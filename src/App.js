import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import FlashcardList from "./components/FlashcardList";
import SubjectsList from "./components/SubjectsList";
import TopicsList from "./components/TopicsList";
import CardCreator from "./components/CardCreator";
import SpacedRepetition from "./components/SpacedRepetition";
import LoadingSpinner from "./components/LoadingSpinner";
import Header from "./components/Header";
import AICardGenerator from './components/AICardGenerator';
import PrintModal from './components/PrintModal';
import TopicListModal from './components/TopicListModal';
import OnboardingWalkthrough from './components/OnboardingWalkthrough';
import { getContrastColor, formatDate, calculateNextReviewDate, isCardDueForReview } from './helper';

// API Keys and constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_ID || "64fc50bc3cd0ac00254bb62b";
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

  // Topic List modal state
  const [topicListModalOpen, setTopicListModalOpen] = useState(false);
  const [selectedTopicListSubject, setSelectedTopicListSubject] = useState(null);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [topicMetadata, setTopicMetadata] = useState({});

  // Onboarding walkthrough state
  const [isNewUser, setIsNewUser] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // User information
  const getUserInfo = useCallback(() => {
    return {
      id: auth?.id || "",
      email: auth?.email || "",
      name: auth?.name || "",
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
        // Store just the card ID as a string
        newSpacedRepetitionData[`box${boxNum}`].push(card.id);
      }
    });

    setSpacedRepetitionData(newSpacedRepetitionData);
  }, []);

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

  // Update color mappings - independent of other functions
  const updateColorMapping = useCallback(
    (subject, topic, color, updateTopics = false) => {
      setSubjectColorMapping((prevMapping) => {
        const newMapping = { ...prevMapping };

        // Create subject entry if it doesn't exist
        if (!newMapping[subject]) {
          newMapping[subject] = { base: color, topics: {} };
        }

        // If it's a subject-level color update
        if (!topic || updateTopics) {
          // Update the base subject color
          newMapping[subject].base = color;
          
          // If we should update topic colors automatically
          if (updateTopics) {
            console.log(`Updating all topic colors for subject ${subject} based on ${color}`);
            
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
                const topicColor = generateShade(color, index, uniqueTopics.length);
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
          newMapping[subject].topics[topic] = color;
        }
        
        return newMapping;
      });
    },
    [allCards, generateShade]
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

  // Save data to localStorage fallback - dependent on state only
  const saveToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem('flashcards', JSON.stringify(allCards));
      localStorage.setItem('colorMapping', JSON.stringify(subjectColorMapping));
      localStorage.setItem('spacedRepetition', JSON.stringify(spacedRepetitionData));
      localStorage.setItem('userTopics', JSON.stringify(userTopics));
      localStorage.setItem('topicMetadata', JSON.stringify(topicMetadata));
      console.log("Saved data to localStorage");
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [allCards, subjectColorMapping, spacedRepetitionData, userTopics, topicMetadata]);

  // Save data to Knack - depends on saveToLocalStorage and showStatus
  const saveData = useCallback(() => {
    if (!auth || isSaving) {
      return;
    }

    setIsSaving(true);
    showStatus("Saving...");

    // Prepare the data to save
    const dataToSave = {
      recordId: recordId,
      cards: allCards,
      colorMapping: subjectColorMapping,
      spacedRepetition: spacedRepetitionData,
      userTopics: userTopics,
      topicMetadata: topicMetadata
    };

    try {
      // Send data to parent window for saving to Knack
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: "SAVE_DATA",
            data: dataToSave,
          },
          "*"
        );

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
  }, [auth, allCards, subjectColorMapping, spacedRepetitionData, userTopics, showStatus, saveToLocalStorage, recordId, topicMetadata]);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback((data) => {
    console.log("Onboarding completed with data:", data);
    setShowOnboarding(false);
    
    // Save the user's selections
    if (data.examType) {
      const newMetadata = { ...topicMetadata, examType: data.examType };
      
      // Save exam boards for each subject
      if (data.examBoards) {
        newMetadata.examBoards = data.examBoards;
      }
      
      setTopicMetadata(newMetadata);
    }
    
    // Create empty topic lists for selected subjects
    if (data.subjects && data.subjects.length > 0) {
      const newUserTopics = { ...userTopics };
      
      data.subjects.forEach(subject => {
        if (!newUserTopics[subject]) {
          newUserTopics[subject] = [];
        }
      });
      
      setUserTopics(newUserTopics);
    }
    
    // Save the data
    setTimeout(() => saveData(), 100);
  }, [topicMetadata, userTopics, saveData]);

  // Cards and data operations - these depend on the above functions
  // Load data from localStorage fallback
  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedCards = localStorage.getItem('flashcards');
      const savedColorMapping = localStorage.getItem('colorMapping');
      const savedSpacedRepetition = localStorage.getItem('spacedRepetition');
      const savedUserTopics = localStorage.getItem('userTopics');
      const savedTopicMetadata = localStorage.getItem('topicMetadata');
      
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
      
      if (savedTopicMetadata) {
        setTopicMetadata(safeParseJSON(savedTopicMetadata));
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

  // Functions for card operations - defined after their dependencies
  // Add a new card
  const addCard = useCallback(
    (card) => {
      setAllCards((prevCards) => {
        const newCards = [...prevCards, card];
        updateSpacedRepetitionData(newCards);
        return newCards;
      });
      
      // Update color mapping if needed
      if (card.subject && card.cardColor) {
        updateColorMapping(card.subject, card.topic, card.cardColor);
      }
      
      // Save the changes after state updates have completed
      setTimeout(() => saveData(), 100);
      showStatus("Card added successfully!");
    },
    [updateSpacedRepetitionData, updateColorMapping, saveData, showStatus]
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

  // Extract unique subjects from all cards
  const getSubjects = useCallback(() => {
    const subjects = [
      ...new Set(allCards.map((card) => card.subject || "General")),
    ];
    return subjects.sort();
  }, [allCards]);

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
            setAuth(event.data.data);

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

                // Check if this is a new user (no cards or preferences set up)
                const isFirstTimeUser = !userData.cards || userData.cards.length === 0;
                setIsNewUser(isFirstTimeUser);
                setShowOnboarding(isFirstTimeUser);
                
                if (isFirstTimeUser) {
                  console.log("New user detected - showing onboarding walkthrough");
                } else {
                  console.log("Existing user detected - loading saved data");
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
                  setUserTopics(safeParseJSON(userData.userTopics));
                }
                
                // Process topic metadata if available
                if (userData.topicMetadata) {
                  setTopicMetadata(safeParseJSON(userData.topicMetadata));
                }
                
                showStatus("Updated with latest data from server");
              } catch (error) {
                console.error("Error processing user data:", error);
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
                
                // Process topic metadata if available
                if (event.data.data.topicMetadata) {
                  setTopicMetadata(safeParseJSON(event.data.data.topicMetadata));
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

  // Handle topic list button click
  const handleTopicListClick = (subject) => {
    setSelectedTopicListSubject(subject);
    setTopicListModalOpen(true);
  };
  
  // Get topics for the selected subject
  const getTopicsForSelectedSubject = useCallback(() => {
    if (!selectedTopicListSubject) return [];
    
    // Check if we have saved topic lists for this subject
    if (userTopics && userTopics[selectedTopicListSubject] && 
        Array.isArray(userTopics[selectedTopicListSubject])) {
      return userTopics[selectedTopicListSubject];
    }
    
    return [];
  }, [selectedTopicListSubject, userTopics]);
  
  // Save a topic list for a subject
  const saveTopicList = useCallback((updatedTopics) => {
    if (!selectedTopicListSubject) return;
    
    const updatedUserTopics = { ...userTopics };
    updatedUserTopics[selectedTopicListSubject] = updatedTopics;
    
    setUserTopics(updatedUserTopics);
    
    // Show status message
    showStatus(`Saved ${updatedTopics.length} topics for ${selectedTopicListSubject}`);
    
    // Save to backend
    setTimeout(() => {
      saveData();
    }, 500);
  }, [selectedTopicListSubject, userTopics, saveData, showStatus]);
  
  // Handle regenerating topics for a subject
  const handleRegenerateTopics = useCallback(async () => {
    if (!selectedTopicListSubject) return;
    
    setIsGeneratingTopics(true);
    
    try {
      // This would normally call the AI topic generation
      // For now, let's use a placeholder implementation
      console.log(`Regenerating topics for ${selectedTopicListSubject}`);
      
      // Get exam type and board info from metadata if available
      const examType = topicMetadata.examType || 'A-Level';
      const examBoard = topicMetadata.examBoards?.[selectedTopicListSubject] || 'AQA';
      
      // In a real implementation, this would call the AICardGenerator's generateTopics function
      // For now, we'll create some sample topics
      const demoTopics = [
        { topic: `${selectedTopicListSubject} Core Concepts`, priority: 0, timestamp: new Date().toISOString() },
        { topic: `${selectedTopicListSubject} Applied Theory`, priority: 0, timestamp: new Date().toISOString() },
        { topic: `${selectedTopicListSubject} Key Methods`, priority: 0, timestamp: new Date().toISOString() },
        { topic: `${selectedTopicListSubject} Historical Development`, priority: 0, timestamp: new Date().toISOString() },
        { topic: `${selectedTopicListSubject} Modern Applications`, priority: 0, timestamp: new Date().toISOString() }
      ];
      
      // Save the generated topics to the subject
      const updatedUserTopics = { ...userTopics };
      updatedUserTopics[selectedTopicListSubject] = demoTopics;
      
      setUserTopics(updatedUserTopics);
      showStatus(`Generated 5 topics for ${selectedTopicListSubject}`);
      
      // Save to backend
      saveData();
    } catch (error) {
      console.error('Error generating topics:', error);
      showStatus(`Error generating topics: ${error.message}`, 5000);
    } finally {
      setIsGeneratingTopics(false);
    }
  }, [selectedTopicListSubject, topicMetadata, userTopics, saveData, showStatus]);
  
  // Generate cards from a topic
  const handleGenerateCardsFromTopic = useCallback((subject, examType, examBoard, topic) => {
    // Redirect to the AI card generator and prefill data
    setView("createCard");
    
    // This would be implemented with your existing AICardGenerator
    // You would need to modify AICardGenerator to accept pre-filled data
    // For now, let's just log what we would do
    console.log(`Generating cards for topic ${topic} in ${subject} (${examBoard} ${examType})`);
    
    // Close the topic list modal
    setTopicListModalOpen(false);
  }, []);

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
    <div className="app">
      <Header
        userInfo={getUserInfo()}
        currentView={view}
        onViewChange={setView}
        onSave={saveData}
        isSaving={isSaving}
      />

      {statusMessage && <div className="status-message">{statusMessage}</div>}

      {/* Onboarding Walkthrough */}
      {showOnboarding && (
        <OnboardingWalkthrough
          onComplete={handleOnboardingComplete}
          onSkip={() => {
            console.log("Onboarding skipped");
            setShowOnboarding(false);
          }}
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
          
          <div className="bank-controls">
            <button
              className="primary-button"
              onClick={() => setCardCreationModalOpen(true)}
            >
              <span className="button-icon">✏️</span> Create New Card
            </button>
            <button
              className="secondary-button"
              onClick={() => setView("spacedRepetition")}
            >
              <span className="button-icon">🧠</span> Start Spaced Repetition
            </button>
            <button
              className="secondary-button print-all-btn"
              onClick={handlePrintAllCards}
            >
              <span className="button-icon">🖨️</span> Print All Cards
            </button>
          </div>

          <div className="bank-container">
            <div className="bank-sidebar">
              <SubjectsList
                subjects={getSubjects()}
                selectedSubject={selectedSubject}
                onSelectSubject={setSelectedSubject}
                getColorForSubject={(subject) =>
                  getColorForSubjectTopic(subject)
                }
                updateColorMapping={updateColorMapping}
                refreshSubjectAndTopicColors={refreshSubjectAndTopicColors}
                onTopicListClick={handleTopicListClick}
              />
            </div>

            <div className="bank-content">
              <FlashcardList
                cards={getFilteredCards()}
                onDeleteCard={deleteCard}
                onUpdateCard={updateCard}
              />
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

      {/* Topic List Modal */}
      <TopicListModal
        isOpen={topicListModalOpen}
        onClose={() => setTopicListModalOpen(false)}
        subject={selectedTopicListSubject}
        examType={topicMetadata.examType || 'A-Level'}
        examBoard={topicMetadata.examBoards?.[selectedTopicListSubject] || 'AQA'}
        topicList={getTopicsForSelectedSubject()}
        onSaveTopicList={saveTopicList}
        onGenerateCards={handleGenerateCardsFromTopic}
        onRegenerateTopics={handleRegenerateTopics}
        isLoading={isGeneratingTopics}
      />
    </div>
  );
}

export default App;
