/**
 * KnackAuthUpdates.js
 * 
 * Helper utilities to integrate AuthManager with Knack API operations
 * in TopicPersistenceService and similar services.
 */

import authManager from '../services/AuthManager';

/**
 * Wrap a fetch call with AuthManager authentication
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response with authentication
 */
export const fetchWithAuth = async (url, options = {}) => {
  try {
    // Check if AuthManager is available and initialized
    if (authManager && authManager.isAuthenticated()) {
      // Use AuthManager's fetchWithAuth for automatic token handling
      return await authManager.fetchWithAuth(url, options);
    } else {
      console.warn('[KnackAuthUpdates] AuthManager not initialized or authenticated, falling back to regular fetch');
      return await fetch(url, options);
    }
  } catch (error) {
    console.error('[KnackAuthUpdates] Error in fetchWithAuth:', error);
    throw error;
  }
};

/**
 * Request token refresh through AuthManager
 * @returns {Promise<boolean>} - Success status
 */
export const requestTokenRefresh = async () => {
  try {
    // Check if AuthManager is available and initialized
    if (authManager && authManager.isAuthenticated()) {
      console.log('[KnackAuthUpdates] Requesting token refresh via AuthManager');
      await authManager.refreshToken();
      return true;
    } else {
      console.warn('[KnackAuthUpdates] AuthManager not initialized, falling back to legacy refresh');
      
      // Legacy approach via postMessage
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "REQUEST_TOKEN_REFRESH",
          timestamp: new Date().toISOString()
        }, "*");
        
        // Wait a moment to allow token refresh to happen
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error('[KnackAuthUpdates] Error requesting token refresh:', error);
    
    // Try legacy refresh as a fallback
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "REQUEST_TOKEN_REFRESH",
        timestamp: new Date().toISOString()
      }, "*");
      
      // Wait a moment to allow token refresh to happen
      await new Promise(resolve => setTimeout(resolve, 1500));
      return true;
    }
    
    return false;
  }
};

/**
 * Get authentication headers for Knack API
 * @param {string} appId - Knack application ID
 * @param {string} apiKey - Knack API key (optional, for object-level access)
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} - Headers with authentication
 */
export const getKnackHeaders = (appId, apiKey = null, additionalHeaders = {}) => {
  const headers = {
    ...additionalHeaders,
    'Content-Type': 'application/json',
    'X-Knack-Application-ID': appId
  };
  
  // Add REST API key if provided
  if (apiKey) {
    headers['X-Knack-REST-API-Key'] = apiKey;
  }
  
  return headers;
};

/**
 * Implement a retry mechanism with token refresh for Knack API calls
 * @param {Function} apiCall - API call to execute and potentially retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} - Result of the API call
 */
export const withRetryAndRefresh = async (apiCall, maxRetries = 3) => {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      console.error(`API call failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      lastError = error;
      
      // If it's an auth error (401/403), try refreshing the token
      if (error.message?.includes('401') || 
          error.message?.includes('403') ||
          error.message?.includes('Authentication') ||
          error.status === 401 ||
          error.status === 403) {
        
        console.log(`Attempting token refresh after auth error on attempt ${attempt + 1}`);
        
        try {
          await requestTokenRefresh();
          
          // Add short delay after token refresh before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      } else {
        // For non-auth errors, add exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError || new Error('API call failed after retries');
};

/**
 * Safe JSON parsing with fallback
 * @param {string|Object} data - Data to parse
 * @param {any} defaultValue - Default value if parsing fails
 * @returns {any} - Parsed data or default value
 */
export const safeParseJSON = (data, defaultValue = null) => {
  if (!data) return defaultValue;
  
  // If it's already an object, just return it
  if (typeof data === 'object' && data !== null) return data;
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return defaultValue;
  }
};

export default {
  fetchWithAuth,
  requestTokenRefresh,
  getKnackHeaders,
  withRetryAndRefresh,
  safeParseJSON
};
