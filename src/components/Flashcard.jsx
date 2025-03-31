import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './Flashcard.css';
import ScaledText from './ScaledText';
import MultipleChoiceOptions from './MultipleChoiceOptions';

// Helper function for determining text color based on background color
export const getContrastColor = (hexColor) => {
  // Default to black if no color provided
  if (!hexColor || typeof hexColor !== 'string') {
    console.warn('Invalid color provided to getContrastColor:', hexColor);
    return '#000000';
  }
  
  try {
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Handle 3-character hex
    if (hexColor.length === 3) {
      hexColor = hexColor[0] + hexColor[0] + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2];
    }
    
    // Validate hex format
    if (!/^[0-9A-F]{6}$/i.test(hexColor)) {
      console.warn('Invalid hex color format:', hexColor);
      return '#000000';
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // Handle NaN values that might occur with invalid hex colors
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn('Invalid RGB conversion in getContrastColor:', { r, g, b, hexColor });
      return '#000000';
    }
    
    // Use WCAG luminance formula for better contrast perception
    // L = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    
    // Return white for dark backgrounds, black for light backgrounds
    // Using a lower threshold (0.5) to ensure more text is white on medium-dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  } catch (error) {
    console.error('Error in getContrastColor:', error, { inputColor: hexColor });
    return '#000000'; // Default to black on error
  }
};

// Removed unused commented-out function: getAppropriateQuestionSize

const Flashcard = ({ card, onDelete, onFlip, onUpdateCard, showButtons = true, preview = false, style = {}, isInModal = false, onClick }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cardRef = useRef(null);
  
  // Apply card styles based on card data
  const cardStyle = {
    backgroundColor: card.cardColor || '#3cb44b',
    borderColor: card.boxNum === 5 ? 'gold' : 'transparent', // Gold border for mastered cards
    boxShadow: card.boxNum === 5 ? '0 0 10px rgba(255, 215, 0, 0.5)' : undefined,
    ...style // Apply any additional styles passed in
  };
  
  // Get contrast color for text based on background
  const textColor = card.textColor || getContrastColor(card.cardColor || '#3cb44b');
  
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

  // Determine if we have options for this card
  const isMultipleChoice = Boolean(card.options && Array.isArray(card.options) && card.options.length > 0);
  const questionText = card.front || card.question || '';
  const questionLengthClass = getQuestionClassByLength(questionText);
  
  // Check if card has additional information
  const hasAdditionalInfo = card.additionalInfo || card.detailedAnswer;
  
  // Special class for modal view and fullscreen
  const cardClass = `flashcard ${isFlipped ? 'flipped' : ''} ${card.boxNum === 5 ? 'mastered' : ''} ${preview ? 'preview-card' : ''} ${isInModal ? 'modal-card' : ''} ${isFullscreen ? 'fullscreen' : ''}`;
  
  // In the component, add a useEffect to set CSS variables based on card colors
  useEffect(() => {
    if (card.cardColor) {
      // Set CSS variables for use in styling options and other elements
      document.documentElement.style.setProperty('--card-bg-color', card.cardColor);
      
      // Calculate if text should be white or black based on background color brightness
      const r = parseInt(card.cardColor.slice(1, 3), 16);
      const g = parseInt(card.cardColor.slice(3, 5), 16);
      const b = parseInt(card.cardColor.slice(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      const textColor = brightness > 125 ? '#000000' : '#ffffff';
      document.documentElement.style.setProperty('--card-text-color', textColor);
    }
  }, [card.cardColor]);
  
  // Toggle fullscreen mode
  const toggleFullscreen = (e) => {
    e.stopPropagation(); // Prevent card flip
    setIsFullscreen(!isFullscreen);
  };
  
  return (
    <>
      <div 
        ref={cardRef}
        className={cardClass}
        onClick={handleClick}
        style={cardStyle}
      >
        {/* Buttons that should appear on both front and back */}
        {showButtons && !preview && (
          <div className="flashcard-buttons">
            <div className="card-buttons">
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
                          border: color === card.cardColor ? '2px solid white' : '2px solid transparent'
                        }}
                        onClick={() => handleColorChange(color)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flashcard-inner">
          <div className="flashcard-front flashcard-flip-area" style={{ 
            color: textColor,
            backgroundColor: card.cardColor || '#3cb44b',
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
                  <MultipleChoiceOptions 
                    options={card.options || []} 
                    preview={preview} 
                    isInModal={isInModal} 
                    card={{
                      ...card,
                      onUpdateOptions: (newOptions) => {
                        if (onUpdateCard && newOptions && newOptions.length > 0) {
                          // Update card with recovered options
                          onUpdateCard({
                            ...card,
                            options: newOptions,
                            savedOptions: newOptions,
                            questionType: 'multiple_choice'
                          });
                        }
                      }
                    }} 
                  />
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
            <ScaledText 
              maxFontSize={isInModal ? 24 : 16} 
              minFontSize={isInModal ? 8 : 6}
              isInModal={isInModal}
            >
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
          <div className="info-modal" onClick={(e) => e.stopPropagation()} style={{ '--card-bg-color': card.cardColor, '--card-text-color': getContrastColor(card.cardColor) }}>
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
      
      {/* Add fullscreen toggle button for mobile */}
      {!isInModal && (
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
