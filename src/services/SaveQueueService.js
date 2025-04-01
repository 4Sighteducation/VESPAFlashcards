// SaveQueueService.js - Centralized save queue management

class SaveQueueService {
  constructor() {
    this.queue = [];
    this.isSaving = false;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Add a save operation to the queue
   * @param {Object} saveOperation - The save operation to queue
   * @param {string} saveOperation.type - Type of save operation (e.g., 'cards', 'colors', 'topics')
   * @param {Object} saveOperation.data - Data to save
   * @param {string} saveOperation.recordId - Knack record ID
   * @param {boolean} saveOperation.preserveFields - Whether to preserve existing fields
   * @returns {Promise} - Resolves when save is complete
   */
  async addToQueue(saveOperation) {
    return new Promise((resolve, reject) => {
      // Add resolve/reject to operation for promise handling
      this.queue.push({
        ...saveOperation,
        resolve,
        reject,
        timestamp: new Date().toISOString()
      });

      console.log(`[SaveQueue] Added operation to queue: ${saveOperation.type}`);
      this.processQueue();
    });
  }

  /**
   * Process the save queue
   */
  async processQueue() {
    if (this.isSaving || this.queue.length === 0) return;

    this.isSaving = true;
    const operation = this.queue[0];

    try {
      console.log(`[SaveQueue] Processing operation: ${operation.type}`);
      
      // Check if we're in an iframe
      if (window.parent === window) {
        console.error("[SaveQueue] Not in iframe, cannot send messages to parent");
        throw new Error("Not in iframe, cannot send messages to parent");
      }
      
      // Prepare the save data with proper error handling
      let saveData;
      try {
        saveData = this.prepareSaveData(operation);
      } catch (prepError) {
        console.error("[SaveQueue] Error preparing save data:", prepError);
        this.handleSaveError(operation, prepError);
        return;
      }
      
      // For SAVE_DATA type, we need to use 'data' field
      // For other types, preserve the operation type and use payload
      const messageData = operation.type === 'SAVE_DATA' 
        ? { type: operation.type, data: saveData }
        : { type: operation.type, data: saveData };
        
      console.log(`[SaveQueue] Sending message to parent: ${operation.type}`);
      
      // Create a promise to track the response
      const responsePromise = new Promise((resolve, reject) => {
        // Function to handle response
        const messageHandler = (event) => {
          // Handle SAVE_RESULT message type
          if (event.data && event.data.type === 'SAVE_RESULT') {
            window.removeEventListener('message', messageHandler);
            clearTimeout(timeoutId);
            
            if (event.data.success) {
              console.log(`[SaveQueue] Received success response for: ${operation.type}`);
              resolve(true);
            } else {
              console.error(`[SaveQueue] Received error response for: ${operation.type}:`, event.data.error);
              reject(new Error(event.data.error || "Unknown error from Knack"));
            }
          }
          
          // Handle specific response types for other operations
          if (event.data && (
              event.data.type === 'ADD_TO_BANK_RESULT' || 
              event.data.type === 'TOPIC_LISTS_UPDATE_RESULT' ||
              event.data.type === 'TOPIC_METADATA_UPDATE_RESULT' ||
              event.data.type === 'TOPIC_EVENT_RESULT' ||
              event.data.type === 'CARDS_UPDATED_RESULT'
          )) {
            window.removeEventListener('message', messageHandler);
            clearTimeout(timeoutId);
            
            if (event.data.success) {
              console.log(`[SaveQueue] Received success response for: ${operation.type}`);
              resolve(true);
            } else {
              console.error(`[SaveQueue] Received error response for: ${operation.type}:`, event.data.error);
              reject(new Error(event.data.error || "Unknown error from Knack"));
            }
          }
        };
        
        // Add the message listener
        window.addEventListener('message', messageHandler);
        
        // Set timeout to prevent waiting forever
        const timeoutId = setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('Save operation timed out after 15 seconds'));
        }, 15000); // 15 second timeout
      });
      
      // Send the message to the parent window
      window.parent.postMessage(messageData, "*");
      
      // Wait for response
      try {
        await responsePromise;
        this.handleSaveSuccess(operation);
      } catch (responseError) {
        this.handleSaveError(operation, responseError);
      }
    } catch (error) {
      console.error(`[SaveQueue] Error processing save operation: ${operation.type}`, error);
      this.handleSaveError(operation, error);
    }
  }

  /**
   * Prepare data for saving
   */
  prepareSaveData(operation) {
    console.log(`[SaveQueue] Preparing data for ${operation.type} operation`);
    
    // Ensure recordId exists
    if (!operation.payload?.recordId) {
      console.error("[SaveQueue] Missing recordId in operation", operation);
      throw new Error("Missing recordId in save operation");
    }

    // For the SAVE_DATA operation, pass through the payload directly
    if (operation.type === 'SAVE_DATA') {
      // Validate payload structure
      const payload = operation.payload;
      
      // Log the payload structure for debugging
      console.log("[SaveQueue] Processing SAVE_DATA with payload structure:", {
        recordId: payload.recordId,
        has_cards: Array.isArray(payload.cards),
        cards_length: Array.isArray(payload.cards) ? payload.cards.length : 'N/A',
        has_colorMapping: !!payload.colorMapping,
        has_spacedRepetition: !!payload.spacedRepetition,
        preserveFields: !!payload.preserveFields
      });
      
      // Ensure required fields exist
      const safePayload = {
        recordId: payload.recordId,
        cards: Array.isArray(payload.cards) ? payload.cards : [],
        colorMapping: payload.colorMapping || {},
        spacedRepetition: payload.spacedRepetition || { box1: [], box2: [], box3: [], box4: [], box5: [] },
        userTopics: payload.userTopics || {},
        topicLists: Array.isArray(payload.topicLists) ? payload.topicLists : [],
        topicMetadata: Array.isArray(payload.topicMetadata) ? payload.topicMetadata : [],
        preserveFields: payload.preserveFields || false
      };
      
      // Ensure data is serializable
      return this.ensureSerializable(safePayload);
    }
    
    // Handle legacy operation types
    const baseData = {
      recordId: operation.payload?.recordId || operation.recordId,
      preserveFields: operation.payload?.preserveFields || operation.preserveFields || false,
      timestamp: new Date().toISOString()
    };

    // Add operation-specific data
    switch (operation.type) {
      case 'cards':
        return {
          ...baseData,
          cards: this.ensureSerializable(operation.payload || operation.data || [])
        };
      case 'colors':
        return {
          ...baseData,
          colorMapping: this.ensureSerializable(operation.payload || operation.data || {})
        };
      case 'topics':
        return {
          ...baseData,
          topicLists: this.ensureSerializable(operation.payload || operation.data || [])
        };
      case 'ADD_TO_BANK':
        // For ADD_TO_BANK, we need to pass the operation payload directly
        return this.ensureSerializable(operation.payload || {});
      case 'TOPIC_LISTS_UPDATED':
      case 'TOPIC_METADATA_UPDATED':
      case 'TOPIC_EVENT': 
      case 'CARDS_UPDATED':
        // For these event types, pass the payload directly
        return this.ensureSerializable(operation.payload || {});
      case 'full':
        return {
          ...baseData,
          ...this.ensureSerializable(operation.payload || operation.data || {})
        };
      default:
        console.warn(`[SaveQueue] Unknown save operation type: ${operation.type}, using payload directly`);
        return this.ensureSerializable(operation.payload || {});
    }
  }

  /**
   * Handle successful save
   */
  handleSaveSuccess(operation) {
    // Remove the completed operation from queue
    this.queue.shift();
    this.retryAttempts.delete(operation);
    
    // Resolve the operation's promise
    operation.resolve(true);
    
    // Reset saving flag and process next in queue
    this.isSaving = false;
    this.processQueue();
  }

  /**
   * Handle save error
   */
  handleSaveError(operation, error) {
    console.error(`[SaveQueue] Save error:`, error.message, operation);
    
    const attempts = this.retryAttempts.get(operation) || 0;
    
    if (attempts < this.maxRetries) {
      // Increment retry count
      this.retryAttempts.set(operation, attempts + 1);
      
      console.log(`[SaveQueue] Retrying operation (attempt ${attempts + 1}/${this.maxRetries})`);
      
      // Retry after delay
      setTimeout(() => {
        this.isSaving = false;
        this.processQueue();
      }, this.retryDelay * Math.pow(2, attempts));
    } else {
      // Max retries reached, remove from queue and reject
      console.error(`[SaveQueue] Max retries (${this.maxRetries}) reached, giving up on operation:`, operation.type);
      this.queue.shift();
      this.retryAttempts.delete(operation);
      operation.reject(error);
      
      // Reset saving flag and process next in queue
      this.isSaving = false;
      this.processQueue();
    }
  }

  /**
   * Ensure data is serializable
   */
  ensureSerializable(data) {
    try {
      JSON.stringify(data);
      return data;
    } catch (e) {
      console.error('[SaveQueue] Data contains circular references:', e);
      
      // Create a stripped down copy
      const cache = new Set();
      return JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) {
            return '[Circular]';
          }
          cache.add(value);
        }
        return value;
      }));
    }
  }
}

// Create and export a singleton instance
const saveQueueService = new SaveQueueService();
export default saveQueueService; 