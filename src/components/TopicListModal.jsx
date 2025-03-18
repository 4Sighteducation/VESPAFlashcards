import React, { useState, useEffect } from "react";
import "./TopicListModal.css";
import { generateTopicPrompt } from '../prompts/topicListPrompt';
import LoadingSpinner from "./LoadingSpinner";

// API keys - using environment variables
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY;
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY;
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY;

// Helper function to format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Explainer modal component
const TopicsExplainer = ({ onClose, onNeverShowAgain }) => {
  return (
    <div className="topics-explainer-overlay">
      <div className="topics-explainer-content">
        <div className="explainer-header">
          <h2>✨ Welcome to Topic Lists! ✨</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="explainer-body">
          <p className="explainer-intro">Here's your quick guide to working with topic lists:</p>
          
          <div className="explainer-section">
            <h3><span className="explainer-icon">📋</span> View & Organize</h3>
            <p>Browse through AI-generated topics for your subject. Topics are organized by category to make studying easier!</p>
          </div>
          
          <div className="explainer-section">
            <h3><span className="explainer-icon">⚡</span> Generate Flashcards</h3>
            <p>Click the lightning icon <span className="topic-action-icon">⚡</span> next to any topic to create AI-generated flashcards specifically for that topic.</p>
          </div>
          
          <div className="explainer-section">
            <h3><span className="explainer-icon">❌</span> Remove Topics</h3>
            <p>Don't need a topic? Click the delete icon <span className="topic-action-icon">❌</span> to remove it from your list.</p>
          </div>
          
          <div className="explainer-section">
            <h3><span className="explainer-icon">➕</span> Add Your Own</h3>
            <p>Click "Add Custom Topic" to create your own topics for anything that's missing.</p>
          </div>
          
          <div className="explainer-section">
            <h3><span className="explainer-icon">🔄</span> Refresh</h3>
            <p>Need fresh ideas? "Regenerate" will create brand new topic suggestions for you.</p>
          </div>
          
          <div className="explainer-section">
            <h3><span className="explainer-icon">💾</span> Save Your Work</h3>
            <p>Don't forget to click "Save Changes" when you're done to keep your customized topic list!</p>
          </div>
        </div>
        
        <div className="explainer-footer">
          <button className="never-show-again" onClick={onNeverShowAgain}>Don't show again</button>
          <button className="got-it-button" onClick={onClose}>Got it!</button>
        </div>
      </div>
    </div>
  );
};

const TopicListModal = ({ 
  subject, 
  examBoard, 
  examType, 
  onClose, 
  userId,
  onTopicListSave,
  existingTopics,
  auth
}) => {
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [regenerate, setRegenerate] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [showTopicsList, setShowTopicsList] = useState(false);
  const [showCardGeneration, setShowCardGeneration] = useState(false);
  const [newCustomTopic, setNewCustomTopic] = useState("");
  const [showAddTopicForm, setShowAddTopicForm] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [mainTopicForCustom, setMainTopicForCustom] = useState("");
  const [availableMainTopics, setAvailableMainTopics] = useState([]);
  
  // Check if we have existing topics
  const hasExistingTopics = existingTopics && 
                           Array.isArray(existingTopics) && 
                           existingTopics.length > 0;

  // Meta information about the topic list
  const [listMetadata, setListMetadata] = useState({
    created: new Date().toISOString(),
    subject: subject,
    examBoard: examBoard,
    examType: examType,
    topicCount: existingTopics?.length || 0
  });

  // Check if explainer should be shown
  useEffect(() => {
    // Check localStorage for user preference
    const explainerSetting = localStorage.getItem(`topicsExplainer_${userId || 'local'}`);
    if (explainerSetting !== 'hide') {
      // Only initialize, actual display happens on handleViewTopics
      setShowExplainer(false);
    }
  }, [userId]);

  // Handle clicking outside the modal to close it
  const handleOverlayClick = (e) => {
    // Only close if the overlay itself was clicked (not its children)
    if (e.target.className === 'topic-list-modal-overlay') {
      onClose();
    }
  };

  // Update available main topics when topics change
  useEffect(() => {
    if (topics && topics.length > 0) {
      // Extract main topics from existing topics
      const mainTopicSet = new Set();
      
      topics.forEach(topic => {
        const topicText = typeof topic === 'string' ? topic : (topic.topic || '');
        if (!topicText) return;
        
        // Check if it has a main category (contains colon)
        const colonIndex = topicText.indexOf(':');
        if (colonIndex > 0) {
          const mainTopic = topicText.substring(0, colonIndex).trim();
          mainTopicSet.add(mainTopic);
        }
      });
      
      setAvailableMainTopics(Array.from(mainTopicSet));
    }
  }, [topics]);

  useEffect(() => {
    console.log("TopicListModal mounted with:", { subject, examBoard, examType, existingTopics });
    
    if (hasExistingTopics && !regenerate) {
      // Format existing topics properly
      const formattedTopics = existingTopics.map(item => 
        typeof item === 'string' ? item : (item.topic || item)
      );
      console.log("Using existing topics:", formattedTopics);
      setTopics(formattedTopics);
      
      // Update metadata
      setListMetadata(prev => ({
        ...prev,
        topicCount: formattedTopics.length
      }));
    } else if (regenerate) {
      // Only generate new topics if regenerate flag is true
      console.log("Regenerating topics due to regenerate flag");
      generateTopics();
    } else {
      // If no existing topics and not regenerating, just set empty topics array
      console.log("No existing topics and not regenerating, showing empty list");
      setTopics([]);
      setListMetadata(prev => ({
        ...prev,
        topicCount: 0
      }));
    }
  }, [hasExistingTopics, existingTopics, regenerate, subject, examBoard, examType]);

  // Organize topics into categories
  const categorizeTopics = () => {
    const categorized = {};
    
    topics.forEach(topic => {
      // Handle both string topics and object topics
      const topicText = typeof topic === 'string' ? topic : (topic.topic || '');
      
      // Skip empty topics
      if (!topicText) return;
      
      try {
        // Try to extract main category from topic
        const parts = topicText.split(':');
        
        if (parts.length > 1) {
          // If topic has format "Category: Subtopic"
          const category = parts[0].trim();
          const subtopic = parts[1].trim();
          
          if (!categorized[category]) {
            categorized[category] = [];
          }
          
          categorized[category].push(subtopic);
        } else {
          // For topics without clear category format
          // Check if topic contains common category keywords
          const mainCategories = [
            "Introduction", "Foundations", "Basics", 
            "Advanced", "Practical", "Theory",
            "Application", "Analysis", "Physical", "Organic", "Inorganic"
          ];
          
          let foundCategory = false;
          
          for (const category of mainCategories) {
            if (topicText.includes(category)) {
              if (!categorized[category]) {
                categorized[category] = [];
              }
              
              categorized[category].push(topicText);
              foundCategory = true;
              break;
            }
          }
          
          // If no category found, put in "Other Topics"
          if (!foundCategory) {
            if (!categorized["Other Topics"]) {
              categorized["Other Topics"] = [];
            }
            
            categorized["Other Topics"].push(topicText);
          }
        }
      } catch (error) {
        // If any error occurs processing this topic, add it to "Other Topics"
        console.error("Error processing topic:", topicText, error);
        if (!categorized["Other Topics"]) {
          categorized["Other Topics"] = [];
        }
        categorized["Other Topics"].push(topicText);
      }
    });
    
    return categorized;
  };
  
  const categorizedTopics = categorizeTopics();

  const generateTopics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Generating topic list for ${subject} (${examBoard} ${examType})`);
      
      // Generate the prompt
      const prompt = generateTopicPrompt(subject, examBoard, examType);
      
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });
      
      // Check for errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }
      
      // Parse the response
      const result = await response.json();
      console.log("OpenAI response:", result);
      
      if (result.choices && result.choices.length > 0) {
        const content = result.choices[0].message.content;
        
        // Parse the JSON content
        let parsedTopics = [];
        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                           content.match(/```\s*([\s\S]*?)\s*```/) ||
                           content.match(/\[\s*".*"\s*\]/);
          
          if (jsonMatch) {
            // Try to parse the extracted JSON
            parsedTopics = JSON.parse(jsonMatch[1]);
          } else {
            // If no JSON format found, try to parse the whole response
            parsedTopics = JSON.parse(content);
          }
        } catch (jsonError) {
          console.error("Error parsing JSON from OpenAI response:", jsonError);
          
          // Fallback: Extract topics using regex
          const topicMatches = content.match(/"([^"]+)"/g) || content.match(/- ([^,\n]+)/g);
          if (topicMatches) {
            parsedTopics = topicMatches.map(match => match.replace(/["'-\s]+/g, '').trim());
          }
        }
        
        // Set topics state
        if (Array.isArray(parsedTopics)) {
          // Filter out empty topics
          const filteredTopics = parsedTopics.filter(topic => 
            topic && typeof topic === 'string' && topic.trim().length > 0
          );
          
          console.log("Parsed topics:", filteredTopics);
          setTopics(filteredTopics);
          
          // Update metadata with the filtered topics count
          setListMetadata(prev => ({
            ...prev,
            created: new Date().toISOString(),
            topicCount: filteredTopics.length
          }));
        } else {
          console.error("Unexpected topics format:", parsedTopics);
          setError("Invalid response format. Please try again.");
        }
      } else {
        setError("No response from AI. Please try again.");
      }
    } catch (error) {
      console.error("Error generating topic list:", error);
      setError("Failed to generate topic list. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Save topic list
  const handleSaveTopics = async () => {
    if (topics.length === 0) return;
    
    // Format topic list for saving
    const topicListData = {
      id: `topiclist_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      name: subject.toLowerCase(),
      examBoard,
      examType,
      subject,
      topics: topics.map(topic => ({ topic })),
      created: new Date().toISOString(),
      userId: auth?.id || userId
    };
    
    console.log("Saving topic list:", topicListData);
    onTopicListSave(topicListData, subject);
    onClose();
  };
  
  // Handle selecting a topic to create cards
  const handleSelectTopicForCards = (topic) => {
    setSelectedTopic(topic);
    setShowCardGeneration(true);
  };
  
  // Confirm card creation
  const confirmCreateCards = () => {
    console.log("Confirming card creation for topic:", selectedTopic);
    onTopicListSave({
      topic: selectedTopic,
      subject,
      examBoard,
      examType,
      createCards: true
    }, subject);
    onClose();
  };
  
  // Cancel card creation
  const cancelCreateCards = () => {
    setSelectedTopic(null);
    setShowCardGeneration(false);
  };
  
  // Handle the "View Topics" button
  const handleViewTopics = () => {
    setShowTopicsList(true);
    
    // Check if explainer should be shown
    const explainerSetting = localStorage.getItem(`topicsExplainer_${userId || 'local'}`);
    if (explainerSetting !== 'hide') {
      setShowExplainer(true);
    }
  };
  
  // Handle closing the explainer
  const handleCloseExplainer = () => {
    setShowExplainer(false);
  };
  
  // Handle "never show again"
  const handleNeverShowAgain = () => {
    localStorage.setItem(`topicsExplainer_${userId || 'local'}`, 'hide');
    setShowExplainer(false);
  };
  
  // Handle "Back to Summary" button
  const handleBackToSummary = () => {
    setShowTopicsList(false);
    setShowAddTopicForm(false);
  };
  
  // Handle "Add Topic" button
  const handleAddTopic = () => {
    setShowAddTopicForm(true);
  };
  
  // Handle submitting the new topic form
  const handleSubmitNewTopic = () => {
    if (newCustomTopic.trim()) {
      let newTopicText = newCustomTopic.trim();
      
      // If a main topic is selected, format as "MainTopic: SubTopic"
      if (mainTopicForCustom) {
        newTopicText = `${mainTopicForCustom}: ${newTopicText}`;
      }
      
      setTopics([...topics, newTopicText]);
      setNewCustomTopic("");
      setMainTopicForCustom("");
      setShowAddTopicForm(false);
      
      // Update metadata
      setListMetadata(prev => ({
        ...prev,
        topicCount: prev.topicCount + 1
      }));
    }
  };
  
  // Handle "Delete Topic" confirmation
  const handleDeleteTopicConfirmation = (topic) => {
    setTopicToDelete(topic);
    setShowDeleteConfirmation(true);
  };
  
  // Confirm delete topic
  const confirmDeleteTopic = () => {
    if (topicToDelete) {
      const newTopics = topics.filter(topic => topic !== topicToDelete);
      setTopics(newTopics);
      
      // Update metadata
      setListMetadata(prev => ({
        ...prev,
        topicCount: prev.topicCount - 1
      }));
      
      setTopicToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };
  
  // Cancel delete topic
  const cancelDeleteTopic = () => {
    setTopicToDelete(null);
    setShowDeleteConfirmation(false);
  };
  
  // Handle the "Prioritise Topics" button (placeholder)
  const handlePrioritiseTopics = () => {
    console.log("Prioritise Topics clicked - functionality to be implemented");
    // This will be implemented later
  };
  
  // Button to generate cards for a topic
  const handleGenerateCardsAction = () => {
    // Show topic selection interface for generating cards
    setShowTopicsList(true);
  };

  // Render the category-based list of topics
  const renderCategorizedTopics = () => {
    return Object.entries(categorizedTopics).map(([category, subtopics]) => (
      <div key={category} className="topic-category">
        <h4 className="category-title">{category}</h4>
        <ul className="category-topics">
          {subtopics.map((topic, index) => {
            // Handle both string topics and object topics
            const topicText = typeof topic === 'string' ? topic : (topic.topic || '');
            if (!topicText) return null;
            
            return (
              <li key={`${category}-${index}`} className="topic-item view-only">
                <span className="topic-name">{topicText}</span>
                <div className="topic-actions">
                  <button
                    className="topic-action-button generate-button"
                    onClick={() => handleSelectTopicForCards(topic)}
                    title="Generate cards for this topic"
                  >
                    <span role="img" aria-label="Generate">⚡</span>
                  </button>
                  <button
                    className="topic-action-button delete-button"
                    onClick={() => handleDeleteTopicConfirmation(topic)}
                    title="Delete this topic"
                  >
                    <span role="img" aria-label="Delete">❌</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    ));
  };

  return (
    <div className="topic-list-modal-overlay" onClick={handleOverlayClick}>
      <div className="topic-list-modal" onClick={e => e.stopPropagation()}>
        <div className="topic-list-header">
          <h2>{subject} Topics</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="topic-list-content">
          {error && <div className="error-message">{error}</div>}
          
          {isLoading ? (
            <LoadingSpinner message="Generating topic list..." />
          ) : showCardGeneration && selectedTopic ? (
            <div className="topic-confirmation">
              <h3>Create Cards for Topic</h3>
              <p>Generate flashcards for: <strong>{selectedTopic}</strong></p>
              <div className="confirmation-buttons">
                <button className="cancel-button" onClick={cancelCreateCards}>Cancel</button>
                <button className="confirm-button" onClick={confirmCreateCards}>Generate Cards</button>
              </div>
            </div>
          ) : showDeleteConfirmation && topicToDelete ? (
            <div className="topic-confirmation">
              <h3>Delete Topic</h3>
              <p>Are you sure you want to delete: <strong>{topicToDelete}</strong>?</p>
              <div className="confirmation-buttons">
                <button className="cancel-button" onClick={cancelDeleteTopic}>Cancel</button>
                <button className="confirm-button delete-confirm" onClick={confirmDeleteTopic}>Delete Topic</button>
              </div>
            </div>
          ) : showAddTopicForm ? (
            <div className="add-topic-form">
              <h3>Add New Topic</h3>
              
              {availableMainTopics.length > 0 && (
                <div className="form-group">
                  <label htmlFor="main-topic-select">Assign to a Main Topic (Optional):</label>
                  <select
                    id="main-topic-select"
                    value={mainTopicForCustom}
                    onChange={(e) => setMainTopicForCustom(e.target.value)}
                    className="main-topic-select"
                  >
                    <option value="">-- None (Create standalone topic) --</option>
                    {availableMainTopics.map((topic, index) => (
                      <option key={index} value={topic}>{topic}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <input
                  type="text"
                  value={newCustomTopic}
                  onChange={(e) => setNewCustomTopic(e.target.value)}
                  placeholder={mainTopicForCustom ? "Enter a subtopic..." : "Enter a new topic..."}
                  className="topic-input"
                />
              </div>
              <div className="form-actions">
                <button className="cancel-button" onClick={() => setShowAddTopicForm(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleSubmitNewTopic}>
                  <span className="button-icon">➕</span> Add Topic
                </button>
              </div>
            </div>
          ) : showTopicsList ? (
            <div className="topics-view">
              <div className="topics-view-header">
                <h3>All Topics ({topics.length})</h3>
                <button className="back-button" onClick={handleBackToSummary}>
                  &larr; Back to Summary
                </button>
              </div>
              
              <div className="topics-container categorized">
                {renderCategorizedTopics()}
              </div>
              
              <div className="topics-actions">
                <button className="action-button add-topic-button" onClick={handleAddTopic}>
                  <span className="button-icon">➕</span> Add Custom Topic
                </button>
                <button 
                  className="action-button regenerate-button"
                  onClick={() => {
                    setRegenerate(true);
                    generateTopics();
                  }}
                >
                  <span className="button-icon">🔄</span> Regenerate All Topics
                </button>
                <button className="action-button save-button" onClick={handleSaveTopics}>
                  <span className="button-icon">💾</span> Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="topic-list-metadata">
              <h3>Current Topic List</h3>
              <div className="metadata-container">
                <div className="metadata-row">
                  <span className="metadata-label">Subject:</span>
                  <span className="metadata-value">{subject}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Exam Board:</span>
                  <span className="metadata-value">{examBoard}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Exam Type:</span>
                  <span className="metadata-value">{examType}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Created:</span>
                  <span className="metadata-value">{formatDate(listMetadata.created)}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Topics:</span>
                  <span className="metadata-value">{listMetadata.topicCount}</span>
                </div>
              </div>
              
              <div className="topic-list-actions">
                <button 
                  className="action-button view-all-button"
                  onClick={handleViewTopics}
                >
                  <span className="button-icon">📋</span> View Topics / Generate Flashcards
                </button>
                <button 
                  className="action-button regenerate-button"
                  onClick={() => {
                    setRegenerate(true);
                    generateTopics();
                  }}
                >
                  <span className="button-icon">🔄</span> Regenerate List
                </button>
                <button 
                  className="action-button prioritise-button"
                  onClick={handlePrioritiseTopics}
                >
                  <span className="button-icon">⭐</span> Prioritise Topics
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Topics Explainer Modal */}
      {showExplainer && (
        <TopicsExplainer 
          onClose={handleCloseExplainer}
          onNeverShowAgain={handleNeverShowAgain}
        />
      )}
    </div>
  );
};

export default TopicListModal; 