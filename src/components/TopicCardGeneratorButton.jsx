import React, { useState } from 'react';
import { FaBolt } from 'react-icons/fa';
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
  const openGenerator = () => {
    setShowGenerator(true);
  };
  
  // Close the card generator
  const closeGenerator = () => {
    setShowGenerator(false);
  };
  
  // Prepare topic data for the generator
  const topicData = {
    topic,
    subject,
    examBoard,
    examType,
    subjectColor
  };
  
  return (
    <div className="topic-card-generator-wrapper">
      <button 
        className="topic-card-generator-button"
        onClick={openGenerator}
        style={{ backgroundColor: subjectColor || '#06206e' }}
      >
        <FaBolt className="generator-icon" />
        <span>Generate Cards</span>
      </button>
      
      {showGenerator && (
        <MobileResponsiveCardGenerator
          topicData={topicData}
          onClose={closeGenerator}
          onAddCard={onAddCard}
          onSaveCards={onSaveCards}
          auth={auth}
          userId={userId}
        />
      )}
    </div>
  );
};

export default TopicCardGeneratorButton; 