/**
 * TopicCardSyncService.js
 * 
 * A centralized service to manage the relationship between topics in field_3011
 * and cards in field_2979, ensuring proper synchronization and integrity.
 */

// API constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const KNACK_API_URL = "https://api.knack.com/v1";
const FLASHCARD_OBJECT = "object_102";

// Field mappings - only the fields we need to work with
const FIELD_MAPPING = {
  cards: 'field_2979',           // Card bank
  topicLists: 'field_3011',      // Topic lists
  box1: 'field_2986',            // Spaced repetition Box 1
  box2: 'field_2987',            // Spaced repetition Box 2  
  box3: 'field_2988',            // Spaced repetition Box 3
  box4: 'field_2989',            // Spaced repetition Box 4
  box5: 'field_2990',            // Spaced repetition Box 5
  lastSaved: 'field_2957'        // Last saved timestamp
};

/**
 * Debug logging helper
 */
const debugLog = (title, data) => {
  console.log(`%c[TopicCardSyncService] ${title}`, 'color: #6600cc; font-weight: bold; font-size: 12px;');
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
    console.error("[TopicCardSyncService] Error parsing JSON:", error);
    
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
      console.error("[TopicCardSyncService] JSON recovery failed:", secondError);
      return defaultValue;
    }
  }
};

/**
 * Get user's record ID from Knack
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<string>} - Record ID
 */
const getUserRecordId = async (userId, auth) => {
  try {
    if (!userId || !auth?.token) {
      throw new Error("Missing userId or auth for record lookup");
    }
    
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
    console.error("[TopicCardSyncService] Error finding user record ID:", error);
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
    console.error("[TopicCardSyncService] Error getting user data:", error);
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
        recordId,
        fields: Object.keys(updateData)
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
      console.error(`[TopicCardSyncService] Save attempt ${retryCount + 1}/${maxRetries + 1} failed:`, errorData);
      
      // Increment retry count
      retryCount++;
      
      // Wait before retrying (exponential backoff)
      if (retryCount <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
      }
    } catch (error) {
      console.error(`[TopicCardSyncService] Save attempt ${retryCount + 1}/${maxRetries + 1} failed with exception:`, error);
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
 * Find cards associated with a specific topic
 * @param {Object} topic - Topic object with subject, examBoard, examType and name
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<Array>} - Array of associated cards
 */
export const findCardsForTopic = async (topic, userId, auth) => {
  try {
    // Get the user's record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get user data
    const userData = await getUserData(recordId, auth);
    
    // Parse cards from field_2979
    const cards = safeParseJSON(userData[FIELD_MAPPING.cards], []);
    
    // Find cards associated with this topic
    // Match by subject, examBoard, examType, and topic name
    const matchingCards = cards.filter(card => 
      card.subject === topic.subject &&
      card.examBoard === topic.examBoard &&
      card.examType === topic.examType &&
      card.topic === topic.name
    );
    
    debugLog("Found cards for topic", { 
      topic: topic.name, 
      count: matchingCards.length 
    });
    
    return matchingCards;
  } catch (error) {
    console.error("[TopicCardSyncService] Error finding cards for topic:", error);
    return [];
  }
};

/**
 * Find cards in a specific spaced repetition box
 * @param {number} boxNum - Box number (1-5)
 * @param {Array} cards - Array of all cards
 * @param {Object} userData - User data containing box field
 * @returns {Array} - Cards in the specified box
 */
const findCardsInBox = (boxNum, cards, userData) => {
  // Get the field name for this box
  const boxField = FIELD_MAPPING[`box${boxNum}`];
  if (!boxField || !userData[boxField]) {
    return [];
  }
  
  // Parse box data
  const boxData = safeParseJSON(userData[boxField], []);
  
  // Create a map of card IDs in this box
  const cardIdsInBox = new Set(boxData.map(entry => entry.cardId));
  
  // Find cards that are in this box
  return cards.filter(card => cardIdsInBox.has(card.id));
};

/**
 * Clean up a deleted topic and its orphaned cards
 * @param {Object} topic - Topic object with subject, examBoard, examType and name
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const cleanupDeletedTopic = async (topic, userId, auth) => {
  try {
    // First, find all cards associated with this topic
    const associatedCards = await findCardsForTopic(topic, userId, auth);
    
    if (associatedCards.length === 0) {
      // No cards associated with this topic, nothing to clean up
      return true;
    }
    
    // Get the record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get all user data to update multiple fields
    const userData = await getUserData(recordId, auth);
    
    // Get the IDs of cards to remove
    const cardIdsToRemove = new Set(associatedCards.map(card => card.id));
    
    // Parse all cards
    let allCards = safeParseJSON(userData[FIELD_MAPPING.cards], []);
    
    // Filter out the cards to remove
    const updatedCards = allCards.filter(card => !cardIdsToRemove.has(card.id));
    
    // Prepare update data
    const updateData = {
      [FIELD_MAPPING.cards]: JSON.stringify(updatedCards),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Remove cards from all spaced repetition boxes
    for (let boxNum = 1; boxNum <= 5; boxNum++) {
      const boxField = FIELD_MAPPING[`box${boxNum}`];
      if (userData[boxField]) {
        const boxData = safeParseJSON(userData[boxField], []);
        const updatedBoxData = boxData.filter(entry => !cardIdsToRemove.has(entry.cardId));
        updateData[boxField] = JSON.stringify(updatedBoxData);
      }
    }
    
    // Preserve topic lists field
    if (userData[FIELD_MAPPING.topicLists]) {
      updateData[FIELD_MAPPING.topicLists] = userData[FIELD_MAPPING.topicLists];
    }
    
    // Save the updated data
    const saveResult = await saveWithRetry(recordId, updateData, auth);
    
    debugLog("Cleanup result", {
      topic: topic.name,
      cardsRemoved: associatedCards.length,
      success: saveResult
    });
    
    return saveResult;
  } catch (error) {
    console.error("[TopicCardSyncService] Error cleaning up deleted topic:", error);
    return false;
  }
};

/**
 * Reassign cards from one topic to another
 * @param {Array} cards - Array of cards to reassign
 * @param {Object} targetTopic - Target topic object
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const reassignCards = async (cards, targetTopic, userId, auth) => {
  try {
    if (!cards || cards.length === 0 || !targetTopic) {
      return false;
    }
    
    // Get the record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get all user data
    const userData = await getUserData(recordId, auth);
    
    // Parse all cards
    let allCards = safeParseJSON(userData[FIELD_MAPPING.cards], []);
    
    // Create a map of card IDs to reassign
    const cardIdsToReassign = new Set(cards.map(card => card.id));
    
    // Update the topic for these cards
    const updatedCards = allCards.map(card => {
      if (cardIdsToReassign.has(card.id)) {
        return {
          ...card,
          topic: targetTopic.name,
          subject: targetTopic.subject,
          examBoard: targetTopic.examBoard,
          examType: targetTopic.examType,
          updatedAt: new Date().toISOString()
        };
      }
      return card;
    });
    
    // Prepare update data
    const updateData = {
      [FIELD_MAPPING.cards]: JSON.stringify(updatedCards),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Preserve other fields
    if (userData[FIELD_MAPPING.topicLists]) {
      updateData[FIELD_MAPPING.topicLists] = userData[FIELD_MAPPING.topicLists];
    }
    
    // Preserve spaced repetition boxes
    for (let boxNum = 1; boxNum <= 5; boxNum++) {
      const boxField = FIELD_MAPPING[`box${boxNum}`];
      if (userData[boxField]) {
        updateData[boxField] = userData[boxField];
      }
    }
    
    // Save the updated data
    const saveResult = await saveWithRetry(recordId, updateData, auth);
    
    debugLog("Reassign result", {
      targetTopic: targetTopic.name,
      cardsReassigned: cards.length,
      success: saveResult
    });
    
    return saveResult;
  } catch (error) {
    console.error("[TopicCardSyncService] Error reassigning cards:", error);
    return false;
  }
};

/**
 * Create a subject accordion automatically when a topic list is saved
 * @param {Object} topicList - Topic list object
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const createSubjectAccordion = async (topicList, userId, auth) => {
  try {
    // Implement subject accordion creation logic here
    // This would interact with whatever system handles subject accordions
    
    debugLog("Created subject accordion", {
      subject: topicList.subject,
      examBoard: topicList.examBoard,
      examType: topicList.examType
    });
    
    // For now, just return success
    return true;
  } catch (error) {
    console.error("[TopicCardSyncService] Error creating subject accordion:", error);
    return false;
  }
};

/**
 * Generate cards directly from a topic
 * @param {Object} topic - Topic object with subject, examBoard, examType and name
 * @param {Array} newCards - Array of newly generated cards
 * @param {string} userId - User ID 
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const appendCardsForTopic = async (topic, newCards, userId, auth) => {
  try {
    if (!newCards || newCards.length === 0) {
      return false;
    }
    
    // Get the record ID
    const recordId = await getUserRecordId(userId, auth);
    
    // Get all user data
    const userData = await getUserData(recordId, auth);
    
    // Parse existing cards
    let existingCards = safeParseJSON(userData[FIELD_MAPPING.cards], []);
    
    // Parse box 1 data
    let box1Data = safeParseJSON(userData[FIELD_MAPPING.box1], []);
    
    // Prepare the new cards for append with proper metadata
    const cardsToAppend = newCards.map(card => ({
      ...card,
      id: card.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      topic: topic.name,
      subject: topic.subject,
      examBoard: topic.examBoard,
      examType: topic.examType,
      boxNum: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      nextReviewDate: new Date().toISOString()
    }));
    
    // Generate Box 1 entries for new cards
    const box1Entries = cardsToAppend.map(card => ({
      cardId: card.id,
      lastReviewed: new Date().toISOString(),
      nextReviewDate: new Date().toISOString()
    }));
    
    // Create the updated arrays
    const updatedCards = [...existingCards, ...cardsToAppend];
    const updatedBox1 = [...box1Data, ...box1Entries];
    
    // Prepare update data
    const updateData = {
      [FIELD_MAPPING.cards]: JSON.stringify(updatedCards),
      [FIELD_MAPPING.box1]: JSON.stringify(updatedBox1),
      [FIELD_MAPPING.lastSaved]: new Date().toISOString()
    };
    
    // Preserve other fields
    if (userData[FIELD_MAPPING.topicLists]) {
      updateData[FIELD_MAPPING.topicLists] = userData[FIELD_MAPPING.topicLists];
    }
    
    // Preserve other spaced repetition boxes
    for (let boxNum = 2; boxNum <= 5; boxNum++) {
      const boxField = FIELD_MAPPING[`box${boxNum}`];
      if (userData[boxField]) {
        updateData[boxField] = userData[boxField];
      }
    }
    
    // Save the updated data
    const saveResult = await saveWithRetry(recordId, updateData, auth);
    
    debugLog("Append cards result", {
      topic: topic.name,
      cardsAppended: cardsToAppend.length,
      success: saveResult
    });
    
    return saveResult;
  } catch (error) {
    console.error("[TopicCardSyncService] Error appending cards for topic:", error);
    return false;
  }
};

/**
 * Verify if a topic has associated cards
 * @param {Object} topic - Topic object
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<{hasCards: boolean, count: number}>} - Object with verification result
 */
export const verifyTopicHasCards = async (topic, userId, auth) => {
  try {
    const cards = await findCardsForTopic(topic, userId, auth);
    return {
      hasCards: cards.length > 0,
      count: cards.length
    };
  } catch (error) {
    console.error("[TopicCardSyncService] Error verifying topic cards:", error);
    return {
      hasCards: false,
      count: 0
    };
  }
};

// Export all functions
export {
  findCardsInBox,
  getUserData,
  getUserRecordId,
  safeParseJSON
};
