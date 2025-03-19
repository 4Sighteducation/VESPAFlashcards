import React, { useState } from 'react';
import MobileResponsiveCardGenerator from './MobileResponsiveCardGenerator';
import './TopicCardGeneratorButton.css';

/**
 * TopicCardGeneratorButton
 * 
 * This component renders a button that launches the MobileResponsiveCardGenerator
 * when clicked. It's designed to be used in the topic list UI to allow users
 * to generate cards directly from a selected topic.
 */
const TopicCardGeneratorButton = ({
  topic,
  subject,
  examBoard,
  examType,
  onAddCard,
  onSaveCards,
  subjectColor,
  auth,
  userId
}) => {
  const [showGenerator, setShowGenerator] = useState(false);
  
  // Open the card generator
  const handleOpenGenerator = () => {
    setShowGenerator(true);
  };
  
  // Close the card generator
  const handleCloseGenerator = () => {
    setShowGenerator(false);
  };
  
  // Prepare topic data for the generator
  const topicData = {
    topic,
    subject,
    examBoard,
    examType
  };
  
  return (
    <>
      <button 
        className="topic-card-generator-button"
        onClick={handleOpenGenerator}
        title="Generate flashcards for this topic"
      >
        <span className="generator-icon">⚡</span>
        <span className="generator-text">Generate Cards</span>
      </button>
      
      {showGenerator && (
        <div className="mobile-generator-modal">
          <MobileResponsiveCardGenerator
            topicData={topicData}
            subjectColor={subjectColor}
            onAddCard={onAddCard}
            onSaveCards={onSaveCards}
            onClose={handleCloseGenerator}
            auth={auth}
            userId={userId}
          />
        </div>
      )}
    </>
  );
};

export default TopicCardGeneratorButton; 