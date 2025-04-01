import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "./App.css";
import FlashcardList from "./components/FlashcardList";
import CardCreator from "./components/CardCreator";
import SpacedRepetition from "./components/SpacedRepetition";
import LoadingSpinner from "./components/LoadingSpinner";
import Header from "./components/Header";
import AICardGenerator from './components/AICardGenerator';
import PrintModal from './components/PrintModal';
import TopicListSyncManager from './components/TopicListSyncManager';
import TopicCreationModal from './components/TopicCreationModal';
import { WebSocketProvider } from './contexts/WebSocketContext'; // Corrected import path
import { 
  initializeAuthManager, 
  handleTokenRefreshRequest, 
} from './utils/AuthAppIntegration';
import { 
  addVersionMetadata, 
  safeParseJSON, 
  localStorageHelpers, 
  dataLogger,
  backupMultipleChoiceOptions,
  restoreMultipleChoiceOptions
} from './utils/DataUtils';

import {
  validateCards,
} from './utils/CardDataProcessor';

import saveQueueService from './services/SaveQueueService';

// API Keys and constants
// Removed unused KNACK_APP_ID
// Removed unused KNACK_API_KEY

// Define isKnack - true if running inside iframe
const isKnack = window.parent !== window;

// Helper function to clean HTML tags from strings
const cleanHtmlTags = (str) => {
  if (!str) return "";
  // If it's not a string, convert to string
  const strValue = String(str);
  // Remove HTML tags
  return strValue.replace(/<\/?[^>]+(>|$)/g, "").trim();
};

// Improved contrast color calculation function with better readability logic
const getContrastColor = (hexColor) => {
  if (!hexColor) return "#000000";
  
  try {
    // Remove # if present
    hexColor = hexColor.replace("#", "");
    
    // Ensure we have a 6-digit hex
    if (hexColor.length === 3) {
      hexColor = hexColor[0] + hexColor[0] + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2];
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // Use enhanced WCAG luminance formula for better contrast calculation
    // This gives more weight to colors that human eyes are more sensitive to
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Use a more sophisticated threshold for better contrast with various colors
    // Enhanced logic to handle particularly problematic colors
    if (luminance > 0.6) {
      // For light or bright colors, use black text
      return "#000000";
    } else if (luminance < 0.3) {
      // For dark colors, use white text
      return "#FFFFFF";
    } else {
      // For medium colors, check if it's a problematic hue (like bright green)
      // Some colors need different thresholds
      
      // Check if this is a green-heavy color (which can be hard to read even at medium luminance)
      if (g > Math.max(r, b) + 50) {
        return "#000000"; // Use black for green-heavy colors
      }
      
      // Check if this is a yellow-heavy color
      if (r > 200 && g > 200 && b < 100) {
        return "#000000"; // Use black for yellow-heavy colors
      }
      
      // Default decision based on adjusted threshold
      return luminance > 0.5 ? "#000000" : "#FFFFFF";
    }
  } catch (e) {
    console.error("Error calculating contrast color:", e);
    return "#000000"; // Default to black on error
  }
};

function App() {
  // Authentication and user state
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [error, /* Removed unused setError */ ] = useState(null);
  const [recordId, setRecordId] = useState(null);

  // App view state
  const [view, setView] = useState("cardBank"); // cardBank, createCard, spacedRepetition

  // Flashcard data
  const [allCards, setAllCards] = useState([]);
  const [subjectColorMapping, setSubjectColorMapping] = useState({});
  const [currentSubjectColor, setCurrentSubjectColor] = useState("#e6194b");

  // Filters and selections
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Topic List Modal state
  const [topicListModalOpen, setTopicListModalOpen] = useState(false);
  const [topicListSubject, setTopicListSubject] = useState(null);
  const [topicListExamBoard, /* Removed unused setTopicListExamBoard */] = useState("AQA");
  const [topicListExamType, /* Removed unused setTopicListExamType */] = useState("A-Level");

  // ** NEW STATE for Topic Creation Modal **
  const [isTopicCreationModalOpen, setIsTopicCreationModalOpen] = useState(false);

  // Spaced repetition state
  const [currentBox, setCurrentBox] = useState(1);
  const [spacedRepetitionData, setSpacedRepetitionData] = useState({
    box1: [],
    box2: [],
    box3: [],
    box4: [],
    box5: [],
  });

  // User-specific topics
  const [userTopics, setUserTopics] = useState({});
  
  // Topic lists state
  const [topicLists, setTopicLists] = useState([]);
  const [topicMetadata, setTopicMetadata] = useState([]);

  // Status messages
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // PrintModal state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [cardCreationModalOpen, setCardCreationModalOpen] = useState(false);

  // User information - enhanced with additional student data
  const getUserInfo = useCallback(() => {
    return {
      id: auth?.id || "",
      email: auth?.email || "",
      name: auth?.name || "",
      role: auth?.role || "",  // Add user role
      tutorGroup: auth?.tutorGroup || "",
      yearGroup: auth?.yearGroup || "",
      tutor: auth?.tutor || "",
      school: auth?.school || auth?.field_122 || "" // School/Educational Establishment
    };
  }, [auth]);

  // Define helper functions first, without dependencies on other functions
  const showStatus = useCallback((message, duration = 3000) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(""), duration);
  }, []);

  // Update spaced repetition data
  const updateSpacedRepetitionData = useCallback((cards) => {
    const newSpacedRepetitionData = {
      box1: [],
      box2: [],
      box3: [],
      box4: [],
      box5: [],
    };

    cards.forEach((card) => {
      const boxNum = card.boxNum || 1;
      if (boxNum >= 1 && boxNum <= 5) {
        // Store card ID with review date information
        newSpacedRepetitionData[`box${boxNum}`].push({
          cardId: card.id,
          lastReviewed: card.lastReviewed || new Date().toISOString(),
          nextReviewDate: card.nextReviewDate || new Date().toISOString() // Default to today's date if not present
        });
      }
    });

    setSpacedRepetitionData(newSpacedRepetitionData);
  }, []);

  // Extract unique topics for a selected subject
  const getTopicsForSubject = useCallback(
    (subject) => {
      if (!subject) return [];
      const topics = [
        ...new Set(
          allCards
            .filter((card) => (card.subject || "General") === subject)
            .map((item) => {
              if (item.type === 'topic' && item.isShell && item.name) {
                // Extract from shell name, handling potential 'Subject: Topic' format
                const nameParts = item.name.split(': ');
                return nameParts.length > 1 ? nameParts[1].trim() : item.name;
              }
              return item.topic || "General"; // Fallback for cards or improperly named shells
            })
        ),
      ];
      return topics.sort();
    },
    [allCards]
  );

  // Generate a shade of a base color
  const generateShade = useCallback((baseColor, shadeIndex, totalShades) => {
    // Convert hex to RGB
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    
    // Calculate lightness and saturation adjustments based on shade index
    // Using a range from -20% (darker) to +30% (lighter) for lightness
    const lightnessAdjustment = -20 + (50 * (shadeIndex / Math.max(totalShades - 1, 1)));
    
    // Also adjust saturation slightly to create more distinct colors
    const saturationAdjustment = 10 - (20 * (shadeIndex / Math.max(totalShades - 1, 1)));
    
    // Convert RGB to HSL
    const rgbToHsl = (r, g, b) => {
      r /= 255;
      g /= 255;
      b /= 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
          default: h = 0;
        }
        
        h /= 6;
      }
      
      return [h, s, l];
    };
    
    // Convert HSL back to RGB
    const hslToRgb = (h, s, l) => {
      let r, g, b;
      
      if (s === 0) {
        r = g = b = l; // achromatic
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };
    
    // Convert to HSL, adjust, and convert back
    const [h, s, l] = rgbToHsl(r, g, b);
    
    // Calculate new saturation and lightness with constraints
    const newS = Math.min(Math.max(s * (1 + saturationAdjustment/100), 0.1), 1);
    const newL = Math.min(Math.max(l * (1 + lightnessAdjustment/100), 0.2), 0.8);
    
    // Convert back to RGB
    const [newR, newG, newB] = hslToRgb(h, newS, newL);
    
    // Convert back to hex
    const toHex = c => {
      const hex = c.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    const adjustedHex = '#' + toHex(newR) + toHex(newG) + toHex(newB);
    
    return adjustedHex;
  }, []);

  // Add the getColorForSubjectTopic function definition here, before it's used
  const getColorForSubjectTopic = useCallback((subject, topic) => {
    if (!subject || !topic) return currentSubjectColor;
    
    // Default color if nothing else works
    const defaultColor = currentSubjectColor;

    // Check if we have a color mapping for this subject
    if (subjectColorMapping && subjectColorMapping[subject]) {
      // Try to get a topic-specific color first
      if (subjectColorMapping[subject].topics && 
          subjectColorMapping[subject].topics[topic]) {
        return subjectColorMapping[subject].topics[topic];
      }
      
      // If topic is not in mapping but we have a base color, generate a color
      else if (topic && topic !== "General" && subjectColorMapping[subject].base) {
        // Get all topics for this subject
        const topicsForSubject = allCards
          .filter(card => (card.subject || "General") === subject)
          .map(item => {
            if (item.type === 'topic' && item.isShell && item.name) {
              // Extract from shell name, handling potential 'Subject: Topic' format
              const nameParts = item.name.split(': ');
              return nameParts.length > 1 ? nameParts[1].trim() : item.name;
            }
            return item.topic || "General"; // Fallback for cards or improperly named shells
          });
        
        // Remove duplicates and sort
        const uniqueTopics = [...new Set(topicsForSubject)].filter(t => t !== "General").sort();
        
        // Find index of this topic
        const topicIndex = uniqueTopics.indexOf(topic);
        
        if (topicIndex !== -1) {
          // Generate a shade and store it for future use
          const shade = generateShade(
            subjectColorMapping[subject].base, 
            topicIndex, 
            Math.max(uniqueTopics.length, 5)
          );
          
          // Store this for next time
          setSubjectColorMapping(prev => {
            const newMapping = { ...prev };
            if (!newMapping[subject].topics) {
              newMapping[subject].topics = {};
            }
            newMapping[subject].topics[topic] = shade;
            return newMapping;
          });
          
          return shade;
        }
      }
      
      // Fall back to the subject base color if no topic color
      return subjectColorMapping[subject].base;
    }
    
    // Default color if no mapping exists
    return defaultColor;
  }, [currentSubjectColor, subjectColorMapping, allCards, generateShade]);

  // Get a color for a card based on its subject and topic
  const getCardColor = useCallback((subject, topic) => {
    // If we don't have the subject or topic, return the default color
    if (!subject) return currentSubjectColor;
    
    // First try to get the topic color if both subject and topic exist
    if (topic && subject) {
      return getColorForSubjectTopic(subject, topic);
    }
    
    // If no topic, return the subject color
    if (subjectColorMapping[subject] && subjectColorMapping[subject].base) {
      return subjectColorMapping[subject].base;
    }
    
    // Fallback to default color
    return currentSubjectColor;
  }, [currentSubjectColor, getColorForSubjectTopic, subjectColorMapping]);

  // Save data to localStorage fallback - using enhanced version with versioning and backups
  const saveToLocalStorage = useCallback(() => {
    // Prepare full data object
    const appData = {
      cards: allCards,
      colorMapping: subjectColorMapping,
      spacedRepetition: spacedRepetitionData,
      userTopics: userTopics,
      topicLists: topicLists,
      topicMetadata: topicMetadata
    };
    
    try {
      // Add version metadata
      const versionedData = addVersionMetadata(appData);
      
      // Log save operation with stats
      dataLogger.logSave('localStorage', versionedData);
      
      // Save with backup using enhanced helpers
      localStorageHelpers.saveData('flashcards_app', versionedData);
      
      // Also save individual components for backward compatibility
      localStorage.setItem('flashcards', JSON.stringify(allCards));
      localStorage.setItem('colorMapping', JSON.stringify(subjectColorMapping));
      localStorage.setItem('spacedRepetition', JSON.stringify(spacedRepetitionData));
      localStorage.setItem('userTopics', JSON.stringify(userTopics));
      
      // Backup multiple choice options
      backupMultipleChoiceOptions(allCards);
      
      console.log("Saved data to localStorage with versioning and backup");
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      dataLogger.logError('localStorage_save', error);
    }
  }, [allCards, subjectColorMapping, spacedRepetitionData, userTopics]);

  // Add this function to recover the record ID if it gets lost
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ensureRecordId = useCallback(async () => {
    // If we already have a record ID, nothing to do
    if (recordId) {
      return recordId;
    }
    
    console.log("[Auth Recovery] Record ID missing, attempting to recover...");
    
    // First try to get it from auth object
    if (auth && auth.recordId) {
      console.log("[Auth Recovery] Found record ID in auth object:", auth.recordId);
      return auth.recordId;
    }
    
    // Try to recover from localStorage as a backup
    try {
      const storedData = localStorage.getItem('flashcards_auth');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        if (parsedData && parsedData.recordId) {
          console.log("[Auth Recovery] Recovered record ID from localStorage:", parsedData.recordId);
          return parsedData.recordId;
        }
      }
    } catch (e) {
      console.error("[Auth Recovery] Error reading from localStorage:", e);
    }
    
    // If we're in an iframe, request it from the parent
    if (window.parent !== window) {
      console.log("[Auth Recovery] Requesting record ID from parent window");
      
      // Create a promise that will resolve when we get a response
      return new Promise((resolve) => {
        // Function to handle the response
        const handleRecordIdResponse = (event) => {
          if (event.data && event.data.type === 'RECORD_ID_RESPONSE' && event.data.recordId) {
            console.log("[Auth Recovery] Received record ID from parent:", event.data.recordId);
            
            // Store the record ID in localStorage for future recovery
            try {
              const authData = { recordId: event.data.recordId };
              localStorage.setItem('flashcards_auth', JSON.stringify(authData));
            } catch (e) {
              console.error("[Auth Recovery] Error storing record ID in localStorage:", e);
            }
            
            // Remove the event listener
            window.removeEventListener('message', handleRecordIdResponse);
            
            // Resolve with the record ID
            resolve(event.data.recordId);
          }
        };
        
        // Add event listener
        window.addEventListener('message', handleRecordIdResponse);
        
        // Send request to parent
        window.parent.postMessage({
          type: 'REQUEST_RECORD_ID',
          timestamp: new Date().toISOString()
        }, '*');
        
        // Set a timeout to avoid hanging indefinitely
        setTimeout(() => {
          window.removeEventListener('message', handleRecordIdResponse);
          console.error("[Auth Recovery] Timed out waiting for record ID");
          resolve(null);
        }, 5000);
      });
    }
    
    // If all recovery methods fail
    console.error("[Auth Recovery] Could not recover record ID");
    return null;
  }, [recordId, auth]);

  // Modify the saveData function to use the ensureRecordId function
  const saveData = useCallback(async (data, preserveFields = false) => {
    console.log("[App] saveData triggered.isAuthenticated:", auth !== null, "isKnack:", window.parent !== window);
    if (!auth) {
      console.warn("[App] No authentication available, saving locally only");
      saveToLocalStorage();
      setIsSaving(false);
      return;
    }

    if (isSaving) {
      console.log("[Save] Save already in progress, skipping this request");
      showStatus("Save in progress...");
      return;
    }

    console.log("[Save] Starting save operation...");
    setIsSaving(true);
    
    // Always save to localStorage first as a backup
    console.log("[Save] Saving to localStorage first");
    saveToLocalStorage();
    
    // If we're in an iframe, send data to parent
    if (window.parent !== window) {
      console.log("[Save] Preparing data for Knack integration");
      
      // Get recordId safely - use the new ensureRecordId function
      let safeRecordId = recordId;
      if (!safeRecordId) {
        safeRecordId = await ensureRecordId();
      }
      
      if (!safeRecordId) {
        console.error("[Save] No record ID available, cannot save to Knack");
        setIsSaving(false);
        showStatus("Error: Missing record ID for save");
        return;
      }
      
      // If no specific data was passed, use current state
      const dataToSave = data || { 
        cards: allCards,
        subjectColorMapping,
        spacedRepetitionData,
        userTopics,
        topicLists,
        topicMetadata
      };
      
      // Ensure data is serializable by running it through JSON.stringify + JSON.parse
      // This prevents circular references and other serialization issues
      const safeSerializeData = (sourceData) => {
        if (!sourceData) return [];
        try {
          if (Array.isArray(sourceData)) {
            return JSON.parse(JSON.stringify(sourceData));
          } else if (typeof sourceData === 'object') {
            return JSON.parse(JSON.stringify(sourceData));
          } else {
            console.warn("[Save] Unexpected data type:", typeof sourceData);
            return [];
          }
        } catch (e) {
          console.error("[Save] Serialization error:", e);
          // Return empty array/object based on expected type
          return Array.isArray(sourceData) ? [] : {};
        }
      };
      
      // Validate that we have cards data
      const cardsData = Array.isArray(dataToSave.cards) ? dataToSave.cards : allCards;
      
      // Prepare the data payload for Knack with proper validation
        const safeData = {
          recordId: safeRecordId,
        cards: safeSerializeData(cardsData || []),
        colorMapping: safeSerializeData(dataToSave.subjectColorMapping || subjectColorMapping || {}),
        spacedRepetition: safeSerializeData(dataToSave.spacedRepetitionData || spacedRepetitionData || { box1: [], box2: [], box3: [], box4: [], box5: [] }),
        userTopics: safeSerializeData(dataToSave.userTopics || userTopics || {}),
        topicLists: safeSerializeData(dataToSave.topicLists || topicLists || []),
        topicMetadata: safeSerializeData(dataToSave.topicMetadata || topicMetadata || []),
        preserveFields: preserveFields
      };
      
      // Additional validation to prevent null/undefined arrays
      if (!Array.isArray(safeData.cards)) safeData.cards = [];
      if (!Array.isArray(safeData.topicLists)) safeData.topicLists = [];
      if (!Array.isArray(safeData.topicMetadata)) safeData.topicMetadata = [];
      
      // *** DETAILED LOGGING BEFORE SENDING ***
      console.log(`[Save] Sending data to Knack (${safeData.cards.length} items, record ID: ${safeRecordId})`);
      console.log("[Save] Payload structure:", {
        recordId: safeData.recordId,
        cards_count: safeData.cards.length,
        colorMapping_keys: Object.keys(safeData.colorMapping || {}),
        spacedRepetition_box1_count: safeData.spacedRepetition?.box1?.length || 0,
        userTopics_keys: Object.keys(safeData.userTopics || {}),
        topicLists_count: safeData.topicLists.length,
        topicMetadata_count: safeData.topicMetadata.length,
        preserveFields: safeData.preserveFields
      });
      
      // Only try to log sample items if we have cards
      if (Array.isArray(safeData.cards) && safeData.cards.length > 0) {
        try {
          // Log a sample of the cards/shells being sent, focusing on type and name
          const sampleItems = safeData.cards.slice(0, 15).map(item => ({
            id: item.id, 
            type: item.type, 
            name: item.name, 
            subject: item.subject, 
            topic: item.topic, 
            isShell: item.isShell,
            color: item.cardColor,
            subjectColor: item.subjectColor
          }));
          console.log("[Save] Sample items being sent:", sampleItems);
          
          // Log topic shells being sent
          const topicShells = safeData.cards.filter(item => item && item.type === 'topic');
          console.log(`[Save] ALL ${topicShells.length} Topic Shells being sent:`, topicShells);
        } catch (logError) {
          console.warn("[Save] Error logging sample items:", logError);
        }
      } else {
        console.log("[Save] No cards to log in sample");
      }
      // *** END DETAILED LOGGING ***
        
      // Add a timeout to clear the saving state if no response is received
      const saveTimeout = setTimeout(() => {
        console.log("[Save] No save response received within timeout, resetting save state");
            setIsSaving(false);
        showStatus("Save status unknown - check your data");
      }, 15000); // 15 second timeout
      
      // Store the timeout ID so we can clear it if we get a response
      window.currentSaveTimeout = saveTimeout;
      
      // Use SaveQueueService to send the data
      console.log("[App] Adding SAVE_DATA to queue with payload structure:", {
        recordId: safeData.recordId,
        cards_count: safeData.cards.length,
        has_data: !!safeData
      });

      saveQueueService.addToQueue({ 
        type: 'SAVE_DATA', 
        payload: safeData
      })
      .then(() => {
        console.log("[App] SAVE_DATA request successfully processed by SaveQueueService");
        
        // Clear the timeout as we've received a response
        if (window.currentSaveTimeout) {
          clearTimeout(window.currentSaveTimeout);
          window.currentSaveTimeout = null;
        }
        
        setIsSaving(false);
        showStatus("Saved successfully!");
      })
      .catch(error => {
        console.error("[App] Error in SAVE_DATA operation:", error);
        
        // Clear the timeout as we've received a response
        if (window.currentSaveTimeout) {
          clearTimeout(window.currentSaveTimeout);
          window.currentSaveTimeout = null;
        }
        
        setIsSaving(false);
        showStatus("Error saving data: " + error.message);
      });
      } else {
      // If we're in standalone mode, mark as saved immediately
      console.log("[Save] Running in standalone mode");
        setIsSaving(false);
      showStatus("Saved to browser storage");
    }
  }, [auth, subjectColorMapping, spacedRepetitionData, userTopics, topicLists, topicMetadata, isSaving, saveToLocalStorage, showStatus, ensureRecordId, recordId, allCards]);

  // Generate a random vibrant color
  const getRandomColor = useCallback(() => {
    // Default bright colors palette
    const brightColors = [
      "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231", 
      "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe", 
      "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000", 
      "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
      "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C",
    ];
    
    // Return a random color from the palette
    return brightColors[Math.floor(Math.random() * brightColors.length)];
  }, []);

  // Update color mappings - enhanced to ensure immediate color application
  const updateColorMapping = useCallback(
    (subject, topic, color, updateTopics = false) => {
      if (!subject) return;
      
      // If color is null, use a default color or generate one
      const colorToUse = color || getRandomColor();
      console.log(`Updating color for subject: ${subject}, topic: ${topic || "none"}, color: ${colorToUse}, updateTopics: ${updateTopics}`);
      
      // First update the color mapping
      setSubjectColorMapping((prevMapping) => {
        const newMapping = { ...prevMapping };

        // Create subject entry if it doesn't exist
        if (!newMapping[subject]) {
          newMapping[subject] = { base: colorToUse, topics: {} };
        } else if (typeof newMapping[subject] === 'string') {
          // Convert legacy string format to object format
          const baseColor = newMapping[subject];
          newMapping[subject] = { base: baseColor, topics: {} };
        }

        // If it's a subject-level color update
        if (!topic || updateTopics) {
          // Update the base subject color
          newMapping[subject].base = colorToUse;
          
          // If we should update topic colors automatically
          if (updateTopics) {
            console.log(`Updating all topic colors for subject ${subject} based on ${colorToUse}`);
            
            // Get all topics for this subject from current cards
            const topicsForSubject = allCards
              .filter(card => (card.subject || "General") === subject)
              .map(item => {
                if (item.type === 'topic' && item.isShell && item.name) {
                  // Extract from shell name, handling potential 'Subject: Topic' format
                  const nameParts = item.name.split(': ');
                  return nameParts.length > 1 ? nameParts[1].trim() : item.name;
                }
                return item.topic || "General"; // Fallback for cards or improperly named shells
              });
            
            // Remove duplicates and sort
            const uniqueTopics = [...new Set(topicsForSubject)].filter(t => t !== "General").sort();
            
            console.log(`Found topics for subject ${subject}:`, uniqueTopics);
            
            // Generate a color for each topic
            if (uniqueTopics.length > 0) {
              // Ensure the topics object exists
              if (!newMapping[subject].topics) {
                newMapping[subject].topics = {};
              }
              
              uniqueTopics.forEach((topicName, index) => {
                // Skip the "General" topic as it should use the base color
                if (topicName === "General") return;
                
                // Generate a shade of the base color for this topic
                const topicColor = generateShade(colorToUse, index, uniqueTopics.length);
                console.log(`Generated color for ${topicName}: ${topicColor}`);
                
                // Update the topic color
                newMapping[subject].topics[topicName] = topicColor;
                
                // Also update any cards that match this topic
                setAllCards(prevCards => 
                  prevCards.map(card => {
                    if (card.subject === subject && card.topic === topicName) {
                      return { ...card, topicColor: topicColor };
                    }
                    return card;
                  })
                );
              });
            }
          }
        } 
        // If it's a topic-level color update
        else if (topic) {
          // Ensure the subject exists in mapping with the correct structure
          if (!newMapping[subject]) {
            newMapping[subject] = { base: colorToUse, topics: {} };
          } else if (typeof newMapping[subject] === 'string') {
            // Convert string color to proper object structure
            const baseColor = newMapping[subject];
            newMapping[subject] = { base: baseColor, topics: {} };
          } else if (!newMapping[subject].topics) {
            // Ensure topics object exists
            newMapping[subject].topics = {};
          }
          
          // Update the specified topic color
          newMapping[subject].topics[topic] = colorToUse;
          
          // Also update any cards that match this topic
          setAllCards(prevCards => 
            prevCards.map(card => {
              if (card.subject === subject && card.topic === topic) {
                return { ...card, topicColor: colorToUse };
          }
          return card;
            })
          );
        }
        
        return newMapping;
      });
      
      // Immediately save to localStorage to ensure color persistence
      setTimeout(() => saveToLocalStorage(), 0);
      
      // Trigger a full save to Knack after a short delay to ensure state is updated
      setTimeout(() => saveData(), 500);
    },
    [generateShade, getRandomColor, saveData, saveToLocalStorage, allCards]
  );

  // Function to refresh subject and topic colors
  // Removed unused refreshSubjectAndTopicColors useCallback

  // Generate a color for a subject or topic - MOVED EARLIER IN THE FILE
  // This function has been moved to line ~250 to fix initialization order

  // Cards and data operations - these depend on the above functions
  // Load data from localStorage with enhanced error recovery
  const loadFromLocalStorage = useCallback(() => {
    try {
      // First try to load the new versioned data format
      const loadResult = localStorageHelpers.loadData('flashcards_app', {
        cards: [],
        colorMapping: {},
        spacedRepetition: {
          box1: [], box2: [], box3: [], box4: [], box5: []
        },
        userTopics: {}
      });
      
      // Log the load operation
      dataLogger.logLoad('localStorage', loadResult);
      
      if (loadResult.success) {
        // Successfully loaded versioned data
        const versionedData = loadResult.data;
        
        // Update state with all data components
        if (versionedData.cards && Array.isArray(versionedData.cards)) {
          setAllCards(versionedData.cards);
          updateSpacedRepetitionData(versionedData.cards);
        }
        
        if (versionedData.colorMapping) {
          setSubjectColorMapping(versionedData.colorMapping);
        }
        
        if (versionedData.spacedRepetition) {
          setSpacedRepetitionData(versionedData.spacedRepetition);
        }
        
        if (versionedData.userTopics) {
          setUserTopics(versionedData.userTopics);
        }
        
        console.log(`Loaded data from localStorage using ${loadResult.source} source`);
        showStatus(`Data loaded from ${loadResult.source}`);

        // Restore multiple choice options
        restoreMultipleChoiceOptions(versionedData.cards);

        return;
      }
      
      // If new format failed, try legacy format as fallback
      console.log("Falling back to legacy localStorage format");
      
      const savedCards = localStorage.getItem('flashcards');
      const savedColorMapping = localStorage.getItem('colorMapping');
      const savedSpacedRepetition = localStorage.getItem('spacedRepetition');
      const savedUserTopics = localStorage.getItem('userTopics');
      
      let loadedData = false;
      
      if (savedCards) {
        const { valid, cleanedCards } = validateCards(safeParseJSON(savedCards, []));
        if (valid) {
          setAllCards(cleanedCards);
          updateSpacedRepetitionData(cleanedCards);
          loadedData = true;
        } else {
          console.warn("Invalid cards detected, using cleaned cards array");
          setAllCards(cleanedCards);
          updateSpacedRepetitionData(cleanedCards);
          loadedData = true;
        }
      }
      
      if (savedColorMapping) {
        setSubjectColorMapping(safeParseJSON(savedColorMapping, {}));
        loadedData = true;
      }
      
      if (savedSpacedRepetition) {
        setSpacedRepetitionData(safeParseJSON(savedSpacedRepetition, {
          box1: [], box2: [], box3: [], box4: [], box5: []
        }));
        loadedData = true;
      }
      
      if (savedUserTopics) {
        setUserTopics(safeParseJSON(savedUserTopics, {}));
        loadedData = true;
      }
      
      if (loadedData) {
        console.log("Loaded data from legacy localStorage format");
        
        // Create a backup in the new format for future use
        setTimeout(() => saveData(), 1000);
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      dataLogger.logError('localStorage_load', error);
      showStatus("Error loading data from local storage");
    }
  }, [updateSpacedRepetitionData, showStatus, saveData]);

  // Load data from Knack
  // Removed unused loadData useCallback

  // Functions for card operations - defined after their dependencies
  // Add a new card
  const addCard = useCallback(
    (card) => {
      // Ensure the card has a boxNum of 1 for spaced repetition
      const cardWithSpacedRep = {
        ...card,
        boxNum: 1,
        nextReviewDate: new Date().toISOString() // Set to today so it's immediately reviewable
      };

      setAllCards((prevCards) => {
        const newCards = [...prevCards, cardWithSpacedRep];
        return newCards;
      });
      
      // Update spaced repetition data separately to ensure it's added to box1
      setSpacedRepetitionData((prevData) => {
        const newData = { ...prevData };
        // Add the card to box1
        newData.box1.push({
          cardId: cardWithSpacedRep.id,
          lastReviewed: new Date().toISOString(),
          nextReviewDate: new Date().toISOString() // Reviewable immediately
        });
        return newData;
      });
      
      // Update color mapping if needed
      if (card.subject && card.cardColor) {
        updateColorMapping(card.subject, card.topic, card.cardColor);
      }
      
      // Save the changes after state updates have completed
      setTimeout(() => saveData(), 100);
      showStatus("Card added successfully!");
    },
    [updateColorMapping, saveData, showStatus]
  );

  // Delete a card
  const deleteCard = useCallback(
    (cardId) => {
      setAllCards((prevCards) => {
        const newCards = prevCards.filter((card) => card.id !== cardId);
        updateSpacedRepetitionData(newCards);
        return newCards;
      });
      
      // Save the changes after state updates have completed
      setTimeout(() => saveData(), 100);
      showStatus("Card deleted");
    },
    [updateSpacedRepetitionData, saveData, showStatus]
  );

  // Update card properties
  const updateCard = useCallback(
    (updatedCard) => {
      setAllCards((prevCards) => {
        const updatedCards = prevCards.map((card) =>
          card.id === updatedCard.id ? { ...card, ...updatedCard } : card
        );
        updateSpacedRepetitionData(updatedCards);
        return updatedCards;
      });
      
      // Update color mapping if color changed
      if (updatedCard.subject && updatedCard.cardColor) {
        updateColorMapping(updatedCard.subject, updatedCard.topic, updatedCard.cardColor);
      }
      
      // Save the changes after state updates have completed
      setTimeout(() => saveData(), 100);
      showStatus("Card updated");
    },
    [updateSpacedRepetitionData, updateColorMapping, saveData, showStatus]
  );

  // Move a card to a specific box in spaced repetition
  const moveCardToBox = useCallback(
    (cardId, box) => {
      console.log(`Moving card ${cardId} to box ${box}`);

      // Calculate the next review date based on the box number
      const calculateNextReviewDate = (boxNumber) => {
        const today = new Date();
        let nextDate = new Date(today);
        
        switch (boxNumber) {
          case 1: // Review next day
            nextDate.setDate(today.getDate() + 1);
            break;
          case 2: // Every other day
            nextDate.setDate(today.getDate() + 2);
            break;
          case 3: // Every 3rd day
            nextDate.setDate(today.getDate() + 3);
            break;
          case 4: // Every week (7 days)
            nextDate.setDate(today.getDate() + 7);
            break;
          case 5: // Every 4 weeks (28 days)
            nextDate.setDate(today.getDate() + 28);
            break;
          default:
            nextDate.setDate(today.getDate() + 1);
        }
        
        // Set the time to midnight for consistent day-based comparisons
        nextDate.setHours(0, 0, 0, 0);
        
        return nextDate.toISOString();
      };

      // Ensure cardId is a string
      const stringCardId = String(cardId).trim();
      
      setSpacedRepetitionData((prevData) => {
        // Create a new object to avoid direct state mutation
        const newData = { ...prevData };

        // Remove the card from its current box (if it exists)
        for (let i = 1; i <= 5; i++) {
          newData[`box${i}`] = newData[`box${i}`].filter(
            (item) => {
              if (typeof item === 'object' && item !== null) {
                return item.cardId !== stringCardId;
              }
              return String(item) !== stringCardId;
            }
          );
        }

        // Add the card to the new box with next review date
        const targetBox = `box${box}`;
        const nextReviewDate = calculateNextReviewDate(box);
        
        // Store both the card ID and review date information
        newData[targetBox].push({
          cardId: stringCardId,
          lastReviewed: new Date().toISOString(),
          nextReviewDate: nextReviewDate
        });

        // Update the Knack notification fields on the next save
        setKnackFieldsNeedUpdate(true);
        
        return newData;
      });
      
      // Also update the card's boxNum property in allCards
      setAllCards(prevCards => {
        return prevCards.map(card => {
          if (String(card.id).trim() === stringCardId) {
            return {
              ...card,
              boxNum: box,
              nextReviewDate: calculateNextReviewDate(box),
              lastReviewed: new Date().toISOString(),
              isReviewable: false
            };
          }
          return card;
        });
      });
      
      // Save the updated data
      setTimeout(() => saveData(), 100);
      console.log(`Card ${cardId} moved to box ${box}`);
    },
    [saveData]
  );

  // Add state to track if Knack fields need updating
  const [knackFieldsNeedUpdate, setKnackFieldsNeedUpdate] = useState(false);

  // Update Knack boolean fields for box notifications
  const updateKnackBoxNotifications = useCallback(async () => {
    if (!auth || !knackFieldsNeedUpdate) return;
    
    try {
      console.log("Updating Knack box notification fields...");
      
      // Check if there are cards ready for review in each box
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to midnight for consistent day comparison
      
      // Prepare box status data
      const boxStatus = {
        field_2991: false, // Box 1
        field_2992: false, // Box 2
        field_2993: false, // Box 3
        field_2994: false, // Box 4
        field_2995: false  // Box 5
      };
      
      // Check each box for cards ready for review
      for (let i = 1; i <= 5; i++) {
        const boxKey = `box${i}`;
        const fieldKey = `field_299${i}`;
        
        // Box is ready if any card's next review date is today or earlier
        boxStatus[fieldKey] = spacedRepetitionData[boxKey]?.some(item => {
          // For string IDs (old format), assume they're ready
          if (typeof item === 'string') return true;
          
          // For object format with nextReviewDate
          if (item && item.nextReviewDate) {
            const nextReviewDate = new Date(item.nextReviewDate);
            return nextReviewDate <= today;
          }
          
          return false;
        }) || false;
        
        console.log(`Box ${i} notification status:`, boxStatus[fieldKey]);
      }
      
      // Update Knack object with box status
      if (auth.id) {
        try {
          // Check if we can use the parent window for Knack operations
          if (window.parent !== window) {
            // Send a message to the parent window to update the Knack fields
            window.parent.postMessage({
              type: "UPDATE_KNACK_BOX_STATUS",
              data: {
                userId: auth.id,
                boxStatus: boxStatus
              }
            }, "*");
            console.log("Requested parent window to update Knack box notification fields");
            setKnackFieldsNeedUpdate(false);
          } else {
            console.log("No parent window available for Knack integration");
          }
        } catch (error) {
          console.error("Error sending update request to parent:", error);
        }
      }
    } catch (error) {
      console.error("Error updating Knack box notifications:", error);
    }
  }, [auth, knackFieldsNeedUpdate, spacedRepetitionData]);

  // Update Knack box notification fields when needed
  useEffect(() => {
    if (knackFieldsNeedUpdate && auth) {
      updateKnackBoxNotifications();
    }
  }, [knackFieldsNeedUpdate, auth, updateKnackBoxNotifications]);

  // Get cards for the current box in spaced repetition mode
  const getCardsForCurrentBox = useCallback(() => {
    // Get the array of card items for the current box
    const boxKey = `box${currentBox}`;
    const boxItems = spacedRepetitionData[boxKey] || [];
    console.log(`Getting cards for box ${currentBox}:`, boxKey, boxItems);
    
    // If we have no cards in this box, return empty array
    if (boxItems.length === 0) {
      console.log(`No cards found in box ${currentBox}`);
      return [];
    }
    
    // Log all card information to help debug
    console.log("All available cards:", allCards.length, allCards.map(c => c.id).slice(0, 10));
    
    // Current date for review date comparisons
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight for consistent day comparison
    
    // Map the IDs to the actual card objects
    const cardsForBox = [];
    
    // Process each item in the box
    for (const boxItem of boxItems) {
      // Get the ID and review date info
      let cardId, nextReviewDate, isReviewable = true;
      
      if (typeof boxItem === 'string') {
        // If it's just a string ID without review date, assume it's reviewable
        cardId = boxItem;
        nextReviewDate = null;
      } else if (boxItem && typeof boxItem === 'object') {
        // If it has review date info
        cardId = boxItem.cardId;
        
        if (boxItem.nextReviewDate) {
          try {
            nextReviewDate = new Date(boxItem.nextReviewDate);
            // Card is reviewable if the next review date is today or earlier
            isReviewable = nextReviewDate <= today;
          } catch (e) {
            console.warn(`Invalid date format for nextReviewDate: ${boxItem.nextReviewDate}`);
            nextReviewDate = null;
            isReviewable = true;
          }
        }
      } else {
        console.warn("Invalid box item, skipping", boxItem);
        continue;
      }
      
      if (!cardId) {
        console.warn("Empty card ID found in box, skipping");
        continue;
      }
      
      // Find the matching card
      const matchingCard = allCards.find(card => {
        // Try multiple matching approaches
        return String(card.id) === String(cardId) || 
               card.id === cardId ||
               String(card.id).trim() === String(cardId).trim();
      });
      
      if (matchingCard) {
        // Add reviewability and next review date info to the card
        const cardWithReviewInfo = {
          ...matchingCard,
          isReviewable,
          nextReviewDate: nextReviewDate ? nextReviewDate.toISOString() : null
        };
        
        console.log(`Found card for ID ${cardId}:`, 
          matchingCard.subject, 
          matchingCard.topic,
          `reviewable: ${isReviewable}`,
          `next review: ${nextReviewDate ? nextReviewDate.toLocaleDateString() : 'anytime'}`
        );
        
        cardsForBox.push(cardWithReviewInfo);
      } else {
        console.warn(`Card with ID ${cardId} not found in allCards (total: ${allCards.length})`);
      }
    }
    
    console.log(`Found ${cardsForBox.length} valid cards for box ${currentBox} out of ${boxItems.length} IDs`);
    return cardsForBox;
  }, [currentBox, spacedRepetitionData, allCards]);

  // Extract the subjects from cards for the sidebar
  const getSubjects = useCallback(() => {
    if (!allCards || allCards.length === 0) return [];

    const subjectsMap = new Map();

    // First pass - collect all subjects and their cards
    allCards.forEach(card => {
      const subject = card.subject || "General";
      if (!subjectsMap.has(subject)) {
        subjectsMap.set(subject, {
          name: subject,
          count: 0,
          color: null,
          timestamp: null
        });
      }
      
      const subjectData = subjectsMap.get(subject);
      subjectData.count += 1;
      
      // Track the earliest timestamp for sorting
      if (card.timestamp) {
        const cardTime = new Date(card.timestamp).getTime();
        if (!subjectData.timestamp || cardTime < subjectData.timestamp) {
          subjectData.timestamp = cardTime;
        }
      }
      
      // Get color from color mapping
      if (!subjectData.color && subjectColorMapping[subject]?.base) {
        subjectData.color = subjectColorMapping[subject].base;
      }
    });

    // Convert to array and sort by timestamp (earliest first)
    let subjectsArray = Array.from(subjectsMap.values());
    
    // Sort by timestamp (earliest first)
    subjectsArray.sort((a, b) => {
      // Handle missing timestamps
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      
      // Sort by timestamp (ascending)
      return a.timestamp - b.timestamp;
    });
    
    return subjectsArray;
  }, [allCards, subjectColorMapping]);

  // Filter cards by subject and topic
  const getFilteredCards = useCallback(() => {
    let filtered = [...allCards];

    if (selectedSubject) {
      filtered = filtered.filter(
        (card) => (card.subject || "General") === selectedSubject
      );
    }

    if (selectedTopic) {
      filtered = filtered.filter(
        (card) => (card.topic || "General") === selectedTopic
      );
    }

    return filtered;
  }, [allCards, selectedSubject, selectedTopic]);

  // Auto-save periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (auth && allCards.length > 0) {
        console.log("Auto-saving data...");
        saveData();
      }
    }, 60000); // Every minute

    return () => clearInterval(intervalId);
  }, [auth, allCards, saveData]);

  // Initialize communication with parent window (Knack)
  // Reference to track if auth has been processed to prevent loops
  const authProcessedRef = useRef(false);
  
  useEffect(() => {
    // Prevent duplicate message sending
    // Removed unused hasReceivedUserInfo variable
    
    // Function to handle new verification messages
    const handleVerificationMessage = (event) => {
      const { type, success, error, reason } = event.data;
      
      console.log(`[Verification] Received ${type}`, event.data);
      
      switch (type) {
        case 'VERIFICATION_COMPLETE':
          // Clear any save timeouts
          if (window.currentSaveTimeout) {
            clearTimeout(window.currentSaveTimeout);
            window.currentSaveTimeout = null;
          }
          
          // Handle verification result
          if (success) {
            showStatus("Save verified successfully");
          } else {
            showStatus("Save completed, verification pending");
          }
          break;
          
        case 'VERIFICATION_SKIPPED':
          // Just log the reason
          console.log(`[Verification] Skipped: ${reason}`);
          break;
          
        case 'VERIFICATION_FAILED':
          console.error(`[Verification] Failed: ${error}`);
          showStatus("Warning: Save verification failed");
          break;
          
        default:
          // Unhandled verification message
          console.log(`[Verification] Unhandled message type: ${type}`);
      }
    };
    
    const handleMessage = (event) => {
      // Avoid logging every message to reduce console spam
      if (event.data && event.data.type !== 'PING') {
        console.log(`[Message Handler ${new Date().toISOString()}] From parent: ${event.data?.type}`);
      }

      if (event.data && event.data.type) {
        switch (event.data.type) {
          case "KNACK_USER_INFO":
            // IMPORTANT: Only process auth once to prevent loops
            if (authProcessedRef.current) {
              console.log("[User Info] Already processed, ignoring duplicate message");
              return;
            }
            
            // Set the flag immediately to prevent race conditions
            authProcessedRef.current = true;
            console.log("[User Info] First-time processing of user data");
            
            // Process student data if we have a role of "student"
            const userRole = event.data.data?.role || "";
            let userStudentData = {};
            
            // Extract school data from any user
            const schoolData = cleanHtmlTags(event.data.data?.field_122 || "");
            
            // Process tutor information
            let tutorData = "";
            // If there's a tutor field directly in the data, use it
            if (event.data.data?.field_1682) {
              tutorData = cleanHtmlTags(event.data.data.field_1682 || "");
            }
            
            if (userRole === "student" && event.data.data?.studentData) {
              try {
                // Extract student data (cleaning HTML tags if needed)
                const studentData = event.data.data.studentData || {};
                
                // Extract yearGroup, tutorGroup and tutor from studentData
                userStudentData = {
                  tutorGroup: cleanHtmlTags(studentData.field_565 || ""),
                  yearGroup: cleanHtmlTags(studentData.field_548 || ""),
                  tutor: cleanHtmlTags(studentData.field_1682 || tutorData || ""), // Use direct field if available
                  school: schoolData
                };
                
                console.log("[User Info] Processed student data");
              } catch (e) {
                console.error("[User Info] Error processing student data:", e);
              }
            } else {
              // For non-student users, just extract the school data
              userStudentData = {
                school: schoolData,
                tutor: tutorData // Include tutor data for all user types
              };
            }
            
            // Initialize AuthManager with the complete authentication data
            const authData = {
              ...event.data.data,
              ...userStudentData
            };
            
            // Set auth state for React components
            setAuth(authData);
            
            // Initialize the centralized AuthManager with the same data
            initializeAuthManager(authData);
            console.log("[User Info] Initialized AuthManager with user data");

            // If user data was included, process it
            if (event.data.data?.userData) {
              try {
                // Use our safe parsing function to handle potential corrupted JSON
                console.log("[User Info] Raw userData from Knack:", event.data.data.userData); // Log raw data
                const userData = safeParseJSON(event.data.data.userData);
                console.log("[User Info] Parsed userData object:", userData); // Log parsed object

                // Store the recordId if available
                if (userData.recordId) {
                  setRecordId(userData.recordId);
                  console.log("[User Info] Stored recordId:", userData.recordId);
                  
                  // Store in localStorage for recovery
                  try {
                    localStorage.setItem('flashcards_auth', JSON.stringify({ recordId: userData.recordId }));
                    console.log("[User Info] Stored record ID in localStorage for recovery");
                  } catch (e) {
                    console.error("[User Info] Error storing record ID in localStorage:", e);
                  }
                }

                // Process cards
                if (userData.cards && Array.isArray(userData.cards)) {
                  console.log("[User Info] Found userData.cards array:", userData.cards); // Log the cards array
                  const restoredCards = restoreMultipleChoiceOptions(userData.cards);
                  console.log("[User Info] Calling setAllCards with:", restoredCards); // Log what's being set
                  setAllCards(restoredCards);
                  updateSpacedRepetitionData(restoredCards);
                  console.log("[User Info] Restored multiple choice options for cards");
                } else {
                   console.warn("[User Info] userData.cards is missing or not an array:", userData.cards);
                }
                
                // Process color mapping
                if (userData.colorMapping) {
                  setSubjectColorMapping(userData.colorMapping);
                }
                
                // Process spaced repetition data if separate
                if (userData.spacedRepetition) {
                  setSpacedRepetitionData(userData.spacedRepetition);
                }
                
                // Process user topics if available
                if (userData.userTopics) {
                  setUserTopics(userData.userTopics);
                }
                
                // Process topic lists if available
                if (userData.topicLists && Array.isArray(userData.topicLists)) {
                  setTopicLists(userData.topicLists);
                  console.log("[User Info] Loaded topic lists from Knack:", userData.topicLists.length);
                }
                
                // Process topic metadata if available
                if (userData.topicMetadata && Array.isArray(userData.topicMetadata)) {
                  setTopicMetadata(userData.topicMetadata);
                  console.log("[User Info] Loaded topic metadata from Knack:", userData.topicMetadata.length);
                }
                
                // Additional logging to help with debugging
                console.log("[User Info] Successfully processed user data from Knack");
              } catch (e) {
                console.error("[User Info] Error processing userData JSON:", e);
                showStatus("Error loading your data. Loading from local storage instead.");
                loadFromLocalStorage();
              }
            } else {
              // If no user data, load from localStorage
              console.log("[User Info] No user data received, falling back to localStorage");
              loadFromLocalStorage();
            }
            
            setLoading(false);
            
            // Confirm receipt of auth info (only do this once)
            if (window.parent !== window) {
              console.log("[User Info] Sending AUTH_CONFIRMED message");
              window.parent.postMessage({ type: "AUTH_CONFIRMED" }, "*");
            }
            break;

          case "SAVE_RESULT":
            console.log("[Save Result] Received:", event.data.success);
            
            // Clear any save timeouts
            if (window.currentSaveTimeout) {
              clearTimeout(window.currentSaveTimeout);
              window.currentSaveTimeout = null;
            }
            
            setIsSaving(false);
            if (event.data.success) {
              showStatus("Saved successfully!");
            } else {
              showStatus("Error saving data. Changes saved locally.");
            }
            break;
            
          case "LOAD_SAVED_DATA":
            console.log("[Load Data] Received updated data from Knack");

            if (event.data.data) {
              try {
                // Process cards
                if (event.data.data.cards && Array.isArray(event.data.data.cards)) {
                  const restoredCards = restoreMultipleChoiceOptions(event.data.data.cards);
                  setAllCards(restoredCards);
                  updateSpacedRepetitionData(restoredCards);
                  console.log("[Load Data] Restored multiple choice options for cards");
                }

                // Process color mapping
                if (event.data.data.colorMapping) {
                  setSubjectColorMapping(safeParseJSON(event.data.data.colorMapping));
                }

                // Process spaced repetition data if separate
                if (event.data.data.spacedRepetition) {
                  setSpacedRepetitionData(safeParseJSON(event.data.data.spacedRepetition));
                }
                
                // Process user topics if available
                if (event.data.data.userTopics) {
                  setUserTopics(safeParseJSON(event.data.data.userTopics));
                }
                
                // Process topic lists if available
                if (event.data.data.topicLists) {
                  setTopicLists(safeParseJSON(event.data.data.topicLists));
                  console.log("[Load Data] Loaded topic lists:", 
                    Array.isArray(safeParseJSON(event.data.data.topicLists)) ? 
                    safeParseJSON(event.data.data.topicLists).length : 'none');
                }
                
                // Process topic metadata if available
                if (event.data.data.topicMetadata) {
                  setTopicMetadata(safeParseJSON(event.data.data.topicMetadata));
                  console.log("[Load Data] Loaded topic metadata:",
                    Array.isArray(safeParseJSON(event.data.data.topicMetadata)) ?
                    safeParseJSON(event.data.data.topicMetadata).length : 'none');
                }
                
                showStatus("Updated with latest data from server");
              } catch (error) {
                console.error("[Load Data] Error processing updated data:", error);
                showStatus("Error loading updated data");
              }
            }
            break;

          case "ADD_TO_BANK_RESULT":
            console.log("[Add To Bank Result] Received:", event.data);
            if (event.data.success) {
              showStatus("Cards added to bank successfully!");
              
              // If shouldReload flag is set, request updated data instead of full page reload
              if (event.data.shouldReload) {
                console.log("[Add To Bank Result] Requesting updated data...");
                setLoading(true);
                setLoadingMessage("Refreshing card data...");
                
                // Send a message to parent window to request updated data
                if (window.parent !== window) {
              window.parent.postMessage({
                    type: "REQUEST_UPDATED_DATA",
                    data: { recordId: recordId }
                  }, "*");
              
                  // No fallback timeout - wait for KNACK_DATA message instead
                  // The data will eventually come through even if it takes longer than 5 seconds
                } else {
                  // If we're not in an iframe, just reload from localStorage
                  loadFromLocalStorage();
              setLoading(false);
                }
              }
            } else {
              showStatus("Error adding cards to bank. Try refreshing the page.");
              
              // If there was an error, try to refresh data anyway after a short delay
              // This can help recover from temporary issues
              setTimeout(() => {
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: "REQUEST_UPDATED_DATA",
                    data: { recordId: recordId }
                  }, "*");
                  
                  console.log("[Add To Bank Result] Requested data refresh after error");
                }
              }, 2000);
            }
            break;
            
          case "TOPIC_SHELLS_CREATED":
            console.log("[Topic Shells] Created successfully:", event.data);
            showStatus(`Created ${event.data.count} topic shells!`);
            
            // If shouldReload flag is set, request updated data instead of full page reload
            if (event.data.shouldReload) {
              console.log("[Topic Shells] Requesting updated data...");
              setLoading(true);
              setLoadingMessage("Refreshing card data...");
              
              // Send a message to parent window to request updated data
              if (window.parent !== window) {
                window.parent.postMessage({
                  type: "REQUEST_UPDATED_DATA",
                  data: { recordId: recordId }
                }, "*");
                
                // No fallback timeout - wait for KNACK_DATA message instead
                // The data will eventually come through even if it takes longer than 5 seconds
              } else {
                // If we're not in an iframe, just reload from localStorage
                loadFromLocalStorage();
                setLoading(false);
              }
            }
            break;
            
          case "RELOAD_APP_DATA":
            console.log("[Reload] Explicit reload request received");
            showStatus("Refreshing data...");
            
            // Instead of reloading the whole page, use the data refresh mechanism
            if (window.parent !== window) {
              window.parent.postMessage({
                type: "REQUEST_UPDATED_DATA",
                data: { recordId: recordId }
              }, "*");
              
              console.log("[Reload] Requested updated data instead of full page reload");
              
              // Set a brief loading state but don't show full initialization screen
              setLoadingMessage("Refreshing your flashcards...");
              
              // Add a timeout to clear loading state in case no response is received
              setTimeout(() => {
                setLoading(false);
                setLoadingMessage("");
              }, 5000);
            } else {
              // If not in an iframe, refresh from localStorage
              loadFromLocalStorage();
            }
            break;

          case "REQUEST_REFRESH":
            console.log("[Refresh] App refresh requested:", event.data);
            
            // Instead of setting loading state which shows init screen,
            // just reload the data silently
            if (window.parent !== window) {
              window.parent.postMessage({
                type: "REQUEST_UPDATED_DATA",
                data: { recordId: recordId || event.data?.data?.recordId }
              }, "*");
              
              console.log("[Refresh] Requested data refresh without showing loading screen");
              
              // Add a timeout to clear loading state in case the response never comes
              setTimeout(() => {
                setLoading(false);
                setLoadingMessage("");
              }, 3000);
            } else {
              // If we're not in an iframe, just reload from localStorage
              loadFromLocalStorage();
              // Ensure we're not in loading state
              setLoading(false);
              setLoadingMessage("");
            }
            break;

          case "SAVE_OPERATION_QUEUED":
            // Data save has been queued on the server
            console.log("[Message Handler] Save operation queued");
            
            // Don't reset the saving state - keep it active
            // since we're still in the save process
            
            showStatus("Your flashcards are being saved (queued)...");
            break;

          case "SAVE_OPERATION_FAILED":
            console.error("[Message Handler] Save operation failed:", event.data.error);
            
            // Clear any save timeouts
            if (window.currentSaveTimeout) {
              clearTimeout(window.currentSaveTimeout);
              window.currentSaveTimeout = null;
            }
            
            setIsSaving(false);
            showStatus("Error saving data: " + (event.data.error || "Unknown error"));
            break;
            
          case "KNACK_DATA":
            console.log("Received data from Knack:", event.data);
            
            if (event.data.cards && Array.isArray(event.data.cards)) {
              try {
                // Restore multiple choice options if they exist
                const restoredCards = restoreMultipleChoiceOptions(event.data.cards);
                
                // Update app state with the loaded cards
                setAllCards(restoredCards);
                console.log(`Loaded ${restoredCards.length} cards from Knack and restored multiple choice options`);
                
                // Load color mapping
            if (event.data.colorMapping) {
              setSubjectColorMapping(event.data.colorMapping);
                  console.log("Loaded color mapping from Knack");
                }
                
                // Load spaced repetition data
                if (event.data.spacedRepetition) {
                  setSpacedRepetitionData(event.data.spacedRepetition);
                  console.log("Loaded spaced repetition data from Knack");
                }
                
                // Load topic lists
            if (event.data.topicLists && Array.isArray(event.data.topicLists)) {
              setTopicLists(event.data.topicLists);
                  console.log(`Loaded ${event.data.topicLists.length} topic lists from Knack`);
            }
            
                // Load topic metadata if available
            if (event.data.topicMetadata && Array.isArray(event.data.topicMetadata)) {
              setTopicMetadata(event.data.topicMetadata);
                  console.log(`Loaded ${event.data.topicMetadata.length} topic metadata entries from Knack`);
                }
                
                // Always ensure loading state is cleared
                setLoading(false);
                setLoadingMessage("");

                // Redirect back to card bank if refresh happened from AI Generator
                if (view === 'aiGenerator') {
                  console.log("[KNACK_DATA Handler] Refresh likely completed after AI generation, redirecting to cardBank.");
                  setView('cardBank');
                }

              } catch (error) {
                console.error("Error processing Knack data:", error);
                setLoading(false);
                setLoadingMessage("");
                showStatus("Error loading cards. Please refresh the page.");
              }
            }
            break;

          case "AUTH_ERROR":
            console.error("Authentication error received:", event.data.data?.message || "Unknown auth error");
            
            // Ensure loading state is cleared first
            setLoading(false);
            setLoadingMessage("");
            
            // Show error message to user
            showStatus(event.data.data?.message || "Authentication error. Please refresh the page.");
            
            // If we're in the AIGenerator view, consider returning to card bank
            if (view === "aiGenerator") {
              setTimeout(() => {
                // Give user time to see the error message before redirecting
                setView("cardBank");
              }, 3000);
            }
            break;

          case "REQUEST_TOKEN_REFRESH":
            console.log("[Token] Using AuthManager to handle token refresh");
            
            // Call our new centralized token refresh utility
            handleTokenRefreshRequest(
              recordId,
              showStatus,
              setLoading,
              loadFromLocalStorage
            ).then(success => {
              if (success) {
                console.log("[Token] Token refresh initiated successfully");
              } else {
                console.warn("[Token] Token refresh could not be initiated");
              }
            });
            break;

          case "VERIFICATION_COMPLETE":
          case "VERIFICATION_SKIPPED":
          case "VERIFICATION_FAILED":
            handleVerificationMessage(event);
            break;

          default:
            console.log("[Message Handler] Unknown message type:", event.data.type);
        }
      }
    };

    // Set up listener for messages from parent window
    window.addEventListener("message", handleMessage);

    // Track if we've sent the initial ready message
    let readyMessageSent = false;
    
    // Send ready message only once
    const sendReadyMessage = () => {
      if (!readyMessageSent && window.parent !== window) {
        window.parent.postMessage({ type: "APP_READY" }, "*");
        console.log("[Init] Sent ready message to parent");
        readyMessageSent = true;
      }
    };
    
    // Send ready message or initialize standalone mode
    if (window.parent !== window) {
      sendReadyMessage();
      } else {
      // In standalone mode, load from localStorage
      console.log("[Init] Running in standalone mode");
      setAuth({
        id: "test-user",
        email: "test@example.com",
        name: "Test User",
      });
      loadFromLocalStorage();
      setLoading(false);
    }

      return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [showStatus, updateSpacedRepetitionData, loadFromLocalStorage]);

  // Function to extract user-specific topics for a subject
  const getUserTopicsForSubject = useCallback(
    (subject) => {
      if (!subject || !auth) return [];
      
      // First check if we have user-specific topics
      if (userTopics && userTopics[subject] && Array.isArray(userTopics[subject])) {
        return userTopics[subject].sort();
      }
      
      // Fall back to extracting from cards if no user topics
      return getTopicsForSubject(subject);
    },
    [userTopics, auth, getTopicsForSubject]
  );
  
  // Function to update user topics for a specific subject
  // Removed unused updateUserTopicsForSubject useCallback

  // Handle opening the topic list modal for a subject
  const handleViewTopicList = useCallback((subject) => {
    setTopicListSubject(subject);
    setTopicListModalOpen(true);
  }, []);

  // Handle selecting a topic from the topic list modal
  const handleSelectTopicFromList = useCallback((topic) => {
    setSelectedTopic(topic);
    setTopicListModalOpen(false);
  }, []);

  // Handle generating cards directly from the topic list modal
  const handleGenerateCardsFromTopic = useCallback((topic) => {
    setSelectedTopic(topic);
    setTopicListModalOpen(false);
    setView("aiGenerator");
  }, []);

  // Add the print modal function near other helper functions
  const openPrintModal = (cardsForPrinting, title) => {
    setCardsToPrint(cardsForPrinting);
    setPrintTitle(title);
    setPrintModalOpen(true);
  };
  
  const handlePrintAllCards = () => {
    // Use the filtered cards that are currently being shown
    const cardsToDisplay = getFilteredCards();
    openPrintModal(cardsToDisplay, "All Flashcards");
  };

  // Listen for topic refresh events from TopicHub component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleTopicRefreshNeeded = () => {
      console.log("[Topic Refresh] Received topicRefreshNeeded event");
      
      // Show a brief loading message
      showStatus("Refreshing your flashcards...");
      
      // Load from localStorage first
      loadFromLocalStorage();
      
      // If in iframe mode, request fresh data from Knack
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "REQUEST_UPDATED_DATA",
          data: { recordId: recordId }
        }, "*");
        
        console.log("[Topic Refresh] Requested data refresh from parent window");
      }
    };
    
    // Add the event listener
    window.addEventListener('topicRefreshNeeded', handleTopicRefreshNeeded);
    
    // Clean up
    return () => {
      window.removeEventListener('topicRefreshNeeded', handleTopicRefreshNeeded);
    };
  }, [showStatus, loadFromLocalStorage, recordId]); // recordId is included, view is not needed

  // Filter allCards to get topic shells for the selected subject when modal is open
  const topicsForModal = (topicListModalOpen && topicListSubject) 
    ? allCards.filter(item => 
        item.type === 'topic' && 
        (item.subject || 'General') === topicListSubject
      )
    : []; // Default to empty array if modal isn't open

  // Filter allCards to get topic shells for the selected subject for AI Generator
  const topicsForAICG = (view === "aiGenerator" && selectedSubject) 
    ? allCards.filter(item => 
        item.type === 'topic' && 
        (item.subject || 'General') === selectedSubject
      )
    : [];

  // Handler for TopicHub to finalize topics and add shells to main state
  const handleFinalizeTopics = useCallback((topicShells) => {
    if (!Array.isArray(topicShells)) {
      console.error("handleFinalizeTopics received invalid data:", topicShells);
      return;
    }
    console.log("[App.js] Received finalized topic shells:", topicShells);
    
    let finalMergedItems = []; // To capture the merged state
    
    // Merge new shells with existing cards/shells in allCards
    setAllCards(prevAllCards => {
      const existingItems = Array.isArray(prevAllCards) ? prevAllCards : [];
      
      const newItems = topicShells.filter(shell => 
        !existingItems.some(existing => existing.type === 'topic' && existing.id === shell.id)
      );
      
      const updatedItems = existingItems.map(existing => {
        if (existing.type === 'topic') {
          const updatedShell = topicShells.find(shell => shell.id === existing.id);
          return updatedShell ? { ...existing, ...updatedShell } : existing; // Ensure update merges properly
        }
        return existing;
      });
      
      finalMergedItems = [...updatedItems, ...newItems]; // Update the scoped variable
      console.log(`[App.js] Merged items. Old count: ${existingItems.length}, New count: ${finalMergedItems.length}`);
      
      // Debug dump of the topic shells being added
      console.log("[CRITICAL DEBUG] Topic shells AFTER merge logic:", 
        finalMergedItems.filter(item => item.type === 'topic').map(shell => ({
          id: shell.id,
          type: shell.type,
          name: shell.name,
          subject: shell.subject
        }))
      );
      
      return finalMergedItems; // Return the merged array for state update
    });

    // Trigger an immediate save, passing the correctly merged items
    // Use setTimeout to ensure the setAllCards has likely started processing,
    // but pass the data directly to avoid relying on its completion.
    setTimeout(() => {
      console.log("[App.js] Triggering save after adding topic shells");
      // CRITICAL CHANGE: Let saveData use the current state, don't pass potentially stale data
      saveData(null, true); // Pass null for data, preserveFields = true
      showStatus("Topic shells added and save triggered.");
      
      // Keep backup save
      setTimeout(() => {
        console.log("[App.js] Trigger backup save");
        saveData(); // Backup uses current state
      }, 2000);
    }, 200); // Increased delay slightly

  }, [saveData, showStatus]); // Removed setAllCards dependency as it's used via updater function

  // Save the topic lists to Knack when they change
  const saveTopicLists = useCallback(() => {
    if (!isKnack || !recordId) return;
    
    console.log("Saving topic lists to Knack:", topicLists);
    
    // Use the saveQueueService
    saveQueueService.addToQueue({
      type: "TOPIC_LISTS_UPDATED",
      payload: {
        recordId,
        topicLists
      }
    })
    .then(() => console.log("Topic lists save queued successfully"))
    .catch(error => console.error("Error queuing topic lists save:", error));
  }, [topicLists, isKnack, recordId]);

  // Save topic metadata to Knack when it changes
  const saveTopicMetadata = useCallback(() => {
    if (!isKnack || !recordId) return;
    
    console.log("Saving topic metadata to Knack:", topicMetadata);
    
    // Use the saveQueueService
    saveQueueService.addToQueue({
      type: "TOPIC_METADATA_UPDATED",
      payload: {
        recordId,
        topicMetadata
      }
    })
    .then(() => console.log("Topic metadata save queued successfully"))
    .catch(error => console.error("Error queuing topic metadata save:", error));
  }, [topicMetadata, isKnack, recordId]);

  // Send a topic event to Knack
  const sendTopicEvent = useCallback((eventType, data) => {
    if (!isKnack || !recordId) return;
    
    console.log(`Sending topic event to Knack: ${eventType}`, data);
    
    // Use the saveQueueService
    saveQueueService.addToQueue({
      type: "TOPIC_EVENT",
      payload: {
        recordId,
        eventType,
        data
      }
    })
    .then(() => console.log("Topic event queued successfully"))
    .catch(error => console.error("Error queuing topic event:", error));
  }, [isKnack, recordId]);

  // Notify Knack of card updates
  const notifyCardUpdates = useCallback((updatedCards) => {
    if (!isKnack || !recordId) return;
    
    console.log("Notifying Knack of card updates:", updatedCards.length);
    
    // Use the saveQueueService
    saveQueueService.addToQueue({
      type: "CARDS_UPDATED",
      payload: {
        recordId,
        cards: updatedCards
      }
    })
    .then(() => console.log("Card updates notification queued successfully"))
    .catch(error => console.error("Error queuing card updates notification:", error));
  }, [isKnack, recordId]);

 // Add the function to handle saving topic shells generated by TopicCreationModal
 const handleSaveTopicShells = useCallback(async (generatedShells) => {
  if (!Array.isArray(generatedShells) || generatedShells.length === 0) {
    console.warn("[App] handleSaveTopicShells called with no shells.");
    showStatus("No topics to save.");
    return;
  }

  console.log("[App] Handling save for generated topic shells:", generatedShells);
  setIsSaving(true);
  showStatus("Saving topic list...");

  // 1. Ensure we have a record ID
  const theRecordId = await ensureRecordId();
  if (!theRecordId) {
    console.error("[App] Cannot save topic shells: Missing record ID.");
    setIsSaving(false);
    showStatus("Error: Missing record ID for saving topics.");
    return;
  }

  // 2. Group shells by subject for the Knack bridge format
  const groupBySubject = (shells) => {
    const grouped = {};
    shells.forEach(shell => {
      if (!shell || !shell.name || !shell.subject) {
         console.warn("[App] Skipping invalid shell during grouping:", shell);
         return; // Skip invalid shells
      }
      const subject = shell.subject || 'General';
      if (!grouped[subject]) {
        grouped[subject] = [];
      }
      // Pass essential shell info (name, id if available, maybe color?)
      // The bridge script primarily uses name but ID might be useful later
      const topicData = {
        name: shell.name,
        id: shell.id, // Pass ID if it exists
        // Add other relevant fields if Knack script uses them (e.g., examBoard, examType)
        examBoard: shell.examBoard,
        examType: shell.examType
      };
      grouped[subject].push(topicData);
    });
    // Convert to the array format expected by the bridge
    return Object.entries(grouped).map(([subject, topics]) => ({
      subject: subject,
      topics: topics // Array of topic objects
    }));
  };

  const groupedTopicLists = groupBySubject(generatedShells);
  console.log("[App] Grouped topic lists for Knack bridge:", groupedTopicLists);

  if (groupedTopicLists.length === 0) {
      console.warn("[App] No valid topic lists generated after grouping.");
      setIsSaving(false);
      showStatus("Error: No valid topics found to save.");
      return;
  }

  // 3. Prepare payload for SaveQueueService
  const payload = {
    recordId: theRecordId,
    topicLists: groupedTopicLists
  };

  // 4. Add to Save Queue
  console.log("[App] Adding TOPIC_LISTS_UPDATED to queue with payload:", payload);
  saveQueueService.addToQueue({
    type: 'TOPIC_LISTS_UPDATED',
    payload: payload
  })
  .then(() => {
    console.log("[App] TOPIC_LISTS_UPDATED request successfully processed by SaveQueueService.");
    setIsSaving(false);
    showStatus("Topic list saved successfully!");
    // Optionally: Trigger a data reload here if needed to reflect shells immediately
    // handleTopicRefreshNeeded(); // Or a similar function
  })
  .catch(error => {
    console.error("[App] Error in TOPIC_LISTS_UPDATED operation:", error);
    setIsSaving(false);
    showStatus("Error saving topic list: " + error.message);
  });

}, [ensureRecordId, showStatus, setIsSaving]); // Dependencies

// --- Filtered Cards Logic ---
const filteredCards = useMemo(() => {
  let filtered = [...allCards];

  if (selectedSubject) {
    filtered = filtered.filter(
      (card) => (card.subject || "General") === selectedSubject
    );
  }

  if (selectedTopic) {
    filtered = filtered.filter(
      (card) => (card.topic || "General") === selectedTopic
    );
  }

  return filtered;
}, [allCards, selectedSubject, selectedTopic]);


  // Handle case when there's no user data in local storage
  useEffect(() => {
    // Get recordId from localStorage if not already available
    if (!recordId) {
      try {
        const storedData = localStorage.getItem('flashcards_auth');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          if (parsedData && parsedData.recordId) {
            console.log("Recovered recordId from localStorage:", parsedData.recordId);
            setRecordId(parsedData.recordId);
          }
        }
      } catch (e) {
        console.error("Error reading from localStorage:", e);
      }
    }
  }, [recordId]);

  // Effect to listen for navigation to AI Generator
  useEffect(() => {
    const handleNavToAIGenerator = (event) => {
      console.log('Navigation to AI Generator requested with data:', event.detail);
      
      // Set the selected subject and topic
      if (event.detail.subject) {
        // Set the selected subject
        setSelectedSubject(event.detail.subject);
        
        // If a topic is provided, set it
        if (event.detail.topic) {
          setSelectedTopic(event.detail.topic);
        }
      }
      
      // Switch to the AI Generator view
      setView('aiGenerator');
    };
    
    // Add event listener
    window.addEventListener('navToAIGenerator', handleNavToAIGenerator);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('navToAIGenerator', handleNavToAIGenerator);
    };
  }, [setSelectedSubject, setSelectedTopic, setView]);

  // Show loading state
  if (loading) {
    return <LoadingSpinner message={loadingMessage} />;
  }

  // Show error state
  if (error) {
    return (
      <div className="app error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Refresh</button>
      </div>
    );
  }

 
  
  return (
    <WebSocketProvider> {/* Wrap the entire app content */}
      <div className="app-container">
        {loading ? (
          <LoadingSpinner message={loadingMessage} />
        ) : (
          <>
            <Header
              userInfo={getUserInfo()}
              currentView={view}
              onViewChange={setView}
              onSave={saveData}
              isSaving={isSaving}
              onPrintAll={handlePrintAllCards}
              onCreateCard={() => setCardCreationModalOpen(true)}
              currentBox={currentBox}
              onSelectBox={setCurrentBox}
              spacedRepetitionData={spacedRepetitionData}
            />
            
            {/* Temporarily hiding UserProfile */}
            {/* {auth && <UserProfile userInfo={getUserInfo()} />} */}

            {statusMessage && (
              <div className="status-message">
                <p>{statusMessage}</p>
              </div>
            )}
            
            {/* Topic List Modal */}
            
            <TopicListSyncManager
              isOpen={topicListModalOpen && topicListSubject}
              subject={topicListSubject}
              examBoard={topicListExamBoard}
              examType={topicListExamType}
              initialTopics={topicsForModal} // Pass the filtered topics
              onClose={() => setTopicListModalOpen(false)}
              onSelectTopic={handleSelectTopicFromList}
              onGenerateCards={handleGenerateCardsFromTopic}
              auth={auth}
              userId={auth?.id}
            />

            {/* ** NEW: Conditionally render TopicCreationModal ** */}
            {isTopicCreationModalOpen && (
              <TopicCreationModal
                onClose={() => setIsTopicCreationModalOpen(false)}
                onSaveTopicShells={handleSaveTopicShells} // Pass the save function
                userId={auth?.id}
                recordId={recordId}
                updateColorMapping={updateColorMapping} // Pass color mapping if needed
                existingSubjects={getSubjects().map(s => s.name)} // Pass existing subject names
                // Pass initial values if needed, e.g., from last session or defaults
                // initialExamType="GCSE"
                // initialExamBoard="AQA"
                // initialSubject=""
              />
            )}

            {view === "cardBank" && (
              <div className="card-bank-view">
                {printModalOpen && (
                  <PrintModal 
                    cards={cardsToPrint} 
                    title={printTitle} 
                    onClose={() => setPrintModalOpen(false)} 
                  />
                )}
                
                {/* Card Creation Modal */}
                {cardCreationModalOpen && (
                  <div className="modal-overlay" onClick={() => setCardCreationModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <button className="modal-close-btn" onClick={() => setCardCreationModalOpen(false)}>×</button>
                      <h2>Create Flashcards</h2>
                      <div className="modal-options">
                        <button 
                          className="primary-button"
                          onClick={() => {
                            setCardCreationModalOpen(false);
                            setView("aiGenerator");
                          }}
                        >
                          <span className="button-icon">🤖</span> Generate Cards with AI
                        </button>
                        <div className="option-divider">or</div>
                        <button 
                          className="secondary-button"
                          onClick={() => {
                            setCardCreationModalOpen(false);
                            setView("manualCreate");
                          }}
                        >
                          <span className="button-icon">✍️</span> Create Cards Manually
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bank-container full-width">
                  <div className="bank-content">
                    {/* Added header showing total card count */}
                    <div className="bank-content-header">
                      <h2>All Flashcards ({getFilteredCards().length})</h2>
                      <button 
                        className="save-icon-button" 
                        onClick={saveData} 
                        disabled={isSaving}
                        title="Save All Changes"
                      >
                        {isSaving ? '⏳' : '💾'}
                      </button>
                    </div>
                    
                    {/* Show empty state or card list based on whether there are cards */}
                    {allCards.length === 0 ? (
                      <div className="empty-card-bank">
                        <h3>No Flashcards Yet</h3>
                        {/* ** MODIFIED TEXT ** */}
                        <p>Start by adding your subjects and topic lists.</p>
                        {/* ** MODIFIED BUTTON ** */}
                        <button 
                          className="primary-button" 
                          onClick={() => setIsTopicCreationModalOpen(true)} // Open the new modal
                        >
                          Create Topic Lists
                        </button>
                      </div>
                    ) : (
                      <FlashcardList 
                        cards={filteredCards} // Use filtered cards if filtering is implemented
                        onDeleteCard={deleteCard}
                        onUpdateCard={updateCard}
                        onViewTopicList={(subject) => { /* Logic to show topic list modal */ }}
                        recordId={recordId}
                        onUpdateSubjectColor={updateColorMapping}
                        subjectColorMapping={subjectColorMapping}
                        handleSaveTopicShells={handleSaveTopicShells} // Pass the new function
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {view === "manualCreate" && (
              <div className="create-card-container">
                <CardCreator
                  onAddCard={addCard}
                  onCancel={() => setView("cardBank")}
                  subjects={getSubjects()}
                  getTopicsForSubject={getUserTopicsForSubject}
                  currentColor={currentSubjectColor}
                  onColorChange={setCurrentSubjectColor}
                  getColorForSubjectTopic={getColorForSubjectTopic}
                  updateColorMapping={updateColorMapping}
                />
              </div>
            )}

            {view === "aiGenerator" && (
              <AICardGenerator
                onAddCard={addCard}
                onClose={() => setView("cardBank")}
                subjects={getSubjects()}
                auth={auth}
                userId={auth?.id}
                initialSubject={selectedSubject}
                initialTopic={selectedTopic}
                initialTopicsProp={topicsForAICG}
                examBoard={topicListExamBoard}
                examType={topicListExamType}
                recordId={recordId}
                onFinalizeTopics={handleFinalizeTopics}
              />
            )}

            {view === "spacedRepetition" && (
              <SpacedRepetition
                cards={getCardsForCurrentBox()}
                currentBox={currentBox}
                spacedRepetitionData={spacedRepetitionData}
                onSelectBox={setCurrentBox}
                onMoveCard={moveCardToBox}
                onReturnToBank={() => setView("cardBank")}
              />
            )}
          </>
        )}
      </div>
    </WebSocketProvider>
  );
}

export default App;
