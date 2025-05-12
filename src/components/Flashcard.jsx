import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './Flashcard.css';
import ScaledText from './ScaledText';
import MultipleChoiceOptions from './MultipleChoiceOptions';
import { getContrastColor } from '../utils/ColorUtils';

// Removed unused commented-out function: getAppropriateQuestionSize

const Flashcard = ({ card, onDelete, onFlip, onUpdateCard, showButtons = true, preview = false, style = {}, isInModal = false, onClick }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const cardRef = useRef(null);
  
  // Color priority:
  // 1. card.cardColor (directly set on the card)
  // 2. topic color from subjectColorMapping
  // 3. subject base color
  // 4. default color (#3cb44b)
  
  // Get the most appropriate card color
  const getCardColor = () => {
    // If card has its own color, use that
    if (card.cardColor) return card.cardColor;
    
    // If card has topic and subject color data, use those
    if (card.topicColor) return card.topicColor;
    
    // If card has subject color, use that
    if (card.subjectColor) return card.subjectColor;
    
    // Default color
    return '#3cb44b';
  };
  
  // Apply card styles based on card data
  const cardStyle = {
    backgroundColor: getCardColor(),
    borderColor: card.boxNum === 5 ? 'gold' : 'transparent', // Gold border for mastered cards
    boxShadow: card.boxNum === 5 ? '0 0 10px rgba(255, 215, 0, 0.5)' : undefined,
    ...style // Apply any additional styles passed in
  };
  
  // Get contrast color for text based on background
  const textColor = card.textColor || getContrastColor(getCardColor());
  
  // Handle card click to flip
  const handleClick = (e) => {
    // If clicking on a button, don't flip
    if (e.target.closest('button') || e.target.closest('.card-topic-indicator')) {
      return;
    }
    
    // Otherwise, flip the card
    if (onClick) {
      onClick(); // Use the custom handler if provided
    } else {
      toggleFlip(e); // Otherwise use the default flip
    }
  };
  
  // Toggle card flip
  const toggleFlip = (e) => {
    if (e) {
      e.stopPropagation();
    }
    
    // If we're in preview mode, don't flip
    if (preview) {
      return;
    }
    
    // Otherwise, toggle the flip state
    setIsFlipped(!isFlipped);
    
    // Call the onFlip callback if provided
    if (onFlip) {
      onFlip(card, !isFlipped);
    }
  };
  
  // Handle delete confirmation
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };
  
  // Cancel delete
  const cancelDelete = (e) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };
  
  // Confirm delete
  const confirmDeleteCard = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(card.id);
  };
  
  // Toggle color picker
  const toggleColorPicker = (e) => {
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
  };
  
  // Toggle info modal
  const toggleInfoModal = (e) => {
    e.stopPropagation();
    setShowInfoModal(!showInfoModal);
  };
  
  // Close info modal
  const closeInfoModal = (e) => {
    if (e) e.stopPropagation();
    setShowInfoModal(false);
  };
  
  // Handle color change
  const handleColorChange = (color) => {
    if (onUpdateCard) {
      // When updating the card, calculate the appropriate text color
      // based on the new background color
      const newTextColor = getContrastColor(color);
      console.log(`Color changed to ${color}, calculated text: ${newTextColor}`);
      
      onUpdateCard({
        ...card,
        cardColor: color,
        baseColor: color,
        textColor: newTextColor // Store the calculated text color
      });
    }
    setShowColorPicker(false);
  };
  
  // Bright colors for the color picker - matches the palette in AICardGenerator.jsx
  const colorOptions = [
    // Blues
    "#5b9bd5", "#2e75b6", "#4472c4", "#4a86e8", "#6fa8dc", 
    // Greens
    "#70ad47", "#548235", "#a9d18e", "#a9d08e", "#c6e0b4", 
    // Reds/Pinks
    "#c00000", "#e74c3c", "#ff9999", "#ea9999", "#f4cccc", 
    // Purples
    "#8e7cc3", "#674ea7", "#b4a7d6", "#d5a6bd", "#d9d2e9", 
    // Yellows/Oranges
    "#f1c232", "#bf9000", "#ffd966", "#f6b26b", "#ffe599", 
    // Browns/Neutrals
    "#a0522d", "#783f04", "#b45f06", "#8d6e63", "#a67c52"
  ];
  
  // Helper function to determine appropriate font size based on content length
  const getQuestionClassByLength = (text) => {
    if (!text) return '';
    
    const length = text.length;
    
    if (length > 300) {
      return 'extremely-long';
    } else if (length > 150) {
      return 'very-long';
    }
    
    return '';
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
  
  // Handle option click for multiple choice
  const handleOptionSelect = (index, e) => {
    e.stopPropagation(); // Prevent card flip when clicking an option
    
    // Only allow selection if not already showing answer
    if (!showAnswer) {
      setSelectedOption(index);
      
      // Show the answer after a slight delay
      setTimeout(() => {
        setShowAnswer(true);
      }, 300);
    }
  };
  
  // Reset selections when card is flipped back
  useEffect(() => {
    if (!isFlipped) {
      setSelectedOption(null);
      setShowAnswer(false);
    }
  }, [isFlipped]);

  // Determine if we have options for this card
  const isMultipleChoice = Boolean(card.options && Array.isArray(card.options) && card.options.length > 0);
  const questionText = card.front || card.question || '';
  const questionLengthClass = getQuestionClassByLength(questionText);
  
  // Check if card has additional information (now primarily from detailedAnswer)
  const hasAdditionalInfo = card.detailedAnswer;
  
  // Special class for modal view and fullscreen
  const cardClass = `flashcard flashcard-${card.id || 'unknown'} ${isFlipped ? 'flipped' : ''} ${card.boxNum === 5 ? 'mastered' : ''} ${preview ? 'preview-card' : ''} ${isInModal ? 'modal-card' : ''} ${isFullscreen ? 'fullscreen' : ''}`;
  
  // In the component, add a useEffect to set CSS variables based on card colors
  useEffect(() => {
    if (!card || !card.cardColor) return;
    
    try {
      // Create a style element for this specific card instance
      const styleId = `card-style-${card.id || Math.random().toString(36).substring(7)}`;
      let styleEl = document.getElementById(styleId);
      
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      
      // Calculate if text should be white or black based on background color brightness
      const cardColor = card.cardColor;
      const r = parseInt(cardColor.slice(1, 3), 16) || 0;
      const g = parseInt(cardColor.slice(3, 5), 16) || 0;
      const b = parseInt(cardColor.slice(5, 7), 16) || 0;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      const effectiveCardColor = getCardColor(); // Use the result of getCardColor()
const effectiveTextColor = getContrastColor(effectiveCardColor); // Recalculate for the CSS var based on effectiveCardColor

// Update the style element with scoped CSS variables
styleEl.textContent = `
  .flashcard-${card.id || 'dynamic'} { /* Add fallback for card.id if it can be null */
    --card-bg-color: ${effectiveCardColor};
    --card-text-color: ${effectiveTextColor};
  }
`;

      
      // Add a cleanup function to remove the style element
      return () => {
        if (styleEl && document.head.contains(styleEl)) {
          document.head.removeChild(styleEl);
        }
      };
    } catch (error) {
      console.error('Error setting card CSS variables:', error);
    }
  }, [card?.cardColor, card?.topicColor, card?.subjectColor, card?.id]
);
  
  // Toggle fullscreen mode
  const toggleFullscreen = (e) => {
    e.stopPropagation(); // Prevent card flip
    setIsFullscreen(!isFullscreen);
  };
  
  // Back side rendering logic
  const renderBack = () => {
    let answerContent;

    // The card.back field is now pre-processed in FlashcardGeneratorBridge
    // to hold the appropriate content for the back of each card type.
    // For MCQs, it's detailedAnswer.
    // For Short Answer/Essay, it's keyPoints.
    // For Acronyms, it's the explanation.

    if (typeof card.back === 'string' && card.back.trim() !== '') {
      // If card.back is a string (e.g., detailedAnswer for MCQ, explanation for Acronym, or joined keyPoints),
      // render it directly. We use dangerouslySetInnerHTML to allow for newlines from keyPoints.
      answerContent = <div dangerouslySetInnerHTML={{ __html: card.back.replace(/\n/g, '<br />') }} />;
    } else if (Array.isArray(card.back) && card.back.length > 0) {
      // If card.back is an array (should ideally be pre-joined, but as a fallback)
      answerContent = (
        <ul>
          {card.back.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      );
    } else {
      answerContent = <div>No key points or answer available for the back.</div>;
    }

    return (
      <div className="flashcard-back flashcard-flip-area" style={{ 
        color: '#000000', 
        backgroundColor: '#ffffff',
        padding: '15px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        width: '100%',
        position: 'absolute',
        boxSizing: 'border-box',
        cursor: preview ? 'default' : 'pointer'
      }}>
        {card.topic && !preview && (
          <div className="card-topic-indicator back-topic">
            {card.topic}
          </div>
        )}
        <div className="card-content-area">
          <ScaledText 
            maxFontSize={isInModal ? 24 : 16} 
            minFontSize={isInModal ? 8 : 6}
            isInModal={isInModal}
          >
            {answerContent}
          </ScaledText>
        </div>
        {card.boxNum !== undefined && !preview && (
          <div className="box-indicator">
            Box {card.boxNum}
          </div>
        )}
      </div>
    );
  };

  // Update the front side rendering to include interactive multiple choice options
  const renderFront = () => {
    const isMultipleChoice = Boolean(card.options && Array.isArray(card.options) && card.options.length > 0);
    const questionText = card.front || card.question || '';
    const questionLengthClass = getQuestionClassByLength(questionText);
    const correctAnswerIndex = getCorrectAnswerIndex();
    
    return (
      <div className="flashcard-front flashcard-flip-area" style={{ 
        color: textColor,
        backgroundColor: cardStyle.backgroundColor,
        padding: '15px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        width: '100%',
        position: 'absolute',
        boxSizing: 'border-box',
        cursor: preview ? 'default' : 'pointer'
      }}>
        {card.topic && !preview && (
          <div className="card-topic-indicator" style={{ color: textColor }}>
            {card.topic}
          </div>
        )}
        {isMultipleChoice ? (
          <>
            <div className={`question-title ${questionLengthClass}`} style={{ color: textColor }}>
              {questionText || "No question available"}
            </div>
            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              width: '100%', 
              display: 'block',
              marginTop: '10px',
              position: 'relative'
            }}>
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
            </div>
          </>
        ) : (
          <div className={`question-title ${questionLengthClass}`} style={{ color: textColor }}>
            {typeof questionText === 'string' ? (
              <div dangerouslySetInnerHTML={{ __html: questionText || "No question available" }} />
            ) : (
              <div>No question available</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Update the main return to use renderFront and renderBack
  return (
    <>
      <div 
        ref={cardRef}
        className={cardClass}
        onClick={handleClick}
        style={cardStyle}
      >
        {/* Buttons container */}
        {showButtons && !preview && (
          <div className="flashcard-buttons">
            {confirmDelete ? (
              <div className="delete-confirm">
                <span style={{ color: textColor }}>Delete?</span>
                <button onClick={confirmDeleteCard} className="confirm-btn">Yes</button>
                <button onClick={cancelDelete} className="cancel-btn">No</button>
              </div>
            ) : (
              <>
                <button 
                  className="delete-btn" 
                  onClick={handleDeleteClick}
                  title="Delete card"
                  style={{ color: textColor }}
                >
                  ✕
                </button>
                
                <button 
                  className="color-btn" 
                  onClick={toggleColorPicker}
                  title="Change color"
                  style={{ color: textColor }}
                >
                  🎨
                </button>
                
                {hasAdditionalInfo && (
                  <button 
                    className="info-btn" 
                    onClick={toggleInfoModal}
                    title="View additional information"
                    style={{ color: textColor }}
                  >
                    ℹ️
                  </button>
                )}
              </>
            )}
            
            {showColorPicker && (
              <div className="color-picker-container" onClick={(e) => e.stopPropagation()}>
                <div className="color-options">
                  {colorOptions.map((color) => (
                    <div 
                      key={color}
                      className="color-option"
                      style={{ 
                        backgroundColor: color,
                        border: color === getCardColor() ? '2px solid white' : '2px solid transparent'
                      }}
                      onClick={() => handleColorChange(color)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flashcard-inner">
          {renderFront()}
          {renderBack()}
        </div>
      </div>
      
      {/* Information Modal */}
      {showInfoModal && ReactDOM.createPortal(
        <div className="info-modal-overlay" onClick={closeInfoModal}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()} style={{ '--card-bg-color': getCardColor(), '--card-text-color': textColor }}>
            <div className="info-modal-header">
              <h3>Additional Information</h3>
              <button className="close-modal-btn" onClick={closeInfoModal}>✕</button>
            </div>
            <div className="info-modal-content">
              {/* Info modal should always show detailedAnswer if available */}
              <div dangerouslySetInnerHTML={{ __html: card.detailedAnswer || card.additionalInfo || "No detailed information available." }} />
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Fullscreen toggle button */}
      {!isInModal && !preview && (
        <button 
          className="fullscreen-toggle" 
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? "⤓" : "⤢"}
        </button>
      )}
    </>
  );
};

export default Flashcard;
