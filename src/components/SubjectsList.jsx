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

  if (!subjects || subjects.length === 0) {
    return (
      <div className="subjects-list empty">
        <h3>No Subjects</h3>
        <p>Create a card to add a subject.</p>
      </div>
    );
  }

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
              All Subjects ({subjects.reduce((acc, subject) => acc + subject.count, 0)} cards)
            </button>
          </div>

          {/* List all subjects */}
          {subjects.map((subject) => (
            <div key={subject.name} className="subject-button-container">
              <button
                className={`subject-button ${activeSubject === subject.name ? "active" : ""}`}
                onClick={() => onSelectSubject(subject.name)}
                style={
                  subject.color
                    ? {
                        borderLeft: `4px solid ${subject.color}`,
                        backgroundColor: `${subject.color}15` // 15 is hex for 10% opacity
                      }
                    : {}
                }
              >
                <span>{subject.name}</span>
                <span>({subject.count} cards)</span>
              </button>
              
              <button
                className="edit-color-button"
                onClick={() => openColorEditor(subject.name)}
                title="Edit subject color"
              >
                🎨
              </button>
              
              <button
                className="refresh-color-button"
                onClick={() => onChangeSubjectColor(subject.name, null)}
                title="Reset to default color"
              >
                ↺
              </button>
            </div>
          ))}
        </div>
      </div>

      {colorEditorOpen && selectedSubject && (
        <ColorEditor
          subject={selectedSubject}
          subjectColor={subjects.find((s) => s.name === selectedSubject)?.color || null}
          onClose={closeColorEditor}
          onSelectColor={handleColorChange}
        />
      )}
    </>
  );
};

export default SubjectsList;
