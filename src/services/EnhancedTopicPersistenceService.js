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
      topicCount: topics?.length || 0,
      userId
    });

    // Check if topics is valid
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      console.error("Invalid topics array provided:", topics);
      return false;
    }

    // Ensure exam metadata is valid - use defaults if not provided
    const validExamBoard = examBoard || "General";
    const validExamType = examType || "Course";

    // Create a set to track IDs we've used to ensure uniqueness
    const usedIds = new Set();
    
    // Ensure all topics have valid IDs and names before saving
    const validatedTopics = topics.map(topic => {
      if (!topic) {
        console.warn("Encountered null/undefined topic, creating placeholder");
        const newId = `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        usedIds.add(newId);
        return {
          id: newId,
          topic: "Unknown Topic",
          name: "Unknown Topic",
          examBoard: validExamBoard,
          examType: validExamType,
          subject: subject
        };
      }
      
      // Generate a new ID only if needed
      let topicId = topic.id;
      if (!topicId || usedIds.has(topicId)) {
        topicId = `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      usedIds.add(topicId);
      
      return {
        ...topic,
        id: topicId,
        topic: topic.topic || topic.name || "Unknown Topic",
        name: topic.name || topic.topic || "Unknown Topic",
        examBoard: validExamBoard,  // Ensure all topics have examBoard
        examType: validExamType,    // Ensure all topics have examType
        subject: subject            // Ensure all topics have subject
      };
    });

    debugLog("Validated topics for saving", {
      original: topics.length,
      validated: validatedTopics.length,
      sample: validatedTopics[0] || null
    });

    // First, save to field_3011 using TopicListService (backward compatibility)
    const field3011Result = await saveTopicList(
      validatedTopics, 
      subject, 
      validExamBoard, 
      validExamType, 
      userId, 
      auth
    );
    
    debugLog("field_3011 save result", { success: field3011Result });

    // Then, convert topics to topic shells and save to field_2979 (new single source of truth)
    const topicShells = validatedTopics.map(topic => ({
      id: topic.id,
      type: 'topic',
      name: topic.name || topic.topic || "Unknown Topic",
      topic: topic.topic || topic.name || "Unknown Topic", // Include both name AND topic properties for consistency
      subject: subject,
      examBoard: validExamBoard,
      examType: validExamType,
      color: '#3cb44b', // Default green color 
      baseColor: '#3cb44b',
      subjectColor: '#3cb44b', // Add this to ensure subject color is passed through
      cards: [], // Empty cards array - this is an empty topic shell
      isShell: true,
      isEmpty: true, // Mark as empty
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }));
    
    debugLog("Topic shells with name/topic properties", { 
      sampleTopicShell: topicShells[0] || null 
    });
    
    debugLog("Converting topics to topic shells", { 
      count: topicShells.length,
      firstShell: topicShells[0] || null
    });
    
    // Save topic shells to field_2979 using UnifiedDataService
    const field2979Result = await saveTopicShells(topicShells, userId, auth);
    
    debugLog("field_2979 save result", { success: field2979Result });
    
    // Only send the parent message if both saves were successful
    // and we're in an iframe (has parent window)
    if (field3011Result && field2979Result && window.parent && window.parent !== window) {
      try {
        // Create a unique list ID
        const listId = `topiclist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Get the saved topic list with complete data
        const topicList = {
          id: listId,
          name: `${subject} - ${validExamBoard} ${validExamType}`,
          examBoard: validExamBoard,
          examType: validExamType,
          subject: subject,
          topics: validatedTopics,
          created: new Date().toISOString(),
          userId
        };
        
        // Send message to parent window to trigger topic shell creation in Knack JavaScript
        // BUT use a different message type to prevent duplicate processing
        window.parent.postMessage({
          type: 'TOPIC_SHELLS_CREATED',  // Changed from TOPIC_LISTS_UPDATED
          data: {
            topicList: topicList,        // Send single topicList instead of array
            recordId: auth?.recordId,    // Send record ID if available
            topicShells: topicShells,    // Send the actual shells
            metadata: {
              subject: subject,
              examBoard: validExamBoard,
              examType: validExamType,
              timestamp: new Date().toISOString(),
              operation: 'save_topics_unified'
            }
          },
          timestamp: new Date().toISOString()
        }, '*');
        
        debugLog("Sent TOPIC_SHELLS_CREATED message to parent", { 
          topicCount: validatedTopics.length,
          metadata: { subject, examBoard: validExamBoard, examType: validExamType }
        });
      } catch (messageError) {
        console.error("Error sending TOPIC_SHELLS_CREATED message:", messageError);
        // Non-fatal error, continue
      }
    }
    
    // Return overall success status
    return field3011Result && field2979Result;
  } catch (error) {
    console.error("Error in saveTopicsUnified:", error);
    return false;
  }
};

export default {
  saveTopicsUnified
};
