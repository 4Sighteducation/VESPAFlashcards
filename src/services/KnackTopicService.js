/**
 * KnackTopicService.js
 * Service for fetching and processing topic data from Knack object_109
 */

/**
 * Fetches topics from Knack object_109 based on examType, examBoard, and subject
 * @param {string} examType - The exam type (GCSE, A-Level)
 * @param {string} examBoard - The exam board (AQA, Edexcel, OCR, etc.)
 * @param {string} subject - The subject (optional)
 * @returns {Promise<Array>} - Promise resolving to processed topic data
 */
export const fetchTopicsFromKnack = async (examType, examBoard, subject = null) => {
  // Get Knack API details from environment variables
  const knackAppId = process.env.REACT_APP_KNACK_APP_ID || window.VESPA_CONFIG?.knackAppId;
  const knackApiKey = process.env.REACT_APP_KNACK_API_KEY || window.VESPA_CONFIG?.knackApiKey;
  const KNACK_API_URL = 'https://api.knack.com/v1';
  
  if (!knackAppId || !knackApiKey) {
    console.error("Missing Knack API credentials");
    throw new Error("Missing Knack API credentials. Please check your environment variables.");
  }
  
  try {
    // Create filters for object_109 based on examType, examBoard, and subject
    const filters = {
      match: 'and',
      rules: []
    };
    
    // Map the frontend names to Knack field IDs
    if (examType) {
      // Handle different naming conventions between frontend and database
      let knackExamType = examType;
      if (examType === 'A-Level') knackExamType = 'A Level';
      if (examType === 'AS-Level') knackExamType = 'AS Level';
      
      filters.rules.push({ field: 'field_3035', operator: 'is', value: knackExamType });
    }
    
    if (examBoard) filters.rules.push({ field: 'field_3034', operator: 'is', value: examBoard });
    if (subject) filters.rules.push({ field: 'field_3033', operator: 'is', value: subject });
    
    console.log(`Fetching topics from Knack with filters:`, filters);
    
    // Use Knack token from the parent window if available (when in iframe)
    const token = window.parent?.Knack?.getUserToken?.() || window.Knack?.getUserToken?.();
    
    // Prepare headers
    const headers = {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Content-Type': 'application/json'
    };
    
    // Add authorization if token is available
    if (token) {
      headers['Authorization'] = token;
    }
    
    // Fetch data from Knack
    const url = `${KNACK_API_URL}/objects/object_109/records`;
    const response = await fetch(`${url}?filters=${encodeURIComponent(JSON.stringify(filters))}&format=raw`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`Knack API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Received ${data.records?.length || 0} records from Knack`);
    
    return processTopicData(data.records || []);
  } catch (error) {
    console.error('Error fetching topics from Knack:', error);
    throw error;
  }
};

/**
 * Fetches available subjects based on examType and examBoard
 * @param {string} examType - The exam type (GCSE, A-Level)
 * @param {string} examBoard - The exam board (AQA, Edexcel, OCR, etc.)
 * @returns {Promise<Array>} - Promise resolving to array of subject names
 */
export const fetchAvailableSubjects = async (examType, examBoard) => {
  // Get Knack API details from environment variables
  const knackAppId = process.env.REACT_APP_KNACK_APP_ID || window.VESPA_CONFIG?.knackAppId;
  const knackApiKey = process.env.REACT_APP_KNACK_API_KEY || window.VESPA_CONFIG?.knackApiKey;
  const KNACK_API_URL = 'https://api.knack.com/v1';
  
  if (!knackAppId || !knackApiKey) {
    console.error("Missing Knack API credentials");
    throw new Error("Missing Knack API credentials. Please check your environment variables.");
  }
  
  try {
    // Create filters for object_109 based on examType and examBoard
    const filters = {
      match: 'and',
      rules: []
    };
    
    // Map the frontend names to Knack field IDs
    if (examType) {
      // Handle different naming conventions between frontend and database
      let knackExamType = examType;
      if (examType === 'A-Level') knackExamType = 'A Level';
      if (examType === 'AS-Level') knackExamType = 'AS Level';
      
      filters.rules.push({ field: 'field_3035', operator: 'is', value: knackExamType });
    }
    
    if (examBoard) filters.rules.push({ field: 'field_3034', operator: 'is', value: examBoard });
    
    console.log(`Fetching available subjects from Knack with filters:`, filters);
    
    // Use Knack token from the parent window if available (when in iframe)
    const token = window.parent?.Knack?.getUserToken?.() || window.Knack?.getUserToken?.();
    
    // Prepare headers
    const headers = {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Content-Type': 'application/json'
    };
    
    // Add authorization if token is available
    if (token) {
      headers['Authorization'] = token;
    }
    
    // Fetch data from Knack
    const url = `${KNACK_API_URL}/objects/object_109/records`;
    const response = await fetch(`${url}?filters=${encodeURIComponent(JSON.stringify(filters))}&format=raw`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`Knack API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Received ${data.records?.length || 0} records from Knack for subject filtering`);
    
    // Extract unique subjects
    const subjects = [...new Set(data.records.map(record => record.field_3033))].filter(Boolean);
    return subjects.sort(); // Return sorted list of subjects
  } catch (error) {
    console.error('Error fetching available subjects:', error);
    return []; // Return empty array on error
  }
};

/**
 * Process the raw Knack data into a format compatible with our topic system
 * @param {Array} records - Raw records from Knack
 * @returns {Array} - Processed topics in the format expected by TopicHub
 */
const processTopicData = (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    console.warn("No valid records to process");
    return [];
  }
  
  console.log("Processing Knack records into topics format");
  
  // Group by subject, module, topic for organization
  const grouped = groupRecordsBySubjectAndModule(records);
  const processedTopics = [];
  
  // Process each group into our topic format
  Object.entries(grouped).forEach(([subject, modules], subjectIndex) => {
    Object.entries(modules).forEach(([moduleName, moduleRecords], moduleIndex) => {
      // Track topic IDs within this module
      let topicCounter = 1;
      
      // First, organize by topics and subtopics
      const topicGroups = {};
      
      moduleRecords.forEach(record => {
        const topic = record.field_3037 || "General"; // Topic or fallback
        if (!topicGroups[topic]) {
          topicGroups[topic] = [];
        }
        topicGroups[topic].push(record);
      });
      
      // Now create entries for each topic and its subtopics
      Object.entries(topicGroups).forEach(([topicName, topicRecords], topicIndex) => {
        // If we have subtopics, create entries for each
        const hasSubtopics = topicRecords.some(record => record.field_3038);
        
        if (hasSubtopics) {
          // Group by subtopic
          const subtopicGroups = {};
          topicRecords.forEach(record => {
            const subtopic = record.field_3038 || "General";
            if (!subtopicGroups[subtopic]) {
              subtopicGroups[subtopic] = [];
            }
            subtopicGroups[subtopic].push(record);
          });
          
          // Create entry for each subtopic
          Object.entries(subtopicGroups).forEach(([subtopicName, subtopicRecords], subtopicIndex) => {
            const mainTopic = moduleName !== "General" ? moduleName : topicName;
            const subtopic = subtopicName !== "General" ? subtopicName : topicName;
            
            // Create ID with proper format (e.g., "1.1")
            const topicId = `${moduleIndex + 1}.${topicCounter++}`;
            
            const examBoard = subtopicRecords[0].field_3034;
            const examType = subtopicRecords[0].field_3035;
            
            processedTopics.push({
              id: topicId,
              topic: `${mainTopic}: ${subtopic}`,
              mainTopic: mainTopic,
              subtopic: subtopic,
              examBoard: examBoard,
              examType: examType,
              subject: subject
            });
          });
        } else {
          // No subtopics, just create a single entry for this topic
          const mainTopic = moduleName !== "General" ? moduleName : topicName;
          const subtopic = topicName;
          
          // Create ID with proper format (e.g., "1.1")
          const topicId = `${moduleIndex + 1}.${topicCounter++}`;
          
          const examBoard = topicRecords[0].field_3034;
          const examType = topicRecords[0].field_3035;
          
          processedTopics.push({
            id: topicId,
            topic: `${mainTopic}: ${subtopic}`,
            mainTopic: mainTopic,
            subtopic: subtopic,
            examBoard: examBoard,
            examType: examType,
            subject: subject
          });
        }
      });
    });
  });
  
  console.log(`Processed ${processedTopics.length} topics from Knack data`);
  return processedTopics;
};

/**
 * Group records by subject, module and topic for easier processing
 * @param {Array} records - Raw records from Knack
 * @returns {Object} - Nested object grouped by subject, module, then topics
 */
const groupRecordsBySubjectAndModule = (records) => {
  const grouped = {};
  
  records.forEach(record => {
    const subject = record.field_3033 || "General";
    const module = record.field_3036 || "General";
    
    if (!grouped[subject]) {
      grouped[subject] = {};
    }
    
    if (!grouped[subject][module]) {
      grouped[subject][module] = [];
    }
    
    grouped[subject][module].push(record);
  });
  
  return grouped;
};

export default {
  fetchTopicsFromKnack,
  fetchAvailableSubjects
};
