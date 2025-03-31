/**
 * UnifiedDataModel.js
 * 
 * This module defines a unified data model for flashcards, topics, and subjects,
 * with proper relationships and a hierarchical structure.
 */

// Constants for entity types
export const ENTITY_TYPES = {
  SUBJECT: 'subject',
  TOPIC: 'topic',
  CARD: 'card'
};

// Current schema version
export const SCHEMA_VERSION = '1.0';

/**
 * Generate a unique ID with optional prefix and timestamp
 * @param {string} prefix - Optional prefix for the ID (subject, topic, card, etc.)
 * @returns {string} - Generated unique ID
 */
export const generateId = (prefix = '') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * Create a new subject with default values
 * @param {string} name - Subject name
 * @param {string} color - Subject color in hex format
 * @param {Object} options - Additional options (examBoard, examType)
 * @returns {Object} - New subject object
 */
export const createSubject = (name, color = '#3cb44b', options = {}) => {
  return {
    id: generateId('subj'),
    name: name,
    color: color,
    examBoard: options.examBoard || '',
    examType: options.examType || '',
    type: ENTITY_TYPES.SUBJECT,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
};

/**
 * Create a new topic with default values
 * @param {string} name - Topic name
 * @param {string} subjectId - ID of parent subject
 * @param {string} parentId - ID of parent topic (null for root topics)
 * @param {Object} options - Additional options (color, level)
 * @returns {Object} - New topic object
 */
export const createTopic = (name, subjectId, parentId = null, options = {}) => {
  return {
    id: generateId('topic'),
    parentId: parentId,
    subjectId: subjectId,
    name: name,
    fullName: options.fullName || name,
    color: options.color || '#9ec2a2',
    cards: [],
    isEmpty: true,
    level: options.level || (parentId ? 2 : 1),
    type: ENTITY_TYPES.TOPIC,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
};

/**
 * Create a new card with default values
 * @param {string} question - Card question
 * @param {string} answer - Card answer
 * @param {string} topicId - ID of parent topic
 * @param {string} subjectId - ID of subject
 * @param {Object} options - Additional options (cardColor, questionType, etc.)
 * @returns {Object} - New card object
 */
export const createCard = (question, answer, topicId, subjectId, options = {}) => {
  const cardId = generateId('card');
  const timestamp = new Date().toISOString();
  
  return {
    id: cardId,
    topicId: topicId,
    subjectId: subjectId,
    subject: options.subject || '',
    topic: options.topic || '',
    examBoard: options.examBoard || '',
    examType: options.examType || '',
    question: question,
    answer: answer,
    detailedAnswer: options.detailedAnswer || '',
    additionalInfo: options.additionalInfo || '',
    type: ENTITY_TYPES.CARD,
    questionType: options.questionType || 'short_answer',
    options: options.options || [],
    savedOptions: options.options || [],
    correctAnswer: options.correctAnswer || '',
    cardColor: options.cardColor || '#46f0f0',
    textColor: options.textColor || '',
    boxNum: options.boxNum || 1,
    lastReviewed: null,
    nextReviewDate: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

/**
 * Create a complete unified data structure with default values
 * @returns {Object} - Empty unified data structure
 */
export const createEmptyDataStructure = () => {
  return {
    version: SCHEMA_VERSION,
    lastUpdated: new Date().toISOString(),
    subjects: [],
    topics: [],
    cards: []
  };
};

/**
 * Convert from the old data structure to the unified data model
 * @param {Array} oldCards - Array of cards in the old format
 * @param {Object} colorMapping - Subject color mapping
 * @returns {Object} - Data in the unified model format
 */
export const convertFromOldFormat = (oldCards = [], colorMapping = {}) => {
  const result = createEmptyDataStructure();
  const subjectMap = new Map(); // Track subjects by name
  const topicMap = new Map();   // Track topics by name within subject
  
  // Process all cards to extract subjects and topics
  oldCards.forEach(card => {
    if (!card) return;
    
    const subjectName = card.subject || 'General';
    const topicName = card.topic || 'General';
    
    // Create or retrieve subject
    let subject;
    if (!subjectMap.has(subjectName)) {
      // Get color from mapping or generate a default
      const baseColor = colorMapping[subjectName]?.base || '#3cb44b';
      subject = createSubject(subjectName, baseColor, {
        examBoard: card.examBoard || '',
        examType: card.examType || ''
      });
      subjectMap.set(subjectName, subject);
      result.subjects.push(subject);
    } else {
      subject = subjectMap.get(subjectName);
    }
    
    // Create or retrieve topic
    const topicKey = `${subjectName}:${topicName}`;
    let topic;
    if (!topicMap.has(topicKey)) {
      // Get topic color from mapping or derive from subject
      const topicColor = colorMapping[subjectName]?.topics?.[topicName] || subject.color;
      topic = createTopic(topicName, subject.id, null, {
        color: topicColor,
        fullName: topicName
      });
      topicMap.set(topicKey, topic);
      result.topics.push(topic);
    } else {
      topic = topicMap.get(topicKey);
    }
    
    // Create card in new format
    const newCard = createCard(
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
    
    // Preserve timestamps if they exist
    if (card.createdAt) newCard.createdAt = card.createdAt;
    if (card.updatedAt) newCard.updatedAt = card.updatedAt;
    
    // Add card to the cards array
    result.cards.push(newCard);
    
    // Update topic's cards array and isEmpty flag
    topic.cards.push(newCard.id);
    topic.isEmpty = false;
  });
  
  return result;
};

/**
 * Convert from the unified data model to the old format for backward compatibility
 * @param {Object} unifiedData - Data in the unified model format
 * @returns {Array} - Array of cards in the old format
 */
export const convertToOldFormat = (unifiedData) => {
  if (!unifiedData || !unifiedData.cards) {
    return [];
  }
  
  // Create lookup maps for subjects and topics
  const subjectMap = new Map();
  const topicMap = new Map();
  
  unifiedData.subjects.forEach(subject => {
    subjectMap.set(subject.id, subject);
  });
  
  unifiedData.topics.forEach(topic => {
    topicMap.set(topic.id, topic);
  });
  
  // Convert each card to the old format
  return unifiedData.cards.map(card => {
    const subject = subjectMap.get(card.subjectId);
    const topic = topicMap.get(card.topicId);
    
    return {
      id: card.id,
      subject: subject?.name || card.subject || 'General',
      topic: topic?.fullName || card.topic || 'General',
      examBoard: card.examBoard || '',
      examType: card.examType || '',
      question: card.question || '',
      answer: card.answer || '',
      front: card.question || '',  // For backward compatibility
      back: card.answer || '',     // For backward compatibility
      detailedAnswer: card.detailedAnswer || '',
      additionalInfo: card.additionalInfo || '',
      type: 'card',
      questionType: card.questionType || 'short_answer',
      options: card.options || [],
      savedOptions: card.savedOptions || [],
      correctAnswer: card.correctAnswer || '',
      cardColor: card.cardColor || '#46f0f0',
      textColor: card.textColor || '',
      boxNum: card.boxNum || 1,
      lastReviewed: card.lastReviewed,
      nextReviewDate: card.nextReviewDate,
      createdAt: card.createdAt || new Date().toISOString(),
      updatedAt: card.updatedAt || new Date().toISOString()
    };
  });
};

/**
 * Find a topic by ID in the unified data model
 * @param {Object} unifiedData - Data in the unified model format
 * @param {string} topicId - Topic ID to find
 * @returns {Object|null} - Found topic or null if not found
 */
export const findTopicById = (unifiedData, topicId) => {
  if (!unifiedData || !unifiedData.topics) return null;
  return unifiedData.topics.find(topic => topic.id === topicId) || null;
};

/**
 * Find a subject by ID in the unified data model
 * @param {Object} unifiedData - Data in the unified model format
 * @param {string} subjectId - Subject ID to find
 * @returns {Object|null} - Found subject or null if not found
 */
export const findSubjectById = (unifiedData, subjectId) => {
  if (!unifiedData || !unifiedData.subjects) return null;
  return unifiedData.subjects.find(subject => subject.id === subjectId) || null;
};

/**
 * Get cards for a specific topic
 * @param {Object} unifiedData - Data in the unified model format
 * @param {string} topicId - Topic ID to get cards for
 * @returns {Array} - Array of cards belonging to the topic
 */
export const getCardsForTopic = (unifiedData, topicId) => {
  if (!unifiedData || !unifiedData.cards) return [];
  return unifiedData.cards.filter(card => card.topicId === topicId);
};

/**
 * Get cards for a specific subject
 * @param {Object} unifiedData - Data in the unified model format
 * @param {string} subjectId - Subject ID to get cards for
 * @returns {Array} - Array of cards belonging to the subject
 */
export const getCardsForSubject = (unifiedData, subjectId) => {
  if (!unifiedData || !unifiedData.cards) return [];
  return unifiedData.cards.filter(card => card.subjectId === subjectId);
};

/**
 * Get topics for a specific subject
 * @param {Object} unifiedData - Data in the unified model format
 * @param {string} subjectId - Subject ID to get topics for
 * @returns {Array} - Array of topics belonging to the subject
 */
export const getTopicsForSubject = (unifiedData, subjectId) => {
  if (!unifiedData || !unifiedData.topics) return [];
  return unifiedData.topics.filter(topic => topic.subjectId === subjectId);
};

const UnifiedDataModel = {
  ENTITY_TYPES,
  SCHEMA_VERSION,
  generateId,
  createSubject,
  createTopic,
  createCard,
  createEmptyDataStructure,
  convertFromOldFormat,
  convertToOldFormat,
  findTopicById,
  findSubjectById,
  getCardsForTopic,
  getCardsForSubject,
  getTopicsForSubject
}; 

export default UnifiedDataModel; 