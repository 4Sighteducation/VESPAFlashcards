/**
 * AICardGeneratorTopicSync.js
 * 
 * This module enhances the AICardGenerator to work with our new TopicCardSyncService.
 * It provides functions for generating cards directly from topics and appending them
 * to the user's card bank while maintaining proper synchronization.
 */

import { appendCardsForTopic, findCardsForTopic } from '../services/TopicCardSyncService';

/**
 * Generate cards for a specific topic and append them to existing cards
 * @param {Object} topic - Topic object with subject, examBoard, examType and name
 * @param {Array} newCards - Array of newly generated cards
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const generateCardsFromTopic = async (topic, cards, userId, auth) => {
  try {
    // Log what we're doing
    console.log("Generating cards for topic:", topic);
    
    // Check for existing cards for this topic
    const existingCards = await findCardsForTopic(topic, userId, auth);
    console.log(`Found ${existingCards.length} existing cards for this topic`);
    
    // Append the new cards using our synchronization service
    const success = await appendCardsForTopic(topic, cards, userId, auth);
    
    return {
      success,
      existingCardCount: existingCards.length,
      newCardCount: cards.length
    };
  } catch (error) {
    console.error("Error in generateCardsFromTopic:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get existing cards for a topic
 * @param {Object} topic - Topic object with subject, examBoard, examType and name
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<Array>} - Array of cards for this topic
 */
export const getExistingCardsForTopic = async (topic, userId, auth) => {
  try {
    return await findCardsForTopic(topic, userId, auth);
  } catch (error) {
    console.error("Error getting existing cards for topic:", error);
    return [];
  }
};

// Export functions for use in AICardGenerator component
export default {
  generateCardsFromTopic,
  getExistingCardsForTopic
};
