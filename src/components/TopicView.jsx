import React, { useState } from 'react';
import TopicToGeneratorConnector from './TopicToGeneratorConnector';
import './TopicView.css';

/**
 * TopicView - Example component showing how to integrate the TopicToGeneratorConnector
 * This is a sample implementation that can be adapted to your Topic Hub
 */
const TopicView = ({ 
  topic, 
  cards = [], 
  subject = "",
  examBoard = "AQA",
  examType = "A-Level",
  recordId,
  userId,
  onRefresh
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const handleGeneratorComplete = () => {
    console.log("Card generation complete, refreshing cards...");
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  };
  
  // Sample render showing how to use the connector
  return (
    <div className="topic-view" style={{ 
      borderColor: topic.color || '#cccccc' 
    }}>
      <div className="topic-header" style={{ 
        backgroundColor: topic.color || '#cccccc',
        color: getContrastColor(topic.color || '#cccccc')
      }}>
        <h3>{topic.name || topic.topic}</h3>
        <div className="topic-stats">
          <span>{cards.length} Cards</span>
          <button 
            className="expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="topic-content">
          <div className="topic-actions">
            {/* This is where we integrate the connector */}
            <TopicToGeneratorConnector
              topic={topic}
              subject={subject}
              examBoard={examBoard}
              examType={examType}
              recordId={recordId}
              userId={userId}
              onComplete={handleGeneratorComplete}
            />
            
            {/* Other topic actions would go here */}
            <button className="view-cards-btn">
              View Cards ({cards.length})
            </button>
          </div>
          
          {/* Card preview section - you could show a few cards here */}
          {cards.length > 0 && (
            <div className="card-preview-section">
              <h4>Recent Cards</h4>
              <div className="card-previews">
                {cards.slice(0, 3).map(card => (
                  <div key={card.id} className="card-preview-item" style={{ 
                    borderColor: card.cardColor || topic.color || '#cccccc' 
                  }}>
                    <div className="preview-question">{card.front || card.question}</div>
                  </div>
                ))}
                {cards.length > 3 && (
                  <div className="more-cards">
                    +{cards.length - 3} more cards
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to determine text color based on background color for contrast
const getContrastColor = (hexColor) => {
  if (!hexColor || typeof hexColor !== 'string') return '#000000';
  
  try {
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Handle 3-character hex
    if (hexColor.length === 3) {
      hexColor = hexColor[0] + hexColor[0] + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2];
    }
    
    // Validate hex format
    if (!/^[0-9A-F]{6}$/i.test(hexColor)) {
      return '#000000';
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // Calculate luminance (perceived brightness)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
  } catch (error) {
    console.error("Error calculating contrast color:", error);
    return '#000000';
  }
};

export default TopicView; 