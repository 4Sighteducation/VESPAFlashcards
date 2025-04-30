// knack-integration.js - Safe for public GitHub repository
// Version: 5x (Introduces SaveQueue and corrected message handling)
(function () {
    // --- Configuration and Constants ---
    // Moved config-dependent constants into initializeFlashcardApp
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
   
    const TOPIC_CURRICULUM_OBJECT = 'object_109'; // Topic curriculum data object
    
    // Topic curriculum object field mapping
    const TOPIC_FIELD_MAPPING = {
      examType: 'field_3035',
      examBoard: 'field_3034',
      subject: 'field_3033',
      module: 'field_3036',
      topic: 'field_3037',
      subtopic: 'field_3038'
    };

    // --- Helper Functions (Copied/Adapted from 5w) ---
  
// Enhanced URI component decoding function with better error handling
function safeDecodeURIComponent(str) {
  if (!str) return str;
  // Check if it looks like it needs decoding
  if (typeof str === 'string' && !str.includes('%')) return str;
  
  try {
    // Handle plus signs as spaces which sometimes occur
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch (error) {
    console.error("Flashcard app: Error decoding URI component:", error, "String:", String(str).substring(0, 100));
    
    try {
      // First attempt to fix potentially invalid % sequences
      const cleaned = String(str).replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
      return decodeURIComponent(cleaned.replace(/\+/g, ' '));
    } catch (secondError) {
      console.error("Flashcard app: Second attempt to decode failed:", secondError);
      
      try {
        // Third attempt: Try more aggressive cleaning - handle truncated URIs by removing trailing %
        const aggressiveCleaned = String(str)
          .replace(/%(?![0-9A-Fa-f]{2})/g, '%25')  // Fix invalid % sequences
          .replace(/%[0-9A-Fa-f]$/g, '%25')        // Fix truncated % at end
          .replace(/%[0-9A-Fa-f](?![0-9A-Fa-f])/g, '%25'); // Fix single-digit % sequences
        
        return decodeURIComponent(aggressiveCleaned.replace(/\+/g, ' '));
      } catch (thirdError) {
        console.error("Flashcard app: Third attempt to decode failed:", thirdError);
        
        // Last resort - try to extract any valid JSON
        try {
          // Look for valid JSON patterns and try to extract them
          const jsonPattern = /\[(.*)\]|\{(.*)\}/;
          const match = String(str).match(jsonPattern);
          if (match) {
            console.warn("Flashcard app: Attempting JSON extraction from corrupted URI");
            const extracted = match[0];
            return extracted;
          }
        } catch (e) {
          console.error("Flashcard app: JSON extraction attempt failed");
        }
        
        // Give up and return the original string
        return String(str);
      }
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
  
// Enhanced JSON parsing function with better recovery
function safeParseJSON(jsonString, defaultVal = null) {
    if (!jsonString) return defaultVal;
    try {
        // If it's already an object (e.g., from Knack raw format), return it directly
        if (typeof jsonString === 'object' && jsonString !== null) return jsonString;
        // Attempt standard parsing
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn("Flashcard app: Initial JSON parse failed:", error, "String:", String(jsonString).substring(0, 100));
        
        // Attempt recovery for common issues
        try {
            // Remove potential leading/trailing whitespace or BOM
            const cleanedString = String(jsonString).trim().replace(/^\uFEFF/, '');
            // Try common fixes like escaped quotes, trailing commas
            const recovered = cleanedString
                .replace(/\\"/g, '"') // Fix incorrectly escaped quotes
                .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
                .replace(/\n/g, ' ') // Remove newlines
                .replace(/\r/g, ' ') // Remove carriage returns
                .replace(/\t/g, ' '); // Remove tabs
            
            const result = JSON.parse(recovered);
            console.log("Flashcard app: JSON recovery successful.");
            return result;
        } catch (secondError) {
            console.error("Flashcard app: JSON recovery failed:", secondError);
            
            // More aggressive approach - try to extract anything that looks like JSON
            try {
                console.warn("Flashcard app: Attempting aggressive JSON extraction");
                
                // Try to extract array or object pattern
                let extractedJson = null;
                const jsonString = String(jsonString);
                
                // Look for array pattern [...]
                if (jsonString.includes('[') && jsonString.includes(']')) {
                    const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
                    if (arrayMatch) extractedJson = arrayMatch[0];
                }
                // Look for object pattern {...}
                else if (jsonString.includes('{') && jsonString.includes('}')) {
                    const objectMatch = jsonString.match(/\{[\s\S]*\}/);
                    if (objectMatch) extractedJson = objectMatch[0];
                }
                
                if (extractedJson) {
                    // Try parsing the extracted pattern
                    const result = JSON.parse(extractedJson);
                    console.log("Flashcard app: Aggressive JSON recovery successful");
                    return result;
                }
            } catch (thirdError) {
                console.error("Flashcard app: Aggressive JSON recovery failed:", thirdError);
            }
            
            // Return the default value if all parsing fails
            return defaultVal;
        }
    }
}
  
  
    // Check if a string is a valid Knack record ID
    function isValidKnackId(id) {
      if (!id) return false;
      return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);
    }
  
    // Helper function to clean HTML from IDs
    function cleanHtmlFromId(idString) {
      if (!idString) return null;
      if (typeof idString === 'object' && idString.id) {
        // If it's already an object containing the ID, clean the ID within it.
        return { id: cleanHtmlFromId(idString.id) }; // Return object structure if needed
         // Or just return the cleaned ID: return cleanHtmlFromId(idString.id);
      }
      const str = String(idString); // Ensure it's a string
      if (str.includes('<')) {
        console.warn("Cleaning HTML from potential ID:", str);
        // Match Knack's span format: <span class="kn-tag ..."><a href=...>ID</a></span>
        // Or simpler formats like <span class="...">ID</span>
        const spanMatch = str.match(/<span[^>]*>([^<]+)<\/span>/) || str.match(/<a[^>]*>([^<]+)<\/a>/);
        if (spanMatch && spanMatch[1]) {
           const potentialId = spanMatch[1].trim();
           console.log("Extracted potential ID from HTML:", potentialId);
           return potentialId;
        }
        // Fallback: strip all HTML tags
        const stripped = str.replace(/<[^>]+>/g, '').trim();
         console.log("Stripped HTML:", stripped);
        return stripped;
      }
      return str; // Return as is if no HTML detected
    }
  
  
    // Extract a valid record ID from various formats
   function extractValidRecordId(value) {
       if (!value) return null;
  
       // If it's already an object (like Knack connection field data)
       if (typeof value === 'object') {
           // Check common properties: 'id', 'identifier', or if it's an array with one object
           let idToCheck = null;
           if (value.id) {
               idToCheck = value.id;
           } else if (value.identifier) {
               idToCheck = value.identifier;
           } else if (Array.isArray(value) && value.length === 1 && value[0].id) {
               // Handle cases where connection is an array with one record
               idToCheck = value[0].id;
           } else if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') {
                // Handle array with just the ID string
                idToCheck = value[0];
           }
  
  
           if (idToCheck) {
               const cleanedId = cleanHtmlFromId(idToCheck); // Clean potential HTML
               return isValidKnackId(cleanedId) ? cleanedId : null;
           }
       }
  
       // If it's a string
       if (typeof value === 'string') {
           const cleanedId = cleanHtmlFromId(value); // Clean potential HTML
           return isValidKnackId(cleanedId) ? cleanedId : null;
       }
  
       return null; // Return null if no valid ID found
   }
  
  
    // Safely remove HTML from strings
    function sanitizeField(value) {
      if (value === null || value === undefined) return "";
      const strValue = String(value); // Convert to string first
      // Remove HTML tags using a non-greedy match
      let sanitized = strValue.replace(/<[^>]*?>/g, "");
      // Remove common markdown characters
      sanitized = sanitized.replace(/[*_~`#]/g, "");
      // Replace HTML entities (basic set)
      sanitized = sanitized
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&nbsp;/g, " "); // Replace non-breaking space
      return sanitized.trim();
    }
  
  
    // Debug logging helper
    function debugLog(title, data) {
      console.log(`%c[Knack Script] ${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
      // Attempt to deep clone for logging to avoid showing proxies or complex objects directly
      try {
         console.log(JSON.parse(JSON.stringify(data, null, 2)));
      } catch (e) {
         console.log("Data could not be fully serialized for logging:", data); // Log original if clone fails
      }
      return data; // Return data for chaining
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
  
              // Check for specific error conditions if needed (e.g., 401/403 for auth)
              // For now, retry on any failure up to maxRetries
              if (retryCount < maxRetries -1) { // Retry maxRetries-1 times
                const retryDelay = delay * Math.pow(2, retryCount); // Exponential backoff
                console.log(`Retrying API call in ${retryDelay}ms...`);
                setTimeout(() => attempt(retryCount + 1), retryDelay);
              } else {
                 console.error(`API call failed after ${maxRetries} attempts.`);
                reject(error); // Max retries reached
              }
            });
        };
        attempt(0);
      });
    }
  
     // Function to refresh authentication (Placeholder - Knack.getUserToken usually sufficient)
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
     function handleTokenRefresh(iframeWindow) { // Added iframeWindow param
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
        this.retryAttempts = new Map(); // Tracks retries per operation instance
        this.maxRetries = 3;
        this.retryDelay = 1000; // Start with 1 second
      }
  
      // Adds an operation to the queue and returns a promise that resolves/rejects on completion/failure
      addToQueue(operation) {
        return new Promise((resolve, reject) => {
           // Basic validation of operation
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
          this.processQueue(); // Attempt to process immediately
        });
      }
  
      // Processes the next operation in the queue if not already saving
      async processQueue() {
        if (this.isSaving || this.queue.length === 0) {
          // console.log(`[SaveQueue] Skipping processQueue. isSaving: ${this.isSaving}, Queue length: ${this.queue.length}`);
          return;
        }
  
        this.isSaving = true;
        const operation = this.queue[0]; // Get the first operation (FIFO)
        console.log(`[SaveQueue] Processing operation: ${operation.type} for record ${operation.recordId}`);
  
        try {
          const updateData = await this.prepareSaveData(operation);
          // --- DEBUG: Log prepared data before save attempt ---
          console.log(`[SaveQueue DEBUG] Data prepared for API PUT (Record ${operation.recordId}):`, JSON.stringify(updateData));
          debugLog("[SaveQueue] Prepared update data (Detailed)", updateData); // Keep detailed log too
          // --- END DEBUG ---
          const response = await this.performSave(updateData, operation.recordId);
          // --- DEBUG: Log API response on success --- 
          console.log(`[SaveQueue DEBUG] API PUT success response (Record ${operation.recordId}):`, JSON.stringify(response));
          debugLog("[SaveQueue] API Save successful (Detailed)", response); // Keep detailed log
          // --- END DEBUG ---
          this.handleSaveSuccess(operation);
        } catch (error) {
           // Error should be the original error object from performSave or prepareSaveData
           console.error(`[SaveQueue] Error during processing for ${operation.type} (record ${operation.recordId}):`, error);
           this.handleSaveError(operation, error); // Pass the actual error object
        } finally {
            // Ensure isSaving is reset ONLY if the queue is empty or the next attempt failed immediately
             if (this.queue.length === 0 || !this.isSaving) { // Check isSaving again in case retry logic reset it
                this.isSaving = false;
                // console.log("[SaveQueue] Reset isSaving flag.");
             }
        }
      }
  
       // Prepares the final data payload for the Knack API PUT request
       async prepareSaveData(operation) {
           const { type, data, recordId, preserveFields } = operation;
           // 'data' here is the object received from postMessage, containing raw JS objects/arrays
           console.log(`[SaveQueue] Preparing save data for type: ${type}, record: ${recordId}, preserveFields: ${preserveFields}`);
           debugLog("[SaveQueue] Raw data received by prepareSaveData:", data);

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
                        // If fetch fails, we cannot reliably preserve. Should we fail the operation?
                        // Option 1: Fail the operation
                        // throw new Error(`Failed to fetch existing data for preservation: ${fetchError.message}`);
                        // Option 2: Proceed without preservation (potentially overwriting data)
                        console.warn("[SaveQueue] Proceeding with save WITHOUT field preservation due to fetch error.");
                        existingData = null; // Ensure existingData is null so preserve logic skips
                   }
               }
  
               // Add data based on operation type
               switch (type) {
                   // --- REVISED: Stringify data *here* before assigning to updateData ---
                   case 'cards': // Assuming this type might still be used elsewhere? If not, remove.
                       updateData[FIELD_MAPPING.cardBankData] = JSON.stringify(
                           this.ensureSerializable(data.cards || []) // data.cards should be the raw array
                       );
                       console.log("[SaveQueue] Stringified cardBankData for 'cards' save.");
                       break;
                   case 'colors': // Assuming this type might still be used elsewhere?
                       updateData[FIELD_MAPPING.colorMapping] = JSON.stringify(
                           this.ensureSerializable(data.colorMapping || {}) // data.colorMapping should be the raw object
                       );
                       console.log("[SaveQueue] Stringified colorMapping for 'colors' save.");
                       break;
                   // REMOVED 'topics' case as topicLists are no longer saved separately
                   /* case 'topics': 
                       updateData[FIELD_MAPPING.topicLists] = JSON.stringify(
                           this.ensureSerializable(data.topicLists || [])
                       );
                       console.log("[SaveQueue] Stringified topicLists for 'topics' save.");
                       break; */
                   case 'full': // This is the primary case used now
                       console.log("[SaveQueue] Preparing 'full' save data by stringifying fields.");
                       // 'data' contains the raw JS objects/arrays (cards, colorMapping, etc.)
                       
                       // --- Restoring processing of actual data --- 
                       if (data.cards !== undefined) {
                           updateData[FIELD_MAPPING.cardBankData] = JSON.stringify(this.ensureSerializable(data.cards || []));
                       }
                       if (data.colorMapping !== undefined) {
                           updateData[FIELD_MAPPING.colorMapping] = JSON.stringify(this.ensureSerializable(data.colorMapping || {}));
                       }
                       if (data.spacedRepetition !== undefined) {
                           const srData = data.spacedRepetition || {};
                           if (srData.box1 !== undefined) updateData[FIELD_MAPPING.box1Data] = JSON.stringify(this.ensureSerializable(srData.box1 || []));
                           if (srData.box2 !== undefined) updateData[FIELD_MAPPING.box2Data] = JSON.stringify(this.ensureSerializable(srData.box2 || []));
                           if (srData.box3 !== undefined) updateData[FIELD_MAPPING.box3Data] = JSON.stringify(this.ensureSerializable(srData.box3 || []));
                           if (srData.box4 !== undefined) updateData[FIELD_MAPPING.box4Data] = JSON.stringify(this.ensureSerializable(srData.box4 || []));
                           if (srData.box5 !== undefined) updateData[FIELD_MAPPING.box5Data] = JSON.stringify(this.ensureSerializable(srData.box5 || []));
                       }
                       if (data.topicMetadata !== undefined) {
                           updateData[FIELD_MAPPING.topicMetadata] = JSON.stringify(this.ensureSerializable(data.topicMetadata || []));
                       }
                       // --- End restoring processing --- 
                       break;
                   default:
                       console.error(`[SaveQueue] Unknown save operation type: ${type}`);
                       throw new Error(`Unknown save operation type: ${type}`);
               }
               // --- END REVISION ---
  
               // If preserving fields and we successfully fetched existing data, merge
               if (preserveFields && existingData) {
                    console.log(`[SaveQueue] Merging prepared data with existing data for record ${recordId}`);
                   this.preserveExistingFields(updateData, existingData);
                   debugLog("[SaveQueue] Merged data after preservation", updateData);
               } else if (preserveFields && !existingData) {
                   console.warn(`[SaveQueue] Cannot preserve fields for record ${recordId} because existing data could not be fetched.`);
               }
  
               return updateData; // Return the final payload
  
           } catch (error) {
                console.error(`[SaveQueue] Error in prepareSaveData for type ${type}:`, error);
               throw error; // Re-throw the error to be caught by processQueue
           }
       }
  
  
      // Fetches current record data from Knack
      async getExistingData(recordId) {
         console.log(`[SaveQueue] Fetching existing data for record ${recordId}`);
         const apiCall = () => {
             return new Promise((resolve, reject) => {
                 $.ajax({
                   url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`,
                   type: 'GET',
                   headers: this.getKnackHeaders(), // Use headers method
                    data: { format: 'raw' }, // Request raw format if needed for connections
                   success: function(response) {
                     console.log(`[SaveQueue] Successfully fetched existing data for record ${recordId}`);
                     resolve(response);
                   },
                   error: function(jqXHR, textStatus, errorThrown) {
                      // Log more detailed error info
                      console.error(`[SaveQueue] Error fetching existing data for record ${recordId}: Status ${jqXHR.status} - ${errorThrown}`, jqXHR.responseText);
                      // Create a more informative error object
                      const error = new Error(`Failed to fetch record ${recordId}: ${jqXHR.status} ${errorThrown}`);
                      error.status = jqXHR.status;
                      error.responseText = jqXHR.responseText;
                      reject(error);
                   }
                 });
             });
         };
         // Use retry mechanism for fetching, fail if retries exhausted
         return retryApiCall(apiCall);
      }
  
  
      // Merges updateData with existingData, preserving specific fields if they aren't explicitly included in updateData
      preserveExistingFields(updateData, existingData) {
          console.log(`[SaveQueue] Preserving fields for record. Fields in updateData: ${Object.keys(updateData).join(', ')}`);
         // Define all fields managed by the app that could be preserved
         const allAppFieldIds = [
            FIELD_MAPPING.cardBankData, FIELD_MAPPING.colorMapping, FIELD_MAPPING.topicLists,
            FIELD_MAPPING.topicMetadata, FIELD_MAPPING.box1Data, FIELD_MAPPING.box2Data,
            FIELD_MAPPING.box3Data, FIELD_MAPPING.box4Data, FIELD_MAPPING.box5Data
            // Add other fields here if the app manages them directly
         ];
  
         allAppFieldIds.forEach(fieldId => {
            // If the update payload *does not* already include this field,
            // but the existing record *does* have data for it, preserve it.
            if (updateData[fieldId] === undefined && existingData[fieldId] !== undefined && existingData[fieldId] !== null) {
               console.log(`[SaveQueue] Preserving existing data for field ID: ${fieldId}`);
               updateData[fieldId] = existingData[fieldId]; // Copy existing value
            }
         });
          // Note: lastSaved is always updated, so it's not preserved from existingData.
      }
  
  
      // Performs the actual Knack API PUT request
      async performSave(updateData, recordId) {
         console.log(`[SaveQueue] Performing API save for record ${recordId}`);
         if (!recordId) {
             throw new Error("Cannot perform save: recordId is missing.");
         }
          if (Object.keys(updateData).length <= 1 && updateData[FIELD_MAPPING.lastSaved]) {
              console.warn(`[SaveQueue] Save payload for record ${recordId} only contains lastSaved timestamp. Skipping API call.`);
              return { message: "Save skipped, only timestamp update." }; // Return a success-like response
          }
  
  
         const apiCall = () => {
             return new Promise((resolve, reject) => {
                 $.ajax({
                   url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`,
                   type: 'PUT',
                   headers: this.getKnackHeaders(), // Use headers method
                   data: JSON.stringify(updateData), // Send prepared data
                   success: function(response) {
                      // --- DEBUG: Log success directly --- 
                      console.log(`[SaveQueue DEBUG] AJAX PUT success for record ${recordId}`);
                      // --- END DEBUG ---
                      console.log(`[SaveQueue] API PUT successful for record ${recordId}`);
                      resolve(response);
                   },
                   error: function(jqXHR, textStatus, errorThrown) {
                       // --- DEBUG: Log error directly --- 
                       console.error(`[SaveQueue DEBUG] AJAX PUT failed for record ${recordId}. Status: ${jqXHR.status}, Error: ${errorThrown}`);
                       // --- END DEBUG ---
                       // Log more detailed error info
                      console.error(`[SaveQueue] API PUT failed for record ${recordId}: Status ${jqXHR.status} - ${errorThrown}`, jqXHR.responseText);
                       // Create a more informative error object
                      const error = new Error(`API Save failed for record ${recordId}: ${jqXHR.status} ${errorThrown}`);
                      error.status = jqXHR.status;
                      error.responseText = jqXHR.responseText;
                      reject(error); // Reject with the error object
                   }
                 });
             });
         };
         // Use retry mechanism for saving, fail if retries exhausted
         return retryApiCall(apiCall);
      }
  
  
      // Handles successful save completion for an operation
      handleSaveSuccess(operation) {
        const completedOperation = this.queue.shift(); // Remove the completed operation
        if (completedOperation !== operation) {
            console.error("[SaveQueue] Mismatch between completed operation and head of queue!", operation, completedOperation);
            // Attempt recovery - find and remove the operation if possible
            const opIndex = this.queue.findIndex(op => op === operation);
            if(opIndex > -1) this.queue.splice(opIndex, 1);
        }
        this.retryAttempts.delete(operation); // Clear retry attempts for this operation
        console.log(`[SaveQueue] Operation ${operation.type} succeeded for record ${operation.recordId}. Queue length: ${this.queue.length}`);
        operation.resolve(true); // Resolve the promise associated with the operation
        this.isSaving = false; // Allow next operation
        this.processQueue(); // Process next item if any
      }
  
       // Handles save errors, implements retry logic
       handleSaveError(operation, error) {
           // Ensure operation is still at the head of the queue before retrying/failing
           if (this.queue[0] !== operation) {
              console.warn(`[SaveQueue] Stale error encountered for operation ${operation.type} (record ${operation.recordId}). Operation no longer at head of queue. Ignoring error.`);
               // We might not want to reset isSaving here if another operation is now processing
               // Check if another save is now in progress
               if (!this.isSaving && this.queue.length > 0) {
                   this.processQueue(); // Try processing the new head
               }
              return;
           }
  
           const attempts = (this.retryAttempts.get(operation) || 0) + 1; // Increment attempt count
           const errorMessage = error instanceof Error ? error.message : String(error);
           console.error(`[SaveQueue] Save error for ${operation.type} (record ${operation.recordId}, Attempt ${attempts}/${this.maxRetries}):`, errorMessage, error);
  
           if (attempts < this.maxRetries) {
               this.retryAttempts.set(operation, attempts);
               const delay = this.retryDelay * Math.pow(2, attempts - 1); // Exponential backoff
               console.log(`[SaveQueue] Retrying operation ${operation.type} (record ${operation.recordId}) in ${delay}ms...`);
               // IMPORTANT: Reset isSaving BEFORE the timeout to allow processing to restart
               this.isSaving = false;
               setTimeout(() => {
                   console.log(`[SaveQueue] Attempting retry for ${operation.type} (record ${operation.recordId}) after delay.`);
                   this.processQueue(); // Attempt to process the queue again
               }, delay);
           } else {
               console.error(`[SaveQueue] Max retries reached for operation ${operation.type} (record ${operation.recordId}). Aborting.`);
               const failedOperation = this.queue.shift(); // Remove the failed operation
               if (failedOperation !== operation) {
                   console.error("[SaveQueue] Mismatch during failure handling!", operation, failedOperation);
               }
               this.retryAttempts.delete(operation); // Clear retry attempts
               // Reject the promise with the last error
               operation.reject(error || new Error(`Save failed after ${this.maxRetries} retries`));
               this.isSaving = false; // Allow next operation
               this.processQueue(); // Process next item if any
           }
       }
  
  
      // Helper to get standard Knack API headers
      getKnackHeaders() {
        // Ensure Knack and getUserToken are available
         if (typeof Knack === 'undefined' || typeof Knack.getUserToken !== 'function') {
            console.error("[SaveQueue] Knack object or getUserToken function not available.");
            // Handle this scenario, maybe by rejecting operations immediately
            throw new Error("Knack authentication context not available.");
         }
         const token = Knack.getUserToken();
         if (!token) {
             console.warn("[SaveQueue] Knack user token is null or undefined. API calls may fail.");
              // Consider throwing an error if token is mandatory
              // throw new Error("Knack user token is missing.");
         }
        return {
          'X-Knack-Application-Id': knackAppId,
          'X-Knack-REST-API-Key': knackApiKey,
          'Authorization': token || '', // Send empty string if token is null
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
                   // Circular reference found, return undefined to omit key
                   return undefined; // Or return '[Circular]' string if preferred
                 }
                 // Store value in our collection
                 cache.add(value);
               }
               return value;
             }));
          } catch (parseError) {
             console.error("[SaveQueue] Failed to serialize data even after attempting to strip circular references:", parseError);
             return data; // Return original data as a last resort
          }
        }
      }
    }
  
    // --- Create Singleton Instance ---
    const saveQueue = new SaveQueue();
  
    // --- Knack Integration Initialization ---
    // REMOVED Old Scene Render Listener

    // Declare variables needed within initializeFlashcardApp in a higher scope
    let knackAppId;
    let knackApiKey;
    let FLASHCARD_APP_URL;
    let APP_CONTAINER_SELECTOR;

    // Initialize the React app
    // Expose this function globally for the loader script (v3.16+)
    window.initializeFlashcardApp = function() {
      console.log("Initializing Flashcard React app (Version 5x with SaveQueue - Loader Compatible)"); // Updated log

      // --- Initialize Config-Dependent Constants HERE ---
      if (!window.VESPA_CONFIG) {
          console.error("Flashcard app: Critical Error - window.VESPA_CONFIG is not defined!");
          // Optionally, display an error message to the user in the placeholder
          const container = document.querySelector('.kn-rich-text') || document.getElementById('view_3005') || document.getElementById('kn-scene_1206');
          if (container) container.innerHTML = '<p style="color: red;">Error: Flashcard App Configuration Missing.</p>';
          return; // Stop initialization
      }
      knackAppId = window.VESPA_CONFIG.knackAppId;
      knackApiKey = window.VESPA_CONFIG.knackApiKey;
      FLASHCARD_APP_URL = window.VESPA_CONFIG.appUrl || 'https://default-fallback-url-if-needed.com'; // Get App URL directly
      APP_CONTAINER_SELECTOR = window.VESPA_CONFIG.elementSelector || '.kn-rich-text'; // Get selector from config, fallback
      // Log the derived constants
      console.log(`Flashcard app: Using knackAppId: ${knackAppId ? 'Set' : 'Not Set'}`);
      console.log(`Flashcard app: Using knackApiKey: ${knackApiKey ? 'Set' : 'Not Set'}`);
      console.log(`Flashcard app: Using FLASHCARD_APP_URL: ${FLASHCARD_APP_URL}`);
      console.log(`Flashcard app: Using APP_CONTAINER_SELECTOR: ${APP_CONTAINER_SELECTOR}`);
      // ----------------------------------------------------

      // Check if necessary config exists directly on window.VESPA_CONFIG (redundant check, but safe)
      // The check above for window.VESPA_CONFIG is the primary one.
      if (!knackAppId || !knackApiKey || !FLASHCARD_APP_URL) {
          console.error("Flashcard app: Missing required configuration values (appId, apiKey, or appUrl) after checking VESPA_CONFIG.");
          return;
      }

      // Check if user is authenticated
      if (typeof Knack === 'undefined' || !Knack.getUserToken) {
          console.error("Flashcard app: Knack context or getUserToken not available.");
          return; // Cannot proceed without Knack context
      }
  
      if (Knack.getUserToken()) {
        console.log("Flashcard app: User is authenticated");
        const userToken = Knack.getUserToken();
        const appId = Knack.application_id;
        const user = Knack.getUserAttributes();
  
        console.log("Flashcard app: Basic user info:", user);
        window.currentKnackUser = user; // Store basic info globally first
  
        // Get complete user data (async)
        getCompleteUserData(user.id, function(completeUserData) {
          if (completeUserData) {
              // Enhance global user object with complete data
            window.currentKnackUser = Object.assign({}, user, completeUserData);
            debugLog("Enhanced global user object", window.currentKnackUser);
          } else {
            console.warn("Flashcard app: Could not get complete user data, continuing with basic info");
          }
          // Proceed with initialization using the (potentially enhanced) global user object
          // Remove the undefined 'config' variable from this call
          // continueInitialization(config, userToken, appId); // Original call
          continueInitialization(userToken, appId); // CORRECTED call
        });
  
      } else {
        console.error("Flashcard app: User is not authenticated (Knack.getUserToken() returned null/false).");
         // Handle cases where user might be logged out or session expired
         // Maybe display a message or attempt re-login if applicable
      }
    } // <<< END OF initializeFlashcardApp FUNCTION DEFINITION

    // --- PASTE THE INITIALIZATION BLOCK HERE ---
    // Ensure Knack context and jQuery might be ready, or handle checks inside initializeFlashcardApp
    /* // START COMMENT BLOCK
    console.log("Flashcards1h.js: Reached execution point after initializeFlashcardApp definition."); // Updated Log
    console.log("Flashcards1h.js: Type of initializeFlashcardApp:", typeof initializeFlashcardApp); // Check type here

    if (typeof $ !== 'undefined' && typeof Knack !== 'undefined') {
        console.log("Flashcards1h.js: Knack and $ ready. Type of initializeFlashcardApp:", typeof "initializeFlashcardApp");
        if (typeof initializeFlashcardApp === 'function') {
            initializeFlashcardApp(); // CALL IT HERE
        } else {
             console.error("Flashcards1h.js: initializeFlashcardApp is NOT a function here!");
        }
    } else {
         // Fallback: Wait a very short moment
         console.error("Flashcards1h.js: Knack or $ not immediately ready, delaying init slightly.");
         setTimeout(() => {
             console.log("Flashcards1h.js: Delayed check. Type of initializeFlashcardApp:", typeof initializeFlashcardApp);
             if (typeof $ !== 'undefined' && typeof Knack !== 'undefined') {
                 console.log("Flashcards1h.js: Delayed initialization starting.");
                 if (typeof initializeFlashcardApp === 'function') {
                     initializeFlashcardApp(); // CALL IT HERE (Delayed)
                 } else {
                      console.error("Flashcards1h.js: initializeFlashcardApp is NOT a function after delay!");
                 }
             } else {
                  console.error("Flashcards1h.js: Knack or $ still not ready after delay. Initialization failed.");
             }
         }, 100);
    }
    */ // END COMMENT BLOCK
    // --- END OF PASTED BLOCK ---
  
     // Continue initialization after potentially fetching complete user data
     // Remove 'config' parameter from function definition as well
     // function continueInitialization(config, userToken, appId) { // config param is no longer used here
     function continueInitialization(userToken, appId) { // CORRECTED definition
         const currentUser = window.currentKnackUser; // Use the globally stored (potentially enhanced) user object
  
         // Extract and store connection field IDs safely
         currentUser.emailId = extractValidRecordId(currentUser.id); // User's own record ID
         currentUser.schoolId = extractValidRecordId(currentUser.school || currentUser.field_122); // Check both possible field names
         currentUser.tutorId = extractValidRecordId(currentUser.tutor);
         currentUser.roleId = extractValidRecordId(currentUser.role);
  
         debugLog("FINAL CONNECTION FIELD IDs", {
           emailId: currentUser.emailId,
           schoolId: currentUser.schoolId,
           tutorId: currentUser.tutorId,
           roleId: currentUser.roleId
         });
  
         // Find or create container for the app
          let container = document.querySelector(APP_CONTAINER_SELECTOR);
          // Fallback selectors (can likely be simplified if only using .kn-rich-text)
          if (!container) container = document.querySelector('.kn-rich-text');
          if (!container) {
              const viewElement = document.getElementById('view_3005') || document.querySelector('.view_3005');
              if (viewElement) {
                  console.log("Creating container inside view_3005");
                  container = document.createElement('div');
                  container.id = 'flashcard-app-container-generated';
                  viewElement.appendChild(container);
              }
          }
          // Final fallback to scene
          if (!container) {
               const sceneElement = document.getElementById('kn-scene_1206');
               if (sceneElement) {
                   console.log("Creating container inside scene_1206");
                   container = document.createElement('div');
                   container.id = 'flashcard-app-container-generated';
                   sceneElement.appendChild(container);
               } else {
                   console.error("Flashcard app: Cannot find any suitable container for the app.");
                   return; // Stop if no container found
               }
          }
  
  
         container.innerHTML = ''; // Clear existing content
  
         // Loading indicator
         const loadingDiv = document.createElement('div');
         loadingDiv.id = 'flashcard-loading-indicator';
         loadingDiv.innerHTML = '<p>Loading Flashcard App...</p>';
          loadingDiv.style.padding = '20px';
          loadingDiv.style.textAlign = 'center';
         container.appendChild(loadingDiv);
  
         // Create iframe
         const iframe = document.createElement('iframe');
         iframe.id = 'flashcard-app-iframe';
         iframe.style.width = '100%';
         iframe.style.minHeight = '800px'; // Use min-height for flexibility
         iframe.style.border = 'none';
         iframe.style.display = 'none'; // Hide initially
         iframe.src = FLASHCARD_APP_URL; // Use the direct URL variable
         container.appendChild(iframe);
  
          // --- Central Message Listener ---
          // Setup listener ONCE
          // Remove previous listener if re-initializing (though full page reload is more common)
         // window.removeEventListener('message', window.flashcardMessageHandler); // Remove old if exists
  
          const messageHandler = function(event) {
              // --- DEBUG: Log raw event and data --- 
              console.log("[Knack Script] Raw Message Event Received:", event); 
              try {
                  // Attempt to log event.data safely, handling potential circular refs
                  const dataString = JSON.stringify(event.data, (key, value) => {
                      if (typeof value === 'object' && value !== null) {
                          // Basic cycle detection (not foolproof)
                          if (key === 'source' || key === 'target' || key === 'currentTarget') return '[Window]'; // Avoid logging window objects
                      }
                      return value;
                  }, 2); 
                  console.log("[Knack Script] Raw event.data:", dataString);
              } catch (e) {
                  console.error("[Knack Script] Error stringifying event.data:", e);
                  console.log("[Knack Script] Raw event.data (logging directly):", event.data);
              }
              // --- END DEBUG ---

              // IMPORTANT: Check origin for security if appUrl is known and consistent
              // const expectedOrigin = new URL(config.appUrl).origin;
              // if (event.origin !== expectedOrigin) {
              //   console.warn("Ignoring message from unexpected origin:", event.origin, "Expected:", expectedOrigin);
              //   return;
              // }
  
              // Only accept messages from the created iframe's contentWindow
              // --- ADDED CHECK: Ensure iframe and iframe.contentWindow exist --- 
              if (!iframe || !iframe.contentWindow || event.source !== iframe.contentWindow) { 
                  // console.log("Ignoring message not from iframe source or iframe invalid."); 
                  return;
              }
              // --- END ADDED CHECK --- 

              // --- REVISED: Get type and the full data object correctly ---
              const messageType = event.data?.type; // Get the type safely
              const messageData = event.data; // Get the whole data object
              // const { type, data } = event.data; // REMOVE incorrect destructuring
              // --- END REVISION ---

              // Log message receipt
              if (messageType !== 'PING') { // Use messageType
                  console.log(`[Knack Script] Received message type: ${messageType}`);
                  // debugLog("[Knack Script] Message data:", data); // Optional: Log data for debugging
              }
  
              // Handle APP_READY separately to send initial data
               if (messageType === 'APP_READY') { // Use messageType
                window.flashcardAppIframeWindow = iframe.contentWindow; // Store reference globally
                   console.log("Flashcard app: React app reported APP_READY.");
                    // Double check if user object is ready
                    if (!window.currentKnackUser || !window.currentKnackUser.id) {
                        console.error("Cannot send initial info: Current Knack user data not ready.");
                        return;
                    }
  
                   loadingDiv.innerHTML = '<p>Loading User Data...</p>'; // Update loading message
  
                   loadFlashcardUserData(window.currentKnackUser.id, function(userData) {
                        // Ensure iframeWindow is still valid
                       if (iframe && iframe.contentWindow) { 
                           const initialData = {
                               type: 'KNACK_USER_INFO',
                               data: {
                                   // Use the potentially enhanced currentUser from the outer scope
                                   id: window.currentKnackUser.id,
                                   email: window.currentKnackUser.email,
                                   name: window.currentKnackUser.name || '',
                                   token: userToken, // Pass the token obtained earlier
                                   appId: appId,     // Pass the appId obtained earlier
                                   userData: userData || {}, // Send loaded data or empty object
                                   // Send derived connection IDs too
                                   emailId: window.currentKnackUser.emailId,
                                   schoolId: window.currentKnackUser.schoolId,
                                   tutorId: window.currentKnackUser.tutorId,
                                   roleId: window.currentKnackUser.roleId
                               }
                           };
                           debugLog("--> Sending KNACK_USER_INFO to React App", initialData.data);
                           // --- FIX: Use iframe.contentWindow --- 
                           iframe.contentWindow.postMessage(initialData, '*'); 

                           // Show iframe after sending initial data
                           loadingDiv.style.display = 'none';
                           iframe.style.display = 'block';
                            console.log("Flashcard app initialized and visible.");
                       } else {
                            console.warn("[Knack Script] Iframe window no longer valid when sending initial data.");
                       }
                   });
               } else {
                  // Delegate other messages to the central handler
                  // --- CORRECTED: Pass iframe.contentWindow to handleMessageRouter --- 
                  handleMessageRouter(messageType, messageData, iframe.contentWindow); 
                  // --- END CORRECTION ---
               }
         };
  
         window.addEventListener('message', messageHandler);
         // Store handler reference if needed for removal later: window.flashcardMessageHandler = messageHandler;
  
         console.log("Flashcard app initialization sequence complete. Waiting for APP_READY from iframe.");
     }
  
  
    // --- Central Message Router ---
    // Routes messages received from the React app iframe to specific handlers
    function handleMessageRouter(type, data, iframeWindow) { // 'data' here IS the full messageData object
      // Basic validation
      if (!type) {
          console.warn("[Knack Script] Received message without type.");
          return;
      }
       if (!iframeWindow) {
           console.error("[Knack Script] iframeWindow is missing in handleMessageRouter. Cannot send response.");
           return;
       }
  
  
      console.log(`[Knack Script] Routing message type: ${type}`);
  
      switch (type) {
        case 'SAVE_DATA':
          handleSaveDataRequest(data, iframeWindow); // Pass the full messageData object
          break;
        case 'ADD_TO_BANK':
          handleAddToBankRequest(data, iframeWindow); // Pass iframeWindow
          break;
        case 'TOPIC_LISTS_UPDATED':
          handleTopicListsUpdatedRequest(data, iframeWindow); // Pass iframeWindow
          break;
        case 'REQUEST_TOKEN_REFRESH':
           handleTokenRefresh(iframeWindow); // Pass iframeWindow
           break;
        case 'RELOAD_APP_DATA':
           handleReloadRequest(data, iframeWindow); // Pass iframeWindow
           break;
        case 'REQUEST_UPDATED_DATA':
           handleDataUpdateRequest(data, iframeWindow); // Pass iframeWindow
           break;
         case 'AUTH_CONFIRMED': // React confirms it received auth
             console.log("[Knack Script] React App confirmed auth.");
             // Could hide loading indicator here if it wasn't already hidden
             const loadingIndicator = document.getElementById('flashcard-loading-indicator');
              if (loadingIndicator) loadingIndicator.style.display = 'none';
              const appIframe = document.getElementById('flashcard-app-iframe');
              if (appIframe) appIframe.style.display = 'block';
             break;
         case 'REQUEST_RECORD_ID':
             handleRecordIdRequest(data, iframeWindow); // Pass iframeWindow
             break;
             case 'KNACK_REQUEST':
                // Log the request for debugging
                console.log(`[Knack Script] Received KNACK_REQUEST:`, data);
                
                // Reconstruct the full message structure that handleKnackRequest expects
                handleKnackRequest({
                  action: data.action,
                  data: data.data,
                  requestId: data.requestId
                }, iframeWindow);
                break;
        case 'DELETE_SUBJECT':
            handleDeleteSubjectRequest(data, iframeWindow);
            break;
        case 'DELETE_TOPIC':
            handleDeleteTopicRequest(data, iframeWindow);
            break;
        // Add other cases for messages from React app as needed
        default:
          console.warn(`[Knack Script] Unhandled message type: ${type}`);
      }
    }
  
  
    // --- Specific Message Handlers (Using Save Queue & Correct PostMessage Target) ---
  
    // Handles 'SAVE_DATA' request from React app
    // --- RENAMED PARAMETER from 'data' to 'saveDataMessage' ---
    async function handleSaveDataRequest(saveDataMessage, iframeWindow) { 
      console.log("[Knack Script] Handling SAVE_DATA request");
      // --- Added Detailed Logging ---
      // This should now log the actual object received
      console.log("[Knack Script] Received SAVE_DATA payload:", JSON.stringify(saveDataMessage, null, 2)); 
      // --- End Added Logging ---
      // --- Use RENAMED PARAMETER --- 
      if (!saveDataMessage || !saveDataMessage.recordId) { 
          console.error("[Knack Script] SAVE_DATA request missing recordId.");
           // CORRECTION: Target iframeWindow for response
          if (iframeWindow) iframeWindow.postMessage({ type: 'SAVE_RESULT', success: false, error: "Missing recordId" }, '*');
          return;
      }
      // --- Use RENAMED PARAMETER --- 
      debugLog("[Knack Script] Data received for SAVE_DATA:", saveDataMessage);
  
      try {
        // Validate and structure colorMapping before saving
        if (saveDataMessage.colorMapping) {
          console.log("[Knack Script] Validating color mapping structure before save");
          saveDataMessage.colorMapping = ensureValidColorMapping(saveDataMessage.colorMapping);
        }
        
        // Add the 'full' save operation to the queue
        await saveQueue.addToQueue({
          type: 'full',
          // --- Use RENAMED PARAMETER --- 
          data: saveDataMessage, // Pass the whole data object received
          recordId: saveDataMessage.recordId,
          preserveFields: saveDataMessage.preserveFields || false // Default preserveFields to false if not provided
        });

        console.log(`[Knack Script] SAVE_DATA for record ${saveDataMessage.recordId} completed successfully.`);
        // --- FIX: Re-get iframe reference before sending result back --- 
        const iframeEl = document.getElementById('flashcard-app-iframe');
        if (iframeEl && iframeEl.contentWindow) { 
            console.log("[Knack Script] Attempting to send SAVE_RESULT back to React app.");
            iframeEl.contentWindow.postMessage({ type: 'SAVE_RESULT', success: true, timestamp: new Date().toISOString() }, '*'); // Send success
            console.log("[Knack Script] SAVE_RESULT sent.");
        } else {
            console.error("[Knack Script] Cannot send SAVE_RESULT: iframe or contentWindow not found.");
        }
        // --- END FIX ---
  
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Knack Script] SAVE_DATA failed for record ${saveDataMessage.recordId}:`, errorMessage);
        // --- FIX: Re-get iframe reference before sending result back --- 
        const iframeEl = document.getElementById('flashcard-app-iframe');
        if (iframeEl && iframeEl.contentWindow) { 
            console.log("[Knack Script] Attempting to send SAVE_RESULT (failure) back to React app.");
            iframeEl.contentWindow.postMessage({ type: 'SAVE_RESULT', success: false, error: errorMessage || 'Unknown save error' }, '*'); // Send failure
            console.log("[Knack Script] SAVE_RESULT (failure) sent.");
        } else {
            console.error("[Knack Script] Cannot send SAVE_RESULT (failure): iframe or contentWindow not found.");
        }
        // --- END FIX ---
      }
    }
  
    // Handles 'ADD_TO_BANK' request from React app
    async function handleAddToBankRequest(data, iframeWindow) {
      console.log("[Knack Script] Handling ADD_TO_BANK request");
       if (!data || !data.recordId || !data.cards) {
           console.error("[Knack Script] ADD_TO_BANK request missing recordId or cards.");
            // CORRECTION: Target iframeWindow for response
           if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: false, error: "Missing recordId or cards" }, '*');
           return;
       }
       debugLog("[Knack Script] Data received for ADD_TO_BANK:", data);
  
       // --- Merge with existing card bank data BEFORE queuing ---
       try {
           console.log(`[Knack Script] Fetching existing data before ADD_TO_BANK for record ${data.recordId}`);
           const existingData = await saveQueue.getExistingData(data.recordId); // Use SaveQueue's fetcher
  
            // Standardize the NEW cards first
           const newCardsStandardized = standardizeCards(data.cards || []);
           const newCardCount = newCardsStandardized.length;
            if (newCardCount === 0) {
                 console.log("[Knack Script] No valid new cards to add.");
                  if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: true, shouldReload: false, message: "No new cards to add." }, '*');
                  return; // Nothing to do
            }
  
  
           // Parse existing card bank
           let existingItems = [];
           if (existingData && existingData[FIELD_MAPPING.cardBankData]) {
               try {
                   let bankDataStr = existingData[FIELD_MAPPING.cardBankData];
                    if (typeof bankDataStr === 'string' && bankDataStr.includes('%')) {
                       bankDataStr = safeDecodeURIComponent(bankDataStr);
                    }
                   existingItems = safeParseJSON(bankDataStr, []); // Default to empty array on parse failure
               } catch (parseError) {
                   console.error("[Knack Script] Error parsing existing card bank data for ADD_TO_BANK:", parseError);
                   existingItems = []; // Start fresh if parsing fails critically
               }
           }
  
           // Split existing into shells and cards
           const { topics: existingTopicShells, cards: existingCards } = splitByType(existingItems);
  
           // Deduplicate: Ensure new cards aren't already in existing cards
           const existingCardIds = new Set(existingCards.map(c => c.id));
           const cardsToAdd = newCardsStandardized.filter(nc => !existingCardIds.has(nc.id));
           const skippedCount = newCardCount - cardsToAdd.length;
           if (skippedCount > 0) {
               console.log(`[Knack Script] Skipped ${skippedCount} cards already present in the bank.`);
           }
            if (cardsToAdd.length === 0) {
                 console.log("[Knack Script] All new cards were duplicates or invalid.");
                  if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: true, shouldReload: false, message: "All submitted cards already exist." }, '*');
                  return; // Nothing to add
            }
  
  
           // Combine existing shells/cards with the NEW, deduplicated cards
           const finalBankData = [...existingTopicShells, ...existingCards, ...cardsToAdd];
           console.log(`[Knack Script] Merged ${cardsToAdd.length} new cards with ${existingCards.length} existing cards and ${existingTopicShells.length} shells.`);
  
           // --- Prepare Box 1 Update ---
            let box1Data = [];
            if (existingData && existingData[FIELD_MAPPING.box1Data]) {
               try {
                   let box1String = existingData[FIELD_MAPPING.box1Data];
                   if (typeof box1String === 'string' && box1String.includes('%')) {
                       box1String = safeDecodeURIComponent(box1String);
                   }
                   box1Data = safeParseJSON(box1String, []); // Default to empty array
               } catch(parseError) {
                  console.error("[Knack Script] Error parsing Box 1 data:", parseError);
                  box1Data = [];
               }
            }
  
            const now = new Date().toISOString();
            const existingBox1Map = new Map(box1Data.map(entry => [entry.cardId, true]));
            // Add ONLY the newly added cards to Box 1
            const newBox1Entries = cardsToAdd
              .filter(card => card.id && !existingBox1Map.has(card.id))
              .map(card => ({ cardId: card.id, lastReviewed: now, nextReviewDate: now }));
  
            const updatedBox1 = [...box1Data, ...newBox1Entries];
            console.log(`[Knack Script] Added ${newBox1Entries.length} new entries to Box 1.`);
  
           // --- Queue a 'full' save operation with merged data ---
           const fullSaveData = {
               // We are providing the specific fields to update within the 'data' object for the 'full' type
               cards: finalBankData, // The fully merged card bank
               spacedRepetition: { // Include the updated Box 1
                   box1: updatedBox1
                   // Other boxes will be preserved because preserveFields is true
               }
               // Other fields like colorMapping, topicLists will be preserved from existingData
           };
  
           await saveQueue.addToQueue({
             type: 'full',
             data: fullSaveData, // Pass the object containing the fields to update
             recordId: data.recordId,
             preserveFields: true // CRITICAL: ensure other fields (colors, topics, other boxes) are preserved
           });
  
           console.log(`[Knack Script] ADD_TO_BANK for record ${data.recordId} completed successfully.`);
           // CORRECTION: Target iframeWindow for response
           if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: true, shouldReload: true }, '*'); // Signal reload might be needed
  
       } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
           console.error(`[Knack Script] ADD_TO_BANK failed during data preparation or queuing for record ${data.recordId}:`, errorMessage, error);
           // CORRECTION: Target iframeWindow for response
           if (iframeWindow) iframeWindow.postMessage({ type: 'ADD_TO_BANK_RESULT', success: false, error: errorMessage || 'Unknown add to bank error' }, '*');
       }
    }
  
  
    // Handles 'TOPIC_LISTS_UPDATED' request from React app
    async function handleTopicListsUpdatedRequest(data, iframeWindow) {
       console.log("[Knack Script] Handling TOPIC_LISTS_UPDATED request");
        if (!data || !data.recordId || !data.topicLists) {
            console.error("[Knack Script] TOPIC_LISTS_UPDATED request missing recordId or topicLists.");
             // CORRECTION: Target iframeWindow for response
            if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_LISTS_UPDATE_RESULT', success: false, error: "Missing recordId or topicLists" }, '*');
            return;
        }
        debugLog("[Knack Script] Data received for TOPIC_LISTS_UPDATED:", data);
  
        try {
           // Step 1: Save the topicLists data itself using the queue
           console.log(`[Knack Script] Queuing save for topicLists field (${FIELD_MAPPING.topicLists}) for record ${data.recordId}`);
           await saveQueue.addToQueue({
              type: 'topics', // Specific type for saving just the topic lists field
              data: data.topicLists, // The array of topic lists
              recordId: data.recordId,
              preserveFields: true // Preserve other fields like card bank, colors etc.
           });
           console.log(`[Knack Script] Successfully queued save for topicLists for record ${data.recordId}.`);
  
           // Step 2: Trigger topic shell creation/update based on the *just saved* lists.
           console.log(`[Knack Script] Triggering topic shell creation/update based on updated lists for record ${data.recordId}.`);
           // This function handles fetching existing data, generating/merging shells, and queuing the final save.
           await createTopicShellsFromLists(data.topicLists, data.recordId, iframeWindow); // Pass iframeWindow for potential feedback within shell creation
  
           console.log(`[Knack Script] TOPIC_LISTS_UPDATED for record ${data.recordId} processed.`);
           // Notify React app - Success here means the process was *initiated* successfully
            // CORRECTION: Target iframeWindow for response
           if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_LISTS_UPDATE_RESULT', success: true, timestamp: new Date().toISOString() }, '*');
  
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
           console.error(`[Knack Script] TOPIC_LISTS_UPDATED failed for record ${data.recordId}:`, errorMessage, error);
           // CORRECTION: Target iframeWindow for response
           if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_LISTS_UPDATE_RESULT', success: false, error: errorMessage || 'Unknown topic list update error' }, '*');
        }
    }
  
     // Handle RELOAD_APP_DATA request
     async function handleReloadRequest(data, iframeWindow) {
         console.log("[Knack Script] Handling RELOAD_APP_DATA request");
         const userId = window.currentKnackUser?.id;
         if (!userId) {
             console.error("[Knack Script] Cannot reload data - user ID not found.");
             if (iframeWindow) iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'User ID not found' }, '*');
             return;
         }
  
         loadFlashcardUserData(userId, function(userData) {
             // CORRECTION: Target iframeWindow for response
             if (userData && iframeWindow) {
                 console.log("[Knack Script] Sending refreshed data to React app (on reload request)");
                 iframeWindow.postMessage({
                     type: 'KNACK_DATA', // Send as KNACK_DATA type
                     cards: userData.cards || [],
                     colorMapping: userData.colorMapping || {},
                     topicLists: userData.topicLists || [],
                     topicMetadata: userData.topicMetadata || [], // Include metadata if loaded
                     spacedRepetition: userData.spacedRepetition || {}, // Include SR data
                     recordId: userData.recordId,
                     auth: { id: userId, email: window.currentKnackUser?.email, name: window.currentKnackUser?.name || '' },
                     timestamp: new Date().toISOString()
                 }, '*');
             } else if (iframeWindow) {
                 console.error("[Knack Script] Error loading updated data for reload");
                 iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'Failed to load data for reload' }, '*');
             }
         });
     }
  
      // Handle REQUEST_UPDATED_DATA request
      async function handleDataUpdateRequest(data, iframeWindow) {
          console.log("[Knack Script] Handling REQUEST_UPDATED_DATA request");
          const userId = window.currentKnackUser?.id;
          const recordId = data?.recordId; // Get recordId from message
  
          if (!userId) {
              console.error("[Knack Script] Cannot refresh data - user ID not found.");
               // CORRECTION: Target iframeWindow for response
              if (iframeWindow) iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'User ID not found' }, '*');
              return;
          }
           if (!recordId) {
               console.error("[Knack Script] Cannot refresh data - missing record ID in request");
                // CORRECTION: Target iframeWindow for response
               if (iframeWindow) iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'Missing record ID in request' }, '*');
               return;
           }
  
          // Use loadFlashcardUserData which inherently gets the latest for that user
          loadFlashcardUserData(userId, function(userData) {
               // CORRECTION: Target iframeWindow for response
              if (userData && iframeWindow) {
                  // Ensure the loaded data corresponds to the requested recordId
                  if (userData.recordId === recordId) {
                     console.log("[Knack Script] Sending refreshed data to React app (on request)");
                     iframeWindow.postMessage({
                         type: 'KNACK_DATA',
                         cards: userData.cards || [],
                         colorMapping: userData.colorMapping || {},
                         topicLists: userData.topicLists || [],
                         topicMetadata: userData.topicMetadata || [], // Include metadata
                         spacedRepetition: userData.spacedRepetition || {}, // Include SR data
                         recordId: userData.recordId, // Send the confirmed recordId
                         auth: { id: userId, email: window.currentKnackUser?.email, name: window.currentKnackUser?.name || '' },
                         timestamp: new Date().toISOString()
                     }, '*');
                  } else {
                     // This case should be rare if the React app correctly maintains the recordId
                     console.warn(`[Knack Script] Loaded data record ID (${userData.recordId}) does not match requested record ID (${recordId}). This might indicate an issue. Sending loaded data anyway.`);
                      iframeWindow.postMessage({
                         type: 'KNACK_DATA', // Still send data
                         cards: userData.cards || [],
                         colorMapping: userData.colorMapping || {},
                         topicLists: userData.topicLists || [],
                         topicMetadata: userData.topicMetadata || [],
                          spacedRepetition: userData.spacedRepetition || {},
                         recordId: userData.recordId, // Send the actual loaded recordId
                         auth: { id: userId, email: window.currentKnackUser?.email, name: window.currentKnackUser?.name || '' },
                         timestamp: new Date().toISOString()
                     }, '*');
                  }
              } else if (iframeWindow) {
                  console.error("[Knack Script] Error loading updated data (on request)");
                  iframeWindow.postMessage({ type: 'DATA_REFRESH_ERROR', error: 'Failed to load data' }, '*');
              }
          });
      }
  
       // Handle REQUEST_RECORD_ID request
       async function handleRecordIdRequest(data, iframeWindow) {
           console.log("[Knack Script] Handling REQUEST_RECORD_ID request");
           const userId = window.currentKnackUser?.id;
           if (!userId) {
               console.error("[Knack Script] Cannot get record ID - user ID not found.");
                // CORRECTION: Target iframeWindow for response
                if (iframeWindow) iframeWindow.postMessage({ type: 'RECORD_ID_ERROR', error: 'User ID not found' }, '*'); // Removed backslash before closing quote
               return;
           }
  
           // Use loadFlashcardUserData to find the record ID associated with the current user
           loadFlashcardUserData(userId, function(userData) {
                // CORRECTION: Target iframeWindow for response
               if (userData && userData.recordId && iframeWindow) {
                   console.log(`[Knack Script] Found record ID: ${userData.recordId}`);
                   iframeWindow.postMessage({
                       type: 'RECORD_ID_RESPONSE',
                       recordId: userData.recordId,
                       timestamp: new Date().toISOString()
                   }, '*');
               } else if (iframeWindow) {
                   console.error(`[Knack Script] Could not find record ID for user ${userId}`);
                   iframeWindow.postMessage({
                       type: 'RECORD_ID_ERROR',
                       error: 'Record ID not found',
                       timestamp: new Date().toISOString()
                   }, '*');
               }
           });
       }
  
  
// Handles requests to Knack's object_109 for curriculum data
async function handleKnackRequest(data, iframeWindow) {
    console.log("[Knack Script] Handling KNACK_REQUEST:", data.action);
    
    if (!data || !data.action || !data.requestId) {
      console.error("[Knack Script] Invalid KNACK_REQUEST: Missing action or requestId");
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'KNACK_RESPONSE', 
        requestId: data?.requestId || 'unknown',
        error: "Invalid request format" 
      }, '*');
      return;
    }
    
    try {
      switch (data.action) {
        case 'GET_SUBJECTS':
          await handleGetSubjectsRequest(data, iframeWindow);
          break;
        case 'GET_TOPICS':
          await handleGetTopicsRequest(data, iframeWindow);
          break;
        default:
          console.warn(`[Knack Script] Unhandled KNACK_REQUEST action: ${data.action}`);
          if (iframeWindow) iframeWindow.postMessage({ 
            type: 'KNACK_RESPONSE', 
            requestId: data.requestId,
            error: `Unknown action: ${data.action}` 
          }, '*');
      }
    } catch (error) {
      console.error(`[Knack Script] Error handling ${data.action} request:`, error);
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'KNACK_RESPONSE', 
        requestId: data.requestId,
        error: error.message || "Error processing request" 
      }, '*');
    }
  }
  
  // Handles GET_SUBJECTS requests to get subjects for a given exam type and board
  async function handleGetSubjectsRequest(data, iframeWindow) {
    console.log(`[Knack Script] Handling GET_SUBJECTS for ${data.data.examType}, ${data.data.examBoard}`);
    
    const { examType, examBoard } = data.data;
    if (!examType || !examBoard) {
      throw new Error("Missing required parameters: examType or examBoard");
    }
    
    // Build filters for the API call
    const filters = {
      match: 'and',
      rules: [
        { field: TOPIC_FIELD_MAPPING.examType, operator: 'is', value: examType },
        { field: TOPIC_FIELD_MAPPING.examBoard, operator: 'is', value: examBoard }
      ]
    };
    
    // Make API call to Knack
    const apiCall = () => new Promise((resolve, reject) => {
      $.ajax({
        url: `${KNACK_API_URL}/objects/${TOPIC_CURRICULUM_OBJECT}/records`,
        type: 'GET',
        headers: saveQueue.getKnackHeaders(),
        data: {
          format: 'raw', 
          filters: JSON.stringify(filters)
        },
        success: resolve,
        error: reject
      });
    });
    
    // Execute API call with retry logic
    const response = await retryApiCall(apiCall);
    
    // Process the results
    if (response && response.records) {
      // Extract unique subjects from results
      const subjects = [...new Set(
        response.records
          .map(record => record[TOPIC_FIELD_MAPPING.subject])
          .filter(subject => subject) // Filter out null/undefined/empty
      )];
      
      console.log(`[Knack Script] Found ${subjects.length} subjects for ${examType}, ${examBoard}`);
      
      // Send response back to React app
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'KNACK_RESPONSE', 
        requestId: data.requestId,
        data: subjects 
      }, '*');
    } else {
      // No results found
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'KNACK_RESPONSE', 
        requestId: data.requestId,
        data: [] 
      }, '*');
    }
  }
  
  // Handles GET_TOPICS requests to get topics for a given subject, exam type, and board
  async function handleGetTopicsRequest(data, iframeWindow) {
    console.log(`[Knack Script] Handling GET_TOPICS for ${data.data.subject}, ${data.data.examType}, ${data.data.examBoard}`);
    
    const { subject, examType, examBoard } = data.data;
    if (!subject || !examType || !examBoard) {
      throw new Error("Missing required parameters: subject, examType, or examBoard");
    }
    
    // Build filters for the API call
    const filters = {
      match: 'and',
      rules: [
        { field: TOPIC_FIELD_MAPPING.subject, operator: 'is', value: subject },
        { field: TOPIC_FIELD_MAPPING.examType, operator: 'is', value: examType },
        { field: TOPIC_FIELD_MAPPING.examBoard, operator: 'is', value: examBoard }
      ]
    };
    
    // Make API call to Knack
    const apiCall = () => new Promise((resolve, reject) => {
      $.ajax({
        url: `${KNACK_API_URL}/objects/${TOPIC_CURRICULUM_OBJECT}/records`,
        type: 'GET',
        headers: saveQueue.getKnackHeaders(),
        data: {
          format: 'raw', 
          filters: JSON.stringify(filters)
        },
        success: resolve,
        error: reject
      });
    });
    
    // Execute API call with retry logic
    const response = await retryApiCall(apiCall);
    
    // Process the results
    if (response && response.records && response.records.length > 0) {
      // Format the results for the React app
      const topicsData = response.records.map(record => {
        // Extract all relevant fields
        const result = {};
        Object.entries(TOPIC_FIELD_MAPPING).forEach(([key, fieldId]) => {
          result[key] = record[fieldId] || "";
        });
        return result;
      });
      
      console.log(`[Knack Script] Found ${topicsData.length} topics for ${subject}, ${examType}, ${examBoard}`);
      
      // Send response back to React app
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'KNACK_RESPONSE', 
        requestId: data.requestId,
        data: topicsData 
      }, '*');
    } else {
      // No results found
      if (iframeWindow) iframeWindow.postMessage({ 
        type: 'KNACK_RESPONSE', 
        requestId: data.requestId,
        data: [] 
      }, '*');
    }
  }

    // --- Data Loading and Utility Functions (Adapted from 5w) ---
  
    // Get complete user data from Knack (Object_3)
    function getCompleteUserData(userId, callback) {
      console.log("[Knack Script] Getting complete user data for:", userId);
      const apiCall = () => new Promise((resolve, reject) => {
          $.ajax({
              url: `${KNACK_API_URL}/objects/object_3/records/${userId}`, // Assuming object_3 is user object
              type: 'GET',
              headers: saveQueue.getKnackHeaders(), // Use headers method from SaveQueue instance
               data: { format: 'raw' }, // Request raw format
              success: resolve,
              error: reject // Let retryApiCall handle error details
          });
      });
  
      retryApiCall(apiCall)
          .then(response => {
              console.log("[Knack Script] Complete user data received.");
              debugLog("[Knack Script] Raw Complete User Data:", response);
              callback(response); // Pass raw response
          })
          .catch(error => {
              console.error("[Knack Script] Error retrieving complete user data:", error);
              callback(null); // Indicate failure
          });
    }
  
     // Load user's flashcard data (Object_102) - Enhanced for multi-subject support
function loadFlashcardUserData(userId, callback) {
  console.log(`[Knack Script] Loading flashcard user data for user ID: ${userId}`);
  const findRecordApiCall = () => new Promise((resolve, reject) => {
      // --- DEBUG: Log API call details ---
      console.log(`[loadFlashcardUserData DEBUG] Making GET request to ${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records with filter for userId: ${userId}`);
      // --- END DEBUG ---
      $.ajax({
          url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records`,
          type: 'GET',
          headers: saveQueue.getKnackHeaders(), // Use headers from queue instance
          data: {
              format: 'raw', // Important: Use raw format
              filters: JSON.stringify({
                  match: 'and',
                  rules: [{ field: FIELD_MAPPING.userId, operator: 'is', value: userId }]
              })
          },
          success: (response) => { // Changed to arrow function for consistent logging context
              // --- DEBUG: Log success --- 
              console.log(`[loadFlashcardUserData DEBUG] GET request succeeded. Response records count: ${response?.records?.length || 0}`);
              // --- END DEBUG ---
              resolve(response);
          },
          error: (jqXHR, textStatus, errorThrown) => { // Changed to arrow function
             // --- DEBUG: Log failure --- 
             console.error(`[loadFlashcardUserData DEBUG] GET request failed. Status: ${jqXHR.status}, Error: ${errorThrown}`);
             // --- END DEBUG ---
             const error = new Error(`Failed find record for user ${userId}: ${jqXHR.status} ${errorThrown}`);
             error.status = jqXHR.status;
             error.responseText = jqXHR.responseText;
             reject(error);
          }
      });
  });

  retryApiCall(findRecordApiCall)
    .then((response) => {
      // --- DEBUG: Log the response received after retries --- 
      console.log("[loadFlashcardUserData DEBUG] Response object AFTER retryApiCall:", response); 
      debugLog("[loadFlashcardUserData DEBUG] Flashcard User data search response (Detailed):", response);
      // --- END DEBUG ---
      if (response && response.records && response.records.length > 0) {
        const record = response.records[0];
        console.log(`[Knack Script] Found existing flashcard record: ${record.id}`);
        
        try {
            // Use enhanced data processing from MultiSubjectBridge
            const userData = {
                recordId: record.id,
                cards: [],
                spacedRepetition: { box1: [], box2: [], box3: [], box4: [], box5: [] },
                topicLists: [],
                colorMapping: {},
                topicMetadata: [],
                lastSaved: record[FIELD_MAPPING.lastSaved] || null
            };
            
            // Enhanced parsing for cards with better error handling
            const rawCardData = record[FIELD_MAPPING.cardBankData];
            if (rawCardData) {
                try {
                    // First try to decode if needed
                    let decodedData = rawCardData;
                    if (typeof rawCardData === 'string' && rawCardData.includes('%')) {
                        try {
                            decodedData = safeDecodeURIComponent(rawCardData);
                        } catch (decodeError) {
                            console.error('[Knack Script] Error with primary decode, trying backup method:', decodeError);
                            // Try handling broken encodings
                            decodedData = String(rawCardData)
                                .replace(/%(?![0-9A-Fa-f]{2})/g, '%25'); // Fix invalid % sequences
                            try {
                                decodedData = decodeURIComponent(decodedData);
                            } catch (secondError) {
                                console.error('[Knack Script] Advanced URI decode failed, using original:', secondError);
                            }
                        }
                    }
                    
                    // Parse the JSON safely
                    userData.cards = safeParseJSON(decodedData, []);
                    userData.cards = migrateTypeToQuestionType(userData.cards); // Migrate legacy types
                    userData.cards = standardizeCards(userData.cards); // Standardize structure
                } catch (cardError) {
                    console.error('[Knack Script] Fatal error processing cards:', cardError);
                    userData.cards = []; // Reset to empty array
                }
            }
            console.log(`[Knack Script] Loaded ${userData.cards.length} cards/shells from bank.`);
            
            // Enhanced parsing for spaced repetition
            for (let i = 1; i <= 5; i++) {
                const fieldKey = FIELD_MAPPING[`box${i}Data`];
                const boxData = record[fieldKey];
                try {
                    if (boxData) {
                        let decodedBox = boxData;
                        if (typeof boxData === 'string' && boxData.includes('%')) {
                            try {
                                decodedBox = safeDecodeURIComponent(boxData);
                            } catch (e) {
                                console.error(`[Knack Script] Error decoding box${i} data:`, e);
                            }
                        }
                        userData.spacedRepetition[`box${i}`] = safeParseJSON(decodedBox, []);
                    } else {
                        userData.spacedRepetition[`box${i}`] = [];
                    }
                } catch (boxError) {
                    console.error(`[Knack Script] Error processing box${i}:`, boxError);
                    userData.spacedRepetition[`box${i}`] = [];
                }
            }
            console.log(`[Knack Script] Loaded spaced repetition data.`);
            
            // Enhanced parsing for topic lists - CRITICAL for multi-subject
            const rawTopicLists = record[FIELD_MAPPING.topicLists];
            try {
                if (rawTopicLists) {
                    let decodedLists = rawTopicLists;
                    if (typeof rawTopicLists === 'string' && rawTopicLists.includes('%')) {
                        try {
                            decodedLists = safeDecodeURIComponent(rawTopicLists);
                        } catch (decodeError) {
                            console.error('[Knack Script] Topic lists decode error, trying backup:', decodeError);
                            // Try to recover with pattern matching
                            const jsonPattern = /\[\s*\{.*\}\s*\]/s;
                            const match = String(rawTopicLists).match(jsonPattern);
                            if (match) {
                                console.log('[Knack Script] Found JSON pattern in topic lists');
                                decodedLists = match[0];
                            }
                        }
                    }
                    
                    const parsedLists = safeParseJSON(decodedLists, []);
                    
                    // Ensure topic lists have minimal valid structure
                    userData.topicLists = Array.isArray(parsedLists) ? parsedLists.map(list => {
                        // Basic validation
                        if (!list || typeof list !== 'object') return null;
                        
                        // Clean up potentially malformed lists
                        return {
                            subject: list.subject || "General",
                            topics: Array.isArray(list.topics) ? list.topics.filter(Boolean) : [],
                            color: list.color || "#808080"
                        };
                    }).filter(Boolean) : [];
                }
            } catch (listError) {
                console.error('[Knack Script] Error processing topic lists:', listError);
                userData.topicLists = [];
            }
            console.log(`[Knack Script] Loaded ${userData.topicLists.length} topic lists.`);
            
            // Enhanced parsing for color mapping
            const rawColorData = record[FIELD_MAPPING.colorMapping];
            try {
                if (rawColorData) {
                    let decodedColor = rawColorData;
                    if (typeof rawColorData === 'string' && rawColorData.includes('%')) {
                        try {
                            decodedColor = safeDecodeURIComponent(rawColorData);
                        } catch (e) {
                            console.error('[Knack Script] Error decoding color mapping:', e);
                        }
                    }
                    userData.colorMapping = safeParseJSON(decodedColor, {});
                    // Ensure it's an object
                    if (typeof userData.colorMapping !== 'object' || userData.colorMapping === null) {
                        userData.colorMapping = {};
                    }
                }
            } catch (colorError) {
                console.error('[Knack Script] Error processing color mapping:', colorError);
                userData.colorMapping = {};
            }
            console.log(`[Knack Script] Loaded color mapping.`);
            
            // Enhanced parsing for topic metadata
            const rawMetaData = record[FIELD_MAPPING.topicMetadata];
            try {
                if (rawMetaData) {
                    let decodedMeta = rawMetaData;
                    if (typeof rawMetaData === 'string' && rawMetaData.includes('%')) {
                        try {
                            decodedMeta = safeDecodeURIComponent(rawMetaData);
                        } catch (e) {
                            console.error('[Knack Script] Error decoding topic metadata:', e);
                        }
                    }
                    userData.topicMetadata = safeParseJSON(decodedMeta, []);
                    // Ensure it's an array
                    if (!Array.isArray(userData.topicMetadata)) {
                        userData.topicMetadata = [];
                    }
                }
            } catch (metaError) {
                console.error('[Knack Script] Error processing topic metadata:', metaError);
                userData.topicMetadata = [];
            }
            console.log(`[Knack Script] Loaded ${userData.topicMetadata.length} topic metadata items.`);

            debugLog("[Knack Script] ASSEMBLED USER DATA from loaded record", userData);
            callback(userData);
        } catch (e) {
            console.error("[Knack Script] Error processing user data fields:", e);
            // Return partially assembled data or fallback
            callback({ 
                recordId: record.id,
                cards: [],
                topicLists: [],
                colorMapping: {},
                spacedRepetition: { box1: [], box2: [], box3: [], box4: [], box5: [] }
            });
        }

      } else {
        // No existing data, create a new record
        console.log(`[loadFlashcardUserData DEBUG] No existing record found (or response invalid/empty), proceeding to create new record for user ${userId}.`);
        console.log(`[Knack Script] No existing flashcard record found for user ${userId}, creating new one...`);
        createFlashcardUserRecord(userId, function(success, newRecordId, creationError) { // Modify callback to accept error
          if (success && newRecordId) {
             console.log(`[Knack Script] New record created with ID: ${newRecordId}`);
            // Return the default empty structure with the new record ID
            callback({
              recordId: newRecordId,
              cards: [],
              spacedRepetition: { box1: [], box2: [], box3: [], box4: [], box5: [] },
              topicLists: [],
              topicMetadata: [],
              colorMapping: {}
            });
          } else {
              console.error(`[Knack Script] Failed to create new flashcard record for user ${userId}. Initial Error:`, creationError);
              // --- If creation failed due to unique constraint, retry the GET --- 
              const isUniqueError = creationError?.responseText?.includes('must be unique');
              if (isUniqueError) {
                  console.warn(`[Knack Script] Record creation failed due to unique constraint. Retrying GET request for user ${userId}...`);
                  retryApiCall(findRecordApiCall) // Retry the original GET call
                    .then(retryResponse => {
                        if (retryResponse && retryResponse.records && retryResponse.records.length > 0) {
                            console.log("[Knack Script] Successfully found record on retry GET.");
                            const record = retryResponse.records[0];
                            // Process the found record (similar logic to the main .then block)
                            try {
                                const userData = { /* ... assemble userData from record ... */ }; 
                                // Simplified assembly for brevity - ensure full assembly is here
                                userData.recordId = record.id;
                                userData.cards = safeParseJSON(record[FIELD_MAPPING.cardBankData] || '[]');
                                // ... parse other fields ... 
                                console.log("[Knack Script] Assembled user data from retry GET.");
                                callback(userData);
                            } catch (parseError) {
                                console.error("[Knack Script] Error parsing record data on retry GET:", parseError);
                                callback(null);
                            }
                        } else {
                            console.error("[Knack Script] Retry GET failed to find record for user ${userId} even after unique constraint error.");
                            callback(null);
                        }
                    })
                    .catch(retryError => {
                        console.error("[Knack Script] Error during retry GET request:", retryError);
                        callback(null);
                    });
              } else {
                  // Creation failed for a different reason
                  callback(null); // Indicate failure
              }
              // --- End retry logic ---
          }
        });
      }
    })
    .catch((error) => {
      console.error("[loadFlashcardUserData DEBUG] Overall error after findRecordApiCall retries failed:", error);
      console.error("[Knack Script] Error loading flashcard user data after retries:", error.status, error.responseText || error.message);
      callback(null); // Indicate failure
    });
}
  
     // Create a new flashcard user record in Object_102
     // --- Modified to pass error object to callback --- 
     function createFlashcardUserRecord(userId, callback) {
         console.log("[Knack Script] Creating new flashcard user record for:", userId);
         const user = window.currentKnackUser; // Assumes global user object is populated
  
          if (!user) {
              console.error("[Knack Script] Cannot create record: window.currentKnackUser is not defined.");
              callback(false, null, new Error("User object is not defined."));
              return;
          }
  
  
         // Initialize an empty color mapping structure
         const initialColorMapping = {};
         
         // Predefined colors for subjects
         const subjectPalette = [
             '#4363d8', // Blue
             '#3cb44b', // Green 
             '#e6194B', // Red
             '#ffe119', // Yellow
             '#911eb4', // Purple
             '#f58231', // Orange
             '#42d4f4', // Light Blue
             '#469990', // Teal
             '#9A6324', // Brown
             '#800000'  // Maroon
         ];
         
         // If there's any subject info in the user object, pre-populate the mapping with distinct colors
         if (user.subjects && Array.isArray(user.subjects)) {
             user.subjects.forEach((subject, index) => {
                 if (subject && typeof subject === 'string') {
                     initialColorMapping[subject] = {
                         base: subjectPalette[index % subjectPalette.length],
                         topics: {}
                     };
                 }
             });
         }
  
         // Basic data structure for a new record
         const data = {
             [FIELD_MAPPING.userId]: userId, // Link to the user ID (text field)
             [FIELD_MAPPING.userEmail]: sanitizeField(user.email),
             [FIELD_MAPPING.userName]: sanitizeField(user.name || ""),
             [FIELD_MAPPING.lastSaved]: new Date().toISOString(),
             // Initialize JSON fields as empty arrays/objects
             [FIELD_MAPPING.cardBankData]: JSON.stringify([]),
             [FIELD_MAPPING.box1Data]: JSON.stringify([]),
             [FIELD_MAPPING.box2Data]: JSON.stringify([]),
             [FIELD_MAPPING.box3Data]: JSON.stringify([]),
             [FIELD_MAPPING.box4Data]: JSON.stringify([]),
             [FIELD_MAPPING.box5Data]: JSON.stringify([]),
             [FIELD_MAPPING.colorMapping]: JSON.stringify(initialColorMapping), // Initialize with proper structure
             [FIELD_MAPPING.topicLists]: JSON.stringify([]),
             [FIELD_MAPPING.topicMetadata]: JSON.stringify([])
         };
  
         // Add connection fields ONLY if valid IDs exist on the currentUser object
         // These IDs should have been derived during initialization
         if (window.currentKnackUser.emailId) data[FIELD_MAPPING.accountConnection] = window.currentKnackUser.emailId; // Connection to Account/User Object
         if (window.currentKnackUser.schoolId) data[FIELD_MAPPING.vespaCustomer] = window.currentKnackUser.schoolId; // Connection to School/Customer Object
         if (window.currentKnackUser.tutorId) data[FIELD_MAPPING.tutorConnection] = window.currentKnackUser.tutorId; // Connection to Tutor Object
         if (window.currentKnackUser.roleId) data[FIELD_MAPPING.userRole] = window.currentKnackUser.roleId; // Connection to Role Object
  
         // Add other user attributes if available and relevant fields exist
         if (user.tutorGroup && FIELD_MAPPING.tutorGroup) data[FIELD_MAPPING.tutorGroup] = sanitizeField(user.tutorGroup);
         if (user.yearGroup && FIELD_MAPPING.yearGroup) data[FIELD_MAPPING.yearGroup] = sanitizeField(user.yearGroup);
  
  
         debugLog("[Knack Script] CREATING NEW RECORD PAYLOAD", data);
  
         const apiCall = () => new Promise((resolve, reject) => {
            $.ajax({
               url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records`,
               type: 'POST',
               headers: saveQueue.getKnackHeaders(), // Use headers from queue
               data: JSON.stringify(data),
               success: resolve,
               error: reject // Let retry handle details
            });
         });
  
         retryApiCall(apiCall)
            .then(response => {
               console.log("[Knack Script] Successfully created user record:", response);
               callback(true, response.id, null); // Pass null for error on success
            })
            .catch(error => {
               console.error("[Knack Script] Error creating user record:", error);
               callback(false, null, error); // Pass the error object to the callback
            });
     }
  
  
     // Standardize card data before saving or processing
     function standardizeCards(cards) {
         if (!Array.isArray(cards)) {
              console.warn("[Knack Script] standardizeCards called with non-array:", cards);
             return [];
         }
         return cards.map(card => {
             if (!card || typeof card !== 'object') {
                  console.warn("[Knack Script] Skipping invalid item in cards array:", card);
                 return null; // Handle null/undefined/non-object entries
             }
             try {
                 // Deep clone via serialization to avoid modifying original & handle complex objects
                 let cleanCard = saveQueue.ensureSerializable(card); // Use queue's helper
  
                  // Define default structure
                 let standardCard = {
                   id: cleanCard.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
                   subject: sanitizeField(cleanCard.subject || 'General'),
                   topic: sanitizeField(cleanCard.topic || 'General'),
                   examBoard: sanitizeField(cleanCard.examBoard || ''),
                   examType: sanitizeField(cleanCard.examType || ''),
                   topicPriority: parseInt(cleanCard.topicPriority || 0, 10), // Ensure number
                   question: sanitizeField(cleanCard.question || cleanCard.front || ''),
                   answer: sanitizeField(cleanCard.answer || cleanCard.back || ''), // Sanitize potentially complex answers
                   keyPoints: Array.isArray(cleanCard.keyPoints) ? cleanCard.keyPoints.map(kp => sanitizeField(kp)) : [],
                   detailedAnswer: sanitizeField(cleanCard.detailedAnswer || ''),
                   additionalInfo: sanitizeField(cleanCard.additionalInfo || cleanCard.notes || ''),
                   cardColor: cleanCard.cardColor || cleanCard.color || '#f0f0f0', // Updated default to neutral light gray
                   subjectColor: cleanCard.subjectColor || '#f0f0f0', // Updated default to neutral light gray
                   topicColor: cleanCard.topicColor || null, // Store topic-specific color
                   textColor: cleanCard.textColor || '',
                   boxNum: cleanCard.boxNum ? parseInt(cleanCard.boxNum, 10) : 1, // Ensure number, default 1
                   lastReviewed: cleanCard.lastReviewed || null, // Keep null if not set
                   nextReviewDate: cleanCard.nextReviewDate || new Date(Date.now() + 86400000).toISOString(), // Default +1 day
                   createdAt: cleanCard.createdAt || new Date().toISOString(),
                   updatedAt: new Date().toISOString(), // Always update timestamp
                   options: Array.isArray(cleanCard.options) ? cleanCard.options : [], // Ensure array
                   savedOptions: Array.isArray(cleanCard.savedOptions) ? cleanCard.savedOptions : [], // Ensure array
                   questionType: cleanCard.questionType || 'short_answer', // Default type
                   type: cleanCard.type || 'card' // Ensure type field exists ('card' or 'topic')
                 };
  
                 // Specific handling for 'topic' type (shells)
                 if (standardCard.type === 'topic' || cleanCard.isShell === true) { // Check isShell flag too
                     standardCard.type = 'topic';
                     standardCard.name = sanitizeField(cleanCard.name || standardCard.topic); // Ensure name exists and is clean
                     standardCard.isShell = true;
                      // Determine isEmpty based on whether a 'cards' array exists and is empty
                     standardCard.isEmpty = !Array.isArray(cleanCard.cards) || cleanCard.cards.length === 0;
                     // Clear fields not relevant to topic shells
                     standardCard.question = '';
                     standardCard.answer = '';
                      standardCard.keyPoints = [];
                      standardCard.detailedAnswer = '';
                      standardCard.additionalInfo = '';
                     standardCard.boxNum = undefined; // Or null
                     standardCard.lastReviewed = undefined; // Or null
                     standardCard.nextReviewDate = undefined; // Or null
                     standardCard.questionType = undefined; // Or null
                      standardCard.options = [];
                      standardCard.savedOptions = [];
                 } else {
                    // Ensure type is 'card' for actual flashcards
                    standardCard.type = 'card';
                     // Remove shell-specific flags if they accidentally ended up on a card
                     delete standardCard.isShell;
                     delete standardCard.isEmpty;
                     delete standardCard.name; // Cards use question/answer, not name
                 }
  
  
                 // Multiple Choice Handling (after type is determined)
                  if (standardCard.type === 'card') { // Only apply MC logic to cards
                      const isMC = isMultipleChoiceCard(standardCard);
                      if (isMC) {
                          standardCard.questionType = 'multiple_choice';
                          // Restore or create options if missing
                          if (!standardCard.options || standardCard.options.length === 0) {
                              if (standardCard.savedOptions && standardCard.savedOptions.length > 0) {
                                   console.log(`[Standardize] Restoring options from savedOptions for card ${standardCard.id}`);
                                  standardCard.options = [...standardCard.savedOptions];
                              }
                              // Optionally add logic here to extract from answer if needed as ultimate fallback
                          }
                          // Backup options if they exist and differ from savedOptions
                          if (standardCard.options && standardCard.options.length > 0) {
                              // Basic check to avoid redundant saving if they are identical
                               try {
                                   if (JSON.stringify(standardCard.options) !== JSON.stringify(standardCard.savedOptions)) {
                                        console.log(`[Standardize] Backing up options to savedOptions for card ${standardCard.id}`);
                                       standardCard.savedOptions = [...standardCard.options];
                                   }
                               } catch (e) {
                                    console.warn(`[Standardize] Error comparing options for backup on card ${standardCard.id}`, e);
                                   // Save anyway if comparison fails
                                   standardCard.savedOptions = [...standardCard.options];
                               }
                          }
                           // Ensure options have required structure (e.g., { text: '...', isCorrect: Boolean(...) })
                           standardCard.options = standardCard.options.map(opt => ({
                               text: sanitizeField(opt.text || ''), // Sanitize option text
                               isCorrect: Boolean(opt.isCorrect)   // Ensure boolean
                           }));
  
                      } else { // If not MC, ensure questionType is appropriate
                         standardCard.questionType = standardCard.questionType === 'multiple_choice' ? 'short_answer' : standardCard.questionType; // Reset if wrongly marked MC
                          // Clear options if it's not an MC card
                          standardCard.options = [];
                          standardCard.savedOptions = [];
                      }
                  }
  
  
                 return standardCard;
  
             } catch (error) {
                 console.error("[Knack Script] Error standardizing card:", error, "Card data:", card);
                 return null; // Return null for cards that cause errors during standardization
             }
         }).filter(card => card !== null); // Filter out any null results from errors
     }
  
  
     // Detect if a card should be multiple choice
     function isMultipleChoiceCard(card) {
       // Check object exists and is a card
       if (!card || typeof card !== 'object' || card.type !== 'card') return false;
  
       // Explicit type check first
       if (card.questionType === 'multiple_choice') return true;
  
       // Presence of valid options array (at least one option)
       if (Array.isArray(card.options) && card.options.length > 0) {
          // Optional: Check if options have the expected structure (text, isCorrect)
           if (card.options.some(opt => opt && typeof opt.text === 'string' && typeof opt.isCorrect === 'boolean')) {
               return true;
           }
       }
        // Presence of valid savedOptions array (as backup check)
        if (Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
             if (card.savedOptions.some(opt => opt && typeof opt.text === 'string' && typeof opt.isCorrect === 'boolean')) {
                return true;
            }
        }
  
       // Legacy type field (should be handled by migration, but check just in case)
       // if (card.type === 'multiple_choice') return true;
  
       return false; // Default to false
     }
  
     // Migrate legacy 'type' field used for question format to 'questionType'
     function migrateTypeToQuestionType(data) {
         if (!data) return data;
         // Handle arrays recursively
         if (Array.isArray(data)) {
             return data.map(item => migrateTypeToQuestionType(item));
         }
         // Handle objects
         if (typeof data === 'object' && data !== null) {
             const newData = { ...data }; // Clone to avoid modifying original
             // Check if legacy type field indicates question format
             if (newData.type === 'multiple_choice' || newData.type === 'short_answer') {
                  // Only migrate if 'questionType' isn't already set or is different
                 if (!newData.questionType || newData.questionType !== newData.type) {
                     console.log(`[Migration] Migrating legacy type ('${newData.type}') to questionType for item: ${newData.id || 'unknown'}`);
                     newData.questionType = newData.type;
                 }
                 // IMPORTANT: Reset the 'type' field to 'card' as the legacy value is now redundant for type classification
                 newData.type = 'card';
             }
             // Ensure 'type' is set for items that might be missing it
             if (!newData.type) {
                 // Basic inference: if it has question/answer it's likely a card, otherwise maybe topic?
                 // This is less reliable, standardizeCards should handle final typing.
                 if (newData.question || newData.answer) {
                     newData.type = 'card';
                      if(!newData.questionType) newData.questionType = 'short_answer'; // Default new cards
                 } else if (newData.name && newData.subject) {
                      // Might be a topic shell - let standardizeCards confirm
                 }
             }
  
             // Optional: Recursively process nested objects (usually not needed for card structure)
             // ...
  
             return newData;
         }
         // Return primitives or other types as is
         return data;
     }
  
      // Helper to split items into topics (shells) and cards based on 'type' or 'isShell'
      function splitByType(items) {
         if (!Array.isArray(items)) {
              console.warn("[Knack Script] splitByType called with non-array:", items);
             return { topics: [], cards: [] };
         }
  
          const topics = items.filter(item => item && (item.type === 'topic' || item.isShell === true));
          const cards = items.filter(item => {
             // Ensure item exists and is not explicitly a topic/shell
             return item && item.type !== 'topic' && item.isShell !== true;
             // We might also check if it looks like a card (e.g., has a question)
             // return item && (item.type === 'card' || (item.question && item.type !== 'topic'));
          });
  
  
         // Log counts for debugging
          // console.log(`[SplitByType] Input: ${items.length}, Output: ${topics.length} topics, ${cards.length} cards`);
  
         return { topics, cards };
      }
  
  
     // --- Topic Shell Creation Logic (Adapted from 5w) ---
     // Handles fetching existing data, generating/merging shells & metadata, and QUEUING the final save.
     async function createTopicShellsFromLists(topicLists, recordId, iframeWindow) {
         console.log(`[Knack Script] Initiating topic shell creation/update for record ${recordId}`);
         if (!Array.isArray(topicLists) || topicLists.length === 0 || !recordId) {
             console.warn("[Knack Script] Skipping shell creation: No topic lists or recordId provided.");
             // Optionally notify React app if needed
              if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_SHELLS_PROCESSED', success: true, count: 0, message: "No lists provided." }, '*');
             return;
         }
  
         try {
             // 1. Fetch existing user data (includes cardBank, colorMapping, topicMetadata)
             console.log(`[Knack Script] Fetching existing data for shell creation (record ${recordId})`);
             const existingData = await saveQueue.getExistingData(recordId); // Use queue's fetcher
  
              // Ensure existingData is valid
              if (!existingData || !existingData.id) {
                   throw new Error(`Failed to fetch existing data for record ${recordId} during shell creation.`);
              }
  
  
             // 2. Parse existing data safely
             let subjectColors = {};
              let existingTopicMetadata = [];
              let existingItems = []; // From cardBankData
  
              try {
                  let colorDataStr = existingData[FIELD_MAPPING.colorMapping];
                  if (typeof colorDataStr === 'string' && colorDataStr.includes('%')) {
                     colorDataStr = safeDecodeURIComponent(colorDataStr);
                  }
                  subjectColors = safeParseJSON(colorDataStr, {}); // Default to empty object
              } catch (e) { console.error("Error parsing existing subject colors:", e); subjectColors = {}; }
  
             try {
                 let metaDataStr = existingData[FIELD_MAPPING.topicMetadata];
                 if (typeof metaDataStr === 'string' && metaDataStr.includes('%')) {
                     metaDataStr = safeDecodeURIComponent(metaDataStr);
                 }
                 existingTopicMetadata = safeParseJSON(metaDataStr, []); // Default to empty array
              } catch (e) { console.error("Error parsing existing topic metadata:", e); existingTopicMetadata = [];}
  
             try {
                 let bankDataStr = existingData[FIELD_MAPPING.cardBankData];
                 if (typeof bankDataStr === 'string' && bankDataStr.includes('%')) {
                     bankDataStr = safeDecodeURIComponent(bankDataStr);
                 }
                 existingItems = safeParseJSON(bankDataStr, []); // Default to empty array
              } catch(e) { console.error("Error parsing existing card bank data:", e); existingItems = [];}
  
             // Split existing items from card bank
             const { topics: existingTopicShells, cards: existingCards } = splitByType(existingItems);
             console.log(`[Knack Script] Existing data parsed: ${existingTopicShells.length} shells, ${existingCards.length} cards, ${existingTopicMetadata.length} metadata items.`);
  
  
             // 3. Generate New Topic Shells and update Colors/Metadata based on topicLists
             const { newShells, updatedColors, updatedMetadata } = generateNewShellsAndMetadata(
                 topicLists,
                 subjectColors, // Pass current colors
                 existingTopicMetadata // Pass current metadata
             );
             console.log(`[Knack Script] Generated ${newShells.length} new shells based on topic lists.`);
  
  
             // 4. Merge new shells with existing shells (preserves card arrays in existing shells)
             const finalTopicShells = mergeTopicShells(existingTopicShells, newShells);
             console.log(`[Knack Script] Merged shells. Total shells: ${finalTopicShells.length}`);
  
             // 5. Combine final shells with existing cards for the new cardBankData payload
             const finalBankData = [...finalTopicShells, ...existingCards];
  
             // 6. Prepare the data payload for saving (includes updated bank, colors, metadata)
             // This payload object contains the specific fields we want to update
             const saveDataPayload = {
                 // recordId is not part of the payload itself, passed to queue separately
                 cards: finalBankData, // Updated card bank with merged shells
                 colorMapping: updatedColors, // Potentially updated colors
                 topicMetadata: updatedMetadata // Merged metadata
                 // We will use preserveFields: true, so other fields like boxes, topicLists are kept
             };
  
             // 7. Queue the save operation using 'full' type as multiple fields are potentially updated
             console.log(`[Knack Script] Queuing 'full' save for topic shell creation/update for record ${recordId}.`);
             await saveQueue.addToQueue({
                 type: 'full',
                 data: saveDataPayload, // Pass the object containing the fields to update
                 recordId: recordId,
                 preserveFields: true // CRITICAL: preserve fields not explicitly in saveDataPayload (like boxes, topicLists field)
             });
  
             console.log(`[Knack Script] Successfully queued save after topic shell processing for record ${recordId}.`);
  
             // Notify React app immediately that shells were processed and save is queued
             if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_SHELLS_PROCESSED', success: true, count: newShells.length }, '*');
  
  
         } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
             console.error("[Knack Script] Error during createTopicShellsFromLists:", errorMessage, error);
             // Notify React app of the failure
              if (iframeWindow) iframeWindow.postMessage({ type: 'TOPIC_SHELLS_PROCESSED', success: false, error: errorMessage }, '*');
         }
     }
  
      // Helper to generate new shells, colors, and metadata from topic lists
      function generateNewShellsAndMetadata(topicLists, currentSubjectColors, currentTopicMetadata) {
          const newShells = [];
          // Create copies to avoid modifying originals directly until the end
          const updatedMetadata = JSON.parse(JSON.stringify(currentTopicMetadata || []));
          let updatedColors = ensureValidColorMapping(currentSubjectColors || {});
  
          const idMap = new Map(); // Track processed shell IDs in this run to avoid intra-list duplicates
          const uniqueSubjects = new Set(topicLists.map(list => list.subject || "General"));
  
          // Always create a structured colorMapping for all subjects with predefined colors
          const subjectPalette = [
              '#4363d8', // Blue
              '#3cb44b', // Green 
              '#e6194B', // Red
              '#ffe119', // Yellow
              '#911eb4', // Purple
              '#f58231', // Orange
              '#42d4f4', // Light Blue
              '#469990', // Teal
              '#9A6324', // Brown
              '#800000'  // Maroon
          ];
          
          // Assign colors to subjects not already having a color
          let colorIndex = 0;
          uniqueSubjects.forEach(subject => {
              if (!updatedColors[subject]) {
                  // Create a new subject entry with a color from the palette
                  updatedColors[subject] = {
                      base: subjectPalette[colorIndex % subjectPalette.length],
                      topics: {}
                  };
                  colorIndex++;
              } else if (typeof updatedColors[subject] === 'string') {
                  // Convert string format to structured format
                  const baseColor = updatedColors[subject];
                  updatedColors[subject] = {
                      base: baseColor,
                      topics: {}
                  };
              } else if (updatedColors[subject]?.base === '#f0f0f0') {
                  // Replace neutral color with a color from the palette
                  updatedColors[subject].base = subjectPalette[colorIndex % subjectPalette.length];
                  colorIndex++;
              }
          });
  
          debugLog("[Shell Gen] Updated subject colors (structured):", updatedColors);
  
          const now = new Date().toISOString();
  
          // --- Process Lists ---
          topicLists.forEach(list => {
              if (!list || !Array.isArray(list.topics)) {
                   console.warn("[Shell Gen] Skipping invalid topic list:", list);
                  return;
              }
  
              const subject = sanitizeField(list.subject || "General");
              const examBoard = sanitizeField(list.examBoard || "General"); // Use General if empty
              const examType = sanitizeField(list.examType || "Course"); // Use Course if empty
              
              // Get subject's base color from the structured object
              const subjectColor = updatedColors[subject]?.base || "#f0f0f0";
  
              // Generate shades for topics - more variations for visual interest
              const topicColors = generateShadeVariations(subjectColor, Math.max(10, list.topics.length));
  
              list.topics.forEach((topic, index) => {
                  // Basic validation for topic object
                  if (!topic || (typeof topic !== 'object' && typeof topic !== 'string') || (!topic.id && !topic.name && !topic.topic && typeof topic !== 'string')) {
                       console.warn("[Shell Gen] Skipping invalid topic item:", topic);
                      return;
                  }
  
                  // Handle case where topic might just be a string name
                   const isStringTopic = typeof topic === 'string';
                   const topicName = sanitizeField(isStringTopic ? topic : (topic.name || topic.topic || "Unknown Topic"));
                   // Generate an ID if none provided, try to make it somewhat stable if possible
                   const topicId = isStringTopic
                       ? `topic_${subject}_${topicName.replace(/[^a-zA-Z0-9]/g, '_')}` // Generate ID from subject/name
                       : (topic.id || `topic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  
                  if (idMap.has(topicId)) {
                       console.log(`[Shell Gen] Skipping duplicate topic ID in this run: ${topicId}`);
                      return; // Skip duplicates within this generation run
                  }
  
                  // Get or assign a topic color
                  const topicColor = topicColors[index % topicColors.length];
                  
                  // Store the topic color in the color mapping for persistence
                  if (!updatedColors[subject].topics) {
                      updatedColors[subject].topics = {};
                  }
                  updatedColors[subject].topics[topicName] = topicColor;
  
                   // Create the shell using standardizeCards for consistency
                    const shellData = {
                       id: topicId,
                       type: 'topic', // Explicitly set type
                       name: topicName, // Use sanitized name
                       topic: topicName, // Keep topic property too
                       subject: subject,
                       examBoard: examBoard,
                       examType: examType,
                       cardColor: topicColor, // Assign topic color variation
                       subjectColor: subjectColor, // Assign base subject color
                       topicColor: topicColor, // Store topic-specific color
                       isShell: true,
                       createdAt: now, // Add creation timestamp
                       updatedAt: now
                   };
  
                   const standardizedShellArray = standardizeCards([shellData]); // Standardize the single shell
                   const shell = standardizedShellArray.length > 0 ? standardizedShellArray[0] : null;
  
                  if(shell) { // Ensure standardization didn't fail
                      newShells.push(shell);
                      idMap.set(topicId, true); // Mark ID as processed for this run
  
                      // --- Update Topic Metadata ---
                      const metadataIndex = updatedMetadata.findIndex(m => m.topicId === topicId);
                      const newMetadataEntry = {
                          topicId: topicId,
                          name: topicName, // Use sanitized name
                          subject: subject,
                          examBoard: examBoard,
                          examType: examType,
                          updated: now // Timestamp of this update/creation
                      };
                      if (metadataIndex >= 0) {
                          // Update existing metadata entry
                          updatedMetadata[metadataIndex] = { ...updatedMetadata[metadataIndex], ...newMetadataEntry };
                      } else {
                          // Add new metadata entry
                          updatedMetadata.push(newMetadataEntry);
                      }
                  } else {
                        console.warn(`[Shell Gen] Failed to standardize shell for topic:`, topic);
                  }
              });
          });
           debugLog("[Shell Gen] Generated Shells:", newShells);
           debugLog("[Shell Gen] Final Color Mapping:", updatedColors);
           debugLog("[Shell Gen] Final Metadata:", updatedMetadata);
  
          return { newShells, updatedColors, updatedMetadata };
      }
  
       // Helper function to generate color variations
        function generateShadeVariations(baseColorHex, count) {
            if (!baseColorHex || typeof baseColorHex !== 'string' || !baseColorHex.startsWith('#')) {
                console.warn("Invalid baseColorHex for generateShadeVariations:", baseColorHex);
                return Array(count).fill('#f0f0f0'); // Updated default to neutral light gray
            }
             if (count <= 0) return [];
             if (count === 1) return [baseColorHex]; // Return base if only one needed
  
  
            const shades = [];
            try {
                // Convert hex to HSL
                const hexToHSL = (hex) => {
                    hex = hex.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) / 255;
                    const g = parseInt(hex.substring(2, 4), 16) / 255;
                    const b = parseInt(hex.substring(4, 6), 16) / 255;
                    const max = Math.max(r, g, b), min = Math.min(r, g, b);
                    let h = 0, s = 0, l = (max + min) / 2;
                    if (max !== min) {
                        const d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                        switch (max) {
                            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                            case g: h = (b - r) / d + 2; break;
                            case b: h = (r - g) / d + 4; break;
                        }
                        h /= 6;
                    }
                    return { h, s, l };
                };
  
                // Convert HSL back to hex
                const hslToHex = (h, s, l) => {
                    let r, g, b;
                    if (s === 0) { r = g = b = l; }
                    else {
                        const hue2rgb = (p, q, t) => {
                            if (t < 0) t += 1; if (t > 1) t -= 1;
                            if (t < 1 / 6) return p + (q - p) * 6 * t;
                            if (t < 1 / 2) return q;
                            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                            return p;
                        };
                        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                        const p = 2 * l - q;
                        r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
                    }
                    const toHex = x => { const hex = Math.round(x * 255).toString(16); return hex.length === 1 ? '0' + hex : hex; };
                    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                };
  
                const { h, s, l } = hexToHSL(baseColorHex);
  
                // Generate variations by adjusting lightness primarily
                 // Aim for a range around the original lightness, e.g., l +/- 15%
                 const minLightness = Math.max(0.2, l - 0.15); // Ensure minimum brightness
                 const maxLightness = Math.min(0.85, l + 0.15); // Ensure maximum brightness
                 const lightnessStep = count > 1 ? (maxLightness - minLightness) / (count - 1) : 0;
  
  
                for (let i = 0; i < count; i++) {
                    const currentL = count === 1 ? l : minLightness + (i * lightnessStep);
                    // Optional: slight hue variation too
                     // const currentH = (h + (i * 0.01)) % 1; // Very small hue shift
                     const currentH = h; // Keep hue constant for simpler shades
                    shades.push(hslToHex(currentH, s, currentL));
                }
  
            } catch (error) {
                console.error("Error generating shade variations:", error);
                // Fallback to repeating base color or default grey
                return Array(count).fill(baseColorHex || '#cccccc');
            }
            return shades;
        }
  
  
      // Merges existing topic shells with newly generated ones, preserving card arrays
      function mergeTopicShells(existingShells, newShells) {
          console.log(`[Merge Shells] Merging ${existingShells.length} existing with ${newShells.length} new shells.`);
          const finalShells = [];
          const existingMap = new Map();
           // Ensure existing shells are valid objects with IDs before adding to map
           existingShells.forEach(shell => {
               if (shell && typeof shell === 'object' && shell.id) {
                   existingMap.set(shell.id, shell);
               } else {
                    console.warn("[Merge Shells] Skipping invalid existing shell:", shell);
               }
           });
  
          const processedIds = new Set();
  
          // Process new shells: update existing or add if new
          newShells.forEach(newShell => {
              if (!newShell || !newShell.id) {
                   console.warn("[Merge Shells] Skipping invalid new shell:", newShell);
                  return; // Skip invalid shells
              }
  
              const existing = existingMap.get(newShell.id);
              if (existing) {
                   // Merge: Keep existing cards array & created date, update the rest from newShell
                   // Use standardizeCards again on the merged result for final cleanup might be overkill but safe
                   const mergedShellData = {
                      ...newShell, // Take latest name, colors, metadata from new shell
                      cards: Array.isArray(existing.cards) ? existing.cards : [], // CRITICAL: Preserve existing cards array
                      isEmpty: !Array.isArray(existing.cards) || existing.cards.length === 0, // Recalculate isEmpty
                      created: existing.created || newShell.created, // Keep original creation date
                      updatedAt: new Date().toISOString() // Always update timestamp
                   };
                   // Standardize the merged shell
                   const stdMergedArray = standardizeCards([mergedShellData]);
                   if (stdMergedArray.length > 0) {
                      finalShells.push(stdMergedArray[0]);
                   } else {
                        console.warn(`[Merge Shells] Failed to standardize merged shell for ID: ${newShell.id}`);
                   }
              } else {
                  // Add new shell (it should already be standardized)
                  finalShells.push(newShell);
              }
              processedIds.add(newShell.id);
          });
  
          // Add back any existing shells that were *not* processed (i.e., not in the new list)
          existingMap.forEach((existingShell, id) => {
              if (!processedIds.has(id)) {
                   // Ensure the existing shell is standardized before adding back
                   const stdExistingArray = standardizeCards([existingShell]);
                   if (stdExistingArray.length > 0) {
                       finalShells.push(stdExistingArray[0]);
                        console.log(`[Merge Shells] Kept existing shell not present in new list: ${id}`);
                   } else {
                       console.warn(`[Merge Shells] Failed to standardize existing shell being kept: ${id}`);
                   }
              }
          });
           console.log(`[Merge Shells] Final shell count: ${finalShells.length}`);
          return finalShells;
      }
  
  
     // --- REMOVED Old/Redundant Functions ---
     // Functions like saveFlashcardUserData, handlePreserveFieldsDataSave, handleAddToBank,
     // addToBankDirectAPI, the old handleSaveData, actualSaveFunction, handleAddToBankPromise,
     // and _handleIframeMessageLogic have been replaced by the new SaveQueue and
     // message routing structure (handleMessageRouter -> specific handlers -> saveQueue).
  
  // Add these new handler functions for deletion operations

// Handle request to delete a subject
async function handleDeleteSubjectRequest(data, iframeWindow) {
  console.log("[Knack Script] Handling DELETE_SUBJECT request", data);
  
  if (!data || !data.recordId || !data.subject) {
      console.error("[Knack Script] DELETE_SUBJECT request missing recordId or subject name");
      if (iframeWindow) iframeWindow.postMessage({ 
          type: 'DELETE_SUBJECT_RESULT', 
          success: false, 
          error: "Missing recordId or subject name" 
      }, '*');
      return;
  }
  
  try {
      // 1. Fetch existing data
      const existingData = await saveQueue.getExistingData(data.recordId);
      if (!existingData) {
          throw new Error(`Failed to fetch existing data for record ${data.recordId}`);
      }
      
      // 2. Parse and update card bank data (remove topics and shells for this subject)
      let bankData = [];
      let topicLists = [];
      let colorMapping = {};
      
      // Process cardBankData
      try {
          let bankDataStr = existingData[FIELD_MAPPING.cardBankData];
          if (typeof bankDataStr === 'string' && bankDataStr.includes('%')) {
              bankDataStr = safeDecodeURIComponent(bankDataStr);
          }
          bankData = safeParseJSON(bankDataStr, []);
          
          // Filter out topic shells and cards for this subject
          bankData = bankData.filter(item => 
              item && item.subject !== data.subject
          );
      } catch (e) {
          console.error("[Knack Script] Error processing card bank during subject deletion:", e);
          // Continue with empty array if parsing failed
          bankData = [];
      }
      
      // Process topicLists
      try {
          let listsStr = existingData[FIELD_MAPPING.topicLists];
          if (typeof listsStr === 'string' && listsStr.includes('%')) {
              listsStr = safeDecodeURIComponent(listsStr);
          }
          topicLists = safeParseJSON(listsStr, []);
          
          // Filter out lists for this subject
          topicLists = topicLists.filter(list => 
              list && list.subject !== data.subject
          );
      } catch (e) {
          console.error("[Knack Script] Error processing topic lists during subject deletion:", e);
          topicLists = [];
      }
      
      // Process colorMapping
      try {
          let colorStr = existingData[FIELD_MAPPING.colorMapping];
          if (typeof colorStr === 'string' && colorStr.includes('%')) {
              colorStr = safeDecodeURIComponent(colorStr);
          }
          colorMapping = safeParseJSON(colorStr, {});
          
          // Remove this subject from colorMapping
          if (colorMapping && typeof colorMapping === 'object') {
              delete colorMapping[data.subject];
          }
      } catch (e) {
          console.error("[Knack Script] Error processing color mapping during subject deletion:", e);
          colorMapping = {};
      }
      
      // 3. Update any SR boxes to remove this subject's cards if necessary
      const updatedSR = {
          box1: processBoxForDeletion(existingData[FIELD_MAPPING.box1Data], bankData),
          box2: processBoxForDeletion(existingData[FIELD_MAPPING.box2Data], bankData),
          box3: processBoxForDeletion(existingData[FIELD_MAPPING.box3Data], bankData),
          box4: processBoxForDeletion(existingData[FIELD_MAPPING.box4Data], bankData),
          box5: processBoxForDeletion(existingData[FIELD_MAPPING.box5Data], bankData)
      };
      
      // 4. Prepare final save data
      const saveData = {
          cards: bankData,
          topicLists: topicLists,
          colorMapping: colorMapping,
          spacedRepetition: updatedSR
      };
      
      // 5. Queue the save operation
      await saveQueue.addToQueue({
          type: 'full',
          data: saveData,
          recordId: data.recordId,
          preserveFields: true // Preserve other fields not included here
      });
      
      console.log(`[Knack Script] Successfully deleted subject: ${data.subject}`);
      
      // 6. Send success response
      if (iframeWindow) {
          iframeWindow.postMessage({
              type: 'DELETE_SUBJECT_RESULT',
              success: true,
              subject: data.subject,
              timestamp: new Date().toISOString()
          }, '*');
      }
      
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Knack Script] Error deleting subject ${data.subject}:`, errorMessage);
      
      // Send error response
      if (iframeWindow) {
          iframeWindow.postMessage({
              type: 'DELETE_SUBJECT_RESULT',
              success: false,
              error: errorMessage || 'Unknown error deleting subject',
              subject: data.subject
          }, '*');
      }
  }
}

// Handle request to delete a topic
async function handleDeleteTopicRequest(data, iframeWindow) {
  console.log("[Knack Script] Handling DELETE_TOPIC request", data);
  
  if (!data || !data.recordId || !data.subject || !data.topic) {
      console.error("[Knack Script] DELETE_TOPIC request missing recordId, subject name, or topic name");
      if (iframeWindow) iframeWindow.postMessage({ 
          type: 'DELETE_TOPIC_RESULT', 
          success: false, 
          error: "Missing recordId, subject name, or topic name" 
      }, '*');
      return;
  }
  
  try {
      // 1. Fetch existing data
      const existingData = await saveQueue.getExistingData(data.recordId);
      if (!existingData) {
          throw new Error(`Failed to fetch existing data for record ${data.recordId}`);
      }
      
      // 2. Parse and update card bank data (remove this topic's shell and cards)
      let bankData = [];
      let topicLists = [];
      let colorMapping = {};
      
      // Process cardBankData
      try {
          let bankDataStr = existingData[FIELD_MAPPING.cardBankData];
          if (typeof bankDataStr === 'string' && bankDataStr.includes('%')) {
              bankDataStr = safeDecodeURIComponent(bankDataStr);
          }
          bankData = safeParseJSON(bankDataStr, []);
          
          // Filter out this topic's shell and cards
          bankData = bankData.filter(item => 
              !(item && 
                item.subject === data.subject && 
                item.topic === data.topic)
          );
      } catch (e) {
          console.error("[Knack Script] Error processing card bank during topic deletion:", e);
          // Continue with empty array if parsing failed
          bankData = [];
      }
      
      // Process topicLists
      try {
          let listsStr = existingData[FIELD_MAPPING.topicLists];
          if (typeof listsStr === 'string' && listsStr.includes('%')) {
              listsStr = safeDecodeURIComponent(listsStr);
          }
          topicLists = safeParseJSON(listsStr, []);
          
          // Update topic lists to remove this topic
          topicLists = topicLists.map(list => {
              if (list && list.subject === data.subject && Array.isArray(list.topics)) {
                  // Create a new list without this topic
                  return {
                      ...list,
                      topics: list.topics.filter(t => {
                          // Handle both string topics and object topics
                          if (typeof t === 'string') {
                              return t !== data.topic;
                          } else if (t && typeof t === 'object') {
                              return t.name !== data.topic && t.topic !== data.topic;
                          }
                          return true; // Keep anything we can't identify
                      })
                  };
              }
              return list; // Return other lists unchanged
          });
      } catch (e) {
          console.error("[Knack Script] Error processing topic lists during topic deletion:", e);
          topicLists = [];
      }
      
      // Process colorMapping
      try {
          let colorStr = existingData[FIELD_MAPPING.colorMapping];
          if (typeof colorStr === 'string' && colorStr.includes('%')) {
              colorStr = safeDecodeURIComponent(colorStr);
          }
          colorMapping = safeParseJSON(colorStr, {});
          
          // Remove this topic from subject's topics in colorMapping
          if (colorMapping && 
              typeof colorMapping === 'object' && 
              colorMapping[data.subject] && 
              colorMapping[data.subject].topics) {
              delete colorMapping[data.subject].topics[data.topic];
          }
      } catch (e) {
          console.error("[Knack Script] Error processing color mapping during topic deletion:", e);
          colorMapping = {};
      }
      
      // 3. Update any SR boxes to remove this topic's cards if necessary
      const updatedSR = {
          box1: processBoxForDeletion(existingData[FIELD_MAPPING.box1Data], bankData),
          box2: processBoxForDeletion(existingData[FIELD_MAPPING.box2Data], bankData),
          box3: processBoxForDeletion(existingData[FIELD_MAPPING.box3Data], bankData),
          box4: processBoxForDeletion(existingData[FIELD_MAPPING.box4Data], bankData),
          box5: processBoxForDeletion(existingData[FIELD_MAPPING.box5Data], bankData)
      };
      
      // 4. Prepare final save data
      const saveData = {
          cards: bankData,
          topicLists: topicLists,
          colorMapping: colorMapping,
          spacedRepetition: updatedSR
      };
      
      // 5. Queue the save operation
      await saveQueue.addToQueue({
          type: 'full',
          data: saveData,
          recordId: data.recordId,
          preserveFields: true // Preserve other fields not included here
      });
      
      console.log(`[Knack Script] Successfully deleted topic: ${data.topic} from subject: ${data.subject}`);
      
      // 6. Send success response
      if (iframeWindow) {
          iframeWindow.postMessage({
              type: 'DELETE_TOPIC_RESULT',
              success: true,
              subject: data.subject,
              topic: data.topic,
              timestamp: new Date().toISOString()
          }, '*');
      }
      
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Knack Script] Error deleting topic ${data.topic} from subject ${data.subject}:`, errorMessage);
      
      // Send error response
      if (iframeWindow) {
          iframeWindow.postMessage({
              type: 'DELETE_TOPIC_RESULT',
              success: false,
              error: errorMessage || 'Unknown error deleting topic',
              subject: data.subject,
              topic: data.topic
          }, '*');
      }
  }
}

// Helper function to process SR boxes for deletion
function processBoxForDeletion(boxDataStr, remainingCards) {
  try {
      // Parse box data
      let boxData = [];
      if (boxDataStr) {
          if (typeof boxDataStr === 'string' && boxDataStr.includes('%')) {
              boxDataStr = safeDecodeURIComponent(boxDataStr);
          }
          boxData = safeParseJSON(boxDataStr, []);
      }
      
      // Create a map of remaining card IDs for quick lookup
      const remainingCardIds = new Set();
      remainingCards.forEach(card => {
          if (card && card.id && card.type === 'card') {
              remainingCardIds.add(card.id);
          }
      });
      
      // Filter box to only include entries for cards that still exist
      return boxData.filter(entry => 
          entry && entry.cardId && remainingCardIds.has(entry.cardId)
      );
  } catch (e) {
      console.error("[Knack Script] Error processing SR box for deletion:", e);
      return []; // Return empty array on error
  }
}
     

 }());

// Add/replace the assignSubjectColorPalette function with this updated version:

// Generate color palette assignment for subjects and topics
function assignSubjectColorPalette(subject, colorMapping) {
    // Fixed palette of distinct colors for subjects
    const subjectPalette = [
        '#4363d8', // Blue
        '#3cb44b', // Green 
        '#e6194B', // Red
        '#ffe119', // Yellow
        '#911eb4', // Purple
        '#f58231', // Orange
        '#42d4f4', // Light Blue
        '#469990', // Teal
        '#9A6324', // Brown
        '#800000'  // Maroon
    ];
    
    const mapping = ensureValidColorMapping(colorMapping);
    
    // Get existing subjects to determine position for new subjects
    const existingSubjects = Object.keys(mapping).filter(s => s !== subject);
    const subjectIndex = existingSubjects.length; // Use count of other subjects for index
    
    // Create/update subject entry if needed
    if (!mapping[subject] || !mapping[subject].base === '#f0f0f0') {
        // Assign a color from the palette using count as index
        const baseColor = subjectPalette[subjectIndex % subjectPalette.length];
        
        if (!mapping[subject]) {
            mapping[subject] = {
                base: baseColor,
                topics: {}
            };
        } else {
            mapping[subject].base = baseColor;
            if (!mapping[subject].topics) {
                mapping[subject].topics = {};
            }
        }
        console.log(`[Knack Script] Assigned color ${baseColor} to subject: ${subject}`);
    }
    
    return mapping;
}

// Helper to ensure colorMapping has the correct structure
function ensureValidColorMapping(colorMapping) {
    if (!colorMapping || typeof colorMapping !== 'object') {
        console.log("[Knack Script] Creating new colorMapping object.");
        return {}; // Return empty object if invalid
    }
    
    // Create a copy to avoid modifying the input directly
    const updatedMapping = JSON.parse(JSON.stringify(colorMapping));
    
    // Check each subject entry
    Object.keys(updatedMapping).forEach(subject => {
        const subjectData = updatedMapping[subject];
        
        // Convert string values to proper structure
        if (typeof subjectData === 'string') {
            console.log(`[Knack Script] Converting string color value for ${subject} to proper structure.`);
            updatedMapping[subject] = {
                base: subjectData,
                topics: {}
            };
        } 
        // Ensure each subject has 'base' and 'topics' properties
        else if (typeof subjectData === 'object' && subjectData !== null) {
            if (!subjectData.base) {
                console.log(`[Knack Script] Adding default base color for ${subject}.`);
                subjectData.base = '#f0f0f0'; // Default base color
            }
            if (!subjectData.topics || typeof subjectData.topics !== 'object') {
                console.log(`[Knack Script] Creating topics object for ${subject}.`);
                subjectData.topics = {};
            }
        }
        // Replace invalid values with proper structure
        else {
            console.log(`[Knack Script] Replacing invalid value for ${subject} with proper structure.`);
            updatedMapping[subject] = {
                base: '#f0f0f0', // Default base color
                topics: {}
            };
        }
    });
    
    return updatedMapping;
}
