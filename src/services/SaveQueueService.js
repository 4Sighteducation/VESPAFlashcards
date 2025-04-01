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
      
      // Prepare the save data
      const saveData = this.prepareSaveData(operation);
      
      // Send save message to parent window
      window.parent.postMessage({
        type: "SAVE_DATA",
        data: saveData
      }, "*");

      // Set up message listener for save result
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'SAVE_RESULT') {
          window.removeEventListener('message', messageHandler);
          
          if (event.data.success) {
            console.log(`[SaveQueue] Save successful for: ${operation.type}`);
            this.handleSaveSuccess(operation);
          } else {
            console.error(`[SaveQueue] Save failed for: ${operation.type}`, event.data.error);
            this.handleSaveError(operation, new Error(event.data.error));
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Set timeout for operation
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        this.handleSaveError(operation, new Error('Save operation timed out'));
      }, 10000);

    } catch (error) {
      console.error(`[SaveQueue] Error processing save operation: ${operation.type}`, error);
      this.handleSaveError(operation, error);
    }
  }

  /**
   * Prepare data for saving
   */
  prepareSaveData(operation) {
    const baseData = {
      recordId: operation.recordId,
      preserveFields: operation.preserveFields,
      timestamp: new Date().toISOString()
    };

    // Add operation-specific data
    switch (operation.type) {
      case 'cards':
        return {
          ...baseData,
          cards: this.ensureSerializable(operation.data)
        };
      case 'colors':
        return {
          ...baseData,
          colorMapping: this.ensureSerializable(operation.data)
        };
      case 'topics':
        return {
          ...baseData,
          topicLists: this.ensureSerializable(operation.data)
        };
      case 'full':
        return {
          ...baseData,
          ...this.ensureSerializable(operation.data)
        };
      default:
        throw new Error(`Unknown save operation type: ${operation.type}`);
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
    const attempts = this.retryAttempts.get(operation) || 0;
    
    if (attempts < this.maxRetries) {
      // Increment retry count
      this.retryAttempts.set(operation, attempts + 1);
      
      // Retry after delay
      setTimeout(() => {
        this.isSaving = false;
        this.processQueue();
      }, this.retryDelay * Math.pow(2, attempts));
    } else {
      // Max retries reached, remove from queue and reject
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