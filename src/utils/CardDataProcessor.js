/**
 * CardDataProcessor.js - Provides data processing for card collections
 * Handles validation, sanitization, migration, and format conversions
 */

import { 
  createStandardCard, 
  validateCard, 
  prepareCardsForKnack, 
  migrateCardsToStandard,
  enhanceSpacedRepetitionData,
  validateCards as validateCardsInternal
} from './StandardCardModel';
import { safeParseJSON } from './DataUtils';

/**
 * Sanitize a collection of cards to the standard format
 * @param {Array} cards - Cards to sanitize
 * @returns {Array} Sanitized cards in standard format
 */
export const sanitizeCards = (cards) => {
  if (!Array.isArray(cards)) {
    console.error('sanitizeCards: Input is not an array');
    return [];
  }
  
  // Create standard cards for each input card
  return cards.map(card => createStandardCard(card));
};

/**
 * Validate a collection of cards, removing or fixing invalid cards
 * @param {Array} cards - Cards to validate
 * @param {boolean} removeInvalid - Whether to remove invalid cards (default: false)
 * @returns {Object} - Validation result object
 */
export const validateCards = (cards, removeInvalid = false) => {
  // Use the internal validation function
  const result = validateCardsInternal(cards);
  
  // Return the full result if not removing invalid cards
  if (!removeInvalid) {
    return result;
  }
  
  // Otherwise return only the cleaned cards
  return {
    ...result,
    processedCards: result.cleanedCards
  };
};

/**
 * Check if a set of cards needs migration to the current schema
 * @param {Array} cards - Cards to check
 * @returns {boolean} True if migration is needed
 */
export const needsMigration = (cards) => {
  if (!Array.isArray(cards) || cards.length === 0) return false;
  
  // Sample the first few cards for migration check
  const sampleSize = Math.min(cards.length, 5);
  const sampleCards = cards.slice(0, sampleSize);
  
  // Check if any cards need migration
  return sampleCards.some(card => 
    !card.hasOwnProperty('createdAt') || 
    !card.hasOwnProperty('examBoard') ||
    !card.hasOwnProperty('examType')
  );
};

/**
 * Migrate card data to the current schema
 * @param {Array|Object} data - Cards or app data object containing cards
 * @returns {Array|Object} - Migrated cards or app data
 */
export const migrateData = (data) => {
  // If it's an array, migrate the cards directly
  if (Array.isArray(data)) {
    return migrateCardsToStandard(data);
  }
  
  // If it's an object with a cards property, migrate that property
  if (data && typeof data === 'object' && Array.isArray(data.cards)) {
    return {
      ...data,
      cards: migrateCardsToStandard(data.cards)
    };
  }
  
  // If it's neither, return the original data
  console.warn('migrateData: Input is neither an array nor an object with cards');
  return data;
};

/**
 * Process data from Knack into app format
 * @param {string|Object} rawData - Raw data from Knack
 * @returns {Object} - Processed data object with cards, colors, etc.
 */
export const parseFromKnack = (rawData) => {
  try {
    // Parse if it's a string
    const data = typeof rawData === 'string' ? safeParseJSON(rawData) : rawData;
    if (!data) return null;
    
    const result = {
      cards: [],
      colorMapping: {},
      spacedRepetition: {
        box1: [], box2: [], box3: [], box4: [], box5: []
      },
      userTopics: {}
    };
    
    // Process cards if available
    if (data.cards && Array.isArray(data.cards)) {
      // Migrate and sanitize
      const migratedCards = migrateCardsToStandard(data.cards);
      result.cards = sanitizeCards(migratedCards);
    }
    
    // Process color mapping
    if (data.colorMapping) {
      result.colorMapping = typeof data.colorMapping === 'string' ? 
        safeParseJSON(data.colorMapping) : data.colorMapping;
    }
    
    // Process spaced repetition data
    if (data.spacedRepetition) {
      const srData = typeof data.spacedRepetition === 'string' ? 
        safeParseJSON(data.spacedRepetition) : data.spacedRepetition;
      
      // Enhance with card data if needed
      result.spacedRepetition = result.cards.length > 0 ? 
        enhanceSpacedRepetitionData(result.cards, srData) : srData;
    }
    
    // Process user topics
    if (data.userTopics) {
      result.userTopics = typeof data.userTopics === 'string' ? 
        safeParseJSON(data.userTopics) : data.userTopics;
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing data from Knack:', error);
    return null;
  }
};

/**
 * Prepare data for saving to Knack
 * @param {Object} appData - App data object with cards, colors, etc.
 * @returns {Object} - Data ready for Knack
 */
export const prepareForKnack = (appData) => {
  try {
    const result = { ...appData };
    
    // Process cards if available
    if (appData.cards && Array.isArray(appData.cards)) {
      result.cards = prepareCardsForKnack(appData.cards);
    }
    
    // Ensure all data is serializable
    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    console.error('Error preparing data for Knack:', error);
    // Try to strip circular references
    const cache = new Set();
    const safeStringify = (obj) => {
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) {
            // Circular reference found, discard key
            return '[Circular]';
          }
          cache.add(value);
        }
        return value;
      });
    };
    
    try {
      // Try again with safe stringify
      return JSON.parse(safeStringify(appData));
    } catch (e) {
      console.error('Failed to make data serializable:', e);
      return null;
    }
  }
};

/**
 * Get unique subjects from a collection of cards
 * @param {Array} cards - Card collection
 * @returns {Array} - Unique subject names
 */
export const getUniqueSubjects = (cards) => {
  if (!Array.isArray(cards)) return [];
  
  const subjects = new Set();
  cards.forEach(card => {
    subjects.add(card.subject || 'General');
  });
  
  return Array.from(subjects).sort();
};

/**
 * Get unique topics for a subject from a collection of cards
 * @param {Array} cards - Card collection
 * @param {string} subject - Subject name
 * @returns {Array} - Unique topic names for the subject
 */
export const getUniqueTopics = (cards, subject) => {
  if (!Array.isArray(cards) || !subject) return [];
  
  const topics = new Set();
  cards
    .filter(card => (card.subject || 'General') === subject)
    .forEach(card => {
      topics.add(card.topic || 'General');
    });
  
  return Array.from(topics).sort();
};

/**
 * Search cards by subject, topic, text, or other properties
 * @param {Array} cards - Card collection
 * @param {Object} criteria - Search criteria
 * @returns {Array} - Matching cards
 */
export const searchCards = (cards, criteria = {}) => {
  if (!Array.isArray(cards)) return [];
  
  return cards.filter(card => {
    // Match by subject
    if (criteria.subject && (card.subject || 'General') !== criteria.subject) {
      return false;
    }
    
    // Match by topic
    if (criteria.topic && (card.topic || 'General') !== criteria.topic) {
      return false;
    }
    
    // Match by exam board
    if (criteria.examBoard && card.examBoard !== criteria.examBoard) {
      return false;
    }
    
    // Match by exam type
    if (criteria.examType && card.examType !== criteria.examType) {
      return false;
    }
    
    // Match by text search in question, answer, or keywords
    if (criteria.searchText) {
      const searchLower = criteria.searchText.toLowerCase();
      const questionMatch = (card.question || '').toLowerCase().includes(searchLower);
      const answerMatch = (card.answer || '').toLowerCase().includes(searchLower);
      const detailedMatch = (card.detailedAnswer || '').toLowerCase().includes(searchLower);
      
      if (!questionMatch && !answerMatch && !detailedMatch) {
        return false;
      }
    }
    
    // If all criteria matched or no criteria
    return true;
  });
};

/**
 * Sort cards by a specified field and direction
 * @param {Array} cards - Card collection
 * @param {string} field - Field to sort by (subject, topic, created, etc.)
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Array} - Sorted cards
 */
export const sortCards = (cards, field = 'createdAt', direction = 'desc') => {
  if (!Array.isArray(cards)) return [];
  
  const sortedCards = [...cards];
  
  sortedCards.sort((a, b) => {
    let valueA, valueB;
    
    // Get values based on field
    switch (field) {
      case 'subject':
        valueA = (a.subject || 'General').toLowerCase();
        valueB = (b.subject || 'General').toLowerCase();
        break;
      case 'topic':
        valueA = (a.topic || 'General').toLowerCase();
        valueB = (b.topic || 'General').toLowerCase();
        break;
      case 'createdAt':
        valueA = new Date(a.createdAt || a.timestamp || 0).getTime();
        valueB = new Date(b.createdAt || b.timestamp || 0).getTime();
        break;
      case 'updatedAt':
        valueA = new Date(a.updatedAt || a.createdAt || a.timestamp || 0).getTime();
        valueB = new Date(b.updatedAt || b.createdAt || b.timestamp || 0).getTime();
        break;
      case 'boxNum':
        valueA = a.boxNum || 1;
        valueB = b.boxNum || 1;
        break;
      default:
        valueA = a[field] || '';
        valueB = b[field] || '';
    }
    
    // Compare based on direction
    const compareResult = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    return direction === 'asc' ? compareResult : -compareResult;
  });
  
  return sortedCards;
};

/**
 * Group cards by a specified field
 * @param {Array} cards - Card collection
 * @param {string} field - Field to group by (subject, topic, etc.)
 * @returns {Object} - Cards grouped by field
 */
export const groupCards = (cards, field = 'subject') => {
  if (!Array.isArray(cards)) return {};
  
  const grouped = {};
  
  cards.forEach(card => {
    const key = card[field] || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(card);
  });
  
  return grouped;
};

/**
 * Add fields to all cards in a collection
 * @param {Array} cards - Card collection
 * @param {Object} fields - Fields to add
 * @returns {Array} - Updated cards
 */
export const addFieldsToCards = (cards, fields = {}) => {
  if (!Array.isArray(cards) || !fields || typeof fields !== 'object') {
    return cards;
  }
  
  return cards.map(card => ({
    ...card,
    ...fields
  }));
};

/**
 * Create a backup of card data
 * @param {Array} cards - Card collection
 * @param {string} reason - Reason for backup
 * @returns {Object} - Backup object
 */
export const createBackup = (cards, reason = 'manual') => {
  return {
    timestamp: new Date().toISOString(),
    reason,
    cardCount: Array.isArray(cards) ? cards.length : 0,
    cards: Array.isArray(cards) ? [...cards] : []
  };
};

/**
 * Improved function to detect if a card is multiple choice based on content
 * @param {Object} card - The card to check
 * @returns {boolean} - Whether the card is multiple choice
 */
export const isMultipleChoiceCard = (card) => {
  // Case 1: Card has options array
  if (card.options && Array.isArray(card.options) && card.options.length > 0) {
    return true;
  }
  
  // Case 2: Card has savedOptions array
  if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
    return true;
  }
  
  // Case 3: Card has questionType explicitly set
  if (card.questionType === 'multiple_choice') {
    return true;
  }
  
  // Case 4: Answer contains "Correct Answer: X)" pattern
  if (card.answer && typeof card.answer === 'string') {
    // Check for "Correct Answer: a)" or "Correct Answer: b)" pattern
    if (card.answer.match(/Correct Answer:\s*[a-z]\)/i)) {
      return true;
    }
    
    // Check for option lettering pattern
    if (card.answer.match(/[a-e]\)\s*[A-Za-z]/)) {
      return true;
    }
  }
  
  // Case 5: Type is already set
  if (card.type === 'multiple_choice') {
    return true;
  }
  
  return false;
};

/**
 * Extract options from answer text for multiple choice cards missing options
 * @param {Object} card - The card to process
 * @returns {Array} - Extracted options
 */
export const extractOptionsFromAnswer = (card) => {
  if (!card.answer || typeof card.answer !== 'string') {
    return [];
  }
  
  // Try to find the correct option letter (a, b, c, d, e)
  const correctAnswerMatch = card.answer.match(/Correct Answer:\s*([a-e])\)/i);
  if (!correctAnswerMatch) {
    return [];
  }
  
  const correctLetter = correctAnswerMatch[1].toLowerCase();
  
  // Create placeholder options based on the correct answer position
  const options = [];
  const letters = ['a', 'b', 'c', 'd', 'e'];
  const correctIndex = letters.indexOf(correctLetter);
  
  if (correctIndex >= 0) {
    // Create 4 options with the correct one marked
    letters.slice(0, 4).forEach(letter => {
      options.push({
        text: letter === correctLetter ? `${card.detailedAnswer || 'Correct option'}` : `Option ${letter.toUpperCase()}`,
        isCorrect: letter === correctLetter
      });
    });
  }
  
  return options;
};
