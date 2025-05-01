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
  const [cardsInReview, setCardsInReview] = useState([]); // State for cards currently in review
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
      
      console.log("[FlashcardGeneratorBridge] Raw AI service response:", JSON.stringify(results, null, 2)); // Log raw response
      
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
              // Ensure options are properly set
              if (!baseCard.options || !Array.isArray(baseCard.options) || baseCard.options.length === 0) {
                  if (baseCard.savedOptions && Array.isArray(baseCard.savedOptions) && baseCard.savedOptions.length > 0) {
                      baseCard.options = [...baseCard.savedOptions]; // Restore from savedOptions
                  }
              }
              
              // Ensure savedOptions exists as a backup
              if (!baseCard.savedOptions || !Array.isArray(baseCard.savedOptions)) {
                  baseCard.savedOptions = [...(baseCard.options || [])];
              }
              
              // Ensure a valid correctAnswer is set
              if (!baseCard.correctAnswer && baseCard.options && baseCard.options.length > 0) {
                  // Find the option with isCorrect flag or default to first option
                  const correctOption = baseCard.options.find(opt => 
                      opt && typeof opt === 'object' && opt.isCorrect === true
                  );
                  
                  if (correctOption) {
                      baseCard.correctAnswer = typeof correctOption === 'object' ? correctOption.text : correctOption;
                  } else {
                      // Default to first option if no correct one is marked
                      baseCard.correctAnswer = typeof baseCard.options[0] === 'object' ? 
                          baseCard.options[0].text : baseCard.options[0];
                  }
              }
              
              // Set front/back fields for compatibility with FlippableCard
              baseCard.front = baseCard.question;
              baseCard.back = baseCard.detailedAnswer || baseCard.answer || 
                  `Correct Answer: a) ${baseCard.correctAnswer || 'Option A'}`;
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
      
      console.log("[FlashcardGeneratorBridge] Cards generated and processed (check options):", JSON.stringify(processedCards, null, 2)); // Log processed cards
      
      // Store the generated cards and move to review step
      setGeneratedCards(processedCards);
      setCardsInReview(processedCards);
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
      if (!cardsInReview || cardsInReview.length === 0) {
        console.error("[FlashcardGeneratorBridge] No cards to save");
        setError("No cards to save. Please generate cards first.");
        return;
      }
      
      console.log(`[FlashcardGeneratorBridge] Saving ${cardsInReview.length} cards`);
      console.log("[FlashcardGeneratorBridge handleSaveCards] Logging cardsInReview state BEFORE mapping:", JSON.stringify(cardsInReview, null, 2));
      
      // Check if we have topic info and recordId
      if (!topic || !topic.subject || !(topic.topic || topic.name) || !recordId) {
        console.error("[FlashcardGeneratorBridge] Missing topic information or recordId for saving cards");
        setError("Missing topic information or record ID for saving cards");
        return;
      }
      
      // Important: Add the topic ID to each card to ensure it's saved to the correct topic
      const topicIdentifier = topic.topic || topic.name; // Use name as fallback
      const topicId = topic.id || `topic_${topic.subject}_${topicIdentifier}`; 
      
      // Process cards with topic information and ID before saving
      const processedCards = cardsInReview.map(card => {
        console.log(`[FlashcardGeneratorBridge handleSaveCards] Processing card inside map (ID: ${card?.id}):`, JSON.stringify(card, null, 2));

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1); // Set to tomorrow

        // --- FIX: Ensure options and savedOptions are preserved --- 
        let finalCorrectAnswer = card.correctAnswer || '';

        if (card.questionType === 'multiple_choice') {
            // Logic to determine finalCorrectAnswer if necessary
            if (!finalCorrectAnswer && card.options && card.options.length > 0) {
                const correctOption = card.options.find(opt => 
                    opt && typeof opt === 'object' && opt.isCorrect === true
                );
                
                if (correctOption) {
                    finalCorrectAnswer = (typeof correctOption === 'object' && correctOption.text !== undefined) ? correctOption.text : ''; 
                } else {
                    const firstOption = card.options[0];
                    finalCorrectAnswer = (typeof firstOption === 'object' && firstOption.text !== undefined) ? 
                        firstOption.text : 
                        (typeof firstOption === 'string' ? firstOption : '');
                }
                console.log(`[handleSaveCards] Determined correctAnswer for card ${card.id}: ${finalCorrectAnswer}`);
            }
        }
        // ----------------------------------------------------------
        
        // --- FIX: Explicitly construct the final card object --- 
        const finalCard = {
          // Fields to keep from original card object
          id: card.id.startsWith('temp_') ? `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` : card.id,
          subject: topic.subject, // Use topic subject
          topic: topicIdentifier, // Use determined topic name
          examBoard: topic.examBoard || card.examBoard || "General",
          examType: topic.examType || card.examType || "Course",
          questionType: card.questionType, // Keep original questionType
          question: card.question || card.front || '', // Ensure question/front exists
          answer: card.answer || card.back || '', // Ensure answer/back exists
          detailedAnswer: card.detailedAnswer || '',
          keyPoints: Array.isArray(card.keyPoints) ? card.keyPoints : [],
          cardColor: card.cardColor || topic.color || '#3cb44b', // Use card color or topic color
          topicId: topicId, // Add topic link
          type: 'card', // Ensure type is card
          // Fields with updated/derived values
          boxNum: 1, 
          lastReviewed: now.toISOString(),
          nextReviewDate: tomorrow.toISOString(),
          createdAt: card.createdAt || now.toISOString(),
          updatedAt: now.toISOString(),
          // --- USE DIRECTLY FROM INPUT card --- 
          options: Array.isArray(card.options) ? card.options : [],         
          savedOptions: Array.isArray(card.savedOptions) ? card.savedOptions : (Array.isArray(card.options) ? card.options : []), // Use savedOptions or fallback to options
          correctAnswer: finalCorrectAnswer   // Use derived correct answer
        };
        // --------------------------------------------------------

        return finalCard;
      });
      
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
  }, [cardsInReview, onAddCards, onClose, topic, recordId]);

  // --- NEW: Handler for flipping a specific card in review ---
  const handleReviewFlip = useCallback((cardId) => {
      setReviewFlippedStates(prev => ({
          ...prev,
          [cardId]: !prev[cardId] // Toggle flipped state
      }));
  }, []);
  // ---------------------------------------------------------
  
  // --- NEW: Handler for deleting a card from the review list ---
  const handleDeleteFromReview = useCallback((cardIdToDelete) => {
    setCardsInReview(prevCards => prevCards.filter(card => card.id !== cardIdToDelete));
    console.log(`[FlashcardGeneratorBridge] Removed card ${cardIdToDelete} from review list.`);
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
        <button 
          className="cancel-button" 
          onClick={onClose}
        >
          Cancel
        </button>
        <button 
          className="generate-button" 
          onClick={generateCards}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  );
  
  // Render the step for reviewing generated cards
  const renderReviewStep = () => (
      <div className="card-generator-review">
        <h3>Review Generated Flashcards</h3>
        
        {cardsInReview.length === 0 ? (
          <div className="no-cards-to-review">All generated cards have been deleted. Go back to generate more.</div>
        ) : (
          <div className="card-preview-list"> 
              {cardsInReview.map((card, index) => (
                  <div key={card.id || index} className="card-review-item"> 
                      {/* Use FlippableCard for rendering */}
                      <FlippableCard 
                          card={card} 
                          // Use state for flipped status, default to false
                          isFlipped={!!reviewFlippedStates[card.id]} 
                          // Pass the flip handler
                          onFlip={() => handleReviewFlip(card.id)} 
                          // Disable answer logic in review mode
                          onAnswer={() => {}}
                          isInModal={false} // Adjust styling if needed
                          showDeleteButton={true} // Show delete button
                          onDeleteRequest={handleDeleteFromReview} // Pass delete handler
                      />
                      <div className="card-review-info">Card {index + 1} - Type: {card.questionType}</div>
                  </div>
              ))}
          </div>
        )}
        
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
            disabled={cardsInReview.length === 0} // Disable save if no cards left
          >
            Save {cardsInReview.length} Card(s)
          </button>
        </div>
      </div>
  );
  // ----------------------------------------------------------------------------
  
  // Main render function
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
        
        {/* Error Display */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
            {errorDetails && (
              <details>
                <summary>Technical Details</summary>
                <pre>{errorDetails}</pre>
              </details>
            )}
          </div>
        )}
        
        {/* Loading Indicator */}
        {isGenerating && (
          <div className="loading-container">
            <LoadingSpinner />
            <p>{loadingMessage || "Loading..."}</p>
          </div>
        )}
        
        {/* Main Content */}
        {!isGenerating && (
          <div className="card-generator-body">
            {/* Render the current step */}
            {step === 1 ? renderOptionsStep() : renderReviewStep()}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FlashcardGeneratorBridge;
