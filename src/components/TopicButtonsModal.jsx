import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaPlus, FaStar, FaTrash, FaMagic, FaSave } from 'react-icons/fa';
import './TopicButtonsModal.css';

/**
 * TopicButtonsModal - Displays a modal with buttons for each topic
 * 
 * This component allows users to view all their topics organized by category
 * and perform actions like generating cards directly or deleting topics.
 */
const TopicButtonsModal = ({
  topics = [],
  subject,
  examBoard,
  examType,
  onClose,
  onGenerateCards,
  onDeleteTopic,
  onAddTopic,
  onSaveTopics
}) => {
  const [activePopup, setActivePopup] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrioritizePopup, setShowPrioritizePopup] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Close all popups when the main modal closes
  useEffect(() => {
    setActivePopup(null);
    setShowPrioritizePopup(false);
    setTopicToDelete(null);
  }, []);

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
      setUnsavedChanges(true);
    }
  }, [topicToDelete, onDeleteTopic]);

  const handleSaveTopics = useCallback(() => {
    if (onSaveTopics) {
      onSaveTopics();
      setUnsavedChanges(false);
    }
  }, [onSaveTopics]);

  const modalContent = (
    <div className="topic-buttons-modal-overlay" onClick={() => onClose()}>
      <div className="topic-buttons-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Topics for {subject} ({examBoard} {examType})</h2>
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
            {unsavedChanges && (
              <button 
                className="save-topics-button" 
                onClick={handleSaveTopics}
              >
                <FaSave /> Save Changes
              </button>
            )}
            <button className="close-modal-button" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="modal-content">
          <div className="topic-buttons-container">
            {Object.keys(groupedTopics).length > 0 ? (
              Object.entries(groupedTopics).map(([category, categoryTopics]) => (
                <div key={category} className="topic-category-section">
                  <h3 className="category-heading">{category}</h3>
                  <div className="topic-buttons-grid">
                    {categoryTopics.map((topic) => (
                      <div key={topic.id || topic.fullName} className="topic-button">
                        <span className="topic-name">{topic.displayName || topic.name}</span>
                        <div className="topic-actions">
                          <button
                            className="generate-button"
                            onClick={() => setActivePopup(topic.id || topic.fullName)}
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
              ))
            ) : (
              <div className="no-topics-message">
                <p>No topics available for this subject.</p>
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
                onClick={() => {
                  const selectedTopic = topics.find(t => (t.id || t.fullName) === activePopup);
                  if (selectedTopic) {
                    handleGenerateCards(selectedTopic);
                  }
                }}
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
