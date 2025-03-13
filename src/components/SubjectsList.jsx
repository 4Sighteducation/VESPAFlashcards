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

  const handleColorChange = (color) => {
    if (selectedSubject) {
      onChangeSubjectColor(selectedSubject, color);
    }
    closeColorEditor();
  };

  // Fix for missing subjects or wrong format
  const normalizedSubjects = Array.isArray(subjects) ? subjects : [];
  
  // Debug the subjects prop
  console.log("Subjects prop:", subjects);

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
    return acc + (typeof subject.count === 'number' ? subject.count : 0);
  }, 0);

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
          {normalizedSubjects.map((subject) => {
            // Handle both object and string formats
            const subjectName = typeof subject === 'object' ? subject.name : subject;
            const subjectCount = typeof subject === 'object' ? subject.count : 0;
            const subjectColor = typeof subject === 'object' ? subject.color : null;
            
            return (
              <div key={subjectName} className="subject-button-container">
                <button
                  className={`subject-button ${activeSubject === subjectName ? "active" : ""}`}
                  onClick={() => onSelectSubject(subjectName)}
                  style={
                    subjectColor
                      ? {
                          borderLeft: `4px solid ${subjectColor}`,
                          backgroundColor: `${subjectColor}15` // 15 is hex for 10% opacity
                        }
                      : {}
                  }
                >
                  <span>{subjectName}</span>
                  <span>({subjectCount} cards)</span>
                </button>
                
                <button
                  className="edit-color-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openColorEditor(subjectName);
                  }}
                  title="Edit subject color"
                >
                  🎨
                </button>
                
                <button
                  className="refresh-color-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeSubjectColor(subjectName, null);
                  }}
                  title="Reset to default color"
                >
                  ↺
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
            const name = typeof s === 'object' ? s.name : s;
            return name === selectedSubject;
          })?.color || null}
          onClose={closeColorEditor}
          onSelectColor={handleColorChange}
        />
      )}
    </>
  );
};

export default SubjectsList;
