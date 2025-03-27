// Function to verify data was saved correctly and notify the React app
function verifyDataSave(recordId, sourceWindow) {
  console.log(`[${new Date().toISOString()}] Verifying data save for record:`, recordId);
  
  // Check if verification is necessary
  // Skip verification if there's already another save operation in progress
  if (window.saveInProgress === true) {
    console.log(`[${new Date().toISOString()}] Skipping verification - another save operation is in progress`);
    
    // Send a status notification to the React app
    if (sourceWindow) {
      sourceWindow.postMessage({
        type: 'VERIFICATION_SKIPPED',
        reason: 'Another save operation is in progress',
        timestamp: new Date().toISOString()
      }, '*');
    }
    
    return;
  }
  
  // Limit verification frequency - check if we've verified recently
  const now = new Date().getTime();
  const lastVerificationTime = window.lastVerificationTime || 0;
  
  // If we've verified within the last 10 seconds, skip this verification
  if (now - lastVerificationTime < 10000) {
    console.log(`[${new Date().toISOString()}] Skipping redundant verification - last verification was ${(now - lastVerificationTime) / 1000}s ago`);
    
    // Send a status notification to the React app
    if (sourceWindow) {
      sourceWindow.postMessage({
        type: 'VERIFICATION_SKIPPED',
        reason: 'Recent verification already performed',
        timestamp: new Date().toISOString()
      }, '*');
    }
    
    return;
  }
  
  // Update the last verification time
  window.lastVerificationTime = now;
  
  // Set a timeout for verification
  setTimeout(function() {
    try {
      // Get a fresh token to avoid 403 errors
      const currentToken = Knack.getUserToken();
      console.log(`[${new Date().toISOString()}] Using token for verification: ${currentToken ? 'Available' : 'Missing'}`);
      
      // If no token, can't verify - fail gracefully
      if (!currentToken) {
        console.log(`[${new Date().toISOString()}] Verification skipped - no auth token available`);
        
        // Notify React app
        if (sourceWindow) {
          sourceWindow.postMessage({
            type: 'VERIFICATION_SKIPPED',
            reason: 'No auth token available',
            timestamp: new Date().toISOString()
          }, '*');
        }
        
        return;
      }
      
      // Fetch the record to verify the data is there
      $.ajax({
        url: `${KNACK_API_URL}/objects/${FLASHCARD_OBJECT}/records/${recordId}`,
        type: 'GET',
        headers: {
          'X-Knack-Application-Id': knackAppId,
          'X-Knack-REST-API-Key': knackApiKey,
          'Authorization': currentToken,
          'Content-Type': 'application/json'
        },
        success: function(response) {
          debugLog("VERIFICATION RESULT", {
            recordId: recordId,
            hasTopicLists: response && response[FIELD_MAPPING.topicLists] ? "yes" : "no",
            hasCardBank: response && response[FIELD_MAPPING.cardBankData] ? "yes" : "no",
            timestamp: new Date().toISOString()
          });
          
          // Simplified verification with just basic checks
          let verificationSuccessful = false;
          
          // Check if topic lists (field_3011) exists and has content
          if (response && response[FIELD_MAPPING.topicLists]) {
            try {
              const topicListsJson = response[FIELD_MAPPING.topicLists];
              const topicLists = safeParseJSON(topicListsJson);
              
              if (Array.isArray(topicLists) && topicLists.length > 0) {
                console.log(`[${new Date().toISOString()}] Verification successful: Topic lists present with ${topicLists.length} items`);
                
                // Simple check to see if topics actually have content
                const hasTopics = topicLists.some(list => Array.isArray(list.topics) && list.topics.length > 0);
                if (hasTopics) {
                  console.log(`[${new Date().toISOString()}] Topic lists contain topics - save fully verified`);
                  verificationSuccessful = true;
                }
              }
            } catch (e) {
              console.error(`[${new Date().toISOString()}] Error parsing topic lists during verification:`, e);
            }
          }
          
          // Check card bank data - simpler check without modifying data
          if (response && response[FIELD_MAPPING.cardBankData]) {
            try {
              const cardBankJson = response[FIELD_MAPPING.cardBankData];
              let cardBank = safeParseJSON(cardBankJson);
              
              // Calculate counts but don't modify data
              if (Array.isArray(cardBank) && cardBank.length > 0) {
                // Count topic shells and regular cards
                const topicShells = cardBank.filter(item => item.type === 'topic' || item.isShell === true);
                const cards = cardBank.filter(item => item.type !== 'topic' && item.isShell !== true);
                
                console.log(`[${new Date().toISOString()}] Card bank contains ${topicShells.length} topic shells and ${cards.length} cards`);
                
                // Count cards with topicId references
                const cardsWithTopicIds = cards.filter(card => card.topicId && typeof card.topicId === 'string');
                console.log(`[${new Date().toISOString()}] ${cardsWithTopicIds.length} of ${cards.length} cards have topicId references`);
              }
            } catch (e) {
              console.error(`[${new Date().toISOString()}] Error parsing card bank during verification:`, e);
            }
          }
          
          // Send the verification result back to the React app
          if (sourceWindow) {
            sourceWindow.postMessage({
              type: 'VERIFICATION_COMPLETE',
              success: verificationSuccessful,
              recordId: recordId,
              timestamp: new Date().toISOString()
            }, '*');
          }
        },
        error: function(error) {
          console.error(`[${new Date().toISOString()}] Verification error:`, error);
          
          // Notify React app of verification failure
          if (sourceWindow) {
            sourceWindow.postMessage({
              type: 'VERIFICATION_FAILED',
              error: error.status || 'Unknown error',
              recordId: recordId,
              timestamp: new Date().toISOString()
            }, '*');
          }
        }
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error setting up verification:`, error);
      
      // Notify React app of setup failure
      if (sourceWindow) {
        sourceWindow.postMessage({
          type: 'VERIFICATION_FAILED',
          error: 'Setup error: ' + (error.message || 'Unknown error'),
          recordId: recordId,
          timestamp: new Date().toISOString()
        }, '*');
      }
    }
  }, 3000); // Reduced from 5000ms to 3000ms for better responsiveness
}

// Ensure options are preserved for multiple choice cards
function ensureOptionsPreserved(cards) {
  if (!Array.isArray(cards)) return cards;
  
  let cardsWithAnswerPattern = 0;
  
  const result = cards.map(card => {
    // Skip topic shells or null items
    if (!card || card.type === 'topic' || card.isShell) {
      return card;
    }
    
    // Check for "Correct Answer: X)" pattern in answer
    const hasCorrectAnswerPattern = card.answer && 
                                  typeof card.answer === 'string' && 
                                  card.answer.match(/Correct Answer:\s*[a-z]\)/i);
                                  
    if (hasCorrectAnswerPattern) {
      cardsWithAnswerPattern++;
      
      // Force questionType to multiple_choice for these cards
      card.questionType = 'multiple_choice';
      
      // Remove type field if it refers to question format
      if (card.type === 'multiple_choice' || card.type === 'short_answer') {
        delete card.type;
      }
      
      // If options are missing, try to recreate them
      if (!card.options || !Array.isArray(card.options) || card.options.length === 0) {
        // Try to use savedOptions first
        if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
          console.log(`[${new Date().toISOString()}] Restoring options from savedOptions for card ${card.id}`);
          card.options = [...card.savedOptions];
        } else {
          // Try to extract the correct option letter
          const correctAnswerMatch = card.answer.match(/Correct Answer:\s*([a-e])\)/i);
          if (correctAnswerMatch) {
            const correctLetter = correctAnswerMatch[1].toLowerCase();
            const letters = ['a', 'b', 'c', 'd', 'e'];
            const options = [];
            
            // Create placeholder options with the correct one marked
            letters.slice(0, 4).forEach(letter => {
              options.push({
                text: letter === correctLetter ? 
                      (card.detailedAnswer || 'Correct option') : 
                      `Option ${letter.toUpperCase()}`,
                isCorrect: letter === correctLetter
              });
            });
            
            console.log(`[${new Date().toISOString()}] Created options from answer pattern for card ${card.id}`);
            card.options = options;
            card.savedOptions = [...options];
          }
        }
      }
      
      // Always ensure savedOptions is also set
      if (card.options && Array.isArray(card.options) && card.options.length > 0 &&
          (!card.savedOptions || !Array.isArray(card.savedOptions))) {
        card.savedOptions = [...card.options];
      }
    }
    
    // Always check if this is a multiple choice card that needs option preservation
    if (card.questionType === 'multiple_choice' || card.type === 'multiple_choice') {
      // Ensure questionType is set correctly
      card.questionType = 'multiple_choice';
      
      // Remove type field if it refers to question format
      if (card.type === 'multiple_choice' || card.type === 'short_answer') {
        delete card.type;
      }
      
      // Apply fixes to options if needed
      if (!card.options || !Array.isArray(card.options) || card.options.length === 0) {
        if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
          card.options = [...card.savedOptions];
          console.log(`[${new Date().toISOString()}] Restored missing options for card ${card.id}`);
        }
      } else if (!card.savedOptions || !Array.isArray(card.savedOptions) || card.savedOptions.length === 0) {
        card.savedOptions = [...card.options];
        console.log(`[${new Date().toISOString()}] Backed up options for card ${card.id}`);
      }
    }
    
    return card;
  });
  
  console.log(`[${new Date().toISOString()}] Options preservation complete:`, {
    total: cards.length,
    withAnswerPattern: cardsWithAnswerPattern,
    withOptions: cards.filter(c => c && c.options && Array.isArray(c.options) && c.options.length > 0).length,
    withSavedOptions: cards.filter(c => c && c.savedOptions && Array.isArray(c.savedOptions) && c.savedOptions.length > 0).length,
    multipleChoice: cards.filter(c => c && c.questionType === 'multiple_choice').length
  });
  
  return result;
}

// Main message handler function to centralize all message processing
function handleMessage(event, sourceWindow) {
  // Safety check for event data
  if (!event || !event.data || !event.data.type) {
    return;
  }
  
  // Extract message type and data
  const { type, data, timestamp } = event.data;
  
  // Log message receipt for debugging
  console.log(`MESSAGE RECEIVED`, {
    type,
    timestamp,
    hasData: data ? "yes" : "no"
  });
  
  // Process message based on type
  switch (type) {
    case "APP_READY":
      // Handle app ready message
      console.log(`Flashcard app: React app is ready, sending user info`);
      // Send user info to app (implementation depends on your system)
      break;
      
    case "REQUEST_TOKEN_REFRESH":
      // Handle token refresh request
      console.log(`Flashcard app [${new Date().toISOString()}]: Message from React app: REQUEST_TOKEN_REFRESH`);
      handleTokenRefresh(event, sourceWindow || event.source);
      break;
      
    case "ADD_TO_BANK":
      // Handle adding cards to bank
      console.log(`Flashcard app: Adding cards to bank:`, data);
      // Process adding cards (implementation depends on your system)
      break;
      
    case "TRIGGER_SAVE":
      // Handle save trigger
      console.log(`Flashcard app: Triggered save from React app`);
      // Process save (implementation depends on your system)
      break;
      
    case "REQUEST_REFRESH":
      // Handle refresh request
      console.log(`Flashcard app: Requested refresh`);
      // Process refresh (implementation depends on your system)
      break;
      
    default:
      // Log unknown message types
      console.log(`Flashcard app: Unknown message type: ${type}`);
      break;
  }
}

// Helper function to access TopicCardSyncService
function getTopicCardSyncService() {
  // If TopicCardSyncService is available in the window object, use it
  if (window.TopicCardSyncService) {
    return window.TopicCardSyncService;
  }
  
  // Create a minimal version for basic splitting if the service isn't available
  return {
    splitByType: function(items) {
      if (!Array.isArray(items)) {
        return { topics: [], cards: [] };
      }
      
      // Categorize items based on type property or inferred type
      const topics = [];
      const cards = [];
      
      items.forEach(item => {
        if (!item) return;
        
        // If type is explicitly set, use it
        if (item.type === 'topic') {
          topics.push(item);
          return;
        }
        
        if (item.type === 'card') {
          cards.push(item);
          return;
        }
        
        // Otherwise, infer type based on properties
        if (item.topicId || item.question || item.front || item.back || item.boxNum) {
          cards.push({...item, type: 'card'});
        } else if (item.name || item.topic || item.isShell === true) {
          topics.push({...item, type: 'topic'});
        } else {
          // Default to card if we can't determine
          cards.push({...item, type: 'card'});
        }
      });
      
      return { topics, cards };
    },
    
    ensureCardBankStructure: function(userData) {
      return userData; // Minimal implementation
    },
    
    syncTopicLists: function(userData) {
      return userData; // Minimal implementation
    }
  };
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

// Migration helper to standardize on questionType
function migrateTypeToQuestionType(data) {
  if (!data) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => migrateTypeToQuestionType(item));
  }
  
  // Handle objects
  if (typeof data === 'object') {
    // Create a new object to avoid modifying original
    const newData = {...data};
    
    // Fix question type fields
    if (newData.type === 'multiple_choice' || newData.type === 'short_answer') {
      // Set questionType based on legacy type
      newData.questionType = newData.type;
      
      // Remove the legacy type field for question format
      delete newData.type;
      
      console.log(`Migrated type to questionType for item: ${newData.id || 'unknown'}`);
    }
    
    // Recursively process nested objects
    for (const key in newData) {
      if (newData[key] && typeof newData[key] === 'object') {
        newData[key] = migrateTypeToQuestionType(newData[key]);
      }
    }
    
    return newData;
  }
  
  // For non-objects, just return as is
  return data;
}

// Initialize message handlers
(function initializeMessageHandlers() {
  console.log(`[${new Date().toISOString()}] Initializing Enhanced Message Handlers`);
  
  // Listen for messages from iframe
  window.addEventListener('message', function(event) {
    // Process messages using our centralized handler
    handleMessage(event, event.source);
  });
  
  // Initialize global token refresh status tracking
  if (window.tokenRefreshInProgress === undefined) {
    window.tokenRefreshInProgress = false;
  }
  
  // Log successful initialization
  console.log(`[${new Date().toISOString()}] Message handlers initialized successfully`);
})();

/**
 * Handle token refresh requests with proper response
 * @param {Object} event - Message event
 * @param {Window} sourceWindow - Source window to send response to
 */
function handleTokenRefresh(event, sourceWindow) {
  console.log(`[${new Date().toISOString()}] Handling token refresh request`);
  
  // Get a fresh token from Knack
  const currentToken = Knack.getUserToken();
  
  // Log token status (available/missing) without exposing the actual token
  console.log(`[${new Date().toISOString()}] Token status: ${currentToken ? 'Available' : 'Missing'}`);
  
  // Prepare response data
  const responseData = {
    type: 'TOKEN_REFRESH_RESULT',
    success: !!currentToken,
    timestamp: new Date().toISOString(),
    source: 'knack-message-handler.js'
  };
  
  // Send the response back to the source window
  if (sourceWindow) {
    console.log(`[${new Date().toISOString()}] Sending token refresh response to source window`);
    sourceWindow.postMessage(responseData, '*');
  }
  
  // Also broadcast to all iframes in case sourceWindow is not available
  try {
    const allIframes = document.querySelectorAll('iframe');
    if (allIframes.length > 0) {
      allIframes.forEach(iframe => {
        if (iframe.contentWindow && iframe.id && iframe.id.includes('flashcard')) {
          iframe.contentWindow.postMessage(responseData, '*');
          console.log(`[${new Date().toISOString()}] Sent token refresh response to iframe: ${iframe.id}`);
        }
      });
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error broadcasting token refresh to iframes:`, err);
  }
  
  // Also update the global token refresh status flag if it exists in the parent window
  if (window.tokenRefreshInProgress !== undefined) {
    window.tokenRefreshInProgress = false;
  }
  
  return responseData;
}
