 // === Knack Multi-App Loader Script ===
    // Version: 2.2-ALL (External Loader - Event Driven Only)

    (function() {
        if (window.KNACK_MULTI_APP_LOADER_INITIALIZED) { /* ... */ return; }
        window.KNACK_MULTI_APP_LOADER_INITIALIZED = true;
        console.log("[Knack External Loader] Initializing...");

        // --- Configuration (Read from Knack Builder) ---
        if (typeof KNACK_SHARED_CONFIG === 'undefined' /* ... */) { /* ... */ } else { /* ... */ }
        window.VESPA_APPS = window.VESPA_APPS || {};

        // --- App Mappings & Script URLs ---
        // *** Ensure Scene/View IDs are correct for ALL apps ***
        const APP_DEFINITIONS = {
            'flashcards': {
                mapping: { 'scene_1206': 'view_3005' }, // Your Flashcards IDs
                scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/Flashcards1b.js', // Corrected Flashcards Script
                configBuilder: function(sharedConfig, sceneId, viewId) { /* ... */ }
            },
            'studyplanner': {
                mapping: { 'scene_1208': 'view_3008' }, // Your Study Planner IDs
                scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/sp2Javascript1c.js', // Corrected Study Planner Script
                configBuilder: function(sharedConfig, sceneId, viewId) { /* ... */ }
            },
            'taskboards': {
                mapping: { 'scene_1118': 'view_3006' }, // Your Taskboards IDs
                scriptUrl: 'https://cdn.jsdelivr.net/gh/4Sighteducation/FlashcardLoader@main/vespataskboardsjs1d.js', // Corrected Taskboards Script
                configBuilder: function(sharedConfig, sceneId, viewId) { /* ... */ }
            }
        };
        // (Keep the full configBuilder functions as they were in v2.1-ALL)


        // --- Core Logic (determineActiveApp, loadApp remain the same) ---
        function determineActiveApp() { /* ... same as before ... */ }
        function loadApp(activeAppInfo) { /* ... same as before ... */ }

        // --- Initialization Trigger (Event Driven ONLY) ---
        let appLoadedForView = {};
        function initializeActiveApp(view) {
            // Add extra guard for Knack context readiness INSIDE the handler
            if (typeof Knack === 'undefined' || !Knack.scene_hash || !Knack.view_hash || !view || !view.key) {
                console.warn("[Knack External Loader] Knack context/view info not ready inside event handler for view:", view ? view.key : 'N/A');
                return;
            }
            const viewKey = `${Knack.scene_hash}-${view.key}`;
            const activeAppInfo = determineActiveApp(); // determineActiveApp already checks Knack context

            if (activeAppInfo && !appLoadedForView[viewKey]) {
                const appName = activeAppInfo.name;
                console.log(`[Knack External Loader] Trigger: View ${view.key} rendered. Active app determined: ${appName}. Loading...`);
                appLoadedForView[viewKey] = true;
                loadApp(activeAppInfo)
                    .then(() => { console.log(`[Knack External Loader] Success: Script loading process initiated for ${appName} on view ${view.key}.`); })
                    .catch(error => {
                        console.error(`[Knack External Loader] Error initiating script load for ${appName} on view ${view.key}:`, error);
                        appLoadedForView[viewKey] = false;
                    });
            }
        }

        // --- Knack Event Listeners ---
        // Function to attach listeners once jQuery is ready
        function attachKnackListeners() {
            if (typeof $ === 'undefined') {
                 console.warn("[Knack External Loader] jQuery ($) not ready yet. Retrying listener attachment...");
                 setTimeout(attachKnackListeners, 100); // Retry after 100ms
                 return;
            }

            if (!window.KNACK_MULTI_APP_LISTENERS_ATTACHED) {
                console.log("[Knack External Loader] Attaching Knack event listeners...");
                $(document).on('knack-view-render.any', function(event, view) {
                     // Log immediate event detection with original view key if available
                     const originalViewKey = view ? view.key : 'N/A';
                     console.log(`[Knack External Loader] Event: knack-view-render.any detected for view: ${originalViewKey}`);

                     // Increase delay
                     setTimeout(() => {
                         // Re-check Knack context and try to find the view again INSIDE the timeout
                         if (window.Knack && Knack.views && Knack.views.models && view && view.key) {
                             const currentView = Knack.views.models.find(v => v.key === view.key);
                             if (currentView) {
                                 console.log(`[Knack External Loader] View ${currentView.key} context re-checked after 100ms delay.`);
                                 initializeActiveApp(currentView.key, 'view');
                             } else {
                                 console.warn(`[Knack External Loader] View ${view.key} object not found in Knack.views.models after 100ms delay.`);
                             }
                         } else {
                             console.warn("[Knack External Loader] Knack context or view key missing after 100ms delay in view-render event.");
                         }
                     }, 100); // Increased delay to 100ms
                });
                $(document).on('knack-scene-render.any', function(event, scene) {
                    const originalSceneKey = scene ? scene.key : 'N/A';
                    if (!originalSceneKey || originalSceneKey === 'N/A') {
                         console.warn("[Knack External Loader] Scene event fired without scene object or key.");
                         return;
                     }
                     console.log(`[Knack External Loader] Event: knack-scene-render.any detected for scene: ${originalSceneKey}`);

                     // Increase delay
                     setTimeout(() => {
                         // Re-check Knack context INSIDE the timeout
                         if (window.Knack && Knack.scenes && Knack.scenes.current) {
                            const currentSceneKey = Knack.scenes.current.key;
                             // Verify if the detected scene matches the current scene after delay
                             if (currentSceneKey === originalSceneKey) {
                                 console.log(`[Knack External Loader] Scene ${currentSceneKey} context re-checked after 100ms delay.`);
                                 appLoadedForView = {}; // Reset flags on scene change
                                 initializeActiveApp(currentSceneKey, 'scene');
                             } else {
                                 console.warn(`[Knack External Loader] Scene mismatch after 100ms delay. Original: ${originalSceneKey}, Current: ${currentSceneKey}`);
                             }
                         } else {
                            console.warn("[Knack External Loader] Knack scene context not ready after 100ms delay in scene-render event.");
                         }
                     }, 100); // Increased delay to 100ms
                });
                window.KNACK_MULTI_APP_LISTENERS_ATTACHED = true;
                 console.log("[Knack External Loader] Attempting initial check after attaching listeners...");
                 // Increase initial check delay significantly
                 setTimeout(checkInitialLoad, 250);
            } else {
                 console.log("[Knack External Loader] Knack event listeners already attached.");
            }
        }

        // --- Updated Initial Check Logic ---
        function checkInitialLoad() {
            console.log('[Knack External Loader] Running checkInitialLoad (after 250ms delay)...');
            // Ensure Knack context and necessary structures are loaded
            if (window.Knack && Knack.views && Knack.views.models && Knack.scenes && Knack.scenes.current) {
                 const currentSceneKey = Knack.scenes.current.key;
                 console.log(`[Knack External Loader] Initial check starting for scene: ${currentSceneKey}`);

                 // Try initializing based on the current scene first
                 initializeActiveApp(currentSceneKey, 'scene');

                 // Additionally, check rendered views within the current scene
                 Knack.views.models.forEach(view => {
                     // Check if the view element exists in the DOM and belongs to the current scene
                     if (view && view.key && view.scene && view.scene.key === currentSceneKey && $(`#${view.key}`).length > 0) {
                         console.log(`[Knack External Loader] Initial check found rendered view in current scene: ${view.key}`);
                         initializeActiveApp(view.key, 'view');
                     }
                 });
            } else {
                // Log missing parts if context isn't ready
                let missing = [];
                if (!window.Knack) missing.push("window.Knack");
                else {
                    if (!Knack.views) missing.push("Knack.views");
                    if (!Knack.views.models) missing.push("Knack.views.models");
                    if (!Knack.scenes) missing.push("Knack.scenes");
                    if (!Knack.scenes.current) missing.push("Knack.scenes.current");
                }
                console.log(`[Knack External Loader] Initial check: Knack context not ready yet. Missing: ${missing.join(', ')}`);
            }
        }

        // Start the process of attaching listeners
        attachKnackListeners();


        // --- Utilities ---
        function debugLog(title, data) {
            if (KNACK_SHARED_CONFIG.debugMode) {
                console.log(`%c[Knack Debug: ${title}]`, 'color: #e0771a; font-weight: bold;', data);
            }
        }

        // --- REMOVED Manual Trigger Function ---
        // --- REMOVED setTimeout Initial Check ---

    })();