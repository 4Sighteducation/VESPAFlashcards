import React, { useState, useEffect, useRef } from "react";
import "./MobileSlideshow.css";
import Flashcard from './Flashcard';

/**
 * MobileSlideshow - A mobile-responsive slideshow component for flashcards
 * 
 * This component provides a fullscreen, gesture-based slideshow for viewing flashcards.
 * It supports swipe navigation, touch controls, and both portrait and landscape orientations.
 */
const MobileSlideshow = ({ 
  cards = [], 
  initialCardIndex = 0, 
  onClose,
  onDeleteCard,
  onUpdateCard
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialCardIndex);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [orientation, setOrientation] = useState(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
  const slideshowRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  
  // Handle window resize to detect orientation changes
  useEffect(() => {
    const handleResize = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Auto-hide controls after a period of inactivity
  useEffect(() => {
    if (showControls) {
      // Clear any existing timeout
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      // Set a new timeout to hide controls
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls]);
  
  // Reset swiping state if cards or currentIndex changes
  useEffect(() => {
    setIsSwiping(false);
    setSwipeDistance(0);
  }, [cards, currentIndex]);
  
  // Get the current card
  const currentCard = cards[currentIndex];
  
  // Navigate to the previous card
  const goToPrevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  // Navigate to the next card
  const goToNextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  // Show controls when the screen is tapped
  const handleScreenTap = (e) => {
    // Ignore taps on buttons
    if (e.target.closest('button')) return;
    
    // Toggle controls
    setShowControls(!showControls);
  };
  
  // Handle touch start event for swipe navigation
  const handleTouchStart = (e) => {
    setIsSwiping(true);
    setStartX(e.touches[0].clientX);
  };
  
  // Handle touch move event for swipe navigation
  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    
    const currentX = e.touches[0].clientX;
    const distance = currentX - startX;
    
    // Set the swipe distance (limited to prevent extreme values)
    setSwipeDistance(Math.min(Math.max(distance, -150), 150));
  };
  
  // Handle touch end event for swipe navigation
  const handleTouchEnd = () => {
    if (!isSwiping) return;
    
    // Determine if swipe was significant enough to change card
    if (swipeDistance > 80) {
      goToPrevCard();
    } else if (swipeDistance < -80) {
      goToNextCard();
    }
    
    // Reset swiping state
    setIsSwiping(false);
    setSwipeDistance(0);
  };
  
  // Prevent body scrolling when in the slideshow
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevCard();
          break;
        case 'ArrowRight':
          goToNextCard();
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, cards.length, onClose]);
  
  // If no cards, show a message
  if (!cards || cards.length === 0) {
    return (
      <div className="mobile-slideshow-overlay">
        <div className="mobile-slideshow-content">
          <div className="no-cards-message">
            <h3>No Cards Available</h3>
            <p>There are no flashcards to display.</p>
            <button className="close-slideshow-button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={`mobile-slideshow-overlay ${orientation}`}
      onClick={handleScreenTap}
      ref={slideshowRef}
    >
      <div 
        className={`mobile-slideshow-content ${isSwiping ? 'swiping' : ''}`}
        style={{
          transform: isSwiping ? `translateX(${swipeDistance}px)` : 'translateX(0)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mobile-slideshow-card-container">
          <Flashcard 
            card={currentCard}
            onDelete={() => onDeleteCard && onDeleteCard(currentCard.id)}
            onUpdateCard={onUpdateCard}
            isInModal={true}
            showButtons={true}
            style={{
              maxWidth: '100%',
              width: '100%',
              height: '100%',
              margin: 0,
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)'
            }}
          />
        </div>
        
        {/* Controls that can fade in/out */}
        <div className={`mobile-slideshow-controls ${showControls ? 'visible' : ''}`}>
          <button 
            className="close-slideshow-button" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ✕
          </button>
          
          <div className="card-info">
            <div className="card-counter">
              {currentIndex + 1} of {cards.length}
            </div>
            {currentCard.topic && (
              <div className="topic-info">
                {currentCard.subject} - {currentCard.topic}
              </div>
            )}
          </div>
          
          <div className="navigation-controls">
            <button 
              className="nav-button prev"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevCard();
              }}
              disabled={currentIndex <= 0}
            >
              Previous
            </button>
            <button 
              className="nav-button next"
              onClick={(e) => {
                e.stopPropagation();
                goToNextCard();
              }}
              disabled={currentIndex >= cards.length - 1}
            >
              Next
            </button>
          </div>
        </div>
        
        {/* Swipe indicators */}
        <div className={`swipe-indicator left ${currentIndex > 0 ? 'active' : ''}`}>
          <span className="arrow">←</span>
        </div>
        <div className={`swipe-indicator right ${currentIndex < cards.length - 1 ? 'active' : ''}`}>
          <span className="arrow">→</span>
        </div>
      </div>
    </div>
  );
};

export default MobileSlideshow; 