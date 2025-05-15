import React, { useState, useEffect, useRef } from 'react';
import { getContrastColor } from '../utils/ColorUtils';
import './Flashcard.css'; // Reuse existing CSS
import ScaledText from './ScaledText'; // Import ScaledText for dynamic text sizing

// --- Detailed Answer Modal --- (Define before FlippableCard)
const DetailedAnswerModal = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detailed-answer-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h3>{title}</h3>
        <div className="detailed-content">
          {typeof content === 'string' ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div>{content || "No detailed answer available."}</div>
          )}
        </div>
      </div>
    </div>
  );
};
// ------------------------------

// --- Feedback Popup --- (Define before FlippableCard)
const FeedbackPopup = ({ message, isCorrect, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className={`feedback-popup ${isCorrect ? 'correct' : 'incorrect'} ${isVisible ? 'visible' : ''}`}>
      {message}
    </div>
  );
};
// ------------------------

const FlippableCard = ({ 
  card, 
  isFlipped, 
  onFlip, 
  onAnswer, 
  isInModal = true, // Often true when used standalone 
  // New props for list view / review view
  showDeleteButton = false, 
  onDeleteRequest, // Function to call when delete is clicked, passes card.id
  disableFlipOnClick = false, // To prevent flipping when shown in a list
  isLocked = false, // New prop for locked state
  lockedNextReviewDate = null // New prop for the review date when locked
}) => {
  // Use parent-controlled flipped state if provided, otherwise internal state
  const [internalFlipped, setInternalFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showDetailedAnswerModal, setShowDetailedAnswerModal] = useState(false); // State for modal
  const [feedback, setFeedback] = useState({ isVisible: false, message: '', isCorrect: null });
  const feedbackTimeoutRef = useRef(null);
  
  // <<< ADD LOGGING HERE >>>
  try {
    console.log(`[FlippableCard Render] Card Prop Received (ID: ${card?.id}):`, JSON.stringify(card));
    // --- Log card options --- 
    if (card && (card.questionType === 'multiple_choice' || (Array.isArray(card.options) && card.options.length > 0))) {
        console.log(`[FlippableCard PROP] Card ${card.id} options:`, JSON.stringify(card.options));
    } else if (card) {
        console.log(`[FlippableCard PROP] Card ${card.id} is NOT multiple choice or has no options.`);
    }
    // --- End log ---
    console.log(`[FlippableCard Render] card.options type: ${typeof card?.options}, isArray: ${Array.isArray(card?.options)}, length: ${card?.options?.length}`);
  } catch (e) {
    console.error(`[FlippableCard Render] Error logging card prop for ID: ${card?.id}`, e);
    console.log(`[FlippableCard Render] Card Prop Received (ID: ${card?.id}) (Direct Log):`, card);
  }
  // <<< END LOGGING >>>
  
  // Determine if we're using internal or external flip state
  // If the card is locked, it should never appear flipped from an external state.
  const effectivelyFlipped = isLocked ? false : (isFlipped !== undefined ? isFlipped : internalFlipped);
  
  // Get the card color with fallbacks
  const cardColor = card?.cardColor || card?.topicColor || card?.subjectColor || '#3cb44b';
  
  // Get contrast color for text based on background
  const textColor = card?.textColor || getContrastColor(cardColor);
  
  // Handle flip
  const handleFlip = () => {
    if (isLocked || disableFlipOnClick) return; // Do not flip if locked or disabled

    if (onFlip) {
      onFlip(!effectivelyFlipped); // Use external handler if provided
    } else {
      setInternalFlipped(!internalFlipped); // Use internal state otherwise
    }
    // Close detailed answer modal when flipping
    setShowDetailedAnswerModal(false); 
    setFeedback({ isVisible: false, message: '', isCorrect: null }); // Hide feedback on flip
  };
  
  // Reset answer state when card changes
  useEffect(() => {
    setSelectedOption(null);
    setShowAnswer(false);
    setShowDetailedAnswerModal(false); // Reset modal state too
    setFeedback({ isVisible: false, message: '', isCorrect: null }); // Reset feedback on card change
    // Clear any pending feedback timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, [card]); // Depend on the whole card object in case delete removed it
  
  // Handle option selection for multiple choice
  const handleOptionSelect = (index, e) => {
    e.stopPropagation(); // Prevent card flip
    
    if (!showAnswer) {
      setSelectedOption(index);
      
      // --- Show Immediate Feedback --- 
      const isCorrect = index === getCorrectAnswerIndex();
      setFeedback({ 
        isVisible: true, 
        message: isCorrect ? 'Correct!' : `Incorrect! Answer: ${String.fromCharCode(97 + getCorrectAnswerIndex())})`,
        isCorrect: isCorrect 
      });

      // Set timeout to hide feedback after a delay
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback({ isVisible: false, message: '', isCorrect: null });
        feedbackTimeoutRef.current = null;
      }, 2500); // Hide after 2.5 seconds
      // ---------------------------------

      // Show the visual answer indication after a short delay
      setTimeout(() => {
        setShowAnswer(true); // This will apply .correct/.incorrect classes
        
        // Call the onAnswer callback if provided (e.g., for Leitner update)
        if (onAnswer && card?.options) {
          onAnswer(isCorrect, index);
        }
      }, 300); // Slightly delayed visual confirmation
    }
  };
  
  // Find correct answer index for multiple choice cards
  const getCorrectAnswerIndex = () => {
    if (!card || !card.options || !Array.isArray(card.options) || card.options.length === 0) {
      console.warn(`[FlippableCard] Cannot determine correct answer index: invalid options array for card ${card?.id}`);
      return 0; // Default to first option
    }
    
    // Try to find correct answer based on multiple matching strategies
    
    // Strategy 1: Use the correctAnswer field directly if it exists
    if (card.correctAnswer) {
      // Handle if correctAnswer is a full option text
      const correctAnswerText = String(card.correctAnswer).replace(/^[a-d]\)\s*/i, '').trim();
      
      // First try exact match
      let correctIndex = card.options.findIndex(option => {
        const optionText = typeof option === 'string' 
          ? option.replace(/^[a-d]\)\s*/i, '').trim() 
          : (option?.text || '').replace(/^[a-d]\)\s*/i, '').trim();
        
        // --- DETAILED LOGGING FOR STRATEGY 1 --- 
        console.log(`[getCorrectAnswerIndex Strat1 Debug] Comparing: 
          CorrectAns: '${correctAnswerText}' 
          Option:     '${optionText}'`);
        // --- END LOGGING ---
          
        return optionText === correctAnswerText;
      });
      
      // If exact match fails, try case-insensitive match
      if (correctIndex === -1) {
        correctIndex = card.options.findIndex(option => {
          const optionText = typeof option === 'string' 
            ? option.replace(/^[a-d]\)\s*/i, '').trim() 
            : (option?.text || '').replace(/^[a-d]\)\s*/i, '').trim();
          return optionText.toLowerCase() === correctAnswerText.toLowerCase();
        });
      }
      
      // If match found, return it
      if (correctIndex !== -1) {
        console.log(`[FlippableCard] Found correct answer by matching correctAnswer: ${correctAnswerText}, index: ${correctIndex}`);
        return correctIndex;
      }
      
      // Log failure to find matching option
      console.warn(`[FlippableCard] Card has correctAnswer "${correctAnswerText}" but it doesn't match any option`);
    }
    
    // Strategy 2: Look for option with isCorrect flag
    const correctOptionIndex = card.options.findIndex(option => 
      option && typeof option === 'object' && option.isCorrect === true
    );
    if (correctOptionIndex >= 0) {
      console.log(`[FlippableCard] Found correct answer via isCorrect flag at index: ${correctOptionIndex}`);
      return correctOptionIndex;
    }
    
    // --- NEW STRATEGY 3.5: Check if answer text matches an option --- 
    if (typeof (card.answer || card.back) === 'string') {
        const answerText = (card.answer || card.back).trim();
        const matchingOptionIndex = card.options.findIndex(option => {
            const optionText = typeof option === 'string' 
                ? option.replace(/^[a-d]\)\s*/i, '').trim()
                : (option?.text || '').replace(/^[a-d]\)\s*/i, '').trim();
            // Check for exact match or if the answer *starts with* the option text (case-insensitive)
            return answerText.toLowerCase() === optionText.toLowerCase() || 
                   answerText.toLowerCase().startsWith(optionText.toLowerCase());
        });
        
        if (matchingOptionIndex !== -1) {
            console.log(`[FlippableCard] Found correct answer by matching answer text to option index: ${matchingOptionIndex}`);
            return matchingOptionIndex;
        }
    }
    // --- END NEW STRATEGY --- 
    
    // Strategy 4: Parse the answer/back text if it contains "Correct Answer: [letter])"
    const answerString = card.answer || card.back || '';
    if (typeof answerString === 'string') {
      const correctAnswerMatch = answerString.match(/Correct Answer:\s*([a-d])\)/i);
      if (correctAnswerMatch) {
        const letter = correctAnswerMatch[1].toLowerCase();
        const index = letter.charCodeAt(0) - 97; // 'a' => 0, 'b' => 1, etc.
        if (index >= 0 && index < card.options.length) {
          console.log(`[FlippableCard] Found correct answer by parsing answer string: ${letter}, index: ${index}`);
          return index;
        }
      }
    }
    
    // Default to first option if no correct answer found
    console.warn(`[FlippableCard] Could not definitively determine correct answer for card ${card.id}. Defaulting to index 0.`);
    return 0;
  };
  
  // --- Handle Delete Button Click ---
  const handleDeleteClick = (e) => {
    e.stopPropagation(); // Prevent card flip or other parent actions
    if (onDeleteRequest && card?.id) {
      console.log(`Requesting delete for card ID: ${card.id}`);
      onDeleteRequest(card.id);
    } else {
      console.warn("Delete request ignored: onDeleteRequest handler or card ID missing.");
    }
  };
  // ----------------------------------
  
  // Get front content based on card type
  const renderFront = () => {
    if (!card) return <div className="flashcard-face flashcard-front empty-card">No card data</div>;
    
    const question = card.front || card.question || '';
    const isMultipleChoice = Array.isArray(card.options) && card.options.length > 0;
    const correctAnswerIndex = getCorrectAnswerIndex();
    
    return (
      <div className="flashcard-face flashcard-front" style={{ color: textColor, backgroundColor: cardColor }}>
        {card.topic && (
          <div className="card-topic-indicator" style={{ color: textColor }}>
            {card.topic}
          </div>
        )}
        
        {/* --- Buttons Area (Delete) --- */}       
        {showDeleteButton && onDeleteRequest && (
          <div className="flashcard-buttons">
            <button 
              className="delete-btn" 
              onClick={handleDeleteClick} 
              title="Delete Card"
              style={{ color: textColor }}
            >
              🗑️
            </button>
          </div>
        )}
        
        {/* --- Question Area with fixed positioning --- */}
        <div className="card-question-area" style={{
          maxHeight: isMultipleChoice ? '35%' : '80%',
          overflow: 'hidden',
          marginBottom: '10px',
          width: '100%',
          textAlign: 'center'
        }}>
          <ScaledText 
            maxFontSize={20} 
            minFontSize={12}
            isQuestion={true}
          >
            {typeof question === 'string' ? (
              <div dangerouslySetInnerHTML={{ __html: question || "No question available" }} />
            ) : (
              <div>No question available</div>
            )}
          </ScaledText>
        </div>
        
        {/* --- Options Area (Only if MC) with dynamic text scaling --- */}
        {isMultipleChoice && (
          <div className="card-options-area" style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            width: '100%'
          }}>
            <div className="dynamic-options-container" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              width: '100%'
            }}>
              {card.options.map((option, index) => {
                const optionText = typeof option === 'string' ? option : option?.text || '';
                // Determine option class based on selection state and correct answer
                const baseClass = `option-item`;
                const stateClasses = [
                  selectedOption === index ? 'selected' : '',
                  showAnswer && index === correctAnswerIndex ? 'correct' : '',
                  showAnswer && selectedOption === index && index !== correctAnswerIndex ? 'incorrect' : '',
                  showAnswer && index === correctAnswerIndex && selectedOption !== index ? 'reveal-correct' : ''
                ].filter(Boolean).join(' ');
                
                return (
                  <div 
                    key={index}
                    className={`${baseClass} ${stateClasses}`}
                    onClick={(e) => handleOptionSelect(index, e)}
                    style={{
                      color: textColor,
                      backgroundColor: 'transparent', // Remove background color
                      border: '1px solid rgba(255, 255, 255, 0.3)', 
                      borderRadius: '5px',
                      margin: '2px 0',
                      padding: '6px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="option-letter" style={{ 
                      fontWeight: 'bold', 
                      marginRight: '6px',
                      minWidth: '15px',
                      fontSize: '0.9em'
                    }}>{String.fromCharCode(97 + index)})</div>
                    <div className="option-text" style={{ 
                      flex: 1,
                      fontSize: '0.9em',
                      lineHeight: '1.2'
                    }}>
                      <ScaledText 
                        maxFontSize={14} 
                        minFontSize={8}
                        isOption={true}
                      >
                        {optionText}
                      </ScaledText>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {card.boxNum !== undefined && (
          <div className="box-indicator">
            Box {card.boxNum}
          </div>
        )}

        {/* --- Add New Feedback Popup Component Here --- */}
        <FeedbackPopup 
          message={feedback.message}
          isCorrect={feedback.isCorrect}
          isVisible={feedback.isVisible}
        />
        {/* --------------------------------------------- */}
      </div>
    );
  };
  
  // Get back content
  const renderBack = () => {
    if (!card) return <div className="flashcard-face flashcard-back empty-card">No card data</div>;
    
    // Determine the primary answer content, prioritizing card.answer
    const primaryAnswerContent = card.answer || card.back || "No answer available";
    // Use detailedAnswer, additionalInfo or any content that could be shown in the modal
    const detailedAnswerContent = card.detailedAnswer || card.additionalInfo || "";

    const handleInfoClick = (e) => {
      e.stopPropagation(); // Prevent card flip
      setShowDetailedAnswerModal(true);
    };

    return (
      <div className="flashcard-face flashcard-back" style={{ backgroundColor: '#ffffff' }}>
        {card.topic && (
          <div className="card-topic-indicator back-topic">
            {card.topic}
          </div>
        )}
        
        {/* Always show delete button on back side if needed */}
        {showDeleteButton && onDeleteRequest && (
          <div className="flashcard-buttons" style={{ top: '5px', right: '5px' }}>
            <button 
              className="delete-btn" 
              onClick={handleDeleteClick} 
              title="Delete Card"
              style={{ color: '#dc3545' }}
            >
              🗑️
            </button>
          </div>
        )}
        
        {/* Make info button more prominent */}
        {(detailedAnswerContent) && (
          <button 
            className="info-button"
            onClick={handleInfoClick}
            title="Show Detailed Answer"
            style={{
              position: 'absolute',
              top: '8px',
              right: showDeleteButton ? '40px' : '8px',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: '#f0f0f0',
              border: '1px solid #ccc',
              color: '#333',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: 'pointer',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            i
          </button>
        )}

        <div className="card-content-area">
          {/* Display the primary answer content with ScaledText */}
          <div className="answer-text" style={{ width: '100%', height: '100%' }}>
            <ScaledText 
              maxFontSize={18} 
              minFontSize={10}
            >
              {typeof primaryAnswerContent === 'string' ? (
                <div dangerouslySetInnerHTML={{ __html: primaryAnswerContent }} />
              ) : (
                <div>Invalid answer format</div>
              )}
            </ScaledText>
          </div>
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
    <>
      <div 
        className={`flashcard ${effectivelyFlipped ? 'flipped' : ''} ${isLocked ? 'is-locked' : ''}`}
        onClick={handleFlip} // handleFlip now internally checks isLocked and disableFlipOnClick
        style={{
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
          transition: 'all 0.3s ease',
          overflow: 'hidden'
        }}
      >
        <div className="flashcard-inner">
          {renderFront()}
          {!isLocked && renderBack()} {/* Don't render back if locked */}
          
          {isLocked && (
            <div className="locked-card-overlay">
              <h4>This card is unavailable</h4>
              {lockedNextReviewDate && (
                <p>Next review date: {new Date(lockedNextReviewDate).toLocaleDateString()}</p>
              )}
              {!lockedNextReviewDate && (
                <p>Review date not set.</p> // Fallback if date is somehow missing
              )}
            </div>
          )}
        </div>
      </div>

      {/* Render the modal conditionally */}
      <DetailedAnswerModal 
        isOpen={showDetailedAnswerModal}
        onClose={() => setShowDetailedAnswerModal(false)}
        title="Detailed Answer"
        content={card?.detailedAnswer || card?.additionalInfo || "No detailed answer available."}
      />
    </>
  );
};

export default FlippableCard;
