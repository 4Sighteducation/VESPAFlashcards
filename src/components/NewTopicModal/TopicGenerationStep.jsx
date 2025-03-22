import React from 'react';
import { FaMagic, FaExclamationTriangle } from 'react-icons/fa';

/**
 * TopicGenerationStep - First step in the topic modal flow
 * Allows users to generate topics based on subject, exam board, and exam type
 */
const TopicGenerationStep = ({
  subject,
  examBoard,
  examType,
  isGenerating,
  onGenerate,
  error
}) => {
  return (
    <div className="topic-generation-step">
      <div className="generation-description">
        <h3>Generate Topics for {subject}</h3>
        <p>
          Generate a comprehensive list of topics for {subject} ({examBoard} {examType}) 
          using our AI-powered topic generation system. The topics will be based on 
          the latest curriculum requirements.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <FaExclamationTriangle />
          <span>{error}</span>
        </div>
      )}

      {isGenerating ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Generating topics for {subject}...</p>
          <p className="loading-text">This may take a moment while we analyze the curriculum.</p>
        </div>
      ) : (
        <div className="generation-actions">
          <button 
            className="generation-button" 
            onClick={onGenerate}
            disabled={isGenerating}
          >
            <FaMagic /> Generate Topics
          </button>
          <p className="generation-help-text">
            Click the button above to generate a comprehensive list of topics for your subject.
            You'll be able to review and edit the topics in the next step.
          </p>
        </div>
      )}

      <div className="existing-topics-info">
        <h4>What happens to my existing topics?</h4>
        <p>
          Generating new topics will replace any existing topics for this subject, exam board, 
          and exam type. You'll have a chance to review the generated topics before saving them.
        </p>
      </div>
    </div>
  );
};

export default TopicGenerationStep;
