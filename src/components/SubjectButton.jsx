import React from 'react';
import { getContrastColor } from '../utils/ColorUtils';
import './SubjectButton.css'; // We'll create this CSS file next

const SubjectButton = ({
  subjectData,
  onClick, // For opening the TopicListModal
  onAction // For subject-level actions like slideshow, print, color, delete
}) => {
  if (!subjectData) return null;

  const {
    name,
    color, // Base subject color
    totalTopics = 0,
    totalCards = 0,
    examBoard = 'N/A',
    examType = 'N/A'
  } = subjectData;

  const textColor = getContrastColor(color || '#333333');
  const buttonStyle = {
    backgroundColor: color || '#cccccc',
    color: textColor,
    borderLeft: `8px solid ${getContrastColor(textColor, 0.2, color)}` // Accent border
  };

  const handleAction = (actionType, e) => {
    e.stopPropagation(); // Prevent onClick from firing
    if (onAction) {
      onAction(actionType, name); // Pass subject name
    }
  };

  return (
    <div className="subject-button-container" style={buttonStyle} onClick={() => onClick(subjectData)}>
      <div className="subject-button-main-content">
        <h3 className="subject-button-name">{name}</h3>
        <div className="subject-button-meta">
          <span>Topics: {totalTopics}</span>
          <span>Cards: {totalCards}</span>
          <span>{examType}</span>
          <span>{examBoard}</span>
        </div>
      </div>
      <div className="subject-button-actions">
        <button
          title={`Slideshow for ${name}`}
          onClick={(e) => handleAction('slideshow', e)}
          className="action-icon"
          disabled={totalCards === 0}
        >
          🔄 {/* Slideshow Icon */}
        </button>
        <button
          title={`Print cards for ${name}`}
          onClick={(e) => handleAction('print', e)}
          className="action-icon"
          disabled={totalCards === 0}
        >
          🖨️ {/* Print Icon */}
        </button>
        <button
          title={`Edit color for ${name}`}
          onClick={(e) => handleAction('color', e)}
          className="action-icon"
        >
          🎨 {/* Color Icon */}
        </button>
        <button
          title={`Delete ${name}`}
          onClick={(e) => handleAction('delete', e)}
          className="action-icon delete"
        >
          🗑️ {/* Delete Icon */}
        </button>
      </div>
    </div>
  );
};

export default SubjectButton; 