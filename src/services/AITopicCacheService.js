/**
 * AITopicCacheService.js
 * 
 * A service to cache AI-generated topics to reduce API calls and prevent rate limiting.
 * Implements both in-memory caching and localStorage persistence.
 */

// Cache constants
const CACHE_VERSION = '1.0.0';
const CACHE_STORAGE_KEY = 'vespa_topic_cache';
const CACHE_EXPIRY_DAYS = 30; // Cache items expire after 30 days

// In-memory cache
let memoryCache = {};
let cacheInitialized = false;

/**
 * Debug logging helper
 */
const debugLog = (title, data) => {
  console.log(`%c[TopicCacheService] ${title}`, 'color: #008080; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

/**
 * Initialize the cache from localStorage
 */
const initializeCache = () => {
  if (cacheInitialized) return;
  
  try {
    // Load cache from localStorage
    const storedCache = localStorage.getItem(CACHE_STORAGE_KEY);
    if (storedCache) {
      const parsedCache = JSON.parse(storedCache);
      
      // Check cache version
      if (parsedCache.version === CACHE_VERSION) {
        memoryCache = parsedCache.data || {};
        
        // Clean expired cache items
        cleanExpiredItems();
        
        debugLog('Cache initialized from localStorage', { 
          entries: Object.keys(memoryCache).length,
          size: storedCache.length
        });
      } else {
        // Version mismatch, reset cache
        memoryCache = {};
        debugLog('Cache version mismatch, resetting', { 
          stored: parsedCache.version, 
          current: CACHE_VERSION 
        });
        saveCache();
      }
    } else {
      // No stored cache, initialize empty
      memoryCache = {};
      saveCache();
      debugLog('No stored cache found, initialized empty cache', {});
    }
    
    cacheInitialized = true;
  } catch (error) {
    // Error with localStorage, continue with empty memory cache
    console.error('Error initializing cache:', error);
    memoryCache = {};
    cacheInitialized = true;
  }
};

/**
 * Save the cache to localStorage
 */
const saveCache = () => {
  try {
    const cacheObject = {
      version: CACHE_VERSION,
      timestamp: new Date().toISOString(),
      data: memoryCache
    };
    
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheObject));
    debugLog('Cache saved to localStorage', { 
      entries: Object.keys(memoryCache).length 
    });
  } catch (error) {
    console.error('Error saving cache to localStorage:', error);
  }
};

/**
 * Clean expired items from the cache
 */
const cleanExpiredItems = () => {
  const now = new Date();
  let cleanCount = 0;
  
  Object.keys(memoryCache).forEach(key => {
    const item = memoryCache[key];
    if (item && item.expiryDate) {
      const expiry = new Date(item.expiryDate);
      if (now > expiry) {
        delete memoryCache[key];
        cleanCount++;
      }
    }
  });
  
  if (cleanCount > 0) {
    debugLog('Cleaned expired cache items', { cleanCount });
    saveCache();
  }
};

/**
 * Generate a cache key from topic parameters
 * @param {string} examBoard - Exam board (e.g., 'AQA')
 * @param {string} examType - Exam type (e.g., 'A-Level')
 * @param {string} subject - Subject name
 * @returns {string} - Cache key
 */
const generateCacheKey = (examBoard, examType, subject) => {
  return `${examBoard.toLowerCase()}_${examType.toLowerCase()}_${subject.toLowerCase()}`;
};

/**
 * Get topics from cache if available
 * @param {string} examBoard - Exam board (e.g., 'AQA')
 * @param {string} examType - Exam type (e.g., 'A-Level')
 * @param {string} subject - Subject name
 * @returns {Array|null} - Cached topics or null if not found
 */
export const getCachedTopics = (examBoard, examType, subject) => {
  if (!cacheInitialized) {
    initializeCache();
  }
  
  const cacheKey = generateCacheKey(examBoard, examType, subject);
  const cacheItem = memoryCache[cacheKey];
  
  if (cacheItem && cacheItem.topics) {
    // Check expiry
    const expiry = new Date(cacheItem.expiryDate);
    const now = new Date();
    
    if (now < expiry) {
      debugLog('Cache hit', { 
        cacheKey,
        topicCount: cacheItem.topics.length
      });
      
      // Update access time but not expiry
      cacheItem.lastAccessed = now.toISOString();
      saveCache();
      
      return cacheItem.topics;
    } else {
      debugLog('Cache expired', { cacheKey, expiry });
      return null;
    }
  }
  
  debugLog('Cache miss', { cacheKey });
  return null;
};

/**
 * Store topics in cache
 * @param {string} examBoard - Exam board (e.g., 'AQA')
 * @param {string} examType - Exam type (e.g., 'A-Level')
 * @param {string} subject - Subject name
 * @param {Array} topics - Topic data to cache
 */
export const cacheTopics = (examBoard, examType, subject, topics) => {
  if (!cacheInitialized) {
    initializeCache();
  }
  
  if (!Array.isArray(topics) || topics.length === 0) {
    console.warn('Attempted to cache empty or invalid topics');
    return;
  }
  
  const cacheKey = generateCacheKey(examBoard, examType, subject);
  const now = new Date();
  
  // Calculate expiry date (30 days from now)
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + CACHE_EXPIRY_DAYS);
  
  memoryCache[cacheKey] = {
    examBoard,
    examType,
    subject,
    topics,
    created: now.toISOString(),
    lastAccessed: now.toISOString(),
    expiryDate: expiryDate.toISOString()
  };
  
  debugLog('Cached topics', { 
    cacheKey, 
    topicCount: topics.length,
    expiry: expiryDate.toISOString()
  });
  
  saveCache();
};

/**
 * Clear the entire cache
 */
export const clearCache = () => {
  memoryCache = {};
  saveCache();
  debugLog('Cache cleared', {});
};

// Initialize cache when loaded
initializeCache();

export default {
  getCachedTopics,
  cacheTopics,
  clearCache
};
