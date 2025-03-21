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
        topicListCount: event.data.data.topicLists ? event.data.data.topicLists.length : 0
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
      // Otherwise use the standard save logic
      else {
        // Standard save logic (existing code)
        const dataToSave = {
          field_3011: JSON.stringify(messageData.topicLists),
          field_3030: JSON.stringify(messageData.topicMetadata)
          // Add any other fields you need to include
        };
        
        saveToKnack(recordId, dataToSave, function(success) {
          // Send result back to the React app
          if (event.source) {
            event.source.postMessage({
              type: 'SAVE_RESULT',
              success: success
            }, '*');
          }
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

// Function to verify data was saved correctly
function verifyDataSave(recordId) {
  console.log(`[${new Date().toISOString()}] Verifying data save for record:`, recordId);
  
  // Wait a moment to ensure data has been committed to the database
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
          timestamp: new Date().toISOString()
        });
        
        // Check if field_3011 exists and has content
        if (response && response[FIELD_MAPPING.topicLists]) {
          const topicLists = safeParseJSON(response[FIELD_MAPPING.topicLists]);
          if (Array.isArray(topicLists) && topicLists.length > 0) {
            console.log(`[${new Date().toISOString()}] Verification successful: Topic lists present with ${topicLists.length} items`);
          } else {
            console.error(`[${new Date().toISOString()}] Verification failed: Topic lists empty or malformed`);
          }
        } else {
          console.error(`[${new Date().toISOString()}] Verification failed: No topic lists field found`);
        }
      },
      error: function(error) {
        console.error(`[${new Date().toISOString()}] Verification error:`, error);
      }
    });
  }, 2000); // Wait 2 seconds before verification
}
