import React, { useState, useEffect } from "react";
import "./TopicListModal.css";
import { generateTopicPrompt } from '../prompts/topicListPrompt';

// API keys - using the correct environment variables
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";

// Define available exam boards and types
const EXAM_BOARDS = ["AQA", "Edexcel", "OCR", "WJEC", "SQA", "International Baccalaureate", "Cambridge International"];
const EXAM_TYPES = ["GCSE", "A-Level", "IB", "AP", "Scottish Higher", "BTEC", "Other"];

// Debug logging helper
const debugLog = (title, data) => {
  console.log(`%c${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

// Safely remove HTML tags from a string to avoid issues with connected fields
const sanitizeField = (value) => {
  if (!value) return "";
  if (typeof value !== 'string') return String(value);
  
  // Remove HTML tags
  return value.replace(/<[^>]*>/g, "")
    // Remove any markdown characters
    .replace(/[*_~`#]/g, "")
    // Replace special chars with their text equivalents
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
};

const TopicListModal = ({ 
  subject, 
  examBoard: initialExamBoard, 
  examType: initialExamType, 
  onClose, 
  onSelectTopic, 
  onGenerateCards,
  auth,
  userId,
  onSaveTopicList,
  existingTopicLists = [],
  existingTopicMetadata = [],
  isLoadingData = false,
  completeUserData = null
}) => {
  const [step, setStep] = useState(1); // 1 = Info screen, 2 = Topic list, 3 = Post-save options
  const [examBoard, setExamBoard] = useState(initialExamBoard || "");
  const [examType, setExamType] = useState(initialExamType || "");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [topicCount, setTopicCount] = useState(0);
  const [topics, setTopics] = useState([]);
  const [groupedTopicsByCategory, setGroupedTopicsByCategory] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicListSaved, setTopicListSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [topicListId, setTopicListId] = useState(null);
  const [prioritizationMode, setPrioritizationMode] = useState(false);

  // Load existing topic list when component mounts
  useEffect(() => {
    if (isLoadingData) {
      setIsLoading(true);
    } else {
      checkSubjectMetadata();
    }
  }, [isLoadingData]);
  
  // When existingTopicLists or existingTopicMetadata change, update our state
  useEffect(() => {
    if (existingTopicLists.length > 0 || existingTopicMetadata.length > 0) {
      processExistingData();
    }
  }, [existingTopicLists, existingTopicMetadata]);
  
  // Process existing data from props
  const processExistingData = () => {
    // Find metadata for current subject
    const subjectMetadata = existingTopicMetadata.find(meta => meta.subject === subject);
    
    // If metadata exists, use it
    if (subjectMetadata) {
      if (subjectMetadata.examBoard && subjectMetadata.examBoard !== "general" && subjectMetadata.examBoard !== "null") {
        setExamBoard(subjectMetadata.examBoard);
      }
      
      if (subjectMetadata.examType && subjectMetadata.examType !== "general" && subjectMetadata.examType !== "null") {
        setExamType(subjectMetadata.examType);
      }
      
      if (subjectMetadata.lastUpdated) {
        setLastUpdated(subjectMetadata.lastUpdated);
      }
    }
    
    // Find topic list for this subject
    if (examBoard && examType) {
      const matchingList = existingTopicLists.find(list => 
        list.subject === subject && 
        list.examBoard === examBoard && 
        list.examType === examType
      );
      
      if (matchingList && matchingList.topics) {
        setTopics(matchingList.topics);
        setTopicCount(matchingList.topics.length);
        
        if (matchingList.lastUpdated) {
          setLastUpdated(matchingList.lastUpdated);
        }
      }
    }
    
    setIsLoading(false);
  };
  
  // Group topics by category when topics change
  useEffect(() => {
    const grouped = groupTopicsByCategory(topics);
    setGroupedTopicsByCategory(grouped);
  }, [topics]);
  
  // Helper function to group topics by category
  const groupTopicsByCategory = (topicsList) => {
    const groups = {};
    
    topicsList.forEach(topic => {
      // Extract category from topic name (before the colon)
      let category = "General";
      let name = topic.name;
      
      if (topic.name.includes(":")) {
        const parts = topic.name.split(":");
        category = parts[0].trim();
        name = parts[1].trim();
      }
      
      if (!groups[category]) {
        groups[category] = [];
      }
      
      groups[category].push({
        ...topic,
        displayName: name,
        category: category,
        fullName: topic.name
      });
    });
    
    return groups;
  };

  // Check if subject metadata exists and load exam board and type
  const checkSubjectMetadata = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we're authenticated
      if (!auth || !userId) {
        setError("You must be logged in to view topic lists");
        setIsLoading(false);
        return;
      }
      
      console.log(`Checking metadata for subject: ${subject}`);
      
      // First check if we have data from props
      if (existingTopicLists.length > 0 || existingTopicMetadata.length > 0) {
        processExistingData();
        return;
      }
      
      // Get user data from Knack
      const getUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
      
      try {
        const getResponse = await fetch(getUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          }
        });
        
        if (!getResponse.ok) {
          throw new Error("Failed to fetch user data");
        }
        
        const userData = await getResponse.json();
        
        // Check for subject metadata and existing topic lists
        let existingTopics = [];
        let foundMetadata = false;
        
        // Check for subject metadata
        if (userData && userData.field_3030) {
          try {
            const subjectMetadata = JSON.parse(userData.field_3030);
            
            // Find metadata for current subject
            const subjectData = subjectMetadata.find(meta => meta.subject === subject);
            
            if (subjectData) {
              foundMetadata = true;
              
              // If metadata exists, use it
              if (subjectData.examBoard && subjectData.examBoard !== "general" && subjectData.examBoard !== "null") {
                setExamBoard(subjectData.examBoard);
              }
              
              if (subjectData.examType && subjectData.examType !== "general" && subjectData.examType !== "null") {
                setExamType(subjectData.examType);
              }
              
              if (subjectData.lastUpdated) {
                setLastUpdated(subjectData.lastUpdated);
              }
              
              console.log(`Found existing metadata for ${subject}. Set exam board to ${subjectData.examBoard} and exam type to ${subjectData.examType}`);
            } else {
              console.log(`No metadata found for ${subject}, using defaults`);
            }
          } catch (e) {
            console.error("Error parsing subject metadata:", e);
          }
        } else {
          console.log("No subject metadata found in user data");
        }
        
        // Check for existing topic lists
        if (userData && userData.field_3011 && examBoard && examType) {
          try {
            const topicLists = JSON.parse(userData.field_3011);
            
            if (Array.isArray(topicLists)) {
              // Find topic list for this subject, exam board, and exam type
              const matchingList = topicLists.find(list => 
                list.subject === subject && 
                list.examBoard === examBoard && 
                list.examType === examType
              );
              
              if (matchingList && matchingList.topics) {
                existingTopics = matchingList.topics;
                setTopics(existingTopics);
                setTopicCount(existingTopics.length);
                
                if (matchingList.lastUpdated) {
                  setLastUpdated(matchingList.lastUpdated);
                }
                
                console.log(`Found existing topic list with ${existingTopics.length} topics`);
              }
            }
          } catch (e) {
            console.error("Error parsing topic lists:", e);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setError("Failed to load subject metadata");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error checking subject metadata:", error);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  // Load topic list for this subject
  const loadTopicList = async () => {
    if (!examBoard || !examType) {
      setError("Please select an exam board and type first");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we're authenticated
      if (!auth || !userId) {
        setError("You must be logged in to view topic lists");
        setIsLoading(false);
        return;
      }
      
      console.log(`Loading topic list for subject: ${subject} (${examBoard} ${examType})`);
      
      // First check if we have data from props
      if (existingTopicLists.length > 0) {
        // Find topic list for this subject, exam board, and exam type
        const matchingList = existingTopicLists.find(list => 
          list.subject === subject && 
          list.examBoard === examBoard && 
          list.examType === examType
        );
        
        if (matchingList && matchingList.topics) {
          setTopics(matchingList.topics);
          console.log(`Found existing topic list with ${matchingList.topics.length} topics`);
          
          // Update metadata to remember these selections for next time
          updateSubjectMetadata();
          
          setIsLoading(false);
          return;
        }
      }
      
      // Get topic lists from Knack
      const getUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
      
      try {
        const getResponse = await fetch(getUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          }
        });
        
        if (!getResponse.ok) {
          throw new Error("Failed to fetch topic lists");
        }
        
        const userData = await getResponse.json();
        
        let foundTopics = [];
        
        // Check for existing topic lists
        if (userData && userData.field_3011) {
          try {
            const topicLists = JSON.parse(userData.field_3011);
            
            if (Array.isArray(topicLists)) {
              // Find topic list for this subject, exam board, and exam type
              const matchingList = topicLists.find(list => 
                list.subject === subject && 
                list.examBoard === examBoard && 
                list.examType === examType
              );
              
              if (matchingList && matchingList.topics) {
                foundTopics = matchingList.topics;
                console.log(`Found existing topic list with ${foundTopics.length} topics`);
              }
            }
          } catch (e) {
            console.error("Error parsing topic lists:", e);
          }
        }
        
        if (foundTopics.length > 0) {
          // Use existing topics
          setTopics(foundTopics);
          setIsLoading(false);
          
          // Update metadata to remember these selections for next time
          updateSubjectMetadata();
        } else {
          // Generate new topics
          console.log("No existing topic list found, generating new topics");
          setIsLoading(false);
          generateTopics();
        }
      } catch (error) {
        console.error("Error loading topic list:", error);
        setError("Failed to load topic list");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error in loadTopicList:", error);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  // Update subject metadata
  const updateSubjectMetadata = async () => {
    try {
      // If we have a custom save handler from parent component, use that instead
      if (onSaveTopicList) {
        // Get current topic lists from props
        const currentTopicLists = [...existingTopicLists];
        const currentMetadata = [...existingTopicMetadata];
        
        // Create new metadata object
        const newMetadata = {
          subject,
          examBoard,
          examType,
          lastUpdated: new Date().toISOString()
        };
        
        // Find if metadata for this subject already exists
        const metaIndex = currentMetadata.findIndex(meta => meta.subject === subject);
        
        // Update or add the metadata
        if (metaIndex >= 0) {
          currentMetadata[metaIndex] = newMetadata;
        } else {
          currentMetadata.push(newMetadata);
        }
        
        // Send to parent component
        await onSaveTopicList(currentTopicLists, currentMetadata);
        return;
      }
      
      // Original Knack API implementation below for backwards compatibility
      // First get the actual record ID for this user in object_102
      let recordId = null;
      const searchUrl = `https://api.knack.com/v1/objects/object_102/records`;
      
      const searchResponse = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        }
      });
      
      if (searchResponse.ok) {
        const allRecords = await searchResponse.json();
        
        // Find the record matching this user ID
        if (allRecords && allRecords.records) {
          const userRecord = allRecords.records.find(record => {
            return record.field_2954 === userId || 
                   (record.field_2958 && record.field_2958 === auth.email);
          });
          
          if (userRecord) {
            recordId = userRecord.id;
            console.log("Found matching record ID for metadata update:", recordId);
          }
        }
      }
      
      if (!recordId) {
        console.error("Could not find a record for this user ID:", userId);
        return;
      }
      
      // Get user data from Knack using the correct record ID
      const getUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
      
      const getResponse = await fetch(getUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        }
      });
      
      if (!getResponse.ok) {
        console.error("Failed to fetch user data for metadata update");
        return;
      }
      
      const userData = await getResponse.json();
      
      // Get existing metadata or create new array
      let subjectMetadata = [];
      if (userData && userData.field_3030) {
        try {
          subjectMetadata = JSON.parse(userData.field_3030);
          if (!Array.isArray(subjectMetadata)) {
            subjectMetadata = [];
          }
        } catch (e) {
          console.error("Error parsing subject metadata:", e);
        }
      }
      
      // Find if metadata for this subject already exists
      const metaIndex = subjectMetadata.findIndex(meta => meta.subject === subject);
      
      // Create new metadata object
      const newMetadata = {
        subject,
        examBoard,
        examType,
        lastUpdated: new Date().toISOString()
      };
      
      // Update or add the metadata
      if (metaIndex >= 0) {
        subjectMetadata[metaIndex] = newMetadata;
      } else {
        subjectMetadata.push(newMetadata);
      }
      
      // Save updated metadata using the correct record ID
      const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
      await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        },
        body: JSON.stringify({
          field_3030: JSON.stringify(subjectMetadata)
        })
      });
      
      console.log("Subject metadata updated successfully");
    } catch (error) {
      console.error("Error updating subject metadata:", error);
    }
  };

  // Generate topics using OpenAI
  const generateTopics = async () => {
    if (!examBoard || !examType) {
      setError("Please select an exam board and type first");
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      console.log(`Generating topics for ${subject} (${examBoard} ${examType})`);
      
      // Generate a prompt for OpenAI
      const prompt = generateTopicPrompt(subject, examBoard, examType);
      
      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates topic lists for students studying various subjects."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.5
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }
      
      const data = await response.json();
      const topicsText = data.choices[0].message.content;
      
      // Parse the response - assuming format is "1. Topic 1\n2. Topic 2\n3. Topic 3"
      let parsedTopics = [];
      try {
        // Try to parse as JSON first
        if (topicsText.includes('[') && topicsText.includes(']')) {
          const jsonMatch = topicsText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsedTopics = JSON.parse(jsonMatch[0]);
          }
        }
        
        // Fallback to regex parsing if JSON parsing fails
        if (!parsedTopics.length) {
          parsedTopics = topicsText
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => /^\d+\./.test(line))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(topic => topic.length > 0);
        }
        
        // Assign unique IDs to each topic
        parsedTopics = parsedTopics.map(topic => ({
          id: generateId(),
          name: topic
        }));
        
        console.log("Generated topics:", parsedTopics);
        setTopics(parsedTopics);
      } catch (e) {
        console.error("Error parsing topics:", e);
        setError("Failed to parse topics from AI response");
      }
    } catch (error) {
      console.error("Error generating topics:", error);
      setError(`Failed to generate topics: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  // Generate a unique ID
  const generateId = (prefix = 'topic') => {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  };

  // Save topic list to Knack
  const saveTopicList = async () => {
    if (topics.length === 0) {
      setError("No topics to save");
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      // Basic validation
      if (!auth || !userId) {
        setError("You must be logged in to save topic lists");
        setIsSaving(false);
        return;
      }
      
      // Enhanced logging to track save process
      console.log(`[${new Date().toISOString()}] Saving topic list for ${subject} with ${topics.length} topics`);
      debugLog("SAVE ATTEMPT STARTED", { 
        subject,
        examBoard,
        examType,
        topicCount: topics.length,
        userId,
        auth: auth ? { email: auth.email, name: auth.name } : null
      });
      
      // If we have a custom save handler from parent component, use that
      if (onSaveTopicList) {
        try {
          // Get current topic lists from props or initialize empty array
          const currentTopicLists = Array.isArray(existingTopicLists) ? [...existingTopicLists] : [];
          
          // Create new topic list object
          const newTopicList = {
            id: generateId('list'),
            subject,
            examBoard,
            examType,
            topics,
            lastUpdated: new Date().toISOString()
          };
          
          // Find if topic list for this subject, exam board, and exam type already exists
          const existingIndex = currentTopicLists.findIndex(list => 
            list.subject === subject && 
            list.examBoard === examBoard && 
            list.examType === examType
          );
          
          // Update or add the topic list
          if (existingIndex >= 0) {
            // Preserve the original ID
            newTopicList.id = currentTopicLists[existingIndex].id;
            currentTopicLists[existingIndex] = newTopicList;
          } else {
            currentTopicLists.push(newTopicList);
          }
          
          // Get current metadata from props or initialize empty array
          const currentMetadata = Array.isArray(existingTopicMetadata) ? [...existingTopicMetadata] : [];
          
          // Create new metadata object
          const newMetadata = {
            subject,
            examBoard,
            examType,
            lastUpdated: new Date().toISOString()
          };
          
          // Find if metadata for this subject already exists
          const metaIndex = currentMetadata.findIndex(meta => meta.subject === subject);
          
          // Update or add the metadata
          if (metaIndex >= 0) {
            currentMetadata[metaIndex] = newMetadata;
          } else {
            currentMetadata.push(newMetadata);
          }
          
          // Send to parent component
          const success = await onSaveTopicList(currentTopicLists, currentMetadata);
          
          if (success) {
            console.log("Topic list saved successfully via parent handler");
            setTopicListSaved(true);
            setIsSaving(false);
            setStep(3); // Move to post-save options
          } else {
            console.error("Failed to save topic list via parent handler");
            setError("Failed to save topic list. Please try again.");
            setIsSaving(false);
          }
        } catch (error) {
          console.error("Error in custom save handler:", error);
          setError("Failed to save topic list. Please try again.");
          setIsSaving(false);
        }
        
        return;
      }
      
      // Legacy direct Knack saving logic
      // Set up a listener for the response from parent window
      const messageHandler = (event) => {
        if (event.data && event.data.type === "SAVE_RESULT") {
          // Remove the event listener once we get a response
          window.removeEventListener("message", messageHandler);
          
          if (event.data.success) {
            console.log("Topic list saved successfully via postMessage");
            setTopicListSaved(true);
            setIsSaving(false);
            setStep(3); // Move to post-save options
          } else {
            console.error("Failed to save topic list via postMessage");
            setError("Failed to save topic list. Please try again.");
            setIsSaving(false);
          }
        }
      };
      
      // Add the event listener
      window.addEventListener("message", messageHandler);
      
      // Get all existing topic lists
      const allTopicLists = existingTopicLists.length > 0 
        ? [...existingTopicLists]
        : [];
      
      // Find if topic list for this subject, exam board, and exam type already exists
      const existingIndex = allTopicLists.findIndex(list => 
        list.subject === subject && 
        list.examBoard === examBoard && 
        list.examType === examType
      );
      
      // Create new topic list object
      const newTopicList = {
        id: existingIndex >= 0 ? allTopicLists[existingIndex].id : generateId('list'),
        subject,
        examBoard,
        examType,
        topics,
        lastUpdated: new Date().toISOString()
      };
      
      // Update or add the topic list
      if (existingIndex >= 0) {
        allTopicLists[existingIndex] = newTopicList;
      } else {
        allTopicLists.push(newTopicList);
      }
      
      // Get all metadata
      const allMetadata = existingTopicMetadata.length > 0
        ? [...existingTopicMetadata]
        : [];
      
      // Find if metadata for this subject already exists
      const metaIndex = allMetadata.findIndex(meta => meta.subject === subject);
      
      // Create new metadata object
      const newMetadata = {
        subject,
        examBoard,
        examType,
        lastUpdated: new Date().toISOString()
      };
      
      // Update or add the metadata
      if (metaIndex >= 0) {
        allMetadata[metaIndex] = newMetadata;
      } else {
        allMetadata.push(newMetadata);
      }
      
      // Find the actual Knack record ID for this user
      let recordId = null;
      
      console.log(`Searching for user record ID...`);
      const searchUrl = `https://api.knack.com/v1/objects/object_102/records`;
      
      try {
        const searchResponse = await fetch(searchUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          }
        });
        
        if (searchResponse.ok) {
          const allRecords = await searchResponse.json();
          
          // Find the record matching this user ID
          if (allRecords && allRecords.records) {
