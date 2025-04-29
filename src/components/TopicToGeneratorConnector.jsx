import React, { useState } from 'react';
import AICardGenerator from './AICardGenerator';
import ErrorBoundary from './ErrorBoundary';
import './TopicToGeneratorConnector.css';

/**
 * TopicToGeneratorConnector
 * 
 * This component acts as a bridge between the Topic Hub and the AI Card Generator.
 * It simplifies the card generation process by pre-populating metadata from the topic.
 */
const TopicToGeneratorConnector = ({ 
  topic = {}, // The selected topic object
  subject = "", // The subject name
  examBoard = "AQA", // Default exam board
  examType = "A-Level", // Default exam type
  recordId, // Record ID for saving cards
  userId, // User ID for attribution
  onComplete // Callback after cards are added
}) => {
  const [showGenerator, setShowGenerator] = useState(false);
  
  // Extract topic name and color
  const topicName = topic?.name || topic?.topic || "";
  const topicColor = topic?.color || topic?.cardColor || null;
  
  const handleGeneratorClose = () => {
    setShowGenerator(false);
    // Call onComplete callback if provided
    if (typeof onComplete === 'function') {
      onComplete();
    }
  };

  return (
    <div className="topic-generator-connector">
      <button 
        className="generate-flashcards-btn"
        onClick={() => setShowGenerator(true)}
        style={{
          backgroundColor: topicColor || '#06206e',
        }}
      >
        <span className="btn-icon">+</span>
        Generate Flashcards for {topicName}
      </button>
      
      {showGenerator && (
        <ErrorBoundary>
          <AICardGenerator
            initialSubject={subject}
            initialTopic={topicName}
            examBoard={examBoard}
            examType={examType}
            skipMetadataSteps={true}
            topicColor={topicColor}
            recordId={recordId}
            userId={userId}
            onClose={handleGeneratorClose}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default TopicToGeneratorConnector; 