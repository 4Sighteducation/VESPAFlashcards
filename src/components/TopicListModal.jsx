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
  userId
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
    checkSubjectMetadata();
  }, []);
  
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

  // Save topic list to Knack using window messaging system
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
      
      console.log(`Saving topic list for ${subject} with ${topics.length} topics`);
      
      // Get the record ID from our current user record - first try looking for it
      let recordId = null;
      
      // Check if it's already in auth object
      if (auth.recordId) {
        recordId = auth.recordId;
      } else {
        // We need to find it by searching records
        console.log("Searching for user record ID...");
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
              const userRecord = allRecords.records.find(record => {
                return record.field_2954 === userId || 
                      (record.field_2958 && record.field_2958 === auth.email);
              });
              
              if (userRecord) {
                recordId = userRecord.id;
                console.log("Found matching record ID:", recordId);
              }
            }
          }
        } catch (e) {
          console.error("Error finding record ID:", e);
        }
      }
      
      if (!recordId) {
        console.error("Could not find a record ID for this user");
        setError("Failed to locate your user record. Please refresh and try again.");
        setIsSaving(false);
        return;
      }

      // Get ALL existing user data (including card bank, study boxes, etc.)
      let completeUserData = null;
      let allTopicLists = [];
      let subjectMetadata = [];
      
      // Get the current data for this record
      const getUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
      
      try {
        console.log("Fetching complete user data to preserve all fields");
        const getResponse = await fetch(getUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          }
        });
        
        if (getResponse.ok) {
          completeUserData = await getResponse.json();
          console.log("Successfully retrieved complete user data");
          
          // Extract topic lists if available
          if (completeUserData && completeUserData.field_3011) {
            try {
              const parsed = JSON.parse(completeUserData.field_3011);
              if (Array.isArray(parsed)) {
                allTopicLists = parsed;
              }
            } catch (e) {
              console.error("Error parsing existing topic lists:", e);
            }
          }
          
          // Extract metadata if available
          if (completeUserData && completeUserData.field_3030) {
            try {
              const parsed = JSON.parse(completeUserData.field_3030);
              if (Array.isArray(parsed)) {
                subjectMetadata = parsed;
              }
            } catch (e) {
              console.error("Error parsing subject metadata:", e);
            }
          }
        } else {
          console.error("Failed to retrieve user data:", await getResponse.text());
          setError("Failed to retrieve your current data. Please try again.");
          setIsSaving(false);
          return;
        }
      } catch (e) {
        console.error("Error retrieving complete user data:", e);
        setError("Error retrieving your data. Please try again.");
        setIsSaving(false);
        return;
      }
      
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
      let updatedTopicLists = [...allTopicLists];
      if (existingIndex >= 0) {
        updatedTopicLists[existingIndex] = newTopicList;
      } else {
        updatedTopicLists.push(newTopicList);
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
      let updatedMetadata = [...subjectMetadata];
      if (metaIndex >= 0) {
        updatedMetadata[metaIndex] = newMetadata;
      } else {
        updatedMetadata.push(newMetadata);
      }
      
      // Use window.parent.postMessage to send data to the parent window
      console.log("Sending topic list data to parent window via postMessage");
      
      // Set up a listener for the response
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
      
      // Send the message to the parent window, including preserveOtherFields flag
      // and complete data for reference
      window.parent.postMessage({
        type: "SAVE_DATA",
        data: {
          recordId: recordId,
          topicLists: updatedTopicLists,
          topicMetadata: updatedMetadata,
          preserveFields: true,
          completeData: completeUserData
        }
      }, "*");
      
      console.log("Sent data with preserveFields flag to maintain other data");
      
      // Set a timeout to handle no response
      setTimeout(() => {
        if (isSaving) {
          window.removeEventListener("message", messageHandler);
          console.error("No save response received within timeout");
          setError("Save operation timed out. Please try again.");
          setIsSaving(false);
        }
      }, 10000); // 10-second timeout
      
    } catch (error) {
      console.error("Error saving topic list:", error);
      setError(`Failed to save topic list: ${error.message}`);
      setIsSaving(false);
    }
  };

  // Generate a unique ID
  const generateId = (prefix = 'topic') => {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  };
  
  // Handle adding a new topic
  const handleAddTopic = () => {
    if (!newTopicName.trim()) {
      setError("Please enter a topic name");
      return;
    }
    
    // Create new topic object
    const newTopic = {
      id: generateId('topic'),
      name: newTopicName.trim()
    };
    
    // Add to topics list
    setTopics(prevTopics => [...prevTopics, newTopic]);
    
    // Reset form and close modal
    setNewTopicName("");
    setShowAddTopicModal(false);
    setTopicListSaved(false); // Indicate changes need to be saved
  };
  
  // Handle deleting a topic
  const handleDeleteTopic = (topicId, event) => {
    event.stopPropagation(); // Prevent topic selection
    
    // Remove topic from list
    setTopics(prevTopics => prevTopics.filter(topic => topic.id !== topicId));
    
    // If the deleted topic was selected, clear selection
    if (selectedTopic && selectedTopic.id === topicId) {
      setSelectedTopic(null);
    }
    
    setTopicListSaved(false); // Indicate changes need to be saved
  };
  
  // Handle clicking a topic
  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
  };
  
  // Handle continue button in post-save options
  const handleContinue = () => {
    if (selectedTopic) {
      onSelectTopic(selectedTopic);
    }
    onClose();
  };
  
  // Handle continue button in exam selection
  const handleContinueToTopics = () => {
    if (!examBoard || !examType) {
      setError("Please select both an exam board and exam type");
      return;
    }
    
    setStep(2);
    loadTopicList();
  };
  
  // Handle the View Topics button click
  const handleViewTopics = () => {
    if (!examBoard || !examType) {
      setError("Subject metadata is incomplete. Please contact support.");
      return;
    }
    
    setStep(2);
    loadTopicList();
  };
  
  // Handle the Regenerate Topics button click
  const handleRegenerateTopics = () => {
    if (!examBoard || !examType) {
      setError("Subject metadata is incomplete. Please contact support.");
      return;
    }
    
    generateTopics();
    setStep(2);
  };
  
  // Handle the Prioritize Topics button click
  const handlePrioritizeTopics = () => {
    if (!examBoard || !examType) {
      setError("Subject metadata is incomplete. Please contact support.");
      return;
    }
    
    if (topics.length === 0) {
      loadTopicList();
    }
    
    setPrioritizationMode(true);
    setStep(2);
  };

  // Handle generating cards from selected topic
  const handleGenerateCards = () => {
    if (selectedTopic) {
      // Pass metadata along with the selected topic to skip initial steps
      onGenerateCards({
        topic: selectedTopic.name,
        examBoard,
        examType,
        subject
      });
    } else {
      setError("Please select a topic first");
    }
  };

  // Render info screen (new initial view)
  const renderInfoScreen = () => {
    // Format date for display
    const formatDate = (dateString) => {
      if (!dateString) return "Never";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        });
      } catch (e) {
        return "Invalid date";
      }
    };

    return (
      <>
        <div className="topic-info-card">
          <h3>Subject Information</h3>
          <div className="info-grid">
            <div className="info-label">Subject:</div>
            <div className="info-value">{subject}</div>
            
            <div className="info-label">Exam Board:</div>
            <div className="info-value">{examBoard || "Not specified"}</div>
            
            <div className="info-label">Exam Type:</div>
            <div className="info-value">{examType || "Not specified"}</div>
            
            <div className="info-label">Last Updated:</div>
            <div className="info-value">{formatDate(lastUpdated)}</div>
            
            <div className="info-label">Topics:</div>
            <div className="info-value">{topicCount || "None"}</div>
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="topic-action-buttons">
          <button 
            className="topic-button view-topics-button"
            onClick={handleViewTopics}
            disabled={isLoading}
          >
            {topicCount > 0 ? "View Topics / Generate Cards" : "Generate Topics"}
          </button>
          
          <button
            className="topic-button regenerate-button"
            onClick={handleRegenerateTopics}
            disabled={isLoading}
          >
            Regenerate Topics
          </button>
          
          <button
            className="topic-button prioritize-button"
            onClick={handlePrioritizeTopics}
            disabled={isLoading || topicCount === 0}
          >
            Prioritize Topics
          </button>
        </div>
        
        <div className="modal-actions">
          <button 
            className="modal-button cancel-button" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </>
    );
  };

  // Render topic list step
  const renderTopicList = () => {
    return (
      <>
        {isLoading ? (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading topics for {subject}...</p>
          </div>
        ) : isGenerating ? (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Generating topics for {subject} ({examBoard} {examType})...</p>
          </div>
        ) : (
          <>
            <div className="topic-list-header">
              <h3>Topics for {subject} ({examBoard} {examType})</h3>
              <div className="topic-header-actions">
                <button
                  className="add-topic-button"
                  onClick={() => setShowAddTopicModal(true)}
                  title="Add a new topic"
                >
                  ➕ Add Topic
                </button>
                
                <button
                  className="prioritize-button"
                  onClick={() => setPrioritizationMode(!prioritizationMode)}
                  title="Prioritize topics"
                >
                  {prioritizationMode ? "✓ Done" : "🔝 Prioritize"}
                </button>
                
                {!topicListSaved && (
                  <button 
                    className="save-topic-button" 
                    onClick={saveTopicList}
                    disabled={topics.length === 0 || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Topic List'}
                  </button>
                )}
                
                <button 
                  className="regenerate-button" 
                  onClick={generateTopics}
                  disabled={isGenerating}
                >
                  🔄 Regenerate
                </button>
              </div>
            </div>
            
            <div className="topics-container">
              {topics.length > 0 ? (
                <div className="topics-by-category">
                  {Object.keys(groupedTopicsByCategory).map(category => (
                    <div key={category} className="topic-category">
                      <h4 className="category-heading">{category}</h4>
                      <ul className="topics-list">
                        {groupedTopicsByCategory[category].map((topic) => (
                          <li 
                            key={topic.id} 
                            className={`topic-item ${selectedTopic?.id === topic.id ? 'selected' : ''}`}
                            onClick={() => handleTopicClick(topic)}
                          >
                            <span className="topic-name">
                              {/* Only show the part after the colon (if it exists) */}
                              {topic.displayName}
                            </span>
                            
                            <div className="topic-actions">
                              <button
                                className="delete-topic-button"
                                onClick={(e) => handleDeleteTopic(topic.id, e)}
                                title="Delete this topic"
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-topics-message">No topics available. Click "Regenerate" to create topics.</p>
              )}
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <div className="modal-actions">
              <button 
                className="modal-button cancel-button" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                className="modal-button select-button" 
                onClick={handleContinue}
                disabled={!selectedTopic}
              >
                Select Topic
              </button>
            </div>
          </>
        )}
      </>
    );
  };

  // Render post-save options
  const renderPostSaveOptions = () => {
    return (
      <>
        <div className="post-save-message">
          <h3>Topic List Saved Successfully!</h3>
          <p>What would you like to do next?</p>
        </div>
        
        <div className="post-save-options">
          <button 
            className="modal-button generate-cards-button" 
            onClick={handleGenerateCards}
            disabled={!selectedTopic}
          >
            Generate Flashcards for {selectedTopic ? selectedTopic.name : 'Selected Topic'}
          </button>
          
          <button 
            className="modal-button continue-editing-button" 
            onClick={() => setStep(2)}
          >
            Continue Editing Topics
          </button>
          
          <button 
            className="modal-button return-button" 
            onClick={onClose}
          >
            Return to Card Bank
          </button>
        </div>
      </>
    );
  };

  // Render Add Topic modal
  const renderAddTopicModal = () => {
    if (!showAddTopicModal) return null;
    
    return (
      <div className="add-topic-modal-overlay">
        <div className="add-topic-modal">
          <h3>Add New Topic</h3>
          <div className="add-topic-form">
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Enter topic name"
              className="topic-input"
            />
            
            <div className="add-topic-actions">
              <button 
                className="cancel-button" 
                onClick={() => {
                  setNewTopicName(""); 
                  setShowAddTopicModal(false);
                }}
              >
                Cancel
              </button>
              <button 
                className="add-button" 
                onClick={handleAddTopic}
                disabled={!newTopicName.trim()}
              >
                Add Topic
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container topic-list-modal">
        <button className="modal-close-button" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <h2>
            {step === 1 && `Set up Topic List for ${subject}`}
            {step === 2 && `Topic List for ${subject}`}
            {step === 3 && `Topic List for ${subject} Saved!`}
          </h2>
        </div>
        
        <div className="modal-content">
          {step === 1 && renderInfoScreen()}
          {step === 2 && renderTopicList()}
          {step === 3 && renderPostSaveOptions()}
        </div>
        
        {renderAddTopicModal()}
      </div>
    </div>
  );
};

export default TopicListModal;
