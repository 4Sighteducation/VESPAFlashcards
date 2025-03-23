import React, { useState, useEffect } from 'react';
import { FaMagic, FaExclamationTriangle, FaEdit, FaTrash, FaPlus, FaSave, FaBolt, FaRedo, FaFolder, FaChevronDown, FaChevronUp, FaTimes } from 'react-icons/fa';
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
  academicYear = "2024-2025"
}) => {
  // State for topic management
  const [topics, setTopics] = useState(initialTopics);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [mainTopics, setMainTopics] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState(null);
  const [newTopicInput, setNewTopicInput] = useState({ mainTopic: '', subtopic: '' });
  const [usingFallbackTopics, setUsingFallbackTopics] = useState(false);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  
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

  // Generate fallback topics using a second API call with a more forceful prompt
  const generateFallbackTopics = async () => {
    console.log("Attempting to generate fallback topics for:", subject);
    
    try {
      // Make a second API call with the fallback prompt
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{
            role: "user",
            content: generateFallbackPrompt(examBoard, examType, subject, academicYear)
          }],
          max_tokens: 2000,
          temperature: 0.7 // Higher temperature to encourage creativity if exact data unavailable
        })
      });
      
      if (!response.ok) {
        throw new Error(`Fallback API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No content returned from fallback API call");
      }
      
      let content = data.choices[0].message.content;
      console.log("==== FALLBACK API RESPONSE ====");
      console.log(content);
      console.log("==== END FALLBACK API RESPONSE ====");
      
      // Enhanced preprocessing similar to main processing function
      content = content.replace(/```json|```javascript|```|\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
        .replace(/^[\s\S]*?\[/m, '[')  // Remove any text before first opening bracket
        .trim();
      
      let parsedTopics;
      try {
        parsedTopics = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse fallback response as JSON:", e);
        
        // Try to handle as JavaScript array
        try {
          // eslint-disable-next-line no-eval
          const possibleArray = eval(content);
          if (Array.isArray(possibleArray) && possibleArray.length > 0) {
            parsedTopics = possibleArray;
          } else {
            return null;
          }
        } catch (evalError) {
          console.error("Failed to evaluate fallback as array:", evalError);
          return null;
        }
      }
      
      if (!Array.isArray(parsedTopics)) {
        if (typeof parsedTopics === 'object' && parsedTopics !== null) {
          parsedTopics = [parsedTopics];
        } else {
          return null;
        }
      }
      
      // Process array of strings if needed
      if (parsedTopics.length > 0 && typeof parsedTopics[0] === 'string') {
        parsedTopics = parsedTopics.map((topicStr, index) => {
          // Check if the topic string has an "Option X:" prefix and extract it
          let optionalPrefix = "";
          let processedTopicStr = topicStr;
          
          const optionMatch = topicStr.match(/^Option\s+(\d+|[A-Z]):\s*(.*)/i);
          if (optionMatch) {
            optionalPrefix = `[Optional - Option ${optionMatch[1]}] `;
            processedTopicStr = optionMatch[2].trim();
          }
          
          // Check if the string contains a colon or section number pattern (like 3.2.1)
          const hasColon = processedTopicStr.includes(':');
          const hasSectionNumber = /\d+\.\d+(\.\d+)?/.test(processedTopicStr);
          
          let mainTopic, subtopic;
          
          if (hasColon) {
            // Process string with a colon format (Main Topic: Subtopic)
            [mainTopic, subtopic] = [processedTopicStr.split(':')[0].trim(), processedTopicStr.split(':').slice(1).join(':').trim()];
          } else if (hasSectionNumber) {
            // Try to extract a section number (e.g., 3.2, 1.1) and use it as part of main topic
            const sectionMatch = processedTopicStr.match(/(\d+\.\d+(\.\d+)?)\s*(.*)/);
            if (sectionMatch) {
              const [, sectionNum, , content] = sectionMatch;
              mainTopic = content.trim() || processedTopicStr;
              subtopic = mainTopic; // Use main topic as subtopic if no clear division
            } else {
              mainTopic = processedTopicStr;
              subtopic = processedTopicStr; // Use the whole topic as both main and subtopic
            }
          } else {
            // No clear subtopic indicator - use the whole string as both
            mainTopic = processedTopicStr;
            subtopic = processedTopicStr; // Use main topic as subtopic
          }
          
          // Add optional prefix if found
          if (optionalPrefix) {
            mainTopic = optionalPrefix + mainTopic;
            // Keep the subtopic as is, since we want [Optional] to show in the main topic grouping only
          }
          
          return {
            id: `${Math.floor(index / 5) + 1}.${(index % 5) + 1}`,
            topic: optionalPrefix + processedTopicStr,
            mainTopic: mainTopic,
            subtopic: subtopic || mainTopic // Use main topic as fallback instead of "General"
          };
        });
      }
      
      console.log("Fallback topics generated successfully:", parsedTopics.length);
      setUsingFallbackTopics(true);
      setShowFallbackNotice(true);
      return parsedTopics;
      
    } catch (error) {
      console.error("Error generating fallback topics:", error);
      return null;
    }
  };

  // Track fallback notification state for debugging
  useEffect(() => {
    if (usingFallbackTopics || showFallbackNotice) {
      console.log("Fallback notice state changed:", { 
        usingFallbackTopics, 
        showFallbackNotice 
      });
    }
  }, [usingFallbackTopics, showFallbackNotice]);
  
  // Call the API to generate topics
  const generateTopics = async () => {
    setIsGenerating(true);
    setError(null);
    setUsingFallbackTopics(false);
    setShowFallbackNotice(false);
    
    try {
      console.log("Starting topic generation for:", examBoard, examType, subject);
      
      // Implement the API call to generate topics
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
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
      
      // Handle empty arrays by trying the fallback approach
      if (parsedTopics.length === 0) {
        console.log("Received empty topics array, attempting AI fallback generation");
        
        // Try the AI fallback function first
        const fallbackTopics = await generateFallbackTopics();
        
        if (fallbackTopics && fallbackTopics.length > 0) {
          console.log("Using AI-generated fallbacks:", fallbackTopics.length, "topics");
          parsedTopics = fallbackTopics;
          setUsingFallbackTopics(true);
          setShowFallbackNotice(true);
        } else {
          // If AI fallback fails, use hard-coded fallbacks or generic ones
          console.log("AI fallback failed, using hard-coded fallbacks");
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
      }
      
      // Final logging of topics before updating state
      console.log("===== FINAL TOPIC LIST BEING USED =====");
      console.log(JSON.stringify(parsedTopics, null, 2));
      console.log("Topic count:", parsedTopics.length);
      console.log("Using fallback:", usingFallbackTopics);
      console.log("===== END FINAL TOPIC LIST =====");
      
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
      
      // Try the fallback approach
      console.log("Error occurred, attempting fallback generation");
      const fallbackTopics = await generateFallbackTopics();
      
      if (fallbackTopics && fallbackTopics.length > 0) {
        console.log("Successfully generated fallback topics after error");
        setTopics(fallbackTopics);
        setHasGenerated(true);
        setUsingFallbackTopics(true);
        setShowFallbackNotice(true);
        return;
      }
      
      // Show a more detailed error message to the user
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
