import React, { useState, useEffect } from "react";
import "./TopicListModal.css";
import { generateTopicPrompt } from '../prompts/topicListPrompt';
import LoadingSpinner from "./LoadingSpinner";

// API keys - using environment variables
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY;
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY;
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY;

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
    topicCount: 0
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
      console.log("Generating topics for:", { subject, examBoard, examType });
      
      // Generate topics using the OpenAI API
      const prompt = generateTopicPrompt(subject, examBoard, examType);
      
      // Make the API call to ChatGPT
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a curriculum expert who creates topic lists for subjects.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const topicListText = data.choices[0].message.content;
      
      // Parse the topic list
      let parsedTopics = [];
      try {
        // Try to parse as JSON first
        if (topicListText.includes('[') && topicListText.includes(']')) {
          const jsonMatch = topicListText.match(/\[([\s\S]*)\]/);
          if (jsonMatch) {
            const jsonStr = `[${jsonMatch[1]}]`;
            parsedTopics = JSON.parse(jsonStr.replace(/'/g, '"'));
          }
        }
        
        // If JSON parsing failed, extract topics line by line
        if (!parsedTopics.length) {
          parsedTopics = topicListText
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(topic => topic.length > 0);
        }
      } catch (parseError) {
        console.error("Error parsing topic list:", parseError);
        // Fallback to simple line splitting
        parsedTopics = topicListText
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .filter(topic => topic.length > 0);
      }
      
      // Clean up the topics to remove any JSON formatting artifacts
      parsedTopics = parsedTopics
        .filter(topic => typeof topic === 'string' && 
                         topic.trim() !== '[' && 
                         topic.trim() !== ']' &&
                         topic.trim() !== '```json' && 
                         topic.trim() !== '```' &&
                         !topic.includes('```'))
        .map(topic => {
          // Remove quotes and commas that might be leftover from JSON
          return topic.replace(/^["'](.*)["'],?$/, '$1')
                      .replace(/["'](.*)["'],?$/, '$1')
                      .replace(/,$/, '')
                      .trim();
        });
      
      console.log("Generated topics:", parsedTopics);
      setTopics(parsedTopics);
      
      // Update metadata with new topic count
      setListMetadata(prev => ({
        ...prev,
        created: new Date().toISOString(),
        topicCount: parsedTopics.length
      }));
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
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="topic-list-modal-overlay" onClick={handleOverlayClick}>
      <div className="topic-list-modal">
        <div className="topic-list-header">
          <h2>{subject} Topics</h2>
          <button 
            className="close-modal-button" 
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        <div className="topic-list-body">
          {isLoading ? (
            <div className="loading-container">
              <LoadingSpinner />
              <p>Generating topic list for {subject}...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <p>{error}</p>
              <button onClick={generateTopics}>Try Again</button>
            </div>
          ) : selectedTopic ? (
            <div className="create-cards-confirmation">
              <p>Create flashcards for <strong>{selectedTopic}</strong>?</p>
              <div className="confirmation-buttons">
                <button onClick={cancelCreateCards}>Cancel</button>
                <button onClick={confirmCreateCards} className="confirm-button">
                  Yes, Create Cards
                </button>
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