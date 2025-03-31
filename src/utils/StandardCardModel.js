/**
 * StandardCardModel.js - Defines standard data structure for flashcards
 * Provides validation, sanitization, and standardization functions
 */

import { v4 as uuidv4 } from 'uuid';

// Enum for card types
export const CARD_TYPES = {
  SHORT_ANSWER: 'short_answer',
  MULTIPLE_CHOICE: 'multiple_choice',
  ESSAY: 'essay',
  ACRONYM: 'acronym'
};

// Enum for exam boards
export const EXAM_BOARDS = {
  AQA: 'AQA',
  EDEXCEL: 'Edexcel',
  OCR: 'OCR',
  WJEC: 'WJEC',
  CCEA: 'CCEA',
  OTHER: 'Other'
};

// Enum for exam types
export const EXAM_TYPES = {
  A_LEVEL: 'A-Level',
  GCSE: 'GCSE',
  IB: 'IB',
  UNIVERSITY: 'University',
  OTHER: 'Other'
};

/**
 * Generate a unique ID for a card 
 * @returns {string} Unique ID
 */
export const generateCardId = () => {
  return uuidv4();
};

/**
 * Safe HTML sanitizer to prevent XSS
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML string
 */
export const sanitizeHtml = (html) => {
  if (!html) return '';
  
  // If it's not a string, convert to string
  const htmlString = String(html);
  
  // For now, we'll just strip script tags and dangerous attributes
  // In a production environment, use a proper sanitizer like DOMPurify
  return htmlString
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '');
};

/**
 * Clean array of strings, removing empty items and sanitizing content
 * @param {Array|string} array - Array to clean or string to split
 * @param {string} delimiter - Delimiter for splitting string (default: semicolon)
 * @returns {Array} Cleaned array
 */
export const sanitizeArray = (array, delimiter = ';') => {
  // If it's a string, split it
  if (typeof array === 'string') {
    array = array.split(delimiter);
  }
  
  // If it's not an array or is null/undefined, return empty array
  if (!Array.isArray(array)) {
    return [];
  }
  
  // Remove empty items and sanitize
  return array
    .map(item => typeof item === 'string' ? item.trim() : String(item).trim())
    .filter(item => item.length > 0);
};

/**
 * Calculate a contrast text color based on background brightness
 * @param {string} bgColor - Background color in hex format
 * @returns {string} Black or white text color for contrast
 */
export const calculateContrastColor = (bgColor) => {
  // Default to black if no color provided
  if (!bgColor || typeof bgColor !== 'string') {
    return '#000000';
  }
  
  try {
    // Remove # if present
    const hex = bgColor.replace('#', '');
    
    // Handle 3-character hex
    const expandedHex = hex.length === 3 
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex;
      
    // Convert to RGB
    const r = parseInt(expandedHex.substring(0, 2), 16);
    const g = parseInt(expandedHex.substring(2, 4), 16);
    const b = parseInt(expandedHex.substring(4, 6), 16);
    
    // Calculate brightness (YIQ formula)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return white for dark backgrounds, black for light backgrounds
    return brightness > 128 ? '#000000' : '#ffffff';
  } catch (e) {
    console.error('Error calculating contrast color:', e);
    return '#000000'; // Default to black
  }
};

/**
 * Create a standard card object, with all required fields
 * @param {Object} data - Card data
 * @returns {Object} Standardized card object
 */
export const createStandardCard = (data = {}) => {
  // Generate ID if not provided
  const id = data.id || generateCardId();
  
  // Basic card data with defaults
  const standardCard = {
    // Core identification
    id: id,
    
    // Subject and topic information
    subject: data.subject || 'General',
    topic: data.topic || 'General',
    examBoard: data.examBoard || '',
    examType: data.examType || '',
    topicPriority: data.topicPriority || 0,
    
    // Content fields
    question: sanitizeHtml(data.question || ''),
    answer: sanitizeHtml(data.answer || ''),
    keyPoints: sanitizeArray(data.keyPoints || []),
    detailedAnswer: sanitizeHtml(data.detailedAnswer || ''),
    additionalInfo: sanitizeHtml(data.additionalInfo || ''),
    
    // Card type
    type: data.type || CARD_TYPES.SHORT_ANSWER,
    
    // Visual properties
    cardColor: data.cardColor || data.color || '#3cb44b',
    textColor: data.textColor || calculateContrastColor(data.cardColor || data.color || '#3cb44b'),
    
    // Spaced repetition
    boxNum: data.boxNum || 1,
    lastReviewed: data.lastReviewed || null,
    nextReviewDate: data.nextReviewDate || new Date().toISOString(),
    
    // Metadata
    createdAt: data.createdAt || data.dateCreated || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Add type-specific fields
  switch (standardCard.type) {
    case CARD_TYPES.MULTIPLE_CHOICE:
      standardCard.options = sanitizeArray(data.options || []);
      standardCard.correctOption = data.correctOption || '';
      break;
      
    case CARD_TYPES.ACRONYM:
      standardCard.acronym = sanitizeHtml(data.acronym || '');
      standardCard.explanation = sanitizeHtml(data.explanation || '');
      break;
    default:
      // Do nothing for other types or if type is unknown
      break;
  }
  
  return standardCard;
};

/**
 * Validate a card object, returning validation errors if any
 * @param {Object} card - Card object to validate
 * @returns {Object} Validation result with status and errors
 */
export const validateCard = (card) => {
  const errors = [];
  
  // Check if card is an object
  if (!card || typeof card !== 'object') {
    return { 
      valid: false, 
      errors: ['Card must be an object']
    };
  }
  
  // Check required fields
  if (!card.id) {
    errors.push('Card ID is required');
  }
  
  if (!card.question) {
    errors.push('Question is required');
  }
  
  // Check type-specific required fields
  switch (card.type) {
    case CARD_TYPES.MULTIPLE_CHOICE:
      if (!Array.isArray(card.options) || card.options.length < 2) {
        errors.push('Multiple choice cards require at least 2 options');
      }
      if (!card.correctOption) {
        errors.push('Multiple choice cards require a correct option');
      }
      break;
      
    case CARD_TYPES.ACRONYM:
      if (!card.acronym) {
        errors.push('Acronym cards require an acronym');
      }
      if (!card.explanation) {
        errors.push('Acronym cards require an explanation');
      }
      break;
      
    case CARD_TYPES.SHORT_ANSWER:
    case CARD_TYPES.ESSAY:
      if (!card.answer) {
        errors.push(`${card.type} cards require an answer`);
      }
      break;
      
    default:
      errors.push(`Unknown card type: ${card.type}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Create a card from one format to another (e.g., API to UI format)
 * @param {Object} card - Card object to convert
 * @param {string} targetFormat - Target format ('ui', 'storage', 'api')
 * @returns {Object} Converted card object
 */
export const convertCardFormat = (card, targetFormat = 'storage') => {
  // Create a standard card first to ensure all fields are present
  const standardCard = createStandardCard(card);
  
  // Clone the card to avoid modifying the original
  const convertedCard = { ...standardCard };
  
  switch (targetFormat) {
    // For UI display
    case 'ui':
      // Rename some fields for legacy UI components
      convertedCard.front = convertedCard.question;
      convertedCard.back = convertedCard.answer;
      break;
      
    // For storage in Knack
    case 'storage':
      // Add metadata for tracking
      convertedCard._version = '1.0';
      convertedCard._lastSaved = new Date().toISOString();
      break;
      
    // Format for external API
    case 'api':
      // Remove internal fields
      delete convertedCard.boxNum;
      delete convertedCard.lastReviewed;
      delete convertedCard.nextReviewDate;
      break;
    default:
      // If format is unknown, return the standard storage format
      break;
  }
  
  return convertedCard;
};

/**
 * Batch validate cards and return clean and invalid cards
 * @param {Array} cards - Array of cards to validate
 * @returns {Object} Object with valid status, cleaned cards and invalid cards
 */
export const validateCards = (cards) => {
  if (!Array.isArray(cards)) {
    return { 
      valid: false, 
      cleanedCards: [],
      invalidCards: [],
      error: 'Cards must be an array'
    };
  }
  
  const cleanedCards = [];
  const invalidCards = [];
  
  // Validate each card
  cards.forEach((card, index) => {
    const validation = validateCard(card);
    
    if (validation.valid) {
      // Create a standardized version of the card
      cleanedCards.push(createStandardCard(card));
    } else {
      invalidCards.push({
        index,
        card,
        errors: validation.errors
      });
    }
  });
  
  return {
    valid: invalidCards.length === 0,
    cleanedCards,
    invalidCards
  };
};

/**
 * Add topic and color information to spaced repetition box items
 * Creates minimal copies of cards with only essential display fields
 * @param {Array} cards - All cards
 * @param {Object} spacedRepetitionData - Spaced repetition data
 * @returns {Object} Enhanced spaced repetition data
 */
export const enhanceSpacedRepetitionData = (cards, spacedRepetitionData) => {
  // Create a map of card ID to card for fast lookup
  const cardMap = {};
  cards.forEach(card => {
    cardMap[card.id] = card;
  });
  
  // Create a new object to avoid modifying the original
  const enhancedData = {};
  
  // Process each box
  for (let boxNum = 1; boxNum <= 5; boxNum++) {
    const boxKey = `box${boxNum}`;
    const boxItems = spacedRepetitionData[boxKey] || [];
    
    // Create a new array for enhanced items
    enhancedData[boxKey] = boxItems.map(item => {
      // Get the card ID based on the item type
      const cardId = typeof item === 'string' ? item : item.cardId;
      
      // Find the card
      const card = cardMap[cardId];
      
      // If card not found, just return the original item
      if (!card) {
        return item;
      }
      
      // Enhanced box item with subject, topic, and color info for UI
      return {
        cardId,
        subject: card.subject,
        topic: card.topic,
        cardColor: card.cardColor,
        boxNum,
        // Preserve review date information if available
        lastReviewed: item.lastReviewed || card.lastReviewed || null,
        nextReviewDate: item.nextReviewDate || card.nextReviewDate || null
      };
    });
  }
  
  return enhancedData;
};

/**
 * Prepares cards for saving to Knack by ensuring serializable format
 * @param {Array} cards - Cards to prepare for Knack
 * @returns {Array} Prepared cards
 */
export const prepareCardsForKnack = (cards) => {
  return cards.map(card => {
    // Create a serializable copy using standard format
    const knackCard = convertCardFormat(card, 'storage');
    
    // Ensure dates are strings in ISO format
    if (knackCard.lastReviewed instanceof Date) {
      knackCard.lastReviewed = knackCard.lastReviewed.toISOString();
    }
    
    if (knackCard.nextReviewDate instanceof Date) {
      knackCard.nextReviewDate = knackCard.nextReviewDate.toISOString();
    }
    
    if (knackCard.createdAt instanceof Date) {
      knackCard.createdAt = knackCard.createdAt.toISOString();
    }
    
    if (knackCard.updatedAt instanceof Date) {
      knackCard.updatedAt = knackCard.updatedAt.toISOString();
    }
    
    return knackCard;
  });
};

/**
 * Migrate existing cards to the new standard format
 * @param {Array} existingCards - Existing cards array
 * @returns {Array} Migrated cards
 */
export const migrateCardsToStandard = (existingCards) => {
  if (!Array.isArray(existingCards)) return [];
  
  return existingCards.map(card => {
    // Check if we need to transform legacy fields
    const needsMigration = !card.hasOwnProperty('createdAt') || 
                          !card.hasOwnProperty('examBoard') ||
                          !card.hasOwnProperty('examType');
    
    if (needsMigration) {
      // Use legacy fields if they exist
      return createStandardCard({
        ...card,
        // Map legacy fields to standard fields
        question: card.question || card.front,
        answer: card.answer || card.back,
        createdAt: card.timestamp || card.dateCreated || new Date().toISOString()
      });
    }
    
    // Card is already in standard format
    return card;
  });
};
