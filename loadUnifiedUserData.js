// Function to load unified user data from field_3032
function loadUnifiedUserData(userId, callback) {
  console.log(`Flashcard app [${new Date().toISOString()}]: Loading unified data for user:`, userId);

  // First, check if the user already has a flashcard record
  $.ajax({
    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records',
    type: 'GET',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    data: {
      format: 'raw',
      filters: JSON.stringify({
        match: 'and',
        rules: [
          {
            field: FIELD_MAPPING.userId,
            operator: 'is',
            value: userId
          }
        ]
      })
    },
    success: function(response) {
      console.log(`Flashcard app [${new Date().toISOString()}]: User data search response:`, response);
      
      if (response.records && response.records.length > 0) {
        // User has existing data
        const record = response.records[0];
        console.log(`Flashcard app [${new Date().toISOString()}]: Found existing user data:`, record);
        
        try {
          // Parse unified data
          let unifiedData = null;
          if (record[FIELD_MAPPING.unifiedData]) {
            // Make sure to decode URL-encoded data if needed
            let data = record[FIELD_MAPPING.unifiedData];
            if (typeof data === 'string' && data.includes('%')) {
              data = safeDecodeURIComponent(data);
            }
            unifiedData = safeParseJSON(data);
          }
          
          // If there's no unified data yet, initialize with empty structure
          if (!unifiedData) {
            unifiedData = initializeEmptyUnifiedData();
            console.log(`Flashcard app [${new Date().toISOString()}]: No existing unified data, initializing empty structure`);
          }
          
          // Return the unified data
          callback({
            recordId: record.id,
            unifiedData: unifiedData
          });
        } catch (e) {
          console.error(`Flashcard app [${new Date().toISOString()}]: Error parsing unified data:`, e);
          
          // If error, return empty data structure
          callback({
            recordId: record.id,
            unifiedData: initializeEmptyUnifiedData()
          });
        }
      } else {
        // No existing data, create a new record
        console.log(`Flashcard app [${new Date().toISOString()}]: No existing user data found, creating new record`);
        createUnifiedUserRecord(userId, callback);
      }
    },
    error: function(error) {
      console.error(`Flashcard app [${new Date().toISOString()}]: Error loading user data:`, error);
      callback(null);
    }
  });
}

// Function to create a new user record with unified data structure
function createUnifiedUserRecord(userId,
