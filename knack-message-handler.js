// Function to verify data was saved correctly and notify the React app
function verifyDataSave(recordId, sourceWindow) {
  console.log(`[${new Date().toISOString()}] Verifying data save for record:`, recordId);
  
  // Wait longer to ensure data has been committed to the database
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
        
        // NEW: Verify card bank data and check multiple choice options
        if (response && response[FIELD_MAPPING.cardBankData]) {
          try {
            const cardBankJson = response[FIELD_MAPPING.cardBankData];
            const cardBank = safeParseJSON(cardBankJson);
            
            if (Array.isArray(cardBank) && cardBank.length > 0) {
              console.log(`[${new Date().toISOString()}] Card bank verification: ${cardBank.length} items found`);
              
              // Check for multiple choice cards with missing options
              const multipleChoiceCards = cardBank.filter(card => 
                card.type === 'card' && 
                (card.questionType === 'multiple_choice' || 
                 (card.answer && card.answer.includes('Correct Answer:')) ||
                 (card.correctAnswer && card.correctAnswer.trim() !== ''))
              );
              
              const cardsWithOptions = multipleChoiceCards.filter(card => 
                card.options && Array.isArray(card.options) && card.options.length > 0
              );
              
              const cardsWithSavedOptions = multipleChoiceCards.filter(card => 
                card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0
              );
              
              const cardsWithCorrectAnswers = multipleChoiceCards.filter(card =>
                card.correctAnswer && card.correctAnswer.trim() !== ''
              );
              
              console.log(`[${new Date().toISOString()}] Multiple choice verification:`, {
                totalMultipleChoice: multipleChoiceCards.length,
                withOptions: cardsWithOptions.length,
                withSavedOptions: cardsWithSavedOptions.length,
                withCorrectAnswers: cardsWithCorrectAnswers.length
              });
              
              let needsCorrection = false;
              
              // Fix options that come from saved options
              if (multipleChoiceCards.length > 0 && 
                  cardsWithOptions.length < multipleChoiceCards.length && 
                  cardsWithSavedOptions.length > 0) {
                needsCorrection = true;
              }
              
              // Fix answers with "Correct Answer:" format but missing options
              if (cardsWithCorrectAnswers.length > 0 && 
                  cardsWithCorrectAnswers.some(card => 
                    (!card.options || !Array.isArray(card.options) || card.options.length === 0) &&
                    (!card.savedOptions || !Array.isArray(card.savedOptions) || card.savedOptions.length === 0)
                  )) {
                needsCorrection = true;
              }
              
              // If any issues were found, fix them
              if (needsCorrection) {
                console.log(`[${new Date().toISOString()}] Found multiple choice cards with issues, attempting to fix...`);
                
                // Process with our comprehensive correction function
                const restoredCardBank = ensureOptionsPreserved(cardBank);
                
                // Check if any changes were made by the correction
                const changeMade = JSON.stringify(restoredCardBank) !== JSON.stringify(cardBank);
                
                if (changeMade) {
                  console.log(`[${new Date().toISOString()}] Fixed multiple choice issues, saving corrected data`);
                  
                  // Save the corrected card bank
                  const updateData = {
                    [FIELD_MAPPING.cardBankData]: JSON.stringify(restoredCardBank),
                    [FIELD_MAPPING.lastSaved]: new Date().toISOString()
                  };
                  
                  // Save the update
                  $.ajax({
                    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records/' + recordId,
                    type: 'PUT',
                    headers: {
                      'X-Knack-Application-Id': knackAppId,
                      'X-Knack-REST-API-Key': knackApiKey,
                      'Authorization': Knack.getUserToken(),
                      'Content-Type': 'application/json'
                    },
                    data: JSON.stringify(updateData),
                    success: function(restoreResponse) {
                      console.log(`[${new Date().toISOString()}] Successfully restored options for multiple choice cards`);
                      
                      // Send updated data to iframe now
                      try {
                        // Create a copy of response with the updated card bank
                        const updatedResponse = {...response};
                        updatedResponse[FIELD_MAPPING.cardBankData] = JSON.stringify(restoredCardBank);
                        
                        if (sourceWindow) {
                          console.log(`[${new Date().toISOString()}] Sending updated data to React app after correction`);
                          sourceWindow.postMessage({
                            type: 'LOAD_SAVED_DATA',
                            data: updatedResponse
                          }, '*');
                        }
                      } catch (error) {
                        console.error(`[${new Date().toISOString()}] Error sending updated data:`, error);
                      }
                    },
                    error: function(error) {
                      console.error(`[${new Date().toISOString()}] Error restoring options:`, error);
                    }
                  });
                } else {
                  console.log(`[${new Date().toISOString()}] No changes made by correction function`);
                }
              }
            } else {
              console.warn(`[${new Date().toISOString()}] Card bank is empty or malformed`);
            }
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Error parsing card bank during verification:`, e);
          }
        } else {
          console.warn(`[${new Date().toISOString()}] No card bank field found during verification`);
        }
        
        // ENHANCED: Process the data to ensure topic shells are properly synchronized between
        // field_2979 (card bank) and field_3011 (topic lists) before sending back to React app
        let processedResponse = response;
        try {
          if (window.TopicCardSyncService && response) {
            // First ensure the card bank data is properly structured
            processedResponse = window.TopicCardSyncService.ensureCardBankStructure(response);
            
            // Then sync topic lists with card bank
            processedResponse = window.TopicCardSyncService.syncTopicLists(processedResponse);

            // ADDED: Ensure multiple choice options are preserved
            if (processedResponse && processedResponse[FIELD_MAPPING.cardBankData]) {
              const cards = safeParseJSON(processedResponse[FIELD_MAPPING.cardBankData], []);
              const updatedCards = ensureOptionsPreserved(cards);
              processedResponse[FIELD_MAPPING.cardBankData] = JSON.stringify(updatedCards);
            }
            
            console.log(`[${new Date().toISOString()}] Successfully processed and synchronized topic data`);
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error syncing topics:`, error);
          // Use original response if there was an error
          processedResponse = response;
        }
        
        // KEY ADDITION: Send the full updated data back to the React app
        // This ensures the UI is updated with the latest data including topic shells
        if (sourceWindow) {
          console.log(`[${new Date().toISOString()}] Sending processed data to React app after verification`);
          sourceWindow.postMessage({
            type: 'LOAD_SAVED_DATA',
            data: processedResponse
          }, '*');
        } else {
          // Try to find the iframe if sourceWindow wasn't provided
          try {
            const iframe = document.getElementById('flashcard-app-iframe');
            if (iframe && iframe.contentWindow) {
              console.log(`[${new Date().toISOString()}] Sending processed data to React app iframe`);
              iframe.contentWindow.postMessage({
                type: 'LOAD_SAVED_DATA',
                data: processedResponse
              }, '*');
            }
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Error finding iframe:`, error);
          }
        }
        
        // Also, if we're in the parent window, post to all flashcard-app iframes
        try {
          const allIframes = document.querySelectorAll('iframe');
          if (allIframes.length > 0) {
            allIframes.forEach(iframe => {
              if (iframe.contentWindow && iframe.id && iframe.id.includes('flashcard')) {
                iframe.contentWindow.postMessage({
                  type: 'LOAD_SAVED_DATA',
                  data: processedResponse
                }, '*');
                console.log(`[${new Date().toISOString()}] Sent data to iframe: ${iframe.id}`);
              }
            });
          }
        } catch (err) {
          console.error(`[${new Date().toISOString()}] Error broadcasting to iframes:`, err);
        }
      },
      error: function(error) {
        console.error(`[${new Date().toISOString()}] Verification error:`, error);
      }
    });
  }, 5000); // Wait 5 seconds before verification to ensure data is committed
}

// Enhanced function to verify card options are preserved
function ensureOptionsPreserved(cards) {
  if (!Array.isArray(cards)) {
    console.error(`[${new Date().toISOString()}] ensureOptionsPreserved: Cards is not an array:`, cards);
    return cards;
  }

  console.log(`[${new Date().toISOString()}] Ensuring options are preserved for ${cards.length} cards`);
  
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
    multipleChoice: cards.filter(c => c && (c.questionType === 'multiple_choice' || c.type === 'multiple_choice')).length
  });
  
  return result;
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
