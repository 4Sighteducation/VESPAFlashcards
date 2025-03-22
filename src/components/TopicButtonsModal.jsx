import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaPlus, FaStar, FaTrash, FaMagic } from 'react-icons/fa';
import './TopicButtonsModal.css';

/**
 * TopicButtonsModal component - Displays topics as buttons with actions
 * 
 * This component allows users to see and interact with their topics in a visually
 * appealing way. Each topic is displayed as a button with options to generate
 * cards directly or delete the topic.
 */
const TopicButtonsModal = ({ isOpen, onClose, topics = [], onGenerateCards, onDeleteTopic, onAddTopic }) => {
  const [activePopup, setActivePopup] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrioritizePopup, setShowPrioritizePopup] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);

  // Close all popups when the main modal closes
  useEffect(() => {
    if (!isOpen) {
      setActivePopup(null);
      setShowPrioritizePopup(false);
      setTopicToDelete(null);
    }
  }, [isOpen]);

  // Group topics by category
  const groupedTopics = topics.reduce((acc, topic) => {
    const category = topic.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(topic);
    return acc;
  }, {});

  const handleGenerateCards = useCallback(async (topic) => {
    setIsGenerating(true);
    try {
      await onGenerateCards(topic);
      setActivePopup(null);
    } catch (error) {
      console.error('Error generating cards:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateCards]);

  const handleDeleteConfirm = useCallback(async () => {
    if (topicToDelete) {
      await onDeleteTopic(topicToDelete);
      setTopicToDelete(null);
    }
  }, [topicToDelete, onDeleteTopic]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="topic-buttons-modal-overlay" onClick={() => onClose()}>
      <div className="topic-buttons-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Topics</h2>
          <div className="modal-actions">
            <button className="add-topic-button" onClick={onAddTopic}>
              <FaPlus /> Add Topic
            </button>
            <button 
              className="prioritize-button" 
              onClick={() => setShowPrioritizePopup(true)}
            >
              <FaStar /> Prioritize
            </button>
            <button className="close-modal-button" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="modal-content">
          <div className="topic-buttons-container">
            {Object.entries(groupedTopics).map(([category, categoryTopics]) => (
              <div key={category} className="topic-category-section">
                <h3 className="category-heading">{category}</h3>
                <div className="topic-buttons-grid">
                  {categoryTopics.map((topic) => (
                    <div key={topic.id} className="topic-button">
                      <span className="topic-name">{topic.name}</span>
                      <div className="topic-actions">
                        <button
                          className="generate-button"
                          onClick={() => setActivePopup(topic.id)}
                          title="Generate Cards"
                        >
                          <FaMagic />
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => setTopicToDelete(topic)}
                          title="Delete Topic"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {Object.keys(groupedTopics).length === 0 && (
              <div className="no-topics-message">
                <p>No topics found</p>
                <p>Click "Add Topic" to create your first topic</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Cards Confirmation Modal */}
      {activePopup && createPortal(
        <div className="action-modal-overlay">
          <div className="action-modal">
            <div className="action-modal-header">
              <h3>Generate Cards</h3>
            </div>
            <div className="action-modal-content">
              <p>Are you sure you want to generate cards for this topic?</p>
              <p>This will create new flashcards based on the selected topic.</p>
            </div>
            <div className="action-modal-footer">
              <button 
                className="cancel-button"
                onClick={() => setActivePopup(null)}
              >
                Cancel
              </button>
              <button
                className="action-button"
                onClick={() => handleGenerateCards(topics.find(t => t.id === activePopup))}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Cards'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {topicToDelete && createPortal(
        <div className="action-modal-overlay">
          <div className="action-modal">
            <div className="action-modal-header">
              <h3>Delete Topic</h3>
            </div>
            <div className="action-modal-content">
              <p>Are you sure you want to delete this topic?</p>
              <p>This action cannot be undone.</p>
            </div>
            <div className="action-modal-footer">
              <button 
                className="cancel-button"
                onClick={() => setTopicToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="action-button"
                onClick={handleDeleteConfirm}
              >
                Delete Topic
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Prioritize Coming Soon Popup */}
      {showPrioritizePopup && createPortal(
        <div className="action-modal-overlay">
          <div className="action-modal">
            <div className="action-modal-header">
              <h3>Coming Soon! 🌟</h3>
            </div>
            <div className="action-modal-content">
              <p>The prioritization feature is coming soon!</p>
              <p>Soon you'll be able to organize your topics by importance and create a personalized study schedule.</p>
            </div>
            <div className="action-modal-footer">
              <button 
                className="action-button"
                onClick={() => setShowPrioritizePopup(false)}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default TopicButtonsModal;
