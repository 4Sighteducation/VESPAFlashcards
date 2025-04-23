/**
 * KnackTopicService.js
 * 
 * Service for fetching and processing topic data from Knack object_109
 * which contains structured syllabus data for different exam boards, types, and subjects.
 */

const KNACK_API_URL = 'https://api.knack.com/v1';
const TOPIC_OBJECT = 'object_109';
const FIELD_MAPPING = {
  examBoard: 'field_3034',
  examType: 'field_3035', 
  subject: 'field_3033',
  module: 'field_3036',
  topic: 'field_3037',
  subtopic: 'field_3038'
};

// Cache for API responses
const cache = {
  examBoards: null,
  subjects: {},
  topics: {}
};

/**
 * Get Knack API headers with authentication
 * @returns {Object} Headers for Knack API requests
 */
function getKnackHeaders() {
  return {
    'X-Knack-Application-Id': process.env.REACT_APP_KNACK_APP_KEY,
    'X-Knack-REST-API-Key': process.env.REACT_APP_KNACK_API_KEY,
    'Content-Type': 'application/json'
  };
}

/**
 * Fetch all available exam boards from Knack object_109
 * @returns {Promise<string[]>} Array of unique exam boards
 */
export async function fetchExamBoards() {
  // Check cache first
  if (cache.examBoards) {
    console.log("Using cached exam boards");
    return cache.examBoards;
  }

  try {
    console.log("Fetching exam boards from Knack object_109");
    
    // Use fetch instead of axios for consistency with existing code
    const response = await fetch(`${KNACK_API_URL}/objects/${TOPIC_OBJECT}/records`, {
      method: 'GET',
      headers: getKnackHeaders(),
      params: {
        format: 'raw',
        rows_per_page: 1000  // Get sufficient records
      }
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract unique exam boards
    const examBoards = [...new Set(data.records
      .map(record => record[FIELD_MAPPING.examBoard])
      .filter(board => board))]
      .sort(); // Sort alphabetically
    
    // Store in cache
    cache.examBoards = examBoards;
    console.log(`Found ${examBoards.length} exam boards in Knack: ${examBoards.join(', ')}`);
    return examBoards;
  } catch (error) {
    console.error('Error fetching exam boards:', error);
    // Return fallback values
    const fallbackBoards = ['AQA', 'Edexcel', 'OCR', 'WJEC', 'CCEA', 'SQA'];
    console.log(`Using fallback exam boards: ${fallbackBoards.join(', ')}`);
    return fallbackBoards;
  }
}

/**
 * Normalize exam type for consistent matching
 * @param {string} examType The exam type to normalize
 * @returns {string} Normalized exam type
 */
function normalizeExamType(examType) {
  if (!examType) return '';
  
  // Convert to lowercase and remove special characters for consistent matching
  const normalized = examType.toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric
  
  // Map common variations
  if (normalized.includes('alevel') || normalized.includes('alevels')) return 'A-Level';
  if (normalized.includes('gcse') || normalized.includes('gcses')) return 'GCSE';
  
  // Default: return original with capitalization
  return examType;
}

/**
 * Fetch subjects available for a specific exam type and board
 * @param {string} examType The exam type (e.g., "GCSE", "A-Level")
 * @param {string} examBoard The exam board (e.g., "AQA", "Edexcel")
 * @returns {Promise<string[]>} Array of subjects
 */
export async function fetchSubjects(examType, examBoard) {
  // Normalize exam type for consistent matching
  const normalizedExamType = normalizeExamType(examType);
  
  // Generate cache key
  const cacheKey = `${normalizedExamType}-${examBoard}`;
  
  // Check cache first
  if (cache.subjects[cacheKey]) {
    console.log(`Using cached subjects for ${examType} ${examBoard}`);
    return cache.subjects[cacheKey];
  }

  try {
    console.log(`Fetching subjects for ${examType} ${examBoard} from Knack object_109`);
    
    // Format filters for Knack API
    const filters = {
      match: 'and',
      rules: [
        {
          field: FIELD_MAPPING.examType,
          operator: 'is',
          value: normalizedExamType
        },
        {
          field: FIELD_MAPPING.examBoard,
          operator: 'is',
          value: examBoard
        }
      ]
    };
    
    // Use fetch instead of axios for consistency
    const response = await fetch(`${KNACK_API_URL}/objects/${TOPIC_OBJECT}/records?filters=${encodeURIComponent(JSON.stringify(filters))}&rows_per_page=1000&format=raw`, {
      method: 'GET',
      headers: getKnackHeaders()
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract unique subjects
    const subjects = [...new Set(data.records
      .map(record => record[FIELD_MAPPING.subject])
      .filter(subject => subject))]
      .sort(); // Sort alphabetically
    
    // Store in cache
    cache.subjects[cacheKey] = subjects;
    console.log(`Found ${subjects.length} subjects for ${examType} ${examBoard}`);
    return subjects;
  } catch (error) {
    console.error(`Error fetching subjects for ${examType} ${examBoard}:`, error);
    return []; // Empty array on error
  }
}

/**
 * Fetch topics for a specific exam type, board, and subject
 * @param {string} examType The exam type (e.g., "GCSE", "A-Level")
 * @param {string} examBoard The exam board (e.g., "AQA", "Edexcel")
 * @param {string} subject The subject (e.g., "Mathematics")
 * @returns {Promise<Array>} Array of structured topic objects
 */
export async function fetchTopics(examType, examBoard, subject) {
  // Normalize exam type for consistent matching
  const normalizedExamType = normalizeExamType(examType);
  
  // Generate cache key
  const cacheKey = `${normalizedExamType}-${examBoard}-${subject}`;
  
  // Check cache first
  if (cache.topics[cacheKey]) {
    console.log(`Using cached topics for ${subject} (${examBoard} ${examType})`);
    return cache.topics[cacheKey];
  }

  try {
    console.log(`Fetching topics for ${subject} (${examBoard} ${examType}) from Knack object_109`);
    
    // Format filters for Knack API
    const filters = {
      match: 'and',
      rules: [
        {
          field: FIELD_MAPPING.examType,
          operator: 'is',
          value: normalizedExamType
        },
        {
          field: FIELD_MAPPING.examBoard,
          operator: 'is',
          value: examBoard
        },
        {
          field: FIELD_MAPPING.subject,
          operator: 'is',
          value: subject
        }
      ]
    };
    
    // Use fetch instead of axios for consistency
    const response = await fetch(`${KNACK_API_URL}/objects/${TOPIC_OBJECT}/records?filters=${encodeURIComponent(JSON.stringify(filters))}&rows_per_page=1000&format=raw`, {
      method: 'GET',
      headers: getKnackHeaders()
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Process and structure the data
    const structuredTopics = processTopicData(data.records, subject);
    
    // Store in cache
    cache.topics[cacheKey] = structuredTopics;
    console.log(`Processed ${structuredTopics.length} topics for ${subject} (${examBoard} ${examType})`);
    return structuredTopics;
  } catch (error) {
    console.error(`Error fetching topics for ${subject} (${examBoard} ${examType}):`, error);
    return []; // Empty array on error
  }
}

/**
 * Process raw Knack records into hierarchical topic structure
 * @param {Array} records Records from Knack API
 * @param {string} subject The subject name
 * @returns {Array} Structured topic objects
 */
function processTopicData(records, subject) {
  if (!records || records.length === 0) {
    console.warn("No records to process");
    return [];
  }
  
  console.log(`Processing ${records.length} records into structured topics`);
  
  // Determine the structure of the data
  // Some records may have modules, others might not
  const hasModules = records.some(record => record[FIELD_MAPPING.module]);
  
  if (hasModules) {
    return processWithModules(records, subject);
  } else {
    return processWithoutModules(records, subject);
  }
}

/**
 * Process records with module structure
 * @param {Array} records Records from Knack API
 * @param {string} subject The subject name
 * @returns {Array} Structured topic objects
 */
function processWithModules(records, subject) {
  // Group by module first
  const moduleGroups = {};
  
  records.forEach(record => {
    const module = record[FIELD_MAPPING.module] || 'General';
    const topic = record[FIELD_MAPPING.topic] || 'General';
    const subtopic = record[FIELD_MAPPING.subtopic] || topic;
    
    if (!moduleGroups[module]) {
      moduleGroups[module] = {};
    }
    
    if (!moduleGroups[module][topic]) {
      moduleGroups[module][topic] = [];
    }
    
    // Add subtopic if not already in the array
    if (!moduleGroups[module][topic].includes(subtopic)) {
      moduleGroups[module][topic].push(subtopic);
    }
  });
  
  // Transform into the expected format for the UI
  const result = [];
  
  Object.entries(moduleGroups).forEach(([moduleName, topicGroups], moduleIndex) => {
    Object.entries(topicGroups).forEach(([topicName, subtopics], topicIndex) => {
      subtopics.forEach((subtopicName, subtopicIndex) => {
        // Generate a consistent ID for the topic
        const id = `${moduleIndex + 1}.${topicIndex + 1}.${subtopicIndex + 1}`;
        
        result.push({
          id,
          topic: subtopicName === topicName 
            ? `${moduleName}: ${topicName}`
            : `${moduleName}: ${topicName} - ${subtopicName}`,
          mainTopic: `${moduleName}: ${topicName}`,
          subtopic: subtopicName,
          subject: subject
        });
      });
    });
  });
  
  return result;
}

/**
 * Process records without module structure
 * @param {Array} records Records from Knack API
 * @param {string} subject The subject name
 * @returns {Array} Structured topic objects
 */
function processWithoutModules(records, subject) {
  // Group directly by topic
  const topicGroups = {};
  
  records.forEach(record => {
    const topic = record[FIELD_MAPPING.topic] || 'General';
    const subtopic = record[FIELD_MAPPING.subtopic] || topic;
    
    if (!topicGroups[topic]) {
      topicGroups[topic] = [];
    }
    
    // Add subtopic if not already in the array
    if (!topicGroups[topic].includes(subtopic)) {
      topicGroups[topic].push(subtopic);
    }
  });
  
  // Transform into the expected format for the UI
  const result = [];
  
  Object.entries(topicGroups).forEach(([topicName, subtopics], topicIndex) => {
    subtopics.forEach((subtopicName, subtopicIndex) => {
      // Generate a consistent ID for the topic
      const id = `${topicIndex + 1}.${subtopicIndex + 1}`;
      
      result.push({
        id,
        topic: subtopicName === topicName 
          ? topicName 
          : `${topicName} - ${subtopicName}`,
        mainTopic: topicName,
        subtopic: subtopicName,
        subject: subject
      });
    });
  });
  
  return result;
}

/**
 * Clear the cache for topics
 * @param {string} examType Optional exam type to clear specific cache
 * @param {string} examBoard Optional exam board to clear specific cache
 * @param {string} subject Optional subject to clear specific cache
 */
export function clearTopicCache(examType = null, examBoard = null, subject = null) {
  if (examType && examBoard && subject) {
    // Clear specific topic cache
    const cacheKey = `${normalizeExamType(examType)}-${examBoard}-${subject}`;
    delete cache.topics[cacheKey];
    console.log(`Cleared topic cache for ${examType} ${examBoard} ${subject}`);
  } else if (examType && examBoard) {
    // Clear subject and topic cache for this exam type and board
    const cacheKey = `${normalizeExamType(examType)}-${examBoard}`;
    delete cache.subjects[cacheKey];
    
    // Clear all matching topic caches
    Object.keys(cache.topics).forEach(key => {
      if (key.startsWith(cacheKey)) {
        delete cache.topics[key];
      }
    });
    console.log(`Cleared subject and topic cache for ${examType} ${examBoard}`);
  } else {
    // Clear all caches
    cache.examBoards = null;
    cache.subjects = {};
    cache.topics = {};
    console.log("Cleared all topic caches");
  }
}
