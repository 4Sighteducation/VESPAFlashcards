import React, { useState, useCallback, useEffect } from 'react';
import AICardGenerator from './AICardGenerator';
import LoadingSpinner from './LoadingSpinner';

/**
 * CardGeneratorConnector - A component that connects the Topic UI with the AICardGenerator
 * 
 * This component is a simpler wrapper around AICardGenerator to provide a cleaner integration
 * with the Topic UI. It handles passing metadata from topics to AICardGenerator.
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
  // Forward the props to AICardGenerator
  return (
    <AICardGenerator
      onAddCard={onAddCard}
      onClose={onClose}
      subjects={subjects}
      auth={auth}
      userId={userId}
      initialSubject={initialSubject}
      initialTopic={initialTopic}
      initialTopicsProp={initialTopicsProp}
      examBoard={examBoard}
      examType={examType}
      recordId={recordId}
      onFinalizeTopics={onFinalizeTopics}
      skipMetadataSteps={initialSubject && initialTopic} // Skip metadata steps if we already have subject and topic
    />
  );
};

export default CardGeneratorConnector;
