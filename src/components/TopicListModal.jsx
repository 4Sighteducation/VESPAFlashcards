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
  
  // Check if we have existing topics
  const hasExistingTopics = existingTopics && 
                           Array.isArray(existingTopics) && 
                           existingTopics.length > 0;

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
    } else {
      // Generate new topics
      console.log("Generating new topics");
      generateTopics();
    }

    // Add ESC key handler for closing the modal
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [subject, examBoard, examType, regenerate, hasExistingTopics, existingTopics, onClose]);

  // Generate topics using OpenAI
  const generateTopics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Generating topics for:", { subject, examBoard, examType });
      
      // Generate the prompt
      const prompt = generateTopicPrompt(subject, examBoard, examType);
      
      // Make API call to OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are an expert curriculum designer for educational content." },
            { role: "user", content: prompt }
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
      
      console.log("Generated topics:", parsedTopics);
      setTopics(parsedTopics);
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
          ) : (
            <>
              <div className="topic-list-message">
                {hasExistingTopics && !regenerate ? (
                  <div className="success-message">
                    <p>✨ Your topic list is ready! Now for the fun part...</p>
                    <p>Click on any topic to create flashcards and start your learning journey!</p>
                  </div>
                ) : (
                  <p>Here are some suggested topics for {subject} ({examType}, {examBoard}):</p>
                )}
              </div>
              
              <div className="topic-list-grid">
                {topics.map((topic, index) => (
                  <button 
                    key={index} 
                    className="topic-button"
                    onClick={() => handleCreateCards(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
              
              <div className="topic-list-actions">
                {!hasExistingTopics && (
                  <button 
                    className="save-button"
                    onClick={handleSaveTopics}
                    disabled={topics.length === 0}
                  >
                    Save Topic List
                  </button>
                )}
                
                {hasExistingTopics && !regenerate && (
                  <button 
                    className="regenerate-button"
                    onClick={() => setRegenerate(true)}
                  >
                    Regenerate Topics
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopicListModal; 