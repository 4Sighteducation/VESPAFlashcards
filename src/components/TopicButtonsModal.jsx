import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaPlus, FaStar, FaTrash, FaMagic, FaSave, FaFolder, FaBolt } from 'react-icons/fa';
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

  // Group topics by main category and subcategory
  const organizeTopics = useCallback((topicsList) => {
    const organizedTopics = {};
    
    topicsList.forEach(topic => {
      // Extract topic name information
      let name = topic.displayName || topic.name || '';
      let mainCategory = 'General';
      let subCategory = null;
      
      // Check for main topic pattern (e.g., "Politics of the Late Republic: Civil War")
      const mainTopicMatch = name.match(/^([^:]+):\s*(.+)$/);
      
      if (mainTopicMatch) {
        mainCategory = mainTopicMatch[1].trim();
        
        // Check if there's a subcategory (e.g., "Civil War")
        const subParts = mainTopicMatch[2].split(/\s*-\s*/);
        if (subParts.length > 1) {
          subCategory = subParts[0].trim();
          name = subParts.slice(1).join(' - ').trim();
        } else {
          name = mainTopicMatch[2].trim();
        }
      }
      
      // Create main category if it doesn't exist
      if (!organizedTopics[mainCategory]) {
        organizedTopics[mainCategory] = {
          mainCategory: true,
          subcategories: {}
        };
      }
      
      // Use subcategory if available, otherwise use generic "Topics"
      const subcategoryKey = subCategory || 'Topics';
      
      // Create subcategory if it doesn't exist
      if (!organizedTopics[mainCategory].subcategories[subcategoryKey]) {
        organizedTopics[mainCategory].subcategories[subcategoryKey] = [];
      }
      
      // Add topic to its subcategory
      organizedTopics[mainCategory].subcategories[subcategoryKey].push({
        ...topic,
        parsedName: name
      });
    });
    
    return organizedTopics;
  }, []);

  const organizedTopics = organizeTopics(topics);

  // Updated handle generate cards to use FlashcardGeneratorBridge instead of AICardGenerator
  const handleGenerateCards = useCallback(async (topic) => {
    setIsGenerating(true);
    try {
      // Get the topic data to pass to the bridge
      const topicData = {
        ...topic,
        subject,
        examBoard,
        examType,
        // Ensure the topic name is properly set
        topic: topic.name || topic.parsedName || topic.displayName || topic.fullName
      };
      
      console.log("Generating cards with topic data:", topicData);
      
      // Instead of using onGenerateCards directly, dispatch a custom event
      // that App.js will listen for to show the FlashcardGeneratorBridge
      window.dispatchEvent(
        new CustomEvent('openFlashcardBridge', { 
          detail: { topic: topicData }
        })
      );
      
      // Close the topic modal
      onClose();
    } catch (error) {
      console.error('Error generating cards:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [subject, examBoard, examType, onClose]);

  // State for delete topic list confirmation
  const [showDeleteListConfirmation, setShowDeleteListConfirmation] = useState(false);
  const [topicListToDelete, setTopicListToDelete] = useState(null);

  const handleDeleteConfirm = useCallback(async () => {
    if (topicToDelete) {
      await onDeleteTopic(topicToDelete);
      setTopicToDelete(null);
      setUnsavedChanges(true);
    }
  }, [topicToDelete, onDeleteTopic]);

  // Handle delete topic list confirmation
  const handleDeleteListConfirm = useCallback(async () => {
    if (topicListToDelete) {
      // Here would be the actual deletion logic for a topic list
      console.log("Deleting topic list:", topicListToDelete);
      setTopicListToDelete(null);
      setShowDeleteListConfirmation(false);
    }
  }, [topicListToDelete]);

  const handleSaveTopics = useCallback(() => {
    if (onSaveTopics) {
      onSaveTopics();
      setUnsavedChanges(false);
    }
  }, [onSaveTopics]);

  const modalContent = (
    <div className="reset-style-root">
      <div 
        className="topic-buttons-modal-overlay" 
        onClick={() => {
          // Only close the parent modal if no child modal is open
          if (!activePopup && !topicToDelete && !showPrioritizePopup) {
            onClose();
          }
        }}
      >
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
              {Object.keys(organizedTopics).length > 0 ? (
                Object.entries(organizedTopics).map(([mainCategory, categoryData]) => (
                  <div key={mainCategory} className="topic-category-section">
                    <h3 className="category-heading">
                      <FaFolder className="category-icon" /> {mainCategory}
                    </h3>
                    
                    {Object.entries(categoryData.subcategories).map(([subCategory, subTopics]) => (
                      <div key={`${mainCategory}-${subCategory}`} className="subcategory-section">
                        {subCategory !== 'Topics' && (
                          <h4 className="subcategory-heading">{subCategory}</h4>
                        )}
                        
                        {subTopics.map((topic) => (
                          <div key={topic.id || topic.fullName} className="topic-button">
                            <span 
                              className="topic-name" 
                              title={topic.parsedName || topic.displayName || topic.name}
                            >
                              {topic.parsedName || topic.displayName || topic.name}
                            </span>
                            <div className="topic-actions">
                              <button
                                className="generate-button"
                                onClick={() => handleGenerateCards(topic)}
                                title="Generate Cards"
                              >
                                <FaBolt />
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
                    ))}
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
          <div 
            className="action-modal-overlay" 
            onClick={(e) => {
              e.stopPropagation(); // Prevent event from reaching parent
              setActivePopup(null);
            }}
          >
            <div className="action-modal" onClick={e => e.stopPropagation()}>
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
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from reaching parent
                    setActivePopup(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="action-button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from reaching parent
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

        {/* Delete Topic Confirmation Modal */}
        {topicToDelete && createPortal(
          <div 
            className="action-modal-overlay" 
            onClick={(e) => {
              e.stopPropagation(); // Prevent event from reaching parent
              setTopicToDelete(null);
            }}
          >
            <div className="action-modal" onClick={e => e.stopPropagation()}>
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
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from reaching parent
                    setTopicToDelete(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="action-button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from reaching parent
                    handleDeleteConfirm();
                  }}
                >
                  Delete Topic
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Delete Topic List Confirmation Modal */}
        {showDeleteListConfirmation && createPortal(
          <div 
            className="action-modal-overlay" 
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteListConfirmation(false);
              setTopicListToDelete(null);
            }}
          >
            <div className="action-modal" onClick={e => e.stopPropagation()}>
              <div className="action-modal-header">
                <h3>Delete Topic List</h3>
              </div>
              <div className="action-modal-content">
                <p>Are you sure you want to delete this topic list?</p>
                <p>This will remove the entire list and cannot be undone.</p>
              </div>
              <div className="action-modal-footer">
                <button 
                  className="cancel-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteListConfirmation(false);
                    setTopicListToDelete(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="action-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteListConfirm();
                  }}
                >
                  Delete List
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Prioritize Coming Soon Popup */}
        {showPrioritizePopup && createPortal(
          <div 
            className="action-modal-overlay" 
            onClick={(e) => {
              e.stopPropagation(); // Prevent event from reaching parent
              setShowPrioritizePopup(false);
            }}
          >
            <div className="action-modal" onClick={e => e.stopPropagation()}>
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
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from reaching parent
                    setShowPrioritizePopup(false);
                  }}
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default TopicButtonsModal;
