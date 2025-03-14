import React, { useState, useEffect } from "react";
import "./AICardGenerator.css";
import Flashcard from './Flashcard';
import { generateTopicPrompt } from '../prompts/topicListPrompt';

// Constants for question types and exam boards
const QUESTION_TYPES = [
  { value: "short_answer", label: "Short Answer" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay", label: "Essay Style" },
  { value: "acronym", label: "Acronym" }
];

const EXAM_BOARDS = [
  { value: "AQA", label: "AQA" },
  { value: "Edexcel", label: "Edexcel" },
  { value: "OCR", label: "OCR" },
  { value: "WJEC", label: "WJEC" },
  { value: "CCEA", label: "CCEA" },
  { value: "International Baccalaureate", label: "IB" }
];

const EXAM_TYPES = [
  { value: "GCSE", label: "GCSE" },
  { value: "A-Level", label: "A-Level" }
];

// Function to return compatible exam boards for each exam type
const boardsForType = (examType) => {
  // All boards are available for all exam types by default
  // If specific restrictions are needed in the future, they can be added here
  return EXAM_BOARDS.map(board => board.value);
};

// Color palette for cards
const BRIGHT_COLORS = [
  // Softer, less garish color palette (36 colors)
  // Blues
  "#5b9bd5", "#2e75b6", "#4472c4", "#4a86e8", "#6fa8dc", "#a4c2f4",
  // Greens
  "#70ad47", "#548235", "#a9d18e", "#a9d08e", "#c6e0b4", "#d9ead3",
  // Reds/Pinks
  "#c00000", "#e74c3c", "#ff9999", "#ea9999", "#f4cccc", "#f9cb9c",
  // Purples
  "#8e7cc3", "#674ea7", "#b4a7d6", "#d5a6bd", "#d9d2e9", "#ead1dc",
  // Yellows/Oranges
  "#f1c232", "#bf9000", "#ffd966", "#f6b26b", "#ffe599", "#fff2cc",
  // Browns/Neutrals
  "#a0522d", "#783f04", "#b45f06", "#8d6e63", "#a67c52", "#c9c9c9"
];

// API keys - in production, these should be in server environment variables
const API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_ID || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";

const AICardGenerator = ({ onAddCard, onClose, subjects = [], auth, userId }) => {
  // Step management state
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(7);
  
  // Form data state
  const [formData, setFormData] = useState({
    examBoard: "",
    examType: "",
    subject: "",
    newSubject: "",
    topic: "",
    newTopic: "",
    numCards: 5,
    questionType: "",
    subjectColor: BRIGHT_COLORS[0],
    generatedCards: []
  });
  
  // Processing states
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  // Results states
  const [generatedCards, setGeneratedCards] = useState([]);
  
  // Progress tracking
  const [completedSteps, setCompletedSteps] = useState({});
  
  // New states for hierarchical topics and saved topic lists
  const [hierarchicalTopics, setHierarchicalTopics] = useState([]);
  const [savedTopicLists, setSavedTopicLists] = useState([]);
  const [showSaveTopicDialog, setShowSaveTopicDialog] = useState(false);
  const [topicListName, setTopicListName] = useState("");
  
  // State for available subjects and topics based on selection
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);

  // New state for success modal
  const [successModal, setSuccessModal] = useState({
    show: false,
    addedCards: []
  });

  // New state for topic modal
  const [showTopicModal, setShowTopicModal] = useState(false);

  // New state for save confirmation
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // New state for topic selection confirmation
  const [showTopicConfirmation, setShowTopicConfirmation] = useState(false);
  const [selectedTopicForConfirmation, setSelectedTopicForConfirmation] = useState("");
  const [topicListSaved, setTopicListSaved] = useState(false);

  // Load saved topic lists from both localStorage and Knack on mount
  useEffect(() => {
    // Only proceed if authenticated
    if (auth && userId) {
      console.log("User authenticated, loading topic lists from Knack");
      // Load from Knack
      loadTopicListsFromKnack()
        .then(knackLists => {
          if (knackLists && knackLists.length > 0) {
            setSavedTopicLists(knackLists);
            console.log("Loaded topic lists from Knack:", knackLists);
          } else {
            setSavedTopicLists([]);
          }
        })
        .catch(error => {
          console.error("Error loading topic lists from Knack:", error);
          setSavedTopicLists([]);
        });
    } else {
      // If not authenticated, we can't use topic lists (user-specific feature)
      console.log("User not authenticated, no topic lists will be available");
      setSavedTopicLists([]);
    }
    
    // Initialize available subjects and topics
    const examTypes = formData.examType ? ["GCSE", "A-Level"] : [];
    setAvailableSubjects(subjects.filter(s => examTypes.includes(s.examType)));
  }, [auth, userId]);

  // Load saved topic lists from Knack
  const loadTopicListsFromKnack = async () => {
    try {
      // Check if we're authenticated or have a user ID
      if (!auth || !userId) {
        console.log("No authentication data or userId, skipping Knack load");
        return [];
      }
      
      console.log("Loading topic lists from Knack for user:", userId);
      
      // Get topic lists from Knack
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
        console.error("Failed to get Knack record:", await getResponse.json());
        return [];
      }
      
      const userData = await getResponse.json();
      
      // Parse topic lists from Knack
      if (userData.field_3011) {
        try {
          const knackTopicLists = JSON.parse(userData.field_3011);
          if (Array.isArray(knackTopicLists) && knackTopicLists.length > 0) {
            console.log("Successfully loaded topic lists from Knack:", knackTopicLists);
            return knackTopicLists;
          }
        } catch (e) {
          console.error("Error parsing Knack topic lists:", e);
        }
      }
      
      return [];
    } catch (error) {
      console.error("Error loading topic lists from Knack:", error);
      return [];
    }
  };

  // Effect to update available subjects when exam type changes
  useEffect(() => {
    if (formData.examType) {
      // In a real implementation, this would fetch from your backend or a predefined list
      // For demo, we'll use a static mapping
      const examTypeSubjects = {
        "GCSE": [
    "English Language", "English Literature", "Mathematics", "Combined Science", "Double Award Science", "Triple Science",
    "Biology", "Chemistry", "Physics", "Environmental Science", "Religious Studies", "Citizenship", "Modern Studies",
    "History", "Geography", "French", "Spanish", "German", "Italian", "Mandarin Chinese", "Welsh", "Latin",
    "Ancient Greek", "Classical Civilisation", "Art and Design", "Photography", "Design and Technology",
    "Design and Technology - Product Design", "Design and Technology - Resistant Materials",
    "Design and Technology - Food Technology", "Design and Technology - Textiles", "Food Preparation and Nutrition",
    "Music", "Drama", "Dance", "Film Studies", "Computer Science", "Digital Technology", "ICT", "Business Studies",
    "Economics", "Sociology", "Psychology", "Media Studies", "Physical Education", "Health and Social Care",
    "Travel and Tourism", "Journalism", "Enterprise/Entrepreneurship", "Electronics", "General Studies", "International Baccalaureate (MYP)"
  ],
        "A-Level": [
    "Mathematics", "Further Mathematics", "Statistics", "Physics", "Chemistry", "Biology", "Combined Science",
    "Combined Science - Double Award", "Combined Science - Triple Award", "Environmental Science", "Computer Science",
    "Electronics", "English Language", "English Literature", "History", "Geography", "Religious Studies / Theology",
    "Philosophy", "Classics", "Classics - Latin", "Classics - Ancient Greek", "Classics - Classical Civilisation",
    "Economics", "Business Studies", "Accounting", "Government and Politics / Politics", "Law", "Psychology",
    "Sociology", "Media Studies", "French", "Spanish", "German", "Italian", "Mandarin Chinese", "Arabic",
    "Japanese", "Russian", "Welsh", "Art and Design", "Design and Technology",
    "Design and Technology - Product Design", "Design and Technology - Textiles",
    "Design and Technology - Resistant Materials", "Design and Technology - Systems and Control",
    "Drama and Theatre Studies", "Film Studies", "Music", "Music Technology", "Dance", "Photography",
    "Fashion", "Physical Education (PE)", "Sport Science", "Health and Social Care (availability varies)",
    "ICT / Information and Communication Technology","International Baccalaureate (DP)"
  ]
      };
      
      if (examTypeSubjects[formData.examType]) {
        // If using subjects from props, combine with predefined list
        // First, convert subjects array to string names if needed
        const subjectNames = Array.isArray(subjects) ? subjects.map(s => 
          typeof s === 'object' && s.name ? s.name : s
        ) : [];
        
        const combinedSubjects = [...new Set([
          ...subjectNames,
          ...examTypeSubjects[formData.examType]
        ])].sort();
        
        // Store as string values only, not objects
        setAvailableSubjects(combinedSubjects);
      }
    } else {
      // When no exam type is selected, handle subjects properly by converting objects to their name property
      const processedSubjects = Array.isArray(subjects) 
        ? subjects.map(s => typeof s === 'object' && s.name ? s.name : s) 
        : [];
      setAvailableSubjects(processedSubjects);
    }
  }, [formData.subject, formData.examBoard, formData.examType, subjects]);

  // Effect to generate topics when subject changes
  useEffect(() => {
    // Reset topics when subject changes
    setAvailableTopics([]);
    
    // Auto-generate topics if subject is selected
    if (formData.subject || formData.newSubject) {
      if (!isGenerating && currentStep === 3 && formData.examBoard && formData.examType) {
        console.log("Auto-generating topics for subject:", formData.subject || formData.newSubject);
        // Uncomment to auto-generate topics
        // generateTopics(formData.examBoard, formData.examType, formData.subject || formData.newSubject)
        //   .then(topics => setAvailableTopics(topics))
        //   .catch(e => console.error("Error auto-generating topics:", e));
      }
    } else {
      setAvailableTopics([]);
    }
  }, [formData.subject, formData.examBoard, formData.examType]);

  // Generate topics using AI
  const generateTopics = async (examBoard, examType, subject) => {
    try {
      if (!examBoard || !examType || !subject) {
        throw new Error("Missing required parameters");
      }
      
      // Make sure subject is a string, not an object
      const subjectName = typeof subject === 'object' && subject.name ? subject.name : subject;
      
      console.log("Generating topics for:", examBoard, examType, subjectName);
      
      // Get the prompt from our new prompt file
      const prompt = generateTopicPrompt(examBoard, examType, subjectName);
      
      // Make API call to OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
          temperature: 0.5
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No content returned from API");
      }
      
      // Extract and clean the content
      let content = data.choices[0].message.content;
      content = content.replace(/```json|```/g, '').trim();
      console.log("Raw topic response:", content);
      
      // Try to parse as JSON
      let topics;
      try {
        topics = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse topic response as JSON:", e);
        // Fall back to text processing if JSON parsing fails
        topics = content.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-*•]\s*/, '').trim());
      }
      
      // Ensure we have an array
      if (!Array.isArray(topics)) {
        console.error("Unexpected response format:", topics);
        throw new Error("Invalid topic format received");
      }
      
      console.log("Generated topics:", topics);
      return topics;
    } catch (error) {
      console.error("Error generating topics:", error);
      throw new Error(`Failed to generate topics: ${error.message}`);
    }
  };

  // Save the current topic list
  const saveTopicList = () => {
    if (!topicListName.trim()) {
      setError("Please enter a name for your topic list");
      return;
    }
    
    // Only allow saving if authenticated
    if (!auth || !userId) {
      setError("You must be logged in to save topic lists");
      return;
    }
    
    try {
      const newSavedList = {
        id: generateId('topiclist'),
        name: topicListName,
        examBoard: formData.examBoard,
        examType: formData.examType,
        subject: formData.subject || formData.newSubject,
        topics: hierarchicalTopics,
        created: new Date().toISOString(),
        userId: userId // Add userId to the list object for future reference
      };
      
      const updatedLists = [...savedTopicLists, newSavedList];
      setSavedTopicLists(updatedLists);
      
      // Save directly to Knack
      saveTopicListToKnack(updatedLists);
      
      // Close save dialog but keep topic modal open
      setShowSaveTopicDialog(false);
      setTopicListName("");
      setError(null);
      setTopicListSaved(true);
      
      console.log("Topic list saved:", newSavedList);
    } catch (error) {
      console.error("Error saving topic list:", error);
      setError("Failed to save topic list: " + error.message);
    }
  };
  
  // Generate a unique ID
  const generateId = (prefix = 'topic') => {
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${timestamp}_${randomStr}`;
  };
  
  // Save topic list to Knack - updated to save the entire lists array
  const saveTopicListToKnack = async (topicLists) => {
    try {
      // Check if we're authenticated or have a user ID
      if (!auth || !userId) {
        console.log("No authentication data or userId, skipping Knack save");
        return;
      }
      
      console.log("Saving topic lists to Knack for user:", userId);
      
      // Update Knack record directly with the full lists array
      const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
      const updateResponse = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Knack-Application-ID": KNACK_APP_ID,
          "X-Knack-REST-API-Key": KNACK_API_KEY
        },
        body: JSON.stringify({
          field_3011: JSON.stringify(topicLists)
        })
      });
      
      if (updateResponse.ok) {
        console.log("Topic lists saved to Knack successfully:", topicLists.length, "lists");
      } else {
        console.error("Failed to save topic lists to Knack:", await updateResponse.json());
      }
    } catch (error) {
      console.error("Error saving topic lists to Knack:", error);
    }
  };
  
  // Load a saved topic list
  const loadTopicList = (listId) => {
    const list = savedTopicLists.find(list => list.id === listId);
    if (!list) {
      setError("Topic list not found");
      return;
    }
    
    // Update the form data with values from the saved list
    setFormData(prev => ({
      ...prev,
      examBoard: list.examBoard,
      examType: list.examType,
      subject: list.subject,
      topic: '', // Clear any existing topic
      newSubject: '',
      newTopic: ''
    }));
    
    // Set the hierarchical topics
    setHierarchicalTopics(list.topics);
    
    // Move to step 4 (topic step) 
    setCurrentStep(4);
    
    console.log(`Loaded topic list: ${list.name}`);
  };
  
  // Delete a topic list
  const deleteTopicList = (listId) => {
    // Check if authenticated
    if (!auth || !userId) {
      setError("You must be logged in to delete topic lists");
      return;
    }
    
    // Remove from state
    const updatedLists = savedTopicLists.filter(list => list.id !== listId);
    setSavedTopicLists(updatedLists);
    
    // Save the updated lists to Knack
    saveTopicListToKnack(updatedLists);
    
    console.log(`Deleted topic list with ID: ${listId}`);
  };
  
  // Render saved topic lists
  const renderSavedTopicLists = () => {
    if (savedTopicLists.length === 0) {
      return (
        <div className="no-saved-topics">
          <p>No saved topic lists yet</p>
        </div>
      );
    }
    
    return (
      <div className="saved-topic-lists">
        <h3>Saved Topic Lists</h3>
        <div className="topic-list-grid">
          {savedTopicLists.map(list => (
            <div key={list.id} className="topic-list-card">
              <h4>{list.name}</h4>
              <div className="topic-list-details">
                <p><strong>Exam:</strong> {list.examBoard} {list.examType}</p>
                <p><strong>Subject:</strong> {list.subject}</p>
                <p><strong>Topics:</strong> {list.topics.length}</p>
                <p className="created-date">Created: {new Date(list.created).toLocaleDateString()}</p>
              </div>
              <div className="topic-list-actions">
                <button onClick={() => loadTopicList(list.id)}>Load</button>
                <button className="delete-button" onClick={() => deleteTopicList(list.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render hierarchical topics
  const renderHierarchicalTopics = () => {
    if (hierarchicalTopics.length === 0) {
      return null;
    }
    
    return (
      <div className="hierarchical-topics">
        <div className="topics-header">
          <h3>Generated Topics</h3>
          <div className="topic-actions">
            <button 
              className="save-topics-button"
              onClick={() => setShowSaveTopicDialog(true)}
            >
              Save Topic List
            </button>
          </div>
        </div>
        
        <div className="topics-list">
          {hierarchicalTopics.map((topicData, index) => {
            // Check if it's a main topic or subtopic
            const isSubtopic = topicData.topic.includes(":");
            const mainTopic = isSubtopic ? topicData.topic.split(":")[0].trim() : topicData.topic;
            const subtopic = isSubtopic ? topicData.topic.split(":")[1].trim() : null;
            
            return (
              <div key={index} className={`topic-card ${isSubtopic ? 'subtopic' : 'main-topic'}`}>
                <h4>{topicData.topic}</h4>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render topic save dialog
  const renderSaveTopicDialog = () => {
    if (!showSaveTopicDialog) {
      return null;
    }
    
    return (
      <div className="save-topic-overlay">
        <div className="save-topic-dialog">
          <h3>Save Topic List</h3>
          <div className="form-group">
            <label>Name</label>
            <input 
              type="text" 
              value={topicListName} 
              onChange={(e) => setTopicListName(e.target.value)}
              placeholder="Enter a name for this topic list"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="dialog-actions">
            <button className="cancel-button" onClick={() => setShowSaveTopicDialog(false)}>Cancel</button>
            <button className="save-button" onClick={saveTopicList}>Save</button>
          </div>
        </div>
      </div>
    );
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for subject field
    if (name === 'subject') {
      // Clear new subject when selecting from dropdown
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        newSubject: '' // Clear new subject when selecting from dropdown
      }));
      
      // If it's a subject selection and we have the original subject object
      // Find the subject object to get its color
      const selectedSubject = subjects.find(s => {
        if (typeof s === 'object' && s.name) {
          return s.name === value;
        }
        return s === value;
      });
      
      // If we found a subject with a color, update the color too
      if (selectedSubject && typeof selectedSubject === 'object' && selectedSubject.color) {
        setFormData(prev => ({
          ...prev,
          subjectColor: selectedSubject.color
        }));
      }
    } else {
      // Regular field update
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle color selection
  const handleColorSelect = (color) => {
    setFormData(prev => ({ ...prev, subjectColor: color }));
  };

  // Handle next step in wizard
  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      // If we're moving from step 6 (question type) to step 7 (confirmation),
      // set isGenerating to true to show the loading screen immediately
      // AND trigger the card generation
      if (currentStep === 6) {
        setIsGenerating(true);
        // Move to next step first, then trigger card generation
        setCurrentStep(currentStep + 1);
        // Directly call generateCards without waiting for the useEffect
        setTimeout(() => generateCards(), 100);
        return; // Exit early since we already set the next step
      }
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle previous step in wizard
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validate current step
  const canProceed = () => {
    switch (currentStep) {
      case 1: // Exam Type
        return !!formData.examType;
      case 2: // Exam Board
        return !!formData.examBoard;
      case 3: // Subject
        return !!(formData.subject || formData.newSubject);
      case 4: // Topic
        return !!(formData.topic || formData.newTopic);
      case 5: // Number of Cards
        return formData.numCards > 0 && formData.numCards <= 20;
      case 6: // Question Type
        return !!formData.questionType;
      default:
        return true;
    }
  };

  // Generate cards using OpenAI API
  const generateCards = async () => {
    // Get subject value, ensuring it's a string not an object
    const subjectValue = formData.subject || formData.newSubject;
    const subjectName = typeof subjectValue === 'object' && subjectValue.name 
      ? subjectValue.name 
      : subjectValue;
    
    console.log("Generate cards function called with state:", { 
      isGenerating, 
      currentStep,
      formData: { 
        examType: formData.examType,
        examBoard: formData.examBoard,
        subject: subjectName,
        topic: formData.topic || formData.newTopic,
        questionType: formData.questionType
      }
    });
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Determine final subject and topic (use new values if provided)
      const finalSubject = formData.newSubject || subjectName;
      const finalTopic = formData.newTopic || formData.topic;
      const finalExamType = formData.examType;
      const finalExamBoard = formData.examBoard;
      
      // Log explicit metadata that will be used
      console.log("Explicit metadata for cards:", {
        finalSubject,
        finalTopic,
        finalExamType,
        finalExamBoard
      });
      
      // Automatically select a color if not already set
      // This can happen if we're coming from a previous step
      let cardColor = formData.subjectColor;
      
      // Get existing subject colors from parent component's subjects if available
      const existingSubjects = subjects || [];
      const existingColors = existingSubjects
        .filter(sub => sub.subjectColor && typeof sub.subjectColor === 'string') // Only consider subjects with colors that are strings
        .map(sub => sub.subjectColor.toLowerCase()); // Normalize color format
      
      // If this is a new subject that matches an existing one, use that color
      const matchingSubject = existingSubjects.find(sub => {
        const subName = typeof sub === 'object' && sub.subject ? sub.subject : 
                       typeof sub === 'object' && sub.name ? sub.name : sub;
        return subName && (subName.toLowerCase() === finalSubject.toLowerCase());
      });
      
      if (matchingSubject && matchingSubject.subjectColor) {
        // Use the existing subject color
        cardColor = matchingSubject.subjectColor;
        console.log(`Using existing color ${cardColor} for subject ${finalSubject}`);
      } else {
        // Find a color not already in use
        const availableColors = BRIGHT_COLORS.filter(color => 
          !existingColors.includes(color.toLowerCase())
        );
        
        if (availableColors.length > 0) {
          // Use a color that's not already used by another subject
          cardColor = availableColors[Math.floor(Math.random() * availableColors.length)];
          console.log(`Selected new color ${cardColor} for subject ${finalSubject}`);
        } else {
          // If all colors are used, just pick a random one
          cardColor = BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
          console.log(`All colors in use, randomly selected ${cardColor} for subject ${finalSubject}`);
        }
      }
      
      // Update the form data with the selected color
      setFormData(prev => ({ ...prev, subjectColor: cardColor }));
      
      // Create prompt based on question type and other parameters
      let prompt;
      
      if (formData.questionType === "acronym") {
        let topicInfo = finalTopic ? ` with focus on ${finalTopic}` : "";
        prompt = `Return only a valid JSON array with no additional text. Please output all mathematical expressions in plain text (avoid markdown or LaTeX formatting). Generate ${formData.numCards} exam-style flashcards for ${formData.examBoard} ${formData.examType} ${finalSubject}${topicInfo}. Create a useful acronym from some essential course knowledge. Be creative and playful. Format exactly as: [{"acronym": "Your acronym", "explanation": "Detailed explanation here"}]`;
      } else {
        // Determine complexity based on exam type
        let complexityInstruction;
        if (formData.examType === "A-Level") {
          complexityInstruction = "Make these appropriate for A-Level students (age 16-18). Questions should be challenging and involve deeper thinking. Include sufficient detail in answers and use appropriate technical language.";
        } else { // GCSE
          complexityInstruction = "Make these appropriate for GCSE students (age 14-16). Questions should be clear but still challenging. Explanations should be thorough but accessible.";
        }
        
        // Base prompt
        prompt = `Return only a valid JSON array with no additional text. Please output all mathematical expressions in plain text (avoid markdown or LaTeX formatting). 
Generate ${formData.numCards} high-quality ${formData.examBoard} ${formData.examType} ${finalSubject} flashcards for the specific topic "${finalTopic}".
${complexityInstruction}

Before generating questions, scrape the latest ${formData.examBoard} ${formData.examType} ${finalSubject} specification to ensure the content matches the current curriculum exactly.

Use this format for different question types:
`;
        
        // Add format based on question type
        if (formData.questionType === "multiple_choice") {
          prompt += `[
  {
    "subject": "${finalSubject}",
    "topic": "${finalTopic}",
    "questionType": "multiple_choice",
    "question": "Clear, focused question based on the curriculum",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": "The correct option exactly as written in options array",
    "detailedAnswer": "Detailed explanation of why this answer is correct, with key concepts and examples"
  }
]`;
        } else if (formData.questionType === "short_answer") {
          prompt += `[
  {
    "subject": "${finalSubject}",
    "topic": "${finalTopic}",
    "questionType": "short_answer",
    "question": "Clear, focused question from the curriculum",
    "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "detailedAnswer": "Complete and thorough explanation with all necessary information"
  }
]`;
        } else if (formData.questionType === "essay") {
          prompt += `[
  {
    "subject": "${finalSubject}",
    "topic": "${finalTopic}",
    "questionType": "essay",
    "question": "Thought-provoking essay question matching the curriculum",
    "keyPoints": ["Important point 1", "Important point 2", "Important point 3", "Important point 4"],
    "detailedAnswer": "Structured essay plan with introduction, key arguments, and conclusion guidance"
  }
]`;
        }
      }
      
      console.log("Generating cards with prompt:", prompt);
      
      // Make the API call to OpenAI
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.7
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Error calling OpenAI API");
      }
      
      // Parse the response
      const content = data.choices[0].message.content;
      console.log("Raw AI response:", content);
      
      const cleanedContent = cleanOpenAIResponse(content);
      
      let cards;
      try {
        cards = JSON.parse(cleanedContent);
      } catch (e) {
        console.error("Error parsing AI response:", e);
        throw new Error("Failed to parse AI response. Please try again.");
      }
      
      if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error("Invalid response format from AI. Please try again.");
      }
      
      // Process the generated cards
      const processedCards = cards.map((card, index) => {
        // Generate a unique ID
        const id = `card_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Log metadata for debugging
        console.log(`Generating card #${index + 1} with metadata:`, {
          subject: finalSubject,
          topic: finalTopic,
          examType: finalExamType,
          examBoard: finalExamBoard,
          color: cardColor
        });
        
        // Ensure card color is valid - use a default if no color is available
        const ensuredCardColor = cardColor || "#3cb44b";
        
        // Add standard fields
        const baseCard = {
          id,
          subject: finalSubject,
          topic: finalTopic,
          examType: finalExamType,
          examBoard: finalExamBoard,
          questionType: formData.questionType,
          cardColor: ensuredCardColor,
          baseColor: ensuredCardColor,
          timestamp: new Date().toISOString(),
          boxNum: 1, // Start in box 1
        };
        
        // Process specific question types
        if (formData.questionType === "acronym") {
          return {
            ...baseCard,
            acronym: card.acronym,
            explanation: card.explanation,
            front: `Acronym: ${card.acronym}`,
            back: `Explanation: ${card.explanation}`
          };
        } else if (formData.questionType === "multiple_choice") {
          // Clean all options and correct answer of any existing prefixes
          const cleanedOptions = card.options.map(option => 
            option.replace(/^[a-d]\)\s*/i, '').trim()
          );
          
          let correctAnswer = card.correctAnswer.replace(/^[a-d]\)\s*/i, '').trim();
          
          // Find the index of the correct answer in the options
          let correctIndex = cleanedOptions.findIndex(option => 
            option.toLowerCase() === correctAnswer.toLowerCase()
          );
          
          // If match not found, try a more flexible comparison
          if (correctIndex === -1) {
            correctIndex = cleanedOptions.findIndex(option => 
              option.toLowerCase().includes(correctAnswer.toLowerCase()) || 
              correctAnswer.toLowerCase().includes(option.toLowerCase())
            );
          }
          
          // If still not found, default to the first option
          if (correctIndex === -1) {
            console.warn("Could not match correct answer to an option, defaulting to first option");
            correctIndex = 0;
            correctAnswer = cleanedOptions[0];
          }
          
          // Get the letter for this index (a, b, c, d)
          const letter = String.fromCharCode(97 + correctIndex);
          
          return {
            ...baseCard,
            question: card.question,
            options: cleanedOptions, // Use the cleaned options
            correctAnswer: correctAnswer, // Use the cleaned correct answer
            correctIndex: correctIndex, // Store the index for future reference
            detailedAnswer: card.detailedAnswer,
            additionalInfo: card.detailedAnswer, // Add to additionalInfo field for info modal
            front: card.question,
            back: `Correct Answer: ${letter}) ${correctAnswer}` // Format with letter prefix
          };
        } else if (formData.questionType === "short_answer" || formData.questionType === "essay") {
          // Create key points as bullet points if they exist
          const keyPointsHtml = card.keyPoints && card.keyPoints.length > 0
            ? card.keyPoints.map(point => `• ${point}`