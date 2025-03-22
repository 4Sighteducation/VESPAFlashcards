import React, { useState, useEffect } from "react";
import { FaInfoCircle, FaList, FaStar, FaSave, FaPlus, FaTrash, FaSyncAlt, FaExclamationTriangle } from 'react-icons/fa';
import "./TopicListSummary.css";
import TopicButtonsModal from "./TopicButtonsModal";
import TopicListViewModal from './TopicListViewModal';
import TopicCardSyncService from '../services/TopicCardSyncService';
import ModalOverlay from './ModalOverlay';

/**
 * TopicListSummary - Displays a summary of topic lists with metadata and actions
 * 
 * This component serves as the initial entry point when users click the topic list button
 * from the subject container. It shows metadata about the topics and provides buttons
 * to open more detailed topic views and perform actions.
 */
const TopicListSummary = ({
  subject,
  examBoard,
  examType,
  topics = [],
  cards = [],
  onClose,
  onGenerateCards,
  onDeleteTopic,
  onAddTopic,
  onSaveTopics,
  onRegenerateTopics,
  lastUpdated,
  spacedRepetitionData
}) => {
  // State for modals
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTopicButtonsModal, setShowTopicButtonsModal] = useState(false);
  const [regenerateWarningVisible, setRegenerateWarningVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for topic-card relationship data
  const [topicCardReport, setTopicCardReport] = useState(null);
  
  // Generate the topic-card relationship report on mount or when data changes
  useEffect(() => {
    if (topics && cards) {
      const report = TopicCardSyncService.generateTopicCardReport(
        cards, 
        [{ subject, examBoard, examType, topics }], 
        spacedRepetitionData
      );
      setTopicCardReport(report);
    }
  }, [subject, examBoard, examType, topics, cards, spacedRepetitionData]);
  
  // Format the last updated timestamp
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid date';
    }
  };
  
  // Count topics with generated cards
  const topicsWithCards = topicCardReport?.topicsWithCards || 0;
  const topicsWithoutCards = topicCardReport?.topicsWithoutCards || 0;
  
  // Handle viewing full topic list
  const handleViewTopics = () => {
    setShowTopicButtonsModal(true);
  };
  
  // Handle opening the info modal with lists
  const handleShowInfoModal = () => {
    setShowInfoModal(true);
  };
  
  // Handle topic regeneration with cards check
  const handleRegenerateTopics = async () => {
    // If topics have associated cards, show a warning
    if (topicsWithCards > 0) {
      setRegenerateWarningVisible(true);
    } else {
      // No cards associated, proceed directly
      if (onRegenerateTopics) {
        setIsLoading(true);
        try {
          await onRegenerateTopics();
        } finally {
          setIsLoading(false);
        }
      }
    }
  };
  
  // Confirm regeneration after warning
  const confirmRegeneration = async () => {
    setRegenerateWarningVisible(false);
    setIsLoading(true);
    
    try {
      if (onRegenerateTopics) {
        await onRegenerateTopics();
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="topic-list-summary">
      <div className="summary-header">
        <h2>Topic List: {subject}</h2>
        <div className="header-actions">
          <button 
            className="info-button" 
            onClick={handleShowInfoModal}
            title="View Topic List Information"
          >
            <FaInfoCircle />
          </button>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
      </div>
      
      <div className="summary-content">
        <div className="metadata-section">
          <div className="metadata-item">
            <span className="metadata-label">Exam Board:</span>
            <span className="metadata-value">{examBoard}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Exam Type:</span>
            <span className="metadata-value">{examType}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Topics:</span>
            <span className="metadata-value">{topics.length}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Last Updated:</span>
            <span className="metadata-value">{formatDate(lastUpdated)}</span>
          </div>
        </div>
        
        <div className="stats-section">
          <div className="stat-card">
            <h3>Topic Coverage</h3>
            <div className="stat-value">
              <div className="coverage-bar">
                <div 
                  className="coverage-progress" 
                  style={{ 
                    width: `${topics.length > 0 ? (topicsWithCards / topics.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              <div className="coverage-text">
                {topicsWithCards} of {topics.length} topics have flashcards
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <h3>Topics Remaining</h3>
            <div className="stat-value">
              <div className="remaining-count">{topicsWithoutCards}</div>
              <div className="remaining-text">
                topics without flashcards
              </div>
            </div>
          </div>
        </div>
        
        <div className="actions-section">
          <button 
            className="primary-action" 
            onClick={handleViewTopics}
            disabled={topics.length === 0}
          >
            <FaList /> View Topics
          </button>
          
          <button 
            className="secondary-action" 
            onClick={onAddTopic}
          >
            <FaPlus /> Add Topic
          </button>
          
          <button 
            className="secondary-action" 
            onClick={handleRegenerateTopics}
            disabled={isLoading}
          >
            <FaSyncAlt /> {isLoading ? 'Regenerating...' : 'Regenerate Topics'}
          </button>
          
          <button 
            className="secondary-action" 
            onClick={onSaveTopics}
          >
            <FaSave /> Save Changes
          </button>
        </div>
      </div>
      
      {/* Topic Buttons Modal */}
      <TopicButtonsModal
        topics={topics}
        subject={subject}
        examBoard={examBoard}
        examType={examType}
        isOpen={showTopicButtonsModal}
        onClose={() => setShowTopicButtonsModal(false)}
        onGenerateCards={onGenerateCards}
        onDeleteTopic={onDeleteTopic}
        onAddTopic={onAddTopic}
        onSaveTopics={onSaveTopics}
        cards={cards}
      />
      
      {/* Topic List Info Modal */}
      <TopicListViewModal
        subject={subject}
        examBoard={examBoard}
        examType={examType}
        topics={topics}
        report={topicCardReport}
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />
      
      {/* Regenerate Warning Modal */}
      <ModalOverlay 
        isOpen={regenerateWarningVisible} 
        onClose={() => setRegenerateWarningVisible(false)}
        zIndex={1500}
      >
        <div className="warning-modal">
          <div className="warning-header">
            <h3>
              <FaExclamationTriangle className="warning-icon" />
              Warning: Topics Have Generated Cards
            </h3>
            <button 
              className="close-warning-button" 
              onClick={() => setRegenerateWarningVisible(false)}
            >
              ×
            </button>
          </div>
          <div className="warning-content">
            <p>
              Some topics already have flashcards generated. Regenerating the topic list 
              might result in orphaned flashcards or lost data.
            </p>
            <p>
              Do you want to continue?
            </p>
          </div>
          <div className="warning-actions">
            <button 
              className="cancel-action" 
              onClick={() => setRegenerateWarningVisible(false)}
            >
              Cancel
            </button>
            <button 
              className="confirm-action" 
              onClick={confirmRegeneration}
            >
              Regenerate Topics
            </button>
          </div>
        </div>
      </ModalOverlay>
      
      {/* Loading Overlay */}
      {isLoading && (
        <ModalOverlay isOpen={true} onClose={() => {}} zIndex={2000}>
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Regenerating topics...</p>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};

export default TopicListSummary;
