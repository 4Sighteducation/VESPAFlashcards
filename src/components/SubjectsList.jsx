import React, { useState } from "react";
import "./SubjectsList.css";
import ColorEditor from "./ColorEditor";

const SubjectsList = ({ subjects, activeSubject, onSelectSubject, onChangeSubjectColor }) => {
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  const openColorEditor = (subject) => {
    setSelectedSubject(subject);
    setColorEditorOpen(true);
  };

  const closeColorEditor = () => {
    setColorEditorOpen(false);
  };

  const handleColorChange = (color, applyToAllTopics = false) => {
    if (selectedSubject) {
      onChangeSubjectColor(selectedSubject, color, applyToAllTopics);
    }
    closeColorEditor();
  };

  // Debug the subjects prop
  console.log("Subjects prop:", subjects);

  // Fix for missing subjects or wrong format
  const normalizedSubjects = Array.isArray(subjects) ? subjects : [];
  
  if (!normalizedSubjects || normalizedSubjects.length === 0) {
    return (
      <div className="subjects-list empty">
        <h3>No Subjects</h3>
        <p>Create a card to add a subject.</p>
      </div>
    );
  }

  // Get the total card count for All Subjects
  const totalCardCount = normalizedSubjects.reduce((acc, subject) => {
    return acc + (typeof subject === 'object' && subject.count ? subject.count : 0);
  }, 0);

  // Helper function to determine if a background color is dark (for contrast)
  const isDarkColor = (hexColor) => {
    if (!hexColor) return true; // Default to dark if no color
    
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // Calculate brightness using YIQ formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return true for dark backgrounds
    return brightness < 140; // Higher threshold to ensure proper contrast
  };

  // Function to apply color with the right transparency for readability
  const getBackgroundWithOpacity = (color) => {
    // Convert hex to RGB
    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);
    
    // Return rgba color with appropriate opacity
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  };

  return (
    <>
      <div className="subjects-list">
        <h3>Subjects</h3>
        <div className="subjects-container">
          {/* "All Subjects" option */}
          <div className="subject-button-container">
            <button
              className={`subject-button ${activeSubject === null ? "active" : ""}`}
              onClick={() => onSelectSubject(null)}
            >
              <span>All Subjects</span>
              <span>({totalCardCount} cards)</span>
            </button>
          </div>

          {/* List all subjects */}
          {normalizedSubjects.map((subject, index) => {
            // Handle both object and string formats
            const subjectName = typeof subject === 'object' && subject.name ? subject.name : 
                               typeof subject === 'string' ? subject : `Subject ${index+1}`;
            const subjectCount = typeof subject === 'object' && subject.count ? subject.count : 0;
            const subjectColor = typeof subject === 'object' && subject.color ? subject.color : "#06206e";
            
            console.log(`Subject ${subjectName}:`, { color: subjectColor, count: subjectCount });
            
            // Determine text color based on background
            const textColor = isDarkColor(subjectColor) ? "#ffffff" : "#333333";
            
            return (
              <div key={subjectName} className="subject-button-container" 
                   style={{ backgroundColor: activeSubject === subjectName ? subjectColor : 'transparent' }}>
                <button
                  className={`subject-button ${activeSubject === subjectName ? "active" : ""}`}
                  onClick={() => onSelectSubject(subjectName)}
                  style={{
                    backgroundColor: subjectColor, /* Always use the full subject color */
                    color: textColor, /* Use contrasting text color */
                    boxShadow: activeSubject === subjectName ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none'
                  }}
                >
                  <span>{subjectName}</span>
                  <span style={{ color: textColor, opacity: 0.8 }}>
                    ({subjectCount} cards)
                  </span>
                </button>
                
                <button
                  className="edit-color-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openColorEditor(subjectName);
                  }}
                  title="Edit subject color"
                >
                  <span role="img" aria-label="Edit color">🎨</span>
                </button>
                
                <button
                  className="refresh-color-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Pass true as the second parameter to refresh colors for all topics
                    onChangeSubjectColor(subjectName, null, true);
                  }}
                  title="Reset to default color"
                >
                  <span role="img" aria-label="Reset color">↺</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {colorEditorOpen && selectedSubject && (
        <ColorEditor
          subject={selectedSubject}
          subjectColor={normalizedSubjects.find((s) => {
            const name = typeof s === 'object' && s.name ? s.name : s;
            return name === selectedSubject;
          })?.color || "#06206e"}
          onClose={closeColorEditor}
          onSelectColor={handleColorChange}
        />
      )}
    </>
  );
};

export default SubjectsList;
