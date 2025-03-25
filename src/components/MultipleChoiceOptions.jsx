import React, { useEffect, useState } from 'react';
import './Flashcard.css';

/**
 * Standalone component for rendering multiple choice options
 * This ensures consistent appearance across all views
 */
const MultipleChoiceOptions = ({ options, preview = false, isInModal = false, card }) => {
  const [optionsToDisplay, setOptionsToDisplay] = useState([]);
  
  // Attempt to initialize options from props or recover from card
  useEffect(() => {
    try {
      // First check if valid options were passed directly
      if (options && Array.isArray(options) && options.length > 0) {
        console.log("Using provided options:", options.length);
        setOptionsToDisplay(options);
        return;
      }
      
      // If not, try to recover from card if available
      if (card) {
        // Try savedOptions if options are missing
        if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
          console.log("Recovered options from savedOptions:", card.savedOptions.length);
          setOptionsToDisplay(card.savedOptions);
          return;
        }
        
        // Try card.options directly if not passed in props
        if (card.options && Array.isArray(card.options) && card.options.length > 0) {
          console.log("Recovered options from card.options:", card.options.length);
          setOptionsToDisplay(card.options);
          return;
        }
      }
      
      // Create default options if nothing is available
      if ((!optionsToDisplay || optionsToDisplay.length === 0) && card && card.questionType === 'multiple_choice') {
        console.warn("No options available for multiple choice card, creating defaults");
        const defaultOptions = [
          "Option A (placeholder)", 
          "Option B (placeholder)", 
          "Option C (placeholder)", 
          "Option D (placeholder)"
        ];
        setOptionsToDisplay(defaultOptions);
      }
    } catch (error) {
      console.error("Error processing options in MultipleChoiceOptions:", error);
      // Set fallback options in case of error
      setOptionsToDisplay(["Option A", "Option B", "Option C", "Option D"]);
    }
  }, [options, card]);

  // Clean option text by removing letter prefixes (a., a), etc.)
  const cleanOptionText = (option) => {
    if (!option) return '';
    // Match patterns like a), a., (a), a-, etc. at beginning of string
    const prefixRegex = /^([a-z][\.\)\-\:]|\([a-z]\))\s*/i;
    return option.replace(prefixRegex, '').trim();
  };

  // Render placeholder if no options available
  if (!optionsToDisplay || !Array.isArray(optionsToDisplay) || optionsToDisplay.length === 0) {
    return (
      <div className="options-container" style={{
        padding: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '5px',
        marginTop: '10px',
      }}>
        <div className="error-message" style={{textAlign: 'center', padding: '10px'}}>
          Multiple choice options unavailable
        </div>
      </div>
    );
  }
  
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
        {optionsToDisplay.map((option, index) => {
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