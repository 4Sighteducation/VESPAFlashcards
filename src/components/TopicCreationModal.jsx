import React, { useState, useEffect, useCallback, useRef } from "react";
// Note: Removed axios import as we primarily use WebSocket and Knack Service now
import "./TopicCreationModal.css"; // Import the new CSS file
import LoadingSpinner from "./LoadingSpinner";
import TopicHub from "./TopicHub"; // Still needed for the final step
import { useWebSocket } from "../contexts/WebSocketContext";

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
  initialExamType = "",
  initialExamBoard = "",
  initialSubject = "",
  existingSubjects = [], // Pass existing subjects to potentially prevent duplicates
}) => {
  console.log(`[TopicCreationModal] Initializing`);

  // State management
  const [formData, setFormData] = useState({
    ...getDefaultFormData(),
    examType: initialExamType,
    examBoard: initialExamBoard,
    subject: initialSubject,
  });

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
  const { socket, isConnected } = useWebSocket();

  // Pending operations state
  const [pendingOperations, setPendingOperations] = useState({
    generateTopics: false,
  });

  // Clear error when changing steps
  useEffect(() => {
    setError(null);
  }, [currentStep]);

  // WebSocket listeners for Topic Generation
  useEffect(() => {
    isMounted.current = true;

    if (socket && isConnected) {
      console.log("[TopicCreationModal] WebSocket connected, setting up topic listeners.");

      const handleProgress = (data) => {
        if (!isMounted.current) return;
        console.log("[TopicCreationModal] Progress update:", data);
        if (data && typeof data.progress === 'number' && typeof data.message === 'string') {
          setProgress(data.progress);
          setProgressMessage(data.message);
        }
      };

      const handleTopicResults = (data) => {
        if (!isMounted.current) return;
        console.log("[TopicCreationModal] Topic results received:", data);
        if (data && Array.isArray(data.topics)) {
          setGeneratedTopics(data.topics);
          setProgress(100);
          setProgressMessage("Topic generation complete!");
          setIsLoading(false);
          setTopicGenerationComplete(true);
          setPendingOperations(prev => ({ ...prev, generateTopics: false }));
        } else {
          setError("Received invalid topic data format from server.");
          setIsLoading(false);
          setPendingOperations(prev => ({ ...prev, generateTopics: false }));
        }
      };

      const handleError = (errorData) => {
        if (!isMounted.current) return;
        console.error("[TopicCreationModal] Error from WebSocket:", errorData);
        setError(errorData.message || "An unknown error occurred during topic generation.");
        setIsLoading(false);
        setProgress(0);
        setProgressMessage("");
        setPendingOperations(prev => ({ ...prev, generateTopics: false }));
      };

      socket.on("generation_progress", handleProgress);
      socket.on("topic_results", handleTopicResults);
      socket.on("generation_error", handleError);

      return () => {
        console.log("[TopicCreationModal] Cleaning up WebSocket listeners.");
        isMounted.current = false;
        socket.off("generation_progress", handleProgress);
        socket.off("topic_results", handleTopicResults);
        socket.off("generation_error", handleError);
      };
    } else {
      console.log("[TopicCreationModal] WebSocket not connected.");
    }
  }, [socket, isConnected]);

  // Function to handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Reset generated topics if metadata changes before reaching TopicHub
    if (currentStep < 4 && (name === 'examType' || name === 'examBoard' || name === 'subject')) {
      setGeneratedTopics([]);
      setTopicGenerationComplete(false);
    }
  };

  // Function to proceed to the next step
  const handleNext = () => {
    setError(null);

    if (currentStep === 1 && !formData.examType) {
      setError("Please select an Exam Type.");
      return;
    }
    if (currentStep === 2 && !formData.examBoard) {
      setError("Please select an Exam Board.");
      return;
    }
    if (currentStep === 3 && !formData.subject) {
      setError("Please enter a Subject.");
      return;
    }
    // Optional: Add check for duplicate subject name here
    // if (currentStep === 3 && existingSubjects.includes(formData.subject.trim())) {
    //   setError("A subject with this name already exists.");
    //   return;
    // }


    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
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

  // Trigger topic generation (called from TopicHub component)
  const triggerTopicGeneration = useCallback(async (generationParams) => {
    const { examType, examBoard, subject } = formData;

    if (!examType || !examBoard || !subject) {
      setError("Missing required fields: Exam Type, Exam Board, or Subject.");
      return;
    }
    if (!socket || !isConnected) {
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
      socket.emit("generate_topics", {
        userId: userId || recordId || 'unknown_user',
        sessionId: socket.id,
        examType,
        examBoard,
        subject,
        numTopics: generationParams?.numTopics || 10, // Use param from TopicHub
        detailLevel: generationParams?.detailLevel || 'Standard' // Use param from TopicHub
      });
      console.log("[TopicCreationModal] Topic generation request sent via WebSocket.");
    } catch (error) {
      console.error("[TopicCreationModal] Error triggering topic generation:", error);
      setError(`Failed to start topic generation: ${error.message}`);
      setIsLoading(false);
      setPendingOperations(prev => ({ ...prev, generateTopics: false }));
    }

    // Timeout for WebSocket response
    setTimeout(() => {
      if (isMounted.current && pendingOperations.generateTopics) {
         console.warn("[TopicCreationModal] Topic generation timeout - resetting state.");
         setIsLoading(false);
         setPendingOperations(prev => ({ ...prev, generateTopics: false }));
         setError("Topic generation timed out. Please try again.");
      }
    }, 30000); // 30 second timeout

  }, [socket, isConnected, userId, recordId, formData, isLoading, pendingOperations.generateTopics]);

  // Function to handle the finalization and saving of topics from TopicHub
  const handleFinalizeAndSaveTopics = useCallback(async (topicShells) => {
    console.log(`[TopicCreationModal] Received ${topicShells.length} finalized topic shells from TopicHub.`);

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
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Enter Subject Name</h2>
            <div className="form-group">
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="E.g., Biology, History, Music Technology"
                required
                className="form-control" // Add a class for styling
              />
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