/**
 * UnifiedDataService.js
 * 
 * A unified service for managing both topic shells and flashcards in field_2979.
 * This service implements the "single source of truth" architecture, storing
 * both topic structures and their cards in a single field.
 */

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
  cardBankData: 'field_2979',      // Unified card bank + topic shells
  topicLists: 'field_3011',        // Legacy topic lists (reference only)
  colorMapping: 'field_3000',      // Color mapping for subjects
  box1: 'field_2986',              // Box 1 (reference)
  box2: 'field_2987',              // Box 2 (reference)
  box3: 'field_2988',              // Box 3 (reference)
  box4: 'field_2989',              // Box 4 (reference)
  box5: 'field_2990',              // Box 5 (reference)
  lastSaved: 'field_2957'          // Last saved timestamp
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
    return safeParseJSON(userData[FIELD_MAPPING.colorMapping], {});
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
    debugLog("User data fetched successfully", { recordId });
    return userData;
  } catch (error) {
    console.error("[UnifiedDataService] Error getting user data:", error);
    throw error;
  }
};

/**
 * Save data to Knack with retry mechanism
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
        recordId
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
        return true;
      }
      
      // If we get here, the request failed but didn't throw
      const errorData = await updateResponse.json().catch(() => ({ message: "Unknown error" }));
      console.error(`[UnifiedDataService] Save attempt ${retryCount + 1}/${maxRetries + 1} failed:`, errorData);
      
      // Increment retry count
      retryCount++;
      
      // Wait before retrying (exponential backoff)
      if (retryCount <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
      }
    } catch (error) {
      console.error(`[UnifiedDataService] Save attempt ${retryCount + 1}/${maxRetries + 1} failed with exception:`, error);
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
 * Save topic shells to field_2979
 * @param {Array} topicShells - Array of topic shell objects
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object containing token
 * @returns {Promise<boolean>} - Success status
 */
export const saveTopicShells = async (topicShells, userId, auth) => {
  try {
    debugLog("Saving topic shells", { 
      count: topicShells.length,
      userId
    });
    
    // Input validation
    if (!Array.isArray(topicShells) || topicShells.length === 0) {
      throw new Error("Invalid topic shells format or empty array");
    }
    
    // Get user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get existing data
    const userData = await getUserData(recordId, auth);
    
    // Get existing color mapping from field_3000
    const colorMapping = getColorMapping(userData);
    debugLog("Existing color mapping", colorMapping);
    
    // Create a new color map for any new subjects
    const newColorMap = {};
    
    // Process each topic shell before saving
    topicShells.forEach(shell => {
      // Ensure each topic shell has required properties
      if (!shell.id) shell.id = generateId('topic');
      if (!shell.type) shell.type = 'topic';
      if (!shell.isShell) shell.isShell = true;
      if (!shell.cards) shell.cards = [];
      if (!shell.created) shell.created = new Date().toISOString();
      shell.updated = new Date().toISOString();
      
      // Mark as empty if it has no cards
      shell.isEmpty = shell.cards.length === 0;
      
      // If subject doesn't have a color in the mapping yet, assign one
      if (!shell.baseColor && shell.subject) {
        if (colorMapping[shell.subject]) {
          // Use existing color from mapping
          shell.baseColor = colorMapping[shell.subject];
        } else if (newColorMap[shell.subject]) {
          // Use color assigned in this batch
          shell.baseColor = newColorMap[shell.subject];
        } else {
          // Assign a new color
          const randomColor = BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
          newColorMap[shell.subject] = randomColor;
          shell.baseColor = randomColor;
        }
      }
      
      // Apply color based on isEmpty status
      if (shell.isEmpty) {
        shell.color = createGreyedOutColor(shell.baseColor);
      } else {
        shell.color = shell.baseColor;
      }
    });
    
    // Parse existing field_2979 data
    let existingData = [];
    if (userData[FIELD_MAPPING.cardBankData]) {
      existingData = safeParseJSON(userData[FIELD_MAPPING.cardBankData], []);
    }

    // Filter out non-topic items (cards) and topic shells that we'll replace
    const cardsOnly = existingData.filter(item => 
      item.type !== 'topic' || 
      (item.type === 'topic' && !topicShells.some(shell => 
        shell.id === item.id || 
        (shell.subject === item.subject && 
         shell.name === item.name && 
         shell.examBoard === item.examBoard &&
         shell.examType === item.examType)
      ))
    );
    
    // Create updated array with cards and new topic shells
    const updatedData = [...cardsOnly, ...topicShells];
    
    // Prepare data to save
    const updateData = {
      [FIELD_MAPPING.cardBankData]: JSON.stringify(updatedData),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Update color mapping in field_3000 if we have new colors
    if (Object.keys(newColorMap).length > 0) {
      updateData[FIELD_MAPPING.colorMapping] = updateColorMapping(userData, newColorMap);
      debugLog("Updated color mapping", { newColors: newColorMap });
    } else if (userData[FIELD_MAPPING.colorMapping]) {
      // Preserve existing color mapping
      updateData[FIELD_MAPPING.colorMapping] = userData[FIELD_MAPPING.colorMapping];
    }
    
    // Preserve other fields
    if (userData[FIELD_MAPPING.topicLists]) updateData[FIELD_MAPPING.topicLists] = userData[FIELD_MAPPING.topicLists];
    if (userData[FIELD_MAPPING.box1]) updateData[FIELD_MAPPING.box1] = userData[FIELD_MAPPING.box1];
    if (userData[FIELD_MAPPING.box2]) updateData[FIELD_MAPPING.box2] = userData[FIELD_MAPPING.box2];
    if (userData[FIELD_MAPPING.box3]) updateData[FIELD_MAPPING.box3] = userData[FIELD_MAPPING.box3];
    if (userData[FIELD_MAPPING.box4]) updateData[FIELD_MAPPING.box4] = userData[FIELD_MAPPING.box4];
    if (userData[FIELD_MAPPING.box5]) updateData[FIELD_MAPPING.box5] = userData[FIELD_MAPPING.box5];
    
    // Save to Knack
    return await saveWithRetry(recordId, updateData, auth);
  } catch (error) {
    console.error("[UnifiedDataService] Error saving topic shells:", error);
    throw error;
  }
};

/**
 * Add cards to field_2979 and link them to a topic
 * @param {Array} cards - Array of card objects
 * @param {string} topicId - ID of the parent topic
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object containing token
 * @returns {Promise<boolean>} - Success status
 */
export const addCardsToTopic = async (cards, topicId, userId, auth) => {
  try {
    debugLog("Adding cards to topic", { 
      cardCount: cards.length,
      topicId,
      userId
    });
    
    // Input validation
    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error("Invalid cards format or empty array");
    }
    
    if (!topicId) {
      throw new Error("No topicId provided");
    }
    
    // Get user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get existing data
    const userData = await getUserData(recordId, auth);
    
    // Parse existing field_2979 data
    let existingData = [];
    if (userData[FIELD_MAPPING.cardBankData]) {
      existingData = safeParseJSON(userData[FIELD_MAPPING.cardBankData], []);
    }
    
    // Find the topic shell
    const topicShellIndex = existingData.findIndex(item => 
      item.type === 'topic' && item.id === topicId
    );
    
    if (topicShellIndex === -1) {
      throw new Error(`Topic shell with ID ${topicId} not found`);
    }
    
    const topicShell = existingData[topicShellIndex];
    
    // Process cards to add topic references
    const processedCards = cards.map(card => {
      // Ensure each card has required properties
      if (!card.id) card.id = generateId('card');
      if (!card.type) card.type = 'card';
      
      // Add references to parent topic
      card.topicId = topicId;
      
      // Use topic metadata if not already provided
      if (!card.subject) card.subject = topicShell.subject;
      if (!card.topic) card.topic = topicShell.name;
      if (!card.examBoard) card.examBoard = topicShell.examBoard;
      if (!card.examType) card.examType = topicShell.examType;
      if (!card.cardColor && topicShell.color) card.cardColor = topicShell.color;
      
      // Add timestamps
      if (!card.created) card.created = new Date().toISOString();
      card.updated = new Date().toISOString();
      
      // Add spaced repetition data if not present
      if (!card.boxNum) card.boxNum = 1;
      if (!card.lastReviewed) card.lastReviewed = new Date().toISOString();
      if (!card.nextReviewDate) {
        // Set next review date to tomorrow
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        card.nextReviewDate = nextDay.toISOString();
      }
      
      return card;
    });
    
    // Update topic shell's cards array and empty status
    topicShell.cards = [...(topicShell.cards || []), ...processedCards.map(card => card.id)];
    
    // Set topic as no longer empty
    const wasEmpty = topicShell.isEmpty === true;
    topicShell.isEmpty = false;
    
    // Update the color to full color (not greyed out) if it was empty before
    if (wasEmpty && topicShell.baseColor) {
      topicShell.color = topicShell.baseColor;
      debugLog("Topic no longer empty, updating color", { 
        topicId, 
        wasEmpty, 
        newColor: topicShell.color 
      });
    }
    
    topicShell.updated = new Date().toISOString();
    
    // Update the topic shell in the existing data
    existingData[topicShellIndex] = topicShell;
    
    // Add the new cards to the existing data
    const updatedData = [...existingData, ...processedCards];
    
    // Prepare box1 entries
    let box1Data = [];
    if (userData[FIELD_MAPPING.box1]) {
      box1Data = safeParseJSON(userData[FIELD_MAPPING.box1], []);
    }
    
    // Create box1 entries for the new cards
    const newBox1Items = processedCards.map(card => ({
      cardId: card.id,
      lastReviewed: card.lastReviewed,
      nextReviewDate: card.nextReviewDate
    }));
    
    // Prepare data to save
    const updateData = {
      [FIELD_MAPPING.cardBankData]: JSON.stringify(updatedData),
      [FIELD_MAPPING.box1]: JSON.stringify([...box1Data, ...newBox1Items]),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Preserve other fields
    if (userData[FIELD_MAPPING.topicLists]) updateData[FIELD_MAPPING.topicLists] = userData[FIELD_MAPPING.topicLists];
    if (userData[FIELD_MAPPING.box2]) updateData[FIELD_MAPPING.box2] = userData[FIELD_MAPPING.box2];
    if (userData[FIELD_MAPPING.box3]) updateData[FIELD_MAPPING.box3] = userData[FIELD_MAPPING.box3];
    if (userData[FIELD_MAPPING.box4]) updateData[FIELD_MAPPING.box4] = userData[FIELD_MAPPING.box4];
    if (userData[FIELD_MAPPING.box5]) updateData[FIELD_MAPPING.box5] = userData[FIELD_MAPPING.box5];
    
    // Save to Knack
    return await saveWithRetry(recordId, updateData, auth);
  } catch (error) {
    console.error("[UnifiedDataService] Error adding cards to topic:", error);
    throw error;
  }
};

/**
 * Get all topics from field_2979
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object containing token
 * @param {Object} filters - Optional filters (subject, examBoard, examType)
 * @returns {Promise<Array>} - Array of topic shells
 */
export const getTopics = async (userId, auth, filters = {}) => {
  try {
    debugLog("Getting topics", { userId, filters });
    
    // Get user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get user data
    const userData = await getUserData(recordId, auth);
    
    // Parse field_2979 data
    let bankData = [];
    if (userData[FIELD_MAPPING.cardBankData]) {
      bankData = safeParseJSON(userData[FIELD_MAPPING.cardBankData], []);
    }
    
    // Filter for topic shells only
    let topics = bankData.filter(item => item.type === 'topic' && item.isShell);
    
    // Apply filters if provided
    if (filters.subject) {
      topics = topics.filter(topic => topic.subject === filters.subject);
    }
    if (filters.examBoard) {
      topics = topics.filter(topic => topic.examBoard === filters.examBoard);
    }
    if (filters.examType) {
      topics = topics.filter(topic => topic.examType === filters.examType);
    }
    
    return topics;
  } catch (error) {
    console.error("[UnifiedDataService] Error getting topics:", error);
    return [];
  }
};

/**
 * Get cards for a specific topic
 * @param {string} topicId - Topic ID
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object containing token
 * @returns {Promise<Array>} - Array of cards
 */
export const getCardsForTopic = async (topicId, userId, auth) => {
  try {
    debugLog("Getting cards for topic", { topicId, userId });
    
    // Get user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get user data
    const userData = await getUserData(recordId, auth);
    
    // Parse field_2979 data
    let bankData = [];
    if (userData[FIELD_MAPPING.cardBankData]) {
      bankData = safeParseJSON(userData[FIELD_MAPPING.cardBankData], []);
    }
    
    // Find the topic shell
    const topicShell = bankData.find(item => 
      item.type === 'topic' && item.id === topicId
    );
    
    if (!topicShell) {
      throw new Error(`Topic with ID ${topicId} not found`);
    }
    
    // Get cards that belong to this topic
    const cards = bankData.filter(item => 
      item.type === 'card' && item.topicId === topicId
    );
    
    return cards;
  } catch (error) {
    console.error("[UnifiedDataService] Error getting cards for topic:", error);
    return [];
  }
};

/**
 * Move cards between topics
 * @param {Array} cardIds - Array of card IDs to move
 * @param {string} sourceTopicId - Source topic ID
 * @param {string} targetTopicId - Target topic ID
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object containing token
 * @returns {Promise<boolean>} - Success status
 */
export const moveCardsBetweenTopics = async (cardIds, sourceTopicId, targetTopicId, userId, auth) => {
  try {
    debugLog("Moving cards between topics", { 
      cardCount: cardIds.length,
      sourceTopicId,
      targetTopicId,
      userId
    });
    
    // Input validation
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      throw new Error("Invalid cardIds format or empty array");
    }
    
    if (!sourceTopicId || !targetTopicId) {
      throw new Error("Source or target topic ID missing");
    }
    
    // Get user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get user data
    const userData = await getUserData(recordId, auth);
    
    // Parse field_2979 data
    let bankData = [];
    if (userData[FIELD_MAPPING.cardBankData]) {
      bankData = safeParseJSON(userData[FIELD_MAPPING.cardBankData], []);
    }
    
    // Find the source and target topic shells
    const sourceTopicIndex = bankData.findIndex(item => 
      item.type === 'topic' && item.id === sourceTopicId
    );
    
    const targetTopicIndex = bankData.findIndex(item => 
      item.type === 'topic' && item.id === targetTopicId
    );
    
    if (sourceTopicIndex === -1) {
      throw new Error(`Source topic with ID ${sourceTopicId} not found`);
    }
    
    if (targetTopicIndex === -1) {
      throw new Error(`Target topic with ID ${targetTopicId} not found`);
    }
    
    const sourceTopic = bankData[sourceTopicIndex];
    const targetTopic = bankData[targetTopicIndex];
    
    // Update the cards with new topic ID and metadata
    bankData = bankData.map(item => {
      if (item.type === 'card' && cardIds.includes(item.id)) {
        return {
          ...item,
          topicId: targetTopicId,
          topic: targetTopic.name,
          subject: targetTopic.subject,
          examBoard: targetTopic.examBoard,
          examType: targetTopic.examType,
          updated: new Date().toISOString()
        };
      }
      return item;
    });
    
    // Update the source topic's cards array
    sourceTopic.cards = (sourceTopic.cards || []).filter(id => !cardIds.includes(id));
    sourceTopic.updated = new Date().toISOString();
    
    // Check if source topic is now empty and update its status and color if needed
    const sourceTopicIsNowEmpty = sourceTopic.cards.length === 0;
    if (sourceTopicIsNowEmpty && !sourceTopic.isEmpty) {
      sourceTopic.isEmpty = true;
      // Apply greyed-out color if baseColor exists
      if (sourceTopic.baseColor) {
        sourceTopic.color = createGreyedOutColor(sourceTopic.baseColor);
      }
      debugLog("Source topic now empty, updating color", { 
        topicId: sourceTopicId, 
        newColor: sourceTopic.color 
      });
    }
    
    // Update the target topic's cards array
    targetTopic.cards = [...(targetTopic.cards || []), ...cardIds];
    targetTopic.updated = new Date().toISOString();
    
    // If target topic was empty, update its status and color
    if (targetTopic.isEmpty && targetTopic.cards.length > 0) {
      targetTopic.isEmpty = false;
      // Apply full color if baseColor exists
      if (targetTopic.baseColor) {
        targetTopic.color = targetTopic.baseColor;
      }
      debugLog("Target topic no longer empty, updating color", { 
        topicId: targetTopicId, 
        newColor: targetTopic.color 
      });
    }
    
    // Update the topics in the bankData
    bankData[sourceTopicIndex] = sourceTopic;
    bankData[targetTopicIndex] = targetTopic;
    
    // Prepare data to save
    const updateData = {
      [FIELD_MAPPING.cardBankData]: JSON.stringify(bankData),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Preserve other fields
    if (userData[FIELD_MAPPING.topicLists]) updateData[FIELD_MAPPING.topicLists] = userData[FIELD_MAPPING.topicLists];
    if (userData[FIELD_MAPPING.box1]) updateData[FIELD_MAPPING.box1] = userData[FIELD_MAPPING.box1];
    if (userData[FIELD_MAPPING.box2]) updateData[FIELD_MAPPING.box2] = userData[FIELD_MAPPING.box2];
    if (userData[FIELD_MAPPING.box3]) updateData[FIELD_MAPPING.box3] = userData[FIELD_MAPPING.box3];
    if (userData[FIELD_MAPPING.box4]) updateData[FIELD_MAPPING.box4] = userData[FIELD_MAPPING.box4];
    if (userData[FIELD_MAPPING.box5]) updateData[FIELD_MAPPING.box5] = userData[FIELD_MAPPING.box5];
    
    // Save to Knack
    return await saveWithRetry(recordId, updateData, auth);
  } catch (error) {
    console.error("[UnifiedDataService] Error moving cards between topics:", error);
    throw error;
  }
};

export default {
  saveTopicShells,
  addCardsToTopic,
  getTopics,
  getCardsForTopic,
  moveCardsBetweenTopics
};
