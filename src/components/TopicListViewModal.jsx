import React, { useState } from 'react';
import { 
  FaTimes, FaChevronDown, FaChevronUp, FaExclamationTriangle, 
  FaCheckCircle, FaQuestionCircle, FaSortDown, FaSortUp
} from 'react-icons/fa';
import ModalOverlay from './ModalOverlay';
import './TopicListViewModal.css';

/**
 * A modal component that displays detailed information about topic lists
 * and their relationship with flashcards, including orphaned cards and
 * topics without cards.
 */
const TopicListViewModal = ({ 
  isOpen, 
  onClose, 
  subject, 
  examBoard, 
  examType, 
  topics = [], 
  report = {} 
}) => {
  // State to track expanded sections
  const [expandedSections, setExpandedSections] = useState({
    orphanedCards: true,
    topicsWithCards: false,
    topicsWithoutCards: false,
  });

  // Format date strings for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Extract topics with and without cards from the report
  const topicsWithCards = report.topicsWithCards || [];
  const topicsWithoutCards = report.topicsWithoutCards || [];
  const orphanedCards = report.orphanedCards || [];

  // Count total cards and topics
  const totalCards = (report.totalCards || 0);
  const totalOrphanedCards = orphanedCards.length;
  const totalTopics = topics.length;
  const coveragePercentage = totalTopics > 0 
    ? Math.round((topicsWithCards.length / totalTopics) * 100) 
    : 0;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} zIndex={1050}>
      <div className="topic-list-view-modal">
        <div className="modal-header">
          <h2>Topic List Analysis</h2>
          <button 
            className="close-modal-button" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>
        
        <div className="modal-content">
          <div className="topic-list-info">
            {/* List Information Section */}
            <div className="info-section">
              <h3>List Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Subject</span>
                  <span className="info-value">{subject || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Exam Board</span>
                  <span className="info-value">{examBoard || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Exam Type</span>
                  <span className="info-value">{examType || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Last Updated</span>
                  <span className="info-value">{formatDate(report.lastUpdated)}</span>
                </div>
              </div>
            </div>

            {/* Card Statistics Section */}
            <div className="stats-section">
              <h3>Card Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{totalTopics}</span>
                  <span className="stat-label">Total Topics</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{totalCards}</span>
                  <span className="stat-label">Total Cards</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{coveragePercentage}%</span>
                  <span className="stat-label">Topics Covered</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{totalOrphanedCards}</span>
                  <span className="stat-label">Orphaned Cards</span>
                </div>
              </div>
            </div>

            {/* Orphaned Cards Section */}
            <div className="expandable-section">
              <div 
                className="section-header" 
                onClick={() => toggleSection('orphanedCards')}
              >
                <div className="header-title">
                  <FaExclamationTriangle className="warning-icon" />
                  <h3>Orphaned Cards ({orphanedCards.length})</h3>
                </div>
                {expandedSections.orphanedCards ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              
              {expandedSections.orphanedCards && (
                <div className="section-content">
                  <p className="section-description">
                    The following cards are not associated with any topic in this list. 
                    Consider assigning them to relevant topics.
                  </p>
                  
                  {orphanedCards.length > 0 ? (
                    <div className="orphaned-cards-list">
                      {orphanedCards.map((card, index) => (
                        <div key={index} className="orphaned-card">
                          <div className="card-info">
                            <div className="card-question">
                              {card.question || 'No question text'}
                            </div>
                            <div className="card-meta">
                              <span>Created: {formatDate(card.createdAt)}</span>
                              <span>Last studied: {formatDate(card.lastStudied)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No orphaned cards found. Great job!</p>
                  )}
                </div>
              )}
            </div>

            {/* Topics With Cards Section */}
            <div className="expandable-section">
              <div 
                className="section-header" 
                onClick={() => toggleSection('topicsWithCards')}
              >
                <div className="header-title">
                  <FaCheckCircle className="success-icon" />
                  <h3>Topics With Cards ({topicsWithCards.length})</h3>
                </div>
                {expandedSections.topicsWithCards ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              
              {expandedSections.topicsWithCards && (
                <div className="section-content">
                  <p className="section-description">
                    These topics have flashcards associated with them. 
                    The list shows how many cards each topic has and their spaced repetition distribution.
                  </p>
                  
                  {topicsWithCards.length > 0 ? (
                    <div className="topics-list">
                      {topicsWithCards.map((topic, index) => (
                        <div key={index} className="topic-item">
                          <div className="topic-name">{topic.name}</div>
                          <div className="topic-stats">
                            <span className="topic-card-count">{topic.cardCount} cards</span>
                            <span className="topic-sr-count">{topic.srCount} in spaced repetition</span>
                          </div>
                          {topic.boxDistribution && Object.keys(topic.boxDistribution).length > 0 && (
                            <div className="boxes-distribution">
                              {Object.entries(topic.boxDistribution).map(([box, count]) => (
                                <div key={box} className="box-indicator">
                                  <span className="box-label">Box {box}:</span>
                                  <span className="box-count">{count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No topics with cards found.</p>
                  )}
                </div>
              )}
            </div>

            {/* Topics Without Cards Section */}
            <div className="expandable-section">
              <div 
                className="section-header" 
                onClick={() => toggleSection('topicsWithoutCards')}
              >
                <div className="header-title">
                  <FaQuestionCircle className="warning-icon" />
                  <h3>Topics Without Cards ({topicsWithoutCards.length})</h3>
                </div>
                {expandedSections.topicsWithoutCards ? <FaChevronUp /> : <FaChevronDown />}
              </div>
              
              {expandedSections.topicsWithoutCards && (
                <div className="section-content">
                  <p className="section-description">
                    These topics don't have any flashcards yet. 
                    Consider creating cards for these topics to improve your study coverage.
                  </p>
                  
                  {topicsWithoutCards.length > 0 ? (
                    <div className="topics-list">
                      {topicsWithoutCards.map((topic, index) => (
                        <div key={index} className="topic-item">
                          <div className="topic-name">{topic.name}</div>
                          <div className="topic-stats">
                            <span>No cards created yet</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>All topics have at least one flashcard. Excellent!</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

export default TopicListViewModal; 