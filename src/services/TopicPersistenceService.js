/**
 * TopicPersistenceService.js
 * 
 * Centralized service to handle all topic list persistence across the application.
 * This service now implements the "single source of truth" architecture by:
 * 1. Saving topic lists to field_3011 (for reference/backward compatibility)
 * 2. Creating topic shells in field_2979 (the new single source of truth)
 */

// Import the UnifiedDataService for topic shell creation
import { saveTopicShells } from './UnifiedDataService';

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
 * Add a centralized token refresh utility
 * @returns {Promise<boolean>} - Success status
 */
export const requestTokenRefresh = async () => {
  console.log("Centralized token refresh requested");
  
  if (window.parent && window.parent !== window) {
    // Send a message to parent requesting token refresh
    window.parent.postMessage({ 
      type: "REQUEST_TOKEN_REFRESH", 
      timestamp: new Date().toISOString() 
    }, "*");
    
    // Return a promise that resolves after waiting for potential refresh
    return new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // No parent frame, can't refresh token
  return Promise.resolve(false);
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

  // Keep track of retry attempts
  let retryCount = 0;
  const maxRetries = 3; // Increased from 2

  while (retryCount <= maxRetries) {
    try {
      debugLog("Looking up record ID for user", { userId, retry: retryCount });
      
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
        
        // Check specifically for authentication errors
        if (searchResponse.status === 403 || errorText.includes("Invalid token")) {
          // Try to request token refresh using our centralized function
          console.warn(`Authentication error on retry ${retryCount}, requesting token refresh`);
          await requestTokenRefresh();
          
          // Increment retry count and try again
          retryCount++;
          continue;
        }
        
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
      console.error(`Error finding user record ID (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      // If this is our last retry, propagate the error
      if (retryCount === maxRetries) {
        // For token errors, add more helpful information
        if (error.message.includes("Invalid token") || error.message.includes("Authentication failed")) {
          // If we're in the iframe, notify the parent about the auth issue
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ 
              type: "AUTH_ERROR", 
              data: { message: "Authentication token expired. Please refresh the page." },
              timestamp: new Date().toISOString() 
            }, "*");
          }
          
          throw new Error(`Authentication error: ${error.message}. Try refreshing the page.`);
        }
        
        throw error;
      }
      
      // Increment retry count
      retryCount++;
      
      // Add a small delay before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount - 1)));
    }
  }

  // This should never be reached due to the throw in the loop, but just in case
  throw new Error(`Failed to find user record ID after ${maxRetries} retries`);
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
      hasMetadata: !!metadata,
      timestamp: new Date().toISOString()
    });

    // Validate topic lists structure before sending to API
    const validationResult = validateTopicLists(topicLists);
    if (!validationResult.valid) {
      console.error("Topic lists validation failed:", validationResult.errors);
      
      // Try to fix common issues with the topic lists
      const fixedTopicLists = fixTopicListsStructure(topicLists);
      debugLog("Fixed topic lists structure", {
        originalCount: topicLists.length,
        fixedCount: fixedTopicLists.length,
        timestamp: new Date().toISOString()
      });
      
      // Replace the original with the fixed version
      topicLists = fixedTopicLists;
    }

    // Find the user's record ID
    const recordId = await findUserRecordId(userId, auth);
    if (!recordId) {
      console.error("Could not find record ID for user:", userId);
      
      // Try API call via postMessage as a fallback
      return await saveViaPostMessage(topicLists, userId, metadata);
    }

    // Get existing data to preserve fields
    const existingData = await getUserData(recordId, auth);
    if (!existingData) {
      console.error("Could not get existing data for user:", userId);
      
      // Try API call via postMessage as a fallback
      return await saveViaPostMessage(topicLists, userId, metadata);
    }

    // Create the update data with field preservation
    const updateData = {
      field_3011: JSON.stringify(topicLists),
      field_2957: new Date().toISOString() // Last saved timestamp
    };

    // Add metadata if provided
    if (metadata && Array.isArray(metadata)) {
      updateData.field_3030 = JSON.stringify(metadata);
    }
    
    // IMPORTANT: Create topic shells in field_2979 (the new single source of truth)
    try {
      // Convert topic lists to topic shells format
      const topicShells = [];
      
      topicLists.forEach(list => {
        if (Array.isArray(list.topics)) {
          list.topics.forEach(topic => {
            // Create a topic shell for each topic
            const topicShell = {
              id: topic.id || `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'topic',
              name: topic.name || topic.topic || 'Unknown Topic',
              subject: list.subject,
              examBoard: list.examBoard,
              examType: list.examType,
              color: topic.color || '#3cb44b', // Default green if no color specified
              cards: [], // Initially empty, will be populated when cards are created
              isShell: true,
              created: new Date().toISOString(),
              updated: new Date().toISOString()
            };
            
            topicShells.push(topicShell);
          });
        }
      });
      
      // If we have topic shells to save, save them to field_2979 using UnifiedDataService
      if (topicShells.length > 0) {
        debugLog("Creating topic shells in field_2979", { 
          count: topicShells.length,
          topicLists: topicLists.length
        });
        
        // This is non-blocking - we don't wait for it to complete
        // If it fails, we still want to save to field_3011 for backward compatibility
        saveTopicShells(topicShells, userId, auth).catch(error => {
          console.error("Error saving topic shells to field_2979:", error);
          // We continue with the normal save process even if this fails
        });
      }
    } catch (error) {
      console.error("Error preparing topic shells:", error);
      // Continue with normal save process even if shell creation fails
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

    // First try direct API save
    try {
      // Save to Knack with retry logic
      const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
      
      // Implement retry mechanism
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount <= maxRetries) {
        try {
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
            debugLog("Topic lists saved successfully (direct API)", { 
              count: topicLists.length,
              recordId
            });
            
            // Also try to save via postMessage for redundancy
            setTimeout(() => {
              saveViaPostMessage(topicLists, userId, metadata).catch(e => {
                // Silently log error - we already have a successful save
                console.log("Redundant save via postMessage failed:", e);
              });
            }, 500);
            
            return true;
          }
          
          // If we get here, the request failed but didn't throw
          const errorData = await updateResponse.json().catch(e => ({ message: "Unknown error" }));
          console.error(`Save attempt ${retryCount + 1}/${maxRetries + 1} failed:`, errorData);
          
          // Increment retry count
          retryCount++;
          
          // Wait before retrying (exponential backoff)
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        } catch (fetchError) {
          console.error(`Save attempt ${retryCount + 1}/${maxRetries + 1} failed with exception:`, fetchError);
          retryCount++;
          
          // Wait before retrying
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }
      }
      
      // All retries failed, try postMessage approach as fallback
      return await saveViaPostMessage(topicLists, userId, metadata);
    } catch (error) {
      console.error("Error saving via direct API:", error);
      
      // Try API call via postMessage as a fallback
      return await saveViaPostMessage(topicLists, userId, metadata);
    }
  } catch (error) {
    console.error("Error in saveTopicLists:", error);
    return false;
  }
};

/**
 * Save topic lists via postMessage to Knack (fallback method)
 * @param {Array} topicLists - Array of topic lists to save
 * @param {string} userId - User ID
 * @param {Array} metadata - Optional metadata to save
 * @returns {Promise<boolean>} - Success status
 */
const saveViaPostMessage = async (topicLists, userId, metadata = null) => {
  debugLog("Attempting to save topic lists via postMessage", {
    count: topicLists.length,
    userId,
    timestamp: new Date().toISOString()
  });
  
  return new Promise((resolve) => {
    // Create the message with preserve fields flag
    const messageData = {
      type: "SAVE_DATA",
      data: {
        recordId: userId,
        userId: userId,
        topicLists: topicLists,
        topicMetadata: metadata || [],
        preserveFields: true // This is crucial to prevent overwriting other fields
      }
    };
    
    // Set up a listener for the response
    const messageHandler = (event) => {
      if (event.data && event.data.type === "SAVE_RESULT") {
        // Remove the event listener once we get a response
        window.removeEventListener("message", messageHandler);
        
        if (event.data.success) {
          console.log(`[${new Date().toISOString()}] Topic list saved successfully via postMessage`);
          resolve(true);
        } else {
          console.error(`[${new Date().toISOString()}] Failed to save topic list via postMessage`);
          resolve(false);
        }
      }
    };
    
    // Add the event listener
    window.addEventListener("message", messageHandler);
    
    // Send message to parent window (Knack)
    if (window.parent) {
      window.parent.postMessage(messageData, "*");
    } else {
      console.error("No parent window found for postMessage");
      resolve(false);
    }
    
    // Set a timeout to handle no response
    setTimeout(() => {
      window.removeEventListener("message", messageHandler);
      console.error(`[${new Date().toISOString()}] No save response received within timeout period`);
      resolve(false);
    }, 10000); // 10-second timeout
  });
};

/**
 * Validate topic lists structure
 * @param {Array} topicLists - Array of topic lists to validate
 * @returns {Object} - Validation result with errors
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
 * Fix common issues with topic lists structure
 * @param {Array} topicLists - Array of topic lists to fix
 * @returns {Array} - Fixed topic lists
 */
const fixTopicListsStructure = (topicLists) => {
  if (!Array.isArray(topicLists)) {
    return [];
  }
  
  // Fix each topic list
  return topicLists.map((list, index) => {
    // Ensure basic structure
    const fixedList = {
      id: list.id || `list_${Date.now()}_${index}`,
      subject: list.subject || "Unknown Subject",
      examBoard: list.examBoard || "Unknown Board",
      examType: list.examType || "Unknown Type",
      lastUpdated: list.lastUpdated || new Date().toISOString()
    };
    
    // Fix topics array
    if (!Array.isArray(list.topics)) {
      fixedList.topics = [];
    } else {
      fixedList.topics = list.topics.map((topic, topicIndex) => {
        // Convert string topics to objects
        if (typeof topic === 'string') {
          return {
            id: `topic_${Date.now()}_${index}_${topicIndex}`,
            name: topic
          };
        }
        
        // Fix object topics
        if (typeof topic === 'object' && topic !== null) {
          return {
            id: topic.id || `topic_${Date.now()}_${index}_${topicIndex}`,
            name: topic.name || topic.topic || `Topic ${topicIndex + 1}`
          };
        }
        
        // Default for invalid topics
        return {
          id: `topic_${Date.now()}_${index}_${topicIndex}`,
          name: `Unknown Topic ${topicIndex + 1}`
        };
      });
    }
    
    return fixedList;
  });
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
    
    try {
      // Try to get the record ID
      let recordId;
      try {
        recordId = await findUserRecordId(userId, auth);
      } catch (error) {
        // If token expired, try to refresh it once and retry
        if (error.message.includes("Authentication") || error.message.includes("Invalid token")) {
          console.log("Auth error finding record ID, trying token refresh");
          await requestTokenRefresh();
          
          // Try again after token refresh
          try {
            recordId = await findUserRecordId(userId, auth);
          } catch (secondError) {
            console.error("Second attempt failed after token refresh:", secondError);
            throw secondError;
          }
        } else {
          throw error;
        }
      }

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
      // Handle authentication errors specifically
      if (error.message.includes("Authentication error") || error.message.includes("Invalid token")) {
        console.warn("Authentication error in loadTopicLists, falling back to local data:", error.message);
        
        // Try to load from localStorage as fallback
        return loadTopicListsFromLocalStorage();
      }
      
      // For other errors, just propagate them
      throw error;
    }
  } catch (error) {
    console.error("Error in loadTopicLists:", error);
    
    // Always return something usable even if there's an error
    return { topicLists: [], metadata: [] };
  }
};

/**
 * Load topic lists from localStorage as a fallback
 * @returns {Object} - Topic lists and metadata from localStorage
 */
const loadTopicListsFromLocalStorage = () => {
  try {
    console.log("Attempting to load topic lists from localStorage");
    
    // Try to load from localStorage
    const topicListsStr = localStorage.getItem('topicLists');
    const metadataStr = localStorage.getItem('topicMetadata');
    
    // Parse topic lists
    let topicLists = [];
    if (topicListsStr) {
      try {
        const parsed = safeParseJSON(topicListsStr, []);
        if (Array.isArray(parsed)) {
          topicLists = parsed;
          console.log(`Loaded ${parsed.length} topic lists from localStorage`);
        }
      } catch (e) {
        console.error("Error parsing topic lists from localStorage:", e);
      }
    }
    
    // Parse metadata
    let metadata = [];
    if (metadataStr) {
      try {
        const parsed = safeParseJSON(metadataStr, []);
        if (Array.isArray(parsed)) {
          metadata = parsed;
          console.log(`Loaded ${parsed.length} topic metadata items from localStorage`);
        }
      } catch (e) {
        console.error("Error parsing topic metadata from localStorage:", e);
      }
    }
    
    return { topicLists, metadata };
  } catch (error) {
    console.error("Error loading from localStorage:", error);
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
