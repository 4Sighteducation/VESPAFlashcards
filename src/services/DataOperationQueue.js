/**
 * DataOperationQueue.js
 * 
 * Advanced queue system for processing data operations sequentially.
 * Features:
 * - Priority-based execution
 * - Operation dependencies
 * - Robust error handling with retries
 * - Detailed operation tracking
 */

class DataOperationQueue {
  constructor() {
    // Queue of pending operations (using Map for better performance)
    this.queue = new Map();
    
    // Queue processing state
    this.isProcessing = false;
    this.currentOperation = null;
    
    // Operation counter for unique IDs
    this.operationCounter = 0;
    
    // Configurable settings
    this.settings = {
      maxRetries: 3,
      retryDelay: 1000, // Base delay in ms
      exponentialBackoff: true,
      logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
      offlineMode: false
    };
    
    // Operation statistics
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      lastCompleted: null,
      lastError: null,
      averageExecutionTime: 0,
      longestOperation: null
    };
    
    // Pending promise resolvers for operations waiting on others
    this.dependencyResolvers = new Map();
    
    // Bind methods to preserve this context
    this.enqueue = this.enqueue.bind(this);
    this.processNext = this.processNext.bind(this);
    this.getStatus = this.getStatus.bind(this);
    
    // Initialize system
    this.initializeOfflineSupport();
  }

  /**
   * Initialize offline support functionality
   */
  initializeOfflineSupport() {
    // Check if browser is online initially
    this.settings.offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
    
    // Set up online/offline event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.settings.offlineMode = false;
        this.log('System back online, processing queued operations', {}, 'info');
        this.processNext();
      });
      
      window.addEventListener('offline', () => {
        this.settings.offlineMode = true;
        this.log('System offline, operations will be queued', {}, 'info');
      });
    }
  }

  /**
   * Add an operation to the queue and start processing if not already
   * @param {Function} operation - Async function to execute
   * @param {Object} options - Queue options for this operation
   * @returns {Promise} - Resolves with operation result or rejects with error
   */
  enqueue(operation, options = {}) {
    if (typeof operation !== 'function') {
      return Promise.reject(new Error('Operation must be a function'));
    }

    // Generate unique operation ID
    const operationId = `op_${Date.now()}_${++this.operationCounter}`;
    
    // Parse options with defaults
    const {
      priority = 5, // Normal priority (1-10 scale, 10 being highest)
      dependencies = [], // IDs of operations this one depends on
      type = 'generic', // Operation type for grouping/filtering
      metadata = {}, // Additional operation metadata
      retries = this.settings.maxRetries, // Number of retries for this operation
      offlineSafe = false, // Whether this operation can be executed offline
      timeout = 30000 // Operation timeout in ms
    } = options;

    // Create a promise that will resolve when the operation completes
    const operationPromise = new Promise((resolve, reject) => {
      // Process dependencies
      let dependencyPromise = Promise.resolve();
      
      if (dependencies.length > 0) {
        // Create array of dependency promises
        const dependencyPromises = dependencies.map(depId => {
          // If dependency is already resolved, return resolved promise
          if (!this.queue.has(depId)) {
            return Promise.resolve();
          }
          
          // Otherwise create a promise that will resolve when the dependency completes
          return new Promise(depResolve => {
            this.dependencyResolvers.set(depId, depResolve);
          });
        });
        
        // Wait for all dependencies to resolve
        dependencyPromise = Promise.all(dependencyPromises);
      }
      
      // Add to the queue
      this.queue.set(operationId, {
        id: operationId,
        operation,
        priority,
        dependencies,
        type,
        metadata: {
          ...metadata,
          enqueuedAt: new Date().toISOString()
        },
        status: 'pending',
        dependencyPromise,
        resolve,
        reject,
        remainingRetries: retries,
        offlineSafe,
        timeout
      });

      this.log('Operation enqueued', { 
        operationId,
        priority,
        queueLength: this.queue.size,
        type
      }, 'debug');

      // Start processing if not already processing
      if (!this.isProcessing) {
        this.processNext();
      }
    });
    
    // Add operation ID and useful methods to the promise
    operationPromise.operationId = operationId;
    
    // Method to cancel the operation
    operationPromise.cancel = () => {
      if (this.queue.has(operationId)) {
        const operation = this.queue.get(operationId);
        operation.status = 'cancelled';
        operation.reject(new Error('Operation cancelled'));
        this.queue.delete(operationId);
        return true;
      }
      return false;
    };
    
    // Method to increase operation priority
    operationPromise.increasePriority = (amount = 1) => {
      if (this.queue.has(operationId)) {
        const operation = this.queue.get(operationId);
        operation.priority = Math.min(10, operation.priority + amount);
        return operation.priority;
      }
      return null;
    };

    return operationPromise;
  }

  /**
   * Find the next operation to process based on priority and dependencies
   * @returns {Object|null} - Next operation or null if none are ready
   */
  findNextOperation() {
    // If queue is empty, nothing to process
    if (this.queue.size === 0) {
      return null;
    }
    
    let highestPriority = -1;
    let nextOperation = null;
    
    // Convert queue to array for easier processing
    const operations = Array.from(this.queue.values());
    
    // First find operations with no unresolved dependencies
    for (const operation of operations) {
      // Skip operations waiting for dependencies
      if (operation.dependencies.length > 0 && !operation.dependenciesResolved) {
        continue;
      }
      
      // In offline mode, only process offline-safe operations
      if (this.settings.offlineMode && !operation.offlineSafe) {
        continue;
      }
      
      // Find highest priority operation
      if (operation.priority > highestPriority) {
        highestPriority = operation.priority;
        nextOperation = operation;
      }
    }
    
    return nextOperation;
  }

  /**
   * Process the next operation in the queue
   * @returns {Promise<void>}
   */
  async processNext() {
    // If already processing or offline, do nothing
    if (this.isProcessing) {
      return;
    }
    
    // Find next operation to process
    const nextOperation = this.findNextOperation();
    
    // If no operations are ready, exit
    if (!nextOperation) {
      this.log('No operations ready to process', { 
        queueSize: this.queue.size,
        offlineMode: this.settings.offlineMode 
      }, 'debug');
      return;
    }

    // Set processing flag
    this.isProcessing = true;
    this.currentOperation = nextOperation;
    
    // Set operation status to processing
    nextOperation.status = 'processing';
    nextOperation.startTime = Date.now();

    // Set up operation timeout
    const timeoutId = setTimeout(() => {
      if (this.currentOperation && this.currentOperation.id === nextOperation.id) {
        this.handleOperationError(
          nextOperation,
          new Error(`Operation timed out after ${nextOperation.timeout}ms`)
        );
      }
    }, nextOperation.timeout);

    try {
      this.log('Starting operation', { 
        operationId: nextOperation.id,
        type: nextOperation.type,
        priority: nextOperation.priority
      });
      
      // Update stats
      this.stats.totalOperations++;
      
      // Wait for dependencies to resolve first
      await nextOperation.dependencyPromise;
      
      // Execute the operation
      const result = await nextOperation.operation();
      
      // Calculate execution time
      const executionTime = Date.now() - nextOperation.startTime;
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Log success
      this.log('Operation completed', { 
        operationId: nextOperation.id,
        executionTime,
        queueRemaining: this.queue.size - 1
      });
      
      // Update stats
      this.stats.successfulOperations++;
      this.stats.lastCompleted = new Date().toISOString();
      
      // Update average execution time
      this.stats.averageExecutionTime = 
        (this.stats.averageExecutionTime * (this.stats.successfulOperations - 1) + executionTime) / 
        this.stats.successfulOperations;
      
      // Update longest operation if this one was longer
      if (!this.stats.longestOperation || executionTime > this.stats.longestOperation.time) {
        this.stats.longestOperation = {
          id: nextOperation.id,
          type: nextOperation.type,
          time: executionTime
        };
      }
      
      // Resolve operation promise
      nextOperation.resolve(result);
      
      // Resolve any operations waiting on this one
      if (this.dependencyResolvers.has(nextOperation.id)) {
        this.dependencyResolvers.get(nextOperation.id)();
        this.dependencyResolvers.delete(nextOperation.id);
      }
      
      // Remove from queue
      this.queue.delete(nextOperation.id);
    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Handle error
      this.handleOperationError(nextOperation, error);
    } finally {
      // Reset processing flag
      this.isProcessing = false;
      this.currentOperation = null;
      
      // Process next operation if any
      if (this.queue.size > 0) {
        this.processNext();
      }
    }
  }
  
  /**
   * Handle operation error including retries
   * @param {Object} operation - Operation that failed
   * @param {Error} error - Error that occurred
   */
  handleOperationError(operation, error) {
    // Log error
    this.log('Operation failed', { 
      operationId: operation.id,
      error: error.message,
      remainingRetries: operation.remainingRetries
    }, 'error');
    
    // Update stats
    this.stats.failedOperations++;
    this.stats.lastError = { 
      operationId: operation.id,
      message: error.message,
      timestamp: new Date().toISOString() 
    };
    
    // Check if we should retry
    if (operation.remainingRetries > 0) {
      // Update retry count and stats
      operation.remainingRetries--;
      this.stats.retriedOperations++;
      
      // Calculate backoff time
      let retryDelay = this.settings.retryDelay;
      if (this.settings.exponentialBackoff) {
        const factor = this.settings.maxRetries - operation.remainingRetries;
        retryDelay = this.settings.retryDelay * Math.pow(2, factor - 1);
      }
      
      this.log('Retrying operation', {
        operationId: operation.id,
        attempt: this.settings.maxRetries - operation.remainingRetries,
        delay: retryDelay
      }, 'warn');
      
      // Reset status to pending
      operation.status = 'pending';
      
      // Schedule retry
      setTimeout(() => {
        // Only retry if operation still exists in queue
        if (this.queue.has(operation.id)) {
          // Try processing the queue again
          if (!this.isProcessing) {
            this.processNext();
          }
        }
      }, retryDelay);
    } else {
      // No more retries, reject the promise
      operation.reject(error);
      
      // Resolve any operations waiting on this one
      if (this.dependencyResolvers.has(operation.id)) {
        this.dependencyResolvers.get(operation.id)();
        this.dependencyResolvers.delete(operation.id);
      }
      
      // Remove from queue
      this.queue.delete(operation.id);
    }
  }

  /**
   * Get the current queue status
   * @returns {Object} - Queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.size,
      isProcessing: this.isProcessing,
      currentOperation: this.currentOperation ? {
        id: this.currentOperation.id,
        type: this.currentOperation.type,
        startTime: this.currentOperation.startTime,
        elapsedTime: this.currentOperation.startTime ? Date.now() - this.currentOperation.startTime : 0
      } : null,
      offlineMode: this.settings.offlineMode,
      stats: this.stats,
      pendingOperations: Array.from(this.queue.values()).map(op => ({
        id: op.id,
        type: op.type,
        priority: op.priority,
        status: op.status,
        enqueuedAt: op.metadata.enqueuedAt
      }))
    };
  }

  /**
   * Clear the queue (emergency use only)
   * @param {Object} options - Clear options
   * @returns {number} - Number of cleared operations
   */
  clearQueue(options = {}) {
    const { 
      type = null, // Clear only operations of this type
      force = false, // Force clear even processing operations
      onlyPending = true // Only clear pending operations
    } = options;
    
    // Count cleared operations
    let clearedCount = 0;
    
    // Get all operations
    const operations = Array.from(this.queue.values());
    
    for (const operation of operations) {
      // Skip if type doesn't match
      if (type && operation.type !== type) {
        continue;
      }
      
      // Skip currently processing operation unless forced
      if (operation === this.currentOperation && !force) {
        continue;
      }
      
      // Skip non-pending operations if onlyPending is true
      if (onlyPending && operation.status !== 'pending') {
        continue;
      }
      
      // Reject the operation
      operation.reject(new Error('Operation cancelled - queue cleared'));
      
      // Resolve any dependencies
      if (this.dependencyResolvers.has(operation.id)) {
        this.dependencyResolvers.get(operation.id)();
        this.dependencyResolvers.delete(operation.id);
      }
      
      // Remove from queue
      this.queue.delete(operation.id);
      clearedCount++;
    }
    
    this.log('Queue cleared', { 
      clearedCount,
      remainingOperations: this.queue.size 
    }, 'warn');
    
    return clearedCount;
  }

  /**
   * Update queue settings
   * @param {Object} newSettings - New settings to apply
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    this.log('Settings updated', { settings: this.settings }, 'info');
  }

  /**
   * Multi-level logging helper
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @param {string} level - Log level (debug, info, warn, error)
   */
  log(message, data = {}, level = 'debug') {
    const logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // Skip if log level is lower than configured level
    if (logLevels[level] < logLevels[this.settings.logLevel]) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logMethod = level === 'error' ? console.error : 
                     level === 'warn' ? console.warn : 
                     level === 'info' ? console.info : 
                     console.log;
    
    const styles = {
      debug: 'color: #9c27b0; font-weight: bold;',
      info: 'color: #2196f3; font-weight: bold;',
      warn: 'color: #ff9800; font-weight: bold;',
      error: 'color: #f44336; font-weight: bold;'
    };
    
    logMethod(`%c[DataOperationQueue] [${level.toUpperCase()}] ${message}`, styles[level], data);
  }
}

// Export a singleton instance
const instance = new DataOperationQueue();
export default instance;
