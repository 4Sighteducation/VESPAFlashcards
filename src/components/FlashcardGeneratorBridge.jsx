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
  const [errorDetails, setErrorDetails] = useState(null);
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
      console.log("[FlashcardGeneratorBridge] Starting card generation process...");
      // Make sure we have all the required metadata
      if (!topic || !topic.subject) {
        throw new Error("Missing required topic information");
      }
      
      console.log("[FlashcardGeneratorBridge] Topic metadata:", {
        subject: topic.subject,
        topic: topic.topic || topic.name,
        examBoard: topic.examBoard,
        examType: topic.examType
      });
      
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
      console.log("[FlashcardGeneratorBridge] Calling AI service with:", requestData);
      const results = await AICardGeneratorService.generateCards(requestData);
      
      console.log("[FlashcardGeneratorBridge] AI service response:", results);
      
      if (!results) {
        throw new Error("Empty response from AI service");
      }
      
      if (!Array.isArray(results)) {
        console.error("[FlashcardGeneratorBridge] Response is not an array:", results);
        throw new Error("Invalid response format from AI service (expected array but got " + typeof results + ")");
      }
      
      // Process the generated cards
      const cards = results.map(card => {
        // Special processing for acronym cards which have a different structure
        if (cardType === 'acronym' && card.acronym && card.explanation) {
          return {
            ...card,
            // Add missing fields expected by the card system
            question: `What does the acronym "${card.acronym}" stand for?`,
            answer: card.explanation,
            front: `What does the acronym "${card.acronym}" stand for?`,
            back: card.explanation,
            type: 'acronym',
            questionType: 'acronym',
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
          };
        }
        
        // Regular card processing for other card types
        return {
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
        };
      });
      
      console.log("[FlashcardGeneratorBridge] Cards generated:", cards);
      
      // Store the generated cards and move to review step
      setGeneratedCards(cards);
      setStep(2);
    } catch (err) {
      console.error("[FlashcardGeneratorBridge] Error generating cards:", err);
      setError(err.message || "Failed to generate cards. Please try again.");
      setErrorDetails(err.stack || "No detailed error information available");
      
      // Log detailed debugging information
      console.log("[FlashcardGeneratorBridge] Error context:", {
        error: err,
        topicInfo: topic,
        cardType,
        cardCount
      });
    } finally {
      setIsGenerating(false);
      setLoadingMessage("");
    }
  }, [topic, cardType, cardCount, userId, recordId]);
  
  // Handle saving the cards to the main app
  const handleSaveCards = useCallback(() => {
    try {
      if (!generatedCards || generatedCards.length === 0) {
        console.error("[FlashcardGeneratorBridge] No cards to save");
        setError("No cards to save. Please generate cards first.");
        return;
      }
      
      console.log(`[FlashcardGeneratorBridge] Saving ${generatedCards.length} cards`);
      
      // Check if we have topic info
      if (!topic || !topic.subject || !topic.topic) {
        console.error("[FlashcardGeneratorBridge] Missing topic information for saving cards");
        setError("Missing topic information for saving cards");
        return;
      }
      
      // Important: Add the topic ID to each card to ensure it's saved to the correct topic
      const topicId = topic.id || `topic_${topic.subject}_${topic.topic}`; 
      
      // Process cards with topic information and ID before saving
      const processedCards = generatedCards.map(card => ({
        ...card,
        topicId: topicId,
        // Ensure subject/topic match the parent topic
        subject: topic.subject,
        topic: topic.topic,
        examBoard: topic.examBoard || card.examBoard || "General",
        examType: topic.examType || card.examType || "Course"
      }));
      
      // Log the processed cards with their topic IDs
      console.log(`[FlashcardGeneratorBridge] Processed cards with topic ID: ${topicId}`, processedCards);
      
      // Add each card to the app's state one by one to ensure they're added properly
      processedCards.forEach(card => {
        if (onAddCards) {
          console.log(`[FlashcardGeneratorBridge] Adding card to app state: ${card.id}`, card);
          onAddCards(card);
        } else {
          console.warn("[FlashcardGeneratorBridge] No onAddCards handler provided");
        }
      });
      
      console.log(`[FlashcardGeneratorBridge] Saved ${processedCards.length} cards`);
      
      // Close the modal
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("[FlashcardGeneratorBridge] Error saving cards:", err);
      setError(err.message || "Failed to save cards. Please try again.");
    }
  }, [generatedCards, onAddCards, onClose, topic]);
  
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
          <h3>Error occurred from AI service</h3>
          <p>{error}</p>
          {errorDetails && (
            <div className="error-details">
              <p><strong>Technical details:</strong></p>
              <pre style={{ maxHeight: '150px', overflow: 'auto', background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
                {errorDetails}
              </pre>
            </div>
          )}
          <button 
            className="try-again-button" 
            onClick={() => {
              setError(null);
              setErrorDetails(null);
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
