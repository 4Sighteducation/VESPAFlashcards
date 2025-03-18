import React, { useState, useEffect } from "react";
import "./TopicListModal.css"; // We'll reuse some of the existing CSS

// Priority level configurations for colors and labels
const PRIORITY_LEVELS = [
  { name: "Cuppa & Chill", description: "Low priority", color: "green" },
  { name: "Mild Concern", description: "Should think about soon", color: "light-yellow" },
  { name: "Beans on Toast Urgency", description: "Medium priority", color: "orange" },
  { name: "Red Bull Rampage", description: "High priority", color: "light-red" },
  { name: "Library Lockdown", description: "Maximum priority", color: "deep-red" }
];

const HighPriorityTopicsModal = ({ onClose, userTopics, allCards, onPrioritizeSubject }) => {
  const [topPriorityTopics, setTopPriorityTopics] = useState([]);
  const [subjectsForPrioritization, setSubjectsForPrioritization] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  
  useEffect(() => {
    // Gather all topics from all subjects
    const allTopics = [];
    Object.entries(userTopics).forEach(([subjectKey, topics]) => {
      if (Array.isArray(topics)) {
        // Extract subject information from the key (format: subject-examBoard-examType)
        const [subject, examBoard, examType] = subjectKey.split('-');
        
        // Add each topic with its subject info
        topics.forEach(topic => {
          if (typeof topic === 'object' && topic.priority !== undefined) {
            allTopics.push({
              ...topic,
              subject,
              examBoard,
              examType,
              // Make sure we have a consistent topic name property
              topicName: topic.topic || topic.name || 'Unnamed Topic'
            });
          }
        });
      }
    });
    
    // Sort by priority (highest first) and take top 10
    const sorted = allTopics.sort((a, b) => b.priority - a.priority);
    setTopPriorityTopics(sorted.slice(0, 10));
    
    // Get unique subjects that have topic lists for the subject selector
    if (allCards && Array.isArray(allCards)) {
      const uniqueSubjects = allCards
        .filter(card => card.hasTopicList && card.template)
        .map(card => ({
          subject: card.subject,
          examBoard: card.examBoard,
          examType: card.examType
        }));
      
      // Remove duplicates
      const subjectMap = {};
      uniqueSubjects.forEach(subject => {
        const key = `${subject.subject}-${subject.examBoard}-${subject.examType}`;
        subjectMap[key] = subject;
      });
      
      setSubjectsForPrioritization(Object.values(subjectMap));
      
      // Set default selected subject if available
      if (Object.values(subjectMap).length > 0) {
        setSelectedSubject(`${Object.values(subjectMap)[0].subject}-${Object.values(subjectMap)[0].examBoard}-${Object.values(subjectMap)[0].examType}`);
      }
    }
  }, [userTopics, allCards]);

  // Handle overlay click (close when clicking outside the modal)
  const handleOverlayClick = (e) => {
    if (e.target.className === "topic-list-modal-overlay") {
      onClose();
    }
  };
  
  // Get priority level info based on priority value (0-4)
  const getPriorityInfo = (priority) => {
    const level = Math.min(Math.max(Math.floor(priority), 0), 4);
    return PRIORITY_LEVELS[level];
  };
  
  // Navigate to prioritize a specific subject
  const handleGoToPrioritize = () => {
    if (selectedSubject && onPrioritizeSubject) {
      const [subject, examBoard, examType] = selectedSubject.split('-');
      onPrioritizeSubject({ subject, examBoard, examType });
      onClose();
    }
  };

  return (
    <div className="topic-list-modal-overlay" onClick={handleOverlayClick}>
      <div className="topic-list-modal high-priority-modal">
        <div className="modal-header">
          <h2>Top Priority Topics</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          {topPriorityTopics.length === 0 ? (
            <div className="no-priorities-container">
              <div className="no-priorities-explainer">
                <h3>📊 No Priority Data Found</h3>
                <p className="explainer-text">
                  You haven't prioritized any topics yet. Prioritizing helps you focus your study time on the topics that matter most.
                </p>
                <div className="explainer-steps">
                  <p><strong>How to prioritize topics:</strong></p>
                  <ol>
                    <li>Select a subject from the dropdown below</li>
                    <li>Click "Prioritize Topics" to go to the prioritization page</li>
                    <li>Use the sliders to set priorities from "Cuppa & Chill" to "Library Lockdown"</li>
                  </ol>
                </div>
                
                {subjectsForPrioritization.length > 0 ? (
                  <div className="prioritize-subject-selector">
                    <label htmlFor="subject-select">Select a Subject:</label>
                    <select 
                      id="subject-select"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="subject-select"
                    >
                      {subjectsForPrioritization.map(subject => (
                        <option 
                          key={`${subject.subject}-${subject.examBoard}-${subject.examType}`}
                          value={`${subject.subject}-${subject.examBoard}-${subject.examType}`}
                        >
                          {subject.subject} ({subject.examBoard} {subject.examType})
                        </option>
                      ))}
                    </select>
                    
                    <button 
                      className="action-button prioritise-button"
                      onClick={handleGoToPrioritize}
                    >
                      <span className="button-icon">⭐</span> Prioritize Topics
                    </button>
                  </div>
                ) : (
                  <p className="no-subjects-message">
                    You don't have any subjects with topic lists yet. Please generate topic lists for your subjects first.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="priority-topics-list">
              {topPriorityTopics.map((topic, index) => {
                const priorityInfo = getPriorityInfo(topic.priority);
                return (
                  <div 
                    key={`${topic.subject}-${topic.topicName}-${index}`} 
                    className="priority-topic-item"
                  >
                    <div 
                      className={`priority-indicator priority-${priorityInfo.color}`}
                      title={`${priorityInfo.name}: ${priorityInfo.description}`}
                    >
                      {topic.priority}
                    </div>
                    <div className="priority-topic-details">
                      <h3 className="topic-name">{topic.topicName}</h3>
                      <p className="topic-subject">{topic.subject} ({topic.examBoard} {topic.examType})</p>
                    </div>
                    <div className="priority-level">
                      {priorityInfo.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          {topPriorityTopics.length > 0 ? (
            <>
              <p className="priority-footnote">
                Topics are sorted by their priority level, showing the highest priority topics first.
              </p>
              <button className="action-button" onClick={onClose}>Close</button>
            </>
          ) : (
            <button className="action-button" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HighPriorityTopicsModal; 