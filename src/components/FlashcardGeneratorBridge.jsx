import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import AICardGeneratorService from '../services/AICardGeneratorService';
import LoadingSpinner from './LoadingSpinner';
import './SimpleCardGeneratorModal.css';

/**
 * FlashcardGeneratorBridge - A simplified flashcard generator modal
 * 
 * This component provides a streamlined interface for generating cards from a topic,
 * without requiring the user to re-enter metadata that's already associated with the topic.
 */
const FlashcardGeneratorBridge = ({ 
  topic, 
  onClose, 
  onAddCards,
  userId,
  recordId
}) => {
  // Track generation and UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedCards, setGeneratedCards] = useState([]);
  const [step, setStep] = useState(1); // 1: Options selection, 2: Review cards
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // Card generation options
  const [cardType, setCardType] = useState('multiple_choice');
  const [cardCount, setCardCount] = useState(1);
  
  // Handle generating the cards
  const generateCards = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setLoadingMessage("Generating flashcards with AI...");
    
    try {
      // Make sure we have all the required metadata
      if (!topic || !topic.subject) {
        throw new Error("Missing required topic information");
      }
      
      // Prepare the request data
      const requestData = {
        subject: topic.subject,
        topic: topic.topic || topic.name, // Use either topic or name field
        examBoard: topic.examBoard || 'General',
        examType: topic.examType || 'General',
        cardType: cardType,
        count: cardCount,
        userId: userId,
        recordId: recordId
      };
      
      console.log("[FlashcardGeneratorBridge] Generating cards with:", requestData);
      
      // Call the AI service to generate cards
      const results = await AICardGeneratorService.generateCards(requestData);
      
      if (!results || !Array.isArray(results)) {
        throw new Error("Invalid response from AI service");
      }
      
      // Process the generated cards
      const cards = results.map(card => ({
        ...card,
        // Ensure the cards have the correct metadata
        subject: topic.subject,
        topic: topic.topic || topic.name,
        examBoard: topic.examBoard || 'General',
        examType: topic.examType || 'General',
        // Generate a unique ID for each card
        id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        // Set the card color from the topic if available
        cardColor: topic.color || topic.topicColor || '#3cb44b',
        // Add creation timestamp
        createdAt: new Date().toISOString()
      }));
      
      console.log("[FlashcardGeneratorBridge] Cards generated:", cards);
      
      // Store the generated cards and move to review step
      setGeneratedCards(cards);
      setStep(2);
    } catch (err) {
      console.error("[FlashcardGeneratorBridge] Error generating cards:", err);
      setError(err.message || "Failed to generate cards. Please try again.");
    } finally {
      setIsGenerating(false);
      setLoadingMessage("");
    }
  }, [topic, cardType, cardCount, userId, recordId]);
  
  // Handle saving the cards to the main app
  const handleSaveCards = useCallback(() => {
    try {
      // Add each card to the app's state
      generatedCards.forEach(card => {
        if (onAddCards) {
          onAddCards(card);
        }
      });
      
      console.log(`[FlashcardGeneratorBridge] Saved ${generatedCards.length} cards`);
      
      // Close the modal
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("[FlashcardGeneratorBridge] Error saving cards:", err);
      setError(err.message || "Failed to save cards. Please try again.");
    }
  }, [generatedCards, onAddCards, onClose]);
  
  // Render the step for selecting card options
  const renderOptionsStep = () => (
    <div className="card-generator-options">
      <h3>Generate Flashcards for {topic.subject}: {topic.topic || topic.name}</h3>
      
      <div className="option-section">
        <label>Card Type</label>
        <div className="option-buttons">
          <button 
            className={`option-button ${cardType === 'multiple_choice' ? 'selected' : ''}`}
            onClick={() => setCardType('multiple_choice')}
          >
            Multiple Choice
          </button>
          <button 
            className={`option-button ${cardType === 'short_answer' ? 'selected' : ''}`}
            onClick={() => setCardType('short_answer')}
          >
            Short Answer
          </button>
          <button 
            className={`option-button ${cardType === 'essay' ? 'selected' : ''}`}
            onClick={() => setCardType('essay')}
          >
            Essay Style
          </button>
          <button 
            className={`option-button ${cardType === 'acronym' ? 'selected' : ''}`}
            onClick={() => setCardType('acronym')}
          >
            Acronym
          </button>
        </div>
      </div>
      
      <div className="option-section">
        <label>Number of Cards</label>
        <div className="option-buttons">
          <button 
            className={`option-button ${cardCount === 1 ? 'selected' : ''}`}
            onClick={() => setCardCount(1)}
          >
            1
          </button>
          <button 
            className={`option-button ${cardCount === 3 ? 'selected' : ''}`}
            onClick={() => setCardCount(3)}
          >
            3
          </button>
          <button 
            className={`option-button ${cardCount === 5 ? 'selected' : ''}`}
            onClick={() => setCardCount(5)}
          >
            5
          </button>
          <button 
            className={`option-button ${cardCount === 10 ? 'selected' : ''}`}
            onClick={() => setCardCount(10)}
          >
            10
          </button>
        </div>
      </div>
      
      <div className="option-section options-actions">
        <button className="cancel-button" onClick={onClose}>
          Cancel
        </button>
        <button 
          className="generate-button" 
          onClick={generateCards}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Cards'}
        </button>
      </div>
    </div>
  );
  
  // Render the step for reviewing generated cards
  const renderReviewStep = () => (
    <div className="card-generator-review">
      <h3>Review Generated Flashcards</h3>
      
      <div className="card-preview-list">
        {generatedCards.map((card, index) => (
          <div key={card.id || index} className="card-preview">
            <div className="card-preview-header">
              <h4>Card {index + 1}</h4>
              <span className="card-type-badge">
                {card.type === 'multiple_choice' ? 'Multiple Choice' : 
                 card.type === 'short_answer' ? 'Short Answer' :
                 card.type === 'essay' ? 'Essay Style' : 'Acronym'}
              </span>
            </div>
            
            <div className="card-preview-content">
              <div className="card-preview-question">
                <strong>Question:</strong>
                <div>{card.question}</div>
              </div>
              
              <div className="card-preview-answer">
                <strong>Answer:</strong>
                <div>{card.answer}</div>
              </div>
              
              {card.type === 'multiple_choice' && card.options && card.options.length > 0 && (
                <div className="card-preview-options">
                  <strong>Options:</strong>
                  <ul>
                    {card.options.map((option, optIndex) => (
                      <li 
                        key={optIndex} 
                        className={option === card.answer ? 'correct-option' : ''}
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="option-section options-actions">
        <button 
          className="cancel-button" 
          onClick={() => setStep(1)}
        >
          Back
        </button>
        <button 
          className="save-button" 
          onClick={handleSaveCards}
        >
          Save All Cards
        </button>
      </div>
    </div>
  );
  
  // Main render function
  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="simple-card-generator-modal" onClick={e => e.stopPropagation()}>
        <button className="close-modal-button" onClick={onClose}>
          <FaTimes />
        </button>
        
        {isGenerating ? (
          <div className="generating-overlay">
            <LoadingSpinner message={loadingMessage || "Generating..."} />
          </div>
        ) : error ? (
          <div className="error-message">
            <h3>Error</h3>
            <p>{error}</p>
            <button 
              className="try-again-button" 
              onClick={() => {
                setError(null);
                setStep(1);
              }}
            >
              Try Again
            </button>
          </div>
        ) : step === 1 ? (
          renderOptionsStep()
        ) : (
          renderReviewStep()
        )}
      </div>
    </div>
  );
  
  // Use portal to render the modal on top of everything else
  return createPortal(modalContent, document.body);
};

export default FlashcardGeneratorBridge;
