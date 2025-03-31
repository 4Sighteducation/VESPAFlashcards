/**
 * AuthAppIntegration.js
 * 
 * Helper module to integrate the AuthManager with the App component.
 * This file provides functions that should be called from App.js.
 */

import authManager from '../services/AuthManager';

/**
 * Initialize the AuthManager with user authentication data
 * @param {Object} authData - The authentication data from Knack
 */
export function initializeAuthManager(authData) {
  console.log("[AuthAppIntegration] Initializing AuthManager with user data");
  authManager.initialize(authData);
}

/**
 * Handle token refresh requests using the AuthManager
 * @param {string} recordId - The user's record ID
 * @param {Function} showStatus - Function to display status messages
 * @param {Function} setLoading - Function to set loading state
 * @param {Function} loadFromLocalStorage - Function to load data from localStorage
 */
export async function handleTokenRefreshRequest(recordId, showStatus, setLoading, loadFromLocalStorage) {
  console.log("[AuthAppIntegration] Handling token refresh with AuthManager");
  
  try {
    // Use the centralized AuthManager to handle token refresh
    await authManager.refreshToken();
    console.log("[AuthAppIntegration] AuthManager successfully refreshed token");
    showStatus("Session refreshed");
    
    // After successful token refresh, clear any loading state
    setLoading(false);
    return true;
  } catch (error) {
    console.error("[AuthAppIntegration] AuthManager failed to refresh token:", error);
    
    // If we've already tried refreshing too many times, show an error
    if (authManager.refreshAttempts > 3) {
      console.error("[AuthAppIntegration] Too many refresh attempts, session may be invalid");
      showStatus("Session error. Please refresh the page.");
      setLoading(false);
      return false;
    }
    
    // Fall back to legacy refresh approach
    if (window.parent !== window) {
      // Include the refresh counter to prevent loops
      window.parent.postMessage({
        type: "REQUEST_TOKEN_REFRESH",
        recordId: recordId || "",
        refreshCount: authManager.refreshAttempts,
        timestamp: new Date().toISOString()
      }, "*");
      
      console.log("[AuthAppIntegration] Requested token refresh from parent window (legacy approach)");
      
      // Show status indicating refresh attempt
      showStatus("Refreshing session...");
      
      // Return true since we've initiated the refresh
      return true;
    } else {
      // We're not in an iframe, try to reload data from localStorage
      console.log("[AuthAppIntegration] Not in iframe, trying local reload");
      loadFromLocalStorage();
      showStatus("Refreshed data from local storage");
      return false;
    }
  }
}

/**
 * Process and handle authentication refresh result
 * @param {Object} data - The message data received from the parent frame
 * @param {Function} setAuth - Function to update auth state
 * @param {Function} showStatus - Function to display status messages
 */
export function handleAuthRefreshResult(data, setAuth, showStatus) {
  console.log("[AuthAppIntegration] Processing auth refresh result:", data);
  
  if (data.success && data.token) {
    // Update AuthManager with the new token
    authManager.handleTokenRefreshResult(data);
    
    // Update app auth state
    setAuth(prev => ({
      ...prev,
      token: data.token,
      refreshed: true,
      timestamp: new Date().toISOString()
    }));
    
    showStatus("Session refreshed");
    return true;
  } else {
    // Handle failure case
    showStatus("Session refresh failed. Please reload the page.");
    return false;
  }
}

/**
 * Check if AuthManager is initialized and prepared for API calls
 * @param {Object} auth - Current auth state 
 * @returns {boolean} - Whether AuthManager is ready
 */
export function isAuthManagerInitialized(auth) {
  const isInitialized = authManager.isAuthenticated();
  
  // If auth state exists but AuthManager is not initialized, initialize it
  if (auth && !isInitialized) {
    console.log("[AuthAppIntegration] Auth exists but AuthManager not initialized, initializing now");
    authManager.initialize(auth);
    return true;
  }
  
  return isInitialized;
}

const AuthAppIntegration = {
  initializeAuthManager,
  handleTokenRefreshRequest,
  handleAuthRefreshResult,
  isAuthManagerInitialized
};

export default AuthAppIntegration;
