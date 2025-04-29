import React, { useState, useCallback } from 'react';
import FlashcardSlideshowModal from './FlashcardSlideshowModal';
import CardService from '../services/CardService';
import './Flashcard.css';
import './FlashcardList.css';
import './FlashcardGenerator.css';

// Constants for question types
const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "essay", label: "Essay Style" },
  { value: "acronym", label: "Acronym" }
];

/**
 * FlashcardGenerator - Simplified modal for generating flashcards
 * 
 * This component takes topic metadata and handles:
 * 1. Selecting card type and quantity
 * 2. Generating cards via API
 * 3. Showing results in a slideshow modal
 * 4. Saving cards to the user's card bank
 */
const FlashcardGenerator = ({
  isOpen = false,
  onClose,
  onSaveCards,
  topicId,
  topicName,
  subject,
  examType,
  examBoard,
  topicColor,
}) => {
  // Simple state - just what we need
  const [formData, setFormData] = useState({
    questionType: "multiple_choice",
    numCards: 5
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedCards, setGeneratedCards] = useState([]);
  const [showSlideshow, setShowSlideshow] = useState(false);
  
  // Update form data
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };
  
  // Generate cards from the backend using CardService
  const handleGenerateCards = useCallback(async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratedCards([]);
    
    try {
      // Use CardService to generate cards
      const cards = await CardService.generateCards({
        subject,
        topic: topicName,
        examType,
        examBoard,
        questionType: formData.questionType,
        numCards: formData.numCards,
        topicId,
        topicColor
      });
      
      setGeneratedCards(cards);
      setShowSlideshow(true);
    } catch (err) {
      console.error('Error generating cards:', err);
      setError(`Failed to generate cards: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating, 
    subject, 
    topicName, 
    examType, 
    examBoard, 
    formData.questionType, 
    formData.numCards,
    topicId,
    topicColor
  ]);
  
  // Add cards to the user's card bank
  const handleSaveCards = useCallback(() => {
    if (onSaveCards && generatedCards.length > 0) {
      onSaveCards(generatedCards);
      setShowSlideshow(false);
      onClose();
    }
  }, [generatedCards, onSaveCards, onClose]);
  
  // Add a single card to the bank
  const handleSaveCard = useCallback((cardIndex) => {
    if (onSaveCards && generatedCards[cardIndex]) {
      onSaveCards([generatedCards[cardIndex]]);
      
      // Remove the saved card from the generated list
      setGeneratedCards(prev => 
        prev.filter((_, index) => index !== cardIndex)
      );
      
      // If all cards are saved, close the slideshow
      if (generatedCards.length === 1) {
        setShowSlideshow(false);
      }
    }
  }, [generatedCards, onSaveCards]);
  
  // If not open, return null
  if (!isOpen) return null;
  
  // Render the slideshow if we have generated cards
  if (showSlideshow && generatedCards.length > 0) {
    return (
      <div className="modal-overlay" onClick={() => setShowSlideshow(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={() => setShowSlideshow(false)}>×</button>
          
          <h3>Generated Flashcards</h3>
          <FlashcardSlideshowModal
            cards={generatedCards}
            topicName={topicName}
            isOpen={true}
            onClose={() => setShowSlideshow(false)}
            mode="bank"
            topicColor={topicColor}
          />
          
          <div className="modal-actions">
            <button 
              className="primary-button"
              onClick={handleSaveCards}
              disabled={generatedCards.length === 0}
            >
              Save All Cards
            </button>
            <button 
              className="secondary-button"
              onClick={handleGenerateCards}
              disabled={isGenerating}
            >
              Regenerate Cards
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Main Form
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        
        <h3>Generate Flashcards for {topicName}</h3>
        
        <div className="form-group">
          <label htmlFor="questionType">Card Type:</label>
          <select
            id="questionType"
            name="questionType"
            value={formData.questionType}
            onChange={handleChange}
            className="form-control"
          >
            {QUESTION_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="numCards">Number of Cards:</label>
          <input
            id="numCards"
            name="numCards"
            type="number"
            min="1"
            max="10"
            value={formData.numCards}
            onChange={handleChange}
            className="form-control"
          />
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="modal-actions">
          <button
            className="primary-button"
            onClick={handleGenerateCards}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Cards'}
          </button>
        </div>
        
        <div className="metadata-summary">
          <p>Subject: {subject}</p>
          <p>Topic: {topicName}</p>
          <p>Exam: {examBoard} {examType}</p>
        </div>
      </div>
    </div>
  );
};

export default FlashcardGenerator; 