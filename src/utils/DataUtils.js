/**
 * DataUtils.js - Utilities for data validation, versioning, and safety mechanisms
 */

import { SCHEMA_VERSION } from './UnifiedDataModel';

// App version from package.json
export const APP_VERSION = process.env.REACT_APP_VERSION || "1.0.0";

/**
 * Add versioning and metadata to data before saving
 * @param {Object} data - The data to add versioning to
 * @returns {Object} - Data with version metadata added
 */
export const addVersionMetadata = (data) => {
  return {
    ...data,
    _metadata: {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      lastUpdated: new Date().toISOString(),
      updateCount: (data._metadata?.updateCount || 0) + 1,
    }
  };
};

/**
 * Validate card data structure
 * @param {Array} cards - Array of card objects
 * @returns {Object} - Validation result
 */
export const validateCards = (cards) => {
  if (!Array.isArray(cards)) {
    return { valid: false, error: "Cards must be an array" };
  }

  const invalidCards = [];
  
  // Validate each card
  cards.forEach((card, index) => {
    if (!card || typeof card !== 'object') {
      invalidCards.push({ index, error: "Card must be an object" });
      return;
    }
    
    if (!card.id) {
      invalidCards.push({ index, error: "Card missing ID" });
    }
    
    // Check required fields
    const requiredFields = ['question', 'answer'];
    for (const field of requiredFields) {
      if (!card[field] && card[field] !== '') {
        invalidCards.push({ index, error: `Card missing ${field}` });
      }
    }
  });
  
  return {
    valid: invalidCards.length === 0,
    invalidCards,
    cleanedCards: invalidCards.length > 0 
      ? cards.filter((_, i) => !invalidCards.some(invalid => invalid.index === i))
      : cards
  };
};

/**
 * Calculate data signature for integrity checking
 * @param {Object} data - Data to calculate signature for
 * @returns {string} - Signature string
 */
export const calculateDataSignature = (data) => {
  try {
    // Simple implementation - could be enhanced with actual hashing
    const signatureObj = {
      cardCount: Array.isArray(data.cards) ? data.cards.length : 0,
      subjectCount: data.subjects ? data.subjects.length : 
                   (data.colorMapping ? Object.keys(data.colorMapping).length : 0),
      lastCardId: Array.isArray(data.cards) && data.cards.length > 0 
        ? data.cards[data.cards.length - 1].id 
        : null,
      timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(signatureObj);
  } catch (error) {
    console.error("Error calculating data signature", error);
    return "";
  }
};

/**
 * Safely parse JSON with error recovery
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} - Parsed object or default value
 */
export const safeParseJSON = (jsonString, defaultValue = null) => {
  try {
    // Check if the string is already an object
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular parse attempt
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    
    // Attempt to fix common JSON syntax errors
    try {
      // Replace any invalid characters that might be causing issues
      const cleanedJson = jsonString
        .replace(/\t/g, ' ')           // Replace tabs with spaces
        .replace(/\n/g, ' ')           // Replace newlines with spaces
        .replace(/\r/g, ' ')           // Replace carriage returns with spaces
        .replace(/\\"/g, '"')          // Fix escaped quotes
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure property names are quoted
        .replace(/,\s*}/g, '}')        // Remove trailing commas in objects
        .replace(/,\s*\]/g, ']');      // Remove trailing commas in arrays
      
      return JSON.parse(cleanedJson);
    } catch (secondError) {
      console.error("Failed to recover corrupted JSON:", secondError);
      
      // Return the default value
      return defaultValue;
    }
  }
};

/**
 * Enhanced localStorage functions with error handling and backups
 */
export const localStorageHelpers = {
  /**
   * Save data to localStorage with backup
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   * @returns {boolean} - Success status
   */
  saveData: (key, data) => {
    try {
      // Create a versioned copy
      const versionedData = addVersionMetadata(data);
      
      // Calculate signature for integrity
      const signature = calculateDataSignature(versionedData);
      
      // Save main data
      localStorage.setItem(key, JSON.stringify(versionedData));
      
      // Save backup with timestamp
      const backupKey = `${key}_backup_${new Date().getTime()}`;
      localStorage.setItem(backupKey, JSON.stringify(versionedData));
      
      // Save signature
      localStorage.setItem(`${key}_signature`, signature);
      
      // Manage backup history - keep only the 3 most recent backups
      const backupKeys = Object.keys(localStorage)
        .filter(k => k.startsWith(`${key}_backup_`))
        .sort()
        .reverse();
      
      // Remove older backups beyond the 3 most recent
      for (let i = 3; i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i]);
      }
      
      return true;
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      
      // Attempt to save minimal data if full save fails
      try {
        const minimalData = {
          cards: Array.isArray(data.cards) ? data.cards : [],
          _metadata: {
            schemaVersion: SCHEMA_VERSION,
            emergency: true,
            lastUpdated: new Date().toISOString()
          }
        };
        localStorage.setItem(`${key}_emergency`, JSON.stringify(minimalData));
        return false;
      } catch (secondError) {
        console.error("Emergency save also failed:", secondError);
        return false;
      }
    }
  },

  /**
   * Load data from localStorage with fallback to backups
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if loading fails
   * @returns {Object} - Loaded data and status
   */
  loadData: (key, defaultValue = null) => {
    try {
      // Try to load the main data
      const dataJson = localStorage.getItem(key);
      if (!dataJson) {
        console.log(`No data found for key: ${key}`);
        return { success: false, data: defaultValue, source: "default" };
      }
      
      const data = safeParseJSON(dataJson, null);
      if (!data) {
        throw new Error("Failed to parse main data");
      }
      
      // Check data signature if available
      const storedSignature = localStorage.getItem(`${key}_signature`);
      if (storedSignature) {
        const currentSignature = calculateDataSignature(data);
        if (storedSignature !== currentSignature) {
          console.warn("Data signature mismatch, may be corrupted");
        }
      }
      
      return { 
        success: true, 
        data: data, 
        source: "primary" 
      };
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      
      // Try to load from the most recent backup
      try {
        const backupKeys = Object.keys(localStorage)
          .filter(k => k.startsWith(`${key}_backup_`))
          .sort()
          .reverse();
          
        if (backupKeys.length > 0) {
          console.log(`Attempting to load from backup: ${backupKeys[0]}`);
          const backupJson = localStorage.getItem(backupKeys[0]);
          const backupData = safeParseJSON(backupJson, null);
          
          if (backupData) {
            console.log("Successfully loaded from backup");
            return { 
              success: true, 
              data: backupData, 
              source: "backup" 
            };
          }
        }
        
        // Try emergency backup
        const emergencyJson = localStorage.getItem(`${key}_emergency`);
        if (emergencyJson) {
          const emergencyData = safeParseJSON(emergencyJson, null);
          if (emergencyData) {
            console.log("Loaded from emergency backup");
            return { 
              success: true, 
              data: emergencyData, 
              source: "emergency" 
            };
          }
        }
      } catch (backupError) {
        console.error("Error loading from backup:", backupError);
      }
      
      // Return default value if all else fails
      return { 
        success: false, 
        data: defaultValue, 
        source: "default" 
      };
    }
  },
  
  /**
   * Create a full backup of all app data
   * @returns {Object} Backup data
   */
  createFullBackup: () => {
    const backup = {
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    // List of keys to backup
    const keysToBackup = [
      'flashcards_app',
      'flashcards',
      'colorMapping',
      'spacedRepetition',
      'userTopics'
    ];
    
    for (const key of keysToBackup) {
      const value = localStorage.getItem(key);
      if (value) {
        backup.data[key] = value;
      }
    }
    
    // Store the backup
    const backupKey = `fullBackup_${new Date().getTime()}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));
    
    // List backup keys and keep only last 5
    const backupKeys = Object.keys(localStorage)
      .filter(k => k.startsWith('fullBackup_'))
      .sort()
      .reverse();
      
    for (let i = 5; i < backupKeys.length; i++) {
      localStorage.removeItem(backupKeys[i]);
    }
    
    return backup;
  }
};

/**
 * Structured logger for save/load operations
 */
export const dataLogger = {
  /**
   * Log save operation
   * @param {string} context - Context of the save
   * @param {Object} data - Data being saved
   * @param {Object} additionalInfo - Additional information
   */
  logSave: (context, data, additionalInfo = {}) => {
    console.group(`📥 Save Operation: ${context}`);
    console.log("Timestamp:", new Date().toISOString());
    
    if (data) {
      console.log("Data Stats:", {
        cards: Array.isArray(data.cards) ? data.cards.length : 0,
        subjects: Array.isArray(data.subjects) ? data.subjects.length : 0,
        topics: Array.isArray(data.topics) ? data.topics.length : 0,
        version: data._metadata ? data._metadata.schemaVersion : SCHEMA_VERSION
      });
    }
    
    if (Object.keys(additionalInfo).length > 0) {
      console.log("Additional Info:", additionalInfo);
    }
    
    console.groupEnd();
  },
  
  /**
   * Log load operation
   * @param {string} context - Context of the load
   * @param {Object} result - Load result
   * @param {Object} additionalInfo - Additional information
   */
  logLoad: (context, result, additionalInfo = {}) => {
    console.group(`📤 Load Operation: ${context}`);
    console.log("Timestamp:", new Date().toISOString());
    console.log("Success:", result.success);
    console.log("Source:", result.source);
    
    if (result.data) {
      console.log("Data Stats:", {
        cards: Array.isArray(result.data.cards) ? result.data.cards.length : 0,
        subjects: Array.isArray(result.data.subjects) ? result.data.subjects.length : 0,
        topics: Array.isArray(result.data.topics) ? result.data.topics.length : 0,
        version: result.data._metadata ? result.data._metadata.schemaVersion : SCHEMA_VERSION
      });
    }
    
    if (Object.keys(additionalInfo).length > 0) {
      console.log("Additional Info:", additionalInfo);
    }
    
    console.groupEnd();
  },
  
  /**
   * Log an error
   * @param {string} context - Error context
   * @param {Error} error - Error object
   */
  logError: (context, error) => {
    console.group(`❌ Error: ${context}`);
    console.log("Timestamp:", new Date().toISOString());
    console.error("Error:", error);
    console.groupEnd();
  }
};

/**
 * Functions for handling multiple choice options in cards
 */
export const multipleChoiceHelpers = {
  /**
   * Back up multiple choice options from cards
   * @param {Array} cards - Array of cards
   */
  backupMultipleChoiceOptions: (cards) => {
    if (!Array.isArray(cards)) return;
    
    cards.forEach(card => {
      if (card && card.questionType === 'multiple_choice' && 
          card.options && Array.isArray(card.options) && card.options.length > 0) {
        
        // Make sure savedOptions exists and is an array
        if (!card.savedOptions || !Array.isArray(card.savedOptions)) {
          card.savedOptions = [];
        }
        
        // Copy options to savedOptions
        card.savedOptions = [...card.options];
      }
    });
  },
  
  /**
   * Restore multiple choice options for cards
   * @param {Array} cards - Array of cards
   */
  restoreMultipleChoiceOptions: (cards) => {
    if (!Array.isArray(cards)) return;
    
    cards.forEach(card => {
      if (card && card.questionType === 'multiple_choice') {
        // Check if options are missing or empty but savedOptions exists
        if ((!card.options || !Array.isArray(card.options) || card.options.length === 0) &&
            card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
          
          // Restore options from savedOptions
          card.options = [...card.savedOptions];
        }
      }
    });
  }
};

// Export functions from multipleChoiceHelpers
export const { backupMultipleChoiceOptions, restoreMultipleChoiceOptions } = multipleChoiceHelpers;
