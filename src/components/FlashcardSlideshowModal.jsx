import React, { useState, useEffect } from 'react';
import FlippableCard from './FlippableCard';
import './Flashcard.css'; // Reuse existing CSS

const FlashcardSlideshowModal = ({ 
  cards = [],
  topicName = '',
  isOpen = false,
  onClose,
  onUpdateCard,
  mode = 'bank', // 'bank' or 'review'
  topicColor
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Reset state when cards change
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [cards]);
  
  // Handle navigation
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };
  
  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };
  
  // Handle card flip
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  // Handle answer selection for review mode
  const handleAnswer = (isCorrect, selectedOption) => {
    if (mode === 'review' && onUpdateCard && cards[currentIndex]) {
      const card = cards[currentIndex];
      // Calculate new box number based on Leitner system
      const oldBoxNum = card.boxNum || 1;
      const newBoxNum = isCorrect 
        ? Math.min(oldBoxNum + 1, 5) // Move up one box, max 5
        : 1; // Always back to box 1 if wrong
      
      // Calculate next review date based on new box
      const now = new Date();
      const nextReviewDate = new Date();
      
      switch (newBoxNum) {
        case 1: // Every day
          nextReviewDate.setDate(now.getDate() + 1);
          break;
        case 2: // Every other day
          nextReviewDate.setDate(now.getDate() + 2);
          break;
        case 3: // Every 3 days
          nextReviewDate.setDate(now.getDate() + 3);
          break;
        case 4: // Every week
          nextReviewDate.setDate(now.getDate() + 7);
          break;
        case 5: // "Retired" - 14 days (2 weeks)
          nextReviewDate.setDate(now.getDate() + 14); // Using 14 days for Box 5 to match SpacedRepetition
          break;
        default:
          nextReviewDate.setDate(now.getDate() + 1);
      }
      
      // Update the card
      onUpdateCard({
        ...card,
        boxNum: newBoxNum,
        lastReviewed: now.toISOString(),
        nextReviewDate: nextReviewDate.toISOString()
      });
    }
  };
  
  // If the modal is not open, render nothing
  if (!isOpen) return null;
  
  // If there are no cards
  if (cards.length === 0) {
    return (
      <div className="modal-overlay card-modal-overlay" onClick={onClose}>
        <div className="modal-content card-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-modal-button" onClick={onClose}>×</button>
          <div className="card-modal-card-container">
            <div className="no-cards-message">
              <h3>No cards found for this topic yet.</h3>
              {mode === 'bank' && (
                <p>Click "Create" to generate new flashcards for this topic.</p>
              )}
            </div>
          </div>
          <div className="card-modal-actions">
            <div className="card-info">
              <div className="topic-info">{topicName}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const currentCard = cards[currentIndex] || null;
  
  return (
    <div className="modal-overlay card-modal-overlay" onClick={onClose}>
      <div className="modal-content card-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-button" onClick={onClose}>×</button>
        
        <div className="card-modal-card-container">
          <FlippableCard
            card={currentCard}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            onAnswer={handleAnswer}
            isInModal={true}
          />
        </div>
        
        <div className="card-modal-actions">
          <div className="nav-buttons">
            <button 
              className="nav-button" 
              onClick={handlePrevious} 
              disabled={currentIndex === 0}
            >
              ← Previous
            </button>
            
            <button 
              className="nav-button" 
              onClick={handleFlip}
            >
              Flip
            </button>
            
            <button 
              className="nav-button" 
              onClick={handleNext}
              disabled={currentIndex === cards.length - 1}
            >
              Next →
            </button>
          </div>
          
          <div className="card-info">
            <div className="card-counter">
              Card {currentIndex + 1} of {cards.length}
            </div>
            <div className="topic-info">{topicName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardSlideshowModal; 