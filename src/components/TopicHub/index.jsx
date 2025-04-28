import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaMagic, FaExclamationTriangle, FaEdit, FaTrash, FaPlus, FaSave, FaBolt, FaRedo, FaFolder, FaChevronDown, FaChevronUp, FaTimes, FaCheck, FaInfo, FaCheckCircle, FaDatabase } from 'react-icons/fa';
import './styles.css';
import { generateTopicPrompt } from '../../prompts/topicListPrompt';
import { generateId } from '../../utils/UnifiedDataModel';
import { fetchTopics } from '../../services/KnackTopicService';

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
  const [showAddTopicForm, setShowAddTopicForm] = useState(false);
  
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
  
  // State for deletion confirmation - fixed to properly destructure state
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
  const [progressMessage, setProgressMessage] = useState(''); // Add missing state for progress messages
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
  
  // Call the API to generate topics
  const generateTopics = async () => {
    setIsGenerating(true);
    setError(null);
    setUsingFallbackTopics(false);
    setShowFallbackNotice(false);
    
    // Save the current timestamp to avoid race conditions with multiple requests
    const currentRequestTimestamp = Date.now();
    lastRequestTimestamp.current = currentRequestTimestamp;
    
    // First try to fetch from Knack object_109 if not BTEC or IB
    if (examType !== 'BTEC' && examType !== 'IB' && examType !== 'International Baccalaureate') {
      try {
        console.log("Attempting to fetch topics from Knack object_109");
        setProgressMessage("Fetching topics from our database...");
        
        const knackTopics = await fetchTopics(examType, examBoard, subject);
        
        if (knackTopics && Array.isArray(knackTopics) && knackTopics.length > 0) {
          console.log(`Successfully retrieved ${knackTopics.length} topics from Knack object_109`);
          setProgressMessage("Topics found in database!");
          
          // STRICT LIMIT: Ensure no more than 30 topics
          let limitedTopics = knackTopics;
          if (limitedTopics.length > 30) {
            console.warn(`Limiting database topics from ${limitedTopics.length} to 30`);
            limitedTopics = limitedTopics.slice(0, 30);
          }
          
          // Store in cache and update UI
          storeTopicsInCache(examBoard, examType, subject, limitedTopics);
          setTopics(limitedTopics);
          setHasGenerated(true);
          setIsGenerating(false);
          return;
        } else {
          console.log("No topics found in Knack object_109 or empty result, falling back to AI generation");
          setProgressMessage("Generating topics with AI...");
        }
      } catch (knackError) {
        console.error("Error fetching from Knack:", knackError);
        console.log("Falling back to AI generation");
        setProgressMessage("Generating topics with AI...");
      }
    } else {
      console.log("BTEC selected, using AI generation directly");
      setProgressMessage("Generating topics with AI for BTEC...");
    }
    
    // If we've reached here, we need to use OpenAI as fallback
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
      
      // Post-process the topics to enforce our rules
      if (Array.isArray(parsedTopics) && parsedTopics.length > 0) {
        // 1. Filter out coursework/investigation/set works topics
        const excludeKeywords = [
          'coursework', 'investigation', 'set work', 'portfolio', 'project', 
          'non-examined', 'practical exam', 'field study', 'field trip'
        ];
        
        let processedTopics = parsedTopics.filter(topic => {
          if (!topic || !topic.mainTopic || !topic.subtopic) return true;
          
          // Skip topics that match exclusion keywords
          const mainTopic = topic.mainTopic.toLowerCase();
          const subtopic = topic.subtopic.toLowerCase();
          
          return !excludeKeywords.some(keyword => 
            mainTopic.includes(keyword) || subtopic.includes(keyword)
          );
        });
        
        // 2. Limit to maximum of 30 topics
        if (processedTopics.length > 30) {
          console.log(`Limiting topics from ${processedTopics.length} to 30`);
          processedTopics = processedTopics.slice(0, 30);
        }
        
        // 3. Re-number topics after filtering if needed
        if (processedTopics.length !== parsedTopics.length) {
          processedTopics = processedTopics.map((topic, index) => {
            const mainTopicNum = Math.floor(index / 5) + 1;
            const subtopicNum = (index % 5) + 1;
            return {
              ...topic,
              id: `${mainTopicNum}.${subtopicNum}`
            };
          });
        }
        
        parsedTopics = processedTopics;
      }
      
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
            const [, , , content] = sectionMatch;
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
    
    // STRICT LIMIT: Final enforcement of 30 topic maximum
    if (parsedTopics.length > 30) {
      console.warn(`[TopicHub] Final enforcement - limiting ${parsedTopics.length} topics to 30`);
      parsedTopics = parsedTopics.slice(0, 30);
    }
    
    // Store the topics in cache
    storeTopicsInCache(examBoard, examType, subject, parsedTopics);
    
    // Update the topics
    setTopics(parsedTopics);
    setHasGenerated(true);
    setIsGenerating(false);
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
  
  // Delete main topic and all its subtopics
  const deleteMainTopic = (mainTopicName) => {
    if (!mainTopicName) return;
    
    console.log(`[TopicHub] Deleting main topic: ${mainTopicName} and all its subtopics`);
    
    // Find all subtopics that belong to this main topic
    const topicsToDelete = topics.filter(topic => topic.mainTopic === mainTopicName);
    
    // Log what's being deleted
    console.log(`[TopicHub] Will delete ${topicsToDelete.length} subtopics`);
    
    // Filter out the main topic and all its subtopics
    setTopics(prevTopics => 
      prevTopics.filter(topic => topic.mainTopic !== mainTopicName)
    );
    
    // Close the confirmation dialog
    setShowDeleteMainTopicDialog(false);
    setMainTopicToDelete(null);
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
  
  // Add a notice to explain topic generation
  const renderTopicGenerationNotice = () => {
    if (!hasGenerated || !topics || topics.length === 0) return null;
    
    return (
      <div className="topic-generation-notice">
        <div className="notice-icon">ℹ️</div>
        <div className="notice-content">
          <p>
            <strong>About these topics:</strong> We've curated up to 30 key topics from the {examBoard} {examType} {subject} specification, 
            focusing on written exam content. While taken directly from the curriculum, the list may not be exhaustive.
            You can add your own topics as needed.
          </p>
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
          <h3>Topics for {subject} ({examBoard} {examType}) 
            <span className="topic-limit-badge">
              {topics.length > 30 ? 
                <span style={{color: 'red'}}>(Showing 30/{topics.length})</span> : 
                `(${topics.length}/30 max)`}
            </span>
          </h3>
          
          <div className="topics-actions">
            <button 
              className="regenerate-button" 
              onClick={handleRegenerateTopics}
              disabled={isGenerating}
              title="Generate a new set of topics"
            >
              <FaRedo /> Regenerate
            </button>
            
            <button
              className="save-topics-button"
              onClick={handleSaveTopicList}
              disabled={isGenerating || topicListSaved}
              title={topicListSaved ? "Topics already saved" : "Save this topic list"}
            >
              <FaSave /> {topicListSaved ? "Saved" : "Save List"}
            </button>
            
            <button
              className="confirm-shells-button"
              onClick={handleFinalizeTopics}
              disabled={isGenerating || topics.length === 0}
              title="Create empty topic shells for these topics"
              style={{ backgroundColor: '#2c3e50', color: 'white', fontWeight: 'bold' }}
            >
              <FaCheckCircle /> Confirm and Save Shells
            </button>
            
            <button
              className="add-topic-button"
              onClick={() => setShowAddTopicForm(true)}
              title="Add a new topic manually"
            >
              <FaPlus /> Add Topic
            </button>
          </div>
        </div>
        
        {renderTopicGenerationNotice()}
        
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
  
  // Updated finalize topics function - improved for stability and multi-subject support
  const handleFinalizeTopics = useCallback(() => {
    console.log(`[TopicHub] Finalizing ${topics.length} topics for subject: ${subject}`);

    // STRICT LIMIT: Ensure no more than 30 topics are processed
    let topicsToProcess = [...topics];
    if (topicsToProcess.length > 30) {
      console.warn(`[TopicHub] Too many topics (${topicsToProcess.length}), limiting to 30`);
      topicsToProcess = topicsToProcess.slice(0, 30);
    }

    // Generate topic shells based on the current state of topics
    const topicShells = topicsToProcess.map((topic, index) => {
      // Ensure we have a valid topic object
      if (!topic || typeof topic !== 'object') {
        console.warn(`[TopicHub] Skipping invalid topic at index ${index}:`, topic);
        return null;
      }
      
      // Use the subtopic name if available, otherwise use main topic or a placeholder
      const actualTopicName = topic.subtopic || topic.mainTopic || `Topic ${index + 1}`;
      
      // Generate a truly unique color for each topic to ensure visibility
      const topicColor = topic.color || `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;

      // Create a truly unique ID by adding a timestamp and random number to ensure uniqueness
      // We'll create a unique ID that won't conflict with other subjects
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 10000);
      // Make sure uniqueId format is consistent across saves
      const uniqueId = `${index+1}.${(index % 5) + 1}_${timestamp}_${randomSuffix}`;

      return {
        id: uniqueId, // Create a guaranteed unique ID
        type: 'topic', // Indicate this is a topic shell
        isShell: true,
        isEmpty: true, // Explicitly mark as empty
        subject: subject, // Subject from props
        name: `${subject}: ${actualTopicName}`, // Standard naming convention
        topic: actualTopicName, // The actual topic name
        examBoard: examBoard || "General", // Metadata from props
        examType: examType || "Course",
        color: topicColor, // Use assigned or random color
        createdAt: new Date(timestamp).toISOString(),
        updatedAt: new Date(timestamp).toISOString(),
      };
    }).filter(shell => shell !== null); // Remove any null entries from invalid topics

    console.log(`[TopicHub] Generated ${topicShells.length} topic shells:`, topicShells);

    // Store a reference to the handler to avoid any scope/closure issues
    const finalizeHandler = onFinalizeTopics;
    const closeHandler = onClose;

    // Extra verification logging
    if (!finalizeHandler) {
      console.error("[TopicHub] ERROR: onFinalizeTopics is null or undefined!");
    } else if (typeof finalizeHandler !== 'function') {
      console.error("[TopicHub] ERROR: onFinalizeTopics is not a function, type:", typeof finalizeHandler);
    } else {
      console.log("[TopicHub] onFinalizeTopics check passed - it's a function");
    }

    // Call the onFinalizeTopics prop passed from parent
    if (finalizeHandler && typeof finalizeHandler === 'function') {
      try {
        // This function will handle saving the shells and any next steps
        finalizeHandler(topicShells);
        console.log("[TopicHub] Successfully called onFinalizeTopics with shells");
        
        // Clear any error state
        setError(null);
        
        // Don't show success modal - the parent will handle the flow
        // Instead, immediately trigger close to return to main app
        if (closeHandler && typeof closeHandler === 'function') {
          closeHandler();
        } else {
          console.warn("[TopicHub] Close handler is missing or not a function");
        }
      } catch (error) {
        console.error("[TopicHub] Error during onFinalizeTopics:", error);
        setError("Error saving topics: " + error.message);
      }
    } else {
      console.error("[TopicHub] onFinalizeTopics function not provided or is not a function!");
      // Show an error to the user if the callback is missing
      setError("Error: Could not finalize topics. Missing callback function.");
    }
  }, [topics, subject, examBoard, examType, onFinalizeTopics, onClose]);
  
  // Render delete main topic confirmation dialog
  const renderDeleteMainTopicDialog = () => {
    if (!showDeleteMainTopicDialog) return null;
    
    return (
      <div className="modal-overlay">
        <div className="delete-dialog">
          <div className="delete-dialog-header">
            <FaExclamationTriangle className="warning-icon" />
            <h3>Delete Main Topic?</h3>
          </div>
          
          <div className="delete-dialog-content">
            <p>
              Are you sure you want to delete the main topic 
              <strong> "{mainTopicToDelete}" </strong> 
              and all its subtopics?
            </p>
            <p className="warning-text">
              This action cannot be undone.
            </p>
          </div>
          
          <div className="delete-dialog-actions">
            <button 
              onClick={() => {
                setShowDeleteMainTopicDialog(false);
                setMainTopicToDelete(null);
              }} 
              className="cancel-button"
            >
              Cancel
            </button>
            <button 
              onClick={() => deleteMainTopic(mainTopicToDelete)}
              className="delete-button"
            >
              Delete All
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Main render method
  return (
    <div className={`topic-hub`}>
      {renderTopics()}
      {renderFallbackNotice()}
      {renderErrorModal()}
      {renderSuccessModal()}
      {renderDeleteMainTopicDialog()}
      {renderLoadingOverlay()}
    </div>
  );
};

export default TopicHub;
