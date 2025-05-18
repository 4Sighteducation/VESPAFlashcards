import React, { useState, useEffect } from 'react';
import { getContrastColor } from '../utils/ColorUtils';
import SlideshowModal from './FlashcardSlideshowModal'; // Assuming SlideshowModal is in the same directory
import './TopicListModal.css'; // We'll create this CSS file next
import { dlog } from '../utils/logger';

const TopicListModal = ({
  isOpen,
  onClose,
  subjectData,
  topicsForSubject, // Array of topic objects { id, name, color, cardCount, examBoard, examType, cards: [] }
  onTopicAction, // (actionType, subjectName, topicData) => void
  // We might not need userId/recordId directly here if onTopicAction handles AI calls via App.js
}) => {
  const [showTopicSlideshow, setShowTopicSlideshow] = useState(false);
  const [slideshowData, setSlideshowData] = useState({ cards: [], title: '' });

  useEffect(() => {
    if (!isOpen) {
      setShowTopicSlideshow(false);
    }
  }, [isOpen]);

  if (!isOpen || !subjectData) return null;

  const subjectColor = subjectData.color || '#333333';
  const subjectTextColor = getContrastColor(subjectColor);

  // This function will now primarily handle non-slideshow actions or be called by the item click
  const handleGenericTopicAction = (actionType, topicData, e) => {
    e.stopPropagation();
    if (onTopicAction) {
      onTopicAction(actionType, subjectData.name, topicData);
    }
  };

  const handleTopicClickForSlideshow = (topicData) => {
    dlog("[TopicListModal] handleTopicClickForSlideshow triggered for topic:", topicData);
    const topicDetails = topicsForSubject?.find(t => t.id === topicData.id);
    dlog("[TopicListModal] Found topic details in topicsForSubject:", topicDetails);
    const cardsForSlideshow = topicDetails?.cards || [];
    dlog("[TopicListModal] Cards determined for slideshow:", cardsForSlideshow);

    if (cardsForSlideshow.length === 0) {
        dlog(`[TopicListModal] No cards for slideshow in topic: ${topicData.name}. Adding placeholder.`);
        setSlideshowData({
          cards: [{ id: 'placeholder', front: `No cards for ${topicData.name} yet.`, back: 'Try generating some!' }],
          title: `${subjectData.name} - ${topicData.name}`
        });
    } else {
        setSlideshowData({
          cards: cardsForSlideshow,
          title: `${subjectData.name} - ${topicData.name}`
        });
    }
    setShowTopicSlideshow(true);
  };
  
  const getTopicCards = (topicId) => {
    // Ensure topicsForSubject is an array before calling find
    const topicsArray = Array.isArray(topicsForSubject) ? topicsForSubject : [];
    const topic = topicsArray.find(t => t.id === topicId);
    return topic?.cards || [];
  }


  return (
    <>
      <div className="modal-overlay topic-list-modal-overlay" onClick={onClose}>
        <div className="modal-content topic-list-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button topic-list-close-button" onClick={onClose}>&times;</button>
          <div className="topic-list-modal-header" style={{ backgroundColor: subjectColor, color: subjectTextColor }}>
            <h2>{subjectData.name} - Topics</h2>
          </div>
          <div className="topic-list-modal-body">
            {(!topicsForSubject || topicsForSubject.length === 0) && (
              <p className="no-topics-message">No topics found for this subject.</p>
            )}
            {topicsForSubject && topicsForSubject.map((topic) => {
              const topicDisplayColor = topic.color || subjectColor; 
              const topicTextColor = getContrastColor(topicDisplayColor);
              const cardCount = topic.cardCount || getTopicCards(topic.id).length || 0;

              return (
                // Make the entire item a button or add onClick here
                <div
                  key={topic.id || topic.name}
                  className="topic-list-item clickable-topic"
                  style={{ backgroundColor: topicDisplayColor, color: topicTextColor }}
                  onClick={() => handleTopicClickForSlideshow(topic)} // Trigger slideshow on click
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleTopicClickForSlideshow(topic)} // Accessibility
                >
                  <div className="topic-list-item-info">
                    <span className="topic-list-item-name">{topic.name}</span>
                    <span className="topic-list-item-meta">
                      Cards: {cardCount} | {topic.examType || 'N/A'} - {topic.examBoard || 'N/A'}
                    </span>
                  </div>
                  <div className="topic-list-item-actions">
                    <button title="AI Generate Cards" onClick={(e) => handleGenericTopicAction('ai_generate', topic, e)}>⚡</button>
                    {/* Slideshow button removed */}
                    <button title="Print Topic" onClick={(e) => handleGenericTopicAction('print', topic, e)} disabled={cardCount === 0}>🖨️</button>
                    <button title="Delete Topic" className="delete" onClick={(e) => handleGenericTopicAction('delete', topic, e)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showTopicSlideshow && (
        <SlideshowModal
          cards={slideshowData.cards}
          title={slideshowData.title}
          onClose={() => setShowTopicSlideshow(false)}
        />
      )}
    </>
  );
};

export default TopicListModal; 