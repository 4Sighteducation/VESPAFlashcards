import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaExchangeAlt, FaCheck, FaInfoCircle } from 'react-icons/fa';
import './TopicReassignmentModal.css';
import { reassignCards } from '../services/TopicCardSyncService';

/**
 * TopicReassignmentModal - Allows users to reassign cards from one topic to another
 * 
 * This component provides a UI for users to select a target topic to move
 * cards to when they want to delete a topic but keep its cards.
 */
const TopicReassignmentModal = ({
  isOpen,
  onClose,
  sourceTopic,
  cards = [],
  topics = [],
  userId,
  auth,
  onReassignComplete,
  onError
}) => {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [filteredTopics, setFilteredTopics] = useState([]);
  const [searchText, setSearchText] = useState('');
  
  // Filter out the source topic and filter by search text
  useEffect(() => {
    if (!topics || !sourceTopic) return;
    
    let filtered = topics;
    
    // Remove the source topic (no need to reassign to itself)
    filtered = filtered.filter(topic => 
      topic.id !== sourceTopic.id
    );
    
    // Apply search filter if there's search text
    if (searchText.trim().length > 0) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(topic => {
        const topicName = topic.name || topic.topic || topic.parsedName || '';
        return topicName.toLowerCase().includes(search);
      });
    }
    
    setFilteredTopics(filtered);
  }, [topics, sourceTopic, searchText]);

  // Handle the reassignment process
  const handleReassign = async () => {
    if (!selectedTopic || !cards.length || !sourceTopic) {
      setError("Please select a topic to reassign cards to");
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use our service to reassign the cards to the selected topic
      const result = await reassignCards(cards, selectedTopic, userId, auth);
      
      if (result) {
        setSuccess(true);
        
        // Call the callback with success info
        if (typeof onReassignComplete === 'function') {
          onReassignComplete({
            sourceTopic,
            targetTopic: selectedTopic,
            cardCount: cards.length,
            success: true
          });
        }
        
        // Close the modal after a brief delay to show success
        setTimeout(() => onClose(), 1500);
      } else {
        setError("Failed to reassign cards");
        
        // Call the error callback
        if (typeof onError === 'function') {
          onError("Failed to reassign cards");
        }
      }
    } catch (error) {
      console.error("Error in handleReassign:", error);
      setError(`Error reassigning cards: ${error.message}`);
      
      // Call the error callback
      if (typeof onError === 'function') {
        onError(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  return createPortal(
    <div className="reassignment-modal-overlay" onClick={onClose}>
      <div className="reassignment-modal" onClick={e => e.stopPropagation()}>
        <div className="reassignment-modal-header">
          <h3>
            <FaExchangeAlt className="header-icon" /> 
            Reassign Cards to Another Topic
          </h3>
          <button 
            className="close-button"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        <div className="reassignment-modal-content">
          {success ? (
            <div className="success-message">
              <FaCheck className="success-icon" />
              <p>
                Successfully reassigned {cards.length} cards to topic: 
                <strong>{selectedTopic.name || selectedTopic.topic || selectedTopic.parsedName}</strong>
              </p>
            </div>
          ) : (
            <>
              <div className="info-box">
                <FaInfoCircle className="info-icon" />
                <div className="info-text">
                  <p>
                    <strong>From Topic:</strong> {sourceTopic?.name || sourceTopic?.topic || sourceTopic?.parsedName}
                  </p>
                  <p>
                    <strong>Cards to Reassign:</strong> {cards.length} cards
                  </p>
                </div>
              </div>
              
              <div className="search-section">
                <input
                  type="text"
                  className="topic-search"
                  placeholder="Search topics..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              
              <div className="topics-list-container">
                <h4 className="topics-list-header">Select destination topic:</h4>
                
                {filteredTopics.length === 0 ? (
                  <div className="no-topics-message">
                    {searchText ? 
                      "No matching topics found. Try a different search term." : 
                      "No other topics available for this subject. Please create another topic first."}
                  </div>
                ) : (
                  <div className="topics-list">
                    {filteredTopics.map(topic => (
                      <div 
                        key={topic.id} 
                        className={`topic-item ${selectedTopic?.id === topic.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTopic(topic)}
                      >
                        <span className="topic-name">
                          {topic.name || topic.topic || topic.parsedName}
                        </span>
                        {selectedTopic?.id === topic.id && (
                          <FaCheck className="selected-icon" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="reassignment-modal-footer">
          <button 
            className="cancel-button"
            onClick={onClose}
            disabled={isLoading || success}
          >
            Cancel
          </button>
          
          {!success && (
            <button 
              className="reassign-button"
              onClick={handleReassign}
              disabled={isLoading || !selectedTopic}
            >
              {isLoading ? 'Reassigning...' : 'Reassign Cards'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TopicReassignmentModal;
