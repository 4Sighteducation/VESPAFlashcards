import React from 'react';
import './Flashcard.css';

/**
 * Standalone component for rendering multiple choice options
 * This ensures consistent appearance across all views
 */
const MultipleChoiceOptions = ({ options, preview = false, isInModal = false }) => {
  // Skip rendering if no options
  if (!options || !Array.isArray(options) || options.length === 0) {
    console.warn("No options provided to MultipleChoiceOptions");
    return null;
  }

  // Clean option text by removing letter prefixes (a., a), etc.)
  const cleanOptionText = (option) => {
    if (!option) return '';
    // Match patterns like a), a., (a), a-, etc. at beginning of string
    const prefixRegex = /^([a-z][\.\)\-\:]|\([a-z]\))\s*/i;
    return option.replace(prefixRegex, '').trim();
  };

  console.log("Rendering options in dedicated component:", options);
  
  // Create option elements with explicit lettering (a, b, c, d, etc.)
  return (
    <div className="options-container" style={{
      display: 'block',
      visibility: 'visible',
      marginTop: '10px',
      padding: '8px',
      borderRadius: '5px',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      width: '100%',
      position: 'relative'
    }}>
      <ol className="multiple-choice-options" style={{
        listStyleType: 'none',
        padding: '0 0 0 5px',
        margin: '0',
        display: 'block'
      }}>
        {options.map((option, index) => {
          if (!option) return null;
          const letter = String.fromCharCode(97 + index); // a, b, c, d, etc.
          const cleanedText = cleanOptionText(option);
          
          return (
            <li key={index} className="option-item" style={{
              display: 'flex',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              padding: '8px 10px',
              marginBottom: '8px',
              borderRadius: '4px',
              position: 'relative'
            }}>
              <span className="option-letter" style={{
                fontWeight: 'bold',
                marginRight: '6px',
                minWidth: '15px'
              }}>{letter})</span>
              <span className="option-text" style={{
                flex: '1'
              }}>{cleanedText}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default MultipleChoiceOptions; 