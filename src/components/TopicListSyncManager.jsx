import React, { useState, useEffect } from "react";
import TopicListModal from "./TopicListModal";

// Safe JSON parsing helper
const safeParseJSON = (jsonString) => {
  if (!jsonString) return null;
  
  try {
    // If it's already an object, just return it
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular JSON parse
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error, "String:", jsonString.substring(0, 100));
    
    // Try recovery methods for common JSON issues
    try {
      // Try to clean up the JSON string
      const cleaned = jsonString
        .replace(/\\"/g, '"')        // Fix escaped quotes
        .replace(/"\s+/g, '"')       // Remove whitespace after quotes
        .replace(/\s+"/g, '"')       // Remove whitespace before quotes
        .replace(/,\s*}/g, '}')      // Remove trailing commas in objects
        .replace(/,\s*\]/g, ']');    // Remove trailing commas in arrays
        
      return JSON.parse(cleaned);
    } catch (secondError) {
      console.error("JSON recovery failed:", secondError);
      
      // Last resort - return empty object/array
      if (jsonString.trim().startsWith('[')) return [];
      return {};
    }
  }
};

// Debug logging helper
const debugLog = (title, data) => {
  console.log(`%c${title}`, 'color: #5d00ff; font-weight: bold; font-size: 12px;');
  console.log(JSON.stringify(data, null, 2));
  return data; // Return data for chaining
};

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
  
  // API keys - using the correct environment variables
  const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
  const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
  
  // Load existing topic lists from Knack when the component mounts or subject changes
  useEffect(() => {
    if (isOpen && auth && userId) {
      loadTopicLists();
    }
  }, [isOpen, auth, userId, subject]);
  
  // Function to load topic lists from Knack
  const loadTopicLists = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Loading topic lists for user ID: ${userId}`);
      
      // Get user data from Knack
      const getUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
      
      try {
        const getResponse = await fetch(getUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          }
        });
        
        if (!getResponse.ok) {
          throw new Error("Failed to fetch topic lists");
        }
        
        const userData = await getResponse.json();
        
        // Store the complete user data for later use
        setCompleteUserData(userData);
        
        // Extract topic lists if available
        if (userData && userData.field_3011) {
          try {
            const parsedLists = safeParseJSON(userData.field_3011);
            if (Array.isArray(parsedLists)) {
              setTopicLists(parsedLists);
              console.log(`Loaded ${parsedLists.length} topic lists from Knack`);
            }
          } catch (e) {
            console.error("Error parsing topic lists:", e);
            setTopicLists([]);
          }
        } else {
          console.log("No topic lists found in user data");
          setTopicLists([]);
        }
        
        // Extract topic metadata if available
        if (userData && userData.field_3030) {
          try {
            const parsedMetadata = safeParseJSON(userData.field_3030);
            if (Array.isArray(parsedMetadata)) {
              setTopicMetadata(parsedMetadata);
              console.log(`Loaded ${parsedMetadata.length} topic metadata entries from Knack`);
            }
          } catch (e) {
            console.error("Error parsing topic metadata:", e);
            setTopicMetadata([]);
          }
        } else {
          console.log("No topic metadata found in user data");
          setTopicMetadata([]);
        }
      } catch (error) {
        console.error("Error fetching from Knack API:", error);
        setError("Failed to load topic lists from server");
      } finally {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error loading topic lists:", error);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };
  
  // Handler for when topic list is saved in the child component
  const handleTopicListSave = async (updatedTopicLists, updatedMetadata) => {
    try {
      console.log(`Saving topic lists with ${updatedTopicLists.length} entries`);
      
      // Create the message with preserve fields flag
      const messageData = {
        type: "SAVE_DATA",
        data: {
          recordId: userId,
          userId: userId,
          topicLists: updatedTopicLists,
          topicMetadata: updatedMetadata,
          preserveFields: true,
          completeData: completeUserData
        }
      };
      
      // Log the message we're sending
      debugLog("SENDING MESSAGE TO PARENT", {
        messageType: messageData.type,
        recordId: userId, 
        topicListsCount: updatedTopicLists.length,
        topicMetadataCount: updatedMetadata.length,
        hasCompleteData: !!completeUserData,
        preserveFields: true
      });
      
      // Set up a listener for the response
      return new Promise((resolve) => {
        const messageHandler = (event) => {
          if (event.data && event.data.type === "SAVE_RESULT") {
            // Remove the event listener once we get a response
            window.removeEventListener("message", messageHandler);
            
            if (event.data.success) {
              console.log("Topic list saved successfully via postMessage");
              // Update our local state
              setTopicLists(updatedTopicLists);
              setTopicMetadata(updatedMetadata);
              resolve(true);
            } else {
              console.error("Failed to save topic list via postMessage");
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
          console.error("No save response received within timeout period");
          resolve(false);
        }, 10000); // 10-second timeout
      });
    } catch (error) {
      console.error("Error in handleTopicListSave:", error);
      return false;
    }
  };
  
  // Only render TopicListModal when isOpen is true
  if (!isOpen) return null;
  
  return (
    <TopicListModal
      subject={subject}
      examBoard={examBoard}
      examType={examType}
      onClose={onClose}
      onSelectTopic={onSelectTopic}
      onGenerateCards={onGenerateCards}
      auth={auth}
      userId={userId}
      // Pass a custom save handler to intercept saves
      onSaveTopicList={handleTopicListSave}
      // Pass our preloaded topic lists data
      existingTopicLists={topicLists}
      existingTopicMetadata={topicMetadata}
      isLoadingData={isLoading}
      completeUserData={completeUserData}
    />
  );
};

export default TopicListSyncManager;
