import React, { useState, useEffect } from "react";
import "./TopicReviewModal.css";
import LoadingSpinner from "./LoadingSpinner";

/**
 * TopicReviewModal - Component for reviewing and customizing generated topics
 * Allows users to review topics for each subject, add, remove, and edit topics
 * Enhanced to support the improved workflow with better organization and card generation
 */
const TopicReviewModal = ({ 
  subjectsWithTopics, 
  onComplete, 
  onAutoAddAll, 
  onClose,
  onAddTopicsToSubject,
  onGenerateCardsForTopic
}) => {
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [editingTopics, setEditingTopics] = useState({});
  const [newTopic, setNewTopic] = useState("");
  const [selectedMainTopic, setSelectedMainTopic] = useState("");
  const [showAddTopicForm, setShowAddTopicForm] = useState(false);
  const [availableMainTopics, setAvailableMainTopics] = useState([]);
  
  // Initialize editing topics state when the component mounts or subjectsWithTopics changes
  useEffect(() => {
    if (subjectsWithTopics && subjectsWithTopics.length > 0) {
      const initialEditingTopics = {};
      
      subjectsWithTopics.forEach(subject => {
        initialEditingTopics[subject.name] = [...subject.topics];
      });
      
      setEditingTopics(initialEditingTopics);
    }
  }, [subjectsWithTopics]);

  // Update available main topics when current subject changes
  useEffect(() => {
    if (subjectsWithTopics && subjectsWithTopics.length > 0) {
      const currentSubject = subjectsWithTopics[currentSubjectIndex];
      const topics = editingTopics[currentSubject.name] || [];
      
      // Extract main topics (categories) from topic list
      const mainTopicSet = new Set();
      
      topics.forEach(topic => {
        const topicText = typeof topic === 'string' ? topic : (topic.topic || '');
        if (!topicText) return;
        
        // Check if it has a main category (contains colon)
        const colonIndex = topicText.indexOf(':');
        if (colonIndex > 0) {
          const mainTopic = topicText.substring(0, colonIndex).trim();
          mainTopicSet.add(mainTopic);
        }
      });
      
      setAvailableMainTopics(Array.from(mainTopicSet));
    }
  }, [currentSubjectIndex, editingTopics, subjectsWithTopics]);

  // Get current subject
  const currentSubject = subjectsWithTopics && subjectsWithTopics.length > 0 ? 
                       subjectsWithTopics[currentSubjectIndex] : null;

  // Categorize topics for current subject
  const categorizeTopics = () => {
    if (!currentSubject) return {};
    
    const categorized = {};
    const topics = editingTopics[currentSubject.name] || [];
    
    topics.forEach(topic => {
      // Handle both string topics and object topics
      const topicText = typeof topic === 'string' ? topic : (topic.topic || '');
      
      // Skip empty topics
      if (!topicText) return;
      
      try {
        // Try to extract main category from topic
        const parts = topicText.split(':');
        
        if (parts.length > 1) {
          // If topic has format "Category: Subtopic"
          const category = parts[0].trim();
          const subtopic = parts[1].trim();
          
          if (!categorized[category]) {
            categorized[category] = [];
          }
          
          categorized[category].push({
            fullTopic: topicText,
            subtopic: subtopic,
            original: topic // Keep original topic object or string
          });
        } else {
          // For topics without clear category format
          if (!categorized["Uncategorized"]) {
            categorized["Uncategorized"] = [];
          }
          
          categorized["Uncategorized"].push({
            fullTopic: topicText,
            subtopic: topicText,
            original: topic
          });
        }
      } catch (error) {
        // If any error occurs processing this topic, add it to "Uncategorized"
        console.error("Error processing topic:", topicText, error);
        if (!categorized["Uncategorized"]) {
          categorized["Uncategorized"] = [];
        }
        categorized["Uncategorized"].push({
          fullTopic: topicText,
          subtopic: topicText,
          original: topic
        });
      }
    });
    
    return categorized;
  };
  
  const categorizedTopics = categorizeTopics();

  // Navigate to previous subject
  const prevSubject = () => {
    if (currentSubjectIndex > 0) {
      setCurrentSubjectIndex(currentSubjectIndex - 1);
    }
  };

  // Navigate to next subject
  const nextSubject = () => {
    if (currentSubjectIndex < subjectsWithTopics.length - 1) {
      setCurrentSubjectIndex(currentSubjectIndex + 1);
    } else {
      // If we're at the last subject, complete the review
      finishReview();
    }
  };

  // Finish review and pass updated topics to parent
  const finishReview = () => {
    const finalSubjectsWithTopics = subjectsWithTopics.map(subject => ({
      ...subject,
      topics: editingTopics[subject.name] || []
    }));
    
    onComplete(finalSubjectsWithTopics);
  };

  // Add a new topic to current subject
  const handleAddTopic = () => {
    if (newTopic.trim()) {
      let topicText = newTopic.trim();
      
      // If main topic is selected, format as "MainTopic: Subtopic"
      if (selectedMainTopic) {
        topicText = `${selectedMainTopic}: ${topicText}`;
      }
      
      // Update editing topics for current subject
      if (currentSubject) {
        setEditingTopics(prev => ({
          ...prev,
          [currentSubject.name]: [...(prev[currentSubject.name] || []), topicText]
        }));
      }
      
      // Reset form
      setNewTopic("");
      setSelectedMainTopic("");
      setShowAddTopicForm(false);
    }
  };

  // Remove a topic from current subject
  const handleRemoveTopic = (topicToRemove) => {
    if (currentSubject) {
      setEditingTopics(prev => ({
        ...prev,
        [currentSubject.name]: (prev[currentSubject.name] || []).filter(
          topic => {
            // Handle both string and object topics
            const topicText = typeof topic === 'string' ? 
              topic : (topic.topic || '');
            
            const removeText = typeof topicToRemove === 'string' ? 
              topicToRemove : 
              (topicToRemove.fullTopic || topicToRemove.topic || '');
              
            return topicText !== removeText;
          }
        )
      }));
    }
  };

  // Auto-accept all topics for all subjects
  const handleAutoAddAll = () => {
    if (onAutoAddAll) {
      onAutoAddAll(subjectsWithTopics.map(subject => ({
        ...subject,
        topics: editingTopics[subject.name] || []
      })));
    }
  };

  // Accept topics for current subject and move to next
  const handleAcceptAndContinue = () => {
    // Add topics to the current subject
    if (currentSubject && onAddTopicsToSubject) {
      onAddTopicsToSubject(
        currentSubject.name, 
        editingTopics[currentSubject.name] || []
      );
    }
    
    // Move to the next subject or finish if this is the last one
    if (currentSubjectIndex < subjectsWithTopics.length - 1) {
      setCurrentSubjectIndex(currentSubjectIndex + 1);
    } else {
      // If this is the last subject, finish the review
      finishReview();
    }
  };

  // Helper function to determine text color based on background brightness
  const getContrastColor = (hexColor) => {
    // Default to black text if no background color
    if (!hexColor) return "#000000";

    // If color is in hex format, convert to RGB
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate brightness using the formula: (0.299*R + 0.587*G + 0.114*B)
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    // Use white text for dark backgrounds, black for light backgrounds
    return brightness > 0.5 ? "#000000" : "#ffffff";
  };

  if (!currentSubject) {
    return (
      <div className="topic-review-overlay">
        <div className="topic-review-modal">
          <div className="topic-review-header">
            <h2>No subjects found</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="topic-review-body">
            <p>No subjects with topics found to review.</p>
          </div>
          <div className="topic-review-footer">
            <button className="close-button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="topic-review-overlay">
      <div className="topic-review-modal">
        <div className="topic-review-header">
          <h2>Review Topics for {currentSubject.name}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="topic-review-body">
          <div className="subject-info" style={{
            backgroundColor: currentSubject.color,
            color: getContrastColor(currentSubject.color)
          }}>
            <div className="subject-details">
              <h3>{currentSubject.name}</h3>
              <div className="subject-metadata">
                <span>{currentSubject.examBoard}</span>
                <span>{currentSubject.examType}</span>
              </div>
            </div>
            <div className="progress-indicator">
              Subject {currentSubjectIndex + 1} of {subjectsWithTopics.length}
            </div>
          </div>
          
          <div className="topics-container">
            {Object.entries(categorizedTopics).map(([category, topics]) => (
              <div key={category} className="topic-category">
                <h4 className="category-title">{category}</h4>
                <ul className="category-topics">
                  {topics.map((topic, index) => (
                    <li key={`${category}-${index}`} className="topic-item">
                      <span className="topic-name">{topic.subtopic}</span>
                      <div className="topic-actions">
                        {onGenerateCardsForTopic && (
                          <button
                            className="generate-cards-button"
                            onClick={() => onGenerateCardsForTopic(currentSubject, topic.fullTopic)}
                            title="Generate flashcards for this topic"
                          >
                            <i className="fa fa-magic"></i> Generate Cards
                          </button>
                        )}
                        <button
                          className="remove-topic-button"
                          onClick={() => handleRemoveTopic(topic)}
                          title="Remove this topic"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          {showAddTopicForm ? (
            <div className="add-topic-form">
              <div className="form-group">
                {availableMainTopics.length > 0 && (
                  <select
                    value={selectedMainTopic}
                    onChange={(e) => setSelectedMainTopic(e.target.value)}
                    className="main-topic-select"
                  >
                    <option value="">-- Create New Topic --</option>
                    {availableMainTopics.map((topic, index) => (
                      <option key={index} value={topic}>Add to: {topic}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder={selectedMainTopic ? "Enter subtopic..." : "Enter topic..."}
                  className="topic-input"
                />
                <div className="add-topic-actions">
                  <button className="cancel-button" onClick={() => setShowAddTopicForm(false)}>
                    Cancel
                  </button>
                  <button className="add-button" onClick={handleAddTopic}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              className="add-topic-button"
              onClick={() => setShowAddTopicForm(true)}
            >
              + Add Custom Topic
            </button>
          )}
        </div>
        
        <div className="topic-review-footer">
          <div className="navigation-buttons">
            <button
              className="prev-button"
              onClick={prevSubject}
              disabled={currentSubjectIndex === 0}
            >
              Previous Subject
            </button>
            
            <button
              className="next-button"
              onClick={handleAcceptAndContinue}
            >
              {currentSubjectIndex < subjectsWithTopics.length - 1 
                ? "Accept & Continue" 
                : "Finish & Save All"}
            </button>
          </div>
          
          <button
            className="auto-add-button"
            onClick={handleAutoAddAll}
            title="Accept all topics for all subjects and finish"
          >
            Auto-Add All Topics
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicReviewModal;
