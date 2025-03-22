import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaPlus, FaStar, FaTrash, FaMagic, FaSave, FaFolder, FaCheck, FaRegStar } from 'react-icons/fa';
import ModalOverlay from './ModalOverlay';
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
  onSaveTopics,
  onTopicChange,
  onPrioritizeTopic,
  currentTopic
}) => {
  const [activePopup, setActivePopup] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrioritizePopup, setShowPrioritizePopup] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [organizedTopics, setOrganizedTopics] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTopics, setFilteredTopics] = useState({});

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

  useEffect(() => {
    if (topics) {
      const organized = organizeTopics(topics);
      setOrganizedTopics(organized);
      setFilteredTopics(organized);
    }
  }, [topics, organizeTopics]);

  // Update filtered topics when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredTopics(organizedTopics);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = {};

    // Filter topics by search term
    Object.entries(organizedTopics).forEach(([category, subcategories]) => {
      const filteredSubcategories = {};
      
      Object.entries(subcategories).forEach(([subcategory, topicsArray]) => {
        const matchedTopics = topicsArray.filter(topic => 
          topic.name.toLowerCase().includes(searchLower)
        );
        
        if (matchedTopics.length > 0) {
          filteredSubcategories[subcategory] = matchedTopics;
        }
      });
      
      if (Object.keys(filteredSubcategories).length > 0) {
        filtered[category] = filteredSubcategories;
      }
    });
    
    setFilteredTopics(filtered);
  }, [searchTerm, organizedTopics]);

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

  // Handle click on a topic button
  const handleTopicClick = (topic) => {
    if (onTopicChange) {
      onTopicChange(topic);
    }
  };

  // Show deletion confirmation
  const handleShowDeleteConfirmation = (topic, e) => {
    e.stopPropagation();
    setTopicToDelete(topic);
  };

  // Handle topic prioritization
  const handlePrioritizeTopic = (topic, e) => {
    e.stopPropagation();
    if (onPrioritizeTopic) {
      onPrioritizeTopic(topic);
    }
  };

  // Handle adding a new topic
  const handleAddNewTopic = () => {
    if (onAddTopic) {
      onAddTopic();
      onClose();
    }
  };

  const modalContent = (
    <ModalOverlay isOpen={true} onClose={onClose} zIndex={1050}>
      <div className="topic-buttons-modal">
        <div className="modal-header">
          <h2>Topics for {subject} ({examBoard} {examType})</h2>
          <div className="modal-actions">
            <button className="add-topic-button" onClick={handleAddNewTopic}>
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

        <div className="modal-search">
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="modal-content">
          <div className="topic-buttons-container">
            {Object.keys(filteredTopics).length > 0 ? (
              <div className="topic-categories">
                {Object.entries(filteredTopics).map(([category, subcategories]) => (
                  <div key={category} className="topic-category">
                    <h3 className="category-title">{category}</h3>
                    
                    {Object.entries(subcategories).map(([subcategory, topicsArray]) => (
                      <div key={subcategory} className="topic-subcategory">
                        <h4 className="subcategory-title">{subcategory}</h4>
                        
                        <div className="topics-grid">
                          {topicsArray.map((topic) => (
                            <div 
                              key={topic.id} 
                              className={`topic-button-container ${currentTopic === topic.id ? 'selected' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTopicClick(topic);
                              }}
                            >
                              <span 
                                className="topic-name" 
                                title={topic.parsedName || topic.displayName || topic.name}
                              >
                                {topic.parsedName || topic.displayName || topic.name}
                              </span>
                              
                              <div className="topic-actions">
                                <button 
                                  className="action-button generate" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateCards(topic);
                                  }}
                                  title="Generate cards"
                                >
                                  <FaMagic />
                                </button>
                                
                                <button 
                                  className={`action-button prioritize ${topic.priority ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrioritizeTopic(topic, e);
                                  }}
                                  title={topic.priority ? "Remove priority" : "Prioritize topic"}
                                >
                                  {topic.priority ? <FaStar /> : <FaRegStar />}
                                </button>
                                
                                <button 
                                  className="action-button delete" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowDeleteConfirmation(topic, e);
                                  }}
                                  title="Delete topic"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-topics-message">
                <p>No topics available for this subject.</p>
                <p>Click "Add Topic" to create your first topic</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="add-topic-button" 
            onClick={handleAddNewTopic}
          >
            <FaPlus /> Add New Topic
          </button>
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

        {/* Delete Confirmation Modal */}
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
    </ModalOverlay>
  );

  return createPortal(modalContent, document.body);
};

export default TopicButtonsModal;
