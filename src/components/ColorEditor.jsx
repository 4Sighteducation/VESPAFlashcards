import React, { useState } from "react";
import "./SubjectsList.css"; // We'll use the styles already defined in SubjectsList.css

const ColorEditor = ({ subject, subjectColor, onClose, onSelectColor }) => {
  const [selectedColor, setSelectedColor] = useState(subjectColor || "#e0e0e0");
  const [applyToAllTopics, setApplyToAllTopics] = useState(true);  // Default to true

  // Define a palette of bright, distinguishable colors matching AICardGenerator.jsx
  const brightColors = [
    // Blues
    "#5b9bd5", "#2e75b6", "#4472c4", "#4a86e8", "#6fa8dc", "#a4c2f4",
    // Greens
    "#70ad47", "#548235", "#a9d18e", "#a9d08e", "#c6e0b4", "#d9ead3",
    // Reds/Pinks
    "#c00000", "#e74c3c", "#ff9999", "#ea9999", "#f4cccc", "#f9cb9c",
    // Purples
    "#8e7cc3", "#674ea7", "#b4a7d6", "#d5a6bd", "#d9d2e9", "#ead1dc",
    // Yellows/Oranges
    "#f1c232", "#bf9000", "#ffd966", "#f6b26b", "#ffe599", "#fff2cc",
    // Browns/Neutrals
    "#a0522d", "#783f04", "#b45f06", "#8d6e63", "#a67c52", "#c9c9c9"
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
        
        <div className="color-preview" style={{ 
          backgroundColor: selectedColor,
          color: getContrastColor(selectedColor)
        }}>
          {subject}
        </div>
        
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