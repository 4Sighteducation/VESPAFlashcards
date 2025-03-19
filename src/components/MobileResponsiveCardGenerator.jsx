import React, { useState, useEffect } from "react";
import "./MobileResponsiveCardGenerator.css";
import Flashcard from './Flashcard';
import LoadingSpinner from "./LoadingSpinner";

// Constants for question types
const QUESTION_TYPES = [
  { id: "multiple-choice", label: "Multiple Choice", description: "Questions with several possible answers" },
  { id: "essay", label: "Essay Style", description: "Open-ended questions requiring longer responses" },
  { id: "short-answer", label: "Short Answer", description: "Brief, focused questions with concise answers" },
  { id: "acronym", label: "ACRONYM", description: "Memory aids using the first letter of keywords" }
];

// Color palette for cards
const BRIGHT_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
  "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
  "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C"
];

// API keys - using the correct environment variables
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";

/**
 * Mobile Responsive Card Generator
 * This component is designed to work with pre-saved topics and their metadata to generate
 * flashcards directly. It skips the initial steps of the AICardGenerator and focuses on
 * creating mobile-responsive cards.
 */
const MobileResponsiveCardGenerator = ({
  onAddCard,
  onSaveCards,
  onClose,
  topicData, // Pre-saved topic data with metadata
  subjectColor, // Color associated with the subject
  auth,
  userId
}) => {
  // Extract metadata from topicData
  const {
    topic = "",
    subject = "",
    examBoard = "",
    examType = "",
  } = topicData || {};

  // Form data state - simpler than the full AICardGenerator
  const [formData, setFormData] = useState({
    numCards: 5,
    questionType: "multiple-choice",
    subjectColor: subjectColor || BRIGHT_COLORS[0]
  });

  // Processing states
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Parameters, 2: Generation/Results

  // Results states
  const [generatedCards, setGeneratedCards] = useState([]);

  // Success modal state
  const [successModal, setSuccessModal] = useState({
    show: false,
    addedCards: []
  });

  // Validation
  useEffect(() => {
    // Validate that we have the necessary data to generate cards
    if (!topic || !subject || !examBoard || !examType) {
      setError("Missing required topic data. Please select a valid topic.");
    } else {
      setError(null);
    }
  }, [topic, subject, examBoard, examType]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle next step button
  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
      generateCards();
    }
  };

  // Handle previous step button
  const handlePrevStep = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  // Validation for current step
  const canProceed = () => {
    if (step === 1) {
      // Validate number of cards and question type
      return formData.numCards > 0 && 
             formData.numCards <= 20 && 
             formData.questionType && 
             !error;
    }
    return true;
  };

  // Helper to get contrast color for text
  const getContrastColor = (hexColor) => {
    // Remove # if present
    if (hexColor.startsWith('#')) {
      hexColor = hexColor.slice(1);
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Helper function to clean AI response
  const cleanOpenAIResponse = (text) => {
    return text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  };

  // Generate cards using OpenAI API
  const generateCards = async () => {
    if (!topic || !subject || !examBoard || !examType) {
      setError("Missing required topic data. Please select a valid topic.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      console.log("Generating cards with metadata:", {
        topic,
        subject,
        examBoard,
        examType,
        numCards: formData.numCards,
        questionType: formData.questionType
      });

      // Create prompt based on question type and other parameters
      let prompt;
      
      if (formData.questionType === "acronym") {
        prompt = `Return only a valid JSON array with no additional text. Please output all mathematical expressions in plain text (avoid markdown or LaTeX formatting). Generate ${formData.numCards} exam-style flashcards for ${examBoard} ${examType} ${subject} with focus on ${topic}. Create a useful acronym from some essential course knowledge. Be creative and playful. Format exactly as: [{"acronym": "Your acronym", "explanation": "Detailed explanation here"}]`;
      } else {
        // Determine complexity based on exam type
        let complexityInstruction;
        if (examType === "A-Level") {
          complexityInstruction = "Make these appropriate for A-Level students (age 16-18). Questions should be challenging and involve deeper thinking. Include sufficient detail in answers and use appropriate technical language.";
        } else { // GCSE
          complexityInstruction = "Make these appropriate for GCSE students (age 14-16). Questions should be clear but still challenging. Explanations should be thorough but accessible.";
        }
        
        // Base prompt
        prompt = `Return only a valid JSON array with no additional text. Please output all mathematical expressions in plain text (avoid markdown or LaTeX formatting). 
Generate ${formData.numCards} high-quality ${examBoard} ${examType} ${subject} flashcards for the specific topic "${topic}".
${complexityInstruction}

Before generating questions, scrape the latest ${examBoard} ${examType} ${subject} specification to ensure the content matches the current curriculum exactly.

Use this format for different question types:
`;
        
        // Add format based on question type
        if (formData.questionType === "multiple-choice") {
          prompt += `[
  {
    "subject": "${subject}",
    "topic": "${topic}",
    "questionType": "multiple-choice",
    "question": "Clear, focused question based on the curriculum",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": "The correct option exactly as written in options array",
    "detailedAnswer": "Detailed explanation of why this answer is correct, with key concepts and examples"
  }
]`;
        } else if (formData.questionType === "short-answer") {
          prompt += `[
  {
    "subject": "${subject}",
    "topic": "${topic}",
    "questionType": "short-answer",
    "question": "Clear, focused question from the curriculum",
    "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "detailedAnswer": "Complete and thorough explanation with all necessary information"
  }
]`;
        } else if (formData.questionType === "essay") {
          prompt += `[
  {
    "subject": "${subject}",
    "topic": "${topic}",
    "questionType": "essay",
    "question": "Thought-provoking essay question matching the curriculum",
    "keyPoints": ["Important point 1", "Important point 2", "Important point 3", "Important point 4"],
    "detailedAnswer": "Structured essay plan with introduction, key arguments, and conclusion guidance"
  }
]`;
        }
      }
      
      console.log("Generating cards with prompt:", prompt);
      
      // Make the API call to OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.7
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Error calling OpenAI API");
      }
      
      // Parse the response
      const content = data.choices[0].message.content;
      console.log("Raw AI response:", content);
      
      const cleanedContent = cleanOpenAIResponse(content);
      
      let cards;
      try {
        cards = JSON.parse(cleanedContent);
      } catch (e) {
        console.error("Error parsing AI response:", e);
        throw new Error("Failed to parse AI response. Please try again.");
      }
      
      if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error("Invalid response format from AI. Please try again.");
      }
      
      // Process the generated cards
      const processedCards = cards.map((card, index) => {
        // Generate a unique ID
        const id = `card_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Ensure card color is valid - use a default if no color is available
        const ensuredCardColor = formData.subjectColor || "#3cb44b";
        
        // Add standard fields
        const baseCard = {
          id,
          subject,
          topic,
          examType,
          examBoard,
          questionType: formData.questionType,
          cardColor: ensuredCardColor,
          baseColor: ensuredCardColor,
          timestamp: new Date().toISOString(),
          boxNum: 1, // Start in box 1
        };
        
        // Process specific question types
        if (formData.questionType === "acronym") {
          return {
            ...baseCard,
            acronym: card.acronym,
            explanation: card.explanation,
            front: `Acronym: ${card.acronym}`,
            back: `Explanation: ${card.explanation}`
          };
        } else if (formData.questionType === "multiple-choice") {
          // Clean all options and correct answer of any existing prefixes
          const cleanedOptions = card.options.map(option => 
            option.replace(/^[a-d]\)\s*/i, '').trim()
          );
          
          let correctAnswer = card.correctAnswer.replace(/^[a-d]\)\s*/i, '').trim();
          
          // Find the index of the correct answer in the options
          let correctIndex = cleanedOptions.findIndex(option => 
            option.toLowerCase() === correctAnswer.toLowerCase()
          );
          
          // If match not found, try a more flexible comparison
          if (correctIndex === -1) {
            correctIndex = cleanedOptions.findIndex(option => 
              option.toLowerCase().includes(correctAnswer.toLowerCase()) || 
              correctAnswer.toLowerCase().includes(option.toLowerCase())
            );
          }
          
          // If still not found, default to the first option
          if (correctIndex === -1) {
            console.warn("Could not match correct answer to an option, defaulting to first option");
            correctIndex = 0;
            correctAnswer = cleanedOptions[0];
          }
          
          // Get the letter for this index (a, b, c, d)
          const letter = String.fromCharCode(97 + correctIndex);
          
          return {
            ...baseCard,
            question: card.question,
            options: cleanedOptions, // Use the cleaned options
            correctAnswer: correctAnswer, // Use the cleaned correct answer
            correctIndex: correctIndex, // Store the index for future reference
            detailedAnswer: card.detailedAnswer,
            additionalInfo: card.detailedAnswer, // Add to additionalInfo field for info modal
            front: card.question,
            back: `Correct Answer: ${letter}) ${correctAnswer}` // Format with letter prefix
          };
        } else if (formData.questionType === "short-answer" || formData.questionType === "essay") {
          // Create key points as bullet points if they exist
          const keyPointsHtml = card.keyPoints && card.keyPoints.length > 0
            ? card.keyPoints.map(point => `• ${point}`).join("<br/>")
            : "";
            
          return {
            ...baseCard,
            question: card.question,
            keyPoints: card.keyPoints || [],
            detailedAnswer: card.detailedAnswer,
            additionalInfo: card.detailedAnswer, // Add to additionalInfo field for info modal
            front: card.question,
            back: keyPointsHtml // Only show key points, not detailed answer
          };
        } else {
          return {
            ...baseCard,
            front: card.front || card.question,
            back: card.back || card.answer
          };
        }
      });

      setGeneratedCards(processedCards);
      
    } catch (error) {
      console.error("Error generating cards:", error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Add a single card to the bank
  const handleAddCard = (card) => {
    onAddCard(card);
    // Mark card as added in UI
    setGeneratedCards(prev => 
      prev.map(c => c.id === card.id ? {...c, added: true} : c)
    );
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = '✓ Card added to your bank!';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = '#4CAF50';
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '4px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    document.body.appendChild(toast);
    
    // Remove after 2 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 2000);
    
    // Use the onSaveCards callback if provided
    if (onSaveCards) {
      onSaveCards([card]);
    }
    
    // Trigger save operations if window.parent exists
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({ type: "TRIGGER_SAVE" }, "*");
      window.parent.postMessage({ type: "SAVE_DATA" }, "*");
    }
  };

  // Handle adding all cards and closing
  const handleAddAllCards = () => {
    const unadded = generatedCards.filter(card => !card.added);
    
    if (unadded.length === 0) {
      return; // No cards to add
    }
    
    // Process the cards with correct metadata
    const cardsToAdd = unadded.map(card => ({
      ...card,
      subject,
      topic,
      subjectColor: formData.subjectColor,
      cardColor: formData.subjectColor,
      // Add metadata for consistency
      exam_board: examBoard,
      exam_type: examType,
      examBoard,
      examType,
      courseType: examType,
      board: examBoard,
      meta: {
        exam_board: examBoard,
        exam_type: examType,
        examBoard,
        examType
      },
      metadata: {
        exam_board: examBoard,
        exam_type: examType,
        examBoard,
        examType,
        subject
      }
    }));
    
    // Use the onSaveCards prop for saving the cards
    if (onSaveCards) {
      onSaveCards(cardsToAdd);
    } else if (onAddCard) {
      // Backward compatibility - add cards one by one
      cardsToAdd.forEach(card => onAddCard(card));
    }
    
    // Mark all cards as added
    setGeneratedCards(prev => prev.map(c => ({...c, added: true})));
    
    // Show success modal with all added cards
    setSuccessModal({
      show: true,
      addedCards: cardsToAdd
    });
    
    // Auto-hide after 3 seconds and close
    setTimeout(() => {
      setSuccessModal(prev => ({...prev, show: false}));
      onClose();
    }, 3000);
    
    // Trigger save operations
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({ type: "TRIGGER_SAVE" }, "*");
    }
  };

  // Generate new batch of cards
  const handleRegenerateCards = () => {
    setGeneratedCards([]);
    setIsGenerating(true);
    generateCards();
  };

  // Render success modal
  const renderSuccessModal = () => {
    if (!successModal.show) return null;
    
    return (
      <div className="success-modal-overlay">
        <div className="success-modal">
          <div className="success-icon">✓</div>
          <h3>{successModal.addedCards.length} {successModal.addedCards.length === 1 ? 'Card' : 'Cards'} Added!</h3>
          <div className="success-cards">
            {successModal.addedCards.slice(0, 5).map(card => (
              <div key={card.id} className="success-card-item" style={{backgroundColor: card.cardColor}}>
                <span style={{color: getContrastColor(card.cardColor)}}>{card.front.substring(0, 40)}...</span>
              </div>
            ))}
            {successModal.addedCards.length > 5 && (
              <div className="success-more">+{successModal.addedCards.length - 5} more</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render parameters step
  const renderParametersStep = () => {
    return (
      <div className="mobile-step">
        <h2>Generate Cards</h2>
        <div className="mobile-metadata">
          <div className="metadata-item">
            <strong>Topic:</strong> <span>{topic}</span>
          </div>
          <div className="metadata-item">
            <strong>Subject:</strong> <span>{subject}</span>
          </div>
          <div className="metadata-item">
            <strong>Course:</strong> <span>{examBoard} {examType}</span>
          </div>
        </div>

        <div className="mobile-form-group">
          <label htmlFor="numCards">Number of Cards:</label>
          <input
            type="number"
            id="numCards"
            name="numCards"
            value={formData.numCards}
            onChange={handleChange}
            min="1"
            max="20"
            className="mobile-input"
          />
          <p className="helper-text">Select between 1 and 20 cards</p>
        </div>

        <div className="mobile-form-group">
          <label>Question Type:</label>
          <div className="mobile-question-types">
            {QUESTION_TYPES.map(type => (
              <div key={type.id} className="mobile-question-type">
                <input
                  type="radio"
                  id={`question-type-${type.id}`}
                  name="questionType"
                  value={type.id}
                  checked={formData.questionType === type.id}
                  onChange={handleChange}
                />
                <label htmlFor={`question-type-${type.id}`}>
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render card generation/results step
  const renderResultsStep = () => {
    return (
      <div className="mobile-step">
        <h2>Generated Cards</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {isGenerating ? (
          <div className="loading-container">
            <LoadingSpinner size="medium" />
            <p>Creating {formData.numCards} flashcards for {examBoard} {examType} {subject}...</p>
          </div>
        ) : generatedCards.length > 0 ? (
          <>
            <div className="mobile-generated-cards-actions">
              <button className="mobile-secondary-button" onClick={handleRegenerateCards}>
                <span className="button-icon">🔄</span> Regenerate
              </button>
            </div>
            
            <div className="mobile-cards-container">
              {generatedCards.map(card => (
                <div 
                  key={card.id} 
                  className={`mobile-card ${card.added ? 'added' : ''}`}
                  style={{ 
                    backgroundColor: card.cardColor,
                    color: getContrastColor(card.cardColor)
                  }}
                >
                  <div className="mobile-card-header">
                    <span className="card-type">
                      {card.questionType === "multiple-choice" ? "Multiple Choice" : 
                       card.questionType === "short-answer" ? "Short Answer" : 
                       card.questionType === "essay" ? "Essay" : "Acronym"}
                    </span>
                    
                    <button 
                      className="mobile-add-btn" 
                      onClick={() => handleAddCard(card)}
                      disabled={card.added}
                    >
                      {card.added ? "Added ✓" : "Add"}
                    </button>
                  </div>
                  
                  <Flashcard 
                    card={card}
                    preview={true}
                    style={{
                      height: 'auto',
                      minHeight: '180px',
                      width: '100%',
                      margin: '0',
                      boxShadow: 'none',
                      borderRadius: '0'
                    }}
                    showButtons={false}
                    isInModal={false}
                  />
                </div>
              ))}
            </div>
            
            <div className="mobile-bottom-actions">
              <button 
                className="mobile-primary-button"
                onClick={handleAddAllCards}
                disabled={generatedCards.every(card => card.added)}
              >
                <span className="button-icon">💾</span> Add All Cards
              </button>
              <p className="mobile-status-text">
                {generatedCards.filter(card => card.added).length} of {generatedCards.length} cards added
              </p>
            </div>
          </>
        ) : (
          <div className="mobile-empty-state">
            <p>No cards generated yet.</p>
            <button 
              className="mobile-primary-button"
              onClick={generateCards}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Cards"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mobile-card-generator">
      <div className="mobile-generator-header">
        <h1>Generate Cards</h1>
        <button className="mobile-close-button" onClick={onClose}>&times;</button>
      </div>
      
      <div className="mobile-generator-content">
        {step === 1 ? renderParametersStep() : renderResultsStep()}
      </div>
      
      <div className="mobile-generator-controls">
        {step === 2 && (
          <button 
            onClick={handlePrevStep} 
            className="mobile-back-button"
            disabled={isGenerating}
          >
            Back
          </button>
        )}
        
        {step === 1 && (
          <button 
            onClick={handleNextStep} 
            className="mobile-next-button"
            disabled={!canProceed() || isGenerating}
          >
            Generate Cards
          </button>
        )}
      </div>
      
      {renderSuccessModal()}
    </div>
  );
};

export default MobileResponsiveCardGenerator; 