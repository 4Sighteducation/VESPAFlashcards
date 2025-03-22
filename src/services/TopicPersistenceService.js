/**
 * TopicPersistenceService.js
 * 
 * Centralized service to handle all topic list persistence across the application.
 * This ensures consistent saving/loading of topic lists to/from Knack field_3011.
 */

// API keys and constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";

// Cache for record IDs to avoid repeated lookups
const recordIdCache = new Map();

/**
 * Debug logging helper
 * @param {string} title - Log title
 * @param {any} data - Data to log
 * @returns {any} - The data (for chaining)
 */
const debugLog = (title, data) => {
  console.log(`%c[TopicPersistenceService] ${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

/**
 * Find a user's record ID in Knack
 * @param {string} userId - User ID to find
 * @param {Object} auth - Auth object containing token
 * @returns {Promise<string>} - Record ID
 */
export const findUserRecordId = async (userId, auth) => {
  if (!userId || !auth) {
    throw new Error("Missing userId or auth for record lookup");
  }

  // Check cache first
  if (recordIdCache.has(userId)) {
    return recordIdCache.get(userId);
  }

  try {
    debugLog("Looking up record ID for user", { userId });
    
    // Search for the user record
    const searchUrl = `https://api.knack.com/v1/objects/object_102/records`;
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
      const errorText = await searchResponse.text();
      throw new Error(`Failed to search for user record: ${errorText}`);
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
        
        // Cache the record ID
        recordIdCache.set(userId, userRecord.id);
        return userRecord.id;
      }
    }

    throw new Error(`No record found for user ID: ${userId}`);
  } catch (error) {
    console.error("Error finding user record ID:", error);
    throw error;
  }
};

/**
 * Get user's complete data from Knack
 * @param {string} recordId - Record ID to fetch
 * @param {Object} auth - Auth object containing token
 * @returns {Promise<Object>} - Complete user data
 */
export const getUserData = async (recordId, auth) => {
  if (!recordId || !auth) {
    throw new Error("Missing recordId or auth for data lookup");
  }

  try {
    debugLog("Fetching user data", { recordId });
    
    const getUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
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
      const errorText = await getResponse.text();
      throw new Error(`Failed to get user data: ${errorText}`);
    }

    const userData = await getResponse.json();
    debugLog("User data fetched successfully", { fields: Object.keys(userData) });
    return userData;
  } catch (error) {
    console.error("Error getting user data:", error);
    throw error;
  }
};

/**
 * Safely parse JSON with recovery options
 * @param {string} jsonString - JSON string to parse
 * @param {Array|Object} defaultValue - Default value if parsing fails
 * @returns {Array|Object} - Parsed JSON or default value
 */
export const safeParseJSON = (jsonString, defaultValue = []) => {
  if (!jsonString) return defaultValue;
  
  try {
    // If it's already an object, just return it
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular JSON parse
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    
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
      console.error("JSON recovery failed:", secondError);
      
      // Return default value
      return defaultValue;
    }
  }
};

/**
 * Save topic lists to Knack with field preservation
 * @param {Array} topicLists - Array of topic lists to save
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object containing token
 * @param {Array} metadata - Optional metadata to save
 * @returns {Promise<boolean>} - Success status
 */
export const saveTopicLists = async (topicLists, userId, auth, metadata = null) => {
  try {
    if (!auth || !userId) {
      console.error("Missing auth or userId for saving topic lists");
      return false;
    }

    if (!Array.isArray(topicLists)) {
      console.error("Invalid topics format:", topicLists);
      return false;
    }

    debugLog("Saving topic lists", { 
      count: topicLists.length, 
      userId,
      hasMetadata: !!metadata
    });

    // Find the user's record ID
    const recordId = await findUserRecordId(userId, auth);

    // Get existing data to preserve fields
    const existingData = await getUserData(recordId, auth);

    // Create the update data with field preservation
    const updateData = {
      field_3011: JSON.stringify(topicLists),
      field_2957: new Date().toISOString() // Last saved timestamp
    };

    // Add metadata if provided
    if (metadata && Array.isArray(metadata)) {
      updateData.field_3030 = JSON.stringify(metadata);
    }

    // Preserve existing fields
    if (existingData) {
      if (existingData.field_2979) updateData.field_2979 = existingData.field_2979; // Cards
      if (existingData.field_2986) updateData.field_2986 = existingData.field_2986; // Box 1
      if (existingData.field_2987) updateData.field_2987 = existingData.field_2987; // Box 2
      if (existingData.field_2988) updateData.field_2988 = existingData.field_2988; // Box 3
      if (existingData.field_2989) updateData.field_2989 = existingData.field_2989; // Box 4
      if (existingData.field_2990) updateData.field_2990 = existingData.field_2990; // Box 5
      if (existingData.field_3000) updateData.field_3000 = existingData.field_3000; // Color mapping
      
      // Only preserve metadata if not explicitly overwriting
      if (!metadata && existingData.field_3030) {
        updateData.field_3030 = existingData.field_3030;
      }
    }

    // Save to Knack
    const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
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
      debugLog("Topic lists saved successfully", { count: topicLists.length });
      return true;
    } else {
      const errorData = await updateResponse.json().catch(e => ({ message: "Unknown error" }));
      console.error("Failed to save topic lists:", errorData);
      return false;
    }
  } catch (error) {
    console.error("Error in saveTopicLists:", error);
    return false;
  }
};

/**
 * Load topic lists from Knack
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object containing token
 * @returns {Promise<Object>} - Topic lists and metadata
 */
export const loadTopicLists = async (userId, auth) => {
  try {
    if (!auth || !userId) {
      console.log("No authentication data or userId, skipping Knack load");
      return { topicLists: [], metadata: [] };
    }
    
    debugLog("Loading topic lists", { userId });
    
    // Find the user's record ID
    const recordId = await findUserRecordId(userId, auth);

    // Get user data
    const userData = await getUserData(recordId, auth);
    
    // Result containers
    let topicLists = [];
    let metadata = [];
    
    // Parse topic lists if available
    if (userData && userData.field_3011) {
      try {
        const parsedLists = safeParseJSON(userData.field_3011, []);
        if (Array.isArray(parsedLists)) {
          topicLists = parsedLists;
          debugLog("Loaded topic lists", { count: parsedLists.length });
        }
      } catch (e) {
        console.error("Error parsing topic lists:", e);
      }
    } else {
      console.log("No topic lists found in user data");
    }
    
    // Parse metadata if available
    if (userData && userData.field_3030) {
      try {
        const parsedMetadata = safeParseJSON(userData.field_3030, []);
        if (Array.isArray(parsedMetadata)) {
          metadata = parsedMetadata;
          debugLog("Loaded metadata", { count: parsedMetadata.length });
        }
      } catch (e) {
        console.error("Error parsing metadata:", e);
      }
    } else {
      console.log("No metadata found in user data");
    }
    
    return { topicLists, metadata, userData };
  } catch (error) {
    console.error("Error in loadTopicLists:", error);
    return { topicLists: [], metadata: [] };
  }
};

/**
 * Clear record ID cache (useful when testing)
 */
export const clearRecordIdCache = () => {
  recordIdCache.clear();
};

/**
 * Implement a retry mechanism for API calls
 * @param {Function} apiCall - The API call function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<any>} - Result of the API call
 */
export const withRetry = async (apiCall, maxRetries = 3, delayMs = 1000) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      console.warn(`API call failed (attempt ${attempt}/${maxRetries}):`, error);
      lastError = error;
      
      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
};
