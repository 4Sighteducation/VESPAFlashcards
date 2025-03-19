import React, { useState, useEffect } from 'react';
import './IntegrationTest.css';

const IntegrationTest = () => {
  // Mock API Key State
  const [apiKey, setApiKey] = useState(localStorage.getItem('testOpenAIKey') || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [generatedCards, setGeneratedCards] = useState([]);
  const [error, setError] = useState(null);
  
  // Sample test data
  const testTopics = [
    {
      topic: "Cellular Respiration",
      subject: "Biology",
      examBoard: "AQA",
      examType: "A-Level",
      subjectColor: "#4CAF50"
    },
    {
      topic: "Photosynthesis",
      subject: "Biology",
      examBoard: "AQA",
      examType: "A-Level",
      subjectColor: "#4CAF50"
    },
    {
      topic: "Nuclear Reactions",
      subject: "Physics",
      examBoard: "Edexcel",
      examType: "A-Level",
      subjectColor: "#2196F3"
    }
  ];
  
  // Save API key to localStorage
  const saveApiKey = () => {
    localStorage.setItem('testOpenAIKey', apiKey);
    showToast('API Key saved!');
  };
  
  // Open the card generation modal
  const openModal = (topic) => {
    setSelectedTopic(topic);
    setIsModalOpen(true);
    setGeneratedCards([]);
    setError(null);
  };
  
  // Close the modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTopic(null);
  };
  
  // Generate flashcards
  const generateCards = async () => {
    if (!apiKey) {
      setError("OpenAI API Key is required");
      return;
    }
    
    if (!selectedTopic) {
      setError("No topic selected");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const prompt = `Generate 3 flashcards for ${selectedTopic.subject} - ${selectedTopic.topic} (${selectedTopic.examBoard} ${selectedTopic.examType}).
      
      For each card, include:
      - front: The question
      - back: The answer
      - options: For multiple choice, include 4 options
      
      Return the cards in a JSON array.`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to generate cards');
      }
      
      // Parse response
      const content = data.choices[0].message.content;
      let cards;
      
      try {
        // Try to parse JSON directly
        cards = JSON.parse(content);
      } catch (e) {
        // Look for JSON in the text
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cards = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse the AI response');
        }
      }
      
      // Process cards
      const processedCards = cards.map((card, index) => ({
        id: `card-${Date.now()}-${index}`,
        front: card.front,
        back: card.back,
        options: card.options,
        // Add metadata
        subject: selectedTopic.subject,
        topic: selectedTopic.topic,
        examBoard: selectedTopic.examBoard,
        examType: selectedTopic.examType,
        subjectColor: selectedTopic.subjectColor,
        cardColor: generateShade(selectedTopic.subjectColor, index, cards.length)
      }));
      
      setGeneratedCards(processedCards);
    } catch (err) {
      console.error('Error generating cards:', err);
      setError(err.message || 'Failed to generate cards');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Display a toast notification
  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `test-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 3000);
  };
  
  // Generate a shade of a color for cards
  const generateShade = (hexColor, index, total) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Apply variation
    const percent = -15 + (index / (total - 1 || 1)) * 30; // Range from -15% to +15%
    
    const nr = Math.min(255, Math.max(0, r * (1 + percent / 100)));
    const ng = Math.min(255, Math.max(0, g * (1 + percent / 100)));
    const nb = Math.min(255, Math.max(0, b * (1 + percent / 100)));
    
    // Convert back to hex
    return `#${Math.round(nr).toString(16).padStart(2, '0')}${Math.round(ng).toString(16).padStart(2, '0')}${Math.round(nb).toString(16).padStart(2, '0')}`;
  };
  
  // Get contrast color for text
  const getContrastColor = (hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };
  
  // Mock function for adding a card
  const handleAddCard = (card) => {
    showToast(`Added card: ${card.front.substring(0, 30)}...`);
  };
  
  return (
    <div className="integration-test-container">
      <h1>Flashcard Generator Test</h1>
      
      <div className="test-description">
        <p>This is a standalone test page for the flashcard generator. Enter your OpenAI API key and test generating cards for different topics.</p>
      </div>
      
      <div className="api-key-section">
        <h2>OpenAI API Key</h2>
        <div className="api-key-input-group">
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your OpenAI API key (sk-...)"
            className="api-key-input"
          />
          <button className="test-button" onClick={saveApiKey}>Save Key</button>
        </div>
        <p className="api-key-note">Your API key is stored only in your browser's local storage.</p>
      </div>
      
      <div className="test-topics">
        <h2>Sample Topics</h2>
        
        {testTopics.map((topic, index) => (
          <div key={index} className="test-topic-item" style={{ borderColor: topic.subjectColor }}>
            <div className="topic-details">
              <h3>{topic.topic}</h3>
              <div className="topic-meta">
                <span>{topic.subject}</span>
                <span>{topic.examBoard} {topic.examType}</span>
              </div>
            </div>
            
            <button 
              className="generate-button"
              onClick={() => openModal(topic)}
              style={{ 
                backgroundColor: topic.subjectColor,
                color: getContrastColor(topic.subjectColor)
              }}
            >
              Generate Cards
            </button>
          </div>
        ))}
      </div>
      
      {/* Card Generation Modal */}
      {isModalOpen && selectedTopic && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ backgroundColor: selectedTopic.subjectColor, color: getContrastColor(selectedTopic.subjectColor) }}>
              <h2>{selectedTopic.topic}</h2>
              <button className="close-button" onClick={closeModal}>×</button>
            </div>
            
            <div className="modal-body">
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}
              
              {isGenerating ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Generating cards for {selectedTopic.topic}...</p>
                </div>
              ) : generatedCards.length > 0 ? (
                <div className="cards-container">
                  {generatedCards.map((card, index) => (
                    <div 
                      key={index} 
                      className="card-item"
                      style={{ 
                        backgroundColor: card.cardColor,
                        color: getContrastColor(card.cardColor)
                      }}
                    >
                      <div className="card-content">
                        <div className="card-front">
                          <strong>Question:</strong> {card.front}
                        </div>
                        
                        {card.options && (
                          <div className="card-options">
                            <strong>Options:</strong>
                            <ol type="a">
                              {card.options.map((option, i) => (
                                <li key={i}>{option}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        
                        <div className="card-back">
                          <strong>Answer:</strong> {card.back}
                        </div>
                      </div>
                      
                      <button className="add-card-button" onClick={() => handleAddCard(card)}>
                        Add to Bank
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="generate-prompt">
                  <p>Click "Generate Cards" to create flashcards for this topic.</p>
                  <button 
                    className="generate-button large"
                    onClick={generateCards}
                    disabled={!apiKey}
                  >
                    Generate Cards
                  </button>
                  
                  {!apiKey && (
                    <p className="warning-message">Please enter your OpenAI API key first.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="test-instructions">
        <h2>Instructions</h2>
        <ol>
          <li>Enter your OpenAI API key at the top of the page</li>
          <li>Click "Generate Cards" on any topic</li>
          <li>Click the Generate button in the modal</li>
          <li>Review the generated cards</li>
          <li>Try adding individual cards to the bank</li>
        </ol>
      </div>
    </div>
  );
};

export default IntegrationTest; 