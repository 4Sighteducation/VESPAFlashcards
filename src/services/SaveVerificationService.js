/**
 * SaveVerificationService.js
 * 
 * This service verifies that saved data is correct and consistent,
 * checking for issues like broken relationships and fixing them when possible.
 */

import { safeParseJSON } from '../utils/DataUtils';

export default class SaveVerificationService {
  constructor() {
    this.verificationRecords = new Map();
    this.maxAttempts = 3;
    this.pendingVerifications = new Map();
    this.autoRepairEnabled = true;
  }

  /**
   * Set whether auto-repair is enabled
   * @param {boolean} enabled - Whether auto-repair is enabled
   */
  setAutoRepair(enabled) {
    this.autoRepairEnabled = enabled;
  }

  /**
   * Verify a save operation
   * @param {string} recordId - Record ID to verify
   * @param {Function} fetchUserData - Function to fetch user data
   * @param {Function} saveFixedData - Function to save fixed data
   * @returns {Promise<Object>} - Verification result
   */
  async verifySave(recordId, fetchUserData, saveFixedData) {
    if (!recordId) {
      return {
        success: false,
        error: "Missing record ID"
      };
    }

    if (typeof fetchUserData !== 'function') {
      return {
        success: false,
        error: "Missing fetchUserData function"
      };
    }

    if (typeof saveFixedData !== 'function') {
      return {
        success: false,
        error: "Missing saveFixedData function"
      };
    }

    // Add verification record
    const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.verificationRecords.set(verificationId, {
      recordId,
      status: 'pending',
      startTime: Date.now(),
      attempts: 0,
      maxAttempts: this.maxAttempts
    });

    try {
      // Wait a moment to ensure data has been committed to the database
      await this.delay(1000);

      // Retrieve the record that was just saved
      const userData = await fetchUserData(recordId);

      if (!userData) {
        throw new Error("Record not found during verification");
      }

      // Perform various verification checks
      const verificationResult = await this.performVerification(userData);

      if (!verificationResult.success && this.autoRepairEnabled) {
        // Attempt to fix issues
        const fixedData = await this.repairIssues(userData, verificationResult.issues);

        if (fixedData) {
          // Save the fixed data
          await saveFixedData(recordId, fixedData);

          // Return verification result with fixes applied
          return {
            success: true,
            fixed: true,
            message: "Issues fixed during verification",
            fixedIssues: verificationResult.issues
          };
        }
      }

      // Verification successful
      return {
        success: verificationResult.success,
        fixed: false,
        message: verificationResult.message || "Verification successful",
        issues: verificationResult.issues
      };
    } catch (error) {
      // Update verification record
      const record = this.verificationRecords.get(verificationId);
      record.attempts++;
      record.lastError = error.message;
      this.verificationRecords.set(verificationId, record);

      // Retry if attempts < maxAttempts
      if (record.attempts < record.maxAttempts) {
        // Wait before retrying
        await this.delay(2000);
        return this.verifySave(recordId, fetchUserData, saveFixedData);
      }

      // Max attempts reached, return failure
      return {
        success: false,
        error: error.message,
        attempts: record.attempts
      };
    } finally {
      // Clean up verification record
      setTimeout(() => {
        this.verificationRecords.delete(verificationId);
      }, 60000);
    }
  }

  /**
   * Perform verification checks on user data
   * @param {Object} userData - User data to verify
   * @returns {Promise<Object>} - Verification result
   */
  async performVerification(userData) {
    const issues = [];

    // Check that card bank data is present
    const cardBankField = 'field_2979'; // Card bank field
    if (!userData[cardBankField]) {
      issues.push({
        type: 'missing_field',
        field: cardBankField,
        message: "Card bank field is missing"
      });
    }

    // Parse card bank data
    let cardBankData;
    try {
      if (userData[cardBankField]) {
        cardBankData = safeParseJSON(userData[cardBankField]);
      }
    } catch (error) {
      issues.push({
        type: 'parse_error',
        field: cardBankField,
        message: `Error parsing card bank data: ${error.message}`
      });
    }

    // Check that card bank data is an array
    if (cardBankData && !Array.isArray(cardBankData)) {
      issues.push({
        type: 'invalid_format',
        field: cardBankField,
        message: "Card bank data is not an array"
      });
    }

    // Split card bank data into topics and cards
    let topics = [];
    let cards = [];

    if (cardBankData && Array.isArray(cardBankData)) {
      // Identify topics and cards
      cardBankData.forEach(item => {
        if (item && (item.type === 'topic' || this.isTopicShell(item))) {
          topics.push(item);
        } else if (item && (item.type === 'card' || this.isCard(item))) {
          cards.push(item);
        }
      });

      // Check for cards with missing topicId
      const cardsWithMissingTopicId = cards.filter(card => !card.topicId);
      if (cardsWithMissingTopicId.length > 0) {
        issues.push({
          type: 'missing_topic_id',
          count: cardsWithMissingTopicId.length,
          message: `${cardsWithMissingTopicId.length} cards missing topicId`,
          affectedCards: cardsWithMissingTopicId.map(card => card.id)
        });
      }

      // Check for cards with topicId that doesn't exist
      const topicIds = new Set(topics.map(topic => topic.id));
      const cardsWithInvalidTopicId = cards.filter(card => card.topicId && !topicIds.has(card.topicId));
      if (cardsWithInvalidTopicId.length > 0) {
        issues.push({
          type: 'invalid_topic_id',
          count: cardsWithInvalidTopicId.length,
          message: `${cardsWithInvalidTopicId.length} cards have topicId that doesn't match any topic`,
          affectedCards: cardsWithInvalidTopicId.map(card => card.id)
        });
      }

      // Check for multiple choice cards with missing options
      const multipleChoiceCardsWithMissingOptions = cards.filter(card => 
        (card.questionType === 'multiple_choice' || this.isMultipleChoiceCard(card)) && 
        (!card.options || !Array.isArray(card.options) || card.options.length === 0)
      );
      if (multipleChoiceCardsWithMissingOptions.length > 0) {
        issues.push({
          type: 'missing_options',
          count: multipleChoiceCardsWithMissingOptions.length,
          message: `${multipleChoiceCardsWithMissingOptions.length} multiple choice cards missing options`,
          affectedCards: multipleChoiceCardsWithMissingOptions.map(card => card.id)
        });
      }
    } else {
      // Card bank data is missing or invalid
      issues.push({
        type: 'invalid_card_bank',
        message: "Card bank data is missing or invalid"
      });
    }

    // Check topic lists
    const topicListsField = 'field_3011'; // Topic lists field
    if (!userData[topicListsField]) {
      issues.push({
        type: 'missing_field',
        field: topicListsField,
        message: "Topic lists field is missing"
      });
    }

    // Parse topic lists data
    let topicLists;
    try {
      if (userData[topicListsField]) {
        topicLists = safeParseJSON(userData[topicListsField]);
      }
    } catch (error) {
      issues.push({
        type: 'parse_error',
        field: topicListsField,
        message: `Error parsing topic lists data: ${error.message}`
      });
    }

    // Check that topic lists data is an array
    if (topicLists && !Array.isArray(topicLists)) {
      issues.push({
        type: 'invalid_format',
        field: topicListsField,
        message: "Topic lists data is not an array"
      });
    }

    // Determine success based on whether there are critical issues
    const hasCriticalIssues = issues.some(issue => 
      ['missing_field', 'parse_error', 'invalid_format', 'invalid_card_bank'].includes(issue.type)
    );

    return {
      success: !hasCriticalIssues,
      message: issues.length > 0
        ? `Verification completed with ${issues.length} issues found`
        : "Verification successful",
      issues
    };
  }

  /**
   * Repair issues found during verification
   * @param {Object} userData - User data to repair
   * @param {Array} issues - Issues to repair
   * @returns {Promise<Object|null>} - Fixed data or null if no fixes needed
   */
  async repairIssues(userData, issues) {
    if (!issues || issues.length === 0) {
      return null;
    }

    // Focus on issues we can fix
    const fixableIssues = issues.filter(issue => 
      ['missing_topic_id', 'invalid_topic_id', 'missing_options'].includes(issue.type)
    );

    if (fixableIssues.length === 0) {
      return null;
    }

    // Parse card bank data
    const cardBankField = 'field_2979';
    let cardBankData;
    try {
      if (userData[cardBankField]) {
        cardBankData = safeParseJSON(userData[cardBankField]);
      }
    } catch (error) {
      console.error(`[SaveVerificationService] Error parsing card bank data: ${error.message}`);
      return null;
    }

    if (!cardBankData || !Array.isArray(cardBankData)) {
      return null;
    }

    // Split card bank data into topics and cards
    let topicShells = [];
    let cards = [];

    cardBankData.forEach(item => {
      if (item && (item.type === 'topic' || this.isTopicShell(item))) {
        topicShells.push(item);
      } else if (item && (item.type === 'card' || this.isCard(item))) {
        cards.push(item);
      }
    });

    // Track whether fixes were applied
    let fixesApplied = false;

    // Fix missing or invalid topicId
    const cardsWithTopicIssues = cards.filter(card => 
      !card.topicId || !topicShells.some(topic => topic.id === card.topicId)
    );

    if (cardsWithTopicIssues.length > 0) {
      // Create a map of topics by name and subject for quick lookup
      const topicsByNameAndSubject = new Map();
      topicShells.forEach(topic => {
        const key = `${topic.subject || 'General'}:${topic.name || topic.topic || 'General'}`;
        topicsByNameAndSubject.set(key, topic);
      });

      // Fix each card
      cardsWithTopicIssues.forEach(card => {
        // Try to find a matching topic
        const key = `${card.subject || 'General'}:${card.topic || 'General'}`;
        if (topicsByNameAndSubject.has(key)) {
          card.topicId = topicsByNameAndSubject.get(key).id;
          fixesApplied = true;
        } else {
          // No exact match, try to find a topic with matching subject
          const matchingSubjectTopic = topicShells.find(topic => topic.subject === (card.subject || 'General'));
          if (matchingSubjectTopic) {
            card.topicId = matchingSubjectTopic.id;
            fixesApplied = true;
          } else if (topicShells.length > 0) {
            // Last resort: use any topic
            card.topicId = topicShells[0].id;
            fixesApplied = true;
          }
        }
      });
    }

    // Fix multiple choice cards with missing options
    const multipleChoiceCardsWithoutOptions = cards.filter(card => 
      (card.questionType === 'multiple_choice' || this.isMultipleChoiceCard(card)) && 
      (!card.options || !Array.isArray(card.options) || card.options.length === 0)
    );

    if (multipleChoiceCardsWithoutOptions.length > 0) {
      multipleChoiceCardsWithoutOptions.forEach(card => {
        // Try to restore from savedOptions
        if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
          card.options = [...card.savedOptions];
          fixesApplied = true;
        } else {
          // Try to extract options from answer text
          const extractedOptions = this.extractOptionsFromAnswer(card);
          if (extractedOptions.length > 0) {
            card.options = extractedOptions;
            card.savedOptions = [...extractedOptions];
            fixesApplied = true;
          } else {
            // Create default options
            card.options = [
              { text: 'Option A', isCorrect: true },
              { text: 'Option B', isCorrect: false },
              { text: 'Option C', isCorrect: false },
              { text: 'Option D', isCorrect: false }
            ];
            card.savedOptions = [...card.options];
            fixesApplied = true;
          }
        }

        // Make sure questionType is correct
        card.questionType = 'multiple_choice';
      });
    }

    // Return fixed data if fixes were applied
    if (fixesApplied) {
      return {
        ...userData,
        [cardBankField]: JSON.stringify([...topicShells, ...cards])
      };
    }

    return null;
  }

  /**
   * Helper method to check if an item is a topic shell
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
   * Helper method to check if an item is a card
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
   * Helper method to check if a card is a multiple choice card
   * @param {Object} card - Card to check
   * @returns {boolean} - True if the card is a multiple choice card
   */
  isMultipleChoiceCard(card) {
    if (!card) return false;
    
    // Check explicit indicators
    if (card.questionType === 'multiple_choice') return true;
    if (card.type === 'multiple_choice') return true;
    
    // Check for options
    if (card.options && Array.isArray(card.options) && card.options.length > 0) return true;
    if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) return true;
    
    // Check answer text patterns
    if (card.answer && typeof card.answer === 'string') {
      // Look for "Correct Answer: x)" pattern
      if (card.answer.match(/Correct Answer:\s*[a-e]\)/i)) return true;
      
      // Look for option lettering
      if (card.answer.match(/[a-e]\)\s*[A-Za-z]/)) return true;
    }
    
    return false;
  }

  /**
   * Extract options from a multiple choice card's answer text
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
    
    // Create placeholder options
    const letters = ['a', 'b', 'c', 'd', 'e'];
    const correctIndex = letters.indexOf(correctLetter);
    
    if (correctIndex >= 0) {
      return letters.slice(0, 4).map(letter => ({
        text: letter === correctLetter 
          ? (card.detailedAnswer || 'Correct option') 
          : `Option ${letter.toUpperCase()}`,
        isCorrect: letter === correctLetter
      }));
    }
    
    return [];
  }

  /**
   * Utility method to delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>} - Promise that resolves after the delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 