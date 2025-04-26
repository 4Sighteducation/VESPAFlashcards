// SaveQueueService.js - Manages the queue for saving data to Knack
// This version fixes URI malformed errors with multi-subject support

// Import enhanced utilities for data handling
import { safeDecodeKnackTopicLists, safeDecodeKnackCards, 
         processKnackUserData, prepareKnackSaveData } from '../utils/KnackAuthUpdates';

// --- Helper Functions ---

// Enhanced URI component decoding function with better error handling for multi-subject
function safeDecodeURIComponent(str) {
  if (!str) return str;
  // Check if it looks like it needs decoding
  if (typeof str === 'string' && !str.includes('%')) return str;
  
  try {
    // Handle plus signs as spaces which sometimes occur
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch (error) {
    console.error("Flashcard app: Error decoding URI component:", error);
    console.log("Problematic string (first 100 chars):", String(str).substring(0, 100));
    
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
        
        // Last resort - try a character-by-character approach to sanitize and extract valid content
        try {
          // Find the first problematic character sequence
          let sanitized = '';
          let i = 0;
          while (i < str.length) {
            try {
              // Try to decode this segment
              if (str[i] === '%') {
                // If we have a percent sign, try to decode it with the next 2 chars
                if (i + 2 < str.length) {
                  const segment = str.substring(i, i + 3);
                  decodeURIComponent(segment); // Just to test if valid
                  // If it didn't throw, it's valid, so add it to sanitized
                  sanitized += segment;
                  i += 3;
                } else {
                  // Not enough chars left for a valid percent encoding, skip
                  sanitized += '%25'; // Replace with encoded %
                  i++;
                }
              } else {
                // Not a percent sign, just add it
                sanitized += str[i];
                i++;
              }
            } catch (charError) {
              // This segment can't be decoded, skip it
              console.warn("Skipping problematic URI segment at position", i);
              sanitized += '%25'; // Replace with encoded %
              i++; // Move past the problematic character
            }
          }
          
          // Try one more time with our sanitized string
          return decodeURIComponent(sanitized);
        } catch (fourthError) {
          console.error("Flashcard app: All decode attempts failed", fourthError);
          
          // As a last resort, try to locate valid JSON in the raw string
          try {
            // Look for valid JSON patterns and try to extract them
            const jsonPattern = /(\[[\s\S]*?\]|\{[\s\S]*?\})/;
            const match = String(str).match(jsonPattern);
            if (match) {
              console.warn("Flashcard app: Attempting JSON extraction from corrupted URI");
              return match[0];
            }
          } catch (e) {
            console.error("Flashcard app: JSON extraction attempt failed");
          }
          
          // Give up and return the original string
          return str;
        }
      }
    }
  }
}

// Enhanced JSON parsing function with better recovery for multi-subject
function safeParseJSON(jsonString, defaultVal = null) {
    if (!jsonString) return defaultVal;
    try {
        // If it's already an object, return it directly
        if (typeof jsonString === 'object' && jsonString !== null) return jsonString;
        // Attempt standard parsing
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn("Flashcard app: Initial JSON parse failed:", error);
        console.log("Problematic string (first 100 chars):", String(jsonString).substring(0, 100));
        
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
            
            // More aggressive approach for multi-subject support
            try {
                console.warn("Flashcard app: Attempting aggressive JSON extraction");
                
                // Try to extract array or object pattern
                let extractedJson = null;
                const jsonStringStr = String(jsonString);
                
                // Look for array pattern with content [...]
                if (jsonStringStr.includes('[') && jsonStringStr.includes(']')) {
                    // Find matching brackets balancing nesting
                    let start = jsonStringStr.indexOf('[');
                    let end = -1;
                    let depth = 0;
                    
                    for (let i = start; i < jsonStringStr.length; i++) {
                        if (jsonStringStr[i] === '[') depth++;
                        if (jsonStringStr[i] === ']') depth--;
                        if (depth === 0) {
                            end = i + 1;
                            break;
                        }
                    }
                    
                    if (end > start) {
                        const extracted = jsonStringStr.substring(start, end);
                        try {
                            // Test if valid JSON
                            const parsed = JSON.parse(extracted);
                            extractedJson = parsed;
                        } catch (e) {
                            console.warn("Extracted array wasn't valid JSON:", extracted.substring(0, 50));
                        }
                    }
                }
                
                // If array extraction failed, try object pattern {...}
                if (!extractedJson && jsonStringStr.includes('{') && jsonStringStr.includes('}')) {
                    let start = jsonStringStr.indexOf('{');
                    let end = -1;
                    let depth = 0;
                    
                    for (let i = start; i < jsonStringStr.length; i++) {
                        if (jsonStringStr[i] === '{') depth++;
                        if (jsonStringStr[i] === '}') depth--;
                        if (depth === 0) {
                            end = i + 1;
                            break;
                        }
                    }
                    
                    if (end > start) {
                        const extracted = jsonStringStr.substring(start, end);
                        try {
                            // Test if valid JSON
                            const parsed = JSON.parse(extracted);
                            extractedJson = parsed;
                        } catch (e) {
                            console.warn("Extracted object wasn't valid JSON:", extracted.substring(0, 50));
                        }
                    }
                }
                
                if (extractedJson) {
                    console.log("Flashcard app: Aggressive JSON extraction successful");
                    return extractedJson;
                }
            } catch (thirdError) {
                console.error("Flashcard app: Aggressive JSON recovery failed:", thirdError);
            }
            
            // Return the default value if all parsing fails
            return defaultVal;
        }
    }
}

// Save Queue configuration for multi-subject support
const SaveQueueService = {
    // Add the missing addToQueue method that App.js is trying to use
    addToQueue: function(operation) {
        console.log(`[SaveQueueService] Adding operation to queue: ${operation.type}`);
        
        // Create a promise to handle the operation
        return new Promise((resolve, reject) => {
            // Process based on operation type
            switch (operation.type) {
                case 'SAVE_DATA':
                    // For SAVE_DATA operations, use the saveData method
                    this.saveData(operation.payload, true)
                        .then(result => resolve(result))
                        .catch(error => reject(error));
                    break;
                    
                case 'TOPIC_LISTS_UPDATED':
                case 'TOPIC_METADATA_UPDATED':
                case 'TOPIC_EVENT':
                case 'CARDS_UPDATED':
                    // Forward these operations to parent window using postMessage
                    if (window.parent) {
                        window.parent.postMessage(operation, '*');
                        
                        // Set up a listener for the response
                        const messageHandler = (event) => {
                            if (event.data && 
                                (event.data.type === `${operation.type}_RESULT` || 
                                 event.data.type === `${operation.type}_ERROR`)) {
                                
                                // Remove the listener
                                window.removeEventListener('message', messageHandler);
                                
                                if (event.data.type === `${operation.type}_RESULT` && event.data.success) {
                                    resolve(event.data);
                                } else {
                                    reject(new Error(event.data.error || 'Unknown error'));
                                }
                            }
                        };
                        
                        // Add the listener
                        window.addEventListener('message', messageHandler);
                        
                        // Add a timeout to prevent hanging
                        setTimeout(() => {
                            window.removeEventListener('message', messageHandler);
                            reject(new Error(`Operation ${operation.type} timed out after 30 seconds`));
                        }, 30000);
                    } else {
                        // If no parent window, reject with error
                        reject(new Error('No parent window available for operation'));
                    }
                    break;
                    
                default:
                    reject(new Error(`Unknown operation type: ${operation.type}`));
            }
        });
    },
    
    saveData: function(data, isKnack = true) {
        console.log(`[App] saveData triggered. IsKnack: ${isKnack}`);
        
        // Save to localStorage for redundancy/recovery
        try {
            const timestamp = new Date().toISOString();
            const serializedData = {
                timestamp,
                version: "5.0", // Version for compatibility checks
                data
            };
            
            console.log("📥 Save Operation: localStorage");
            console.log(`Timestamp: ${timestamp}`);
            console.log("Data Stats:", {
                cardCount: data.cards?.length || 0,
                topicListCount: data.topicLists?.length || 0,
                metadataCount: data.topicMetadata?.length || 0,
                colorMappingSubjects: data.colorMapping ? Object.keys(data.colorMapping).length : 0,
            });
            
            // Special handling for multiple choice cards - backup options
            if (Array.isArray(data.cards)) {
                const mcCards = data.cards.filter(card => card.questionType === 'multiple_choice' && Array.isArray(card.options));
                const backupCount = mcCards.length;
                console.log(`Backed up options for ${backupCount} multiple choice cards`);
                
                // Ensure each multiple choice card has its options backed up in savedOptions
                data.cards = data.cards.map(card => {
                    if (card.questionType === 'multiple_choice' && Array.isArray(card.options)) {
                        return { ...card, savedOptions: [...card.options] };
                    }
                    return card;
                });
            }
            
            // Save to localStorage - using version + JSON.stringify for backup
            localStorage.setItem('vespa_flashcards_data', JSON.stringify(serializedData));
            console.log("Saved data to localStorage with versioning and backup");
            
            // If this is a Knack save, do the real save
            if (isKnack && window.parent) {
                console.log("[Save] Sending data to Knack. Payload size:", data.cards?.length || 0, "items.");
                
                // ENHANCED: Prepare data for saving to Knack with multi-subject safeguards
                const preparedData = prepareKnackSaveData(data);
                
                // Send a message to the parent window (Knack) to save the data
                this.queueKnackSave(preparedData);
            }
            
            // Return a resolved promise with the data
            return Promise.resolve(data);
            
        } catch (error) {
            console.error("[Save] Error saving data:", error);
            return Promise.reject(error);
        }
    },
    
    queueKnackSave: function(data) {
        // --- REVISED FIX: Check recordId on the *incoming* data object --- 
        if (!data || !data.recordId) {
            console.error("[SaveQueueService] CRITICAL ERROR: Cannot queue Knack save - recordId is missing in the prepared data.");
            return Promise.reject(new Error("Cannot save to Knack: Missing recordId in prepared data."));
        }
        
        const recordId = data.recordId; // Use the ID from the prepared data
        
        // --- DEBUGGING STEP: Construct MINIMAL message explicitly --- 
        const message = {
            type: 'SAVE_DATA',
            preserveFields: true, 
            recordId: recordId, // Use the verified recordId
            // --- Temporarily OMIT large encoded fields --- 
            // [FIELD_MAPPING.cardBankData]: data.cards, 
            // [FIELD_MAPPING.topicLists]: data.topicLists,
            // [FIELD_MAPPING.colorMapping]: data.colorMapping,
            // [FIELD_MAPPING.spacedRepetition]: data.spacedRepetition, 
            // [FIELD_MAPPING.topicMetadata]: data.topicMetadata,
            [FIELD_MAPPING.lastSaved]: new Date().toISOString() // Keep lastSaved
        };

        console.log(`[SaveQueueService] Queuing MINIMAL SAVE_DATA message for recordId: ${recordId}`);
        // Log the message structure JUST BEFORE sending to see if it looks correct
        console.log("[SaveQueueService] MINIMAL Message Payload being sent:", JSON.stringify(message)); 
        // --- End Debugging Step ---

        // Dispatch message to queue management in Knack
        window.parent.postMessage(message, '*');

        // Return a promise that will be resolved when the save response is received
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Save operation timed out'));
            }, 30000); // 30 second timeout
            
            const messageHandler = function(event) {
                if (event.data && (event.data.type === 'SAVE_RESULT' || event.data.type === 'SAVE_ERROR')) {
                    // Remove the message listener
                    window.removeEventListener('message', messageHandler);
                    // Clear the timeout
                    clearTimeout(timeoutId);
                    
                    if (event.data.type === 'SAVE_RESULT' && event.data.success) {
                        resolve(event.data);
                    } else {
                        reject(new Error(event.data.error || 'Unknown save error'));
                    }
                }
            };
            
            // Add the message listener
            window.addEventListener('message', messageHandler);
        });
    },
    
    /*
     * Modified routines for safely parsing loaded data with multi-subject support
     */
    processLoadedTopicLists: function(topicListsData) {
        // Use the enhanced utility for topic list decoding
        return safeDecodeKnackTopicLists(topicListsData);
    },
    
    processLoadedCards: function(cardsData) {
        // Use the enhanced utility for cards decoding
        return safeDecodeKnackCards(cardsData);
    },
    
    processKnackUserData: function(userData) {
        // Use the enhanced utility for processing all user data
        return processKnackUserData(userData);
    },
    
    // Safe recovery functions that can be used by other services
    safeDecodeURIComponent,
    safeParseJSON
};

// --- TODO: Need to make FIELD_MAPPING available here --- 
// This might require importing it from the bridge script or defining it here.
// For now, using placeholders - replace with actual field IDs from your bridge script.
const FIELD_MAPPING = {
    cardBankData: 'field_2979', // Replace with actual field ID
    topicLists: 'field_3011',   // Replace with actual field ID
    colorMapping: 'field_3000', // Replace with actual field ID
    spacedRepetition: 'field_xxxx', // Placeholder - Check if needed/stringified correctly
    box1Data: 'field_2986', // Replace with actual field ID (Needed if spacedRepetition isn't one field)
    box2Data: 'field_2987', // Replace with actual field ID
    box3Data: 'field_2988', // Replace with actual field ID
    box4Data: 'field_2989', // Replace with actual field ID
    box5Data: 'field_2990', // Replace with actual field ID
    topicMetadata: 'field_3030', // Replace with actual field ID
    lastSaved: 'field_2957' // Replace with actual field ID
};

export default SaveQueueService;
