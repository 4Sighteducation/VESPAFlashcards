// Flashcard App Integration with Knack
// This script connects the React Flashcard app with Knack and handles authentication and data transfer

// Define Knack credentials
const knackAppId = "5ee90912c38ae7001510c1a9";
const knackApiKey = "8f733aa5-dd35-4464-8348-64824d1f5f0d";

// Define Knack API endpoint
const KNACK_API_URL = 'https://api.knack.com/v1';

// Configuration for scenes and views where the app should be embedded
const FLASHCARD_APP_CONFIG = {
  'scene_1206': { // Your flashcard app scene ID
    'view_3005': { // Your rich text field view ID
      appType: 'flashcard-app',
      elementSelector: '.kn-rich-text', // Target element to mount the app
      appUrl: 'https://vespaflashcards-50af4a5d150b.herokuapp.com/' // Your Heroku app URL
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
  colorMapping: 'field_3000'      // Color Mapping
};

// Initialize app when the specific scene renders
$(document).on('knack-scene-render.scene_1206', function(event, scene) {
  console.log("Flashcard app: Scene rendered:", scene.key);
  initializeFlashcardApp();
});

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
      
      // Set up message listener for communication with the iframe
      window.addEventListener('message', function(event) {
        // Only accept messages from our iframe
        if (event.source !== iframe.contentWindow) {
          return;
        }
        
        console.log("Flashcard app: Message from React app:", event.data);
        
        if (event.data && event.data.type) {
          switch(event.data.type) {
            case 'APP_READY':
              console.log("Flashcard app: React app is ready, sending user info");
              
              // First, get user data from Knack
              loadFlashcardUserData(user.id, function(userData) {
                // Send authentication and user data to the iframe
                iframe.contentWindow.postMessage({
                  type: 'KNACK_USER_INFO',
                  data: {
                    id: user.id,
                    email: user.email,
                    name: user.name || '',
                    token: userToken,
                    appId: appId,
                    userData: userData || {}
                  }
                }, '*');
                
                authSent = true;
                console.log("Flashcard app: Sent user info to React app");
              });
              break;
              
            case 'AUTH_CONFIRMED':
              console.log("Flashcard app: Authentication confirmed by React app");
              
              // Hide loading indicator and show iframe
              loadingDiv.style.display = 'none';
              iframe.style.display = 'block';
              break;
              
            case 'SAVE_DATA':
              console.log("Flashcard app: Saving data from React app:", event.data.data);
              
              // Save the data to Knack
              saveFlashcardUserData(user.id, event.data.data, function(success) {
                // Notify the React app about the save result
                iframe.contentWindow.postMessage({
                  type: 'SAVE_RESULT',
                  success: success
                }, '*');
              });
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
              cardData = decodeURIComponent(cardData);
            }
            userData.cards = JSON.parse(cardData);
          }
          
          // Parse color mapping
          if (record[FIELD_MAPPING.colorMapping]) {
            // Make sure to decode URL-encoded data if needed
            let colorData = record[FIELD_MAPPING.colorMapping];
            if (typeof colorData === 'string' && colorData.includes('%')) {
              colorData = decodeURIComponent(colorData);
            }
            userData.colorMapping = JSON.parse(colorData);
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
              box1Data = decodeURIComponent(box1Data);
            }
            srData.box1 = JSON.parse(box1Data);
          }
          
          // Handle box 2
          if (record[FIELD_MAPPING.box2Data]) {
            let box2Data = record[FIELD_MAPPING.box2Data];
            if (typeof box2Data === 'string' && box2Data.includes('%')) {
              box2Data = decodeURIComponent(box2Data);
            }
            srData.box2 = JSON.parse(box2Data);
          }
          
          // Handle box 3
          if (record[FIELD_MAPPING.box3Data]) {
            let box3Data = record[FIELD_MAPPING.box3Data];
            if (typeof box3Data === 'string' && box3Data.includes('%')) {
              box3Data = decodeURIComponent(box3Data);
            }
            srData.box3 = JSON.parse(box3Data);
          }
          
          // Handle box 4
          if (record[FIELD_MAPPING.box4Data]) {
            let box4Data = record[FIELD_MAPPING.box4Data];
            if (typeof box4Data === 'string' && box4Data.includes('%')) {
              box4Data = decodeURIComponent(box4Data);
            }
            srData.box4 = JSON.parse(box4Data);
          }
          
          // Handle box 5
          if (record[FIELD_MAPPING.box5Data]) {
            let box5Data = record[FIELD_MAPPING.box5Data];
            if (typeof box5Data === 'string' && box5Data.includes('%')) {
              box5Data = decodeURIComponent(box5Data);
            }
            srData.box5 = JSON.parse(box5Data);
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
    [FIELD_MAPPING.userEmail]: user.email,
    [FIELD_MAPPING.lastSaved]: new Date().toISOString(),
    [FIELD_MAPPING.cardBankData]: JSON.stringify([]),
    [FIELD_MAPPING.box1Data]: JSON.stringify([]),
    [FIELD_MAPPING.box2Data]: JSON.stringify([]),
    [FIELD_MAPPING.box3Data]: JSON.stringify([]),
    [FIELD_MAPPING.box4Data]: JSON.stringify([]),
    [FIELD_MAPPING.box5Data]: JSON.stringify([]),
    [FIELD_MAPPING.colorMapping]: JSON.stringify({})
  };
  
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

// Save flashcard user data
function saveFlashcardUserData(userId, data, callback) {
  console.log("Flashcard app: Saving flashcard data for user:", userId, data);
  
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
  
  // Prepare the update data
  const updateData = {
    [FIELD_MAPPING.lastSaved]: new Date().toISOString(),
    [FIELD_MAPPING.cardBankData]: JSON.stringify(data.cards || []),
    [FIELD_MAPPING.colorMapping]: JSON.stringify(data.colorMapping || {})
  };
  
  // Add spaced repetition data if available
  if (data.spacedRepetition) {
    updateData[FIELD_MAPPING.box1Data] = JSON.stringify(data.spacedRepetition.box1 || []);
    updateData[FIELD_MAPPING.box2Data] = JSON.stringify(data.spacedRepetition.box2 || []);
    updateData[FIELD_MAPPING.box3Data] = JSON.stringify(data.spacedRepetition.box3 || []);
    updateData[FIELD_MAPPING.box4Data] = JSON.stringify(data.spacedRepetition.box4 || []);
    updateData[FIELD_MAPPING.box5Data] = JSON.stringify(data.spacedRepetition.box5 || []);
  }
  
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
      console.log("Flashcard app: Successfully saved user data:", response);
      callback(true);
    },
    error: function(error) {
      console.error("Flashcard app: Error saving user data:", error);
      callback(false);
    }
  });
} 