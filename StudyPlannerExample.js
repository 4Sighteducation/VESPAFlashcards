 // StudyPlanner 2.0 - Knack Integration Script - v1.0
// This script must be added to Knack builder to enable communication between Knack and the embedded React app
(function() {
  // REMOVED: Initial config check - Loader will provide config before calling init.
  // if (!window.STUDYPLANNER_CONFIG) { ... }

  // --- Constants and Configuration ---
  // Use constants provided by the loader via window.STUDYPLANNER_CONFIG
  // These will be accessed inside initializeStudyPlannerApp when it's called.
  const KNACK_API_URL = 'https://api.knack.com/v1';
  const STUDYPLANNER_OBJECT = 'object_110'; // Study Plan object
  const TUTOR_SHARING_OBJECT = 'object_90'; // Tutor Sharing object for session sharing
  
  // Field mappings for the main study plan object
  const FIELD_MAPPING = {
    userId: 'field_3040', // User ID
    userEmail: 'field_3041', // User Email
    userName: 'field_3039', // User Name
    planData: 'field_3042', // JSON Data field
    lastSaved: 'field_3045', // Last saved timestamp (moved to field_3045)
    teacherConnection: 'field_3044', // User Account connection field 
    vespaCustomer: 'field_3043', // VESPA Customer (school)
    tutorConnection: 'field_3058', // Tutor connections
    staffAdminConnection: 'field_3059' // Staff Admin connection
  };
  
  // Field mappings for the tutor sharing object (object_90 - Study Sessions)
  const TUTOR_SHARING_FIELDS = {
    sessionName: 'field_2480',    // Session Name (short text set to - Planned from App-{date})
    studentName: 'field_3056',    // Student Name (short text)
    vespaCustomer: 'field_2473',  // VESPA Customer (Connected field - user account field_122)
    staffAdmin: 'field_2474',     // Staff Admin (Connected Field - student object_6/field_190)
    userConnection: 'field_2475', // Account (Connect Field - user email/account record)
    tutor: 'field_2476',          // Tutors (Multiple connected field - student object_6/field_1682)
    sessionStart: 'field_2477',   // Session Start (Date Time, dd/mm/yyyy HH:MM)
    sessionFinish: 'field_2478',  // Session Finish (Date Time, dd/mm/yyyy HH:MM) 
    sessionDetails: 'field_2479', // Session Details (Rich Text Field) 
    studentEmail: 'field_2469',   // Student Email (email field - backup) 
    deleteFlag: 'field_3055',     // Delete flag (boolean, default to No)
    sessionId: 'field_3057',      // Session ID (unique, short text)
  };

  // --- Helper Functions ---
  // Safe URI component decoding function
  function safeDecodeURIComponent(str) {
    if (!str) return str;
    if (typeof str === 'string' && !str.includes('%')) return str;
    try {
      return decodeURIComponent(str.replace(/\+/g, ' '));
    } catch (error) {
      console.error("StudyPlanner: Error decoding URI component:", error, "String:", String(str).substring(0, 100));
      try {
        const cleaned = String(str).replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
        return decodeURIComponent(cleaned.replace(/\+/g, ' '));
      } catch (secondError) {
        console.error("StudyPlanner: Second attempt to decode failed:", secondError);
        return String(str);
      }
    }
  }

  // Safely encode URI component
  function safeEncodeURIComponent(str) {
    try {
      return encodeURIComponent(String(str));
    } catch (e) {
      console.error("Error encoding URI component:", e, "Input:", str);
      return String(str);
    }
  }

  // Safe JSON parsing function
  function safeParseJSON(jsonString, defaultVal = null) {
    if (!jsonString) return defaultVal;
    try {
      // If it's already an object, return it directly
      if (typeof jsonString === 'object' && jsonString !== null) return jsonString;
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn("StudyPlanner: Initial JSON parse failed:", error, "String:", String(jsonString).substring(0, 100));
      try {
        const cleanedString = String(jsonString).trim().replace(/^\uFEFF/, '');
        const recovered = cleanedString
          .replace(/\\"/g, '"')
          .replace(/,\s*([}\]])/g, '$1');
        const result = JSON.parse(recovered);
        console.log("StudyPlanner: JSON recovery successful.");
        return result;
      } catch (secondError) {
        console.error("StudyPlanner: JSON recovery failed:", secondError);
        return defaultVal;
      }
    }
  }

  // Check if a string is a valid Knack record ID
  function isValidKnackId(id) {
    if (!id) return false;
    return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);
  }

  // Extract a valid record ID from various formats
  function extractValidRecordId(value) {
    if (!value) return null;

    // If it's already an object
    if (typeof value === 'object') {
      let idToCheck = null;
      if (value.id) {
        idToCheck = value.id;
      } else if (value.identifier) {
        idToCheck = value.identifier;
      } else if (Array.isArray(value) && value.length === 1 && value[0].id) {
        idToCheck = value[0].id;
      } else if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') {
        idToCheck = value[0];
      }

      if (idToCheck) {
        return isValidKnackId(idToCheck) ? idToCheck : null;
      }
    }

    // If it's a string
    if (typeof value === 'string') {
      return isValidKnackId(value) ? value : null;
    }

    return null;
  }

  // Safely remove HTML from strings
  function sanitizeField(value) {
    if (value === null || value === undefined) return "";
    const strValue = String(value);
    let sanitized = strValue.replace(/<[^>]*?>/g, "");
    sanitized = sanitized.replace(/[*_~`#]/g, "");
    sanitized = sanitized
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ");
    return sanitized.trim();
  }

  // Debug logging helper
  function debugLog(title, data) {
    console.log(`%c[StudyPlanner] ${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
    try {
      console.log(JSON.parse(JSON.stringify(data, null, 2)));
    } catch (e) {
      console.log("Data could not be fully serialized for logging:", data);
    }
    return data;
  }

  // Generic retry function for API calls
  function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
      const attempt = (retryCount) => {
        apiCall()
          .then(resolve)
          .catch((error) => {
            const attemptsMade = retryCount + 1;
            console.warn(`API call failed (Attempt ${attemptsMade}/${maxRetries}):`, error.status, error.statusText, error.responseText);

            if (retryCount < maxRetries - 1) {
              const retryDelay = delay * Math.pow(2, retryCount);
              console.log(`Retrying API call in ${retryDelay}ms...`);
              setTimeout(() => attempt(retryCount + 1), retryDelay);
            } else {
              console.error(`API call failed after ${maxRetries} attempts.`);
              reject(error);
            }
          });
      };
      attempt(0);
    });
  }

  // Function to refresh authentication
  function refreshAuthentication() {
    return new Promise((resolve, reject) => {
      try {
        const currentToken = Knack.getUserToken();
        if (currentToken) {
          console.log(`Auth token available via Knack.getUserToken()`);
          resolve(currentToken);
        } else {
          console.error(`Cannot get auth token - Knack.getUserToken() returned null`);
          reject(new Error("Auth token not available"));
        }
      } catch (error) {
        console.error(`Error getting auth token:`, error);
        reject(error);
      }
    });
  }

  // Handle token refresh request from React app
  function handleTokenRefresh(iframeWindow) {
    console.log("Handling token refresh request from React app");
    try {
      const currentToken = Knack.getUserToken();
      if (!currentToken) {
        console.error("Cannot get token from Knack");
        if (iframeWindow) iframeWindow.postMessage({ type: "AUTH_REFRESH_RESULT", success: false, error: "Token not available from Knack" }, "*");
        return;
      }
      // Send the current token back
      if (iframeWindow) iframeWindow.postMessage({ type: "AUTH_REFRESH_RESULT", success: true, token: currentToken }, "*");
      console.log("Successfully sent current token for refresh");
    } catch (error) {
      console.error("Error refreshing token:", error);
      if (iframeWindow) iframeWindow.postMessage({ type: "AUTH_REFRESH_RESULT", success: false, error: error.message || "Unknown error refreshing token" }, "*");
    }
  }

  // --- Save Queue Class ---
  class SaveQueue {
    constructor() {
      this.queue = [];
      this.isSaving = false;
      this.retryAttempts = new Map();
      this.maxRetries = 3;
      this.retryDelay = 1000;
    }

    // Adds an operation to the queue
    addToQueue(operation) {
      return new Promise((resolve, reject) => {
        if (!operation.type || !operation.recordId) {
          console.error("[SaveQueue] Invalid operation added:", operation);
          return reject(new Error("Invalid save operation: missing type or recordId"));
        }

        const queuedOperation = {
          ...operation,
          resolve,
          reject,
          timestamp: new Date().toISOString()
        };
        this.queue.push(queuedOperation);
        console.log(`[SaveQueue] Added operation to queue: ${operation.type} for record ${operation.recordId}. Queue length: ${this.queue.length}`);
        this.processQueue();
      });
    }

    // Processes the next operation in the queue if not already saving
    async processQueue() {
      if (this.isSaving || this.queue.length === 0) {
        return;
      }

      this.isSaving = true;
      const operation = this.queue[0];
      console.log(`[SaveQueue] Processing operation: ${operation.type} for record ${operation.recordId}`);

      try {
        const updateData = await this.prepareSaveData(operation);
        debugLog("[SaveQueue] Prepared update data", updateData);
        const response = await this.performSave(updateData, operation.recordId);
        debugLog("[SaveQueue] API Save successful", response);
        this.handleSaveSuccess(operation);
      } catch (error) {
        console.error(`[SaveQueue] Error during processing for ${operation.type} (record ${operation.recordId}):`, error);
        this.handleSaveError(operation, error);
      }
    }

    // Prepares the data to save
    async prepareSaveData(operation) {
      const { type, data, recordId, preserveFields } = operation;
      console.log(`[SaveQueue] Preparing save data for type: ${type}, record: ${recordId}, preserveFields: ${preserveFields}`);

      // Start with the mandatory lastSaved field
      const updateData = {
        [FIELD_MAPPING.lastSaved]: new Date().toISOString()
      };

      try {
        // Fetch existing data ONLY if preserving fields
        let existingData = null;
        if (preserveFields) {
          console.log(`[SaveQueue] Preserving fields for ${type}, fetching existing data...`);
          try {
            existingData = await this.getExistingData(recordId);
            debugLog("[SaveQueue] Fetched existing data for preservation", existingData ? `Record ${recordId} found` : `Record ${recordId} NOT found`);
          } catch (fetchError) {
            console.error(`[SaveQueue] Failed to fetch existing data for field preservation (record ${recordId}):`, fetchError);
            console.warn("[SaveQueue] Proceeding with save WITHOUT field preservation due to fetch error.");
            existingData = null;
          }
        }

        // Add data based on operation type
        switch (type) {
          case 'studyPlan':
            updateData[FIELD_MAPPING.planData] = JSON.stringify(
              this.ensureSerializable(data || {})
            );
            console.log("[SaveQueue] Prepared studyPlan data for save.");
            break;
          default:
            console.error(`[SaveQueue] Unknown save operation type: ${type}`);
            throw new Error(`Unknown save operation type: ${type}`);
        }

        // If preserving fields and we successfully fetched existing data, merge
        if (preserveFields && existingData) {
          console.log(`[SaveQueue] Merging prepared data with existing data for record ${recordId}`);
          this.preserveExistingFields(updateData, existingData);
          debugLog("[SaveQueue] Merged data after preservation", updateData);
        } else if (preserveFields && !existingData) {
          console.warn(`[SaveQueue] Cannot preserve fields for record ${recordId} because existing data could not be fetched.`);
        }

        return updateData;
      } catch (error) {
        console.error(`[SaveQueue] Error in prepareSaveData for type ${type}:`, error);
        throw error;
      }
    }

    // Fetches current record data from Knack
    async getExistingData(recordId) {
      console.log(`[SaveQueue] Fetching existing data for record ${recordId}`);
      const apiCall = () => {
        return new Promise((resolve, reject) => {
          $.ajax({
            url: `${KNACK_API_URL}/objects/${STUDYPLANNER_OBJECT}/records/${recordId}`,
            type: 'GET',
            headers: this.getKnackHeaders(),
            data: { format: 'raw' },
            success: function(response) {
              console.log(`[SaveQueue] Successfully fetched existing data for record ${recordId}`);
              resolve(response);
            },
            error: function(jqXHR, textStatus, errorThrown) {
              console.error(`[SaveQueue] Error fetching existing data for record ${recordId}: Status ${jqXHR.status} - ${errorThrown}`, jqXHR.responseText);
              const error = new Error(`Failed to fetch record ${recordId}: ${jqXHR.status} ${errorThrown}`);
              error.status = jqXHR.status;
              error.responseText = jqXHR.responseText;
              reject(error);
            }
          });
        });
      };
      return retryApiCall(apiCall);
    }

    // Merges updateData with existingData, preserving specific fields
    preserveExistingFields(updateData, existingData) {
      console.log(`[SaveQueue] Preserving fields for record. Fields in updateData: ${Object.keys(updateData).join(', ')}`);
      // Define all fields managed by the app that could be preserved
      const allAppFieldIds = [
        FIELD_MAPPING.planData,
        FIELD_MAPPING.teacherConnection,
        FIELD_MAPPING.vespaCustomer,
        FIELD_MAPPING.tutorConnection,
        FIELD_MAPPING.staffAdminConnection
      ];

      allAppFieldIds.forEach(fieldId => {
        if (updateData[fieldId] === undefined && existingData[fieldId] !== undefined && existingData[fieldId] !== null) {
          console.log(`[SaveQueue] Preserving existing data for field ID: ${fieldId}`);
          updateData[fieldId] = existingData[fieldId];
        }
      });
    }

    // Performs the actual Knack API PUT request
    async performSave(updateData, recordId) {
      console.log(`[SaveQueue] Performing API save for record ${recordId}`);
      if (!recordId) {
        throw new Error("Cannot perform save: recordId is missing.");
      }
      if (Object.keys(updateData).length <= 1 && updateData[FIELD_MAPPING.lastSaved]) {
        console.warn(`[SaveQueue] Save payload for record ${recordId} only contains lastSaved timestamp. Skipping API call.`);
        return { message: "Save skipped, only timestamp update." };
      }

      const apiCall = () => {
        return new Promise((resolve, reject) => {
          $.ajax({
            url: `${KNACK_API_URL}/objects/${STUDYPLANNER_OBJECT}/records/${recordId}`,
            type: 'PUT',
            headers: this.getKnackHeaders(),
            data: JSON.stringify(updateData),
            success: function(response) {
              console.log(`[SaveQueue] API PUT successful for record ${recordId}`);
              resolve(response);
            },
            error: function(jqXHR, textStatus, errorThrown) {
              console.error(`[SaveQueue] API PUT failed for record ${recordId}: Status ${jqXHR.status} - ${errorThrown}`, jqXHR.responseText);
              const error = new Error(`API Save failed for record ${recordId}: ${jqXHR.status} ${errorThrown}`);
              error.status = jqXHR.status;
              error.responseText = jqXHR.responseText;
              reject(error);
            }
          });
        });
      };
      return retryApiCall(apiCall);
    }

    // Handles successful save completion
    handleSaveSuccess(operation) {
      const completedOperation = this.queue.shift();
      if (completedOperation !== operation) {
        console.error("[SaveQueue] Mismatch between completed operation and head of queue!", operation, completedOperation);
        const opIndex = this.queue.findIndex(op => op === operation);
        if(opIndex > -1) this.queue.splice(opIndex, 1);
      }
      this.retryAttempts.delete(operation);
      console.log(`[SaveQueue] Operation ${operation.type} succeeded for record ${operation.recordId}. Queue length: ${this.queue.length}`);
      operation.resolve(true);
      this.isSaving = false;
      this.processQueue();
    }

    // Handles save errors, implements retry logic
    handleSaveError(operation, error) {
      if (this.queue[0] !== operation) {
        console.warn(`[SaveQueue] Stale error encountered for operation ${operation.type} (record ${operation.recordId}). Operation no longer at head of queue. Ignoring error.`);
        if (!this.isSaving && this.queue.length > 0) {
          this.processQueue();
        }
        return;
      }

      const attempts = (this.retryAttempts.get(operation) || 0) + 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SaveQueue] Save error for ${operation.type} (record ${operation.recordId}, Attempt ${attempts}/${this.maxRetries}):`, errorMessage, error);

      if (attempts < this.maxRetries) {
        this.retryAttempts.set(operation, attempts);
        const delay = this.retryDelay * Math.pow(2, attempts - 1);
        console.log(`[SaveQueue] Retrying operation ${operation.type} (record ${operation.recordId}) in ${delay}ms...`);
        this.isSaving = false;
        setTimeout(() => {
          console.log(`[SaveQueue] Attempting retry for ${operation.type} (record ${operation.recordId}) after delay.`);
          this.processQueue();
        }, delay);
      } else {
        console.error(`[SaveQueue] Max retries reached for operation ${operation.type} (record ${operation.recordId}). Aborting.`);
        const failedOperation = this.queue.shift();
        if (failedOperation !== operation) {
          console.error("[SaveQueue] Mismatch during failure handling!", operation, failedOperation);
        }
        this.retryAttempts.delete(operation);
        operation.reject(error || new Error(`Save failed after ${this.maxRetries} retries`));
        this.isSaving = false;
        this.processQueue();
      }
    }

    // Helper to get standard Knack API headers
    getKnackHeaders() {
      // Now reading knackAppId and knackApiKey from STUDYPLANNER_CONFIG
      const config = window.STUDYPLANNER_CONFIG;
      if (!config || !config.knackAppId || !config.knackApiKey) {
         console.error("[SaveQueue] Missing Knack App ID or API Key in STUDYPLANNER_CONFIG.");
         throw new Error("Knack configuration missing in window.STUDYPLANNER_CONFIG");
      }
      const knackAppId = config.knackAppId;
      const knackApiKey = config.knackApiKey;

      if (typeof Knack === 'undefined' || typeof Knack.getUserToken !== 'function') {
        console.error("[SaveQueue] Knack object or getUserToken function not available.");
        throw new Error("Knack authentication context not available.");
      }
      const token = Knack.getUserToken();
      if (!token) {
        console.warn("[SaveQueue] Knack user token is null or undefined. API calls may fail.");
      }
      return {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': token || '',
        'Content-Type': 'application/json'
      };
    }

    // Helper to ensure data is serializable (prevents circular references)
    ensureSerializable(data) {
      try {
        // Test serialization
        JSON.stringify(data);
        return data;
      } catch (e) {
        console.warn('[SaveQueue] Data contains circular references or non-serializable values. Stripping them.', e);
        const cache = new Set();
        try {
          return JSON.parse(JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (cache.has(value)) {
                return undefined;
              }
              cache.add(value);
            }
            return value;
          }));
        } catch (parseError) {
          console.error("[SaveQueue] Failed to serialize data even after attempting to strip circular references:", parseError);
          return data;
        }
      }
    }
  }

  // Create singleton instance
  const saveQueue = new SaveQueue();

  // --- Knack Integration Initialization ---
  // Keep track of initialization state to prevent duplicate initializations
  let appReadyReceived = false; // Keep this for iframe communication

  // REMOVED: Knack Scene Render Listener

  // Main initialization function, now exposed globally.
  // This will be called by the loader script AFTER config is ready.
  window.initializeStudyPlannerApp = function() {
    console.log("StudyPlanner: Initializing StudyPlannerApp function called...");

    // Get config directly from the global object set by the loader
    const config = window.STUDYPLANNER_CONFIG;
    if (!config || !config.appUrl || !config.elementSelector) {
      console.error("StudyPlanner Error: Missing or incomplete STUDYPLANNER_CONFIG when initializeStudyPlannerApp called.", config);
      // Ensure config is an object to avoid errors if it was initially null/undefined
      const safeConfig = config || {};
      // Try a fallback selector if elementSelector is missing
      safeConfig.elementSelector = safeConfig.elementSelector || '.kn-rich-text';
      if (!safeConfig.appUrl) {
          console.error("StudyPlanner Fatal Error: appUrl is missing in STUDYPLANNER_CONFIG. Cannot load app.");
          return; // Cannot proceed without appUrl
      }
      console.warn("StudyPlanner Warning: Proceeding with potentially incomplete config.");
       // Reassign config to the potentially modified safeConfig
       window.STUDYPLANNER_CONFIG = safeConfig; // Update global if needed, or just use safeConfig locally
    }
    // Use the potentially updated config object
    const currentConfig = window.STUDYPLANNER_CONFIG;
    debugLog("StudyPlanner: Using configuration from loader", currentConfig);

    // Check if Knack context is ready (redundant if loader ensures it, but safe)
    if (typeof Knack === 'undefined' || typeof $ === 'undefined' || !Knack.getUserToken || !Knack.getUserAttributes || typeof Knack.application_id === 'undefined') {
      console.error("StudyPlanner Error: Required Knack context or jQuery ($) not available when initializeStudyPlannerApp called.");
      return;
    }

    if (Knack.getUserToken()) {
      console.log("StudyPlanner: User is authenticated");
      const userToken = Knack.getUserToken();
      const appId = Knack.application_id;
      const user = Knack.getUserAttributes();

      console.log("StudyPlanner: Basic user info:", user);
      // Ensure user object exists before assigning to window
      if (!user || typeof user !== 'object') {
          console.error("StudyPlanner Error: Knack.getUserAttributes() did not return a valid user object.");
          return;
      }
      window.currentKnackUser = user;

      // Get complete user data (async)
      getCompleteUserData(user.id, function(completeUserData) {
        if (completeUserData) {
           // Ensure window.currentKnackUser still exists before assigning
           if (window.currentKnackUser) {
             window.currentKnackUser = Object.assign({}, window.currentKnackUser, completeUserData);
             debugLog("Enhanced global user object", window.currentKnackUser);
           } else {
              console.warn("StudyPlanner: window.currentKnackUser lost before complete data arrived.");
              window.currentKnackUser = Object.assign({}, user, completeUserData); // Re-create if lost
           }
        } else {
          console.warn("StudyPlanner: Could not get complete user data, continuing with basic info");
        }
        // Pass the current config to continueInitialization
        continueInitialization(currentConfig, userToken, appId);
      });
    } else {
      console.error("StudyPlanner: User is not authenticated (Knack.getUserToken() returned null/false).");
    }
  }

  // Continue initialization after potentially fetching complete user data
  // This function now starts the DOM setup attempt
  function continueInitialization(config, userToken, appId) {
    const currentUser = window.currentKnackUser;

     if (!currentUser) {
       console.error("StudyPlanner Error: Cannot continue initialization, currentKnackUser is not defined.");
       return;
     }

    // Log the full user object to help debug connection fields
    console.log("COMPLETE USER OBJECT FOR CONNECTION DEBUGGING:", JSON.stringify(currentUser, null, 2));
    
    // Extract and store connection field IDs safely
    currentUser.emailId = extractValidRecordId(currentUser.id);
    
    // For VESPA Customer ID (field_122/school) - For object_2 connections
    if (currentUser.field_122_raw && Array.isArray(currentUser.field_122_raw) && currentUser.field_122_raw.length > 0) {
      currentUser.schoolId = extractValidRecordId(currentUser.field_122_raw[0].id);
      console.log("Found VESPA Customer ID from field_122_raw:", currentUser.schoolId);
    } else if (currentUser.school_raw && Array.isArray(currentUser.school_raw) && currentUser.school_raw.length > 0) {
      currentUser.schoolId = extractValidRecordId(currentUser.school_raw[0].id);
      console.log("Found VESPA Customer ID from school_raw:", currentUser.schoolId);
    } else {
      currentUser.schoolId = extractValidRecordId(currentUser.school || currentUser.field_122);
      console.log("Using fallback for VESPA Customer ID:", currentUser.schoolId);
    }
    
    // For tutor connection(s) - object_6 connections via field_1682
    currentUser.teacherId = null; // Initialize teacherId
    if (currentUser.field_1682_raw && Array.isArray(currentUser.field_1682_raw) && currentUser.field_1682_raw.length > 0) {
      // Get all tutor IDs
      const tutorIds = currentUser.field_1682_raw
        .map(item => extractValidRecordId(item.id))
        .filter(id => id);
        
      if (tutorIds.length === 1) {
        currentUser.teacherId = tutorIds[0];
        console.log("Found single Tutor ID from field_1682_raw:", currentUser.teacherId);
      } else if (tutorIds.length > 1) {
        currentUser.teacherId = tutorIds; // Store as array
        console.log(`Found ${tutorIds.length} Tutor IDs from field_1682_raw:`, tutorIds);
      }
    } else if (currentUser.tutor_raw && Array.isArray(currentUser.tutor_raw) && currentUser.tutor_raw.length > 0) {
      // Get all tutor IDs from tutor_raw
      const tutorIds = currentUser.tutor_raw
        .map(item => extractValidRecordId(item.id))
        .filter(id => id);
        
      if (tutorIds.length === 1) {
        currentUser.teacherId = tutorIds[0];
        console.log("Found single Tutor ID from tutor_raw:", currentUser.teacherId);
      } else if (tutorIds.length > 1) {
        currentUser.teacherId = tutorIds; // Store as array
        console.log(`Found ${tutorIds.length} Tutor IDs from tutor_raw:`, tutorIds);
      }
    } else {
      // Fallback for single tutor
      const singleTutorId = extractValidRecordId(currentUser.tutor);
      if(singleTutorId) {
           currentUser.teacherId = singleTutorId;
           console.log("Using fallback for Tutor ID:", currentUser.teacherId);
      } else {
           console.log("No valid Tutor ID found in fallback.");
      }
    }
    
    currentUser.roleId = extractValidRecordId(currentUser.role);
    
    // Staff admin connection (field_190) - object_6 connection
    currentUser.staffAdminId = null; // Initialize staffAdminId
    if (currentUser.field_190_raw && Array.isArray(currentUser.field_190_raw) && currentUser.field_190_raw.length > 0) {
      // Get all staff admin IDs
      const staffAdminIds = currentUser.field_190_raw
        .map(item => extractValidRecordId(item.id))
        .filter(id => id);
        
      if (staffAdminIds.length === 1) {
        currentUser.staffAdminId = staffAdminIds[0];
        console.log("Found single Staff Admin ID from field_190_raw:", currentUser.staffAdminId);
      } else if (staffAdminIds.length > 1) {
        currentUser.staffAdminId = staffAdminIds; // Store as array
        console.log(`Found ${staffAdminIds.length} Staff Admin IDs from field_190_raw:`, staffAdminIds);
      }
    } else if (currentUser.staffAdmin_raw && Array.isArray(currentUser.staffAdmin_raw) && currentUser.staffAdmin_raw.length > 0) {
      // Get all staff admin IDs from staffAdmin_raw
      const staffAdminIds = currentUser.staffAdmin_raw
        .map(item => extractValidRecordId(item.id))
        .filter(id => id);
        
      if (staffAdminIds.length === 1) {
        currentUser.staffAdminId = staffAdminIds[0];
        console.log("Found single Staff Admin ID from staffAdmin_raw:", currentUser.staffAdminId);
      } else if (staffAdminIds.length > 1) {
        currentUser.staffAdminId = staffAdminIds; // Store as array
        console.log(`Found ${staffAdminIds.length} Staff Admin IDs from staffAdmin_raw:`, staffAdminIds);
      }
    }
    
    // For object_2 - we need a valid ID for the VESPA Customer field (field_2473)
    // Use the school ID if it exists
    currentUser.vespaCustomerId = currentUser.schoolId;
    console.log("Set VESPA Customer ID for field_2473:", currentUser.vespaCustomerId);

    debugLog("FINAL CONNECTION FIELD IDs", {
      emailId: currentUser.emailId,
      schoolId: currentUser.schoolId,
      teacherId: currentUser.teacherId, // This might now be an array
      staffAdminId: currentUser.staffAdminId, // This might now be an array
      roleId: currentUser.roleId
    });

    // Start attempting to find the container and set up the DOM
    attemptStudyPlannerDomSetup(config, userToken, appId, 0); // Start with 0 retries
  }

  // New function to find container and setup iframe, with retries
  function attemptStudyPlannerDomSetup(config, userToken, appId, retryCount) {
      const MAX_RETRIES = 8; // Increased from 5
      const RETRY_DELAY_MS = 400; // Increased from 200
      let appReadyReceived = false; // Flag specific to this attempt

      console.log(`StudyPlanner: Attempting DOM setup (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      
      // Check if Knack has fully rendered the correct view
      function checkForKnackStability() {
        // Check if Knack has fully rendered by looking for view_3008 in multiple ways
        const viewExists = 
          document.getElementById('view_3008') || 
          document.querySelector('.view_3008') ||
          document.querySelector('[data-view="view_3008"]') ||
          document.querySelector('[data-knack-view="view_3008"]');
        
        return !!viewExists;
      }

      // Only proceed if Knack appears stable
      if (!checkForKnackStability()) {
        if (retryCount < MAX_RETRIES) {
          console.log(`StudyPlanner: Knack view not stable yet, retrying in ${RETRY_DELAY_MS}ms...`);
          setTimeout(() => attemptStudyPlannerDomSetup(config, userToken, appId, retryCount + 1), RETRY_DELAY_MS);
          return;
        }
      }

      // Find or create container for the app using config.elementSelector
      let container = document.querySelector(config.elementSelector);
      // Fallback selectors (use view ID from config if available, else hardcoded)
      const viewId = config.viewKey || 'view_3008'; // Prefer viewKey from loader if present
      const sceneId = config.sceneKey || 'scene_1208'; // Prefer sceneKey from loader if present

      if (!container) {
        const viewElement = document.getElementById(viewId) || document.querySelector('.' + viewId);
        if (viewElement) {
          console.log(`Creating container inside ${viewId}`);
          container = document.createElement('div');
          container.id = 'studyplanner-app-container-generated';
          viewElement.appendChild(container);
        }
      }
      // Final fallback to scene
      if (!container) {
        const sceneElement = document.getElementById('kn-' + sceneId); // Knack scene IDs often prefixed with kn-
        if (sceneElement) {
          console.log(`Creating container inside ${sceneId}`);
          container = document.createElement('div');
          container.id = 'studyplanner-app-container-generated';
          sceneElement.appendChild(container);
        } else {
          // Container not found even with scene fallback
          if (retryCount < MAX_RETRIES) {
              console.warn(`StudyPlanner: Container not found (selector: ${config.elementSelector}), retrying in ${RETRY_DELAY_MS}ms...`);
              setTimeout(() => attemptStudyPlannerDomSetup(config, userToken, appId, retryCount + 1), RETRY_DELAY_MS);
              return; // Stop this attempt, wait for retry
          } else {
              console.error(`StudyPlanner: Cannot find any suitable container after ${MAX_RETRIES + 1} attempts using selector: ${config.elementSelector} or fallbacks. Aborting.`);
              return; // Stop initialization
          }
        }
      }

      // Final check if container was found after all fallbacks
      if (!container) {
         if (retryCount < MAX_RETRIES) {
              console.warn(`StudyPlanner: Container not found (selector: ${config.elementSelector}), retrying in ${RETRY_DELAY_MS}ms...`);
              setTimeout(() => attemptStudyPlannerDomSetup(config, userToken, appId, retryCount + 1), RETRY_DELAY_MS);
              return; // Stop this attempt, wait for retry
          } else {
              console.error(`StudyPlanner: Final check: Still cannot find container after ${MAX_RETRIES + 1} attempts. Aborting.`);
              return; // Stop initialization
          }
      }

      // --- Container found, proceed with iframe setup --- 
      console.log("StudyPlanner: Container found. Proceeding with iframe setup.");
      container.innerHTML = '';

      // Loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.id = 'studyplanner-loading-indicator';
      loadingDiv.innerHTML = '<p>Loading Study Planner...</p>';
      loadingDiv.style.padding = '20px';
      loadingDiv.style.textAlign = 'center';
      container.appendChild(loadingDiv);

      // Create iframe using config.appUrl
      const iframe = document.createElement('iframe');
      iframe.id = 'studyplanner-app-iframe';
      iframe.style.width = '100%';
      iframe.style.minHeight = '800px'; // Consider making this configurable
      iframe.style.border = 'none';
      iframe.style.display = 'none'; // Keep hidden until APP_READY
      iframe.src = config.appUrl;
      container.appendChild(iframe);

      // Setup listener ONCE
      // Ensure previous listeners are removed if re-initializing (though direct init should prevent this)
      // window.removeEventListener('message', messageHandler); // Uncomment if re-initialization becomes possible

      const messageHandler = function(event) {
        // Basic security check: Ensure the message is from the expected iframe source
         if (event.source !== iframe.contentWindow || event.origin !== new URL(config.appUrl).origin) {
           // console.warn("[Knack Script] Ignoring message from unexpected source or origin:", event.origin);
           return;
         }

        if (!event.data || !event.data.type) {
          console.warn("[Knack Script] Ignoring message with invalid format:", event.data);
          return;
        }

        const { type, data } = event.data;
        const iframeWindow = iframe.contentWindow;

        if (type !== 'PING') { // Reduce console noise for frequent pings
          console.log(`[Knack Script] Received message type: ${type}`);
        }

        if (type === 'APP_READY') {
          // Prevent handling duplicate APP_READY messages
          if (appReadyReceived) {
            console.log("StudyPlanner: Ignoring duplicate APP_READY message");
            return;
          }

          appReadyReceived = true;
          console.log("StudyPlanner: React app reported APP_READY.");

          const userForApp = window.currentKnackUser; // Use potentially updated user object

          if (!userForApp || !userForApp.id) {
            console.error("Cannot send initial info: Current Knack user data not ready or missing ID at APP_READY.");
            // Optionally, tell the iframe there was an error
             if (iframeWindow) {
                 iframeWindow.postMessage({ type: 'KNACK_INIT_ERROR', error: 'Knack user data not available' }, new URL(config.appUrl).origin);
             }
            return;
          }

          loadingDiv.innerHTML = '<p>Loading User Data...</p>';

          loadStudyPlannerUserData(userForApp.id, function(userData) {
            // Check if iframe is still valid before posting message
            if (iframe.contentWindow && iframeWindow && iframe.contentWindow === iframeWindow) {
              const initialData = {
                type: 'KNACK_USER_INFO',
                data: {
                  id: userForApp.id,
                  email: userForApp.email,
                  name: userForApp.name || '',
                  token: userToken, // Use the token captured earlier
                  appId: appId,     // Use the appId captured earlier
                  userData: userData || {}, // Send loaded study plan data or empty obj
                  // Send resolved IDs
                  emailId: userForApp.emailId,
                  schoolId: userForApp.schoolId,
                  teacherId: userForApp.teacherId,
                  roleId: userForApp.roleId
                }
              };
              debugLog("--> Sending KNACK_USER_INFO to React App", initialData.data);
              iframeWindow.postMessage(initialData, new URL(config.appUrl).origin); // Use specific origin

              // Show iframe after sending initial data
              loadingDiv.style.display = 'none';
              iframe.style.display = 'block';
              console.log("StudyPlanner initialized and visible.");
            } else {
              console.warn("[Knack Script] Iframe window no longer valid when sending initial data.");
            }
          });
        } else {
           // Route other messages using the specific origin for security
           handleMessageRouter(type, data, iframeWindow, new URL(config.appUrl).origin);
        }
      };

      window.addEventListener('message', messageHandler);
      console.log("StudyPlanner initialization sequence complete. Waiting for APP_READY from iframe.");
  }

  // Central Message Router - Added origin parameter
  function handleMessageRouter(type, data, iframeWindow, origin) {
    if (!type) {
      console.warn("[Knack Script] Received message without type.");
      return;
    }
     if (!iframeWindow) {
         console.error("[Knack Script] iframeWindow is missing in handleMessageRouter. Cannot send response.");
         return;
     }
     if (!origin) {
         console.error("[Knack Script] Origin is missing in handleMessageRouter. Cannot send response securely.");
         return;
     }

    console.log(`[Knack Script] Routing message type: ${type}`);

    switch (type) {
      case 'SAVE_DATA':
        handleSaveDataRequest(data, iframeWindow, origin);
        break;
      case 'REQUEST_UPDATED_DATA':
        handleDataUpdateRequest(data, iframeWindow, origin);
        break;
      case 'REQUEST_TOKEN_REFRESH':
        // handleTokenRefresh doesn't strictly need origin for sending, but good practice
        handleTokenRefresh(iframeWindow); // Keep as is, or modify to take origin
        break;
      case 'REQUEST_RECORD_ID':
        handleRecordIdRequest(data, iframeWindow, origin);
        break;
      case 'TUTOR_SHARE_SESSIONS':
        handleTutorShareRequest(data, iframeWindow, origin);
        break;
      case 'LOOKUP_CONNECTION_FIELDS':
        handleLookupConnectionFields(data, iframeWindow, origin);
        break;
      case 'AUTH_CONFIRMED':
        console.log("[Knack Script] React App confirmed auth.");
        const loadingIndicator = document.getElementById('studyplanner-loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        const appIframe = document.getElementById('studyplanner-app-iframe');
        if (appIframe) appIframe.style.display = 'block';
        break;
      // Add PONG handler if needed for heartbeat checks
      // case 'PONG':
      //  console.log("[Knack Script] Received PONG from iframe.");
      //  break;
      default:
        console.warn(`[Knack Script] Unhandled message type: ${type}`);
    }
  }

  // Handle 'SAVE_DATA' request from React app - Added origin
  async function handleSaveDataRequest(data, iframeWindow, origin) {
    console.log("[Knack Script] Handling SAVE_DATA request");
    if (!data || !data.recordId) {
      console.error("[Knack Script] SAVE_DATA request missing recordId.");
      if (iframeWindow) iframeWindow.postMessage({ type: 'SAVE_RESULT', success: false, error: "Missing recordId" }, origin);
      return;
    }
    debugLog("[Knack Script] Data received for SAVE_DATA:", data);

    try {
      // Check if this is a session synchronization
      if (data.session) {
        console.log("[Knack Script] Detected session data in SAVE_DATA request", data.session);
        
        // We'll still save the entire studyPlan, but we can log that we detected a session
        console.log("[Knack Script] Processing session synchronization for session:", data.session.id);
      }
      
      await saveQueue.addToQueue({
        type: 'studyPlan',
        data: data.studyPlan,
        recordId: data.recordId,
        preserveFields: data.preserveFields || false // Default to false if not provided
      });

      console.log(`[Knack Script] SAVE_DATA for record ${data.recordId} added to queue.`);
      // Post success message optimistically after queuing
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'SAVE_RESULT', 
        success: true, 
        queued: true, 
        timestamp: new Date().toISOString(),
        // If this was a session sync, include the session ID in the response
        sessionId: data.session?.id
      }, origin);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Knack Script] SAVE_DATA failed for record ${data.recordId} during queueing:`, errorMessage);
      if (iframeWindow) iframeWindow.postMessage({ type: 'SAVE_RESULT', success: false, error: errorMessage || 'Unknown save error' }, origin);
    }
  }

  // Handle request for updated data from React app - Added origin
  async function handleDataUpdateRequest(messageData, iframeWindow, origin) {
    console.log("[Knack Script] Handling REQUEST_UPDATED_DATA request", messageData);
    const userId = window.currentKnackUser?.id;

    // Extract recordId - Improved logic
    let recordId = null;
    if (typeof messageData === 'object' && messageData !== null) {
      recordId = messageData.recordId || messageData.data?.recordId;
    }
    console.log("[Knack Script] Extracted recordId for data update request:", recordId);

    if (!userId) {
      console.error("[Knack Script] Cannot refresh data - user ID not found.");
      if (iframeWindow) iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'User ID not found' }, origin);
      return;
    }

    // Always load data based on userId, then check if recordId matches if provided
    loadStudyPlannerUserData(userId, function(userData) {
      if (userData && iframeWindow) {
        // If a specific recordId was requested, log a warning if it doesn't match
        if (recordId && userData.recordId !== recordId) {
           console.warn(`[Knack Script] Loaded data record ID (${userData.recordId}) does not match requested record ID (${recordId}). Sending loaded data anyway as it's the user's current record.`);
        }

        console.log("[Knack Script] Sending refreshed data to React app (on request)");
        iframeWindow.postMessage({
          type: 'KNACK_DATA', // Consistent type
          studyPlan: userData.studyPlan || {},
          recordId: userData.recordId,
          lastSaved: userData.lastSaved, // Send last saved time too
          timestamp: new Date().toISOString() // Timestamp of this message
        }, origin);

      } else if (iframeWindow) {
        console.error("[Knack Script] Error loading updated data (on request) or iframe invalid.");
        iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'Failed to load data' }, origin);
      }
    });
  }

  // Handle record ID request - Added origin
  async function handleRecordIdRequest(data, iframeWindow, origin) {
    console.log("[Knack Script] Handling REQUEST_RECORD_ID request");
    const userId = window.currentKnackUser?.id;
    if (!userId) {
      console.error("[Knack Script] Cannot get record ID - user ID not found.");
      if (iframeWindow) iframeWindow.postMessage({ type: 'RECORD_ID_ERROR', error: 'User ID not found' }, origin);
      return;
    }

    // Use the existing load function which finds or creates the record
    loadStudyPlannerUserData(userId, function(userData) {
      if (userData && userData.recordId && iframeWindow) {
        console.log(`[Knack Script] Responding with record ID: ${userData.recordId}`);
        iframeWindow.postMessage({
          type: 'RECORD_ID_RESPONSE',
          recordId: userData.recordId,
          timestamp: new Date().toISOString()
        }, origin);
      } else if (iframeWindow) {
        console.error(`[Knack Script] Could not find or create record ID for user ${userId}`);
        iframeWindow.postMessage({
          type: 'RECORD_ID_ERROR',
          error: 'Record ID not found or could not be created',
          timestamp: new Date().toISOString()
        }, origin);
      }
    });
  }

  // Handle tutor sharing request from React app
  async function handleTutorShareRequest(data, iframeWindow, origin) {
    console.log("[Knack Script] Handling TUTOR_SHARE_SESSIONS request");
    debugLog("[Knack Script] Tutor share request data:", data);
    
    // Handle both possible data structures to be more robust
    // The data we need might be directly in the data object or nested inside data.data
    const messageData = data?.data || data || {};
    const recordId = messageData.recordId || data?.recordId;
    const sessions = messageData.sessions || data?.sessions;
    
    // Extract the student name from the message data - this will be used when creating sessions
    const studentName = messageData.studentName || "";
    console.log(`[Knack Script] Extracted student name from message data: ${studentName}`);
    
    if (!recordId) {
      console.error("[Knack Script] TUTOR_SHARE_SESSIONS request missing recordId.");
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'TUTOR_SHARE_RESULT', 
        success: false, 
        error: "Missing recordId" 
      }, origin);
      return;
    }
    
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      console.error("[Knack Script] TUTOR_SHARE_SESSIONS request missing sessions data.");
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'TUTOR_SHARE_RESULT', 
        success: false, 
        error: "No sessions data provided" 
      }, origin);
      return;
    }
    
    const user = window.currentKnackUser;
    if (!user || !user.id) {
      console.error("[Knack Script] Cannot share sessions: Current user data not available.");
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'TUTOR_SHARE_RESULT', 
        success: false, 
        error: "User data not available" 
      }, origin);
      return;
    }
    
    debugLog("[Knack Script] Session data received for tutor sharing:", data);
    
    const results = {
      success: true,
      shared: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    
    // Process each session
    for (const session of messageData.sessions) {
      try {
        // Check if this session already exists in object_90
        const existingRecord = await findTutorSharedSession(session.sessionId);
        
        if (existingRecord.success && existingRecord.record) {
          console.log(`[Knack Script] Session ${session.sessionId} already shared, skipping`);
          results.skipped++;
          continue;
        }
        
        // Create new tutor sharing record
        const shareResult = await createTutorSharedSession(session, user);
        
        if (shareResult.success) {
          console.log(`[Knack Script] Successfully shared session ${session.sessionId} with tutor`);
          results.shared++;
        } else {
          console.error(`[Knack Script] Failed to share session ${session.sessionId}:`, shareResult.error);
          results.failed++;
          results.errors.push(`Failed to share session ${session.sessionId}: ${shareResult.error}`);
        }
      } catch (error) {
        console.error(`[Knack Script] Error processing session ${session.sessionId}:`, error);
        results.failed++;
        results.errors.push(`Error processing session ${session.sessionId}: ${error.message || 'Unknown error'}`);
      }
    }
    
    // Format final result message
    results.message = `Shared ${results.shared} sessions, skipped ${results.skipped} already shared sessions, failed on ${results.failed} sessions.`;
    console.log(`[Knack Script] Tutor sharing result: ${results.message}`);
    
    // Send result back to React app
    if (iframeWindow) {
      iframeWindow.postMessage({ 
        type: 'TUTOR_SHARE_RESULT',
        ...results,
        timestamp: new Date().toISOString()
      }, origin);
    }
  }
  
  // Find a session in object_90 by sessionId to check if it's already shared
  async function findTutorSharedSession(sessionId) {
    if (!sessionId) {
      return { success: false, error: 'Session ID is required' };
    }
    
    console.log(`[Knack Script] Checking if session ${sessionId} is already shared with tutor`);
    
    // Create filter to find by session ID (field_3057)
    const filters = encodeURIComponent(JSON.stringify({
      match: 'and',
      rules: [
        {
          field: TUTOR_SHARING_FIELDS.sessionId,
          operator: 'is',
          value: sessionId
        }
      ]
    }));
    
    const apiCall = () => new Promise((resolve, reject) => {
      $.ajax({
        url: `${KNACK_API_URL}/objects/${TUTOR_SHARING_OBJECT}/records?filters=${filters}`,
        type: 'GET',
        headers: saveQueue.getKnackHeaders(),
        data: { format: 'raw' },
        success: resolve,
        error: (jqXHR, textStatus, errorThrown) => {
          const error = new Error(`Failed to check for existing shared session: ${jqXHR.status} ${errorThrown}`);
          error.status = jqXHR.status;
          error.responseText = jqXHR.responseText;
          reject(error);
        }
      });
    });
    
    try {
      const response = await retryApiCall(apiCall);
      
      // Check if we found any records
      if (response && response.records && response.records.length > 0) {
        return {
          success: true,
          record: response.records[0]
        };
      } else {
        return {
          success: true,
          record: null
        };
      }
    } catch (error) {
      console.error(`[Knack Script] Error checking for existing shared session ${sessionId}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error checking for existing record'
      };
    }
  }
  
  // Sanitize field for Knack use - ensure no HTML tags and properly extract emails 
  function sanitizeField(value) {
    if (value === null || value === undefined) return "";
    
    // Convert to string
    const strValue = String(value);
    
    // Look for multiple patterns of embedded emails
    
    // HTML email link pattern: <a href="mailto:example@domain.com">
    if (strValue.includes('href="mailto:')) {
      const emailMatch = strValue.match(/mailto:([^"]+)/i);
      if (emailMatch && emailMatch[1]) {
        console.log(`[Knack Script] Extracted email from mailto link: ${emailMatch[1]}`);
        return emailMatch[1];
      }
    }
    
    // Different email link pattern sometimes used by Knack: <a href="email@domain.com">
    if (strValue.includes('<a href="') && strValue.includes('@')) {
      const emailMatch = strValue.match(/<a href="([^"]+@[^"]+)"/i);
      if (emailMatch && emailMatch[1]) {
        console.log(`[Knack Script] Extracted email from direct href link: ${emailMatch[1]}`);
        return emailMatch[1];
      }
    }
    
    // Email in display text pattern: >email@domain.com<
    if (strValue.includes('>') && strValue.includes('@') && strValue.includes('<')) {
      const emailMatch = strValue.match(/>([^<>]+@[^<>]+)</i);
      if (emailMatch && emailMatch[1]) {
        console.log(`[Knack Script] Extracted email from display text: ${emailMatch[1]}`);
        return emailMatch[1];
      }
    }
    
    // Plain email pattern: look for anything with @ that looks like an email
    if (strValue.includes('@')) {
      const emailMatch = strValue.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
      if (emailMatch && emailMatch[1]) {
        console.log(`[Knack Script] Extracted plain email: ${emailMatch[1]}`);
        return emailMatch[1];
      }
    }
    
    // If no email patterns matched, remove all HTML tags
    let sanitized = strValue.replace(/<[^>]*?>/g, "");
    sanitized = sanitized.replace(/[*_~`#]/g, "");
    sanitized = sanitized
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ");
    return sanitized.trim();
  }

  // Create a new record in object_90 for a shared session
  async function createTutorSharedSession(session, user) {
    try {
      console.log(`[Knack Script] Creating tutor shared session record for: ${session.sessionId}`);
      
      // IMPORTANT: First fetch the user's StudyPlan record to get exact connection fields
      // This provides the connection field IDs that are already working in object_110
      const studyPlanRecord = await getUserStudyPlanRecord(user.id);
      console.log(`[Knack Script] Retrieved user's StudyPlan record for connection fields: ${studyPlanRecord ? "Success" : "Failed"}`);
      // *** ADDED LOGGING HERE ***
      debugLog('[Knack Script] StudyPlanRecord as received in createTutorSharedSession', studyPlanRecord);
      // *** END ADDED LOGGING ***
      
      // Format session data for Knack object_90
      let startDate = null;
      let startTime = null;
      let endDate = null;
      let endTime = null;
      
      try {
        // Parse date and time
        const sessionDate = new Date(session.sessionDate);
        
        // Format date as dd/mm/yyyy for Knack
        const day = String(sessionDate.getDate()).padStart(2, '0');
        const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
        const year = sessionDate.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        
        // Parse the time from HH:MM format
        const [hours, minutes] = (session.startTime || '09:00').split(':').map(n => parseInt(n, 10));
        
        // Create start date/time
        const startDateTime = new Date(sessionDate);
        startDateTime.setHours(hours, minutes, 0, 0);
        
        // Format time as HH:MM for Knack
        const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        
        // Calculate end time based on duration
        let durationMinutes = 60; // Default to 60 minutes
        const durationStr = session.studyLength;
        
        if (durationStr) {
          if (durationStr.includes('min')) {
            const match = durationStr.match(/(\d+)\s*min/);
            if (match) {
              durationMinutes = parseInt(match[1], 10);
            }
          } else if (durationStr.includes('Sprint')) {
            if (durationStr.includes('Quick Sprint')) {
              durationMinutes = 75; // 25+25+25
            } else if (durationStr.includes('Serious Sprint')) {
              durationMinutes = 95; // 25+10+25+10+25
            }
          }
        }
        
        // Add the duration to the end time
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);
        
        // Format end time
        const endHours = String(endDateTime.getHours()).padStart(2, '0');
        const endMinutes = String(endDateTime.getMinutes()).padStart(2, '0');
        const formattedEndTime = `${endHours}:${endMinutes}`;
        
        // Set values for Knack
        startDate = `${formattedDate} ${formattedTime}`;
        endDate = `${formattedDate} ${formattedEndTime}`;
      } catch (dateError) {
        console.error(`[Knack Script] Error parsing session date/time:`, dateError);
        startDate = new Date().toLocaleDateString('en-GB'); // fallback to current date
        startTime = '09:00'; // fallback to default time
      }
      
      // Current date in dd/mm/yyyy format
      const today = new Date();
      const formattedToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      
      // IMPORTANT CHANGE: Extract connection fields directly from StudyPlan record
      // instead of using complicated lookup procedures
      
      // Initialize connection field IDs
      let vespaCustomerId = null;
      let staffAdminId = null; // Can be single ID or array
      let tutorId = null; // Can be single ID or array
      let studentId = null;
      
      // Extract field values from StudyPlan record if available
      if (studyPlanRecord) {
        console.log("[Knack Script] Extracting connection fields from StudyPlan record");

        // *** REMOVED DEBUG LOGS as they are no longer the focus ***

        // Extract VESPA Customer ID (field_3043 -> field_2473)
        if (studyPlanRecord.field_3043_raw && Array.isArray(studyPlanRecord.field_3043_raw) && studyPlanRecord.field_3043_raw.length > 0) {
          vespaCustomerId = extractValidRecordId(studyPlanRecord.field_3043_raw[0]);
          console.log(`[Knack Script] Found VESPA Customer ID in StudyPlan record (_raw): ${vespaCustomerId}`);
        }
        // *** ADDED FALLBACK for VESPA Customer non-raw field just in case ***
        else if (studyPlanRecord.field_3043 && Array.isArray(studyPlanRecord.field_3043) && studyPlanRecord.field_3043.length > 0) {
           vespaCustomerId = extractValidRecordId(studyPlanRecord.field_3043[0]); // Knack API often returns array of IDs here
           console.log(`[Knack Script] Found VESPA Customer ID in StudyPlan record (non-raw): ${vespaCustomerId}`);
        }


        // Extract Staff Admin ID(s) (field_3059 -> field_2474) - Handles multiple
        // *** MODIFIED: Directly use field_3059 ***
        if (studyPlanRecord.field_3059 && Array.isArray(studyPlanRecord.field_3059) && studyPlanRecord.field_3059.length > 0) {
          console.log(`[Knack Script Debug] Processing field_3059 content:`, JSON.stringify(studyPlanRecord.field_3059));
          const staffAdminIds = studyPlanRecord.field_3059
            .map(item => extractValidRecordId(item)) // The API should return IDs here
            .filter(id => id); // Remove null/undefined values
          if (staffAdminIds.length > 0) {
            staffAdminId = staffAdminIds.length === 1 ? staffAdminIds[0] : staffAdminIds;
            console.log(`[Knack Script] Found Staff Admin ID(s) in StudyPlan record (field_3059): ${JSON.stringify(staffAdminId)}`);
          } else {
             console.log(`[Knack Script] field_3059 exists but no valid IDs extracted.`);
          }
        } else {
           console.log(`[Knack Script] field_3059 not found or not a non-empty array in StudyPlan record.`);
        }


        // Extract Tutor ID(s) (field_3058 -> field_2476) - Handles multiple
         // *** MODIFIED: Directly use field_3058 ***
        if (studyPlanRecord.field_3058 && Array.isArray(studyPlanRecord.field_3058) && studyPlanRecord.field_3058.length > 0) {
           console.log(`[Knack Script Debug] Processing field_3058 content:`, JSON.stringify(studyPlanRecord.field_3058));
          const tutorIds = studyPlanRecord.field_3058
             .map(item => {
                  // *** ADDED DETAILED LOGGING ***
                  console.log('[Knack Script] Mapping Tutor item from field_3058:', JSON.stringify(item));
                  const extractedId = extractValidRecordId(item); // API should return IDs
                  console.log(`[Knack Script] Extracted ID for item: ${extractedId}`);
                  return extractedId;
                  // *** END ADDED LOGGING ***
               })
            .filter(id => id); // Remove null/undefined values
          if (tutorIds.length > 0) {
            tutorId = tutorIds.length === 1 ? tutorIds[0] : tutorIds;
            console.log(`[Knack Script] Found Tutor ID(s) in StudyPlan record (field_3058): ${JSON.stringify(tutorId)}`);
          } else {
            console.log(`[Knack Script] field_3058 exists but no valid IDs extracted.`);
          }
        } else {
           console.log(`[Knack Script] field_3058 not found or not a non-empty array in StudyPlan record.`);
        }


        // Extract User Connection ID (field_3044 -> field_2475)
        // *** Keep original logic - seems less problematic ***
        if (studyPlanRecord.field_3044_raw) {
          if (Array.isArray(studyPlanRecord.field_3044_raw) && studyPlanRecord.field_3044_raw.length > 0) {
            console.log("[Knack Script] Found User Connection in StudyPlan record (_raw)");
          }
        } else if (studyPlanRecord.field_3044 && Array.isArray(studyPlanRecord.field_3044) && studyPlanRecord.field_3044.length > 0){
            console.log("[Knack Script] Found User Connection in StudyPlan record (non-raw)");
        }
      }
      
      // Fallback to user object values if needed (less likely with StudyPlan record available)
      // *** REMOVE Fallbacks for Tutor/Staff Admin as we should rely on the StudyPlan record ***
      if (!vespaCustomerId && user.vespaCustomerId) {
        vespaCustomerId = user.vespaCustomerId;
        console.log(`[Knack Script] Using VESPA Customer ID from user object: ${vespaCustomerId}`);
      } else if (!vespaCustomerId && user.schoolId) {
        vespaCustomerId = user.schoolId;
        console.log(`[Knack Script] Using school ID from user object: ${vespaCustomerId}`);
      }

      // Fallback for staff admin if not found in studyPlanRecord
      /* // REMOVED - Rely on studyPlanRecord
      if (!staffAdminId && user.staffAdminId) {
         staffAdminId = user.staffAdminId; // user.staffAdminId might be single or array
         console.log(`[Knack Script] Using staff admin ID(s) from user object: ${JSON.stringify(staffAdminId)}`);
      }
      */

      // Fallback for tutor if not found in studyPlanRecord
      /* // REMOVED - Rely on studyPlanRecord
      if (!tutorId && user.teacherId) {
         tutorId = user.teacherId; // user.teacherId might be single or array
         console.log(`[Knack Script] Using tutor ID(s) from user object: ${JSON.stringify(tutorId)}`);
      }
      */

      // For student record ID, we still need to get that from object_6
      // This is different from the account ID (user.id) and is specific to the student role
      if (!studentId) {
        // Check cache first
        if (user === window.currentKnackUser && window.currentKnackUser.studentRecordId) {
            studentId = window.currentKnackUser.studentRecordId;
            console.log("[Knack Script] Using cached studentRecordId:", studentId);
        } else {
            console.log("[Knack Script] Looking up student record for user's email:", user.email);
            try {
              const studentRecord = await lookupRecordByEmail('object_6', 'field_91', user.email);
              if (studentRecord.success && studentRecord.record) {
                studentId = studentRecord.record.id;
                console.log(`[Knack Script] Found student record ID by email lookup: ${studentId}`);
                
                // Store this for future reference if we're in the main user record context
                if (user === window.currentKnackUser) {
                  window.currentKnackUser.studentRecordId = studentId;
                  console.log("[Knack Script] Caching studentRecordId in currentKnackUser for future use");
                }
              }
            } catch (err) {
              console.error("[Knack Script] Error looking up student record:", err);
            }
        }
      }
      
      // Prepare data for object_90 with proper connection field formats - using RECORD IDs for connected fields
      const data = {
        [TUTOR_SHARING_FIELDS.sessionName]: `Planned from App-${formattedToday}`,
        [TUTOR_SHARING_FIELDS.studentName]: sanitizeField(session.studentName || user.name || "Student"),
        [TUTOR_SHARING_FIELDS.sessionStart]: startDate,
        [TUTOR_SHARING_FIELDS.sessionFinish]: endDate,
        [TUTOR_SHARING_FIELDS.sessionDetails]: session.details || "",
        [TUTOR_SHARING_FIELDS.studentEmail]: sanitizeField(session.studentEmail || user.email || ""), // Plain email as backup
        [TUTOR_SHARING_FIELDS.deleteFlag]: "No",
        [TUTOR_SHARING_FIELDS.sessionId]: session.sessionId
      };
      
      // Make sure we use the user.name directly for the studentName field if available
      if (user.name) {
        data[TUTOR_SHARING_FIELDS.studentName] = sanitizeField(user.name);
        console.log(`[Knack Script] Setting Student Name field (${TUTOR_SHARING_FIELDS.studentName}) to: "${user.name}"`);
      }
      
      // Add connection fields - use the IDs we carefully extracted
      if (vespaCustomerId) {
        data[TUTOR_SHARING_FIELDS.vespaCustomer] = vespaCustomerId;
        console.log(`[Knack Script] Setting VESPA Customer (field_2473) to: ${vespaCustomerId}`);
      }
      
      if (staffAdminId) {
        data[TUTOR_SHARING_FIELDS.staffAdmin] = staffAdminId; // Can be single ID or array
        const logValue = Array.isArray(staffAdminId) ? JSON.stringify(staffAdminId) : staffAdminId;
        console.log(`[Knack Script] Setting Staff Admin (field_2474) to: ${logValue}`);
      }
      
      if (tutorId) {
        data[TUTOR_SHARING_FIELDS.tutor] = tutorId; // Can be single ID or array
        const logValue = Array.isArray(tutorId) ? JSON.stringify(tutorId) : tutorId;
        console.log(`[Knack Script] Setting Tutor (field_2476) to: ${logValue}`);
      }
      
      if (studentId) {
        data[TUTOR_SHARING_FIELDS.userConnection] = studentId;
        console.log(`[Knack Script] Setting User Connection (field_2475) to: ${studentId}`);
      } else {
        console.warn("[Knack Script] No student record ID found for User Connection field");
      }
      
      // Enhanced debugging for connection fields
      console.log("[Knack Script] Connection fields for Knack integration:");
      console.log(`- field_2473 (VESPA Customer): "${vespaCustomerId || 'Not set'}"`);
      console.log(`- field_2474 (Staff Admin): "${staffAdminId ? JSON.stringify(staffAdminId) : 'Not set'}"`); // Log stringified value
      console.log(`- field_2475 (User Connection): "${studentId || 'Not set'}"`);
      console.log(`- field_2476 (Tutor): "${tutorId ? JSON.stringify(tutorId) : 'Not set'}"`); // Log stringified value
      
      debugLog("[Knack Script] Complete record data", data);
      
      // Create the record in Knack with proper connection formats
      console.log(`[Knack Script] Submitting session record to object_90`);
      
      const apiCall = () => new Promise((resolve, reject) => {
        $.ajax({
          url: `${KNACK_API_URL}/objects/${TUTOR_SHARING_OBJECT}/records`,
          type: 'POST',
          headers: saveQueue.getKnackHeaders(),
          data: JSON.stringify(data),
          contentType: 'application/json',
          success: resolve,
          error: (jqXHR, textStatus, errorThrown) => {
            // Get more detailed error information
            let errorDetail = "Unknown error";
            try {
              if (jqXHR.responseText) {
                const errorObj = JSON.parse(jqXHR.responseText);
                if (errorObj && errorObj.errors) {
                  errorDetail = JSON.stringify(errorObj.errors);
                }
              }
            } catch (parseError) {
              errorDetail = jqXHR.responseText || errorThrown;
            }
            
            const error = new Error(`Failed to create shared session record: ${jqXHR.status} - ${errorDetail}`);
            error.status = jqXHR.status;
            error.responseText = jqXHR.responseText;
            reject(error);
          }
        });
      });
      
      const response = await retryApiCall(apiCall);
      
      if (response && response.id) {
        return {
          success: true,
          id: response.id
        };
      } else {
        return {
          success: false,
          error: 'Record created but no ID returned'
        };
      }
    } catch (error) {
      console.error(`[Knack Script] Error creating tutor shared session record:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error creating record'
      };
    }
  }
  
  // Get complete user data from Knack
  function getCompleteUserData(userId, callback) {
    if (!userId) {
      console.error("[Knack Script] Cannot get complete user data: userId is missing.");
      callback(null);
      return;
    }
    console.log("[Knack Script] Getting complete user data for:", userId);
    const apiCall = () => new Promise((resolve, reject) => {
      $.ajax({
        url: `${KNACK_API_URL}/objects/object_3/records/${userId}`, // Assuming object_3 is User object
        type: 'GET',
        headers: saveQueue.getKnackHeaders(), // Use headers from saveQueue instance
        data: { format: 'raw' },
        success: resolve,
        error: (jqXHR, textStatus, errorThrown) => {
           const error = new Error(`Failed fetch user ${userId}: ${jqXHR.status} ${errorThrown}`);
           error.status = jqXHR.status;
           error.responseText = jqXHR.responseText;
           reject(error);
        }
      });
    });

    retryApiCall(apiCall, 2, 500) // Fewer retries for user data fetch
      .then(response => {
        console.log("[Knack Script] Complete user data received.");
        debugLog("[Knack Script] Raw Complete User Data:", response);
        callback(response);
      })
      .catch(error => {
        console.error("[Knack Script] Error retrieving complete user data after retries:", error.status, error.responseText || error.message);
        callback(null);
      });
  }

  // Load user's study planner data (find or create)
  function loadStudyPlannerUserData(userId, callback) {
    if (!userId) {
      console.error("[Knack Script] Cannot load study planner data: userId is missing.");
      callback(null);
      return;
    }
    console.log(`[Knack Script] Loading study planner data for user ID: ${userId}`);
    const findRecordApiCall = () => new Promise((resolve, reject) => {
      $.ajax({
        url: `${KNACK_API_URL}/objects/${STUDYPLANNER_OBJECT}/records`,
        type: 'GET',
        headers: saveQueue.getKnackHeaders(),
        data: {
          format: 'raw',
          rows_per_page: 1, // Only need one record
          filters: JSON.stringify({
            match: 'and',
            rules: [{ field: FIELD_MAPPING.userId, operator: 'is', value: userId }]
          })
        },
        success: resolve,
        error: (jqXHR, textStatus, errorThrown) => {
           const error = new Error(`Failed find record for user ${userId}: ${jqXHR.status} ${errorThrown}`);
           error.status = jqXHR.status;
           error.responseText = jqXHR.responseText;
           reject(error);
        }
      });
    });

    retryApiCall(findRecordApiCall)
      .then((response) => {
        debugLog("[Knack Script] Study Planner data search response:", response);
        if (response && response.records && response.records.length > 0) {
          const record = response.records[0];
          console.log(`[Knack Script] Found existing study planner record: ${record.id}`);

          // Assemble userData from record fields safely
          let userData = { recordId: record.id };
          try {
            // Helper to parse potentially encoded fields
            const parseField = (fieldName) => {
              const rawValue = record[fieldName];
              if (rawValue === undefined || rawValue === null || rawValue === "") return null; // Treat empty string as null
               // Decode only if it looks like a URI component
               const decodedValue = (typeof rawValue === 'string' && rawValue.includes('%'))
                   ? safeDecodeURIComponent(rawValue)
                   : rawValue;
               // Parse JSON only if it looks like JSON
               if (typeof decodedValue === 'string' && (decodedValue.startsWith('{') || decodedValue.startsWith('['))) {
                   return safeParseJSON(decodedValue);
               }
              return decodedValue; // Return as is otherwise
            };

            userData.studyPlan = parseField(FIELD_MAPPING.planData) || {}; // Default to empty object
            userData.lastSaved = record[FIELD_MAPPING.lastSaved]; // Keep raw timestamp
            // Assuming teacherConnection might be an array of IDs or similar structure
            //userData.teacherConnection = parseField(FIELD_MAPPING.teacherConnection) || []; // Default to empty array

            debugLog("[Knack Script] ASSEMBLED USER DATA from loaded record", userData);
            callback(userData);
          } catch (e) {
            console.error("[Knack Script] Error parsing loaded user data fields:", e);
            // Return partially assembled data even if parsing fails for one field
            callback(userData);
          }
        } else {
          // No existing data, create a new record
          console.log(`[Knack Script] No existing study planner record found for user ${userId}, creating new one...`);
          createStudyPlannerUserRecord(userId, function(success, newRecordId) {
            if (success && newRecordId) {
              console.log(`[Knack Script] New record created with ID: ${newRecordId}`);
              // Return the minimal data for a new record
              callback({
                recordId: newRecordId,
                studyPlan: {}, // Empty plan for new record
                lastSaved: null // No save yet
              });
            } else {
              console.error(`[Knack Script] Failed to create new study planner record for user ${userId}.`);
              callback(null);
            }
          });
        }
      })
      .catch((error) => {
        console.error("[Knack Script] Error loading study planner user data after retries:", error.status, error.responseText || error.message);
        callback(null);
      });
  }

  // Create a new study planner user record
  async function createStudyPlannerUserRecord(userId, callback) {
    console.log("[Knack Script] Creating new study planner user record for:", userId);
    const user = window.currentKnackUser; // Use the potentially enhanced user object

    if (!user || !user.email) { // Check for essential fields like email
      console.error("[Knack Script] Cannot create record: window.currentKnackUser is missing or lacks email.");
      callback(false, null);
      return;
    }

    try {
      console.log("[Knack Script] Looking up Student role data directly from user's profile");
      
      // Get the user's profile data directly from their roles/profile info
      let studentRole = null;
      
      // Try to get a direct student role record from object_6
      // This is tricky as we need to make sure we get the correct student role for this user
      console.log(`[Knack Script] Fetching student role data for user ID: ${userId} with email: ${user.email}`);
      
      // Get profile keys (roles) from the user
      const userProfileKeys = user.profile_keys || user.field_73 || [];
      console.log(`[Knack Script] User profile keys:`, userProfileKeys);
      
  // Try to identify the student role ID directly from the user's account
  const studentRoleId = Array.isArray(user.roles) && user.roles.find(role => role === 'object_6');
  console.log(`[Knack Script] Student role ID from roles:`, studentRoleId);
  
  // Create a more specific filter to find student roles by email using multiple possible fields
  // The issue is that the email might be in different fields depending on how the system is set up
  const searchFilters = {
    match: 'or',  // Use OR to match any email field
    rules: [
      // Try field_91 (primary email field in object_6)
      {
        field: 'field_91', 
        operator: 'is',
        value: user.email 
      },
      // Try field_70 (sometimes used for email)
      {
        field: 'field_70',
        operator: 'is',
        value: user.email
      },
      // Try a search in case email is embedded in another field
      {
        field: 'field_91',
        operator: 'contains',
        value: user.email
      }
    ]
  };
      
      const studentRoleFilters = encodeURIComponent(JSON.stringify(searchFilters));
      console.log(`[Knack Script] Using student role filter:`, JSON.stringify(searchFilters, null, 2));
      
      try {
        const response = await retryApiCall(() => new Promise((resolve, reject) => {
          $.ajax({
            url: `${KNACK_API_URL}/objects/object_6/records?filters=${studentRoleFilters}`,
            type: 'GET',
            headers: saveQueue.getKnackHeaders(),
            data: { format: 'raw' },
            success: resolve,
            error: (jqXHR, textStatus, errorThrown) => {
              const error = new Error(`Failed to lookup student role: ${jqXHR.status} ${errorThrown}`);
              error.status = jqXHR.status;
              error.responseText = jqXHR.responseText;
              reject(error);
            }
          });
        }));
        
        if (response && response.records && response.records.length > 0) {
          console.log(`[Knack Script] Found ${response.records.length} student role records`);
          
          // Check each record to find which one matches our user's email
          let bestMatch = null;
          
          for (const record of response.records) {
            // Get email from various places
            const recordFields = record.field_91 || {};
            const recordEmailRaw = recordFields.email || record.field_91_raw?.email || '';
            const recordEmail = sanitizeField(recordEmailRaw);
            
            console.log(`[Knack Script] Checking record email: "${recordEmail}" against user email: "${user.email}"`);
            
            // If record matches current user's email, use it
            if (recordEmail && recordEmail.toLowerCase() === user.email.toLowerCase()) {
              console.log(`[Knack Script] Found exact match for user email: ${recordEmail}`);
              bestMatch = record;
              break;
            }
          }
          
          // Use the best match if found, otherwise use the first record
          if (bestMatch) {
            studentRole = bestMatch;
            console.log("[Knack Script] Using exact matching student role record");
          } else {
            studentRole = response.records[0];
            console.warn("[Knack Script] No exact match found. Using first record but connection fields may be incorrect");
          }
          
          debugLog("[Knack Script] Student role data that will be used", studentRole);
        } else {
          console.log("[Knack Script] No student role record found for email:", user.email);
        }
      } catch (error) {
        console.error("[Knack Script] Error looking up student role:", error);
      }
      
      // Basic data structure for a new record
      const data = {
        [FIELD_MAPPING.userId]: userId,
        [FIELD_MAPPING.userEmail]: sanitizeField(user.email), // Sanitize just in case
        [FIELD_MAPPING.userName]: sanitizeField(user.name || ""), // Sanitize just in case
        [FIELD_MAPPING.lastSaved]: new Date().toISOString(), // Set initial save time
        [FIELD_MAPPING.planData]: JSON.stringify({}) // Empty object for new plan
      };
      
      // Add User Account connection (field_3044) - use the actual user Account ID
      // Format correctly for Knack connected field - must use the ID
      data[FIELD_MAPPING.teacherConnection] = userId; // Direct account ID, not email
      console.log(`[Knack Script] Setting User Account connection (field_3044) to Account ID: "${userId}"`);
      
      // Add VESPA Customer connection (field_3043) from user account
      // Use actual ID for connected field - all connected fields need record IDs
      if (user.schoolId) {
        data[FIELD_MAPPING.vespaCustomer] = user.schoolId;
        console.log(`[Knack Script] Setting VESPA Customer (${FIELD_MAPPING.vespaCustomer}) to ID: "${user.schoolId}"`);
      } else if (studentRole && studentRole.field_122_raw) {
        // Try to get school ID from student role if available
        const schoolId = extractValidRecordId(studentRole.field_122_raw);
        if (schoolId) {
          data[FIELD_MAPPING.vespaCustomer] = schoolId;
          console.log(`[Knack Script] Setting VESPA Customer from student role to ID: "${schoolId}"`);
        }
      }
      
      // Enhanced debugging for student role field extraction
      if (studentRole) {
        console.log("[Knack Script] Analyzing student role data fields:");
        console.log(`- field_1682 (Tutor) exists: ${studentRole.hasOwnProperty('field_1682')}`);
        console.log(`- field_1682_raw exists: ${studentRole.hasOwnProperty('field_1682_raw')}`);
        console.log(`- field_190 (Staff Admin) exists: ${studentRole.hasOwnProperty('field_190')}`);
        console.log(`- field_190_raw exists: ${studentRole.hasOwnProperty('field_190_raw')}`);

        // Dump raw connection field values to help debug
        if (studentRole.field_1682) console.log("Raw tutor field value:", JSON.stringify(studentRole.field_1682));
        if (studentRole.field_1682_raw) console.log("Raw tutor_raw field value:", JSON.stringify(studentRole.field_1682_raw));
        if (studentRole.field_190) console.log("Raw staff admin field value:", JSON.stringify(studentRole.field_190));
        if (studentRole.field_190_raw) console.log("Raw staff admin_raw field value:", JSON.stringify(studentRole.field_190_raw));
        
         // Extract tutor record ID(s) (not email) - Handles multiple
        let tutorId = null; // Can be single ID or array
        if (studentRole.field_1682_raw && Array.isArray(studentRole.field_1682_raw) && studentRole.field_1682_raw.length > 0) {
           console.log("[Knack Script] Extracting tutor IDs from field_1682_raw...");
           const tutorIds = studentRole.field_1682_raw
             .map(item => extractValidRecordId(item))
             .filter(id => id);
           if (tutorIds.length > 0) {
             tutorId = tutorIds.length === 1 ? tutorIds[0] : tutorIds;
             console.log(`[Knack Script] Extracted ${tutorIds.length} tutor ID(s) from _raw: ${JSON.stringify(tutorIds)}`);
           }
        }
        // *** RESTORED LOGIC FOR NON-RAW FIELD, BUT WITH CORRECT MAPPING ***
        else if (studentRole.field_1682 && Array.isArray(studentRole.field_1682)) {
          console.log("[Knack Script] field_1682_raw not found, extracting tutor IDs from field_1682...");
          const tutorIds = studentRole.field_1682
              .map(item => extractValidRecordId(item)) // Map ALL items
              .filter(id => id); // Filter out nulls
          if (tutorIds.length > 0) {
               tutorId = tutorIds.length === 1 ? tutorIds[0] : tutorIds;
               console.log(`[Knack Script] Extracted ${tutorIds.length} tutor ID(s) from field_1682: ${JSON.stringify(tutorIds)}`);
          }
        }
        // *** END RESTORED LOGIC ***

        if (tutorId) {
          data[FIELD_MAPPING.tutorConnection] = tutorId;
          const logValue = Array.isArray(tutorId) ? JSON.stringify(tutorId) : tutorId;
          console.log(`[Knack Script] Setting Tutor connection (${FIELD_MAPPING.tutorConnection}) to ID(s): "${logValue}"`);
        } else {
          console.log("[Knack Script] Could not extract valid tutor ID(s) from student role");
        }
        
        // Extract staff admin record ID(s) (not email) - Handles multiple
        let staffAdminId = null; // Can be single ID or array
        if (studentRole.field_190_raw && Array.isArray(studentRole.field_190_raw) && studentRole.field_190_raw.length > 0) {
          console.log("[Knack Script] Extracting staff admin IDs from field_190_raw...");
           const staffAdminIds = studentRole.field_190_raw
             .map(item => extractValidRecordId(item))
             .filter(id => id);
           if (staffAdminIds.length > 0) {
             staffAdminId = staffAdminIds.length === 1 ? staffAdminIds[0] : staffAdminIds;
             console.log(`[Knack Script] Extracted ${staffAdminIds.length} staff admin ID(s) from _raw: ${JSON.stringify(staffAdminIds)}`);
           }
        }
        // *** RESTORED LOGIC FOR NON-RAW FIELD, BUT WITH CORRECT MAPPING ***
        else if (studentRole.field_190 && Array.isArray(studentRole.field_190)) {
           console.log("[Knack Script] field_190_raw not found, extracting staff admin IDs from field_190...");
           const staffAdminIds = studentRole.field_190
              .map(item => extractValidRecordId(item)) // Map ALL items
              .filter(id => id); // Filter out nulls
           if (staffAdminIds.length > 0) {
               staffAdminId = staffAdminIds.length === 1 ? staffAdminIds[0] : staffAdminIds;
               console.log(`[Knack Script] Extracted ${staffAdminIds.length} staff admin ID(s) from field_190: ${JSON.stringify(staffAdminIds)}`);
           }
        }
      
        // *** END RESTORED LOGIC ***

        if (staffAdminId) {
          data[FIELD_MAPPING.staffAdminConnection] = staffAdminId;
          const logValue = Array.isArray(staffAdminId) ? JSON.stringify(staffAdminId) : staffAdminId;
          console.log(`[Knack Script] Setting Staff Admin connection (${FIELD_MAPPING.staffAdminConnection}) to ID(s): "${logValue}"`);
        } else {
          console.log("[Knack Script] Could not extract valid staff admin ID(s) from student role");
        }
      }
      // Enhanced debugging for connection fields
      console.log("[Knack Script] Connection fields for new StudyPlanner record:");
      console.log(`- ${FIELD_MAPPING.teacherConnection} (User Account): "${data[FIELD_MAPPING.teacherConnection] || "Not set"}"`);
      console.log(`- ${FIELD_MAPPING.vespaCustomer} (VESPA Customer): "${data[FIELD_MAPPING.vespaCustomer] || "Not set"}"`);
      console.log(`- ${FIELD_MAPPING.tutorConnection} (Tutor): "${data[FIELD_MAPPING.tutorConnection] ? JSON.stringify(data[FIELD_MAPPING.tutorConnection]) : "Not set"}"`);
      console.log(`- ${FIELD_MAPPING.staffAdminConnection} (Staff Admin): "${data[FIELD_MAPPING.staffAdminConnection] ? JSON.stringify(data[FIELD_MAPPING.staffAdminConnection]) : "Not set"}"`);
      
      debugLog("[Knack Script] COMPLETE NEW RECORD PAYLOAD", data);
      
      const apiCall = () => new Promise((resolve, reject) => {
        $.ajax({
          url: `${KNACK_API_URL}/objects/${STUDYPLANNER_OBJECT}/records`,
          type: 'POST',
          headers: saveQueue.getKnackHeaders(),
          data: JSON.stringify(data), // Ensure data is stringified
          contentType: 'application/json', // Explicitly set Content-Type
          success: resolve,
          error: (jqXHR, textStatus, errorThrown) => {
             const error = new Error(`Failed to create record for user ${userId}: ${jqXHR.status} ${errorThrown}`);
             error.status = jqXHR.status;
             error.responseText = jqXHR.responseText;
             reject(error);
          }
        });
      });

      const response = await retryApiCall(apiCall);
      console.log("[Knack Script] Successfully created user record:", response);
      
      // Ensure response has an ID before calling back
      if (response && response.id) {
          callback(true, response.id);
      } else {
          console.error("[Knack Script] Record creation API call succeeded but response missing ID.", response);
          callback(false, null);
      }
    } catch (error) {
      console.error("[Knack Script] Error creating user record:", error.status, error.responseText || error.message);
      callback(false, null);
    }
  }

  // Handle lookup connection fields request from React app
  async function handleLookupConnectionFields(data, iframeWindow, origin) {
    console.log("[Knack Script] Handling LOOKUP_CONNECTION_FIELDS request");
    debugLog("[Knack Script] Connection fields lookup request data:", data);
    
    if (!data || !data.userEmail) {
      console.error("[Knack Script] LOOKUP_CONNECTION_FIELDS request missing userEmail.");
      if (iframeWindow) {
        iframeWindow.postMessage({
          type: 'CONNECTION_FIELDS_RESULT',
          success: false,
          error: "Missing userEmail",
          data: {}
        }, origin);
      }
      return;
    }
    
    const userEmail = data.userEmail;
    const lookups = data.lookups || [];
    
    // Store the lookup results - now including record IDs
    const results = {};
    
    try {
      // Lookup in object_3 (Accounts) for field_122 (VESPA Customer)
      const vespaCustomerLookup = lookups.find(l => l.extractField === 'field_122');
      if (vespaCustomerLookup) {
        try {
          const vespaCustomerResult = await lookupRecordByEmail('object_3', 'field_70', userEmail);
          if (vespaCustomerResult.success && vespaCustomerResult.record) {
            // Get both display value and record ID
            const vespaCustomerValue = extractFieldValue(vespaCustomerResult.record, 'field_122');
            
            // Get record ID directly from raw field if available
            let vespaCustomerId = null;
            if (vespaCustomerResult.record.field_122_raw && 
                Array.isArray(vespaCustomerResult.record.field_122_raw) && 
                vespaCustomerResult.record.field_122_raw.length > 0) {
              vespaCustomerId = extractValidRecordId(vespaCustomerResult.record.field_122_raw[0]);
            }
            
            // Add text value
            if (vespaCustomerValue) {
              results[vespaCustomerLookup.targetField] = vespaCustomerValue;
              console.log(`[Knack Script] Found VESPA Customer: ${vespaCustomerValue}`);
            }
            
            // Add ID - important for Knack connection fields
            if (vespaCustomerId) {
              results[vespaCustomerLookup.targetField + "_id"] = vespaCustomerId;
              console.log(`[Knack Script] Found VESPA Customer ID: ${vespaCustomerId}`);
            }
          }
        } catch (error) {
          console.error('[Knack Script] Error looking up VESPA Customer:', error);
        }
      }
      
      // Lookup in object_6 (Students) for field_1682 (Tutor emails) and field_190 (Staff Admin)
      const studentLookup = lookups.find(l => l.object === 'object_6');
      if (studentLookup) {
        try {
          const studentResult = await lookupRecordByEmail('object_6', 'field_70', userEmail);
          if (studentResult.success && studentResult.record) {
            // Get student name value to ensure it's properly included
            if (studentResult.record.field_69) {
              const studentName = studentResult.record.field_69.full || 
                               `${studentResult.record.field_69.first || ''} ${studentResult.record.field_69.last || ''}`.trim();
              if (studentName) {
                results["studentName"] = sanitizeField(studentName);
                console.log(`[Knack Script] Found Student Name: ${studentName}`);
              }
            }
            
            // Extract tutor email and IDs - handle multiple connections
            const tutorLookup = lookups.find(l => l.extractField === 'field_1682');
            if (tutorLookup) {
              const tutorValue = extractFieldValue(studentResult.record, 'field_1682');
              
              // Get tutor IDs directly from raw field - handle as array for multiple connections
              let tutorIds = [];
              if (studentResult.record.field_1682_raw && 
                  Array.isArray(studentResult.record.field_1682_raw)) {
                  
                // Extract all valid IDs from the array
                tutorIds = studentResult.record.field_1682_raw
                  .map(item => extractValidRecordId(item))
                  .filter(id => id); // Filter out null/undefined values
                
                if (tutorIds.length > 0) {
                  console.log(`[Knack Script] Found ${tutorIds.length} Tutor IDs: ${tutorIds.join(', ')}`);
                }
              }
              
              // If we don't have valid IDs yet but have an email, look up the tutor record by email
              if (tutorIds.length === 0 && tutorValue && tutorValue.includes('@')) {
                try {
                  console.log(`[Knack Script] Looking up tutor record for email: ${tutorValue}`);
                  const tutorRecord = await lookupRecordByEmail('object_6', 'field_91', tutorValue);
                  if (tutorRecord.success && tutorRecord.record && tutorRecord.record.id) {
                    tutorIds = [tutorRecord.record.id];
                    console.log(`[Knack Script] Found tutor record ID from email lookup: ${tutorRecord.record.id}`);
                  }
                } catch (err) {
                  console.error(`[Knack Script] Error looking up tutor record by email:`, err);
                }
              }
              
              // Add text value
              if (tutorValue) {
                results[tutorLookup.targetField] = tutorValue;
                console.log(`[Knack Script] Found Tutor: ${tutorValue}`);
              }
              
              // Add ID array - important for Knack connection fields
              if (tutorIds.length > 0) {
                results[tutorLookup.targetField + "_id"] = tutorIds;
                console.log(`[Knack Script] Found Tutor IDs: ${JSON.stringify(tutorIds)}`);
              }
            }
            
            // Extract staff admin email and IDs - handle multiple connections
            const staffAdminLookup = lookups.find(l => l.extractField === 'field_190');
            if (staffAdminLookup) {
              const staffAdminValue = extractFieldValue(studentResult.record, 'field_190');
              
              // Get staff admin IDs directly from raw field - handle as array for multiple connections
              let staffAdminIds = [];
              if (studentResult.record.field_190_raw && 
                  Array.isArray(studentResult.record.field_190_raw)) {
                  
                // Extract all valid IDs from the array
                staffAdminIds = studentResult.record.field_190_raw
                  .map(item => extractValidRecordId(item))
                  .filter(id => id); // Filter out null/undefined values
                  
                if (staffAdminIds.length > 0) {
                  console.log(`[Knack Script] Found ${staffAdminIds.length} Staff Admin IDs: ${staffAdminIds.join(', ')}`);
                }
              }
              
              // If we don't have valid IDs yet but have an email, look up the staff admin record by email
              if (staffAdminIds.length === 0 && staffAdminValue && staffAdminValue.includes('@')) {
                try {
                  console.log(`[Knack Script] Looking up staff admin record for email: ${staffAdminValue}`);
                  const staffAdminRecord = await lookupRecordByEmail('object_6', 'field_91', staffAdminValue);
                  if (staffAdminRecord.success && staffAdminRecord.record && staffAdminRecord.record.id) {
                    staffAdminIds = [staffAdminRecord.record.id];
                    console.log(`[Knack Script] Found staff admin record ID from email lookup: ${staffAdminRecord.record.id}`);
                  }
                } catch (err) {
                  console.error(`[Knack Script] Error looking up staff admin record by email:`, err);
                }
              }
              
              // Add text value
              if (staffAdminValue) {
                results[staffAdminLookup.targetField] = staffAdminValue;
                console.log(`[Knack Script] Found Staff Admin: ${staffAdminValue}`);
              }
              
              // Add ID array - important for Knack connection fields
              if (staffAdminIds.length > 0) {
                results[staffAdminLookup.targetField + "_id"] = staffAdminIds;
                console.log(`[Knack Script] Found Staff Admin IDs: ${JSON.stringify(staffAdminIds)}`);
              }
            }
            
            // Add student record ID as user account ID (critical for object_6 connection)
            if (studentResult.record.id) {
              // Use the student record ID directly
              results["user_account_id"] = studentResult.record.id;
              console.log(`[Knack Script] Found Student Record ID (for User Connection): ${studentResult.record.id}`);
            }
          }
        } catch (error) {
          console.error('[Knack Script] Error looking up Student record:', error);
        }
      }
      
      // Log all the results for debugging
      console.log("[Knack Script] Complete connection fields lookup results:");
      for (const [key, value] of Object.entries(results)) {
        console.log(`- ${key}: ${value}`);
      }
      
      // Send the results back to the React app
      if (iframeWindow) {
        iframeWindow.postMessage({
          type: 'CONNECTION_FIELDS_RESULT',
          success: true,
          data: results,
          timestamp: new Date().toISOString()
        }, origin);
      }
    } catch (error) {
      console.error('[Knack Script] Error processing connection fields lookup:', error);
      if (iframeWindow) {
        iframeWindow.postMessage({
          type: 'CONNECTION_FIELDS_RESULT',
          success: false,
          error: error.message || 'Unknown error',
          data: results,
          timestamp: new Date().toISOString()
        }, origin);
      }
    }
  }
  
  // Get the user's StudyPlan record to use for connection fields
  async function getUserStudyPlanRecord(userId) {
    console.log(`[Knack Script] Fetching StudyPlan record for user ${userId}`);
    
    // Look up the user's record in STUDYPLANNER_OBJECT (object_110) by userId field
    const filters = encodeURIComponent(JSON.stringify({
      match: 'and',
      rules: [{ field: FIELD_MAPPING.userId, operator: 'is', value: userId }]
    }));
    
    const apiCall = () => new Promise((resolve, reject) => {
      $.ajax({
        url: `${KNACK_API_URL}/objects/${STUDYPLANNER_OBJECT}/records?filters=${filters}`,
        type: 'GET',
        headers: saveQueue.getKnackHeaders(),
        data: { format: 'raw' }, // Request raw format to get connection IDs
        success: function(response) {
          if (response && response.records && response.records.length > 0) {
            // *** ADDED LOGGING HERE ***
            debugLog('[Knack Script] Raw StudyPlan Record Fetched in getUserStudyPlanRecord', response.records[0]);
            resolve(response.records[0]);
          } else {
            resolve(null);
          }
        },
        error: function(jqXHR, textStatus, errorThrown) {
          const error = new Error(`Failed to fetch StudyPlan record: ${jqXHR.status} ${errorThrown}`);
          reject(error);
        }
      });
    });
    
    try {
      return await retryApiCall(apiCall);
    } catch (error) {
      console.error(`[Knack Script] Error fetching StudyPlan record:`, error);
      return null;
    }
  }
  
  // Helper function to lookup a record by email
  async function lookupRecordByEmail(objectKey, emailField, email) {
    if (!email) {
      return { success: false, error: 'Email is required' };
    }
    
    console.log(`[Knack Script] Looking up ${objectKey} record by email: ${email}`);
    
    // Create filter to find by email - use both exact match and contains for better results
    const filters = encodeURIComponent(JSON.stringify({
      match: 'or',
      rules: [
        {
          field: emailField,
          operator: 'is',
          value: email
        },
        {
          field: emailField,
          operator: 'contains',
          value: email
        },
        // Also try field_70 which is sometimes used for email
        {
          field: 'field_70',
          operator: 'is',
          value: email
        },
        {
          field: 'field_70',
          operator: 'contains',
          value: email
        }
      ]
    }));
    
    const apiCall = () => new Promise((resolve, reject) => {
      $.ajax({
        url: `${KNACK_API_URL}/objects/${objectKey}/records?filters=${filters}`,
        type: 'GET',
        headers: saveQueue.getKnackHeaders(),
        data: { format: 'raw' },
        success: resolve,
        error: (jqXHR, textStatus, errorThrown) => {
          const error = new Error(`Failed to lookup record by email: ${jqXHR.status} ${errorThrown}`);
          error.status = jqXHR.status;
          error.responseText = jqXHR.responseText;
          reject(error);
        }
      });
    });
    
    try {
      const response = await retryApiCall(apiCall);
      
      // Check if we found any records
      if (response && response.records && response.records.length > 0) {
        return {
          success: true,
          record: response.records[0]
        };
      } else {
        return {
          success: true,
          record: null
        };
      }
    } catch (error) {
      console.error(`[Knack Script] Error looking up record by email ${email}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error looking up record'
      };
    }
  }
  
  // Helper function to extract a field value from a record
  function extractFieldValue(record, fieldKey) {
    if (!record || !fieldKey) return null;
    
    // Log what we're extracting for debugging
    console.log(`[Knack Script] Extracting value for field: ${fieldKey}`);
    
    // Get the raw field value
    const rawValue = record[fieldKey];
    if (rawValue === undefined || rawValue === null || rawValue === '') return null;
    
    // Log the raw value type for debugging
    console.log(`[Knack Script] Raw value for field ${fieldKey}:`, 
                typeof rawValue, 
                Array.isArray(rawValue) ? 'array' : '', 
                rawValue && typeof rawValue === 'object' ? 'keys: ' + Object.keys(rawValue).join(',') : '');
    
    // Try to get HTML content that might contain email addresses
    const htmlContent = typeof rawValue === 'string' && rawValue.includes('<a href="mailto:');
    if (htmlContent) {
      console.log(`[Knack Script] Field ${fieldKey} contains HTML with email links`);
      return sanitizeField(rawValue); // Our updated sanitizeField will extract emails from HTML
    }
    
    // Check if this is a connection field (which typically has _raw suffix with more data)
    const rawFieldKey = `${fieldKey}_raw`;
    if (record[rawFieldKey]) {
      console.log(`[Knack Script] Found ${rawFieldKey} field, checking it first`);
      
      // Handle array of connections
      if (Array.isArray(record[rawFieldKey]) && record[rawFieldKey].length > 0) {
        console.log(`[Knack Script] ${rawFieldKey} is an array with ${record[rawFieldKey].length} items`);
        
        // Extract email identifiers from connections - prioritize email properties
        for (const item of record[rawFieldKey]) {
          // Look for email format properties first
          if (item.email) {
            const email = sanitizeField(item.email);
            console.log(`[Knack Script] Found email in raw field array: ${email}`);
            return email;
          }
          
          if (item.identifier && typeof item.identifier === 'string' && item.identifier.includes('@')) {
            const email = sanitizeField(item.identifier);
            console.log(`[Knack Script] Found email-like identifier in raw field array: ${email}`);
            return email;
          }
        }
        
        // If no emails found, fall back to first identifier
        if (record[rawFieldKey][0].identifier) {
          const identifier = sanitizeField(record[rawFieldKey][0].identifier);
          console.log(`[Knack Script] No email found, using identifier from raw field array: ${identifier}`);
          return identifier;
        }
      }
      // Single connection object
      else if (typeof record[rawFieldKey] === 'object' && record[rawFieldKey] !== null) {
        console.log(`[Knack Script] ${rawFieldKey} is a single object`);
        
        // Prioritize email properties
        if (record[rawFieldKey].email) {
          const email = sanitizeField(record[rawFieldKey].email);
          console.log(`[Knack Script] Found email in raw field object: ${email}`);
          return email;
        }
        
        if (record[rawFieldKey].identifier) {
          const identifier = sanitizeField(record[rawFieldKey].identifier);
          console.log(`[Knack Script] Found identifier in raw field object: ${identifier}`);
          return identifier;
        }
      }
    }
    
    // Try direct value if raw field didn't provide a value
    if (typeof rawValue === 'string') {
      const value = sanitizeField(rawValue);
      console.log(`[Knack Script] Field is a direct string: ${value}`);
      return value;
    } 
    // Handle arrays
    else if (Array.isArray(rawValue)) {
      console.log(`[Knack Script] Field is an array with ${rawValue.length} items`);
      if (rawValue.length === 0) return null;
      
      // Check for email-like values first
      for (const item of rawValue) {
        if (typeof item === 'string' && item.includes('@')) {
          const email = sanitizeField(item);
          console.log(`[Knack Script] Found email-like string in array: ${email}`);
          return email;
        }
        
        if (typeof item === 'object' && item !== null) {
          if (item.email) {
            const email = sanitizeField(item.email);
            console.log(`[Knack Script] Found email in array object: ${email}`);
            return email;
          }
          if (item.identifier && typeof item.identifier === 'string' && item.identifier.includes('@')) {
            const email = sanitizeField(item.identifier);
            console.log(`[Knack Script] Found email-like identifier in array object: ${email}`);
            return email;
          }
        }
      }
      
      // If no emails found, fall back to first item
      if (typeof rawValue[0] === 'string') {
        const value = sanitizeField(rawValue[0]);
        console.log(`[Knack Script] Using first string from array: ${value}`);
        return value;
      } else if (typeof rawValue[0] === 'object' && rawValue[0] !== null) {
        if (rawValue[0].identifier) {
          const identifier = sanitizeField(rawValue[0].identifier);
          console.log(`[Knack Script] Using identifier from first array object: ${identifier}`);
          return identifier;
        }
      }
    } 
    // Handle direct object
    else if (typeof rawValue === 'object' && rawValue !== null) {
      console.log(`[Knack Script] Field is a direct object`);
      
      // Check for object with email property
      if (rawValue.email) {
        const email = sanitizeField(rawValue.email);
        console.log(`[Knack Script] Found email property in object: ${email}`);
        return email;
      }
      
      // Fall back to identifier
      if (rawValue.identifier) {
        const identifier = sanitizeField(rawValue.identifier);
        console.log(`[Knack Script] Found identifier property in object: ${identifier}`);
        return identifier;
      }
    }
    
    console.log(`[Knack Script] No suitable value found for field: ${fieldKey}`);
    return null;
  }

})(); // End of IIFE

