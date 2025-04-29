import React, { useState, useEffect } from 'react';
import { getContrastColor } from '../utils/ColorUtils';
import './Flashcard.css'; // Reuse existing CSS

const FlippableCard = ({ 
  card, 
  isFlipped, 
  onFlip, 
  onAnswer, 
  showControls = false,
  isInModal = true 
}) => {
  // Use parent-controlled flipped state if provided, otherwise internal state
  const [internalFlipped, setInternalFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  
  // Determine if we're using internal or external flip state
  const flipped = isFlipped !== undefined ? isFlipped : internalFlipped;
  
  // Get the card color with fallbacks
  const cardColor = card?.cardColor || card?.topicColor || card?.subjectColor || '#3cb44b';
  
  // Get contrast color for text based on background
  const textColor = card?.textColor || getContrastColor(cardColor);
  
  // Handle flip
  const handleFlip = () => {
    if (onFlip) {
      onFlip(!flipped);
    } else {
      setInternalFlipped(!internalFlipped);
    }
  };
  
  // Reset answer state when card changes
  useEffect(() => {
    setSelectedOption(null);
    setShowAnswer(false);
  }, [card?.id]);
  
  // Handle option selection for multiple choice
  const handleOptionSelect = (index, e) => {
    e.stopPropagation(); // Prevent card flip
    
    if (!showAnswer) {
      setSelectedOption(index);
      
      // Show the answer after a slight delay
      setTimeout(() => {
        setShowAnswer(true);
        
        // Call the onAnswer callback if provided
        if (onAnswer && card?.options) {
          const isCorrect = index === getCorrectAnswerIndex();
          onAnswer(isCorrect, index);
        }
      }, 300);
    }
  };
  
  // Find correct answer index for multiple choice cards
  const getCorrectAnswerIndex = () => {
    if (!card || !card.questionType || card.questionType !== 'multiple_choice' || !card.options) {
      return -1;
    }
    
    // Try to find correct answer based on multiple matching strategies
    
    // Strategy 1: Use the correctAnswer field directly if it exists
    if (card.correctAnswer) {
      // Handle if correctAnswer is a full option text
      const correctAnswerText = card.correctAnswer.replace(/^[a-d]\)\s*/i, '').trim();
      return card.options.findIndex(option => {
        const optionText = typeof option === 'string' 
          ? option.replace(/^[a-d]\)\s*/i, '').trim() 
          : (option?.text || '').replace(/^[a-d]\)\s*/i, '').trim();
        return optionText === correctAnswerText;
      });
    }
    
    // Strategy 2: Look for option with isCorrect flag
    const correctOptionIndex = card.options.findIndex(option => 
      option && typeof option === 'object' && option.isCorrect === true
    );
    if (correctOptionIndex >= 0) return correctOptionIndex;
    
    // Strategy 3: Parse the back text if it contains "Correct Answer: [letter])"
    if (typeof card.back === 'string') {
      const correctAnswerMatch = card.back.match(/Correct Answer:\s*([a-d])\)/i);
      if (correctAnswerMatch) {
        const letter = correctAnswerMatch[1].toLowerCase();
        return letter.charCodeAt(0) - 97; // 'a' => 0, 'b' => 1, etc.
      }
    }
    
    // Default to first option if no correct answer found
    return 0;
  };
  
  // Get front content based on card type
  const renderFront = () => {
    if (!card) return <div>No card data</div>;
    
    const question = card.front || card.question || '';
    const isMultipleChoice = Array.isArray(card.options) && card.options.length > 0;
    const correctAnswerIndex = getCorrectAnswerIndex();
    
    return (
      <div className="flashcard-front" style={{ color: textColor, backgroundColor: cardColor }}>
        {card.topic && (
          <div className="card-topic-indicator" style={{ color: textColor }}>
            {card.topic}
          </div>
        )}
        
        <div className="question-title">
          {typeof question === 'string' ? (
            <div dangerouslySetInnerHTML={{ __html: question || "No question available" }} />
          ) : (
            <div>No question available</div>
          )}
        </div>
        
        {isMultipleChoice && (
          <div className="options-container">
            <ol>
              {card.options.map((option, index) => {
                const optionText = typeof option === 'string' ? option : option?.text || '';
                // Determine option class based on selection state and correct answer
                const optionClass = `
                  option-item
                  ${selectedOption === index ? 'selected-option' : ''}
                  ${showAnswer && index === correctAnswerIndex ? 'correct-option' : ''}
                  ${showAnswer && selectedOption === index && index !== correctAnswerIndex ? 'incorrect-option' : ''}
                `;
                
                return (
                  <li 
                    key={index} 
                    className={optionClass}
                    onClick={(e) => handleOptionSelect(index, e)}
                  >
                    <span className="option-letter">{String.fromCharCode(97 + index)})</span>
                    <span className="option-text">{optionText}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        
        {showAnswer && (
          <div className="answer-feedback">
            {selectedOption === correctAnswerIndex ? (
              <div className="correct-feedback">Correct!</div>
            ) : (
              <div className="incorrect-feedback">
                Incorrect. The correct answer is {String.fromCharCode(97 + correctAnswerIndex)}.
              </div>
            )}
          </div>
        )}
        
        {card.boxNum !== undefined && (
          <div className="box-indicator">
            Box {card.boxNum}
          </div>
        )}
      </div>
    );
  };
  
  // Get back content
  const renderBack = () => {
    if (!card) return <div>No card data</div>;
    
    return (
      <div className="flashcard-back" style={{ backgroundColor: '#ffffff' }}>
        {card.topic && (
          <div className="card-topic-indicator back-topic">
            {card.topic}
          </div>
        )}
        
        <div className="card-content-area">
          {card.questionType === 'multiple_choice' ? (
            <div>
              <strong>Correct Answer:</strong><br />
              {card.correctAnswer || "Not specified"}
            </div>
          ) : (
            typeof card.back === 'string' ? (
              <div dangerouslySetInnerHTML={{ __html: card.back || "No answer available" }} />
            ) : (
              <div>No answer available</div>
            )
          )}
        </div>
        
        {card.boxNum !== undefined && (
          <div className="box-indicator">
            Box {card.boxNum}
          </div>
        )}
      </div>
    );
  };
  
  // Render the card
  return (
    <div 
      className={`flashcard modal-card ${flipped ? 'flipped' : ''}`}
      onClick={handleFlip}
      style={{ backgroundColor: cardColor }}
    >
      <div className="flashcard-inner">
        {renderFront()}
        {renderBack()}
      </div>
    </div>
  );
};

export default FlippableCard; 