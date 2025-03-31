import React, { useState, useEffect, useCallback } from "react";
import NewTopicModal from "./NewTopicModal";
import { generateTopicPrompt } from '../prompts/topicListPrompt';
import { 
  persistTopics, 
  retrieveTopics, 
  clearPersistedTopics,
  setupPageUnloadProtection
} from './TopicsPersistenceManager';
import {
  loadTopicLists,
  formatTopicList
} from '../services/TopicListService';
import { saveTopicsUnified } from '../services/EnhancedTopicPersistenceService';

// API keys for topic generation if needed
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";

// Debug logging helper
const debugLog = (title, data) => {
  console.log(`%c${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

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
  userId
}) => {
  // State for topic lists and metadata
  const [topicLists, setTopicLists] = useState([]);
  const [topicMetadata, setTopicMetadata] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completeUserData, setCompleteUserData] = useState(null);
  const [currentTopics, setCurrentTopics] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Function to load topic lists from Knack
  const loadTopicListsFromKnack = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Loading topic lists for user ID: ${userId}`);
      
      // Use our dedicated topic service to load topic lists
      const topicData = await loadTopicLists(userId, auth, subject, examBoard, examType);
      
      // Update state with loaded data
      if (topicData && topicData.length > 0) {
        // Get just the topics from the first matching list
        const matchingList = topicData[0];
        if (matchingList && matchingList.topics) {
          setCurrentTopics(matchingList.topics);
          setLastUpdated(matchingList.lastUpdated);
          console.log(`Loaded ${matchingList.topics.length} topics for ${subject}`);
          
          // Cache these topics for protection against page refresh
          persistTopics(subject, examBoard, examType, matchingList.topics);
        } else {
          setCurrentTopics([]);
          console.log("No topics found for this subject/exam combination");
        }
      } else {
        console.log("No topic lists found in user data");
        setCurrentTopics([]);
      }
    } catch (error) {
      console.error("Error loading topic lists:", error);
      setError("Error loading topic lists: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, auth, subject, examBoard, examType]);
  
  // Load existing topic lists from Knack when the component mounts or subject changes
  useEffect(() => {
    if (isOpen && auth && userId) {
      loadTopicListsFromKnack();
    }
  }, [isOpen, auth, userId, subject, loadTopicListsFromKnack]);
  
  // Set up page unload protection when component mounts
  useEffect(() => {
    setupPageUnloadProtection();
  }, []);

  // Find the current topic list for this subject/exam board/exam type
  useEffect(() => {
    if (subject && examBoard && examType) {
      // First check for locally cached topics (highest priority - most recent)
      const cachedTopics = retrieveTopics(subject, examBoard, examType);
      
      if (cachedTopics && cachedTopics.length > 0) {
        console.log(`Restored ${cachedTopics.length} topics from cache for ${subject}`);
        setCurrentTopics(cachedTopics);
        return;
      }
      
      // Otherwise try to load from Knack if we haven't already
      if (currentTopics.length === 0 && !isLoading) {
        loadTopicListsFromKnack();
      }
    }
  }, [subject, examBoard, examType, currentTopics.length, isLoading, loadTopicListsFromKnack]);

  // Generate topics using OpenAI (this will be called from the modal)
  const generateTopics = async () => {
    if (!examBoard || !examType) {
      return [];
    }

    setIsGenerating(true);
    
    try {
      console.log(`Generating topics for ${subject} (${examBoard} ${examType})`);
      
      // Generate a prompt for OpenAI
      const prompt = generateTopicPrompt(subject, examBoard, examType);
      
      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates topic lists for students studying various subjects."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.5
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }
      
      const data = await response.json();
      const topicsText = data.choices[0].message.content;
      
      // Parse the response - assuming format is "1. Topic 1\n2. Topic 2\n3. Topic 3"
      let parsedTopics = [];
      try {
        // Try to parse as JSON first
        if (topicsText.includes('[') && topicsText.includes(']')) {
          const jsonMatch = topicsText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsedTopics = JSON.parse(jsonMatch[0]);
          }
        }
        
        // Fallback to regex parsing if JSON parsing fails
        if (!parsedTopics.length) {
          parsedTopics = topicsText
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => /^\d+\./.test(line))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(topic => topic.length > 0);
        }
        
        // Assign unique IDs to each topic
        const topicsWithIds = parsedTopics.map(topic => ({
          id: `topic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: typeof topic === 'string' ? topic : topic.name || 'Unknown Topic'
        }));
        
        console.log("Generated topics:", topicsWithIds);
        
        // Update the current topics
        setCurrentTopics(topicsWithIds);
        
        // Save the topics
        await saveTopics(topicsWithIds);
        
        return topicsWithIds;
      } catch (e) {
        console.error("Error parsing topics:", e);
        return [];
      }
    } catch (error) {
      console.error("Error generating topics:", error);
      return [];
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Save topics - uses the enhanced service to save to both field_3011 and field_2979
  const saveTopics = async (topicsList) => {
    try {
      // First save to local cache to protect against issues during server save
      const persistSuccess = persistTopics(subject, examBoard, examType, topicsList);
      if (persistSuccess) {
        console.log(`Protected ${topicsList.length} topics in local cache`);
      }
      
      // Use our enhanced service to save topics to both field_3011 and field_2979
      const success = await saveTopicsUnified(
        topicsList, 
        subject, 
        examBoard, 
        examType, 
        userId, 
        auth
      );
      
      if (success) {
        console.log("Topics saved successfully to both field_3011 and field_2979");
        setLastUpdated(new Date().toISOString());
        
        // Clear from local cache only if successfully saved to server
        if (persistSuccess) {
          clearPersistedTopics(subject, examBoard, examType);
        }
        
        return true;
      } else {
        console.error("Failed to save topics to Knack");
        console.log("Topics are still protected in local cache");
        return false;
      }
    } catch (error) {
      console.error("Error in saveTopics:", error);
      return false;
    }
  };

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
      onSaveTopics={saveTopics}
      initialTopics={currentTopics}
    />
  );
};

export default TopicListSyncManager;
