import React, { useState, useEffect, useCallback, useRef } from "react";
import AICardGeneratorService from '../services/AICardGeneratorService';
import saveQueueService from '../services/SaveQueueService';
import { getContrastColor } from '../utils/ColorUtils';
import FlippableCard from './FlippableCard';
import "./SimpleCardGeneratorModal.css";

// Constants for question types
const QUESTION_TYPES = [
  { value: "short_answer", label: "Short Answer" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay", label: "Essay Style" },
  { value: "acronym", label: "Acronym" }
];

/**
 * SimpleCardGeneratorModal - A streamlined card generator that avoids render loops
 * This modal provides a minimal interface for generating flashcards without the complexity
 * of the original AICardGenerator component.
 */
const SimpleCardGeneratorModal = ({
  // Topic data (passed directly from Topic Hub)
  topicData = {},
  // Callbacks
  onClose,
  onAddCards,
  // User-related props
  userId,
  recordId
}) => {
  // Extract important metadata from topicData
  const {
    subject = "General",
    topic = "General",
    examBoard = "General",
    examType = "General",
    id: topicId = null,
    color: topicColor = "#3cb44b"
  } = topicData;

  // Track mount state to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Basic state
  const [step, setStep] = useState(1); // 1: Options, 2: Review cards
  const [numCards, setNumCards] = useState(5);
  const [questionType, setQuestionType] = useState('multiple_choice');
  const [generatedCards, setGeneratedCards] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [contentGuidance, setContentGuidance] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      dlog("SimpleCardGeneratorModal unmounted, preventing further state updates");
    };
  }, []);

  // Generate cards function that calls the API
  const generateCards = useCallback(async () => {
    if (!isMounted.current) return;
    
    setIsGenerating(true);
    setError(null);
    setLoadingStatus('Requesting AI-generated flashcards...');
    
    try {
      // Call the API service
      const cardData = await AICardGeneratorService.generateCards({
        subject,
        topic,
        examType,
        examBoard,
        questionType,
        numCards,
        contentGuidance
      });
      
      // Process the response data
      if (!Array.isArray(cardData)) {
        throw new Error("API did not return an array of cards");
      }
      
      // Use the service to process cards with metadata
      const processedCards = AICardGeneratorService.processCards(cardData, {
        subject,
        topic,
        examType,
        examBoard,
        cardColor: topicColor,
        textColor: getContrastColor(topicColor),
        topicId
      });
      
      dlog(`[SimpleCardGeneratorModal] Generated ${processedCards.length} cards`);
      
      if (isMounted.current) {
        setGeneratedCards(processedCards);
        setIsGenerating(false);
        setLoadingStatus(`${processedCards.length} Cards generated successfully.`);
      }
    } catch (error) {
      derr("[SimpleCardGeneratorModal] Card generation failed:", error);
      if (isMounted.current) {
        setError(`AI Generation Error: ${error.message || 'Unknown error'}`);
        setIsGenerating(false);
        setLoadingStatus('Error occurred.');
      }
    }
  }, [subject, topic, examType, examBoard, questionType, numCards, contentGuidance, topicColor, topicId]);

  // Handle adding a single card to the bank
  const handleAddCard = useCallback(async (card) => {
    if (!card || !card.id) {
      derr("[SimpleCardGeneratorModal] Invalid card data:", card);
      setError("Cannot add invalid card data.");
      return;
    }
    
    try {
      // Use current metadata values
      const enrichedCard = {
        ...card,
        subject,
        topic,
        examBoard,
        examType,
        topicId,
        cardColor: topicColor,
        textColor: getContrastColor(topicColor),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date().toISOString(),
        boxNum: 1, // Start in box 1 for Leitner system
      };
      
      // Add card to save queue
      await saveQueueService.add("ADD_CARD_TO_BANK", {
        recordId: recordId || window.recordId || '',
        userId: userId || window.VESPA_USER_ID || "current_user",
        card: enrichedCard
      });
      
      // Update UI state
      if (isMounted.current) {
        setGeneratedCards(prev => prev.filter(c => c.id !== card.id));
        setSavedCount(prev => prev + 1);
        setShowSuccessMessage(true);
        
        // Auto-hide success message after 2 seconds
        setTimeout(() => {
          if (isMounted.current) {
            setShowSuccessMessage(false);
          }
        }, 2000);
      }
      
      // Call the callback if provided
      if (onAddCards && typeof onAddCards === 'function') {
        onAddCards([enrichedCard]);
      }
      
      return true;
    } catch (error) {
      derr("[SimpleCardGeneratorModal] Error adding card:", error);
      setError(`Error adding card: ${error.message}`);
      return false;
    }
  }, [subject, topic, examBoard, examType, topicId, topicColor, recordId, userId, onAddCards]);

  // Handle adding all cards at once
  const handleAddAllCards = useCallback(async () => {
    if (!generatedCards.length) {
      setError("No cards to add.");
      return;
    }
    
    try {
      // Enrich all cards with consistent metadata
      const cardsToAdd = generatedCards.map(card => ({
        ...card,
        subject,
        topic,
        examBoard,
        examType,
        topicId,
        cardColor: topicColor,
        textColor: getContrastColor(topicColor),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date().toISOString(),
        boxNum: 1
      }));
      
      // Add all cards to save queue
      await saveQueueService.add("ADD_CARDS_BATCH", {
        recordId: recordId || window.recordId || '',
        userId: userId || window.VESPA_USER_ID || "current_user",
        cards: cardsToAdd
      });
      
      // Update UI state
      if (isMounted.current) {
        setSavedCount(prev => prev + cardsToAdd.length);
        setGeneratedCards([]);
        setShowSuccessMessage(true);
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          if (isMounted.current) {
            setShowSuccessMessage(false);
          }
        }, 3000);
      }
      
      // Call the callback if provided
      if (onAddCards && typeof onAddCards === 'function') {
        onAddCards(cardsToAdd);
      }
      
      return true;
    } catch (error) {
      derr("[SimpleCardGeneratorModal] Error adding cards:", error);
      setError(`Error adding cards: ${error.message}`);
      return false;
    }
  }, [generatedCards, subject, topic, examBoard, examType, topicId, topicColor, recordId, userId, onAddCards]);

  // Render the options step
  const renderOptionsStep = () => (
    <div className="card-options-step">
      <div className="metadata-summary">
        <h4>Generate Cards for:</h4>
        <div className="metadata-item">
          <label>Subject:</label>
          <span>{subject}</span>
        </div>
        <div className="metadata-item">
          <label>Topic:</label>
          <span>{topic}</span>
        </div>
        <div className="metadata-item">
          <label>Exam Type:</label>
          <span>{examType}</span>
        </div>
        <div className="metadata-item">
          <label>Exam Board:</label>
          <span>{examBoard}</span>
        </div>
      </div>
      
      <div className="options-form">
        <div className="form-group">
          <label htmlFor="questionType">Card Type:</label>
          <select 
            id="questionType"
            value={questionType}
            onChange={e => setQuestionType(e.target.value)}
            className="select-input"
          >
            {QUESTION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="numCards">Number of Cards:</label>
          <input
            id="numCards"
            type="number"
            min="1"
            max="20"
            value={numCards}
            onChange={e => setNumCards(parseInt(e.target.value) || 1)}
            className="number-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="contentGuidance">Content Guidance (Optional):</label>
          <textarea
            id="contentGuidance"
            value={contentGuidance}
            onChange={e => setContentGuidance(e.target.value)}
            placeholder="Add specific instructions for content generation"
            className="textarea-input"
            maxLength={500}
          />
          <div className="char-count">{contentGuidance.length}/500</div>
        </div>
      </div>
    </div>
  );

  // Render the review step with generated cards
  const renderReviewStep = () => (
    <div className="review-cards-step">
      {isGenerating ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <div className="loading-message">{loadingStatus}</div>
        </div>
      ) : (
        <>
          <h4>Review Generated Cards</h4>
          
          {error && <div className="error-message">{error}</div>}
          
          {showSuccessMessage && (
            <div className="success-message">
              {savedCount} card(s) added successfully!
            </div>
          )}
          
          {generatedCards.length === 0 && !isGenerating && !error ? (
            <div className="no-cards-message">
              No cards generated yet. Click "Generate Cards" to create flashcards.
            </div>
          ) : (
            <div className="cards-container">
              {generatedCards.map(card => (
                <div key={card.id} className="card-preview-container">
                  <div className="card-preview">
                    <div className="card-preview-header">
                      <span className="card-type">{card.questionType.replace('_', ' ')}</span>
                      <button
                        className="add-card-button"
                        onClick={() => handleAddCard(card)}
                      >
                        Add Card
                      </button>
                    </div>
                    
                    <div className="card-preview-content">
                      <div className="question">
                        <strong>Q:</strong> {card.question}
                      </div>
                      
                      {card.questionType === 'multiple_choice' && card.options && (
                        <div className="options-list">
                          <ul>
                            {card.options.map((option, i) => (
                              <li key={i}>
                                <strong>{String.fromCharCode(97 + i)})</strong> {option}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="answer">
                        <strong>A:</strong> {card.answer || card.back}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {generatedCards.length > 0 && (
            <div className="bulk-actions">
              <button
                className="add-all-button"
                onClick={handleAddAllCards}
                disabled={generatedCards.length === 0}
              >
                Add All Cards
              </button>
              <button
                className="regenerate-button"
                onClick={generateCards}
                disabled={isGenerating}
              >
                Regenerate Cards
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="simple-card-generator-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>AI Flashcard Generator</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {step === 1 ? (
            // Options step
            renderOptionsStep()
          ) : (
            // Review step
            renderReviewStep()
          )}
        </div>
        
        <div className="modal-footer">
          {step === 1 ? (
            <button 
              className="primary-button"
              onClick={() => {
                setStep(2);
                generateCards();
              }}
              disabled={isGenerating}
            >
              Generate Cards
            </button>
          ) : (
            <button 
              className="secondary-button"
              onClick={() => setStep(1)}
              disabled={isGenerating}
            >
              Back to Options
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleCardGeneratorModal;
