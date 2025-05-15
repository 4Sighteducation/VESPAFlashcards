import React, { useState, useEffect, useCallback, useRef } from "react";
// Note: Removed axios import as we primarily use WebSocket and Knack Service now
import "./TopicCreationModal.css"; // Import the new CSS file
import LoadingSpinner from "./LoadingSpinner";
import TopicHub from "./TopicHub"; // Still needed for the final step
import { useWebSocket } from "../hooks/useWebSocket";
import { fetchExamBoards, fetchSubjects, fetchTopics } from "../services/KnackTopicService";

// Constants related to Topic Hub functionality
const MAX_TOPICS_GENERATED = 25; // Increased limit as discussed
const MAX_TOPICS_DISPLAYED = 25;

// IB subject groups for structured generation
const ibSubjectGroups = {
  "Language & Literature": ["English Literature", "Language A Literature", "Language A Language and Literature"],
  "Language Acquisition": ["English B", "French B", "Spanish B", "German B", "Mandarin B", "Language ab initio"],
  "Individuals & Societies": ["History", "Geography", "Economics", "Psychology", "Business Management", "Global Politics"],
  "Sciences": ["Biology", "Chemistry", "Physics", "Computer Science", "Design Technology", "Environmental Systems and Societies"],
  "Mathematics": ["Mathematics: Analysis and Approaches", "Mathematics: Applications and Interpretation"],
  "The Arts": ["Visual Arts", "Theatre", "Music", "Film", "Dance"]
};

// Helper function to get available IB subjects
function getIBSubjects(group) {
  return ibSubjectGroups[group] || [];
}

// Helper function to get all IB subject groups
function getIBSubjectGroups() {
  return Object.keys(ibSubjectGroups);
}

// Helper function to get default form data (only topic metadata)
const getDefaultFormData = () => ({
  examType: "",
  examBoard: "",
  subject: "",
  ibGroup: "", // Add field for IB subject group
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
  dlog(`[TopicCreationModal] Initializing`);

  // State management
  const [formData, setFormData] = useState({
    ...getDefaultFormData(),
    examType: initialExamType,
    examBoard: initialExamBoard,
    subject: initialSubject,
  });

  // ** NEW State to track if user is adding a new subject **
  const [isAddingNewSubject, setIsAddingNewSubject] = useState(false);
  const [isIBSelected, setIsIBSelected] = useState(false); // Track if IB is selected
  
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
  
  // Add state for locking during save operations
  const [isLocked, setIsLocked] = useState(false);

  // Ref to track mounted state
  const isMounted = useRef(true);

  // WebSocket context for topic generation
  const { sendMessage, lastMessage, readyState } = useWebSocket();
  const isConnected = readyState === 1; // WebSocket.OPEN

  // Pending operations state
  const [pendingOperations, setPendingOperations] = useState({
    generateTopics: false,
  });

  // Add state for dynamic data from Knack
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableExamBoards, setAvailableExamBoards] = useState([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // Add useEffect to handle subject list updates
  useEffect(() => {
    if (Array.isArray(existingSubjects)) {
      dlog("[TopicCreationModal] Received existing subjects:", existingSubjects);
      setAvailableSubjects(existingSubjects);
    }
  }, [existingSubjects]);
  
  // Fetch exam boards when component mounts
  useEffect(() => {
    const loadExamBoards = async () => {
      setIsLoadingBoards(true);
      try {
        const boards = await fetchExamBoards();
        dlog("[TopicCreationModal] Loaded exam boards from Knack:", boards);
        setAvailableExamBoards(boards);
      } catch (error) {
        derr("[TopicCreationModal] Error loading exam boards:", error);
        // Use fallback values on error
        setAvailableExamBoards(['AQA', 'Edexcel', 'OCR', 'WJEC', 'CCEA', 'SQA']);
      } finally {
        setIsLoadingBoards(false);
      }
    };
    
    loadExamBoards();
  }, []);
  
  // Fetch subjects when exam type and board change
  useEffect(() => {
    if (formData.examType && formData.examBoard) {
      // Skip API call if IB is selected - we'll use local data instead
      if (formData.examType === "IB") {
        // If IB Group is selected, populate subjects from that group
        if (formData.ibGroup) {
          const ibSubjects = getIBSubjects(formData.ibGroup);
          dlog(`[TopicCreationModal] Using IB subjects for group ${formData.ibGroup}:`, ibSubjects);
          setAvailableSubjects(ibSubjects);
        } else {
          // If no IB group is selected yet, show empty subjects list
          setAvailableSubjects([]);
        }
        return;
      }
      
      const loadSubjects = async () => {
        setIsLoadingSubjects(true);
        try {
          const subjects = await fetchSubjects(formData.examType, formData.examBoard);
          dlog(`[TopicCreationModal] Loaded ${subjects.length} subjects for ${formData.examType} ${formData.examBoard}`);
          
          if (subjects && subjects.length > 0) {
            setAvailableSubjects(subjects);
          } else {
            dlog("[TopicCreationModal] No subjects found in Knack, keeping existing subjects");
          }
        } catch (error) {
          derr("[TopicCreationModal] Error loading subjects:", error);
        } finally {
          setIsLoadingSubjects(false);
        }
      };
      
      loadSubjects();
    }
  }, [formData.examType, formData.examBoard, formData.ibGroup]);

  // Clear error when changing steps
  useEffect(() => {
    setError(null);
  }, [currentStep]);

  // Create refs to store the handlers and ensure they're always accessible
  const saveHandlerRef = useRef(onSaveTopicShells);
  const closeHandlerRef = useRef(onClose);

  // WebSocket message handler
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const data = JSON.parse(lastMessage.data);
      
      switch (data.type) {
        case 'status':
          if (data.action === 'generateTopics') {
            dlog("[TopicCreationModal] Progress update:", data);
            setProgress(data.progress || 0);
            setProgressMessage(data.message || "");
          }
          break;

        case 'topicResults':
          if (data.action === 'generateTopics' && Array.isArray(data.topics)) {
            dlog("[TopicCreationModal] Topic results received:", data);
            setGeneratedTopics(data.topics);
            setProgress(100);
            setProgressMessage("Topic generation complete!");
            setIsLoading(false);
            setTopicGenerationComplete(true);
            setPendingOperations(prev => ({ ...prev, generateTopics: false }));
          }
          break;

        case 'error':
          derr("[TopicCreationModal] Error from WebSocket:", data);
          setError(data.message || "An unknown error occurred during topic generation.");
          setIsLoading(false);
          setProgress(0);
          setProgressMessage("");
          setPendingOperations(prev => ({ ...prev, generateTopics: false }));
          break;

        default:
          dlog("[TopicCreationModal] Unhandled message type:", data.type);
      }
    } catch (error) {
      derr("[TopicCreationModal] Error parsing WebSocket message:", error);
    }
  }, [lastMessage]);

  // Add this useEffect to log and verify existingSubjects
  useEffect(() => {
    dlog("Existing subjects in modal:", existingSubjects);
  }, [existingSubjects]);

// Add this useEffect before the handleChange function
useEffect(() => {
  // Update refs to always point to the latest prop values
  saveHandlerRef.current = onSaveTopicShells;
  closeHandlerRef.current = onClose;
}, [onSaveTopicShells, onClose]);

  // Update handleChange to properly handle subject selection
  const handleChange = (e) => {
    const { name, value } = e.target;
    dlog("[TopicCreationModal] handleChange called with:", { name, value });
    
    if (name === 'subject-select') {
      if (value === '--addNew--') {
        setIsAddingNewSubject(true);
        setFormData(prev => ({ ...prev, subject: '' }));
      } else {
        setIsAddingNewSubject(false);
        setFormData(prev => ({ ...prev, subject: value }));
      }
    } else if (name === 'examType') {
      // Handle exam type change - set isIBSelected flag if IB is selected
      const isIB = value === 'IB';
      setIsIBSelected(isIB);
      
      // Clear exam board if switching to/from IB
      if (isIB) {
        setFormData(prev => ({ 
          ...prev, 
          examType: value,
          examBoard: 'IB', // Set default board for IB
          ibGroup: '',     // Reset IB group
          subject: ''      // Reset subject
        }));
      } else {
        setFormData(prev => ({ 
          ...prev, 
          examType: value,
          examBoard: '',  // Reset board for non-IB
          ibGroup: '',    // Reset IB group
          subject: ''     // Reset subject
        }));
      }
    } else if (name === 'ibGroup') {
      // Handle IB group selection
      setFormData(prev => ({ 
        ...prev, 
        ibGroup: value,
        subject: '' // Reset subject when group changes
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Reset generated topics if metadata changes before reaching TopicHub
    if (currentStep < 4 && (name === 'examType' || name === 'examBoard' || name === 'subject' || name === 'subject-select' || name === 'subject-new' || name === 'ibGroup')) {
        setGeneratedTopics([]);
        setTopicGenerationComplete(false);
    }
  };

  // Function to proceed to the next step
  const handleNext = () => {
    dlog(`[TopicCreationModal] handleNext called. Current step: ${currentStep}, Total steps: ${totalSteps}`);
    setError(null);

    // Validation checks
    if (currentStep === 1 && !formData.examType) {
      dlog("[TopicCreationModal] Validation failed: Exam Type missing.");
      setError("Please select an Exam Type.");
      return;
    }
    if (currentStep === 2) {
      if (!formData.examBoard) {
        dlog("[TopicCreationModal] Validation failed: Exam Board missing.");
        setError("Please select an Exam Board.");
        return;
      }
      // For IB, also check if subject group is selected
      if (isIBSelected && !formData.ibGroup) {
        dlog("[TopicCreationModal] Validation failed: IB Subject Group missing.");
        setError("Please select an IB Subject Group.");
        return;
      }
    }
    if (currentStep === 3 && !formData.subject) {
      dlog(`[TopicCreationModal] Validation failed: Subject missing or empty. Value: '${formData.subject}'`);
      setError("Please select or enter a Subject.");
      return;
    }
    dlog("[TopicCreationModal] Validation passed for step", currentStep);

    // Check if we can advance
    if (currentStep < totalSteps) {
      dlog(`[TopicCreationModal] Advancing from step ${currentStep} to ${currentStep + 1}`);
      setCurrentStep(currentStep + 1);
    } else {
      dlog("[TopicCreationModal] Already at the last step or beyond.");
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
    const { examType, examBoard, subject, ibGroup } = formData;

    if (!examType || !examBoard || !subject) {
      setError("Missing required fields: Exam Type, Exam Board, or Subject.");
      return;
    }
    if (!isConnected) {
      setError("WebSocket connection is not available. Cannot generate topics.");
      return;
    }
    if (isLoading || pendingOperations.generateTopics) {
      dlog("Topic generation already in progress or pending.");
      return;
    }

    dlog(`[TopicCreationModal] Triggering topic generation for ${subject}`);
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
          subject,
          ibGroup // Include IB group for IB subjects
        }
      }));
    } catch (error) {
      derr("[TopicCreationModal] Error sending WebSocket message:", error);
      setError("Failed to start topic generation. Please try again.");
      setIsLoading(false);
      setPendingOperations(prev => ({ ...prev, generateTopics: false }));
    }
  }, [formData, isConnected, isLoading, pendingOperations.generateTopics, sendMessage]);

// Function to handle the finalization and saving of topics from TopicHub - fixed for multi-subject support
const handleFinalizeAndSaveTopics = useCallback(async (topicShells) => {
  dlog(`[TopicCreationModal] Received ${topicShells.length} finalized topic shells from TopicHub.`);
  dlog(`[TopicCreationModal] Current formData state: ExamType='${formData.examType}', ExamBoard='${formData.examBoard}', Subject='${formData.subject}'`);

  if (!Array.isArray(topicShells) || topicShells.length === 0) {
    dwarn("[TopicCreationModal] No topic shells provided for finalization. Closing modal.");
    if (closeHandlerRef.current) closeHandlerRef.current();
    return;
  }

  // CRITICAL: Add lock check to prevent concurrent saves that could cause subject overwriting
  if (isLocked) {
    dwarn("[TopicCreationModal] Another save operation is in progress, please wait.");
    setError("Save in progress. Please wait a moment before trying again.");
    return;
  }

  // Set the lock to prevent concurrent save operations
  setIsLocked(true);
  dlog("[TopicCreationModal] Lock acquired for save operation");

  try {
    // Get current handlers from refs - always up to date
    const saveHandler = saveHandlerRef.current;
    const closeHandler = closeHandlerRef.current;

    // Extra verification logging
    if (!saveHandler) {
      derr("[TopicCreationModal] CRITICAL ERROR: onSaveTopicShells is null or undefined");
    } else if (typeof saveHandler !== 'function') {
      derr("[TopicCreationModal] CRITICAL ERROR: onSaveTopicShells is not a function, type:", typeof saveHandler);
    } else {
      dlog("[TopicCreationModal] onSaveTopicShells verification passed - it's a function");
    }

    // Ensure shells have the necessary metadata before saving
    const shellsToSave = topicShells.map(shell => {
      // Generate a truly unique ID that includes timestamp, randomness, and subject name
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000000); // Larger random range
      // Include subject in the ID to ensure uniqueness across subjects
      const uniqueId = shell.id || `topic_${formData.subject.replace(/\s+/g, '_')}_${timestamp}_${randomSuffix}`;
      
      return {
        ...shell, // Include name, color, etc. from TopicHub selection
        id: uniqueId, // Ensure unique ID across subjects
        examType: formData.examType,
        examBoard: formData.examBoard,
        subject: formData.subject,
        type: 'topic', // Ensure type is set correctly
        isShell: true, // Mark as a shell
        timestamp: new Date().toISOString(), // Add creation timestamp
        ...(formData.ibGroup ? { ibGroup: formData.ibGroup } : {}) // Add IB group if applicable
      };
    });

    dlog("[TopicCreationModal] Prepared shellsToSave:", shellsToSave);

    try {
      // Final verification before calling save handler
      if (!saveHandler || typeof saveHandler !== 'function') {
        derr("[TopicCreationModal] Cannot save - save handler is missing or not a function");
        
        // FALLBACK: If normal prop is missing, try custom event as backup
        dwarn("[TopicCreationModal] Save handler missing - attempting event fallback");
        try {
          const event = new CustomEvent('saveTopicShells', {
            detail: { shells: shellsToSave }
          });
          window.dispatchEvent(event);
          dlog("[TopicCreationModal] Dispatched saveTopicShells event as fallback");
          
          // Close modal after event dispatch
          if (closeHandler && typeof closeHandler === 'function') {
            closeHandler();
          } else if (closeHandlerRef.current) {
            closeHandlerRef.current();
          }
          return;
        } catch (e) {
          derr("[TopicCreationModal] Fallback event dispatch failed:", e);
          setError("Cannot save topics - all save methods failed");
          return;
        }
      }

      // Main path: Use the saveHandler function
      dlog("[TopicCreationModal] Calling save handler with shells...");
      await saveHandler(shellsToSave);
      dlog("[TopicCreationModal] Topic shells passed to onSaveTopicShells handler.");
      
      // Close modal immediately after successful save
      if (closeHandler && typeof closeHandler === 'function') {
        closeHandler();
      } else {
        dwarn("[TopicCreationModal] Close handler is missing or not a function.");
      }
    } catch (error) {
      derr("[TopicCreationModal] Error saving topic shells:", error);
      setError(`Failed to save topic shells: ${error.message}`);
      
      // FALLBACK ON ERROR: Try event dispatch as a last resort
      try {
        dwarn("[TopicCreationModal] Save handler failed - attempting event fallback");
        const event = new CustomEvent('saveTopicShells', {
          detail: { shells: shellsToSave }
        });
        window.dispatchEvent(event);
        dlog("[TopicCreationModal] Dispatched saveTopicShells event as fallback after error");
      } catch (e) {
        derr("[TopicCreationModal] Fallback event dispatch failed:", e);
      }
    }
  } finally {
    // CRITICAL: Release the lock after a timeout to ensure any related save operations complete
    // This ensures the lock is always released, even if an error occurs
    setTimeout(() => {
      setIsLocked(false);
      dlog("[TopicCreationModal] Lock released after save operation");
    }, 3000); // 3 second timeout to ensure we don't block subsequent operations indefinitely
  }
}, [formData, isLocked]); // Add isLocked to dependencies

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
                disabled={isLoadingBoards}
              >
                <option value="">Select Type...</option>
                <option value="GCSE">GCSE</option>
                <option value="A-Level">A-Level</option>
                <option value="BTEC">BTEC / Vocational</option>
                <option value="IB">International Baccalaureate</option>
              </select>
              {isLoadingBoards && <div className="loading-indicator"><LoadingSpinner size="small" /></div>}
            </div>
          </div>
        );
      case 2: // Exam Board
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>
              {isIBSelected ? 'Select IB Subject Group' : 'Select Exam Board'}
            </h2>
            <div className="form-group">
              {isIBSelected ? (
                // Render IB Subject Groups selector
                <select
                  name="ibGroup"
                  value={formData.ibGroup}
                  onChange={handleChange}
                  required
                  className="form-control"
                  disabled={isLoadingSubjects}
                >
                  <option value="">Select IB Subject Group...</option>
                  {getIBSubjectGroups().map(group => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              ) : (
                // Render standard exam boards
                <select
                  name="examBoard"
                  value={formData.examBoard}
                  onChange={handleChange}
                  required
                  className="form-control"
                  disabled={isLoadingSubjects}
                >
                  <option value="">Select Board...</option>
                  {availableExamBoards.map(board => (
                    <option key={board} value={board}>
                      {board}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              )}
              {isLoadingSubjects && <div className="loading-indicator"><LoadingSpinner size="small" /></div>}
            </div>
          </div>
        );
      case 3: // Subject
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select or Create Subject</h2>
            <div className="form-group">
              {isLoadingSubjects ? (
                <div className="loading-container">
                  <LoadingSpinner />
                  <p>Loading subjects for {formData.examType} {isIBSelected ? formData.ibGroup : formData.examBoard}...</p>
                </div>
              ) : !isAddingNewSubject ? (
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
                    {availableSubjects.length > 0 ? (
                      availableSubjects.map((subject) => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))
                    ) : (
                      <option value="" disabled>
                        {isIBSelected 
                          ? `No subjects found for ${formData.ibGroup}` 
                          : `No subjects found for ${formData.examType} ${formData.examBoard}`}
                      </option>
                    )}
                    <option value="--addNew--">+ Add New Subject</option>
                  </select>
                  {availableSubjects.length === 0 && (
                    <div className="info-message" style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                      No subjects found in database. Add a new subject or try a different {isIBSelected ? 'subject group' : 'exam type/board'}.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label htmlFor="new-subject">New Subject Name:</label>
                  <input
                    type="text"
                    id="new-subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Enter new subject name"
                  />
                  <button
                    onClick={() => setIsAddingNewSubject(false)}
                    className="cancel-button"
                    style={{ marginTop: '10px' }}
                  >
                    Cancel
                  </button>
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
              ibGroup={formData.ibGroup} // Pass IB group if applicable
              generatedTopics={generatedTopics}
              isLoading={isLoading}
              error={error}
              progress={progress}
              progressMessage={progressMessage}
              triggerTopicGeneration={triggerTopicGeneration}
              onFinalizeTopics={handleFinalizeAndSaveTopics}
              // Don't pass onSaveTopicShells directly - it's causing problems with second subject
              // We'll use handleFinalizeAndSaveTopics instead which properly calls onSaveTopicShells
              topicGenerationComplete={topicGenerationComplete}
              maxTopicsGenerated={MAX_TOPICS_GENERATED}
              maxTopicsDisplayed={MAX_TOPICS_DISPLAYED}
              onClose={onClose}
              userId={userId}
              recordId={recordId}
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
                (currentStep === 2 && isIBSelected && !formData.ibGroup) ||
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
