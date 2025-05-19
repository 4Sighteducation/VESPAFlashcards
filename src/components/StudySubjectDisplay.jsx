import React from 'react';
import { getContrastColor } from '../utils/ColorUtils';
import './StudySubjectDisplay.css'; // To be created

const StudySubjectDisplay = ({
  subjectName,
  subjectColor,
  cardsDueInSubject,
  reviewableCardsInSubject,
  onReviewAll, // Action to review all cards for this subject in the current box
  onOpenTopicsModal // Action to open the topic selection modal
}) => {
  if (!subjectName) return null;

  const textColor = getContrastColor(subjectColor || '#333333');
  const displayStyle = {
    backgroundColor: subjectColor || '#cccccc',
    color: textColor,
    borderLeft: `6px solid ${getContrastColor(textColor, 0.2, subjectColor)}`
  };

  return (
    <div className="study-subject-display-container" style={displayStyle}>
      <div className="study-subject-info" onClick={onOpenTopicsModal}>
        <h3 className="study-subject-name">
          {subjectName}
          {reviewableCardsInSubject > 0 && (
            <span className="review-notification-circle subject-notification">
              {reviewableCardsInSubject}
            </span>
          )}
        </h3>
        <span className="study-subject-cards-due">
          {cardsDueInSubject} card{cardsDueInSubject !== 1 ? 's' : ''} due
        </span>
      </div>
      <div className="study-subject-actions">
        <button
          title={`Review all ${cardsDueInSubject} cards for ${subjectName}`}
          onClick={onReviewAll}
          className="study-action-button review-all-button"
          disabled={cardsDueInSubject === 0}
        >
          <span role="img" aria-label="Review">👁️</span> Review All ({cardsDueInSubject})
        </button>
        {/* <button
          title={`View topics for ${subjectName}`}
          onClick={onOpenTopicsModal}
          className="study-action-button view-topics-button"
          disabled={cardsDueInSubject === 0}
        >
          View Topics ➔
        </button> */}
      </div>
    </div>
  );
};

export default StudySubjectDisplay; 