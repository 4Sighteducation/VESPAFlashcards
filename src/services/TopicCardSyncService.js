/**
 * TopicCardSyncService.js
 * 
 * A service for managing the synchronization between topics (field_3011) and cards (field_2979).
 * This service provides methods to:
 * - Check if a topic has associated cards
 * - Generate reports on orphaned cards/topics
 * - Register card-topic relationships
 * - Handle integrity checks before topic deletion
 */

// Import necessary utilities
import { safeParseJSON } from '../utils/DataUtils';

// API constants - using environment variables
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";

// Field mappings for Knack
const FIELD_MAPPING = {
  topicLists: 'field_3011',       // Topic lists JSON storage
  cards: 'field_2979',            // Flashcards JSON storage
  spacedRepetition: {
    box1: 'field_2986',
    box2: 'field_2987',
    box3: 'field_2988',
    box4: 'field_2989', 
    box5: 'field_2990'
  }
};

/**
 * Debug logging helper
 * @param {string} title - Log title
 * @param {any} data - Data to log
 * @returns {any} - The data (for chaining)
 */
const debugLog = (title, data) => {
  console.log(`%c[TopicCardSyncService] ${title}`, 'color: #ff7700; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

/**
 * Local cache to store topic-card relationship data for performance
 * This avoids having to recalculate relationships on every check
 */
const relationshipCache = {
  cardsByTopic: new Map(), // Map of topic identifier -> array of card IDs
  topicsByCard: new Map(), // Map of card ID -> topic identifier
  lastUpdated: null,       // Timestamp of last cache update
  isValid: false           // Flag to indicate if cache is valid
};

/**
 * Generate a unique topic identifier that combines all relevant metadata
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} topicName - Topic name
 * @returns {string} - Unique topic identifier
 */
export const generateTopicIdentifier = (subject, examBoard, examType, topicName) => {
  return `${subject}|${examBoard}|${examType}|${topicName}`.toLowerCase();
};

/**
 * Check if two topics match (same subject, exam board, exam type, and name)
 * @param {Object} topic1 - First topic object
 * @param {Object} topic2 - Second topic object
 * @returns {boolean} - Whether topics match
 */
export const topicsMatch = (topic1, topic2) => {
  // If either topic is null or undefined, they don't match
  if (!topic1 || !topic2) return false;
  
  // Generate identifiers for both topics
  const id1 = generateTopicIdentifier(
    topic1.subject || "", 
    topic1.examBoard || "", 
    topic1.examType || "", 
    topic1.name || topic1.topic || ""
  );
  
  const id2 = generateTopicIdentifier(
    topic2.subject || "", 
    topic2.examBoard || "", 
    topic2.examType || "", 
    topic2.name || topic2.topic || ""
  );
  
  // Return whether identifiers match
  return id1 === id2;
};

/**
 * Invalidate the relationship cache
 * Call this when topics or cards are modified
 */
export const invalidateCache = () => {
  relationshipCache.isValid = false;
  relationshipCache.cardsByTopic.clear();
  relationshipCache.topicsByCard.clear();
  debugLog("Cache invalidated", { timestamp: new Date().toISOString() });
};

/**
 * Build the relationship cache from current card and topic data
 * @param {Array} cards - Array of card objects
 * @param {Array} topicLists - Array of topic list objects
 * @returns {Object} - The updated relationship cache
 */
export const buildRelationshipCache = (cards = [], topicLists = []) => {
  debugLog("Building relationship cache", { 
    cardCount: cards.length, 
    topicListCount: topicLists.length 
  });
  
  // Clear existing cache
  relationshipCache.cardsByTopic.clear();
  relationshipCache.topicsByCard.clear();
  
  // Process all cards
  cards.forEach(card => {
    if (!card.id || !card.subject || !card.topic) return;
    
    // Generate the topic identifier
    const topicId = generateTopicIdentifier(
      card.subject,
      card.examBoard || "",
      card.examType || "",
      card.topic
    );
    
    // Add to topic -> cards mapping
    if (!relationshipCache.cardsByTopic.has(topicId)) {
      relationshipCache.cardsByTopic.set(topicId, []);
    }
    relationshipCache.cardsByTopic.get(topicId).push(card.id);
    
    // Add to card -> topic mapping
    relationshipCache.topicsByCard.set(card.id, topicId);
  });
  
  // Mark cache as valid and set timestamp
  relationshipCache.isValid = true;
  relationshipCache.lastUpdated = new Date().toISOString();
  
  return relationshipCache;
};

/**
 * Get all cards associated with a specific topic
 * @param {Array} cards - All cards from the card bank
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} topicName - Topic name
 * @returns {Array} - Cards associated with the topic
 */
export const getCardsForTopic = (cards, subject, examBoard, examType, topicName) => {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return [];
  }
  
  const topicId = generateTopicIdentifier(subject, examBoard, examType, topicName);
  
  // If cache is valid, use it for faster lookup
  if (relationshipCache.isValid && relationshipCache.cardsByTopic.has(topicId)) {
    const cardIds = relationshipCache.cardsByTopic.get(topicId);
    return cards.filter(card => cardIds.includes(card.id));
  }
  
  // Otherwise, filter cards directly
  return cards.filter(card => 
    card.subject?.toLowerCase() === subject?.toLowerCase() &&
    card.examBoard?.toLowerCase() === examBoard?.toLowerCase() &&
    card.examType?.toLowerCase() === examType?.toLowerCase() &&
    card.topic?.toLowerCase() === topicName?.toLowerCase()
  );
};

/**
 * Check if a topic has associated cards
 * @param {Array} cards - All cards from the card bank
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} topicName - Topic name
 * @returns {boolean} - Whether the topic has cards
 */
export const topicHasCards = (cards, subject, examBoard, examType, topicName) => {
  const topicCards = getCardsForTopic(cards, subject, examBoard, examType, topicName);
  return topicCards.length > 0;
};

/**
 * Get topic for a specific card
 * @param {Array} topicLists - All topic lists
 * @param {Object} card - Card object
 * @returns {Object|null} - Topic object or null if not found
 */
export const getTopicForCard = (topicLists, card) => {
  if (!topicLists || !Array.isArray(topicLists) || !card) {
    return null;
  }
  
  // Search all topic lists for a matching topic
  for (const list of topicLists) {
    if (list.subject?.toLowerCase() !== card.subject?.toLowerCase() ||
        list.examBoard?.toLowerCase() !== card.examBoard?.toLowerCase() ||
        list.examType?.toLowerCase() !== card.examType?.toLowerCase()) {
      continue;
    }
    
    // Check all topics in the list
    const matchingTopic = list.topics?.find(topic => 
      (topic.name?.toLowerCase() === card.topic?.toLowerCase()) ||
      (topic.displayName?.toLowerCase() === card.topic?.toLowerCase())
    );
    
    if (matchingTopic) {
      return {
        ...matchingTopic,
        subject: list.subject,
        examBoard: list.examBoard,
        examType: list.examType,
        listId: list.id
      };
    }
  }
  
  return null;
};

/**
 * Find orphaned cards (cards without a matching topic)
 * @param {Array} cards - All cards from the card bank
 * @param {Array} topicLists - All topic lists
 * @returns {Array} - Array of orphaned cards
 */
export const findOrphanedCards = (cards, topicLists) => {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return [];
  }
  
  return cards.filter(card => !getTopicForCard(topicLists, card));
};

/**
 * Register card-topic relationships for newly generated cards
 * @param {Array} newCards - Newly generated cards
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} topicName - Topic name
 */
export const registerCardsForTopic = (newCards, subject, examBoard, examType, topicName) => {
  if (!newCards || !Array.isArray(newCards) || newCards.length === 0) {
    return;
  }
  
  const topicId = generateTopicIdentifier(subject, examBoard, examType, topicName);
  
  // Add to cache if it's valid
  if (relationshipCache.isValid) {
    if (!relationshipCache.cardsByTopic.has(topicId)) {
      relationshipCache.cardsByTopic.set(topicId, []);
    }
    
    const cardIds = newCards.map(card => card.id);
    relationshipCache.cardsByTopic.get(topicId).push(...cardIds);
    
    // Update card -> topic mapping
    newCards.forEach(card => {
      relationshipCache.topicsByCard.set(card.id, topicId);
    });
  } else {
    // If cache is invalid, just invalidate it further
    invalidateCache();
  }
  
  debugLog("Registered cards for topic", { 
    topicId, 
    cardCount: newCards.length 
  });
};

/**
 * Get cards from all spaced repetition boxes that belong to a topic
 * @param {Object} spacedRepetitionData - Spaced repetition data with boxes
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} topicName - Topic name
 * @returns {Object} - Object mapping box numbers to arrays of card IDs
 */
export const getSpacedRepetitionCardsForTopic = (spacedRepetitionData, subject, examBoard, examType, topicName) => {
  if (!spacedRepetitionData) {
    return { box1: [], box2: [], box3: [], box4: [], box5: [] };
  }
  
  const result = { box1: [], box2: [], box3: [], box4: [], box5: [] };
  const topicId = generateTopicIdentifier(subject, examBoard, examType, topicName);
  
  // Helper function to filter cards in a box
  const filterBox = (boxCards, boxName) => {
    if (!boxCards || !Array.isArray(boxCards)) return;
    
    // If cache is valid, use it for faster lookup
    if (relationshipCache.isValid) {
      result[boxName] = boxCards.filter(card => 
        relationshipCache.topicsByCard.has(card.id) && 
        relationshipCache.topicsByCard.get(card.id) === topicId
      );
    } else {
      // Otherwise, filter based on card properties
      result[boxName] = boxCards.filter(card => 
        card.subject?.toLowerCase() === subject?.toLowerCase() &&
        card.examBoard?.toLowerCase() === examBoard?.toLowerCase() &&
        card.examType?.toLowerCase() === examType?.toLowerCase() &&
        card.topic?.toLowerCase() === topicName?.toLowerCase()
      );
    }
  };
  
  // Filter each box
  if (spacedRepetitionData.box1) filterBox(spacedRepetitionData.box1, 'box1');
  if (spacedRepetitionData.box2) filterBox(spacedRepetitionData.box2, 'box2');
  if (spacedRepetitionData.box3) filterBox(spacedRepetitionData.box3, 'box3');
  if (spacedRepetitionData.box4) filterBox(spacedRepetitionData.box4, 'box4');
  if (spacedRepetitionData.box5) filterBox(spacedRepetitionData.box5, 'box5');
  
  return result;
};

/**
 * Generate a comprehensive report on topic-card relationships
 * @param {Array} cards - All cards from the card bank
 * @param {Array} topicLists - All topic lists
 * @param {Object} spacedRepetitionData - Spaced repetition data
 * @returns {Object} - Detailed report object
 */
export const generateTopicCardReport = (cards, topicLists, spacedRepetitionData) => {
  // Build cache first for better performance
  if (!relationshipCache.isValid) {
    buildRelationshipCache(cards, topicLists);
  }
  
  const report = {
    totalCards: cards?.length || 0,
    totalTopics: topicLists.reduce((sum, list) => sum + (list.topics?.length || 0), 0),
    topicsWithCards: 0,
    topicsWithoutCards: 0,
    orphanedCards: [],
    topicDetails: []
  };
  
  // Process all topic lists
  topicLists.forEach(list => {
    const { subject, examBoard, examType } = list;
    
    // Process topics in this list
    list.topics?.forEach(topic => {
      const topicName = topic.name || topic.displayName;
      const topicId = generateTopicIdentifier(subject, examBoard, examType, topicName);
      
      // Get cards for this topic
      const topicCards = getCardsForTopic(cards, subject, examBoard, examType, topicName);
      
      // Get spaced repetition cards for this topic
      const srCards = getSpacedRepetitionCardsForTopic(
        spacedRepetitionData, subject, examBoard, examType, topicName
      );
      
      // Calculate total SR cards
      const totalSRCards = Object.values(srCards).reduce((sum, box) => sum + box.length, 0);
      
      // Add topic details to report
      report.topicDetails.push({
        subject,
        examBoard, 
        examType,
        topicName,
        topicId,
        cardCount: topicCards.length,
        spacedRepetitionCardCount: totalSRCards,
        spacedRepetitionDetails: {
          box1: srCards.box1.length,
          box2: srCards.box2.length,
          box3: srCards.box3.length,
          box4: srCards.box4.length,
          box5: srCards.box5.length
        }
      });
      
      // Update summary counts
      if (topicCards.length > 0) {
        report.topicsWithCards++;
      } else {
        report.topicsWithoutCards++;
      }
    });
  });
  
  // Find orphaned cards
  report.orphanedCards = findOrphanedCards(cards, topicLists);
  
  return report;
};

/**
 * Remove cards associated with a topic from spaced repetition boxes
 * @param {Object} spacedRepetitionData - Spaced repetition data
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} topicName - Topic name
 * @returns {Object} - Updated spaced repetition data
 */
export const removeTopicFromSpacedRepetition = (spacedRepetitionData, subject, examBoard, examType, topicName) => {
  if (!spacedRepetitionData) {
    return { box1: [], box2: [], box3: [], box4: [], box5: [] };
  }
  
  const topicId = generateTopicIdentifier(subject, examBoard, examType, topicName);
  const result = { ...spacedRepetitionData };
  
  // Helper function to filter cards in a box
  const filterBox = (boxName) => {
    if (!result[boxName] || !Array.isArray(result[boxName])) {
      result[boxName] = [];
      return;
    }
    
    // If cache is valid, use it for faster lookup
    if (relationshipCache.isValid) {
      result[boxName] = result[boxName].filter(card => 
        !relationshipCache.topicsByCard.has(card.id) || 
        relationshipCache.topicsByCard.get(card.id) !== topicId
      );
    } else {
      // Otherwise, filter based on card properties
      result[boxName] = result[boxName].filter(card => 
        !(card.subject?.toLowerCase() === subject?.toLowerCase() &&
          card.examBoard?.toLowerCase() === examBoard?.toLowerCase() &&
          card.examType?.toLowerCase() === examType?.toLowerCase() &&
          card.topic?.toLowerCase() === topicName?.toLowerCase())
      );
    }
  };
  
  // Filter each box
  filterBox('box1');
  filterBox('box2');
  filterBox('box3');
  filterBox('box4');
  filterBox('box5');
  
  return result;
};

// Helper to find cards matching a topic
const findCardsForTopic = (cards, topic) => {
  if (!cards || !cards.length || !topic) return [];
  
  return cards.filter(card => 
    card.topic && 
    (card.topic.toLowerCase() === topic.toLowerCase() || 
     card.topic.toLowerCase().includes(topic.toLowerCase()))
  );
};

// Check if a card is synchronized with its topic
const isCardSynchronized = (card, topics = []) => {
  if (!card || !card.topic || !topics.length) return false;
  
  // Normalize topics for matching
  const normalizedTopics = topics.map(topic => 
    typeof topic === 'string' ? topic.toLowerCase() : (topic.name || '').toLowerCase()
  );
  
  // Check if card's topic exists in the topics list
  return normalizedTopics.some(topic => 
    card.topic.toLowerCase() === topic || 
    card.topic.toLowerCase().includes(topic)
  );
};

// Update card topics to match from the topics list
const synchronizeCardTopics = (cards = [], topics = []) => {
  if (!cards.length || !topics.length) return cards;

  // Create topic map for faster lookup
  const topicMap = new Map();
  topics.forEach(topic => {
    const topicName = typeof topic === 'string' ? topic : (topic.name || '');
    topicMap.set(topicName.toLowerCase(), topicName);
  });

  // Update cards with exact topic matches
  return cards.map(card => {
    if (!card.topic) return card;
    
    const cardTopic = card.topic.toLowerCase();
    
    // Look for exact match first
    if (topicMap.has(cardTopic)) {
      return {
        ...card,
        topic: topicMap.get(cardTopic) // Use the properly capitalized version
      };
    }
    
    // Look for partial match
    for (const [mappedTopic, originalTopic] of topicMap.entries()) {
      if (cardTopic.includes(mappedTopic) || mappedTopic.includes(cardTopic)) {
        return {
          ...card,
          topic: originalTopic
        };
      }
    }
    
    // No match found, keep original
    return card;
  });
};

// Detect changes needed for orphaned cards
const getOrphanedCardRecommendations = (orphanedCards = [], topics = []) => {
  if (!orphanedCards.length || !topics.length) return [];
  
  return orphanedCards.map(card => {
    // Find potential topic matches based on content
    const potentialTopics = topics
      .filter(topic => {
        const topicName = typeof topic === 'string' ? topic : (topic.name || '');
        const cardContent = `${card.question} ${card.answer}`.toLowerCase();
        
        return cardContent.includes(topicName.toLowerCase());
      })
      .map(topic => typeof topic === 'string' ? topic : (topic.name || ''));
    
    return {
      card,
      potentialTopics
    };
  }).filter(rec => rec.potentialTopics.length > 0);
};

// Export the service functions
export default {
  getCardsForTopic,
  topicHasCards,
  getTopicForCard,
  findOrphanedCards,
  registerCardsForTopic,
  getSpacedRepetitionCardsForTopic,
  generateTopicCardReport,
  removeTopicFromSpacedRepetition,
  buildRelationshipCache,
  invalidateCache,
  findCardsForTopic,
  isCardSynchronized,
  synchronizeCardTopics,
  getOrphanedCardRecommendations
}; 