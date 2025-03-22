import React, { useState, useEffect } from "react";
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
  
  // Handle modal close with escape key
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

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
    onGenerateCards({
      topic: topic.name,
      examBoard,
      examType,
      subject
    });
  };
  
  // Handle deleting a topic
  const handleDeleteTopic = (topic, event) => {
    event.stopPropagation();
    
    // Set the topic to delete and show confirmation modal
    setTopicToDelete(topic);
    setShowDeleteConfirm(true);
  };
  
  // Confirm topic deletion
  const confirmDeleteTopic = () => {
    if (topicToDelete) {
      onDeleteTopic(topicToDelete.id);
      setUnsavedChanges(true);
    }
    setShowDeleteConfirm(false);
    setTopicToDelete(null);
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
  
  // Render delete confirmation modal
  const renderDeleteConfirmation = () => {
    if (!showDeleteConfirm) return null;
    
    return (
      <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
        <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Delete Topic</h3>
          <p>Are you sure you want to delete this topic?</p>
          <p className="warning">{topicToDelete?.displayName}</p>
          <div className="delete-confirm-actions">
            <button 
              className="cancel-button" 
              onClick={() => {
                setShowDeleteConfirm(false);
                setTopicToDelete(null);
              }}
            >
              Cancel
            </button>
            <button 
              className="delete-button" 
              onClick={confirmDeleteTopic}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="topic-buttons-modal-overlay" onClick={onClose}>
      <div className="topic-buttons-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-button" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <h2>Topics for {subject} ({examBoard} {examType})</h2>
          <div className="modal-actions">
            <button 
              className="add-topic-button" 
              onClick={() => setShowAddTopicModal(true)}
            >
              Add Topic
            </button>
            
            {unsavedChanges && (
              <button 
                className="save-topics-button" 
                onClick={onSaveTopics}
              >
                Save Changes
              </button>
            )}
          </div>
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
        
        {renderAddTopicModal()}
        {renderDeleteConfirmation()}
      </div>
    </div>
  );
};

export default TopicButtonsModal;
