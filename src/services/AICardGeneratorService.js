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
 * @param {Object} params - Generation parameters (subject, topic, examType, examBoard, questionType, numCards)
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
      questionType = 'multiple_choice',
      numCards = 5,
      contentGuidance = ''
    } = params;

    // Make the API request
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject,
        topic,
        examType,
        examBoard,
        questionType,
        numCards,
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
    debugLog('Successfully generated cards', { count: data?.length || 0 });
    return data;
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
    return {
      id,
      subject: card.subject || subject,
      topic: card.topic || topic,
      examType: card.examType || examType,
      examBoard: card.examBoard || examBoard,
      questionType: card.questionType || 'short_answer',
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
      options: card.options || [],
      savedOptions: card.options || [], // Backup for multiple choice options
      correctAnswer: card.correctAnswer || ''
    };
  }).filter(Boolean); // Remove any null entries
};

// Export the service functions
export default {
  generateCards,
  processCards
};
