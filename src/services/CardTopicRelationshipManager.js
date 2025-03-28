/**
 * CardTopicRelationshipManager.js
 * 
 * This service manages relationships between cards and topics,
 * including detecting card types, matching cards to topics,
 * and fixing relationship issues.
 */

export default class CardTopicRelationshipManager {
  constructor() {
    this.topicCache = new Map();
  }

  /**
   * Process a collection of cards to ensure proper topic relationships
   * @param {Array} cards - Array of cards to process
   * @param {Array} topics - Array of available topics
   * @returns {Array} - Processed cards with verified topic relationships
   */
  processCards(cards, topics) {
    if (!Array.isArray(cards) || !Array.isArray(topics)) {
      console.error('[CardTopicRelationshipManager] Invalid input:', { cards, topics });
      return cards;
    }
    
    // Reset the topic cache
    this.topicCache.clear();
    
    // Build topic lookup maps for quick access
    const topicById = new Map();
    const topicsByName = new Map();
    const topicsBySubject = new Map();
    
    // Process topics into lookup maps
    topics.forEach(topic => {
      if (!topic) return;
      
      // Skip if no ID
      if (!topic.id) return;
      
      // Add to ID map
      topicById.set(topic.id, topic);
      
      // Add to name map
      const name = topic.name || topic.topic || '';
      if (name) {
        if (!topicsByName.has(name)) {
          topicsByName.set(name, []);
        }
        topicsByName.get(name).push(topic);
      }
      
      // Add to subject map
      const subject = topic.subject || '';
      if (subject) {
        if (!topicsBySubject.has(subject)) {
          topicsBySubject.set(subject, []);
        }
        topicsBySubject.get(subject).push(topic);
      }
    });
    
    // Store in cache for quick lookup in other methods
    this.topicCache.set('byId', topicById);
    this.topicCache.set('byName', topicsByName);
    this.topicCache.set('bySubject', topicsBySubject);
    
    // Check each card and ensure proper relationship with a topic
    return cards.map(card => {
      if (!card) return card;
      
      // Normalize the card to ensure required fields
      const normalizedCard = this.normalizeCard(card);
      
      // First check if the card already has a valid topicId
      if (normalizedCard.topicId && topicById.has(normalizedCard.topicId)) {
        // Card already has a valid topicId, just update other fields
        return this.updateCardWithTopicInfo(normalizedCard, topicById.get(normalizedCard.topicId));
      }
      
      // If no valid topicId, try to find a matching topic
      const matchingTopic = this.findMatchingTopic(normalizedCard, topics, {
        topicById,
        topicsByName,
        topicsBySubject
      });
      
      if (matchingTopic) {
        // Found a matching topic, update card with topic info
        return this.updateCardWithTopicInfo(normalizedCard, matchingTopic);
      }
      
      // No matching topic found, just return the normalized card
      return normalizedCard;
    });
  }

  /**
   * Normalize a card to ensure it has all required fields
   * @param {Object} card - Card to normalize
   * @returns {Object} - Normalized card
   */
  normalizeCard(card) {
    // If the card is already normalized, just return it
    if (card.normalized) return card;
    
    // Create a copy with minimal required fields
    const normalizedCard = {
      ...card,
      id: card.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'card',
      question: card.question || card.front || '',
      answer: card.answer || card.back || '',
      subject: card.subject || 'General',
      topic: card.topic || 'General',
      boxNum: card.boxNum || 1,
      normalized: true,
      questionType: this.detectQuestionType(card)
    };
    
    // Return the normalized card
    return normalizedCard;
  }

  /**
   * Detect the question type based on card content
   * @param {Object} card - Card to examine
   * @returns {string} - Detected question type
   */
  detectQuestionType(card) {
    // If the card already has a questionType, use it
    if (card.questionType) return card.questionType;
    
    // Check for multiple choice indicators
    if (card.options && Array.isArray(card.options) && card.options.length > 0) {
      return 'multiple_choice';
    }
    
    if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
      return 'multiple_choice';
    }
    
    // Check for multiple choice in answer text
    if (card.answer && typeof card.answer === 'string') {
      // Look for "Correct Answer: x)" pattern
      if (card.answer.match(/Correct Answer:\s*[a-e]\)/i)) {
        return 'multiple_choice';
      }
      
      // Look for option lettering
      if (card.answer.match(/[a-e]\)\s*[A-Za-z]/)) {
        return 'multiple_choice';
      }
    }
    
    // Look for acronym indicators
    if (card.question && typeof card.question === 'string') {
      // Check if question starts with "What does ... stand for?"
      if (card.question.match(/^What does [A-Z]+\s+stand for\?/i)) {
        return 'acronym';
      }
      
      // Check if it's a pure acronym
      if (card.question.match(/^[A-Z]{2,}$/)) {
        return 'acronym';
      }
    }
    
    // Default to short answer
    return 'short_answer';
  }

  /**
   * Find a matching topic for a card
   * @param {Object} card - Card to find a topic for
   * @param {Array} topics - Array of topics to search
   * @param {Object} lookupMaps - Maps for quick lookup
   * @returns {Object|null} - Matching topic or null if no match
   */
  findMatchingTopic(card, topics, lookupMaps) {
    // Destructure lookup maps
    const { topicById, topicsByName, topicsBySubject } = lookupMaps;
    
    // 1. First strategy: Try to match by exact topic name and subject
    if (card.topic && card.subject) {
      // Check by name
      if (topicsByName.has(card.topic)) {
        const matchingTopics = topicsByName.get(card.topic);
        
        // Find one with matching subject
        const exactMatch = matchingTopics.find(topic => 
          topic.subject === card.subject
        );
        
        if (exactMatch) return exactMatch;
      }
    }
    
    // 2. Second strategy: Try to match by topic name only
    if (card.topic && topicsByName.has(card.topic)) {
      const matchingTopics = topicsByName.get(card.topic);
      
      // Just pick the first one if there's only one
      if (matchingTopics.length === 1) {
        return matchingTopics[0];
      }
    }
    
    // 3. Third strategy: Try to match by subject
    if (card.subject && topicsBySubject.has(card.subject)) {
      const matchingTopics = topicsBySubject.get(card.subject);
      
      // Find the most generic topic for this subject
      const genericTopic = matchingTopics.find(topic => 
        (topic.name === 'General' || topic.topic === 'General')
      );
      
      if (genericTopic) return genericTopic;
      
      // If no generic topic, just take the first one
      if (matchingTopics.length > 0) {
        return matchingTopics[0];
      }
    }
    
    // 4. Last resort: Just find a generic topic
    const generalTopic = topics.find(topic => 
      (topic.name === 'General' || topic.topic === 'General')
    );
    
    if (generalTopic) return generalTopic;
    
    // No matching topic found
    return null;
  }

  /**
   * Update a card with information from its associated topic
   * @param {Object} card - Card to update
   * @param {Object} topic - Topic to use for updating
   * @returns {Object} - Updated card
   */
  updateCardWithTopicInfo(card, topic) {
    if (!topic) return card;
    
    return {
      ...card,
      topicId: topic.id,
      subject: card.subject || topic.subject || 'General',
      topic: card.topic || topic.name || topic.topic || 'General',
      examBoard: card.examBoard || topic.examBoard || '',
      examType: card.examType || topic.examType || '',
      cardColor: card.cardColor || topic.color || '#3cb44b',
      updated: new Date().toISOString()
    };
  }

  /**
   * Apply fixes to multiple choice cards
   * @param {Array} cards - Cards to fix
   * @returns {Array} - Fixed cards
   */
  fixMultipleChoiceCards(cards) {
    if (!Array.isArray(cards)) return cards;
    
    return cards.map(card => {
      if (!card) return card;
      
      // Skip non-multiple choice cards
      if (this.detectQuestionType(card) !== 'multiple_choice') {
        return card;
      }
      
      // Make a copy to avoid modifying the original
      const fixedCard = { ...card };
      
      // Ensure questionType is set
      fixedCard.questionType = 'multiple_choice';
      
      // Fix options if missing
      if (!fixedCard.options || !Array.isArray(fixedCard.options) || fixedCard.options.length === 0) {
        // Try to restore from savedOptions
        if (fixedCard.savedOptions && Array.isArray(fixedCard.savedOptions) && fixedCard.savedOptions.length > 0) {
          fixedCard.options = [...fixedCard.savedOptions];
        } else {
          // Try to extract from answer
          const extractedOptions = this.extractOptionsFromAnswer(fixedCard);
          
          if (extractedOptions.length > 0) {
            fixedCard.options = extractedOptions;
            fixedCard.savedOptions = [...extractedOptions];
          }
        }
      }
      
      // Make sure options have isCorrect property
      if (fixedCard.options && Array.isArray(fixedCard.options)) {
        fixedCard.options = fixedCard.options.map(option => {
          if (typeof option === 'string') {
            // Convert string option to object
            return {
              text: option,
              isCorrect: false
            };
          }
          
          if (typeof option === 'object' && !('isCorrect' in option)) {
            // Add isCorrect property if missing
            return {
              ...option,
              isCorrect: false
            };
          }
          
          return option;
        });
        
        // Make sure at least one option is marked as correct
        const hasCorrectOption = fixedCard.options.some(option => option.isCorrect);
        
        if (!hasCorrectOption && fixedCard.options.length > 0) {
          // Mark the first option as correct
          fixedCard.options[0].isCorrect = true;
        }
        
        // Back up options
        fixedCard.savedOptions = [...fixedCard.options];
      }
      
      return fixedCard;
    });
  }

  /**
   * Extract options from answer text
   * @param {Object} card - Card to extract options from
   * @returns {Array} - Extracted options
   */
  extractOptionsFromAnswer(card) {
    if (!card.answer || typeof card.answer !== 'string') {
      return [];
    }
    
    // Try to find the correct option letter
    const correctAnswerMatch = card.answer.match(/Correct Answer:\s*([a-e])\)/i);
    
    if (!correctAnswerMatch) {
      return [];
    }
    
    const correctLetter = correctAnswerMatch[1].toLowerCase();
    
    // Extract options from the answer text if possible
    const optionRegex = /([a-e])\)\s*([^\n]+)/g;
    const options = [];
    let match;
    
    while ((match = optionRegex.exec(card.answer)) !== null) {
      const letter = match[1].toLowerCase();
      const text = match[2].trim();
      
      options.push({
        text,
        isCorrect: letter === correctLetter
      });
    }
    
    // If we found options, return them
    if (options.length > 0) {
      return options;
    }
    
    // Create placeholder options based on the correct answer position
    const letters = ['a', 'b', 'c', 'd', 'e'];
    const correctIndex = letters.indexOf(correctLetter);
    
    if (correctIndex >= 0) {
      const placeholderOptions = [];
      
      // Create 4 options with the correct one marked
      letters.slice(0, 4).forEach(letter => {
        placeholderOptions.push({
          text: letter === correctLetter 
            ? (card.detailedAnswer || 'Correct option') 
            : `Option ${letter.toUpperCase()}`,
          isCorrect: letter === correctLetter
        });
      });
      
      return placeholderOptions;
    }
    
    return [];
  }

  /**
   * Check if an item is a topic shell
   * @param {Object} item - Item to check
   * @returns {boolean} - True if the item is a topic shell
   */
  isTopicShell(item) {
    if (!item) return false;
    
    return (
      item.type === 'topic' || 
      item.isShell === true ||
      // Detect topic shells implicitly
      (
        (item.topic || item.name) && 
        !item.question && 
        !item.answer && 
        !item.front && 
        !item.back
      )
    );
  }

  /**
   * Check if an item is a card
   * @param {Object} item - Item to check
   * @returns {boolean} - True if the item is a card
   */
  isCard(item) {
    if (!item) return false;
    
    return (
      item.type === 'card' || 
      // Detect cards implicitly 
      (
        (item.question || item.answer || item.front || item.back) || 
        (item.options && Array.isArray(item.options))
      )
    );
  }

  /**
   * Split a collection of items into topics and cards
   * @param {Array} items - Array of items to split
   * @returns {Object} - Object with topics and cards arrays
   */
  splitByType(items) {
    if (!Array.isArray(items)) {
      return { topics: [], cards: [] };
    }
    
    const topics = [];
    const cards = [];
    
    items.forEach(item => {
      if (!item) return;
      
      if (this.isTopicShell(item)) {
        topics.push(this.normalizeTopicShell(item));
      } else if (this.isCard(item)) {
        cards.push(this.normalizeCard(item));
      } else {
        console.warn('[CardTopicRelationshipManager] Unknown item type:', item);
      }
    });
    
    return { topics, cards };
  }

  /**
   * Normalize a topic shell
   * @param {Object} item - Topic shell to normalize
   * @returns {Object} - Normalized topic shell
   */
  normalizeTopicShell(item) {
    // Create a copy to avoid modifying the original
    const normalized = { ...item };
    
    // Ensure required fields
    normalized.id = normalized.id || `topic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    normalized.type = 'topic';
    normalized.isShell = true;
    normalized.name = normalized.name || normalized.topic || 'General';
    normalized.topic = normalized.topic || normalized.name || 'General';
    normalized.subject = normalized.subject || 'General';
    normalized.color = normalized.color || '#3cb44b';
    normalized.cards = normalized.cards || [];
    normalized.isEmpty = normalized.isEmpty ?? (normalized.cards.length === 0);
    normalized.created = normalized.created || new Date().toISOString();
    normalized.updated = normalized.updated || new Date().toISOString();
    
    return normalized;
  }
} 