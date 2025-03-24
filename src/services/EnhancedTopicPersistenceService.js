/**
 * EnhancedTopicPersistenceService.js
 * 
 * Enhanced service to handle all topic list persistence across the application.
 * This service implements the "single source of truth" architecture by:
 * 1. Saving topic lists to field_3011 (for reference/backward compatibility)
 * 2. Creating topic shells in field_2979 (the new single source of truth)
 */

// Import the UnifiedDataService for topic shell creation
import { saveTopicShells } from './UnifiedDataService';
import { saveTopicList } from './TopicListService';

/**
 * Debug logging helper
 * @param {string} title - Log title
 * @param {any} data - Data to log
 * @returns {any} - The data (for chaining)
 */
const debugLog = (title, data) => {
  console.log(`%c[EnhancedTopicPersistenceService] ${title}`, 'color: #ff5500; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

/**
 * Save topic list to both field_3011 (backward compatibility) and field_2979 (as topic shells)
 * 
 * @param {Array} topics - Array of topic objects
 * @param {string} subject - Subject name
 * @param {string} examBoard - Exam board
 * @param {string} examType - Exam type
 * @param {string} userId - User ID
 * @param {Object} auth - Auth object with token
 * @returns {Promise<boolean>} - Success status
 */
export const saveTopicsUnified = async (topics, subject, examBoard, examType, userId, auth) => {
  try {
    debugLog("Saving topics to unified storage", { 
      subject,
      examBoard,
      examType,
      topicCount: topics.length,
      userId
    });

    // First, save to field_3011 using TopicListService (backward compatibility)
    const field3011Result = await saveTopicList(
      topics, 
      subject, 
      examBoard, 
      examType, 
      userId, 
      auth
    );
    
    debugLog("field_3011 save result", { success: field3011Result });

    // Then, convert topics to topic shells and save to field_2979 (new single source of truth)
    const topicShells = topics.map(topic => ({
      id: topic.id,
      type: 'topic',
      name: topic.name,
      subject: subject,
      examBoard: examBoard,
      examType: examType,
      color: '#3cb44b', // Default green color 
      baseColor: '#3cb44b',
      cards: [], // Empty cards array - this is an empty topic shell
      isShell: true,
      isEmpty: true, // Mark as empty
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }));
    
    debugLog("Converting topics to topic shells", { 
      count: topicShells.length,
      firstShell: topicShells[0] || null
    });
    
    // Save topic shells to field_2979 using UnifiedDataService
    const field2979Result = await saveTopicShells(topicShells, userId, auth);
    
    debugLog("field_2979 save result", { success: field2979Result });
    
    // Return overall success status (both operations should succeed)
    return field3011Result && field2979Result;
  } catch (error) {
    console.error("Error in saveTopicsUnified:", error);
    return false;
  }
};

export default {
  saveTopicsUnified
};
