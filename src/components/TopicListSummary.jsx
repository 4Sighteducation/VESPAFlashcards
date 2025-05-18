import React, { useState, useEffect } from "react";
import "./TopicListSummary.css";
import TopicButtonsModal from "./TopicButtonsModal";
import { FaBolt, FaTrash } from "react-icons/fa";

/**
 * TopicListSummary - A streamlined component for topic list management
 * 
 * This component replaces the overly complex TopicListModal with a simpler interface
 * that focuses on showing summary information and providing clear actions.
 * 
 * Created as part of the topic-modal-refactor (see git tag 'topic-modal-original' for previous implementation)
 */
const TopicListSummary = ({
  subject,
  examBoard,
  examType,
  onClose,
  onGenerateCards,
  topics = [],
  lastUpdated = null,
  isLoading = false,
  onSaveTopics,
  onAddTopic,
  onDeleteTopic,
  onRegenerateTopics
}) => {
  const [showTopicsModal, setShowTopicsModal] = useState(false);
  const [showTopicInfoModal, setShowTopicInfoModal] = useState(false);
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [topicListToDelete, setTopicListToDelete] = useState(null);

  // Handle opening the topic selection modal for generating cards
  const handleGenerateCards = () => {
    setShowTopicsModal(true);
  };

  // Handle delete with confirmation
  const handleDeleteTopicList = (topicList) => {
    setTopicListToDelete(topicList);
    setShowDeleteConfirmation(true);
  };

  // Confirm deletion of topic list
  const confirmDeleteTopicList = () => {
    if (topicListToDelete) {
      // Call the actual delete function from props
      // onDeleteTopicList(topicListToDelete);
      dlog("Deleting topic list:", topicListToDelete);
      setShowDeleteConfirmation(false);
      setTopicListToDelete(null);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      derr("Error formatting date:", e);
      return "Unknown";
    }
  };
  
  // Handle the action to view and manage topics
  const handleViewTopics = () => {
    setShowTopicsModal(true);
  };
  
  // Handle showing the simple topic list info modal
  const handleShowTopicInfo = () => {
    setShowTopicInfoModal(true);
  };
  
  // Handle prioritizing topics
  const handlePrioritizeTopics = () => {
    setIsPrioritizing(true);
    // Prioritization mode is a future feature - for now, just show the topics modal
    setShowTopicsModal(true);
  };
  
  // Handle regenerating topics
  const handleRegenerateTopics = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerateTopics();
    } finally {
      setIsRegenerating(false);
    }
  };
  
  // Render the quick info modal that shows all topics in a simple list
  const renderTopicInfoModal = () => {
    if (!showTopicInfoModal) return null;
    
    return (
      <div className="modal-overlay" onClick={() => setShowTopicInfoModal(false)}>
        <div className="topic-info-modal" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={() => setShowTopicInfoModal(false)}>×</button>
          <h3>Topics for {subject} ({examBoard} {examType})</h3>
          
          {isLoading ? (
            <div className="loading-indicator">Loading topics...</div>
          ) : topics.length === 0 ? (
            <div className="no-topics-message">No topics available for this subject.</div>
          ) : (
            <ul className="topic-list">
              {topics.map(topic => (
                <li key={topic.id} className="topic-item">{topic.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="topic-list-summary-container">
      <div className="summary-header">
        <h2>Topic Management for {subject}</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="summary-content">
        <div className="metadata-section">
          <div className="metadata-item">
            <span className="label">Subject:</span>
            <span className="value">{subject}</span>
          </div>
          <div className="metadata-item">
            <span className="label">Exam Board:</span>
            <span className="value">{examBoard}</span>
          </div>
          <div className="metadata-item">
            <span className="label">Exam Type:</span>
            <span className="value">{examType}</span>
          </div>
          <div className="metadata-item">
            <span className="label">Topics:</span>
            <span className="value">{topics.length}</span>
            <button 
              className="info-button" 
              onClick={handleShowTopicInfo}
              title="View topic list"
            >
              ℹ️
            </button>
          </div>
          <div className="metadata-item">
            <span className="label">Last Updated:</span>
            <span className="value">{formatDate(lastUpdated)}</span>
          </div>
        </div>

        <div className="actions-section">
          <button 
            className="action-button generate-cards-button"
            onClick={handleGenerateCards}
            disabled={isLoading || isRegenerating || topics.length === 0}
          >
            <span className="button-icon"><FaBolt /></span>
            <span className="button-text">Generate Cards</span>
          </button>

          <button 
            className="action-button view-topics-button"
            onClick={handleViewTopics}
            disabled={isLoading || isRegenerating}
          >
            <span className="button-icon">📋</span>
            <span className="button-text">View & Edit Topics</span>
          </button>
          
          <button 
            className="action-button prioritize-button"
            onClick={handlePrioritizeTopics}
            disabled={isLoading || isRegenerating || topics.length === 0}
          >
            <span className="button-icon">⭐</span>
            <span className="button-text">Prioritize Topics</span>
          </button>
          
          <button 
            className={`action-button regenerate-button ${isRegenerating ? 'loading' : ''}`}
            onClick={handleRegenerateTopics}
            disabled={isLoading || isRegenerating}
          >
            <span className="button-icon">{isRegenerating ? '🔄' : '🔄'}</span>
            <span className="button-text">
              {isRegenerating ? 'Regenerating...' : 'Regenerate Topics'}
            </span>
          </button>

          <button 
            className="action-button delete-button"
            onClick={() => handleDeleteTopicList({ subject, examBoard, examType })}
            disabled={isLoading || topics.length === 0}
          >
            <span className="button-icon"><FaTrash /></span>
            <span className="button-text">Delete List</span>
          </button>
        </div>
      </div>
      
      {/* Render the Topic Buttons Modal if needed */}
      {showTopicsModal && (
        <TopicButtonsModal
          topics={topics}
          subject={subject}
          examBoard={examBoard}
          examType={examType}
          onClose={() => {
            setShowTopicsModal(false);
            setIsPrioritizing(false);
          }}
          onGenerateCards={onGenerateCards}
          onAddTopic={onAddTopic}
          onDeleteTopic={onDeleteTopic}
          onSaveTopics={onSaveTopics}
        />
      )}
      
      {/* Render the simple topic info modal if needed */}
  {renderTopicInfoModal()}
  
  {/* Render Delete Confirmation Modal */}
  {showDeleteConfirmation && (
    <div className="modal-overlay" onClick={() => setShowDeleteConfirmation(false)}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Delete Topic List</h3>
        <p>Are you sure you want to delete this topic list? This action cannot be undone.</p>
        <div className="confirmation-actions">
          <button className="cancel-button" onClick={() => setShowDeleteConfirmation(false)}>
            Cancel
          </button>
          <button className="delete-button" onClick={confirmDeleteTopicList}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
};

export default TopicListSummary;
