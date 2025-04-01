import React, { useEffect, useState } from 'react';
import './Flashcard.css';

/**
 * Enhanced MultipleChoiceOptions component
 * - Better integration with unified data model
 * - Improved recovery from missing options
 * - Better error handling and fallbacks
 */
const MultipleChoiceOptions = ({ options, preview = false, isInModal = false, card }) => {
  const [optionsToDisplay, setOptionsToDisplay] = useState([]);
  const [error, setError] = useState(null);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      setError(null);
      
      // First check if valid options were passed directly
      if (options && Array.isArray(options) && options.length > 0) {
        console.log("MultipleChoiceOptions: Using provided options array:", options.length);
        setOptionsToDisplay(options);
        return;
      }
      
      // If not, try to recover from card if available
      if (card) {
        // Try savedOptions if options are missing
        if (card.savedOptions && Array.isArray(card.savedOptions) && card.savedOptions.length > 0) {
          console.log("MultipleChoiceOptions: Recovered options from savedOptions:", card.savedOptions.length);
          setOptionsToDisplay(card.savedOptions);
          return;
        }
        
        // Try card.options directly if not passed in props
        if (card.options && Array.isArray(card.options) && card.options.length > 0) {
          console.log("MultipleChoiceOptions: Using card.options directly:", card.options.length);
          setOptionsToDisplay(card.options);
          return;
        }
        
        // Try to generate options from correctAnswer if available
        if (card.correctAnswer && typeof card.correctAnswer === 'string') {
          console.log("MultipleChoiceOptions: Generating options from correctAnswer");
          const correctAnswer = card.correctAnswer.replace(/^[a-d]\)\s*/i, '').trim();
          
          const generatedOptions = [
            correctAnswer,
            "Alternative answer 1",
            "Alternative answer 2",
            "Alternative answer 3"
          ];
          
          setOptionsToDisplay(generatedOptions);
          
          // Store these for future use
          if (card.onUpdateOptions) {
            card.onUpdateOptions(generatedOptions);
          }
          
          return;
        }
        
        // If answer has "Correct Answer:" format, extract it
        if (card.answer && typeof card.answer === 'string' && 
            card.answer.includes("Correct Answer:")) {
          console.log("MultipleChoiceOptions: Extracting options from answer format");
          const match = card.answer.match(/Correct Answer:\s*([^\n]+)/);
          if (match && match[1]) {
            const correctAnswer = match[1].trim();
            
            const generatedOptions = [
              correctAnswer,
              "Alternative answer 1",
              "Alternative answer 2",
              "Alternative answer 3"
            ];
            
            setOptionsToDisplay(generatedOptions);
            
            // Store these for future use
            if (card.onUpdateOptions) {
              card.onUpdateOptions(generatedOptions);
            }
            
            return;
          }
        }
      }
      
      // Create default options if nothing is available
      if ((!optionsToDisplay || optionsToDisplay.length === 0) && 
          card && (card.questionType === 'multiple_choice' || 
                  (card.answer && card.answer.startsWith("Correct Answer:")))) {
        console.warn("MultipleChoiceOptions: No options available, creating defaults");
        const defaultOptions = [
          "Option A (placeholder)", 
          "Option B (placeholder)", 
          "Option C (placeholder)", 
          "Option D (placeholder)"
        ];
        setOptionsToDisplay(defaultOptions);
        
        // Store these for future use
        if (card.onUpdateOptions) {
          card.onUpdateOptions(defaultOptions);
        }
      }
    } catch (error) {
      console.error("Error processing options in MultipleChoiceOptions:", error);
      setError(error.message || "Error processing options");
      
      // Set fallback options in case of error
      setOptionsToDisplay(["Option A", "Option B", "Option C", "Option D"]);
    }
  }, [options, card, optionsToDisplay.length]);

  // Clean option text by removing letter prefixes (a.), a), etc.)
  const cleanOptionText = (option) => {
    if (!option) return '';
    
    // Guard against non-string options
    if (typeof option !== 'string') {
      // If option is an object with a text property, use that
      if (option && typeof option === 'object' && typeof option.text === 'string') {
        option = option.text;
      } else {
        // Otherwise convert to string or return empty string
        try {
          option = String(option);
        } catch (e) {
          console.warn('Failed to convert option to string:', option);
          return '';
        }
      }
    }
    
    // Match patterns like a), a., (a), a-, etc. at beginning of string
    const prefixRegex = /^([a-z][.)\-:]|\([a-z]\))\s*/i;
    return option.replace(prefixRegex, '').trim();
  };

  // Render error message if there was a problem
  if (error) {
    return (
      <div className="options-container" style={{
        padding: '12px',
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        borderRadius: '5px',
        marginTop: '10px',
      }}>
        <div className="error-message" style={{textAlign: 'center', padding: '10px', color: 'red'}}>
          Error loading options: {error}
        </div>
      </div>
    );
  }

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
          
          // Validate option type before processing
          let displayOption = option;
          if (typeof displayOption !== 'string') {
            // If option is an object with a text property, use that
            if (displayOption && typeof displayOption === 'object' && typeof displayOption.text === 'string') {
              displayOption = displayOption.text;
            } else {
              // Otherwise convert to string or use placeholder
              try {
                displayOption = String(displayOption);
              } catch (e) {
                console.warn('Failed to convert option to string:', displayOption);
                displayOption = `Option ${String.fromCharCode(97 + index)}`;
              }
            }
          }
          
          const letter = String.fromCharCode(97 + index); // a, b, c, d, etc.
          const cleanedText = cleanOptionText(displayOption);
          
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