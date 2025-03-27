/**
 * TopicCardSyncService.js
 * 
 * A service for ensuring topic shells and cards are properly synchronized
 * between field_2979 (card bank) and field_3011 (topic lists).
 * 
 * This service implements fixes for common data loss scenarios and provides
 * helpers for type-safe operations on the combined data structures.
 */

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
  console.log(`%c[TopicCardSyncService] ${title}`, 'color: #008080; font-weight: bold; font-size: 12px;');
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
 * Helper function to ensure an item has a type field
 * @param {Object} item - Item to check and possibly modify
 * @returns {Object} - Item with guaranteed type field
 */
export function ensureItemType(item) {
  if (!item) return item;
  
  // If type is already set, return as is
  if (item.type) return item;
  
  // Otherwise, try to determine the type
  if (item.topicId || item.question || item.front || item.back || item.boxNum) {
    return {...item, type: 'card'};
  } else if (
    (item.name && typeof item.name === 'string') || 
    (item.topic && typeof item.topic === 'string') || 
    item.isShell === true ||
    (item.subject && !item.topicId) // Has subject but no topicId generally indicates a topic
  ) {
    return {...item, type: 'topic'};
  }
  
  // Default to card if we can't determine
  return {...item, type: 'card'};
}

/**
 * Process an array and ensure all items have types
 * @param {Array} items - Array of items to process
 * @returns {Array} - Array with all items having types
 */
export function ensureAllItemTypes(items) {
  if (!Array.isArray(items)) return [];
  return items.map(ensureItemType);
}

/**
 * Split a mixed array into topics and cards
 * @param {Array} items - Array of possibly mixed items
 * @returns {Object} - Object with separate topics and cards arrays
 */
export function splitByType(items) {
  if (!Array.isArray(items)) {
    return { topics: [], cards: [] };
  }
  
  // Ensure all items have types
  const typedItems = ensureAllItemTypes(items);
  
  // Split by type
  const topics = typedItems.filter(item => item.type === 'topic');
  const cards = typedItems.filter(item => item.type !== 'topic');
  
  return { topics, cards };
}

/**
 * Safe add to bank method that preserves topic shells
 * @param {Object} existingData - Raw data from Knack
 * @param {Array} newCards - New cards to add
 * @returns {Object} - Updated data ready to save
 */
export function safeAddToBank(existingData, newCards) {
  if (!existingData || !Array.isArray(newCards) || newCards.length === 0) {
    return existingData || {};
  }
  
  // Parse field_2979 data
  let existingItems = [];
  try {
    existingItems = safeParseJSON(existingData[FIELD_MAPPING.cardBankData], []);
  } catch (e) {
    console.error('[TopicCardSyncService] Error parsing existing items:', e);
    existingItems = [];
  }
  
  // Add debug logging to show the split before merging
  const { topics: existingTopics, cards: existingCards } = splitByType(existingItems);
  
  debugLog("EXISTING DATA SPLIT", {
    topicCount: existingTopics.length,
    cardCount: existingCards.length,
    topicSample: existingTopics.length > 0 ? existingTopics[0].name || existingTopics[0].topic : null
  });
  
  // Ensure all new cards have type='card'
  const processedCards = newCards.map(card => ({
    ...card,
    type: 'card',
    created: card.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    id: card.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }));
  
  // Group cards by topicId
  const cardsByTopic = {};
  processedCards.forEach(card => {
    if (card.topicId) {
      if (!cardsByTopic[card.topicId]) {
        cardsByTopic[card.topicId] = [];
      }
      cardsByTopic[card.topicId].push(card);
    }
  });
  
  // Update topic shells' isEmpty status and cards array based on new cards
  const updatedTopics = existingTopics.map(topic => {
    // Check if any of the new cards belong to this topic
    const topicCards = cardsByTopic[topic.id] || [];
    
    if (topicCards.length > 0) {
      // Add the new card IDs to the topic's cards array
      const updatedCardIds = [...(topic.cards || []), ...topicCards.map(card => card.id)];
      
      // Topic has cards, update its isEmpty property and cards array
      return {
        ...topic,
        isEmpty: false,
        cards: updatedCardIds,
        updated: new Date().toISOString()
      };
    }
    
    // No cards for this topic, leave it unchanged
    return topic;
  });
  
  // Merge keeping both topics and cards
  const updatedCards = [...existingCards, ...processedCards];
  
  // Important: topics come first in the final array for predictable ordering
  const finalData = [...updatedTopics, ...updatedCards];
  
  // Parse existing Box 1 (field_2986)
  let box1Cards = [];
  try {
    box1Cards = safeParseJSON(existingData[FIELD_MAPPING.box1], []);
  } catch (e) {
    console.error('[TopicCardSyncService] Error parsing box 1 cards:', e);
    box1Cards = [];
  }
  
  // Create Box 1 entries for new cards
  const newBox1Items = processedCards.map(card => ({
    cardId: card.id,
    lastReviewed: card.lastReviewed || new Date().toISOString(),
    nextReviewDate: card.nextReviewDate || new Date().toISOString()
  }));
  
  // Add new items to Box 1
  const updatedBox1 = [...box1Cards, ...newBox1Items];
  
  // Debug logging to show what we're saving
  debugLog("SAVING UPDATED DATA", {
    topicCount: updatedTopics.length,
    cardCount: updatedCards.length,
    box1Count: updatedBox1.length,
    sample: updatedTopics.length > 0 ? 
      { 
        topicName: updatedTopics[0].name || updatedTopics[0].topic,
        isEmpty: updatedTopics[0].isEmpty,
        cardCount: updatedTopics[0].cards ? updatedTopics[0].cards.length : 0
      } : null
  });
  
  // Prepare results
  const result = {
    ...existingData,
    [FIELD_MAPPING.cardBankData]: JSON.stringify(finalData),
    [FIELD_MAPPING.box1]: JSON.stringify(updatedBox1),
    [FIELD_MAPPING.lastSaved]: new Date().toISOString()
  };
  
  return result;
}

/**
 * Get a topicId for a card based on topic name/subject matching
 * @param {Object} card - Card to find a topic for
 * @param {Array} topics - Available topics
 * @returns {string|null} - TopicId or null if no match
 */
export function findMatchingTopicId(card, topics) {
  if (!card || !Array.isArray(topics) || topics.length === 0) {
    return null;
  }
  
  // Look for exact match by name
  if (card.topic) {
    const exactMatch = topics.find(topic => {
      const topicName = topic.name || topic.topic;
      return topicName === card.topic;
    });
    
    if (exactMatch) {
      return exactMatch.id;
    }
  }
  
  // Look for subject match if there's no topic match
  if (card.subject) {
    const subjectMatch = topics.find(topic => {
      return topic.subject === card.subject;
    });
    
    if (subjectMatch) {
      return subjectMatch.id;
    }
  }
  
  return null;
}

/**
 * Associate unassociated cards with topics based on name/subject matching
 * @param {Array} items - Mixed array of cards and topics
 * @returns {Array} - Updated array with improved associations
 */
export function improveTopicAssociations(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return items;
  }
  
  // Ensure all items have types and split
  const { topics, cards } = splitByType(items);
  
  // Find cards without topicId
  const unassociatedCards = cards.filter(card => !card.topicId);
  const associatedCards = cards.filter(card => card.topicId);
  
  if (unassociatedCards.length === 0) {
    // No work to do
    return items;
  }
  
  // Try to associate each card
  const newlyAssociatedCards = unassociatedCards.map(card => {
    const topicId = findMatchingTopicId(card, topics);
    
    if (topicId) {
      // Update the card with the topic ID
      return {
        ...card,
        topicId: topicId,
        updated: new Date().toISOString()
      };
    }
    
    // No match, return the original card
    return card;
  });
  
  // Create a map of existing topic card associations
  const existingCardsByTopic = {};
  associatedCards.forEach(card => {
    if (card.topicId) {
      if (!existingCardsByTopic[card.topicId]) {
        existingCardsByTopic[card.topicId] = [];
      }
      existingCardsByTopic[card.topicId].push(card.id);
    }
  });
  
  // Update the topic shell card ID lists
  const updatedTopics = topics.map(topic => {
    // Get newly associated cards for this topic
    const newCardIds = newlyAssociatedCards
      .filter(card => card.topicId === topic.id)
      .map(card => card.id);
    
    // Get existing associated cards for this topic
    const existingCardIds = existingCardsByTopic[topic.id] || [];
    
    // Combine existing and new card IDs
    const topicCardIds = [...(topic.cards || []), ...existingCardIds, ...newCardIds];
    
    // Remove duplicates
    const uniqueCardIds = [...new Set(topicCardIds)];
    
    // Update topic
    return {
      ...topic,
      cards: uniqueCardIds,
      isEmpty: uniqueCardIds.length === 0,
      updated: new Date().toISOString()
    };
  });
  
  // Combine all items back together
  return [...updatedTopics, ...associatedCards, ...newlyAssociatedCards];
}

/**
 * Ensure the card bank data in field_2979 is properly typed and structured
 * @param {Object} userData - User data
 * @returns {Object} - Updated user data
 */
export function ensureCardBankStructure(userData) {
  if (!userData) return userData;
  
  // Parse field_2979 data
  let cardBankData = [];
  try {
    cardBankData = safeParseJSON(userData[FIELD_MAPPING.cardBankData], []);
  } catch (e) {
    console.error('[TopicCardSyncService] Error parsing card bank data:', e);
    return userData;
  }
  
  // Ensure all items have types
  const typedItems = ensureAllItemTypes(cardBankData);
  
  // Improve topic associations
  const improvedItems = improveTopicAssociations(typedItems);
  
  // Update the user data
  return {
    ...userData,
    [FIELD_MAPPING.cardBankData]: JSON.stringify(improvedItems),
    [FIELD_MAPPING.lastSaved]: new Date().toISOString()
  };
}

/**
 * Fix topic shells in field_2979 based on topic lists in field_3011
 * @param {Object} userData - User data
 * @returns {Object} - Updated user data
 */
export function syncTopicLists(userData) {
  if (!userData) return userData;
  
  // Parse field_2979 data
  let cardBankData = [];
  try {
    cardBankData = safeParseJSON(userData[FIELD_MAPPING.cardBankData], []);
  } catch (e) {
    console.error('[TopicCardSyncService] Error parsing card bank data:', e);
    cardBankData = [];
  }
  
  // Parse field_3011 data
  let topicLists = [];
  try {
    topicLists = safeParseJSON(userData[FIELD_MAPPING.topicLists], []);
  } catch (e) {
    console.error('[TopicCardSyncService] Error parsing topic lists:', e);
    topicLists = [];
  }
  
  if (topicLists.length === 0) {
    return userData; // No topic lists to sync
  }
  
  // Extract topics from topic lists
  const topicsFromLists = [];
  
  topicLists.forEach(list => {
    if (Array.isArray(list.topics)) {
      list.topics.forEach(topic => {
        // Create a topic shell for each topic in the list
        topicsFromLists.push({
          id: topic.id || `topic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'topic',
          isShell: true,
          name: topic.topic || topic.name,
          topic: topic.topic || topic.name,
          subject: list.subject,
          examBoard: list.examBoard,
          examType: list.examType,
          isEmpty: true,
          cards: [],
          created: topic.created || new Date().toISOString(),
          updated: new Date().toISOString()
        });
      });
    }
  });
  
  // Split existing data
  const { topics: existingTopics, cards: existingCards } = splitByType(cardBankData);
  
  // Create mappings of cards by topic ID
  const cardsByTopicId = {};
  existingCards.forEach(card => {
    if (card.topicId) {
      if (!cardsByTopicId[card.topicId]) {
        cardsByTopicId[card.topicId] = [];
      }
      cardsByTopicId[card.topicId].push(card);
    }
  });
  
  // Merge topics, preserving existing ones
  const existingTopicIds = existingTopics.map(t => t.id);
  const newTopics = topicsFromLists.filter(t => !existingTopicIds.includes(t.id));
  
  // Update existing topics to preserve their card arrays and isEmpty status
  const updatedExistingTopics = existingTopics.map(topic => {
    // Get cards associated with this topic
    const topicCards = cardsByTopicId[topic.id] || [];
    
    // Get card IDs
    const cardIds = topicCards.map(card => card.id);
    
    // Update topic with card associations
    return {
      ...topic,
      cards: cardIds,
      isEmpty: cardIds.length === 0,
      updated: new Date().toISOString()
    };
  });
  
  // Also check if there are any unassociated cards we can match to topics
  const unassociatedCards = existingCards.filter(card => !card.topicId);
  
  // Try to associate cards by topic name
  unassociatedCards.forEach(card => {
    if (card.topic) {
      // Find matching topic by name
      const matchingTopic = [...updatedExistingTopics, ...newTopics].find(
        topic => (topic.name === card.topic || topic.topic === card.topic)
      );
      
      if (matchingTopic) {
        // Update card with topic ID
        card.topicId = matchingTopic.id;
        card.updated = new Date().toISOString();
        
        // Update topic's cards array and isEmpty flag
        if (!matchingTopic.cards) matchingTopic.cards = [];
        matchingTopic.cards.push(card.id);
        matchingTopic.isEmpty = false;
        matchingTopic.updated = new Date().toISOString();
      }
    }
  });
  
  // Combine all topics and cards
  const combinedItems = [...updatedExistingTopics, ...newTopics, ...existingCards];
  
  // Debug log what we're actually saving
  debugLog("SYNCING TOPIC LISTS", {
    topicCount: updatedExistingTopics.length + newTopics.length, 
    cardCount: existingCards.length,
    sample: updatedExistingTopics.length > 0 ? {
      topicName: updatedExistingTopics[0].name || updatedExistingTopics[0].topic,
      isEmpty: updatedExistingTopics[0].isEmpty,
      cardCount: updatedExistingTopics[0].cards ? updatedExistingTopics[0].cards.length : 0
    } : null
  });
  
  // Update the user data
  return {
    ...userData,
    [FIELD_MAPPING.cardBankData]: JSON.stringify(combinedItems),
    [FIELD_MAPPING.lastSaved]: new Date().toISOString()
  };
}

export default {
  ensureItemType,
  ensureAllItemTypes,
  splitByType,
  safeAddToBank,
  findMatchingTopicId,
  improveTopicAssociations,
  ensureCardBankStructure,
  syncTopicLists
};
