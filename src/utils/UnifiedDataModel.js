/**
 * UnifiedDataModel.js
 * 
 * This module defines a unified data model for flashcards, topics, and subjects,
 * with proper relationships and a hierarchical structure.
 * Updated to schema version 2.0 with refined relationships and structure.
 */

// Constants for entity types
export const ENTITY_TYPES = {
  SUBJECT: 'subject',
  TOPIC: 'topic',
  CARD: 'card'
};

// Update schema version to 2.0
export const SCHEMA_VERSION = '2.0';

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
    metadata: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      createdBy: options.createdBy || '',
      isHidden: options.isHidden || false,
      sortOrder: options.sortOrder || 0
    }
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
    subjectId: subjectId,
    parentId: parentId,
    name: name,
    fullName: options.fullName || name,
    color: options.color || '#9ec2a2',
    isEmpty: options.isEmpty !== undefined ? options.isEmpty : true,
    level: options.level || (parentId ? 2 : 1),
    cardIds: options.cardIds || [],
    type: ENTITY_TYPES.TOPIC,
    metadata: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      examBoard: options.examBoard || '',
      examType: options.examType || '',
      description: options.description || '',
      isShell: options.isShell !== undefined ? options.isShell : false,
      sortOrder: options.sortOrder || 0
    }
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
    type: ENTITY_TYPES.CARD,
    question: question,
    answer: answer,
    questionType: options.questionType || 'short_answer',
    cardColor: options.cardColor || '#46f0f0',
    textColor: options.textColor || '',
    
    // Spaced repetition properties
    boxNum: options.boxNum || 1,
    lastReviewed: options.lastReviewed || null,
    nextReviewDate: options.nextReviewDate || timestamp,
    
    // Type-specific properties
    options: options.options || [],
    savedOptions: options.savedOptions || options.options || [],
    correctAnswer: options.correctAnswer || '',
    detailedAnswer: options.detailedAnswer || '',
    
    // Metadata
    metadata: {
      created: timestamp,
      updated: timestamp,
      version: options.version || 1,
      examBoard: options.examBoard || '',
      examType: options.examType || '',
      difficulty: options.difficulty || 3,
      tags: options.tags || [],
      source: options.source || 'User Created',
      aiModel: options.aiModel || ''
    }
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
    userId: '',
    recordId: '',
    subjects: [],
    topics: [],
    cards: []
  };
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
      subject: subject?.name || 'General',
      topic: topic?.name || 'General',
      examBoard: card.metadata?.examBoard || topic?.metadata?.examBoard || subject?.examBoard || '',
      examType: card.metadata?.examType || topic?.metadata?.examType || subject?.examType || '',
      question: card.question || '',
      answer: card.answer || '',
      front: card.question || '',  // For backward compatibility
      back: card.answer || '',     // For backward compatibility
      detailedAnswer: card.detailedAnswer || '',
      additionalInfo: card.metadata?.description || '',
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
      createdAt: card.metadata?.created || new Date().toISOString(),
      updatedAt: card.metadata?.updated || new Date().toISOString()
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

/**
 * Generate a topic color from a subject color
 * @param {string} subjectColor - Subject color in hex format
 * @param {number} topicIndex - Index of the topic
 * @param {number} totalTopics - Total number of topics for the subject
 * @returns {string} - Generated topic color
 */
export const generateTopicColor = (subjectColor, topicIndex, totalTopics) => {
  // Simple implementation for now
  const hue = parseInt(subjectColor.substring(1, 3), 16) % 360;
  const saturation = 70 + (topicIndex % 3) * 10;
  const lightness = 40 + (topicIndex / totalTopics) * 30;
  
  return hslToHex(hue, saturation, lightness);
};

/**
 * Convert HSL to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} - Hex color
 */
export const hslToHex = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Calculate contrast text color for a background color
 * @param {string} backgroundColor - Background color in hex format
 * @returns {string} - Contrast text color (#000000 or #ffffff)
 */
export const getContrastTextColor = (backgroundColor) => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

export default {
  ENTITY_TYPES,
  SCHEMA_VERSION,
  generateId,
  createSubject,
  createTopic,
  createCard,
  createEmptyDataStructure,
  convertToOldFormat,
  findTopicById,
  findSubjectById,
  getCardsForTopic,
  getCardsForSubject,
  getTopicsForSubject,
  generateTopicColor,
  hslToHex,
  getContrastTextColor
}; 