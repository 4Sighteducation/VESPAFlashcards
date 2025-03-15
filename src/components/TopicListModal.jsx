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
        if (userData && userData.field_3012) {
          try {
            const subjectMetadata = JSON.parse(userData.field_3012);
            
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
            }
          } catch (e) {
            console.error("Error parsing subject metadata:", e);
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
            const allTopicLists = JSON.parse(userData.field_3011);
            
            // Find topic list for this subject, exam board, and type
            const matchingList = allTopicLists.find(list => 
              list.subject === subject && 
              list.examBoard === examBoard && 
              list.examType === examType
            );
            
            if (matchingList && matchingList.topics && matchingList.topics.length > 0) {
              console.log("Found existing topic list:", matchingList);
              foundTopics = matchingList.topics;
              setTopicListSaved(true);
            } else {
              console.log("No existing topic list found, generating new one");
              await generateTopics();
              return;
            }
          } catch (e) {
            console.error("Error parsing topic lists:", e);
            await generateTopics();
            return;
          }
        } else {
          console.log("No topic lists found, generating new one");
          await generateTopics();
          return;
        }
        
        setTopics(foundTopics);
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading topic list:", error);
        setError("Failed to load topic list");
        setIsLoading(false);
        
        // Generate new topics if loading fails
        try {
          await generateTopics();
        } catch (genError) {
          console.error("Failed to generate topics:", genError);
        }
      }
    } catch (error) {
      console.error("Error in loadTopicList:", error);
      setError("An unexpected error occurred");
      setIsLoading(false);
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
      
      console.log(`Saving topic list for ${subject} with ${topics.length} topics`);
      
      // Get existing topic lists first
      const getUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
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
      console.log("Fetched user data:", userData);
      
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
      
      console.log("Current topic lists:", allTopicLists);
      
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
      
      console.log("New topic list to save:", newTopicList);
      
      // Update or add the topic list
      if (existingIndex >= 0) {
        allTopicLists[existingIndex] = newTopicList;
      } else {
        allTopicLists.push(newTopicList);
      }
      
      // Save metadata for this subject
      let subjectMetadata = [];
      if (userData && userData.field_3012) {
        try {
          subjectMetadata = JSON.parse(userData.field_3012);
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
      
      // Prepare the data to save
      const dataToSave = {
        field_3011: JSON.stringify(allTopicLists),
        field_3012: JSON.stringify(subjectMetadata)
      };
      
      console.log("Data being sent to Knack:", dataToSave);
      console.log("String length of field_3011:", JSON.stringify(allTopicLists).length);
      
      // Check if the data is too large
      if (JSON.stringify(dataToSave).length > 1000000) {
        console.error("Data payload is too large, may exceed Knack's size limits");
        setError("Data is too large to save. Try with fewer topics.");
        setIsSaving(false);
        return;
      }
      
      // Save to Knack
      const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        },
        body: JSON.stringify(dataToSave)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("Failed to save topic list:", errorText);
        setError("Failed to save topic list");
        setIsSaving(false);
        return;
      }
      
      console.log("Topic list saved successfully to Knack");
      setTopicListSaved(true);
      setIsSaving(false);
      setStep(3); // Move to post-save options
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