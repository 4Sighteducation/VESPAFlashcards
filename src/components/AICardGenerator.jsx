import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./AICardGenerator.css";
import Flashcard from './Flashcard';
import TopicHub from '../components/TopicHub'; // Keep for potential future use or topic display
import saveQueueService from '../services/SaveQueueService';
import AICardGeneratorService from '../services/AICardGeneratorService';
import { BRIGHT_COLORS, getContrastColor } from '../utils/ColorUtils';

// Constants for question types and exam boards
const QUESTION_TYPES = [
  { value: "short_answer", label: "Short Answer" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay", label: "Essay Style" },
  { value: "acronym", label: "Acronym" }
];

const EXAM_BOARDS = [
  { value: "AQA", label: "AQA" },
  { value: "Edexcel", label: "Edexcel" },
  { value: "OCR", label: "OCR" },
  { value: "WJEC", label: "WJEC" },
  { value: "SQA", label: "SQA" },
  { value: "International Baccalaureate", label: "International Baccalaureate" },
  { value: "Cambridge International", label: "Cambridge International" }
];

const EXAM_TYPES = [
  { value: "GCSE", label: "GCSE" },
  { value: "A-Level", label: "A-Level" },
  { value: "IB", label: "International Baccalaureate" },
  { value: "AP", label: "Advanced Placement" },
  { value: "Scottish Higher", label: "Scottish Higher" },
  { value: "BTEC", label: "BTEC / Vocational" },
  { value: "Other", label: "Other" }
];

// Function to return compatible exam boards for each exam type
const boardsForType = (examType) => {
  // All boards are available for all exam types by default
  return EXAM_BOARDS.map(board => board.value);
};

// Debug logging helper
const debugLog = (title, data) => {
  console.log(`%c${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

// Helper function for delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// This component should be named AICardGenerator to match the export
const AICardGenerator = (props) => {
  // First, destructure props
  const {
    onAddCard, onClose, subjects = [], auth, userId,
    initialSubject = "", initialTopic = "", examBoard = "AQA", examType = "A-Level",
    recordId, initialTopicsProp, onFinalizeTopics, skipMetadataSteps = false, topicColor = null
  } = props;

  // Initialize state variables
  const [currentStep, setCurrentStep] = useState(skipMetadataSteps ? 4 : 1);
  const totalSteps = 5;
  
  // Check for missing required props
  const missingRequiredProps = skipMetadataSteps && (!initialSubject || !initialTopic);
  
  // Use useMemo to stabilize the initial form data to prevent render loops
  const initialFormData = useMemo(() => ({
    examBoard: examBoard,
    examType: examType,
    subject: initialSubject,
    newSubject: "",
    topic: initialTopic,
    newTopic: "",
    numCards: 5,
    questionType: "multiple_choice",
    subjectColor: topicColor || BRIGHT_COLORS[0],
  }), [examBoard, examType, initialSubject, initialTopic, topicColor]); // Explicit dependencies
  
  const [formData, setFormData] = useState(initialFormData);
  
  // State for card generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [generatedCards, setGeneratedCards] = useState([]);
  
  // State for topic handling
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [hierarchicalTopics, setHierarchicalTopics] = useState([]);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [successModal, setSuccessModal] = useState({ show: false, addedCards: [] });
  const [showSaveTopicDialog, setShowSaveTopicDialog] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showTopicConfirmation, setShowTopicConfirmation] = useState(false);
  const [selectedTopicForConfirmation, setSelectedTopicForConfirmation] = useState("");
  const [showOptionsExplanationModal, setShowOptionsExplanationModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [pendingOperations, setPendingOperations] = useState({ save: false, refresh: false, addToBank: false });
  const [operationSuccess, setOperationSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [contentGuidanceFromStorage, setContentGuidanceFromStorage] = useState("");

  // Add this effect to load content guidance when initialTopic changes
  useEffect(() => {
    if (skipMetadataSteps && initialTopic) {
      // Try to find topic ID from available topics
      const topicObj = availableTopics.find(t => 
        t.topic === initialTopic || t.subtopic === initialTopic
      );
      
      if (topicObj?.id) {
        const storedGuidance = localStorage.getItem(`contentGuidance_${topicObj.id}`);
        if (storedGuidance) {
          console.log(`Loaded content guidance from storage for topic ${initialTopic}`);
          setContentGuidanceFromStorage(storedGuidance);
        }
      }
    }
  }, [skipMetadataSteps, initialTopic, availableTopics]);

  // Initialize availableTopics state when initialTopicsProp changes
  useEffect(() => {
    if (initialTopicsProp && Array.isArray(initialTopicsProp) && initialTopicsProp.length > 0) {
      // Ensure passed topics have IDs
      const topicsWithIds = initialTopicsProp.map((topic, index) => ({
        ...topic,
        id: topic.id || `prop_topic_${Date.now()}_${index}` // Generate ID if missing
      }));
      setAvailableTopics(topicsWithIds);
      setHierarchicalTopics(topicsWithIds); // Also set hierarchical if needed
      console.log(`[AICardGenerator] Initialized with ${topicsWithIds.length} topics from prop.`);
    } else {
      setAvailableTopics([]);
      setHierarchicalTopics([]);
    }
  }, [initialTopicsProp]); 

  // Token Refresh Logic (Keep if still needed for parent communication)
  const requestTokenRefresh = useCallback(async () => {
    console.log(`[${new Date().toISOString()}] AICardGenerator requesting token refresh`);
    if (!window.tokenRefreshInProgress) {
      window.tokenRefreshInProgress = true;
    } else {
      console.log("Token refresh already in progress, waiting...");
    }
    try {
      if (window.parent && window.parent !== window) {
        // ... (postMessage logic with retries) ...
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in token refresh:`, error);
      window.tokenRefreshInProgress = false; // Ensure flag is reset on error
    } finally {
      // Ensure the flag is always reset eventually
      // Use a timeout just in case the promise logic fails to reset it
      setTimeout(() => { window.tokenRefreshInProgress = false; }, 5000);
    }
    return Promise.resolve(false); // Default return if no parent communication
  }, []);

  // Effect to update available subjects (Based on exam type or props)
  useEffect(() => {
    // Logic to determine available subjects based on formData.examType or passed subjects prop
    const predefinedSubjects = { /* ... your predefined subject lists ... */ };
    const currentExamTypeSubjects = predefinedSubjects[formData.examType] || [];
    const propSubjectNames = Array.isArray(subjects) ? subjects.map(s => typeof s === 'object' ? s.name : s) : [];
    const combined = [...new Set([...propSubjectNames, ...currentExamTypeSubjects])].sort();
    setAvailableSubjects(combined);
  }, [formData.examType, subjects]);

  // Memoize the metadata extraction from form data to prevent excess re-renders
  const currentMetadata = useMemo(() => ({
    finalSubject: formData.subject || formData.newSubject || initialSubject || "General",
    finalTopic: formData.topic || formData.newTopic || initialTopic || "General",
    finalExamType: formData.examType || examType || "General",
    finalExamBoard: formData.examBoard || examBoard || "General",
    finalQuestionType: formData.questionType || "short_answer",
    cardColor: formData.subjectColor || topicColor || BRIGHT_COLORS[0]
  }), [
    formData.subject, 
    formData.newSubject, 
    formData.topic, 
    formData.newTopic, 
    formData.examType, 
    formData.examBoard, 
    formData.questionType, 
    formData.subjectColor,
    initialSubject, 
    initialTopic, 
    examBoard, 
    examType, 
    topicColor
  ]);

  // HTTP-based topic generation
  const generateTopics = useCallback(async (genExamBoard, genExamType, genSubject) => {
    if (!genExamBoard || !genExamType || !genSubject) {
      console.error("generateTopics: Missing required parameters.");
      setError("Missing exam board, type, or subject to generate topics.");
      return;
    }
    
    console.log(`Requesting topic generation for ${genSubject} (${genExamBoard} ${genExamType})`);
    setError(null);
    setAvailableTopics([]); // Clear previous topics before new request
    setHierarchicalTopics([]);
    setIsGenerating(true);
    setLoadingStatus('Requesting topic list...');

    try {
      // This is a mock implementation since we're focusing on card generation
      // In a future update, we can add topic generation to the backend API
      
      // For now, generate some placeholder topics based on the subject
      setTimeout(() => {
        const mockTopics = [
          { id: `topic_${Date.now()}_1`, topic: `${genSubject} Fundamentals`, subtopic: null },
          { id: `topic_${Date.now()}_2`, topic: `${genSubject} Advanced Concepts`, subtopic: null },
          { id: `topic_${Date.now()}_3`, topic: `${genSubject} Applications`, subtopic: null }
        ];
        
        setAvailableTopics(mockTopics);
        setHierarchicalTopics(mockTopics);
        setIsGenerating(false);
        setLoadingStatus('Topic list generated.');
      }, 1000);
    } catch (error) {
      console.error("Error generating topics:", error);
      setError(`Failed to generate topics: ${error.message}`);
      setIsGenerating(false);
      setLoadingStatus('Error occurred.');
    }
  }, []);

  // Effect to auto-generate topics when entering Step 3 if needed
  useEffect(() => {
    if (currentStep === 3 && (formData.subject || formData.newSubject) && formData.examBoard && formData.examType && !isGenerating) {
      const subjectToGenerate = formData.subject || formData.newSubject;
      console.log(`AICardGenerator: Requesting topics for: ${subjectToGenerate} (${formData.examBoard} ${formData.examType})`);
      generateTopics(formData.examBoard, formData.examType, subjectToGenerate);
    }
    // Clear topics if exam/subject details become invalid in Step 3
    else if (currentStep === 3 && !(formData.subject || formData.newSubject) && !(formData.examBoard && formData.examType)) {
      setAvailableTopics([]);
      setHierarchicalTopics([]);
    }
  }, [currentStep, formData.subject, formData.newSubject, formData.examBoard, formData.examType, isGenerating, generateTopics]);

  // Card generation with HTTP API
  const generateCards = useCallback(async () => {
    // Get the values from form data, with fallbacks to props
    const genExamBoard = formData.examBoard || examBoard || "General";
    const genExamType = formData.examType || examType || "General";
    const genSubject = formData.subject || formData.newSubject || initialSubject || "General";
    const genTopic = formData.topic || formData.newTopic || initialTopic || "General";
    const genQuestionType = formData.questionType || "multiple_choice";
    const genNumCards = formData.numCards || 5;
    const genContentGuidance = skipMetadataSteps ? contentGuidanceFromStorage : "";
    
    console.log(`Requesting card generation: ${genQuestionType} cards for ${genSubject}/${genTopic} (${genExamBoard} ${genExamType})`);
    setError(null);
    setGeneratedCards([]); // Clear previous cards before new request
    setIsGenerating(true);
    setLoadingStatus('Requesting AI-generated flashcards...');
    
    try {
      // Call the HTTP API service
      const cardData = await AICardGeneratorService.generateCards({
        subject: genSubject,
        topic: genTopic,
        examType: genExamType,
        examBoard: genExamBoard,
        questionType: genQuestionType,
        numCards: genNumCards,
        contentGuidance: genContentGuidance
      });
      
      // Process the response data
      if (!Array.isArray(cardData)) {
        throw new Error("API did not return an array of cards");
      }
      
      // Use the service to process cards with metadata
      const processedCards = AICardGeneratorService.processCards(cardData, {
        subject: genSubject,
        topic: genTopic,
        examType: genExamType,
        examBoard: genExamBoard,
        cardColor: currentMetadata.cardColor,
        textColor: getContrastColor(currentMetadata.cardColor),
        topicId: selectedTopic?.id || null
      });
      
      debugLog("PROCESSED CARDS FROM API", processedCards.map(c => ({ 
        id: c.id, 
        subject: c.subject, 
        topic: c.topic, 
        type: c.questionType 
      })));
      
      setGeneratedCards(processedCards);
      setIsGenerating(false);
      setLoadingStatus(`${processedCards.length} Cards generated.`);
      setError(null);
    } catch (error) {
      console.error("Card generation failed:", error);
      setError(`AI Generation Error: ${error.message || 'Unknown error'}`);
      setIsGenerating(false);
      setLoadingStatus('Error occurred.');
      setGeneratedCards([]);
    }
  }, [
    formData, 
    examBoard, 
    examType, 
    initialSubject, 
    initialTopic,
    skipMetadataSteps, 
    contentGuidanceFromStorage,
    currentMetadata,
    selectedTopic
  ]);

  // Effect to generate cards on step entry (Step 5)
  useEffect(() => {
    // Generate cards when entering step 5 IF cards aren't already generated/generating
    if (currentStep === 5 && generatedCards.length === 0 && !isGenerating) {
      console.log("AICardGenerator: Triggering card generation on step 5 entry");
      // We need to call generateCards here, but NOT include it in the dependency array
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generateCards();
    }
  }, [currentStep, generatedCards.length, isGenerating]);

  // Functions related to saving/loading topic lists (if kept) ---
  const saveTopicList = () => {
    console.warn("saveTopicList function needs review/update for HTTP integration.");
    setShowSaveTopicDialog(true); // Example UI interaction
  };

  const saveTopicListToKnack = async (topicLists) => {
    console.warn("saveTopicListToKnack needs review - ensure it uses correct data structure.");
    try {
      await saveQueueService.add("SAVE_TOPIC_LISTS", { userId, recordId, topicLists });
      // ... UI updates on success
    } catch (error) {
      // ... UI updates on error
    }
  };
  
  const loadTopicList = (listId) => {
    console.warn("loadTopicList function needs implementation/review.");
  };

  const deleteTopicList = (listId) => {
    console.warn("deleteTopicList function needs implementation/review.");
  };

  const renderSavedTopicLists = () => {
    return <div>Saved Topic Lists UI (Not Implemented)</div>;
  };

  const generateCardsFromTopicList = (list) => {
    console.warn("generateCardsFromTopicList function needs review.");
    if (list && list.topics) {
      setAvailableTopics(list.topics);
      setHierarchicalTopics(list.topics);
    }
  };

  const renderSaveTopicDialog = () => {
    if (!showSaveTopicDialog) return null;
    return (
      <div>Save Topic Dialog UI (Not Implemented)</div>
    );
  };
  // --- End Topic List Functions ---

  // Form change handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value
    }));

    // Reset topic if subject changes
    if (name === 'subject' || name === 'newSubject') {
      setFormData(prev => ({ ...prev, topic: '', newTopic: ''}));
      setAvailableTopics([]); // Clear generated topics
      setHierarchicalTopics([]);
      setSelectedTopic(null); // Deselect topic
    }
    // Reset new subject if existing subject is selected
    if (name === 'subject' && value) {
      setFormData(prev => ({ ...prev, newSubject: '' }));
    }
    // Reset subject if new subject is typed
    if (name === 'newSubject' && value) {
      setFormData(prev => ({ ...prev, subject: '' }));
    }
    // Reset new topic if existing topic is selected
    if (name === 'topic' && value) {
      setFormData(prev => ({ ...prev, newTopic: '' }));
      // Find and set the selected topic object
      const topicObj = availableTopics.find(t => t.topic === value || t.id === value); // Match by name or ID
      setSelectedTopic(topicObj || null);
    }
    // Reset topic if new topic is typed
    if (name === 'newTopic' && value) {
      setFormData(prev => ({ ...prev, topic: '' }));
      setSelectedTopic(null);
    }
  };

  // Step navigation
  const handleNextStep = () => {
    if (canProceed()) {
      // Logic before advancing step if needed (e.g., trigger generation)
      if (currentStep === 3 && !formData.topic && !formData.newTopic) {
        setError("Please select or enter a topic before proceeding.");
        return; // Prevent advancing without a topic selected/entered in step 3
      }
      // Trigger card generation automatically when moving from step 4 to 5
      if (currentStep === 4) {
        console.log("Moving to Step 5, triggering card generation...");
        generateCards(); // Generate cards before showing step 5
      }

      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      setError(null); // Clear errors on step change
    } else {
      console.log("Cannot proceed, validation failed for step", currentStep);
      // Error state should be set by canProceed logic if validation fails
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null); // Clear errors on step change
  };

  // Validation logic for proceeding
  const canProceed = () => {
    setError(null); // Clear previous validation errors

    // If skipMetadataSteps is true, only validate relevant steps
    if (skipMetadataSteps) {
      // Only validate steps 4-5 when skipMetadataSteps is true
      switch (currentStep) {
        case 4: // Card Options
          if (formData.numCards <= 0 || !formData.questionType) {
            setError("Please set the number of cards and select a question type.");
            return false;
          }
          return true;
        case 5: // Review Cards - Always allow going back from here
          return true;
        default:
          return true; // Skip validation for earlier steps
      }
    }

    // Regular validation for all steps when not skipping
    switch (currentStep) {
      case 1: // Exam Details
        if (!formData.examBoard || !formData.examType) {
          setError("Please select both Exam Board and Exam Type.");
          return false;
        }
        return true;
      case 2: // Subject
        if (!formData.subject && !formData.newSubject) {
          setError("Please select or enter a Subject.");
          return false;
        }
        return true;
      case 3: // Topic (Selection/Generation)
        // Check if topics are available OR if user entered a new topic
        const hasTopicSelection = formData.topic || formData.newTopic;
        // If generating, allow proceed? Maybe not, wait for generation.
        if (isGenerating && availableTopics.length === 0) {
          setError("Please wait for topics to generate.");
          return false;
        }
        // If not generating, require a selected or new topic
        if (!isGenerating && !hasTopicSelection) {
          setError("Please select a topic from the list or enter a new one.");
          return false;
        }
        // If topics loaded but none selected/entered
        if (availableTopics.length > 0 && !hasTopicSelection) {
          setError("Please select a topic from the list or enter a new one.");
          return false;
        }
        return true; // Allow proceed if generating is done and a topic is selected/entered, or if entering new topic
      case 4: // Card Options
        // Basic check, specific options validation might be needed
        if (formData.numCards <= 0 || !formData.questionType) {
          setError("Please set the number of cards and select a question type.");
          return false;
        }
        return true;
      case 5: // Review Cards - Always allow going back from here
        return true; // Or maybe check if cards exist? generateCards called on entering this step
      default:
        return false;
    }
  };

  // handleAddCard function - Updated to use stable data & communicate via parent/service
  const handleAddCard = (card) => {
    if (pendingOperations.addToBank || card.processing) {
      console.log("Add to bank operation already in progress or card processing, ignoring duplicate request");
      return;
    }
    if (!card || !card.id) {
      console.error("handleAddCard: Invalid card data provided:", card);
      setError("Cannot add invalid card data.");
      return;
    }

    setPendingOperations(prev => ({ ...prev, addToBank: true }));
    setGeneratedCards(prev => prev.map(c => 
      c.id === card.id ? {...c, processing: true} : c
    ));

    // CRITICAL: Store stable local variables from form state or props at the time of click
    const localExamBoard = formData.examBoard || examBoard || "General";
    const localExamType = formData.examType || examType || "Course";
    const localSubject = formData.subject || formData.newSubject || initialSubject || "General";
    // Use topic from the *card object itself* first, as it came from generation, fallback to form state
    const localTopic = card.topic || formData.topic || formData.newTopic || initialTopic || "General";
    const topicId = selectedTopic?.id || card.topicId || null; // Prefer ID from selectedTopic object if available
    
    // Ensure the card color is set from topic color if available, or from form data
    const cardColor = topicColor || formData.subjectColor || card.cardColor || BRIGHT_COLORS[0];
    
    const recordIdToUse = recordId || window.recordId || ''; // Get recordId reliably
    const userIdToUse = userId || window.VESPA_USER_ID || "current_user"; // Get userId reliably
    
    debugLog("Adding card with stable metadata", {
      topicId,
      examType: localExamType,
      examBoard: localExamBoard,
      subject: localSubject,
      topic: localTopic, // Use the determined localTopic
      cardId: card.id,
      recordId: recordIdToUse,
      userId: userIdToUse,
      cardColor // Debug the determined color
    });

    try {      
      // Enrich card with guaranteed consistent metadata from stable vars + add timestamps etc.
      const enrichedCard = {
        ...card, // Spread original card data (already processed by service)
        examBoard: localExamBoard, // Overwrite with stable value
        examType: localExamType,   // Overwrite with stable value
        subject: localSubject,     // Overwrite with stable value
        topic: localTopic,         // Overwrite with stable value
        topicId: topicId,          // Add topicId if available
        cardColor: cardColor,      // Ensure card color is set correctly
        subjectColor: cardColor,   // Set subject color for consistency
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        lastReviewed: new Date().toISOString(), // Initialize review dates
        nextReviewDate: new Date().toISOString(),
        boxNum: card.boxNum || 1, // Ensure boxNum exists, starting in box 1 for spaced repetition
        // Ensure options/savedOptions are handled correctly for MCQs
        ...(card.questionType === 'multiple_choice' && {
          options: card.options || card.savedOptions || [],
          savedOptions: card.savedOptions || card.options || [],
          correctAnswer: card.correctAnswer || (card.options ? card.options[0] : null) // Ensure correctAnswer exists
        }),
      };

      // Extract the contrast color from the card color
      enrichedCard.textColor = getContrastColor(cardColor);

      // Remove the temporary processing flag before sending
      delete enrichedCard.processing;

      // --- Communication Method ---
      // Prioritize using the onAddCard prop if provided (likely for direct parent state update)
      let addedLocally = false;
      if (typeof onAddCard === 'function') {
        try {
          onAddCard(enrichedCard);
          console.log("Card passed to onAddCard callback");
          addedLocally = true;
        } catch (callbackError) {
          console.error("Error in onAddCard callback:", callbackError);
          setError(`Error adding card locally: ${callbackError.message}`);
          // Don't necessarily stop the save queue attempt
        }
      }

      // Use Save Queue Service as the primary method for persistence
      console.log("Adding card via Save Queue Service");
      saveQueueService.add("ADD_CARD_TO_BANK", { // Use a specific action type
        recordId: recordIdToUse, // Pass necessary identifiers
        userId: userIdToUse,
        card: enrichedCard // Send the fully enriched card object
      })
      .then(() => {
        console.log(`Card ${enrichedCard.id} added to save queue.`);
        // Update UI optimistically or based on service feedback
        setSuccessModal({ show: true, addedCards: [enrichedCard] }); // Show success
        setTimeout(() => setSuccessModal(prev => ({ ...prev, show: false })), 3000);

        // Remove the card from the generated list after successful queuing
        setGeneratedCards(prev => prev.filter(c => c.id !== card.id));
        setSavedCount(prev => prev + 1); // Increment saved counter
      })
      .catch(queueError => {
        console.error("Error adding card to save queue:", queueError);
        setError(`Failed to queue card for saving: ${queueError.message}`);
        // Revert processing state on the card in UI
        setGeneratedCards(prev => prev.map(c => 
          c.id === card.id ? {...c, processing: false } : c
        ));
      })
      .finally(() => {
        // Always reset the pending operation flag
        setPendingOperations(prev => ({ ...prev, addToBank: false }));
        // Reset card-specific processing flag just in case
        setGeneratedCards(prev => prev.map(c => 
          c.id === card.id ? {...c, processing: false } : c
        ));
      });

    } catch (error) {
      console.error("Error handling add card:", error);
      setError(`Error adding card: ${error.message}. Please try again.`);
      setGeneratedCards(prev => prev.map(c => 
        c.id === card.id ? {...c, processing: false} : c
      ));
      setPendingOperations(prev => ({ ...prev, addToBank: false }));
    }
  };

  // handleAddAllCards function - Updated to use SaveQueueService
  const handleAddAllCards = () => {
    if (pendingOperations.addToBank) {
      console.log("Add all operation already in progress, ignoring duplicate click");
      return;
    }
    if (generatedCards.length === 0) {
      setError("No cards to add.");
      return;
    }
    
    setPendingOperations(prev => ({ ...prev, addToBank: true }));
    // Mark all cards as processing
    setGeneratedCards(prev => prev.map(c => ({...c, processing: true })));
    
    // CRITICAL: Store stable local variables
    const localExamBoard = formData.examBoard || examBoard || "General";
    const localExamType = formData.examType || examType || "Course";
    const localSubject = formData.subject || formData.newSubject || initialSubject || "General";
    // Use topic from the *first card* as representative, fallback to form state
    const localTopic = generatedCards[0]?.topic || formData.topic || formData.newTopic || initialTopic || "General";
    const topicId = selectedTopic?.id || generatedCards[0]?.topicId || null;
    
    // Get color from topic or form data
    const cardColor = topicColor || formData.subjectColor || BRIGHT_COLORS[0];
    
    const recordIdToUse = recordId || window.recordId || '';
    const userIdToUse = userId || window.VESPA_USER_ID || "current_user";

    debugLog("Starting add all cards with stable metadata", {
      examType: localExamType, examBoard: localExamBoard, subject: localSubject, topic: localTopic,
      cardCount: generatedCards.length, recordId: recordIdToUse, userId: userIdToUse,
      cardColor // Log the color being used
    });
    
    try {
      // Enrich all cards consistently before sending
      const cardsToAdd = generatedCards.map(card => {
        const enrichedCard = {
          ...card, // Spread original card data (already processed by service)
          examBoard: localExamBoard,
          subject: localSubject,
          topic: localTopic,
          examType: localExamType,
          topicId: topicId,
          cardColor: cardColor, // Set consistent card color
          subjectColor: cardColor, // Set subject color for consistency
          textColor: getContrastColor(cardColor), // Calculate appropriate text color
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          lastReviewed: new Date().toISOString(), 
          nextReviewDate: new Date().toISOString(),
          boxNum: card.boxNum || 1,
          ...(card.questionType === 'multiple_choice' && {
            options: card.options || card.savedOptions || [],
            savedOptions: card.savedOptions || card.options || [],
            correctAnswer: card.correctAnswer || (card.options ? card.options[0] : null)
          }),
        };
        delete enrichedCard.processing; // Remove temp flag
        return enrichedCard;
      });

      // Use Save Queue Service for batch add
      console.log(`Adding batch of ${cardsToAdd.length} cards via Save Queue Service`);
      saveQueueService.add("ADD_CARDS_BATCH", { // Use a specific batch action type
        recordId: recordIdToUse,
        userId: userIdToUse,
        cards: cardsToAdd // Send the array of enriched cards
      })
      .then(() => {
        console.log(`${cardsToAdd.length} cards added to save queue.`);
        setSuccessModal({ show: true, addedCards: cardsToAdd });
        setTimeout(() => setSuccessModal(prev => ({ ...prev, show: false })), 3000);

        setSavedCount(prev => prev + cardsToAdd.length);
        setGeneratedCards([]); // Clear the list after successful queuing
      })
      .catch(queueError => {
        console.error("Error adding card batch to save queue:", queueError);
        setError(`Failed to queue cards for saving: ${queueError.message}`);
        // Revert processing state on UI
        setGeneratedCards(prev => prev.map(c => ({...c, processing: false })));
      })
      .finally(() => {
        setPendingOperations(prev => ({ ...prev, addToBank: false }));
        // Ensure processing flags are cleared even if some remain
        setGeneratedCards(prev => prev.map(c => ({...c, processing: false })));
      });
    } catch (error) {
      console.error("Error in handleAddAllCards:", error);
      setError(`Error preparing to add cards: ${error.message}`);
      setGeneratedCards(prev => prev.map(c => ({...c, processing: false }))); // Reset processing state
      setPendingOperations(prev => ({ ...prev, addToBank: false }));
    }
  };
  // Modal to show successfully added cards
  const renderSuccessModal = () => {
    if (!successModal.show) return null;
    const count = successModal.addedCards.length;
    
    return (
      <div className="success-modal-overlay">
        <div className="success-modal">
          <div className="success-icon">✓</div>
          <h3>{count} {count === 1 ? 'Card' : 'Cards'} Added!</h3>
          <div className="success-cards">
            {successModal.addedCards.slice(0, 5).map(card => (
              <div key={card.id} className="success-card-item" style={{backgroundColor: card.cardColor || '#ddd'}}>
                <span style={{color: getContrastColor(card.cardColor || '#ddd')}}>{(card.front || card.question || '').substring(0, 40)}...</span>
              </div>
            ))}
            {count > 5 && (
              <div className="success-more">+{count - 5} more</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Regenerate cards using HTTP API
  const handleRegenerateCards = () => {
    console.log("Regenerating cards via HTTP API...");
    if (!isGenerating) {
      generateCards(); // Call the HTTP function
    } else {
      console.log("Already generating, regenerate request ignored.");
    }
  };

  // Reset state after card operations
  const resetAfterCardOperation = () => {
    console.log("Resetting state after card operation.");
    setSavedCount(0);
    setOperationSuccess(false);
  };

  // Main function to render content based on currentStep
  const renderStepContent = () => {
    if (skipMetadataSteps) {
      if (currentStep === 4) {
        return (
          <div>
            <h4>Card Options</h4>
            <label>Number of Cards:</label>
            <input 
              type="number" 
              name="numCards" 
              value={formData.numCards} 
              onChange={handleChange}
              min="1" 
              max="20"
            />
            <label>Question Type:</label>
            <select name="questionType" value={formData.questionType} onChange={handleChange}>
              {QUESTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
        );
      }
      if (currentStep === 5) {
        return (
          <div>
            <h4>Review & Add Cards</h4>
            {isGenerating && loadingStatus && <div>{loadingStatus}... <div className="spinner"></div></div>}
            {error && <div className="error-message">{error}</div>}
            <div className="generated-cards-container">
              {(() => {
                if (!Array.isArray(generatedCards)) {
                  console.error("generatedCards is not an array", generatedCards);
                  return <div>Error: generatedCards is not an array.</div>;
                }
                if (generatedCards.length > 0 && !isGenerating) {
                  console.log("Rendering generatedCards:", generatedCards);
                  return generatedCards.map((card, index) => {
                    if (!card) {
                      console.error("Null/undefined card at index", index, generatedCards);
                      return <div key={index} style={{ color: 'red' }}>Error: Card is undefined/null at index {index}.</div>;
                    }
                    if (!card.id || !card.front) {
                      console.error("Invalid card object at index", index, card);
                      return <div key={index} style={{ color: 'red' }}>Error: Card missing id or front at index {index}.</div>;
                    }
                    return (
                      <div key={card.id || index} className="generated-card-review-item">
                        {/* Basic card preview - could use Flashcard component */}
                        <div className="card-preview" style={{ borderLeft: `5px solid ${card.cardColor}` }}>
                          <strong>Q:</strong> {card.front?.substring(0, 100)}{card.front?.length > 100 ? '...' : ''} <br />
                          <strong>A:</strong> {card.back?.substring(0, 100)}{card.back?.length > 100 ? '...' : ''}
                        </div>
                        <button onClick={() => handleAddCard(card)} disabled={pendingOperations.addToBank || card.processing}>
                          {card.processing ? 'Adding...' : 'Add This Card'}
                        </button>
                      </div>
                    );
                  });
                } else {
                  if (!isGenerating) {
                    return <div>No cards generated yet.</div>;
                  }
                  return null;
                }
              })()}
            </div>
            {generatedCards.length > 0 && !isGenerating && (
              <div className="card-actions">
                <button onClick={handleAddAllCards} disabled={pendingOperations.addToBank || isGenerating}>
                  Add All {generatedCards.length} Cards
                </button>
                <button onClick={handleRegenerateCards} disabled={pendingOperations.addToBank || isGenerating}>
                  Regenerate Cards
                </button>
              </div>
            )}
            {savedCount > 0 && <div className="saved-count-indicator">{savedCount} card(s) added.</div>}
          </div>
        );
      }
      return null;
    }
    switch (currentStep) {
      case 1: // Exam Details
        return (
          <div>
            <h4>Step 1: Exam Details</h4>
            {/* Exam Board Dropdown */}
            <label>Exam Board:</label>
            <select name="examBoard" value={formData.examBoard} onChange={handleChange}>
              <option value="">Select Board</option>
              {EXAM_BOARDS.map(board => <option key={board.value} value={board.value}>{board.label}</option>)}
            </select>
            {/* Exam Type Dropdown */}
            <label>Exam Type:</label>
            <select name="examType" value={formData.examType} onChange={handleChange}>
              <option value="">Select Type</option>
              {EXAM_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
        );
      case 2: // Subject Selection
        return (
          <div>
            <h4>Step 2: Subject</h4>
            {/* Subject Dropdown */}
            <label>Subject:</label>
            <select name="subject" value={formData.subject} onChange={handleChange}>
              <option value="">Select Subject</option>
              {availableSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
            {/* OR New Subject Input */}
            <label>Or Add New Subject:</label>
            <input
              type="text"
              name="newSubject"
              value={formData.newSubject}
              onChange={handleChange}
              placeholder="e.g., Astrophysics"
            />
          </div>
        );
      case 3: // Topic Selection/Generation
        return (
          <div>
            <h4>Step 3: Topic</h4>
            {isGenerating && loadingStatus && <div>{loadingStatus}... <div className="spinner"></div></div>}
            {error && <div className="error-message">{error}</div>}
            {availableTopics.length > 0 && !isGenerating && (
              <>
                {/* Topic Dropdown */}
                <label>Select Topic:</label>
                <select name="topic" value={formData.topic} onChange={handleChange}>
                  <option value="">Select Topic</option>
                  {availableTopics.map(t => (
                    <option key={t.id || t.topic} value={t.id || t.topic}>
                      {t.topic} {t.subtopic ? `(${t.subtopic})` : ''}
                    </option>
                  ))}
                </select>
                {/* OR New Topic Input */}
                <label>Or Add New Topic:</label>
                <input
                  type="text"
                  name="newTopic"
                  value={formData.newTopic}
                  onChange={handleChange}
                  placeholder="e.g., Black Holes"
                />
                {/* Optionally, button to regenerate topics */}
                <button onClick={() => generateTopics(formData.examBoard, formData.examType, formData.subject || formData.newSubject)} disabled={isGenerating}>
                  Regenerate Topics
                </button>
              </>
            )}
            {/* Show if topics haven't loaded and not currently generating */}
            {!isGenerating && availableTopics.length === 0 && !error && (
              <div>No topics generated yet. Check Subject/Exam details or try regenerating.</div>
            )}
            {/* Button to trigger generation if not auto-triggered */}
            {!isGenerating && availableTopics.length === 0 && !error && (
              <button onClick={() => generateTopics(formData.examBoard, formData.examType, formData.subject || formData.newSubject)} disabled={!(formData.subject || formData.newSubject)}>
                Generate Topics Now
              </button>
            )}
          </div>
        );
      case 4: // Card Options
        return (
          <div>
            <h4>Step 4: Card Options</h4>
            {/* Display selected metadata if skipping steps */}
            {skipMetadataSteps && (
              <div className="metadata-summary">
                <p><strong>Subject:</strong> {formData.subject}</p>
                <p><strong>Topic:</strong> {formData.topic}</p>
              </div>
            )}
            {/* Number of Cards Input */}
            <label>Number of Cards:</label>
            <input 
              type="number" 
              name="numCards" 
              value={formData.numCards} 
              onChange={handleChange}
              min="1" 
              max="20" // Set a reasonable max
            />
            {/* Question Type Dropdown */}
            <label>Question Type:</label>
            <select name="questionType" value={formData.questionType} onChange={handleChange}>
              {QUESTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
        );
      case 5: // Review Generated Cards
        return (
          <div>
            <h4>Step 5: Review & Add Cards</h4>
            {isGenerating && loadingStatus && <div>{loadingStatus}... <div className="spinner"></div></div>}
            {error && <div className="error-message">{error}</div>}
            <div className="generated-cards-container">
              {(() => {
                if (!Array.isArray(generatedCards)) {
                  console.error("generatedCards is not an array", generatedCards);
                  return <div>Error: generatedCards is not an array.</div>;
                }
                if (generatedCards.length > 0 && !isGenerating) {
                  console.log("Rendering generatedCards:", generatedCards);
                  return generatedCards.map((card, index) => {
                    if (!card) {
                      console.error("Null/undefined card at index", index, generatedCards);
                      return <div key={index} style={{ color: 'red' }}>Error: Card is undefined/null at index {index}.</div>;
                    }
                    if (!card.id || !card.front) {
                      console.error("Invalid card object at index", index, card);
                      return <div key={index} style={{ color: 'red' }}>Error: Card missing id or front at index {index}.</div>;
                    }
                    return (
                      <div key={card.id || index} className="generated-card-review-item">
                        {/* Basic card preview - could use Flashcard component */}
                        <div className="card-preview" style={{ borderLeft: `5px solid ${card.cardColor}` }}>
                          <strong>Q:</strong> {card.front?.substring(0, 100)}{card.front?.length > 100 ? '...' : ''} <br />
                          <strong>A:</strong> {card.back?.substring(0, 100)}{card.back?.length > 100 ? '...' : ''}
                        </div>
                        <button onClick={() => handleAddCard(card)} disabled={pendingOperations.addToBank || card.processing}>
                          {card.processing ? 'Adding...' : 'Add This Card'}
                        </button>
                      </div>
                    );
                  });
                } else {
                  if (!isGenerating) {
                    return <div>No cards generated yet.</div>;
                  }
                  return null;
                }
              })()}
            </div>
            {generatedCards.length > 0 && !isGenerating && (
              <div className="card-actions">
                <button onClick={handleAddAllCards} disabled={pendingOperations.addToBank || isGenerating}>
                  Add All {generatedCards.length} Cards
                </button>
                <button onClick={handleRegenerateCards} disabled={pendingOperations.addToBank || isGenerating}>
                  Regenerate Cards
                </button>
              </div>
            )}
            {savedCount > 0 && <div className="saved-count-indicator">{savedCount} card(s) added.</div>}
          </div>
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  // Close handler
  const handleClose = () => {
    console.log("AICardGenerator closing.");
    // Reset state
    setGeneratedCards([]);
    setAvailableTopics([]);
    setError(null);
    setIsGenerating(false);
    setLoadingStatus('');
    // Call the onClose prop if provided
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  // Log props for debugging
  console.log("AICardGenerator props", props);

  return (
    <div className="ai-card-generator-modal">
      {renderSuccessModal()} {/* Render success modal */}
      <div className="modal-content">
        <button className="close-button" onClick={handleClose}>×</button>
        <h2>AI Flashcard Generator</h2>

        {/* Progress Indicator - hide if skipMetadataSteps */}
        {!skipMetadataSteps && (
          <div className="progress-indicator">
            Step {currentStep} of {totalSteps}
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${(currentStep / totalSteps) * 100}%` }}></div>
            </div>
          </div>
        )}
    
        {/* Render content for the current step */}
        <div className="step-content">
          {renderStepContent()}
        </div>
    
        {/* Display general errors */}
        {error && currentStep !== 5 && <div className="error-message general-error">{error}</div>}

        {/* Navigation Buttons - modify for skipMetadataSteps */}
        <div className="navigation-buttons">
          {/* Only show Previous button if not skipping metadata or if on review step */}
          {(!skipMetadataSteps || currentStep === 5) && (
            <button onClick={handlePrevStep} disabled={currentStep === 1 || (skipMetadataSteps && currentStep === 4)}>
              Previous
            </button>
          )}
          <button onClick={handleNextStep} disabled={currentStep === totalSteps || isGenerating || !canProceed()}>
            {currentStep === totalSteps -1 ? 'Generate & Review Cards' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICardGenerator;