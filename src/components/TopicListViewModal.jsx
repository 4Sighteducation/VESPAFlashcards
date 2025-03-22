import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaList, FaCalendarAlt, FaBook, FaPlusCircle, FaRedo, FaClipboardList } from 'react-icons/fa';
import './TopicListViewModal.css';

/**
 * TopicListViewModal - Displays all topic lists in a simple list format
 * 
 * This component is opened from the Topic List Summary page when users
 * click the "i" button. It shows all saved topic lists organized by
 * subject/exam type with timestamps.
 */
const TopicListViewModal = ({
  isOpen,
  subject,
  examBoard,
  examType,
  topics = [],
  lastUpdated,
  topicLists = [],
  onClose,
  onSelectTopicList,
  onSelectTopic,
  onGenerateTopics,
  onViewAllTopics
}) => {
  const [groupedLists, setGroupedLists] = useState({});

  // Group topic lists by subject
  useEffect(() => {
    if (topicLists && topicLists.length > 0) {
      const grouped = topicLists.reduce((acc, list) => {
        const subject = list.subject || 'Uncategorized';
        
        if (!acc[subject]) {
          acc[subject] = [];
        }
        
        acc[subject].push(list);
        return acc;
      }, {});
      
      setGroupedLists(grouped);
    } else {
      setGroupedLists({});
    }
  }, [topicLists]);

  // Format the date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
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
      return 'Invalid date';
    }
  };

  // If the modal is not open, don't render anything
  if (!isOpen) return null;

  // Render the modal using a portal
  return createPortal(
    <div className="topic-list-view-modal-overlay" onClick={onClose}>
      <div className="topic-list-view-modal" onClick={e => e.stopPropagation()}>
        <div className="topic-list-view-modal-header">
          <h2><FaList /> All Topic Lists</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="topic-list-view-modal-content">
          {Object.keys(groupedLists).length === 0 ? (
            <div className="no-topic-lists">
              <p>No topic lists found. Generate topics to create your first list.</p>
              
              {/* New button for generating topics when none exist */}
              <button 
                className="generate-topics-button"
                onClick={onGenerateTopics}
              >
                <FaPlusCircle /> Generate Topics
              </button>
              
              {/* Show subject info if available */}
              {subject && (
                <div className="subject-info">
                  <p>Subject: <strong>{subject}</strong></p>
                  <p>Exam Board: <strong>{examBoard}</strong></p>
                  <p>Exam Type: <strong>{examType}</strong></p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Action buttons when lists exist */}
              <div className="topic-list-actions">
                <button 
                  className="action-button regenerate-button"
                  onClick={onGenerateTopics}
                >
                  <FaRedo /> Regenerate Topics
                </button>
                
                <button 
                  className="action-button view-topics-button"
                  onClick={onViewAllTopics}
                >
                  <FaClipboardList /> View All Topics
                </button>
              </div>
              
              {/* Render the grouped topic lists */}
              {Object.entries(groupedLists).map(([subject, lists]) => (
                <div key={subject} className="subject-group">
                  <h3 className="subject-header">{subject}</h3>
                  <div className="topic-lists">
                    {lists.map((list) => (
                      <div 
                        key={list.id} 
                        className="topic-list-item"
                        onClick={() => onSelectTopicList(list)}
                      >
                        <div className="topic-list-info">
                          <div className="topic-list-header">
                            <h4 className="topic-list-subject">
                              <FaBook className="subject-icon" /> {list.subject}
                            </h4>
                            <span className="topic-count">{list.topics.length} topics</span>
                          </div>
                          <div className="topic-list-meta">
                            <span className="exam-info">{list.examBoard} {list.examType}</span>
                            <span className="timestamp">
                              <FaCalendarAlt className="calendar-icon" /> {formatDate(list.lastUpdated)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="topic-list-view-modal-footer">
          <button className="close-button-bottom" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TopicListViewModal;
