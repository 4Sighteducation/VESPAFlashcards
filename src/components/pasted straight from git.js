// knack-integration.js - Safe for public GitHub repository
// Version: Flashcards Loader Compatible (v3.16+)
(function () {
    // --- Configuration and Constants ---
    // REMOVED: Global definitions of FLASHCARD_APP_URL, APP_CONTAINER_SELECTOR.
    // These will be defined inside initializeFlashcardApp using window.VESPA_CONFIG.
    // Safe to define these here as they don't depend on VESPA_CONFIG yet.
    const KNACK_API_URL = 'https://api.knack.com/v1';
    const FLASHCARD_OBJECT = 'object_102'; // Your flashcard object
    const FIELD_MAPPING = {
        userId: 'field_2954',
        userEmail: 'field_2958',
        accountConnection: 'field_2956',
        vespaCustomer: 'field_3008',
        tutorConnection: 'field_3009',
        cardBankData: 'field_2979',
        lastSaved: 'field_2957',
        box1Data: 'field_2986',
        box2Data: 'field_2987',
        box3Data: 'field_2988',
        box4Data: 'field_2989',
        box5Data: 'field_2990',
        colorMapping: 'field_3000',
        topicLists: 'field_3011',
        topicMetadata: 'field_3030',
        userName: 'field_3010',
        tutorGroup: 'field_565',
        yearGroup: 'field_548',
        userRole: 'field_73'
    };

    // --- Helper Functions (Unchanged) ---
    function safeDecodeURIComponent(str) { /* ... */ }
    function safeEncodeURIComponent(str) { /* ... */ }
    function safeParseJSON(jsonString, defaultVal = null) { /* ... */ }
    function isValidKnackId(id) { /* ... */ }
    function cleanHtmlFromId(idString) { /* ... */ }
    function extractValidRecordId(value) { /* ... */ }
    function sanitizeField(value) { /* ... */ }
    function debugLog(title, data) { /* ... */ }
    function retryApiCall(apiCall, maxRetries = 3, delay = 1000) { /* ... */ }
    function refreshAuthentication() { /* ... */ }
    function handleTokenRefresh(iframeWindow) { /* ... */ }

    // --- Save Queue Class ---
    class SaveQueue {
        constructor() {
            this.queue = [];
            this.isSaving = false;
            this.retryAttempts = new Map();
            this.maxRetries = 3;
            this.retryDelay = 1000;
        }
        // ... (addToQueue, processQueue, prepareSaveData methods - unchanged) ...
         addToQueue(operation) {
           return new Promise((resolve, reject) => {
              if (!operation.type || !operation.recordId) {
                 console.error("[SaveQueue] Invalid operation added:", operation);
                 return reject(new Error("Invalid save operation: missing type or recordId"));
              }
             const queuedOperation = { ...operation, resolve, reject, timestamp: new Date().toISOString() };
             this.queue.push(queuedOperation);
             console.log(`[SaveQueue] Added operation to queue: ${operation.type} for record ${operation.recordId}. Queue length: ${this.queue.length}`);
             this.processQueue();
           });
         }
         async processQueue() {
           if (this.isSaving || this.queue.length === 0) { return; }
           this.isSaving = true; const operation = this.queue[0];
           console.log(`[SaveQueue] Processing operation: ${operation.type} for record ${operation.recordId}`);
           try {
             const updateData = await this.prepareSaveData(operation); debugLog("[SaveQueue] Prepared update data", updateData);
             const response = await this.performSave(updateData, operation.recordId); debugLog("[SaveQueue] API Save successful", response);
             this.handleSaveSuccess(operation);
           } catch (error) { console.error(`[SaveQueue] Error during processing for ${operation.type} (record ${operation.recordId}):`, error); this.handleSaveError(operation, error);
           } finally { if (this.queue.length === 0 || !this.isSaving) { this.isSaving = false; } }
         }
         async prepareSaveData(operation) {
            const { type, data, recordId, preserveFields } = operation; console.log(`[SaveQueue] Preparing save data for type: ${type}, record: ${recordId}, preserveFields: ${preserveFields}`);
            const updateData = { [FIELD_MAPPING.lastSaved]: new Date().toISOString() };
            try {
                let existingData = null;
                if (preserveFields) {
                    console.log(`[SaveQueue] Preserving fields for ${type}, fetching existing data...`);
                    try { existingData = await this.getExistingData(recordId); debugLog("[SaveQueue] Fetched existing data for preservation", existingData ? `Record ${recordId} found` : `Record ${recordId} NOT found`);
                    } catch (fetchError) { console.error(`[SaveQueue] Failed to fetch existing data for field preservation (record ${recordId}):`, fetchError); console.warn("[SaveQueue] Proceeding with save WITHOUT field preservation due to fetch error."); existingData = null; }
                }
                switch (type) {
                    case 'cards': updateData[FIELD_MAPPING.cardBankData] = JSON.stringify( this.ensureSerializable(data || []) ); console.log("[SaveQueue] Prepared cardBankData for 'cards' save."); break;
                    case 'colors': updateData[FIELD_MAPPING.colorMapping] = JSON.stringify( this.ensureSerializable(data || {}) ); console.log("[SaveQueue] Prepared colorMapping for 'colors' save."); break;
                    case 'topics': updateData[FIELD_MAPPING.topicLists] = JSON.stringify( this.ensureSerializable(data || []) ); console.log("[SaveQueue] Prepared topicLists for 'topics' save."); break;
                    case 'full': console.log("[SaveQueue] Preparing 'full' save data."); Object.assign(updateData, this.prepareFullSaveData(data || {})); break;
                    default: console.error(`[SaveQueue] Unknown save operation type: ${type}`); throw new Error(`Unknown save operation type: ${type}`);
                }
                if (preserveFields && existingData) { console.log(`[SaveQueue] Merging prepared data with existing data for record ${recordId}`); this.preserveExistingFields(updateData, existingData); debugLog("[SaveQueue] Merged data after preservation", updateData);
                } else if (preserveFields && !existingData) { console.warn(`[SaveQueue] Cannot preserve fields for record ${recordId} because existing data could not be fetched.`); }
                return updateData;
            } catch (error) { console.error(`[SaveQueue] Error in prepareSaveData for type ${type}:`, error); throw error; }
         }
         // ... (getExistingData, preserveExistingFields, prepareFullSaveData - unchanged) ...
          async getExistingData(recordId) {
            console.log(`[SaveQueue] Fetching existing data for record ${recordId}`);
            const apiCall = () => new Promise((resolve, reject) => { $.ajax({ url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`, type: 'GET', headers: this.getKnackHeaders(), data: { format: 'raw' }, success: response => { console.log(`[SaveQueue] Successfully fetched existing data for record ${recordId}`); resolve(response); }, error: (jqXHR, textStatus, errorThrown) => { console.error(`[SaveQueue] Error fetching existing data for record ${recordId}: Status ${jqXHR.status} - ${errorThrown}`, jqXHR.responseText); const error = new Error(`Failed to fetch record ${recordId}: ${jqXHR.status} ${errorThrown}`); error.status = jqXHR.status; error.responseText = jqXHR.responseText; reject(error); } }); });
            return retryApiCall(apiCall);
          }
          preserveExistingFields(updateData, existingData) {
             console.log(`[SaveQueue] Preserving fields for record. Fields in updateData: ${Object.keys(updateData).join(', ')}`);
            const allAppFieldIds = [ FIELD_MAPPING.cardBankData, FIELD_MAPPING.colorMapping, FIELD_MAPPING.topicLists, FIELD_MAPPING.topicMetadata, FIELD_MAPPING.box1Data, FIELD_MAPPING.box2Data, FIELD_MAPPING.box3Data, FIELD_MAPPING.box4Data, FIELD_MAPPING.box5Data ];
            allAppFieldIds.forEach(fieldId => { if (updateData[fieldId] === undefined && existingData[fieldId] !== undefined && existingData[fieldId] !== null) { console.log(`[SaveQueue] Preserving existing data for field ID: ${fieldId}`); updateData[fieldId] = existingData[fieldId]; } });
          }
          prepareFullSaveData(data) {
              const updatePayload = {}; console.log("[SaveQueue] Preparing full save data from data object:", Object.keys(data));
              if (data.cards !== undefined) { console.log("[SaveQueue] Processing 'cards' for full save"); let cardsToSave = data.cards || []; cardsToSave = migrateTypeToQuestionType(cardsToSave); cardsToSave = standardizeCards(cardsToSave); updatePayload[FIELD_MAPPING.cardBankData] = JSON.stringify(this.ensureSerializable(cardsToSave)); console.log(`[SaveQueue] Included ${cardsToSave.length} cards in full save payload.`); } else { console.log("[SaveQueue] 'cards' field missing in full save data object."); }
              if (data.colorMapping !== undefined) { console.log("[SaveQueue] Processing 'colorMapping' for full save"); updatePayload[FIELD_MAPPING.colorMapping] = JSON.stringify(this.ensureSerializable(data.colorMapping || {})); }
              if (data.topicLists !== undefined) { console.log("[SaveQueue] Processing 'topicLists' for full save"); updatePayload[FIELD_MAPPING.topicLists] = JSON.stringify(this.ensureSerializable(data.topicLists || [])); }
              if (data.spacedRepetition !== undefined) { console.log("[SaveQueue] Processing 'spacedRepetition' for full save"); const { box1, box2, box3, box4, box5 } = data.spacedRepetition || {}; if (box1 !== undefined) updatePayload[FIELD_MAPPING.box1Data] = JSON.stringify(this.ensureSerializable(box1 || [])); if (box2 !== undefined) updatePayload[FIELD_MAPPING.box2Data] = JSON.stringify(this.ensureSerializable(box2 || [])); if (box3 !== undefined) updatePayload[FIELD_MAPPING.box3Data] = JSON.stringify(this.ensureSerializable(box3 || [])); if (box4 !== undefined) updatePayload[FIELD_MAPPING.box4Data] = JSON.stringify(this.ensureSerializable(box4 || [])); if (box5 !== undefined) updatePayload[FIELD_MAPPING.box5Data] = JSON.stringify(this.ensureSerializable(box5 || [])); }
              if (data.topicMetadata !== undefined) { console.log("[SaveQueue] Processing 'topicMetadata' for full save"); updatePayload[FIELD_MAPPING.topicMetadata] = JSON.stringify(this.ensureSerializable(data.topicMetadata || [])); }
              return updatePayload;
          }

        // Modified getKnackHeaders
        getKnackHeaders() {
            if (typeof Knack === 'undefined' || typeof Knack.getUserToken !== 'function') {
                console.error("[SaveQueue] Knack object or getUserToken function not available.");
                throw new Error("Knack authentication context not available.");
            }
            const token = Knack.getUserToken();
            if (!token) {
                console.warn("[SaveQueue] Knack user token is null or undefined. API calls may fail.");
            }
            // Safely access config properties AFTER initialization should have set them
            const currentConfig = window.VESPA_CONFIG;
            const currentKnackAppId = currentConfig?.knackAppId;
            const currentKnackApiKey = currentConfig?.knackApiKey;

            if (!currentKnackAppId || !currentKnackApiKey) {
                console.error("[SaveQueue] Knack App ID or API Key is missing from VESPA_CONFIG.", currentConfig);
                // Fallback or throw error depending on whether save can ever happen before init
                // For now, let's throw, as saving without config seems wrong.
                throw new Error("Knack API configuration missing in window.VESPA_CONFIG.");
            }
            return {
                'X-Knack-Application-Id': currentKnackAppId,
                'X-Knack-REST-API-Key': currentKnackApiKey,
                'Authorization': token || '', // Send empty string if token is null
                'Content-Type': 'application/json'
            };
        }
        // ... (performSave, handleSaveSuccess, handleSaveError, ensureSerializable - unchanged) ...
         async performSave(updateData, recordId) {
            console.log(`[SaveQueue] Performing API save for record ${recordId}`); if (!recordId) { throw new Error("Cannot perform save: recordId is missing."); }
            if (Object.keys(updateData).length <= 1 && updateData[FIELD_MAPPING.lastSaved]) { console.warn(`[SaveQueue] Save payload for record ${recordId} only contains lastSaved timestamp. Skipping API call.`); return { message: "Save skipped, only timestamp update." }; }
            const apiCall = () => new Promise((resolve, reject) => { $.ajax({ url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`, type: 'PUT', headers: this.getKnackHeaders(), data: JSON.stringify(updateData), success: response => { console.log(`[SaveQueue] API PUT successful for record ${recordId}`); resolve(response); }, error: (jqXHR, textStatus, errorThrown) => { console.error(`[SaveQueue] API PUT failed for record ${recordId}: Status ${jqXHR.status} - ${errorThrown}`, jqXHR.responseText); const error = new Error(`API Save failed for record ${recordId}: ${jqXHR.status} ${errorThrown}`); error.status = jqXHR.status; error.responseText = jqXHR.responseText; reject(error); } }); });
            return retryApiCall(apiCall);
         }
         handleSaveSuccess(operation) {
            const completedOperation = this.queue.shift(); if (completedOperation !== operation) { console.error("[SaveQueue] Mismatch between completed operation and head of queue!", operation, completedOperation); const opIndex = this.queue.findIndex(op => op === operation); if(opIndex > -1) this.queue.splice(opIndex, 1); }
            this.retryAttempts.delete(operation); console.log(`[SaveQueue] Operation ${operation.type} succeeded for record ${operation.recordId}. Queue length: ${this.queue.length}`);
            operation.resolve(true); this.isSaving = false; this.processQueue();
         }
         handleSaveError(operation, error) {
            if (this.queue[0] !== operation) { console.warn(`[SaveQueue] Stale error encountered for operation ${operation.type} (record ${operation.recordId}). Operation no longer at head of queue. Ignoring error.`); if (!this.isSaving && this.queue.length > 0) { this.processQueue(); } return; }
            const attempts = (this.retryAttempts.get(operation) || 0) + 1; const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[SaveQueue] Save error for ${operation.type} (record ${operation.recordId}, Attempt ${attempts}/${this.maxRetries}):`, errorMessage, error);
            if (attempts < this.maxRetries) { this.retryAttempts.set(operation, attempts); const delay = this.retryDelay * Math.pow(2, attempts - 1); console.log(`[SaveQueue] Retrying operation ${operation.type} (record ${operation.recordId}) in ${delay}ms...`); this.isSaving = false; setTimeout(() => { console.log(`[SaveQueue] Attempting retry for ${operation.type} (record ${operation.recordId}) after delay.`); this.processQueue(); }, delay);
            } else { console.error(`[SaveQueue] Max retries reached for operation ${operation.type} (record ${operation.recordId}). Aborting.`); const failedOperation = this.queue.shift(); if (failedOperation !== operation) { console.error("[SaveQueue] Mismatch during failure handling!", operation, failedOperation); } this.retryAttempts.delete(operation); operation.reject(error || new Error(`Save failed after ${this.maxRetries} retries`)); this.isSaving = false; this.processQueue(); }
         }
         ensureSerializable(data) { try { JSON.stringify(data); return data; } catch (e) { console.warn('[SaveQueue] Data contains circular references or non-serializable values. Stripping them.', e); const cache = new Set(); try { return JSON.parse(JSON.stringify(data, (key, value) => { if (typeof value === 'object' && value !== null) { if (cache.has(value)) { return undefined; } cache.add(value); } return value; })); } catch (parseError) { console.error("[SaveQueue] Failed to serialize data even after attempting to strip circular references:", parseError); return data; } } }
    }
    const saveQueue = new SaveQueue();

    // --- Knack Integration Initialization ---
    window.initializeFlashcardApp = function() {
        console.log("Flashcard app: Initializing FlashcardApp function called...");

        // --- Get Configuration ---
        const config = window.VESPA_CONFIG;
        if (!config || !config.appUrl) {
            console.error("Flashcard app Error: Missing or incomplete VESPA_CONFIG when initializeFlashcardApp called.", config);
            return;
        }
        // --- Define constants using config ---
        const FLASHCARD_APP_URL = config.appUrl;
        const APP_CONTAINER_SELECTOR = config.elementSelector || '.kn-rich-text'; // Use config or default
        debugLog("Flashcard app: Using configuration from loader", config);

        // --- Check Knack Context & User Auth ---
        if (typeof Knack === 'undefined' || typeof $ === 'undefined' || !Knack.getUserToken || !Knack.getUserAttributes || typeof Knack.application_id === 'undefined') {
            console.error("Flashcard app Error: Required Knack context or jQuery not available.");
            return;
        }

        if (Knack.getUserToken()) {
            console.log("Flashcard app: User is authenticated");
            const userToken = Knack.getUserToken();
            const appId = Knack.application_id;
            const user = Knack.getUserAttributes();
            if (!user || typeof user !== 'object') {
                console.error("Flashcard app Error: Knack.getUserAttributes() did not return a valid user object.");
                return;
            }
            console.log("Flashcard app: Basic user info:", user);
            window.currentKnackUser = user;

            getCompleteUserData(user.id, function(completeUserData) {
                if (completeUserData) {
                    window.currentKnackUser = Object.assign({}, user, completeUserData);
                    debugLog("Enhanced global user object", window.currentKnackUser);
                } else {
                    console.warn("Flashcard app: Could not get complete user data, continuing with basic info");
                }
                // Pass necessary ids/tokens AND config-derived constants
                continueInitialization(userToken, appId, FLASHCARD_APP_URL, APP_CONTAINER_SELECTOR);
            });
        } else {
            console.error("Flashcard app: User is not authenticated (Knack.getUserToken() returned null/false).");
        }
    }; // <<< END OF initializeFlashcardApp FUNCTION DEFINITION

    // Modified continueInitialization to accept URL and Selector
    function continueInitialization(userToken, appId, FLASHCARD_APP_URL, APP_CONTAINER_SELECTOR) {
        const currentUser = window.currentKnackUser;
        const config = window.VESPA_CONFIG; // Config is guaranteed here

        // Add check for newly passed parameters
        if (!currentUser || !config || !userToken || !appId || !FLASHCARD_APP_URL || !APP_CONTAINER_SELECTOR) {
            console.error("Flashcard app Error: Missing required data in continueInitialization.", { currentUser, config, userToken, appId, FLASHCARD_APP_URL, APP_CONTAINER_SELECTOR });
            return;
        }

        currentUser.emailId = extractValidRecordId(currentUser.id);
        currentUser.schoolId = extractValidRecordId(currentUser.school || currentUser.field_122);
        currentUser.tutorId = extractValidRecordId(currentUser.tutor);
        currentUser.roleId = extractValidRecordId(currentUser.role);
        debugLog("FINAL CONNECTION FIELD IDs", { emailId: currentUser.emailId, schoolId: currentUser.schoolId, tutorId: currentUser.tutorId, roleId: currentUser.roleId });

        // --- Container setup (Uses APP_CONTAINER_SELECTOR) ---
        let container = document.querySelector(APP_CONTAINER_SELECTOR);
        const viewId = config.viewKey || 'view_3005'; // Use config keys if provided
        const sceneId = config.sceneKey || 'scene_1206';
        if (!container) container = document.querySelector('.kn-rich-text'); // Default fallback
        if (!container) {
            const viewElement = document.getElementById(viewId) || document.querySelector('.' + viewId);
            if (viewElement) { console.log(`Creating container inside ${viewId}`); container = document.createElement('div'); container.id = 'flashcard-app-container-generated'; viewElement.appendChild(container); }
        }
        if (!container) {
            const sceneElement = document.getElementById('kn-' + sceneId);
            if (sceneElement) { console.log(`Creating container inside ${sceneId}`); container = document.createElement('div'); container.id = 'flashcard-app-container-generated'; sceneElement.appendChild(container); }
            else { console.error("Flashcard app: Cannot find any suitable container for the app using selector or fallbacks."); return; }
        }
        container.innerHTML = '';

        // --- Loading Indicator ---
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'flashcard-loading-indicator';
        loadingDiv.innerHTML = '<p>Loading Flashcard App...</p>';
        loadingDiv.style.padding = '20px'; loadingDiv.style.textAlign = 'center';
        container.appendChild(loadingDiv);

        // --- Create iframe (Uses FLASHCARD_APP_URL) ---
        const iframe = document.createElement('iframe');
        iframe.id = 'flashcard-app-iframe';
        iframe.style.width = '100%'; iframe.style.minHeight = '800px'; iframe.style.border = 'none'; iframe.style.display = 'none';
        // Use the FLASHCARD_APP_URL parameter passed into this function
        iframe.src = FLASHCARD_APP_URL;
        container.appendChild(iframe);

        // --- Central Message Listener ---
        let appReadyReceived = false; // Prevent multiple APP_READY processing
        const messageHandler = function(event) {
            let expectedOrigin;
            try {
                expectedOrigin = new URL(FLASHCARD_APP_URL).origin;
            } catch (e) {
                console.error("Flashcard app Error: Invalid FLASHCARD_APP_URL provided:", FLASHCARD_APP_URL, e);
                return; // Cannot proceed without a valid origin
            }

            // Security: Check origin and source
            if (event.source !== iframe.contentWindow || event.origin !== expectedOrigin) {
                // console.warn("Ignoring message from unexpected source or origin:", event.origin);
                return;
            }
            if (!event.data || !event.data.type) {
                console.warn("[Knack Script] Ignoring message with invalid format:", event.data);
                return;
            }

            const { type, data } = event.data;
            const iframeWindow = iframe.contentWindow;

            if (type !== 'PING') { console.log(`[Knack Script] Received message type: ${type}`); }

            if (type === 'APP_READY') {
                if (appReadyReceived) { console.log("Flashcard app: Ignoring duplicate APP_READY message"); return; }
                appReadyReceived = true; // Mark as received
                console.log("Flashcard app: React app reported APP_READY.");
                const userForApp = window.currentKnackUser;
                if (!userForApp || !userForApp.id) { console.error("Cannot send initial info: Current Knack user data not ready or missing ID at APP_READY."); return; }

                loadingDiv.innerHTML = '<p>Loading User Data...</p>';

                loadFlashcardUserData(userForApp.id, function(userData) {
                    // Check iframe still exists before posting
                    if (iframe.contentWindow && iframeWindow && iframe.contentWindow === iframeWindow) {
                        const initialData = {
                            type: 'KNACK_USER_INFO', data: {
                                id: userForApp.id, email: userForApp.email, name: userForApp.name || '', token: userToken, appId: appId, userData: userData || {}, emailId: userForApp.emailId, schoolId: userForApp.schoolId, tutorId: userForApp.tutorId, roleId: userForApp.roleId
                            }
                        };
                        debugLog("--> Sending KNACK_USER_INFO to React App", initialData.data);
                        // Use specific origin for security
                        iframeWindow.postMessage(initialData, expectedOrigin);
                        loadingDiv.style.display = 'none'; iframe.style.display = 'block';
                        console.log("Flashcard app initialized and visible.");
                    } else { console.warn("[Knack Script] Iframe window no longer valid when sending initial data."); }
                });
            } else {
                // Pass origin to router for secure responses
                handleMessageRouter(type, data, iframeWindow, expectedOrigin);
            }
        };
        window.addEventListener('message', messageHandler);
        console.log("Flashcard app initialization sequence complete. Waiting for APP_READY from iframe.");
    }

    // Modified handleMessageRouter to accept and use origin
    function handleMessageRouter(type, data, iframeWindow, origin) {
        if (!type) { console.warn("[Knack Script] Received message without type."); return; }
        if (!iframeWindow) { console.error("[Knack Script] iframeWindow is missing in handleMessageRouter."); return; }
        if (!origin) { console.error("[Knack Script] Origin is missing in handleMessageRouter."); return; } // Added origin check

        console.log(`[Knack Script] Routing message type: ${type}`);
        switch (type) {
            case 'SAVE_DATA': handleSaveDataRequest(data, iframeWindow, origin); break;
            case 'ADD_TO_BANK': handleAddToBankRequest(data, iframeWindow, origin); break;
            case 'TOPIC_LISTS_UPDATED': handleTopicListsUpdatedRequest(data, iframeWindow, origin); break;
            case 'REQUEST_TOKEN_REFRESH': handleTokenRefresh(iframeWindow); break; // Origin check inside handleTokenRefresh? OK for now.
            case 'RELOAD_APP_DATA': handleReloadRequest(data, iframeWindow, origin); break;
            case 'REQUEST_UPDATED_DATA': handleDataUpdateRequest(data, iframeWindow, origin); break;
            case 'AUTH_CONFIRMED':
                console.log("[Knack Script] React App confirmed auth.");
                const li = document.getElementById('flashcard-loading-indicator'); if (li) li.style.display = 'none';
                const ai = document.getElementById('flashcard-app-iframe'); if (ai) ai.style.display = 'block';
                break;
            case 'REQUEST_RECORD_ID': handleRecordIdRequest(data, iframeWindow, origin); break;
            default: console.warn(`[Knack Script] Unhandled message type: ${type}`);
        }
    }

    // --- Specific Message Handlers (Modified to use origin) ---
    async function handleSaveDataRequest(data, iframeWindow, origin) {
        console.log("[Knack Script] Handling SAVE_DATA request");
        if (!data || !data.recordId) { console.error("[Knack Script] SAVE_DATA request missing recordId."); if (iframeWindow) iframeWindow.postMessage({ type: 'SAVE_RESULT', success: false, error: "Missing recordId" }, origin); return; }
        debugLog("[Knack Script] Data received for SAVE_DATA:", data);
        try {
            await saveQueue.addToQueue({ type: 'full', data: data, recordId: data.recordId, preserveFields: data.preserveFields || false });
            console.log(`[Knack Script] SAVE_DATA for record ${data.recordId} completed successfully.`);
            if (iframeWindow) iframeWindow.postMessage({ type: 'SAVE_RESULT', success: true, timestamp: new Date().toISOString() }, origin); // Use origin
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error); console.error(`[Knack Script] SAVE_DATA failed for record ${data.recordId}:`, errorMessage);
            if (iframeWindow) iframeWindow.postMessage({ type: 'SAVE_RESULT', success: false, error: errorMessage || 'Unknown save error' }, origin); // Use origin
        }
    }
    async function handleAddToBankRequest(data, iframeWindow, origin) {
       console.log("[Knack Script] Handling ADD_TO_BANK request");
       if (!data || !data.recordId || !data.cards) { console.error("[Knack Script] ADD_TO_BANK request missing recordId or cards."); if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: false, error: "Missing recordId or cards" }, origin); return; }
       debugLog("[Knack Script] Data received for ADD_TO_BANK:", data);
       try {
           console.log(`[Knack Script] Fetching existing data before ADD_TO_BANK for record ${data.recordId}`); const existingData = await saveQueue.getExistingData(data.recordId);
           const newCardsStandardized = standardizeCards(data.cards || []); const newCardCount = newCardsStandardized.length; if (newCardCount === 0) { console.log("[Knack Script] No valid new cards to add."); if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: true, shouldReload: false, message: "No new cards to add." }, origin); return; }
           let existingItems = []; if (existingData && existingData[FIELD_MAPPING.cardBankData]) { try { let bankDataStr = existingData[FIELD_MAPPING.cardBankData]; if (typeof bankDataStr === 'string' && bankDataStr.includes('%')) { bankDataStr = safeDecodeURIComponent(bankDataStr); } existingItems = safeParseJSON(bankDataStr, []); } catch (parseError) { console.error("[Knack Script] Error parsing existing card bank data for ADD_TO_BANK:", parseError); existingItems = []; } }
           const { topics: existingTopicShells, cards: existingCards } = splitByType(existingItems); const existingCardIds = new Set(existingCards.map(c => c.id)); const cardsToAdd = newCardsStandardized.filter(nc => !existingCardIds.has(nc.id)); const skippedCount = newCardCount - cardsToAdd.length; if (skippedCount > 0) { console.log(`[Knack Script] Skipped ${skippedCount} cards already present in the bank.`); } if (cardsToAdd.length === 0) { console.log("[Knack Script] All new cards were duplicates or invalid."); if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: true, shouldReload: false, message: "All submitted cards already exist." }, origin); return; }
           const finalBankData = [...existingTopicShells, ...existingCards, ...cardsToAdd]; console.log(`[Knack Script] Merged ${cardsToAdd.length} new cards with ${existingCards.length} existing cards and ${existingTopicShells.length} shells.`);
           let box1Data = []; if (existingData && existingData[FIELD_MAPPING.box1Data]) { try { let box1String = existingData[FIELD_MAPPING.box1Data]; if (typeof box1String === 'string' && box1String.includes('%')) { box1String = safeDecodeURIComponent(box1String); } box1Data = safeParseJSON(box1String, []); } catch(parseError) { console.error("[Knack Script] Error parsing Box 1 data:", parseError); box1Data = []; } }
           const now = new Date().toISOString(); const existingBox1Map = new Map(box1Data.map(entry => [entry.cardId, true])); const newBox1Entries = cardsToAdd .filter(card => card.id && !existingBox1Map.has(card.id)) .map(card => ({ cardId: card.id, lastReviewed: now, nextReviewDate: now })); const updatedBox1 = [...box1Data, ...newBox1Entries]; console.log(`[Knack Script] Added ${newBox1Entries.length} new entries to Box 1.`);
           const fullSaveData = { cards: finalBankData, spacedRepetition: { box1: updatedBox1 } }; await saveQueue.addToQueue({ type: 'full', data: fullSaveData, recordId: data.recordId, preserveFields: true });
           console.log(`[Knack Script] ADD_TO_BANK for record ${data.recordId} completed successfully.`);
           if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: true, shouldReload: true }, origin); // Use origin
       } catch (error) {
           const errorMessage = error instanceof Error ? error.message : String(error); console.error(`[Knack Script] ADD_TO_BANK failed for record ${data.recordId}:`, errorMessage, error);
           if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: false, error: errorMessage || 'Unknown add to bank error' }, origin); // Use origin
       }
    }
    async function handleTopicListsUpdatedRequest(data, iframeWindow, origin) {
       console.log("[Knack Script] Handling TOPIC_LISTS_UPDATED request");
       if (!data || !data.recordId || !data.topicLists) { console.error("[Knack Script] TOPIC_LISTS_UPDATED request missing recordId or topicLists."); if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_LISTS_UPDATE_RESULT', success: false, error: "Missing recordId or topicLists" }, origin); return; }
       debugLog("[Knack Script] Data received for TOPIC_LISTS_UPDATED:", data);
       try {
           console.log(`[Knack Script] Queuing save for topicLists field (${FIELD_MAPPING.topicLists}) for record ${data.recordId}`); await saveQueue.addToQueue({ type: 'topics', data: data.topicLists, recordId: data.recordId, preserveFields: true }); console.log(`[Knack Script] Successfully queued save for topicLists for record ${data.recordId}.`);
           console.log(`[Knack Script] Triggering topic shell creation/update based on updated lists for record ${data.recordId}.`); await createTopicShellsFromLists(data.topicLists, data.recordId, iframeWindow); console.log(`[Knack Script] TOPIC_LISTS_UPDATED for record ${data.recordId} processed.`);
           if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_LISTS_UPDATE_RESULT', success: true, timestamp: new Date().toISOString() }, origin); // Use origin
       } catch (error) {
           const errorMessage = error instanceof Error ? error.message : String(error); console.error(`[Knack Script] TOPIC_LISTS_UPDATED failed for record ${data.recordId}:`, errorMessage, error);
           if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_LISTS_UPDATE_RESULT', success: false, error: errorMessage || 'Unknown topic list update error' }, origin); // Use origin
       }
    }
    async function handleReloadRequest(data, iframeWindow, origin) {
       console.log("[Knack Script] Handling RELOAD_APP_DATA request"); const userId = window.currentKnackUser?.id; if (!userId) { console.error("[Knack Script] Cannot reload data - user ID not found."); if (iframeWindow) iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'User ID not found' }, origin); return; }
       loadFlashcardUserData(userId, function(userData) {
           if (userData && iframeWindow) { console.log("[Knack Script] Sending refreshed data to React app (on reload request)"); iframeWindow.postMessage({ type: 'KNACK_DATA', cards: userData.cards || [], colorMapping: userData.colorMapping || {}, topicLists: userData.topicLists || [], topicMetadata: userData.topicMetadata || [], spacedRepetition: userData.spacedRepetition || {}, recordId: userData.recordId, auth: { id: userId, email: window.currentKnackUser?.email, name: window.currentKnackUser?.name || '' }, timestamp: new Date().toISOString() }, origin); // Use origin
           } else if (iframeWindow) { console.error("[Knack Script] Error loading updated data for reload"); iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'Failed to load data for reload' }, origin); } // Use origin
       });
    }
    async function handleDataUpdateRequest(data, iframeWindow, origin) {
       console.log("[Knack Script] Handling REQUEST_UPDATED_DATA request"); const userId = window.currentKnackUser?.id; const recordId = data?.recordId; if (!userId) { console.error("[Knack Script] Cannot refresh data - user ID not found."); if (iframeWindow) iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'User ID not found' }, origin); return; } if (!recordId) { console.error("[Knack Script] Cannot refresh data - missing record ID in request"); if (iframeWindow) iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'Missing record ID in request' }, origin); return; }
       loadFlashcardUserData(userId, function(userData) {
           if (userData && iframeWindow) {
               if (userData.recordId === recordId) { console.log("[Knack Script] Sending refreshed data to React app (on request)"); iframeWindow.postMessage({ type: 'KNACK_DATA', cards: userData.cards || [], colorMapping: userData.colorMapping || {}, topicLists: userData.topicLists || [], topicMetadata: userData.topicMetadata || [], spacedRepetition: userData.spacedRepetition || {}, recordId: userData.recordId, auth: { id: userId, email: window.currentKnackUser?.email, name: window.currentKnackUser?.name || '' }, timestamp: new Date().toISOString() }, origin); // Use origin
               } else { console.warn(`[Knack Script] Loaded data record ID (${userData.recordId}) does not match requested record ID (${recordId}). Sending loaded data anyway.`); iframeWindow.postMessage({ type: 'KNACK_DATA', cards: userData.cards || [], colorMapping: userData.colorMapping || {}, topicLists: userData.topicLists || [], topicMetadata: userData.topicMetadata || [], spacedRepetition: userData.spacedRepetition || {}, recordId: userData.recordId, auth: { id: userId, email: window.currentKnackUser?.email, name: window.currentKnackUser?.name || '' }, timestamp: new Date().toISOString() }, origin); } // Use origin
           } else if (iframeWindow) { console.error("[Knack Script] Error loading updated data (on request)"); iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'Failed to load data' }, origin); } // Use origin
       });
    }
    async function handleRecordIdRequest(data, iframeWindow, origin) {
       console.log("[Knack Script] Handling REQUEST_RECORD_ID request"); const userId = window.currentKnackUser?.id; if (!userId) { console.error("[Knack Script] Cannot get record ID - user ID not found."); if (iframeWindow) iframeWindow.postMessage({ type: 'RECORD_ID_ERROR', error: 'User ID not found' }, origin); return; } // Use origin
       loadFlashcardUserData(userId, function(userData) {
           if (userData && userData.recordId && iframeWindow) { console.log(`[Knack Script] Found record ID: ${userData.recordId}`); iframeWindow.postMessage({ type: 'RECORD_ID_RESPONSE', recordId: userData.recordId, timestamp: new Date().toISOString() }, origin); // Use origin
           } else if (iframeWindow) { console.error(`[Knack Script] Could not find record ID for user ${userId}`); iframeWindow.postMessage({ type: 'RECORD_ID_ERROR', error: 'Record ID not found', timestamp: new Date().toISOString() }, origin); } // Use origin
       });
    }

    // --- Data Loading and Utility Functions (Unchanged) ---
    function getCompleteUserData(userId, callback) { /* ... */ }
    function loadFlashcardUserData(userId, callback) { /* ... */ }
    function createFlashcardUserRecord(userId, callback) { /* ... */ }
    function standardizeCards(cards) { /* ... */ }
    function isMultipleChoiceCard(card) { /* ... */ }
    function migrateTypeToQuestionType(data) { /* ... */ }
    function splitByType(items) { /* ... */ }
    function createTopicShellsFromLists(topicLists, recordId, iframeWindow) { /* ... */ }
    function generateNewShellsAndMetadata(topicLists, currentSubjectColors, currentTopicMetadata) { /* ... */ }
    function generateShadeVariations(baseColorHex, count) { /* ... */ }
    function mergeTopicShells(existingShells, newShells) { /* ... */ }

}()); // End of IIFE