import React, { useState, useEffect } from "react";
import "./SubjectSelectionWizard.css";

// Constants for exam types and subjects
const EXAM_TYPES = [
  { value: "GCSE", label: "GCSE" },
  { value: "A-Level", label: "A-Level" },
  { value: "International Baccalaureate", label: "International Baccalaureate" },
  { value: "Advanced Placement", label: "Advanced Placement" },
  { value: "Scottish Higher", label: "Scottish Higher" },
  { value: "BTEC / Cambridge Nationals Level 2", label: "BTEC / Cambridge Nationals Level 2" },
  { value: "BTEC / Cambridge Nationals Level 3", label: "BTEC / Cambridge Nationals Level 3" }
];

const EXAM_BOARDS = [
  { value: "AQA", label: "AQA" },
  { value: "Edexcel", label: "Edexcel" },
  { value: "OCR", label: "OCR" },
  { value: "WJEC", label: "WJEC" },
  { value: "SQA", label: "SQA" },
  { value: "International Baccalaureate", label: "International Baccalaureate" },
  { value: "Cambridge International", label: "Cambridge International" }
];

// Hard-coded subjects by exam type
const SUBJECTS_BY_EXAM_TYPE = {
  "GCSE": [
    "English Language", "English Literature", "Mathematics", "Combined Science", "Double Award Science", "Triple Science",
    "Biology", "Chemistry", "Physics", "Environmental Science", "Religious Studies", "Citizenship", "Modern Studies",
    "History", "Geography", "French", "Spanish", "German", "Italian", "Mandarin Chinese", "Welsh", "Latin",
    "Ancient Greek", "Classical Civilisation", "Art and Design", "Photography", "Design and Technology",
    "Design and Technology - Product Design", "Design and Technology - Resistant Materials",
    "Design and Technology - Food Technology", "Design and Technology - Textiles", "Food Preparation and Nutrition",
    "Music", "Drama", "Dance", "Film Studies", "Computer Science", "Digital Technology", "ICT", "Business Studies",
    "Economics", "Sociology", "Psychology", "Media Studies", "Physical Education", "Health and Social Care",
    "Travel and Tourism", "Journalism", "Enterprise/Entrepreneurship", "Electronics", "General Studies", "Arabic"
  ],
  
  "A-Level": [
    "Mathematics", "Further Mathematics", "Statistics", "Physics", "Chemistry", "Biology", "Combined Science",
    "Combined Science - Double Award", "Combined Science - Triple Award", "Environmental Science", "Computer Science",
    "Electronics", "English Language", "English Literature", "History", "Geography", "Religious Studies / Theology",
    "Philosophy", "Classics", "Classics - Latin", "Classics - Ancient Greek", "Classics - Classical Civilisation",
    "Economics", "Business Studies", "Accounting", "Government and Politics / Politics", "Law", "Psychology",
    "Sociology", "Media Studies", "French", "Spanish", "German", "Italian", "Mandarin Chinese", "Arabic",
    "Japanese", "Russian", "Welsh", "Art and Design", "Design and Technology",
    "Design and Technology - Product Design", "Design and Technology - Textiles",
    "Design and Technology - Resistant Materials", "Design and Technology - Systems and Control",
    "Drama and Theatre Studies", "Film Studies", "Music", "Music Technology", "Dance", "Photography",
    "Fashion", "Physical Education (PE)", "Sport Science", "Health and Social Care"
  ],
  
  "International Baccalaureate": [
    "English A: Literature", "English A: Language and Literature", "Literature and Performance", 
    "Language B (French, Spanish, German, etc.)", "Language ab initio (French, Spanish, German, etc.)", 
    "Mathematics: Analysis and Approaches", "Mathematics: Applications and Interpretation", 
    "Biology", "Chemistry", "Physics", "Computer Science", "Design Technology", 
    "Sports, Exercise and Health Science", "Environmental Systems and Societies", 
    "History", "Geography", "Economics", "Global Politics", "Philosophy", 
    "Psychology", "Social and Cultural Anthropology", "World Religions", 
    "Visual Arts", "Music", "Theatre", "Dance", "Film", 
    "Theory of Knowledge", "Extended Essay", "Creativity, Activity, Service (CAS)", "Arabic"
  ],
  
  "Advanced Placement": [
    "Art History", "Music Theory", "Studio Art: 2-D Design", "Studio Art: 3-D Design", "Studio Art: Drawing", 
    "English Language and Composition", "English Literature and Composition", 
    "Comparative Government and Politics", "European History", "Human Geography", "Macroeconomics", "Microeconomics", 
    "Psychology", "United States Government and Politics", "United States History", "World History: Modern", 
    "Calculus AB", "Calculus BC", "Computer Science A", "Computer Science Principles", "Statistics", 
    "Biology", "Chemistry", "Environmental Science", "Physics 1: Algebra-Based", "Physics 2: Algebra-Based", 
    "Physics C: Electricity and Magnetism", "Physics C: Mechanics", 
    "Chinese Language and Culture", "French Language and Culture", "German Language and Culture", 
    "Italian Language and Culture", "Japanese Language and Culture", "Latin", "Spanish Language and Culture", 
    "Spanish Literature and Culture", "Arabic Language and Culture"
  ],
  
  "Scottish Higher": [
    "Accounting", "Administration and IT", "Biology", "Business Management", "Chemistry", 
    "Computing Science", "Dance", "Design and Manufacture", "Drama", "Economics", 
    "Engineering Science", "English", "Environmental Science", "Fashion and Textile Technology", 
    "French", "Gaelic (Learners)", "Gàidhlig", "Geography", "German", "Graphic Communication", 
    "Health and Food Technology", "History", "Human Biology", "Italian", "Latin", 
    "Mathematics", "Media", "Modern Studies", "Music", "Photography", 
    "Physical Education", "Physics", "Politics", "Practical Cookery", "Psychology", 
    "Religious, Moral and Philosophical Studies", "Sociology", "Spanish", "Arabic"
  ],
  
  "BTEC / Cambridge Nationals Level 3": [
    "Applied Law", "Applied Psychology", "Applied Science", "Art and Design", "Business", 
    "Childcare and Education", "Computing", "Construction and the Built Environment", 
    "Creative Digital Media Production", "Criminology", "Engineering", "Enterprise and Entrepreneurship", 
    "Esports", "Fashion Design and Production", "Financial Studies", "Forensic and Criminal Investigation", 
    "Health and Social Care", "Hospitality", "Information Technology", "Music", "Music Technology", 
    "Performing Arts", "Public Services", "Sport", "Sport and Exercise Science", 
    "Travel and Tourism", "Uniformed Protective Services", "Arabic"
  ],
  
  "BTEC / Cambridge Nationals Level 2": [
    "Applied Science", "Art and Design", "Business", "Child Development", "Creative iMedia", 
    "Construction", "Digital Technology", "Engineering", "Enterprise", "Health and Fitness", 
    "Health and Social Care", "Hospitality and Catering", "Information Technology", "Media Studies", 
    "Music", "Performing Arts", "Public Services", "Retail Business", "Sport", 
    "Sport Science", "Technical Award in IT", "Travel and Tourism", "Vehicle Technology", "Arabic"
  ]
};

// Color palette for subjects
const BRIGHT_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
  "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
  "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C"
];

const SubjectSelectionWizard = ({ onClose, onSaveSubjects }) => {
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(3);
  
  // Form data
  const [examType, setExamType] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectBoards, setSubjectBoards] = useState({});
  
  // Color mapping
  const [subjectColors, setSubjectColors] = useState({});
  
  // Helper function to generate a random color
  const getRandomColor = () => {
    const unusedColors = BRIGHT_COLORS.filter(color => 
      !Object.values(subjectColors).includes(color)
    );
    
    if (unusedColors.length > 0) {
      return unusedColors[Math.floor(Math.random() * unusedColors.length)];
    }
    
    // If all colors are used, return a random one from the full list
    return BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
  };
  
  // Check if we can proceed to the next step
  const canProceed = () => {
    switch (currentStep) {
      case 1: // Exam Type selection
        return examType !== "";
      case 2: // Subject selection
        return selectedSubjects.length > 0 && selectedSubjects.length <= 15;
      case 3: // Exam Board selection
        return Object.keys(subjectBoards).length === selectedSubjects.length;
      default:
        return false;
    }
  };
  
  // Handle next step
  const handleNextStep = () => {
    if (canProceed()) {
      if (currentStep === totalSteps) {
        // Final step - save and close
        handleSaveSubjects();
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };
  
  // Handle previous step
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose();
    }
  };
  
  // Handle exam type selection
  const handleExamTypeSelect = (type) => {
    setExamType(type);
    // Clear previously selected subjects when changing exam type
    setSelectedSubjects([]);
    setSubjectBoards({});
  };
  
  // Handle subject selection
  const handleSubjectSelect = (subject) => {
    if (selectedSubjects.includes(subject)) {
      // Remove subject
      setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
      
      // Remove its exam board and color
      const newSubjectBoards = { ...subjectBoards };
      delete newSubjectBoards[subject];
      setSubjectBoards(newSubjectBoards);
      
      const newSubjectColors = { ...subjectColors };
      delete newSubjectColors[subject];
      setSubjectColors(newSubjectColors);
    } else {
      // Add subject, but check if we're at the maximum
      if (selectedSubjects.length < 15) {
        setSelectedSubjects([...selectedSubjects, subject]);
        
        // Assign a random color to the new subject
        setSubjectColors({
          ...subjectColors,
          [subject]: getRandomColor()
        });
      }
    }
  };
  
  // Handle exam board selection for a subject
  const handleBoardSelect = (subject, board) => {
    setSubjectBoards({
      ...subjectBoards,
      [subject]: board
    });
  };
  
  // Save all subjects
  const handleSaveSubjects = () => {
    // Prepare the subjects data with all required info
    const subjectsData = selectedSubjects.map(subject => ({
      name: subject,
      examBoard: subjectBoards[subject] || "AQA",
      examType: examType,
      color: subjectColors[subject]
    }));
    
    // Call the parent component's save function
    onSaveSubjects(subjectsData);
    onClose();
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderExamTypeSelection();
      case 2:
        return renderSubjectSelection();
      case 3:
        return renderExamBoardSelection();
      default:
        return <div>Unknown step</div>;
    }
  };
  
  // Render exam type selection
  const renderExamTypeSelection = () => {
    return (
      <div className="wizard-step exam-type-selection">
        <h2>Select Your Exam Type</h2>
        <p>Choose the exam type you're preparing for:</p>
        
        <div className="exam-type-buttons">
          {EXAM_TYPES.map(type => (
            <button
              key={type.value}
              className={`exam-type-button ${examType === type.value ? 'selected' : ''}`}
              onClick={() => handleExamTypeSelect(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Render subject selection
  const renderSubjectSelection = () => {
    const subjects = examType ? SUBJECTS_BY_EXAM_TYPE[examType] || [] : [];
    
    return (
      <div className="wizard-step subject-selection">
        <h2>Select Your Subjects</h2>
        <p>Choose between 1 and 15 subjects:</p>
        
        <div className="subjects-counter">
          Selected: {selectedSubjects.length}/15
        </div>
        
        <div className="subject-buttons">
          {subjects.map(subject => (
            <button
              key={subject}
              className={`subject-button ${selectedSubjects.includes(subject) ? 'selected' : ''}`}
              onClick={() => handleSubjectSelect(subject)}
              style={{
                backgroundColor: selectedSubjects.includes(subject) ? subjectColors[subject] : '',
                color: selectedSubjects.includes(subject) ? (getContrastColor(subjectColors[subject])) : ''
              }}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Render exam board selection
  const renderExamBoardSelection = () => {
    return (
      <div className="wizard-step exam-board-selection">
        <h2>Assign Exam Boards</h2>
        <p>Select an exam board for each of your subjects:</p>
        
        <div className="subject-board-list">
          {selectedSubjects.map(subject => (
            <div 
              key={subject} 
              className="subject-board-item"
              style={{
                backgroundColor: subjectColors[subject],
                color: getContrastColor(subjectColors[subject])
              }}
            >
              <div className="subject-name">{subject}</div>
              <div className="board-selector">
                <select 
                  value={subjectBoards[subject] || ""}
                  onChange={(e) => handleBoardSelect(subject, e.target.value)}
                  style={{
                    backgroundColor: `${subjectColors[subject]}99`,
                    color: getContrastColor(subjectColors[subject])
                  }}
                >
                  <option value="">Select an exam board</option>
                  {EXAM_BOARDS.map(board => (
                    <option key={board.value} value={board.value}>
                      {board.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Helper function to get contrast color for text
  const getContrastColor = (hexColor) => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance using perceived brightness formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };
  
  return (
    <div className="subject-wizard-overlay">
      <div className="subject-wizard-content">
        <div className="wizard-header">
          <h1>VESPA Subject Setup Wizard</h1>
          <button 
            className="close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="progress-bar">
          <div className="progress-steps">
            {[...Array(totalSteps)].map((_, index) => (
              <div 
                key={index} 
                className={`progress-step ${currentStep > index ? 'completed' : ''} ${currentStep === index + 1 ? 'active' : ''}`}
              >
                {index + 1}
              </div>
            ))}
          </div>
          <div className="progress-track">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
            ></div>
          </div>
        </div>
        
        <div className="wizard-body">
          {renderStepContent()}
        </div>
        
        <div className="wizard-footer">
          <button 
            className="prev-button"
            onClick={handlePrevStep}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>
          
          <button 
            className="next-button"
            onClick={handleNextStep}
            disabled={!canProceed()}
          >
            {currentStep === totalSteps ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubjectSelectionWizard; 