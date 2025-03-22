import React, { useState, useEffect } from "react";
import TopicListSummary from "./TopicListSummary";
import { generateTopicPrompt } from '../prompts/topicListPrompt';
import { 
  persistTopics, 
  retrieveTopics, 
  clearPersistedTopics,
  setupPageUnloadProtection
} from './TopicsPersistenceManager';
import {
  saveTopicLists,
  loadTopicLists,
  safeParseJSON,
  withRetry
} from '../services/TopicPersistenceService';

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
 * The UI is presented through the TopicListSummary component.
 * 
 * Created as part of the topic-modal-refactor (see git tag 'topic-modal-original' for previous implementation)
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
  
  // API keys - using the correct environment variables
  const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
  const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
  
  // Load existing topic lists from Knack when the component mounts or subject changes
  useEffect(() => {
    if (isOpen && auth && userId) {
      loadTopicListsFromKnack();
    }
  }, [isOpen, auth, userId, subject]);
  
  // Function to load topic lists from Knack
  const loadTopicListsFromKnack = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Loading topic lists for user ID: ${userId}`);
      
      // Use our centralized service to load topic lists
      const { topicLists: loadedLists, metadata, userData } = await loadTopicLists(userId, auth);
      
      // Store the complete user data for later use
      if (userData) {
        setCompleteUserData(userData);
      }
      
      // Update state with loaded data
      if (loadedLists.length > 0) {
        setTopicLists(loadedLists);
        console.log(`Loaded ${loadedLists.length} topic lists from Knack`);
      } else {
        console.log("No topic lists found in user data");
        setTopicLists([]);
      }
      
      // Set metadata if available
      if (metadata && metadata.length > 0) {
        setTopicMetadata(metadata);
        console.log(`Loaded ${metadata.length} topic metadata entries from Knack`);
      } else {
        console.log("No topic metadata found in user data");
        setTopicMetadata([]);
      }
    } catch (error) {
      console.error("Error loading topic lists:", error);
      setError("Error loading topic lists: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handler for when topic list is saved in the child component
  const handleTopicListSave = async (updatedTopicLists, updatedMetadata) => {
    try {
      console.log(`[${new Date().toISOString()}] Saving topic lists with ${updatedTopicLists.length} entries`);
      
      // Log detailed info about the save operation
      debugLog("SAVING TOPIC LISTS", {
        topicListsCount: updatedTopicLists.length,
        topicMetadataCount: updatedMetadata?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // First try the direct API save with our service (most reliable method)
      const success = await withRetry(() => 
        saveTopicLists(updatedTopicLists, userId, auth, updatedMetadata)
      );
      
      if (success) {
        console.log(`[${new Date().toISOString()}] Topic lists saved successfully via direct API`);
        // Update our local state
        setTopicLists(updatedTopicLists);
        setTopicMetadata(updatedMetadata);
        return true;
      }
      
      // If direct API fails, try window messaging as fallback
      console.log("Direct API save failed, trying window messaging fallback");
      
      // Create the message with preserve fields flag
      const messageData = {
        type: "SAVE_DATA",
        data: {
          recordId: userId,
          userId: userId,
          topicLists: updatedTopicLists,
          topicMetadata: updatedMetadata,
          preserveFields: true, // This is crucial to prevent overwriting other fields
          completeData: completeUserData
        }
      };
      
      // Set up a listener for the response
      return new Promise((resolve) => {
        const messageHandler = (event) => {
          if (event.data && event.data.type === "SAVE_RESULT") {
            // Remove the event listener once we get a response
            window.removeEventListener("message", messageHandler);
            
            if (event.data.success) {
              console.log(`[${new Date().toISOString()}] Topic list saved successfully via postMessage`);
              // Update our local state
              setTopicLists(updatedTopicLists);
              setTopicMetadata(updatedMetadata);
              resolve(true);
            } else {
              console.error(`[${new Date().toISOString()}] Failed to save topic list via postMessage`);
              resolve(false);
            }
          }
        };
        
        // Add the event listener
        window.addEventListener("message", messageHandler);
        
        // Send message to parent window
        window.parent.postMessage(messageData, "*");
        
        // Set a timeout to handle no response
        setTimeout(() => {
          window.removeEventListener("message", messageHandler);
          console.error(`[${new Date().toISOString()}] No save response received within timeout period`);
          resolve(false);
        }, 10000); // 10-second timeout
      });
    } catch (error) {
      console.error("Error in handleTopicListSave:", error);
      return false;
    }
  };
  
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
      
      // Fall back to server-loaded topics if no cache
      if (topicLists.length > 0) {
        const matchingList = topicLists.find(list => 
          list.subject === subject && 
          list.examBoard === examBoard && 
          list.examType === examType
        );
        
        if (matchingList && matchingList.topics) {
          setCurrentTopics(matchingList.topics);
          setLastUpdated(matchingList.lastUpdated);
          
          // Cache these topics for protection against page refresh/autosave
          persistTopics(subject, examBoard, examType, matchingList.topics);
        } else {
          setCurrentTopics([]);
          setLastUpdated(null);
        }
      }
    }
  }, [topicLists, subject, examBoard, examType]);

  // Generate a unique ID for new topics/lists
  const generateId = (prefix = 'topic') => {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  };
  
  // Generate topics using OpenAI
  const generateTopics = async () => {
    if (!examBoard || !examType) {
      setError("Please select an exam board and type first");
      return;
    }

    setIsGenerating(true);
    setError(null);
    
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
          id: generateId(),
          name: topic
        }));
        
        console.log("Generated topics:", topicsWithIds);
        setCurrentTopics(topicsWithIds);
        
        // Create or update the topic list
        await saveTopics(topicsWithIds);
      } catch (e) {
        console.error("Error parsing topics:", e);
        setError("Failed to parse topics from AI response");
      }
    } catch (error) {
      console.error("Error generating topics:", error);
      setError(`Failed to generate topics: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle adding a new topic
  const handleAddTopic = async (topicName) => {
    try {
      // Create new topic object
      const newTopic = {
        id: generateId('topic'),
        name: topicName.trim()
      };
      
      // Add to current topics
      const updatedTopics = [...currentTopics, newTopic];
      setCurrentTopics(updatedTopics);
      
      // Save the updated topics
      await saveTopics(updatedTopics);
      
      return true;
    } catch (error) {
      console.error("Error adding topic:", error);
      return false;
    }
  };
  
  // Handle deleting a topic
  const handleDeleteTopic = async (topicId) => {
    try {
      // Filter out the deleted topic
      const updatedTopics = currentTopics.filter(topic => topic.id !== topicId);
      setCurrentTopics(updatedTopics);
      
      // Save the updated topics
      await saveTopics(updatedTopics);
      
      return true;
    } catch (error) {
      console.error("Error deleting topic:", error);
      return false;
    }
  };
  
  // Save current topics list
  const saveTopics = async (topicsList) => {
    try {
      // First save to local cache to protect against issues during server save
      const persistSuccess = persistTopics(subject, examBoard, examType, topicsList);
      if (persistSuccess) {
        console.log(`Protected ${topicsList.length} topics in local cache`);
      }
      
      // Get current topic lists or initialize empty array
      const currentTopicLists = Array.isArray(topicLists) ? [...topicLists] : [];
      
      // Create new topic list object
      const newTopicList = {
        id: generateId('list'),
        subject,
        examBoard,
        examType,
        topics: topicsList,
        lastUpdated: new Date().toISOString()
      };
      
      // Find if topic list for this subject, exam board, and exam type already exists
      const existingIndex = currentTopicLists.findIndex(list => 
        list.subject === subject && 
        list.examBoard === examBoard && 
        list.examType === examType
      );
      
      // Update or add the topic list
      if (existingIndex >= 0) {
        // Preserve the original ID
        newTopicList.id = currentTopicLists[existingIndex].id;
        currentTopicLists[existingIndex] = newTopicList;
      } else {
        currentTopicLists.push(newTopicList);
      }
      
      // Get current metadata or initialize empty array
      const currentMetadata = Array.isArray(topicMetadata) ? [...topicMetadata] : [];
      
      // Create new metadata object
      const newMetadata = {
        subject,
        examBoard,
        examType,
        lastUpdated: new Date().toISOString()
      };
      
      // Find if metadata for this subject already exists
      const metaIndex = currentMetadata.findIndex(meta => meta.subject === subject);
      
      // Update or add the metadata
      if (metaIndex >= 0) {
        currentMetadata[metaIndex] = newMetadata;
      } else {
        currentMetadata.push(newMetadata);
      }
      
      // Send to server
      const success = await handleTopicListSave(currentTopicLists, currentMetadata);
      
      if (success) {
        console.log("Topics saved successfully to server");
        setLastUpdated(newMetadata.lastUpdated);
        // Clear from local cache only if successfully saved to server
        if (persistSuccess) {
          clearPersistedTopics(subject, examBoard, examType);
        }
        return true;
      } else {
        console.error("Failed to save topics to server");
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
  
  return (
    <TopicListSummary
      subject={subject}
      examBoard={examBoard}
      examType={examType}
      onClose={onClose}
      onGenerateCards={onGenerateCards}
      topics={currentTopics}
      lastUpdated={lastUpdated}
      isLoading={isLoading || isGenerating}
      onSaveTopics={() => saveTopics(currentTopics)}
      onAddTopic={handleAddTopic}
      onDeleteTopic={handleDeleteTopic}
      onRegenerateTopics={generateTopics}
    />
  );
};

export default TopicListSyncManager;
