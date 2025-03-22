import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./TopicButtonsModal.css";

/**
 * TopicButtonsModal component - Displays topics as buttons with actions
 * 
 * This component allows users to see and interact with their topics in a visually
 * appealing way. Each topic is displayed as a button with options to generate
 * cards directly or delete the topic.
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
  // State for grouped topics by category
  const [groupedTopics, setGroupedTopics] = useState({});
  // State for new topic modal
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicCategory, setNewTopicCategory] = useState("");
  const [existingCategories, setExistingCategories] = useState([]);
  const [addingTopic, setAddingTopic] = useState(false);
  // State for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);
  // State for save confirmation
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  // State for popup positioning
  const [activePopup, setActivePopup] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [popupPlacement, setPopupPlacement] = useState('bottom');
  const [showPrioritizePopup, setShowPrioritizePopup] = useState(false);
  const [prioritizePopupPosition, setPrioritizePopupPosition] = useState({ top: 0, left: 0 });
  
  const modalRef = useRef(null);
  const popupRef = useRef(null);
  const prioritizeButtonRef = useRef(null);

  // Create portal container for modals
  useEffect(() => {
    const portalContainer = document.createElement('div');
    portalContainer.id = 'modal-portal';
    document.body.appendChild(portalContainer);
    return () => {
      document.body.removeChild(portalContainer);
    };
  }, []);

  // Handle click outside for all modals
  useEffect(() => {
    const handleClickOutside = (event) => {
      if ((showPrioritizePopup && 
          !event.target.closest('.prioritize-button') && 
          !event.target.closest('.coming-soon-popup')) ||
          (activePopup && 
          !event.target.closest('.action-modal'))) {
        setShowPrioritizePopup(false);
        setActivePopup(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPrioritizePopup, activePopup]);

  // Handle escape key for all modals
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        if (showPrioritizePopup) {
          setShowPrioritizePopup(false);
        } else if (showAddTopicModal) {
          setShowAddTopicModal(false);
        } else if (activePopup) {
          setActivePopup(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showPrioritizePopup, showAddTopicModal, activePopup, onClose]);

  // Calculate popup position
  const calculatePopupPosition = (buttonElement, popupType) => {
    if (!buttonElement) return;

    const buttonRect = buttonElement.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    let top = buttonRect.bottom + 8;
    let left = buttonRect.left + (buttonRect.width / 2) - 160;

    // Check if popup would go below viewport
    if (top + 200 > windowHeight) {
      top = buttonRect.top - 216; // Height of popup + padding
    }

    // Check if popup would go off screen to the right
    if (left + 320 > windowWidth) {
      left = windowWidth - 340;
    }

    // Check if popup would go off screen to the left
    if (left < 20) {
      left = 20;
    }

    return { top, left };
  };

  // Group topics by category on component mount or when topics change
  useEffect(() => {
    if (topics && topics.length > 0) {
      const grouped = groupTopicsByCategory(topics);
      setGroupedTopics(grouped);
      
      // Extract unique categories for dropdown
      const categories = [...new Set(Object.keys(grouped))];
      setExistingCategories(categories);
      
      if (categories.length > 0 && !newTopicCategory) {
        setNewTopicCategory(categories[0]);
      }
    } else {
      setGroupedTopics({});
      setExistingCategories([]);
    }
  }, [topics]);
  
  // Helper function to group topics by category
  const groupTopicsByCategory = (topicsList) => {
    const groups = {};
    
    topicsList.forEach(topic => {
      // Extract category from topic name (before the colon)
      let category = "General";
      let name = topic.name || topic;
      
      if (name.includes(":")) {
        const parts = name.split(":");
        category = parts[0].trim();
        name = parts[1].trim();
      }
      
      if (!groups[category]) {
        groups[category] = [];
      }
      
      groups[category].push({
        ...topic,
        displayName: name,
        category: category,
        fullName: topic.name || topic
      });
    });
    
    // Sort categories alphabetically
    return Object.keys(groups)
      .sort()
      .reduce((acc, key) => {
        acc[key] = groups[key].sort((a, b) => a.displayName.localeCompare(b.displayName));
        return acc;
      }, {});
  };
  
  // Handle generating cards for a topic
  const handleGenerateCards = (topic, event) => {
    event.stopPropagation();
    setActivePopup({ type: 'generate', topic });
  };
  
  // Handle deleting a topic
  const handleDeleteTopic = (topic, event) => {
    event.stopPropagation();
    setTopicToDelete(topic);
    setActivePopup({ type: 'delete', topic });
  };
  
  // Handle adding a new topic
  const handleAddTopic = () => {
    if (!newTopicName.trim()) {
      return;
    }
    
    setAddingTopic(true);
    
    // Format the topic name based on category
    let fullTopicName = newTopicName.trim();
    if (newTopicCategory && newTopicCategory !== "General") {
      fullTopicName = `${newTopicCategory}: ${newTopicName.trim()}`;
    }
    
    // Call the parent component's onAddTopic function
    onAddTopic(fullTopicName)
      .then(() => {
        setNewTopicName("");
        setShowAddTopicModal(false);
        setUnsavedChanges(true);
      })
      .finally(() => {
        setAddingTopic(false);
      });
  };
  
  // Handle prioritize button click
  const handlePrioritizeClick = () => {
    if (prioritizeButtonRef.current) {
      const buttonRect = prioritizeButtonRef.current.getBoundingClientRect();
      const position = {
        top: buttonRect.bottom + 8,
        left: Math.max(20, buttonRect.left + (buttonRect.width / 2) - 160)
      };
      setPrioritizePopupPosition(position);
      setShowPrioritizePopup(true);
    }
  };
  
  // Render "Add Topic" modal
  const renderAddTopicModal = () => {
    if (!showAddTopicModal) return null;
    
    return (
      <div className="add-topic-modal-overlay" onClick={() => setShowAddTopicModal(false)}>
        <div className="add-topic-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Add New Topic</h3>
          <div className="add-topic-form">
            <div className="form-group">
              <label htmlFor="category-select">Category</label>
              <div className="select-wrapper">
                <select
                  id="category-select"
                  value={newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value)}
                >
                  {existingCategories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="new">+ Add new category</option>
                </select>
              </div>
            </div>
            
            {newTopicCategory === "new" && (
              <div className="form-group">
                <label htmlFor="new-category-input">New Category</label>
                <input
                  id="new-category-input"
                  type="text"
                  placeholder="Enter new category"
                  value={newTopicCategory === "new" ? "" : newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value)}
                />
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="topic-input">Topic Name</label>
              <input
                id="topic-input"
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Enter topic name"
              />
            </div>
            
            <div className="add-topic-actions">
              <button 
                className="cancel-button" 
                onClick={() => {
                  setNewTopicName("");
                  setShowAddTopicModal(false);
                }}
              >
                Cancel
              </button>
              <button 
                className="add-button" 
                onClick={handleAddTopic}
                disabled={!newTopicName.trim() || addingTopic}
              >
                {addingTopic ? "Adding..." : "Add Topic"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render action modal content
  const renderActionModal = () => {
    if (!activePopup) return null;

    const isGenerateModal = activePopup.type === 'generate';
    const modalClass = isGenerateModal ? 'generate-modal' : 'delete-modal';

    const content = (
      <div className="action-modal-overlay">
        <div className={`action-modal ${modalClass}`}>
          <div className="action-modal-header">
            <h3>
              {isGenerateModal ? 'Generate Flashcards' : 'Delete Topic'}
            </h3>
          </div>
          
          <div className="action-modal-content">
            <p>
              {isGenerateModal 
                ? 'Are you sure you want to generate flashcards for this topic?' 
                : 'Are you sure you want to delete this topic? This action cannot be undone.'}
            </p>
            
            <div className="topic-name">
              {activePopup.topic.displayName}
            </div>
            
            {isGenerateModal && (
              <p className="help-text">
                This will create a new set of flashcards based on the curriculum content for this topic.
              </p>
            )}
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
                if (isGenerateModal) {
                  onGenerateCards(activePopup.topic);
                } else {
                  onDeleteTopic(activePopup.topic);
                }
                setActivePopup(null);
              }}
            >
              {isGenerateModal ? 'Generate Cards' : 'Delete Topic'}
            </button>
          </div>
        </div>
      </div>
    );

    return createPortal(content, document.getElementById('modal-portal'));
  };
  
  // Render prioritize popup
  const renderPrioritizePopup = () => {
    if (!showPrioritizePopup) return null;

    const content = (
      <div 
        className="topic-popup"
        style={{
          top: prioritizePopupPosition.top,
          left: prioritizePopupPosition.left
        }}
      >
        <div className="coming-soon-popup">
          <h4>🌟 Coming Soon! 🌟</h4>
          <p>Our AI minions are working hard to bring you this awesome feature!</p>
          <p className="fun-message">In the meantime, why not generate some flashcards? They're like priorities, but without the guilt trip! 😄</p>
          <div className="popup-actions">
            <button 
              onClick={() => setShowPrioritizePopup(false)}
              className="confirm-button"
            >
              Got it! 👍
            </button>
          </div>
        </div>
      </div>
    );

    return createPortal(content, document.getElementById('popup-portal'));
  };
  
  return (
    <div className="topic-buttons-modal-overlay" onClick={onClose}>
      <div 
        ref={modalRef}
        className="topic-buttons-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Topics for {subject} ({examBoard} {examType})</h2>
          <div className="modal-actions">
            <button 
              className="add-topic-button" 
              onClick={() => setShowAddTopicModal(true)}
            >
              <span className="button-icon">➕</span>
              Add Topic
            </button>
            
            <button 
              ref={prioritizeButtonRef}
              className="prioritize-button" 
              onClick={handlePrioritizeClick}
              title="Prioritize topics"
            >
              <span className="button-icon">⭐</span>
              Prioritize
            </button>
            
            {unsavedChanges && (
              <button 
                className="save-topics-button" 
                onClick={onSaveTopics}
              >
                <span className="button-icon">💾</span>
                Save Changes
              </button>
            )}
          </div>
          <button className="close-modal-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          {Object.keys(groupedTopics).length > 0 ? (
            <div className="topic-buttons-container">
              {Object.entries(groupedTopics).map(([category, categoryTopics]) => (
                <div key={category} className="topic-category-section">
                  <h3 className="category-heading">{category}</h3>
                  <div className="topic-buttons-grid">
                    {categoryTopics.map(topic => (
                      <div key={topic.id || topic.fullName} className="topic-button-wrapper">
                        <div className="topic-button">
                          <div className="topic-name">{topic.displayName}</div>
                          <div className="topic-actions">
                            <button 
                              className="generate-button" 
                              onClick={(e) => handleGenerateCards(topic, e)}
                              title="Generate cards for this topic"
                            >
                              <span className="icon">📝</span>
                            </button>
                            <button 
                              className="delete-button" 
                              onClick={(e) => handleDeleteTopic(topic, e)}
                              title="Delete this topic"
                            >
                              <span className="icon">✕</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-topics-message">
              <p>No topics available for this subject.</p>
              <p>Click "Add Topic" to create your first topic or generate topics from the main screen.</p>
            </div>
          )}
        </div>
      </div>
      {renderAddTopicModal()}
      {renderActionModal()}
      {renderPrioritizePopup()}
    </div>
  );
};

export default TopicButtonsModal;
