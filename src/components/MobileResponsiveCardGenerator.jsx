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
  const [loading, setLoading] = useState(false);
  const [generatedCards, setGeneratedCards] = useState([]);
  const [error, setError] = useState(null);
  const [numCards, setNumCards] = useState(5);
  const [questionType, setQuestionType] = useState("multiple-choice");
  const [viewMode, setViewMode] = useState("options"); // 'options' or 'results'

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
  const [step, setStep] = useState(1); // 1: Parameters, 2: Generation/Results

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

  // Replace the getApiKey function with this simpler version
  const getApiKey = () => {
    // In production, just use the environment variable or auth key
    return process.env.REACT_APP_OPENAI_KEY || (auth && auth.openaiKey);
  };

  // Remove the saveApiKey function completely by replacing it with a no-op
  const saveApiKey = () => {
    // No-op in production
    return false;
  };

  // Generate cards using OpenAI API
  const generateCards = async () => {
    setLoading(true);
    setGeneratedCards([]);
    setError(null);
    
    try {
      // Get API key from props or environment
      const apiKey = process.env.REACT_APP_OPENAI_KEY || (auth && auth.openaiKey);
      
      if (!apiKey) {
        throw new Error("No OpenAI API key available. Please configure an API key.");
      }
      
      // Switch to results view immediately
      setViewMode("results");
      
      // Create prompt based on question type and other parameters
      const prompt = `Generate ${numCards} flashcards for ${subject} - ${topic} (${examBoard} ${examType}).
      
      Question type: ${questionType}
      
      Format each card as a JSON object with these fields:
      - front: The question or prompt
      - back: The answer or explanation
      - options: For multiple-choice questions only, include 4 options with one correct answer
      
      Return the cards in a JSON array.`;
      
      // Make API call
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("OpenAI API error:", data);
        throw new Error(data.error?.message || "Failed to generate cards");
      }
      
      // Process the response
      const cardsText = data.choices[0].message.content;
      let cards;
      
      try {
        // Try to parse as JSON directly
        cards = JSON.parse(cardsText);
      } catch (e) {
        // If direct parsing fails, try to extract JSON portion
        const jsonMatch = cardsText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cards = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to parse API response");
        }
      }
      
      // Validate and process cards
      if (!Array.isArray(cards)) {
        throw new Error("API did not return an array of cards");
      }
      
      // Process cards
      const processedCards = cards.map((card, index) => {
        // Generate unique ID
        const id = `card-${Date.now()}-${index}`;
        
        // Generate a topic color
        const topicColor = generateTopicColor(subjectColor);
        
        return {
          id,
          front: card.front,
          back: card.back,
          options: card.options,
          subject,
          topic,
          examBoard,
          examType,
          questionType,
          cardColor: topicColor,
          subjectColor: subjectColor || "#06206e",
          timestamp: new Date().toISOString(),
          boxNum: 1, // Start in box 1 for spaced repetition
          meta: {
            examBoard,
            examType
          },
          metadata: {
            examBoard,
            examType,
            subject
          }
        };
      });
      
      setGeneratedCards(processedCards);
    } catch (err) {
      console.error("Error generating cards:", err);
      setError(err.message || "Failed to generate cards");
    } finally {
      setLoading(false);
    }
  };

  // Ensure colors are properly assigned - generate a shade of the subject color for the topic
  const generateTopicColor = (subjectColor) => {
    if (!subjectColor) return "#06206e"; // Default blue if no subject color
    
    try {
      // Remove any '#' prefix
      const hex = subjectColor.replace('#', '');
      
      // Convert to RGB
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 2), 16);
      const b = parseInt(hex.substring(4, 2), 16);
      
      // Create a slightly lighter/darker shade
      const variation = Math.random() > 0.5 ? 0.85 : 1.15; // 15% lighter or darker
      
      // Apply variation and ensure values are in 0-255 range
      const newR = Math.min(255, Math.max(0, Math.floor(r * variation)));
      const newG = Math.min(255, Math.max(0, Math.floor(g * variation)));
      const newB = Math.min(255, Math.max(0, Math.floor(b * variation)));
      
      // Convert back to hex
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    } catch (e) {
      console.error("Error generating topic color:", e);
      return subjectColor; // Fall back to subject color
    }
  };

  // Handle adding all cards and closing
  const handleAddAllCards = () => {
    const unadded = generatedCards.filter(card => !card.added);
    
    if (unadded.length === 0) {
      return; // No cards to add
    }
    
    // Process the cards with correct metadata
    const cardsToAdd = unadded.map(card => {
      // Generate a valid topic color based on subject color
      const topicColor = generateTopicColor(subjectColor);
      
      return {
        ...card,
        subject,
        topic,
        subjectColor: subjectColor,
        cardColor: topicColor, // Use the generated topic color
        // Add metadata for consistency
        exam_board: examBoard,
        exam_type: examType,
        examBoard,
        examType,
        courseType: examType,
        board: examBoard,
        boxNum: 1, // Start in box 1 for spaced repetition
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
      };
    });
    
    // Create Knack-specific JSON for field_2979
    const knackFormatted = cardsToAdd.map(card => ({
      id: card.id,
      question: card.front || "",
      answer: card.back || "",
      subject: card.subject,
      topic: card.topic,
      cardColor: card.cardColor,
      subjectColor: card.subjectColor,
      exam_board: card.exam_board,
      exam_type: card.exam_type,
      examBoard: card.examBoard,
      examType: card.examType,
      courseType: card.courseType,
      board: card.board,
      meta: card.meta,
      metadata: card.metadata,
      boxNum: 1,
      timestamp: card.timestamp
    }));
    
    // JSON string for Knack field_2979
    const knackField2979 = JSON.stringify(knackFormatted);
    
    // JSON string for Knack field_2986 (Box 1 for spaced repetition)
    const knackField2986 = JSON.stringify(knackFormatted);
    
    console.log("Sending to Knack - field_2979:", knackField2979);
    console.log("Sending to Knack - field_2986:", knackField2986);
    
    // Use the onSaveCards prop for saving the cards
    if (onSaveCards) {
      // Add the Knack-specific fields to the first card in the batch
      const enhancedCards = [...cardsToAdd];
      if (enhancedCards.length > 0) {
        enhancedCards[0].knackField2979 = knackField2979;
        enhancedCards[0].knackField2986 = knackField2986;
      }
      onSaveCards(enhancedCards);
    } else if (onAddCard) {
      // Backward compatibility - add cards one by one
      cardsToAdd.forEach((card, index) => {
        // Add Knack fields to the first card only
        if (index === 0) {
          card.knackField2979 = knackField2979;
          card.knackField2986 = knackField2986;
        }
        onAddCard(card);
      });
    }
    
    // Mark all cards as added
    setGeneratedCards(prev => prev.map(c => ({...c, added: true})));
    
    // Show success toast
    const toast = document.createElement('div');
    toast.className = 'toast-message success-toast';
    toast.innerHTML = `✓ ${cardsToAdd.length} cards added to bank!`;
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
    
    // Remove after 2 seconds and close modal
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
      onClose();
    }, 2000);
    
    // Trigger save operations
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({
        type: "TRIGGER_SAVE",
        knackField2979,
        knackField2986
      }, "*");
    }
  };

  const handleRegenerateCards = () => {
    setViewMode("options");
    setGeneratedCards([]);
  };

  // Render the options view
  const renderOptionsView = () => (
    <>
      <div className="generator-header">
        <h2>{topic}</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="generator-options">
        <div className="option-group">
          <label htmlFor="numCards">Number of Cards:</label>
          <select 
            id="numCards" 
            value={numCards} 
            onChange={e => setNumCards(parseInt(e.target.value))}
          >
            {[...Array(20)].map((_, i) => (
              <option key={i+1} value={i+1}>{i+1}</option>
            ))}
          </select>
        </div>
        
        <div className="option-group">
          <label htmlFor="questionType">Question Type:</label>
          <select 
            id="questionType" 
            value={questionType} 
            onChange={e => setQuestionType(e.target.value)}
          >
            {QUESTION_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="generator-content">
        <div className="mobile-question-types">
          {QUESTION_TYPES.map(type => (
            <div key={type.id} className="mobile-question-type">
              <input
                type="radio"
                id={`question-type-${type.id}`}
                name="questionType"
                value={type.id}
                checked={questionType === type.id}
                onChange={e => setQuestionType(e.target.value)}
              />
              <label htmlFor={`question-type-${type.id}`}>
                {type.label}
              </label>
            </div>
          ))}
        </div>
        
        <button 
          className="generate-button"
          onClick={generateCards}
          disabled={!topic || !subject || error}
        >
          Generate {numCards} Cards
        </button>
      </div>
    </>
  );
  
  // Render the results view
  const renderResultsView = () => (
    <>
      <div className="generator-header">
        <h2>
          {topic} - {generatedCards.length} Cards
        </h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="generator-content">
        {loading ? (
          <div className="loading-container">
            <LoadingSpinner size="medium" />
            <p>Generating {numCards} cards for {topic}...</p>
          </div>
        ) : error ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setViewMode("options")}>Go Back</button>
          </div>
        ) : (
          <div className="generated-cards-container">
            <div className="cards-grid">
              {generatedCards.map((card, index) => (
                <div 
                  key={card.id} 
                  className={`generated-card ${card.added ? 'added' : ''}`}
                  style={{ backgroundColor: card.cardColor }}
                >
                  <div className="card-content">
                    <div className="card-question">{card.front}</div>
                    
                    {card.options && (
                      <div className="card-options">
                        <ol type="a" className={card.options.length > 2 ? 'small-font-options' : ''}>
                          {card.options.map((option, i) => (
                            <li key={i}>{option}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    
                    <div className="card-answer">
                      <strong>Answer:</strong> {card.back}
                    </div>
                  </div>
                  
                  <button 
                    className="add-card-btn"
                    onClick={() => handleAddCard(card)}
                    disabled={card.added}
                  >
                    {card.added ? 'Added ✓' : 'Add to Bank'}
                  </button>
                </div>
              ))}
            </div>
            
            <div className="generator-actions">
              <button 
                className="regenerate-button"
                onClick={handleRegenerateCards}
              >
                Change Options
              </button>
              
              <button 
                className="add-all-button"
                onClick={handleAddAllCards}
                disabled={generatedCards.length === 0 || generatedCards.every(c => c.added)}
              >
                Add All to Bank
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Add a single card to the bank
  const handleAddCard = (card) => {
    // Generate a valid topic color based on subject color
    const topicColor = generateTopicColor(subjectColor);
    
    // Create an enhanced card with proper metadata
    const enhancedCard = {
      ...card,
      cardColor: topicColor,
      subjectColor: subjectColor,
      boxNum: 1, // Start in box 1 for spaced repetition
      // Ensure all required metadata is present
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
    };
    
    // Create Knack-specific JSON for field_2979 and field_2986
    const knackFormatted = [{
      id: enhancedCard.id,
      question: enhancedCard.front || "",
      answer: enhancedCard.back || "",
      subject: enhancedCard.subject,
      topic: enhancedCard.topic,
      cardColor: enhancedCard.cardColor,
      subjectColor: enhancedCard.subjectColor,
      exam_board: enhancedCard.exam_board,
      exam_type: enhancedCard.exam_type,
      examBoard: enhancedCard.examBoard,
      examType: enhancedCard.examType,
      courseType: enhancedCard.courseType,
      board: enhancedCard.board,
      meta: enhancedCard.meta,
      metadata: enhancedCard.metadata,
      boxNum: 1,
      timestamp: enhancedCard.timestamp
    }];
    
    // Create JSON strings for Knack fields
    enhancedCard.knackField2979 = JSON.stringify(knackFormatted);
    enhancedCard.knackField2986 = JSON.stringify(knackFormatted);
    
    // Log the data being sent
    console.log("Adding single card to Knack:", enhancedCard);
    
    // Call the onAddCard callback
    onAddCard(enhancedCard);
    
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
      onSaveCards([enhancedCard]);
    }
    
    // Trigger save operations if window.parent exists
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({ 
        type: "TRIGGER_SAVE",
        knackField2979: enhancedCard.knackField2979,
        knackField2986: enhancedCard.knackField2986
      }, "*");
    }
  };

  return (
    <div className="mobile-card-generator-overlay">
      <div className="mobile-card-generator">
        {viewMode === "options" ? renderOptionsView() : renderResultsView()}
      </div>
    </div>
  );
};

export default MobileResponsiveCardGenerator; 