import { dlog, dwarn, derr } from '../utils/logger';
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
 * Get all available exam boards (hard-coded for reliability)
 * @returns {Promise<string[]>} Array of exam boards
 */
export async function fetchExamBoards() {
  // Check cache first
  if (cache.examBoards) {
    dlog("Using cached exam boards");
    return cache.examBoards;
  }

  // Hard-coded list of main UK exam boards
  const examBoards = ['AQA', 'Edexcel', 'OCR', 'WJEC', 'CCEA'];
  
  // Store in cache
  cache.examBoards = examBoards;
  dlog(`Using hard-coded exam boards: ${examBoards.join(', ')}`);
  return examBoards;
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
  if (normalized.includes('alevel') || normalized.includes('alevels')) return 'A-LEVEL';
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
    dlog(`Using cached subjects for ${examType} ${examBoard}`);
    return cache.subjects[cacheKey];
  }

  try {
    dlog(`Fetching all pages of subjects for ${examType} ${examBoard} from Knack object_109`);
    
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

    let currentPage = 1;
    let totalPages = 1; // Initialize to 1, will be updated by the first API response
    const allRecords = [];
    const rowsPerPage = 1000; // Knack's typical max, can be adjusted

    do {
      const response = await fetch(`${KNACK_API_URL}/objects/${TOPIC_OBJECT}/records?filters=${encodeURIComponent(JSON.stringify(filters))}&rows_per_page=${rowsPerPage}&page=${currentPage}&format=raw`, {
        method: 'GET',
        headers: getKnackHeaders()
      });

      if (!response.ok) {
        throw new Error(`API call failed on page ${currentPage}: ${response.status}`);
      }

      const data = await response.json();
      if (data.records) {
        allRecords.push(...data.records);
      }
      
      // Update totalPages from the first response, or on subsequent ones if available
      // Knack typically provides total_pages and current_page in the response.
      // If not, this logic might need adjustment based on Knack's specific pagination response structure.
      totalPages = data.total_pages || totalPages; 
      currentPage = (data.current_page || currentPage) + 1;

    } while (currentPage <= totalPages && (allRecords.length % rowsPerPage === 0 || allRecords.length < (totalPages * rowsPerPage) )); // Continue if current page is less than total pages and we are either getting full pages or haven't reached the expected total

    dlog(`Fetched ${allRecords.length} records in total across ${totalPages} page(s) for subjects.`);
    
    // Extract unique subjects from all fetched records
    const subjects = [...new Set(allRecords
      .map(record => record[FIELD_MAPPING.subject])
      .filter(subject => subject))]
      .sort(); // Sort alphabetically
    
    // Store in cache
    cache.subjects[cacheKey] = subjects;
    dlog(`Found ${subjects.length} unique subjects for ${examType} ${examBoard}`);
    return subjects;
  } catch (error) {
    derr(`Error fetching subjects for ${examType} ${examBoard}:`, error);
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
    dlog(`Using cached topics for ${subject} (${examBoard} ${examType})`);
    return cache.topics[cacheKey];
  }

  try {
    dlog(`Fetching all pages of topics for ${subject} (${examBoard} ${examType}) from Knack object_109`);
    
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
    
    let currentPage = 1;
    let totalPages = 1; // Initialize to 1, will be updated by the first API response
    const allRecords = [];
    const rowsPerPage = 1000;

    do {
      const response = await fetch(`${KNACK_API_URL}/objects/${TOPIC_OBJECT}/records?filters=${encodeURIComponent(JSON.stringify(filters))}&rows_per_page=${rowsPerPage}&page=${currentPage}&format=raw`, {
        method: 'GET',
        headers: getKnackHeaders()
      });

      if (!response.ok) {
        throw new Error(`API call failed on page ${currentPage} for topics: ${response.status}`);
      }

      const data = await response.json();
      if (data.records) {
        allRecords.push(...data.records);
      }
      
      totalPages = data.total_pages || totalPages;
      currentPage = (data.current_page || currentPage) + 1;

    } while (currentPage <= totalPages && (allRecords.length % rowsPerPage === 0 || allRecords.length < (totalPages * rowsPerPage) ));

    dlog(`Fetched ${allRecords.length} records in total across ${totalPages} page(s) for topics.`);

    // Process and structure all fetched records
    const structuredTopics = processTopicData(allRecords, subject);
    
    // Store in cache
    cache.topics[cacheKey] = structuredTopics;
    dlog(`Processed ${structuredTopics.length} topics for ${subject} (${examBoard} ${examType})`);
    return structuredTopics;
  } catch (error) {
    derr(`Error fetching topics for ${subject} (${examBoard} ${examType}):`, error);
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
    dwarn("No records to process");
    return [];
  }
  
  dlog(`Processing ${records.length} records into structured topics`);
  
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
    dlog(`Cleared topic cache for ${examType} ${examBoard} ${subject}`);
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
    dlog(`Cleared subject and topic cache for ${examType} ${examBoard}`);
  } else {
    // Clear all caches
    cache.examBoards = null;
    cache.subjects = {};
    cache.topics = {};
    dlog("Cleared all topic caches");
  }
}
