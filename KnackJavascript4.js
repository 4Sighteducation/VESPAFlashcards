// knack-integration.js - Safe for public GitHub repository
(function() {
  // Look for configuration in global scope
  if (!window.VESPA_CONFIG) {
    console.error("Flashcard app: Missing VESPA_CONFIG. Please define configuration in Knack.");
    return;
  }
  
  // Safe URI component decoding function to handle malformed URI components
  function safeDecodeURIComponent(str) {
    if (!str) return str;
    try {
      return decodeURIComponent(str);
    } catch (error) {
      console.error("Flashcard app: Error decoding URI component:", error, "String:", str);
      
      // Try to fix common issues with % encoding
      try {
        // Replace any standalone % characters with %25 (properly encoded % symbol)
        const cleaned = str.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
        return decodeURIComponent(cleaned);
      } catch (secondError) {
        console.error("Flashcard app: Second attempt to decode failed:", secondError);
        // If all decoding attempts fail, return the original string
        return str;
      }
    }
  }
  
  // Safe JSON parsing function with error recovery
  function safeParseJSON(jsonString) {
    if (!jsonString) return null;
    
    try {
      // If it's already an object, just return it
      if (typeof jsonString === 'object') return jsonString;
      
      // Regular JSON parse
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("Flashcard app: Error parsing JSON:", error, "String:", jsonString.substring(0, 100));
      
      // Try recovery methods for common JSON issues
      try {
        // Try to clean up the JSON string
        const cleaned = jsonString
          .replace(/\\"/g, '"')        // Fix escaped quotes
          .replace(/"\s+/g, '"')       // Remove whitespace after quotes
          .replace(/\s+"/g, '"')       // Remove whitespace before quotes
          .replace(/,\s*}/g, '}')      // Remove trailing commas in objects
          .replace(/,\s*\]/g, ']');    // Remove trailing commas in arrays
          
        return JSON.parse(cleaned);
      } catch (secondError) {
        console.error("Flashcard app: JSON recovery failed:", secondError);
        
        // Last resort - return empty object/array
        if (jsonString.trim().startsWith('[')) return [];
        return {};
      }
    }
  }

  // Extract configuration (defined in Knack's JavaScript, not here)
  const knackAppId = window.VESPA_CONFIG.knackAppId;
  const knackApiKey = window.VESPA_CONFIG.knackApiKey;
  const KNACK_API_URL = 'https://api.knack.com/v1';
  const FLASHCARD_APP_CONFIG = window.VESPA_CONFIG.appConfig || {
    'scene_1206': {
      'view_3005': {
        appType: 'flashcard-app',
        elementSelector: '.kn-rich-text',
        appUrl: window.VESPA_CONFIG.appUrl || 'https://vespa-flashcards-e7f31e9ff3c9.herokuapp.com/'
      }
    }
  };

// Object and field definitions
const FLASHCARD_OBJECT = 'object_102'; // Your flashcard object
const FIELD_MAPPING = {
userId: 'field_2954',           // User ID
userEmail: 'field_2958',        // User email
accountConnection: 'field_2956', // Connection to account
vespaCustomer: 'field_3008',    // VESPA Customer Connection
tutorConnection: 'field_3009',  // Tutor Connection
cardBankData: 'field_2979',     // Flashcard Bank JSON Store
lastSaved: 'field_2957',        // Date Last Saved
box1Data: 'field_2986',         // Box 1 JSON
box2Data: 'field_2987',         // Box 2 JSON
box3Data: 'field_2988',         // Box 3 JSON
box4Data: 'field_2989',         // Box 4 JSON
box5Data: 'field_2990',         // Box 5 JSON
colorMapping: 'field_3000',     // Color Mapping
topicLists: 'field_3011',       // Topic Lists JSON - ADDED THIS
topicMetadata: 'field_3030',    // Topic Metadata JSON - ADDED THIS
userName: 'field_3010',         // User Name - ADDED THIS
tutorGroup: 'field_565',        // Tutor Group - ADDED THIS
yearGroup: 'field_548',         // Year Group - ADDED THIS
userRole: 'field_73'            // User Role - ADDED THIS
};

// Initialize app when the specific scene renders
$(document).on('knack-scene-render.scene_1206', function(event, scene) {
console.log("Flashcard app: Scene rendered:", scene.key);
initializeFlashcardApp();
});

// Check if a string is a valid Knack record ID
function isValidKnackId(id) {
if (!id) return false;
// Knack IDs are 24-character hexadecimal strings
return typeof id === 'string' && id.match(/^[0-9a-f]{24}$/i);
}

// Extract a valid record ID from various formats
function extractValidRecordId(value) {
if (!value) return null;

// If it's already an object with an id
if (typeof value === 'object' && value.id) {
  // Clean and check the id inside the object
  const cleanedId = cleanHtmlFromId(value.id);
  return isValidKnackId(cleanedId) ? cleanedId : null;
}

// If it's a string
if (typeof value === 'string') {
  const cleanedId = cleanHtmlFromId(value);
  return isValidKnackId(cleanedId) ? cleanedId : null;
}

return null;
}

// Helper function to ensure an item has a type and split items by type
function getSyncService() {
  // If TopicCardSyncService is available in the window object, use it
  if (window.TopicCardSyncService) {
    return window.TopicCardSyncService;
  }
  
  // Fallback implementation
  return {
    ensureItemType: (item) => {
      if (!item) return item;
      
      if (item.type) return item;
      
      if (item.topicId || item.question || item.front || item.back || item.boxNum) {
        return {...item, type: 'card'};
      } else if (item.name || item.topic || item.isShell === true) {
        return {...item, type: 'topic'};
      }
      
      return {...item, type: 'card'};
    },
    splitByType: (items) => {
      if (!Array.isArray(items)) {
        return { topics: [], cards: [] };
      }
      
      const ensureType = (item) => {
        if (!item.type) {
          return getSyncService().ensureItemType(item);
        }
        return item;
      };
      
      const typedItems = items.map(ensureType);
      
      const topics = typedItems.filter(item => item.type === 'topic');
      const cards = typedItems.filter(item => item.type !== 'topic');
      
      return { topics, cards };
    }
  };
}

// Helper function to clean HTML from IDs
function cleanHtmlFromId(idString) {
if (!idString) return null;

// If it's already an object with an id
if (typeof idString === 'object' && idString.id) {
  // Clean the id inside the object
  return { id: cleanHtmlFromId(idString.id) };
}

// Convert to string if it's not already
const str = idString.toString();

// Check if it contains HTML
if (str.includes('<')) {
  console.log("Flashcard app: Cleaning HTML from ID:", str);
  
  // If it's wrapped in a span with a class that looks like an ID
  const spanMatch = str.match(/<span class="([^"]+)">([^<]+)<\/span>/);
  if (spanMatch) {
    console.log("Flashcard app: Extracted ID from span class:", spanMatch[1]);
    return spanMatch[1]; // Use the class as the ID, which is often the real ID
  }
  
  // Otherwise just strip all HTML
  const cleanStr = str.replace(/<[^>]+>/g, '').trim();
  console.log("Flashcard app: Stripped HTML from ID:", cleanStr);
  return cleanStr;
}

return str;
}

// Safely remove HTML from strings to avoid issues with connected fields
function sanitizeField(value) {
if (!value) return "";
if (typeof value !== 'string') return String(value);

// Remove HTML tags
return value.replace(/<[^>]*>/g, "")
  // Remove any markdown characters
  .replace(/[*_~`#]/g, "")
  // Replace special chars with their text equivalents
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .trim();
}

// Debug logging helper
function debugLog(title, data) {
console.log(`%c${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
console.log(JSON.stringify(data, null, 2));
return data; // Return data for chaining
}

// Get complete user data from Knack
function getCompleteUserData(userId, callback) {
console.log("Flashcard app: Getting complete user data for:", userId);

$.ajax({
  url: KNACK_API_URL + '/objects/object_3/records/' + userId,
  type: 'GET',
  headers: {
    'X-Knack-Application-Id': knackAppId,
    'X-Knack-REST-API-Key': knackApiKey,
    'Authorization': Knack.getUserToken(),
    'Content-Type': 'application/json'
  },
  success: function(response) {
    console.log("Flashcard app: Complete user data:", response);
    
    // Store this data for later use
    window.completeUserData = response;
    
    callback(response);
  },
  error: function(error) {
    console.error("Flashcard app: Error retrieving complete user data:", error);
    callback(null);
  }
});
}

// Initialize the React app
function initializeFlashcardApp() {
console.log("Initializing Flashcard React app");

// Get config for this scene/view
const config = FLASHCARD_APP_CONFIG['scene_1206']['view_3005'];

// Check if user is authenticated
if (typeof Knack !== 'undefined' && Knack.getUserToken()) {
  console.log("Flashcard app: User is authenticated");
  
  // Get user data
  const userToken = Knack.getUserToken();
  const appId = Knack.application_id;
  const user = Knack.getUserAttributes();
  
  console.log("Flashcard app: Basic user info:", user);
  
  // Store the current user globally for later use
  window.currentKnackUser = user;
  
  // Get complete user data including role information
  getCompleteUserData(user.id, function(completeUserData) {
    if (completeUserData) {
      // Enhance the stored user info
      window.currentKnackUser = Object.assign({}, user, completeUserData);
      continueInitialization();
    } else {
      console.log("Flashcard app: Could not get complete user data, continuing with basic info");
      continueInitialization();
    }
  });
  
  function continueInitialization() {
    // Extract and store connection field IDs
    const currentUser = window.currentKnackUser;
    
    // Add connection field IDs to the user object
    currentUser.emailId = extractValidRecordId(currentUser.id); // User's own ID from Object_3 / field_70
    currentUser.schoolId = extractValidRecordId(currentUser.school); // School ID from Object_2 / Field_44
    currentUser.tutorId = extractValidRecordId(currentUser.tutor); // Tutor ID from object_7 / field_96
    currentUser.roleId = extractValidRecordId(currentUser.role); // Role ID
    
    // Log the connection field IDs
    debugLog("CONNECTION FIELD IDs", {
      emailId: currentUser.emailId,
      schoolId: currentUser.schoolId, 
      tutorId: currentUser.tutorId,
      roleId: currentUser.roleId
    });
    
    // Find or create a container for the app
    let container = document.querySelector(config.elementSelector);
  
    // If that doesn't work, try to find any rich text field
    if (!container) {
      console.log("Flashcard app: First selector failed, trying alternatives");
      container = document.querySelector('.kn-rich-text');
    }
    
    // If that still doesn't work, find the view and create a container
    if (!container) {
      console.log("Flashcard app: No rich text field found, looking for the view");
      const view = document.getElementById('view_3005') || document.querySelector('.view_3005');
      
      if (view) {
        console.log("Flashcard app: View found, creating container");
        container = document.createElement('div');
        container.id = 'flashcard-app-container';
        container.style.margin = '20px 0';
        view.appendChild(container);
      }
    }
    
    // Final fallback - just add to the scene
    if (!container) {
      console.log("Flashcard app: No suitable container found, adding to scene");
      const scene = document.getElementById('kn-scene_1206');
      if (scene) {
        container = document.createElement('div');
        container.id = 'flashcard-app-container';
        container.style.margin = '20px 0';
        scene.appendChild(container);
      } else {
        console.error("Flashcard app: Cannot find any suitable container for the app");
        return;
      }
    }
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Create a loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'app-loading';
    loadingDiv.innerHTML = '<p>Loading your flashcard app...</p>';
    loadingDiv.style.padding = '20px';
    loadingDiv.style.textAlign = 'center';
    container.appendChild(loadingDiv);
    
    // Create an iframe for the React app
    const iframe = document.createElement('iframe');
    iframe.id = 'flashcard-app-iframe';
    iframe.style.width = '100%';
    iframe.style.height = '800px'; // Adjust as needed
    iframe.style.border = 'none';
    iframe.style.display = 'none'; // Hide initially until loaded
    iframe.src = config.appUrl;
    container.appendChild(iframe);
    
    // Track authentication status
    let authSent = false;
    
    // Track message processing to prevent loops
    let appReadyHandled = false;
    let authConfirmReceived = false;
    
    // Set up message listener for communication with the iframe
window.addEventListener('message', function(event) {
  // Only accept messages from our iframe
  if (event.source !== iframe.contentWindow) {
    return;
  }
  
  console.log(`Flashcard app [${new Date().toISOString()}]: Message from React app:`, event.data?.type);
  debugLog("MESSAGE RECEIVED", {
    type: event.data?.type,
    timestamp: new Date().toISOString(),
    hasData: event.data?.data ? "yes" : "no"
  });
  
  if (event.data && event.data.type) {
    switch(event.data.type) {
      case 'APP_READY':
        // Only handle APP_READY once to prevent loops
        if (appReadyHandled) {
          console.log("Flashcard app: Ignoring duplicate APP_READY message");
          return;
        }
        
        // Mark as handled immediately to prevent race conditions
        appReadyHandled = true;
        console.log("Flashcard app: React app is ready, sending user info (first time)");
            
            // First, get user data from Knack
            loadFlashcardUserData(user.id, function(userData) {
              // Check again to prevent double-handling due to async operations
              if (authSent) {
                console.log("Flashcard app: Auth already sent, skipping duplicate send");
                return;
              }
              
              // Include connection field IDs in the data sent to the React app
              const userDataToSend = {
                id: user.id,
                email: user.email,
                name: user.name || '',
                token: userToken,
                appId: appId,
                userData: userData || {},
                // Add connection field IDs
                emailId: currentUser.emailId,
                schoolId: currentUser.schoolId,
                tutorId: currentUser.tutorId,
                roleId: currentUser.roleId
              };
              
              // Send authentication and user data to the iframe only if not already sent
              if (!authSent) {
                iframe.contentWindow.postMessage({
                  type: 'KNACK_USER_INFO',
                  data: userDataToSend
                }, '*');
                
                authSent = true;
                console.log("Flashcard app: Sent user info to React app");
              }
            });
            break;
            
          case 'AUTH_CONFIRMED':
            console.log("Flashcard app: Authentication confirmed by React app");
            
            // Hide loading indicator and show iframe
            loadingDiv.style.display = 'none';
            iframe.style.display = 'block';
            break;
            
      case 'SAVE_DATA':
        console.log(`Flashcard app [${new Date().toISOString()}]: Saving data from React app:`, event.data.data);
        debugLog("SAVE_DATA REQUEST RECEIVED", {
          preserveFields: event.data.data.preserveFields,
          hasRecordId: event.data.data.recordId ? "yes" : "no",
          timestamp: new Date().toISOString()
        });
        
        // Check if preserveFields flag is set (for topic list saving)
        if (event.data.data.preserveFields === true && event.data.data.completeData) {
          console.log(`Flashcard app [${new Date().toISOString()}]: Using data preservation mode for saving`);
          
          // Extract user ID from the message data or use the current user ID
          const userId = event.data.data.userId || user.id;
          
          // Handle preserving fields when saving topic lists
          handlePreserveFieldsDataSave(userId, event.data.data, function(success) {
            debugLog("SAVE_RESULT SENDING", {
              success: success,
              preserveFields: true,
              timestamp: new Date().toISOString()
            });
            
            // Notify the React app about the save result
            iframe.contentWindow.postMessage({
              type: 'SAVE_RESULT',
              success: success,
              timestamp: new Date().toISOString()
            }, '*');
            
            // If save was successful, verify it immediately
            if (success && event.data.data.recordId) {
              verifyDataSave(event.data.data.recordId);
            }
          });
            } else {
              // Standard save operation (original behavior)
              saveFlashcardUserData(user.id, event.data.data, function(success) {
                // Notify the React app about the save result
                iframe.contentWindow.postMessage({
                  type: 'SAVE_RESULT',
                  success: success
                }, '*');
              });
            }
            break;
            
          case 'ADD_TO_BANK':
            console.log("Flashcard app: Adding cards to bank:", event.data.data);
            
            // Handle adding cards to both the card bank and Box 1
            handleAddToBank(event.data.data, function(success) {
              // Notify the React app about the result
              iframe.contentWindow.postMessage({
                type: 'ADD_TO_BANK_RESULT',
                success: success
              }, '*');
            });
            break;
            
          case 'TRIGGER_SAVE':
            console.log("Flashcard app: Triggered save from React app");
            // This is a hint to also save to the card bank
            // Trigger ADD_TO_BANK operation for any unsaved cards
            if (event.data.cards && Array.isArray(event.data.cards) && event.data.cards.length > 0) {
              // If we have cards in the trigger message, add them to bank
              handleAddToBank(event.data, function(success) {
                // We don't need to notify about this automatic operation
              });
            }
            break;
        }
      }
    });
  }
} else {
  console.error("Flashcard app: User is not authenticated");
}
}

// Load user data from Knack
function loadFlashcardUserData(userId, callback) {
console.log("Flashcard app: Loading user data for:", userId);

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
    console.log("Flashcard app: User data search response:", response);
    
    if (response.records && response.records.length > 0) {
      // User has existing data
      const record = response.records[0];
      console.log("Flashcard app: Found existing user data:", record);
      
        // Parse the JSON data
        let userData = {};
        
        try {
          // Parse cards data
          if (record[FIELD_MAPPING.cardBankData]) {
            // Make sure to decode URL-encoded data if needed
            let cardData = record[FIELD_MAPPING.cardBankData];
            if (typeof cardData === 'string' && cardData.includes('%')) {
              cardData = safeDecodeURIComponent(cardData);
            }
            userData.cards = safeParseJSON(cardData);
          }
          
          // Parse color mapping
          if (record[FIELD_MAPPING.colorMapping]) {
            // Make sure to decode URL-encoded data if needed
            let colorData = record[FIELD_MAPPING.colorMapping];
            if (typeof colorData === 'string' && colorData.includes('%')) {
              colorData = safeDecodeURIComponent(colorData);
            }
            userData.colorMapping = safeParseJSON(colorData);
          }
          
          // Parse topic lists data - ADDED THIS
          if (record[FIELD_MAPPING.topicLists]) {
            // Make sure to decode URL-encoded data if needed
            let topicListData = record[FIELD_MAPPING.topicLists];
            if (typeof topicListData === 'string' && topicListData.includes('%')) {
              topicListData = safeDecodeURIComponent(topicListData);
            }
            userData.topicLists = safeParseJSON(topicListData);
          }
          
          // Parse topic metadata - ADDED THIS
          if (record[FIELD_MAPPING.topicMetadata]) {
            // Make sure to decode URL-encoded data if needed
            let topicMetadata = record[FIELD_MAPPING.topicMetadata];
            if (typeof topicMetadata === 'string' && topicMetadata.includes('%')) {
              topicMetadata = safeDecodeURIComponent(topicMetadata);
            }
            userData.topicMetadata = safeParseJSON(topicMetadata);
          }
          
          // Parse spaced repetition data
          const srData = {
            box1: [],
            box2: [],
            box3: [],
            box4: [],
            box5: []
          };
          
          // Handle box 1
          if (record[FIELD_MAPPING.box1Data]) {
            let box1Data = record[FIELD_MAPPING.box1Data];
            if (typeof box1Data === 'string' && box1Data.includes('%')) {
              box1Data = safeDecodeURIComponent(box1Data);
            }
            srData.box1 = safeParseJSON(box1Data) || [];
          }
          
          // Handle box 2
          if (record[FIELD_MAPPING.box2Data]) {
            let box2Data = record[FIELD_MAPPING.box2Data];
            if (typeof box2Data === 'string' && box2Data.includes('%')) {
              box2Data = safeDecodeURIComponent(box2Data);
            }
            srData.box2 = safeParseJSON(box2Data) || [];
          }
          
          // Handle box 3
          if (record[FIELD_MAPPING.box3Data]) {
            let box3Data = record[FIELD_MAPPING.box3Data];
            if (typeof box3Data === 'string' && box3Data.includes('%')) {
              box3Data = safeDecodeURIComponent(box3Data);
            }
            srData.box3 = safeParseJSON(box3Data) || [];
          }
          
          // Handle box 4
          if (record[FIELD_MAPPING.box4Data]) {
            let box4Data = record[FIELD_MAPPING.box4Data];
            if (typeof box4Data === 'string' && box4Data.includes('%')) {
              box4Data = safeDecodeURIComponent(box4Data);
            }
            srData.box4 = safeParseJSON(box4Data) || [];
          }
          
          // Handle box 5
          if (record[FIELD_MAPPING.box5Data]) {
            let box5Data = record[FIELD_MAPPING.box5Data];
            if (typeof box5Data === 'string' && box5Data.includes('%')) {
              box5Data = safeDecodeURIComponent(box5Data);
            }
            srData.box5 = safeParseJSON(box5Data) || [];
          }
        
        userData.spacedRepetition = srData;
        
        // Store the record ID for later updates
        userData.recordId = record.id;
        
      } catch (e) {
        console.error("Flashcard app: Error parsing user data:", e);
      }
      
      callback(userData);
    } else {
      // No existing data, create a new record
      console.log("Flashcard app: No existing user data found, creating new record");
      createFlashcardUserRecord(userId, function(success, recordId) {
        if (success) {
          callback({
            recordId: recordId,
            cards: [],
            colorMapping: {},
            topicLists: [], // ADDED THIS
            topicMetadata: [], // ADDED THIS
            spacedRepetition: {
              box1: [],
              box2: [],
              box3: [],
              box4: [],
              box5: []
            }
          });
        } else {
          callback(null);
        }
      });
    }
  },
  error: function(error) {
    console.error("Flashcard app: Error loading user data:", error);
    callback(null);
  }
});
}

// Create a new flashcard user record
function createFlashcardUserRecord(userId, callback) {
console.log("Flashcard app: Creating new flashcard user record for:", userId);

// Get the current user
const user = window.currentKnackUser;

// Prepare the data
const data = {
  [FIELD_MAPPING.userId]: userId,
  [FIELD_MAPPING.userEmail]: sanitizeField(user.email), // Plain text email field
  [FIELD_MAPPING.lastSaved]: new Date().toISOString(),
  [FIELD_MAPPING.cardBankData]: JSON.stringify([]),
  [FIELD_MAPPING.box1Data]: JSON.stringify([]),
  [FIELD_MAPPING.box2Data]: JSON.stringify([]),
  [FIELD_MAPPING.box3Data]: JSON.stringify([]),
  [FIELD_MAPPING.box4Data]: JSON.stringify([]),
  [FIELD_MAPPING.box5Data]: JSON.stringify([]),
  [FIELD_MAPPING.colorMapping]: JSON.stringify({}),
  [FIELD_MAPPING.topicLists]: JSON.stringify([]), // ADDED THIS
  [FIELD_MAPPING.topicMetadata]: JSON.stringify([]), // ADDED THIS
  [FIELD_MAPPING.userName]: sanitizeField(user.name || "") // ADDED THIS
};

// Add non-connection fields
if (user.tutorGroup) data[FIELD_MAPPING.tutorGroup] = sanitizeField(user.tutorGroup);
if (user.yearGroup) data[FIELD_MAPPING.yearGroup] = sanitizeField(user.yearGroup);

// Only add connection fields if they have valid IDs
// Email connection field (field_2956) - only add if it's a valid ID
const emailId = extractValidRecordId(user.id); // User's own ID is used for email connection
if (emailId) {
  data[FIELD_MAPPING.accountConnection] = emailId;
}

// VESPA Customer/school (field_3008) - only add if it's a valid ID 
const schoolId = extractValidRecordId(user.school || user.field_122);
if (schoolId) {
  data[FIELD_MAPPING.vespaCustomer] = schoolId;
}

// Tutor connection (field_3009) - only add if it's a valid ID
const tutorId = extractValidRecordId(user.tutor);
if (tutorId) {
  data[FIELD_MAPPING.tutorConnection] = tutorId;
}

// User Role (field_73) - only add if it's a valid ID
const roleId = extractValidRecordId(user.role);
if (roleId) {
  data[FIELD_MAPPING.userRole] = roleId;
}

// Add debug logging for created record
debugLog("CREATING NEW RECORD", data);

// Create the record
$.ajax({
  url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records',
  type: 'POST',
  headers: {
    'X-Knack-Application-Id': knackAppId,
    'X-Knack-REST-API-Key': knackApiKey,
    'Authorization': Knack.getUserToken(),
    'Content-Type': 'application/json'
  },
  data: JSON.stringify(data),
  success: function(response) {
    console.log("Flashcard app: Successfully created user record:", response);
    callback(true, response.id);
  },
  error: function(error) {
    console.error("Flashcard app: Error creating user record:", error);
    callback(false);
  }
});
}

// Safe check for circular references in data
function ensureDataIsSerializable(obj) {
try {
  // Test if the object can be serialized
  JSON.stringify(obj);
  return obj;
} catch (e) {
  console.error("Flashcard app: Data contains circular references or non-serializable values", e);
  
  // Create a stripped down copy
  const cache = new Set();
  const safeObj = JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        // Circular reference found, discard key
        return '[Circular]';
      }
      cache.add(value);
    }
    return value;
  }));
  
  return safeObj;
}
}

// Standardize card data before saving
function standardizeCards(cards) {
if (!Array.isArray(cards)) return [];

return cards.map(card => {
  // If it's already a standard card, just return it
  if (card.createdAt && card.updatedAt && card.examBoard !== undefined) {
    return card;
  }
  
  // Otherwise, standardize it
  return {
    // Core identification
    id: card.id,
    
    // Subject and topic information
    subject: card.subject || 'General',
    topic: card.topic || 'General',
    examBoard: card.examBoard || '',
    examType: card.examType || '',
    topicPriority: card.topicPriority || 0,
    
    // Content fields
    question: card.question || card.front || '',
    answer: card.answer || card.back || '',
    keyPoints: card.keyPoints || [],
    detailedAnswer: card.detailedAnswer || '',
    additionalInfo: card.additionalInfo || '',
    
    // Card type
    type: card.type || 'short_answer',
    
    // Visual properties
    cardColor: card.cardColor || card.color || '#3cb44b',
    textColor: card.textColor || '',
    
    // Spaced repetition
    boxNum: card.boxNum || 1,
    lastReviewed: card.lastReviewed || null,
    nextReviewDate: card.nextReviewDate || new Date().toISOString(),
    
    // Metadata
    createdAt: card.createdAt || card.timestamp || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
});
}

// Save flashcard user data
// Handle data saving with field preservation (specifically for topic list updates)
function handlePreserveFieldsDataSave(userId, data, callback) {
  console.log(`Flashcard app [${new Date().toISOString()}]: Saving with field preservation for user:`, userId);
  
  // Ensure we have a record ID
  const recordId = data.recordId;
  if (!recordId) {
    console.error("Flashcard app: Cannot save with field preservation - no record ID");
    callback(false);
    return;
  }
  
  // Get the complete data provided
  const completeData = data.completeData;
  
  // Get cleaned versions of the topic data we want to update
  const cleanTopicLists = ensureDataIsSerializable(data.topicLists || []);
  const cleanTopicMetadata = ensureDataIsSerializable(data.topicMetadata || []);
  
  // Create an update object that contains ONLY the fields we want to update
  // while preserving all other fields
  const updateData = {
    // Only update the following fields
    [FIELD_MAPPING.topicLists]: JSON.stringify(cleanTopicLists),
    [FIELD_MAPPING.topicMetadata]: JSON.stringify(cleanTopicMetadata),
    [FIELD_MAPPING.lastSaved]: new Date().toISOString()
  };
  
  // Log what we're updating
  debugLog("UPDATING ONLY THESE FIELDS (PRESERVING OTHERS)", {
    topicListsCount: cleanTopicLists.length,
    topicMetadataCount: cleanTopicMetadata.length,
    recordId: recordId,
    timestamp: new Date().toISOString()
  });
  
  // Implement retry mechanism for more reliable saving
  let retryCount = 0;
  const maxRetries = 2;
  
  function attemptSave() {
    // Save to Knack
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
      success: function(response) {
        console.log(`Flashcard app [${new Date().toISOString()}]: Successfully saved topic list data:`, response.id);
        debugLog("SAVE SUCCESS", {
          recordId: response.id,
          timestamp: new Date().toISOString()
        });
        
        // If successful, verify the save immediately
        verifyDataSave(recordId);
        
        callback(true);
      },
      error: function(error) {
        console.error(`Flashcard app [${new Date().toISOString()}]: Error saving topic list data:`, error);
        debugLog("SAVE ERROR", {
          recordId: recordId,
          errorStatus: error.status,
          errorText: error.statusText,
          retryCount: retryCount
        });
        
        // Retry logic for failed saves
        if (retryCount < maxRetries) {
          console.log(`Flashcard app [${new Date().toISOString()}]: Retrying save (${retryCount + 1}/${maxRetries})...`);
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

// Verify that topic list data was properly saved
function verifyDataSave(recordId) {
  console.log(`Flashcard app [${new Date().toISOString()}]: Verifying data save for record:`, recordId);
  
  // Wait a moment to ensure data has been committed to the database
  setTimeout(function() {
    // Fetch the record to verify the data is there
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
        debugLog("VERIFICATION RESULT", {
          recordId: recordId,
          hasTopicLists: response && response[FIELD_MAPPING.topicLists] ? "yes" : "no",
          timestamp: new Date().toISOString()
        });
        
        // Check if field_3011 exists and has content
        if (response && response[FIELD_MAPPING.topicLists]) {
          try {
            const topicListsJson = response[FIELD_MAPPING.topicLists];
            const topicLists = safeParseJSON(topicListsJson);
            
            if (Array.isArray(topicLists) && topicLists.length > 0) {
              console.log(`Flashcard app [${new Date().toISOString()}]: Verification successful: Topic lists present with ${topicLists.length} items`);
              
              // Check if any of the topic lists have topics
              const hasSomeTopics = topicLists.some(list => 
                list.topics && Array.isArray(list.topics) && list.topics.length > 0
              );
              
              if (hasSomeTopics) {
                console.log(`Flashcard app [${new Date().toISOString()}]: Topic lists contain topics - save fully verified`);
              } else {
                console.warn(`Flashcard app [${new Date().toISOString()}]: Topic lists exist but none have topics`);
              }
            } else {
              console.error(`Flashcard app [${new Date().toISOString()}]: Verification failed: Topic lists empty or malformed`);
            }
          } catch (e) {
            console.error(`Flashcard app [${new Date().toISOString()}]: Error parsing topic lists during verification:`, e);
          }
        } else {
          console.error(`Flashcard app [${new Date().toISOString()}]: Verification failed: No topic lists field found`);
        }
      },
      error: function(error) {
        console.error(`Flashcard app [${new Date().toISOString()}]: Verification error:`, error);
      }
    });
  }, 2000); // Wait 2 seconds before verification
}

// Handle adding cards to both the card bank and Box 1
function handleAddToBank(data, callback) {
  // Get current user ID if not provided
  const userId = data.userId || (window.currentKnackUser && window.currentKnackUser.id);
  
  if (!userId) {
    console.error("Flashcard app: Cannot add to bank - no user ID found");
    if (callback) callback(false);
    return;
  }
  
  console.log("Flashcard app: Adding cards to bank for user:", userId);
  
  // Extract the needed data
  const recordId = data.recordId;
  const newCards = data.cards || [];
  
  if (!recordId || newCards.length === 0) {
    console.error("Flashcard app: Cannot add to bank - missing record ID or cards");
    if (callback) callback(false);
    return;
  }
  
  // First get the current record to retrieve existing cards and box 1 data
  $.ajax({
    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records/' + recordId,
    type: 'GET',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    success: function(existingData) {
      console.log("Flashcard app: Retrieved existing data for adding to bank");
      
      try {
        // Parse existing card bank data
        let existingItems = [];
        if (existingData[FIELD_MAPPING.cardBankData]) {
          let cardData = existingData[FIELD_MAPPING.cardBankData];
          if (typeof cardData === 'string' && cardData.includes('%')) {
            cardData = safeDecodeURIComponent(cardData);
          }
          existingItems = safeParseJSON(cardData) || [];
        }
        
        // CRITICAL: Split by type to preserve topic shells
        const topicShells = existingItems.filter(item => item.type === 'topic');
        const existingCards = existingItems.filter(item => item.type !== 'topic');
        
        debugLog("SPLIT BANK ITEMS BY TYPE", {
          totalItems: existingItems.length,
          topicShellCount: topicShells.length,
          cardCount: existingCards.length
        });
        
        // Parse existing Box 1 data
        let box1Cards = [];
        if (existingData[FIELD_MAPPING.box1Data]) {
          let box1Data = existingData[FIELD_MAPPING.box1Data];
          if (typeof box1Data === 'string' && box1Data.includes('%')) {
            box1Data = safeDecodeURIComponent(box1Data);
          }
          box1Cards = safeParseJSON(box1Data) || [];
        }
        
        // Standardize and ensure the new cards are properly formatted
        const standardizedNewCards = standardizeCards(newCards);
        
        // Add new cards to the existing cards
        const updatedCards = [...existingCards, ...standardizedNewCards];
        
        // CRITICAL: Create final data by combining topic shells and cards
        const finalBankData = [...topicShells, ...updatedCards];
        
        // Create Box 1 entries for the new cards
        const newBox1Items = standardizedNewCards.map(card => ({
          cardId: card.id,
          lastReviewed: new Date().toISOString(),
          nextReviewDate: new Date().toISOString()
        }));
        
        // Add new items to Box 1
        const updatedBox1 = [...box1Cards, ...newBox1Items];
        
        // Prepare data to save - preserve all existing fields
        const updateData = {
          ...existingData, // Preserve all existing fields
          [FIELD_MAPPING.cardBankData]: JSON.stringify(finalBankData),
          [FIELD_MAPPING.box1Data]: JSON.stringify(updatedBox1),
          [FIELD_MAPPING.lastSaved]: new Date().toISOString()
        };
        
        // Log what we're adding
        debugLog("ADDING TO BANK", {
          existingCardsCount: existingCards.length,
          newCardsCount: standardizedNewCards.length,
          totalCardsCount: updatedCards.length,
          existingBox1Count: box1Cards.length,
          newBox1Count: newBox1Items.length,
          topicShellCount: topicShells.length
        });
        
        // Save the updated data
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
          success: function(response) {
            console.log("Flashcard app: Successfully added cards to bank:", response.id);
            if (callback) callback(true);
          },
          error: function(error) {
            console.error("Flashcard app: Error adding cards to bank:", error);
            if (callback) callback(false);
          }
        });
      } catch (error) {
        console.error("Flashcard app: Error processing data for add to bank:", error);
        if (callback) callback(false);
      }
    },
    error: function(error) {
      console.error("Flashcard app: Error retrieving existing data for add to bank:", error);
      if (callback) callback(false);
    }
  });
}

function saveFlashcardUserData(userId, data, callback) {
  console.log("Flashcard app: Saving flashcard data for user:", userId);
  debugLog("SAVING DATA WITH RECORD ID", data.recordId);

  // Check if we have a record ID
  if (!data.recordId) {
    // No record ID, try to load the user data first
    loadFlashcardUserData(userId, function(userData) {
      if (userData && userData.recordId) {
        // Now we have a record ID, save the data
        data.recordId = userData.recordId;
        saveFlashcardUserData(userId, data, callback);
      } else {
        console.error("Flashcard app: Cannot save data - no record ID found");
        callback(false);
      }
    });
    return;
  }

  // Get the current user for additional field data
  const user = window.currentKnackUser || {};

  try {
    // Ensure cards are in standard format before saving
    const standardizedCards = standardizeCards(data.cards || []);
    
    // Make sure data is serializable (no circular references)
    const cleanCards = ensureDataIsSerializable(standardizedCards);
    const cleanColorMapping = ensureDataIsSerializable(data.colorMapping || {});
    const cleanSpacedRepetition = ensureDataIsSerializable(data.spacedRepetition || {
      box1: [], box2: [], box3: [], box4: [], box5: []
    });
    const cleanTopicLists = ensureDataIsSerializable(data.topicLists || []);
    const cleanTopicMetadata = ensureDataIsSerializable(data.topicMetadata || []);
    
    // Get current data first to preserve topic shells
    $.ajax({
      url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records/' + data.recordId,
      type: 'GET',
      headers: {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': Knack.getUserToken(),
        'Content-Type': 'application/json'
      },
      success: function(existingData) {
        // Parse existing card bank data
        let existingItems = [];
        if (existingData[FIELD_MAPPING.cardBankData]) {
          existingItems = safeParseJSON(existingData[FIELD_MAPPING.cardBankData], []);
        }
        
        // Get the sync service for type handling
        const syncService = getSyncService();
        
        // Split by type to preserve topic shells
        const { topics: topicShells, cards: existingCards } = syncService.splitByType(existingItems);
        
        debugLog("SPLIT BANK ITEMS BY TYPE FOR SAVE", {
          totalItems: existingItems.length,
          topicShellCount: topicShells.length,
          cardCount: existingCards.length
        });
        
        // CRITICAL: Combine topic shells with new cards
        const finalBankData = [...topicShells, ...cleanCards];
        
        // Prepare the update data
        const updateData = {
          [FIELD_MAPPING.lastSaved]: new Date().toISOString(),
          [FIELD_MAPPING.cardBankData]: JSON.stringify(finalBankData),
          [FIELD_MAPPING.colorMapping]: JSON.stringify(cleanColorMapping)
        };
        
        // Add any extra fields passed from the React app
        if (data.additionalFields && typeof data.additionalFields === 'object') {
          // Merge in additional fields
          Object.entries(data.additionalFields).forEach(([key, value]) => {
            // Ensure sanitization for text fields
            updateData[key] = typeof value === 'string' ? sanitizeField(value) : value;
          });
        }
        
        // Add topic lists if available
        updateData[FIELD_MAPPING.topicLists] = JSON.stringify(cleanTopicLists);
        
        // Add topic metadata if available
        updateData[FIELD_MAPPING.topicMetadata] = JSON.stringify(cleanTopicMetadata);
        
        // Add user name (not a connection field)
        if (user.name) updateData[FIELD_MAPPING.userName] = sanitizeField(user.name);
        
        // Add non-connection fields
        if (user.tutorGroup) updateData[FIELD_MAPPING.tutorGroup] = sanitizeField(user.tutorGroup);
        if (user.yearGroup) updateData[FIELD_MAPPING.yearGroup] = sanitizeField(user.yearGroup);
        
        // Add regular text email (not a connection)
        if (user.email) updateData[FIELD_MAPPING.userEmail] = sanitizeField(user.email);
        
        // Only add connection fields if they have valid IDs
        // Email connection field (field_2956) - only add if it's a valid ID
        const emailId = extractValidRecordId(user.id); // User's own ID is used for email connection
        if (emailId) {
          updateData[FIELD_MAPPING.accountConnection] = emailId;
        }
        
        // VESPA Customer/school (field_3008) - only add if it's a valid ID 
        const schoolId = extractValidRecordId(user.school || user.field_122);
        if (schoolId) {
          updateData[FIELD_MAPPING.vespaCustomer] = schoolId;
        }
        
        // Tutor connection (field_3009) - only add if it's a valid ID
        const tutorId = extractValidRecordId(user.tutor);
        if (tutorId) {
          updateData[FIELD_MAPPING.tutorConnection] = tutorId;
        }
        
        // User Role (field_73) - only add if it's a valid ID
        const roleId = extractValidRecordId(user.role);
        if (roleId) {
          updateData[FIELD_MAPPING.userRole] = roleId;
        }
        
        // Add spaced repetition data
        updateData[FIELD_MAPPING.box1Data] = JSON.stringify(cleanSpacedRepetition.box1 || []);
        updateData[FIELD_MAPPING.box2Data] = JSON.stringify(cleanSpacedRepetition.box2 || []);
        updateData[FIELD_MAPPING.box3Data] = JSON.stringify(cleanSpacedRepetition.box3 || []);
        updateData[FIELD_MAPPING.box4Data] = JSON.stringify(cleanSpacedRepetition.box4 || []);
        updateData[FIELD_MAPPING.box5Data] = JSON.stringify(cleanSpacedRepetition.box5 || []);
        
        // Log the data we're sending
        debugLog("SAVING TO KNACK: DATA STATS", {
          topicShellCount: topicShells.length,
          cardsCount: cleanCards.length,
          colorCount: Object.keys(cleanColorMapping).length,
          spacedRepCount: Object.values(cleanSpacedRepetition).flat().length
        });
        
        // Pause briefly before saving to ensure any UI updates have completed
        setTimeout(function() {
          // Update the record
          $.ajax({
            url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records/' + data.recordId,
            type: 'PUT',
            headers: {
              'X-Knack-Application-Id': knackAppId,
              'X-Knack-REST-API-Key': knackApiKey,
              'Authorization': Knack.getUserToken(),
              'Content-Type': 'application/json'
            },
            data: JSON.stringify(updateData),
            success: function(response) {
              console.log("Flashcard app: Successfully saved user data:", response.id);
              debugLog("KNACK SAVE SUCCESS", {
                userId: userId,
                recordId: response.id,
                timestamp: new Date().toISOString()
              });
              callback(true);
            },
            error: function(error) {
              console.error("Flashcard app: Error saving user data:", error);
              debugLog("KNACK SAVE ERROR", error);
              callback(false);
            }
          });
        }, 100);
      },
      error: function(error) {
        console.error("Flashcard app: Error retrieving existing data:", error);
        callback(false);
      }
    });
  } catch (error) {
    console.error("Flashcard app: Error preparing data for saving:", error);
    callback(false);
  }
}
})