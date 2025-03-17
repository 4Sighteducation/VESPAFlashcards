import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './Flashcard.css';

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

// Enhanced ScaledText component with more aggressive font scaling
const ScaledText = ({ children, className = '', maxFontSize = 18, minFontSize = 3, isInModal = false }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  
  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current || !textRef.current) return;
      
      const container = containerRef.current;
      const textElement = textRef.current;
      const contentLength = children ? children.toString().length : 0;
      
      // Check if we're on a mobile device
      const isMobile = window.innerWidth <= 768;
      const isVerySmallScreen = window.innerWidth <= 480;
      
      // Further reduce starting font size for longer content
      let startFontSize = maxFontSize;
      
      if (isInModal) {
        // More aggressive scaling for modal view on mobile
        if (isMobile) {
          startFontSize = isVerySmallScreen ? 16 : 18;
          if (contentLength > 300) startFontSize = Math.min(startFontSize, 12);
          if (contentLength > 200) startFontSize = Math.min(startFontSize, 10);
          if (contentLength > 100) startFontSize = Math.min(startFontSize, 8);
          if (contentLength > 50) startFontSize = Math.min(startFontSize, 12);
        } else {
          // Desktop modal sizing
          startFontSize = maxFontSize;
          if (contentLength > 500) startFontSize = Math.min(startFontSize, 16);
          if (contentLength > 300) startFontSize = Math.min(startFontSize, 14);
          if (contentLength > 200) startFontSize = Math.min(startFontSize, 12);
          if (contentLength > 100) startFontSize = Math.min(startFontSize, 10);
        }
      } else {
        // Regular view - more aggressive for mobile
        if (isMobile) {
          startFontSize = isVerySmallScreen ? 14 : 16;
          if (contentLength > 300) startFontSize = Math.min(startFontSize, 10);
          if (contentLength > 200) startFontSize = Math.min(startFontSize, 9);
          if (contentLength > 100) startFontSize = Math.min(startFontSize, 8);
          if (contentLength > 50) startFontSize = Math.min(startFontSize, 10);
        } else {
          // Desktop regular sizing
          if (contentLength > 500) startFontSize = Math.min(startFontSize, 14);
          if (contentLength > 300) startFontSize = Math.min(startFontSize, 13);
          if (contentLength > 200) startFontSize = Math.min(startFontSize, 12);
          if (contentLength > 100) startFontSize = Math.min(startFontSize, 11);
          if (contentLength > 50) startFontSize = Math.min(startFontSize, 14);
        }
      }
      
      // Special handling for multiple choice questions - ensure they have enough space
      if (className.includes('question-title') && container.closest('.flashcard-front')?.querySelector('.options-container')) {
        // If this is a multiple choice question, reduce the font size further to leave room for options
        startFontSize = Math.min(startFontSize, isMobile ? 12 : 14);
        if (contentLength > 100) startFontSize = Math.min(startFontSize, isMobile ? 10 : 12);
      }
      
      // Debug output for initial sizing
      console.log(`ScaledText length: ${contentLength}, starting fontSize: ${startFontSize}, modal: ${isInModal}, mobile: ${isMobile}`);
      
      // Binary search for optimal font size
      let low = minFontSize;
      let high = startFontSize;
      let bestFontSize = minFontSize;
      let iterations = 0;
      
      while (low <= high && iterations < 20) {
        iterations++;
        const mid = Math.floor((low + high) / 2);
        textElement.style.fontSize = `${mid}px`;
        
        // Check if text overflows
        const isOverflowing = 
          textElement.scrollHeight > container.clientHeight || 
          textElement.scrollWidth > container.clientWidth;
        
        if (isOverflowing) {
          high = mid - 0.5;
        } else {
          bestFontSize = mid;
          low = mid + 0.5;
        }
      }
      
      // For mobile modal view, be even more aggressive to ensure no scrollbars
      if (isInModal && isMobile && bestFontSize > 6) {
        bestFontSize = Math.min(bestFontSize, isVerySmallScreen ? 14 : 16);
      }
      
      // Ensure minimum readable size for questions
      if (className.includes('question-title') && bestFontSize < 11 && !isMobile) {
        bestFontSize = Math.max(bestFontSize, 11);
      } else if (className.includes('question-title') && bestFontSize < 8 && isMobile) {
        bestFontSize = Math.max(bestFontSize, 8); // Lower minimum for mobile
      }
      
      // Set final font size
      textElement.style.fontSize = `${bestFontSize}px`;
      console.log(`ScaledText final fontSize: ${bestFontSize} after ${iterations} iterations`);
      
      // Add class based on font size for additional styling
      container.classList.remove('very-small-text', 'small-text');
      if (bestFontSize <= 6) {
        container.classList.add('very-small-text');
      } else if (bestFontSize <= 9) {
        container.classList.add('small-text');
      }
    };
    
    adjustFontSize();
    window.addEventListener('resize', adjustFontSize);
    
    return () => window.removeEventListener('resize', adjustFontSize);
  }, [children, maxFontSize, minFontSize, isInModal, className]);
  
  return (
    <div className={`scaled-text ${className}`} ref={containerRef}>
      <div ref={textRef}>{children}</div>
    </div>
  );
};

// Improved component for multiple choice options with more responsive scaling
const MultipleChoiceOptions = ({ options, preview = false, isInModal = false }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current || !options || options.length === 0) return;
    
    // Restart auto-scaling after render
    const timer = setTimeout(() => {
      autoScaleOptions();
    }, 0);
    
    return () => {
      clearTimeout(timer);
    };
  }, [options]);
  
  // Automatically scale the options to fit within the container
  const autoScaleOptions = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const items = Array.from(container.querySelectorAll('li'));
    
    if (items.length === 0) return;
    
    // Calculate content properties to inform scaling
    const lengths = items.map(item => item.textContent.length);
    const maxLength = Math.max(...lengths);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    
    // Set starting font size based on content length, number of options, and container width
    const containerWidth = container.clientWidth;
    const isMobile = window.innerWidth <= 768;
    const isVerySmallScreen = window.innerWidth <= 480;
    
    // Adjust starting font size based on screen size and content
    let fontSize = isInModal ? 14 : 12; // Default

    // More aggressive font size reduction for mobile modal view
    if (isInModal && isMobile) {
      fontSize = isVerySmallScreen ? 11 : 13;
    }
    // Smaller starting size for regular mobile view
    else if (isMobile) {
      fontSize = isVerySmallScreen ? 9 : 10;
    }
    
    // Adjust based on number of options
    if (options.length >= 5) {
      fontSize = Math.min(fontSize, isMobile ? 8 : (isInModal ? 12 : 10));
    } else if (options.length >= 4) {
      fontSize = Math.min(fontSize, isMobile ? 9 : (isInModal ? 13 : 11));
    }
    
    // Further adjust based on content length
    if (maxLength > 100) {
      fontSize = Math.min(fontSize, isMobile ? 7 : (isInModal ? 10 : 8));
    } else if (avgLength > 50) {
      fontSize = Math.min(fontSize, isMobile ? 8 : (isInModal ? 11 : 9));
    }
    
    // Special handling for preview mode in card generation
    if (preview) {
      // In preview mode, we want to ensure the options are readable
      fontSize = Math.min(fontSize, isMobile ? 9 : 11);
      
      // For very long options in preview, be more aggressive
      if (maxLength > 80) {
        fontSize = Math.min(fontSize, isMobile ? 7 : 9);
      }
    }
    
    // Debug output
    console.log(`MultipleChoice options: ${options.length}, max length: ${maxLength}, avg length: ${avgLength.toFixed(1)}, container width: ${containerWidth}, starting fontSize: ${fontSize}, mobile: ${isMobile}, preview: ${preview}`);
    
    // Reset all items to the starting fontSize
    items.forEach(item => {
      item.style.fontSize = `${fontSize}px`;
    });
    
    // Check if container is overflowing - be more aggressive on smaller screens
    let isOverflowing = container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth;
    
    // If overflowing, reduce font size until it fits
    if (isOverflowing) {
      let attempts = 0;
      const minFontSize = isMobile ? 3 : 4; // More aggressive for mobile
      const step = isMobile ? 0.75 : 0.5; // Larger steps for mobile
      
      while (fontSize > minFontSize && isOverflowing && attempts < 25) {
        fontSize -= step;
        items.forEach(item => {
          item.style.fontSize = `${fontSize}px`;
        });
        attempts++;
        isOverflowing = container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth;
      }
      
      // If we're in a modal and still struggling, try other adjustments
      if (isInModal && isMobile && isOverflowing) {
        container.style.overflow = 'visible';
        items.forEach(item => {
          item.style.lineHeight = "1";
          item.style.padding = "1px 4px";
          item.style.margin = "1px 0";
        });
      }
      // If we hit minimum font size and still overflowing, reduce line height
      else if (fontSize <= minFontSize && isOverflowing) {
        items.forEach(item => {
          item.style.lineHeight = "1";
          item.style.padding = "1px 0";
          item.style.margin = "1px 0";
        });
      }
      
      // Special handling for preview mode if still overflowing
      if (preview && isOverflowing) {
        items.forEach(item => {
          item.style.lineHeight = "1";
          item.style.padding = "1px 2px";
          item.style.margin = "1px 0";
          // Limit to 2 lines in preview mode
          item.style.webkitLineClamp = "2";
        });
      }
    }
    
    console.log(`MultipleChoice options final fontSize: ${fontSize}`);
    
    // Add classes to adjust styles based on font size
    container.classList.remove('small-font-options', 'very-small-font-options', 'tiny-font-options');
    
    if (fontSize <= 5) {
      container.classList.add('tiny-font-options');
    } else if (fontSize <= 7) {
      container.classList.add('very-small-font-options');
    } else if (fontSize <= 9) {
      container.classList.add('small-font-options');
    }
  };
  
  // Enhanced option cleaning to handle various prefix formats
  const cleanedOptions = options.map(option => {
    if (!option) return '';
    
    // Handle different letter prefix formats:
    // Format 1: "a) Option text"
    // Format 2: "a. Option text"
    // Format 3: "(a) Option text"
    // Format 4: "a - Option text"
    
    return option
      .replace(/^[a-z]\)\s*/i, '') // Format 1
      .replace(/^[a-z]\.\s*/i, '') // Format 2
      .replace(/^\([a-z]\)\s*/i, '') // Format 3
      .replace(/^[a-z]\s*-\s*/i, ''); // Format 4
  });
  
  return (
    <div className={`options-container ${isInModal ? 'modal-options' : ''} ${preview ? 'preview-options' : ''}`} ref={containerRef}>
      <ol type="a">
        {cleanedOptions.map((option, index) => (
          <li key={index}>
            <span className="option-letter">{String.fromCharCode(97 + index)})</span> {option}
          </li>
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
  
  // Determine if this is a multiple choice card
  const isMultipleChoice = card.questionType === 'multiple_choice' && Array.isArray(card.options);
  
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
          </>
        )}
        
        <div className="flashcard-inner">
          <div className="flashcard-front" style={{ 
            color: textColor,
            backgroundColor: card.cardColor || '#3cb44b',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            width: '100%',
            position: 'absolute',
            boxSizing: 'border-box'
          }}>
            {card.topic && !preview && (
              <div className="card-topic-indicator" style={{ color: textColor }}>
                {card.topic}
              </div>
            )}
            {isMultipleChoice ? (
              <>
                <ScaledText 
                  className="question-title" 
                  maxFontSize={isInModal ? 28 : 18} 
                  minFontSize={isInModal ? 8 : 6}
                  isInModal={isInModal}
                >
                  {card.front || card.question || "No question available"}
                </ScaledText>
                <MultipleChoiceOptions options={card.options || []} preview={preview} isInModal={isInModal} />
              </>
            ) : (
              <ScaledText 
                maxFontSize={isInModal ? 28 : 18} 
                minFontSize={isInModal ? 8 : 6}
                isInModal={isInModal}
              >
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
            backgroundColor: '#ffffff',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            width: '100%',
            position: 'absolute',
            boxSizing: 'border-box'
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
