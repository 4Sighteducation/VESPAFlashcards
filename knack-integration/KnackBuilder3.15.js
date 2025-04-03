// == Knack Builder Multi-App Loader v3.15 ==
// Goal: Load different JS apps based on Knack Scene/View event data, regardless of order.
// Strategy: Store the latest scene AND view keys. After each event, check if the
//           current combination matches an app.
// Changes from v3.14: Store lastViewKey, check condition after BOTH event types.

(function() {
    console.log("[Knack Builder Loader v3.15] Script start.");

    // --- Configuration ---
    const VERSION = "3.15";
    const DEBUG_MODE = true;

    // --- App Configuration ---
    const APPS = {
        'flashcards': {
            scenes: ['scene_1206'],
            views: ['view_3005'],
            scriptUrl: 'https://cdn.jsdelivr.net/gh/TonyDiliberto/VESPAFlashcards@latest/public/Flashcards1d.js',
            configBuilder: (baseConfig, sceneKey, viewKey) => ({
                ...baseConfig,
                appConfig: { currentScene: sceneKey, currentView: viewKey },
                appUrl: 'https://vespa-flashcards-e7f31e9ff3c9.herokuapp.com/'
            }),
        },
        'studyPlanner': {
            scenes: ['scene_1208'],
            views: ['view_3011'],
            scriptUrl: 'https://cdn.jsdelivr.net/gh/TonyDiliberto/VESPAScheduler@latest/public/sp2Javascript1c.js',
            configBuilder: (baseConfig, sceneKey, viewKey) => ({
                ...baseConfig,
                appConfig: { currentScene: sceneKey, currentView: viewKey },
            }),
        },
        'taskboards': {
             scenes: ['scene_XYZ'], // *** REPLACE ***
             views: ['view_ABC'],   // *** REPLACE ***
             scriptUrl: 'YOUR_TASKBOARDS_SCRIPT_URL_HERE', // *** REPLACE ***
             configBuilder: (baseConfig, sceneKey, viewKey) => ({
                 ...baseConfig,
                 appConfig: { currentScene: sceneKey, currentView: viewKey },
             }),
        }
    };

    // --- Shared Configuration ---
    const sharedConfig = {
        knackAppId: '635ae3808307f1001ff97b15',
        knackApiKey: '5051c541-419f-49f1-b3c8-8576f17c94e7',
    };

    // --- State ---
    let loadedAppKey = null;
    let lastRenderedSceneKey = null; // Store the latest scene key
    let lastRenderedViewKey = null;  // Store the latest view key

    // --- Helper Functions ---
     function log(message, data) {
        if (DEBUG_MODE) {
            let logData = data;
            if (typeof data === 'object' && data !== null) {
                try { logData = JSON.parse(JSON.stringify(data)); } catch (e) { /* Ignore */ }
            }
            console.log(`[Knack Builder Loader v${VERSION}] ${message}`, logData !== undefined ? logData : "");
        }
    }

    function errorLog(message, error) {
        console.error(`[Knack Builder Loader v${VERSION}] ${message}`, error !== undefined ? error : "");
    }

    function loadScript(url) {
        if (typeof $ === 'undefined' || typeof $.getScript === 'undefined') {
            errorLog("jQuery ($) or $.getScript is not defined.", url);
            return Promise.reject(new Error("jQuery or $.getScript not defined"));
        }
        return new Promise((resolve, reject) => {
            log("Attempting to load script via jQuery:", url);
            $.getScript(url)
                .done(() => { log("Script loaded successfully:", url); resolve(); })
                .fail((jqxhr, settings, exception) => {
                    errorLog("Failed to load script via jQuery:", { url, status: jqxhr?.status, exception });
                    reject(new Error(`Failed to load script: ${url} - ${exception}`));
                });
        });
    }

    // Finds app based on explicit scene/view keys
    function findAppToLoad(sceneKey, viewKey) {
         if (!sceneKey || !viewKey || typeof sceneKey !== 'string' || typeof viewKey !== 'string') {
            // log(`App search skipped: Invalid keys. Scene: ${sceneKey}, View: ${viewKey}`); // Reduce noise
            return null;
         }
         log(`Searching for app matching Scene Key: ${sceneKey}, View Key: ${viewKey}`);
         for (const key in APPS) {
             const app = APPS[key];
             const sceneMatch = app.scenes.includes(sceneKey);
             const viewMatch = app.views.includes(viewKey);
             if (sceneMatch && viewMatch) {
                 log(`Match found: App '${key}'.`);
                 return key;
             }
         }
         log(`No app configuration found for Scene '${sceneKey}', View '${viewKey}'.`);
         return null;
    }

    // Central function to check conditions and load the app
    async function tryLoadApp() {
        log(`Checking load conditions. Scene: ${lastRenderedSceneKey}, View: ${lastRenderedViewKey}`);
        const appKey = findAppToLoad(lastRenderedSceneKey, lastRenderedViewKey);

        if (!appKey) {
             // log("No matching app for current scene/view combination."); // Reduce noise
            return; // No app matches the current combination
        }

        if (appKey === loadedAppKey) {
            // log(`App '${appKey}' already loaded/loading. Skipping.`); // Reduce noise
            return; // Already loaded or loading
        }

        log(`Conditions met for app: ${appKey}. Attempting load.`);
        loadedAppKey = appKey; // Mark as loading/loaded

        const appConfig = APPS[appKey];
        if (!appConfig || !appConfig.scriptUrl || !appConfig.configBuilder) {
            errorLog(`Configuration error for app: ${appKey}`);
            loadedAppKey = null; return;
        }

        try {
            // Use the stored keys for config building
            window.VESPA_CONFIG = appConfig.configBuilder(sharedConfig, lastRenderedSceneKey, lastRenderedViewKey);
            log(`Configuration set for ${appKey}`, window.VESPA_CONFIG);
            await loadScript(appConfig.scriptUrl);
            log(`App '${appKey}' script loaded. Child script must initialize.`);
        } catch (error) {
            errorLog(`Failed to load script for app ${appKey}:`, error);
            loadedAppKey = null; // Reset state
            window.VESPA_CONFIG = undefined;
        }
    }

    // --- Main Execution (jQuery Document Ready) ---
    $(function() {
        log("DOM ready. Attaching Knack event listeners.");

        if (typeof $ === 'undefined' || typeof $.ajax === 'undefined') {
             errorLog("Critical Error: jQuery ($) is not available at DOM ready.");
             return;
        }
        log("jQuery confirmed available.");

        // Listener 1: Store scene key and then check if conditions are met
        $(document).on('knack-scene-render.any', function(event, scene) {
            if (scene && scene.key) {
                log(`Scene rendered: Storing scene key '${scene.key}'`);
                lastRenderedSceneKey = scene.key;
                // Check if this completes the required pair
                tryLoadApp();
            } else {
                 log("Scene render event fired, but no scene key found.");
            }
        });

        // Listener 2: Store view key and then check if conditions are met
        $(document).on('knack-view-render.any', function(event, view) {
            if (view && view.key) {
                 log(`View rendered: Storing view key '${view.key}'`);
                 lastRenderedViewKey = view.key;
                 // Check if this completes the required pair
                 tryLoadApp();
            } else {
                 log("View render event fired, but no view key found.");
            }
        });

        log("Knack render event listeners attached.");
        log("Loader setup complete. Waiting for render events.");
    });

    log("Knack Builder Loader setup registered. Waiting for DOM ready.");

}());