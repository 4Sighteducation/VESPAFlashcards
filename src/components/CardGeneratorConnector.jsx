import React, { useState, useCallback, useEffect } from 'react';
import FlashcardGeneratorBridge from './FlashcardGeneratorBridge';
import LoadingSpinner from './LoadingSpinner';

/**
 * CardGeneratorConnector - A component that connects the Topic UI with flashcard generation
 * 
 * This component provides a clean integration between the Topic UI and our
 * FlashcardGeneratorBridge component. It handles passing metadata from topics to the generator.
 */
const CardGeneratorConnector = ({
  onAddCard,
  onClose,
  subjects = [],
  auth,
  userId,
  initialSubject = null,
  initialTopic = null,
  initialTopicsProp = [],
  examBoard = "AQA",
  examType = "A-Level",
  recordId,
  onFinalizeTopics
}) => {
  // Forward the props to FlashcardGeneratorBridge in a cleaner format
  return (
    <FlashcardGeneratorBridge
      topic={{
        subject: initialSubject,
        topic: initialTopic,
        examBoard: examBoard,
        examType: examType
      }}
      recordId={recordId}
      userId={userId}
      onClose={onClose}
      onAddCards={onAddCard}
    />
  );
};

export default CardGeneratorConnector;
