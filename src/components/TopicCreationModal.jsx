import React, { useState, useEffect, useCallback, useRef } from "react";
// Note: Removed axios import as we primarily use WebSocket and Knack Service now
import "./TopicCreationModal.css"; // Import the new CSS file
import LoadingSpinner from "./LoadingSpinner";
import TopicHub from "./TopicHub"; // Still needed for the final step
import { useWebSocket } from "../hooks/useWebSocket";

// Constants related to Topic Hub functionality
const MAX_TOPICS_GENERATED = 25; // Increased limit as discussed
const MAX_TOPICS_DISPLAYED = 25;

// Helper function to get default form data (only topic metadata)
const getDefaultFormData = () => ({
  examType: "",
  examBoard: "",
  subject: "",
});

// Define the new component
const TopicCreationModal = ({
  onClose,
  onSaveTopicShells, // This is the prop passed down from App.js
  userId,
  recordId,
  updateColorMapping, // Keep if TopicHub or saving needs to update colors
  existingSubjects = [], // Make sure this has a default value
  initialExamType = "",
  initialExamBoard = "",
  initialSubject = "",
}) => {
  console.log(`[TopicCreationModal] Initializing`);

  // State management
  const [formData, setFormData] = useState({
    ...getDefaultFormData(),
    examType: initialExamType,
    examBoard: initialExamBoard,
    subject: initialSubject,
  });

  // ** NEW State to track if user is adding a new subject **
  const [isAddingNewSubject, setIsAddingNewSubject] = useState(false);

  // Workflow: 1: Type, 2: Board, 3: Subject, 4: TopicHub
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // State for topic generation via WebSocket
  const [isLoading, setIsLoading] = useState(false); // Specifically for topic generation loading
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [generatedTopics, setGeneratedTopics] = useState([]);
  const [topicGenerationComplete, setTopicGenerationComplete] = useState(false);

  // Ref to track mounted state
  const isMounted = useRef(true);

  // WebSocket context for topic generation
  const { sendMessage, lastMessage, readyState } = useWebSocket();
  const isConnected = readyState === 1; // WebSocket.OPEN

  // Pending operations state
  const [pendingOperations, setPendingOperations] = useState({
    generateTopics: false,
  });

  // Clear error when changing steps
  useEffect(() => {
    setError(null);
  }, [currentStep]);

  // WebSocket message handler
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const data = JSON.parse(lastMessage.data);
      
      switch (data.type) {
        case 'status':
          if (data.action === 'generateTopics') {
            console.log("[TopicCreationModal] Progress update:", data);
            setProgress(data.progress || 0);
            setProgressMessage(data.message || "");
          }
          break;

        case 'topicResults':
          if (data.action === 'generateTopics' && Array.isArray(data.topics)) {
            console.log("[TopicCreationModal] Topic results received:", data);
            setGeneratedTopics(data.topics);
            setProgress(100);
            setProgressMessage("Topic generation complete!");
            setIsLoading(false);
            setTopicGenerationComplete(true);
            setPendingOperations(prev => ({ ...prev, generateTopics: false }));
          }
          break;

        case 'error':
          console.error("[TopicCreationModal] Error from WebSocket:", data);
          setError(data.message || "An unknown error occurred during topic generation.");
          setIsLoading(false);
          setProgress(0);
          setProgressMessage("");
          setPendingOperations(prev => ({ ...prev, generateTopics: false }));
          break;

        default:
          console.log("[TopicCreationModal] Unhandled message type:", data.type);
      }
    } catch (error) {
      console.error("[TopicCreationModal] Error parsing WebSocket message:", error);
    }
  }, [lastMessage]);

  // Add this useEffect to log and verify existingSubjects
  useEffect(() => {
    console.log("Existing subjects in modal:", existingSubjects);
  }, [existingSubjects]);

  // Function to handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'subject-select') {
      if (value === '--addNew--') {
        setIsAddingNewSubject(true);
        setFormData(prev => ({
          ...prev,
          subject: ''
        }));
      } else {
        setIsAddingNewSubject(false);
        setFormData(prev => ({
          ...prev,
          subject: value
        }));
      }
    } else if (name === 'subject-new') {
      setFormData(prev => ({
        ...prev,
        subject: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Reset generated topics if metadata changes before reaching TopicHub
    if (currentStep < 4 && (name === 'examType' || name === 'examBoard' || name === 'subject' || name === 'subject-select' || name === 'subject-new')) {
        setGeneratedTopics([]);
        setTopicGenerationComplete(false);
    }
  };

  // Function to proceed to the next step
  const handleNext = () => {
    console.log(`[TopicCreationModal] handleNext called. Current step: ${currentStep}, Total steps: ${totalSteps}`);
    setError(null);

    // Validation checks
    if (currentStep === 1 && !formData.examType) {
      console.log("[TopicCreationModal] Validation failed: Exam Type missing.");
      setError("Please select an Exam Type.");
      return;
    }
    if (currentStep === 2 && !formData.examBoard) {
      console.log("[TopicCreationModal] Validation failed: Exam Board missing.");
      setError("Please select an Exam Board.");
      return;
    }
    if (currentStep === 3 && !formData.subject) {
      console.log(`[TopicCreationModal] Validation failed: Subject missing or empty. Value: '${formData.subject}'`);
      setError("Please select or enter a Subject.");
      return;
    }
    console.log("[TopicCreationModal] Validation passed for step", currentStep);

    // Check if we can advance
    if (currentStep < totalSteps) {
      console.log(`[TopicCreationModal] Advancing from step ${currentStep} to ${currentStep + 1}`);
      setCurrentStep(currentStep + 1);
    } else {
      console.log("[TopicCreationModal] Already at the last step or beyond.");
    }
  };

  // Function to go back to the previous step
  const handlePrevious = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      // Reset generation state if going back from Topic Hub
      if (currentStep === totalSteps) {
        setGeneratedTopics([]);
        setTopicGenerationComplete(false);
        setIsLoading(false);
        setProgress(0);
        setProgressMessage("");
      }
    }
  };

  // Update the triggerTopicGeneration function
  const triggerTopicGeneration = useCallback(async () => {
    const { examType, examBoard, subject } = formData;

    if (!examType || !examBoard || !subject) {
      setError("Missing required fields: Exam Type, Exam Board, or Subject.");
      return;
    }
    if (!isConnected) {
      setError("WebSocket connection is not available. Cannot generate topics.");
      return;
    }
    if (isLoading || pendingOperations.generateTopics) {
      console.log("Topic generation already in progress or pending.");
      return;
    }

    console.log(`[TopicCreationModal] Triggering topic generation for ${subject}`);
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setProgressMessage("Initiating topic generation...");
    setGeneratedTopics([]);
    setTopicGenerationComplete(false);
    setPendingOperations(prev => ({ ...prev, generateTopics: true }));

    try {
      sendMessage(JSON.stringify({
        action: 'generateTopics',
        data: {
          examType,
          examBoard,
          subject
        }
      }));
    } catch (error) {
      console.error("[TopicCreationModal] Error sending WebSocket message:", error);
      setError("Failed to start topic generation. Please try again.");
      setIsLoading(false);
      setPendingOperations(prev => ({ ...prev, generateTopics: false }));
    }
  }, [formData, isConnected, isLoading, pendingOperations.generateTopics, sendMessage]);

  // Function to handle the finalization and saving of topics from TopicHub
  const handleFinalizeAndSaveTopics = useCallback(async (topicShells) => {
    console.log(`[TopicCreationModal] Received ${topicShells.length} finalized topic shells from TopicHub.`);
    console.log(`[TopicCreationModal] Current formData state: ExamType='${formData.examType}', ExamBoard='${formData.examBoard}', Subject='${formData.subject}'`);

    if (!Array.isArray(topicShells) || topicShells.length === 0) {
      console.warn("[TopicCreationModal] No topic shells provided for finalization. Closing modal.");
      onClose();
      return;
    }

    // Ensure shells have the necessary metadata before saving
    const shellsToSave = topicShells.map(shell => ({
        ...shell, // Include name, color, etc. from TopicHub selection
        examType: formData.examType,
        examBoard: formData.examBoard,
        subject: formData.subject,
        type: 'topic', // Ensure type is set correctly
        isShell: true, // Mark as a shell
        timestamp: new Date().toISOString(), // Add creation timestamp
    }));

    console.log("[TopicCreationModal] Prepared shellsToSave:", shellsToSave);

    try {
      // Call the onSaveTopicShells prop (from App.js or parent) to handle persistence
      if (onSaveTopicShells && typeof onSaveTopicShells === 'function') {
        await onSaveTopicShells(shellsToSave);
        console.log("[TopicCreationModal] Topic shells passed to onSaveTopicShells handler.");
      } else {
        console.error("[TopicCreationModal] onSaveTopicShells prop is missing or not a function.");
        setError("Configuration error: Cannot save topic shells.");
        return; // Prevent closing if save failed
      }

      onClose(); // Close modal after successful save

    } catch (error) {
      console.error("[TopicCreationModal] Error saving topic shells:", error);
      setError(`Failed to save topic shells: ${error.message}`);
    }

  }, [onSaveTopicShells, onClose, formData.examType, formData.examBoard, formData.subject]);

  // Render content based on the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Exam Type
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select Exam Type</h2>
            <div className="form-group">
              <select
                name="examType"
                value={formData.examType}
                onChange={handleChange}
                required
                className="form-control" // Add a class for styling
              >
                <option value="">Select Type...</option>
                <option value="GCSE">GCSE</option>
                <option value="A-Level">A-Level</option>
                <option value="AS-Level">AS-Level</option>
                <option value="BTEC">BTEC</option>
                <option value="Diploma">Diploma</option>
                <option value="Certificate">Certificate</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        );
      case 2: // Exam Board
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select Exam Board</h2>
            <div className="form-group">
              <select
                name="examBoard"
                value={formData.examBoard}
                onChange={handleChange}
                required
                 className="form-control" // Add a class for styling
              >
                <option value="">Select Board...</option>
                <option value="AQA">AQA</option>
                <option value="Edexcel">Edexcel</option>
                <option value="OCR">OCR</option>
                <option value="WJEC">WJEC</option>
                <option value="CCEA">CCEA</option>
                <option value="Cambridge">Cambridge International</option>
                <option value="IB">IB (International Baccalaureate)</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        );
      case 3: // Subject
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select or Create Subject</h2>
            <div className="form-group">
              {!isAddingNewSubject ? (
                <>
                  <label htmlFor="subject-select">Choose a Subject:</label>
                  <select
                    id="subject-select"
                    name="subject-select"
                    value={formData.subject || ''}
                    onChange={handleChange}
                    className="form-control"
                  >
                    <option value="">Select a Subject</option>
                    {Array.isArray(existingSubjects) && existingSubjects.map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                    <option value="--addNew--">+ Add New Subject</option>
                  </select>
                </>
              ) : (
                <>
                  <label htmlFor="subject-new">Enter New Subject:</label>
                  <div className="new-subject-input">
                    <input
                      type="text"
                      id="subject-new"
                      name="subject-new"
                      value={formData.subject || ''}
                      onChange={handleChange}
                      placeholder="Enter subject name"
                      className="form-control"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewSubject(false);
                        setFormData(prev => ({ ...prev, subject: '' }));
                      }}
                      className="cancel-new-subject"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      case 4: // Topic Hub
        return (
          <div className="step-content topic-hub-step">
            {/* TopicHub handles its own UI */}
            <TopicHub
              examType={formData.examType}
              examBoard={formData.examBoard}
              subject={formData.subject}
              generatedTopics={generatedTopics}
              isLoading={isLoading}
              error={error}
              progress={progress}
              progressMessage={progressMessage}
              triggerTopicGeneration={triggerTopicGeneration}
              onFinalizeTopics={handleFinalizeAndSaveTopics}
              topicGenerationComplete={topicGenerationComplete}
              maxTopicsGenerated={MAX_TOPICS_GENERATED}
              maxTopicsDisplayed={MAX_TOPICS_DISPLAYED}
              onClose={onClose}
            />
          </div>
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  // Progress bar styles
  const progressBarContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    width: '80%', // Adjust width as needed
    margin: '20px auto', // Center it
  };

  const stepStyle = (step, currentStep) => ({
    width: '30px', // Fixed size circle
    height: '30px',
    borderRadius: '50%',
    backgroundColor: step <= currentStep ? '#007bff' : '#e0e0e0', // Active vs inactive color
    color: step <= currentStep ? '#ffffff' : '#666666',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    transition: 'background-color 0.3s ease',
    zIndex: 1, // Ensure circles are above lines
    position: 'relative', // Needed for line positioning
  });

  const lineStyle = (step, currentStep, totalSteps) => ({
    flexGrow: 1, // Take up space between circles
    height: '4px',
    backgroundColor: step < currentStep ? '#007bff' : '#e0e0e0',
    transition: 'background-color 0.3s ease',
    // Adjust margin to align lines correctly between circles
    margin: '0 -15px', // Overlap slightly with circles
  });

  // Inline error display styles
  const errorStyle = {
    color: 'red',
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
  };

  const clearErrorButtonStyle = {
    background: 'none',
    border: 'none',
    font: 'inherit',
    cursor: 'pointer',
    outline: 'inherit',
    marginLeft: '10px',
  };

  return (
    <div className="topic-creation-modal-overlay" onClick={onClose}> {/* Use new class */}
      <div className="topic-creation-modal-content" onClick={(e) => e.stopPropagation()}> {/* Use new class */}
        {/* Add a Title */}
         <div className="modal-header">
             <h2>Create New Topic List</h2>
             <button className="close-button" onClick={onClose}>×</button>
         </div>

        {/* --- START Progress Bar JSX --- */}
        <div className="progress-bar-container" style={progressBarContainerStyle}>
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <React.Fragment key={step}>
              <div style={stepStyle(step, currentStep)}>
                {currentStep > step ? '✓' : step}
              </div>
              {step < totalSteps && <div style={lineStyle(step, currentStep, totalSteps)}></div>}
            </React.Fragment>
          ))}
        </div>
        {/* --- END Progress Bar JSX --- */}

        {/* --- START Inline Error Display --- */}
        {error && currentStep < totalSteps && (
          <div style={errorStyle}>
            <span style={{ marginRight: '10px' }}>⚠️</span>
            {error}
            <button onClick={() => setError(null)} style={clearErrorButtonStyle}>×</button>
          </div>
        )}
        {/* --- END Inline Error Display --- */}

        <div className="step-content-container">
          {renderStepContent()}
        </div>

        {/* Loading indicator only needed if triggered OUTSIDE TopicHub (unlikely now) */}
        {/* {isLoading && currentStep !== totalSteps && ( ... )} */}

        {/* Navigation Buttons - Only show for steps 1-3 */}
        {currentStep < totalSteps && (
           <div className="navigation-buttons">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1 || isLoading}
              className="button-secondary" // Use consistent button classes
            >
              ← Previous
            </button>
            <button
              onClick={handleNext}
              disabled={isLoading ||
                (currentStep === 1 && !formData.examType) ||
                (currentStep === 2 && !formData.examBoard) ||
                (currentStep === 3 && !formData.subject)
              }
              className="button-primary" // Use consistent button classes
            >
              Next →
            </button>
          </div>
        )}
        {/* No navigation needed on Step 4 (TopicHub), it has its own 'Confirm'/'Cancel' */}
      </div>
    </div>
  );
};

export default TopicCreationModal; // Export the new component name