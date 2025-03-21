import React, { useState, useEffect } from "react";
import "./TopicsList.css";
import TopicButtonsModal from "./TopicButtonsModal";

const TopicsList = ({
  topics,
  selectedTopic,
  onSelectTopic,
  getColorForTopic,
  updateTopics,
  examBoard,
  examType,
  subject,
  onGenerateCards
}) => {
  // State for showing the topic buttons modal
  const [showTopicButtonsModal, setShowTopicButtonsModal] = useState(false);
  // State for tracking expanded topics
  const [expandedTopics, setExpandedTopics] = useState({});
  const [groupedTopics, setGroupedTopics] = useState({});
  
  // Group topics by main category
  useEffect(() => {
    const grouped = {};
    
    // Process topics
    topics.forEach(topic => {
      // Check if it's a subtopic (contains a colon)
      if (topic.includes(":")) {
        const [mainTopic, subtopic] = topic.split(":");
        const mainTopicTrimmed = mainTopic.trim();
        const subtopicTrimmed = subtopic.trim();
        
        // Initialize main topic if not exists
        if (!grouped[mainTopicTrimmed]) {
          grouped[mainTopicTrimmed] = {
            name: mainTopicTrimmed,
            subtopics: []
          };
        }
        
        // Add subtopic
        grouped[mainTopicTrimmed].subtopics.push({
          name: subtopicTrimmed,
          fullName: topic // Store the full topic name for selection
        });
      } else {
        // Main topic without subtopics
        if (!grouped[topic]) {
          grouped[topic] = {
            name: topic,
            subtopics: []
          };
        }
      }
    });
    
    setGroupedTopics(grouped);
    
    // Initialize all topics as collapsed
    const initialExpanded = {};
    Object.keys(grouped).forEach(topic => {
      initialExpanded[topic] = false;
    });
    setExpandedTopics(initialExpanded);
  }, [topics]);
  
  // Toggle accordion expansion
  const toggleTopicExpansion = (topic, event) => {
    event.stopPropagation();
    setExpandedTopics(prev => ({
      ...prev,
      [topic]: !prev[topic]
    }));
  };
  
  // Helper function to determine text color based on background brightness
  const getContrastColor = (bgColor) => {
    // Default to black text if no background color
    if (!bgColor) return "#000000";

    // If color is in hex format, convert to RGB
    const hex = bgColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate brightness using the formula: (0.299*R + 0.587*G + 0.114*B)
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    // Use white text for dark backgrounds, black for light backgrounds
    return brightness > 0.5 ? "#000000" : "#ffffff";
  };

  // Handle adding a new topic
  const handleAddTopic = async (topicName) => {
    // Create new topic object with a unique ID
    const newTopic = {
      id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: topicName
    };
    
    // Add to topics list
    const updatedTopics = [...topics, newTopic];
    
    // Update the topics in the parent component
    if (updateTopics && typeof updateTopics === 'function') {
      await updateTopics(updatedTopics);
    }
    
    return Promise.resolve();
  };
  
  // Handle deleting a topic
  const handleDeleteTopic = (topicId) => {
    // Remove topic from list
    const updatedTopics = topics.filter(topic => topic.id !== topicId);
    
    // Update the topics in the parent component
    if (updateTopics && typeof updateTopics === 'function') {
      updateTopics(updatedTopics);
    }
  };
  
  // Handle saving topics
  const handleSaveTopics = () => {
    // Trigger save in the parent component
    if (updateTopics && typeof updateTopics === 'function') {
      updateTopics(topics);
    }
  };

  if (!topics || topics.length === 0) {
    return (
      <div className="topics-list empty">
        <p>No topics available for this subject.</p>
      </div>
    );
  }

  return (
    <div className="topics-list">
      <div className="topics-header">
        <h3>Topics</h3>
        <button 
          className="topic-buttons-link" 
          onClick={() => setShowTopicButtonsModal(true)} 
          title="View topic buttons"
        >
          <span className="icon">📋</span>
          <span className="text">Topic Buttons</span>
        </button>
      </div>
      <div className="topics-container">
        {/* All Topics button */}
        <button
          className={`topic-button ${selectedTopic === null ? "active" : ""}`}
          onClick={() => onSelectTopic(null)}
          style={{
            backgroundColor: "#f5f5f5",
            color: "#333"
          }}
        >
          All Topics
        </button>
        
        {/* Main topics with accordion */}
        {Object.keys(groupedTopics).map(topicKey => {
          const topic = groupedTopics[topicKey];
          const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;
          const isExpanded = expandedTopics[topicKey];
          const isSelected = selectedTopic === topicKey;
          const bgColor = getColorForTopic(topicKey);
          
          return (
            <div key={topicKey} className="topic-accordion">
              <div className="topic-header">
                <button
                  className={`topic-button ${isSelected ? "active" : ""}`}
                  onClick={() => onSelectTopic(topicKey)}
                  style={{
                    backgroundColor: isSelected ? bgColor : "#f5f5f5",
                    color: isSelected ? getContrastColor(bgColor) : "#333"
                  }}
                >
                  {topic.name}
                </button>
                
                {hasSubtopics && (
                  <div
                    className={`expand-icon ${isExpanded ? "expanded" : ""}`}
                    onClick={(e) => toggleTopicExpansion(topicKey, e)}
                  >
                    {isExpanded ? "−" : "+"}
                  </div>
                )}
              </div>
              
              {/* Render subtopics if expanded */}
              {hasSubtopics && isExpanded && (
                <div className="subtopics-container">
                  {topic.subtopics.map(subtopic => {
                    const isSubtopicSelected = selectedTopic === subtopic.fullName;
                    const subtopicBgColor = getColorForTopic(subtopic.fullName);
                    
                    return (
                      <button
                        key={subtopic.fullName}
                        className={`topic-button subtopic ${isSubtopicSelected ? "active" : ""}`}
                        onClick={() => onSelectTopic(subtopic.fullName)}
                        style={{
                          backgroundColor: isSubtopicSelected ? subtopicBgColor : "#f5f5f5",
                          color: isSubtopicSelected ? getContrastColor(subtopicBgColor) : "#333"
                        }}
                      >
                        {subtopic.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Render the TopicButtonsModal when it should be visible */}
      {showTopicButtonsModal && (
        <TopicButtonsModal
          topics={topics}
          subject={subject}
          examBoard={examBoard}
          examType={examType}
          onClose={() => setShowTopicButtonsModal(false)}
          onGenerateCards={onGenerateCards}
          onDeleteTopic={handleDeleteTopic}
          onAddTopic={handleAddTopic}
          onSaveTopics={handleSaveTopics}
        />
      )}
    </div>
  );
};

export default TopicsList;
