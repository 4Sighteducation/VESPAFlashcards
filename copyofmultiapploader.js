// == Knack Builder Multi-App Loader v3.16 ==
// Goal: Load different JS apps based on Knack Scene/View event data, regardless of order.
// Strategy: Store the latest scene AND view keys. After each event, check if the
//           current combination matches an app. Load script, set specific config, call initializer.
// Changes from v3.15: Added configGlobalVar/initializerFunctionName, explicit call after load.

(function() {
    console.log("[Knack Builder Loader v3.16] Script start.");

    // --- Configuration ---
    const VERSION = "3.16"; // Updated version
    const DEBUG_MODE = false; // Enable debug mode for logging

    // --- App Configuration ---
    const APPS = {
    
        'reportProfiles': {
            scenes: ['scene_1095'],
            views: ['view_2776', 'view_3015'],
            scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/integrations/report/ReportProfiles1c.js',
            configBuilder: (baseConfig, sceneKey, viewKey) => ({
                ...baseConfig,
                appType: 'reportProfiles',
                sceneKey: sceneKey,
                viewKey: viewKey,
                elementSelectors: {
                    reportContainer: '#view_2776 .kn-rich_text__content',
                    profileContainer: '#view_3015 .kn-rich_text__content'
                }
            }),
            configGlobalVar: 'REPORTPROFILE_CONFIG',
            initializerFunctionName: 'initializeReportProfiles'
        },
  'flashcards': {
            scenes: ['scene_1206'],
            views: ['view_3005'],
            scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/integrations/Flashcards1v.js',
            configBuilder: (baseConfig, sceneKey, viewKey) => ({
                ...baseConfig,
                appType: 'flashcards', // Add appType for potential use
                sceneKey: sceneKey,
                viewKey: viewKey,
                elementSelector: '.kn-rich-text', // Default selector
                // REMOVED: appConfig nesting, flatten structure
                appUrl: 'https://vespa-flashcards-e7f31e9ff3c9.herokuapp.com/'
            }),
            configGlobalVar: 'VESPA_CONFIG', // Global var for this app's config
            initializerFunctionName: 'initializeFlashcardApp' // Function to call in child script
        },
    
        'studyPlanner': {
            scenes: ['scene_1208'],
            views: ['view_3008'],
            scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/integrations/studyPlanner2m.js',
            configBuilder: (baseConfig, sceneKey, viewKey) => ({
                ...baseConfig,
                appType: 'studyPlanner',
                sceneKey: sceneKey,
                viewKey: viewKey,
                elementSelector: '.kn-rich-text',
                // Needs its own appUrl if different from baseConfig or other apps
                appUrl: 'https://studyplanner2-fc98f9e231f4.herokuapp.com/' // Example, adjust if needed
            }),
            configGlobalVar: 'STUDYPLANNER_CONFIG', // Global var for this app's config
            initializerFunctionName: 'initializeStudyPlannerApp' // Function to call in child script
        },
        'taskboards': {
             scenes: ['scene_1188'], // *** REPLACE ***
             views: ['view_3009'],   // *** REPLACE ***
             scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/integrations/taskboard1c.js', // *** REPLACE ***
             configBuilder: (baseConfig, sceneKey, viewKey) => ({
                 ...baseConfig,
                 appType: 'taskboards',
                 sceneKey: sceneKey,
                 viewKey: viewKey,
                 elementSelector: '.kn-rich-text',
                 appUrl: 'https://vespataskboards-00affb61eb55.herokuapp.com/' // *** REPLACE ***
             }),
             configGlobalVar: 'TASKBOARD_CONFIG', // Global var for this app's config
             initializerFunctionName: 'initializeTaskboardApp' // *** REPLACE with actual function name ***
        },
        'homepage': {
             scenes: ['scene_1210'], 
             views: ['view_3013'],
             scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/integrations/landingPage/Homepage2h.js', // Will need to be uploaded to GitHub
             configBuilder: (baseConfig, sceneKey, viewKey) => ({
                 ...baseConfig,
                 appType: 'homepage',
                 sceneKey: sceneKey,
                 viewKey: viewKey,
                 elementSelector: '#view_3013', // Changed from .kn-rich-text to #view_3013 based on debugging
             }),
             configGlobalVar: 'HOMEPAGE_CONFIG', // Global var for this app's config
             initializerFunctionName: 'initializeHomepage'
        },
        'uploadSystem': {
        scenes: ['scene_1212'],
        views: ['view_3020'],
        scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/vespa-upload-bridge@main/src/index2o.js',
        configBuilder: (baseConfig, sceneKey, viewKey) => ({
            ...baseConfig,
            appType: 'uploadSystem',
            sceneKey: sceneKey,
            viewKey: viewKey,
            elementSelector: '#view_3020 .kn-rich_text__content',
            apiUrl: 'https://vespa-upload-api-07e11c285370.herokuapp.com',
            userRole: Knack.getUserRoles()[0] || 'Staff Admin', // Uses first role or defaults to Staff Admin
        }),
        configGlobalVar: 'VESPA_UPLOAD_CONFIG',
        initializerFunctionName: 'initializeUploadBridge'
    },
   'staffHomepage': {
    scenes: ['scene_1215'],
    views: ['view_3024'],
    scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/integrations/landingPage/staffHomepage4d.js',
    configBuilder: (baseConfig, sceneKey, viewKey) => ({
        ...baseConfig,
        appType: 'staffHomepage',
        sceneKey: sceneKey,
        viewKey: viewKey,
        elementSelector: '#view_3024',
        // Add SendGrid configuration here:
        sendGrid: {
            proxyUrl: 'https://vespa-sendgrid-proxy-660b8a5a8d51.herokuapp.com/api/send-email',
            fromEmail: 'noreply@notifications.vespa.academy',
            fromName: 'VESPA Academy',
            templateId: 'd-6a6ac61c9bab43e28706dbb3da4acdcf', // Replace with your actual SendGrid template ID
            confirmationtemplateId: 'd-2e21f98579f947b08f2520c567b43c35',
        }
    }),
    configGlobalVar: 'STAFFHOMEPAGE_CONFIG',
    initializerFunctionName: 'initializeStaffHomepage'
}
    };

    // --- Shared Configuration --- (Optional: Can be merged by configBuilder if needed)
    const sharedConfig = {
        knackAppId: '5ee90912c38ae7001510c1a9',
        knackApiKey: '8f733aa5-dd35-4464-8348-64824d1f5f0d',
        // Add SendGrid configuration
    sendGrid: {
        apiKey: "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", // Direct API key
        fromEmail: 'noreply@notifications.vespa.academy',
        fromName: 'VESPA Academy'
    }
    };

    // --- State ---
    let loadedAppKey = null;
    let lastRenderedSceneKey = null; // Store the latest scene key
    let lastRenderedViewKey = null;  // Store the latest view key

    // --- Helper Functions ---
     function log(message, data) {
        if (DEBUG_MODE) {
            let logData = data;
            // Avoid circular structure issues in logging complex objects
            if (typeof data === 'object' && data !== null) {
                try { logData = JSON.parse(JSON.stringify(data)); } catch (e) { logData = "[Data non-serializable for logging]"; }
            }
            console.log(`[Knack Builder Loader v${VERSION}] ${message}`, logData !== undefined ? logData : "");
        }
    }

    function errorLog(message, error) {
        console.error(`[Knack Builder Loader v${VERSION}] ${message}`, error !== undefined ? error : "");
    }

    // Adjusted loadScript: Resolves AFTER success, easier chaining
    function loadScript(url) {
        return new Promise((resolve, reject) => {
             if (typeof $ === 'undefined' || typeof $.getScript === 'undefined') {
                 const errorMsg = "jQuery ($) or $.getScript is not defined.";
                 errorLog(errorMsg, url);
                 return reject(new Error(errorMsg));
             }
             log("Attempting to load script via jQuery:", url);
             $.getScript(url)
                 .done(() => {
                     log("Script loaded successfully via getScript:", url);
                     resolve(); // Resolve *after* script execution succeeded
                 })
                 .fail((jqxhr, settings, exception) => {
                     errorLog("Failed to load script via jQuery:", { url, status: jqxhr?.status, exception });
                     reject(new Error(`Failed to load script: ${url} - ${exception || 'Unknown reason'}`));
                 });
         });
    }

    // Finds app based on explicit scene/view keys
    function findAppToLoad(sceneKey, viewKey) {
         // Added debug message to track the modified function is being used
         console.log("[DEBUG] Using modified findAppToLoad function with special case for reportProfiles");
        
         if (!sceneKey || !viewKey || typeof sceneKey !== 'string' || typeof viewKey !== 'string') {
            // log(`App search skipped: Invalid keys. Scene: ${sceneKey}, View: ${viewKey}`); // Reduce noise
            return null;
         }
         
         // Special case for reportProfiles - check if both views exist in DOM
         if (sceneKey === 'scene_1095') {
             // First check for the core views we need
             const reportContainer = document.querySelector('#view_2776 .kn-rich_text__content');
             const profileContainer = document.querySelector('#view_3015 .kn-rich_text__content');
             
             if (reportContainer && profileContainer) {
                 log('Special case match for reportProfiles: both required views found');
                 return 'reportProfiles';
             }
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
            return; // No app matches
        }

        if (appKey === loadedAppKey) {
            return; // Already loaded/loading
        }

        log(`Conditions met for app: ${appKey}. Preparing load.`);
        loadedAppKey = appKey; // Mark as loading/loaded

        const appConfigDef = APPS[appKey]; // Get the app definition
        if (!appConfigDef || !appConfigDef.scriptUrl || !appConfigDef.configBuilder || !appConfigDef.configGlobalVar || !appConfigDef.initializerFunctionName) {
            errorLog(`Configuration error for app (missing required properties): ${appKey}`, appConfigDef);
            loadedAppKey = null; return;
        }

        try {
            // 1. Build the specific config for this instance
            const instanceConfig = appConfigDef.configBuilder(sharedConfig, lastRenderedSceneKey, lastRenderedViewKey);
            log(`Built instance config for ${appKey}`, instanceConfig);

            // 2. Load the script
            await loadScript(appConfigDef.scriptUrl);
            log(`Script loaded for app '${appKey}'.`);

            // 3. Set the global config variable *after* script load
            window[appConfigDef.configGlobalVar] = instanceConfig;
            log(`Set global config variable '${appConfigDef.configGlobalVar}' for ${appKey}`);

            // 4. Call the initializer function *after* script load and config set
            if (typeof window[appConfigDef.initializerFunctionName] === 'function') {
                log(`Calling initializer function: ${appConfigDef.initializerFunctionName}`); // <<< EXPECT THIS LOG NOW
                try {
                     window[appConfigDef.initializerFunctionName](); // <<< THE CALL
                } catch (initError) {
                    errorLog(`Error calling initializer function ${appConfigDef.initializerFunctionName}:`, initError);
                    loadedAppKey = null; // Allow retry if init fails
                    window[appConfigDef.configGlobalVar] = undefined; // Clean up config
                    return; // Stop further processing for this attempt
                }
                log(`Initializer function ${appConfigDef.initializerFunctionName} called successfully for ${appKey}.`);
            } else {
                errorLog(`Initializer function '${appConfigDef.initializerFunctionName}' not found after loading script for app '${appKey}'.`);
                loadedAppKey = null; // Allow retry maybe?
                window[appConfigDef.configGlobalVar] = undefined; // Clean up config
            }

        } catch (error) {
            errorLog(`Failed during load/init process for app ${appKey}:`, error);
            loadedAppKey = null; // Reset state to allow retry on next event
            // Ensure cleanup even on loadScript failure
            if (appConfigDef && appConfigDef.configGlobalVar) {
                 window[appConfigDef.configGlobalVar] = undefined;
            }
        }
    }

    // --- Main Execution (jQuery Document Ready) ---
    $(function() {
        // ... (DOM ready and event listener attachment remains the same) ...
         log("DOM ready. Attaching Knack event listeners.");

        if (typeof $ === 'undefined' || typeof $.ajax === 'undefined') {
             errorLog("Critical Error: jQuery ($) is not available at DOM ready.");
             return;
        }
        log("jQuery confirmed available.");

        // Listener 1: Store scene key and then check if conditions are met
        $(document).on('knack-scene-render.any', function(event, scene) {
            if (scene && scene.key) {
                // If the scene is changing, reset loadedAppKey to force reinitialization
                if (lastRenderedSceneKey && lastRenderedSceneKey !== scene.key) {
                    log(`Scene changed from ${lastRenderedSceneKey} to ${scene.key}. Resetting loaded app.`);
                    loadedAppKey = null;
                }
                
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