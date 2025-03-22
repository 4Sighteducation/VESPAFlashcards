import React, { useState } from 'react';
import { FaFolder, FaEdit, FaTrash, FaPlus, FaExclamationTriangle, FaSave } from 'react-icons/fa';

/**
 * TopicReviewStep - Second step in the topic modal flow
 * Allows users to review, edit, add, and delete topics before saving
 */
const TopicReviewStep = ({
  topics,
  onAddTopic,
  onDeleteTopic,
  onEditTopic,
  error
}) => {
  const [newTopicName, setNewTopicName] = useState('');
  const [editMode, setEditMode] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Handle adding a new topic
  const handleAddTopic = (e) => {
    e.preventDefault();
    
    if (newTopicName.trim()) {
      onAddTopic(newTopicName);
      setNewTopicName('');
    }
  };

  // Handle entering edit mode for a topic
  const handleStartEdit = (topic) => {
    setEditMode(topic.id);
    setEditValue(topic.name);
  };

  // Handle saving an edited topic
  const handleSaveEdit = (topicId) => {
    if (editValue.trim()) {
      onEditTopic(topicId, editValue);
    }
    setEditMode(null);
    setEditValue('');
  };

  // Handle canceling an edit
  const handleCancelEdit = () => {
    setEditMode(null);
    setEditValue('');
  };

  // Organize topics into categories
  const organizeTopics = () => {
    // In a real implementation, this would organize topics into categories
    // For now, we'll just put them all in one category
    return [
      {
        id: 'main',
        name: 'Main Topics',
        topics: topics
      }
    ];
  };

  const categories = organizeTopics();

  return (
    <div className="topic-review-step">
      <div className="review-description">
        <h3>Review Topics</h3>
        <p>
          Review the generated topics below. You can add, edit, or delete topics as needed.
          Once you're satisfied with the list, proceed to the next step to save your topics.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <FaExclamationTriangle />
          <span>{error}</span>
        </div>
      )}

      <div className="topic-list">
        {categories.map((category) => (
          <div key={category.id} className="topic-category">
            <div className="topic-category-header">
              <FaFolder /> {category.name}
            </div>
            <div className="topic-items">
              {category.topics.length === 0 ? (
                <div className="empty-topic-message">
                  No topics in this category. Add a topic below.
                </div>
              ) : (
                category.topics.map((topic) => (
                  <div key={topic.id} className="topic-item">
                    {editMode === topic.id ? (
                      <div className="topic-edit-form">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(topic.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button onClick={() => handleSaveEdit(topic.id)}>
                          <FaSave />
                        </button>
                        <button onClick={handleCancelEdit}>
                          <FaExclamationTriangle />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="topic-item-name">{topic.name}</span>
                        <div className="topic-item-actions">
                          <button
                            className="edit-button"
                            onClick={() => handleStartEdit(topic)}
                            title="Edit Topic"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => onDeleteTopic(topic.id)}
                            title="Delete Topic"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <form className="add-topic-form" onSubmit={handleAddTopic}>
        <input
          type="text"
          placeholder="Enter a new topic name"
          value={newTopicName}
          onChange={(e) => setNewTopicName(e.target.value)}
        />
        <button type="submit" disabled={!newTopicName.trim()}>
          <FaPlus /> Add Topic
        </button>
      </form>

      <div className="review-help-text">
        <p>
          <strong>Tip:</strong> You can add as many topics as needed. Make sure your topics
          align with the curriculum requirements for your subject.
        </p>
      </div>
    </div>
  );
};

export default TopicReviewStep;
