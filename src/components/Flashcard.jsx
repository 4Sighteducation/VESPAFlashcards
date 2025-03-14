import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './Flashcard.css';

// Helper function to determine text color based on background color brightness
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#000000';
  
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);
  
  // Calculate brightness using YIQ formula - adjusted for better contrast
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Lower threshold (120 instead of 128) to ensure more text is white on darker backgrounds
  return brightness > 120 ? '#000000' : '#ffffff';
};

const ScaledText = ({ children, minFontSize = 6, maxFontSize = 16, className = '' }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  
  useEffect(() => {
    // Initial render - wait for next frame for proper sizes
    const timer = requestAnimationFrame(() => {
      adjustTextSize();
    });
    
    return () => cancelAnimationFrame(timer);
  }, [children]);
  
  // Add resize listener
  useEffect(() => {
    window.addEventListener('resize', adjustTextSize);
    return () => window.removeEventListener('resize', adjustTextSize);
  }, []);
  
  const adjustTextSize = () => {
    if (!textRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    const text = textRef.current;
    
    // Reset font size to maximum to measure properly
    text.style.fontSize = `${maxFontSize}px`;
    
    // Check if overflowing (both width and height)
    if (text.scrollHeight > container.clientHeight || text.scrollWidth > container.clientWidth) {
      // Binary search to find the right size
      let min = minFontSize;
      let max = maxFontSize;
      
      while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        text.style.fontSize = `${mid}px`;
        
        if (text.scrollHeight <= container.clientHeight && text.scrollWidth <= container.clientWidth) {
          min = mid + 1;
        } else {
          max = mid - 1;
        }
      }
      
      // Final adjustment
      text.style.fontSize = `${max}px`;
      
      // If still overflowing at minimum size, add ellipsis
      if (max <= minFontSize && (text.scrollHeight > container.clientHeight || text.scrollWidth > container.clientWidth)) {
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
      }
    }
  };
  
  return (
    <div ref={containerRef} className={`text-container ${className}`}>
      <div ref={textRef} className="scaled-text">
        {children}
      </div>
    </div>
  );
};

// Component for multiple choice options with scaling
const MultipleChoiceOptions = ({ options, preview = false }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    adjustOptionsFontSize();
    window.addEventListener('resize', adjustOptionsFontSize);
    return () => window.removeEventListener('resize', adjustOptionsFontSize);
  }, [options]);
  
  const adjustOptionsFontSize = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const items = container.querySelectorAll('li');
    
    // Start with a reasonable font size
    let fontSize = 14;
    
    // Reduce font size if any item overflows
    let overflow = false;
    do {
      overflow = false;
      items.forEach(item => {
        item.style.fontSize = `${fontSize}px`;
        // Check both width and height overflow
        if (item.scrollWidth > item.clientWidth || 
            container.scrollHeight > container.clientHeight) {
          overflow = true;
        }
      });
      
      if (overflow && fontSize > 6) {
        fontSize -= 1;
      } else {
        break;
      }
    } while (fontSize > 6);
    
    // Final check for container overflow
    if (container.scrollHeight > container.clientHeight && fontSize > 6) {
      // Further reduce font size if the entire list is too tall
      do {
        fontSize -= 1;
        items.forEach(item => {
          item.style.fontSize = `${fontSize}px`;
        });
      } while (container.scrollHeight > container.clientHeight && fontSize > 6);
    }
  };
  
  // Clean options by removing any existing letter prefixes
  const cleanedOptions = options.map(option => {
    return option.replace(/^[a-d]\)\s*/i, '');
  });
  
  return (
    <div className="options-container" ref={containerRef}>
      <ol type="a">
        {cleanedOptions.map((option, index) => (
          <li key={index}>{option}</li>
        ))}
      </ol>
    </div>
  );
};

const Flashcard = ({ card, onDelete, onFlip, onUpdateCard, showButtons = true, preview = false, style = {}, isInModal = false, onClick }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const cardRef = useRef(null);
  
  // Apply card styles based on card data
  const cardStyle = {
    backgroundColor: card.cardColor || '#3cb44b',
    borderColor: card.boxNum === 5 ? 'gold' : 'transparent', // Gold border for mastered cards
    boxShadow: card.boxNum === 5 ? '0 0 10px rgba(255, 215, 0, 0.5)' : undefined,
    ...style // Apply any additional styles passed in
  };
  
  // Get contrast color for text based on background
  const textColor = getContrastColor(card.cardColor || '#3cb44b');
  
  // Handle card flipping
  const handleFlip = (e) => {
    // Don't flip if clicking on buttons or controls
    if (
      e.target.closest('.delete-btn') || 
      e.target.closest('.color-btn') || 
      e.target.closest('.info-btn') || 
      e.target.closest('.delete-confirm') || 
      e.target.closest('.color-picker-container')
    ) {
      return;
    }
    
    setIsFlipped(!isFlipped);
    if (onFlip) onFlip(card, !isFlipped);
  };
  
  // Handle clicking on the card - for opening modal view
  const handleClick = (e) => {
    if (onClick && !isInModal) {
      // Only trigger onClick if it's not a button click and we're not already in modal
      if (
        !e.target.closest('.delete-btn') && 
        !e.target.closest('.color-btn') && 
        !e.target.closest('.info-btn') && 
        !e.target.closest('.delete-confirm') && 
        !e.target.closest('.color-picker-container')
      ) {
        onClick(e);
      }
    } else {
      handleFlip(e);
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
      onUpdateCard({
        ...card,
        cardColor: color,
        baseColor: color
      });
    }
    setShowColorPicker(false);
  };
  
  // Bright colors for the color picker
  const colorOptions = [
    "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
    "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000"
  ];
  
  // Determine if this is a multiple choice card
  const isMultipleChoice = card.questionType === 'multiple_choice' && Array.isArray(card.options);
  
  // Check if card has additional information
  const hasAdditionalInfo = card.additionalInfo || card.detailedAnswer;
  
  // Special class for modal view
  const cardClass = `flashcard ${isFlipped ? 'flipped' : ''} ${card.boxNum === 5 ? 'mastered' : ''} ${preview ? 'preview-card' : ''} ${isInModal ? 'modal-card' : ''}`;
  
  return (
    <>
      <div 
        ref={cardRef}
        className={cardClass}
        onClick={handleClick}
        style={cardStyle}
      >
        {showButtons && !preview && (
          <>
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
                >
                  ✕
                </button>
                
                <button 
                  className="color-btn" 
                  onClick={toggleColorPicker}
                  title="Change color"
                >
                  🎨
                </button>
                
                {hasAdditionalInfo && (
                  <button 
                    className="info-btn" 
                    onClick={toggleInfoModal}
                    title="View additional information"
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
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorChange(color)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        <div className="flashcard-inner">
          <div className="flashcard-front" style={{ color: textColor }}>
            {isMultipleChoice ? (
              <>
                <ScaledText className="question-title" maxFontSize={16}>
                  {card.front || card.question || "No question available"}
                </ScaledText>
                <MultipleChoiceOptions options={card.options || []} preview={preview} />
              </>
            ) : (
              <ScaledText maxFontSize={16}>
                {typeof card.front === 'string' || typeof card.question === 'string' ? (
                  <div dangerouslySetInnerHTML={{ __html: card.front || card.question || "No question available" }} />
                ) : (
                  <div>No question available</div>
                )}
              </ScaledText>
            )}
          </div>
          
          <div className="flashcard-back" style={{ 
            color: '#000000', 
            backgroundColor: '#ffffff' 
          }}>
            <ScaledText maxFontSize={14}>
              {card.questionType === 'multiple_choice' ? (
                <div>
                  Correct Answer: {(() => {
                    // Clean the correct answer of any existing prefix
                    const cleanAnswer = card.correctAnswer ? card.correctAnswer.replace(/^[a-d]\)\s*/i, '') : "Not specified";
                    
                    // Find the index of this answer in the options array
                    const answerIndex = card.options ? card.options.findIndex(option => 
                      option.replace(/^[a-d]\)\s*/i, '').trim() === cleanAnswer.trim()
                    ) : -1;
                    
                    // Get the letter for this index (a, b, c, d)
                    const letter = answerIndex >= 0 ? String.fromCharCode(97 + answerIndex) : '';
                    
                    // Return formatted answer with letter prefix
                    return answerIndex >= 0 ? `${letter}) ${cleanAnswer}` : cleanAnswer;
                  })()}
                </div>
              ) : (
                typeof card.back === 'string' ? (
                  <div dangerouslySetInnerHTML={{ __html: card.back || "No answer available" }} />
                ) : (
                  <div>No answer available</div>
                )
              )}
            </ScaledText>
            
            {card.boxNum !== undefined && (
              <div className="box-indicator">
                Box {card.boxNum}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Information Modal - Moved outside of flashcard div for better positioning */}
      {showInfoModal && ReactDOM.createPortal(
        <div className="info-modal-overlay" onClick={closeInfoModal}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <h3>Additional Information</h3>
              <button className="close-modal-btn" onClick={closeInfoModal}>✕</button>
            </div>
            <div className="info-modal-content">
              <div dangerouslySetInnerHTML={{ __html: card.additionalInfo || card.detailedAnswer || "No additional information available." }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Flashcard;
