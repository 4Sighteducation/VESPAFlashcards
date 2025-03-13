import React, { useState } from "react";
import "./SubjectsList.css";

const SubjectsList = ({
  subjects,
  selectedSubject,
  onSelectSubject,
  getColorForSubject,
  updateColorMapping,
  refreshSubjectAndTopicColors
}) => {
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [selectedColor, setSelectedColor] = useState("");
  const [applyToAllTopics, setApplyToAllTopics] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  
  const brightColors = [
    "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231", 
    "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe", 
    "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000", 
    "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
    "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C",
  ];
  
  const handleColorEditClick = (subject) => {
    setEditingSubject(subject);
    setSelectedColor(getColorForSubject(subject));
    setShowColorEditor(true);
  };
  
  const applyColorChange = () => {
    if (editingSubject && selectedColor) {
      console.log(`Updating color for subject ${editingSubject} to ${selectedColor}`);
      
      if (applyToAllTopics) {
        // Show the confirmation modal instead of directly refreshing
        setShowRefreshModal(true);
      } else {
        // Only update the subject's base color
        updateColorMapping(editingSubject, null, selectedColor, false);
        setShowColorEditor(false);
      }
    }
  };
  
  const confirmRefreshColors = () => {
    // User confirmed, now apply the refresh
    refreshSubjectAndTopicColors(editingSubject, selectedColor);
    setShowRefreshModal(false);
    setShowColorEditor(false);
  };
  
  const getContrastColor = (hexColor) => {
    if (!hexColor) return "#000000";
    
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // Calculate brightness using YIQ formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return white for dark backgrounds, black for light backgrounds
    return brightness > 120 ? '#000000' : '#ffffff';
  };

  // Render the refresh color confirmation modal
  const renderRefreshColorModal = () => {
    if (!showRefreshModal) return null;
    
    return (
      <div className="modal-overlay" onClick={() => setShowRefreshModal(false)}>
        <div className="modal-content color-refresh-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Refresh Topic Colors</h3>
          <p>This will update all topic and card colors for "{editingSubject}" to different shades of the selected color.</p>
          
          <div className="color-preview" style={{ backgroundColor: selectedColor }}>
            <span style={{ color: getContrastColor(selectedColor) }}>Preview</span>
          </div>
          
          <div className="modal-actions">
            <button 
              className="secondary-button" 
              onClick={() => setShowRefreshModal(false)}
            >
              Cancel
            </button>
            <button 
              className="primary-button" 
              onClick={confirmRefreshColors}
            >
              Apply Colors
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (subjects.length === 0) {
    return (
      <div className="subjects-list empty">
        <h3>No Subjects</h3>
        <p>Create cards to see subjects here</p>
      </div>
    );
  }

  return (
    <div className="subjects-list">
      {renderRefreshColorModal()}
      
      <h3>Subjects</h3>
      <div className="subjects-container">
        <button
          className={`subject-button ${
            selectedSubject === null ? "active" : ""
          }`}
          onClick={() => onSelectSubject(null)}
        >
          All Subjects
        </button>

        {subjects.map((subject) => (
          <div key={subject} className="subject-button-container">
            <button
              className={`subject-button ${
                selectedSubject === subject ? "active" : ""
              }`}
              style={{
                backgroundColor: getColorForSubject(subject),
                color: getContrastColor(getColorForSubject(subject)),
              }}
              onClick={() => onSelectSubject(subject)}
            >
              {subject}
            </button>
            <button 
              className="edit-color-button"
              onClick={(e) => {
                e.stopPropagation();
                handleColorEditClick(subject);
              }}
              title="Edit subject color"
            >
              <span>🎨</span>
            </button>
            <button 
              className="refresh-color-button"
              onClick={(e) => {
                e.stopPropagation();
                // Set up the modal for direct refresh
                setEditingSubject(subject);
                setSelectedColor(getColorForSubject(subject));
                setShowRefreshModal(true);
              }}
              title="Refresh all topic colors based on this subject's color"
            >
              <span>↻</span>
            </button>
          </div>
        ))}
      </div>
      
      {showColorEditor && (
        <div className="color-editor-overlay">
          <div className="color-editor-panel">
            <h4>Edit Color for "{editingSubject}"</h4>
            
            <div className="color-grid">
              {brightColors.map((color) => (
                <div
                  key={color}
                  className={`color-swatch ${color === selectedColor ? "selected" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
            
            <div className="color-apply-options">
              <label className="checkbox-container">
                <input 
                  type="checkbox" 
                  checked={applyToAllTopics}
                  onChange={(e) => setApplyToAllTopics(e.target.checked)}
                />
                <span className="checkmark"></span>
                Apply to all topics in this subject
              </label>
              <p className="color-info">
                {applyToAllTopics ? 
                  "This will update all topic and card colors to different shades of the selected color." :
                  "Only the subject color will be changed. Topic colors will remain the same."}
              </p>
            </div>
            
            <div className="color-editor-actions">
              <button onClick={() => setShowColorEditor(false)}>Cancel</button>
              <button className="primary-button" onClick={applyColorChange}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectsList;
