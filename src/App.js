﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useEffect, useCallback, useRef } from "react";
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
import TopicListModal from './components/TopicListModal';
import SubjectSelectionWizard from './components/SubjectSelectionWizard';
import TopicGenerationModal from './components/TopicGenerationModal';
import { generateTopicPrompt } from './prompts/topicListPrompt';
import HighPriorityTopicsModal from './components/HighPriorityTopicsModal';
import StandaloneTopicGenerator from './StandaloneTopicGenerator';

// API Keys and constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";

// Debug log for API keys
console.log("Application starting with:", { 
  appIdEnv: process.env.REACT_APP_KNACK_APP_KEY ? "Defined" : "Undefined",
  apiKeyEnv: process.env.REACT_APP_KNACK_API_KEY ? "Defined" : "Undefined",
  appId: KNACK_APP_ID,
  // Don't log the full API key for security reasons
  apiKeyDefined: !!KNACK_API_KEY
});

// Box descriptions
const BOX_DESCRIPTIONS = {
  1: "New cards start here. Review these daily. When answered correctly, they move to Box 2; otherwise they stay here.",
  2: "Review these cards every other day. Correct responses move them to Box 3; if missed or answered incorrectly, they return to Box 1.",
  3: "Review these cards every 3 days. Correct responses move them to Box 4; if incorrect or overdue, they return to Box 1.",
  4: "Review these cards weekly. Correct responses move them to Box 5; if incorrect, they return to Box 1.",
  5: "Cards here remain indefinitely unless answered incorrectly, which returns them to Box 1."
};

// Utility function to safely parse JSON
const safeParseJSON = (jsonString) => {
  try {
    // Check if the string is already an object
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular parse attempt
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    
    // Attempt to fix common JSON syntax errors
    try {
      // Replace any invalid characters that might be causing issues
      const cleanedJson = jsonString
        .replace(/\t/g, ' ')           // Replace tabs with spaces
        .replace(/\n/g, ' ')           // Replace newlines with spaces
        .replace(/\r/g, ' ')           // Replace carriage returns with spaces
        .replace(/\\"/g, '"')          // Fix escaped quotes
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure property names are quoted
        .replace(/,\s*}/g, '}')        // Remove trailing commas in objects
        .replace(/,\s*\]/g, ']');      // Remove trailing commas in arrays
      
      return JSON.parse(cleanedJson);
    } catch (secondError) {
      console.error("Failed to recover corrupted JSON:", secondError);
      
      // Last resort: fall back to empty data structure
      return {};
    }
  }
};

// Helper function to clean HTML tags from strings
const cleanHtmlTags = (str) => {
  if (!str) return "";
  // If it's not a string, convert to string
  const strValue = String(str);
  // Remove HTML tags
  return strValue.replace(/<\/?[^>]+(>|$)/g, "").trim();
};

function App() {
  // Debug loading state
  console.log("App component initializing");

  // Authentication and user state
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [error, setError] = useState(null);
  const [recordId, setRecordId] = useState("");

  // Priority features state
  const [highPriorityModalOpen, setHighPriorityModalOpen] = useState(false);
  const [prioritizeDirectly, setPrioritizeDirectly] = useState(false);

  // App view state
  const [view, setView] = useState("cardBank"); // cardBank, createCard, spacedRepetition

  // Flashcard data
  const [allCards, setAllCards] = useState([]);
  const [currentCards, setCurrentCards] = useState([]);
  const [filter, setFilter] = useState("");
  const [subjectsFilter, setSubjectsFilter] = useState([]);
  const [topicsFilter, setTopicsFilter] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subjectColorMapping, setSubjectColorMapping] = useState({});
  const [currentSubjectColor, setCurrentSubjectColor] = useState("#e6194b");

  // Filters and selections
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Topic List Modal state
  const [topicListModalOpen, setTopicListModalOpen] = useState(false);
  const [topicListSubject, setTopicListSubject] = useState("");
  const [topicListExamBoard, setTopicListExamBoard] = useState("AQA");
  const [topicListExamType, setTopicListExamType] = useState("A-Level");
  const [existingTopicListData, setExistingTopicListData] = useState(null);
  
  // AI Card Generator state
  const [currentAIGeneratorSubject, setCurrentAIGeneratorSubject] = useState("");
  const [currentAIGeneratorTopic, setCurrentAIGeneratorTopic] = useState("");
  const [currentAIGeneratorExamBoard, setCurrentAIGeneratorExamBoard] = useState("");
  const [currentAIGeneratorExamType, setCurrentAIGeneratorExamType] = useState("");

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
  const [topicLists, setTopicLists] = useState([]);

  // Status messages
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // PrintModal state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [cardCreationModalOpen, setCardCreationModalOpen] = useState(false);

  // New state for subject wizard
  const [subjectWizardOpen, setSubjectWizardOpen] = useState(false);
  
  // New state for topic generation
  const [topicGenerationModalOpen, setTopicGenerationModalOpen] = useState(false);
  const [subjectsToGenerateTopics, setSubjectsToGenerateTopics] = useState([]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [topicGenerationProgress, setTopicGenerationProgress] = useState({ current: 0, total: 0 });
  const [currentGeneratingSubject, setCurrentGeneratingSubject] = useState(null);
  
  // State for tracking topic review process
  const [topicsUnderReview, setTopicsUnderReview] = useState([]);
  const [topicReviewComplete, setTopicReviewComplete] = useState(false);
  
  // State for AI Card Generator
  const [showAICardGenerator, setShowAICardGenerator] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // Used to force re-render of AICardGenerator

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

  // Save data to localStorage fallback - dependent on state only
  const saveToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem('flashcards', JSON.stringify(allCards));
      localStorage.setItem('colorMapping', JSON.stringify(subjectColorMapping));
      localStorage.setItem('spacedRepetition', JSON.stringify(spacedRepetitionData));
      localStorage.setItem('userTopics', JSON.stringify(userTopics));
      console.log("Saved data to localStorage");
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [allCards, subjectColorMapping, spacedRepetitionData, userTopics]);

  // Function to sanitize objects for JSON serialization
  const sanitizeForJSON = (obj) => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle simple types that are safe for JSON
    if (typeof obj !== 'object' && typeof obj !== 'function') {
      return obj;
    }

    // Don't try to sanitize functions
    if (typeof obj === 'function') {
      return null; // Convert functions to null
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForJSON(item));
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      // Skip React synthetic events, DOM nodes, and other non-serializable objects
      if (obj.nativeEvent || obj.target || obj.currentTarget || obj.view || obj._reactName) {
        console.warn("Skipping non-serializable React event object", typeof obj);
        return null;
      }
      
      // Handle plain objects
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip non-serializable properties and functions
        if (typeof value === 'function') {
          continue;
        }
        
        // Skip special React or DOM properties
        if (key.startsWith('_') || key === 'nativeEvent' || key === 'target' || key === 'currentTarget' || key === 'view') {
          continue;
        }
        
        sanitized[key] = sanitizeForJSON(value);
      }
      return sanitized;
    }
    
    // Fallback for any other case
    try {
      // Try to convert to string
      return String(obj);
    } catch (e) {
      console.warn("Unable to sanitize object for JSON", e);
      return null;
    }
  };

  // Save data to Knack - depends on saveToLocalStorage and showStatus
  const saveData = useCallback((cards = null) => {
    if (!auth) return;

    setIsSaving(true);

    try {
      // Use provided cards or the current state
      let cardsToSave = cards || allCards;
      
      // Sanitize card topics - avoid using "General" topic directly
      cardsToSave = cardsToSave.map(card => {
        if (card.topic === "General" && card.subject) {
          return {
            ...card,
            topic: `${card.subject} - General`
          };
        }
        return card;
      });

      // Send data to parent window for saving to Knack
      if (window.parent !== window) {
        // Get the user info for saving
        const userInfo = getUserInfo();
        
        // Extract the user role directly from auth
        const userRole = auth.role || "";
        
        // Get VESPA Customer info - this should be the school name
        const vespaCustomer = cleanHtmlTags(userInfo.school || auth.field_122 || "");
        
        // Get tutor information - clean any HTML tags and handle undefined values
        const tutorInfo = cleanHtmlTags(userInfo.tutor || "");
        
        // Get user email for the connection fields
        const userEmail = userInfo.email || auth.email || "";
        
        // Get topic lists if they exist
        let topicLists = [];
        try {
          if (auth.field_3011) {
            const existingTopicLists = typeof auth.field_3011 === 'string'
              ? JSON.parse(auth.field_3011)
              : auth.field_3011;
            
            if (Array.isArray(existingTopicLists)) {
              topicLists = existingTopicLists;
            }
          }
        } catch (error) {
          console.error("Error parsing existing topic lists from auth:", error);
        }
        
        // Safely sanitize all data to ensure it can be serialized for postMessage
        const sanitizedCards = sanitizeForJSON(cardsToSave);
        const sanitizedColorMapping = sanitizeForJSON(subjectColorMapping);
        const sanitizedSpacedRep = sanitizeForJSON(spacedRepetitionData);
        const sanitizedUserTopics = sanitizeForJSON(userTopics);
        const sanitizedTopicLists = sanitizeForJSON(topicLists);
        
        // Prepare additional fields for Object_102
        const additionalFields = {
          field_3029: userInfo.name || "",                  // User Name
          field_3008: vespaCustomer,                        // VESPA Customer (school/educational establishment)
          field_2956: userEmail,                            // User Account Email
          field_3009: tutorInfo,                            // User "Tutor"
          // Add additional fields for student-specific data if needed
          field_565: userInfo.tutorGroup || "",             // Group (Tutor Group)
          field_548: userInfo.yearGroup || "",              // Year Group
          field_73: userRole,                               // User Role
          // Ensure both field_2979 and field_2986 are populated for compatibility
          field_2979: JSON.stringify(sanitizedCards),       // Legacy cards field (main Card Bank)
          // Store only card IDs and review dates in spaced repetition boxes
          field_2986: JSON.stringify((sanitizedSpacedRep.box1 || []).map(item => 
            item ? { 
              cardId: item.cardId, 
              lastReviewed: item.lastReviewed, 
              nextReviewDate: item.nextReviewDate 
            } : null
          ).filter(Boolean)),  // Box 1
          field_2987: JSON.stringify((sanitizedSpacedRep.box2 || []).map(item => 
            item ? { 
              cardId: item.cardId, 
              lastReviewed: item.lastReviewed, 
              nextReviewDate: item.nextReviewDate 
            } : null
          ).filter(Boolean)),  // Box 2
          field_2988: JSON.stringify((sanitizedSpacedRep.box3 || []).map(item => 
            item ? { 
              cardId: item.cardId, 
              lastReviewed: item.lastReviewed, 
              nextReviewDate: item.nextReviewDate 
            } : null
          ).filter(Boolean)),  // Box 3
          field_2989: JSON.stringify((sanitizedSpacedRep.box4 || []).map(item => 
            item ? { 
              cardId: item.cardId, 
              lastReviewed: item.lastReviewed, 
              nextReviewDate: item.nextReviewDate 
            } : null
          ).filter(Boolean)),  // Box 4
          field_2990: JSON.stringify((sanitizedSpacedRep.box5 || []).map(item => 
            item ? { 
              cardId: item.cardId, 
              lastReviewed: item.lastReviewed, 
              nextReviewDate: item.nextReviewDate 
            } : null
          ).filter(Boolean)),  // Box 5
          // Explicitly include topic lists
          field_3011: JSON.stringify(sanitizedTopicLists)   // Topic lists field
        };
        
        console.log("Saving to Knack with additional fields:", additionalFields);
        
        try {
          // Convert to JSON and back to ensure it's fully serializable
          const safePayload = JSON.parse(JSON.stringify({
            type: "SAVE_DATA",
            data: {
              recordId: recordId,
              cards: sanitizedCards,
              colorMapping: sanitizedColorMapping,
              spacedRepetition: sanitizedSpacedRep,
              userTopics: sanitizedUserTopics,
              additionalFields: additionalFields,
              topicLists: sanitizedTopicLists
            }
          }));
          
          window.parent.postMessage(safePayload, "*");
          console.log("Saving data with additional user fields to Knack Object_102");
          showStatus("Saving your flashcards...");
        } catch (e) {
          console.error("Error saving data:", e);
          
          // Try one more time with minimal data to avoid serialization issues
          try {
            // Create minimal box data with only required fields
            const createMinimalBoxData = (box) => {
              return (box || [])
                .filter(Boolean)
                .map(item => ({
                  cardId: item.cardId,
                  lastReviewed: item.lastReviewed,
                  nextReviewDate: item.nextReviewDate
                }));
            };
            
            const minimalPayload = {
              type: "SAVE_DATA",
              data: {
                recordId: recordId,
                cards: JSON.parse(JSON.stringify(sanitizedCards)),
                additionalFields: {
                  field_2979: JSON.stringify(sanitizedCards),
                  field_2986: JSON.stringify(createMinimalBoxData(sanitizedSpacedRep.box1)),
                  field_2987: JSON.stringify(createMinimalBoxData(sanitizedSpacedRep.box2)),
                  field_2988: JSON.stringify(createMinimalBoxData(sanitizedSpacedRep.box3)),
                  field_2989: JSON.stringify(createMinimalBoxData(sanitizedSpacedRep.box4)),
                  field_2990: JSON.stringify(createMinimalBoxData(sanitizedSpacedRep.box5)),
                  field_3011: JSON.stringify(sanitizedTopicLists)
                }
              }
            };
            
            window.parent.postMessage(minimalPayload, "*");
            showStatus("Saving your flashcards (simplified)...");
          } catch (fallbackError) {
            console.error("Final fallback error saving data:", fallbackError);
            showStatus("Error saving your flashcards. Changes are saved locally only.", 3000, "error");
          }
        }
      }
      
      // Always save to localStorage as fallback
      saveToLocalStorage();
    } catch (e) {
      console.error("Error in saveData:", e);
      showStatus("Error saving data", 3000, "error");
    } finally {
      setIsSaving(false);
    }
  }, [auth, recordId, allCards, sanitizeForJSON, subjectColorMapping, spacedRepetitionData, userTopics, saveToLocalStorage, showStatus, getUserInfo, cleanHtmlTags]);

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
          // Ensure the topics object exists
          if (!newMapping[subject].topics) {
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
    // Handler for adding topics to a subject
const handleAddTopicsToSubject = useCallback((subjectName, topics) => {
  console.log(`Adding ${topics.length} topics to subject ${subjectName}`);
  
  // Add the topics to userTopics
  setUserTopics(prevTopics => {
    // Create a key based on subject name and exam info
    const key = `${subjectName}-${topicListExamBoard}-${topicListExamType}`;
    
    // Format topics to include priority
    const formattedTopics = topics.map(topic => {
      // If topic is already an object, preserve its structure
      if (typeof topic === 'object' && topic !== null) {
        return {
          ...topic,
          priority: topic.priority !== undefined ? topic.priority : 1 // Default priority is 1
        };
      }
      // If topic is a string, convert to object with topic property
      return {
        topic: topic,
        priority: 1
      };
    });
    
    return {
      ...prevTopics,
      [key]: formattedTopics
    };
  });

  // Mark the subject card as having topics
  setAllCards(prevCards => {
    return prevCards.map(card => {
      if (card.subject === subjectName && card.template) {
        return {
          ...card,
          hasTopicList: true
        };
      }
      return card;
    });
  });
  
  // Save the updated topics to Knack
  setTimeout(() => {
    saveData();
  }, 100);
  
  // Show confirmation
  showStatus(`Topics added to ${subjectName}!`);
}, [topicListExamBoard, topicListExamType, saveData, showStatus]);

// Handler for completing the topic review process
const handleTopicReviewComplete = useCallback((finalSubjectsWithTopics) => {
  console.log("Topic review complete:", finalSubjectsWithTopics);
  setTopicReviewComplete(true);
  
  // Update existing topic lists in auth data
  let allTopicLists = [];
  
  try {
    if (auth && auth.field_3011) {
      const existingLists = typeof auth.field_3011 === 'string'
        ? JSON.parse(auth.field_3011)
        : auth.field_3011;
        
      if (Array.isArray(existingLists)) {
        allTopicLists = [...existingLists];
      }
    }
    
    // Update or add topic lists for each subject
    finalSubjectsWithTopics.forEach(subject => {
      const { name, examBoard, examType, topics } = subject;
      
      // Format topics to ensure consistent structure
      const formattedTopics = topics.map(topic => {
        if (typeof topic === 'object' && topic !== null) {
          return {
            ...topic,
            topic: topic.topic || topic.name || String(topic),
            priority: topic.priority !== undefined ? topic.priority : 1
          };
        }
        return { 
          topic: String(topic),
          priority: 1
        };
      });
      
      // Find existing topic list for this subject
      const existingIndex = allTopicLists.findIndex(
        list => list.subject === name && list.examBoard === examBoard && list.examType === examType
      );
      
      if (existingIndex >= 0) {
        // Update existing entry
        allTopicLists[existingIndex] = {
          ...allTopicLists[existingIndex],
          topics: formattedTopics,
          updated: new Date().toISOString()
        };
      } else {
        // Add new entry
        allTopicLists.push({
          id: `topiclist_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          subject: name,
          name: name.toLowerCase(),
          examBoard: examBoard,
          examType: examType,
          topics: formattedTopics,
          created: new Date().toISOString(),
          userId: auth?.id || ""
        });
      }
      
      // Also update userTopics state for this subject
      const topicKey = `${name}-${examBoard}-${examType}`;
      setUserTopics(prevTopics => ({
        ...prevTopics,
        [topicKey]: formattedTopics
      }));
      
      // Update subject card to show it has a topic list
      setAllCards(prevCards => 
        prevCards.map(card => {
          if (card.subject === name && card.template) {
            return {
              ...card,
              hasTopicList: true
            };
          }
          return card;
        })
      );
    });
    
    // Update auth with new topic lists
    if (auth) {
      setAuth(prevAuth => ({
        ...prevAuth,
        field_3011: JSON.stringify(allTopicLists)
      }));
    }
    
    // Save everything to Knack
    saveData();
    
    // Show success message
    showStatus("All topics saved successfully!");
  } catch (error) {
    console.error("Error in handleTopicReviewComplete:", error);
    showStatus("Error saving topics", 3000, "error");
  }
  
  // Close the topic generation modal
  setTopicGenerationModalOpen(false);
}, [auth, saveData, showStatus]);

    // Now update all cards with this subject to use their topic colors
    setAllCards(prevCards => {
      return prevCards.map(card => {
        if ((card.subject || "General") === subject) {
          const topic = card.topic || "General";
          // Wait for the state update to complete before accessing values
          // Instead use calculated colors
          let topicColor = newColor;

          // Handler for generating topic lists
const handleGenerateTopicLists = useCallback(async () => {
  if (!subjectsToGenerateTopics || subjectsToGenerateTopics.length === 0) {
    console.log("No subjects to generate topics for");
    return;
  }
  
  setGeneratingTopics(true);
  setTopicGenerationProgress({ current: 0, total: subjectsToGenerateTopics.length });
  
  // Generate topics for each subject one by one
  for (let i = 0; i < subjectsToGenerateTopics.length; i++) {
    const subject = subjectsToGenerateTopics[i];
    setCurrentGeneratingSubject(subject.name);
    
    try {
      // Generate the prompt for this subject
      const prompt = generateTopicPrompt({
        subject: subject.name,
        examBoard: subject.examBoard,
        examType: subject.examType,
        level: 'comprehensive'
      });
      
      // Get API response - you need to implement the actual API call here
      // This is just a placeholder
      // For example, you might use a function like:
      // const topics = await generateTopicsWithAI(prompt);
      
      // Simulate some topics for now
      const generatedTopics = [
        `${subject.name} Topic 1`,
        `${subject.name} Topic 2`,
        `${subject.name} Topic 3`,
        `${subject.name} Core Concepts`,
        `${subject.name} Advanced Applications`
      ];
      
      // Update the subject with the generated topics
      setSubjectsToGenerateTopics(prevSubjects => {
        return prevSubjects.map(s => {
          if (s.name === subject.name) {
            return {
              ...s,
              topics: generatedTopics
            };
          }
          return s;
        });
      });
      
      // Update progress
      setTopicGenerationProgress(prev => ({ 
        ...prev, 
        current: i + 1 
      }));
      
      // Short delay to avoid UI freezes
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error generating topics for ${subject.name}:`, error);
    }
  }
  return (
    <div className="app">
      <Header />
      
      {/* Your existing components would go here */}
      {view === "cardBank" && <FlashcardList flashcards={currentCards} />}
      {view === "createCard" && <CardCreator />}
      {view === "spacedRepetition" && <SpacedRepetition />}
  
      {/* Add the StandaloneTopicGenerator here */}
      <StandaloneTopicGenerator 
        topicListExamBoard={topicListExamBoard}
        topicListExamType={topicListExamType}
        setUserTopics={setUserTopics}
        allCards={allCards}
        setAllCards={setAllCards}
        saveData={saveData}
        showStatus={showStatus}
        auth={auth}
        setAuth={setAuth}
      />
      
      {/* Continue with any other components */}
      {showAICardGenerator && <AICardGenerator />}
      {loading && <LoadingSpinner />}
    </div>
  );
  
  setGeneratingTopics(false);
}, [subjectsToGenerateTopics, generateTopicPrompt]);
      // If the topic is "General", use the subject color directly
      if (topic === "General") {
        topicColor = newColor;
      }
      // Otherwise, find the appropriate color for this topic
      else if (topic !== "General") {
        const topicIndex = uniqueTopics.indexOf(topic);
        if (topicIndex !== -1) {
          topicColor = generateShade(newColor, topicIndex, Math.max(uniqueTopics.length, 5));
        }
      }

      return {
        ...card,
        cardColor: topicColor,
        subjectColor: newColor,
        baseColor: newColor
      };
        }
        return card;
      });
    });
    
    return true;
  }, [allCards, generateShade]);

  // Handler for adding topics to a subject
  const handleAddTopicsToSubject = useCallback((subjectName, topics) => {
    console.log(`Adding ${topics.length} topics to subject ${subjectName}`);
    
    // Add the topics to userTopics
    setUserTopics(prevTopics => {
      // Create a key based on subject name and exam info
      const key = `${subjectName}-${topicListExamBoard}-${topicListExamType}`;
      
      // Format topics to include priority
      const formattedTopics = topics.map(topic => {
        // If topic is already an object, preserve its structure
        if (typeof topic === 'object' && topic !== null) {
          return {
            ...topic,
            priority: topic.priority !== undefined ? topic.priority : 1 // Default priority is 1
          };
        }
        // If topic is a string, convert to object with topic property
        return {
          topic: topic,
          priority: 1
        };
      });
      
      return {
        ...prevTopics,
        [key]: formattedTopics
      };
    });

    // Mark the subject card as having topics
    setAllCards(prevCards => {
      return prevCards.map(card => {
        if (card.subject === subjectName && card.template) {
          return {
            ...card,
            hasTopicList: true
          };
        }
        return card;
      });
    });
    
    // Save the updated topics to Knack
    setTimeout(() => {
      saveData();
    }, 100);
    
    // Show confirmation
    showStatus(`Topics added to ${subjectName}!`);
  }, [topicListExamBoard, topicListExamType, saveData, showStatus]);

  // Handler for completing the topic review process
  const handleTopicReviewComplete = useCallback((finalSubjectsWithTopics) => {
    console.log("Topic review complete:", finalSubjectsWithTopics);
    setTopicReviewComplete(true);
    
    // Update existing topic lists in auth data
    let allTopicLists = [];
    
    try {
      if (auth && auth.field_3011) {
        const existingLists = typeof auth.field_3011 === 'string'
          ? JSON.parse(auth.field_3011)
          : auth.field_3011;
          
        if (Array.isArray(existingLists)) {
          allTopicLists = [...existingLists];
        }
      }
      
      // Update or add topic lists for each subject
      finalSubjectsWithTopics.forEach(subject => {
        const { name, examBoard, examType, topics } = subject;
        
        // Format topics to ensure consistent structure
        const formattedTopics = topics.map(topic => {
          if (typeof topic === 'object' && topic !== null) {
            return {
              ...topic,
              topic: topic.topic || topic.name || String(topic),
              priority: topic.priority !== undefined ? topic.priority : 1
            };
          }
          return { 
            topic: String(topic),
            priority: 1
          };
        });
        
        // Find existing topic list for this subject
        const existingIndex = allTopicLists.findIndex(
          list => list.subject === name && list.examBoard === examBoard && list.examType === examType
        );
        
        if (existingIndex >= 0) {
          // Update existing entry
          allTopicLists[existingIndex] = {
            ...allTopicLists[existingIndex],
            topics: formattedTopics,
            updated: new Date().toISOString()
          };
        } else {
          // Add new entry
          allTopicLists.push({
            id: `topiclist_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            subject: name,
            name: name.toLowerCase(),
            examBoard: examBoard,
            examType: examType,
            topics: formattedTopics,
            created: new Date().toISOString(),
            userId: auth?.id || ""
          });
        }
        
        // Also update userTopics state for this subject
        const topicKey = `${name}-${examBoard}-${examType}`;
        setUserTopics(prevTopics => ({
          ...prevTopics,
          [topicKey]: formattedTopics
        }));
        
        // Update subject card to show it has a topic list
        setAllCards(prevCards => 
          prevCards.map(card => {
            if (card.subject === name && card.template) {
              return {
                ...card,
                hasTopicList: true
              };
            }
            return card;
          })
        );
      });
      
      // Update auth with new topic lists
      if (auth) {
        setAuth(prevAuth => ({
          ...prevAuth,
          field_3011: JSON.stringify(allTopicLists)
        }));
      }
      
      // Save everything to Knack
      saveData();
      
      // Show success message
      showStatus("All topics saved successfully!");
    } catch (error) {
      console.error("Error in handleTopicReviewComplete:", error);
      showStatus("Error saving topics", 3000, "error");
    }
    
    // Close the topic generation modal
    setTopicGenerationModalOpen(false);
  }, [auth, saveData, showStatus]);

  // Handler for generating topic lists
  const handleGenerateTopicLists = useCallback(async () => {
    if (!subjectsToGenerateTopics || subjectsToGenerateTopics.length === 0) {
      console.log("No subjects to generate topics for");
      return;
    }
    
    setGeneratingTopics(true);
    setTopicGenerationProgress({ current: 0, total: subjectsToGenerateTopics.length });
    
    // Generate topics for each subject one by one
    for (let i = 0; i < subjectsToGenerateTopics.length; i++) {
      const subject = subjectsToGenerateTopics[i];
      setCurrentGeneratingSubject(subject.name);
      
      try {
        // Generate the prompt for this subject
        const prompt = generateTopicPrompt({
          subject: subject.name,
          examBoard: subject.examBoard,
          examType: subject.examType,
          level: 'comprehensive'
        });
        
        // Get API response - you need to implement the actual API call here
        // This is just a placeholder
        // For example, you might use a function like:
        // const topics = await generateTopicsWithAI(prompt);
        
        // Simulate some topics for now
        const generatedTopics = [
          `${subject.name} Topic 1`,
          `${subject.name} Topic 2`,
          `${subject.name} Topic 3`,
          `${subject.name} Core Concepts`,
          `${subject.name} Advanced Applications`
        ];
        
        // Update the subject with the generated topics
        setSubjectsToGenerateTopics(prevSubjects => {
          return prevSubjects.map(s => {
            if (s.name === subject.name) {
              return {
                ...s,
                topics: generatedTopics
              };
            }
            return s;
          });
        });
        
        // Update progress
        setTopicGenerationProgress(prev => ({ 
          ...prev, 
          current: i + 1 
        }));
        
        // Short delay to avoid UI freezes
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error generating topics for ${subject.name}:`, error);
      }
    }
    
    setGeneratingTopics(false);
  }, [subjectsToGenerateTopics, generateTopicPrompt]);

  // The App's return statement
  return (
    <div className="app">
      <Header />
      
      {/* Main content based on current view */}
      {view === "cardBank" && (
        <div className="main-content">
          <div className="sidebar">
            <SubjectsList
              subjects={getUniqueSubjects()}
              selectedSubject={selectedSubject}
              onSubjectClick={handleSubjectClick}
              subjectColorMapping={subjectColorMapping}
              onUpdateColor={updateColorMapping}
              onRefreshColors={refreshSubjectAndTopicColors}
            />
            <TopicsList
              subject={selectedSubject}
              topics={getTopicsForSubject(selectedSubject)}
              selectedTopic={selectedTopic}
              onTopicClick={handleTopicClick}
              subjectColorMapping={subjectColorMapping}
              onUpdateColor={updateColorMapping}
            />
          </div>
          <FlashcardList
            flashcards={currentCards}
          />
        </div>
      )}
      {view === "createCard" && <CardCreator />}
      {view === "spacedRepetition" && <SpacedRepetition />}
      
      {/* StandaloneTopicGenerator - THIS IS THE KEY ADDITION */}
      <StandaloneTopicGenerator 
        topicListExamBoard={topicListExamBoard}
        topicListExamType={topicListExamType}
        setUserTopics={setUserTopics}
        allCards={allCards}
        setAllCards={setAllCards}
        saveData={saveData}
        showStatus={showStatus}
        auth={auth}
        setAuth={setAuth}
      />
      
      {/* Modals */}
      {topicListModalOpen && <TopicListModal />}
      {showAICardGenerator && <AICardGenerator />}
      {printModalOpen && <PrintModal />}
      {loading && <LoadingSpinner />}
      {statusMessage && <div className="status-message">{statusMessage}</div>}
    </div>
  );
}

export default App;
