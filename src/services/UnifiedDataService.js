/**
 * UnifiedDataService.js
 * 
 * A unified service for managing both topic shells and flashcards in a single source of truth
 * Now updated to use the new unified data model
 */

import UnifiedDataModel from '../utils/UnifiedDataModel';
import { safeParseJSON } from '../utils/DataUtils';

// Color palette for subject/topic assignment
const BRIGHT_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
  "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080"
];

// API constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const KNACK_API_URL = "https://api.knack.com/v1";
const FLASHCARD_OBJECT = "object_102";

// Field mappings
const FIELD_MAPPING = {
  unifiedData: 'field_2979',         // Store the entire unified data model here
  topicLists: 'field_3011',          // Legacy topic lists (reference only)
  colorMapping: 'field_3000',        // Color mapping for subjects
  box1: 'field_2986',                // Box 1 (reference)
  box2: 'field_2987',                // Box 2 (reference)
  box3: 'field_2988',                // Box 3 (reference)
  box4: 'field_2989',                // Box 4 (reference)
  box5: 'field_2990',                // Box 5 (reference)
  lastSaved: 'field_2957'            // Last saved timestamp
};

/**
 * Debug logging helper
 */
const debugLog = (title, data) => {
  console.log(`%c[UnifiedDataService] ${title}`, 'color: #4b0082; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

/**
 * Local helper for parsing JSON with recovery options - renamed to avoid conflict
 * @param {string} jsonString - JSON string to parse
 * @param {Array|Object} defaultValue - Default value if parsing fails
 * @returns {Array|Object} - Parsed JSON or default value
 */
const parseSafeJSON = (jsonString, defaultValue = []) => {
  if (!jsonString) return defaultValue;
  
  try {
    // If it's already an object, just return it
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular JSON parse
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("[UnifiedDataService] Error parsing JSON:", error);
    
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
      console.error("[UnifiedDataService] JSON recovery failed:", secondError);
      return defaultValue;
    }
  }
};

/**
 * Create a greyed-out version of a color for empty topic shells
 * @param {string} baseColor - The base color in hex format
 * @returns {string} - Greyed-out color in hex format
 */
const createGreyedOutColor = (baseColor) => {
  if (!baseColor) return '#e0e0e0'; // Default grey if no color provided
  
  try {
    // Remove # if present
    const hex = baseColor.replace('#', '');
    
    // Convert to RGB - fixed parsing for correct RGB extraction
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Mix with grey (desaturate and lighten)
    const greyMix = 0.7; // 70% grey mix
    const greyR = Math.floor(r * (1 - greyMix) + 200 * greyMix);
    const greyG = Math.floor(g * (1 - greyMix) + 200 * greyMix);
    const greyB = Math.floor(b * (1 - greyMix) + 200 * greyMix);
    
    // Convert back to hex
    return `#${greyR.toString(16).padStart(2, '0')}${greyG.toString(16).padStart(2, '0')}${greyB.toString(16).padStart(2, '0')}`;
  } catch (error) {
    console.error("[UnifiedDataService] Error creating greyed-out color:", error);
    return '#e0e0e0'; // Default grey if there's an error
  }
};

/**
 * Get existing color mapping for subjects
 * @param {Object} userData - User data from Knack
 * @returns {Object} - Map of subject names to colors
 */
const getColorMapping = (userData) => {
  if (!userData[FIELD_MAPPING.colorMapping]) return {};
  
  try {
    return parseSafeJSON(userData[FIELD_MAPPING.colorMapping], {});
  } catch (error) {
    console.error("[UnifiedDataService] Error parsing color mapping:", error);
    return {};
  }
};

/**
 * Create or update color mapping
 * @param {Object} userData - User data from Knack
 * @param {Object} colorMap - Map of subject names to colors
 * @returns {string} - Stringified color mapping
 */
const updateColorMapping = (userData, subjectColorMap) => {
  const existingMap = getColorMapping(userData);
  const updatedMap = { ...existingMap, ...subjectColorMap };
  return JSON.stringify(updatedMap);
};

/**
 * Generate a unique ID
 * @param {string} prefix - Prefix for the ID ('topic', 'card', etc.)
 * @returns {string} - Unique ID
 */
const generateId = (prefix = 'item') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    console.error("[UnifiedDataService] Error finding user record ID:", error);
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
    debugLog("User data fetched successfully", { fields: Object.keys(userData) });
    return userData;
  } catch (error) {
    console.error("[UnifiedDataService] Error getting user data:", error);
    throw error;
  }
};

/**
 * Load user data with the unified data model
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<Object>} - User data in unified model format
 */
export const loadUserData = async (userId, auth) => {
  try {
    // Get the user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get the user's data
    const userData = await getUserData(recordId, auth);
    
    // Check if unified data exists
    if (userData[FIELD_MAPPING.unifiedData]) {
      // Parse the unified data
      const unifiedData = parseSafeJSON(userData[FIELD_MAPPING.unifiedData], null);
      
      if (unifiedData && unifiedData.version === UnifiedDataModel.SCHEMA_VERSION) {
        debugLog("Loaded unified data", { 
          subjects: unifiedData.subjects.length,
          topics: unifiedData.topics.length,
          cards: unifiedData.cards.length
        });
        
        return {
          recordId,
          unifiedData
        };
      }
    }
    
    // If no unified data, convert from old format
    const oldCards = userData[FIELD_MAPPING.cardBankData] 
      ? parseSafeJSON(userData[FIELD_MAPPING.cardBankData], [])
      : [];
      
    const colorMapping = userData[FIELD_MAPPING.colorMapping]
      ? parseSafeJSON(userData[FIELD_MAPPING.colorMapping], {})
      : {};
      
    // Convert old format to unified model
    const unifiedData = UnifiedDataModel.convertFromOldFormat(oldCards, colorMapping);
    
    debugLog("Converted from old format", {
      oldCards: oldCards.length,
      subjects: unifiedData.subjects.length,
      topics: unifiedData.topics.length,
      cards: unifiedData.cards.length
    });
    
    return {
      recordId,
      unifiedData,
      oldFormatData: {
        cards: oldCards,
        colorMapping
      }
    };
  } catch (error) {
    console.error("[UnifiedDataService] Error loading user data:", error);
    throw error;
  }
};

/**
 * Save user data with the unified data model
 * @param {string} recordId - Record ID
 * @param {Object} unifiedData - Data in unified model format
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const saveUserData = async (recordId, unifiedData, auth) => {
  try {
    debugLog("Saving unified data", {
      recordId,
      subjects: unifiedData.subjects.length,
      topics: unifiedData.topics.length,
      cards: unifiedData.cards.length
    });
    
    // Update timestamp
    unifiedData.lastUpdated = new Date().toISOString();
    
    // Convert to old format for backward compatibility
    const oldFormatCards = UnifiedDataModel.convertToOldFormat(unifiedData);
    
    // Create color mapping from subjects and topics
    const colorMapping = {};
    unifiedData.subjects.forEach(subject => {
      colorMapping[subject.name] = {
        base: subject.color,
        topics: {}
      };
      
      // Add topic colors
      const topicsForSubject = unifiedData.topics.filter(topic => topic.subjectId === subject.id);
      topicsForSubject.forEach(topic => {
        colorMapping[subject.name].topics[topic.name] = topic.color;
      });
    });
    
    // Prepare update data
    const updateData = {
      [FIELD_MAPPING.unifiedData]: JSON.stringify(unifiedData),
      [FIELD_MAPPING.cardBankData]: JSON.stringify(oldFormatCards),
      [FIELD_MAPPING.colorMapping]: JSON.stringify(colorMapping),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Update the record
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
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update user data: ${await updateResponse.text()}`);
    }
    
    debugLog("Saved unified data successfully", { recordId });
    return true;
  } catch (error) {
    console.error("[UnifiedDataService] Error saving user data:", error);
    return false;
  }
};

/**
 * Add cards to both the unified data model and convert to old format for backward compatibility
 * @param {Object} unifiedData - Current unified data model
 * @param {Array} newCards - New cards in the old format
 * @returns {Object} - Updated unified data model
 */
export const addCardsToUnifiedData = (unifiedData, newCards) => {
  if (!unifiedData || !Array.isArray(newCards) || newCards.length === 0) {
    return unifiedData;
  }
  
  // Create a copy of the unified data
  const updatedData = {
    ...unifiedData,
    subjects: [...unifiedData.subjects],
    topics: [...unifiedData.topics],
    cards: [...unifiedData.cards]
  };
  
  // Create maps for quick lookups
  const subjectMap = new Map();
  updatedData.subjects.forEach(subject => {
    subjectMap.set(subject.name, subject);
  });
  
  const topicMap = new Map();
  updatedData.topics.forEach(topic => {
    const key = `${topic.subjectId}:${topic.name}`;
    topicMap.set(key, topic);
  });
  
  // Process new cards
  newCards.forEach(card => {
    if (!card) return;
    
    const subjectName = card.subject || 'General';
    const topicName = card.topic || 'General';
    
    // Find or create subject
    let subject = updatedData.subjects.find(s => s.name === subjectName);
    if (!subject) {
      subject = UnifiedDataModel.createSubject(subjectName, card.cardColor || '#3cb44b', {
        examBoard: card.examBoard || '',
        examType: card.examType || ''
      });
      updatedData.subjects.push(subject);
      subjectMap.set(subjectName, subject);
    }
    
    // Find or create topic
    const topicKey = `${subject.id}:${topicName}`;
    let topic = null;
    
    for (const t of updatedData.topics) {
      if (t.subjectId === subject.id && t.name === topicName) {
        topic = t;
        break;
      }
    }
    
    if (!topic) {
      topic = UnifiedDataModel.createTopic(topicName, subject.id, null, {
        color: card.cardColor || subject.color,
        fullName: topicName
      });
      updatedData.topics.push(topic);
      topicMap.set(topicKey, topic);
    }
    
    // Create the new card in unified format
    const newCard = UnifiedDataModel.createCard(
      card.question || card.front || '',
      card.answer || card.back || '',
      topic.id,
      subject.id,
      {
        subject: subjectName,
        topic: topicName,
        examBoard: card.examBoard || '',
        examType: card.examType || '',
        detailedAnswer: card.detailedAnswer || '',
        additionalInfo: card.additionalInfo || '',
        questionType: card.questionType || 'short_answer',
        options: card.options || [],
        savedOptions: card.savedOptions || card.options || [],
        correctAnswer: card.correctAnswer || '',
        cardColor: card.cardColor || card.color || subject.color,
        textColor: card.textColor || '',
        boxNum: card.boxNum || 1
      }
    );
    
    // Preserve original ID if it exists
    if (card.id) {
      newCard.id = card.id;
    }
    
    // Add card to unified data
    updatedData.cards.push(newCard);
    
    // Update topic's cards array and isEmpty flag
    topic.cards.push(newCard.id);
    topic.isEmpty = false;
    topic.updated = new Date().toISOString();
  });
  
  // Update lastUpdated timestamp
  updatedData.lastUpdated = new Date().toISOString();
  
  return updatedData;
};

/**
 * Create a backup of the unified data in localStorage
 * @param {Object} unifiedData - Unified data model
 * @param {string} key - Storage key
 */
export const backupToLocalStorage = (unifiedData, key = 'unified_data_backup') => {
  try {
    const timestamp = new Date().toISOString();
    const backup = {
      timestamp,
      data: unifiedData
    };
    
    localStorage.setItem(key, JSON.stringify(backup));
    console.log(`[UnifiedDataService] Backed up unified data to localStorage (${unifiedData.cards.length} cards)`);
    return true;
  } catch (error) {
    console.error('[UnifiedDataService] Error backing up to localStorage:', error);
    return false;
  }
};

/**
 * Restore unified data from localStorage backup
 * @param {string} key - Storage key
 * @returns {Object|null} - Restored data or null if backup not found
 */
export const restoreFromLocalStorage = (key = 'unified_data_backup') => {
  try {
    const backupJson = localStorage.getItem(key);
    if (!backupJson) return null;
    
    const backup = parseSafeJSON(backupJson, null);
    if (!backup || !backup.data) return null;
    
    console.log(`[UnifiedDataService] Restored unified data from localStorage (${backup.data.cards.length} cards)`);
    return backup.data;
  } catch (error) {
    console.error('[UnifiedDataService] Error restoring from localStorage:', error);
    return null;
  }
};

/**
 * Save topic shells to the unified data model
 * @param {Array} topicShells - Array of topic shells to save
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const saveTopicShells = async (topicShells, userId, auth) => {
  try {
    if (!Array.isArray(topicShells) || topicShells.length === 0) {
      console.log("[UnifiedDataService] No topic shells to save");
      return true; // Nothing to do, so technically successful
    }
    
    debugLog("Saving topic shells", { 
      count: topicShells.length, 
      userId 
    });
    
    // Get the user's record ID
    let recordId;
    try {
      // First try to get recordId from API
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
          recordId = userRecord.id;
          debugLog("Found record ID", { recordId });
        } else {
          throw new Error(`No record found for user ID: ${userId}`);
        }
      } else {
        throw new Error("No records returned from Knack API");
      }
    } catch (error) {
      console.error("[UnifiedDataService] Error finding user record ID:", error);
      return false;
    }
    
    // Get the user's current data
    let existingData;
    try {
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

      existingData = await getResponse.json();
    } catch (error) {
      console.error("[UnifiedDataService] Error getting user data:", error);
      return false;
    }
    
    // Process the existing card bank data to extract cards
    let existingBankData = [];
    if (existingData[FIELD_MAPPING.cardBankData]) {
      try {
        existingBankData = parseSafeJSON(existingData[FIELD_MAPPING.cardBankData], []);
      } catch (error) {
        console.error("[UnifiedDataService] Error parsing existing bank data:", error);
        existingBankData = [];
      }
    }
    
    // Split existing data into topic shells and cards
    const existingTopicShells = existingBankData.filter(item => item.type === 'topic');
    const existingCards = existingBankData.filter(item => item.type !== 'topic');
    
    debugLog("Split existing data", {
      totalItems: existingBankData.length,
      existingTopics: existingTopicShells.length,
      existingCards: existingCards.length
    });
    
    // Create a map of existing topic shells by ID for quick lookup
    const existingTopicMap = new Map();
    existingTopicShells.forEach(topic => {
      existingTopicMap.set(topic.id, topic);
    });
    
    // Process the new topic shells, updating existing ones if they exist
    const updatedTopicShells = [];
    topicShells.forEach(newTopic => {
      if (existingTopicMap.has(newTopic.id)) {
        // Update existing topic shell
        const existingTopic = existingTopicMap.get(newTopic.id);
        existingTopicMap.delete(newTopic.id); // Remove from map as we've processed it
        
        // Preserve cards array from existing topic
        updatedTopicShells.push({
          ...newTopic,
          cards: existingTopic.cards || [],
          updated: new Date().toISOString()
        });
      } else {
        // Add new topic shell
        updatedTopicShells.push({
          ...newTopic,
          updated: new Date().toISOString()
        });
      }
    });
    
    // Add any remaining existing topic shells that weren't updated
    existingTopicMap.forEach(remainingTopic => {
      updatedTopicShells.push(remainingTopic);
    });
    
    // Combine updated topic shells with existing cards
    const updatedBankData = [...updatedTopicShells, ...existingCards];
    
    debugLog("Updated bank data", {
      totalItems: updatedBankData.length,
      updatedTopics: updatedTopicShells.length,
      existingCards: existingCards.length
    });
    
    // Update the record
    try {
      const updateUrl = `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`;
      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY,
          "Authorization": `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          [FIELD_MAPPING.cardBankData]: JSON.stringify(updatedBankData),
          [FIELD_MAPPING.lastSaved]: new Date().toISOString()
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update user data: ${await updateResponse.text()}`);
      }

      debugLog("Topic shells saved successfully", {
        count: updatedTopicShells.length,
        recordId
      });
      
      return true;
    } catch (error) {
      console.error("[UnifiedDataService] Error updating user data:", error);
      return false;
    }
  } catch (error) {
    console.error("[UnifiedDataService] Error saving topic shells:", error);
    return false;
  }
};

export default {
  loadUserData,
  saveUserData,
  addCardsToUnifiedData,
  backupToLocalStorage,
  restoreFromLocalStorage,
  saveTopicShells
};
