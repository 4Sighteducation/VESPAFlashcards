﻿import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import FlashcardList from "./components/FlashcardList";
import SubjectsList from "./components/SubjectsList";
import TopicsList from "./components/TopicsList";
import CardCreator from "./components/CardCreator";
import SpacedRepetition from "./components/SpacedRepetition";
import LoadingSpinner from "./components/LoadingSpinner";
import Header from "./components/Header";
import UserProfile from "./components/UserProfile";
import AICardGenerator from './components/AICardGenerator';
import PrintModal from './components/PrintModal';
import { getContrastColor, formatDate, calculateNextReviewDate, isCardDueForReview } from './helper';
import TopicListSyncManager from './components/TopicListSyncManager';
import authManager from './services/AuthManager';
import { 
  initializeAuthManager, 
  handleTokenRefreshRequest, 
  handleAuthRefreshResult 
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
  migrateCardsToStandard,
  createStandardCard
} from './utils/StandardCardModel';

import {
  sanitizeCards,
  validateCards,
  prepareForKnack,
  needsMigration
} from './utils/CardDataProcessor';

import saveQueueManager from './services/SaveQueueManager';
import cardTopicRelationshipManager from './services/CardTopicRelationshipManager';
import messageHandler from './utils/MessageHandler';
import saveVerificationService from './services/SaveVerificationService';

// API Keys and constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";

// Box descriptions
const BOX_DESCRIPTIONS = {
  1: "New cards start here. Review these daily. When answered correctly, they move to Box 2; otherwise they stay here.",
  2: "Review these cards every other day. Correct responses move them to Box 3; if missed or answered incorrectly, they return to Box 1.",
  3: "Review these cards every 3 days. Correct responses move them to Box 4; if incorrect or overdue, they return to Box 1.",
  4: "Review these cards weekly. Correct responses move them to Box 5; if incorrect, they return to Box 1.",
  5: "Cards here remain indefinitely unless answered incorrectly, which returns them to Box 1."
};

// Using safeParseJSON from DataUtils instead of local implementation


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
  const [error, setError] = useState(null);
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
  const [topicListExamBoard, setTopicListExamBoard] = useState("AQA");
  const [topicListExamType, setTopicListExamType] = useState("A-Level");

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
            .map((card) => card.topic || "General")
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
    
    // Calculate lightness adjustment based on shade index
    // Using a range from -20% (darker) to +30% (lighter)
    const adjustment = -20 + (50 * (shadeIndex / (totalShades - 1)));
    
    // Apply adjustment to RGB values
    let adjustedR = Math.min(255, Math.max(0, r * (1 + adjustment/100)));
    let adjustedG = Math.min(255, Math.max(0, g * (1 + adjustment/100)));
    let adjustedB = Math.min(255, Math.max(0, b * (1 + adjustment/100)));
    
    // Convert back to hex
    const adjustedHex = '#' + 
      Math.round(adjustedR).toString(16).padStart(2, '0') +
      Math.round(adjustedG).toString(16).padStart(2, '0') +
      Math.round(adjustedB).toString(16).padStart(2, '0');
    
    return adjustedHex;
  }, []);

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

  // Replace the existing saveData function
  const saveData = useCallback(async () => {
    // Check if we're authenticated
    if (!auth) {
      console.log("[Save] No authentication available, saving locally only");
      saveToLocalStorage();
      setIsSaving(false);
      return;
    }

    // Prevent multiple save operations
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
    
    try {
      // Get recordId safely
      let safeRecordId = recordId;
      if (!safeRecordId) {
        safeRecordId = await ensureRecordId();
        if (!safeRecordId) {
          throw new Error("No record ID available for save");
        }
      }
      
      // Use SaveQueueManager if available
      if (saveQueueManager) {
        console.log("[Save] Using SaveQueueManager for transaction-based save");
        
        // Begin a transaction
        const transactionId = saveQueueManager.beginTransaction();
        
        // Add cards operation if we have cards
        if (allCards && allCards.length > 0) {
          saveQueueManager.addOperation({
            type: 'saveCards',
            cards: allCards
          });
        }
        
        // Add color mapping operation
        if (subjectColorMapping) {
          saveQueueManager.addOperation({
            type: 'updateColorMapping',
            colorMapping: subjectColorMapping
          });
        }
        
        // Add spaced repetition data if available
        if (spacedRepetitionData) {
          saveQueueManager.addOperation({
            type: 'updateSpacedRepetition',
            data: spacedRepetitionData
          });
        }
        
        // Add topic lists if available
        if (topicLists && topicLists.length > 0) {
          saveQueueManager.addOperation({
            type: 'saveTopicLists',
            topicLists: topicLists
          });
        }
        
        // Add topic metadata if available
        if (topicMetadata && topicMetadata.length > 0) {
          saveQueueManager.addOperation({
            type: 'saveTopicMetadata',
            topicMetadata: topicMetadata
          });
        }
        
        // Commit the transaction
        await saveQueueManager.commitTransaction();
        
        console.log("[Save] Transaction committed successfully");
        setIsSaving(false);
        showStatus("Save complete");
        return;
      }
      
      // Fallback to iframe message-based save if no SaveQueueManager
      if (window.parent !== window) {
        console.log("[Save] Preparing data for Knack integration");
        
        // Prepare the data payload for Knack
        const safeData = {
          recordId: safeRecordId,
          cards: JSON.parse(JSON.stringify(allCards)),
          colorMapping: JSON.parse(JSON.stringify(subjectColorMapping)), 
          spacedRepetition: JSON.parse(JSON.stringify(spacedRepetitionData)),
          userTopics: JSON.parse(JSON.stringify(userTopics)),
          topicLists: JSON.parse(JSON.stringify(topicLists)),
          topicMetadata: JSON.parse(JSON.stringify(topicMetadata)),
          preserveFields: true
        };
        
        console.log(`[Save] Sending data to Knack (${allCards.length} cards, record ID: ${safeRecordId})`);
        
        // Use messageHandler if available
        if (messageHandler) {
          console.log("[Save] Using MessageHandler for communication");
          
          try {
            const result = await messageHandler.saveData(safeData);
            console.log("[Save] MessageHandler save result:", result);
            setIsSaving(false);
            showStatus("Save complete");
          } catch (error) {
            console.error("[Save] MessageHandler save failed:", error);
            setIsSaving(false);
            showStatus("Save failed: " + error.message);
          }
          
          return;
        }
        
        // Fallback to direct postMessage
        window.parent.postMessage({
          type: "SAVE_DATA",
          data: safeData
        }, "*");
        
        // Set a timeout to clear the saving state
        setTimeout(() => {
          setIsSaving(false);
          showStatus("Save complete");
        }, 2000);
      } else {
        console.log("[Save] Not in iframe, no parent window to send data to");
        setIsSaving(false);
        showStatus("Save complete (local only)");
      }
    } catch (error) {
      console.error("[Save] Error during save operation:", error);
      setIsSaving(false);
      showStatus("Save failed: " + error.message);
    }
  }, [auth, allCards, subjectColorMapping, spacedRepetitionData, userTopics, topicLists, topicMetadata, isSaving, saveToLocalStorage, showStatus, ensureRecordId, recordId]);

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

  // Update color mappings - independent of other functions
  const updateColorMapping = useCallback(
    (subject, topic, color, updateTopics = false) => {
      if (!subject) return;
      
      // If color is null, use a default color or generate one
      const colorToUse = color || getRandomColor();
      console.log(`Updating color for subject: ${subject}, topic: ${topic || "none"}, color: ${colorToUse}, updateTopics: ${updateTopics}`);
      
      setSubjectColorMapping((prevMapping) => {
        const newMapping = { ...prevMapping };

        // Create subject entry if it doesn't exist
        if (!newMapping[subject]) {
          newMapping[subject] = { base: colorToUse, topics: {} };
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
              .map(card => card.topic || "General");
            
            // Remove duplicates and sort
            const uniqueTopics = [...new Set(topicsForSubject)].sort();
            
            console.log(`Found topics for subject ${subject}:`, uniqueTopics);
            
            // Generate a color for each topic
            if (uniqueTopics.length > 0) {
              uniqueTopics.forEach((topicName, index) => {
                // Skip the "General" topic as it should use the base color
                if (topicName === "General") return;
                
                // Generate a shade of the base color for this topic
                const topicColor = generateShade(colorToUse, index, uniqueTopics.length);
                console.log(`Generated color for ${topicName}: ${topicColor}`);
                
                // Ensure the topics object exists
                if (!newMapping[subject].topics) {
                  newMapping[subject].topics = {};
                }
                
                // Update the topic color
                newMapping[subject].topics[topicName] = topicColor;
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
        }
        
        return newMapping;
      });
      
      // Also update the cards that use this subject/topic to reflect the new color
      setAllCards(prevCards => {
        const updatedCards = prevCards.map(card => {
          if ((card.subject || "General") === subject) {
            // If this is a topic-specific update and this card doesn't match, skip it
            if (topic && (card.topic || "General") !== topic && !updateTopics) {
              return card;
            }
            
            // Get the appropriate color based on the card's topic
            let newColor = colorToUse;
            if (topic && (card.topic || "General") === topic) {
              newColor = colorToUse;
            } else if (!topic && card.topic && card.topic !== "General" && updateTopics) {
              // For topic cards, get a shade of the subject color
              const topicsForSubject = [...new Set(
                allCards
                  .filter(c => (c.subject || "General") === subject)
                  .map(c => c.topic || "General")
              )].sort();
              
              const topicIndex = topicsForSubject.indexOf(card.topic);
              if (topicIndex !== -1) {
                newColor = generateShade(colorToUse, topicIndex, topicsForSubject.length);
              }
            }
            
            // Return updated card with new color
            return {
              ...card,
              cardColor: newColor,
              subjectColor: colorToUse,
              baseColor: subject === (card.subject || "General") ? colorToUse : card.baseColor
            };
          }
          return card;
        });
        
        // Log the first few cards for debugging
        if (updatedCards.length > 0) {
          console.log("Sample cards after color update:", updatedCards.slice(0, 3));
        }
        
        return updatedCards;
      });
      
      // Save changes
      setTimeout(() => saveToLocalStorage(), 100);
    },
    [allCards, generateShade, getRandomColor, saveToLocalStorage]
  );

  // Function to refresh subject and topic colors
  const refreshSubjectAndTopicColors = useCallback((subject, newColor) => {
    // Remove the confirmation dialog since we'll handle that in the SubjectsList component
    console.log(`Refreshing colors for subject ${subject} with base color ${newColor}`);
    
    // Get all topics for this subject
    const topicsForSubject = allCards
      .filter(card => (card.subject || "General") === subject)
      .map(card => card.topic || "General");
    
    // Remove duplicates and sort
    const uniqueTopics = [...new Set(topicsForSubject)].sort();
    
    if (uniqueTopics.length === 0) {
      console.log(`No topics found for subject ${subject}`);
      return false;
    }
    
    console.log(`Found ${uniqueTopics.length} topics for subject ${subject}`);
    
    // Start by updating the subject color
    setSubjectColorMapping(prevMapping => {
      const newMapping = { ...prevMapping };
      
      // Create subject entry if it doesn't exist
      if (!newMapping[subject]) {
        newMapping[subject] = { base: newColor, topics: {} };
      } else {
        newMapping[subject].base = newColor;
        
        // Reset topics object
        newMapping[subject].topics = {};
      }
      
      // Generate new colors for each topic
      uniqueTopics.forEach((topic, index) => {
        // Skip the "General" topic - it will use the subject color
        if (topic === "General") {
          newMapping[subject].topics[topic] = newColor;
          return;
        }
        
        // Generate a shade of the base color for this topic
        const topicColor = generateShade(newColor, index, Math.max(uniqueTopics.length, 5));
        newMapping[subject].topics[topic] = topicColor;
        
        console.log(`Generated color for topic ${topic}: ${topicColor}`);
      });
      
      return newMapping;
    });
    
    // Now update all cards with this subject to use their topic colors
    setAllCards(prevCards => {
      return prevCards.map(card => {
        if ((card.subject || "General") === subject) {
          const topic = card.topic || "General";
          // Wait for the state update to complete before accessing values
          // Instead use calculated colors
          let topicColor = newColor;
          
          if (topic !== "General") {
            const topicIndex = uniqueTopics.indexOf(topic);
            topicColor = generateShade(newColor, topicIndex, Math.max(uniqueTopics.length, 5));
          }
          
          // Return updated card with new colors
          return {
            ...card,
            cardColor: topicColor,
            baseColor: newColor
          };
        }
        return card;
      });
    });
    
    // Show confirmation to user
    showStatus("Colors refreshed successfully", "success");
    return true;
  }, [allCards, generateShade, showStatus]);

  // Generate a color for a subject or topic
  const getColorForSubjectTopic = useCallback(
    (subject, topic) => {
      // Default color if nothing else works
      const defaultColor = currentSubjectColor;

      // Check if we have a color mapping for this subject
      if (subjectColorMapping[subject]) {
        // If there's a topic, try to get its specific color
        if (
          topic &&
          subjectColorMapping[subject].topics &&
          subjectColorMapping[subject].topics[topic]
        ) {
          return subjectColorMapping[subject].topics[topic];
        } 
        // If topic is not in mapping but we have a base color, generate a color
        else if (topic && topic !== "General" && subjectColorMapping[subject].base) {
          // Get all topics for this subject
          const topicsForSubject = allCards
            .filter(card => (card.subject || "General") === subject)
            .map(card => card.topic || "General");
          
          // Remove duplicates and sort
          const uniqueTopics = [...new Set(topicsForSubject)].sort();
          
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

        // Otherwise return the base subject color
        return subjectColorMapping[subject].base;
      }

      return defaultColor;
    },
    [subjectColorMapping, currentSubjectColor, generateShade, allCards]
  );

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
        setTimeout(() => saveToLocalStorage(), 1000);
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      dataLogger.logError('localStorage_load', error);
      showStatus("Error loading data from local storage");
    }
  }, [updateSpacedRepetitionData, showStatus, saveToLocalStorage]);

  // Load data from Knack
  const loadData = useCallback(async () => {
    if (!auth) return;

    setLoadingMessage("Loading your flashcards...");
    setLoading(true);

    try {
      // Data will be loaded through the Knack integration script
      // We just wait for messages from the parent window
      
      // Load from localStorage as fallback
      loadFromLocalStorage();
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load your flashcards. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [auth, loadFromLocalStorage]);

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
  const readyMessageSentRef = useRef(false);
  
  useEffect(() => {
    // If we're in an iframe, set up communication with the parent
    if (window.parent !== window) {
      console.log("[App] Setting up communication with parent window");
      
      // Function to handle messages from the parent window
      const handleMessage = (event) => {
        if (!event.data || !event.data.type) return;
        
        console.log(`[App] Received message from parent: ${event.data.type}`);
        
        switch (event.data.type) {
          case 'KNACK_USER_INFO':
            if (event.data.data) {
              // Set auth information
              setAuth({
                id: event.data.data.id,
                email: event.data.data.email,
                name: event.data.data.name || '',
                token: event.data.data.token,
                appId: event.data.data.appId
              });
              
              // Set record ID if available
              if (event.data.data.userData && event.data.data.userData.recordId) {
                setRecordId(event.data.data.userData.recordId);
              }
              
              // Load data from user data if available
              if (event.data.data.userData) {
                const userData = event.data.data.userData;
                
                // Load cards
                if (userData.cards && Array.isArray(userData.cards)) {
                  setAllCards(userData.cards);
                  updateSpacedRepetitionData(userData.cards);
                }
                
                // Load color mapping
                if (userData.colorMapping) {
                  setSubjectColorMapping(userData.colorMapping);
                }
                
                // Load topic lists
                if (userData.topicLists && Array.isArray(userData.topicLists)) {
                  setTopicLists(userData.topicLists);
                }
                
                // Load topic metadata
                if (userData.topicMetadata && Array.isArray(userData.topicMetadata)) {
                  setTopicMetadata(userData.topicMetadata);
                }
              }
              
              // Notify parent that auth is confirmed
              window.parent.postMessage({
                type: 'AUTH_CONFIRMED'
              }, '*');
              
              setLoading(false);
            }
            break;
            
          case 'KNACK_DATA':
            // Handle refreshed data
            if (event.data.cards && Array.isArray(event.data.cards)) {
              setAllCards(event.data.cards);
              updateSpacedRepetitionData(event.data.cards);
            }
            
            if (event.data.colorMapping) {
              setSubjectColorMapping(event.data.colorMapping);
            }
            
            if (event.data.recordId) {
              setRecordId(event.data.recordId);
            }
            
            if (event.data.topicLists && Array.isArray(event.data.topicLists)) {
              setTopicLists(event.data.topicLists);
            }
            
            if (event.data.topicMetadata && Array.isArray(event.data.topicMetadata)) {
              setTopicMetadata(event.data.topicMetadata);
            }
            
            break;
            
          case 'SAVE_RESULT':
            // Handle save result
            setIsSaving(false);
            if (event.data.success) {
              showStatus("Save complete");
            } else {
              showStatus(`Save failed: ${event.data.error || 'Unknown error'}`);
            }
            break;
            
          // Add other case handlers as needed...
        }
      };
      
      // Register message handler
      window.addEventListener('message', handleMessage);
      
      // Use the messageHandler if available
      if (messageHandler) {
        messageHandler.addListener('authentication', (authData) => {
          if (authData) {
            setAuth({
              id: authData.id,
              email: authData.email,
              name: authData.name || '',
              token: authData.token,
              appId: authData.appId
            });
            
            if (authData.userData && authData.userData.recordId) {
              setRecordId(authData.userData.recordId);
            }
            
            setLoading(false);
          }
        });
      }
      
      // Notify parent that app is ready
      console.log("[App] Sending APP_READY message to parent");
      window.parent.postMessage({
        type: 'APP_READY'
      }, '*');
      
      // Share persistence services with parent window
      if (saveQueueManager && cardTopicRelationshipManager) {
        console.log("[App] Sharing persistence services with parent window");
        window.parent.postMessage({
          type: 'PERSISTENCE_SERVICES_READY',
          services: {
            unifiedPersistenceManager: saveQueueManager,
            topicShellManager: cardTopicRelationshipManager,
            saveVerificationService: saveVerificationService
          }
        }, '*');
      }
      
      // Cleanup
      return () => {
        window.removeEventListener('message', handleMessage);
        if (messageHandler) {
          // Cleanup any messageHandler listeners here
        }
      };
    } else {
      // Not in an iframe, proceed with normal initialization
      setLoading(false);
    }
  }, [updateSpacedRepetitionData, showStatus]);

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
  const updateUserTopicsForSubject = useCallback(
    (subject, topics) => {
      if (!subject || !auth) return;
      
      setUserTopics(prevTopics => {
        const newTopics = { ...prevTopics };
        newTopics[subject] = topics;
        return newTopics;
      });
      
      // Save changes
      setTimeout(() => {
        saveData();
      }, 500);
    },
    [auth, saveData]
  );

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
          recordId: recordId
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
  }, [showStatus, loadFromLocalStorage, recordId]);

  // Initialize the services
  const initializeServices = useCallback(() => {
    console.log("[App] Initializing services");
    
    // Connect SaveQueueManager with MessageHandler
    if (saveQueueManager && messageHandler) {
      messageHandler.setSaveQueueManager(saveQueueManager);
      console.log("[App] Connected SaveQueueManager to MessageHandler");
    }
    
    // Set up CardTopicRelationshipManager
    if (cardTopicRelationshipManager) {
      cardTopicRelationshipManager.initialize(allCards, topicLists);
      console.log("[App] Initialized CardTopicRelationshipManager");
    }
    
    // Set up SaveVerificationService
    if (saveVerificationService) {
      console.log("[App] Initialized SaveVerificationService");
    }
  }, [allCards, topicLists]);

  // Call initializeServices when auth and recordId are available
  useEffect(() => {
    if (auth && recordId) {
      initializeServices();
    }
  }, [auth, recordId, initializeServices]);

  // Replace or update the handleAddToBank function
  const handleAddToBank = useCallback((cards) => {
    console.log("[AddToBank] Adding cards to bank:", cards.length);
    
    // Use SaveQueueManager if available
    if (saveQueueManager) {
      setIsSaving(true);
      
      // Begin transaction
      const transactionId = saveQueueManager.beginTransaction();
      
      // Add operation
      saveQueueManager.addOperation({
        type: 'addToBank',
        cards: cards,
        recordId: recordId
      });
      
      // Commit transaction
      saveQueueManager.commitTransaction()
        .then(() => {
          console.log("[AddToBank] Transaction committed successfully");
          setIsSaving(false);
          showStatus("Cards added to bank");
        })
        .catch(error => {
          console.error("[AddToBank] Transaction failed:", error);
          setIsSaving(false);
          showStatus("Failed to add cards: " + error.message);
        });
      
      return;
    }
    
    // Fallback to messageHandler or direct postMessage
    if (window.parent !== window) {
      setIsSaving(true);
      
      // Use messageHandler if available
      if (messageHandler) {
        messageHandler.addToBank(cards, recordId)
          .then(result => {
            console.log("[AddToBank] Cards added successfully:", result);
            setIsSaving(false);
            showStatus("Cards added to bank");
          })
          .catch(error => {
            console.error("[AddToBank] Failed to add cards:", error);
            setIsSaving(false);
            showStatus("Failed to add cards: " + error.message);
          });
        
        return;
      }
      
      // Fallback to direct postMessage
      window.parent.postMessage({
        type: 'ADD_TO_BANK',
        data: {
          cards: cards,
          recordId: recordId
        }
      }, '*');
      
      // Set a timeout to clear the saving state
      setTimeout(() => {
        setIsSaving(false);
        showStatus("Cards added to bank");
      }, 2000);
    } else {
      // Not in iframe, add to local state only
      setAllCards(prevCards => [...prevCards, ...cards]);
      showStatus("Cards added (local only)");
    }
  }, [recordId, showStatus, setIsSaving]);

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
            onClose={() => setTopicListModalOpen(false)}
            onSelectTopic={handleSelectTopicFromList}
            onGenerateCards={handleGenerateCardsFromTopic}
            auth={auth}
            userId={auth?.id}
          />

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
                      <h3>No flashcards yet</h3>
                      <p>Create your first flashcard to get started!</p>
                      <button className="primary-button" onClick={() => setCardCreationModalOpen(true)}>
                        Create Flashcard
                      </button>
                    </div>
                  ) : (
                    <FlashcardList 
                      cards={getFilteredCards()} 
                      onDeleteCard={deleteCard} 
                      onUpdateCard={updateCard}
                      onViewTopicList={handleViewTopicList}
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
              examBoard={topicListExamBoard}
              examType={topicListExamType}
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
  );
}

export default App;
