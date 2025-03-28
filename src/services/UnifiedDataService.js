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
  cardBankData: 'field_2979',        // FIXED: Added missing mapping for card bank data
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
    // First, fix multiple choice cards before saving
    const fixedData = fixMultipleChoiceInUnifiedData(unifiedData);
    
    debugLog("Saving unified data", {
      recordId,
      subjects: fixedData.subjects.length,
      topics: fixedData.topics.length,
      cards: fixedData.cards.length
    });
    
    // Update timestamp
    fixedData.lastUpdated = new Date().toISOString();
    
    // Convert to old format for backward compatibility
    const oldFormatCards = UnifiedDataModel.convertToOldFormat(fixedData);
    
    // Create color mapping from subjects and topics
    const colorMapping = {};
    fixedData.subjects.forEach(subject => {
      colorMapping[subject.name] = {
        base: subject.color,
        topics: {}
      };
      
      // Add topic colors
      const topicsForSubject = fixedData.topics.filter(topic => topic.subjectId === subject.id);
      topicsForSubject.forEach(topic => {
        colorMapping[subject.name].topics[topic.name] = topic.color;
      });
    });
    
    // Prepare update data
    const updateData = {
      [FIELD_MAPPING.unifiedData]: JSON.stringify(fixedData),
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
 * Detect if a card is multiple choice by examining content
 * @param {Object} card - The card to examine
 * @returns {boolean} - Whether the card is multiple choice
 */
const isMultipleChoiceCard = (card) => {
  if (!card) return false;
  
  // Check explicit indicators
  if (card.questionType === 'multiple_choice') return true;
  if (card.type === 'multiple_choice') return true;
  
  // Check for options
  if (card.options && Array.isArray(card.options) && card.options.length > 0) return true;
  if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) return true;
  
  // Check answer text patterns
  if (card.answer && typeof card.answer === 'string') {
    // Look for "Correct Answer: x)" pattern
    if (card.answer.match(/Correct Answer:\s*[a-e]\)/i)) return true;
    
    // Look for option lettering
    if (card.answer.match(/[a-e]\)\s*[A-Za-z]/)) return true;
  }
  
  return false;
};

/**
 * Fix type and options for multiple choice cards before saving
 * @param {Array} cards - Array of cards to fix
 * @returns {Array} - Fixed cards
 */
export const fixMultipleChoiceCards = (cards) => {
  if (!Array.isArray(cards)) return cards;
  
  return cards.map(card => {
    if (!card) return card;
    
    // Deep clone to avoid mutating original
    const fixedCard = { ...card };
    
    // Check if this is a multiple choice card
    if (isMultipleChoiceCard(fixedCard)) {
      // Set the questionType explicitly
      fixedCard.questionType = 'multiple_choice';
      
      // Ensure options are present
      if (!fixedCard.options || !Array.isArray(fixedCard.options) || fixedCard.options.length === 0) {
        // Try to restore from savedOptions
        if (fixedCard.savedOptions && Array.isArray(fixedCard.savedOptions) && fixedCard.savedOptions.length > 0) {
          fixedCard.options = [...fixedCard.savedOptions];
          console.log(`[UnifiedDataService] Restored options from savedOptions for card ${fixedCard.id}`);
        } else if (fixedCard.answer && typeof fixedCard.answer === 'string') {
          // Try to extract from answer
          const match = fixedCard.answer.match(/Correct Answer:\s*([a-e])\)/i);
          
          if (match) {
            const correctLetter = match[1].toLowerCase();
            const letters = ['a', 'b', 'c', 'd', 'e'];
            const options = [];
            
            // Create options with the correct one marked
            letters.slice(0, 4).forEach(letter => {
              options.push({
                text: letter === correctLetter ? 
                      (fixedCard.detailedAnswer || 'Correct option') : 
                      `Option ${letter.toUpperCase()}`,
                isCorrect: letter === correctLetter
              });
            });
            
            fixedCard.options = options;
            fixedCard.savedOptions = [...options];
            console.log(`[UnifiedDataService] Created options from answer pattern for card ${fixedCard.id}`);
          }
        }
      }
      
      // Always backup options to savedOptions
      if (fixedCard.options && Array.isArray(fixedCard.options) && fixedCard.options.length > 0) {
        fixedCard.savedOptions = [...fixedCard.options];
      }
    }
    
    return fixedCard;
  });
};

/**
 * Fix and process multiple choice cards in the unified data model
 * @param {Object} unifiedData - The unified data model
 * @returns {Object} - Updated unified data model
 */
export const fixMultipleChoiceInUnifiedData = (unifiedData) => {
  if (!unifiedData || !unifiedData.cards || !Array.isArray(unifiedData.cards)) {
    return unifiedData;
  }
  
  // Create a deep copy
  const updatedData = {
    ...unifiedData,
    cards: fixMultipleChoiceCards(unifiedData.cards),
    lastUpdated: new Date().toISOString()
  };
  
  return updatedData;
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
        debugLog("Successfully parsed existing card bank data", { 
          length: existingBankData.length,
          fieldName: FIELD_MAPPING.cardBankData
        });
      } catch (error) {
        console.error("[UnifiedDataService] Error parsing existing bank data:", error);
        console.error("Raw data was:", existingData[FIELD_MAPPING.cardBankData]?.substring(0, 100) + "...");
        existingBankData = [];
      }
    } else {
      console.log("[UnifiedDataService] No existing card bank data found in field_2979");
    }
    
    // Split existing data into topic shells and cards
    const existingTopicShells = Array.isArray(existingBankData) 
      ? existingBankData.filter(item => item && item.type === 'topic')
      : [];
    const existingCards = Array.isArray(existingBankData)
      ? existingBankData.filter(item => item && item.type !== 'topic')
      : [];
    
    debugLog("Split existing data", {
      totalItems: existingBankData.length,
      existingTopics: existingTopicShells.length,
      existingCards: existingCards.length
    });
    
    // Create a map of existing topic shells by ID for quick lookup
    const existingTopicMap = new Map();
    existingTopicShells.forEach(topic => {
      if (topic && topic.id) {
        existingTopicMap.set(topic.id, topic);
      }
    });
    
    // Create a map of new topic shells by subject+examBoard+examType+name for duplicate detection
    const newTopicsByKey = new Map();
    topicShells.forEach(newTopic => {
      if (newTopic) {
        const key = `${newTopic.subject}|${newTopic.examBoard}|${newTopic.examType}|${newTopic.name}`;
        newTopicsByKey.set(key, newTopic);
      }
    });
    
    // Also check existing topics against this key to prevent duplicate topics with different IDs
    const existingTopicKeys = new Set();
    existingTopicShells.forEach(topic => {
      if (topic) {
        const key = `${topic.subject}|${topic.examBoard}|${topic.examType}|${topic.name}`;
        existingTopicKeys.add(key);
      }
    });
    
    // Process the new topic shells, updating existing ones if they exist
    const updatedTopicShells = [];
    topicShells.forEach(newTopic => {
      if (!newTopic) return; // Skip invalid topics
      
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
        // Check if we already have a topic with the same subject+examBoard+examType+name
        const key = `${newTopic.subject}|${newTopic.examBoard}|${newTopic.examType}|${newTopic.name}`;
        if (existingTopicKeys.has(key)) {
          console.log(`[UnifiedDataService] Topic already exists with key ${key}, skipping duplicate`);
          // We don't add this to updatedTopicShells to avoid duplicates
        } else {
          // Add new topic shell
          updatedTopicShells.push({
            ...newTopic,
            updated: new Date().toISOString()
          });
          // Add to our set to prevent adding more duplicates
          existingTopicKeys.add(key);
        }
      }
    });
    
    // Add any remaining existing topic shells that weren't updated
    existingTopicMap.forEach(remainingTopic => {
      if (remainingTopic) {
        updatedTopicShells.push(remainingTopic);
      }
    });
    
    // Safety check - ensure all topics have required fields
    const validatedTopicShells = updatedTopicShells.filter(topic => {
      if (!topic || !topic.id) {
        console.error("[UnifiedDataService] Invalid topic - missing ID, skipping", topic);
        return false;
      }
      return true;
    }).map(topic => {
      // Ensure all topics have required fields
      return {
        ...topic,
        type: topic.type || 'topic',
        cards: topic.cards || [],
        isShell: topic.isShell || true,
        isEmpty: topic.isEmpty === false ? false : (topic.isEmpty || true),
        created: topic.created || new Date().toISOString(),
        updated: new Date().toISOString()
      };
    });
    
    // Find cards associated with each topic and update the topic shells
    // This ensures topics properly track their cards
    const topicShellsWithCards = validatedTopicShells.map(topic => {
      // Find all cards with this topicId
      const associatedCards = existingCards.filter(card => card.topicId === topic.id);
      
      if (associatedCards.length > 0) {
        // This topic has associated cards, update it
        return {
          ...topic,
          isEmpty: false,
          cards: associatedCards.map(card => card.id),
          updated: new Date().toISOString()
        };
      }
      
      return topic;
    });
    
    // Combine updated topic shells with existing cards
    const updatedBankData = [...topicShellsWithCards, ...existingCards];
    
    debugLog("Updated bank data", {
      totalItems: updatedBankData.length,
      updatedTopics: validatedTopicShells.length,
      existingCards: existingCards.length
    });
    
    // Update the record
    try {
      const updateData = {};
      updateData[FIELD_MAPPING.cardBankData] = JSON.stringify(updatedBankData);
      updateData[FIELD_MAPPING.lastSaved] = new Date().toISOString();
      
      debugLog("Field mapping being used", { 
        cardBankData: FIELD_MAPPING.cardBankData,
        lastSaved: FIELD_MAPPING.lastSaved 
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

      if (!updateResponse.ok) {
        throw new Error(`Failed to update user data: ${await updateResponse.text()}`);
      }

      debugLog("Topic shells saved successfully", {
        count: validatedTopicShells.length,
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
  saveTopicShells,
  fixMultipleChoiceCards,
  fixMultipleChoiceInUnifiedData
};
