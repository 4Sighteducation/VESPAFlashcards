/**
 * AppLoaderInit.js - Helper to initialize global app handlers
 * Provides fallback mechanisms for modal interactions and improves reliability
 */

/**
 * Initialize the app's global references on load
 * This makes it possible to access key functions from event handlers
 * and provides fallback mechanisms for when handler props aren't passed correctly
 */
export const initializeAppGlobals = (appInstance) => {
  if (!appInstance) {
    console.error("[AppLoaderInit] Cannot initialize - no App instance provided");
    return;
  }

  try {
    // Create a global window.App reference
    window.App = window.App || {};

    // Ensure critical handlers are available globally
    window.App.handleSaveTopicShellsAndRefresh = appInstance.handleSaveTopicShellsAndRefresh;
    
    console.log("[AppLoaderInit] Set up global App handlers with:", 
      appInstance.handleSaveTopicShellsAndRefresh ? "handleSaveTopicShellsAndRefresh available" : "handleSaveTopicShellsAndRefresh missing");

    // Listen for handler check events
    window.addEventListener('checkSaveHandlers', (event) => {
      console.log("[AppLoaderInit] Checking save handlers availability, source:", 
        event?.detail?.source || 'unknown');
        
      if (appInstance.handleSaveTopicShellsAndRefresh) {
        window.App.handleSaveTopicShellsAndRefresh = appInstance.handleSaveTopicShellsAndRefresh;
        console.log("[AppLoaderInit] Handler refreshed");
        
        // Send a notification event that handlers are available
        window.dispatchEvent(new CustomEvent('handlersAvailable', {
          detail: { 
            source: 'AppLoaderInit', 
            handlersAvailable: true,
            timestamp: new Date().toISOString()
          }
        }));
      } else {
        console.error("[AppLoaderInit] Handler still missing");
      }
    });
  } catch (error) {
    console.error("[AppLoaderInit] Error setting up app globals:", error);
  }
};

export default {
  initializeAppGlobals
};
