// Enhanced Message Handler for Knack Integration
// Implementation for handling messages from the React app iframe

// Listen for messages from the React app iframe
window.addEventListener('message', function(event) {
  // Ensure message is from our React app iframe
  if (!event.data || !event.data.type) return;
  
  console.log(`[${new Date().toISOString()}] Received message from React app: ${event.data.type}`);
  debugLog("MESSAGE RECEIVED", {
    type: event.data.type,
    timestamp: new Date().toISOString(),
    hasData: event.data.data ? true : false
  });
  
  // Handle different message types
  switch (event.data.type) {
    case 'SAVE_DATA':
      console.log(`[${new Date().toISOString()}] Saving data with preserveFields:`, event.data.data.preserveFields);
      debugLog("SAVE_DATA MESSAGE DETAILS", {
        recordId: event.data.data.recordId,
        preserveFields: event.data.data.preserveFields,
        topicListCount: event.data.data.topicLists ? event.data.data.topicLists.length : 0,
        hasExplicitFields: !!event.data.data.explicitFields
      });
      
      // Get provided data
      const messageData = event.data.data;
      const recordId = messageData.recordId;
      
      // If preserveFields flag is set, merge data instead of replacing
      if (messageData.preserveFields === true && messageData.completeData) {
        console.log(`[${new Date().toISOString()}] Using data preservation mode`);
        // This is crucial: We need to keep all other fields intact
        const existingData = messageData.completeData;
        
        // Create a merged data object
        const mergedData = {
          // Keep all existing fields from the complete data
          ...existingData,
          
          // Override only the specific fields we want to update
          field_3011: JSON.stringify(messageData.topicLists), // Topic Lists
          field_3030: JSON.stringify(messageData.topicMetadata), // Topic Metadata
          field_2957: new Date().toISOString() // Last saved timestamp
        };
        
        debugLog("MERGED DATA FOR SAVE", {
          field_3011_size: JSON.stringify(messageData.topicLists).length,
          field_3030_size: JSON.stringify(messageData.topicMetadata).length,
          timestamp: new Date().toISOString()
        });
        
        // Now save the merged data to Knack
        saveToKnack(recordId, mergedData, function(success) {
          debugLog("SAVE RESULT", { success, timestamp: new Date().toISOString() });
          
          // Send result back to the React app
          if (event.source) {
            event.source.postMessage({
              type: 'SAVE_RESULT',
              success: success,
              timestamp: new Date().toISOString()
            }, '*');
          }
          
          // If successful, verify the save
          if (success) {
            verifyDataSave(recordId);
          }
        });
      }
      // Otherwise use the standard save logic with field preservation
      else {
        console.log(`[${new Date().toISOString()}] Using standard save logic with field preservation`);
        
        // First get the current data to avoid overwriting fields we don't manage
        getCurrentData(recordId, function(existingData) {
          if (!existingData) {
            console.error(`[${new Date().toISOString()}] Failed to get current data for standard save`);
            
            // Even if we can't get current data, try to save what we have
            const basicDataToSave = {
              field_3011: JSON.stringify(messageData.topicLists || []),
              field_3030: JSON.stringify(messageData.topicMetadata || []),
              field_2957: new Date().toISOString() // Last saved timestamp
            };
            
            saveToKnack(recordId, basicDataToSave, function(success) {
              // Send result back to the React app
              if (event.source) {
                event.source.postMessage({
                  type: 'SAVE_RESULT',
                  success: success,
                  timestamp: new Date().toISOString()
                }, '*');
              }
            });
            
            return;
          }
          
          // Create a merged data object using the existing data as a base
          const mergedData = {
            // Keep all existing fields from the complete data
            ...existingData,
            
            // Update the fields we want to save
            field_3011: messageData.explicitFields?.field_3011 || JSON.stringify(messageData.topicLists || []), // Topic Lists
            field_3030: messageData.explicitFields?.field_3030 || JSON.stringify(messageData.topicMetadata || []), // Topic Metadata
            field_2957: new Date().toISOString(), // Last saved timestamp
            
            // Preserve card data if available in the message
            field_2979: messageData.cards ? JSON.stringify(messageData.cards) : existingData.field_2979,
            
            // Preserve spaced repetition data if available in the message
            field_2986: messageData.spacedRepetition?.box1 ? JSON.stringify(messageData.spacedRepetition.box1) : existingData.field_2986,
            field_2987: messageData.spacedRepetition?.box2 ? JSON.stringify(messageData.spacedRepetition.box2) : existingData.field_2987,
            field_2988: messageData.spacedRepetition?.box3 ? JSON.stringify(messageData.spacedRepetition.box3) : existingData.field_2988,
            field_2989: messageData.spacedRepetition?.box4 ? JSON.stringify(messageData.spacedRepetition.box4) : existingData.field_2989,
            field_2990: messageData.spacedRepetition?.box5 ? JSON.stringify(messageData.spacedRepetition.box5) : existingData.field_2990
          };
          
          // Log important field values for debugging
          console.log(`[${new Date().toISOString()}] Field values for critical fields:`, {
            'field_3011_length': mergedData.field_3011 ? mergedData.field_3011.length : 0,
            'field_3030_length': mergedData.field_3030 ? mergedData.field_3030.length : 0,
            'used_explicit_fields': !!messageData.explicitFields
          });
          
          debugLog("MERGED DATA FOR STANDARD SAVE", {
            field_3011_size: mergedData.field_3011 ? mergedData.field_3011.length : 0,
            field_3030_size: mergedData.field_3030 ? mergedData.field_3030.length : 0,
            field_2979_preserved: !!mergedData.field_2979,
            field_2986_preserved: !!mergedData.field_2986,
            timestamp: new Date().toISOString()
          });
          
          // Now save the merged data to Knack
          saveToKnack(recordId, mergedData, function(success) {
            debugLog("STANDARD SAVE RESULT", { 
              success, 
              timestamp: new Date().toISOString() 
            });
            
            // Send result back to the React app
            if (event.source) {
              event.source.postMessage({
                type: 'SAVE_RESULT',
                success: success,
                timestamp: new Date().toISOString()
              }, '*');
            }
            
            // If successful, verify the save to confirm topicLists are still there
            if (success) {
              verifyDataSave(recordId);
            }
          });
        });
      }
      break;
      
    case 'ADD_TO_BANK':
      // Handle adding cards to the bank AND to Box 1
      handleAddToBank(event.data.data, function(success) {
        // Send result back to the React app
        if (event.source) {
          event.source.postMessage({
            type: 'ADD_TO_BANK_RESULT',
            success: success
          }, '*');
        }
      });
      break;
      
    // Handle other message types as needed...
  }
});

// Function to handle "Add to Bank" functionality
function handleAddToBank(data, callback) {
  // Extract needed information
  const recordId = data.recordId;
  const newCards = data.cards || [];
  
  if (!recordId || newCards.length === 0) {
    console.error('Invalid data for Add to Bank');
    callback(false);
    return;
  }
  
  // First, get the current data from Knack
  getCurrentData(recordId, function(existingData) {
    if (!existingData) {
      console.error('Failed to get current data');
      callback(false);
      return;
    }
    
    // Parse existing card bank (field_2979)
    let existingCards = [];
    try {
      existingCards = JSON.parse(existingData.field_2979 || '[]');
      if (!Array.isArray(existingCards)) existingCards = [];
    } catch (e) {
      console.error('Error parsing existing cards', e);
      existingCards = [];
    }
    
    // Parse existing Box 1 (field_2986)
    let box1Cards = [];
    try {
      box1Cards = JSON.parse(existingData.field_2986 || '[]');
      if (!Array.isArray(box1Cards)) box1Cards = [];
    } catch (e) {
      console.error('Error parsing box 1 cards', e);
      box1Cards = [];
    }
    
    // Add new cards to card bank
    const updatedCards = [...existingCards, ...newCards];
    
    // Create Box 1 references for new cards (just need IDs and review dates)
    const newBox1Items = newCards.map(card => ({
      cardId: card.id,
      lastReviewed: new Date().toISOString(),
      nextReviewDate: new Date().toISOString()
    }));
    
    // Add new items to Box 1
    const updatedBox1 = [...box1Cards, ...newBox1Items];
    
    // Prepare data to save
    const dataToSave = {
      field_2979: JSON.stringify(updatedCards), // Card Bank
      field_2986: JSON.stringify(updatedBox1),  // Box 1
      field_2957: new Date().toISOString()      // Last Saved timestamp
    };
    
    // Save to Knack
    saveToKnack(recordId, dataToSave, callback);
  });
}

// Function to get current data from Knack
function getCurrentData(recordId, callback) {
  console.log(`[${new Date().toISOString()}] Getting current data for record:`, recordId);
  
  // Implement the actual API call to fetch the record data from Knack
  $.ajax({
    url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`,
    type: 'GET',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    success: function(response) {
      debugLog("RETRIEVED CURRENT DATA", {
        recordId: recordId,
        timestamp: new Date().toISOString(),
        hasTopicLists: response && response[FIELD_MAPPING.topicLists] ? true : false
      });
      callback(response);
    },
    error: function(error) {
      console.error(`[${new Date().toISOString()}] Error fetching record data:`, error);
      debugLog("ERROR FETCHING RECORD", {
        recordId: recordId,
        errorStatus: error.status,
        errorMessage: error.statusText
      });
      callback(null);
    }
  });
}

// Function to save data to Knack
function saveToKnack(recordId, data, callback) {
  console.log(`[${new Date().toISOString()}] Saving data to record:`, recordId);
  
  // Implement retry mechanism for more reliable saving
  let retryCount = 0;
  const maxRetries = 2;
  
  function attemptSave() {
    $.ajax({
      url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`,
      type: 'PUT',
      headers: {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': Knack.getUserToken(),
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(data),
      success: function(response) {
        console.log(`[${new Date().toISOString()}] Save successful:`, response.id);
        debugLog("SAVE SUCCESSFUL", {
          recordId: response.id,
          timestamp: new Date().toISOString()
        });
        callback(true);
      },
      error: function(error) {
        console.error(`[${new Date().toISOString()}] Error saving data:`, error);
        debugLog("SAVE ERROR", {
          recordId: recordId,
          errorStatus: error.status,
          errorMessage: error.statusText,
          retryCount: retryCount
        });
        
        // Implement retry logic
        if (retryCount < maxRetries) {
          console.log(`[${new Date().toISOString()}] Retrying save (${retryCount + 1}/${maxRetries})...`);
          retryCount++;
          // Wait before retrying
          setTimeout(attemptSave, 1000);
        } else {
          callback(false);
        }
      }
    });
  }
  
  // Start the save process
  attemptSave();
}

// Function to verify data was saved correctly and notify the React app
function verifyDataSave(recordId) {
  console.log(`[${new Date().toISOString()}] Verifying data save for record:`, recordId);
  
  // Wait a longer time to ensure data has been committed to the database
  setTimeout(function() {
    // Fetch the record to verify the data is there
    $.ajax({
      url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`,
      type: 'GET',
      headers: {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': Knack.getUserToken(),
        'Content-Type': 'application/json'
      },
      success: function(response) {
        debugLog("VERIFICATION RESULT", {
          recordId: recordId,
          hasTopicLists: response && response[FIELD_MAPPING.topicLists] ? true : false,
          hasCards: response && response[FIELD_MAPPING.cardBankData] ? true : false,
          timestamp: new Date().toISOString()
        });
        
        // Check if topic lists (field_3011) exists and has content
        let topicListsValid = false;
        if (response && response[FIELD_MAPPING.topicLists]) {
          try {
            const topicListsJson = response[FIELD_MAPPING.topicLists];
            const topicLists = safeParseJSON(topicListsJson);
            
            if (Array.isArray(topicLists) && topicLists.length > 0) {
              console.log(`[${new Date().toISOString()}] Verification successful: Topic lists present with ${topicLists.length} items`);
              topicListsValid = true;
              
              // More thorough validation of topic lists structure
              let isValidStructure = true;
              let validationErrors = [];
              
              topicLists.forEach((list, index) => {
                // Check if each list has required fields
                if (!list.id) {
                  isValidStructure = false;
                  validationErrors.push(`List ${index} missing id`);
                }
                if (!list.subject) {
                  isValidStructure = false;
                  validationErrors.push(`List ${index} missing subject`);
                }
                if (!list.examBoard) {
                  isValidStructure = false;
                  validationErrors.push(`List ${index} missing examBoard`);
                }
                if (!list.examType) {
                  isValidStructure = false;
                  validationErrors.push(`List ${index} missing examType`);
                }
                if (!Array.isArray(list.topics)) {
                  isValidStructure = false;
                  validationErrors.push(`List ${index} topics is not an array`);
                }
              });
              
              if (!isValidStructure) {
                console.error(`[${new Date().toISOString()}] Topic lists structure validation failed:`, validationErrors);
                // Log details about the invalid structure for debugging
                debugLog("INVALID TOPIC LIST STRUCTURE", {
                  errors: validationErrors,
                  sampleData: JSON.stringify(topicLists[0]).substring(0, 200) + '...'
                });
              } else {
                console.log(`[${new Date().toISOString()}] Topic lists structure validation passed`);
              }
            } else {
              console.error(`[${new Date().toISOString()}] Verification warning: Topic lists empty or malformed`);
            }
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Error parsing topic lists during verification:`, e);
          }
        } else {
          console.error(`[${new Date().toISOString()}] Verification warning: No topic lists field found`);
        }
        
        // Check if cards (field_2979) exists and has content
        let cardsValid = false;
        if (response && response[FIELD_MAPPING.cardBankData]) {
          try {
            const cards = safeParseJSON(response[FIELD_MAPPING.cardBankData]);
            if (Array.isArray(cards) && cards.length > 0) {
              console.log(`[${new Date().toISOString()}] Verification successful: Cards present with ${cards.length} items`);
              cardsValid = true;
            } else {
              console.error(`[${new Date().toISOString()}] Verification warning: Cards empty or malformed`);
            }
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Error parsing cards during verification:`, e);
          }
        } else {
          console.error(`[${new Date().toISOString()}] Verification warning: No cards field found`);
        }
        
        // Push the verification result back to the React app
        // Attempt to find the iframe and send a message
        try {
          // First try using window.frames
          if (window.frames.length > 0 && window.frames[0].postMessage) {
            window.frames[0].postMessage({
              type: 'VERIFICATION_RESULT',
              success: topicListsValid,
              data: {
                topicListsValid,
                cardsValid,
                timestamp: new Date().toISOString()
              }
            }, '*');
          } 
          // If that fails, try searching for the iframe
          else {
            const iframe = document.getElementById('flashcard-app-iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                type: 'VERIFICATION_RESULT',
                success: topicListsValid,
                data: {
                  topicListsValid,
                  cardsValid,
                  timestamp: new Date().toISOString()
                }
              }, '*');
            } else {
              console.warn('[Verification] Failed to find iframe for messaging');
            }
          }
        } catch (error) {
          console.error('[Verification] Error sending verification result:', error);
        }
      },
      error: function(error) {
        console.error(`[${new Date().toISOString()}] Verification error:`, error);
        
        // Push the error back to the React app
        if (window.frames.length > 0 && window.frames[0].postMessage) {
          window.frames[0].postMessage({
            type: 'VERIFICATION_ERROR',
            error: error.statusText || 'Unknown error',
            timestamp: new Date().toISOString()
          }, '*');
        }
      }
    });
  }, 5000); // Wait 5 seconds before verification to ensure data is committed
}

// Safe JSON parse helper function (in case it's not defined elsewhere)
function safeParseJSON(jsonString) {
  if (!jsonString) return null;
  
  try {
    // If it's already an object, just return it
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular JSON parse
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error, "String:", jsonString ? jsonString.substring(0, 100) : "null");
    
    // Return empty array as fallback for arrays
    return [];
  }
}

// Debug log helper (in case it's not defined elsewhere)
function debugLog(title, data) {
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(`%c${title}`, 'color: #5d00ff; font-weight: bold;');
    console.log(JSON.stringify(data, null, 2));
    console.groupEnd();
  } else {
    console.log(`[${title}]`, JSON.stringify(data));
  }
}
