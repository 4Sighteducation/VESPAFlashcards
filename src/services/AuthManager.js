/**
 * AuthManager.js
 * 
 * Central authentication manager for the Flashcards application.
 * Handles token storage, refresh, and authentication status.
 */

// Default timeout for token refresh attempts (milliseconds)
const TOKEN_REFRESH_TIMEOUT = 10000;

class AuthManager {
  constructor() {
    this.token = null;
    this.userInfo = null;
    this.isInitialized = false;
    this.refreshAttempts = 0;
    this.maxRefreshAttempts = 5;
    this.refreshCallbacks = [];
    this.refreshTimestamp = null;
  }

  /**
   * Initialize the AuthManager with user authentication data
   * @param {Object} authData - The user's authentication data
   */
  initialize(authData) {
    if (!authData) {
      console.error('[AuthManager] Failed to initialize: No auth data provided');
      return false;
    }

    this.token = authData.token || null;
    this.userInfo = {
      id: authData.id || '',
      email: authData.email || '',
      name: authData.name || '',
      role: authData.role || '',
      school: authData.school || authData.field_122 || '',
      tutorGroup: authData.tutorGroup || '',
      yearGroup: authData.yearGroup || '',
      tutor: authData.tutor || ''
    };
    
    this.isInitialized = true;
    this.refreshTimestamp = new Date().toISOString();
    console.log('[AuthManager] Initialized successfully');
    
    return true;
  }

  /**
   * Check if the AuthManager is authenticated
   * @returns {boolean} - Authentication status
   */
  isAuthenticated() {
    return this.isInitialized && !!this.token;
  }

  /**
   * Get the current user information
   * @returns {Object|null} - User information or null if not authenticated
   */
  getUserInfo() {
    return this.isInitialized ? this.userInfo : null;
  }

  /**
   * Get the current authentication token
   * @returns {string|null} - The authentication token or null if not authenticated
   */
  getToken() {
    return this.token;
  }

  /**
   * Refresh the authentication token
   * @returns {Promise<string>} - Promise resolving to the refreshed token
   */
  async refreshToken() {
    if (!this.isInitialized) {
      return Promise.reject(new Error('AuthManager not initialized'));
    }

    // Increment refresh attempt counter
    this.refreshAttempts++;
    console.log(`[AuthManager] Token refresh attempt #${this.refreshAttempts}`);

    // If we've tried too many times, reject
    if (this.refreshAttempts > this.maxRefreshAttempts) {
      return Promise.reject(new Error('Max refresh attempts exceeded'));
    }

    // Create a promise that will be resolved when the token is refreshed
    return new Promise((resolve, reject) => {
      // Update timestamp to track refresh time
      this.refreshTimestamp = new Date().toISOString();
      
      // Store this promise's resolve/reject callbacks for later
      const callbackId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      this.refreshCallbacks.push({
        id: callbackId,
        resolve,
        reject
      });

      // Send message to parent window for token refresh
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "REQUEST_TOKEN_REFRESH",
          timestamp: this.refreshTimestamp,
          refreshCount: this.refreshAttempts
        }, "*");
        
        console.log('[AuthManager] Requested token refresh from parent window');
        
        // Set up timeout in case we don't get a response
        setTimeout(() => {
          // Find and remove this callback
          const index = this.refreshCallbacks.findIndex(cb => cb.id === callbackId);
          if (index !== -1) {
            const callback = this.refreshCallbacks.splice(index, 1)[0];
            callback.reject(new Error('Token refresh timed out'));
          }
        }, TOKEN_REFRESH_TIMEOUT);
      } else {
        // If not in iframe, we can't refresh token
        reject(new Error('Not in iframe, unable to refresh token'));
      }
    });
  }

  /**
   * Handle token refresh result message from parent window
   * @param {Object} data - The token refresh result data
   * @returns {boolean} - True if token was refreshed successfully
   */
  handleTokenRefreshResult(data) {
    if (!data) return false;
    
    // If successful and contains a token
    if (data.success && data.token) {
      // Update our stored token
      this.token = data.token;
      
      // Reset refresh attempts on success
      this.refreshAttempts = 0;
      
      // Resolve all pending refresh callbacks
      this.refreshCallbacks.forEach(callback => {
        callback.resolve(data.token);
      });
      
      // Clear the callbacks array
      this.refreshCallbacks = [];
      
      console.log('[AuthManager] Token refreshed successfully');
      return true;
    } else {
      // Token refresh failed
      console.error('[AuthManager] Token refresh failed:', data.error || 'Unknown error');
      
      // Reject all pending refresh callbacks
      this.refreshCallbacks.forEach(callback => {
        callback.reject(new Error(data.error || 'Token refresh failed'));
      });
      
      // Clear the callbacks array
      this.refreshCallbacks = [];
      
      return false;
    }
  }

  /**
   * Fetch with authentication token, handling token refresh if needed
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - The fetch response
   */
  async fetchWithAuth(url, options = {}) {
    if (!this.isInitialized) {
      return Promise.reject(new Error('AuthManager not initialized'));
    }

    // Add the authentication token to the headers
    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`
      }
    };

    try {
      const response = await fetch(url, authOptions);
      
      // If unauthorized, try to refresh token and retry
      if (response.status === 401 || response.status === 403) {
        try {
          console.log('[AuthManager] Unauthorized response, refreshing token');
          
          // Try to refresh the token
          const newToken = await this.refreshToken();
          
          // Retry the fetch with the new token
          const retryOptions = {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`
            }
          };
          
          return fetch(url, retryOptions);
        } catch (refreshError) {
          console.error('[AuthManager] Token refresh failed:', refreshError);
          throw new Error('Authentication failed');
        }
      }
      
      return response;
    } catch (error) {
      console.error('[AuthManager] Fetch error:', error);
      throw error;
    }
  }

  /**
   * Clear authentication data when logging out
   */
  logout() {
    this.token = null;
    this.userInfo = null;
    this.isInitialized = false;
    this.refreshAttempts = 0;
    this.refreshCallbacks = [];
    this.refreshTimestamp = null;
  }
}

// Create singleton instance
const authManager = new AuthManager();

export default authManager;
