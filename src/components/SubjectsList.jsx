import React, { useState, useRef, useEffect } from "react";
import "./SubjectsList.css";
import ColorEditor from "./ColorEditor";

const SubjectsList = ({ 
  subjects, 
  activeSubject, 
  onSelectSubject, 
  onChangeSubjectColor,
  onViewTopicList 
}) => {
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const subjectsListRef = useRef(null);
  const lastSelectedSubjectRef = useRef(null);

  // This effect will handle scrolling when a subject is selected
  useEffect(() => {
    // Only auto-scroll on mobile devices
    if (window.innerWidth <= 768 && lastSelectedSubjectRef.current) {
      // Get the element and scroll it into view
      const element = lastSelectedSubjectRef.current;
      
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        // Scroll the element into view with smooth behavior
        const yOffset = -20; // Add some offset at the top
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        
        window.scrollTo({
          top: y,
          behavior: 'smooth'
        });
      });
      
      // Clear the ref after scrolling
      lastSelectedSubjectRef.current = null;
    }
  }, [activeSubject]);

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

  const handleSelectSubject = (subject) => {
    onSelectSubject(subject);
    
    // Set the ref for scrolling on mobile
    if (window.innerWidth <= 768) {
      // Find the element that was just selected
      const elements = document.querySelectorAll('.subject-button-container');
      for (let i = 0; i < elements.length; i++) {
        const button = elements[i].querySelector('.subject-button');
        if (button && button.textContent.includes(subject || 'All Subjects')) {
          lastSelectedSubjectRef.current = elements[i];
          break;
        }
      }
    }
  };

  // Helper function to determine if a color is dark
  const isDarkColor = (hexColor) => {
    // Remove # if present
    if (hexColor.startsWith('#')) {
      hexColor = hexColor.slice(1);
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return true for dark colors
    return luminance < 0.5;
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

  return (
    <>
      <div className="subjects-list" ref={subjectsListRef}>
        <h3>Subjects</h3>
        <div className="subjects-container">
          {/* "All Subjects" option */}
          <div className="subject-button-container">
            <button
              className={`subject-button ${activeSubject === null ? "active" : ""}`}
              onClick={() => handleSelectSubject(null)}
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
                  onClick={() => handleSelectSubject(subjectName)}
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
                
                <div className="subject-actions">
                  <button
                    className="view-topics-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewTopicList && onViewTopicList(subjectName);
                    }}
                    title="View Topic List"
                  >
                    <span role="img" aria-label="View Topics">🗃️</span>
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
                </div>
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
