import React, { useState, useEffect } from 'react';
import { getContrastColor } from '../utils/ColorUtils';
import './Flashcard.css'; // Reuse existing CSS

// --- Detailed Answer Modal --- (Define before FlippableCard)
const DetailedAnswerModal = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detailed-answer-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h3>{title}</h3>
        <pre>{content}</pre>
      </div>
    </div>
  );
};
// ------------------------------

const FlippableCard = ({ 
  card, 
  isFlipped, 
  onFlip, 
  onAnswer, 
  isInModal = true, // Often true when used standalone 
  // New props for list view / review view
  showDeleteButton = false, 
  onDeleteRequest, // Function to call when delete is clicked, passes card.id
  disableFlipOnClick = false // To prevent flipping when shown in a list
}) => {
  // Use parent-controlled flipped state if provided, otherwise internal state
  const [internalFlipped, setInternalFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showDetailedAnswerModal, setShowDetailedAnswerModal] = useState(false); // State for modal
  
  // Determine if we're using internal or external flip state
  const flipped = isFlipped !== undefined ? isFlipped : internalFlipped;
  
  // Get the card color with fallbacks
  const cardColor = card?.cardColor || card?.topicColor || card?.subjectColor || '#3cb44b';
  
  // Get contrast color for text based on background
  const textColor = card?.textColor || getContrastColor(cardColor);
  
  // Handle flip
  const handleFlip = () => {
    if (onFlip) {
      onFlip(!flipped); // Use external handler if provided
    } else {
      setInternalFlipped(!internalFlipped); // Use internal state otherwise
    }
    // Close detailed answer modal when flipping
    setShowDetailedAnswerModal(false); 
  };
  
  // Reset answer state when card changes
  useEffect(() => {
    setSelectedOption(null);
    setShowAnswer(false);
    setShowDetailedAnswerModal(false); // Reset modal state too
  }, [card]); // Depend on the whole card object in case delete removed it
  
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
    
    // Strategy 3: Parse the answer/back text if it contains "Correct Answer: [letter])"
    const answerString = card.answer || card.back || '';
    if (typeof answerString === 'string') {
      const correctAnswerMatch = answerString.match(/Correct Answer:\s*([a-d])\)/i);
      if (correctAnswerMatch) {
        const letter = correctAnswerMatch[1].toLowerCase();
        return letter.charCodeAt(0) - 97; // 'a' => 0, 'b' => 1, etc.
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
            >
              🗑️
            </button>
          </div>
        )}
        
        {/* --- Question Area --- */}
        <div className="card-question-area">
          {typeof question === 'string' ? (
            <div dangerouslySetInnerHTML={{ __html: question || "No question available" }} />
          ) : (
            <div>No question available</div>
          )}
        </div>
        
        {/* --- Options Area (Only if MC) --- */}
        {isMultipleChoice && (
          <div className="card-options-area">
            <ol className="options-list">
              {card.options.map((option, index) => {
                const optionText = typeof option === 'string' ? option : option?.text || '';
                // Determine option class based on selection state and correct answer
                const optionClass = `
                  option-item
                  ${selectedOption === index ? 'selected' : ''}
                  ${showAnswer && index === correctAnswerIndex ? 'correct' : ''}
                  ${showAnswer && selectedOption === index && index !== correctAnswerIndex ? 'incorrect' : ''}
                  ${showAnswer && index === correctAnswerIndex && selectedOption !== index ? 'reveal-correct' : ''} 
                `;
                
                return (
                  <li 
                    key={index} 
                    className={optionClass}
                    onClick={(e) => handleOptionSelect(index, e)}
                    style={{ color: textColor }} // Use contrast text color
                  >
                    <span className="option-letter">{String.fromCharCode(97 + index)})</span>
                    <span className="option-text">{optionText}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* --- Answer Feedback Area (Only if MC) --- */}
        {isMultipleChoice && showAnswer && (
          <div className="answer-feedback">
            {selectedOption === correctAnswerIndex ? (
              <div className="correct-feedback-text">Correct!</div>
            ) : (
              <div className="incorrect-feedback-text">
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
    if (!card) return <div className="flashcard-face flashcard-back empty-card">No card data</div>;
    
    // Determine the primary answer content, prioritizing card.answer
    const primaryAnswerContent = card.answer || card.back || "No answer available";
    const detailedAnswerContent = card.detailedAnswer || "";

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
        
        {detailedAnswerContent && (
          <button 
            className="info-button"
            onClick={handleInfoClick}
            title="Show Detailed Answer"
          >
            i
          </button>
        )}

        <div className="card-content-area">
          {/* Display the primary answer content */}
          <div className="answer-text">
            {typeof primaryAnswerContent === 'string' ? (
               <div dangerouslySetInnerHTML={{ __html: primaryAnswerContent }} />
            ) : (
               <div>Invalid answer format</div>
            )}
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
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        onClick={!disableFlipOnClick ? handleFlip : undefined} // Conditionally allow flip
        // Remove background color setting here, handled by face
      >
        <div className="flashcard-inner">
          {renderFront()}
          {renderBack()}
        </div>
      </div>

      {/* Render the modal conditionally */}
      <DetailedAnswerModal 
        isOpen={showDetailedAnswerModal}
        onClose={() => setShowDetailedAnswerModal(false)}
        title="Detailed Answer"
        content={card?.detailedAnswer || "No detailed answer available."}
      />
    </>
  );
};

export default FlippableCard; 