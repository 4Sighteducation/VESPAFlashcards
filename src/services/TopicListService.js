/**
 * TopicListService.js
 * 
 * A dedicated service for handling topic list operations.
 * This service ensures that topic lists are saved to and retrieved from Knack field_3011
 * without interfering with other fields like field_2979 (flashcards).
 */

// API constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const KNACK_API_URL = "https://api.knack.com/v1";
const FLASHCARD_OBJECT = "object_102";

// Field mappings - only the fields we need to work with
const FIELD_MAPPING = {
  topicLists: 'field_3011',       // Topic lists JSON
  topicMetadata: 'field_3030',    // Topic metadata JSON
  lastSaved: 'field_2957'         // Last saved timestamp
};

/**
 * Debug logging helper
 */
const debugLog = (title, data) => {
  console.log(`%c[TopicListService] ${title}`, 'color: #6600cc; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

/**
 * Safely parse JSON with recovery options
 * @param {string} jsonString - JSON string to parse
 * @param {Array|Object} defaultValue - Default value if parsing fails
 * @returns {Array|Object} - Parsed JSON or default value
 */
const safeParseJSON = (jsonString, defaultValue = []) => {
  if (!jsonString) return defaultValue;
  
  try {
    // If it's already an object, just return it
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular JSON parse
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("[TopicListService] Error parsing JSON:", error);
    
    // Try recovery methods for common JSON issues
    try {
      // Try to clean up the JSON string
      const cleaned = jsonString
        .replace(/\\"/g, '"')        // Fix escaped quotes
        .replace(/"\s+/g, '"')       // Remove whitespace after quotes
        .replace(/\s+"/g, '"')       // Remove whitespace before quotes
        .replace(/,\s*}/g, '}')      // Remove trailing commas in objects
        .replace(/,\s*\]/g, ']');    // Remove trailing commas in arrays
        
      return JSON.parse(cleaned);
    } catch (secondError) {
      console.error("[TopicListService] JSON recovery failed:", secondError);
      return defaultValue;
    }
  }
};

/**
 * Generate a unique ID for a topic or list
 * @param {string} prefix - Prefix for the ID ('topic' or 'list')
 * @returns {string} - Unique ID
 */
const generateId = (prefix = 'topic') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Format topics properly for saving
 * @param {Array} topics - Array of topic objects
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @returns {Object} - Formatted topic list object
 */
const formatTopicList = (topics, subject, examBoard, examType) => {
  // Ensure topics have the required properties
  const formattedTopics = topics.map(topic => ({
    id: topic.id || generateId('topic'),
    name: typeof topic === 'string' ? topic : (topic.name || `Unknown Topic`)
  }));
  
  return {
    id: generateId('list'),
    subject,
    examBoard,
    examType,
    topics: formattedTopics,
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Validate topic list structure
 * @param {Array} topicLists - Topic lists to validate
 * @returns {Object} - Validation result { valid, errors }
 */
const validateTopicLists = (topicLists) => {
  const result = {
    valid: true,
    errors: []
  };
  
  if (!Array.isArray(topicLists)) {
    result.valid = false;
    result.errors.push("Topic lists is not an array");
    return result;
  }
  
  topicLists.forEach((list, index) => {
    // Check required fields
    if (!list.id) {
      result.valid = false;
      result.errors.push(`List ${index} missing id`);
    }
    
    if (!list.subject) {
      result.valid = false;
      result.errors.push(`List ${index} missing subject`);
    }
    
    if (!list.examBoard) {
      result.valid = false;
      result.errors.push(`List ${index} missing examBoard`);
    }
    
    if (!list.examType) {
      result.valid = false;
      result.errors.push(`List ${index} missing examType`);
    }
    
    // Validate topics array
    if (!Array.isArray(list.topics)) {
      result.valid = false;
      result.errors.push(`List ${index} topics is not an array`);
    } else {
      // Check each topic
      list.topics.forEach((topic, topicIndex) => {
        if (typeof topic !== 'object') {
          result.valid = false;
          result.errors.push(`Topic ${topicIndex} in list ${index} is not an object`);
        } else if (!topic.id && !topic.name) {
          result.valid = false;
          result.errors.push(`Topic ${topicIndex} in list ${index} missing required fields`);
        }
      });
    }
  });
  
  return result;
};

/**
 * Get user's record ID from Knack
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<string>} - Record ID
 */
const getUserRecordId = async (userId, auth) => {
  try {
    debugLog("Looking up record ID for user", { userId });
    
    const searchUrl = `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records`;
    const searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Knack-Application-ID": KNACK_APP_ID,
        "X-Knack-REST-API-Key": KNACK_API_KEY,
        "Authorization": `Bearer ${auth.token}`
      }
    });

    if (!searchResponse.ok) {
      throw new Error(`Failed to search for user record: ${await searchResponse.text()}`);
    }

    const allRecords = await searchResponse.json();
    
    // Find the record matching this user ID
    if (allRecords && allRecords.records) {
      const userRecord = allRecords.records.find(record => 
        record.field_2954 === userId || 
        (record.field_2958 && record.field_2958 === auth.email)
      );

      if (userRecord) {
        debugLog("Found record ID", { recordId: userRecord.id });
        return userRecord.id;
      }
    }

    throw new Error(`No record found for user ID: ${userId}`);
  } catch (error) {
    console.error("[TopicListService] Error finding user record ID:", error);
    throw error;
  }
};

/**
 * Get user's complete data from Knack
 * @param {string} recordId - Record ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<Object>} - User data
 */
const getUserData = async (recordId, auth) => {
  try {
    debugLog("Fetching user data", { recordId });
    
    const getUrl = `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`;
    const getResponse = await fetch(getUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Knack-Application-ID": KNACK_APP_ID,
        "X-Knack-REST-API-Key": KNACK_API_KEY,
        "Authorization": `Bearer ${auth.token}`
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to get user data: ${await getResponse.text()}`);
    }

    const userData = await getResponse.json();
    debugLog("User data fetched successfully", { recordId });
    return userData;
  } catch (error) {
    console.error("[TopicListService] Error getting user data:", error);
    throw error;
  }
};

/**
 * Save topic list with retry mechanism
 * @param {string} recordId - Record ID
 * @param {Object} updateData - Data to update
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
const saveWithRetry = async (recordId, updateData, auth) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      debugLog(`Save attempt ${retryCount + 1}/${maxRetries + 1}`, {
        recordId,
        hasTopicLists: !!updateData[FIELD_MAPPING.topicLists]
      });
      
      const updateUrl = `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`;
      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY,
          "Authorization": `Bearer ${auth.token}`
        },
        body: JSON.stringify(updateData)
      });
      
      if (updateResponse.ok) {
        const result = await updateResponse.json();
        debugLog("Save successful", { recordId: result.id });
        
        // Verify the save immediately
        await verifyTopicListSave(recordId, updateData[FIELD_MAPPING.topicLists], auth);
        
        return true;
      }
      
      // If we get here, the request failed but didn't throw
      const errorData = await updateResponse.json().catch(() => ({ message: "Unknown error" }));
      console.error(`[TopicListService] Save attempt ${retryCount + 1}/${maxRetries + 1} failed:`, errorData);
      
      // Increment retry count
      retryCount++;
      
      // Wait before retrying (exponential backoff)
      if (retryCount <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
      }
    } catch (error) {
      console.error(`[TopicListService] Save attempt ${retryCount + 1}/${maxRetries + 1} failed with exception:`, error);
      retryCount++;
      
      // Wait before retrying
      if (retryCount <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
      }
    }
  }
  
  // All retries failed
  return false;
};

/**
 * Verify that topic lists were saved correctly
 * @param {string} recordId - Record ID
 * @param {string} topicListsData - Topic lists JSON string
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
const verifyTopicListSave = async (recordId, topicListsData, auth) => {
  try {
    debugLog("Verifying topic list save", { recordId });
    
    // Wait to ensure data has been committed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get the user data again to verify
    const userData = await getUserData(recordId, auth);
    
    // Check if the topic lists field exists and has our data
    if (userData && userData[FIELD_MAPPING.topicLists]) {
      const savedTopicLists = safeParseJSON(userData[FIELD_MAPPING.topicLists], []);
      const originalTopicLists = safeParseJSON(topicListsData, []);
      
      if (Array.isArray(savedTopicLists) && savedTopicLists.length > 0) {
        debugLog("Verification successful", {
          savedCount: savedTopicLists.length,
          originalCount: Array.isArray(originalTopicLists) ? originalTopicLists.length : 0
        });
        return true;
      } else {
        console.error("[TopicListService] Verification failed: Topic lists empty or malformed");
        return false;
      }
    } else {
      console.error("[TopicListService] Verification failed: No topic lists field found");
      return false;
    }
  } catch (error) {
    console.error("[TopicListService] Error verifying topic list save:", error);
    return false;
  }
};

/**
 * Save topic list with field preservation
 * @param {Array} topics - Array of topic objects to save
 * @param {string} subject - Subject
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
const saveTopicList = async (topics, subject, examBoard, examType, userId, auth) => {
  try {
    if (!Array.isArray(topics) || !userId || !auth?.token) {
      throw new Error("Missing required parameters for saving topics");
    }
    
    debugLog("Saving topic list", {
      subject,
      examBoard,
      examType,
      topicCount: topics.length
    });
    
    // Get the user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get existing user data to preserve fields
    const userData = await getUserData(recordId, auth);
    
    // Get current topic lists or initialize empty array
    let currentTopicLists = [];
    if (userData[FIELD_MAPPING.topicLists]) {
      currentTopicLists = safeParseJSON(userData[FIELD_MAPPING.topicLists], []);
    }
    
    // Create or update topic list for this subject/exam board/exam type
    const formattedTopicList = formatTopicList(topics, subject, examBoard, examType);
    
    // Find existing list for this combination
    const existingIndex = currentTopicLists.findIndex(list => 
      list.subject === subject && 
      list.examBoard === examBoard && 
      list.examType === examType
    );
    
    // Update or add the list
    if (existingIndex >= 0) {
      // Preserve the original ID
      formattedTopicList.id = currentTopicLists[existingIndex].id;
      currentTopicLists[existingIndex] = formattedTopicList;
    } else {
      currentTopicLists.push(formattedTopicList);
    }
    
    // Validate before saving
    const validation = validateTopicLists(currentTopicLists);
    if (!validation.valid) {
      console.error("[TopicListService] Topic list validation failed:", validation.errors);
      // Continue anyway with best effort
    }
    
    // Prepare the update data - ONLY updating topic-related fields
    const updateData = {
      [FIELD_MAPPING.topicLists]: JSON.stringify(currentTopicLists),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Add metadata if available in the original data
    if (userData[FIELD_MAPPING.topicMetadata]) {
      updateData[FIELD_MAPPING.topicMetadata] = userData[FIELD_MAPPING.topicMetadata];
    }
    
    // Save the data with retry logic
    const saveResult = await saveWithRetry(recordId, updateData, auth);
    
    debugLog("Save result", { 
      success: saveResult,
      recordId,
      timestamp: new Date().toISOString()
    });
    
    // If save was successful and via the posting message mechanism, also send a message to parent window
    // This ensures both saving channels are notified
    if (saveResult && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: "TOPIC_LISTS_UPDATED",
          data: {
            topicLists: currentTopicLists,
            subject,
            examBoard,
            examType
          }
        }, "*");
      } catch (error) {
        console.error("[TopicListService] Error sending update message to parent:", error);
      }
    }
    
    return saveResult;
  } catch (error) {
    console.error("[TopicListService] Error saving topic list:", error);
    return false;
  }
};

/**
 * Load topic lists for a specific subject/exam board/exam type
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @param {string} subject - Optional subject filter
 * @param {string} examBoard - Optional exam board filter
 * @param {string} examType - Optional exam type filter
 * @returns {Promise<Array>} - Topic lists or filtered topic list
 */
const loadTopicLists = async (userId, auth, subject = null, examBoard = null, examType = null) => {
  try {
    debugLog("Loading topic lists", { userId, subject, examBoard, examType });
    
    // Get the user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get user data
    const userData = await getUserData(recordId, auth);
    
    // Parse topic lists
    let topicLists = [];
    if (userData[FIELD_MAPPING.topicLists]) {
      topicLists = safeParseJSON(userData[FIELD_MAPPING.topicLists], []);
    }
    
    // If no filters, return all topic lists
    if (!subject && !examBoard && !examType) {
      return topicLists;
    }
    
    // Apply filters if provided
    if (subject || examBoard || examType) {
      return topicLists.filter(list => 
        (!subject || list.subject === subject) &&
        (!examBoard || list.examBoard === examBoard) &&
        (!examType || list.examType === examType)
      );
    }
    
    return topicLists;
  } catch (error) {
    console.error("[TopicListService] Error loading topic lists:", error);
    return [];
  }
};

// Export all the functions
export {
  saveTopicList,
  loadTopicLists,
  formatTopicList,
  validateTopicLists,
  generateId,
  safeParseJSON
};
