import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { FaMagic, FaExclamationTriangle, FaEdit, FaTrash, FaPlus, FaSave, FaBolt, FaRedo, FaFolder, FaChevronDown, FaChevronUp, FaTimes, FaCheck, FaInfo, FaCheckCircle, FaDatabase } from 'react-icons/fa';
import './styles.css';
import { generateTopicPrompt } from '../../prompts/topicListPrompt';
import { generateId } from '../../utils/UnifiedDataModel';
import { WebSocketContext } from '../../contexts/WebSocketContext';
import KnackTopicService from '../../services/KnackTopicService';

/**
 * TopicHub - Enhanced topic management component
 * 
 * Serves as a central hub for generating, editing, and organizing topics
 * before proceeding with card generation.
 */
const TopicHub = ({
  subject,
  examBoard,
  examType,
  initialTopics = [],
  onSaveTopicList,
  onSelectTopic,
  onGenerateCards,
  academicYear = "2024-2025",
  onClose,
  recordId,
  onFinalizeTopics
}) => {
  // State for topic management
  const [topics, setTopics] = useState(initialTopics);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [mainTopics, setMainTopics] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [, setError] = useState(null);
  const [newTopicInput, setNewTopicInput] = useState({ mainTopic: '', subtopic: '' });
  const [useExistingMainTopic, setUseExistingMainTopic] = useState(true);
  
  // State for error modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  
  // State for fallback topics
  const [usingFallbackTopics, setUsingFallbackTopics] = useState(false);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  
  // Cache system
  const topicCache = useRef({});
  const [, setUsingCache] = useState(false);
  const lastRequestTimestamp = useRef(0);
  const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between API calls
  
  // State for edit functionality
  const [editMode, setEditMode] = useState(null);
  const [editValue, setEditValue] = useState({ mainTopic: '', subtopic: '' });
  const [editMainTopicMode, setEditMainTopicMode] = useState(null);
  const [editMainTopicValue, setEditMainTopicValue] = useState('');
  
  // State for deletion confirmation
  const [, setShowDeleteMainTopicDialog] = useState(false);
  const [, setMainTopicToDelete] = useState(null);
  
  // State for save/proceed functionality
  const [listName, setListName] = useState(`${subject} - ${examBoard} ${examType}`);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSelectDialog, setShowSelectDialog] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [contentGuidance, setContentGuidance] = useState('');
  
  // State for tracking selected optional topics
  const [selectedOptionalTopics, setSelectedOptionalTopics] = useState({});
  
  // State for success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Additional state for UI and loading
  const [loadingStatus, setLoadingStatus] = useState('');
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  
  const [topicListSaved, setTopicListSaved] = useState(false);
  
   
  // Load saved content guidance when a topic is selected
  useEffect(() => {
    if (selectedTopic) {
      const savedGuidance = localStorage.getItem(`contentGuidance_${selectedTopic.id}`);
      if (savedGuidance) {
        setContentGuidance(savedGuidance);
      } else {
        setContentGuidance('');
      }
    }
  }, [selectedTopic]);
  
  // Process topics into main topic groupings when topics change
  useEffect(() => {
    // Check if topics is a valid array before processing
    if (topics && Array.isArray(topics) && topics.length > 0) {
      const topicGroups = {};
      
      // Group topics by mainTopic
      topics.forEach(topic => {
        // Ensure topic and mainTopic exist before trying to group
        if (topic && topic.mainTopic) {
          const mainTopic = topic.mainTopic;
          if (!topicGroups[mainTopic]) {
            topicGroups[mainTopic] = [];
          }
          topicGroups[mainTopic].push(topic);
        } else {
          console.warn("Skipping invalid topic object during grouping:", topic);
        }
      });
      
      // Convert to array format for rendering
      const mainTopicArray = Object.keys(topicGroups).map(mainTopicName => ({
        name: mainTopicName,
        subtopics: topicGroups[mainTopicName]
      }));
      
      // Update the state used for rendering
      console.log("[TopicHub] Grouping topics into mainTopics:", mainTopicArray);
      setMainTopics(mainTopicArray); 

    } else {
      // If topics is empty or invalid, reset mainTopics
      setMainTopics([]);
    }
  // This effect should run whenever the source 'topics' array changes
  }, [topics]); 

  // API key - matching the format used in AICardGenerator for consistency
  const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";

  // Check cache for existing topics
  const checkTopicCache = (examBoard, examType, subject) => {
    const cacheKey = `${examBoard}-${examType}-${subject}`.toLowerCase();
    
    if (topicCache.current[cacheKey] && topicCache.current[cacheKey].length > 0) {
      console.log("✅ Using cached topics for:", cacheKey);
      return topicCache.current[cacheKey];
    }
    
    console.log("❌ No cached topics found for:", cacheKey);
    return null;
  };
  
  // Store topics in cache
  const storeTopicsInCache = (examBoard, examType, subject, topicsArray) => {
    const cacheKey = `${examBoard}-${examType}-${subject}`.toLowerCase();
    console.log("📦 Storing topics in cache:", cacheKey);
    topicCache.current[cacheKey] = topicsArray;
  };
  
  // Check if we should throttle API requests
  const shouldThrottleRequest = () => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimestamp.current;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      console.log(`⏱️ Throttling API request, only ${timeSinceLastRequest}ms since last request`);
      return true;
    }
    
    return false;
  };
  
  // Import and define WebSocket hook at the top of the component
  const { sendMessage, lastMessage, readyState, isConnected } = useContext(WebSocketContext);

  // WebSocket message handler
  useEffect(() => {
    if (!lastMessage) return;
    
    try {
      const data = JSON.parse(lastMessage.data);
      
      switch (data.type) {
        case 'topicResults':
          if (data.action === 'generateTopics' && Array.isArray(data.topics)) {
            console.log("Received topic results:", data.topics.length, "topics");
            setTopics(data.topics);
            setHasGenerated(true);
            setIsGenerating(false);
            
            // Store in cache for future use
            storeTopicsInCache(examBoard, examType, subject, data.topics);
          }
          break;
          
        case 'status':
          if (data.action === 'generateTopics') {
            console.log("Generation status update:", data.message);
            setLoadingStatus(data.message);
          }
          break;
          
        case 'error':
          if (data.action === 'generateTopics') {
            console.error("Error from server:", data.message);
            setErrorMessage("Server Error");
            setErrorDetails(data.message);
            setShowErrorModal(true);
            setIsGenerating(false);
            
            // Try using fallbacks on error
            useFallbackTopics();
          }
          break;
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }, [lastMessage, examBoard, examType, subject]);
  
  // Function to use fallback topics when API fails
  const useFallbackTopics = () => {
    console.log("Using fallback topics");
    const hardcodedFallbacks = getSubjectFallbackTopics(subject, examBoard, examType);
    
    if (hardcodedFallbacks && hardcodedFallbacks.length > 0) {
      console.log("Using subject-specific fallbacks:", hardcodedFallbacks.length, "topics");
      setTopics(hardcodedFallbacks);
      setHasGenerated(true);
      setUsingFallbackTopics(true);
      setShowFallbackNotice(true);
      
      // Also store these in the cache to prevent future API errors
      storeTopicsInCache(examBoard, examType, subject, hardcodedFallbacks);
    } else {
      console.log("No subject-specific fallbacks available, using generic ones");
      const genericFallbacks = [
        {
          id: "1.1",
          topic: `${subject}: Core Concepts`,
          mainTopic: subject,
          subtopic: "Core Concepts"
        },
        {
          id: "1.2",
          topic: `${subject}: Key Principles`,
          mainTopic: subject,
          subtopic: "Key Principles"
        },
        {
          id: "1.3",
          topic: `${subject}: Fundamental Applications`,
          mainTopic: subject,
          subtopic: "Fundamental Applications"
        }
      ];
      
      setTopics(genericFallbacks);
      setHasGenerated(true);
      setUsingFallbackTopics(true);
      setShowFallbackNotice(true);
      storeTopicsInCache(examBoard, examType, subject, genericFallbacks);
    }
  };

  // Generate topics using Knack database (for A-Level/GCSE) or AI (for BTEC/Cambridge National)
  const generateTopics = async () => {
    setIsGenerating(true);
    setError(null);
    setUsingCache(false);
    setUsingFallbackTopics(false);
    setShowFallbackNotice(false);
    
    try {
      console.log("Starting topic generation for:", examBoard, examType, subject);
      
      // Check cache first before making any API call
      const cachedTopics = checkTopicCache(examBoard, examType, subject);
      if (cachedTopics) {
        console.log("Using cached topics instead of making API call");
        setTopics(cachedTopics);
        setHasGenerated(true);
        setUsingCache(true);
        setIsGenerating(false);
        return;
      }
      
      // Check if we should throttle this request
      if (shouldThrottleRequest()) {
        console.log("Request throttled, showing error modal");
        setErrorMessage("Too many requests in a short time period");
        setErrorDetails("Please wait a moment before generating more topics. We limit requests to prevent API rate limits.");
        setShowErrorModal(true);
        setIsGenerating(false);
        return;
      }
      
      // Update the last request timestamp
      lastRequestTimestamp.current = Date.now();
      
      // Determine if we should use Knack database or AI based on exam type
      const useKnackDatabase = examType === 'GCSE' || examType === 'A-Level';
      
      if (useKnackDatabase) {
        // Use Knack database for GCSE and A-Level
        try {
          console.log(`Using Knack database for ${examBoard} ${examType} ${subject}`);
          setLoadingStatus(`Fetching ${examType} ${subject} topics from database...`);
          
          // Fetch topics from Knack database
          const knackTopics = await KnackTopicService.fetchTopicsFromKnack(examType, examBoard, subject);
          
          if (knackTopics && knackTopics.length > 0) {
            console.log(`Found ${knackTopics.length} topics in Knack database`);
            setTopics(knackTopics);
            setHasGenerated(true);
            // Store in cache for future use
            storeTopicsInCache(examBoard, examType, subject, knackTopics);
          } else {
            console.log("No topics found in Knack database, falling back to AI generation");
            
            // If no topics found in Knack, fall back to AI generation
            if (!isConnected) {
              throw new Error("WebSocket not connected, cannot use AI fallback");
            }
            
            setLoadingStatus("No database topics found. Generating with AI...");
            
            // Send request through WebSocket for AI generation
            sendMessage(JSON.stringify({
              action: 'generateTopics',
              data: {
                examBoard,
                examType,
                subject,
                academicYear,
                forceAI: true // Flag to force AI generation even for GCSE/A-Level
              }
            }));
          }
          
        } catch (knackError) {
          console.error("Error fetching topics from Knack:", knackError);
          
          // Try AI generation if Knack fails and WebSocket is connected
          if (isConnected) {
            console.log("Falling back to AI generation after Knack error");
            setLoadingStatus("Database error. Falling back to AI generation...");
            
            // Send request through WebSocket for AI generation
            sendMessage(JSON.stringify({
              action: 'generateTopics',
              data: {
                examBoard,
                examType,
                subject,
                academicYear,
                forceAI: true
              }
            }));
          } else {
            // If WebSocket is not connected, use hardcoded fallbacks
            throw knackError;
          }
        }
      } else {
        // Use AI generation for BTEC/Cambridge National
        if (!isConnected) {
          console.error("WebSocket not connected, cannot generate topics");
          setErrorMessage("Connection Error");
          setErrorDetails("WebSocket connection is not available. Please try refreshing the page.");
          setShowErrorModal(true);
          setIsGenerating(false);
          return;
        }
        
        console.log(`Using AI generation for ${examBoard} ${examType} ${subject}`);
        setLoadingStatus(`Generating topics for ${examType} ${subject} using AI...`);
        
        // Send request through WebSocket instead of direct API call
        sendMessage(JSON.stringify({
          action: 'generateTopics',
          data: {
            examBoard,
            examType,
            subject,
            academicYear
          }
        }));
      }
      
      // Processing of the response is now handled in the WebSocket message handler above
      
    } catch (error) {
      console.error("Error generating topics:", error);
      
      // Additional debugging info
      console.error("API Key available:", !!OPENAI_API_KEY);
      console.error("API Key length:", OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
      
      // Log more detailed error information
      if (error.response) {
        console.error("API response status:", error.response.status);
        console.error("API response data:", error.response.data);
      }
      
      // Check specifically for rate limit error (HTTP 429)
      if (error.message && error.message.includes('429')) {
        console.error("Rate limit error detected!");
        setErrorMessage("Rate limit exceeded");
        setErrorDetails("We've hit the API rate limit. Please try again in a few minutes.");
        setShowErrorModal(true);
        setIsGenerating(false);
        return;
      }
      
      // Use hardcoded fallbacks for any error
      console.log("Error occurred, using hardcoded fallbacks");
      const hardcodedFallbacks = getSubjectFallbackTopics(subject, examBoard, examType);
      
      if (hardcodedFallbacks && hardcodedFallbacks.length > 0) {
        console.log("Using hardcoded fallbacks after error");
        setTopics(hardcodedFallbacks);
        setHasGenerated(true);
        setUsingFallbackTopics(true);
        setShowFallbackNotice(true);
        
        // Also store these in the cache to prevent future API errors
        storeTopicsInCache(examBoard, examType, subject, hardcodedFallbacks);
      } else {
        // Show a more detailed error message to the user if fallbacks didn't work
        let errorMessage = `Failed to generate topics: ${error.message}`;
        if (error.message.includes("API key")) {
          errorMessage = "API key error. Please check your OpenAI API key configuration.";
        } else if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-openai-key") {
          errorMessage = "No API key found. Please add your OpenAI API key to the environment variables.";
        }
        
        setError(errorMessage);
        setErrorMessage("Generation Error");
        setErrorDetails(errorMessage);
        setShowErrorModal(true);
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Get fallback topics for specific subjects
  const getSubjectFallbackTopics = (subject, examBoard, examType) => {
    // Convert to lowercase for case-insensitive matching
    const subjectLower = subject.toLowerCase();
    
    // Geography fallbacks (added to resolve the current issue)
    if (subjectLower.includes('geography')) {
      return [
        {
          id: "1.1",
          topic: "Physical Geography: Water and Carbon Cycles",
          mainTopic: "Physical Geography",
          subtopic: "Water and Carbon Cycles"
        },
        {
          id: "1.2",
          topic: "Physical Geography: Coastal Systems and Landscapes",
          mainTopic: "Physical Geography",
          subtopic: "Coastal Systems and Landscapes"
        },
        {
          id: "1.3",
          topic: "Physical Geography: Hazards and Natural Disasters",
          mainTopic: "Physical Geography",
          subtopic: "Hazards and Natural Disasters"
        },
        {
          id: "2.1",
          topic: "Human Geography: Global Systems and Governance",
          mainTopic: "Human Geography",
          subtopic: "Global Systems and Governance"
        },
        {
          id: "2.2",
          topic: "Human Geography: Changing Places",
          mainTopic: "Human Geography",
          subtopic: "Changing Places"
        },
        {
          id: "2.3",
          topic: "Human Geography: Population and Migration",
          mainTopic: "Human Geography",
          subtopic: "Population and Migration"
        },
        {
          id: "3.1",
          topic: "Human Geography: Resource Security",
          mainTopic: "Human Geography",
          subtopic: "Resource Security"
        },
        {
          id: "3.2",
          topic: "Human Geography: Contemporary Urban Environments",
          mainTopic: "Human Geography",
          subtopic: "Contemporary Urban Environments"
        },
        {
          id: "4.1",
          topic: "Skills and Techniques: Fieldwork and Investigation",
          mainTopic: "Skills and Techniques",
          subtopic: "Fieldwork and Investigation"
        },
        {
          id: "4.2",
          topic: "Skills and Techniques: Geographical Information Systems (GIS)",
          mainTopic: "Skills and Techniques",
          subtopic: "Geographical Information Systems (GIS)"
        }
      ];
    }
    
    // Chemistry fallbacks
    if (subjectLower.includes('chemistry')) {
      return [
        {
          id: "1.1",
          topic: "Atomic Structure and Periodicity: Atomic Models and Electronic Configuration",
          mainTopic: "Atomic Structure and Periodicity",
          subtopic: "Atomic Models and Electronic Configuration"
        },
        {
          id: "1.2",
          topic: "Atomic Structure and Periodicity: Periodic Trends",
          mainTopic: "Atomic Structure and Periodicity",
          subtopic: "Periodic Trends"
        },
        {
          id: "2.1",
          topic: "Chemical Bonding: Ionic Bonding",
          mainTopic: "Chemical Bonding",
          subtopic: "Ionic Bonding"
        },
        {
          id: "2.2",
          topic: "Chemical Bonding: Covalent Bonding",
          mainTopic: "Chemical Bonding",
          subtopic: "Covalent Bonding"
        },
        {
          id: "2.3",
          topic: "Chemical Bonding: Metallic Bonding",
          mainTopic: "Chemical Bonding",
          subtopic: "Metallic Bonding"
        },
        {
          id: "3.1",
          topic: "Energetics: Enthalpy Changes",
          mainTopic: "Energetics",
          subtopic: "Enthalpy Changes"
        },
        {
          id: "3.2",
          topic: "Energetics: Bond Enthalpies",
          mainTopic: "Energetics",
          subtopic: "Bond Enthalpies"
        }
      ];
    }
    
    // Biology fallbacks
    if (subjectLower.includes('biology')) {
      return [
        {
          id: "1.1",
          topic: "Cell Biology: Cell Structure",
          mainTopic: "Cell Biology",
          subtopic: "Cell Structure"
        },
        {
          id: "1.2",
          topic: "Cell Biology: Cell Transport",
          mainTopic: "Cell Biology",
          subtopic: "Cell Transport"
        },
        {
          id: "1.3",
          topic: "Cell Biology: Cell Division",
          mainTopic: "Cell Biology",
          subtopic: "Cell Division"
        },
        {
          id: "2.1",
          topic: "Genetics: DNA Structure and Replication",
          mainTopic: "Genetics",
          subtopic: "DNA Structure and Replication"
        },
        {
          id: "2.2",
          topic: "Genetics: Protein Synthesis",
          mainTopic: "Genetics",
          subtopic: "Protein Synthesis"
        },
        {
          id: "2.3",
          topic: "Genetics: Inheritance",
          mainTopic: "Genetics",
          subtopic: "Inheritance"
        }
      ];
    }
    
    // Physics fallbacks
    if (subjectLower.includes('physics')) {
      return [
        {
          id: "1.1",
          topic: "Mechanics: Forces and Motion",
          mainTopic: "Mechanics",
          subtopic: "Forces and Motion"
        },
        {
          id: "1.2",
          topic: "Mechanics: Energy and Work",
          mainTopic: "Mechanics",
          subtopic: "Energy and Work"
        },
        {
          id: "1.3",
          topic: "Mechanics: Momentum",
          mainTopic: "Mechanics",
          subtopic: "Momentum"
        },
        {
          id: "2.1",
          topic: "Waves: Wave Properties",
          mainTopic: "Waves",
          subtopic: "Wave Properties"
        },
        {
          id: "2.2",
          topic: "Waves: Wave Behavior",
          mainTopic: "Waves",
          subtopic: "Wave Behavior"
        }
      ];
    }
    
    // Mathematics fallbacks
    if (subjectLower.includes('math') || subjectLower.includes('maths')) {
      return [
        {
          id: "1.1",
          topic: "Algebra: Equations and Inequalities",
          mainTopic: "Algebra",
          subtopic: "Equations and Inequalities"
        },
        {
          id: "1.2",
          topic: "Algebra: Functions and Graphs",
          mainTopic: "Algebra",
          subtopic: "Functions and Graphs"
        },
        {
          id: "1.3",
          topic: "Algebra: Sequences and Series",
          mainTopic: "Algebra",
          subtopic: "Sequences and Series"
        },
        {
          id: "2.1",
          topic: "Calculus: Differentiation",
          mainTopic: "Calculus",
          subtopic: "Differentiation"
        },
        {
          id: "2.2",
          topic: "Calculus: Integration",
          mainTopic: "Calculus",
          subtopic: "Integration"
        }
      ];
    }
    
    // Dance fallbacks
    if (subjectLower.includes('dance')) {
      return [
        {
          id: "1.1",
          topic: "Choreography: Choreographic Process",
          mainTopic: "Choreography",
          subtopic: "Choreographic Process"
        },
        {
          id: "1.2",
          topic: "Choreography: Composition Techniques",
          mainTopic: "Choreography",
          subtopic: "Composition Techniques"
        },
        {
          id: "2.1",
          topic: "Performance: Technical Skills",
          mainTopic: "Performance",
          subtopic: "Technical Skills"
        },
        {
          id: "2.2",
          topic: "Performance: Expressive Skills",
          mainTopic: "Performance",
          subtopic: "Expressive Skills"
        },
        {
          id: "3.1",
          topic: "Dance Appreciation: Critical Analysis",
          mainTopic: "Dance Appreciation",
          subtopic: "Critical Analysis"
        }
      ];
    }
    
    // Generic fallback for any other subject
    return [
      {
        id: "1.1",
        topic: `${subject}: Core Concepts`,
        mainTopic: subject,
        subtopic: "Core Concepts"
      },
      {
        id: "1.2",
        topic: `${subject}: Key Principles`,
        mainTopic: subject,
        subtopic: "Key Principles"
      },
      {
        id: "1.3",
        topic: `${subject}: Fundamental Applications`,
        mainTopic: subject,
        subtopic: "Fundamental Applications"
      },
      {
        id: "1.4",
        topic: `${subject}: Historical Development`,
        mainTopic: subject,
        subtopic: "Historical Development"
      },
      {
        id: "1.5",
        topic: `${subject}: Contemporary Issues`,
        mainTopic: subject,
        subtopic: "Contemporary Issues"
      }
    ];
  };

  // Toggle expansion of a main topic
  const toggleMainTopic = (topicName) => {
    setExpandedTopics(prev => ({
      ...prev,
      [topicName]: !prev[topicName]
    }));
  };
  
  // Add a new topic
  const addTopic = () => {
    if (!newTopicInput.mainTopic.trim() || !newTopicInput.subtopic.trim()) {
      setError("Both Main Topic and Subtopic are required");
      return;
    }
    
    // Generate a new ID based on existing topics
    let maxMainId = 0;
    let existingSubIds = [];
    
    topics.forEach(topic => {
      const idParts = topic.id.split('.');
      const mainId = parseInt(idParts[0]);
      
      if (mainId > maxMainId) {
        maxMainId = mainId;
      }
      
      if (topic.mainTopic === newTopicInput.mainTopic) {
        existingSubIds.push(parseInt(idParts[1]));
      }
    });
    
    // If this is a new main topic, create it with ID of (max+1).1
    // If this is an existing main topic, use the next available subtopic ID
    let newId;
    if (topics.some(t => t.mainTopic === newTopicInput.mainTopic)) {
      // Find the next available subtopic ID
      const maxSubId = Math.max(...existingSubIds, 0);
      newId = `${mainTopics.findIndex(m => m.name === newTopicInput.mainTopic) + 1}.${maxSubId + 1}`;
    } else {
      newId = `${maxMainId + 1}.1`;
    }
    
    const newTopic = {
      id: newId,
      topic: `${newTopicInput.mainTopic}: ${newTopicInput.subtopic}`,
      mainTopic: newTopicInput.mainTopic,
      subtopic: newTopicInput.subtopic
    };
    
    setTopics(prev => [...prev, newTopic]);
    setNewTopicInput({ mainTopic: '', subtopic: '' });
    setError(null);
    
    // Auto-expand this main topic
    setExpandedTopics(prev => ({
      ...prev,
      [newTopicInput.mainTopic]: true
    }));
  };
  
  // Delete a topic
  const deleteTopic = (topicId) => {
    setTopics(prev => prev.filter(t => t.id !== topicId));
  };
  
  // Start editing a topic
  const startEdit = (topic) => {
    setEditMode(topic.id);
    setEditValue({
      mainTopic: topic.mainTopic,
      subtopic: topic.subtopic
    });
  };
  
  // Save an edited topic
  const saveEdit = (topicId) => {
    if (!editValue.mainTopic.trim() || !editValue.subtopic.trim()) {
      setError("Both Main Topic and Subtopic are required");
      return;
    }
    
    setTopics(prev => prev.map(topic => {
      if (topic.id === topicId) {
        return {
          ...topic,
          topic: `${editValue.mainTopic}: ${editValue.subtopic}`,
          mainTopic: editValue.mainTopic,
          subtopic: editValue.subtopic
        };
      }
      return topic;
    }));
    
    setEditMode(null);
    setEditValue({ mainTopic: '', subtopic: '' });
    setError(null);
  };
  
  // Cancel editing
  const cancelEdit = () => {
    setEditMode(null);
    setEditValue({ mainTopic: '', subtopic: '' });
  };
  
  // Start editing a main topic
  const startMainTopicEdit = (mainTopicName) => {
    setEditMainTopicMode(mainTopicName);
    setEditMainTopicValue(mainTopicName);
  };
  
  // Save main topic edit
  const saveMainTopicEdit = (oldMainTopicName) => {
    if (!editMainTopicValue.trim()) {
      setError("Main Topic name cannot be empty");
      return;
    }
    
    // Update all topics with this main topic name
    setTopics(prev => prev.map(topic => {
      if (topic.mainTopic === oldMainTopicName) {
        return {
          ...topic,
          topic: `${editMainTopicValue}: ${topic.subtopic}`,
          mainTopic: editMainTopicValue
        };
      }
      return topic;
    }));
    
    setEditMainTopicMode(null);
    setEditMainTopicValue('');
    setError(null);
  };
  
  // Cancel main topic edit
  const cancelMainTopicEdit = () => {
    setEditMainTopicMode(null);
    setEditMainTopicValue('');
  };
  
  // Toggle optional status for a topic
  const toggleOptionalStatus = (topicId) => {
    setSelectedOptionalTopics(prev => {
      const newState = { ...prev };
      // If topic is already selected, unselect it, otherwise select it
      if (newState[topicId]) {
        delete newState[topicId];
      } else {
        newState[topicId] = true;
      }
      return newState;
    });
    
    // When a topic is selected (marked as non-optional), update the topics state
    // to reflect this in the UI and when saved
    setTopics(prev => prev.map(topic => {
      if (topic.id === topicId) {
        const isCurrentlySelected = selectedOptionalTopics[topicId];
        
        if (isCurrentlySelected) {
          // If it's currently selected, we're toggling it back to optional
          return topic;
        } else {
          // We're selecting it, so remove [Optional] from the name if present
          const newMainTopic = topic.mainTopic.replace(/\[\s*Optional[^\]]*\]\s*/gi, '').trim();
          const newSubtopic = topic.subtopic.replace(/\[\s*Optional[^\]]*\]\s*/gi, '').trim();
          const newTopic = `${newMainTopic}: ${newSubtopic}`;
          
          return {
            ...topic,
            topic: newTopic,
            mainTopic: newMainTopic,
            subtopic: newSubtopic,
            isSelected: true
          };
        }
      }
      return topic;
    }));
  };
  
  // Show delete main topic confirmation dialog
  const showDeleteMainTopicConfirmation = (mainTopicName) => {
    setMainTopicToDelete(mainTopicName);
    setShowDeleteMainTopicDialog(true);
  };
  
  // Handle regenerating all topics
  const handleRegenerateTopics = () => {
    if (window.confirm("This will replace all topics. Are you sure?")) {
      generateTopics();
    }
  };
  
  // Handle saving topic list - REVISED LOGIC
  const handleSaveTopicList = useCallback(() => {
    console.log("handleSaveTopicList triggered");
    
    // Add a guard to prevent repeated runs if topics are already saved
    if (topicListSaved) {
      console.log("Topics already saved, ignoring duplicate save request");
      return;
    }
    
    // Basic validation
    if (!topics || topics.length === 0) {
      console.error("No topics available to finalize.");
      setError("No topics available to save."); // Use setError if needed
      return;
    }

    console.log("TOPIC HUB: Creating topic shells from", topics.length, "topics");
    console.log("TOPIC HUB: First few topics:", topics.slice(0, 3));
    console.log("TOPIC HUB: Subject:", subject, "examBoard:", examBoard, "examType:", examType);

    // Format topics into topic shells for the unified model
    const topicShells = topics.map(topic => ({
      id: topic.id || generateId('topic'), // Use imported generateId
      type: 'topic', // Explicitly set type
      name: topic.topic || topic.name || 'Unknown Topic', // Use consistent name property if possible
      subject: subject || "Unknown Subject", 
      examBoard: topic.examBoard || examBoard || "Unknown Board", // Get examBoard from topic or prop
      examType: topic.examType || examType || "Unknown Type", // Get examType from topic or prop
      color: topic.color || '#cccccc', // Default grey or assign later
      isShell: true,
      isEmpty: true,
      cards: [], // Shells start empty
      created: topic.created || new Date().toISOString(),
      updated: new Date().toISOString()
    }));

    console.log("TOPIC HUB: Created", topicShells.length, "topic shells");
    console.log("TOPIC HUB: First few shells:", topicShells.slice(0, 3));

    // Call the prop passed down from App.js to update the main state
    if (onFinalizeTopics) {
      try {
        console.log("TOPIC HUB: Calling onFinalizeTopics with", topicShells.length, "shells");
        onFinalizeTopics(topicShells);
        console.log("TOPIC HUB: onFinalizeTopics call completed successfully");
        
        // Update local state to show success
        setTopicListSaved(true);
        setShowSuccessModal(true); // Show the success modal
        setError(null); // Clear any previous errors
      } catch (error) {
        console.error("Error calling onFinalizeTopics:", error);
        setError("Failed to finalize topics in main app state.");
      }
    } else {
      console.error("onFinalizeTopics prop is missing!");
      setError("Save functionality is not configured correctly.");
    }
  }, [topics, subject, examBoard, examType, onFinalizeTopics, topicListSaved]);
  
  // Handle selecting a topic to continue with card generation
  const handleSelectTopic = () => {
    if (!selectedTopic) {
      setError("Please select a topic first");
      return;
    }
    
    // Save content guidance for this topic in localStorage
    if (contentGuidance) {
      localStorage.setItem(`contentGuidance_${selectedTopic.id}`, contentGuidance);
    }
    
    // Add content guidance to the topic object when passing to parent
    const topicWithGuidance = {
      ...selectedTopic,
      contentGuidance: contentGuidance
    };
    
    onSelectTopic && onSelectTopic(topicWithGuidance);
    setShowSelectDialog(false);
  };
  
  // Dismiss the fallback notice
  const dismissFallbackNotice = () => {
    setShowFallbackNotice(false);
  };
  
  // Render initial generator section
  const renderGenerator = () => {
    return (
      <div className="topic-generator">
        <div className="topic-generator-header">
          <h3>Generate Topics for {subject}</h3>
          <p>
            Generate a comprehensive list of topics for {subject} ({examBoard} {examType}).
            {examType === 'GCSE' || examType === 'A-Level' ? (
              <span> Topics will be sourced from our curriculum database for accuracy.</span>
            ) : (
              <span> Topics will be generated using our AI-powered system based on latest curriculum requirements.</span>
            )}
          </p>
        </div>
        
        {isGenerating ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">{loadingStatus || `Generating topics for ${subject}...`}</p>
            <p className="loading-text">
              {(examType === 'GCSE' || examType === 'A-Level') 
                ? 'This may take a moment while we search our database.' 
                : 'This may take a moment while we analyze the curriculum.'}
            </p>
          </div>
        ) : (
          <div className="generation-actions">
            <button 
              className="generation-button" 
              onClick={generateTopics}
              disabled={isGenerating}
            >
              {(examType === 'GCSE' || examType === 'A-Level') 
                ? <><FaDatabase /> Load Topics from Database</> 
                : <><FaMagic /> Generate Topics with AI</>}
            </button>
            <p className="generation-help-text">
              Click the button above to {(examType === 'GCSE' || examType === 'A-Level') ? 'load' : 'generate'} a comprehensive list of topics for your subject.
              You'll be able to review and edit the topics afterward.
            </p>
          </div>
        )}
      </div>
    );
  };
  
  // Render select topic dialog
  const renderSelectDialog = () => {
    if (!showSelectDialog) return null;
    
    return (
      <div className="modal-overlay">
        <div className="select-topic-dialog">
          <h3>Select Topic to Continue</h3>
          <p>Choose a topic to generate flashcards for.</p>
          
          <div className="select-topic-form">
            <select
              value={selectedTopic ? selectedTopic.id : ''}
              onChange={(e) => {
                const selected = topics.find(t => t.id === e.target.value);
                setSelectedTopic(selected);
              }}
              className="topic-select"
            >
              <option value="">-- Select a Topic --</option>
              {mainTopics.map(mainTopic => (
                <optgroup key={mainTopic.name} label={mainTopic.name}>
                  {mainTopic.subtopics.map(topic => (
                    <option key={topic.id} value={topic.id}>
                      {topic.id} - {topic.subtopic}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            
            {selectedTopic && (
              <div className="content-guidance-section">
                <label htmlFor="content-guidance" className="guidance-label">
                  Additional Content Guidance (optional):
                </label>
                <textarea
                  id="content-guidance"
                  value={contentGuidance}
                  onChange={(e) => setContentGuidance(e.target.value)}
                  placeholder="Add specific instructions for this topic (e.g., focus areas, important concepts, or formatting preferences)"
                  className="content-guidance-input"
                  maxLength={500}
                />
                <p className="guidance-help-text">
                  <small>
                    This guidance will be used when generating flashcards to provide additional context.
                    Max 500 characters. {contentGuidance.length}/500
                  </small>
                </p>
              </div>
            )}
            
            <div className="select-topic-actions">
              <button onClick={() => setShowSelectDialog(false)} className="cancel-button">
                Cancel
              </button>
              <button 
                onClick={handleSelectTopic} 
                className="continue-button"
                disabled={!selectedTopic}
              >
                <FaBolt /> Continue with Selected Topic
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the main topics and subtopics
  const renderTopics = () => {
    if (!mainTopics || mainTopics.length === 0) {
      return renderGenerator();
    }
    
    return (
      <div className="topics-container">
        <div className="topics-header">
          <h3>Generated Topics ({topics.length})</h3>
          <div className="topics-actions">
            {hasGenerated && (
              <button 
                className="regenerate-button" 
                onClick={handleRegenerateTopics}
                disabled={isGenerating}
              >
                <FaRedo /> Regenerate All Topics
              </button>
            )}
            <button 
              className="finalize-button primary-button" 
              onClick={handleFinalizeTopics}
              disabled={topics.length === 0 || isGenerating}
            >
              <FaCheckCircle /> Confirm and Save Shells
            </button>
          </div>
        </div>
        
        <div className="main-topics-list">
          {mainTopics.map((mainTopic, index) => (
            <div key={mainTopic.name || index} className="main-topic-container">
              <div className="main-topic-header-container">
                {editMainTopicMode === mainTopic.name ? (
                  <div className="main-topic-edit-form">
                    <input
                      type="text"
                      value={editMainTopicValue}
                      onChange={(e) => setEditMainTopicValue(e.target.value)}
                      placeholder="Main Topic Name"
                      className="edit-main-topic-name"
                      autoFocus
                    />
                    <div className="edit-form-actions">
                      <button onClick={() => saveMainTopicEdit(mainTopic.name)} className="save-edit-button">
                        <FaSave />
                      </button>
                      <button onClick={cancelMainTopicEdit} className="cancel-edit-button">
                        <FaExclamationTriangle />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="main-topic-header"
                    onClick={() => toggleMainTopic(mainTopic.name)}
                  >
                    <span 
                      className="main-topic-name"
                      data-optional={mainTopic.name.includes("[Optional]")}
                    >
                      <FaFolder /> {mainTopic.name}
                    </span>
                    <span className="main-topic-count">
                      {mainTopic.subtopics.length} subtopics
                    </span>
                    <div className="main-topic-actions">
                      <button
                        className="edit-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startMainTopicEdit(mainTopic.name);
                        }}
                        title="Edit Main Topic"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="delete-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          showDeleteMainTopicConfirmation(mainTopic.name);
                        }}
                        title="Delete Main Topic and All Subtopics"
                      >
                        <FaTrash />
                      </button>
                      <span className="main-topic-toggle">
                        {expandedTopics[mainTopic.name] ? <FaChevronUp /> : <FaChevronDown />}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {expandedTopics[mainTopic.name] && (
                <div className="subtopics-list">
                  {mainTopic.subtopics.map(topic => (
                    <div key={topic.id} className="subtopic-item">
                      {editMode === topic.id ? (
                        <div className="subtopic-edit-form">
                          <div className="edit-form-inputs">
                            <input
                              type="text"
                              value={editValue.mainTopic}
                              onChange={(e) => setEditValue({...editValue, mainTopic: e.target.value})}
                              placeholder="Main Topic"
                              className="edit-main-topic"
                            />
                            <input
                              type="text"
                              value={editValue.subtopic}
                              onChange={(e) => setEditValue({...editValue, subtopic: e.target.value})}
                              placeholder="Subtopic"
                              className="edit-subtopic"
                              autoFocus
                            />
                          </div>
                          <div className="edit-form-actions">
                            <button onClick={() => saveEdit(topic.id)} className="save-edit-button">
                              <FaSave />
                            </button>
                            <button onClick={cancelEdit} className="cancel-edit-button">
                              <FaExclamationTriangle />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="subtopic-info">
                            <span className="subtopic-id">{topic.id}</span>
                            <span 
                              className="subtopic-name"
                              data-optional={(topic.subtopic && topic.subtopic.includes("[Optional]")) || 
                                            (topic.mainTopic && topic.mainTopic.includes("[Optional]"))}
                            >
                              {topic.subtopic || "Unknown Subtopic"}
                            </span>
                          </div>
                          <div className="subtopic-actions">
                            {/* Optional topic selection button - only show for optional topics */}
                            {((topic.subtopic && topic.subtopic.includes("[Optional]")) || 
                              (topic.mainTopic && topic.mainTopic.includes("[Optional]"))) && (
                              <button
                                className={`select-optional-button ${selectedOptionalTopics[topic.id] ? 'selected' : ''}`}
                                onClick={() => toggleOptionalStatus(topic.id)}
                                title={selectedOptionalTopics[topic.id] ? "Mark as Optional" : "Select as Required"}
                              >
                                <FaCheck />
                              </button>
                            )}
                            <button
                              className="edit-button"
                              onClick={() => startEdit(topic)}
                              title="Edit Topic"
                            >
                              <FaEdit />
                            </button>
                            <button
                              className="delete-button"
                              onClick={() => deleteTopic(topic.id)}
                              title="Delete Topic"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="add-topic-section">
          <h4>Add New Topic</h4>
          <div className="add-topic-form">
            <div className="add-topic-inputs">
              <div className="main-topic-input-container">
                <div className="topic-input-toggle">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={useExistingMainTopic}
                      onChange={() => setUseExistingMainTopic(!useExistingMainTopic)}
                      className="toggle-checkbox"
                    />
                    <span className="toggle-text">
                      {useExistingMainTopic ? "Select existing main topic" : "Add new main topic"}
                    </span>
                  </label>
                </div>
                
                {useExistingMainTopic && mainTopics.length > 0 ? (
                  <select
                    value={newTopicInput.mainTopic}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setUseExistingMainTopic(false);
                        setNewTopicInput({...newTopicInput, mainTopic: ''});
                      } else {
                        setNewTopicInput({...newTopicInput, mainTopic: e.target.value});
                      }
                    }}
                    className="main-topic-select"
                  >
                    <option value="">-- Select Main Topic --</option>
                    {mainTopics.map(mainTopic => (
                      <option key={mainTopic.name} value={mainTopic.name}>
                        {mainTopic.name}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add New Main Topic</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newTopicInput.mainTopic}
                    onChange={(e) => setNewTopicInput({...newTopicInput, mainTopic: e.target.value})}
                    placeholder="Main Topic"
                    className="add-main-topic"
                  />
                )}
              </div>
              <input
                type="text"
                value={newTopicInput.subtopic}
                onChange={(e) => setNewTopicInput({...newTopicInput, subtopic: e.target.value})}
                placeholder="Subtopic"
                className="add-subtopic"
              />
            </div>
            <button 
              onClick={addTopic} 
              className="add-topic-button"
              disabled={!newTopicInput.mainTopic.trim() || !newTopicInput.subtopic.trim() || newTopicInput.mainTopic === "__add_new__"}
            >
              <FaPlus /> Add Topic
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render fallback notice
  const renderFallbackNotice = () => {
    if (!showFallbackNotice) return null;
    
    return (
      <div className="fallback-notice">
        <div className="fallback-notice-content">
          <FaExclamationTriangle className="fallback-notice-icon" />
          <p className="fallback-notice-message">
            We couldn't find the exact topic list for <strong>{examBoard} {examType} {subject}</strong> for {academicYear}.
            The topics below are typical for this subject/level based on previous years.
            You can edit any topic for more precision when creating flashcards.
          </p>
        </div>
        <button className="fallback-notice-dismiss" onClick={dismissFallbackNotice} title="Dismiss">
          <FaTimes />
        </button>
      </div>
    );
  };
  
  // Render error modal for API rate limits
  const renderErrorModal = () => {
    if (!showErrorModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="error-modal">
          <h3><FaExclamationTriangle /> {errorMessage}</h3>
          <p>{errorDetails}</p>
          <div className="error-actions">
            <button 
              onClick={() => setShowErrorModal(false)} 
              className="close-button"
            >
              <FaTimes /> Close
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render success modal
  const renderSuccessModal = () => {
    if (!showSuccessModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="success-modal">
          <div className="success-header">
            <FaCheckCircle className="success-icon" />
            <h3>Topic List Saved Successfully!</h3>
          </div>
          
          <div className="success-content">
            <p>Your topic list has been saved and <strong>empty topic shells have been created</strong> for all your topics.</p>
            
            <div className="topic-shell-explanation">
              <h4><FaInfo /> What are topic shells?</h4>
              <p>Topic shells are empty containers where your flashcards will be stored. You can now:</p>
              <ul>
                <li>Add flashcards to these topics using the AI generator</li>
                <li>Create flashcards manually within each topic</li>
                <li>Import flashcards from other sources</li>
              </ul>
            </div>
            
            <div className="next-steps">
              <h4>Next Steps</h4>
              <p>Click "Finish" to return to your flashcard collection, where you'll see your new topics ready for cards.</p>
            </div>
          </div>
          
          <div className="success-actions">
            <button 
              onClick={() => {
                // First hide the modal
                setShowSuccessModal(false);
                // Then close the component after a short delay to prevent state conflicts
                setTimeout(() => {
                  onClose && onClose();
                }, 50);
              }} 
              className="finish-button"
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render loading overlay
  const renderLoadingOverlay = () => {
    if (!showLoadingOverlay) return null;
    
    return (
      <div className="loading-overlay">
        <div className="loading-overlay-content">
          <div className="loading-spinner"></div>
          <p className="loading-message">{loadingStatus || "Processing..."}</p>
        </div>
      </div>
    );
  };
  
  // Update the finalize topics function in TopicHub
  const handleFinalizeTopics = () => {
    console.log(`[TopicHub] Finalizing ${topics.length} topics for subject: ${subject}`);

    // Generate topic shells based on the current state of topics
    const topicShells = topics.map((topic, index) => {
      // Ensure we have a valid topic object
      if (!topic || typeof topic !== 'object') {
        console.warn(`[TopicHub] Skipping invalid topic at index ${index}:`, topic);
        return null;
      }
      
      // Use the subtopic name if available, otherwise use main topic or a placeholder
      const actualTopicName = topic.subtopic || topic.mainTopic || `Topic ${index + 1}`;
      const topicColor = topic.color || `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;

      return {
        id: topic.id || generateId('topic'), // Use existing ID or generate new one
        type: 'topic', // Indicate this is a topic shell
        isShell: true,
        subject: subject, // Subject from props
        name: `${subject}: ${actualTopicName}`, // Standard naming convention
        topic: actualTopicName, // The actual topic name
        examBoard: examBoard || "General", // Metadata from props
        examType: examType || "Course",
        color: topicColor, // Use assigned or random color
        timestamp: new Date().toISOString(),
        hasIcons: true, // Flag to show icons in FlashcardList
        // Include any other relevant metadata if available
        // metadata: { ... }
      };
    }).filter(shell => shell !== null); // Remove any null entries from invalid topics

    console.log(`[TopicHub] Generated ${topicShells.length} topic shells:`, topicShells);

    // Call the onFinalizeTopics prop passed from AICardGenerator
    if (onFinalizeTopics && typeof onFinalizeTopics === 'function') {
      // This function should handle saving the shells and closing the AICardGenerator
      onFinalizeTopics(topicShells);
      
      // Show a success message within TopicHub (optional, as AICardGenerator will close)
      setShowSuccessModal(true); // You might want to customize this modal

      // Note: We are NOT calling onClose() here directly anymore.
      // The AICardGenerator's onFinalizeTopics wrapper will handle closing.

    } else {
      console.error("[TopicHub] onFinalizeTopics function not provided or is not a function!");
      // Show an error to the user if the callback is missing
      setError("Error: Could not finalize topics. Missing callback function.");
    }
  };
  
  // Main render method
  return (
    <div className={`topic-hub`}>
      {renderTopics()}
      {renderFallbackNotice()}
      {renderErrorModal()}
      {renderSuccessModal()}
      {renderLoadingOverlay()}
    </div>
  );
};

export default TopicHub;
