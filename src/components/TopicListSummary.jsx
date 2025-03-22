import React, { useState, useEffect } from 'react';
import { FaInfoCircle, FaLayerGroup, FaArrowRight, FaListUl, FaExclamationTriangle } from 'react-icons/fa';
import './TopicListSummary.css';
import TopicListViewModal from './TopicListViewModal';
import TopicButtonsModal from './TopicButtonsModal';
import { loadTopicLists } from '../services/TopicPersistenceService';

/**
 * TopicListSummary - First level of topic list navigation
 * 
 * This component serves as the initial entry point when users click
 * the topic list button from the subject container. It displays metadata
 * and buttons to navigate to either the lists view or buttons modal.
 */
const TopicListSummary = ({
  isOpen,
  onClose,
  subject,
  examBoard,
  examType,
  userId,
  auth,
  onGenerateCards
}) => {
  const [topicLists, setTopicLists] = useState([]);
  const [currentTopicList, setCurrentTopicList] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // UI state
  const [showListsModal, setShowListsModal] = useState(false);
  const [showButtonsModal, setShowButtonsModal] = useState(false);

  // Load topic lists from Knack when the component mounts
  useEffect(() => {
    if (isOpen && auth && userId) {
      loadTopicListsFromKnack();
    }
  }, [isOpen, auth, userId, subject, examBoard, examType]);

  // Function to load topic lists from Knack
  const loadTopicListsFromKnack = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all topic lists first
      const { topicLists: allLists } = await loadTopicLists(userId, auth);
      
      // Find the list for this subject/exam board/exam type
      let matchingList = null;
      if (allLists && allLists.length > 0) {
        matchingList = allLists.find(list => 
          list.subject === subject && 
          list.examBoard === examBoard && 
          list.examType === examType
        );
      }
      
      // Set the current topic list
      setCurrentTopicList(matchingList);
      
      // Set all topic lists (for the lists modal)
      setTopicLists(allLists || []);
    } catch (error) {
      console.error("Error loading topic lists:", error);
      setError("Error loading topic lists: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle selecting a topic list from the view modal
  const handleSelectTopicList = (list) => {
    setCurrentTopicList(list);
    setShowListsModal(false);
    // Automatically open the topic buttons modal for the selected list
    setShowButtonsModal(true);
  };

  // Don't render anything if the modal is closed
  if (!isOpen) return null;

  return (
    <div className="topic-list-summary-overlay" onClick={onClose}>
      <div className="topic-list-summary" onClick={e => e.stopPropagation()}>
        <div className="topic-list-summary-header">
          <h2>Topic List: {subject}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="topic-list-summary-content">
          {isLoading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading topic lists...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <FaExclamationTriangle />
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div className="metadata-section">
                <div className="metadata-row">
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
                </div>
                <div className="metadata-row">
                  <div className="metadata-item">
                    <span className="label">Topics:</span>
                    <span className="value highlight">
                      {currentTopicList?.topics?.length || 0} topics
                    </span>
                  </div>
                  <div className="metadata-item">
                    <span className="label">Last Updated:</span>
                    <span className="value">
                      {currentTopicList?.lastUpdated 
                        ? new Date(currentTopicList.lastUpdated).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="navigation-buttons">
                <button 
                  className="view-lists-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowListsModal(true);
                  }}
                >
                  <FaInfoCircle className="button-icon" />
                  <span className="button-text">View Topic Lists</span>
                  <FaArrowRight className="button-arrow" />
                </button>
                
                <button 
                  className="view-topics-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowButtonsModal(true);
                  }}
                  disabled={!currentTopicList}
                >
                  <FaLayerGroup className="button-icon" />
                  <span className="button-text">
                    {currentTopicList 
                      ? 'View Topic Buttons' 
                      : 'No Topics Available'}
                  </span>
                  <FaArrowRight className="button-arrow" />
                </button>
              </div>
              
              {!currentTopicList && (
                <div className="no-topics-message">
                  <FaListUl className="list-icon" />
                  <p>
                    No topic list found for {subject} ({examBoard} {examType}).
                    Generate topics using the Card Generator to create your first topic list.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* TopicListViewModal - Opens when the "i" button is clicked */}
      <TopicListViewModal
        isOpen={showListsModal}
        topicLists={topicLists}
        onClose={() => setShowListsModal(false)}
        onSelectTopicList={handleSelectTopicList}
      />

      {/* TopicButtonsModal - Opens when "View Topic Buttons" is clicked */}
      {currentTopicList && (
        <TopicButtonsModal
          isOpen={showButtonsModal}
          topics={currentTopicList.topics}
          subject={subject}
          examBoard={examBoard}
          examType={examType}
          onClose={() => setShowButtonsModal(false)}
          onGenerateCards={onGenerateCards}
          onDeleteTopic={(topicId) => {
            // This will be implemented as part of the enhanced delete functionality
            console.log("Delete topic:", topicId);
          }}
          onAddTopic={() => {
            // This will open the topic add form
            console.log("Add topic");
          }}
          onSaveTopics={() => {
            // This will save the updated topic list
            console.log("Save topics");
          }}
        />
      )}
    </div>
  );
};

export default TopicListSummary;
