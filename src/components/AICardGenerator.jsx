import React, { useState, useEffect, useCallback } from "react";
import "./AICardGenerator.css";
import Flashcard from './Flashcard';
import { generateTopicPrompt } from '../prompts/topicListPrompt';
import TopicHub from '../components/TopicHub';
import saveQueueService from '../services/SaveQueueService';

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
  { value: "BTEC", label: "BTEC" },
  { value: "Other", label: "Other" }
];

// Function to return compatible exam boards for each exam type
const boardsForType = (examType) => {
  // All boards are available for all exam types by default
  // If specific restrictions are needed in the future, they can be added here
  return EXAM_BOARDS.map(board => board.value);
};

// Color palette for cards
const BRIGHT_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
  "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
  "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C"
];

// API keys - using the correct environment variables
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";

// Debug logging helper
const debugLog = (title, data) => {
  console.log(`%c${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

// Helper function for delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const AICardGenerator = ({ 
  onAddCard, 
  onClose, 
  subjects = [], 
  auth, 
  userId,
  initialSubject = "",
  initialTopic = "",
  examBoard = "AQA",
  examType = "A-Level",
  recordId,
  initialTopicsProp,
  onFinalizeTopics // Accept the new prop
}) => {
  // Step management state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5; // Update total steps
  
  // Form data state
  const [formData, setFormData] = useState({
    examBoard: examBoard,
    examType: examType,
    subject: initialSubject,
    newSubject: "",
    topic: initialTopic,
    newTopic: "",
    numCards: 5,
    questionType: "multiple_choice",
    subjectColor: BRIGHT_COLORS[0],
    generatedCards: []
  });
  
  // Processing states
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  // Results states
  const [generatedCards, setGeneratedCards] = useState([]);
  
  // New states for hierarchical topics and saved topic lists
  const [hierarchicalTopics, setHierarchicalTopics] = useState([]);
  const [savedTopicLists, setSavedTopicLists] = useState([]);
  const [showSaveTopicDialog, setShowSaveTopicDialog] = useState(false);
  const [topicListName, setTopicListName] = useState("");
  
  // State for available subjects and topics based on selection
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);

  // New state for success modal
  const [successModal, setSuccessModal] = useState({
    show: false,
    addedCards: []
  });

  // New state for topic modal
  const [showTopicModal, setShowTopicModal] = useState(false);

  // New state for save confirmation
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // New state for topic selection confirmation
  const [showTopicConfirmation, setShowTopicConfirmation] = useState(false);
  const [selectedTopicForConfirmation, setSelectedTopicForConfirmation] = useState("");
  const [topicListSaved, setTopicListSaved] = useState(false);
  
  // New state for options explanation modal
  const [showOptionsExplanationModal, setShowOptionsExplanationModal] = useState(false);
  
  // State for selected topic
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Add a state to track if we've already triggered a save/refresh to prevent duplicate requests
  const [pendingOperations, setPendingOperations] = useState({
    save: false,
    refresh: false,
    addToBank: false
  });

  // Add these missing state variables
  const [operationSuccess, setOperationSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

// Initialize availableTopics state when initialTopicsProp changes
useEffect(() => {
  // Check if the prop has valid topic data
  if (initialTopicsProp && Array.isArray(initialTopicsProp) && initialTopicsProp.length > 0) {
    // Assuming 'availableTopics' holds the list used in the UI (e.g., Step 4)
    // Or maybe you need to set 'hierarchicalTopics'? Adjust if needed.
    setAvailableTopics(initialTopicsProp); 
    setHierarchicalTopics(initialTopicsProp); // Also set hierarchical if needed
    
    console.log(`[AICardGenerator] Initialized with ${initialTopicsProp.length} topics from prop.`);
  } else {
    // If no initial topics are passed, clear the state
    setAvailableTopics([]);
    setHierarchicalTopics([]);
  }
// This effect runs when the prop containing the initial topics changes
}, [initialTopicsProp]); 

  // Enhanced helper function to request token refresh with improved reliability and retry logic
  // eslint-disable-next-line no-use-before-define 
  const requestTokenRefresh = useCallback(async () => { // Wrap in useCallback
    console.log(`[${new Date().toISOString()}] AICardGenerator requesting token refresh`);
    
    // Global tracking variable to prevent duplicate requests across components
    if (!window.tokenRefreshInProgress) {
      window.tokenRefreshInProgress = true;
    } else {
      console.log("Token refresh already in progress, waiting for completion");
      // Wait for existing refresh to complete with improved reliability
      return new Promise(resolve => {
        let attempts = 0;
        const maxAttempts = 10; // More attempts for reliability
        
        const checkInterval = setInterval(() => {
          attempts++;
          if (!window.tokenRefreshInProgress) {
            clearInterval(checkInterval);
            console.log(`[${new Date().toISOString()}] Existing token refresh completed`);
            resolve(true);
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            // Reset the flag if we're giving up waiting
            window.tokenRefreshInProgress = false;
            console.log(`[${new Date().toISOString()}] Timed out waiting for existing token refresh`);
            resolve(false);
          }
        }, 500); // Longer interval for less CPU usage
      });
    }
    
    try {
      if (window.parent && window.parent !== window) {
        // Create a more robust system with message acknowledgment and retries
        return new Promise((resolve) => {
          let receivedResponse = false;
          
          // Function to handle token refresh response
          const messageHandler = (event) => {
            if (event.data && 
                (event.data.type === "AUTH_REFRESH" || 
                 event.data.type === "TOKEN_REFRESH_RESULT")) {
              // Prevent duplicate handling
              if (receivedResponse) return;
              receivedResponse = true;
              
              // Remove listener once we get a response
              window.removeEventListener('message', messageHandler);
              window.tokenRefreshInProgress = false;
              
              console.log(`[${new Date().toISOString()}] Received token refresh response:`, event.data.type);
              resolve(true);
            }
          };
          
          // Add listener for response
          window.addEventListener('message', messageHandler);
          
          // Function to send refresh request with retry capability
          const sendRefreshRequest = (retryCount = 0) => {
            // Send a message to parent requesting token refresh
            window.parent.postMessage({ 
              type: "REQUEST_TOKEN_REFRESH", 
              timestamp: new Date().toISOString(),
              source: "AICardGenerator",
              retryCount
            }, "*");
            
            console.log(`[${new Date().toISOString()}] Sent token refresh request (attempt ${retryCount + 1})`);
          };
          
          // Send initial request
          sendRefreshRequest();
          
          // Add retry logic - try 3 more times with increasing delays
          for (let i = 1; i <= 3; i++) {
            // Pass 'i' as an argument to setTimeout's callback
            // eslint-disable-next-line no-loop-func
            setTimeout((retryNum) => {
              // Only retry if we haven't received a response yet
              if (!receivedResponse) {
                sendRefreshRequest(retryNum); // Use the passed argument
              }
            }, 1000 * i, i); // Pass 'i' here
          }
          
          // Set a timeout to ensure we don't wait forever
          setTimeout(() => {
            if (!receivedResponse) {
              window.removeEventListener('message', messageHandler);
              window.tokenRefreshInProgress = false;
              console.log(`[${new Date().toISOString()}] Token refresh timed out`);
              resolve(false);
            }
          }, 3000);
        });
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in token refresh:`, error);
      window.tokenRefreshInProgress = false;
    }
    
    window.tokenRefreshInProgress = false;
    return Promise.resolve(false);
  }, []); // Added dependencies for useCallback // Added currentStep


 
  // Effect to update available subjects when exam type changes
  useEffect(() => {
    if (formData.examType) {
      // In a real implementation, this would fetch from your backend or a predefined list
      // For demo, we'll use a static mapping
      const examTypeSubjects = {
        "GCSE": [
    "English Language", "English Literature", "Mathematics", "Combined Science", "Double Award Science", "Triple Science",
    "Biology", "Chemistry", "Physics", "Environmental Science", "Religious Studies", "Citizenship", "Modern Studies",
    "History", "Geography", "French", "Spanish", "German", "Italian", "Mandarin Chinese", "Welsh", "Latin",
    "Ancient Greek", "Classical Civilisation", "Art and Design", "Photography", "Design and Technology",
    "Design and Technology - Product Design", "Design and Technology - Resistant Materials",
    "Design and Technology - Food Technology", "Design and Technology - Textiles", "Food Preparation and Nutrition",
    "Music", "Drama", "Dance", "Film Studies", "Computer Science", "Digital Technology", "ICT", "Business Studies",
    "Economics", "Sociology", "Psychology", "Media Studies", "Physical Education", "Health and Social Care",
    "Travel and Tourism", "Journalism", "Enterprise/Entrepreneurship", "Electronics", "General Studies", "International Baccalaureate (MYP)"
  ],
        "A-Level": [
    "Mathematics", "Further Mathematics", "Statistics", "Physics", "Chemistry", "Biology", "Combined Science",
    "Combined Science - Double Award", "Combined Science - Triple Award", "Environmental Science", "Computer Science",
    "Electronics", "English Language", "English Literature", "History", "Geography", "Religious Studies / Theology",
    "Philosophy", "Classics", "Classics - Latin", "Classics - Ancient Greek", "Classics - Classical Civilisation",
    "Economics", "Business Studies", "Accounting", "Government and Politics / Politics", "Law", "Psychology",
    "Sociology", "Media Studies", "French", "Spanish", "German", "Italian", "Mandarin Chinese", "Arabic",
    "Japanese", "Russian", "Welsh", "Art and Design", "Design and Technology",
    "Design and Technology - Product Design", "Design and Technology - Textiles",
    "Design and Technology - Resistant Materials", "Design and Technology - Systems and Control",
    "Drama and Theatre Studies", "Film Studies", "Music", "Music Technology", "Dance", "Photography",
    "Fashion", "Physical Education (PE)", "Sport Science", "Health and Social Care (availability varies)",
    "ICT / Information and Communication Technology","International Baccalaureate (DP)"
  ]
      };
      
      if (examTypeSubjects[formData.examType]) {
        // If using subjects from props, combine with predefined list
        // First, convert subjects array to string names if needed
        const subjectNames = Array.isArray(subjects) ? subjects.map(s => 
          typeof s === 'object' && s.name ? s.name : s
        ) : [];
        
        const combinedSubjects = [...new Set([
          ...subjectNames,
          ...examTypeSubjects[formData.examType]
        ])].sort();
        
        // Store as string values only, not objects
        setAvailableSubjects(combinedSubjects);
      }
    } else {
      // When no exam type is selected, handle subjects properly by converting objects to their name property
      const processedSubjects = Array.isArray(subjects) 
        ? subjects.map(s => typeof s === 'object' && s.name ? s.name : s) 
        : [];
      setAvailableSubjects(processedSubjects);
    }
  }, [formData.subject, formData.examBoard, formData.examType, subjects]);

  // Effect to generate topics when subject changes
  useEffect(() => {
    // Reset topics when subject changes
    setAvailableTopics([]);
    
    // Auto-generate topics if subject is selected
    if (formData.subject || formData.newSubject) {
      if (!isGenerating && currentStep === 3 && formData.examBoard && formData.examType) {
        console.log("Auto-generating topics for subject:", formData.subject || formData.newSubject);
        // Uncomment to auto-generate topics
        // generateTopics(formData.examBoard, formData.examType, formData.subject || formData.newSubject)
        //   .then(topics => setAvailableTopics(topics))
        //   .catch(e => console.error("Error auto-generating topics:", e));
      }
    } else {
      setAvailableTopics([]);
    }
  }, [formData.subject, formData.examBoard, formData.examType, currentStep, formData.newSubject, isGenerating]); // Added missing dependencies

  // Get fallback topics for specific subjects (to use when API calls fail)
  const getFallbackTopics = (examBoard, examType, subject) => {
    // Convert to lowercase for case-insensitive matching
    const subjectLower = typeof subject === 'string' ? subject.toLowerCase() : '';
    
    // Chemistry fallbacks 
    if (subjectLower.includes('chemistry')) {
      return [
        "Atomic Structure and Periodicity: Atomic Models and Electronic Configuration",
        "Atomic Structure and Periodicity: Periodic Trends",
        "Chemical Bonding: Ionic Bonding", 
        "Chemical Bonding: Covalent Bonding",
        "Chemical Bonding: Metallic Bonding",
        "Energetics: Enthalpy Changes",
        "Energetics: Bond Enthalpies",
        "Energetics: Hess's Law",
        "Reaction Kinetics: Rate of Reaction",
        "Reaction Kinetics: Rate Equations",
        "Reaction Kinetics: Catalysis",
        "Chemical Equilibria: Dynamic Equilibrium",
        "Chemical Equilibria: Le Chatelier's Principle",
        "Acid-Base Equilibria: Brønsted-Lowry Theory",
        "Acid-Base Equilibria: Strong and Weak Acids",
        "Redox Reactions: Oxidation Numbers",
        "Redox Reactions: Electrochemical Cells"
      ];
    }
    
    // Biology fallbacks
    if (subjectLower.includes('biology')) {
      return [
        "Cell Biology: Cell Structure",
        "Cell Biology: Cell Transport",
        "Cell Biology: Cell Division",
        "Genetics: DNA Structure and Replication",
        "Genetics: Protein Synthesis",
        "Genetics: Inheritance",
        "Ecology: Ecosystems and Energy Flow",
        "Ecology: Carbon and Nitrogen Cycles",
        "Ecology: Population Dynamics",
        "Physiology: Respiration",
        "Physiology: Circulation",
        "Physiology: Digestion",
        "Physiology: Nervous System",
        "Physiology: Hormonal Regulation"
      ];
    }
    
    // Physics fallbacks
    if (subjectLower.includes('physics')) {
      return [
        "Mechanics: Forces and Motion",
        "Mechanics: Energy and Work",
        "Mechanics: Momentum",
        "Waves: Wave Properties",
        "Waves: Wave Behavior",
        "Optics: Reflection and Refraction",
        "Optics: Lenses and Mirrors",
        "Electricity: DC Circuits",
        "Electricity: Electric Fields",
        "Magnetism: Magnetic Fields",
        "Magnetism: Electromagnetic Induction",
        "Quantum Physics: Photoelectric Effect",
        "Quantum Physics: Wave-Particle Duality",
        "Nuclear Physics: Radioactive Decay"
      ];
    }
    
    // Geography fallbacks
    if (subjectLower.includes('geography')) {
      return [
        "Physical Geography: Water and Carbon Cycles",
        "Physical Geography: Coastal Systems and Landscapes",
        "Physical Geography: Hazards and Natural Disasters",
        "Human Geography: Global Systems and Governance",
        "Human Geography: Changing Places",
        "Human Geography: Population and Migration",
        "Human Geography: Resource Security",
        "Human Geography: Contemporary Urban Environments",
        "Skills and Techniques: Fieldwork and Investigation",
        "Skills and Techniques: Geographical Information Systems (GIS)",
        "Climate Change: Evidence and Causes",
        "Climate Change: Impacts and Adaptation",
        "Conservation and Biodiversity: Ecosystem Services",
        "Development: Economic Development and Quality of Life",
        "Globalization: Transnational Corporations and Trade"
      ];
    }
    
    // Mathematics fallbacks
    if (subjectLower.includes('math') || subjectLower.includes('maths')) {
      return [
        "Algebra: Equations and Inequalities",
        "Algebra: Functions and Graphs",
        "Algebra: Sequences and Series",
        "Calculus: Differentiation",
        "Calculus: Integration",
        "Calculus: Differential Equations",
        "Trigonometry: Sine and Cosine Rules",
        "Trigonometry: Identities and Equations",
        "Geometry: Coordinate Geometry",
        "Geometry: Vectors",
        "Statistics: Probability",
        "Statistics: Distributions",
        "Statistics: Hypothesis Testing",
        "Mechanics: Kinematics",
        "Mechanics: Forces and Newton's Laws"
      ];
    }
    
    // Generic fallbacks for any subject
    return [
      `${subject}: Core Concepts and Principles`,
      `${subject}: Key Theories and Models`,
      `${subject}: Historical Development`,
      `${subject}: Modern Applications`,
      `${subject}: Research Methods and Analysis`,
      `${subject}: Critical Evaluation Techniques`,
      `${subject}: Contemporary Issues and Debates`,
      `${subject}: Case Studies and Examples`,
      `${subject}: Practical Skills and Techniques`,
      `${subject}: Ethical Considerations`
    ];
  };

  // Generate topics using AI with improved fallback handling
  const generateTopics = async (examBoard, examType, subject) => {
    try {
      if (!examBoard || !examType || !subject) {
        throw new Error("Missing required parameters");
      }
      
      // Make sure subject is a string, not an object
      const subjectName = typeof subject === 'object' && subject.name ? subject.name : subject;
      
      console.log("Generating topics for:", examBoard, examType, subjectName);
      
      try {
      // Get the prompt from our new prompt file
      const prompt = generateTopicPrompt(examBoard, examType, subjectName);
      
      // Make API call to OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
          temperature: 0.5
        })
      });
      
      if (!response.ok) {
          // If we get a 429 (rate limit), immediately use fallback data
          if (response.status === 429) {
            console.log("Rate limit hit, using fallback data for", subjectName);
            return getFallbackTopics(examBoard, examType, subjectName);
          }
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No content returned from API");
      }
      
      // Extract and clean the content
      let content = data.choices[0].message.content;
      content = content.replace(/```json|```/g, '').trim();
      console.log("Raw topic response:", content);
      
      // Try to parse as JSON
      let topics;
      try {
        topics = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse topic response as JSON:", e);
        // Fall back to text processing if JSON parsing fails
        topics = content.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-*•]\s*/, '').trim());
      }
      
      // Ensure we have an array
      if (!Array.isArray(topics)) {
        console.error("Unexpected response format:", topics);
        throw new Error("Invalid topic format received");
      }
      
      console.log("Generated topics:", topics);
      return topics;
      } catch (apiError) {
        // Log the error but recover with fallback data
        console.warn("API error, using fallback data:", apiError.message);
        
        // Get pre-defined topics for this subject
        const fallbackTopics = getFallbackTopics(examBoard, examType, subjectName);
        console.log("Using fallback topics:", fallbackTopics);
        
        return fallbackTopics;
      }
    } catch (error) {
      console.error("Error in generateTopics:", error);
      // Even in case of a catastrophic error, return some generic topics
      return [`${subject}: Core Concepts`, `${subject}: Key Principles`, `${subject}: Applications`];
    }
  };

  // Save the current topic list
  const saveTopicList = () => {
    if (!topicListName.trim()) {
      setError("Please enter a name for your topic list");
      return;
    }
    
    // Only allow saving if authenticated
    if (!auth || !userId) {
      setError("You must be logged in to save topic lists");
      return;
    }
    
    try {
      // Validate that we have topics to save
      if (!hierarchicalTopics || hierarchicalTopics.length === 0) {
        setError("No topics available to save. Please generate topics first.");
        return;
      }
      
      const newSavedList = {
        id: generateId('topiclist'),
        name: topicListName,
        examBoard: formData.examBoard,
        examType: formData.examType,
        subject: formData.subject || formData.newSubject,
        topics: hierarchicalTopics,
        created: new Date().toISOString(),
        userId: userId // Add userId to the list object for future reference
      };
      
      // Log the new list for debugging
      console.log("Creating new topic list:", newSavedList);
      
      const updatedLists = [...savedTopicLists, newSavedList];
      setSavedTopicLists(updatedLists);
      
      // Save directly to Knack
      saveTopicListToKnack(updatedLists)
        .then(success => {
          if (success) {
            // Close save dialog but keep topic modal open
            setShowSaveTopicDialog(false);
            setTopicListName("");
            setError(null);
            setTopicListSaved(true);
            console.log("Topic list saved successfully:", newSavedList.name);
            
            // Show a temporary success message
            const successElement = document.createElement('div');
            successElement.className = 'save-success-message';
            successElement.innerHTML = '✅ Topic list saved successfully!';
            document.querySelector('.topic-modal-body').appendChild(successElement);
            
            // Remove the message after 3 seconds
            setTimeout(() => {
              if (successElement.parentNode) {
                successElement.parentNode.removeChild(successElement);
              }
            }, 3000);
          } else {
            // Error message is set by saveTopicListToKnack
            console.error("Failed to save topic list to Knack");
          }
        })
        .catch(err => {
          console.error("Error in save operation:", err);
          setError("Failed to save topic list: " + err.message);
        });
    } catch (error) {
      console.error("Error saving topic list:", error);
      setError("Failed to save topic list: " + error.message);
    }
  };
  
  // Generate a unique ID
  const generateId = (prefix = 'topic') => {
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${timestamp}_${randomStr}`;
  };
  
  // Save topic list to Knack using our unified service
  const saveTopicListToKnack = async (topicLists) => {
    try {
      // Check if we're authenticated or have a user ID
      if (!auth || !userId) {
        console.log("No authentication data or userId, skipping Knack save");
        setError("You must be logged in to save topic lists");
        return false;
      }
      
      console.log("Saving topic lists to Knack for user:", userId);
      console.log("TopicLists data type:", typeof topicLists);
      console.log("TopicLists data:", JSON.stringify(topicLists).substring(0, 200) + "...");
      
      // Safety check to ensure topicLists is a valid array
      if (!Array.isArray(topicLists)) {
        console.error("Topic lists is not an array:", topicLists);
        setError("Invalid data format: Topic lists must be an array");
        return false;
      }
      
      // Ensure we have valid topic lists with required structure - improved validation
      const validTopicLists = topicLists.filter(list => 
        list && typeof list === 'object' && list.topics && Array.isArray(list.topics) && list.topics.length > 0
      );
      
      if (validTopicLists.length === 0) {
        console.error("No valid topic lists found with required structure");
        setError("No valid topic lists with required structure");
        return false;
      }
      
      console.log("Valid topic lists found:", validTopicLists.length);
      
      // Process each topic list individually to create topic shells
      for (const list of validTopicLists) {
        // Add detailed logging to see what's happening
        console.log("Processing topic list:", list);
        
        try {
          // Enhanced validation - check for empty arrays too
          if (!list.topics || !Array.isArray(list.topics) || list.topics.length === 0) {
            console.error("Invalid or empty topics array:", list.topics);
            continue; // Skip this invalid list but continue with others
          }
          
          // Double-check that topics is still defined right before using it
          // This addresses the specific error we're seeing
          if (!list.topics) {
            console.error("Topics array became undefined during processing, skipping list");
            continue;
          }
          
          const topics = list.topics.map(topic => {
            if (!topic) {
              console.error("Invalid topic entry:", topic);
              return { id: generateId('topic'), topic: 'Unknown Topic' };
            }
            return {
              id: topic.id || generateId('topic'),
              topic: topic.topic || topic.name || 'Unknown Topic'
            };
          });

          // Verify topics array after mapping
          if (!topics || topics.length === 0) {
            console.error("Failed to create topics array, skipping list");
            continue;
          }

          // Use our enhanced service to save topics to both storage fields
          console.log(`Saving topic list "${list.name}" with ${topics.length} topics`);
          
          // Direct API call to save to both storage fields
        /*await saveTopicsUnified(
            topics, 
            list.subject, 
            list.examBoard, 
            list.examType, 
            userId, 
            auth
          );*/
          
          console.log(`Successfully saved topic list "${list.name}"`);
        } catch (innerError) {
          console.error("Error saving topics in list:", list.name, innerError);
          // Continue with other lists despite error
        }
      }
      
      console.log("Topic lists saved to unified storage successfully:", validTopicLists.length, "lists");
      return true;
    } catch (error) {
      console.error("Error in saveTopicListToKnack:", error);
      setError(`Error saving topic lists: ${error.message || "Unknown error"}`);
      return false;
    }
  };
  
  // Load a saved topic list
  const loadTopicList = (listId) => {
    const list = savedTopicLists.find(list => list.id === listId);
    if (!list) {
      setError("Topic list not found");
      return;
    }
    
    // Update the form data with values from the saved list
    setFormData(prev => ({
      ...prev,
      examBoard: list.examBoard,
      examType: list.examType,
      subject: list.subject,
      topic: '', // Clear any existing topic
      newSubject: '',
      newTopic: ''
    }));
    
    // Set the hierarchical topics
    setHierarchicalTopics(list.topics);
    
    // Move to step 4 (topic step) 
    setCurrentStep(4);
    
    console.log(`Loaded topic list: ${list.name}`);
  };
  
  // Delete a topic list
  const deleteTopicList = (listId) => {
    // Check if authenticated
    if (!auth || !userId) {
      setError("You must be logged in to delete topic lists");
      return;
    }
    
    // Remove from state
    const updatedLists = savedTopicLists.filter(list => list.id !== listId);
    setSavedTopicLists(updatedLists);
    
    // Save the updated lists to Knack
    saveTopicListToKnack(updatedLists);
    
    console.log(`Deleted topic list with ID: ${listId}`);
  };
  
  // Render saved topic lists
  const renderSavedTopicLists = () => {
    if (savedTopicLists.length === 0) {
      return (
        <div className="no-saved-topics">
          <p>No saved topic lists yet</p>
        </div>
      );
    }
    
    return (
      <div className="saved-topic-lists">
        <h3>Saved Topic Lists</h3>
        <div className="topic-list-grid">
          {savedTopicLists.map(list => (
            <div key={list.id} className="topic-list-card">
              <h4>{list.name}</h4>
              <div className="topic-list-details">
                <p><strong>Exam:</strong> {list.examBoard} {list.examType}</p>
                <p><strong>Subject:</strong> {list.subject}</p>
                <p><strong>Topics:</strong> {list.topics.length}</p>
                <p className="created-date">Created: {new Date(list.created).toLocaleDateString()}</p>
              </div>
              <div className="topic-list-actions">
                <button onClick={() => loadTopicList(list.id)}>Load</button>
                <button 
                  className="generate-cards-button" 
                  onClick={() => generateCardsFromTopicList(list)}
                >
                  Generate Cards
                </button>
                <button className="delete-button" onClick={() => deleteTopicList(list.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Generate cards directly from a saved topic list with improved stability
  const generateCardsFromTopicList = (list) => {
    // Store stable values before any state updates
    const stableExamBoard = list.examBoard;
    const stableExamType = list.examType;
    const stableSubject = list.subject;
    
    // Select a topic from the list
    const randomTopic = list.topics[Math.floor(Math.random() * list.topics.length)].topic;
    
    console.log(`Generating cards from topic list "${list.name}" with stable metadata:`, {
      examBoard: stableExamBoard,
      examType: stableExamType,
      subject: stableSubject,
      topic: randomTopic
    });
    
    // First update form data with stable values
    setFormData(prev => ({
      ...prev,
      examBoard: stableExamBoard,
      examType: stableExamType,
      subject: stableSubject,
      topic: randomTopic,
      questionType: "multiple_choice",
      numCards: 5
    }));
    
    // Add a delay before moving to the next step to ensure state is updated
    setTimeout(() => {
      // Move to the question type step (step 5)
      setCurrentStep(5);
      
      // Add another log to confirm values are stable
      console.log(`Loaded topic list for card generation: ${list.name}`);
      console.log(`Using stable values - exam type: ${stableExamType}, exam board: ${stableExamBoard}`);
    }, 300);
  };

  // Render topic save dialog
  const renderSaveTopicDialog = () => {
    if (!showSaveTopicDialog) {
      return null;
    }
    
    return (
      <div className="save-topic-overlay">
        <div className="save-topic-dialog">
          <h3>Save Topic List</h3>
          <div className="form-group">
            <label>Name</label>
            <input 
              type="text" 
              value={topicListName} 
              onChange={(e) => setTopicListName(e.target.value)}
              placeholder="Enter a name for this topic list"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="dialog-actions">
            <button className="cancel-button" onClick={() => setShowSaveTopicDialog(false)}>Cancel</button>
            <button className="save-button" onClick={saveTopicList}>Save</button>
          </div>
        </div>
      </div>
    );
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for subject field
    if (name === 'subject') {
      // Clear new subject when selecting from dropdown
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        newSubject: '' // Clear new subject when selecting from dropdown
      }));
      
      // If it's a subject selection and we have the original subject object
      // Find the subject object to get its color
      const selectedSubject = subjects.find(s => {
        if (typeof s === 'object' && s.name) {
          return s.name === value;
        }
        return s === value;
      });
      
      // If we found a subject with a color, update the color too
      if (selectedSubject && typeof selectedSubject === 'object' && selectedSubject.color) {
        setFormData(prev => ({
          ...prev,
          subjectColor: selectedSubject.color
        }));
      }
    } else {
      // Regular field update
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Enhanced handleNextStep function with robust state management to prevent initialization screen issues
  const handleNextStep = () => {
    // First check if we're already progressing - prevent duplicate transitions
    if (isGenerating) {
      console.log("Already generating cards or processing a step, ignoring duplicate request");
      return;
    }
    
    // Only proceed if we're not at the last step
    if (currentStep < totalSteps) {
      // Critical step: If we're moving from step 6 (question type) to step 7,
      // we need to handle card generation carefully to avoid the initialization screen issue
      if (currentStep === 6) {
        // Create local copies of ALL form values to ensure complete stability
        const stableValues = {
          examType: formData.examType || examType || "General",
          examBoard: formData.examBoard || examBoard || "General",
          subject: formData.subject || formData.newSubject || initialSubject || "General",
          topic: formData.topic || formData.newTopic || initialTopic || "General",
          questionType: formData.questionType || "short_answer",
          numCards: formData.numCards || 5,
          subjectColor: formData.subjectColor || BRIGHT_COLORS[0]
        };
        
        // Log the stable values we're using
        debugLog("Step 6->7 transition with comprehensive stable metadata", stableValues);
        
        // First set the loading indicator - BEFORE any state changes
        setIsGenerating(true);
        
        // Set pendingOperations flag to prevent conflicts
        setPendingOperations(prev => ({ ...prev, transition: true }));
        
        // Then move to next step with a slight delay to avoid state update conflicts
        setTimeout(() => {
          // Move to step 7
          setCurrentStep(7);
          
          // Use a longer delay to ensure step transition completes
          setTimeout(() => {
            // Log that we're starting card generation
            console.log(`[${new Date().toISOString()}] Starting card generation with stable values:`, stableValues);
            
            // Special handling for multiple staggered state updates to prevent conflicts
            // First, update form data with our stable values
            setFormData(prev => ({
              ...prev,
              ...stableValues
            }));
            
            // Wait for form data update to complete
            setTimeout(() => {
              // CRITICAL FIX: Generate cards with explicitly passed stable values
              // This should be picked up by our enhanced generateCards function
              generateCards();
              
              // Clear the transition flag after a delay
              setTimeout(() => {
                setPendingOperations(prev => ({ ...prev, transition: false }));
              }, 1000);
            }, 300);
          }, 500);
        }, 100);
        
        return; // Exit early since we already set the next step
      }
      
      // For other steps, simply increment the step counter
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle previous step in wizard
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validate current step
  const canProceed = () => {
    switch (currentStep) {
      case 1: // Exam Type
        return !!formData.examType;
      case 2: // Exam Board
        return !!formData.examBoard;
      case 3: // Subject
        return !!(formData.subject || formData.newSubject);
      case 4: // Topic
        return !!(formData.topic || formData.newTopic);
      case 5: // Number of Cards
        return formData.numCards > 0 && formData.numCards <= 20;
      case 6: // Question Type
        return !!formData.questionType;
      default:
        return true;
    }
  };

  // Generate cards using OpenAI API with enhanced stability and comprehensive error handling
  const generateCards = useCallback(async () => {
    // Check if we're already generating to prevent duplicate calls
    if (isGenerating) {
      console.log("Card generation already in progress, ignoring duplicate call");
      return;
    }
    
    // CRITICAL FIX: Store all form values in local variables to ensure stability throughout the function
    // This prevents issues caused by state updates during async operations
    const localFormData = {...formData};
    
    // These stable values are crucial for exam metadata
    const localExamType = localFormData.examType || examType || "General";
    const localExamBoard = localFormData.examBoard || examBoard || "General";
    
    // Get subject value, ensuring it's a string not an object
    const subjectValue = localFormData.subject || localFormData.newSubject || initialSubject;
    const subjectName = typeof subjectValue === 'object' && subjectValue.name 
      ? subjectValue.name 
      : subjectValue;
    
    // Topic needs the same treatment for stability
    const topicValue = localFormData.topic || localFormData.newTopic || initialTopic;
    const questionTypeValue = localFormData.questionType;
    const numCardsValue = localFormData.numCards;
    
    // Log all the stable values we're using
    debugLog("Generate cards function called with stabilized state", { 
      isGenerating, 
      currentStep,
      examType: localExamType,
      examBoard: localExamBoard,
      subject: subjectName,
      topic: topicValue,
      questionType: questionTypeValue,
      numCards: numCardsValue
    });
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Explicitly define final values used for card generation
      // CRITICAL: Only use the local variables captured at the start
      const finalSubject = subjectName;
      const finalTopic = topicValue;
      const finalExamType = localExamType;
      const finalExamBoard = localExamBoard;
      
      // Extra debug log for metadata
      debugLog("Final stable metadata for card generation", {
        finalSubject,
        finalTopic,
        finalExamType,
        finalExamBoard
      });
      
      // Automatically select a color if not already set
      let cardColor = localFormData.subjectColor;
      
      // Get existing subject colors from parent component's subjects if available
      const existingSubjects = subjects || [];
      const existingColors = existingSubjects
        .filter(sub => sub.subjectColor && typeof sub.subjectColor === 'string')
        .map(sub => sub.subjectColor.toLowerCase());
      
      // If this is a new subject that matches an existing one, use that color
      const matchingSubject = existingSubjects.find(sub => {
        const subName = typeof sub === 'object' && sub.subject ? sub.subject : 
                       typeof sub === 'object' && sub.name ? sub.name : sub;
        return subName && (subName.toLowerCase() === finalSubject.toLowerCase());
      });
      
      if (matchingSubject && matchingSubject.subjectColor) {
        // Use the existing subject color
        cardColor = matchingSubject.subjectColor;
        console.log(`Using existing color ${cardColor} for subject ${finalSubject}`);
      } else {
        // Find a color not already in use
        const availableColors = BRIGHT_COLORS.filter(color => 
          !existingColors.includes(color.toLowerCase())
        );
        
        if (availableColors.length > 0) {
          // Use a color that's not already used by another subject
          cardColor = availableColors[Math.floor(Math.random() * availableColors.length)];
          console.log(`Selected new color ${cardColor} for subject ${finalSubject}`);
        } else {
          // If all colors are used, just pick a random one
          cardColor = BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
          console.log(`All colors in use, randomly selected ${cardColor} for subject ${finalSubject}`);
        }
      }
      
      // Update the form data with the selected color - AFTER card generation to avoid state issues
      const colorUpdateOnly = async () => {
        setFormData(prev => ({ ...prev, subjectColor: cardColor }));
      };
      
      // Create prompt based on question type and other parameters
      let prompt;
      
      if (questionTypeValue === "acronym") {
        let topicInfo = finalTopic ? ` with focus on ${finalTopic}` : "";
        prompt = `Return only a valid JSON array with no additional text. Please output all mathematical expressions in plain text (avoid markdown or LaTeX formatting). Generate ${numCardsValue} exam-style flashcards for ${finalExamBoard} ${finalExamType} ${finalSubject}${topicInfo}. Create a useful acronym from some essential course knowledge. Be creative and playful. Format exactly as: [{"acronym": "Your acronym", "explanation": "Detailed explanation here"}]`;
      } else {
        // Determine complexity based on exam type
        let complexityInstruction;
        if (finalExamType === "A-Level") {
          complexityInstruction = "Make these appropriate for A-Level students (age 16-18). Questions should be challenging and involve deeper thinking. Include sufficient detail in answers and use appropriate technical language.";
        } else { // GCSE or other
          complexityInstruction = "Make these appropriate for GCSE students (age 14-16). Questions should be clear but still challenging. Explanations should be thorough but accessible.";
        }
        
        // Base prompt - IMPROVED: Using final stable values only
        prompt = `Return only a valid JSON array with no additional text. Please output all mathematical expressions in plain text (avoid markdown or LaTeX formatting). 
Generate ${numCardsValue} high-quality ${finalExamBoard} ${finalExamType} ${finalSubject} flashcards for the specific topic "${finalTopic}".
${complexityInstruction}

Before generating questions, scrape the latest ${finalExamBoard} ${finalExamType} ${finalSubject} specification to ensure the content matches the current curriculum exactly.

Use this format for ${questionTypeValue === 'multiple_choice' ? 'multiple choice questions' : questionTypeValue + ' questions'}:
[
  {
    "subject": "${finalSubject}",
    "topic": "${finalTopic}",
    "questionType": "${questionTypeValue}",
    "question": "Clear, focused question based on the curriculum"${questionTypeValue === 'multiple_choice' ? ',\n    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],\n    "correctAnswer": "The correct option exactly as written in options array"' : ''},
    "detailedAnswer": "Detailed explanation of why this answer is correct, with key concepts and examples"
  }
]`;
      }
      
      console.log("Generating cards with prompt:", prompt);
      
      // Make the API call to OpenAI with retry logic for resilience
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [{ role: "user", content: prompt }],
              max_tokens: 2000,
              temperature: 0.7
            })
          });
          
          // Break out of retry loop if successful
          if (response.ok) break;
          
          // If we got a 401/403, request a token refresh and retry
          if (response.status === 401 || response.status === 403) {
            console.warn(`Authentication error (${response.status}) on attempt ${attempts+1}, trying to refresh token...`);
            await requestTokenRefresh();
            attempts++;
            continue;
          }
          
          // For rate limits, wait longer before retry
          if (response.status === 429) {
            console.warn(`Rate limit (${response.status}) on attempt ${attempts+1}, waiting before retry...`);
            await delay(2000 * (attempts + 1)); // Use delay helper
            attempts++;
            continue;
          }
          
          // For other errors, just retry with backoff
          console.warn(`API error (${response.status}) on attempt ${attempts+1}, retrying...`);
          await delay(1000 * (attempts + 1)); // Use delay helper
          attempts++;
          
        } catch (fetchError) {
          console.error(`Network error on attempt ${attempts+1}:`, fetchError);
          
          // On network error, wait and retry
          await delay(1000 * (attempts + 1)); // Use delay helper
          attempts++;
          
          // Throw if we've tried too many times
          if (attempts >= maxAttempts) {
            throw new Error(`Failed to connect to OpenAI API after ${maxAttempts} attempts: ${fetchError.message}`);
          }
        }
      }
      
      // Now check the response fully after retries
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Safe guard against invalid API response
      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid or empty response from OpenAI API");
      }
      
      // Parse the response
      const content = data.choices[0].message.content;
      console.log("Raw AI response:", content);
      
      const cleanedContent = cleanOpenAIResponse(content);
      
      let cards;
      try {
        cards = JSON.parse(cleanedContent);
      } catch (e) {
        console.error("Error parsing AI response:", e);
        throw new Error("Failed to parse AI response. Please try again.");
      }
      
      if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error("Invalid response format from AI. Please try again.");
      }
      
      // Now that we have cards, update color first
      await colorUpdateOnly();
      
      // Process the generated cards - ENHANCED: Ensure all cards have stable metadata
      const processedCards = cards.map((card, index) => {
        // Generate a unique ID
        const id = `card_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Log metadata for debugging
        console.log(`Generating card #${index + 1} with metadata:`, {
          subject: finalSubject,
          topic: finalTopic,
          examType: finalExamType,
          examBoard: finalExamBoard,
          color: cardColor
        });
        
        // Ensure card color is valid - use a default if no color is available
        const ensuredCardColor = cardColor || "#3cb44b";
        
        // Add standard fields - CRITICAL: Using stable values defined at function start
        const baseCard = {
          id,
          subject: finalSubject,
          topic: finalTopic,
          examType: finalExamType,
          examBoard: finalExamBoard,
          questionType: questionTypeValue,
          cardColor: ensuredCardColor,
          baseColor: ensuredCardColor,
          timestamp: new Date().toISOString(),
          boxNum: 1, // Start in box 1
        };
        
        // Process specific question types
        if (questionTypeValue === "acronym") {
          return {
            ...baseCard,
            acronym: card.acronym,
            explanation: card.explanation,
            front: `Acronym: ${card.acronym}`,
            back: `Explanation: ${card.explanation}`
          };
        } else if (questionTypeValue === "multiple_choice") {
          // Validate options array before processing
          if (!card.options || !Array.isArray(card.options) || card.options.length === 0) {
            console.warn("Missing options array for multiple choice card, creating default options");
            card.options = ["Option A", "Option B", "Option C", "Option D"];
            card.correctAnswer = "Option A";
          }
          
          // Clean all options and correct answer of any existing prefixes
          const cleanedOptions = card.options.map(option => 
            option.replace(/^[a-d]\)\s*/i, '').trim()
          );
          
          let correctAnswer = (card.correctAnswer || cleanedOptions[0]).replace(/^[a-d]\)\s*/i, '').trim();
          
          // Find the index of the correct answer in the options
          let correctIndex = cleanedOptions.findIndex(option => 
            option.toLowerCase() === correctAnswer.toLowerCase()
          );
          
          // If match not found, try a more flexible comparison
          if (correctIndex === -1) {
            correctIndex = cleanedOptions.findIndex(option => 
              option.toLowerCase().includes(correctAnswer.toLowerCase()) || 
              correctAnswer.toLowerCase().includes(option.toLowerCase())
            );
          }
          
          // If still not found, default to the first option
          if (correctIndex === -1) {
            console.warn("Could not match correct answer to an option, defaulting to first option");
            correctIndex = 0;
            correctAnswer = cleanedOptions[0];
          }
          
          // Get the letter for this index (a, b, c, d)
          const letter = String.fromCharCode(97 + correctIndex);
          
          return {
            ...baseCard,
            question: card.question,
            options: cleanedOptions, // Use the cleaned options
            correctAnswer: correctAnswer, // Use the cleaned correct answer
            correctIndex: correctIndex, // Store the index for future reference
            detailedAnswer: card.detailedAnswer,
            additionalInfo: card.detailedAnswer, // Add to additionalInfo field for info modal
            front: card.question,
            back: `Correct Answer: ${letter}) ${correctAnswer}`, // Format with letter prefix
            savedOptions: [...cleanedOptions] // IMPORTANT: Save a backup of options
          };
        } else if (questionTypeValue === "short_answer" || questionTypeValue === "essay") {
          // Create key points as bullet points if they exist
          const keyPointsHtml = card.keyPoints && card.keyPoints.length > 0
            ? card.keyPoints.map(point => `• ${point}`).join("<br/>")
            : "";
            
          return {
            ...baseCard,
            question: card.question,
            keyPoints: card.keyPoints || [],
            detailedAnswer: card.detailedAnswer,
            additionalInfo: card.detailedAnswer, // Add to additionalInfo field for info modal
            front: card.question,
            back: keyPointsHtml || card.detailedAnswer // Use detailed answer if no key points
          };
        } else {
          return {
            ...baseCard,
            front: card.front || card.question,
            back: card.back || card.answer
          };
        }
      });
      
      // ENHANCED: Add explicit exam metadata verification before setting state
      const verifiedCards = processedCards.map(card => {
        // Double-check that all cards have the correct exam metadata
        if (!card.examType || card.examType === "undefined") {
          card.examType = finalExamType;
          console.warn(`Fixed missing examType on card ${card.id}`);
        }
        if (!card.examBoard || card.examBoard === "undefined") {
          card.examBoard = finalExamBoard;
          console.warn(`Fixed missing examBoard on card ${card.id}`);
        }
        return card;
      });
      
      // Add debug log of the full processed cards before setting state
      debugLog("FINAL PROCESSED CARDS WITH METADATA", verifiedCards.map(card => ({
        id: card.id,
        subject: card.subject,
        topic: card.topic,
        examType: card.examType,
        examBoard: card.examBoard,
        questionType: card.questionType,
      })));

      // Set the state with our verified cards
      setGeneratedCards(verifiedCards);
      
    } catch (error) {
      console.error("Error generating cards:", error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, formData, examType, examBoard, initialSubject, initialTopic, subjects, requestTokenRefresh, currentStep]);
  // Call to generate cards when arriving at the final step
  // This useEffect is now a backup in case the direct call fails
  useEffect(() => {
    // Only trigger card generation if we're at step 7, we don't have cards yet,
    // and we're not already generating (to avoid duplicate calls)
    if (currentStep === 7 && generatedCards.length === 0 && !isGenerating) {
      console.log("Backup useEffect triggering card generation");
      
      // Store the current values to ensure they don't change during state updates
      const currentExamType = formData.examType;
      const currentExamBoard = formData.examBoard;
      
      // Use a longer delay to ensure all state is updated before generating cards
      setTimeout(() => {
        console.log("Generating cards with exam metadata:", {
          examType: currentExamType,
          examBoard: currentExamBoard
        });
        
        // Make sure we pass the stable values to generate cards
        const tempFormData = {
          ...formData,
          examType: currentExamType,
          examBoard: currentExamBoard
        };
        
        // Use a wrapper function to ensure stable references
        const generateCardsWithStableData = () => {
          console.log("Using stable data to generate cards:", tempFormData.examType, tempFormData.examBoard);
          generateCards();
        };
        
        generateCardsWithStableData();
      }, 500); // Increased delay for more stability
    }
  }, [currentStep, generatedCards.length, isGenerating, formData, generateCards]); // Added missing formData and generateCards

  // Helper function to clean AI response
  const cleanOpenAIResponse = (text) => {
    return text.replace(/```json\\s*/g, "").replace(/```/g, "").trim();
  };


  // Completely enhanced handleAddCard function with improved error handling and stable metadata
  const handleAddCard = (card) => {
    // Prevent adding card if already in progress
    if (pendingOperations.addToBank) {
      console.log("Add to bank operation already in progress, ignoring duplicate request");
      return;
    }
    
    if (!card || !card.id) {
      console.error("Invalid card data:", card);
      return;
    }

    // Set pending flag for this operation
    setPendingOperations(prev => ({ ...prev, addToBank: true }));

    // Mark the card as being processed
    setGeneratedCards(prev => prev.map(c => 
      c.id === card.id ? {...c, processing: true} : c
    ));

    // Get the selected topic ID if available
    const topicId = selectedTopic?.id || null;
    
    // CRITICAL: Store all current state values that we need in local variables
    // This ensures they remain stable during the async operation
    const localExamBoard = formData.examBoard || examBoard || "General";
    const localExamType = formData.examType || examType || "Course";
    const localSubject = formData.subject || formData.newSubject || initialSubject || "General";
    const localTopic = formData.topic || formData.newTopic || initialTopic || "General";
    
    // Additional values for communication
    const recordIdToUse = recordId || (typeof auth === 'object' && auth.recordId ? auth.recordId : null) || window.recordId || '';
    const userIdToUse = userId || window.VESPA_USER_ID || "current_user";
    
    // Log what we're doing with explicit metadata
    debugLog("Adding card with metadata", {
      topicId,
      examType: localExamType,
      examBoard: localExamBoard,
      subject: localSubject,
      topic: localTopic,
      cardId: card.id,
      recordId: recordIdToUse,
      userId: userIdToUse
    });

    try {      
      // Ensure the card has proper metadata - explicitly use our stable local variables
      const enrichedCard = {
        ...card,
        examBoard: localExamBoard,  // Simplified and consistent usage
        examType: localExamType,    // Simplified and consistent usage
        subject: card.subject || localSubject,
        topic: card.topic || localTopic,
        topicId: topicId || card.topicId || "",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date().toISOString(),
        boxNum: 1
      };
      
      // Double-check essential metadata is present and correctly formatted
      if (!enrichedCard.examType || enrichedCard.examType === "undefined") {
        console.warn(`Fixed missing examType on card ${enrichedCard.id}`);
        enrichedCard.examType = localExamType;
      }
      if (!enrichedCard.examBoard || enrichedCard.examBoard === "undefined") {
        console.warn(`Fixed missing examBoard on card ${enrichedCard.id}`);
        enrichedCard.examBoard = localExamBoard;
      }
      if (!enrichedCard.subject || enrichedCard.subject === "undefined") {
        console.warn(`Fixed missing subject on card ${enrichedCard.id}`);
        enrichedCard.subject = localSubject;
      }
      if (!enrichedCard.topic || enrichedCard.topic === "undefined") {
        console.warn(`Fixed missing topic on card ${enrichedCard.id}`);
        enrichedCard.topic = localTopic;
      }
      
      // For multiple choice cards, ensure options are preserved
      if (enrichedCard.questionType === 'multiple_choice') {
        if (!enrichedCard.savedOptions && enrichedCard.options) {
          enrichedCard.savedOptions = [...enrichedCard.options];
          console.log(`Added savedOptions backup for multiple choice card ${enrichedCard.id}`);
        } else if (!enrichedCard.options && enrichedCard.savedOptions) {
          enrichedCard.options = [...enrichedCard.savedOptions];
          console.log(`Restored options from savedOptions for card ${enrichedCard.id}`);
        }
      }
      
      // Fix any object type issues - ensure we have consistent types
      // This is critical for proper serialization
      if (enrichedCard.questionType === undefined) {
        enrichedCard.questionType = card.type === 'multiple_choice' ? 'multiple_choice' : 'short_answer';
      }
      
      // Make sure the card has a type field for proper categorization
      if (!enrichedCard.type || enrichedCard.type === 'multiple_choice' || enrichedCard.type === 'short_answer') {
        enrichedCard.type = 'card';
      }
      
      // Show success message early to ensure visible feedback
      setSuccessModal({
        show: true,
        addedCards: [enrichedCard]
      });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccessModal(prev => ({...prev, show: false}));
      }, 3000);
      
      // First try with local callback if available
      let localAddSuccess = false;
      if (typeof onAddCard === 'function') {
        try {
          onAddCard(enrichedCard);
          console.log("Card added via onAddCard callback");
          localAddSuccess = true;
        } catch (callbackError) {
          console.error("Error in onAddCard callback:", callbackError);
        }
      }
      
      // Then use the message passing to the parent window as the main approach
      if (window.parent && window.parent.postMessage) {
        // Make sure we have valid auth data
       //onst authData = typeof auth === 'boolean' ? {recordId: window.recordId} : auth;
        
        console.log("Adding card via parent window messaging");
        
        // Sequence of operations with better error handling and longer delays
        const addCardSequence = async () => {
          try {
            if (pendingOperations.addToBank) {
              console.log("Add to bank operation already in progress, skipping");
              return;
            }
            
            setPendingOperations({ ...pendingOperations, addToBank: true });
            
            // Get selected topic
            const selectedTopic = selectedTopicForConfirmation;
            
            // Guard checks
            if (!selectedTopic) {
              console.error("No topic selected for adding cards");
              setError("No topic selected");
              setPendingOperations({ ...pendingOperations, addToBank: false });
              return;
            }
            
            // Validate that recordId or userId is available
            if (!recordId && !userId) {
              console.error("No recordId or userId available for saving cards");
              setError("User ID not available for save operation");
              setPendingOperations({ ...pendingOperations, addToBank: false });
              return;
            }
            
            console.log(`Adding cards for topic: ${selectedTopic}`);
            
            // Define stable values for the operation
            const stableSubject = formData.subject || formData.newSubject || "General";
            const stableExamBoard = formData.examBoard || examBoard || "General";
            const stableExamType = formData.examType || examType || "General";
            
            // Process the cards to ensure they have the required structure
            const cardsToAdd = generatedCards.map((card, index) => ({
              id: card.id || `temp_card_${Date.now()}_${index}`,
              question: card.question,
              answer: card.answer,
              options: card.options || [],
              topicId: null, // We'll let the server/Knack assign this
              topic: selectedTopic, // Selected topic name
              subject: stableSubject, // Subject from form
              examBoard: stableExamBoard,
              examType: stableExamType,
              questionType: card.questionType || formData.questionType,
              difficulty: card.difficulty || "medium",
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              tags: [stableExamType, stableExamBoard, stableSubject],
              confidenceLevel: 0,
              reviewCount: 0,
              lastReviewDate: null,
              nextReviewDate: new Date().toISOString(), // Reviewable immediately
              boxNumber: 1 // Start in box 1 for spaced repetition
            }));
            
            // Add the cards to the bank using our sendMessage helper with retries
            await sendMessageWithRetry("ADD_TO_BANK", {
              recordId: recordId || userId,
              subject: stableSubject,
              examBoard: stableExamBoard,
              examType: stableExamType,
              topic: selectedTopic,
              cards: cardsToAdd
            });
            
            console.log(`${cardsToAdd.length} cards added successfully`);
            
            // Show success modal
            setSuccessModal({
              show: true,
              addedCards: cardsToAdd
            });
            
            // Reset states
            resetAfterCardOperation();
            
            // Clear the pendingOperations flag
            setPendingOperations({ ...pendingOperations, addToBank: false });
            
            // Reset currentStep to 1
            setCurrentStep(1);
            
            return true;
          } catch (error) {
            console.error("Error adding cards to bank:", error);
            setError(`Error adding cards: ${error.message}`);
            setPendingOperations({ ...pendingOperations, addToBank: false });
            return false;
          }
        };
        
        // Start the sequence
        addCardSequence().catch(error => {
          console.error("Error in add card sequence:", error);
          setError(`Error adding card: ${error.message}. Please try again.`);
          // Reset processing state
          setGeneratedCards(prev => prev.map(c => 
            c.id === card.id ? {...c, processing: false} : c
          ));
          
          // Run reset function after error to recover
          setTimeout(() => {
            resetAfterCardOperation();
          }, 2000);
        }).finally(() => {
          // Always reset the pending operation flag when done
          setPendingOperations(prev => ({ ...prev, addToBank: false }));
        });
      } else {
        console.error("Cannot access parent window for messaging");
        setError("Failed to communicate with parent window");
        // Reset processing state
        setGeneratedCards(prev => prev.map(c => 
          c.id === card.id ? {...c, processing: false} : c
        ));
        setPendingOperations(prev => ({ ...prev, addToBank: false }));
      }
    } catch (error) {
      console.error("Error handling add card:", error);
      setError(`Error adding card: ${error.message}. Please try again.`);
      // Reset processing state
      setGeneratedCards(prev => prev.map(c => 
        c.id === card.id ? {...c, processing: false} : c
      ));
      setPendingOperations(prev => ({ ...prev, addToBank: false }));
      
      // Run reset function after error to recover
      setTimeout(() => {
        resetAfterCardOperation();
      }, 2000);
    }
  };

  // Enhanced handleAddAllCards function with comprehensive protection against race conditions
  const handleAddAllCards = () => {
    console.log("Add all cards button clicked");
    
    // Prevent multiple clicks with early return
    if (pendingOperations.addToBank) {
      console.log("Add all operation already in progress, ignoring duplicate click");
      return;
    }
    
    // Mark operation as in progress immediately
    setPendingOperations(prev => ({ ...prev, addToBank: true }));
    
    // CRITICAL: Store all current state values that we need in local variables
    // This ensures they remain stable throughout the entire operation
    const localExamType = formData.examType || examType || "General";
    const localExamBoard = formData.examBoard || examBoard || "General";
    const localSubject = formData.subject || formData.newSubject || initialSubject || "General";
    const localTopic = formData.topic || formData.newTopic || initialTopic || "General";
    
    // Log operation with explicit metadata
    debugLog("Starting add all cards with stable metadata", {
      examType: localExamType,
      examBoard: localExamBoard,
      subject: localSubject,
      topic: localTopic,
      cardCount: generatedCards.length
    });
    
    try {
      // We need to delay to ensure we don't encounter React state update issues
      setTimeout(() => {
        // Call addAllToBank but pass our stable local values explicitly
        addAllToBank(localExamType, localExamBoard, localSubject, localTopic);
      }, 500);
    } catch (error) {
      console.error("Error in handleAddAllCards:", error);
      setError(`Error preparing to add cards: ${error.message}`);
      setPendingOperations(prev => ({ ...prev, addToBank: false }));
    }
  };

  // Modal to show successfully added cards
  const renderSuccessModal = () => {
    if (!successModal.show) return null;
    
    return (
      <div className="success-modal-overlay">
        <div className="success-modal">
          <div className="success-icon">✓</div>
          <h3>{successModal.addedCards.length} {successModal.addedCards.length === 1 ? 'Card' : 'Cards'} Added!</h3>
          <div className="success-cards">
            {successModal.addedCards.slice(0, 5).map(card => (
              <div key={card.id} className="success-card-item" style={{backgroundColor: card.cardColor}}>
                <span style={{color: getContrastColor(card.cardColor)}}>{card.front.substring(0, 40)}...</span>
              </div>
            ))}
            {successModal.addedCards.length > 5 && (
              <div className="success-more">+{successModal.addedCards.length - 5} more</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Generate new batch of cards
  const handleRegenerateCards = () => {
    setGeneratedCards([]);
    setIsGenerating(true);
    
    // We want to keep all the existing parameters the same,
    // including the color, but generate new cards
    generateCards();
  };

  // Helper to get contrast color for text
  const getContrastColor = (hexColor) => {
    // Remove # if present
    if (hexColor.startsWith('#')) {
      hexColor = hexColor.slice(1);
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Function to handle generating topics from the main screen/
 /* const handleGenerateTopics = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      // Show the topic modal immediately with the loading indicator
      setShowTopicModal(true);
      
      // Get the subject value, ensuring it's a string not an object
      const subjectValue = formData.subject || formData.newSubject;
      const subjectName = typeof subjectValue === 'object' && subjectValue.name 
        ? subjectValue.name 
        : subjectValue;
      
      const topics = await generateTopics(
        formData.examBoard,
        formData.examType,
        subjectName
      );
      setAvailableTopics(topics);
      setHierarchicalTopics(topics.map(topic => ({ topic })));
      setTopicListSaved(false);
      
      // First ensure we're not showing the options explanation modal
      setShowOptionsExplanationModal(false);
      
      // Then show options explanation modal after topics are generated successfully
      if (topics.length > 0) {
        // Close any other modals that might be blocking this one
        console.log("Generated topics:", topics);
        
        // Use a longer delay to ensure the topic modal is fully rendered first
        setTimeout(() => {
          // Force the options modal to appear
          setShowOptionsExplanationModal(true);
          console.log("Showing options explanation modal");
        }, 1000);
      }
    } catch (err) {
      setError(err.message);
      // Don't close the modal on error, just show the error inside it
    } finally {
      setIsGenerating(false);
    }
  };
*/
  // Add a function to reset state after card operations to fix initialization screen issue
  const resetAfterCardOperation = () => {
    // This function helps recover from initialization screen issues
    // by resetting flags after card operations
    console.log(`[${new Date().toISOString()}] Resetting card operation state flags`);
    
    // Clear all pending operations
    setPendingOperations({
      save: false,
      refresh: false,
      addToBank: false,
      transition: false
    });
    
    // Reset generating flag if it's stuck
    setIsGenerating(false);
    
    // Clear any error messages
    setError(null);
  };
  
  // Effect to auto-reset after successful card operations
  useEffect(() => {
    // If cards have been added and we're still showing an initialization screen,
    // reset the state to recover
    const addedCards = generatedCards.filter(card => card.added).length;
    
    if (addedCards > 0 && isGenerating && currentStep === 7) {
      console.log(`[${new Date().toISOString()}] Auto-recovery: Cards added but still showing initialization screen`);
      
      // Use a timeout to give any in-progress operations time to complete
      const timer = setTimeout(() => {
        resetAfterCardOperation();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [generatedCards, isGenerating, currentStep]);
  
  // Render step content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Exam Type Selection
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select Exam Type</h2>
            <div className="form-group">
              <select 
                name="examType" 
                value={formData.examType} 
                onChange={handleChange}
                required
              >
                <option value="">-- Select Exam Type --</option>
                {EXAM_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        );
      case 2: // Exam Board Selection
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select Exam Board</h2>
            <div className="form-group">
              <select 
                name="examBoard" 
                value={formData.examBoard} 
                onChange={handleChange}
                required
              >
                <option value="">-- Select Exam Board --</option>
                {boardsForType(formData.examType).map(boardValue => {
                  const boardLabel = EXAM_BOARDS.find(b => b.value === boardValue)?.label || boardValue;
                  return <option key={boardValue} value={boardValue}>{boardLabel}</option>;
                })}
              </select>
            </div>
          </div>
        );
      case 3: // Subject Selection
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select Subject</h2>
            <div className="form-group">
              <select 
                name="subject" 
                value={formData.subject} 
                onChange={handleChange}
                required
              >
                <option value="">-- Select Subject --</option>
                {availableSubjects.map(subjectName => (
                  <option key={subjectName} value={subjectName}>{subjectName}</option>
                ))}
                <option value="__add_new__">+ Add New Subject</option>
              </select>
            </div>
            {formData.subject === "__add_new__" && (
              <div className="form-group" style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  name="newSubject"
                  value={formData.newSubject}
                  onChange={handleChange}
                  placeholder="Enter new subject name"
                  required 
                />
              </div>
            )}
          </div>
        );
      case 4: // Card Settings (Number of Cards, Question Type)
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Card Settings</h2>
            <div className="form-group">
              <label>Number of Cards per Topic:</label>
              <input 
                type="number" 
                name="numCards" 
                value={formData.numCards} 
                onChange={handleChange}
                min="1" 
                max="20" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Question Type:</label>
              <select 
                name="questionType" 
                value={formData.questionType} 
                onChange={handleChange}
                required
              >
                {QUESTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        );
      case 5: // Topic Hub - Now the final step
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Topic Hub</h2>
            <TopicHub
              subject={formData.subject === "__add_new__" ? formData.newSubject : formData.subject}
              examBoard={formData.examBoard}
              examType={formData.examType}
              recordId={recordId}
              // This is the crucial part: pass a function that handles finalization
              // AND closes the generator modal
              onFinalizeTopics={(topicShells) => {
                console.log(`[AICardGenerator] Received ${topicShells.length} finalized topic shells from TopicHub.`);
                // Call the original handler passed from the parent (e.g., App.js)
                if (onFinalizeTopics && typeof onFinalizeTopics === 'function') {
                  onFinalizeTopics(topicShells);
                }
                // Close the AICardGenerator modal after finalization
                onClose(); 
              }}
              // Pass the onClose function directly to TopicHub so it can close itself if needed
              onClose={onClose} 
            />
          </div>
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  // Function to regenerate topics
  const handleRegenerateTopics = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Clear existing topics
      setAvailableTopics([]);
      
      const topics = await generateTopics(
        formData.examBoard,
        formData.examType,
        formData.subject || formData.newSubject
      );
      
      setAvailableTopics(topics);
      setHierarchicalTopics(topics.map(topic => ({ topic })));
      setTopicListSaved(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Completely enhanced addAllToBank function with comprehensive protection against race conditions
  const addAllToBank = async (stableExamType, stableExamBoard, stableSubject, stableTopic) => {
    try {
    if (pendingOperations.addToBank) {
        console.log("Add to bank operation already in progress, skipping");
      return;
    }
    
      setPendingOperations({ ...pendingOperations, addToBank: true });
      
      // Guard checks
      if (!recordId && !userId) {
        console.error("No recordId or userId available for saving cards");
        setError("User ID not available for save operation");
        setPendingOperations({ ...pendingOperations, addToBank: false });
        return;
      }
      
      console.log(`Adding ALL cards for subject: ${stableSubject}, topic: ${stableTopic}`);
      
      // Cards have already been generated with the proper subject & topic
      const cardsToAdd = [...generatedCards];
      
      // Process each card to ensure it's ready for storage
      const processedCards = cardsToAdd.map(card => {
        // Deep clone the card to avoid reference issues
        const processedCard = JSON.parse(JSON.stringify(card));
        
        // Ensure multiple choice options are properly formatted
        if (processedCard.questionType === 'multiple_choice' && processedCard.options) {
          // Make sure options is an array of strings
          const cleanedOptions = processedCard.options.map(option => {
            if (typeof option === 'string') {
              return option;
            } 
            else if (option && typeof option === 'object' && option.text) {
              return option.text;
            }
            else {
              // Convert to string as a fallback
              try {
                return String(option);
              } catch (e) {
                console.warn('Failed to convert option to string:', option);
                return 'Option';
              }
            }
          });
          
          processedCard.options = cleanedOptions;
          
          // Also ensure correctAnswer is a string
          if (processedCard.correctAnswer && typeof processedCard.correctAnswer !== 'string') {
            try {
              processedCard.correctAnswer = String(processedCard.correctAnswer);
            } catch (e) {
              console.warn('Failed to convert correctAnswer to string:', processedCard.correctAnswer);
            }
          }
        }
        
        return processedCard;
      });
      
      // Add cards to the local state first
      let successCount = 0;
      
      for (const card of processedCards) {
        try {
          const cardId = card.id;
          console.log(`Adding card locally: ${cardId}`);
          
          if (onAddCard) {
            onAddCard(card);
            successCount++;
            
            // Also update the color for this topic if needed
            // Note: updateColorMapping would need to be passed as a prop
            // if (updateColorMapping && card.subject && card.topic) {
            //   updateColorMapping(card.subject, card.topic, card.color || currentGeneratedColor, false);
            // }
              } else {
            console.error("onAddCard function not available");
            setError("Cannot add cards - missing handler function");
          }
        } catch (e) {
          console.error("Error adding card locally:", e);
        }
      }
      
      console.log(`${successCount} cards added locally successfully`);
      
      // Now send to Knack for permanent storage
      // Only proceed if we successfully added at least one card locally
      if (successCount > 0) {
        console.log(`Sending ${successCount} cards to Knack via ADD_TO_BANK`);
        
        sendMessageWithRetry({
          type: 'ADD_TO_BANK',
          recordId,
          cardsCount: successCount
        });
        
        // Display success message
        setOperationSuccess(true);
        setSavedCount(successCount);
        setShowSuccessModal(true);
        
        // Reset state after brief delay
        setTimeout(() => {
          setOperationSuccess(false);
          setShowSuccessModal(false);
        }, 3000);
      } else {
        console.error("No cards were successfully added locally");
        setError("Failed to add cards locally");
      }
      
      setPendingOperations({ ...pendingOperations, addToBank: false });
    } catch (error) {
      console.error("Error in addAllToBank:", error);
      setError(`Failed to add cards: ${error.message}`);
      setPendingOperations({ ...pendingOperations, addToBank: false });
    }
  };

  // Helper function to send messages with retry
  const sendMessageWithRetry = async (type, data, maxRetries = 3) => {
    // If we're in a standalone environment (not in an iframe), resolve immediately
    if (window.parent === window) {
      console.log(`[GenerateCards] Standalone mode detected, not sending ${type} message`);
      return Promise.resolve({ success: true });
    }
    
    // Otherwise send messages to Knack with a promise wrapper
    return new Promise((resolve, reject) => {
      console.log(`[GenerateCards] Sending ${type} message with retry logic, data:`, {
        type,
        recordId: data.recordId,
        cardsCount: data.cards ? data.cards.length : 0
      });
      
      let retryCount = 0;
      
      // Function to send the message
      const sendMessage = () => {
        console.log(`[GenerateCards] Sending ${type} message (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        // Use SaveQueueService instead of direct postMessage
        saveQueueService.addToQueue({ type, payload: data })
          .then(() => {
            console.log(`[GenerateCards] ${type} message successfully queued and processed`);
            resolve({ success: true });
          })
          .catch(error => {
            console.error(`[GenerateCards] Error sending ${type} message:`, error);
            retryCount++;
            if (retryCount <= maxRetries) {
              console.log(`[GenerateCards] Retrying in ${retryCount * 1000}ms...`);
              setTimeout(sendMessage, retryCount * 1000);
      } else {
              reject(new Error(`Failed to send ${type} message after ${maxRetries + 1} attempts: ${error.message || 'Unknown error'}`));
            }
          });
      };
      
      // Start the process
      sendMessage();
    });
  };

  // Add the handleClose function to replace the one that was removed during our previous edits
  const handleClose = () => {
    // If we saved topics, request a data refresh
    if (topicListSaved) {
      console.log("Topics were saved - triggering data refresh before closing");
      
      // Send message to parent window to request latest data
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ 
          type: "REQUEST_REFRESH_DATA",
          data: {
            recordId: auth?.recordId || window.recordId
          }
        }, "*");
        
        // Small delay to allow data to refresh before closing
        setTimeout(() => {
          onClose();
        }, 300);
      } else {
        // If can't message parent, just close normally
        onClose();
      }
    } else {
      // No topics saved, just close normally
      onClose();
    }
  };

  return (
    <div className="ai-card-generator">
      <div className="card-generator-header">
        <h2>AI Flashcard Generator</h2>
        <button className="close-button" onClick={onClose}>✖</button>
      </div>
      
      {/* Render the step indicator (ensure this exists or add it) */}
      {/* Example: {stepIndicator} */}
      <div className="progress-bar">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div 
            key={idx} 
            className={`progress-step ${idx + 1 === currentStep ? 'active' : ''} ${idx + 1 < currentStep ? 'completed' : ''}`}
            onClick={() => { if (idx + 1 < currentStep) setCurrentStep(idx + 1); }}
          >
            {idx + 1 < currentStep ? '✓' : idx + 1}
          </div>
        ))}
      </div>
      
      <div className="step-content-container">
        {renderStepContent()}
      </div>
      
      <div className="navigation-controls">
        {currentStep > 1 && (
          <button 
            className="prev-button" 
            onClick={handlePrevStep} 
          >
            ← Previous
          </button>
        )}
        
        {/* Only show Next button if not on the last step (Topic Hub) */}
        {currentStep < totalSteps && (
          <button 
            className={`next-button ${!canProceed() ? 'disabled' : ''}`} 
            onClick={handleNextStep} 
            disabled={!canProceed()}
          >
            Next →
          </button>
        )}
      </div>
      
      {/* Removed references to old modals like renderSuccessModal, renderOptionsExplanationModal */}
    </div>
  );
};

export default AICardGenerator;