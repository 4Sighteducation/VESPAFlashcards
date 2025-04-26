// DataUtils.js - Enhanced for multi-subject support
import SaveQueueService from '../services/SaveQueueService';

// Enhanced URI component decoding function with better error handling
export function safeDecodeURIComponent(str) {
  if (!str) return str;
  // Check if it looks like it needs decoding
  if (typeof str === 'string' && !str.includes('%')) return str;
  
  try {
      // Handle plus signs as spaces which sometimes occur
      return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch (error) {
      console.error("Error decoding URI component:", error);
      console.log("Problematic string (first 100 chars):", String(str).substring(0, 100));
      
      try {
          // First attempt to fix potentially invalid % sequences
          const cleaned = String(str).replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
          return decodeURIComponent(cleaned.replace(/\+/g, ' '));
      } catch (secondError) {
          console.error("Second attempt to decode failed:", secondError);
          
          try {
              // Third attempt: Try more aggressive cleaning
              const aggressiveCleaned = String(str)
                  .replace(/%(?![0-9A-Fa-f]{2})/g, '%25')  // Fix invalid % sequences
                  .replace(/%[0-9A-Fa-f]$/g, '%25')        // Fix truncated % at end
                  .replace(/%[0-9A-Fa-f](?![0-9A-Fa-f])/g, '%25'); // Fix single-digit % sequences
              
              return decodeURIComponent(aggressiveCleaned.replace(/\+/g, ' '));
          } catch (thirdError) {
              console.error("Third attempt to decode failed:", thirdError);
              
              // Last resort - try pattern matching to extract valid content
              try {
                  const jsonPattern = /(\[[\s\S]*?\]|\{[\s\S]*?\})/;
                  const match = String(str).match(jsonPattern);
                  if (match) {
                      console.warn("Attempting JSON extraction from corrupted URI");
                      return match[0];
                  }
              } catch (e) {
                  console.error("JSON extraction attempt failed");
              }
              
              // Give up and return the original string
              return str;
          }
      }
  }
}

// Enhanced JSON parsing function with better recovery and proper error reporting
export function safeParseJSON(jsonString, defaultVal = null) {
  // Use the enhanced version from SaveQueueService for consistent behavior
  return SaveQueueService.safeParseJSON(jsonString, defaultVal);
}

// Add version metadata to data for persistence
export function addVersionMetadata(data) {
  if (!data) return { version: "5.0", data: {} };
  
  return {
    version: "5.0", // Updated version number
    timestamp: new Date().toISOString(),
    data: data
  };
}

// Enhanced localStorage helpers with error handling and versioning
export const localStorageHelpers = {
  saveData: function(key, data) {
    try {
      // If the data doesn't have version info, add it
      const versionedData = data.version ? data : addVersionMetadata(data);
      
      // Convert to string for storage
      const serialized = JSON.stringify(versionedData);
      
      // Create a backup with timestamp before overwriting
      try {
        const existing = localStorage.getItem(key);
        if (existing) {
          const backupKey = `${key}_backup_${new Date().toISOString().replace(/:/g, '_')}`;
          localStorage.setItem(backupKey, existing);
          
          // Keep only the 3 most recent backups to avoid storage issues
          const backupKeys = Object.keys(localStorage).filter(k => k.startsWith(`${key}_backup_`));
          if (backupKeys.length > 3) {
            // Sort by date (newest first) and remove older ones
            backupKeys.sort().reverse();
            backupKeys.slice(3).forEach(oldKey => localStorage.removeItem(oldKey));
          }
        }
      } catch (backupError) {
        console.warn("Failed to create backup before save:", backupError);
      }
      
      // Save the new data
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
      return false;
    }
  },
  
  loadData: function(key, defaultVal = {}) {
    try {
      // Try to get data from localStorage
      const data = localStorage.getItem(key);
      
      // If no data found, return default and log
      if (!data) {
        console.log(`No data found in localStorage for ${key}, using default.`);
        return { success: false, data: defaultVal, source: 'default' };
      }
      
      // Parse the data using enhanced safe parse
      const parsedData = safeParseJSON(data);
      
      // If parsing failed completely, return default
      if (parsedData === null) {
        console.warn(`Failed to parse data from localStorage for ${key}, using default.`);
        return { success: false, data: defaultVal, source: 'default' };
      }
      
      // Check if it's in the versioned format
      if (parsedData && parsedData.version && parsedData.data) {
        console.log(`Found versioned data (v${parsedData.version}) in localStorage for ${key}.`);
        return { success: true, data: parsedData.data, source: 'localStorage', version: parsedData.version };
      }
      
      // Handle legacy format (direct data without versioning)
      console.log(`Found legacy data in localStorage for ${key}.`);
      return { success: true, data: parsedData, source: 'localStorage_legacy' };
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return { success: false, data: defaultVal, source: 'error', error };
    }
  }
};

// Data operation logging with timestamps
export const dataLogger = {
  logOperation: function(type, source, data = {}) {
    console.log(`[${new Date().toISOString()}] ${type.toUpperCase()} from ${source}:`, data);
  },
  
  logError: function(operation, error) {
    console.error(`[${new Date().toISOString()}] ERROR in ${operation}:`, error);
  },
  
  logSave: function(destination, data = {}) {
    this.logOperation('save', destination, {
      timestamp: new Date().toISOString(),
      cardCount: data.data?.cards?.length || 0,
      topicListCount: data.data?.topicLists?.length || 0
    });
  },
  
  logLoad: function(source, result = {}) {
    this.logOperation('load', source, {
      success: result.success || false,
      source: result.source,
      version: result.version,
      cardCount: result.data?.cards?.length || 0,
      topicListCount: result.data?.topicLists?.length || 0
    });
  }
};

// Backup and restore functions for multiple choice options
export function backupMultipleChoiceOptions(cards) {
  if (!Array.isArray(cards)) return;
  
  // Find all multiple choice cards
  const mcCards = cards.filter(card => 
    card.questionType === 'multiple_choice' && 
    Array.isArray(card.options)
  );
  
  // Create a separate backup for each card's options
  mcCards.forEach(card => {
    try {
      if (card.id && Array.isArray(card.options)) {
        // Store the options backup in the card itself
        card.savedOptions = [...card.options];
        
        // Also store in localStorage as a backup
        const mcBackupKey = `mc_options_${card.id}`;
        localStorage.setItem(mcBackupKey, JSON.stringify(card.options));
      }
    } catch (e) {
      console.warn(`Failed to backup MC options for card ${card.id}:`, e);
    }
  });
  
  console.log(`Backed up options for ${mcCards.length} multiple choice cards`);
  return cards; // Return the cards for function chaining
}

export function restoreMultipleChoiceOptions(cards) {
  if (!Array.isArray(cards)) return cards || [];
  
  let restoreCount = 0;
  
  // Process each card
  const restoredCards = cards.map(card => {
    // Skip cards that aren't multiple choice or already have options
    if (card.questionType !== 'multiple_choice' || 
        (Array.isArray(card.options) && card.options.length > 0)) {
      return card;
    }
    
    // Try to restore options from savedOptions first (in-memory backup)
    if (Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
      restoreCount++;
      return { ...card, options: [...card.savedOptions] };
    }
    
    // If no in-memory backup, try localStorage backup
    try {
      if (card.id) {
        const mcBackupKey = `mc_options_${card.id}`;
        const storedOptions = localStorage.getItem(mcBackupKey);
        if (storedOptions) {
          const parsedOptions = JSON.parse(storedOptions);
          if (Array.isArray(parsedOptions) && parsedOptions.length > 0) {
            restoreCount++;
            return { ...card, options: parsedOptions, savedOptions: [...parsedOptions] };
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to restore MC options for card ${card.id}:`, e);
    }
    
    // Return the original card if no options could be restored
    return card;
  });
  
  if (restoreCount > 0) {
    console.log(`Restored multiple choice options for ${restoreCount} cards`);
  } else {
    console.log(`Empty or invalid multiple choice options backup`);
  }
  
  return restoredCards;
}

// Card validation functions
export function validateCards(cards) {
  // Validate that cards is an array
  if (!Array.isArray(cards)) {
    console.warn("validateCards: Input is not an array:", cards);
    return { valid: false, cleanedCards: [] };
  }

  // Validate individual cards in the array
  let hasInvalidCards = false;
  const cleanedCards = cards.filter(card => {
    // Check if card is a valid object
    if (!card || typeof card !== 'object') {
      hasInvalidCards = true;
      console.warn("validateCards: Invalid card (not an object):", card);
      return false;
    }
    
    // Check for required fields based on type
    if (card.type === 'topic') {
      // Topic shells require different validation
      if (!card.id || !card.name || !card.subject) {
        hasInvalidCards = true;
        console.warn("validateCards: Invalid topic shell (missing required fields):", card);
        return false;
      }
      return true;
    }
    
    // Regular card validation
    if (!card.id) {
      hasInvalidCards = true;
      console.warn("validateCards: Invalid card (missing ID):", card);
      return false;
    }
    
    // For standard cards, require question and answer
    if (card.type !== 'topic' && (!card.question && !card.front)) {
      hasInvalidCards = true;
      console.warn("validateCards: Invalid card (missing question/front):", card);
      return false;
    }
    
    return true;
  });

  return {
    valid: !hasInvalidCards && cleanedCards.length === cards.length,
    cleanedCards: cleanedCards
  };
}
