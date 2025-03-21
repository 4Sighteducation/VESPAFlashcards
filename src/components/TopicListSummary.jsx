import React, { useState, useEffect } from "react";
import "./TopicListSummary.css";
import TopicButtonsModal from "./TopicButtonsModal";

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

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      console.error("Error formatting date:", e);
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
            className="action-button view-topics-button"
            onClick={handleViewTopics}
            disabled={isLoading}
          >
            <span className="button-icon">📋</span>
            <span className="button-text">View & Edit Topics</span>
          </button>
          
          <button 
            className="action-button prioritize-button"
            onClick={handlePrioritizeTopics}
            disabled={isLoading || topics.length === 0}
          >
            <span className="button-icon">⭐</span>
            <span className="button-text">Prioritize Topics</span>
          </button>
          
          <button 
            className="action-button regenerate-button"
            onClick={onRegenerateTopics}
            disabled={isLoading}
          >
            <span className="button-icon">🔄</span>
            <span className="button-text">Regenerate Topics</span>
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
    </div>
  );
};

export default TopicListSummary;
