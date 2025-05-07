import saveQueueService from './services/SaveQueueService';
import { initializeAppGlobals } from './services/AppLoaderInit';
import { prepareKnackSaveData } from './utils/KnackAuthUpdates';
import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from "react";
import "./App.css";
import FlashcardList from "./components/FlashcardList";
import CardCreator from "./components/CardCreator";
import SpacedRepetition from "./components/SpacedRepetition";
import LoadingSpinner from "./components/LoadingSpinner";
import Header from "./components/Header";
import AICardGenerator from './components/AICardGenerator';
import CardGeneratorConnector from './components/CardGeneratorConnector';
import FlashcardGeneratorBridge from './components/FlashcardGeneratorBridge';
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

import {
  getRandomColor,
  generateShade,
  ensureValidColorMapping,
  BRIGHT_COLORS // Import BRIGHT_COLORS
} from './utils/ColorUtils';


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

function App() {
  // Authentication and user state
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [error, /* Removed unused setError */ ] = useState(null);
  const [recordId, setRecordId] = useState(null);

  // App view state
  const [view, setView] = useState("cardBank"); // cardBank, createCard, spacedRepetition

  const appInstanceRef = useRef(null);
  const localStorageDataTimestampRef = useRef(null); // For storing timestamp of localStorage data

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
  
  // ** NEW STATE for direct flashcard generation **
  const [showFlashcardBridge, setShowFlashcardBridge] = useState(false);
  const [bridgeTopicData, setBridgeTopicData] = useState(null);

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
  }, [allCards, subjectColorMapping, spacedRepetitionData, userTopics, topicLists, topicMetadata]);

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

  // Proper implementation of loadCombinedData to ensure topics are correctly loaded
  const loadCombinedData = useCallback(async (source = 'auto') => {
      setLoading(true);
      setLoadingMessage(`Loading data from ${source}...`);
      console.log(`[App Load] Starting data load from ${source}`, {timestamp: new Date().toISOString()});
      
      try {
          // Step 1: Load the data from the appropriate source
          let loadedData;
          let fromKnack = false;
          
          if (source === 'knack' && isKnack) {
              // If data is coming from Knack, use cached data from message handlers
              console.log("[App Load] Loading from Knack data cache");
              // This data would have been provided through message handlers
              fromKnack = true;
              
              if (window.knackLoadedData) {
                  loadedData = window.knackLoadedData;
                  console.log("[App Load] Using cached Knack data:", { cardCount: loadedData.cards?.length });
              } else {
                  console.warn("[App Load] No cached Knack data available, falling back to localStorage");
                  loadedData = localStorageHelpers.loadData('flashcards_app');
              }
          } else {
              // Otherwise load from localStorage
              console.log("[App Load] Loading from localStorage");
              loadedData = localStorageHelpers.loadData('flashcards_app');
          }
          
          // Step 2: Process the loaded data
          if (loadedData) {
              console.log("[App Load] Processing loaded data:", { 
                  cardCount: loadedData.cards?.length,
                  topicListCount: loadedData.topicLists?.length || 0,
                  source: fromKnack ? 'knack' : 'localStorage'
              });
              
              // Step 3: Update state with loaded data
              // First set cards - important to do this before topics for relationships
              const processedCards = restoreMultipleChoiceOptions(loadedData.cards || []);
              setAllCards(processedCards);
              
              // Update color mappings
              setSubjectColorMapping(loadedData.colorMapping || {});
              
              // Update spaced repetition data and regenerate if needed
              if (loadedData.spacedRepetition) {
                  setSpacedRepetitionData(loadedData.spacedRepetition);
              } else {
                  // Regenerate spaced repetition data from cards if missing
                  updateSpacedRepetitionData(processedCards);
              }
              
              // Update user topics
              setUserTopics(loadedData.userTopics || {});
              
              // Process topic lists with proper reconstruction of relationships
              const topicLists = loadedData.topicLists || [];
              console.log(`[App Load] Processing ${topicLists.length} topic lists`);
              
              // Log each topic list for debugging
              topicLists.forEach((list, index) => {
                  console.log(`[App Load] Topic list ${index + 1}: ${list.subject} with ${list.topics?.length || 0} topics`);
              });
              
              // Update topic lists state
              setTopicLists(topicLists);
              
              // Update topic metadata
              setTopicMetadata(loadedData.topicMetadata || []);
              
              // Reconcile and verify topics match shells
              const reconcileTopics = () => {
                  const topicShells = processedCards.filter(card => card.type === 'topic' && card.isShell);
                  console.log(`[App Load] Reconciling ${topicShells.length} topic shells with ${topicLists.length} topic lists`);
                  
                  // Ensure all topic shells have matching entries in topicLists
                  // This is a critical step to fix the subject overwriting issue
                  const subjectMap = new Map();
                  
                  // Group existing topic lists by subject
                  topicLists.forEach(list => {
                      if (list.subject) {
                          subjectMap.set(list.subject, list);
                      }
                  });
                  
                  // Group topic shells by subject
                  const shellsBySubject = new Map();
                  topicShells.forEach(shell => {
                      const subject = shell.subject || 'General';
                      if (!shellsBySubject.has(subject)) {
                          shellsBySubject.set(subject, []);
                      }
                      shellsBySubject.get(subject).push(shell);
                  });
                  
                  // Create topic lists for any shells that don't have them
                  shellsBySubject.forEach((shells, subject) => {
                      if (!subjectMap.has(subject) && shells.length > 0) {
                          console.log(`[App Load] Creating missing topic list for subject: ${subject} with ${shells.length} shells`);
                          
                          // Create a new topic list for this subject
                          const newTopicList = {
                              subject,
                              topics: shells.map(shell => ({
                                  id: shell.id,
                                  name: shell.name,
                                  examBoard: shell.examBoard || '',
                                  examType: shell.examType || '',
                                  color: shell.color || '#cccccc',
                                  subjectColor: subjectColorMapping[subject]?.base || '#3cb44b'
                              })),
                              color: subjectColorMapping[subject]?.base || '#3cb44b'
                          };
                          
                          // Add to topic lists
                          setTopicLists(prev => [...prev, newTopicList]);
                          subjectMap.set(subject, newTopicList);
                      }
                  });
              };
              
              // Run topic reconciliation after a short delay to ensure state is updated
              setTimeout(reconcileTopics, 500);
              
              // Store the timestamp of the loaded localStorage data
              if (loadedData.success && loadedData.data?.metadata?.timestamp) {
                localStorageDataTimestampRef.current = loadedData.data.metadata.timestamp;
                console.log('[App Load] Stored localStorage timestamp:', localStorageDataTimestampRef.current);
              } else {
                localStorageDataTimestampRef.current = null; // Reset if no valid timestamp from this load
              }
              
              console.log("[App Load] Data loading complete from " + source);
          } else {
              console.log("[App Load] No data found in " + source);
              localStorageDataTimestampRef.current = null; // No data, no timestamp
              setAllCards([]);
              setSubjectColorMapping({});
              setTopicLists([]);
              setUserTopics({});
          }
      } catch (error) {
          console.error("[App Load] Error loading data:", error);
          showStatus("Error loading data. Using default empty state.");
          setAllCards([]);
          setSubjectColorMapping({});
      } finally {
          setLoading(false);
          setLoadingMessage("");
      }
  }, [
      setAllCards, 
      setSubjectColorMapping, 
      setSpacedRepetitionData, 
      setUserTopics, 
      setTopicLists, 
      setTopicMetadata, 
      setLoading, 
      setLoadingMessage, 
      isKnack, 
      updateSpacedRepetitionData,
      showStatus
  ]);

  // Modify the saveData function to use the ensureRecordId function
  const saveData = useCallback(async (data, preserveFields = false) => {
    // --- FIX: Add check for recordId at the very beginning ---
    const currentRecordId = recordId || (auth && auth.recordId); // Get ID from state or auth object
    if (!currentRecordId && isKnack) { // Only block Knack save if ID is missing
        console.error("[App] saveData ABORTED: Cannot save to Knack - recordId is missing.");
        showStatus("Save Error: Missing user record ID. Please refresh.");
        setIsSaving(false); // Ensure saving state is reset
        return; // Stop execution
    }
    // --- End Fix ---

    console.log("[App] saveData triggered. IsKnack:", isKnack);
    if (!auth) {
      console.warn("[App] No auth, saving locally only");
      saveToLocalStorage();
      setIsSaving(false);
      return;
    }
    if (isSaving) {
      console.log("[Save] Already saving, skipping.");
      showStatus("Save in progress...");
      return;
    }

    setIsSaving(true);
    saveToLocalStorage(); // Save locally first

    if (isKnack) {
      let safeRecordId = currentRecordId || await ensureRecordId();
      if (!safeRecordId) {
        console.error("[Save] No record ID, cannot save to Knack");
        setIsSaving(false);
        showStatus("Error: Missing record ID");
        return;
      }

      const dataToSave = data || {
        cards: allCards,
        colorMapping: subjectColorMapping, // Corrected name
        spacedRepetition: spacedRepetitionData, // Corrected name
        userTopics,
        topicLists,
        topicMetadata
      };

      const safeSerializeData = (sourceData) => {
          // ... (safe serialization logic) ...
           try {
             if (!sourceData) return Array.isArray(sourceData) ? [] : {}; // Handle null/undefined
             // Basic check for circular refs - not foolproof
             JSON.stringify(sourceData);
             return JSON.parse(JSON.stringify(sourceData)); // Deep clone
           } catch (e) {
              console.error("[Save] Serialization error:", e, "Data:", sourceData);
              return Array.isArray(sourceData) ? [] : {};
           }
      };

       // Prepare payload carefully
       const cardsPayload = safeSerializeData(dataToSave.cards || allCards || []);
       // Use ensureValidColorMapping to normalize the color mapping structure
       const colorMapPayload = safeSerializeData(
         ensureValidColorMapping(dataToSave.colorMapping || subjectColorMapping || {})
       );
       const spacedRepPayload = safeSerializeData(dataToSave.spacedRepetition || spacedRepetitionData || { box1:[], box2:[], box3:[], box4:[], box5:[] });
       const userTopicsPayload = safeSerializeData(dataToSave.userTopics || userTopics || {});
       const topicListsPayload = safeSerializeData(dataToSave.topicLists || topicLists || []);
       const topicMetaPayload = safeSerializeData(dataToSave.topicMetadata || topicMetadata || []);

       let safeData = {
        recordId: safeRecordId,
        cards: cardsPayload,
        colorMapping: colorMapPayload,
        spacedRepetition: spacedRepPayload,
        userTopics: userTopicsPayload,
        topicLists: topicListsPayload,
        topicMetadata: topicMetaPayload,
        preserveFields: preserveFields
     };
     
     // Apply enhanced encoding for multi-subject support
     safeData = prepareKnackSaveData(safeData);

     // <<< NEW LOGGING START >>>
     try {
       console.log('[SaveData DEBUG] Preparing to queue SAVE_DATA. Data snapshot:', JSON.stringify({
         recordId: safeRecordId,
         cardsCount: (dataToSave.cards || allCards || []).length,
         colorsKeys: Object.keys(dataToSave.colorMapping || subjectColorMapping || {}),
         box1Count: (dataToSave.spacedRepetition?.box1 || spacedRepetitionData?.box1 || []).length,
         box2Count: (dataToSave.spacedRepetition?.box2 || spacedRepetitionData?.box2 || []).length,
         // ... add other box counts if needed ...
         topicListsCount: (dataToSave.topicLists || topicLists || []).length,
         topicMetadataCount: (dataToSave.topicMetadata || topicMetadata || []).length,
         preserveFields: preserveFields
       }, null, 2)); // Pretty print for readability
     } catch(e) {
        console.error('[SaveData DEBUG] Error logging data snapshot:', e);
     }
     // <<< NEW LOGGING END >>>

      console.log(`[Save] Sending data to Knack. Payload size: ${safeData.cards?.length} items.`);

      const saveTimeout = setTimeout(() => {
          console.log("[Save] Timeout waiting for SAVE_RESULT");
          if (window.currentSaveTimeout === saveTimeout) { // Check if it's still the current timeout
              setIsSaving(false);
              showStatus("Save status unknown");
          }
      }, 15000);
      window.currentSaveTimeout = saveTimeout;

      // Add verification after saves to confirm colors were properly saved
      const verifySave = (originalMapping) => {
        setTimeout(() => {
          // Compare what we have in state now vs what we tried to save
          const currentMapping = subjectColorMapping;
          const discrepancies = [];
          
          // Check each subject
          Object.keys(originalMapping).forEach(subject => {
            if (!currentMapping[subject]) {
              discrepancies.push(`Subject ${subject} is missing after save`);
            } else if (typeof currentMapping[subject] !== typeof originalMapping[subject]) {
              discrepancies.push(`Subject ${subject} has wrong type after save`);
            } else if (currentMapping[subject].base !== originalMapping[subject].base) {
              discrepancies.push(`Subject ${subject} base color changed unexpectedly`);
            }
            
            // Check topics too if topics object exists
            if (originalMapping[subject].topics && currentMapping[subject]?.topics) {
              Object.keys(originalMapping[subject].topics).forEach(topic => {
                if (!currentMapping[subject].topics[topic]) {
                  discrepancies.push(`Topic ${topic} for subject ${subject} is missing after save`);
                } else if (currentMapping[subject].topics[topic] !== originalMapping[subject].topics[topic]) {
                  discrepancies.push(`Topic ${topic} for subject ${subject} color changed unexpectedly`);
                }
              });
            }
          });
          
          if (discrepancies.length > 0) {
            console.error("Save verification failed:", discrepancies);
            // Retry save with increased delay if verification fails
            setTimeout(() => saveData(null, true), 2000);  // Even longer timeout for retry
          } else {
            console.log("Save verification passed!");
          }
        }, 2000); // Check 2 seconds after save
      };
      
      // Capture the original mapping before sending to Knack
      const originalMapping = JSON.parse(JSON.stringify(subjectColorMapping));

      saveQueueService.addToQueue({ type: 'SAVE_DATA', payload: safeData })
        .then(() => {
          console.log("[App] SAVE_DATA processed successfully.");
          if (window.currentSaveTimeout === saveTimeout) clearTimeout(saveTimeout);
          setIsSaving(false);
          showStatus("Saved successfully!");
          // --- REMOVE STATE UPDATES HERE --- 
          // The state should already be correct due to direct updates
          // in functions like updateColorMapping, addCard, etc.
          // Reloading state from potentially stale payloads here causes overwrites.
          // console.log("[App] Updating local state after successful save...");
          // setAllCards(cardsPayload);
          // setSubjectColorMapping(colorMapPayload);
          // setSpacedRepetitionData(spacedRepPayload);
          // setUserTopics(userTopicsPayload);
          // setTopicLists(topicListsPayload);
          // setTopicMetadata(topicMetaPayload);
          // --- END REMOVAL ---
          
          // Verify color mapping was saved correctly
          verifySave(originalMapping);
        })
        .catch(error => {
          console.error("[App] Error in SAVE_DATA:", error);
          if (window.currentSaveTimeout === saveTimeout) clearTimeout(saveTimeout);
          setIsSaving(false);
          showStatus("Error saving data: " + error.message);
        });
    } else {
      // Standalone mode
      setIsSaving(false);
      showStatus("Saved to browser storage");
       // No refresh needed usually, state updates suffice. If needed: loadCombinedData('localStorage');
    }
  }, [auth, recordId, allCards, subjectColorMapping, spacedRepetitionData, userTopics, topicLists, topicMetadata, isSaving, saveToLocalStorage, showStatus, ensureRecordId, loadCombinedData]);

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
    (subject, topic, color, applyToTopics = false) => {
      if (!subject) return;
      
      // If color is null, use a default color or generate one
      const colorToUse = color || getRandomColor();
      console.log(`Updating color for subject: ${subject}, topic: ${topic || "none"}, color: ${colorToUse}, applyToTopics: ${applyToTopics}`);
      
      // CRITICAL: Use functional state update to ensure we're working with latest state
      setSubjectColorMapping((prevMapping) => {
        // Always ensure valid structure by creating deep clone
        const newMapping = JSON.parse(JSON.stringify(prevMapping || {}));
        
        // Normalize the color mapping structure for this subject
        if (!newMapping[subject]) {
          newMapping[subject] = { base: colorToUse, topics: {} };
        } else if (typeof newMapping[subject] === 'string') {
          // Convert legacy string format to object format
          const baseColor = newMapping[subject];
          newMapping[subject] = { base: baseColor, topics: {} };
        } else if (!newMapping[subject].topics) {
          // Ensure topics object exists
          newMapping[subject].topics = {};
        }

        // Subject-level or apply-to-topics update
        if (!topic || applyToTopics) {
          // Update the base subject color
          newMapping[subject].base = colorToUse;
          
          // Update topic colors if requested
          if (applyToTopics) {
            // Get all topics for this subject
            const topicsForSubject = [...new Set(
              allCards
                .filter(card => (card.subject || "General") === subject)
                .map(card => card.topic || "General")
                .filter(Boolean)
            )];
            
            // Generate a shade for each topic
            topicsForSubject.forEach((topicName, index) => {
              if (topicName !== "General") {
                const shade = generateShade(
                  colorToUse, 
                  index, 
                  topicsForSubject.length
                );
                newMapping[subject].topics[topicName] = shade;
              }
            });
          }
        } 
        // Topic-level update
        else if (topic) {
          newMapping[subject].topics[topic] = colorToUse;
        }
        
        return newMapping;
      });
      
      // Update card colors to match the topic colors
      if (topic || applyToTopics) {
        setAllCards(prevCards => 
          prevCards.map(card => {
            if (card.subject === subject) {
              if (!topic && applyToTopics) {
                // Update all cards for this subject with their topic colors
                const topicColor = card.topic && card.topic !== "General" 
                  ? subjectColorMapping[subject]?.topics?.[card.topic] 
                  : colorToUse;
                return { ...card, topicColor: topicColor || colorToUse };
              } else if (topic && card.topic === topic) {
                // Update specific topic cards
                return { ...card, topicColor: colorToUse };
              }
            }
            return card;
          })
        );
      }
      
      // CRITICAL: Increase both timeout durations
      // Save to localStorage with small delay to ensure state update has been processed
      setTimeout(() => saveToLocalStorage(), 100);
      
      // Increase Knack save delay significantly to ensure state is fully updated
      setTimeout(() => saveData(null, true), 1000);  // true = preserveFields
    },
    [generateShade, getRandomColor, saveData, saveToLocalStorage, allCards, subjectColorMapping]
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
  // Add a new card - improved to work with both topics and cards
  const addCard = useCallback(
    (card) => {
      console.log("[App.addCard] Adding card:", { id: card.id, type: card.type, subject: card.subject, topic: card.topic });
      
      if (!card || !card.id) {
        console.error("[App.addCard] Invalid card object:", card);
        showStatus("Error: Invalid card data");
        return;
      }
      
      // Special handling for topic shells vs actual cards
      if (card.type === 'topic' && card.isShell) {
        console.log("[App.addCard] Adding topic shell:", card.name);
        setAllCards((prevCards) => {
          const filteredCards = prevCards.filter(existingCard => 
            !(existingCard.type === 'topic' && existingCard.isShell && existingCard.id === card.id)
          );
          return [...filteredCards, {...card}];
        });
      } else {
        console.log("[App.addCard] Adding flashcard to topic:", card.topic);
        
        const nowISO = new Date().toISOString();
        const reviewDateForNewCard = new Date(new Date().setUTCHours(0,0,0,0) - 1).toISOString(); // Explicitly 1ms before current UTC day start

        const cardWithSpacedRep = {
          ...card,
          boxNum: 1,
          lastReviewed: nowISO,
          nextReviewDate: reviewDateForNewCard, 
          type: card.type || 'flashcard'
        };
        
        setAllCards((prevCards) => {
          const newCards = [...prevCards];
          if (card.topicId) {
            const topicShellIndex = newCards.findIndex(c => 
              c.type === 'topic' && c.isShell && c.id === card.topicId
            );
            if (topicShellIndex >= 0) {
              newCards[topicShellIndex] = {
                ...newCards[topicShellIndex],
                isEmpty: false,
                updatedAt: new Date().toISOString()
              };
            }
          }
          return [...newCards, cardWithSpacedRep];
        });
        
        setSpacedRepetitionData((prevData) => {
          const newData = { ...prevData };
          newData.box1.push({
            cardId: cardWithSpacedRep.id,
            lastReviewed: nowISO, 
            nextReviewDate: reviewDateForNewCard // Use the same explicitly calculated date
          });
          return newData;
        });
        
        if (card.subject && card.cardColor) {
          updateColorMapping(card.subject, card.topic, card.cardColor);
        }
      }
      
      setTimeout(() => saveData(), 300);
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

      const calculateNextReviewDate = (boxNumber) => {
        const now = new Date(); 
        let nextDateUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); // Start of current UTC day

        switch (boxNumber) {
          case 1:
            // Set review for the START of the NEXT UTC day (minus 1ms)
            nextDateUTC.setUTCDate(nextDateUTC.getUTCDate() + 1); 
            nextDateUTC.setUTCMilliseconds(nextDateUTC.getUTCMilliseconds() - 1);
            break;
          case 2: 
            nextDateUTC.setUTCDate(nextDateUTC.getUTCDate() + 2); 
            break;
          case 3: 
            nextDateUTC.setUTCDate(nextDateUTC.getUTCDate() + 3);
            break;
          case 4: 
            nextDateUTC.setUTCDate(nextDateUTC.getUTCDate() + 7);
            break;
          case 5: 
            nextDateUTC.setUTCDate(nextDateUTC.getUTCDate() + 28);
            break;
          default: // Fallback (shouldn't happen for boxes 1-5)
            nextDateUTC.setUTCDate(nextDateUTC.getUTCDate() + 1); 
        }
        
        // Return the calculated UTC date as an ISO string
        return nextDateUTC.toISOString(); 
      };

      const stringCardId = String(cardId).trim();
      const newNextReviewDateCalculated = calculateNextReviewDate(box); // Calculate once
      const nowISOForMove = new Date().toISOString(); // Define once for this move

      // <<< NEW LOGGING START >>>
      console.log(`[MoveCard DEBUG] Card ID: ${stringCardId}, Target Box: ${box}, Calculated Next Review: ${newNextReviewDateCalculated}`);
      // <<< NEW LOGGING END >>>

      setSpacedRepetitionData((prevData) => {
        const newData = { ...prevData };
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
        const targetBox = `box${box}`;
        newData[targetBox].push({
          cardId: stringCardId,
          lastReviewed: nowISOForMove, // Use consistent timestamp for this operation
          nextReviewDate: newNextReviewDateCalculated // Use the pre-calculated date
        });
        setKnackFieldsNeedUpdate(true);
        return newData;
      });
      
      setAllCards(prevCards => {
        // <<< NEW LOGGING START >>>
        const cardBeforeUpdate = prevCards.find(card => String(card.id).trim() === stringCardId);
        console.log(`[MoveCard DEBUG] Card ${stringCardId} state BEFORE update:`, JSON.stringify({ boxNum: cardBeforeUpdate?.boxNum, nextReviewDate: cardBeforeUpdate?.nextReviewDate, isReviewable: cardBeforeUpdate?.isReviewable }));
        // <<< NEW LOGGING END >>>
        return prevCards.map(card => {
          if (String(card.id).trim() === stringCardId) {
            // const newNextReviewDate = calculateNextReviewDate(box); // Already calculated
            const todayUTC = new Date();
            todayUTC.setUTCHours(0,0,0,0);
            const updatedCardData = { // Define updatedCardData here
              ...card,
              boxNum: box,
              nextReviewDate: newNextReviewDateCalculated, // Use the pre-calculated date
              lastReviewed: nowISOForMove, // Use consistent timestamp
              isReviewable: new Date(newNextReviewDateCalculated) <= todayUTC 
            };
            // <<< NEW LOGGING MOVED HERE >>>
            console.log(`[MoveCard DEBUG] Card ${stringCardId} state AFTER update:`, JSON.stringify({ boxNum: updatedCardData.boxNum, nextReviewDate: updatedCardData.nextReviewDate, isReviewable: updatedCardData.isReviewable }));
            // <<< END LOGGING >>>
            return updatedCardData;
          }
          return card;
        });
      });

      // ***** NEW: Call saveToLocalStorage more immediately *****
      // Use a microtask (Promise.resolve().then()) to ensure the state updates
      // have likely been processed by React before saveToLocalStorage reads them.
      Promise.resolve().then(() => {
        console.log("[MoveCard DEBUG] Attempting immediate saveToLocalStorage after state updates.");
        saveToLocalStorage(); // This will use the `allCards` and `spacedRepetitionData` state variables from App's scope
      });
      // *********************************************************
      
      setTimeout(() => saveData(), 200); // Slightly increase delay for full save
      console.log(`Card ${cardId} moved to box ${box}`);
    },
    [saveData, saveToLocalStorage] // Added saveToLocalStorage to dependencies
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

// Define handleSaveTopicShellsAndRefresh before it's used
const handleSaveTopicShellsAndRefresh = useCallback(async (topicShells, isRegeneration = false) => {
    if (!topicShells || topicShells.length === 0) return;
    console.log(`[App handleSaveTopicShellsAndRefresh] Function called directly, shells: ${topicShells?.length || 0}`);

    try {
        // 1. Extract and ensure we have the subject information from these shells
        const subject = topicShells[0]?.subject || "General";
        console.log(`[App handleSaveTopicShellsAndRefresh] Processing shells for subject: ${subject}`);

        // 2. Use the IDs provided by the component, but ensure they're unique
        // We'll assume the IDs from TopicCreationModal already have subject prefixes
        const itemsToSave = topicShells.map((shell) => {
            // Ensure each shell has the proper metadata
            return {
                ...shell,
                id: shell.id, // Keep original ID which should already be unique
                timestamp: new Date().toISOString(),
                type: 'topic',
                isShell: true,
                regenerate: isRegeneration,
                // Ensure the subject is explicitly set
                subject: subject
            };
        });

        // 3. Get the current cards and topicLists states
        const currentCards = [...allCards];
        const currentTopicLists = [...topicLists];

        // 4. Create filtered arrays for each subject - CRITICAL FIX
        // First, separate cards for the current subject
        const thisSubjectCards = currentCards.filter(card => 
            (card.subject || "General") === subject && 
            (card.type !== 'topic' || !card.isShell)
        );
        
        const thisSubjectShells = currentCards.filter(card => 
            (card.subject || "General") === subject && 
            card.type === 'topic' && 
            card.isShell
        );
        
        // This is the key fix - preserve cards from OTHER subjects
        const otherSubjectItems = currentCards.filter(card => 
            (card.subject || "General") !== subject
        );
        
        console.log(`[App handleSaveTopicShellsAndRefresh] Current card counts by type:
            - This subject cards: ${thisSubjectCards.length}
            - This subject shells: ${thisSubjectShells.length}
            - Other subjects items: ${otherSubjectItems.length}
            - New shells to add: ${itemsToSave.length}`);

        // 5. Create a set of topic IDs to check for duplicates
        const newShellIds = new Set(itemsToSave.map(shell => shell.id));
        
        // 6. Keep existing shells for this subject that aren't being replaced
        const remainingShells = thisSubjectShells.filter(shell => !newShellIds.has(shell.id));
        
        // 7. Build the final cards array, preserving all other subjects completely
        const updatedCardsPayload = [
            ...otherSubjectItems,       // Cards from other subjects (unchanged)
            ...thisSubjectCards,        // Regular cards for this subject (unchanged)
            ...remainingShells,         // Existing shells for this subject that aren't replaced
            ...itemsToSave              // New shells for this subject
        ];
        
        console.log(`[App handleSaveTopicShellsAndRefresh] Final merged cards payload count: ${updatedCardsPayload.length}`);

        // 8. Update the topic lists - CRITICAL FIX FOR TOPIC LISTS
        const topicListEntries = itemsToSave.map(shell => ({
            id: shell.id,
            name: shell.name || shell.topic || "Unknown Topic",
            examBoard: shell.examBoard || '',
            examType: shell.examType || '',
            color: shell.color || '#cccccc',
            subjectColor: shell.subjectColor || subjectColorMapping[subject]?.base || '#3cb44b'
        }));
        
        // Find existing topic list for this subject
        const existingListIndex = currentTopicLists.findIndex(list => list.subject === subject);
        let updatedTopicLists = [];
        
        if (existingListIndex >= 0) {
            // Update existing topic list for this subject
            updatedTopicLists = [...currentTopicLists];
            
            // Keep track of existing topic IDs to avoid duplicates
            const existingTopicIds = new Set(updatedTopicLists[existingListIndex].topics?.map(t => t.id) || []);
            
            // Add new topics to existing list, avoiding duplicates
            const updatedTopics = [...(updatedTopicLists[existingListIndex].topics || [])];
            
            // Filter out any existing topics that are being replaced
            const filteredTopics = updatedTopics.filter(topic => !newShellIds.has(topic.id));
            
            // Add the new topic entries
            updatedTopicLists[existingListIndex] = {
                ...updatedTopicLists[existingListIndex],
                topics: [...filteredTopics, ...topicListEntries]
            };
            
            console.log(`[App handleSaveTopicShellsAndRefresh] Updated existing topic list for ${subject} with ${topicListEntries.length} new entries`);
        } else {
            // Create a new topic list for this subject
            updatedTopicLists = [
                ...currentTopicLists,
                {
                    subject,
                    topics: topicListEntries,
                    color: subjectColorMapping[subject]?.base || getRandomColor()
                }
            ];
            
            console.log(`[App handleSaveTopicShellsAndRefresh] Added new topic list for subject: ${subject}`);
        }
        
        console.log(`[App handleSaveTopicShellsAndRefresh] Final topic lists count: ${updatedTopicLists.length}`);

        // 9. Save the data - First update local state
        setAllCards(updatedCardsPayload);
        setTopicLists(updatedTopicLists);
            
        // 10. Then save to storage/backend
        console.log(`[App handleSaveTopicShellsAndRefresh] Calling saveData with ${updatedCardsPayload.length} total items`);
        await saveData({
            cards: updatedCardsPayload,
            colorMapping: subjectColorMapping,
            spacedRepetition: spacedRepetitionData,
            userTopics: userTopics,
            topicLists: updatedTopicLists,
            topicMetadata: topicMetadata
        }, true); // preserveFields=true to ensure other data is preserved
         // Make the window.App reference available globally if it isn't already
        if (window.App) {
          window.App.handleSaveTopicShellsAndRefresh = handleSaveTopicShellsAndRefresh;
          console.log("[App handleSaveTopicShellsAndRefresh] Refreshed global handler reference");
        } 
   
        console.log("[App handleSaveTopicShellsAndRefresh] saveData call completed successfully");
        showStatus("Topics saved successfully!");
            
    } catch (error) {
      console.error("[App handleSaveTopicShellsAndRefresh] Error details:", error);
      // Attempt to fix window.App reference if it was lost
      if (window.App) {
        window.App.handleSaveTopicShellsAndRefresh = handleSaveTopicShellsAndRefresh;
      }
    }
}, [allCards, saveData, showStatus, subjectColorMapping, getRandomColor, spacedRepetitionData, userTopics, topicLists, topicMetadata, setTopicLists, setAllCards]);

// Now add the event listener for fallback topic shell saving
useEffect(() => {
  const handleFallbackShellSave = (event) => {
    if (event.detail && Array.isArray(event.detail.shells)) {
      console.log("[App] Received fallback saveTopicShells event");
      handleSaveTopicShellsAndRefresh(event.detail.shells);
    }
  };
  
  window.addEventListener('saveTopicShells', handleFallbackShellSave);
  
  return () => {
    window.removeEventListener('saveTopicShells', handleFallbackShellSave);
  };
}, [handleSaveTopicShellsAndRefresh]); // Include in dependencies

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
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0); // Start of current day in UTC
    
    // Map the IDs to the actual card objects
    const cardsForBox = [];
    
    // Process each item in the box
    for (const boxItem of boxItems) {
      // Get the ID and review date info
      let cardId, nextReviewDate, isReviewable = true;
      
      if (typeof boxItem === 'string') {
        // If it's just a string ID without review date, assume it's reviewable
        cardId = boxItem;
        nextReviewDate = null; // Will evaluate to true against todayUTC if !card.nextReviewDate
        isReviewable = true; // Explicitly true
      } else if (boxItem && typeof boxItem === 'object') {
        // If it has review date info
        cardId = boxItem.cardId;
        
        if (boxItem.nextReviewDate) {
          try {
            nextReviewDate = new Date(boxItem.nextReviewDate);
            // Card is reviewable if the next review date is today or earlier (UTC comparison)
            isReviewable = nextReviewDate <= todayUTC;
          } catch (e) {
            console.warn(`Invalid date format for nextReviewDate: ${boxItem.nextReviewDate}`);
            nextReviewDate = null;
            isReviewable = true; // Fallback to reviewable if date is invalid
          }
        } else {
          // No nextReviewDate means it should be reviewable (e.g. new card error state or legacy)
          isReviewable = true;
          nextReviewDate = null;
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
        // Ensure isReviewable from the boxItem logic (which now uses UTC) is authoritative here
        const cardWithReviewInfo = {
          ...matchingCard,
          isReviewable, // This is the key part, determined by UTC comparison
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
            const authDataFromKnack = { // Renamed to avoid confusion
              ...event.data.data,
              ...userStudentData
            };
            
            // Set auth state for React components
            setAuth(authDataFromKnack);
            
            // Initialize the centralized AuthManager with the same data
            initializeAuthManager(authDataFromKnack);
            console.log("[User Info] Initialized AuthManager with user data from Knack.");

            // If user data (the JSON blob) was included, process it with timestamp comparison
            // If user data (the JSON blob) was included, process it with timestamp comparison
            if (event.data.data?.userData) {
              const knackPayload = event.data.data; // This is the `data` part of the message
              const knackUserDataBlob = safeParseJSON(knackPayload.userData); // This is the stringified JSON content
              const knackRecordTimestampString = knackPayload.knackRecordLastSaved; // Timestamp of the Knack record itself
              // Corrected: Use localStorageDataTimestampRef.current directly
              const localDataTimestampStringFromRef = localStorageDataTimestampRef.current; // Timestamp from appData.metadata.timestamp

              console.log("[User Info] Processing KNACK_USER_INFO. LocalStorage Timestamp:", localDataTimestampStringFromRef, "Knack Record Timestamp:", knackRecordTimestampString);

              // Store the recordId if available from the blob (as it's part of the userData blob)
              // The recordId in the blob should be the ID of the object_102 record.
              if (knackUserDataBlob && knackUserDataBlob.recordId) {
                setRecordId(knackUserDataBlob.recordId);
                console.log("[User Info] Stored recordId from Knack userData blob:", knackUserDataBlob.recordId);
                try {
                  localStorage.setItem('flashcards_auth', JSON.stringify({ recordId: knackUserDataBlob.recordId }));
                } catch (e) { console.error("[User Info] Error storing record ID in localStorage:", e); }
              } else if (authDataFromKnack.id) { // Fallback to main auth ID (user's own ID from object_3) if not in blob
                                          // This might not be the object_102 record ID, be cautious.
                // setRecordId(authDataFromKnack.id); // This might be incorrect if authDataFromKnack.id is the user's ID, not the flashcard data record ID.
                                                  // The ensureRecordId logic should handle finding the correct flashcard record ID.
                console.warn("[User Info] recordId not found in Knack userData blob. Relying on ensureRecordId or existing recordId state.");
              }
              
              const localTimestamp = localDataTimestampStringFromRef ? new Date(localDataTimestampStringFromRef).getTime() : 0;
              const knackTimestamp = knackRecordTimestampString ? new Date(knackRecordTimestampString).getTime() : 0;
              const timeBuffer = 10000; // 10 seconds buffer to account for save queue and potential small discrepancies

              if (localTimestamp > (knackTimestamp + timeBuffer)) {
                // LocalStorage data is significantly newer.
                console.warn(`[User Info] LocalStorage data (ts: ${localDataTimestampStringFromRef}) is newer than Knack record (ts: ${knackRecordTimestampString}). Prioritizing local data.`);
                showStatus("Local data is newer. Syncing to server...");
                // The app state is already populated from localStorage by loadCombinedData.
                // We just need to ensure Knack gets updated with this fresher data.
                setTimeout(() => saveData(null, true), 2500); // preserveFields = true to be safe, slightly longer delay
              } else {
                // Knack data is newer, or timestamps are inconclusive/local is not significantly newer.
                // Proceed with updating state from Knack data.
                console.log(`[User Info] Knack data (ts: ${knackRecordTimestampString}) is newer or similar to local (ts: ${localDataTimestampStringFromRef}). Using Knack data.`);
                try {
                  if (knackUserDataBlob.cards && Array.isArray(knackUserDataBlob.cards)) {
                    const restoredCards = restoreMultipleChoiceOptions(knackUserDataBlob.cards);
                    setAllCards(restoredCards);
                    updateSpacedRepetitionData(restoredCards);
                  } else {
                     console.warn("[User Info] Knack userData.cards is missing or not an array.");
                  }
                  // Ensure colorMapping is an object before processing
                  setSubjectColorMapping(ensureValidColorMapping(knackUserDataBlob.colorMapping || {}));
                  
                  if (knackUserDataBlob.spacedRepetition) {
                    setSpacedRepetitionData(knackUserDataBlob.spacedRepetition);
                  } else {
                    console.warn("[User Info] Knack userData.spacedRepetition is missing.");
                  }
                  if (knackUserDataBlob.userTopics) {
                    setUserTopics(knackUserDataBlob.userTopics);
                  }
                  if (knackUserDataBlob.topicLists && Array.isArray(knackUserDataBlob.topicLists)) {
                    setTopicLists(knackUserDataBlob.topicLists);
                  }
                  if (knackUserDataBlob.topicMetadata && Array.isArray(knackUserDataBlob.topicMetadata)) {
                    setTopicMetadata(knackUserDataBlob.topicMetadata);
                  }
                  console.log("[User Info] Successfully processed user data from Knack.");
                } catch (e) {
                  console.error("[User Info] Error processing Knack userData JSON:", e);
                  showStatus("Error loading your data from server. Using local data as fallback.");
                }
              }
            } else {
              // If no userData blob from Knack, it implies this might be the first load for the user in Knack
              // or an issue with Knack data. Data loaded from localStorage (if any) will be used.
              console.log("[User Info] No userData blob received from Knack. App will rely on localStorage data or defaults.");
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
            
            if (window.currentSaveTimeout) {
              clearTimeout(window.currentSaveTimeout);
              window.currentSaveTimeout = null;
            }
            
            setIsSaving(false);
            if (event.data.success) {
              showStatus("Saved successfully!");
              // --- REMOVE AUTOMATIC DATA REFRESH ON SAVE --- 
              // if (isKnack && propagateSaveToBridge && recordId) { 
              //     console.log(`[App SAVE_RESULT] Sending REQUEST_UPDATED_DATA for recordId: ${recordId}`);
              //     propagateSaveToBridge({
              //         type: 'REQUEST_UPDATED_DATA',
              //         recordId: recordId 
              //     });
              // } else if (isKnack) {
              //     console.warn("[App SAVE_RESULT] Cannot request updated data: propagate function or recordId missing.");
              // }
              // -------------------------------------------
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
              if (event.data.shouldReload) {
                console.log("[Add To Bank Result] Requesting updated data...");
                // setLoading(true); // Optional: Re-enable if needed
                // setLoadingMessage("Refreshing card data...");
                if (isKnack && propagateSaveToBridge && recordId) { // Check if in Knack & have function/ID
                    console.log(`[App ADD_TO_BANK_RESULT] Sending REQUEST_UPDATED_DATA for recordId: ${recordId}`);
                    propagateSaveToBridge({
                        type: 'REQUEST_UPDATED_DATA',
                        recordId: recordId // Correct format
                    });
                } else {
                   console.warn("[App ADD_TO_BANK_RESULT] Cannot request updated data: propagate function or recordId missing.");
                   // Fallback: Maybe load from local storage if not in Knack? Or show error.
                   // loadFromLocalStorage(); 
                   // setLoading(false);
                }
              }
            } else {
              showStatus("Error adding cards to bank. Try refreshing the page.");
              // ... (error handling) ...
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
                // --- Log cards before processing ---
                console.log(`[KNACK_DATA] Received cards count: ${event.data.cards.length}. Sample options BEFORE processing:`);
                event.data.cards.slice(0, 5).forEach((card, index) => {
                    if (card.questionType === 'multiple_choice' || (Array.isArray(card.options) && card.options.length > 0)) {
                        console.log(`[KNACK_DATA PRE] Card ${index} (ID: ${card.id}) options:`, JSON.stringify(card.options));
                    }
                });
                // --- End log ---
                
                // Restore multiple choice options if they exist
                const restoredCards = restoreMultipleChoiceOptions(event.data.cards);
                
                // --- Log cards after processing ---
                console.log(`[KNACK_DATA] Processed cards count: ${restoredCards.length}. Sample options AFTER processing:`);
                restoredCards.slice(0, 5).forEach((card, index) => {
                    if (card.questionType === 'multiple_choice' || (Array.isArray(card.options) && card.options.length > 0)) {
                        console.log(`[KNACK_DATA POST] Card ${index} (ID: ${card.id}) options:`, JSON.stringify(card.options));
                    }
                });
                // --- End log ---
                
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
  }, [showStatus, updateSpacedRepetitionData, recordId, view]); // FINAL: Removed loadFromLocalStorage and propagateSaveToBridge

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

  // Listen for the FlashcardGeneratorBridge trigger event
  useEffect(() => {
    const handleOpenFlashcardBridge = (event) => {
      console.log("[FlashcardBridge] Received openFlashcardBridge event", event.detail);
      
      if (event.detail && event.detail.topic) {
        // Set the bridge topic data state
        setBridgeTopicData(event.detail.topic);
        
        // Show the bridge
        setShowFlashcardBridge(true);
        
        console.log("[FlashcardBridge] Opening bridge with topic:", event.detail.topic);
      }
    };
    
    // Add the event listener
    window.addEventListener('openFlashcardBridge', handleOpenFlashcardBridge);
    
    // Clean up
    return () => {
      window.removeEventListener('openFlashcardBridge', handleOpenFlashcardBridge);
    };
  }, []);  // Empty dependency array since we don't use any external variables

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

// Fixed function to handle saving topic shells generated by TopicCreationModal
// This improved version ensures subjects don't overwrite each other
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

  // CRITICAL FIX: Extract the subject from the first shell to use consistently
  const subjectToUse = generatedShells[0]?.subject || "General";
  console.log("[App] Processing shells for subject:", subjectToUse);

  // 2. Process shells and assign colors - with unique ID generation
  const timestamp = Date.now();
  const uniqueRandom = Math.random().toString(36).substring(2, 7); // Common random string for all shells in this batch
  const processedShells = generatedShells.map((shell, index) => {
    // Ensure all shells have the same subject - critical for consistency
    const subject = subjectToUse;
    let subjectColor = subjectColorMapping[subject]?.base;
    
    // If no color exists for this subject, assign one by cycling through the palette
    if (!subjectColor) {
      const existingSubjectKeys = Object.keys(subjectColorMapping);
      const newSubjectIndex = existingSubjectKeys.length; // This will be 0 for the first subject, 1 for the second, etc.
      subjectColor = BRIGHT_COLORS[newSubjectIndex % BRIGHT_COLORS.length];
      console.log(`[handleSaveTopicShells] Assigning new subject color for '${subject}': ${subjectColor} (index ${newSubjectIndex})`);
      updateColorMapping(subject, null, subjectColor, true); // true to apply to topics as well
    }

    // Generate a topic color based on the subject color
    const topicColor = generateShade(subjectColor, index % 5, 5);

    // Generate a truly unique ID with a consistent format
    // The key fix here is using a different ID format that won't collide with other subjects
    const uniqueId = `topic_${subject.replace(/\s+/g, '_')}_${timestamp}_${uniqueRandom}_${index}`;

    return {
      ...shell,
      id: uniqueId, // Override any existing ID to ensure consistency
      subject: subject, // Ensure subject is set correctly and consistently
      type: 'topic',
      isShell: true,
      isEmpty: true, // Explicitly mark as empty
      color: topicColor,
      subjectColor: subjectColor,
      metadata: {
        examType: shell.examType || "General",
        examBoard: shell.examBoard || "General",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    };
  });

  // 3. Update allCards with the new shells - with improved merging logic
  setAllCards(prevCards => {
    // Get all existing cards that belong to OTHER subjects - critical fix
    const otherSubjectCards = prevCards.filter(card => 
      (card.subject || "General") !== subjectToUse
    );
    
    // Get existing cards for THIS subject that are NOT topic shells
    const thisSubjectNonShellCards = prevCards.filter(card => 
      (card.subject || "General") === subjectToUse && 
      (card.type !== 'topic' || !card.isShell)
    );
    
    // Combine other subject cards, this subject's non-shell cards, and the new shells
    const mergedCards = [...otherSubjectCards, ...thisSubjectNonShellCards, ...processedShells];
    
    console.log(`[App] New merged card counts:
      - Other subjects: ${otherSubjectCards.length}
      - This subject (non-shells): ${thisSubjectNonShellCards.length}
      - New shells: ${processedShells.length}
      - Total: ${mergedCards.length}`);
    
    return mergedCards;
  });

  // 4. Prepare topic list for the NEW subject only
    // Create a topic list for this subject from the shells
    const newTopicListForThisSubject = {
      subject: subjectToUse,
      topics: processedShells.map(shell => ({
        id: shell.id,
        name: shell.name,
        examBoard: shell.examType || shell.metadata?.examBoard || '',
        examType: shell.examType || shell.metadata?.examType || '',
        color: shell.color,
        subjectColor: shell.subjectColor
      })),
      // Use the determined subjectColor for the topic list itself
      color: subjectColorMapping[subjectToUse]?.base || BRIGHT_COLORS[Object.keys(subjectColorMapping).length % BRIGHT_COLORS.length]
    };
  
    // Merge with existing topic lists WITHOUT modifying other subjects
  const existingTopicLists = [...topicLists];
  const existingListIndex = existingTopicLists.findIndex(list => 
    list.subject === subjectToUse
  );
  
  let mergedTopicLists;
  
  if (existingListIndex >= 0) {
    // Replace the existing topic list for this subject
    console.log(`[App] Replacing existing topic list for subject: ${subjectToUse}`);
    mergedTopicLists = [...existingTopicLists];
    mergedTopicLists[existingListIndex] = newTopicListForThisSubject;
  } else {
    // Add a new topic list for this subject while preserving all others
    console.log(`[App] Adding new topic list for subject: ${subjectToUse}`);
    mergedTopicLists = [...existingTopicLists, newTopicListForThisSubject];
  }
  
  // Update topic lists state immediately
  setTopicLists(mergedTopicLists);
  
  console.log(`[App] Final topic lists count: ${mergedTopicLists.length}`);

  // 5. Save to Knack with complete payload
  try {
    // First save the topic lists
    console.log("[App] Saving topic lists via queue");
    await saveQueueService.addToQueue({
      type: 'TOPIC_LISTS_UPDATED',
      payload: {
        recordId: theRecordId,
        topicLists: mergedTopicLists
      }
    });

    // 6. Now save the complete state with cards, using preserveFields=true to prevent data loss
    console.log("[App] Triggering full save with updated data");
    
    // Get the current state of all cards after our update
    const currentCards = [...allCards];
    
    // Create a complete payload for saving
    const savePayload = {
      recordId: theRecordId,
      cards: currentCards,
      colorMapping: subjectColorMapping,
      spacedRepetition: spacedRepetitionData,
      userTopics: userTopics,
      topicLists: mergedTopicLists,
      topicMetadata: topicMetadata,
      preserveFields: true // Critical to prevent data loss
    };
    
    // Use saveData but pass true for preserveFields
    await saveData(savePayload, true);
    
    console.log("[App] Save operations completed successfully");
    setIsSaving(false);
    showStatus("Topic list saved successfully!");
    
  } catch (error) {
    console.error("[App] Error saving topic data:", error);
    setIsSaving(false);
    showStatus("Error saving topic list: " + error.message);
  }
}, [ensureRecordId, showStatus, setIsSaving, subjectColorMapping, getRandomColor, generateShade, updateColorMapping, saveData, topicLists, setTopicLists]);

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

  // --- MOVE REMAINING HOOK DEFINITIONS HERE --- (Before early returns)
  // --- REMOVE loadCombinedData FROM HERE ---
  // const loadCombinedData = useCallback(...) // MOVED EARLIER

// Function already moved above, removing duplicate declaration

  // Modified to accept and pass the applyToTopics flag
  const handleUpdateSubjectColor = useCallback(async (subject, topic, newColor, applyToTopics = false) => {
      // Call the existing updateColorMapping function which handles state update and saving
      console.log(`[App handleUpdateSubjectColor] Received update for ${subject} / ${topic || 'Subject Base'} to ${newColor}. ApplyToTopics: ${applyToTopics}. Delegating to updateColorMapping.`);
      if (subject && newColor) {
          // Pass the applyToTopics flag (which is the 4th argument to updateColorMapping)
          updateColorMapping(subject, topic, newColor, applyToTopics);
          showStatus(`Color updated for ${topic ? topic : subject}.`);
      } else {
          console.error("[App handleUpdateSubjectColor] Invalid arguments received:", { subject, topic, newColor, applyToTopics });
          showStatus("Error: Could not update color.");
      }
      // Removed the incorrect manual state update and saveData call here.
      // updateColorMapping handles saving internally.
  }, [updateColorMapping, showStatus]); // Dependencies updated

// Initialize AppLoaderInit to expose critical handlers globally
useEffect(() => {
  // Store the current instance in the ref
  appInstanceRef.current = {
    handleSaveTopicShellsAndRefresh
  };
  
  // Initialize the global App reference with our instance
  console.log("[App] Initializing global App reference with handlers");
  initializeAppGlobals(appInstanceRef.current);
  
  return () => {
    // Cleanup on unmount if needed
    console.log("[App] Cleaning up global App reference");
    appInstanceRef.current = null;
  };
}, [handleSaveTopicShellsAndRefresh]); // Only re-initialize if the handler changes


  // --- Initial Load useEffect ---
  useEffect(() => {
      // ... (implementation as before, ensuring it calls loadCombinedData) ...
      console.log("[App useEffect Initial Load] Triggering initial data load.");
      loadCombinedData('initial mount');
      // Example: Placeholder if not already implemented
      // if (!hasLoadedInitialData.current) {
      //  console.log("[App useEffect Initial Load] Calling loadCombinedData.");
      //  loadCombinedData('initial mount');
      //  hasLoadedInitialData.current = true;
      // }
  }, [loadCombinedData]); // Ensure dependencies are correct, only run once ideally

  const getCardCounts = useCallback(() => {
    // Calculate total subjects (excluding General/default)
    const validSubjects = allCards.filter(card => card.subject && card.subject !== "General");
    const uniqueSubjects = [...new Set(validSubjects.map(card => card.subject))];
    const subjectCount = uniqueSubjects.length;
    
    // Calculate total topics (those with type='topic' and isShell=true)
    const topicShells = allCards.filter(card => card.type === 'topic' && card.isShell);
    const topicCount = topicShells.length;
    
    // Calculate actual flashcards (not topic shells)
    const actualCards = allCards.filter(card => !card.isShell);
    const cardCount = actualCards.length;
    
    return {
      subjects: subjectCount,
      topics: topicCount,
      flashcards: cardCount
    };
  }, [allCards]);

  // --- Add function to handle propagating saves ---
  const propagateSaveToBridge = useCallback((messagePayload) => {
    console.log("[App] propagateSaveToBridge called with payload (before stringify):", messagePayload);
    
    let payloadToSend = { ...messagePayload };
    if (payloadToSend.cards && typeof payloadToSend.cards === 'object') {
        try {
            console.log("[App] Stringifying cards array before postMessage");
            // Log a sample before stringifying
            if (Array.isArray(payloadToSend.cards) && payloadToSend.cards.length > 0) {
              console.log("[App] Sample card OPTIONS before stringify:", payloadToSend.cards[0]?.options);
            }
            const stringifiedCards = JSON.stringify(payloadToSend.cards);
            console.log("[App] Stringified cards length:", stringifiedCards.length);
            payloadToSend.cards = stringifiedCards;
            console.log("[App] Payload AFTER stringify (sample card field):", payloadToSend.cards?.substring(0, 200)); // Log sample of stringified
        } catch (e) {
            console.error("[App] Failed to stringify cards array:", e);
            payloadToSend = { ...messagePayload }; 
        }
    }
    // ---------------------------------------------------

    const iframeElement = document.getElementById('flashcard-app-iframe');
    // --- More robust iframe lookup --- 
    let iframeWindow = iframeElement?.contentWindow || window.flashcardAppIframeWindow || null;
    // ----------------------------------
    
    // Fallback 1: Try global reference if direct access fails (redundant with above but safe)
    if (!iframeWindow && window.flashcardAppIframeWindow) {
      console.log("[App] Using fallback global reference for iframe");
      iframeWindow = window.flashcardAppIframeWindow;
    }

    if (iframeWindow) {
      console.log(`[App] Posting message type ${payloadToSend.type} to Knack script`);
      iframeWindow.postMessage(payloadToSend, '*'); // Send the modified payload
    } else {
      console.error("[App] Cannot send message to bridge: Iframe element or contentWindow not found.");
      
      // Fallback 2: Try parent window as last resort
      if (window.parent !== window) {
        console.log("[App] Attempting to send message via parent window as fallback");
        window.parent.postMessage(messagePayload, '*');
      } else {
        showStatus("Error: Could not communicate with the saving mechanism.", 5000);
      }
    }
  }, [showStatus]); // showStatus is the only dependency

  // ... rest of useEffect hooks ...

  // ... getCardCounts ...

  // --- Early returns for loading/error --- 
  // ...

  // --- Main Return ---
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
            cardCounts={getCardCounts()} // Add this line to pass the counts
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
                onSaveTopicShells={handleSaveTopicShellsAndRefresh}
                userId={auth?.id}
                recordId={recordId}
                updateColorMapping={updateColorMapping}
                existingSubjects={getSubjects().map(subject => subject.name)}
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
                      onViewTopicList={handleViewTopicList} // Corrected prop name based on usage
                      recordId={recordId}
                      userId={auth?.id} // Add userId prop
                      // --- Pass the state and the handler function --- 
                      subjectColorMapping={subjectColorMapping} 
                      onUpdateSubjectColor={handleUpdateSubjectColor} 
                      // --- Pass the new prop for communication --- 
                      propagateSaveToBridge={propagateSaveToBridge} // Pass the new function
                      // -------------------------------------------
                      handleSaveTopicShells={handleSaveTopicShellsAndRefresh} // Pass the new function
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
            <CardGeneratorConnector
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

          {/* Render the FlashcardGeneratorBridge when needed */}
          {showFlashcardBridge && bridgeTopicData && (
            <FlashcardGeneratorBridge
              topic={bridgeTopicData}
              onClose={() => {
                setShowFlashcardBridge(false);
                setBridgeTopicData(null);
              }}
              onAddCards={addCard}
              userId={auth?.id}
              recordId={recordId}
            />
          )}
        </>
      )}
    </div>
    </WebSocketProvider>
  );
}

export default App;
