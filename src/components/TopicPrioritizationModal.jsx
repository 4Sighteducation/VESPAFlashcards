import React, { useState, useEffect } from "react";
import "./TopicPrioritizationModal.css";

// Priority levels and descriptions
export const PRIORITY_LEVELS = [
  {
    level: 1,
    name: "Cuppa & Chill",
    description: "Low priority. You've got this under control. Maybe flip through your notes while enjoying a nice tea break.",
    color: "#4CAF50" // Green
  },
  {
    level: 2,
    name: "Mild Concern",
    description: "Should probably start thinking about this soon. The deadline isn't looming yet, but it's on the horizon.",
    color: "#FFF59D" // Light Yellow
  },
  {
    level: 3,
    name: "Beans on Toast Urgency",
    description: "Medium priority. Time to fuel up on quick student staples and hit the books properly.",
    color: "#FF9800" // Orange (color of beans!)
  },
  {
    level: 4,
    name: "Red Bull Rampage",
    description: "High priority. Sleep is becoming optional, energy drinks essential, and your flatmates barely see you anymore.",
    color: "#F44336" // Light Red (Red Bull color)
  },
  {
    level: 5,
    name: "Library Lockdown",
    description: "Maximum priority! You've claimed your spot in the library, packed enough snacks for days, and your phone is on permanent silent. May contain mild hyperventilating.",
    color: "#B71C1C" // Deep Red
  }
];

// Explainer component
const PriorityExplainer = ({ onClose, onNeverShowAgain }) => {
  return (
    <div className="priority-explainer-overlay">
      <div className="priority-explainer-content">
        <div className="explainer-header">
          <h2>🔖 Topic Priority Levels</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="explainer-body">
          <p className="explainer-intro">Set your topic priorities to focus your study efforts where they're needed most:</p>
          
          {PRIORITY_LEVELS.map((level) => (
            <div 
              key={level.level} 
              className="priority-level-explanation"
              style={{ borderLeft: `5px solid ${level.color}` }}
            >
              <h3>{level.level}. {level.name}</h3>
              <p>{level.description}</p>
            </div>
          ))}
          
          <div className="explainer-tip">
            <p><strong>Tip:</strong> Revisit your priorities regularly as exams approach to make sure you're focusing on the right topics!</p>
          </div>
        </div>
        
        <div className="explainer-footer">
          <button className="never-show-again" onClick={onNeverShowAgain}>Don't show again</button>
          <button className="got-it-button" onClick={onClose}>Let's prioritize!</button>
        </div>
      </div>
    </div>
  );
};

// Topic Priority Slider component
const PrioritySlider = ({ topic, priority, onChange }) => {
  const [value, setValue] = useState(priority || 1);
  const currentLevel = PRIORITY_LEVELS[value - 1];
  
  const handleChange = (e) => {
    const newValue = parseInt(e.target.value);
    setValue(newValue);
    onChange(newValue);
  };
  
  const getSliderBackground = () => {
    const percent = ((value - 1) / 4) * 100;
    return `linear-gradient(to right, 
      ${PRIORITY_LEVELS[0].color} 0%, 
      ${PRIORITY_LEVELS[1].color} 25%, 
      ${PRIORITY_LEVELS[2].color} 50%, 
      ${PRIORITY_LEVELS[3].color} 75%, 
      ${PRIORITY_LEVELS[4].color} 100%)`;
  };
  
  return (
    <div className="priority-slider-container">
      <div className="priority-level-indicator" style={{ backgroundColor: currentLevel.color }}>
        {value}: {currentLevel.name}
      </div>
      
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={handleChange}
        className="priority-slider"
        style={{ background: getSliderBackground() }}
      />
    </div>
  );
};

const TopicPrioritizationModal = ({ 
  subject, 
  examBoard, 
  examType, 
  topics = [], 
  onClose, 
  onSavePriorities,
  userId
}) => {
  const [prioritizedTopics, setPrioritizedTopics] = useState([]);
  const [showExplainer, setShowExplainer] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  
  // Initialize with existing topics and their priorities
  useEffect(() => {
    // Create a deep copy of topics with their priorities
    const initialTopics = topics.map(topic => {
      // Handle both string and object topics
      const topicText = typeof topic === 'string' ? topic : (topic.topic || '');
      const priority = topic.priority || 1;
      
      return {
        topic: topicText,
        priority: priority,
        originalObject: topic // Keep reference to original object
      };
    });
    
    setPrioritizedTopics(initialTopics);
    
    // Show explainer if user hasn't dismissed it before
    const explainerSetting = localStorage.getItem(`priorityExplainer_${userId || 'local'}`);
    if (explainerSetting !== 'hide') {
      setShowExplainer(true);
    }
  }, [topics, userId]);
  
  // Handle closing the explainer
  const handleCloseExplainer = () => {
    setShowExplainer(false);
  };
  
  // Handle "never show again"
  const handleNeverShowAgain = () => {
    localStorage.setItem(`priorityExplainer_${userId || 'local'}`, 'hide');
    setShowExplainer(false);
  };
  
  // Update priority for a topic
  const handlePriorityChange = (index, newPriority) => {
    const updatedTopics = [...prioritizedTopics];
    updatedTopics[index].priority = newPriority;
    setPrioritizedTopics(updatedTopics);
  };
  
  // Save all priorities
  const handleSave = () => {
    // Create objects with proper structure for saving
    const topicsToSave = prioritizedTopics.map(item => {
      // If the original was an object, preserve its structure
      if (typeof item.originalObject === 'object' && item.originalObject !== null) {
        return {
          ...item.originalObject,
          priority: item.priority
        };
      }
      
      // If it was a string, create new object
      return {
        topic: item.topic,
        priority: item.priority
      };
    });
    
    onSavePriorities(topicsToSave);
    onClose();
  };
  
  // Filter topics based on search and priority filter
  const filteredTopics = prioritizedTopics.filter(item => {
    const matchesSearch = item.topic.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    
    const priorityLevel = parseInt(filter);
    return matchesSearch && item.priority === priorityLevel;
  });
  
  // Group topics by category if they follow the format "Category: Topic"
  const groupedTopics = {};
  
  filteredTopics.forEach(item => {
    const colonIndex = item.topic.indexOf(':');
    
    if (colonIndex > 0) {
      const category = item.topic.substring(0, colonIndex).trim();
      const subtopic = item.topic.substring(colonIndex + 1).trim();
      
      if (!groupedTopics[category]) {
        groupedTopics[category] = [];
      }
      
      groupedTopics[category].push({
        ...item,
        displayTopic: subtopic // Show just the subtopic part
      });
    } else {
      // For topics without a category
      if (!groupedTopics["Other Topics"]) {
        groupedTopics["Other Topics"] = [];
      }
      
      groupedTopics["Other Topics"].push({
        ...item,
        displayTopic: item.topic // Show the full topic
      });
    }
  });
  
  return (
    <div className="priority-modal-overlay">
      <div className="priority-modal">
        <div className="priority-modal-header">
          <h2>{subject} Topic Priorities</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="priority-modal-subheader">
          <div className="priority-info">
            <span className="exam-info">{examBoard} {examType}</span>
            <button 
              className="help-button"
              onClick={() => setShowExplainer(true)}
              title="Show priority level guide"
            >
              <span className="help-icon">❓</span>
            </button>
          </div>
          
          <div className="priority-search-container">
            <input
              type="text"
              placeholder="Search topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="priority-search"
            />
            
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="priority-filter"
            >
              <option value="all">All Priorities</option>
              {PRIORITY_LEVELS.map(level => (
                <option key={level.level} value={level.level}>
                  {level.level}: {level.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="priority-topics-container">
          {Object.keys(groupedTopics).length > 0 ? (
            Object.entries(groupedTopics).map(([category, topics]) => (
              <div key={category} className="priority-category">
                <h3 className="category-title">{category}</h3>
                <div className="category-topics">
                  {topics.map((item, index) => {
                    // Find the original index in the prioritizedTopics array
                    const originalIndex = prioritizedTopics.findIndex(
                      t => t.topic === item.topic
                    );
                    
                    return (
                      <div key={index} className="priority-topic-item">
                        <div className="topic-info">
                          <span className="topic-name">{item.displayTopic}</span>
                        </div>
                        <PrioritySlider 
                          topic={item.topic}
                          priority={item.priority}
                          onChange={(newPriority) => handlePriorityChange(originalIndex, newPriority)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="no-topics-message">
              <p>No topics match your search criteria</p>
            </div>
          )}
        </div>
        
        <div className="priority-modal-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>
            <span className="button-icon">💾</span> Save Priorities
          </button>
        </div>
      </div>
      
      {/* Priority Explainer Modal */}
      {showExplainer && (
        <PriorityExplainer 
          onClose={handleCloseExplainer}
          onNeverShowAgain={handleNeverShowAgain}
        />
      )}
    </div>
  );
};

export default TopicPrioritizationModal; 