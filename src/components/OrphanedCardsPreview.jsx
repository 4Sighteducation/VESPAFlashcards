import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import './OrphanedCardsPreview.css';
import { findCardsForTopic } from '../services/TopicCardSyncService';

/**
 * OrphanedCardsPreview - Displays cards that would be deleted when a topic is deleted
 * 
 * This component shows a preview of all cards associated with a topic that
 * would become orphaned (and deleted) if the topic is removed.
 */
const OrphanedCardsPreview = ({
  isOpen,
  onClose,
  topic,
  userId,
  auth
}) => {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);

  // Load cards for the topic when the component opens
  useEffect(() => {
    if (isOpen && topic) {
      loadCards();
    }
  }, [isOpen, topic]);

  // Function to load cards associated with this topic
  const loadCards = async () => {
    if (!topic || !userId || !auth) {
      setError("Missing required information to load cards");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const topicCards = await findCardsForTopic(topic, userId, auth);
      setCards(topicCards);
    } catch (error) {
      console.error("Error loading orphaned cards:", error);
      setError(`Failed to load cards: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Group cards by box number (for the Leitner system)
  const groupCardsByBox = () => {
    const grouped = {};
    
    cards.forEach(card => {
      const boxNum = card.boxNum || 1;
      if (!grouped[boxNum]) {
        grouped[boxNum] = [];
      }
      grouped[boxNum].push(card);
    });
    
    return grouped;
  };

  // Get contrast color for text based on background color
  const getContrastColor = (hexColor) => {
    // Default to black if no color or invalid
    if (!hexColor || typeof hexColor !== 'string') {
      return '#000000';
    }
    
    // Remove hash if present
    if (hexColor.startsWith('#')) {
      hexColor = hexColor.slice(1);
    }
    
    // Convert to RGB
    let r, g, b;
    if (hexColor.length === 3) {
      r = parseInt(hexColor.charAt(0) + hexColor.charAt(0), 16);
      g = parseInt(hexColor.charAt(1) + hexColor.charAt(1), 16);
      b = parseInt(hexColor.charAt(2) + hexColor.charAt(2), 16);
    } else if (hexColor.length === 6) {
      r = parseInt(hexColor.substring(0, 2), 16);
      g = parseInt(hexColor.substring(2, 4), 16);
      b = parseInt(hexColor.substring(4, 6), 16);
    } else {
      return '#000000'; // Default if format is invalid
    }
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Function to toggle full view of a card
  const toggleCardExpand = (cardId) => {
    if (expandedCard === cardId) {
      setExpandedCard(null);
    } else {
      setExpandedCard(cardId);
    }
  };

  // Render expanded card details
  const renderExpandedCard = () => {
    if (!expandedCard) return null;
    
    const card = cards.find(c => c.id === expandedCard);
    if (!card) return null;
    
    return createPortal(
      <div 
        className="expanded-card-overlay" 
        onClick={() => setExpandedCard(null)}
      >
        <div 
          className="expanded-card" 
          onClick={e => e.stopPropagation()}
          style={{ backgroundColor: card.cardColor || '#f0f0f0' }}
        >
          <button 
            className="close-expanded-card" 
            onClick={() => setExpandedCard(null)}
          >
            <FaTimes />
          </button>
          
          <div 
            className="expanded-card-content"
            style={{ color: getContrastColor(card.cardColor) }}
          >
            <div className="card-side">
              <h4>Front</h4>
              <div 
                className="card-front-content" 
                dangerouslySetInnerHTML={{ __html: card.front }}
              />
            </div>
            
            <div className="card-side">
              <h4>Back</h4>
              <div 
                className="card-back-content" 
                dangerouslySetInnerHTML={{ __html: card.back }}
              />
            </div>
            
            <div className="card-metadata">
              <div className="metadata-item">
                <span className="label">Question Type:</span>
                <span className="value">{card.questionType}</span>
              </div>
              <div className="metadata-item">
                <span className="label">Box:</span>
                <span className="value">{card.boxNum || 1}</span>
              </div>
              {card.createdAt && (
                <div className="metadata-item">
                  <span className="label">Created:</span>
                  <span className="value">
                    {new Date(card.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  const groupedCards = groupCardsByBox();
  const boxNumbers = Object.keys(groupedCards).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="orphaned-cards-overlay" onClick={onClose}>
      <div className="orphaned-cards-modal" onClick={e => e.stopPropagation()}>
        <div className="orphaned-cards-header">
          <h3>Cards for Topic: {topic?.name || topic?.topic || topic?.parsedName}</h3>
          <button 
            className="close-button"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        <div className="orphaned-cards-content">
          {isLoading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading cards...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <FaExclamationTriangle className="error-icon" />
              <p>{error}</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="no-cards-message">
              <FaInfoCircle className="info-icon" />
              <p>No cards found for this topic.</p>
            </div>
          ) : (
            <div className="orphaned-cards-container">
              <div className="warning-banner">
                <FaExclamationTriangle className="warning-icon" />
                <p>
                  <strong>Warning:</strong> Deleting this topic will permanently remove all {cards.length} associated cards.
                </p>
              </div>
              
              {boxNumbers.map(boxNum => (
                <div key={boxNum} className="box-group">
                  <h4 className="box-heading">Box {boxNum} ({groupedCards[boxNum].length} cards)</h4>
                  <div className="cards-grid">
                    {groupedCards[boxNum].map(card => (
                      <div 
                        key={card.id} 
                        className="card-preview-item"
                        style={{ backgroundColor: card.cardColor || '#f0f0f0' }}
                        onClick={() => toggleCardExpand(card.id)}
                      >
                        <div 
                          className="card-preview-question"
                          style={{ color: getContrastColor(card.cardColor) }}
                        >
                          <div dangerouslySetInnerHTML={{ __html: card.front || card.question }} />
                        </div>
                        <div 
                          className="card-preview-meta"
                          style={{ color: getContrastColor(card.cardColor) }}
                        >
                          <span className="card-type">{card.questionType}</span>
                          <span className="view-details">Click to view</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="orphaned-cards-footer">
          <button 
            className="back-button"
            onClick={onClose}
          >
            Back to Delete Options
          </button>
        </div>
      </div>
      
      {renderExpandedCard()}
    </div>
  );
};

export default OrphanedCardsPreview;
