import React, { useState, useEffect } from 'react';
import './SubjectHubModal.css'; // We'll create this CSS file next

// Define priority levels (can be moved to a utils file later)
const PRIORITY_LEVELS = {
  1: { label: "Leaf it till later", icon: "🪴", color: "#4CAF50", class: "priority-low" },
  2: { label: "Turtle mode", icon: "🐢", color: "#CDDC39", class: "priority-mild" },
  3: { label: "Brain says maybe", icon: "🧠", color: "#FF9800", class: "priority-medium" }, // Default
  4: { label: "Deadline incoming!", icon: "⏰", color: "#FF5722", class: "priority-high" },
  5: { label: "This is fine.", icon: "🔥", color: "#F44336", class: "priority-very-high" } // Shortened for display
};
const DEFAULT_PRIORITY = 3;

const SubjectHubModal = ({ isOpen, onClose, subjectData, onAddTopic, onUpdateTopicPriority, onDeleteTopic }) => {
  if (!isOpen || !subjectData) return null;

  const { name, topics = [], color } = subjectData;
  const [newTopicName, setNewTopicName] = useState('');

  // State to manage which topic's priority editor is open
  const [editingPriorityForTopic, setEditingPriorityForTopic] = useState(null);

  const handleAddTopicClick = () => {
    if (newTopicName.trim() && onAddTopic) {
      onAddTopic(subjectData.name, newTopicName.trim());
      setNewTopicName('');
    }
  };

  const handleSetPriority = (topicId, priorityValue) => {
    if (onUpdateTopicPriority) {
      onUpdateTopicPriority(subjectData.name, topicId, priorityValue);
    }
    setEditingPriorityForTopic(null); // Close editor after selection
  };

  // Effect to close priority editor if modal closes or subject changes
  useEffect(() => {
    if (!isOpen) {
      setEditingPriorityForTopic(null);
    }
  }, [isOpen]);

  return (
    <div className="subject-hub-modal-overlay" onClick={onClose}>
      <div className="subject-hub-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="subject-hub-modal-header" style={{ backgroundColor: color || '#777' }}>
          <h2>{name} - Topic Hub</h2>
          <button className="subject-hub-modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="subject-hub-modal-body">
          <div className="topic-list-section">
            <h3>Topics ({topics.length})</h3>
            {topics.length === 0 ? (
              <p>No topics yet for this subject. Add one below!</p>
            ) : (
              <ul className="topic-management-list">
                {topics.map((topic, index) => {
                  const currentPriorityValue = topic.topicPriority || DEFAULT_PRIORITY;
                  const priorityDisplay = PRIORITY_LEVELS[currentPriorityValue] || PRIORITY_LEVELS[DEFAULT_PRIORITY];
                  const isEditingThis = editingPriorityForTopic === topic.id;

                  return (
                    <li key={topic.id || index} className="topic-management-item">
                      <span className="topic-name">{topic.name || topic.topic || `Topic ${index + 1}`}</span>
                      <div className="topic-actions">
                        <div className="priority-section">
                          {isEditingThis ? (
                            <div className="priority-editor">
                              {Object.entries(PRIORITY_LEVELS).map(([level, { icon, label }]) => (
                                <button 
                                  key={level} 
                                  title={label}
                                  className={`priority-button ${PRIORITY_LEVELS[level].class}`}
                                  onClick={() => handleSetPriority(topic.id, parseInt(level))}
                                  style={{ backgroundColor: PRIORITY_LEVELS[level].color }}
                                >
                                  {icon}
                                </button>
                              ))}
                              <button className="priority-cancel-btn" onClick={() => setEditingPriorityForTopic(null)}>&times;</button>
                            </div>
                          ) : (
                            <button 
                              className={`priority-display ${priorityDisplay.class}`}
                              onClick={() => setEditingPriorityForTopic(topic.id)}
                              title={`Current priority: ${priorityDisplay.label}. Click to change.`}
                              style={{ backgroundColor: priorityDisplay.color }}
                            >
                              {priorityDisplay.icon} <span className="priority-label-tooltip">{priorityDisplay.label}</span>
                            </button>
                          )}
                        </div>
                        <button className="delete-topic-btn-hub" onClick={() => onDeleteTopic && onDeleteTopic(subjectData.name, topic.id || topic.name)} title="Delete Topic">
                          🗑️
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="add-topic-section">
            <h4>Add New Topic</h4>
            <div className="add-topic-form-container">
              <input 
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Enter new topic name"
                className="new-topic-input"
              />
              <button 
                className="add-topic-btn-hub actual-add-btn"
                onClick={handleAddTopicClick}
                disabled={!newTopicName.trim()}
              >
                + Add Topic
              </button>
            </div>
          </div>
        </div>
        <div className="subject-hub-modal-footer">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default SubjectHubModal; 