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
            field_3011: JSON.stringify(messageData.topicLists || []), // Topic Lists
            field_3030: JSON.stringify(messageData.topicMetadata || []), // Topic Metadata
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

// Import the UnifiedDataService functions
// This import is dynamically injected at runtime so we access it through window
function getUnifiedDataService() {
  // In production, UnifiedDataService should be available through the main app
  if (window.UnifiedDataService) {
    return window.UnifiedDataService;
  }
  
  // If not directly available, define a minimal version here for reliability
  return {
    addCardsToTopic: async (cards, topicId, userId, auth) => {
      console.log("Using fallback addCardsToTopic implementation");
      return addCardsToTopicFallback(cards, topicId, userId, auth);
    }
  };
}

// Function to handle "Add to Bank" functionality using UnifiedDataService
async function handleAddToBank(data, callback) {
  try {
    // Extract needed information
    const recordId = data.recordId;
    const newCards = data.cards || [];
    const topicId = data.topicId; // Topic ID for associating cards with a topic
    
    // Validate input
    if (newCards.length === 0) {
      console.error('No cards provided for Add to Bank');
      callback(false);
      return;
    }
    
    // Look up user ID from recordId if needed
    let userId = data.userId;
    if (!userId && recordId) {
      try {
        const userData = await new Promise((resolve, reject) => {
          getCurrentData(recordId, function(data) {
            if (data) resolve(data);
            else reject(new Error('Failed to get user data'));
          });
        });
        
        // Extract userId from user data
        userId = userData.field_2954;
      } catch (error) {
        console.error('Failed to get userId from record:', error);
      }
    }
    
    if (!userId) {
      console.error('Missing userId for Add to Bank');
      callback(false);
      return;
    }
    
    // Log operation
    console.log(`[${new Date().toISOString()}] Adding cards to bank with UnifiedDataService`, {
      cardCount: newCards.length,
      hasTopicId: !!topicId,
      userId
    });
    
    // Get auth token - Using Knack's built-in token
    const auth = { token: Knack.getUserToken() };
    
    // Process the cards to ensure they have required fields
    const processedCards = newCards.map(card => {
      return {
        ...card,
        type: 'card',
        created: card.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        id: card.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };
    });
    
    // Enhanced logging to debug card processing
    debugLog("PROCESSED CARDS FOR ADD_TO_BANK", {
      sample: processedCards[0],
      count: processedCards.length,
      topicId: topicId
    });
    
    // If we have a topicId, use UnifiedDataService to add cards to topic
    if (topicId) {
      const UnifiedDataService = getUnifiedDataService();
      console.log(`[${new Date().toISOString()}] Using UnifiedDataService to add cards to topic ${topicId}`);
      
      const success = await UnifiedDataService.addCardsToTopic(
        processedCards, 
        topicId, 
        userId, 
        auth
      );
      
      // Enhanced logging after the operation is completed
      debugLog("ADD_TO_TOPIC_RESULT", {
        success: success,
        topicId: topicId,
        cardCount: processedCards.length
      });
      
      callback(success);
      return;
    }
    
    // If no topicId, use the traditional approach
    addCardsToCardBank(recordId, processedCards, callback);
  } catch (error) {
    console.error('Error in handleAddToBank:', error);
    callback(false);
  }
}

// Fallback function to add cards to the card bank (used when no topic ID is provided)
function addCardsToCardBank(recordId, processedCards, callback) {
  console.log(`[${new Date().toISOString()}] Adding cards to card bank without topic association`);
  // Get current data
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
    
    // Enhanced logging for better diagnostics
    debugLog("PARSED EXISTING CARDS", {
      count: existingCards.length,
      topicShellCount: existingCards.filter(item => item.type === 'topic').length,
      cardCount: existingCards.filter(item => item.type !== 'topic').length,
    });
    
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
    const updatedCards = [...existingCards, ...processedCards];
    
    // Create Box 1 references for new cards
    const newBox1Items = processedCards.map(card => ({
      cardId: card.id,
      lastReviewed: card.lastReviewed || new Date().toISOString(),
      nextReviewDate: card.nextReviewDate || new Date().toISOString()
    }));
    
    // Add new items to Box 1
    const updatedBox1 = [...box1Cards, ...newBox1Items];
    
    // Prepare data to save
    const dataToSave = {
      field_2979: JSON.stringify(updatedCards), // Card Bank
      field_2986: JSON.stringify(updatedBox1),  // Box 1
      field_2957: new Date().toISOString()      // Last Saved timestamp
    };
    
    // Preserve other fields from existing data
    if (existingData.field_3011) dataToSave.field_3011 = existingData.field_3011; // Topic Lists
    if (existingData.field_3030) dataToSave.field_3030 = existingData.field_3030; // Topic Metadata
    if (existingData.field_2987) dataToSave.field_2987 = existingData.field_2987; // Box 2
    if (existingData.field_2988) dataToSave.field_2988 = existingData.field_2988; // Box 3
    if (existingData.field_2989) dataToSave.field_2989 = existingData.field_2989; // Box 4
    if (existingData.field_2990) dataToSave.field_2990 = existingData.field_2990; // Box 5
    
    // Save to Knack
    saveToKnack(recordId, dataToSave, callback);
  });
}

// Fallback implementation of addCardsToTopic
async function addCardsToTopicFallback(cards, topicId, userId, auth) {
  return new Promise((resolve, reject) => {
    console.log(`[${new Date().toISOString()}] Fallback: Adding cards to topic ${topicId} for user ${userId}`);
    // First get the record ID
    // We'll use the local Knack API to find the record
    $.ajax({
      url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records`,
      type: 'GET',
      headers: {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': Knack.getUserToken(),
        'Content-Type': 'application/json'
      },
      success: function(response) {
        const userRecord = response.records.find(record => 
          record.field_2954 === userId
        );
        
        if (!userRecord) {
          console.error('Could not find user record for userId:', userId);
          resolve(false);
          return;
        }
        
        const recordId = userRecord.id;
        
        // Now get the current data
        getCurrentData(recordId, function(existingData) {
          if (!existingData) {
            console.error('Failed to get current data');
            resolve(false);
            return;
          }
          
          // Parse existing cards
          let existingCards = [];
          try {
            existingCards = JSON.parse(existingData.field_2979 || '[]');
            if (!Array.isArray(existingCards)) existingCards = [];
          } catch (e) {
            console.error('Error parsing existing cards', e);
            existingCards = [];
          }
          
          // Enhanced logging for better diagnostics
          debugLog("PARSED EXISTING CARDS (FALLBACK)", {
            count: existingCards.length,
            topicShellCount: existingCards.filter(item => item.type === 'topic').length,
            cardCount: existingCards.filter(item => item.type !== 'topic').length,
          });
          
          // Parse existing Box 1
          let box1Cards = [];
          try {
            box1Cards = JSON.parse(existingData.field_2986 || '[]');
            if (!Array.isArray(box1Cards)) box1Cards = [];
          } catch (e) {
            console.error('Error parsing box 1 cards', e);
            box1Cards = [];
          }
          
          // Find topic shell
          const topicIndex = existingCards.findIndex(item => 
            item.type === 'topic' && item.id === topicId
          );
          
          if (topicIndex === -1) {
            console.error('Topic not found:', topicId);
            resolve(false);
            return;
          }
          
          const topicShell = existingCards[topicIndex];
          
          // Debug log of topic shell
          debugLog("TOPIC SHELL FOUND", {
            id: topicShell.id,
            name: topicShell.name || topicShell.topic,
            subject: topicShell.subject,
            isEmpty: topicShell.isEmpty
          });
          
          // Prepare cards for adding
          const processedCards = cards.map(card => {
            // Ensure ID and type
            card.id = card.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            card.type = 'card';
            
            // Add topic references
            card.topicId = topicId;
            
            // Use topic metadata if not provided
            if (!card.subject) card.subject = topicShell.subject;
            if (!card.topic) card.topic = topicShell.name || topicShell.topic;
            if (!card.examBoard) card.examBoard = topicShell.examBoard;
            if (!card.examType) card.examType = topicShell.examType;
            
            // Add timestamps
            if (!card.created) card.created = new Date().toISOString();
            card.updated = new Date().toISOString();
            
            return card;
          });
          
          // Update topic shell card references
          topicShell.cards = [...(topicShell.cards || []), ...processedCards.map(card => card.id)];
          topicShell.isEmpty = false; // No longer empty
          topicShell.updated = new Date().toISOString();
          
          // If topic has a baseColor, ensure color is set (not greyed out)
          if (topicShell.baseColor) {
            topicShell.color = topicShell.baseColor;
          }
          
          // Update the topic in the existing cards
          existingCards[topicIndex] = topicShell;
          
          // Enhanced logging to verify the topic shell update
          debugLog("UPDATED TOPIC SHELL", {
            id: topicShell.id,
            name: topicShell.name || topicShell.topic,
            cardIds: topicShell.cards,
            isEmpty: topicShell.isEmpty
          });
          
          // Add new cards to the data
          const updatedCards = [...existingCards, ...processedCards];
          
          // Create Box 1 entries for the new cards
          const newBox1Items = processedCards.map(card => ({
            cardId: card.id,
            lastReviewed: card.lastReviewed || new Date().toISOString(),
            nextReviewDate: card.nextReviewDate || new Date().toISOString()
          }));
          
          // Add to Box 1
          const updatedBox1 = [...box1Cards, ...newBox1Items];
          
          // Prepare data to save
          const dataToSave = {
            field_2979: JSON.stringify(updatedCards), // Card Bank
            field_2986: JSON.stringify(updatedBox1),  // Box 1
            field_2957: new Date().toISOString()      // Last Saved timestamp
          };
          
          // Preserve other fields
          if (existingData.field_3011) dataToSave.field_3011 = existingData.field_3011; // Topic Lists
          if (existingData.field_3030) dataToSave.field_3030 = existingData.field_3030; // Topic Metadata
          if (existingData.field_2987) dataToSave.field_2987 = existingData.field_2987; // Box 2
          if (existingData.field_2988) dataToSave.field_2988 = existingData.field_2988; // Box 3
          if (existingData.field_2989) dataToSave.field_2989 = existingData.field_2989; // Box 4
          if (existingData.field_2990) dataToSave.field_2990 = existingData.field_2990; // Box 5
          
          // Save to Knack
          saveToKnack(recordId, dataToSave, function(success) {
            resolve(success);
          });
        });
      },
      error: function(error) {
        console.error('Error finding user record:', error);
        resolve(false);
      }
    });
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
              
              // Enhanced logging to verify topic shells in the card data
              const topicShells = cards.filter(item => item.type === 'topic' && item.isShell);
              const regularCards = cards.filter(item => item.type !== 'topic');
              
              debugLog("CARD BANK CONTENT STATS", {
                totalItems: cards.length,
                topicShellCount: topicShells.length,
                regularCardCount: regularCards.length,
                topicShellSample: topicShells.length > 0 ? topicShells[0].name || 'Unknown Topic' : 'None'
              });
              
              cardsValid = true;
            } else {
              console.error(`[${new Date().toISOString()}] Verification warning: Cards empty or malformed`);
            }
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Error parsing cards
