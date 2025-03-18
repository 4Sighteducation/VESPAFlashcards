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
  const [showTopicButtons, setShowTopicButtons] = useState(false);
  
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

  // Handle clicking outside the modal to close it
  const handleOverlayClick = (e) => {
    // Only close if the overlay itself was clicked (not its children)
    if (e.target.className === 'topic-list-modal-overlay') {
      onClose();
    }
  };

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
    } else {
      // Generate new topics
      console.log("Generating new topics");
      generateTopics();
    }
  }, [hasExistingTopics, existingTopics, regenerate]);

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
  const handleCreateCards = (topic) => {
    console.log("Selected topic for card creation:", topic);
    setSelectedTopic(topic);
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
  };
  
  // Handle showing the topic selection view
  const handleShowTopicButtons = () => {
    setShowTopicButtons(true);
  };
  
  // Handle the "Prioritise Topics" button (placeholder)
  const handlePrioritiseTopics = () => {
    console.log("Prioritise Topics clicked - functionality to be implemented");
    // This will be implemented later
  };
  
  // Button to view all topics
  const handleViewAllTopics = () => {
    setShowTopicButtons(true);
  };

  // Button to generate cards for a topic
  const handleGenerateCards = () => {
    if (selectedTopic) {
      confirmCreateCards();
    } else {
      alert("Please select a topic first");
    }
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
          ) : selectedTopic ? (
            <div className="topic-confirmation">
              <h3>Create Cards for Topic</h3>
              <p>Generate flashcards for: <strong>{selectedTopic}</strong></p>
              <div className="confirmation-buttons">
                <button className="cancel-button" onClick={cancelCreateCards}>Cancel</button>
                <button className="confirm-button" onClick={confirmCreateCards}>Generate Cards</button>
              </div>
            </div>
          ) : showTopicButtons ? (
            <>
              <div className="topics-container">
                <ul className="topics-list">
                  {topics.map((topic, index) => (
                    <li 
                      key={index} 
                      className="topic-item"
                      onClick={() => handleCreateCards(topic)}
                    >
                      <span className="topic-name">{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="modal-button save-button"
                  onClick={handleSaveTopics}
                >
                  Save Topic List
                </button>
                <button 
                  className="modal-button regenerate-button"
                  onClick={() => {
                    setRegenerate(true);
                    generateTopics();
                  }}
                >
                  Regenerate Topics
                </button>
              </div>
            </>
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
              
              <div className="topic-list-preview">
                <h4>Topics</h4>
                <div className="topics-preview">
                  {topics.slice(0, 5).map((topic, index) => (
                    <div key={index} className="topic-preview-item">{topic}</div>
                  ))}
                  {topics.length > 5 && (
                    <div className="topic-preview-more">
                      + {topics.length - 5} more topics...
                    </div>
                  )}
                </div>
              </div>
              
              <div className="topic-list-actions">
                <button 
                  className="action-button view-all-button"
                  onClick={handleViewAllTopics}
                >
                  View All Topics
                </button>
                <button 
                  className="action-button generate-cards-button"
                  onClick={handleShowTopicButtons}
                >
                  Generate Cards
                </button>
                <button 
                  className="action-button regenerate-button"
                  onClick={() => {
                    setRegenerate(true);
                    generateTopics();
                  }}
                >
                  Regenerate List
                </button>
                <button 
                  className="action-button prioritise-button"
                  onClick={handlePrioritiseTopics}
                >
                  Prioritise Topics
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopicListModal; 