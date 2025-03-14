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
  const [step, setStep] = useState(1); // 1 = Exam selection, 2 = Topic list, 3 = Post-save options
  const [examBoard, setExamBoard] = useState(initialExamBoard || "");
  const [examType, setExamType] = useState(initialExamType || "");
  const [topics, setTopics] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicListSaved, setTopicListSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing topic list when component mounts
  useEffect(() => {
    checkSubjectMetadata();
  }, []);

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
        
        // Check for subject metadata
        if (userData && userData.field_3030) {
          try {
            const subjectMetadata = JSON.parse(userData.field_3030);
            
            // Find metadata for current subject
            const subjectData = subjectMetadata.find(meta => meta.subject === subject);
            
            if (subjectData) {
              // If metadata exists, use it
              if (subjectData.examBoard && subjectData.examBoard !== "general" && subjectData.examBoard !== "null") {
                setExamBoard(subjectData.examBoard);
              }
              
              if (subjectData.examType && subjectData.examType !== "general" && subjectData.examType !== "null") {
                setExamType(subjectData.examType);
              }
              
              // If we have both exam board and type, go straight to topic list
              if (
                subjectData.examBoard && 
                subjectData.examType && 
                subjectData.examBoard !== "general" && 
                subjectData.examType !== "general" &&
                subjectData.examBoard !== "null" && 
                subjectData.examType !== "null"
              ) {
                setStep(2);
                loadTopicList();
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

  // Save topic list to Knack
  const saveTopicList = async () => {
    if (topics.length === 0) {
      setError("No topics to save");
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      // Check if we're authenticated
      if (!auth || !userId) {
        setError("You must be logged in to save topic lists");
        setIsSaving(false);
        return;
      }
      
      debugLog("AUTH OBJECT", auth);
      debugLog("USER ID", userId);
      console.log(`Saving topic list for ${subject} with ${topics.length} topics`);
      
      // First get the actual record ID for this user in object_102
      const searchUrl = `https://api.knack.com/v1/objects/object_102/records`;
      debugLog("RECORD SEARCH URL", searchUrl);
      
      try {
        const searchResponse = await fetch(searchUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          }
        });
        
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error("Failed to search for user record:", errorText);
          setError("Failed to find your data record");
          setIsSaving(false);
          return;
        }
        
        const allRecords = await searchResponse.json();
        debugLog("ALL RECORDS", allRecords);
        
        // Find the record matching this user ID
        let recordId = null;
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
        
        if (!recordId) {
          console.error("Could not find a record for this user ID:", userId);
          setError("Failed to locate your user record");
          setIsSaving(false);
          return;
        }
        
        // Now get the current data for this record
        const getUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
        debugLog("GET URL", getUrl);
        
        const getResponse = await fetch(getUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          }
        });
        
        if (!getResponse.ok) {
          const errorText = await getResponse.text();
          console.error("Failed to get existing topic lists:", errorText);
          setError("Failed to save topic list");
          setIsSaving(false);
          return;
        }
        
        const userData = await getResponse.json();
        debugLog("FETCHED USER DATA", userData);
      
        // Parse existing topic lists
        let allTopicLists = [];
        if (userData && userData.field_3011) {
          try {
            allTopicLists = JSON.parse(userData.field_3011);
            if (!Array.isArray(allTopicLists)) {
              console.log("field_3011 is not an array, initializing empty array");
              allTopicLists = [];
            }
          } catch (e) {
            console.error("Error parsing existing topic lists:", e);
            allTopicLists = [];
          }
        } else {
          console.log("field_3011 not found in user data, initializing empty array");
        }
        
        debugLog("CURRENT TOPIC LISTS", allTopicLists);
        
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
        
        debugLog("NEW TOPIC LIST TO SAVE", newTopicList);
        
        // Update or add the topic list
        if (existingIndex >= 0) {
          allTopicLists[existingIndex] = newTopicList;
        } else {
          allTopicLists.push(newTopicList);
        }
        
        // Save metadata for this subject
        let subjectMetadata = [];
        if (userData && userData.field_3030) {
          try {
            subjectMetadata = JSON.parse(userData.field_3030);
            if (!Array.isArray(subjectMetadata)) {
              subjectMetadata = [];
            }
          } catch (e) {
            console.error("Error parsing subject metadata:", e);
            subjectMetadata = [];
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
        
        // Extract user information for additional fields
        const userName = sanitizeField(auth.name || "");
        const userEmail = sanitizeField(auth.email || "");
        
        // Prepare the data to save
        const dataToSave = {
          field_3011: JSON.stringify(allTopicLists),
          field_3030: JSON.stringify(subjectMetadata)
        };
        
        // Only add user name if it has a value (not a connection field)
        if (userName) dataToSave.field_3010 = userName;
        
        // Handle email fields
        if (userEmail) {
          // field_2958 is always the plain text email (not a connection)
          dataToSave.field_2958 = userEmail;
          
          // Only add email as a connection (field_2956) if it's a valid ID
          // from Object_3 / field_70
          if (auth.emailId && typeof auth.emailId === 'string' && 
              auth.emailId.match(/^[0-9a-f]{24}$/i)) {
            dataToSave.field_2956 = auth.emailId;
          }
        }
        
        // VESPA Customer/school (field_3008) - only add if it's a valid ID 
        // from Object_2 / Field_44
        if (auth.schoolId && typeof auth.schoolId === 'string' && 
            auth.schoolId.match(/^[0-9a-f]{24}$/i)) {
          dataToSave.field_3008 = auth.schoolId;
        }
        
        // Tutor connection (field_3009) - only add if it's a valid ID
        // from object_7 / field_96
        if (auth.tutorId && typeof auth.tutorId === 'string' && 
            auth.tutorId.match(/^[0-9a-f]{24}$/i)) {
          dataToSave.field_3009 = auth.tutorId;
        }
        
        // User Role (field_73) - only add if it's a valid ID
        if (auth.roleId && typeof auth.roleId === 'string' && 
            auth.roleId.match(/^[0-9a-f]{24}$/i)) {
          dataToSave.field_73 = auth.roleId;
        }
        
        // These fields are not connections, so we can add them as text
        const tutorGroup = sanitizeField(auth.tutorGroup || "");
        const yearGroup = sanitizeField(auth.yearGroup || "");
        if (tutorGroup) dataToSave.field_565 = tutorGroup;
        if (yearGroup) dataToSave.field_548 = yearGroup;
        
        // Double check that our JSON is valid for field_3011
        try {
          const testParse = JSON.parse(dataToSave.field_3011);
          if (!Array.isArray(testParse)) {
            console.warn("field_3011 is not an array after stringification, fixing format");
            dataToSave.field_3011 = JSON.stringify([]);
          }
        } catch (e) {
          console.error("Invalid JSON for field_3011, using empty array instead:", e);
          dataToSave.field_3011 = JSON.stringify([]);
        }
        
        // Double check that our JSON is valid for field_3030
        try {
          const testParse = JSON.parse(dataToSave.field_3030);
          if (!Array.isArray(testParse)) {
            console.warn("field_3030 is not an array after stringification, fixing format");
            dataToSave.field_3030 = JSON.stringify([]);
          }
        } catch (e) {
          console.error("Invalid JSON for field_3030, using empty array instead:", e);
          dataToSave.field_3030 = JSON.stringify([]);
        }
        
        debugLog("DATA BEING SENT TO KNACK", dataToSave);
        console.log("String length of field_3011:", JSON.stringify(allTopicLists).length);
        
        // Check if the data is too large
        if (JSON.stringify(dataToSave).length > 1000000) {
          console.error("Data payload is too large, may exceed Knack's size limits");
          setError("Data is too large to save. Try with fewer topics.");
          setIsSaving(false);
          return;
        }
        
        // Save to Knack - using the actual record ID, not userId
        const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${recordId}`;
        debugLog("UPDATE URL", updateUrl);
        
        const updateResponse = await fetch(updateUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          },
          body: JSON.stringify(dataToSave)
        });
        
        const responseStatus = updateResponse.status;
        const responseStatusText = updateResponse.statusText;
        debugLog("KNACK API RESPONSE STATUS", { status: responseStatus, statusText: responseStatusText });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          debugLog("KNACK API ERROR", errorText);
          console.error("Failed to save topic list:", errorText);
          setError("Failed to save topic list");
          setIsSaving(false);
          return;
        }
        
        try {
          const responseData = await updateResponse.json();
          debugLog("KNACK API SUCCESS RESPONSE", responseData);
          
          // Check if the response indicates no records were updated
          if (responseData.total_records === 0 || (responseData.records && responseData.records.length === 0)) {
            console.log("No records were updated. Trying alternative update method...");
            
            // Try a POST request as an alternative
            const createUrl = `https://api.knack.com/v1/objects/object_102/records`;
            debugLog("TRYING POST URL", createUrl);
            
            // For POST, include the record ID in the data
            const postData = {
              ...dataToSave,
              id: recordId
            };
            
            const createResponse = await fetch(createUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Knack-Application-ID": KNACK_APP_ID,
                "X-Knack-REST-API-Key": KNACK_API_KEY
              },
              body: JSON.stringify(postData)
            });
            
            if (!createResponse.ok) {
              const createErrorText = await createResponse.text();
              console.error("Alternative update also failed:", createErrorText);
            } else {
              const createResponseData = await createResponse.json();
              debugLog("POST RESPONSE", createResponseData);
              console.log("Alternative update method succeeded");
            }
          }
        } catch (e) {
          console.log("Could not parse response JSON, but request was successful");
        }
        
        console.log("Topic list saved successfully to Knack");
        setTopicListSaved(true);
        setIsSaving(false);
        setStep(3); // Move to post-save options
      } catch (apiError) {
        debugLog("API ERROR", { message: apiError.message, stack: apiError.stack });
        console.error("Error with Knack API:", apiError);
        setError(`API error: ${apiError.message}`);
        setIsSaving(false);
      }
    } catch (error) {
      debugLog("SAVE TOPIC LIST ERROR", { message: error.message, stack: error.stack });
      console.error("Error saving topic list:", error);
      setError(`Failed to save topic list: ${error.message}`);
      setIsSaving(false);
    }
  };

  // Generate a unique ID
  const generateId = (prefix = 'topic') => {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
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

  // Handle generating cards from selected topic
  const handleGenerateCards = () => {
    if (selectedTopic) {
      onGenerateCards(selectedTopic);
    } else {
      setError("Please select a topic first");
    }
  };

  // Render exam selection step
  const renderExamSelection = () => {
    return (
      <>
        <div className="exam-selection-form">
          <div className="form-group">
            <label>Exam Type</label>
            <select 
              value={examType} 
              onChange={(e) => setExamType(e.target.value)}
              className="exam-select"
            >
              <option value="">-- Select Exam Type --</option>
              {EXAM_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Exam Board</label>
            <select 
              value={examBoard} 
              onChange={(e) => setExamBoard(e.target.value)}
              className="exam-select"
            >
              <option value="">-- Select Exam Board --</option>
              {EXAM_BOARDS.map(board => (
                <option key={board} value={board}>{board}</option>
              ))}
            </select>
          </div>
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
            className="modal-button continue-button" 
            onClick={handleContinueToTopics}
            disabled={!examBoard || !examType}
          >
            Continue
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
                <ul className="topics-list">
                  {topics.map((topic) => (
                    <li 
                      key={topic.id} 
                      className={`topic-item ${selectedTopic?.id === topic.id ? 'selected' : ''}`}
                      onClick={() => handleTopicClick(topic)}
                    >
                      {topic.name}
                    </li>
                  ))}
                </ul>
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
            className="modal-button return-button" 
            onClick={onClose}
          >
            Return to Card Bank
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container topic-list-modal">
        <button className="modal-close-button" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <h2>
            {step === 1 ? 'Select Exam Details' : 
             step === 2 ? 'Topic List for ' + subject : 
             'Topic List Saved'}
          </h2>
        </div>
        
        <div className="modal-content">
          {step === 1 && renderExamSelection()}
          {step === 2 && renderTopicList()}
          {step === 3 && renderPostSaveOptions()}
        </div>
      </div>
    </div>
  );
};

export default TopicListModal; 