/**
 * TopicsPersistenceManager.js
 * 
 * A utility that handles persistence for topic lists to prevent data loss
 * during autosave or page refreshes.
 * 
 * Created as part of the topic-modal-refactor branch
 */

// Time-based cache key generation to ensure uniqueness
const generateCacheKey = (subject, examBoard, examType) => {
  return `topics_${subject}_${examBoard}_${examType}`.replace(/\s+/g, '_').toLowerCase();
};

// Session storage fallback for page refreshes
const sessionStorageKey = 'vespa_topic_list_cache';

/**
 * Save topics to both session storage and a memory cache
 * This ensures data preservation across autosaves and page refreshes
 */
export const persistTopics = (subject, examBoard, examType, topics) => {
  if (!subject || !examBoard || !examType) return false;
  
  try {
    const cacheKey = generateCacheKey(subject, examBoard, examType);
    
    // Create the cache entry
    const cacheEntry = {
      subject,
      examBoard,
      examType,
      topics,
      timestamp: new Date().toISOString()
    };
    
    // Save to session storage as a fallback for page refreshes
    let sessionCache = {};
    
    try {
      const existingCache = sessionStorage.getItem(sessionStorageKey);
      if (existingCache) {
        sessionCache = JSON.parse(existingCache);
      }
    } catch (e) {
      console.warn("Error reading from session storage:", e);
    }
    
    // Update the cache with this entry
    sessionCache[cacheKey] = cacheEntry;
    
    // Save updated cache back to session storage
    try {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(sessionCache));
      console.log(`Topics persisted to session storage for ${subject} (${examBoard} ${examType})`);
    } catch (e) {
      console.warn("Error saving to session storage:", e);
    }
    
    // Also update memory cache for immediate access
    window.__vespaPersistentTopics = window.__vespaPersistentTopics || {};
    window.__vespaPersistentTopics[cacheKey] = cacheEntry;
    
    return true;
  } catch (error) {
    console.error("Error persisting topics:", error);
    return false;
  }
};

/**
 * Retrieve topics from cache
 * Tries memory cache first, then falls back to session storage
 */
export const retrieveTopics = (subject, examBoard, examType) => {
  if (!subject || !examBoard || !examType) return null;
  
  try {
    const cacheKey = generateCacheKey(subject, examBoard, examType);
    
    // First try memory cache (fastest)
    if (window.__vespaPersistentTopics && window.__vespaPersistentTopics[cacheKey]) {
      console.log(`Retrieved topics from memory cache for ${subject} (${examBoard} ${examType})`);
      return window.__vespaPersistentTopics[cacheKey].topics;
    }
    
    // Fall back to session storage
    try {
      const sessionCache = sessionStorage.getItem(sessionStorageKey);
      if (sessionCache) {
        const parsed = JSON.parse(sessionCache);
        if (parsed[cacheKey]) {
          // Update memory cache for future use
          window.__vespaPersistentTopics = window.__vespaPersistentTopics || {};
          window.__vespaPersistentTopics[cacheKey] = parsed[cacheKey];
          
          console.log(`Retrieved topics from session storage for ${subject} (${examBoard} ${examType})`);
          return parsed[cacheKey].topics;
        }
      }
    } catch (e) {
      console.warn("Error reading from session storage:", e);
    }
    
    return null;
  } catch (error) {
    console.error("Error retrieving topics:", error);
    return null;
  }
};

/**
 * Clear topics from cache
 * Use when the user manually deletes topics or regenerates them
 */
export const clearPersistedTopics = (subject, examBoard, examType) => {
  if (!subject || !examBoard || !examType) return;
  
  try {
    const cacheKey = generateCacheKey(subject, examBoard, examType);
    
    // Clear from memory cache
    if (window.__vespaPersistentTopics) {
      delete window.__vespaPersistentTopics[cacheKey];
    }
    
    // Clear from session storage
    try {
      const sessionCache = sessionStorage.getItem(sessionStorageKey);
      if (sessionCache) {
        const parsed = JSON.parse(sessionCache);
        if (parsed[cacheKey]) {
          delete parsed[cacheKey];
          sessionStorage.setItem(sessionStorageKey, JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.warn("Error clearing from session storage:", e);
    }
  } catch (error) {
    console.error("Error clearing persisted topics:", error);
  }
};

/**
 * Setup page unload protection to save topics before the page refreshes
 * This also provides protection against browser crashes
 */
export const setupPageUnloadProtection = () => {
  if (typeof window === 'undefined') return;
  
  // Save all topics to local storage when page is about to unload
  window.addEventListener('beforeunload', () => {
    if (window.__vespaPersistentTopics) {
      Object.values(window.__vespaPersistentTopics).forEach(entry => {
        persistTopics(entry.subject, entry.examBoard, entry.examType, entry.topics);
      });
    }
  });
};
