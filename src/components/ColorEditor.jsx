import React, { useState } from "react";
import "./SubjectsList.css"; // We'll use the styles already defined in SubjectsList.css

const ColorEditor = ({ subject, subjectColor, onClose, onSelectColor }) => {
  const [selectedColor, setSelectedColor] = useState(subjectColor || "#e0e0e0");
  const [applyToAllTopics, setApplyToAllTopics] = useState(false);

  // Define a palette of bright, distinguishable colors
  const brightColors = [
    "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231", 
    "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe", 
    "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000", 
    "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
    "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C",
  ];

  // Function to determine if text should be black or white based on background
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

  const handleApplyColor = () => {
    onSelectColor(selectedColor, applyToAllTopics);
  };

  return (
    <div className="color-editor-overlay" onClick={onClose}>
      <div className="color-editor-panel" onClick={(e) => e.stopPropagation()}>
        <h4>Edit Color for "{subject}"</h4>
        
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
            Apply to all topics in this subject
          </label>
          <p className="color-info">
            {applyToAllTopics ? 
              "This will update all topic and card colors to different shades of the selected color." :
              "Only the subject color will be changed. Topic colors will remain the same."}
          </p>
        </div>
        
        <div className="color-editor-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={handleApplyColor}>Apply</button>
        </div>
      </div>
    </div>
  );
};

export default ColorEditor; 