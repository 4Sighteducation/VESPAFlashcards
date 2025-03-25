// Function to verify data was saved correctly and notify the React app
function verifyDataSave(recordId, sourceWindow) {
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
          hasCards: response && response[FIELD_MAPPING.cardBankData] ? true : false,
          timestamp: new Date().toISOString()
        });
        
        // Check if verification was successful
        let verificationSuccessful = false;
        
        // Check if topic lists (field_3011) exists and has content
        if (response && response[FIELD_MAPPING.topicLists]) {
          try {
            const topicListsJson = response[FIELD_MAPPING.topicLists];
            const topicLists = safeParseJSON(topicListsJson);
            
            if (Array.isArray(topicLists) && topicLists.length > 0) {
              console.log(`[${new Date().toISOString()}] Verification successful: Topic lists present with ${topicLists.length} items`);
              verificationSuccessful = true;
            }
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Error parsing topic lists during verification:`, e);
          }
        }
        
        // Check if cards (field_2979) exists and has content
        let cardsValid = false;
        if (response && response[FIELD_MAPPING.cardBankData]) {
          try {
            const cardsJson = response[FIELD_MAPPING.cardBankData];
            const cards = safeParseJSON(cardsJson);
            
            if (Array.isArray(cards) && cards.length > 0) {
              console.log(`[${new Date().toISOString()}] Cards verification successful: ${cards.length} cards present`);
              cardsValid = true;
            }
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Error parsing cards during verification:`, e);
          }
        }
        
        // KEY ADDITION: Send the full updated data back to the React app
        // This ensures the UI is updated with the latest data including topic shells
        if (sourceWindow) {
          console.log(`[${new Date().toISOString()}] Sending updated data to React app after verification`);
          sourceWindow.postMessage({
            type: 'LOAD_SAVED_DATA',
            data: response
          }, '*');
        } else {
          // Try to find the iframe if sourceWindow wasn't provided
          try {
            const iframe = document.getElementById('flashcard-app-iframe');
            if (iframe && iframe.contentWindow) {
              console.log(`[${new Date().toISOString()}] Sending updated data to React app iframe`);
              iframe.contentWindow.postMessage({
                type: 'LOAD_SAVED_DATA',
                data: response
              }, '*');
            }
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Error finding iframe:`, error);
          }
        }
      },
      error: function(error) {
        console.error(`[${new Date().toISOString()}] Verification error:`, error);
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
