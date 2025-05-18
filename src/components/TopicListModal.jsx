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
    // Reset slideshow state if modal reopens for a new subject or closes
    if (!isOpen) {
      setShowTopicSlideshow(false);
    }
  }, [isOpen]);

  if (!isOpen || !subjectData) return null;

  const subjectColor = subjectData.color || '#333333';
  const subjectTextColor = getContrastColor(subjectColor);

  const handleTopicAction = (actionType, topicData, e) => {
    e.stopPropagation();
    if (actionType === 'slideshow') {
      const cardsForSlideshow = topicsForSubject?.find(t => t.id === topicData.id)?.cards || [];
      if (cardsForSlideshow.length === 0) {
          dlog(`No cards for slideshow in topic: ${topicData.name}. Adding placeholder.`);
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
    } else if (onTopicAction) {
      onTopicAction(actionType, subjectData.name, topicData);
    }
  };
  
  const getTopicCards = (topicId) => {
    const topic = topicsForSubject.find(t => t.id === topicId);
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
              const topicDisplayColor = topic.color || subjectColor; // Fallback to subject color
              const topicTextColor = getContrastColor(topicDisplayColor);
              const cardCount = topic.cardCount || getTopicCards(topic.id).length || 0;

              return (
                <div
                  key={topic.id || topic.name}
                  className="topic-list-item"
                  style={{ backgroundColor: topicDisplayColor, color: topicTextColor }}
                >
                  <div className="topic-list-item-info">
                    <span className="topic-list-item-name">{topic.name}</span>
                    <span className="topic-list-item-meta">
                      Cards: {cardCount} | {topic.examType || 'N/A'} - {topic.examBoard || 'N/A'}
                    </span>
                  </div>
                  <div className="topic-list-item-actions">
                    <button title="AI Generate Cards" onClick={(e) => handleTopicAction('ai_generate', topic, e)}>⚡</button>
                    <button title="Slideshow" onClick={(e) => handleTopicAction('slideshow', topic, e)} disabled={cardCount === 0}>🔄</button>
                    <button title="Print Topic" onClick={(e) => handleTopicAction('print', topic, e)} disabled={cardCount === 0}>🖨️</button>
                    <button title="Delete Topic" className="delete" onClick={(e) => handleTopicAction('delete', topic, e)}>🗑️</button>
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