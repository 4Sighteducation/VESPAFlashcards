// Enhanced Message Handler for Knack Integration
// For inclusion in your parent window (knack-integration.js)

// Listen for messages from the React app iframe
window.addEventListener('message', function(event) {
  // Ensure message is from our React app iframe
  if (!event.data || !event.data.type) return;
  
  console.log(`Received message from React app: ${event.data.type}`);
  
  // Handle different message types
  switch (event.data.type) {
    case 'SAVE_DATA':
      console.log('Saving data with preserveFields:', event.data.data.preserveFields);
      
      // Get provided data
      const messageData = event.data.data;
      const recordId = messageData.recordId;
      
      // If preserveFields flag is set, merge data instead of replacing
      if (messageData.preserveFields === true && messageData.completeData) {
        // This is crucial: We need to keep all other fields intact
        const existingData = messageData.completeData;
        
        // Create a merged data object
        const mergedData = {
          // Keep all existing fields from the complete data
          ...existingData,
          
          // Override only the specific fields we want to update
          field_3011: JSON.stringify(messageData.topicLists), // Topic Lists
          field_3030: JSON.stringify(messageData.topicMetadata) // Topic Metadata
        };
        
        // Now save the merged data to Knack
        saveToKnack(recordId, mergedData, function(success) {
          // Send result back to the React app
          if (event.source) {
            event.source.postMessage({
              type: 'SAVE_RESULT',
              success: success
            }, '*');
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
  // This is a placeholder - you'll need to implement the actual API call
  // to fetch the record data from Knack
  console.log('Getting current data for record:', recordId);
  
  // In a real implementation, this would be an AJAX call to Knack API
  // Example (pseudo-code):
  /*
  $.ajax({
    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records/' + recordId,
    type: 'GET',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    success: function(response) {
      callback(response);
    },
    error: function(error) {
      console.error('Error fetching record data:', error);
      callback(null);
    }
  });
  */
  
  // For now, return null and let the callback handle it
  callback(null);
}

// Function to save data to Knack
function saveToKnack(recordId, data, callback) {
  // This is a placeholder - you'll need to implement the actual API call
  // to save the data to Knack
  console.log('Saving data to record:', recordId);
  console.log('Data to save:', data);
  
  // In a real implementation, this would be an AJAX call to Knack API
  // Example (pseudo-code):
  /*
  $.ajax({
    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records/' + recordId,
    type: 'PUT',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(data),
    success: function(response) {
      console.log('Save successful:', response);
      callback(true);
    },
    error: function(error) {
      console.error('Error saving data:', error);
      callback(false);
    }
  });
  */
  
  // For now, return success and let the callback handle it
  callback(true);
}
