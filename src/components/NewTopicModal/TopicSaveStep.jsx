import React from 'react';
import { FaSave, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

/**
 * TopicSaveStep - Third step in the topic modal flow
 * Allows users to confirm and save their topic list to Knack
 */
const TopicSaveStep = ({
  topics,
  isSaving,
  saveSuccess,
  onSave,
  error
}) => {
  if (saveSuccess) {
    return (
      <div className="topic-save-step">
        <div className="save-success">
          <div className="success-icon">
            <FaCheck />
          </div>
          <h3 className="save-message">Topics Saved Successfully!</h3>
          <p className="save-description">
            Your topics have been saved successfully and are now available for use in your flashcards.
            You can close this modal or visit the flashcard creator to start making cards.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="topic-save-step">
      {!isSaving && (
        <>
          <div className="save-icon">
            <FaSave />
          </div>
          <h3 className="save-message">Save Your Topics</h3>
          <p className="save-description">
            You're about to save {topics.length} topics for this subject. These topics will be
            available when creating new flashcards. Click the button below to save your topics.
          </p>
        </>
      )}

      {error && (
        <div className="error-message">
          <FaExclamationTriangle />
          <span>{error}</span>
        </div>
      )}

      {isSaving ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Saving your topics...</p>
          <p className="loading-text">This may take a moment while we update the database.</p>
        </div>
      ) : (
        <button 
          className="save-button" 
          onClick={onSave}
          disabled={isSaving || topics.length === 0}
        >
          <FaSave /> Save Topics
        </button>
      )}

      {!isSaving && (
        <div className="topics-summary">
          <h4>Topics to be saved: {topics.length}</h4>
          <ul className="topics-summary-list">
            {topics.slice(0, 5).map(topic => (
              <li key={topic.id}>{topic.name}</li>
            ))}
            {topics.length > 5 && (
              <li className="more-topics">
                ...and {topics.length - 5} more topics
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TopicSaveStep;
