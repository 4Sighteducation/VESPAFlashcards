import React, { useState, useEffect, useCallback, useRef } from "react";
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

  // Save data to Knack - depends on saveToLocalStorage and showStatus
  const saveData = useCallback((cards = null) => {
    if (!auth) return;

    setIsSaving(true);

    try {
      // Use provided cards or the current state
      const cardsToSave = cards || allCards;

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
          field_2979: JSON.stringify(cardsToSave),          // Legacy cards field (main Card Bank)
          field_2986: JSON.stringify(cardsToSave)           // New cards field (might be used in some versions)
        };
        
        console.log("Saving to Knack with additional fields:", additionalFields);
        
        window.parent.postMessage(
          {
            type: "SAVE_DATA",
            data: {
              recordId: recordId,
              cards: cardsToSave,
              colorMapping: subjectColorMapping,
              spacedRepetition: spacedRepetitionData,
              userTopics: userTopics,
              additionalFields: additionalFields
            },
          },
          "*"
        );

        console.log("Saving data with additional user fields to Knack Object_102");
        showStatus("Saving your flashcards...");
      }
      
      // Always save to localStorage as fallback
      saveToLocalStorage();
      
      // If we're in standalone mode, mark as saved
      if (window.parent === window) {
        setIsSaving(false);
        showStatus("Saved successfully!");
      }
    } catch (error) {
      console.error("Error saving data:", error);
      setIsSaving(false);
      showStatus("Error saving data");
    }
  }, [auth, allCards, subjectColorMapping, spacedRepetitionData, userTopics, showStatus, saveToLocalStorage, recordId, getUserInfo]);

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
  // Load data from localStorage fallback
  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedCards = localStorage.getItem('flashcards');
      const savedColorMapping = localStorage.getItem('colorMapping');
      const savedSpacedRepetition = localStorage.getItem('spacedRepetition');
      const savedUserTopics = localStorage.getItem('userTopics');
      
      if (savedCards) {
        const parsedCards = safeParseJSON(savedCards);
        setAllCards(parsedCards);
        updateSpacedRepetitionData(parsedCards);
      }
      
      if (savedColorMapping) {
        setSubjectColorMapping(safeParseJSON(savedColorMapping));
      }
      
      if (savedSpacedRepetition) {
        setSpacedRepetitionData(safeParseJSON(savedSpacedRepetition));
      }
      
      if (savedUserTopics) {
        setUserTopics(safeParseJSON(savedUserTopics));
      }
      
      console.log("Loaded data from localStorage");
    } catch (error) {
      console.error("Error loading from localStorage:", error);
    }
  }, [updateSpacedRepetitionData]);

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

  // Load data from Knack when user is authenticated
  const loadDataFromKnack = useCallback(async () => {
    if (!auth || !auth.id) return;
    
    try {
      setLoadingMessage("Loading your data...");
      
      // Fetch record data
      const response = await fetch(`https://api.knack.com/v1/objects/object_102/records/${auth.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Knack-Application-Id': KNACK_APP_ID,
          'X-Knack-REST-API-Key': KNACK_API_KEY
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Loaded data from Knack:", data);
      
      // Check if we have field_2979 or field_2986 (flashcards)
      let loadedCards = [];
      if (data?.record?.field_2979) {
        try {
          const cards = safeParseJSON(data.record.field_2979);
          if (Array.isArray(cards) && cards.length > 0) {
            console.log(`Loaded ${cards.length} cards from field_2979`);
            loadedCards = cards;
          }
        } catch (e) {
          console.error("Failed to parse cards data from field_2979:", e);
        }
      }
      
      // Try field_2986 if field_2979 is empty or failed
      if (loadedCards.length === 0 && data?.record?.field_2986) {
        try {
          const cards = safeParseJSON(data.record.field_2986);
          if (Array.isArray(cards) && cards.length > 0) {
            console.log(`Loaded ${cards.length} cards from field_2986`);
            loadedCards = cards;
          }
        } catch (e) {
          console.error("Failed to parse cards data from field_2986:", e);
        }
      }
      
      // Set the loaded cards if we found any
      if (loadedCards.length > 0) {
        setAllCards(loadedCards);
        updateSpacedRepetitionData(loadedCards);
      }
      
      // Check if we have field_3011 (topic lists)
      if (data?.record?.field_3011) {
        try {
          const topicLists = safeParseJSON(data.record.field_3011);
          console.log("Loaded topic lists from Knack:", topicLists);
          
          // Update auth object with topic lists
          setAuth(prevAuth => ({
            ...prevAuth,
            field_3011: data.record.field_3011
          }));
          
          // Process topic lists into userTopics structure
          processTopicLists(topicLists);
        } catch (e) {
          console.error("Failed to parse topic lists data:", e);
        }
      } else if (data?.record?.field_2979) {
        // Fall back to field_2979 for backward compatibility
        try {
          const topicLists = safeParseJSON(data.record.field_2979);
          console.log("Loaded topic lists from field_2979:", topicLists);
          
          // Update auth object with topic lists
          setAuth(prevAuth => ({
            ...prevAuth,
            field_2979: data.record.field_2979,
            field_3011: data.record.field_2979 // Copy to field_3011 for future use
          }));
          
          // Process topic lists into userTopics structure
          processTopicLists(topicLists);
        } catch (e) {
          console.error("Failed to parse topic lists data from field_2979:", e);
        }
      }
      
      // Check if we have color mappings
      if (data?.record?.field_3000) {
        try {
          const colorMap = safeParseJSON(data.record.field_3000);
          if (colorMap && typeof colorMap === 'object') {
            console.log("Loaded color mappings from Knack:", colorMap);
            setSubjectColorMapping(colorMap);
          }
        } catch (e) {
          console.error("Failed to parse color mappings:", e);
        }
      }
      
      // Check if we have spaced repetition data
      if (data?.record?.field_166) {
        try {
          const spaced = safeParseJSON(data.record.field_166);
          if (spaced && typeof spaced === 'object') {
            console.log("Loaded spaced repetition data from Knack:", spaced);
            setSpacedRepetitionData(spaced);
          }
        } catch (e) {
          console.error("Failed to parse spaced repetition data:", e);
        }
      }
      
    } catch (error) {
      console.error("Error loading data from Knack:", error);
      setError(`Failed to load your data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth, KNACK_APP_ID, KNACK_API_KEY, updateSpacedRepetitionData]);

  // Process topic lists into userTopics structure
  const processTopicLists = useCallback((topicLists) => {
    if (!Array.isArray(topicLists) || topicLists.length === 0) return;
    
    const processedTopics = {};
    
    topicLists.forEach(list => {
      if (list && list.subject) {
        const subject = list.subject;
        
        // If this is the first topic list for this subject, initialize the array
        if (!processedTopics[subject]) {
          processedTopics[subject] = [];
        }
        
        // Process the topics
        if (Array.isArray(list.topics)) {
          // Add all topics from this list
          processedTopics[subject] = [...processedTopics[subject], ...list.topics];
        }
      }
    });
    
    // Update the userTopics state with the processed data
    setUserTopics(processedTopics);
    console.log("Processed topic lists into userTopics format:", processedTopics);
  }, []);

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
  useEffect(() => {
    const handleMessage = (event) => {
      console.log("Message received from parent:", event.data);

      if (event.data && event.data.type) {
        switch (event.data.type) {
          case "KNACK_USER_INFO":
            console.log("Received user info from Knack", event.data.data);
            
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
                
                console.log("Processed student data:", userStudentData);
              } catch (e) {
                console.error("Error processing student data:", e);
              }
            } else {
              // For non-student users, just extract the school data
              userStudentData = {
                school: schoolData,
                tutor: tutorData // Include tutor data for all user types
              };
            }
            
            // Set auth with combined user and student data
            setAuth({
              ...event.data.data,
              ...userStudentData
            });

            // If user data was included, process it
            if (event.data.data?.userData) {
              try {
                // Use our safe parsing function to handle potential corrupted JSON
                const userData = safeParseJSON(event.data.data.userData);

                // Store the recordId if available
                if (userData.recordId) {
                  setRecordId(userData.recordId);
                  console.log("Stored recordId:", userData.recordId);
                }

                // Process cards
                if (userData.cards && Array.isArray(userData.cards)) {
                  setAllCards(userData.cards);
                  updateSpacedRepetitionData(userData.cards);
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
                
                // Additional logging to help with debugging
                console.log("Successfully processed user data from Knack");
              } catch (e) {
                console.error("Error processing userData JSON:", e);
                showStatus("Error loading your data. Loading from local storage instead.");
                loadFromLocalStorage();
              }
            } else {
              // If no user data, load from localStorage
              console.log("No user data received, falling back to localStorage");
              loadFromLocalStorage();
            }
            
            setLoading(false);
            
            // Confirm receipt of auth info
            if (window.parent !== window) {
              window.parent.postMessage({ type: "AUTH_CONFIRMED" }, "*");
            }
            break;

          case "SAVE_RESULT":
            console.log("Save result received:", event.data.success);
            setIsSaving(false);
            if (event.data.success) {
              showStatus("Saved successfully!");
            } else {
              showStatus("Error saving data. Changes saved locally.");
            }
            break;
            
          case "LOAD_SAVED_DATA":
            console.log("Received updated data from Knack", event.data.data);

            if (event.data.data) {
              try {
                // Process cards
                if (event.data.data.cards && Array.isArray(event.data.data.cards)) {
                  setAllCards(event.data.data.cards);
                  updateSpacedRepetitionData(event.data.data.cards);
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
                
                showStatus("Updated with latest data from server");
              } catch (error) {
                console.error("Error processing updated data:", error);
                showStatus("Error loading updated data");
              }
            }
            break;

          default:
            console.log("Unknown message type:", event.data.type);
        }
      }
    };

    // Set up listener for messages from parent window
    window.addEventListener("message", handleMessage);

    // Try to send a ready message to parent
    if (window.parent !== window) {
      window.parent.postMessage({ type: "APP_READY" }, "*");
      console.log("Sent ready message to parent");
    } else {
      // In standalone mode, load from localStorage
      console.log("Running in standalone mode");
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

  // Effect to listen for messages from the parent window
  useEffect(() => {
    const handleMessage = (event) => {
      // Handle data from Knack
      if (event.data && event.data.type === "KNACK_DATA") {
        console.log("Received data from Knack:", event.data);
        
        // Set the record ID for saving
        if (event.data.recordId) {
          setRecordId(event.data.recordId);
        }
        
        // Set authentication status
        if (event.data.auth) {
          setAuth(event.data.auth);
        }
        
        // Load cards if available
        if (event.data.cards && Array.isArray(event.data.cards)) {
          setAllCards(event.data.cards);
          console.log(`Loaded ${event.data.cards.length} cards from Knack`);
        }
        
        // Load color mapping if available
        if (event.data.colorMapping) {
          setSubjectColorMapping(event.data.colorMapping);
          console.log("Loaded color mapping from Knack");
        }
        
        // Load spaced repetition data if available
        if (event.data.spacedRepetition) {
          setSpacedRepetitionData(event.data.spacedRepetition);
          console.log("Loaded spaced repetition data from Knack");
        }
        
        // Load user topics if available
        if (event.data.userTopics) {
          setUserTopics(event.data.userTopics);
          console.log("Loaded user topics from Knack");
        }
        
        setLoading(false);
      }
      
      // Handle save confirmation
      if (event.data && event.data.type === "SAVE_CONFIRMATION") {
        console.log("Save confirmation received:", event.data);
        setIsSaving(false);
        showStatus("Saved successfully!");
      }
      
      // Handle explicit save request from AICardGenerator
      if (event.data && event.data.type === "TRIGGER_SAVE") {
        console.log("Explicit save request received");
        saveData();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [saveData, showStatus]);

  // Handle opening the topic list modal
  const handleViewTopicList = useCallback((subject, examBoard, examType) => {
    console.log("Opening topic list for:", subject, examBoard, examType);
    
    setTopicListSubject(subject);
    setTopicListExamBoard(examBoard || "AQA");
    setTopicListExamType(examType || "A-Level");
    
    // Check if we already have a topic list for this subject
    let existingTopics = null;
    
    // First check if we have auth and field_3011 data
    try {
      if (auth && auth.field_3011) {
        const topicLists = JSON.parse(auth.field_3011);
        console.log("Parsed topic lists from field_3011:", topicLists);
        
        if (Array.isArray(topicLists)) {
          // Find the topic list for this subject with matching exam board if specified
          const subjectTopicList = topicLists.find(list => 
            (list.subject === subject || list.name?.toLowerCase() === subject.toLowerCase()) && 
            (!examBoard || list.examBoard === examBoard)
          );
          
          if (subjectTopicList && Array.isArray(subjectTopicList.topics)) {
            console.log("Found existing topic list:", subjectTopicList);
            existingTopics = subjectTopicList.topics;
            
            // Also update userTopics state for future reference
            setUserTopics(prev => ({
              ...prev,
              [subject]: subjectTopicList.topics
            }));
          } else {
            console.log("No matching topic list found for:", subject, examBoard);
          }
        }
      }
    } catch (error) {
      console.error("Error finding existing topic list in field_3011:", error);
    }
    
    // If we didn't find in field_3011, check userTopics state
    if (!existingTopics && userTopics[subject]) {
      console.log("Using topic list from userTopics state:", userTopics[subject]);
      existingTopics = userTopics[subject];
    }
    
    console.log("existingTopics to pass to modal:", existingTopics);
    
    // Pass existingTopics to the modal when we open it
    setExistingTopicListData({
      topics: existingTopics || [],
      examBoard: examBoard,
      examType: examType,
      subject: subject
    });
    
    // Open the modal
    setTopicListModalOpen(true);
  }, [auth, userTopics]);

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

  // Handle saving subjects from wizard
  const handleSaveSubjects = (subjectsData) => {
    console.log("Saving subjects:", subjectsData);
    
    // Create empty subjects in the card bank
    const newSubjectColorMapping = { ...subjectColorMapping };
    
    // Process each subject
    subjectsData.forEach(subject => {
      const { name, color, examBoard, examType } = subject;
      
      // Add to subject color mapping
      newSubjectColorMapping[name] = color;
      
      // Create an empty "shell" card to represent the subject
      // This will make the subject appear in the card bank
      const subjectCard = {
        id: `template-${name}-${Date.now()}`,
        question: "",
        answer: "",
        subject: name,
        topic: "General",
        cardColor: color,
        subjectColor: color,
        // Add metadata in ALL possible formats to ensure display
        exam_board: examBoard,
        exam_type: examType,
        examBoard: examBoard,
        examType: examType,
        courseType: examType,
        board: examBoard,
        meta: {
          exam_board: examBoard,
          exam_type: examType,
          examBoard: examBoard,
          examType: examType
        },
        metadata: {
          exam_board: examBoard,
          exam_type: examType,
          examBoard: examBoard,
          examType: examType,
          subject: name
        },
        hasTopicList: false,
        template: true,
        boxNum: 1,
        timestamp: new Date().toISOString()
      };
      
      // Add the template card
      setAllCards(prevCards => [...prevCards, subjectCard]);
    });
    
    // Update subject colors
    setSubjectColorMapping(newSubjectColorMapping);
    
    // Show success message and prompt for topic generation
    showStatus("Subjects added successfully!", 3000);
    
    // After a short delay, show the topic generation modal
    setTimeout(() => {
      setTopicGenerationModalOpen(true);
      setSubjectsToGenerateTopics(subjectsData);
    }, 500);
  };

  // Render subject wizard
  const renderSubjectWizard = () => {
    if (!subjectWizardOpen) return null;
    
    return (
      <SubjectSelectionWizard 
        onClose={() => setSubjectWizardOpen(false)}
        onSaveSubjects={handleSaveSubjects}
      />
    );
  };

  // Render the "Select Your Subjects" button
  const renderSelectSubjectsButton = () => {
    return (
      <div className="select-subjects-container">
        <button 
          className="select-subjects-button"
          onClick={() => setSubjectWizardOpen(true)}
        >
          <span className="button-icon">📚</span>
          Select Your Subjects
        </button>
      </div>
    );
  };

  // Handle generating topic lists for selected subjects
  const handleGenerateTopicLists = async () => {
    if (subjectsToGenerateTopics.length > 0) {
      await generateAllTopicLists(subjectsToGenerateTopics);
    }
  };

  // Render topic generation modal
  const renderTopicGenerationModal = () => {
    return (
      <TopicGenerationModal 
        open={topicGenerationModalOpen}
        subjects={subjectsToGenerateTopics}
        onClose={() => setTopicGenerationModalOpen(false)}
        onGenerate={handleGenerateTopicLists}
        isGenerating={generatingTopics}
        progress={topicGenerationProgress}
        currentSubject={currentGeneratingSubject}
      />
    );
  };

  // Generate topic list for a single subject
  const generateTopicListForSubject = async (name, examBoard, examType) => {
    try {
      console.log(`Generating topic list for ${name} (${examBoard} ${examType})`);
      setLoadingMessage(`Generating topic list for ${name}...`);
      
      const prompt = `You are a curriculum expert who creates topic lists for ${examBoard} ${examType} ${name}. 
      Create a comprehensive list of topics that should be studied for this subject.
      Format each topic as a clear, specific area of study.
      Return ONLY the list of topics as a JSON array of strings, with no additional text or explanation.`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a curriculum expert who creates topic lists for subjects.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const topicListText = data.choices[0].message.content;
      
      // Parse the topic list
      let topics = [];
      try {
        // Try to parse as JSON first
        if (topicListText.includes('[') && topicListText.includes(']')) {
          const jsonMatch = topicListText.match(/\[([\s\S]*)\]/);
          if (jsonMatch) {
            const jsonStr = `[${jsonMatch[1]}]`;
            topics = JSON.parse(jsonStr.replace(/'/g, '"'));
          }
        }
        
        // If JSON parsing failed, extract topics line by line
        if (!topics.length) {
          topics = topicListText
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(topic => topic.length > 0);
        }
      } catch (parseError) {
        console.error("Error parsing topic list:", parseError);
        // Fallback to simple line splitting
        topics = topicListText
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .filter(topic => topic.length > 0);
      }
      
      // Clean up the topics to remove any JSON formatting artifacts
      topics = topics
        .filter(topic => typeof topic === 'string' && 
                         topic.trim() !== '[' && 
                         topic.trim() !== ']' &&
                         topic.trim() !== '```json' && 
                         topic.trim() !== '```' &&
                         !topic.includes('```'))
        .map(topic => {
          // Remove quotes and commas that might be leftover from JSON
          return topic.replace(/^["'](.*)["'],?$/, '$1')
                      .replace(/["'](.*)["'],?$/, '$1')
                      .replace(/,$/, '')
                      .trim();
        });
      
      console.log("Generated topics:", topics);
      
      return topics;
    } catch (error) {
      console.error(`Error generating topic list for ${name}:`, error);
      throw error;
    }
  };

  // Generate topic lists for multiple subjects
  const generateAllTopicLists = async (subjects) => {
    setGeneratingTopics(true);
    setTopicGenerationProgress({ current: 0, total: subjects.length });
    
    // Create an array to hold all topic lists
    let allTopicLists = [];
    
    try {
      // First load existing topic lists if available
      if (auth && auth.field_3011) {
        try {
          const existingLists = JSON.parse(auth.field_3011);
          if (Array.isArray(existingLists)) {
            allTopicLists = [...existingLists];
          }
        } catch (error) {
          console.error("Error parsing existing topic lists:", error);
        }
      }
      
      // Process each subject one by one
      for (let i = 0; i < subjects.length; i++) {
        const subject = subjects[i];
        setCurrentGeneratingSubject(subject.name);
        setTopicGenerationProgress({ current: i + 1, total: subjects.length });
        
        try {
          // Check if this subject already has a topic list in allTopicLists
          const existingIndex = allTopicLists.findIndex(list => 
            list.subject === subject.name && list.examBoard === subject.examBoard
          );
          
          // Generate topic list for this subject
          const topicList = await generateTopicListForSubject(subject.name, subject.examBoard, subject.examType);
          
          if (topicList && topicList.length > 0) {
            // Create a topic list object
            const topicListObj = {
              id: `topiclist_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
              name: subject.name.toLowerCase(),
              examBoard: subject.examBoard,
              examType: subject.examType,
              subject: subject.name,
              topics: topicList.map(topic => ({ topic })),
              created: new Date().toISOString(),
              userId: auth?.id || ""
            };
            
            if (existingIndex >= 0) {
              // Update existing entry
              allTopicLists[existingIndex] = topicListObj;
            } else {
              // Add new entry
              allTopicLists.push(topicListObj);
            }
            
            // Update subject card to show it has a topic list
            setAllCards(prevCards => 
              prevCards.map(card => {
                if (card.subject === subject.name && card.template) {
                  return {
                    ...card,
                    hasTopicList: true
                  };
                }
                return card;
              })
            );
          }
        } catch (error) {
          console.error(`Error generating topic list for ${subject.name}:`, error);
        }
      }
      
      // Save all topic lists to Knack
      if (auth && recordId && allTopicLists.length > 0) {
        try {
          console.log("Saving all topic lists to Knack:", JSON.stringify(allTopicLists));
          const response = await fetch(`https://api.knack.com/v1/objects/object_102/records/${recordId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Knack-Application-Id": KNACK_APP_ID,
              "X-Knack-REST-API-Key": KNACK_API_KEY
            },
            body: JSON.stringify({
              field_3011: JSON.stringify(allTopicLists)
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to save topic lists: ${response.status}`);
          }
          
          showStatus("All topic lists generated and saved successfully!", 3000);
        } catch (error) {
          console.error("Error saving topic lists to Knack:", error);
          showStatus("Error saving topic lists. Some lists might not be saved.", 3000, "error");
        }
      }
    } catch (error) {
      console.error("Error in overall topic list generation:", error);
      showStatus("Error generating topic lists", 3000, "error");
    } finally {
      setGeneratingTopics(false);
      setTopicGenerationModalOpen(false);
      setCurrentGeneratingSubject(null);
    }
  };

  // Handle saving a topic list
  const handleSaveTopicList = useCallback(async (topicListData, subject) => {
    console.log("Saving topic list:", topicListData);

    // Clean up topics if they contain JSON artifacts
    if (topicListData.topics && Array.isArray(topicListData.topics)) {
      topicListData.topics = topicListData.topics.map(topicItem => {
        let topic = typeof topicItem === 'string' ? topicItem : topicItem.topic;
        
        // Remove surrounding quotes if present
        topic = topic.replace(/^["'](.*)["']$/, '$1');
        
        // Remove any trailing commas
        topic = topic.replace(/,$/, '');
        
        // Remove brackets that might be part of JSON structure
        topic = topic.replace(/^\[|\]$/g, '');

        return typeof topicItem === 'string' ? topic : { ...topicItem, topic };
      });
      
      // Filter out any empty topics or JSON artifacts like '[' or ']'
      topicListData.topics = topicListData.topics.filter(item => {
        const topic = typeof item === 'string' ? item : item.topic;
        return topic && topic.trim() !== '[' && topic.trim() !== ']';
      });
    }

    // If this is a createCards request, launch AI card generator
    if (topicListData.createCards) {
      console.log("Create cards requested for topic:", topicListData.topic);
      
      // Set the selected subject and topic
      setSelectedTopic(typeof topicListData.topic === 'string' ? topicListData.topic : topicListData.topic.topic);
      setSelectedSubject(subject);
      
      // Set the exam board and exam type from the topic list data
      setCurrentAIGeneratorExamBoard(topicListData.examBoard);
      setCurrentAIGeneratorExamType(topicListData.examType);
      setCurrentAIGeneratorSubject(subject);
      setCurrentAIGeneratorTopic(typeof topicListData.topic === 'string' ? topicListData.topic : topicListData.topic.topic);
      
      // Open the AI card generator
      setShowAICardGenerator(true);
      
      // Return early - no need to save to Knack yet
      return;
    }

    // If this is a normal save (not createCards)
    const updatedUserTopics = { ...userTopics };
    
    // Each subject has an array of topic lists
    if (!updatedUserTopics[subject]) {
      updatedUserTopics[subject] = [];
    }
    
    // Check if we're updating an existing list or adding a new one
    const existingListIndex = updatedUserTopics[subject].findIndex(list => list.id === topicListData.id);
    
    if (existingListIndex >= 0) {
      // Update existing list
      updatedUserTopics[subject][existingListIndex] = topicListData;
    } else {
      // Add new list
      updatedUserTopics[subject].push(topicListData);
    }
    
    // Update state
    setUserTopics(updatedUserTopics);
    
    // Save to localStorage
    localStorage.setItem('userTopics', JSON.stringify(updatedUserTopics));
    
    // Only save to Knack if we have auth
    if (auth && recordId) {
      console.log("Auth object when saving topic list:", auth);
      
      // Get existing field_3011 data first to avoid overwriting other subjects
      let field3011Data = [];
      try {
        if (auth.field_3011) {
          const existingData = JSON.parse(auth.field_3011);
          if (Array.isArray(existingData)) {
            field3011Data = existingData;
          }
        }
      } catch (error) {
        console.error("Error parsing existing field_3011 data:", error);
      }
      
      // Find and update or add the topic list for this subject
      const existingIndex = field3011Data.findIndex(item => 
        (item.subject === subject || item.name === subject) && item.examBoard === topicListData.examBoard
      );
      
      if (existingIndex >= 0) {
        // Update existing entry
        field3011Data[existingIndex] = {
          ...field3011Data[existingIndex],
          topics: topicListData.topics,
          updated: new Date().toISOString()
        };
      } else {
        // Add new entry
        field3011Data.push({
          id: topicListData.id || `topiclist_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          name: subject.toLowerCase(),
          examBoard: topicListData.examBoard,
          examType: topicListData.examType,
          subject: subject,
          topics: topicListData.topics,
          created: new Date().toISOString(),
          userId: auth?.id
        });
      }
      
      console.log("Saving to Knack field_3011:", JSON.stringify(field3011Data));
      
      try {
        // Update the Knack record
        const response = await fetch(`https://api.knack.com/v1/objects/object_102/records/${recordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Knack-Application-Id': KNACK_APP_ID,
            'X-Knack-REST-API-Key': KNACK_API_KEY
          },
          body: JSON.stringify({
            field_3011: JSON.stringify(field3011Data)
          })
        });
        
        console.log("Knack API response status:", response.status);
        
        if (!response.ok) {
          console.error("Error saving topic list to Knack:", await response.text());
          showStatus("Error saving topic list", 3000, "error");
        } else {
          showStatus("Topic list saved to your account!", 3000);
          
          // Update subject card to show it has a topic list
          setAllCards(prevCards => 
            prevCards.map(card => {
              if (card.subject === subject && card.template) {
                return {
                  ...card,
                  hasTopicList: true
                };
              }
              return card;
            })
          );
        }
      } catch (error) {
        console.error("Error saving topic list:", error);
        showStatus("Error saving topic list", 3000, "error");
      }
    } else {
      showStatus("Topic list saved locally!", 3000);
    }
  }, [auth, recordId, userTopics, showStatus]);

  // Handle saving AI-generated cards
  const handleSaveAICards = useCallback((generatedCards) => {
    console.log("Saving AI-generated cards:", generatedCards);
    
    if (!generatedCards || !Array.isArray(generatedCards) || generatedCards.length === 0) {
      console.error("No cards to save");
      return;
    }
    
    // Process the generated cards
    const newCards = generatedCards.map(card => ({
      ...card,
      id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      box: 1, // Start in box 1 for spaced repetition
      boxNum: 1, // For backward compatibility
      last_reviewed: new Date().toISOString(),
      next_review: calculateNextReviewDate(1),
      subjectColor: subjectColorMapping[card.subject] || "#e6194b",
      cardColor: subjectColorMapping[card.subject] || "#e6194b"
    }));
    
    // Add the new cards to the card bank
    setAllCards(prevCards => {
      const updatedCards = [...prevCards, ...newCards];
      
      // Immediately save to localStorage to prevent data loss on refresh
      localStorage.setItem('flashcards', JSON.stringify(updatedCards));
      console.log("Cards saved to localStorage immediately after adding");
      
      // Save to Knack if authenticated
      if (auth && recordId) {
        // Use the new saveData function that accepts cards parameter
        saveData(updatedCards); // This will save to Knack
        console.log("Saving cards to Knack immediately after adding");
      }
      
      return updatedCards;
    });
    
    // Show a success message
    showStatus(`Added ${newCards.length} new flashcards to Box 1!`, 3000);
    
    // Close the AI generator
    setShowAICardGenerator(false);
    
    // Update forceUpdate to ensure we get a fresh AICardGenerator next time
    setForceUpdate(prev => prev + 1);
  }, [allCards, calculateNextReviewDate, saveData, showStatus, subjectColorMapping, auth, recordId]);

  // Load data when auth changes
  useEffect(() => {
    if (auth && auth.id) {
      console.log("Auth detected, loading data from Knack");
      loadDataFromKnack();
    } else if (!loading) { // Only load from localStorage if we're not in initial loading state
      console.log("No auth, loading from localStorage");
      loadFromLocalStorage();
    }
  }, [auth, loading, loadDataFromKnack, loadFromLocalStorage]);

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
          
          {/* Select Subjects Button */}
          {renderSelectSubjectsButton()}

          {/* Topic List Modal */}
          {topicListModalOpen && (
            <TopicListModal 
              subject={topicListSubject}
              examBoard={topicListExamBoard}
              examType={topicListExamType}
              onClose={() => setTopicListModalOpen(false)}
              userId={auth?.id}
              onTopicListSave={handleSaveTopicList}
              existingTopics={existingTopicListData?.topics || []}
              auth={auth}
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
            <div className="ai-card-generator-view">
              {/* Note: The AICardGenerator is now rendered in an overlay */}
              <p className="info-text">The AI Card Generator will open in an overlay. You can also access it by selecting a topic from your topic lists.</p>
              <button 
                className="primary-button" 
                onClick={() => setShowAICardGenerator(true)}
              >
                Open AI Card Generator
              </button>
            </div>
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

          {/* Subject Selection Wizard */}
          {renderSubjectWizard()}
          
          {/* Topic Generation Modal */}
          {renderTopicGenerationModal()}

          {/* Modal overlay for AICardGenerator component */}
          {showAICardGenerator && (
            <div className="ai-card-generator-overlay">
              <AICardGenerator
                onClose={() => setShowAICardGenerator(false)}
                onSaveCards={handleSaveAICards}
                initialSubject={selectedSubject}
                initialTopic={selectedTopic}
                initialExamBoard={topicListExamBoard}
                initialExamType={topicListExamType}
                auth={auth}
                userId={auth?.id}
                key={`ai-generator-${selectedSubject}-${selectedTopic}-${forceUpdate}`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
