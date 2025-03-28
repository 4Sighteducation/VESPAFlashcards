/**
 * UnifiedPersistenceManager.js
 * 
 * Central service for managing all data persistence operations.
 * Provides transaction support, atomic operations, and consistent metadata.
 * 
 * Features:
 * - Transaction management and rollback
 * - Sequential operation processing
 * - Error recovery and retry
 * - Data integrity validation
 */

import authManager from './AuthManager';
import dataOperationQueue from './DataOperationQueue';
import metadataManager from './MetadataManager';
import topicShellManager from './TopicShellManager';
import colorManager from './ColorManager';
import { safeParseJSON, addVersionMetadata, backupMultipleChoiceOptions } from '../utils/DataUtils';
import { generateId } from '../utils/UnifiedDataModel';

// API constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const KNACK_API_URL = 'https://api.knack.com/v1';

// Knack field mappings
const FIELD_MAPPING = {
  userId: 'field_2954',             // User ID
  userEmail: 'field_2958',          // User email
  accountConnection: 'field_2956',  // Connection to account
  vespaCustomer: 'field_3008',      // VESPA Customer Connection
  tutorConnection: 'field_3009',    // Tutor Connection
  cardBankData: 'field_2979',       // Flashcard Bank JSON Store
  lastSaved: 'field_2957',          // Date Last Saved
  box1Data: 'field_2986',           // Box 1 JSON
  box2Data: 'field_2987',           // Box 2 JSON
  box3Data: 'field_2988',           // Box 3 JSON
  box4Data: 'field_2989',           // Box 4 JSON
  box5Data: 'field_2990',           // Box 5 JSON
  colorMapping: 'field_3000',       // Color Mapping
  topicLists: 'field_3011',         // Topic Lists JSON
  topicMetadata: 'field_3030',      // Topic Metadata JSON
  userName: 'field_3010',           // User Name
  tutorGroup: 'field_565',          // Tutor Group
  yearGroup: 'field_548',           // Year Group
  userRole: 'field_73'              // User Role
};

// Cache for record IDs to avoid repeated lookups
const recordIdCache = new Map();

// Track current transaction state
const transactionState = {
  isActive: false,
  operations: [],
  rollbackOperations: [],
  startState: null
};

class UnifiedPersistenceManager {
  constructor() {
    this.debugEnabled = process.env.NODE_ENV !== 'production';
    this.authManager = authManager;
    this.operationQueue = dataOperationQueue;
    
    // Cache for user data
    this.cachedUserData = null;
    
    // Register event listeners
    window.addEventListener('beforeunload', this.flushPendingChanges.bind(this));
  }
  
  /**
   * Debug logging helper
   * @param {string} title - Log title
   * @param {any} data - Data to log
   * @returns {any} - The data (for chaining)
   */
  debugLog(title, data) {
    if (!this.debugEnabled) return data;
    
    console.log(`%c[UnifiedPersistenceManager] ${title}`, 'color: #9c27b0; font-weight: bold; font-size: 12px;');
    if (data) console.log(JSON.stringify(data, null, 2));
    return data; // Return data for chaining
  }
  
  /**
   * Flush any pending changes before page unload
   */
  flushPendingChanges() {
    // Check if there's an active transaction
    if (transactionState.isActive) {
      this.debugLog("Page unloading with active transaction, committing changes", {
        operationCount: transactionState.operations.length
      });
      
      // Try to commit the transaction synchronously
      try {
        // Use navigator.sendBeacon for asynchronous non-blocking save
        if (this.cachedUserData && this.cachedUserData.recordId && navigator.sendBeacon) {
          // Prepare minimal data for beacon
          const essentialData = {
            cardBankData: this.cachedUserData.cards.concat(this.cachedUserData.topicShells)
          };
          
          // Use beacon API to send final data
          const url = `${KNACK_API_URL}/objects/object_102/records/${this.cachedUserData.recordId}`;
          const token = this.authManager.getToken();
          
          // Create headers for Knack API
          const headers = {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          };
          
          if (token) {
            headers["Authorization"] = token;
          }
          
          // Send the beacon
          navigator.sendBeacon(url, JSON.stringify({
            headers,
            method: "PUT",
            body: JSON.stringify(essentialData)
          }));
        }
      } catch (error) {
        console.error("Error flushing changes on page unload:", error);
      }
    }
  }
  
  /**
   * Start a transaction for grouped operations
   * @returns {boolean} - Success status
   */
  beginTransaction() {
    if (transactionState.isActive) {
      this.debugLog("Transaction already in progress", {});
      return false;
    }
    
    this.debugLog("Beginning transaction", {});
    
    // Store current state for potential rollback
    transactionState.startState = this.cachedUserData ? JSON.parse(JSON.stringify(this.cachedUserData)) : null;
    
    // Initialize transaction
    transactionState.isActive = true;
    transactionState.operations = [];
    transactionState.rollbackOperations = [];
    
    return true;
  }
  
  /**
   * Commit the current transaction
   * @returns {Promise<boolean>} - Success status
   */
  async commitTransaction() {
    if (!transactionState.isActive || transactionState.operations.length === 0) {
      this.debugLog("No active transaction to commit", {});
      return false;
    }
    
    this.debugLog("Committing transaction", {
      operationCount: transactionState.operations.length
    });
    
    try {
      // Group operations by type for more efficient processing
      const cards = [];
      const topics = [];
      const metadataUpdates = [];
      let colorMappingUpdated = false;
      let needsFullSave = false;
      
      // Process operations
      transactionState.operations.forEach(op => {
        switch (op.type) {
          case 'saveCard':
            cards.push(op.data);
            break;
          case 'saveTopic':
            topics.push(op.data);
            break;
          case 'updateMetadata':
            metadataUpdates.push(op.data);
            break;
          case 'updateColorMapping':
            colorMappingUpdated = true;
            break;
          case 'fullSave':
            needsFullSave = true;
            break;
        }
      });
      
      // Determine save strategy
      if (needsFullSave) {
        // Perform full save of all data
        await this.saveAllData();
      } else {
        // Process batched operations
        if (cards.length > 0) {
          await this.saveCards(cards);
        }
        
        if (topics.length > 0) {
          await this.saveTopics(topics);
        }
        
        if (metadataUpdates.length > 0) {
          await this.saveTopicMetadata(metadataUpdates);
        }
        
        if (colorMappingUpdated) {
          await this.saveColorMapping(colorManager.getCurrentMapping());
        }
      }
      
      // Clear transaction state
      transactionState.isActive = false;
      transactionState.operations = [];
      transactionState.rollbackOperations = [];
      transactionState.startState = null;
      
      return true;
    } catch (error) {
      this.debugLog("Error committing transaction", { error: error.message });
      
      // Attempt rollback
      await this.rollbackTransaction();
      
      throw error;
    }
  }
  
  /**
   * Roll back the current transaction
   * @returns {Promise<boolean>} - Success status
   */
  async rollbackTransaction() {
    if (!transactionState.isActive) {
      this.debugLog("No active transaction to roll back", {});
      return false;
    }
    
    this.debugLog("Rolling back transaction", {
      operationCount: transactionState.operations.length
    });
    
    try {
      // Restore the initial state
      if (transactionState.startState) {
        this.cachedUserData = JSON.parse(JSON.stringify(transactionState.startState));
        
        // Save to localStorage as backup
        this.saveToLocalStorage(this.cachedUserData);
      }
      
      // Execute any specific rollback operations
      for (const rollbackOp of transactionState.rollbackOperations) {
        await rollbackOp();
      }
      
      // Clear transaction state
      transactionState.isActive = false;
      transactionState.operations = [];
      transactionState.rollbackOperations = [];
      transactionState.startState = null;
      
      return true;
    } catch (error) {
      this.debugLog("Error rolling back transaction", { error: error.message });
      
      // Reset transaction state even if rollback fails
      transactionState.isActive = false;
      transactionState.operations = [];
      transactionState.rollbackOperations = [];
      transactionState.startState = null;
      
      throw error;
    }
  }
  
  /**
   * Add an operation to the current transaction
   * @param {Object} operation - Operation to add
   * @param {Function} rollbackFunction - Function to call for rollback
   */
  addTransactionOperation(operation, rollbackFunction = null) {
    if (!transactionState.isActive) {
      return;
    }
    
    // Add to operations list
    transactionState.operations.push(operation);
    
    // Add rollback function if provided
    if (rollbackFunction && typeof rollbackFunction === 'function') {
      transactionState.rollbackOperations.push(rollbackFunction);
    }
  }
  
  /**
   * Find user record ID in Knack
   * @param {string} userId - User ID
   * @param {Object} auth - Auth object (fallback)
   * @returns {Promise<string>} - Record ID
   */
  async findUserRecordId(userId, auth = null) {
    if (!userId) {
      throw new Error("Missing userId for record lookup");
    }
    
    // Check cache first
    if (recordIdCache.has(userId)) {
      return recordIdCache.get(userId);
    }
    
    this.debugLog("Looking up record ID for user", { userId });
    
    // Queue this operation to ensure it completes before dependent operations
    return this.operationQueue.enqueue(async () => {
      try {
        // Use authManager for API call with automatic token handling
        const searchUrl = `${KNACK_API_URL}/objects/object_102/records`;
        
        // Create proper headers with Knack app ID and API key
        const headers = {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        };
        
        // Use AuthManager's fetchWithAuth for automatic token handling
        const searchResponse = await this.authManager.fetchWithAuth(searchUrl, {
          method: "GET",
          headers
        });
        
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          throw new Error(`Failed to search for user record: ${errorText}`);
        }
        
        const allRecords = await searchResponse.json();
        
        // Find the record matching this user ID
        if (allRecords && allRecords.records) {
          // Get current user info from auth manager
          const userInfo = this.authManager.getUserInfo() || {};
          const userEmail = userInfo.email || (auth ? auth.email : null);
          
          const userRecord = allRecords.records.find(record => 
            record.field_2954 === userId || 
            (record.field_2958 && userEmail && record.field_2958 === userEmail)
          );
          
          if (userRecord) {
            this.debugLog("Found record ID", { recordId: userRecord.id });
            
            // Cache the record ID
            recordIdCache.set(userId, userRecord.id);
            return userRecord.id;
          }
        }
        
        throw new Error(`No record found for user ID: ${userId}`);
      } catch (error) {
        console.error("Error finding user record ID:", error);
        throw error;
      }
    }, {
      priority: 10,  // High priority
      type: 'recordLookup',
      metadata: { userId }
    });
  }
  
  /**
   * Get complete user data from Knack
   * @param {string} recordId - Record ID
   * @returns {Promise<Object>} - User data
   */
  async getUserData(recordId) {
    if (!recordId) {
      throw new Error("Missing recordId for data lookup");
    }
    
    this.debugLog("Fetching user data", { recordId });
    
    // Queue this operation
    return this.operationQueue.enqueue(async () => {
      try {
        // Create proper headers with Knack app ID and API key
        const headers = {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        };
        
        const getUrl = `${KNACK_API_URL}/objects/object_102/records/${recordId}`;
        
        // Use AuthManager's fetchWithAuth for automatic token handling
        const getResponse = await this.authManager.fetchWithAuth(getUrl, {
          method: "GET",
          headers
        });
        
        if (!getResponse.ok) {
          const errorText = await getResponse.text();
          throw new Error(`Failed to get user data: ${errorText}`);
        }
        
        const userData = await getResponse.json();
        this.debugLog("User data fetched successfully", { fields: Object.keys(userData) });
        return userData;
      } catch (error) {
        console.error("Error getting user data:", error);
        throw error;
      }
    }, {
      priority: 9,  // High priority
      type: 'dataFetch',
      metadata: { recordId }
    });
  }
  
  /**
   * Load user data from Knack
   * @param {string} userId - User ID
   * @param {Object} auth - Auth object containing token
   * @returns {Promise<Object>} - Complete user data
   */
  async loadUserData(userId, auth = null) {
    if (!userId) {
      throw new Error("Missing userId for loading data");
    }
    
    this.debugLog("Loading user data", { userId });
    
    try {
      // Start a transaction to track data loading
      this.beginTransaction();
      
      // Get the record ID first
      const recordId = await this.findUserRecordId(userId, auth);
      
      // Get the full user data
      const rawUserData = await this.getUserData(recordId);
      
      // Process the data into a usable format
      const processedData = await this.processRawUserData(rawUserData, recordId);
      
      // Update cached data
      this.cachedUserData = processedData;
      
      // Store the processed data locally for backup
      this.saveToLocalStorage(processedData);
      
      // Initialize the metadata manager with this data
      metadataManager.initializeCache(processedData);
      
      // Initialize the topic shell manager
      topicShellManager.initialize(processedData);
      
      // Initialize the color manager
      if (processedData.colorMapping) {
        colorManager.restoreColorMapping(processedData.colorMapping);
      }
      
      // Commit the load transaction
      await this.commitTransaction();
      
      return processedData;
    } catch (error) {
      console.error("Error loading user data:", error);
      
      // Roll back the transaction
      await this.rollbackTransaction();
      
      // Try to load from localStorage as fallback
      this.debugLog("Attempting to load from localStorage");
      return this.loadFromLocalStorage();
    }
  }
  
  /**
   * Process raw user data from Knack into a usable format
   * @param {Object} rawData - Raw data from Knack
   * @param {string} recordId - Record ID
   * @returns {Promise<Object>} - Processed data
   */
  async processRawUserData(rawData, recordId) {
    this.debugLog("Processing raw user data", { recordId });
    
    const result = {
      recordId: recordId,
      cards: [],
      topicShells: [],
      colorMapping: {},
      spacedRepetition: {
        box1: [],
        box2: [],
        box3: [],
        box4: [],
        box5: []
      },
      topicLists: [],
      topicMetadata: []
    };
    
    try {
      // Process cards (field_2979)
      if (rawData[FIELD_MAPPING.cardBankData]) {
        const cardData = safeParseJSON(rawData[FIELD_MAPPING.cardBankData], []);
        if (Array.isArray(cardData)) {
          // Split cards and topic shells
          const cardsAndShells = this.splitCardsByType(cardData);
          result.cards = cardsAndShells.cards;
          result.topicShells = cardsAndShells.topics;
        }
      }
      
      // Process color mapping (field_3000)
      if (rawData[FIELD_MAPPING.colorMapping]) {
        result.colorMapping = safeParseJSON(rawData[FIELD_MAPPING.colorMapping], {});
      }
      
      // Process spaced repetition boxes
      const boxes = ['box1', 'box2', 'box3', 'box4', 'box5'];
      boxes.forEach((box, index) => {
        const boxField = FIELD_MAPPING[`${box}Data`];
        if (rawData[boxField]) {
          result.spacedRepetition[box] = safeParseJSON(rawData[boxField], []);
        }
      });
      
      // Process topic lists (field_3011)
      if (rawData[FIELD_MAPPING.topicLists]) {
        result.topicLists = safeParseJSON(rawData[FIELD_MAPPING.topicLists], []);
      }
      
      // Process topic metadata (field_3030)
      if (rawData[FIELD_MAPPING.topicMetadata]) {
        result.topicMetadata = safeParseJSON(rawData[FIELD_MAPPING.topicMetadata], []);
      }
    } catch (error) {
      console.error("Error processing raw user data:", error);
    }
    
    this.debugLog("User data processed", {
      cardsCount: result.cards.length,
      topicShellsCount: result.topicShells.length,
      topicListsCount: result.topicLists.length
    });
    
    return result;
  }
  
  /**
   * Split cards and topic shells
   * @param {Array} items - Mixed array of cards and topic shells
   * @returns {Object} - Separated cards and topic shells
   */
  splitCardsByType(items) {
    if (!Array.isArray(items)) {
      return { topics: [], cards: [] };
    }
    
    // Ensure all items have a type
    const ensureType = (item) => {
      if (!item) return item;
      
      if (item.type) return item;
      
      // Try to determine type based on properties
      if (item.isShell === true || item.name) {
        return {...item, type: 'topic'};
      } else if (item.question || item.front || item.back || item.topicId || item.boxNum) {
        return {...item, type: 'card'};
      }
      
      // Default to card type
      return {...item, type: 'card'};
    };
    
    const typedItems = items.map(ensureType);
    
    const topics = typedItems.filter(item => item.type === 'topic');
    const cards = typedItems.filter(item => item.type !== 'topic');
    
    return { topics, cards };
  }
  
  /**
 * Save data to localStorage as backup
 * @param {Object} data - Data to save
 */
saveToLocalStorage(data) {
  try {
    // Add version metadata
    const versionedData = addVersionMetadata(data);
    
    // Save to localStorage
    localStorage.setItem('flashcards_app_data', JSON.stringify(versionedData));
    
    // Save individual components for backward compatibility
    if (data.cards) localStorage.setItem('flashcards', JSON.stringify(data.cards));
    if (data.colorMapping) localStorage.setItem('colorMapping', JSON.stringify(data.colorMapping));
    if (data.spacedRepetition) localStorage.setItem('spacedRepetition', JSON.stringify(data.spacedRepetition));
    if (data.topicLists) localStorage.setItem('topicLists', JSON.stringify(data.topicLists));
    if (data.topicMetadata) localStorage.setItem('topicMetadata', JSON.stringify(data.topicMetadata));
    
    // Backup multiple choice options
    if (data.cards) backupMultipleChoiceOptions(data.cards);
    
    this.debugLog("Saved data to localStorage");
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

/**
 * Load data from localStorage
 * @returns {Object} - Loaded data
 */
loadFromLocalStorage() {
  try {
    // Try to load new format first
    const storedData = localStorage.getItem('flashcards_app_data');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      this.debugLog("Loaded data from localStorage (new format)");
      return parsedData;
    }
    
    // Fall back to old format
    const result = {
      cards: [],
      topicShells: [],
      colorMapping: {},
      spacedRepetition: {
        box1: [],
        box2: [],
        box3: [],
        box4: [],
        box5: []
      },
      topicLists: [],
      topicMetadata: []
    };
    
    // Load individual components
    const cardsData = localStorage.getItem('flashcards');
    if (cardsData) {
      result.cards = safeParseJSON(cardsData, []);
    }
    
    const colorData = localStorage.getItem('colorMapping');
    if (colorData) {
      result.colorMapping = safeParseJSON(colorData, {});
    }
    
    const srData = localStorage.getItem('spacedRepetition');
    if (srData) {
      result.spacedRepetition = safeParseJSON(srData, {
        box1: [],
        box2: [],
        box3: [],
        box4: [],
        box5: []
      });
    }
    
    const topicListsData = localStorage.getItem('topicLists');
    if (topicListsData) {
      result.topicLists = safeParseJSON(topicListsData, []);
    }
    
    const topicMetadataData = localStorage.getItem('topicMetadata');
    if (topicMetadataData) {
      result.topicMetadata = safeParseJSON(topicMetadataData, []);
    }
    
    this.debugLog("Loaded data from localStorage (old format)");
    return result;
  } catch (error) {
    console.error("Error loading from localStorage:", error);
    return {
      cards: [],
      topicShells: [],
      colorMapping: {},
      spacedRepetition: {
        box1: [],
        box2: [],
        box3: [],
        box4: [],
        box5: []
      },
      topicLists: [],
      topicMetadata: []
    };
  }
}
 
  /**
 * Validate and standardize a card before saving
 * @param {Object} card - Card to standardize
 * @returns {Object} - Standardized card
 */
standardizeCard(card) {
  // Deep clone to avoid modifying original
  const clone = JSON.parse(JSON.stringify(card));
  
  // Ensure ID
  if (!clone.id) {
    clone.id = generateId('card');
  }
  
  // Ensure type is set for cards (not topic)
  if (!clone.type) {
    clone.type = 'card';
  }
  
  // Ensure creation timestamp
  if (!clone.createdAt) {
    clone.createdAt = new Date().toISOString();
  }
  
  // Ensure update timestamp
  clone.updatedAt = new Date().toISOString();
  
  // Handle multiple choice type consistently
  if (clone.questionType === 'multiple_choice' || 
      clone.type === 'multiple_choice' ||
      (clone.answer && typeof clone.answer === 'string' && clone.answer.match(/Correct Answer:\s*[a-e]\)/i))) {
    
    // Standardize on questionType
    clone.questionType = 'multiple_choice';
    
    // Remove legacy type field if it was for question format
    if (clone.type === 'multiple_choice' || clone.type === 'short_answer') {
      clone.type = 'card';
    }
    
    // Ensure options array is present
    if (!Array.isArray(clone.options) || clone.options.length === 0) {
      // Try to restore from savedOptions
      if (Array.isArray(clone.savedOptions) && clone.savedOptions.length > 0) {
        clone.options = [...clone.savedOptions];
      } else if (clone.answer && typeof clone.answer === 'string') {
        // Try to extract options from answer text (simplified version)
        const match = clone.answer.match(/Correct Answer:\s*([a-e])\)/i);
        if (match) {
          const correctLetter = match[1].toLowerCase();
          const letters = ['a', 'b', 'c', 'd', 'e'];
          const options = [];
          
          // Create options with the correct one marked
          letters.slice(0, 4).forEach(letter => {
            options.push({
              text: letter === correctLetter ? 
                  (clone.detailedAnswer || 'Correct option') : 
                  `Option ${letter.toUpperCase()}`,
              isCorrect: letter === correctLetter
            });
          });
          
          clone.options = options;
        }
      }
    }
    
    // Always backup options
    if (Array.isArray(clone.options) && clone.options.length > 0) {
      clone.savedOptions = [...clone.options];
    }
  } else if (!clone.questionType) {
    // Default to short_answer for non-multiple choice cards
    clone.questionType = 'short_answer';
  }
  
  return clone;
}

/**
 * Apply metadata to an entity before saving
 * @param {Object} entity - Entity to process
 * @returns {Object} - Entity with applied metadata
 */
applyMetadataBeforeSave(entity) {
  if (!entity) return entity;
  
  // Process different entity types
  if (entity.type === 'card') {
    // For cards, ensure they have metadata from their topic
    if (entity.topicId) {
      return metadataManager.applyMetadata(entity);
    }
  } else if (entity.type === 'topic') {
    // For topics, ensure they have consistent metadata
    return metadataManager.applyMetadata(entity, { forceUpdate: true });
  }
  
  return entity;
}

/**
 * Save cards to Knack
 * @param {Array} cards - Cards to save
 * @returns {Promise<boolean>} - Success status
 */
async saveCards(cards) {
  if (!this.cachedUserData || !this.cachedUserData.recordId) {
    throw new Error("No user data loaded for saving cards");
  }
  
  if (!Array.isArray(cards) || cards.length === 0) {
    return false;
  }
  
  this.debugLog("Saving cards", { count: cards.length });
  
  // Queue this operation
  return this.operationQueue.enqueue(async () => {
    try {
      // Standardize all cards
      const standardizedCards = cards.map(card => this.standardizeCard(card));
      
      // Apply metadata to each card
      const processedCards = standardizedCards.map(card => this.applyMetadataBeforeSave(card));
      
      // For each card, check if it needs to be linked to a topic
      processedCards.forEach(card => {
        if (card.topicId) {
          topicShellManager.linkCardToTopic(card.topicId, card.id);
        }
      });
      
      // Merge with existing cards - create a map for faster lookups
      const existingCardMap = new Map();
      this.cachedUserData.cards.forEach(card => {
        if (card.id) {
          existingCardMap.set(card.id, card);
        }
      });
      
      // Update existing cards or add new ones
      processedCards.forEach(card => {
        if (existingCardMap.has(card.id)) {
          // Update existing card
          existingCardMap.set(card.id, card);
        } else {
          // Add new card
          existingCardMap.set(card.id, card);
        }
      });
      
      // Update cached data
      this.cachedUserData.cards = Array.from(existingCardMap.values());
      
      // Get all items to save
      const allItems = [
        ...this.cachedUserData.cards,
        ...this.cachedUserData.topicShells
      ];
      
      // Create update data
      const updateData = {
        [FIELD_MAPPING.cardBankData]: JSON.stringify(allItems),
        [FIELD_MAPPING.lastSaved]: new Date().toISOString()
      };
      
      // Create proper headers
      const headers = {
        "Content-Type": "application/json",
        "X-Knack-Application-ID": KNACK_APP_ID,
        "X-Knack-REST-API-Key": KNACK_API_KEY
      };
      
      // Update the record
      const updateUrl = `${KNACK_API_URL}/objects/object_102/records/${this.cachedUserData.recordId}`;
      const updateResponse = await this.authManager.fetchWithAuth(updateUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(updateData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update record: ${errorText}`);
      }
      
      // Save to localStorage as backup
      this.saveToLocalStorage(this.cachedUserData);
      
      this.debugLog("Cards saved successfully", { count: processedCards.length });
      
      return true;
    } catch (error) {
      console.error("Error saving cards:", error);
      throw error;
    }
  }, {
    priority: 7,
    type: 'saveCards',
    metadata: { count: cards.length }
  });
}

/**
 * Save topics to Knack
 * @param {Array} topics - Topics to save
 * @returns {Promise<boolean>} - Success status
 */
async saveTopics(topics) {
  if (!this.cachedUserData || !this.cachedUserData.recordId) {
    throw new Error("No user data loaded for saving topics");
  }
  
  if (!Array.isArray(topics) || topics.length === 0) {
    return false;
  }
  
  this.debugLog("Saving topics", { count: topics.length });
  
  // Queue this operation
  return this.operationQueue.enqueue(async () => {
    try {
      // Process each topic through the topic shell manager
      const processedTopics = topics.map(topic => {
        // Create or update the topic shell
        return topicShellManager.createOrUpdateTopicShell(topic);
      });
      
      // Update cached topic shells
      const existingTopicMap = new Map();
      this.cachedUserData.topicShells.forEach(topic => {
        if (topic.id) {
          existingTopicMap.set(topic.id, topic);
        }
      });
      
      // Update existing topics or add new ones
      processedTopics.forEach(topic => {
        existingTopicMap.set(topic.id, topic);
      });
      
      // Update cached data
      this.cachedUserData.topicShells = Array.from(existingTopicMap.values());
      
      // Get all items to save
      const allItems = [
        ...this.cachedUserData.cards,
        ...this.cachedUserData.topicShells
      ];
      
      // Create update data
      const updateData = {
        [FIELD_MAPPING.cardBankData]: JSON.stringify(allItems),
        [FIELD_MAPPING.lastSaved]: new Date().toISOString()
      };
      
      // Create proper headers
      const headers = {
        "Content-Type": "application/json",
        "X-Knack-Application-ID": KNACK_APP_ID,
        "X-Knack-REST-API-Key": KNACK_API_KEY
      };
      
      // Update the record
      const updateUrl = `${KNACK_API_URL}/objects/object_102/records/${this.cachedUserData.recordId}`;
      const updateResponse = await this.authManager.fetchWithAuth(updateUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(updateData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update record: ${errorText}`);
      }
      
      // Save to localStorage as backup
      this.saveToLocalStorage(this.cachedUserData);
      
      this.debugLog("Topics saved successfully", { count: processedTopics.length });
      
      return true;
    } catch (error) {
      console.error("Error saving topics:", error);
      throw error;
    }
  }, {
    priority: 7,
    type: 'saveTopics',
    metadata: { count: topics.length }
  });
}

/**
 * Save topic metadata to Knack
 * @param {Array} metadata - Metadata to save
 * @returns {Promise<boolean>} - Success status
 */
async saveTopicMetadata(metadata) {
  if (!this.cachedUserData || !this.cachedUserData.recordId) {
    throw new Error("No user data loaded for saving metadata");
  }
  
  if (!Array.isArray(metadata)) {
    return false;
  }
  
  this.debugLog("Saving topic metadata", { count: metadata.length });
  
  // Queue this operation
  return this.operationQueue.enqueue(async () => {
    try {
      // Update cached data
      this.cachedUserData.topicMetadata = metadata;
      
      // Create update data
      const updateData = {
        [FIELD_MAPPING.topicMetadata]: JSON.stringify(metadata),
        [FIELD_MAPPING.lastSaved]: new Date().toISOString()
      };
      
      // Create proper headers
      const headers = {
        "Content-Type": "application/json",
        "X-Knack-Application-ID": KNACK_APP_ID,
        "X-Knack-REST-API-Key": KNACK_API_KEY
      };
      
      // Update the record
      const updateUrl = `${KNACK_API_URL}/objects/object_102/records/${this.cachedUserData.recordId}`;
      const updateResponse = await this.authManager.fetchWithAuth(updateUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(updateData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update metadata: ${errorText}`);
      }
      
      // Save to localStorage as backup
      this.saveToLocalStorage(this.cachedUserData);
      
      this.debugLog("Topic metadata saved successfully", { count: metadata.length });
      
      return true;
    } catch (error) {
      console.error("Error saving topic metadata:", error);
      throw error;
    }
  }, {
    priority: 6,
    type: 'saveMetadata',
    metadata: { count: metadata.length }
  });
}

/**
 * Save color mapping to Knack
 * @param {Object} colorMapping - Color mapping to save
 * @returns {Promise<boolean>} - Success status
 */
async saveColorMapping(colorMapping) {
  if (!this.cachedUserData || !this.cachedUserData.recordId) {
    throw new Error("No user data loaded for saving color mapping");
  }
  
  if (!colorMapping || typeof colorMapping !== 'object') {
    return false;
  }
  
  this.debugLog("Saving color mapping", { subjects: Object.keys(colorMapping).length });
  
  // Queue this operation
  return this.operationQueue.enqueue(async () => {
    try {
      // Update cached data
      this.cachedUserData.colorMapping = colorMapping;
      
      // Create update data
      const updateData = {
        [FIELD_MAPPING.colorMapping]: JSON.stringify(colorMapping),
        [FIELD_MAPPING.lastSaved]: new Date().toISOString()
      };
      
      // Create proper headers
      const headers = {
        "Content-Type": "application/json",
        "X-Knack-Application-ID": KNACK_APP_ID,
        "X-Knack-REST-API-Key": KNACK_API_KEY
      };
      
      // Update the record
      const updateUrl = `${KNACK_API_URL}/objects/object_102/records/${this.cachedUserData.recordId}`;
      const updateResponse = await this.authManager.fetchWithAuth(updateUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(updateData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update color mapping: ${errorText}`);
      }
      
      // Save to localStorage as backup
      this.saveToLocalStorage(this.cachedUserData);
      
      this.debugLog("Color mapping saved successfully");
      
      return true;
    } catch (error) {
      console.error("Error saving color mapping:", error);
      throw error;
    }
  }, {
    priority: 5,
    type: 'saveColorMapping'
  });
}

/**
 * Save all data to Knack (complete save)
 * @returns {Promise<boolean>} - Success status
 */
async saveAllData() {
  if (!this.cachedUserData || !this.cachedUserData.recordId) {
    throw new Error("No user data loaded for complete save");
  }
  
  this.debugLog("Performing complete data save");
  
  // Queue this operation
  return this.operationQueue.enqueue(async () => {
    try {
      // Get all items to save
      const allItems = [
        ...this.cachedUserData.cards,
        ...this.cachedUserData.topicShells
      ];
      
      // Create update data with all fields
      const updateData = {
        [FIELD_MAPPING.cardBankData]: JSON.stringify(allItems),
        [FIELD_MAPPING.colorMapping]: JSON.stringify(this.cachedUserData.colorMapping),
        [FIELD_MAPPING.topicLists]: JSON.stringify(this.cachedUserData.topicLists),
        [FIELD_MAPPING.topicMetadata]: JSON.stringify(this.cachedUserData.topicMetadata),
        [FIELD_MAPPING.lastSaved]: new Date().toISOString()
      };
      
      // Add spaced repetition boxes
      const boxes = ['box1', 'box2', 'box3', 'box4', 'box5'];
      boxes.forEach(box => {
        updateData[FIELD_MAPPING[`${box}Data`]] = JSON.stringify(
          this.cachedUserData.spacedRepetition[box] || []
        );
      });
      
      // Create proper headers
      const headers = {
        "Content-Type": "application/json",
        "X-Knack-Application-ID": KNACK_APP_ID,
        "X-Knack-REST-API-Key": KNACK_API_KEY
      };
      
      // Update the record
      const updateUrl = `${KNACK_API_URL}/objects/object_102/records/${this.cachedUserData.recordId}`;
      const updateResponse = await this.authManager.fetchWithAuth(updateUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(updateData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to perform complete save: ${errorText}`);
      }
      
      // Save to localStorage as backup
      this.saveToLocalStorage(this.cachedUserData);
      
      this.debugLog("Complete data save successful", {
        cards: this.cachedUserData.cards.length,
        topics: this.cachedUserData.topicShells.length
      });
      
      return true;
    } catch (error) {
      console.error("Error performing complete save:", error);
      throw error;
    }
  }, {
    priority: 10, // Highest priority
    type: 'saveAllData'
  });
}

/**
 * Save a single card
 * @param {Object} card - Card to save
 * @returns {Promise<Object>} - Saved card
 */
async saveCard(card) {
  if (!card) {
    throw new Error("Missing card data for save");
  }
  
  // Start a transaction if not already in one
  const startedTransaction = !transactionState.isActive && this.beginTransaction();
  
  try {
    // Standardize the card
    const standardizedCard = this.standardizeCard(card);
    
    // Add to transaction
    this.addTransactionOperation({
      type: 'saveCard',
      data: standardizedCard
    });
    
    // If we started the transaction, commit it
    if (startedTransaction) {
      await this.commitTransaction();
    }
    
    return standardizedCard;
  } catch (error) {
    // If we started the transaction and there's an error, roll back
    if (startedTransaction) {
      await this.rollbackTransaction();
    }
    
    throw error;
  }
}

/**
 * Save multiple cards
 * @param {Array} cards - Cards to save
 * @returns {Promise<Array>} - Saved cards
 */
async saveCardsWithTransaction(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return [];
  }
  
  // Start a transaction if not already in one
  const startedTransaction = !transactionState.isActive && this.beginTransaction();
  
  try {
    // Standardize all cards
    const standardizedCards = cards.map(card => this.standardizeCard(card));
    
    // Add to transaction
    standardizedCards.forEach(card => {
      this.addTransactionOperation({
        type: 'saveCard',
        data: card
      });
    });
    
    // If we started the transaction, commit it
    if (startedTransaction) {
      await this.commitTransaction();
    }
    
    return standardizedCards;
  } catch (error) {
    // If we started the transaction and there's an error, roll back
    if (startedTransaction) {
      await this.rollbackTransaction();
    }
    
    throw error;
  }
}

/**
 * Save a topic
 * @param {Object} topic - Topic to save
 * @returns {Promise<Object>} - Saved topic
 */
async saveTopic(topic) {
  if (!topic || !topic.subject) {
    throw new Error("Missing topic data for save");
  }
  
  // Start a transaction if not already in one
  const startedTransaction = !transactionState.isActive && this.beginTransaction();
  
  try {
    // Create or update topic shell
    const topicShell = topicShellManager.createOrUpdateTopicShell(topic);
    
    // Add to transaction
    this.addTransactionOperation({
      type: 'saveTopic',
      data: topicShell
    });
    
    // Also update metadata
    this.addTransactionOperation({
      type: 'updateMetadata',
      data: {
        id: topicShell.id,
        name: topicShell.name,
        subject: topicShell.subject,
        examBoard: topicShell.examBoard,
        examType: topicShell.examType
      }
    });
    
    // If we started the transaction, commit it
    if (startedTransaction) {
      await this.commitTransaction();
    }
    
    return topicShell;
  } catch (error) {
    // If we started the transaction and there's an error, roll back
    if (startedTransaction) {
      await this.rollbackTransaction();
    }
    
    throw error;
  }
}
}
// Export a singleton instance
const unifiedPersistenceManager = new UnifiedPersistenceManager();
export default unifiedPersistenceManager;
