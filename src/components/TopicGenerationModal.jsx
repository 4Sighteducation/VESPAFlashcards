import React from "react";
import "./TopicGenerationModal.css";
import LoadingSpinner from "./LoadingSpinner";

const TopicGenerationModal = ({ 
  onClose, 
  onGenerateAll, 
  subjects, 
  isGenerating = false,
  progress = { current: 0, total: 0 },
  currentSubject = null
}) => {
  // Calculate progress percentage
  const progressPercentage = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;
  
  return (
    <div className="topic-generation-overlay">
      <div className="topic-generation-content">
        {!isGenerating ? (
          // Initial prompt screen
          <>
            <div className="topic-generation-header">
              <h2>Generate Topic Lists</h2>
              <button className="close-button" onClick={onClose}>✕</button>
            </div>
            <div className="topic-generation-body">
              <p>
                Would you like to automatically generate topic lists for all your selected subjects?
                This will use AI to create comprehensive topic lists for each subject based on your exam board and type.
              </p>
              
              <div className="subjects-summary">
                <h3>Selected Subjects:</h3>
                <ul>
                  {subjects.map(subject => (
                    <li key={subject.name}>
                      <span className="subject-dot" style={{ backgroundColor: subject.color }}></span>
                      {subject.name} ({subject.examBoard}, {subject.examType})
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="generation-note">
                <p><strong>Note:</strong> This process may take a few minutes depending on the number of subjects.</p>
              </div>
            </div>
            <div className="topic-generation-footer">
              <button 
                className="cancel-button"
                onClick={onClose}
              >
                I'll generate them later
              </button>
              <button 
                className="generate-button"
                onClick={onGenerateAll}
              >
                Yes, generate for all subjects
              </button>
            </div>
          </>
        ) : (
          // Progress screen
          <>
            <div className="topic-generation-header">
              <h2>Generating Topic Lists</h2>
            </div>
            <div className="topic-generation-body">
              <div className="generation-progress">
                <LoadingSpinner size="medium" />
                <div className="progress-info">
                  <p className="current-subject">
                    {currentSubject ? `Generating topics for ${currentSubject}...` : 'Preparing...'}
                  </p>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  <p className="progress-text">
                    {progress.current} of {progress.total} subjects completed ({progressPercentage}%)
                  </p>
                </div>
              </div>
              
              <div className="generation-note">
                <p>Please don't close this window. This process may take several minutes.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TopicGenerationModal; 