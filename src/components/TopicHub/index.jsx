import React, { useState, useEffect, useRef } from 'react';
import { FaMagic, FaExclamationTriangle, FaEdit, FaTrash, FaPlus, FaSave, FaBolt, FaRedo, FaFolder, FaChevronDown, FaChevronUp, FaTimes, FaCheck, FaDatabase, FaInfo, FaCheckCircle } from 'react-icons/fa';
import './styles.css';
import { generateTopicPrompt } from '../../prompts/topicListPrompt';

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
  recordId
}) => {
  // State for topic management
  const [topics, setTopics] = useState(initialTopics);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [mainTopics, setMainTopics] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState(null);
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
  const [usingCache, setUsingCache] = useState(false);
  const lastRequestTimestamp = useRef(0);
  const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between API calls
  
  // State for edit functionality
  const [editMode, setEditMode] = useState(null);
  const [editValue, setEditValue] = useState({ mainTopic: '', subtopic: '' });
  const [editMainTopicMode, setEditMainTopicMode] = useState(null);
  const [editMainTopicValue, setEditMainTopicValue] = useState('');
  
  // State for deletion confirmation
  const [showDeleteMainTopicDialog, setShowDeleteMainTopicDialog] = useState(false);
  const [mainTopicToDelete, setMainTopicToDelete] = useState(null);
  
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
  const [darkMode, setDarkMode] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  
  // Process topics into main topic groupings when topics change
  useEffect(() => {
    if (topics && topics.length > 0) {
      const topicGroups = {};
      
      // Group topics by mainTopic
      topics.forEach(topic => {
        const mainTopic = topic.mainTopic;
        if (!topicGroups[mainTopic]) {
          topicGroups[mainTopic] = [];
        }
        topicGroups[mainTopic].push(topic);
      });
      
      // Convert to array format for rendering
      const mainTopicArray = Object.keys(topicGroups).map(mainTopic => ({
        name: mainTopic,
        subtopics: topicGroups[mainTopic]
      }));
      
      setMainTopics(mainTopicArray);
      
      // If this is the first time processing topics, expand the first main topic
      if (mainTopicArray.length > 0 && Object.keys(expandedTopics).length === 0) {
        setExpandedTopics({ [mainTopicArray[0].name]: true });
      }
    } else {
      setMainTopics([]);
    }
  }, [topics]);
  
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
  
  // Call the API to generate topics
  const generateTopics = async () => {
    setIsGenerating(true);
    setError(null);
    setUsingCache(false);
    setUsingFallbackTopics(false);
    setShowFallbackNotice(false);
    
    try {
      console.log("Starting topic generation for:", examBoard, examType, subject);
      
      // Check cache first before making API call
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
      
      // Make the API call to generate topics
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "user",
            content: generateTopicPrompt(examBoard, examType, subject, academicYear)
          }],
          max_tokens: 2000,
          temperature: 0.8
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No content returned from API");
      }
      
      // Parse and process the topics from the API response
      let content = data.choices[0].message.content;
      
      // Log the raw API response
      console.log("==== RAW API RESPONSE FROM OPENAI ====");
      console.log(content);
      console.log("==== END RAW API RESPONSE ====");
      
      // Enhanced preprocessing for GPT-4's verbose responses - more aggressive cleanup
      content = content.replace(/```json|```javascript|```|\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
        .replace(/^[\s\S]*?\[/m, '[')  // Remove any text before first opening bracket
        .trim();
      
      // Find JSON array in response - looking for content between [ and ]
      const jsonMatch = content.match(/\[([\s\S]*?)\]/m);
      const potentialJson = jsonMatch ? `[${jsonMatch[1]}]` : content;
      
      console.log("Content after preprocessing:", potentialJson.substring(0, 150) + "...");
      
      let parsedTopics;
      let usedFallback = false;
      
      try {
        parsedTopics = JSON.parse(potentialJson);
        console.log("Successfully parsed JSON response:", parsedTopics);
        
        // Check if the API returned an error object
        const hasErrorObject = Array.isArray(parsedTopics) && 
          parsedTopics.length === 1 && 
          parsedTopics[0] && 
          parsedTopics[0].hasOwnProperty('error');
        
        if (hasErrorObject) {
          console.log("API returned an error object:", parsedTopics[0].error);
          console.log("Switching to fallback topics");
          usedFallback = true;
          
          // Use subject-specific fallbacks
          const hardcodedFallbacks = getSubjectFallbackTopics(subject, examBoard, examType);
          
          if (hardcodedFallbacks && hardcodedFallbacks.length > 0) {
            console.log("Using subject-specific fallbacks");
            parsedTopics = hardcodedFallbacks;
          } else {
            // If no subject-specific fallbacks available, use generic ones
            console.log("No subject-specific fallbacks, using generic fallbacks");
            parsedTopics = [
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
          }
          
          setUsingFallbackTopics(true);
          setShowFallbackNotice(true);
        }
      } catch (e) {
        console.error("Failed to parse topic response as JSON:", e);
        usedFallback = true;
        
        // Check if it's an error message and provide better feedback
        if (content.includes("I'm sorry") || content.includes("Error")) {
          // Extract a more useful error message
          const displayError = content.split('.')[0] || "Error from API";
          console.error("API returned an error message:", displayError);
        }

        // More aggressive JSON extraction
        try {
          // Find anything that looks like a JSON array using a more aggressive regex
          const jsonRegex = /\[\s*{[\s\S]*}\s*\]/g;
          const jsonMatches = content.match(jsonRegex);
          
          if (jsonMatches && jsonMatches.length > 0) {
            console.log("Found potential JSON with aggressive regex:", jsonMatches[0].substring(0, 100));
            parsedTopics = JSON.parse(jsonMatches[0]);
            usedFallback = false;
          } else {
            // Try to handle the case where we have a valid array of strings but not JSON
            // eslint-disable-next-line no-eval
            const possibleArray = eval(`(${content})`);
            if (Array.isArray(possibleArray) && possibleArray.length > 0) {
              console.log("Response was a JavaScript array, not JSON:", possibleArray);
              parsedTopics = possibleArray;
              usedFallback = false;
            } else {
              throw new Error("Could not extract valid array");
            }
          }
        } catch (innerError) {
          console.error("All parsing attempts failed:", innerError);
          // Fall back to sample topic
          parsedTopics = [
            {
              id: "1.1",
              topic: "Sample Topic: Introduction",
              mainTopic: "Sample Topic",
              subtopic: "Introduction"
            }
          ];
          console.log("Created fallback topics due to parsing failure");
          usedFallback = true;
        }
      }
      
      // If we used a fallback method, update the state
      if (usedFallback) {
        console.log("EXPLICITLY SETTING FALLBACK STATE - Parsing required fallback");
        setUsingFallbackTopics(true);
        setShowFallbackNotice(true);
      }
      
      if (!Array.isArray(parsedTopics)) {
        console.error("Response is not an array:", typeof parsedTopics);
        // Convert to array if it's an object with properties we can use
        if (typeof parsedTopics === 'object' && parsedTopics !== null) {
          parsedTopics = [parsedTopics];
        } else {
          throw new Error("Unexpected response format: not an array");
        }
      }
      
      // Process array of strings if needed (convert to required object format)
      if (parsedTopics.length > 0 && typeof parsedTopics[0] === 'string') {
        console.log("Converting array of strings to topic objects...");
        parsedTopics = parsedTopics.map((topicStr, index) => {
          // Check for Option prefix and extract it
          let optionalPrefix = "";
          let processedTopicStr = topicStr;
          
          const optionMatch = topicStr.match(/^Option\s+(\d+|[A-Z]):\s*(.*)/i);
          if (optionMatch) {
            optionalPrefix = `[Optional - Option ${optionMatch[1]}] `;
            processedTopicStr = optionMatch[2].trim();
          }
          
          // Check if the string contains a colon or section number pattern
          const hasColon = processedTopicStr.includes(':');
          const hasSectionNumber = /\d+\.\d+(\.\d+)?/.test(processedTopicStr);
          
          let mainTopic, subtopic;
          
          if (hasColon) {
            // Process string with a colon format (Main Topic: Subtopic)
            [mainTopic, subtopic] = [processedTopicStr.split(':')[0].trim(), processedTopicStr.split(':').slice(1).join(':').trim()];
          } else if (hasSectionNumber) {
            // Try to extract a section number and use it as part of main topic
            const sectionMatch = processedTopicStr.match(/(\d+\.\d+(\.\d+)?)\s*(.*)/);
            if (sectionMatch) {
              const [, sectionNum, , content] = sectionMatch;
              mainTopic = content.trim() || processedTopicStr;
              subtopic = mainTopic; // Use main topic as subtopic
            } else {
              mainTopic = processedTopicStr;
              subtopic = processedTopicStr; // Use the whole string as both
            }
          } else {
            // No clear structure - use the whole string as both
            mainTopic = processedTopicStr;
            subtopic = processedTopicStr;
          }
          
          // Add the optional prefix if found
          if (optionalPrefix) {
            mainTopic = optionalPrefix + mainTopic;
          }
          
          // Create a properly formatted topic object
          return {
            id: `${Math.floor(index / 5) + 1}.${(index % 5) + 1}`, // Create sections of 5 items
            topic: optionalPrefix + processedTopicStr,
            mainTopic: mainTopic,
            subtopic: subtopic || mainTopic // Use main topic instead of "General"
          };
        });
        console.log("Converted topics:", parsedTopics);
      }
      
      // Handle empty arrays by using hardcoded fallbacks
      if (parsedTopics.length === 0) {
        console.log("Received empty topics array, using hardcoded fallbacks");
        
        // Use hard-coded fallbacks
        const hardcodedFallbacks = getSubjectFallbackTopics(subject, examBoard, examType);
        
        if (hardcodedFallbacks && hardcodedFallbacks.length > 0) {
          console.log("Using subject-specific fallbacks:", hardcodedFallbacks.length, "topics");
          parsedTopics = hardcodedFallbacks;
          setUsingFallbackTopics(true);
          setShowFallbackNotice(true);
        } else {
          // Generic fallback if no subject-specific fallback available
          console.log("No subject-specific fallbacks, using generic ones");
          parsedTopics = [
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
          setUsingFallbackTopics(true);
          setShowFallbackNotice(true);
        }
      }
      
      // Final logging of topics before updating state
      console.log("===== FINAL TOPIC LIST BEING USED =====");
      console.log(JSON.stringify(parsedTopics, null, 2));
      console.log("Topic count:", parsedTopics.length);
      console.log("Using fallback:", usingFallbackTopics);
      console.log("===== END FINAL TOPIC LIST =====");
      
      // Store the topics in cache
      storeTopicsInCache(examBoard, examType, subject, parsedTopics);
      
      // Update the topics
      setTopics(parsedTopics);
      setHasGenerated(true);
      
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
        return;
      }
      
      // Show a more detailed error message to the user if fallbacks didn't work
      let errorMessage = `Failed to generate topics: ${error.message}`;
      if (error.message.includes("API key")) {
        errorMessage = "API key error. Please check your OpenAI API key configuration.";
      } else if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-openai-key") {
        errorMessage = "No API key found. Please add your OpenAI API key to the environment variables.";
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Generate fallback prompt for when specific exam topics can't be found
  const generateFallbackPrompt = (examBoard, examType, subject, academicYear) => {
    return `You are an education expert. Create a comprehensive list of topics that would TYPICALLY appear in a ${examBoard} ${examType} ${subject} curriculum for the ${academicYear} academic year.

YOUR RESPONSE MUST BE ONLY THE JSON ARRAY WITH NO OTHER TEXT - THIS IS CRITICAL.

Even without the exact specification, provide your best approximation based on standard curricula for this subject at this level.

Choose one format:

Format 1 - If this subject typically has main topics and subtopics:
[
  {
    "id": "1.1",
    "topic": "Main Topic 1: Subtopic 1",
    "mainTopic": "Main Topic 1",
    "subtopic": "Subtopic 1"
  }
]

Format 2 - If this subject typically doesn't have a clear main/subtopic structure:
[
  "Topic 1",
  "Topic 2",
  "Topic 3"
]

HANDLING OPTIONAL TOPICS:
If the curriculum typically includes optional topics:
- Include all optional topics in your response
- Mark optional topics by adding "[Optional]" at the beginning of the topic name
- If options are grouped, include the group, e.g. "[Optional - Option 1] Topic Name"

CRITICAL REQUIREMENTS:
- ENSURE YOUR RESPONSE BEGINS WITH "[" AND ENDS WITH "]"
- DO NOT ADD ANY TEXT BEFORE OR AFTER THE JSON ARRAY
- DO NOT INCLUDE "OPTION 1:" OR ANY OTHER LABELS
- Be comprehensive - include ALL typical topics for this subject
- Use appropriate subject terminology
- Organize topics in a logical curriculum sequence
- Provide 15-30 topics depending on the subject's breadth
- Format topic strings as "Main Topic: Subtopic" where appropriate
- Be specific and detailed in topic descriptions

This is a fallback request since the exact curriculum couldn't be found. Your goal is to create a reasonable approximation of standard topics for this subject.`;
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

  // Use the imported generateTopicPrompt function
  
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
  
  // Delete a main topic and all its subtopics
  const deleteMainTopic = () => {
    if (!mainTopicToDelete) return;
    
    // Remove all topics with this main topic name
    setTopics(prev => prev.filter(topic => topic.mainTopic !== mainTopicToDelete));
    
    // Close the dialog and reset state
    setShowDeleteMainTopicDialog(false);
    setMainTopicToDelete(null);
  };
  
  // Handle regenerating all topics
  const handleRegenerateTopics = () => {
    if (window.confirm("This will replace all topics. Are you sure?")) {
      generateTopics();
    }
  };
  
  // Handle saving topic list
  const handleSaveTopicList = () => {
    // Toggle save dialog visibility
    setShowSaveDialog(false);
    
    // Check if we have at least one topic
    if (!topics || topics.length === 0) {
      setErrorMessage("No topics to save");
      setErrorDetails("Please generate or add topics before saving.");
      setShowErrorModal(true);
      return;
    }
    
    // Format topics for saving with additional validation
    const topicListForSave = topics.map(topic => {
      // Ensure each required property exists
      if (!topic) {
        console.error("Found null/undefined topic in topics array");
        return {
          id: `topic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: "Unknown Topic",
          mainTopic: "Unknown",
          subtopic: "Unknown",
          topic: "Unknown Topic"
        };
      }
      
      return {
        id: topic.id || `topic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: `${topic.mainTopic || ''}: ${topic.subtopic || ''}`.trim() || "Unknown Topic",
        mainTopic: topic.mainTopic || subject || "Unknown",
        subtopic: topic.subtopic || "General",
        topic: `${topic.mainTopic || ''}: ${topic.subtopic || ''}`.trim() || "Unknown Topic"
      };
    });
    
    // Log the formatted topic list for debugging
    console.log("Formatted topic list for save:", topicListForSave);
    
    // Create the complete topicList object with metadata
    const completeTopicList = {
      name: `${subject} - ${examBoard} ${examType}`,
      topics: topicListForSave,
      examBoard: examBoard,
      examType: examType,
      subject: subject
    };
    
    // Call the parent's onSaveTopicList callback with the formatted topics
    if (onSaveTopicList) {
      setLoadingStatus("Saving your topic list...");
      setShowLoadingOverlay(true);
      
      try {
        // Send complete object with proper metadata
        const metadata = {
          subject,
          examBoard,
          examType,
          recordId
        };
        
        // Log the complete objects being passed to parent
        console.log("Sending topic list object to parent:", completeTopicList);
        console.log("With metadata:", metadata);
        
        // Handle both promise-based and callback-based implementations
        const result = onSaveTopicList(completeTopicList, metadata);
        
        // If the result is a promise, handle it with then/catch
        if (result && typeof result.then === 'function') {
          result.then((response) => {
            console.log("Topic save result:", response);
            setShowLoadingOverlay(false);
            
            if (response && response.success) {
              // Show success modal
              setShowSuccessModal(true);
            } else {
              // Handle error
              setErrorMessage("Error saving topic list");
              setErrorDetails(response?.error || "An unknown error occurred.");
              setShowErrorModal(true);
            }
          }).catch((error) => {
            console.error("Error saving topic list:", error);
            setShowLoadingOverlay(false);
            setErrorMessage("Error saving topic list");
            setErrorDetails(error?.message || "An unknown error occurred.");
            setShowErrorModal(true);
          });
        } else {
          console.log("Topic save completed (non-promise style)");
          setShowLoadingOverlay(false);
          setShowSuccessModal(true);
        }
      } catch (error) {
        console.error("Exception saving topic list:", error);
        setShowLoadingOverlay(false);
        setErrorMessage("Error saving topic list");
        setErrorDetails(error?.message || "An unexpected error occurred.");
        setShowErrorModal(true);
      }
    }
  };
  
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
            Generate a comprehensive list of topics for {subject} ({examBoard} {examType}) 
            using our AI-powered topic generation system. The topics will be based on 
            the latest curriculum requirements.
          </p>
        </div>
        
        {isGenerating ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Generating topics for {subject}...</p>
            <p className="loading-text">This may take a moment while we analyze the curriculum.</p>
          </div>
        ) : (
          <div className="generation-actions">
            <button 
              className="generation-button" 
              onClick={generateTopics}
              disabled={isGenerating}
            >
              <FaMagic /> Generate Topics
            </button>
            <p className="generation-help-text">
              Click the button above to generate a comprehensive list of topics for your subject.
              You'll be able to review and edit the topics afterward.
            </p>
          </div>
        )}
      </div>
    );
  };
  
  // Render save dialog
  const renderSaveDialog = () => {
    if (!showSaveDialog) return null;
    
    return (
      <div className="modal-overlay">
        <div className="save-topic-dialog">
          <h3>Save Topic List</h3>
          <p>Enter a name for this topic list so you can access it later.</p>
          
          <div className="save-topic-form">
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Topic List Name"
              className="topic-list-name-input"
            />
            
            <div className="save-topic-actions">
              <button onClick={() => setShowSaveDialog(false)} className="cancel-button">
                Cancel
              </button>
              <button 
                onClick={handleSaveTopicList} 
                className="save-button"
                disabled={!listName.trim()}
              >
                <FaSave /> Save Topic List
              </button>
            </div>
          </div>
        </div>
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
      return null;
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
              className="add-topic-button" 
              onClick={() => setShowSaveDialog(true)}
              disabled={topics.length === 0}
            >
              <FaSave /> Save Topic List
            </button>
            <button 
              className="continue-button" 
              onClick={() => setShowSelectDialog(true)}
              disabled={topics.length === 0}
            >
              Select Topic to Continue
            </button>
          </div>
        </div>
        
        <div className="main-topics-list">
          {mainTopics.map((mainTopic, index) => (
            <div key={mainTopic.name} className="main-topic-container">
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
                              className="generate-button"
                              onClick={() => {
                                setSelectedTopic(topic);
                                setShowSelectDialog(true);
                              }}
                              title="Generate Cards from this Topic"
                            >
                              <FaBolt />
                            </button>
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
                        // Switch to text input mode if user selects "Add New Main Topic"
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
                setShowSuccessModal(false);
                
                // Show a loading indicator
                setLoadingStatus("Finalizing your topic shells...");
                setShowLoadingOverlay(true);
                
                // Wait another 1 second before refreshing data
                console.log("Finishing topic shell creation, waiting 1 more second...");
                setTimeout(() => {
                  console.log("Requesting data refresh...");
                  // Completely exit the Topic Hub
                  onClose && onClose();
                  
                  // Instead of force reloading the page, request updated data
                  if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                      type: "REQUEST_UPDATED_DATA",
                      recordId: recordId,
                      timestamp: new Date().toISOString()
                    }, '*');
                    
                    console.log("Sent REQUEST_UPDATED_DATA message instead of reloading page");
                  } else {
                    // If we're not in an iframe, fall back to localStorage refresh
                    console.log("Not in iframe, using fallback refresh method");
                    // Trigger a global event that App.js can listen for
                    window.dispatchEvent(new CustomEvent('topicRefreshNeeded'));
                  }
                }, 1000); // Additional 1 second buffer
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
  
  // Main render method
  return (
    <div className={`topic-hub ${darkMode ? 'dark-mode' : ''}`}>
      {renderGenerator()}
      {renderSaveDialog()}
      {renderSelectDialog()}
      {renderTopics()}
      {renderFallbackNotice()}
      {renderErrorModal()}
      {renderSuccessModal()}
      {renderLoadingOverlay()}
    </div>
  );
};

export default TopicHub;