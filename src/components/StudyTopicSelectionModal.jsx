import React from 'react';
import { getContrastColor } from '../utils/ColorUtils';
import './StudyTopicSelectionModal.css'; // To be created

const StudyTopicSelectionModal = ({
  isOpen,
  onClose,
  subjectName,
  subjectColor,
  topicsWithDueCards, // Array of { name, color, cardsDueInTopicCount, id (topicId) }
  onReviewTopic, // (subjectName, topicData) => void - topicData will be the selected topic object
}) => {
  if (!isOpen || !subjectName) return null;

  const headerColor = subjectColor || '#333333';
  const headerTextColor = getContrastColor(headerColor);

  const handleTopicSelect = (topicData, e) => {
    e.stopPropagation();
    if (onReviewTopic) {
      onReviewTopic(subjectName, topicData);
    }
    onClose(); // Close modal after selection
  };

  return (
    <div className="modal-overlay study-topic-modal-overlay" onClick={onClose}>
      <div className="modal-content study-topic-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button study-topic-close-button" onClick={onClose}>&times;</button>
        <div className="study-topic-modal-header" style={{ backgroundColor: headerColor, color: headerTextColor }}>
          <h2>Select Topic to Study</h2>
          <h4>{subjectName}</h4>
        </div>
        <div className="study-topic-modal-body">
          {(!topicsWithDueCards || topicsWithDueCards.length === 0) && (
            <p className="no-study-topics-message">No topics with cards due in the current box for this subject.</p>
          )}
          {topicsWithDueCards && topicsWithDueCards.map((topic) => {
            const topicDisplayColor = topic.color || headerColor; // Fallback to subject color
            const topicTextColor = getContrastColor(topicDisplayColor);
            const cardsDueCount = topic.cardsDueInTopicCount || 0;
            const reviewableCount = topic.reviewableCardsInTopic || 0; // Get reviewable count

            return (
              <button
                key={topic.id || topic.name}
                className="study-topic-item-button"
                style={{ backgroundColor: topicDisplayColor, color: topicTextColor }}
                onClick={(e) => handleTopicSelect(topic, e)}
                disabled={cardsDueCount === 0} /* Should this be reviewableCount === 0 ? */
              >
                <span className="study-topic-item-name">
                  {topic.name}
                  {reviewableCount > 0 && (
                    <span className="review-notification-circle topic-notification">
                      {reviewableCount}
                    </span>
                  )}
                </span>
                <span className="study-topic-item-cards-due">
                  ({cardsDueCount} card{cardsDueCount !== 1 ? 's' : ''} due)
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StudyTopicSelectionModal; 