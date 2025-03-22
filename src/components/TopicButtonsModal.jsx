import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaPlus, FaStar, FaTrash, FaMagic, FaSave, FaFolder, FaEye, FaExchangeAlt, FaInfoCircle, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import './TopicButtonsModal.css';
import './TopicButtonsModal.additions.css';
import { findCardsForTopic, cleanupDeletedTopic, reassignCards, verifyTopicHasCards } from '../services/TopicCardSyncService';

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
  const [topicCardInfo, setTopicCardInfo] = useState({ hasCards: false, count: 0, cards: [] });
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [isCheckingCards, setIsCheckingCards] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Close all popups when the main modal closes
  useEffect(() => {
    setActivePopup(null);
    setShowPrioritizePopup(false);
    setTopicToDelete(null);
    setTopicCardInfo({ hasCards: false, count: 0, cards: [] });
    setShowCardPreview(false);
    setShowReassignModal(false);
    setShowRegenerateConfirm(false);
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

  // Check if a topic has cards before deletion
  const handleTopicDelete = useCallback(async (topic, userId, auth) => {
    setIsCheckingCards(true);
    setTopicToDelete(topic);
    
    try {
      // Check if this topic has any associated cards
      const cardCheck = await verifyTopicHasCards(topic, userId, auth);
      
      if (cardCheck.hasCards) {
        // If it has cards, get the actual cards for preview
        const topicCards = await findCardsForTopic(topic, userId, auth);
        setTopicCardInfo({
          hasCards: true,
          count: cardCheck.count,
          cards: topicCards
        });
      } else {
        setTopicCardInfo({
          hasCards: false,
          count: 0,
          cards: []
        });
      }
    } catch (error) {
      console.error('Error checking topic cards:', error);
      // If there's an error checking cards, assume there are none
      setTopicCardInfo({ hasCards: false, count: 0, cards: [] });
    } finally {
      setIsCheckingCards(false);
    }
  }, []);

  // Handle delete confirmation with card deletion
  const handleDeleteConfirm = useCallback(async (userId, auth) => {
    if (!topicToDelete) return;
    
    setIsDeleting(true);
    
    try {
      if (topicCardInfo.hasCards) {
        // Remove the orphaned cards associated with this topic
        await cleanupDeletedTopic(topicToDelete, userId, auth);
      }
      
      // Now delete the topic itself
      await onDeleteTopic(topicToDelete);
      setUnsavedChanges(true);
    } catch (error) {
      console.error('Error deleting topic and cards:', error);
    } finally {
      setIsDeleting(false);
      setTopicToDelete(null);
      setTopicCardInfo({ hasCards: false, count: 0, cards: [] });
    }
  }, [topicToDelete, topicCardInfo, onDeleteTopic]);

  // Handle reassigning cards to another topic
  const handleReassignCards = useCallback(async (targetTopic, userId, auth) => {
    if (!topicToDelete || !topicCardInfo.cards.length) return;
    
    try {
      // Reassign the cards to the target topic
      await reassignCards(topicCardInfo.cards, targetTopic, userId, auth);
      
      // Now delete the original topic (without cards since they're reassigned)
      await onDeleteTopic(topicToDelete);
      setUnsavedChanges(true);
      
      // Close the reassign modal
      setShowReassignModal(false);
      setTopicToDelete(null);
      setTopicCardInfo({ hasCards: false, count: 0, cards: [] });
    } catch (error) {
      console.error('Error reassigning cards:', error);
    }
  }, [topicToDelete, topicCardInfo, onDeleteTopic]);

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
              <button className="add-topic-button" onClick={onAddTopic} title="Add a new topic">
                <FaPlus /> Add Topic
              </button>
              <button 
                className="regenerate-button" 
                onClick={() => setShowRegenerateConfirm(true)}
                title="Regenerate all topics"
              >
                <FaSync /> Regenerate
              </button>
              <button 
                className="prioritize-button" 
                onClick={() => setShowPrioritizePopup(true)}
                title="Prioritize topics"
              >
                <FaStar /> Prioritize
              </button>
              {unsavedChanges && (
                <button 
                  className="save-topics-button" 
                  onClick={handleSaveTopics}
                  title="Save changes"
                >
                  <FaSave /> Save Changes
                </button>
              )}
              <button className="close-modal-button" onClick={onClose} title="Close modal">
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
                                onClick={() => setActivePopup(topic.id || topic.fullName)}
                                title="Generate Cards"
                              >
                                <FaMagic />
                              </button>
                              <button
                                className="delete-button"
                                onClick={() => handleTopicDelete(topic, /* userId and auth from props */)}
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

        {/* Enhanced Delete Confirmation Modal */}
        {topicToDelete && createPortal(
          <div 
            className="action-modal-overlay" 
            onClick={(e) => {
              e.stopPropagation();
              if (!isCheckingCards && !isDeleting) {
                setTopicToDelete(null);
                setTopicCardInfo({ hasCards: false, count: 0, cards: [] });
              }
            }}
          >
            <div className="action-modal" onClick={e => e.stopPropagation()}>
              <div className="action-modal-header">
                <h3>
                  {isCheckingCards ? 'Checking Topic' : 'Delete Topic'}
                  {topicCardInfo.hasCards && !isCheckingCards && ' and Cards'}
                </h3>
              </div>
              
              {isCheckingCards ? (
                <div className="action-modal-content checking-content">
                  <div className="checking-spinner"></div>
                  <p>Checking if this topic has associated cards...</p>
                </div>
              ) : (
                <div className="action-modal-content">
                  {topicCardInfo.hasCards ? (
                    <>
                      <div className="warning-message">
                        <FaExclamationTriangle className="warning-icon" />
                        <div>
                          <p>This topic has <strong>{topicCardInfo.count} associated cards</strong>.</p>
                          <p>Deleting this topic will also remove these cards from your card bank.</p>
                        </div>
                      </div>
                      <div className="topic-delete-options">
                        <button 
                          className="option-button preview-button"
                          onClick={() => setShowCardPreview(true)}
                        >
                          <FaEye /> View Cards
                        </button>
                        <button 
                          className="option-button reassign-button"
                          onClick={() => setShowReassignModal(true)}
                        >
                          <FaExchangeAlt /> Reassign Cards
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Are you sure you want to delete this topic?</p>
                      <p>This action cannot be undone.</p>
                    </>
                  )}
                </div>
              )}
              
              <div className="action-modal-footer">
                {!isCheckingCards && (
                  <>
                    <button 
                      className="cancel-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTopicToDelete(null);
                        setTopicCardInfo({ hasCards: false, count: 0, cards: [] });
                      }}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      className="action-button delete-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConfirm(/* userId and auth from props */);
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 
                       topicCardInfo.hasCards ? 'Delete Topic & Cards' : 'Delete Topic'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Card Preview Modal */}
        {showCardPreview && topicToDelete && createPortal(
          <div 
            className="card-preview-modal-overlay" 
            onClick={() => setShowCardPreview(false)}
          >
            <div className="card-preview-modal" onClick={e => e.stopPropagation()}>
              <div className="card-preview-header">
                <h3>Cards for Topic: {topicToDelete.name || topicToDelete.parsedName}</h3>
                <button 
                  className="close-button"
                  onClick={() => setShowCardPreview(false)}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="card-preview-content">
                {topicCardInfo.cards.length === 0 ? (
                  <p className="no-cards-message">No cards found for this topic.</p>
                ) : (
                  <div className="cards-grid">
                    {topicCardInfo.cards.map(card => (
                      <div 
                        key={card.id} 
                        className="card-preview-item"
                        style={{ backgroundColor: card.cardColor || '#f0f0f0' }}
                      >
                        <div className="card-preview-question">
                          <div dangerouslySetInnerHTML={{ __html: card.front || card.question }} />
                        </div>
                        <div className="card-preview-meta">
                          <span className="card-type">{card.questionType}</span>
                          <span className="card-box">Box {card.boxNum || 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-preview-footer">
                <button 
                  className="back-button"
                  onClick={() => setShowCardPreview(false)}
                >
                  Back to Delete Options
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        
        {/* Reassign Topic Modal */}
        {showReassignModal && topicToDelete && createPortal(
          <div 
            className="reassign-modal-overlay" 
            onClick={() => setShowReassignModal(false)}
          >
            <div className="reassign-modal" onClick={e => e.stopPropagation()}>
              <div className="reassign-modal-header">
                <h3>Reassign Cards to Another Topic</h3>
                <button 
                  className="close-button"
                  onClick={() => setShowReassignModal(false)}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="reassign-modal-content">
                <p>Select a topic to move the cards to:</p>
                
                <div className="topics-list">
                  {topics.filter(t => t.id !== topicToDelete.id).length === 0 ? (
                    <p className="no-topics-message">
                      No other topics available. Please create another topic first.
                    </p>
                  ) : (
                    topics
                      .filter(t => t.id !== topicToDelete.id)
                      .map(topic => (
                        <div 
                          key={topic.id} 
                          className="reassign-topic-item"
                          onClick={() => handleReassignCards(topic, /* userId and auth from props */)}
                        >
                          <span className="topic-name">
                            {topic.name || topic.parsedName}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
              <div className="reassign-modal-footer">
                <button 
                  className="cancel-button"
                  onClick={() => setShowReassignModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        
        {/* Regenerate Topics Confirmation */}
        {showRegenerateConfirm && createPortal(
          <div 
            className="action-modal-overlay" 
            onClick={(e) => {
              e.stopPropagation();
              setShowRegenerateConfirm(false);
            }}
          >
            <div className="action-modal warning-modal" onClick={e => e.stopPropagation()}>
              <div className="action-modal-header">
                <h3>
                  <FaExclamationTriangle className="warning-icon" /> 
                  Regenerate All Topics
                </h3>
              </div>
              <div className="action-modal-content">
                <p className="warning-text">
                  <strong>Warning:</strong> This will replace your current topic list with newly generated topics.
                </p>
                <p>Any changes to the current topic list will be lost.</p>
                <div className="info-box">
                  <FaInfoCircle className="info-icon" />
                  <p>
                    Cards created from existing topics will <strong>not</strong> be affected, but 
                    the topics themselves will be replaced with new ones.
                  </p>
                </div>
              </div>
              <div className="action-modal-footer">
                <button 
                  className="cancel-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRegenerateConfirm(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="action-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle regenerate topics
                    setShowRegenerateConfirm(false);
                  }}
                >
                  Regenerate Topics
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
