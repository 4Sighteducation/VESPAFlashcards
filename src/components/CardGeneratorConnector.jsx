import React, { useState, useEffect, useCallback, useRef } from 'react';
import SimpleCardGeneratorModal from './SimpleCardGeneratorModal';

/**
 * CardGeneratorConnector - A wrapper around SimpleCardGeneratorModal
 * 
 * This connector component safely integrates the flashcard generator with the Topic Hub
 * while avoiding the render loops that led to React Error #301.
 */
const CardGeneratorConnector = (props) => {
  // Extract props with defaults to match AICardGenerator
  const {
    onAddCard, 
    onClose, 
    subjects = [], 
    auth, 
    userId,
    initialSubject = "", 
    initialTopic = "", 
    examBoard = "AQA", 
    examType = "A-Level",
    recordId, 
    initialTopicsProp, 
    onFinalizeTopics, 
    skipMetadataSteps = false
  } = props;

  // Internal state to track if the modal should be displayed
  const [showModal, setShowModal] = useState(true);
  const [topicData, setTopicData] = useState(null);
  
  // Properly format topic data from passed props
  useEffect(() => {
    // Only process if we have both subject and topic
    if (initialSubject && initialTopic) {
      // Find the topic color from initialTopicsProp if available
      let topicColor = null;
      let topicId = null;
      
      if (initialTopicsProp && Array.isArray(initialTopicsProp)) {
        const matchingTopic = initialTopicsProp.find(topic => 
          (topic.topic === initialTopic || topic.subtopic === initialTopic || topic.name === initialTopic)
        );
        
        if (matchingTopic) {
          topicColor = matchingTopic.color || matchingTopic.topicColor || null;
          topicId = matchingTopic.id || null;
        }
      }
      
      // Create a formatted topic data object
      setTopicData({
        subject: initialSubject,
        topic: initialTopic,
        examBoard,
        examType,
        id: topicId,
        color: topicColor || '#3cb44b' // Default color if none found
      });
    }
  }, [initialSubject, initialTopic, examBoard, examType, initialTopicsProp]);

  // Prevent unmount during render by using a timeout
  const handleClose = useCallback(() => {
    setShowModal(false);
    // Add small delay to prevent state update conflicts
    setTimeout(() => {
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
    }, 50);
  }, [onClose]);

  // Handle adding cards with proper callback chain
  const handleAddCards = useCallback((cards) => {
    if (!Array.isArray(cards) || cards.length === 0) return;
    
    console.log(`[CardGeneratorConnector] Adding ${cards.length} cards to bank`);
    
    // If onAddCard is an array function, call it for each card
    if (typeof onAddCard === 'function') {
      cards.forEach(card => {
        try {
          onAddCard(card);
        } catch (err) {
          console.error('[CardGeneratorConnector] Error in onAddCard:', err);
        }
      });
    }
  }, [onAddCard]);

  // Don't render anything if the modal is closed
  if (!showModal) return null;
  
  // Don't render until we have processed topic data
  if (!topicData) return null;
  
  return (
    <SimpleCardGeneratorModal
      topicData={topicData}
      onClose={handleClose}
      onAddCards={handleAddCards}
      userId={userId}
      recordId={recordId}
    />
  );
};

export default CardGeneratorConnector;
