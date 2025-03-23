import React, { useState, useEffect } from 'react';
import { FaMagic, FaExclamationTriangle, FaEdit, FaTrash, FaPlus, FaSave, FaBolt, FaRedo, FaFolder, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './styles.css';

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
  
  // State for edit functionality
  const [editMode, setEditMode] = useState(null);
  const [editValue, setEditValue] = useState({ mainTopic: '', subtopic: '' });
  
  // State for save/proceed functionality
  const [listName, setListName] = useState(`${subject} - ${examBoard} ${examType}`);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSelectDialog, setShowSelectDialog] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  
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
  
  // API key - matching the format used in AICardGenerator for consistency
  const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";

  // Call the API to generate topics
  const generateTopics = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log("Starting topic generation for:", examBoard, examType, subject);
      
      // Implement the API call to generate topics
      // This should use your OpenAI integration and the updated prompt
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
            content: generatePrompt(examBoard, examType, subject, academicYear)
          }],
          max_tokens: 2000,
          temperature: 0.5
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
      content = content.replace(/```json|```/g, '').trim();
      
      let parsedTopics;
      try {
        parsedTopics = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse topic response as JSON:", e);
        console.log("Raw response preview:", content.substring(0, 100));

        // Check if it's an error message and provide better feedback
        if (content.includes("I'm sorry") || content.includes("Error")) {
          // Extract a more useful error message
          const displayError = content.split('.')[0] || "Error from API";
          throw new Error(`Invalid JSON: ${displayError}`);
        }

        // If not a recognizable error, try to recover by creating a sample topic structure
        // This will allow the user to at least have some functionality
        parsedTopics = [
          {
            id: "1.1",
            topic: "Sample Topic: Introduction",
            mainTopic: "Sample Topic",
            subtopic: "Introduction"
          }
        ];
        console.log("Created fallback topics due to parsing failure");
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
  
  // Generate the prompt using the improved structure
  const generatePrompt = (examBoard, examType, subject, academicYear) => {
    const promptTemplate = `You are an exam syllabus expert. Return ONLY a valid JSON array with no additional text, explanations, or prefixes.

Find the current ${examBoard} ${examType} ${subject} specification for the ${academicYear} academic year from the official source:
- AQA: https://www.aqa.org.uk/
- Edexcel/Pearson: https://qualifications.pearson.com/
- OCR: https://www.ocr.org.uk/
- WJEC/Eduqas: https://www.wjec.co.uk/ or https://www.eduqas.co.uk/
- SQA: https://www.sqa.org.uk/

Extract ALL topics and subtopics in this exact format:
[
  {
    "id": "1.1",
    "topic": "Topic Area 1: Subtopic 1",
    "mainTopic": "Topic Area 1",
    "subtopic": "Subtopic 1"
  },
  {
    "id": "1.2",
    "topic": "Topic Area 1: Subtopic 2",
    "mainTopic": "Topic Area 1",
    "subtopic": "Subtopic 2"
  },
  {
    "id": "2.1",
    "topic": "Topic Area 2: Subtopic 1",
    "mainTopic": "Topic Area 2",
    "subtopic": "Subtopic 1"
  }
]

FORMAT RULES:
1. Each string must follow the pattern "Main Topic: Subtopic"
2. Include EVERY subtopic from the official specification
3. Repeat the main topic name for each of its subtopics
4. Use the exact topic and subtopic names from the official specification
5. No duplicates allowed
6. No extra explanations outside the JSON array
7. Return properly formatted, valid JSON only

SOURCE: Use only the latest official ${examBoard} specification document.`;
    
    return promptTemplate;
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
  
  // Handle regenerating all topics
  const handleRegenerateTopics = () => {
    if (window.confirm("This will replace all topics. Are you sure?")) {
      generateTopics();
    }
  };
  
  // Handle saving topic list
  const handleSaveTopicList = () => {
    if (!listName.trim()) {
      setError("Please enter a name for the topic list");
      return;
    }
    
    if (!topics || topics.length === 0) {
      setError("Cannot save an empty topic list");
      return;
    }
    
    onSaveTopicList && onSaveTopicList({
      name: listName,
      topics: topics
    });
    
    setShowSaveDialog(false);
  };
  
  // Handle selecting a topic to continue with card generation
  const handleSelectTopic = () => {
    if (!selectedTopic) {
      setError("Please select a topic first");
      return;
    }
    
    onSelectTopic && onSelectTopic(selectedTopic);
    setShowSelectDialog(false);
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
              <div 
                className="main-topic-header"
                onClick={() => toggleMainTopic(mainTopic.name)}
              >
                <span className="main-topic-name">
                  <FaFolder /> {mainTopic.name}
                </span>
                <span className="main-topic-count">
                  {mainTopic.subtopics.length} subtopics
                </span>
                <span className="main-topic-toggle">
                  {expandedTopics[mainTopic.name] ? <FaChevronUp /> : <FaChevronDown />}
                </span>
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
                            <span className="subtopic-name">{topic.subtopic}</span>
                          </div>
                          <div className="subtopic-actions">
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
              <input
                type="text"
                value={newTopicInput.mainTopic}
                onChange={(e) => setNewTopicInput({...newTopicInput, mainTopic: e.target.value})}
                placeholder="Main Topic"
                className="add-main-topic"
              />
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
              disabled={!newTopicInput.mainTopic.trim() || !newTopicInput.subtopic.trim()}
            >
              <FaPlus /> Add Topic
            </button>
          </div>
        </div>
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
  
  return (
    <div className="topic-hub">
      {/* Display any errors */}
      {error && (
        <div className="error-message">
          <FaExclamationTriangle />
          <span>{error}</span>
        </div>
      )}
      
      {/* Show generator only if no topics exist yet */}
      {(!topics || topics.length === 0) && !hasGenerated && renderGenerator()}
      
      {/* Show topics list if topics exist or generation has been attempted */}
      {(topics && topics.length > 0 || hasGenerated) && renderTopics()}
      
      {/* Topic generation section if no topics yet but generation attempted */}
      {topics && topics.length === 0 && hasGenerated && !isGenerating && (
        <div className="empty-topics-message">
          <p>No topics were generated. Please try again or add topics manually.</p>
          <button 
            className="generation-button" 
            onClick={generateTopics}
            disabled={isGenerating}
          >
            <FaMagic /> Try Again
          </button>
        </div>
      )}
      
      {/* Show loaders if generating */}
      {isGenerating && renderGenerator()}
      
      {/* Dialogs */}
      {renderSaveDialog()}
      {renderSelectDialog()}
    </div>
  );
};

export default TopicHub;
