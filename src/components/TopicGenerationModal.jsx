import React, { useState, useEffect } from "react";
import "./TopicGenerationModal.css";
import LoadingSpinner from "./LoadingSpinner";
import TopicReviewModal from "./TopicReviewModal";

const TopicGenerationModal = ({ 
  open,
  onClose, 
  onGenerate,
  subjects, 
  isGenerating = false,
  progress = { current: 0, total: 0 },
  currentSubject = null,
  onAddTopicsToSubject,
  onReviewComplete
}) => {
  // State for managing topic generation flow
  const [generationPhase, setGenerationPhase] = useState("initial"); // "initial", "generating", "reviewing", "complete"
  const [subjectsWithTopics, setSubjectsWithTopics] = useState([]);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  
  // Reset phase when modal is opened/closed
  useEffect(() => {
    if (open) {
      setGenerationPhase("initial");
      setShowCelebrationModal(false);
    }
  }, [open]);
  
  // Update phase based on generation status
  useEffect(() => {
    if (isGenerating) {
      setGenerationPhase("generating");
    } else if (generationPhase === "generating" && progress.current === progress.total && progress.total > 0) {
      // Generation is complete, show celebration and move to review phase
      setGenerationPhase("completed");
      setShowCelebrationModal(true);
      
      // Process subjects to ensure they have topics property
      // If App.js has added topics to the subjects, use those
      const processedSubjects = subjects.map(subject => {
        // Ensure each subject has a topics array
        return {
          ...subject,
          topics: subject.topics || [] // Use existing topics or empty array
        };
      });
      
      setSubjectsWithTopics(processedSubjects);
    }
  }, [isGenerating, progress, subjects, generationPhase]);
  
  // Handle starting the generation process
  const handleStartGeneration = () => {
    setGenerationPhase("generating");
    if (onGenerate) {
      onGenerate();
    }
  };
  
  // Handle completing the review process
  const handleCompleteReview = (finalSubjectsWithTopics) => {
    console.log("All topics reviewed and finalized:", finalSubjectsWithTopics);
    
    // Pass all topics to the parent component for complete handling
    if (onReviewComplete) {
      onReviewComplete(finalSubjectsWithTopics);
    } else {
      // Fallback to previous behavior if onReviewComplete is not provided
      finalSubjectsWithTopics.forEach(subject => {
        if (onAddTopicsToSubject) {
          onAddTopicsToSubject(subject.name, subject.topics);
        }
      });
    }
    
    setGenerationPhase("complete");
    onClose();
  };
  
  // Handle auto-adding all topics
  const handleAutoAddAll = (subjectsWithTopics) => {
    console.log("Auto-adding all topics:", subjectsWithTopics);
    
    // Pass all topics to the parent component for complete handling
    if (onReviewComplete) {
      onReviewComplete(subjectsWithTopics);
    } else {
      // Fallback to previous behavior if onReviewComplete is not provided
      subjectsWithTopics.forEach(subject => {
        if (onAddTopicsToSubject) {
          onAddTopicsToSubject(subject.name, subject.topics);
        }
      });
    }
    
    setGenerationPhase("complete");
    onClose();
  };
  
  // Handle generating cards for a specific topic
  const handleGenerateCardsForTopic = (subject, topic) => {
    console.log(`Generating cards for ${subject.name} - ${topic}`);
    // Close the topic review modal
    setGenerationPhase("complete");
    
    // Pass the topic and subject data to the parent component
    if (onClose) {
      onClose({
        action: "generateCards",
        subject: subject.name,
        topic: topic,
        examBoard: subject.examBoard,
        examType: subject.examType,
        color: subject.color
      });
    }
  };
  
  // If not open or missing required props, don't render anything
  if (!open || !subjects || !Array.isArray(subjects) || subjects.length === 0 || !onClose || !onGenerate) {
    console.log("TopicGenerationModal not rendering because:", { 
      open, 
      hasSubjects: !!subjects && Array.isArray(subjects) && subjects.length > 0,
      hasCallbacks: !!onClose && !!onGenerate
    });
    return null;
  }
  
  // If in reviewing phase, show the TopicReviewModal
  if (generationPhase === "completed" && !showCelebrationModal) {
    return (
          <TopicReviewModal
            subjectsWithTopics={subjectsWithTopics}
            onComplete={handleCompleteReview}
            onAutoAddAll={handleAutoAddAll}
            onClose={onClose}
            onAddTopicsToSubject={onAddTopicsToSubject}
            onGenerateCardsForTopic={handleGenerateCardsForTopic}
          />
    );
  }
  
  // Calculate progress percentage
  const progressPercentage = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div className="topic-generation-overlay">
      <div className="topic-generation-content">
        {generationPhase === "initial" ? (
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
                onClick={handleStartGeneration}
              >
                Yes, generate for all subjects
              </button>
            </div>
          </>
        ) : generationPhase === "generating" ? (
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
        ) : showCelebrationModal ? (
          // Celebration screen after generation completes
          <>
            <div className="topic-generation-header">
              <h2>Topics Generated! 🎉</h2>
              <button className="close-button" onClick={() => setShowCelebrationModal(false)}>✕</button>
            </div>
            <div className="topic-generation-body celebration">
              <div className="celebration-content">
                <div className="celebration-icon">🎓</div>
                <h3>WooHoo! Time to Add Your Topics!</h3>
                <p>We've generated topics for all your subjects! Now it's time to review and customize them to match your curriculum.</p>
                
                <div className="celebration-actions">
                  <button 
                    className="review-topics-button"
                    onClick={() => setShowCelebrationModal(false)}
                  >
                    Let's Review Topics
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default TopicGenerationModal;
