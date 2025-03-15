import React, { useState, useEffect } from "react";
import "./TopicListModal.css";

// API keys - using the correct environment variables
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";

const TopicListModal = ({ 
  subject, 
  examBoard, 
  examType, 
  onClose, 
  onSelectTopic, 
  onGenerateCards,
  auth,
  userId
}) => {
  const [topics, setTopics] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicListSaved, setTopicListSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing topic list for this subject on mount
  useEffect(() => {
    loadTopicList();
  }, [subject]);

  // Load topic list for this subject
  const loadTopicList = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we're authenticated
      if (!auth || !userId) {
        setError("You must be logged in to view topic lists");
        setIsLoading(false);
        return;
      }
      
      console.log(`Loading topic list for subject: ${subject}`);
      
      // Get topic lists from Knack
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
          const errorText = await getResponse.text();
          console.error("Failed to get Knack record:", errorText);
          setError("Failed to load topic list");
          setIsLoading(false);
          return;
        }
        
        const userData = await getResponse.json();
        
        // Parse topic lists from Knack
        if (userData && userData.field_3011) {
          try {
            const allTopicLists = JSON.parse(userData.field_3011);
            
            // Find the topic list for this subject
            const subjectTopicList = allTopicLists.find(list => 
              list.subject === subject && 
              list.examBoard === examBoard && 
              list.examType === examType
            );
            
            if (subjectTopicList && Array.isArray(subjectTopicList.topics)) {
              console.log(`Found topic list for ${subject} with ${subjectTopicList.topics.length} topics`);
              setTopics(subjectTopicList.topics.map(t => t.topic));
              setTopicListSaved(true);
            } else {
              console.log(`No topic list found for ${subject}`);
              setTopics([]);
            }
          } catch (e) {
            console.error("Error parsing Knack topic lists:", e);
            setError("Error loading topic list");
          }
        } else {
          console.log("No topic lists found in user data");
          setTopics([]);
        }
      } catch (fetchError) {
        console.error("Error fetching from Knack API:", fetchError);
        setError("Error connecting to server");
      }
    } catch (error) {
      console.error("Error loading topic list:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate topics for this subject
  const generateTopics = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log(`Generating topics for: ${examBoard} ${examType} ${subject}`);
      
      // Create a prompt for the OpenAI API
      const prompt = `Generate a list of 20 specific curriculum topics for ${examBoard} ${examType} ${subject}. 
      Format the response as a JSON array of strings, with each string being a specific topic.
      Make the topics specific and detailed enough to create flashcards about.`;
      
      // Call the OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Error calling OpenAI API");
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      console.log("Raw topic response:", content);
      
      // Parse the response
      let parsedTopics;
      try {
        // Clean the response to handle potential formatting issues
        const cleanedContent = content
          .replace(/```json\s*/g, "")
          .replace(/```/g, "")
          .trim();
        
        parsedTopics = JSON.parse(cleanedContent);
      } catch (e) {
        console.error("Failed to parse topic response as JSON:", e);
        // Fall back to text processing if JSON parsing fails
        parsedTopics = content.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-*•]\s*/, '').trim());
      }
      
      // Ensure we have an array
      if (!Array.isArray(parsedTopics)) {
        console.error("Unexpected response format:", parsedTopics);
        throw new Error("Invalid topic format received");
      }
      
      console.log("Generated topics:", parsedTopics);
      setTopics(parsedTopics);
      
      // Save the topic list
      saveTopicList(parsedTopics);
      
    } catch (error) {
      console.error("Error generating topics:", error);
      setError(`Failed to generate topics: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save topic list to Knack
  const saveTopicList = async (topicsList) => {
    try {
      // Check if we're authenticated
      if (!auth || !userId) {
        setError("You must be logged in to save topic lists");
        return;
      }
      
      console.log(`Saving topic list for ${subject} with ${topicsList.length} topics`);
      
      // Get existing topic lists first
      const getUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
      const getResponse = await fetch(getUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        }
      });
      
      if (!getResponse.ok) {
        const errorText = await getResponse.text();
        console.error("Failed to get existing topic lists:", errorText);
        setError("Failed to save topic list");
        return;
      }
      
      const userData = await getResponse.json();
      
      // Parse existing topic lists
      let allTopicLists = [];
      if (userData && userData.field_3011) {
        try {
          allTopicLists = JSON.parse(userData.field_3011);
          if (!Array.isArray(allTopicLists)) {
            allTopicLists = [];
          }
        } catch (e) {
          console.error("Error parsing existing topic lists:", e);
        }
      }
      
      // Create the new topic list object
      const newTopicList = {
        id: generateId('topiclist'),
        name: `${subject} - ${examBoard} ${examType}`,
        examBoard,
        examType,
        subject,
        topics: topicsList.map(topic => ({ topic })),
        created: new Date().toISOString(),
        userId
      };
      
      // Remove any existing topic list for this subject/exam combination
      const filteredLists = allTopicLists.filter(list => 
        !(list.subject === subject && list.examBoard === examBoard && list.examType === examType)
      );
      
      // Add the new list
      const updatedLists = [...filteredLists, newTopicList];
      
      // Save to Knack
      const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        },
        body: JSON.stringify({
          field_3011: JSON.stringify(updatedLists)
        })
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error("Failed to save topic list:", errorText);
        setError("Failed to save topic list");
        return;
      }
      
      console.log("Topic list saved successfully");
      setTopicListSaved(true);
      
    } catch (error) {
      console.error("Error saving topic list:", error);
      setError(`Failed to save topic list: ${error.message}`);
    }
  };

  // Generate a unique ID
  const generateId = (prefix = 'topic') => {
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${timestamp}_${randomStr}`;
  };

  // Handle topic selection
  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
  };

  // Handle continue button click
  const handleContinue = () => {
    if (selectedTopic) {
      onSelectTopic(selectedTopic);
    }
  };

  // Handle generate cards button click
  const handleGenerateCards = () => {
    if (selectedTopic) {
      onGenerateCards(selectedTopic);
    }
  };

  return (
    <div className="topic-list-modal-overlay">
      <div className="topic-list-modal-content">
        <div className="topic-list-modal-header">
          <h3>{subject} Topics</h3>
          <button className="close-modal-button" onClick={onClose}>×</button>
        </div>
        
        <div className="topic-list-modal-body">
          {isLoading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading topics for {subject}...</p>
            </div>
          ) : isGenerating ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Generating topics for {subject}...</p>
              <p className="loading-subtext">This may take a moment as we analyze the curriculum.</p>
            </div>
          ) : topics.length > 0 ? (
            <>
              <div className="topics-header-actions">
                <h4>Available Topics</h4>
                <button 
                  className="regenerate-topics-button"
                  onClick={generateTopics}
                  disabled={isGenerating}
                >
                  Regenerate Topics
                </button>
              </div>
              <div className="topic-list-container">
                {topics.map((topic) => (
                  <div 
                    key={topic} 
                    className={`topic-item ${selectedTopic === topic ? 'selected' : ''}`}
                    onClick={() => handleTopicClick(topic)}
                  >
                    {topic}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-topics-message">
              <p>No topics available for {subject} yet.</p>
              <p>Click the "Generate Topics" button to create topics for this subject.</p>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
        
        <div className="topic-list-modal-actions">
          {topics.length === 0 ? (
            <button 
              className="generate-topics-button"
              onClick={generateTopics}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Topics"}
            </button>
          ) : (
            <>
              <button 
                className="continue-button"
                disabled={!selectedTopic}
                onClick={handleContinue}
              >
                Continue with Selected Topic
              </button>
              
              <button 
                className="generate-cards-button"
                disabled={!selectedTopic}
                onClick={handleGenerateCards}
              >
                Generate Cards
              </button>
            </>
          )}
          
          <button 
            className="close-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicListModal; 