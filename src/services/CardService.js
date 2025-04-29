import { getContrastColor } from '../utils/ColorUtils';

/**
 * Service for handling flashcard generation and management
 */
const CardService = {
  /**
   * Generate flashcards via the backend API
   * 
   * @param {Object} params Card generation parameters
   * @param {string} params.subject Subject name
   * @param {string} params.topic Topic name
   * @param {string} params.examType Exam type (e.g., 'A-Level')
   * @param {string} params.examBoard Exam board (e.g., 'Edexcel')
   * @param {string} params.questionType Type of question (e.g., 'multiple_choice')
   * @param {number} params.numCards Number of cards to generate
   * @param {string} params.topicId Topic ID for associating with generated cards
   * @param {string} params.topicColor Color for the topic/cards
   * @returns {Promise<Array>} Array of generated card objects
   */
  async generateCards({
    subject,
    topic,
    examType,
    examBoard,
    questionType,
    numCards,
    topicId,
    topicColor
  }) {
    try {
      // Make API request to your backend
      const response = await fetch('https://aicardgenerator-b1b251a07885.herokuapp.com/generate-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          topic,
          examType,
          examBoard,
          questionType,
          numCards
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('API response is not an array');
      }
      
      // Process cards with metadata
      return this.processCards(data, {
        topicId,
        topicName: topic,
        subject,
        examType,
        examBoard,
        cardColor: topicColor,
      });
    } catch (error) {
      console.error('Error generating cards:', error);
      throw error;
    }
  },
  
  /**
   * Process raw cards from the API by adding metadata
   * 
   * @param {Array} cards Raw card data from API
   * @param {Object} metadata Metadata to add to each card
   * @returns {Array} Processed cards with metadata
   */
  processCards(cards, metadata) {
    const { 
      topicId, 
      topicName, 
      subject, 
      examType, 
      examBoard, 
      cardColor = '#3cb44b'
    } = metadata;
    
    const textColor = getContrastColor(cardColor);
    
    return cards.map((card, index) => {
      // Normalize card data structure
      const processed = {
        ...card,
        id: card.id || `card_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
        topicId: topicId || card.topicId,
        topicName: topicName || card.topicName || card.topic,
        topic: card.topic || topicName,
        subject: card.subject || subject,
        examType: card.examType || examType,
        examBoard: card.examBoard || examBoard,
        cardColor: card.cardColor || cardColor,
        textColor: card.textColor || textColor,
        boxNum: card.boxNum || 1, // Start in box 1 (Leitner system)
        created: card.created || new Date().toISOString(),
        lastReviewed: card.lastReviewed || new Date().toISOString(),
        nextReviewDate: card.nextReviewDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      
      // Handle multiple choice options if present
      if (card.questionType === 'multiple_choice' && Array.isArray(card.options)) {
        processed.options = card.options;
        processed.savedOptions = card.savedOptions || card.options;
      }
      
      // Ensure front/back content is present
      if (!processed.front && processed.question) {
        processed.front = processed.question;
      }
      
      if (!processed.back && processed.answer) {
        processed.back = processed.answer;
      }
      
      // Ensure question/answer content is present (backwards compatibility)
      if (!processed.question && processed.front) {
        processed.question = processed.front;
      }
      
      if (!processed.answer && processed.back) {
        processed.answer = processed.back;
      }
      
      return processed;
    });
  },
  
  /**
   * Calculate the next review date based on box number
   * 
   * @param {number} boxNum Leitner box number (1-5)
   * @returns {Date} Next review date
   */
  calculateNextReviewDate(boxNum) {
    const now = new Date();
    const nextReview = new Date();
    
    switch (boxNum) {
      case 1: // Every day
        nextReview.setDate(now.getDate() + 1);
        break;
      case 2: // Every other day
        nextReview.setDate(now.getDate() + 2);
        break;
      case 3: // Every 3 days
        nextReview.setDate(now.getDate() + 3);
        break;
      case 4: // Every week
        nextReview.setDate(now.getDate() + 7);
        break;
      case 5: // "Retired" - 1 month
        nextReview.setMonth(now.getMonth() + 1);
        break;
      default:
        nextReview.setDate(now.getDate() + 1);
    }
    
    return nextReview;
  },
  
  /**
   * Update a card's Leitner box status based on answer correctness
   * 
   * @param {Object} card The card to update
   * @param {boolean} isCorrect Whether the answer was correct
   * @returns {Object} Updated card with new box status
   */
  updateCardBoxStatus(card, isCorrect) {
    // Calculate new box number based on Leitner system
    const oldBoxNum = card.boxNum || 1;
    const newBoxNum = isCorrect 
      ? Math.min(oldBoxNum + 1, 5) // Move up one box, max 5
      : 1; // Always back to box 1 if wrong
    
    // Calculate review dates
    const now = new Date();
    const nextReviewDate = this.calculateNextReviewDate(newBoxNum);
    
    // Return updated card
    return {
      ...card,
      boxNum: newBoxNum,
      lastReviewed: now.toISOString(),
      nextReviewDate: nextReviewDate.toISOString()
    };
  }
};

export default CardService; 