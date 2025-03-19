import React, { useState, useEffect } from 'react';
import './TopicCardGeneratorButton.css';
import MobileResponsiveCardGenerator from './MobileResponsiveCardGenerator';
import { createPortal } from 'react-dom';

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
  const [modalRoot, setModalRoot] = useState(null);
  
  // Set up the modal root on component mount
  useEffect(() => {
    // Create a div for the modal root if it doesn't exist
    let root = document.getElementById('card-generator-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'card-generator-modal-root';
      document.body.appendChild(root);
    }
    setModalRoot(root);
    
    // Clean up on unmount
    return () => {
      // Only remove the root if we created it and it's still in the DOM
      if (!root.getAttribute('data-persistent') && document.body.contains(root)) {
        document.body.removeChild(root);
      }
    };
  }, []);
  
  // Handler to open the generator
  const handleOpenGenerator = () => {
    setShowGenerator(true);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
  };
  
  // Handler to close the generator
  const handleCloseGenerator = () => {
    setShowGenerator(false);
    // Restore body scroll
    document.body.style.overflow = '';
  };
  
  // Prepare the topic data to pass to the generator
  const topicData = {
    topic: topic || "",
    subject: subject || "",
    examBoard: examBoard || "",
    examType: examType || "",
    subjectColor: subjectColor || "#06206e"
  };
  
  // Generate a contrasting text color based on background color
  const getContrastColor = (hexColor) => {
    // Default to white if no color provided
    if (!hexColor) return "#FFFFFF";
    
    // Remove the # if it exists
    const hex = hexColor.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance using sRGB luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark colors, and dark gray for light colors
    return luminance > 0.5 ? "#333333" : "#FFFFFF";
  };
  
  // Button background and text colors
  const buttonStyle = {
    backgroundColor: subjectColor || '#06206e',
    color: getContrastColor(subjectColor) || '#FFFFFF'
  };

  return (
    <>
      <button 
        className="topic-card-generator-button"
        onClick={handleOpenGenerator}
        style={buttonStyle}
        aria-label="Generate flashcards for this topic"
      >
        <i className="fa fa-magic"></i>
        <span>Generate Cards</span>
      </button>
      
      {showGenerator && modalRoot && createPortal(
        <MobileResponsiveCardGenerator
          topicData={topicData}
          onClose={handleCloseGenerator}
          onAddCard={onAddCard}
          onSaveCards={onSaveCards}
          auth={auth}
          userId={userId}
        />,
        modalRoot
      )}
    </>
  );
};

export default TopicCardGeneratorButton; 