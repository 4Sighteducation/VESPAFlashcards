/**
 * SaveQueueManager.js
 * 
 * A transaction-based queue system for managing data operations.
 * This ensures that operations are atomic and performed in sequence,
 * with proper error handling and recovery.
 */

export default class SaveQueueManager {
  constructor() {
    this.queue = [];
    this.inProgress = false;
    this.currentTransaction = null;
    this.eventListeners = new Map();
    this.lastSaveResult = null;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // ms
      maxDelay: 10000, // ms
    };
  }

  /**
   * Add an event listener
   * @param {string} eventName - Event name to listen for
   * @param {Function} callback - Callback function
   * @returns {Function} - Function to remove the listener
   */
  addEventListener(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }

    this.eventListeners.get(eventName).add(callback);

    // Return function to remove the listener
    return () => {
      if (this.eventListeners.has(eventName)) {
        this.eventListeners.get(eventName).delete(callback);
      }
    };
  }

  /**
   * Notify all listeners of an event
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   */
  notifyListeners(eventName, data) {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventName} event listener:`, error);
        }
      });
    }
  }

  /**
   * Begin a new transaction
   * @returns {string} - Transaction ID
   */
  beginTransaction() {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.currentTransaction = {
      id: transactionId,
      operations: [],
      state: 'pending',
      startTime: Date.now(),
      originalData: null,
      recordId: null,
      retryCount: 0
    };
    
    this.notifyListeners('transaction:begin', this.currentTransaction);
    
    return transactionId;
  }

  /**
   * Add an operation to the current transaction
   * @param {Object} operation - Operation to add
   * @returns {SaveQueueManager} - For chaining
   */
  addOperation(operation) {
    if (!this.currentTransaction) {
      throw new Error("No active transaction");
    }
    
    // Add operation to the transaction
    this.currentTransaction.operations.push({
      ...operation,
      timestamp: Date.now()
    });
    
    this.notifyListeners('operation:added', {
      transaction: this.currentTransaction.id,
      operation
    });
    
    return this;
  }

  /**
   * Commit the current transaction
   * @returns {Promise<Object>} - Transaction results
   */
  async commitTransaction() {
    if (!this.currentTransaction) {
      throw new Error("No active transaction");
    }
    
    // Set transaction state to committing
    this.currentTransaction.state = 'committing';
    
    this.notifyListeners('transaction:commit', this.currentTransaction);
    
    // Add to the queue and process if not already in progress
    return new Promise((resolve, reject) => {
      this.queue.push({
        transaction: this.currentTransaction,
        resolve,
        reject
      });
      
      const currentTransaction = { ...this.currentTransaction };
      this.currentTransaction = null;
      
      // Start processing if not already in progress
      if (!this.inProgress) {
        this.processQueue();
      }
    });
  }

  /**
   * Roll back the current transaction
   * @returns {Promise<void>}
   */
  async rollbackTransaction() {
    if (!this.currentTransaction) {
      return;
    }
    
    // Set transaction state to rolling back
    this.currentTransaction.state = 'rolling_back';
    
    this.notifyListeners('transaction:rollback', this.currentTransaction);
    
    // Clean up the transaction
    const transaction = { ...this.currentTransaction };
    this.currentTransaction = null;
    
    // Return success
    return Promise.resolve();
  }

  /**
   * Process the next item in the queue
   * @private
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.inProgress = false;
      return;
    }
    
    this.inProgress = true;
    const item = this.queue[0];
    const { transaction, resolve, reject } = item;
    
    try {
      // Execute each operation in sequence
      let result = transaction.originalData;
      
      for (const operation of transaction.operations) {
        try {
          this.notifyListeners('operation:start', {
            transaction: transaction.id,
            operation
          });
          
          // Execute the operation
          result = await this.executeOperation(operation, result);
          
          this.notifyListeners('operation:complete', {
            transaction: transaction.id,
            operation,
            success: true
          });
        } catch (error) {
          this.notifyListeners('operation:error', {
            transaction: transaction.id,
            operation,
            error
          });
          
          // Rethrow the error
          throw error;
        }
      }
      
      // Save the final result
      const saveResult = await this.saveToKnack(result, transaction.recordId);
      
      // Verify the save was successful
      const verificationResult = await this.verifyTransaction(saveResult);
      
      if (verificationResult.success) {
        // Transaction successful
        transaction.state = 'committed';
        
        this.notifyListeners('transaction:complete', transaction);
        
        // Remove from queue
        this.queue.shift();
        
        // Resolve the promise
        resolve(transaction);
        
        // Process next item in queue
        this.processQueue();
      } else {
        // Verification failed, check retry count
        transaction.retryCount++;
        
        if (transaction.retryCount < this.retryConfig.maxRetries) {
          // Retry after a delay
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, transaction.retryCount),
            this.retryConfig.maxDelay
          );
          
          this.notifyListeners('transaction:retry', {
            transaction: transaction.id,
            retryCount: transaction.retryCount,
            delay,
            error: verificationResult.error
          });
          
          setTimeout(() => this.processQueue(), delay);
        } else {
          // Max retries reached, fail the transaction
          transaction.state = 'failed';
          
          this.notifyListeners('transaction:failed', {
            transaction: transaction.id,
            error: verificationResult.error
          });
          
          // Remove from queue
          this.queue.shift();
          
          // Reject the promise
          reject(new Error(`Transaction verification failed: ${verificationResult.error}`));
          
          // Process next item in queue
          this.processQueue();
        }
      }
    } catch (error) {
      // Operation error, check retry count
      transaction.retryCount++;
      
      if (transaction.retryCount < this.retryConfig.maxRetries) {
        // Retry after a delay
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, transaction.retryCount),
          this.retryConfig.maxDelay
        );
        
        this.notifyListeners('transaction:retry', {
          transaction: transaction.id,
          retryCount: transaction.retryCount,
          delay,
          error
        });
        
        setTimeout(() => this.processQueue(), delay);
      } else {
        // Max retries reached, fail the transaction
        transaction.state = 'failed';
        
        this.notifyListeners('transaction:failed', {
          transaction: transaction.id,
          error
        });
        
        // Remove from queue
        this.queue.shift();
        
        // Reject the promise
        reject(error);
        
        // Process next item in queue
        this.processQueue();
      }
    }
  }

  /**
   * Execute a single operation
   * @param {Object} operation - Operation to execute
   * @param {any} data - Current data state
   * @returns {Promise<any>} - Updated data
   * @private
   */
  async executeOperation(operation, data) {
    // Implementation will depend on operation type
    switch (operation.type) {
      case 'saveCards':
        return this.executeCardsSave(operation, data);
      case 'saveTopics':
        return this.executeTopicsSave(operation, data);
      case 'updateCardTopicRelationships':
        return this.executeUpdateRelationships(operation, data);
      // Add more operation types as needed
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Save data to Knack
   * @param {any} data - Data to save
   * @param {string} recordId - Record ID
   * @returns {Promise<any>} - Save result
   * @private
   */
  async saveToKnack(data, recordId) {
    // Implementation will integrate with Knack
    // This is a placeholder - actual implementation will use Knack API
    console.log(`[SaveQueueManager] Saving data to Knack for record ${recordId}`);
    
    // Return mock success for now
    return Promise.resolve({
      success: true,
      recordId
    });
  }

  /**
   * Verify a transaction after save
   * @param {any} saveResult - Result of the save operation
   * @returns {Promise<Object>} - Verification result
   * @private
   */
  async verifyTransaction(saveResult) {
    // Implementation will verify data integrity
    // This is a placeholder - actual implementation will fetch and verify
    console.log(`[SaveQueueManager] Verifying transaction for record ${saveResult.recordId}`);
    
    // Return mock success for now
    return Promise.resolve({
      success: true
    });
  }

  /**
   * Execute a save cards operation
   * @param {Object} operation - Operation details
   * @param {any} data - Current data state
   * @returns {Promise<any>} - Updated data
   * @private
   */
  async executeCardsSave(operation, data) {
    // Implementation for saving cards
    console.log(`[SaveQueueManager] Executing saveCards operation with ${operation.cards?.length || 0} cards`);
    
    // This is a placeholder - actual implementation will update the data
    return Promise.resolve(data);
  }

  /**
   * Execute a save topics operation
   * @param {Object} operation - Operation details
   * @param {any} data - Current data state
   * @returns {Promise<any>} - Updated data
   * @private
   */
  async executeTopicsSave(operation, data) {
    // Implementation for saving topics
    console.log(`[SaveQueueManager] Executing saveTopics operation with ${operation.topics?.length || 0} topics`);
    
    // This is a placeholder - actual implementation will update the data
    return Promise.resolve(data);
  }

  /**
   * Execute an update relationships operation
   * @param {Object} operation - Operation details
   * @param {any} data - Current data state
   * @returns {Promise<any>} - Updated data
   * @private
   */
  async executeUpdateRelationships(operation, data) {
    // Implementation for updating card-topic relationships
    console.log(`[SaveQueueManager] Executing updateCardTopicRelationships operation`);
    
    // This is a placeholder - actual implementation will update relationships
    return Promise.resolve(data);
  }

  /**
   * Add a high-priority operation to the queue
   * @param {Object} operation - Operation to add
   * @returns {Promise<any>} - Operation result
   */
  async enqueue(operation) {
    // Begin a transaction
    const transactionId = this.beginTransaction();
    
    // Add the operation
    this.addOperation(operation);
    
    // Commit and return the result
    return this.commitTransaction();
  }
} 