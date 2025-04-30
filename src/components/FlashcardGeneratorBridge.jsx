import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import AICardGeneratorService from '../services/AICardGeneratorService';
import LoadingSpinner from './LoadingSpinner';
import FlippableCard from './FlippableCard';
import './SimpleCardGeneratorModal.css';
import './Flashcard.css';

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
  
  // --- NEW: State for flipped status of cards in review ---
  const [reviewFlippedStates, setReviewFlippedStates] = useState({}); 
  // ---------------------------------------------------------

  // Card generation options
  const [cardType, setCardType] = useState('multiple_choice');
  const [cardCount, setCardCount] = useState(1);
  
  // Handle generating the cards
  const generateCards = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setLoadingMessage("Generating flashcards with AI...");
    // --- Reset flipped states when regenerating ---
    setReviewFlippedStates({}); 
    // ---------------------------------------------
    
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
      
      // --- ENHANCED CARD PROCESSING ---
      const processedCards = results.map((card, index) => {
          let baseCard = {
              id: `temp_card_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 9)}`,
              subject: topic.subject,
              topic: topic.topic || topic.name,
              examBoard: topic.examBoard || 'General',
              examType: topic.examType || 'General',
              cardColor: topic.color || topic.topicColor || '#3cb44b',
              questionType: cardType, // Use the selected cardType
              createdAt: new Date().toISOString(),
              // Add default fields expected by FlippableCard/saving
              boxNum: 1,
              lastReviewed: null,
              nextReviewDate: null, 
              options: [], // Initialize options
              savedOptions: [], // Initialize savedOptions
              keyPoints: [], // Initialize keyPoints
              detailedAnswer: '', // Initialize detailedAnswer
          };
          
          // Merge AI response data into the base card
          baseCard = { ...baseCard, ...card };
          
          // --- Specific processing based on actual cardType ---
          if (baseCard.questionType === 'acronym') {
              baseCard.question = baseCard.question || `What does the acronym "${baseCard.acronym}" stand for?`;
              baseCard.answer = baseCard.explanation; // Map explanation to answer
              baseCard.front = baseCard.question; // Set front/back for FlippableCard
              baseCard.back = baseCard.explanation;
          } else if (baseCard.questionType === 'multiple_choice') {
              // Ensure 'options' exists and is an array
              baseCard.options = Array.isArray(baseCard.options) ? baseCard.options : [];
              
              // Standardize options to { text: string, isCorrect: boolean } format
              // This might require adjusting based on exact AI response structure
              const correctAnswerText = String(baseCard.correctAnswer || '').trim();
              baseCard.options = baseCard.options.map(opt => {
                 const optionText = String(opt || '').trim(); // Handle cases where options might be just strings
                 const isCorrect = optionText.toLowerCase() === correctAnswerText.toLowerCase();
                 return { text: optionText, isCorrect: isCorrect };
              });
              
              // Ensure at least one option is marked correct if possible
              if (correctAnswerText && !baseCard.options.some(opt => opt.isCorrect)) {
                  const correctIndex = baseCard.options.findIndex(opt => opt.text.toLowerCase() === correctAnswerText.toLowerCase());
                  if (correctIndex !== -1) {
                     baseCard.options[correctIndex].isCorrect = true;
                  } else {
                     // Fallback: mark the first option? Or handle error?
                     console.warn("MC Card generated, but correct answer doesn't match any option text:", correctAnswerText, baseCard.options);
                     // If no options exist after processing, add the correctAnswer as the first option.
                     if (baseCard.options.length === 0 && correctAnswerText) {
                          baseCard.options.push({ text: correctAnswerText, isCorrect: true });
                          console.log("Added correctAnswer as the only option.");
                     } else if (baseCard.options.length > 0) {
                           // Or mark the first one if we have options but none match
                           // baseCard.options[0].isCorrect = true; 
                     }
                  }
              }
               // Ensure front/back are set
               baseCard.front = baseCard.question || "Multiple Choice Question";
               baseCard.back = `Correct Answer: ${correctAnswerText}<br/>Explanation: ${baseCard.detailedAnswer || baseCard.answer || 'No explanation provided.'}`; // Combine answer/explanation

          } else { // short_answer or essay
              baseCard.front = baseCard.question;
              baseCard.back = baseCard.detailedAnswer || baseCard.answer || (Array.isArray(baseCard.keyPoints) ? baseCard.keyPoints.join('\n') : '');
          }
          
          // --- Final Standardization Step ---
          // Use the standardizeCards function for robustness if available, otherwise basic standardization
          // Assuming standardizeCards is not directly importable here, we apply basic checks:
          baseCard.id = baseCard.id || `temp_card_${Date.now()}_${index}_fallback`;
          baseCard.type = 'card'; // Ensure type is 'card'
          
          return baseCard;
      });
      // --- END ENHANCED CARD PROCESSING ---
      
      console.log("[FlashcardGeneratorBridge] Cards generated and processed:", processedCards);
      
      // Store the generated cards and move to review step
      setGeneratedCards(processedCards);
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
      if (!topic || !topic.subject || !(topic.topic || topic.name)) { // Check both topic/name
        console.error("[FlashcardGeneratorBridge] Missing topic information for saving cards");
        setError("Missing topic information for saving cards");
        return;
      }
      
      // Important: Add the topic ID to each card to ensure it's saved to the correct topic
      const topicIdentifier = topic.topic || topic.name; // Use name as fallback
      const topicId = topic.id || `topic_${topic.subject}_${topicIdentifier}`; 
      
      // Process cards with topic information and ID before saving
      const processedCards = generatedCards.map(card => ({
        ...card,
        id: card.id.startsWith('temp_') ? `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` : card.id, // Ensure permanent ID
        topicId: topicId,
        // Ensure subject/topic match the parent topic
        subject: topic.subject,
        topic: topicIdentifier, // Use the determined topic name
        examBoard: topic.examBoard || card.examBoard || "General",
        examType: topic.examType || card.examType || "Course"
      }));
      
      // Log the processed cards with their topic IDs
      console.log(`[FlashcardGeneratorBridge] Processed cards with topic ID: ${topicId}`, processedCards);
      
      // Call the onAddCards handler passed from parent (FlashcardList)
      if (onAddCards) {
          console.log(`[FlashcardGeneratorBridge] Calling onAddCards handler with ${processedCards.length} cards`);
          onAddCards(processedCards); // Pass the array of cards
      } else {
          console.warn("[FlashcardGeneratorBridge] No onAddCards handler provided. Cannot save cards to main app state.");
          setError("Save functionality not configured correctly.");
          return; // Stop if handler is missing
      }
      
      console.log(`[FlashcardGeneratorBridge] Triggered save for ${processedCards.length} cards`);
      
      // Close the modal
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("[FlashcardGeneratorBridge] Error saving cards:", err);
      setError(err.message || "Failed to save cards. Please try again.");
    }
  }, [generatedCards, onAddCards, onClose, topic]);

  // --- NEW: Handler for flipping a specific card in review ---
  const handleReviewFlip = useCallback((cardId) => {
      setReviewFlippedStates(prev => ({
          ...prev,
          [cardId]: !prev[cardId] // Toggle flipped state
      }));
  }, []);
  // ---------------------------------------------------------
  
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
  
  // --- UPDATED: Render the step for reviewing generated cards using FlippableCard ---
  const renderReviewStep = () => (
      <div className="card-generator-review">
        <h3>Review Generated Flashcards</h3>
        
        <div className="card-preview-list"> 
            {generatedCards.map((card, index) => (
                <div key={card.id || index} className="card-review-item"> 
                    {/* Use FlippableCard for rendering */}
                    <FlippableCard 
                        card={card} 
                        // Use state for flipped status, default to false
                        isFlipped={!!reviewFlippedStates[card.id]} 
                        // Pass the flip handler
                        onFlip={() => handleReviewFlip(card.id)} 
                         // Disable answer logic in review mode for now
                        onAnswer={() => {}}
                        isInModal={false} // Adjust styling if needed
                    />
                    <div className="card-review-info">Card {index + 1} - Type: {card.questionType}</div>
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
  // ----------------------------------------------------------------------------
  
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
