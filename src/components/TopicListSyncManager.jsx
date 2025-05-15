import React, { useState, useEffect, useCallback } from "react";
import NewTopicModal from "./NewTopicModal";
import { 
  setupPageUnloadProtection
} from './TopicsPersistenceManager';
import { dlog, dwarn, derr } from '../utils/logger'; 
import { fetchTopicsForSubject } from '../services/KnackTopicService';
/**
 * TopicListSyncManager - Data layer for topic list management
 * 
 * This component acts as a data management layer between the app and the topic UI components.
 * It handles loading, saving, and synchronizing topic data with Knack.
 * 
 * The UI is presented through the NewTopicModal component.
 */
const TopicListSyncManager = ({ 
  isOpen,
  subject,
  examBoard,
  examType,
  onClose,
  onSelectTopic,
  onGenerateCards,
  auth,
  userId,
  initialTopics
}) => {
  // State for topic lists and metadata
  const [currentTopics, setCurrentTopics] = useState([]);
  
  // Initialize currentTopics state when initialTopics prop changes
  useEffect(() => {
    if (initialTopics && Array.isArray(initialTopics)) {
      setCurrentTopics(initialTopics);
      dlog(`[TopicListSyncManager] Initialized with ${initialTopics.length} topics from prop.`);
    }
  }, [initialTopics]); // Rerun only when initialTopics prop changes

  // Set up page unload protection when component mounts
  useEffect(() => {
    setupPageUnloadProtection();
  }, []);


  // Only render when isOpen is true
  if (!isOpen) return null;
  
  // Use the new modal
  return (
    <NewTopicModal
      isOpen={isOpen}
      subject={subject}
      examBoard={examBoard}
      examType={examType}
      onClose={onClose}
      onGenerateCards={onGenerateCards}
      initialTopics={currentTopics}
    />
  );
};

export default TopicListSyncManager;
