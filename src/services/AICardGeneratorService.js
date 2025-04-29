/**
 * AICardGeneratorService.js
 * HTTP-based service for card generation using the backend API
 */

// Backend API endpoint
const API_ENDPOINT = 'https://aicardgenerator-b1b251a07885.herokuapp.com/api/generate-cards';

/**
 * Debug logging helper
 */
const debugLog = (title, data) => {
  console.log(`%c[AICardGeneratorService] ${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

/**
 * Generate flashcards via HTTP request to the backend
 * @param {Object} params - Generation parameters
 * @returns {Promise<Array>} - Generated cards
 */
export const generateCards = async (params) => {
  try {
    debugLog('Generating cards with params', params);
    
    // Extract parameters with default values
    const {
      subject = 'General',
      topic = 'General',
      examType = 'General',
      examBoard = 'General',
      cardType = 'multiple_choice', // Using cardType as the main param name
      questionType, // For backward compatibility
      count = 1, // Using count as the main param name
      numCards, // For backward compatibility
      contentGuidance = '',
      userId = null,
      recordId = null
    } = params;

    // Map our simplified types to backend types if needed
    const mappedQuestionType = questionType || cardType;
    const mappedNumCards = numCards || count;

    // Make the API request
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId || 'anonymous', // Add user ID if available
        'X-Record-ID': recordId || '' // Add record ID if available
      },
      body: JSON.stringify({
        subject,
        topic,
        examType,
        examBoard,
        questionType: mappedQuestionType,
        numCards: mappedNumCards,
        contentGuidance
      })
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    // Parse and return response data
    const data = await response.json();
    
    // Extract cards from the response structure
    // The backend wraps the cards array in an object with a "cards" property
    if (data.cards) {
      debugLog('Successfully generated cards', { count: data.cards.length || 0 });
      return data.cards;
    } else if (Array.isArray(data)) {
      // Fallback for backward compatibility
      debugLog('Successfully generated cards (array format)', { count: data.length || 0 });
      return data;
    } else {
      debugLog('Unexpected response format', data);
      throw new Error('Unexpected response format from API');
    }
  } catch (error) {
    console.error('[AICardGeneratorService] Card generation failed:', error);
    throw error;
  }
};

/**
 * Process card data to ensure it matches the expected schema
 * 
 * @param {Array} cards - Raw cards from the API
 * @param {Object} metadata - Metadata to apply to all cards (subject, topic, etc.)
 * @returns {Array} - Processed cards ready for saving
 */
export const processCards = (cards, metadata) => {
  if (!Array.isArray(cards)) {
    console.error('[AICardGeneratorService] Cannot process cards - expected array but got:', typeof cards);
    return [];
  }

  const {
    subject = 'General',
    topic = 'General',
    examType = 'General',
    examBoard = 'General',
    cardColor = '#3cb44b',
    textColor = '',
    topicId = null
  } = metadata;

  return cards.map((card, index) => {
    // Basic validation - ensure we have a card object
    if (!card || typeof card !== 'object') {
      console.warn('[AICardGeneratorService] Invalid card object at index', index);
      return null;
    }

    // Generate unique ID (similar to existing ID generation)
    const id = `card_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare front/back content based on card structure
    let front = card.question || card.acronym || 'Question Not Available';
    let back = card.detailedAnswer || card.explanation || 'Answer Not Available';
    
    // Special handling for multiple choice
    if (card.questionType === 'multiple_choice' && card.options && card.correctAnswer) {
      const correctOptionText = card.correctAnswer;
      // Find correct index by comparing option text
      let correctIndex = card.options.findIndex(opt => opt && opt.trim() === correctOptionText.trim());
      
      // Fallback: try case-insensitive match
      if (correctIndex === -1) {
        correctIndex = card.options.findIndex(opt => 
          opt && opt.trim().toLowerCase() === correctOptionText.trim().toLowerCase()
        );
      }
      
      // Final fallback to first option
      if (correctIndex === -1) {
        console.warn(`[AICardGeneratorService] Could not match correctAnswer "${correctOptionText}" to options. Defaulting to option A.`);
        correctIndex = 0;
      }
      
      const letter = correctIndex !== -1 ? String.fromCharCode(97 + correctIndex) : '?';
      back = `Correct Answer: ${letter}) ${card.options[correctIndex]}`;
    }
    
    // Create card object matching the expected schema
    const processedCard = {
      id,
      subject: card.subject || subject,
      topic: card.topic || topic,
      examType: card.examType || examType,
      examBoard: card.examBoard || examBoard,
      type: card.questionType || card.type || 'short_answer', // Standardize on "type"
      questionType: card.questionType || card.type || 'short_answer', // Keep for backward compatibility
      question: front,
      answer: back,
      front, // Duplicate for compatibility
      back,  // Duplicate for compatibility
      detailedAnswer: card.detailedAnswer || '',
      additionalInfo: card.additionalInfo || '',
      cardColor: cardColor,
      baseColor: cardColor,
      textColor: textColor,
      timestamp: new Date().toISOString(),
      topicId: topicId,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      nextReviewDate: new Date().toISOString(),
      boxNum: 1, // Start in box 1 for spaced repetition
      isShell: false, // Not a topic shell
      isEmpty: false // Has content
    };
    
    // Handle multiple choice options
    if (card.options && Array.isArray(card.options)) {
      processedCard.options = card.options;
      processedCard.savedOptions = [...card.options]; // Backup for multiple choice options
      processedCard.correctAnswer = card.correctAnswer || '';
    } else {
      processedCard.options = [];
      processedCard.savedOptions = [];
      processedCard.correctAnswer = '';
    }
    
    // Return the standardized card
    return processedCard;
  }).filter(Boolean); // Remove any null entries
};

// Export the service functions
export default {
  generateCards,
  processCards
};
