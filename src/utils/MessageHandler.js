/**
 * MessageHandler.js
 * 
 * Enhanced communication with Knack integration through the iframe.
 * This handles message passing between the React app and the parent Knack window,
 * with reliable delivery, retry mechanisms, and proper event handling.
 */

class MessageHandler {
  constructor() {
    this.pendingOperations = new Map();
    this.retryCount = 0;
    this.maxRetries = 3;
    this.listeners = new Map();
    this.queuedMessages = [];
    this.connectionHealthy = true;
    this.lastMessageTime = Date.now();
    this.healthCheckInterval = null;
    this.retryTimeouts = new Map();
    
    // Initialize when created
    this.initialize();
  }

  /**
   * Initialize the message handler
   */
  initialize() {
    // Add message event listener
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Set up periodic health check to detect disconnections
    this.healthCheckInterval = setInterval(() => this.checkConnectionHealth(), 10000);
    
    // Send a test message to check if the connection is working
    setTimeout(() => {
      this.sendHealthCheck();
    }, 2000);
  }

  /**
   * Clean up event listeners and intervals
   */
  cleanup() {
    // Remove event listener
    window.removeEventListener('message', this.handleMessage.bind(this));
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Clear any retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  /**
   * Add an event listener
   * @param {string} type - Message type to listen for
   * @param {Function} callback - Callback function
   * @returns {Function} - Function to remove the listener
   */
  addListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type).add(callback);
    
    // Return function to remove the listener
    return () => {
      if (this.listeners.has(type)) {
        this.listeners.get(type).delete(callback);
      }
    };
  }

  /**
   * Handle incoming messages
   * @param {MessageEvent} event - Message event
   */
  handleMessage(event) {
    // Validate message source
    if (!this.isValidMessageSource(event.source)) {
      return;
    }
    
    // Check if the message has the expected structure
    if (!event.data || !event.data.type) {
      return;
    }
    
    // Update last message time for health checks
    this.lastMessageTime = Date.now();
    
    const { type, data, operationId, timestamp } = event.data;
    
    // Log for debugging
    console.log(`[MessageHandler] Received message: ${type}`, {
      hasData: !!data,
      operationId,
      timestamp
    });
    
    // Special handling for operation responses
    if (operationId && this.pendingOperations.has(operationId)) {
      this.handleOperationResponse(operationId, event.data);
      return;
    }
    
    // Handle health check response
    if (type === 'HEALTH_CHECK_RESPONSE') {
      this.connectionHealthy = true;
      return;
    }
    
    // Notify listeners for this message type
    this.notifyListeners(type, data);
  }

  /**
   * Notify listeners of a message
   * @param {string} type - Message type
   * @param {any} data - Message data
   */
  notifyListeners(type, data) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[MessageHandler] Error in listener for ${type}:`, error);
        }
      });
    }
    
    // Also notify '*' listeners (catch-all)
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => {
        try {
          callback({ type, data });
        } catch (error) {
          console.error(`[MessageHandler] Error in catch-all listener:`, error);
        }
      });
    }
  }

  /**
   * Send a message to the parent window
   * @param {string} type - Message type
   * @param {any} data - Message data
   * @returns {Promise<any>} - Promise resolving with response
   */
  sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      // Generate unique ID for this operation
      const operationId = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Add to pending operations
      this.pendingOperations.set(operationId, {
        type,
        data,
        timestamp: Date.now(),
        resolve,
        reject,
        retries: 0
      });
      
      // If parent window available, send message
      if (this.hasValidParentWindow()) {
        window.parent.postMessage({
          type,
          data,
          operationId,
          timestamp: new Date().toISOString()
        }, '*');
        
        // Set timeout for operation
        const timeoutId = setTimeout(() => {
          this.handleOperationTimeout(operationId);
        }, 8000);
        
        // Store timeout id for cleanup
        this.retryTimeouts.set(operationId, timeoutId);
      } else {
        // Remove from pending operations
        this.pendingOperations.delete(operationId);
        
        // No parent window available
        reject(new Error('No parent window available for communication'));
      }
    });
  }

  /**
   * Handle a timeout for an operation
   * @param {string} operationId - Operation ID
   */
  handleOperationTimeout(operationId) {
    // Clear the timeout
    if (this.retryTimeouts.has(operationId)) {
      clearTimeout(this.retryTimeouts.get(operationId));
      this.retryTimeouts.delete(operationId);
    }
    
    const operation = this.pendingOperations.get(operationId);
    if (!operation) return;
    
    // If max retries reached, reject and clean up
    if (operation.retries >= this.maxRetries) {
      operation.reject(new Error(`Operation ${operation.type} timed out after ${this.maxRetries} retries`));
      this.pendingOperations.delete(operationId);
      return;
    }
    
    // Retry the operation with exponential backoff
    operation.retries++;
    this.pendingOperations.set(operationId, operation);
    
    const delay = Math.min(1000 * Math.pow(2, operation.retries), 10000);
    
    console.log(`[MessageHandler] Retrying operation ${operation.type} (${operation.retries}/${this.maxRetries}) after ${delay}ms`);
    
    // Resend the message after delay
    const retryTimeoutId = setTimeout(() => {
      if (this.hasValidParentWindow()) {
        window.parent.postMessage({
          type: operation.type,
          data: operation.data,
          operationId,
          retry: operation.retries,
          timestamp: new Date().toISOString()
        }, '*');
        
        // Set timeout for operation
        const timeoutId = setTimeout(() => {
          this.handleOperationTimeout(operationId);
        }, 8000);
        
        // Store timeout id for cleanup
        this.retryTimeouts.set(operationId, timeoutId);
      } else {
        // No parent window available
        operation.reject(new Error('No parent window available for communication'));
        this.pendingOperations.delete(operationId);
      }
    }, delay);
    
    // Store retry timeout id for cleanup
    this.retryTimeouts.set(`retry_${operationId}`, retryTimeoutId);
  }

  /**
   * Handle a response for an operation
   * @param {string} operationId - Operation ID
   * @param {any} response - Response data
   */
  handleOperationResponse(operationId, response) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) return;
    
    // Clear any timeouts
    if (this.retryTimeouts.has(operationId)) {
      clearTimeout(this.retryTimeouts.get(operationId));
      this.retryTimeouts.delete(operationId);
    }
    
    if (this.retryTimeouts.has(`retry_${operationId}`)) {
      clearTimeout(this.retryTimeouts.get(`retry_${operationId}`));
      this.retryTimeouts.delete(`retry_${operationId}`);
    }
    
    // Remove from pending operations
    this.pendingOperations.delete(operationId);
    
    // Check for error
    if (response.error) {
      operation.reject(new Error(response.error));
      return;
    }
    
    // Resolve with response data
    operation.resolve(response.data || response);
  }

  /**
   * Check if the connection is healthy
   */
  checkConnectionHealth() {
    const timeSinceLastMessage = Date.now() - this.lastMessageTime;
    
    // If it's been more than 30 seconds since the last message,
    // consider the connection unhealthy
    if (timeSinceLastMessage > 30000) {
      this.connectionHealthy = false;
      
      // Try to restore connection
      this.sendHealthCheck();
    }
  }

  /**
   * Send a health check message
   */
  sendHealthCheck() {
    // No need to track this as a pending operation
    if (this.hasValidParentWindow()) {
      window.parent.postMessage({
        type: 'HEALTH_CHECK',
        timestamp: new Date().toISOString()
      }, '*');
    }
  }

  /**
   * Checks if the message source is valid
   * @param {Window} source - Message source
   * @returns {boolean} - True if valid
   */
  isValidMessageSource(source) {
    // Accept messages from parent window
    if (source === window.parent) {
      return true;
    }
    
    // Accept messages from this window (for testing)
    if (source === window) {
      return true;
    }
    
    return false;
  }

  /**
   * Checks if there is a valid parent window
   * @returns {boolean} - True if valid
   */
  hasValidParentWindow() {
    return window.parent && window.parent !== window;
  }

  /**
   * Send data to Knack for saving
   * @param {any} data - Data to save
   * @returns {Promise<any>} - Promise resolving with response
   */
  saveData(data) {
    return this.sendMessage('SAVE_DATA', data);
  }

  /**
   * Add cards to the flashcard bank
   * @param {Array} cards - Cards to add
   * @param {string} recordId - Record ID
   * @returns {Promise<any>} - Promise resolving with response
   */
  addToBank(cards, recordId) {
    return this.sendMessage('ADD_TO_BANK', { cards, recordId });
  }

  /**
   * Request record ID from parent
   * @returns {Promise<string>} - Promise resolving with record ID
   */
  requestRecordId() {
    return this.sendMessage('REQUEST_RECORD_ID');
  }

  /**
   * Request updated data from parent
   * @param {string} recordId - Record ID
   * @returns {Promise<any>} - Promise resolving with updated data
   */
  requestUpdatedData(recordId) {
    return this.sendMessage('REQUEST_UPDATED_DATA', { recordId });
  }

  /**
   * Notify parent that topic shells have been created
   * @param {Array} topicShells - Created topic shells
   * @param {string} recordId - Record ID
   * @returns {Promise<any>} - Promise resolving with response
   */
  notifyTopicShellsCreated(topicShells, recordId) {
    return this.sendMessage('TOPIC_SHELLS_CREATED', { 
      topicShells, 
      recordId,
      count: topicShells.length
    });
  }

  /**
   * Request token refresh
   * @returns {Promise<any>} - Promise resolving with refreshed token
   */
  requestTokenRefresh() {
    return this.sendMessage('REQUEST_TOKEN_REFRESH');
  }

  /**
   * Set the SaveQueueManager instance
   * @param {SaveQueueManager} saveQueueManager
   */
  setSaveQueueManager(saveQueueManager) {
    this.saveQueueManager = saveQueueManager;
    
    // Subscribe to transaction events
    if (this.saveQueueManager) {
      this.saveQueueManager.addEventListener('transaction:begin', this.handleTransactionBegin.bind(this));
      this.saveQueueManager.addEventListener('transaction:complete', this.handleTransactionComplete.bind(this));
      this.saveQueueManager.addEventListener('transaction:failed', this.handleTransactionFailed.bind(this));
    }
  }

  /**
   * Handle transaction begin event
   * @param {Object} transaction - Transaction information
   */
  handleTransactionBegin(transaction) {
    this.notifyParent('TRANSACTION_BEGIN', { transactionId: transaction.id });
  }

  /**
   * Handle transaction complete event
   * @param {Object} transaction - Transaction information
   */
  handleTransactionComplete(transaction) {
    this.notifyParent('TRANSACTION_COMPLETE', { 
      transactionId: transaction.id,
      success: true
    });
  }

  /**
   * Handle transaction failed event
   * @param {Object} data - Failure information
   */
  handleTransactionFailed(data) {
    this.notifyParent('TRANSACTION_FAILED', { 
      transactionId: data.transaction.id,
      error: data.error?.message || 'Unknown error'
    });
  }

  /**
   * Send notification to parent window without expecting a response
   * @param {string} type - Message type
   * @param {any} data - Message data
   */
  notifyParent(type, data = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type,
        data,
        timestamp: new Date().toISOString()
      }, '*');
    }
  }
}

// Create and export a singleton instance
const messageHandler = new MessageHandler();
export default messageHandler; 