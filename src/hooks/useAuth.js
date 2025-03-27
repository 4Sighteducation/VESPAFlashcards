/**
 * useAuth.js
 * 
 * React hook for easy access to authentication state and methods
 * throughout the application. Provides a consistent interface for
 * authentication operations.
 */

import { useState, useEffect, useCallback } from 'react';
import authManager from '../services/AuthManager';

/**
 * Custom hook for authentication
 * @returns {Object} Auth state and methods
 */
function useAuth() {
  // Track authenticated state and user info
  const [isAuthenticated, setIsAuthenticated] = useState(authManager.isAuthenticated());
  const [userInfo, setUserInfo] = useState(authManager.getUserInfo());
  
  // Track if auth is being refreshed
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Effect to update state when AuthManager is initialized externally
  useEffect(() => {
    // Create a check function
    const checkAuthStatus = () => {
      const authStatus = authManager.isAuthenticated();
      const currentUserInfo = authManager.getUserInfo();
      
      // Only update state if there's a change
      if (authStatus !== isAuthenticated) {
        setIsAuthenticated(authStatus);
      }
      
      // Update user info if it's different (shallow comparison of ID is enough)
      if (currentUserInfo?.id !== userInfo?.id) {
        setUserInfo(currentUserInfo);
      }
    };
    
    // Check initially
    checkAuthStatus();
    
    // Set up interval to periodically check auth status
    const intervalId = setInterval(checkAuthStatus, 5000);
    
    // Clean up on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [isAuthenticated, userInfo]);
  
  /**
   * Refresh the authentication token
   */
  const refreshToken = useCallback(async () => {
    if (!isAuthenticated) {
      console.warn('[useAuth] Cannot refresh token when not authenticated');
      return null;
    }
    
    try {
      setIsRefreshing(true);
      const token = await authManager.refreshToken();
      setIsRefreshing(false);
      return token;
    } catch (error) {
      console.error('[useAuth] Token refresh failed:', error);
      setIsRefreshing(false);
      return null;
    }
  }, [isAuthenticated]);
  
  /**
   * Perform an authenticated fetch request
   */
  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      if (!isAuthenticated) {
        throw new Error('User is not authenticated');
      }
      
      try {
        return await authManager.fetchWithAuth(url, options);
      } catch (error) {
        console.error('[useAuth] Authenticated fetch failed:', error);
        throw error;
      }
    },
    [isAuthenticated]
  );
  
  /**
   * Log out the current user
   */
  const logout = useCallback(() => {
    authManager.logout();
    setIsAuthenticated(false);
    setUserInfo(null);
  }, []);
  
  return {
    isAuthenticated,
    userInfo,
    isRefreshing,
    refreshToken,
    fetchWithAuth,
    logout
  };
}

export default useAuth;
