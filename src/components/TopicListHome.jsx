import React, { useState } from 'react';
import { FaInfo, FaList, FaPlus, FaArrowRight, FaTimes, FaStar, FaSave } from 'react-icons/fa';
import { RiAiGenerate } from 'react-icons/ri';
import './TopicListHome.css';

// Component imports
import TopicListSummary from './TopicListSummary';
import TopicListViewModal from './TopicListViewModal';

/**
 * TopicListHome - First level in topic list navigation
 * Displays metadata and provides navigation options to topic-related views
 */
const TopicListHome = ({ 
  subject, 
  examBoard, 
  examType, 
  topics = [], 
  topicReport = null,
  lastUpdated,
  onClose, 
  onGenerateTopics,
  onViewTopics,
  onSaveTopicList,
  onPrioritizeTopics
}) => {
  // State for modals
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSummaryView, setShowSummaryView] = useState(false);
  const [showTopicsView, setShowTopicsView] = useState(false);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not yet saved';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle view topics button
  const handleViewTopics = () => {
    if (onViewTopics && typeof onViewTopics === 'function') {
      onViewTopics();
    } else {
      setShowTopicsView(true);
    }
  };

  // Handle generate topics button
  const handleGenerateTopics = () => {
    if (onGenerateTopics && typeof onGenerateTopics === 'function') {
      onGenerateTopics();
    }
  };

  // Handle show details/summary button
  const handleShowSummary = () => {
    setShowSummaryView(true);
  };

  return (
    <div className="topic-list-home">
      {/* Header */}
      <div className="topic-home-header">
        <h2>Topic List</h2>
        <div className="header-actions">
          <button 
            className="info-button"
            onClick={() => setShowInfoModal(true)}
            aria-label="Show information"
          >
            <FaInfo />
          </button>
          <button 
            className="close-button"
            onClick={onClose}
            aria-label="Close topic list"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="topic-home-content">
        {/* Info section */}
        <div className="topic-home-info">
          <div className="topic-metadata">
            <div className="metadata-item">
              <div className="metadata-label">Subject</div>
              <div className="metadata-value">{subject || 'Not specified'}</div>
            </div>
            <div className="metadata-item">
              <div className="metadata-label">Exam Board</div>
              <div className="metadata-value">{examBoard || 'Not specified'}</div>
            </div>
            <div className="metadata-item">
              <div className="metadata-label">Exam Type</div>
              <div className="metadata-value">{examType || 'Not specified'}</div>
            </div>
            <div className="metadata-item">
              <div className="metadata-label">Last Updated</div>
              <div className="metadata-value">{formatDate(lastUpdated)}</div>
            </div>
          </div>
          
          <div className="topic-count-display">
            <div className="topic-count">
              <div className="count-number">{topics.length}</div>
              <div className="count-label">Topics</div>
            </div>
          </div>
        </div>

        {/* Actions section */}
        <div className="topic-home-actions">
          <button 
            className="action-button primary"
            onClick={handleViewTopics}
            disabled={topics.length === 0}
          >
            <FaList />
            <span>View Topics</span>
            <FaArrowRight className="icon-right" />
          </button>

          <button 
            className="action-button secondary"
            onClick={handleShowSummary}
            disabled={topics.length === 0}
          >
            <FaInfo />
            <span>View Details & Summary</span>
            <FaArrowRight className="icon-right" />
          </button>

          <button 
            className="action-button secondary"
            onClick={handleGenerateTopics}
          >
            <RiAiGenerate />
            <span>Generate New Topics</span>
            <FaArrowRight className="icon-right" />
          </button>

          {onSaveTopicList && (
            <button 
              className="action-button secondary"
              onClick={onSaveTopicList}
              disabled={topics.length === 0}
            >
              <FaSave />
              <span>Save Topic List</span>
              <FaArrowRight className="icon-right" />
            </button>
          )}

          {onPrioritizeTopics && (
            <button 
              className="action-button secondary priority-button"
              onClick={onPrioritizeTopics}
              disabled={topics.length === 0}
            >
              <FaStar />
              <span>Prioritize Topics</span>
              <div className="coming-soon-badge">Beta</div>
              <FaArrowRight className="icon-right" />
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showInfoModal && (
        <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Topic List Information</h3>
              <button className="close-button" onClick={() => setShowInfoModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-content">
              <p>This is your topic list for {subject} {examBoard} {examType}.</p>
              <p>From here, you can:</p>
              <ul>
                <li><strong>View Topics</strong> - See all topics in your list and manage them</li>
                <li><strong>View Details & Summary</strong> - Get a detailed overview of your topics and associated flashcards</li>
                <li><strong>Generate New Topics</strong> - Create a new list of topics using AI</li>
                <li><strong>Save Topic List</strong> - Save your current topic list to your account</li>
                <li><strong>Prioritize Topics</strong> - Organize topics by importance (Beta feature)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {showTopicsView && topicReport && (
        <TopicListViewModal
          subject={subject}
          examBoard={examBoard}
          examType={examType}
          topics={topics}
          report={topicReport}
          onClose={() => setShowTopicsView(false)}
        />
      )}

      {showSummaryView && (
        <TopicListSummary
          subject={subject}
          examBoard={examBoard}
          examType={examType}
          topics={topics}
          onClose={() => setShowSummaryView(false)}
          onBack={() => setShowSummaryView(false)}
        />
      )}
    </div>
  );
};

export default TopicListHome; 