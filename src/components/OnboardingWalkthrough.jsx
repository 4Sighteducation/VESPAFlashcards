import React, { useState, useEffect } from 'react';
import './OnboardingWalkthrough.css';

const EXAM_TYPES = [
  { value: "GCSE", label: "GCSE" },
  { value: "A-Level", label: "A-Level" }
];

const EXAM_BOARDS = [
  { value: "AQA", label: "AQA" },
  { value: "Edexcel", label: "Edexcel" },
  { value: "OCR", label: "OCR" },
  { value: "WJEC", label: "WJEC" },
  { value: "CCEA", label: "CCEA" },
  { value: "International Baccalaureate", label: "IB" }
];

// Common subjects for each exam type
const COMMON_SUBJECTS = {
  "GCSE": [
    "Mathematics", "English Language", "English Literature", "Biology", 
    "Chemistry", "Physics", "Combined Science", "History", "Geography",
    "French", "Spanish", "German", "Computer Science", "Religious Studies",
    "Business Studies", "Art & Design"
  ],
  "A-Level": [
    "Mathematics", "Further Mathematics", "English Language", "English Literature",
    "Biology", "Chemistry", "Physics", "History", "Geography", "Psychology",
    "Sociology", "Economics", "Business Studies", "Computer Science",
    "French", "Spanish", "German", "Law", "Politics"
  ]
};

const OnboardingWalkthrough = ({ 
  isVisible, 
  onComplete,
  onSkip
}) => {
  const [step, setStep] = useState(1);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectExamBoards, setSubjectExamBoards] = useState({});
  const [commonSubjects, setCommonSubjects] = useState([]);
  const [customSubject, setCustomSubject] = useState('');
  
  // Update subject list when exam type changes
  useEffect(() => {
    if (selectedExamType && COMMON_SUBJECTS[selectedExamType]) {
      setCommonSubjects(COMMON_SUBJECTS[selectedExamType]);
    }
  }, [selectedExamType]);
  
  // Move to next step
  const nextStep = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      // Complete walkthrough and pass data
      onComplete({
        examType: selectedExamType,
        subjects: selectedSubjects,
        examBoards: subjectExamBoards
      });
    }
  };
  
  // Go back to previous step
  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // Skip the walkthrough
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };
  
  // Toggle subject selection
  const toggleSubject = (subject) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
      // Also remove from exam boards
      const newExamBoards = { ...subjectExamBoards };
      delete newExamBoards[subject];
      setSubjectExamBoards(newExamBoards);
    } else {
      if (selectedSubjects.length < 16) { // Max 16 subjects
        setSelectedSubjects([...selectedSubjects, subject]);
      }
    }
  };
  
  // Add custom subject
  const addCustomSubject = () => {
    if (customSubject.trim() && !selectedSubjects.includes(customSubject.trim())) {
      if (selectedSubjects.length < 16) {
        setSelectedSubjects([...selectedSubjects, customSubject.trim()]);
        setCustomSubject('');
      }
    }
  };
  
  // Handle exam board selection
  const handleExamBoardChange = (subject, board) => {
    setSubjectExamBoards({
      ...subjectExamBoards,
      [subject]: board
    });
  };
  
  // Check if ready to proceed to next step
  const canProceed = () => {
    switch (step) {
      case 1: 
        return selectedExamType !== '';
      case 2: 
        return selectedSubjects.length > 0;
      case 3: 
        return selectedSubjects.every(subject => subjectExamBoards[subject]);
      default: 
        return true;
    }
  };
  
  // If walkthrough is not visible, don't render anything
  if (!isVisible) return null;
  
  return (
    <div className="walkthrough-overlay">
      <div className="walkthrough-modal">
        <div className="walkthrough-header">
          <h2>Welcome to VESPA Flashcards! 🎉</h2>
          <button 
            className="skip-walkthrough-btn"
            onClick={handleSkip}
          >
            Skip
          </button>
        </div>
        
        <div className="walkthrough-progress">
          <div className="step-indicator">
            <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
            <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
            <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
            <div className={`step-line ${step >= 4 ? 'active' : ''}`}></div>
            <div className={`step ${step >= 4 ? 'active' : ''}`}>4</div>
          </div>
        </div>
        
        <div className="walkthrough-content">
          {step === 1 && (
            <div className="walkthrough-step">
              <h3>Let's get you set up!</h3>
              <p>First, what type of exams are you studying for?</p>
              
              <div className="exam-type-selection">
                {EXAM_TYPES.map(type => (
                  <div 
                    key={type.value}
                    className={`exam-type-option ${selectedExamType === type.value ? 'selected' : ''}`}
                    onClick={() => setSelectedExamType(type.value)}
                  >
                    <span className="exam-type-label">{type.label}</span>
                    {selectedExamType === type.value && <span className="check-mark">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {step === 2 && (
            <div className="walkthrough-step">
              <h3>Select your subjects</h3>
              <p>Choose the subjects you're studying (max 16)</p>
              
              <div className="subjects-selection">
                <div className="common-subjects">
                  {commonSubjects.map(subject => (
                    <div 
                      key={subject}
                      className={`subject-option ${selectedSubjects.includes(subject) ? 'selected' : ''}`}
                      onClick={() => toggleSubject(subject)}
                    >
                      <span className="subject-name">{subject}</span>
                      {selectedSubjects.includes(subject) && <span className="check-mark">✓</span>}
                    </div>
                  ))}
                </div>
                
                <div className="custom-subject-input">
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Add custom subject..."
                    onKeyPress={(e) => e.key === 'Enter' && addCustomSubject()}
                  />
                  <button 
                    onClick={addCustomSubject}
                    disabled={!customSubject.trim() || selectedSubjects.length >= 16}
                  >
                    Add
                  </button>
                </div>
                
                <div className="selected-subjects-display">
                  <p>Selected: {selectedSubjects.length}/16</p>
                  <div className="selected-subject-tags">
                    {selectedSubjects.map(subject => (
                      <div key={subject} className="selected-subject-tag">
                        {subject}
                        <button onClick={() => toggleSubject(subject)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {step === 3 && (
            <div className="walkthrough-step">
              <h3>Select exam boards for each subject</h3>
              <p>This helps us generate more accurate topic lists and flashcards</p>
              
              <div className="exam-board-selection">
                {selectedSubjects.map(subject => (
                  <div key={subject} className="subject-exam-board">
                    <label>{subject}</label>
                    <select
                      value={subjectExamBoards[subject] || ''}
                      onChange={(e) => handleExamBoardChange(subject, e.target.value)}
                    >
                      <option value="">Select exam board</option>
                      {EXAM_BOARDS.map(board => (
                        <option key={board.value} value={board.value}>
                          {board.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {step === 4 && (
            <div className="walkthrough-step final-step">
              <h3>You're all set! 🎓</h3>
              <p>We've created your subject folders based on your selections.</p>
              <p>Next steps:</p>
              <ul>
                <li>Click on the topic list button (📋) on any subject to manage your topics</li>
                <li>Generate AI flashcards for any topic</li>
                <li>Create your own flashcards manually</li>
                <li>Use spaced repetition to improve your learning</li>
              </ul>
              <p className="fun-message">Time to ace those exams! 🚀</p>
            </div>
          )}
        </div>
        
        <div className="walkthrough-actions">
          {step > 1 && (
            <button 
              className="prev-button"
              onClick={prevStep}
            >
              Back
            </button>
          )}
          
          <button 
            className="next-button"
            onClick={nextStep}
            disabled={!canProceed()}
          >
            {step < 4 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWalkthrough; 