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
  { value: "SQA", label: "SQA" },
  { value: "International Baccalaureate", label: "International Baccalaureate" },
  { value: "Cambridge International", label: "Cambridge International" }
];

const EXAM_TYPES = [
  { value: "GCSE", label: "GCSE" },
  { value: "A-Level", label: "A-Level" },
  { value: "IB", label: "International Baccalaureate" },
  { value: "AP", label: "Advanced Placement" },
  { value: "Scottish Higher", label: "Scottish Higher" },
  { value: "BTEC", label: "BTEC" },
  { value: "Other", label: "Other" }
];

// Function to return compatible exam boards for each exam type
const boardsForType = (examType) => {
  // All boards are available for all exam types by default
  // If specific restrictions are needed in the future, they can be added here
  return EXAM_BOARDS.map(board => board.value);
};

// Color palette for cards
const BRIGHT_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
  "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
  "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C"
];

// API keys - using the correct environment variables
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_KEY || "your-openai-key";
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";

const AICardGenerator = ({ 
  onAddCard, 
  onClose, 
  subjects = [], 
  auth, 
  userId,
  initialSubject = "",
  initialTopic = "",
  examBoard = "AQA",
  examType = "A-Level"
}) => {
  // Step management state
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(7);
  
  // Form data state
  const [formData, setFormData] = useState({
    examBoard: examBoard,
    examType: examType,
    subject: initialSubject,
    newSubject: "",
    topic: initialTopic,
    newTopic: "",
    numCards: 5,
    questionType: "multiple_choice",
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
          // Try to get the error as text first to avoid JSON parsing errors
          const errorText = await getResponse.text();
          console.error("Failed to get Knack record:", errorText);
          return [];
        }
        
        const userData = await getResponse.json();
        
        // Parse topic lists from Knack
        if (userData && userData.field_3011) {
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
      } catch (fetchError) {
        console.error("Error fetching from Knack API:", fetchError);
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
    "Philosophy", "Classics", "Classics - Latin", "Classesics - Ancient Greek", "Classesics - Classical Civilisation",
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
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
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
      // Validate that we have topics to save
      if (!hierarchicalTopics || hierarchicalTopics.length === 0) {
        setError("No topics available to save. Please generate topics first.");
        return;
      }
      
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
      
      // Log the new list for debugging
      console.log("Creating new topic list:", newSavedList);
      
      const updatedLists = [...savedTopicLists, newSavedList];
      setSavedTopicLists(updatedLists);
      
      // Save directly to Knack
      saveTopicListToKnack(updatedLists)
        .then(success => {
          if (success) {
            // Close save dialog but keep topic modal open
            setShowSaveTopicDialog(false);
            setTopicListName("");
            setError(null);
            setTopicListSaved(true);
            console.log("Topic list saved successfully:", newSavedList.name);
          } else {
            // Error message is set by saveTopicListToKnack
            console.error("Failed to save topic list to Knack");
          }
        })
        .catch(err => {
          console.error("Error in save operation:", err);
          setError("Failed to save topic list: " + err.message);
        });
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
        return false;
      }
      
      console.log("Saving topic lists to Knack for user:", userId);
      
      // Safety check to ensure topicLists is a valid array
      if (!Array.isArray(topicLists)) {
        console.error("Topic lists is not an array:", topicLists);
        return false;
      }
      
      // Extract user information for additional fields
      const userName = auth.name || "";
      const userEmail = auth.email || "";
      const userTutor = auth.tutor || "";
      const userSchool = auth.school || auth.field_122 || "";
      const userRole = auth.role || "";
      const tutorGroup = auth.tutorGroup || "";
      const yearGroup = auth.yearGroup || "";
      
      // Create the data object to send
      const dataToSave = {
        field_3011: JSON.stringify(topicLists),
        field_3010: userName,                        // User Name
        field_3008: userSchool,                      // VESPA Customer (school)
        field_2956: userEmail,                       // User Account Email
        field_3009: userTutor,                       // User "Tutor"
        field_565: tutorGroup,                       // Group (Tutor Group)
        field_548: yearGroup,                        // User Role
        field_73: userRole
      };
      
      console.log("Data being sent to Knack:", dataToSave);
      
      try {
        // Update Knack record directly with the full lists array
        const updateUrl = `https://api.knack.com/v1/objects/object_102/records/${userId}`;
        const updateResponse = await fetch(updateUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Knack-Application-ID": KNACK_APP_ID,
            "X-Knack-REST-API-Key": KNACK_API_KEY
          },
          body: JSON.stringify(dataToSave)
        });
        
        if (updateResponse.ok) {
          console.log("Topic lists and user information saved to Knack successfully");
          return true;
        } else {
          const errorText = await updateResponse.text();
          console.error("Failed to save topic lists to Knack:", errorText);
          return false;
        }
      } catch (fetchError) {
        console.error("Error with Knack API request:", fetchError);
        return false;
      }
    } catch (error) {
      console.error("Error saving topic lists to Knack:", error);
      return false;
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
                <button 
                  className="generate-cards-button" 
                  onClick={() => generateCardsFromTopicList(list)}
                >
                  Generate Cards
                </button>
                <button className="delete-button" onClick={() => deleteTopicList(list.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Generate cards directly from a saved topic list
  const generateCardsFromTopicList = (list) => {
    // First load the topic list data
    setFormData(prev => ({
      ...prev,
      examBoard: list.examBoard,
      examType: list.examType,
      subject: list.subject,
      // We'll select a random topic from the list
      topic: list.topics[Math.floor(Math.random() * list.topics.length)].topic,
      // Default to multiple choice questions
      questionType: "multiple_choice",
      numCards: 5
    }));
    
    // Move to the question type step (step 5)
    setCurrentStep(5);
    
    console.log(`Loaded topic list for card generation: ${list.name}`);
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
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
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
            ? card.keyPoints.map(point => `• ${point}`).join("<br/>")
            : "";
            
          return {
            ...baseCard,
            question: card.question,
            keyPoints: card.keyPoints || [],
            detailedAnswer: card.detailedAnswer,
            additionalInfo: card.detailedAnswer, // Add to additionalInfo field for info modal
            front: card.question,
            back: keyPointsHtml // Only show key points, not detailed answer
          };
        } else {
          return {
            ...baseCard,
            front: card.front || card.question,
            back: card.back || card.answer
          };
        }
      });
      
      // Add debug log of the full processed cards before setting state
      console.log("FINAL PROCESSED CARDS:", processedCards.map(card => ({
        id: card.id,
        subject: card.subject,
        topic: card.topic,
        examType: card.examType,
        examBoard: card.examBoard,
        questionType: card.questionType,
      })));

      setGeneratedCards(processedCards);
      
    } catch (error) {
      console.error("Error generating cards:", error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Call to generate cards when arriving at the final step
  // This useEffect is now a backup in case the direct call fails
  useEffect(() => {
    // Only trigger card generation if we're at step 7, we don't have cards yet,
    // and we're not already generating (to avoid duplicate calls)
    if (currentStep === 7 && generatedCards.length === 0 && !isGenerating) {
      console.log("Backup useEffect triggering card generation");
      generateCards();
    }
  }, [currentStep, generatedCards.length, isGenerating]);

  // Helper function to clean AI response
  const cleanOpenAIResponse = (text) => {
    return text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  };

  // Add a single card to the bank
  const handleAddCard = (card) => {
    onAddCard(card);
    // Mark card as added in UI
    setGeneratedCards(prev => 
      prev.map(c => c.id === card.id ? {...c, added: true} : c)
    );
    
    // Show success modal with this card
    setSuccessModal({
      show: true,
      addedCards: [card]
    });
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setSuccessModal(prev => ({...prev, show: false}));
    }, 2000);
    
    // Trigger an explicit save operation to prevent data loss on refresh
    if (window.parent && window.parent.postMessage) {
      window.parent.postMessage({ type: "TRIGGER_SAVE" }, "*");
      console.log("Triggered save after adding card to bank");
    }
  };

  // Add all cards to the bank
  const handleAddAllCards = () => {
    const unadded = generatedCards.filter(card => !card.added);
    
    if (unadded.length === 0) {
      return; // No cards to add
    }
    
    // Add all unadded cards
    unadded.forEach(card => {
      onAddCard(card);
    });
    
    // Mark all cards as added
    setGeneratedCards(prev => prev.map(c => ({...c, added: true})));
    
    // Show success modal with all added cards
    setSuccessModal({
      show: true,
      addedCards: unadded
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setSuccessModal(prev => ({...prev, show: false}));
    }, 3000);
    
    // Trigger an explicit save operation to ensure cards are saved to the database
    // This is important to prevent data loss if the user refreshes the page
    if (window.parent && window.parent.postMessage) {
      // Send a message to trigger a save operation
      window.parent.postMessage({ type: "TRIGGER_SAVE" }, "*");
      console.log("Triggered explicit save after adding all cards");
    }
  };
  
  // Modal to show successfully added cards
  const renderSuccessModal = () => {
    if (!successModal.show) return null;
    
    return (
      <div className="success-modal-overlay">
        <div className="success-modal">
          <div className="success-icon">✓</div>
          <h3>{successModal.addedCards.length} {successModal.addedCards.length === 1 ? 'Card' : 'Cards'} Added!</h3>
          <div className="success-cards">
            {successModal.addedCards.slice(0, 5).map(card => (
              <div key={card.id} className="success-card-item" style={{backgroundColor: card.cardColor}}>
                <span style={{color: getContrastColor(card.cardColor)}}>{card.front.substring(0, 40)}...</span>
              </div>
            ))}
            {successModal.addedCards.length > 5 && (
              <div className="success-more">+{successModal.addedCards.length - 5} more</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Generate new batch of cards
  const handleRegenerateCards = () => {
    setGeneratedCards([]);
    setIsGenerating(true);
    
    // Keep the existing color when regenerating
    const currentColor = formData.subjectColor;
    
    // We want to keep all the existing parameters the same,
    // including the color, but generate new cards
    generateCards();
  };

  // Helper to get contrast color for text
  const getContrastColor = (hexColor) => {
    // Remove # if present
    if (hexColor.startsWith('#')) {
      hexColor = hexColor.slice(1);
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Function to handle generating topics from the main screen
  const handleGenerateTopics = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      // Show the modal immediately with the loading indicator
      setShowTopicModal(true);
      
      // Get the subject value, ensuring it's a string not an object
      const subjectValue = formData.subject || formData.newSubject;
      const subjectName = typeof subjectValue === 'object' && subjectValue.name 
        ? subjectValue.name 
        : subjectValue;
      
      const topics = await generateTopics(
        formData.examBoard,
        formData.examType,
        subjectName
      );
      setAvailableTopics(topics);
      setHierarchicalTopics(topics.map(topic => ({ topic })));
      setTopicListSaved(false);
    } catch (err) {
      setError(err.message);
      // Don't close the modal on error, just show the error inside it
    } finally {
      setIsGenerating(false);
    }
  };

  // Render step content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Exam Type
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select Exam Type</h2>
            <div className="form-group">
              <select 
                name="examType" 
                value={formData.examType} 
                onChange={handleChange}
                required
                style={examSelectorStyle}
              >
                <option value="">Select Exam Type</option>
                {EXAM_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
        
      case 2: // Exam Board
        return (
          <div className="step-content">
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Select Exam Board</h2>
            <div className="form-group">
              <select 
                name="examBoard" 
                value={formData.examBoard} 
                onChange={handleChange}
                required
                style={examSelectorStyle}
              >
                <option value="">Select Exam Board</option>
                {EXAM_BOARDS.filter(board => boardsForType(formData.examType).includes(board.value)).map(board => (
                  <option key={board.value} value={board.value}>
                    {board.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
        
      case 3: // Subject
        return (
          <div className="step-content">
            <h2>Select Subject</h2>
            <div className="form-group">
              <select 
                name="subject" 
                value={formData.subject} 
                onChange={handleChange}
              >
                <option value="">-- Select Subject --</option>
                {availableSubjects.map((subject, index) => {
                  // Ensure we're working with subject names, not objects
                  const subjectName = typeof subject === 'object' && subject.name ? subject.name : subject;
                  return (
                    <option key={index} value={subjectName}>
                      {subjectName}
                    </option>
                  );
                })}
              </select>
            
              <div className="form-group mt-3">
                <p className="divider">Or</p>
                <label htmlFor="newSubject">Enter a new subject:</label>
                <input
                  type="text"
                  id="newSubject"
                  name="newSubject"
                  value={formData.newSubject}
                  onChange={handleChange}
                  placeholder="Type a new subject name"
                />
              </div>
            </div>
          </div>
        );
        
      case 4: // Topic
        return (
          <div className="step-content">
            <h2>Select a Topic</h2>
            
            <div className="form-group">
              <label>Topic</label>
              {renderTopicSelectionUI()}
            </div>
            
            {/* Saved topic lists shown below */}
            {renderSavedTopicLists()}
          </div>
        );
        
      case 5: // Number of Cards
        return (
          <div className="step-content">
            <h2>Number of Cards</h2>
            <div className="form-group">
              <input 
                type="number" 
                name="numCards" 
                value={formData.numCards} 
                onChange={handleChange}
                min="1" 
                max="20" 
                required 
              />
              <p className="helper-text">Select between 1 and 20 cards</p>
            </div>
          </div>
        );
        
      case 6: // Question Type
        return (
          <div className="step-content">
            <h2>Select Question Type</h2>
            <div className="question-type-selector">
              {QUESTION_TYPES.map(type => (
                <div key={type.value} className="question-type-option">
                  <input
                    type="radio"
                    id={`question-type-${type.value}`}
                    name="questionType"
                    value={type.value}
                    checked={formData.questionType === type.value}
                    onChange={handleChange}
                  />
                  <label htmlFor={`question-type-${type.value}`}>
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
            
            <div className="question-type-description">
              {formData.questionType === "short_answer" && (
                <p>Short answer questions test recall of key facts and concepts.</p>
              )}
              {formData.questionType === "multiple_choice" && (
                <p>Multiple choice questions provide options to choose from, testing recognition.</p>
              )}
              {formData.questionType === "essay" && (
                <p>Essay style questions test deeper understanding and application of knowledge.</p>
              )}
              {formData.questionType === "acronym" && (
                <p>Acronym questions help memorize lists or sequences using memorable letter patterns.</p>
              )}
            </div>
          </div>
        );
        
      case 7: // Confirmation and Generated Cards
        return renderConfirmation();
        
      default:
        return <div>Unknown step</div>;
    }
  };

  // Function to regenerate topics
  const handleRegenerateTopics = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Clear existing topics
      setAvailableTopics([]);
      
      const topics = await generateTopics(
        formData.examBoard,
        formData.examType,
        formData.subject || formData.newSubject
      );
      
      setAvailableTopics(topics);
      setHierarchicalTopics(topics.map(topic => ({ topic })));
      setTopicListSaved(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Updated function to render topic selection UI
  const renderTopicSelectionUI = () => {
    return (
      <div className="topic-selection-container">
        <button
          className="generate-topics-button"
          onClick={handleGenerateTopics}
          disabled={isGenerating || !(formData.subject || formData.newSubject)}
        >
          {isGenerating ? "Generating..." : "Generate Topics"}
        </button>
        
        {formData.topic && (
          <div className="selected-topic">
            <span>Selected Topic: <strong>{formData.topic}</strong></span>
            <button 
              className="change-topic-btn"
              onClick={() => setFormData(prev => ({ ...prev, topic: '' }))}
            >
              Change
            </button>
          </div>
        )}
        
        <div className="topic-input-section">
          <label>Or Enter a New Topic:</label>
          <input
            type="text"
            name="newTopic"
            value={formData.newTopic}
            onChange={handleChange}
            placeholder="Enter a specific topic"
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  };

  // Effect to update the progress based on steps completed
  useEffect(() => {
    // Update progress steps completion status
    const newCompletedSteps = {};
    
    // Mark previous steps as completed
    for (let i = 1; i < currentStep; i++) {
      newCompletedSteps[i] = true;
    }
    
    // Check if current step is complete
    newCompletedSteps[currentStep] = canProceed();
    
    setCompletedSteps(newCompletedSteps);
  }, [currentStep, formData]);

  // Step 7: Confirmation Step and Generated Cards
  const renderConfirmation = () => {
    // Ensure subject is displayed as a string
    const subjectValue = formData.newSubject || formData.subject;
    const subjectDisplay = typeof subjectValue === 'object' && subjectValue.name 
      ? subjectValue.name 
      : subjectValue;
    
    return (
      <div className="generator-step review-step">
        <h2>Review and Generate Cards</h2>
        
        <div className="confirmation-details">
          <div className="confirmation-item">
            <span className="label">Exam Type:</span>
            <span className="value">{formData.examType}</span>
          </div>
          
          <div className="confirmation-item">
            <span className="label">Exam Board:</span>
            <span className="value">{formData.examBoard}</span>
          </div>
          
          <div className="confirmation-item">
            <span className="label">Subject:</span>
            <span className="value">{subjectDisplay}</span>
          </div>
          
          <div className="confirmation-item">
            <span className="label">Topic:</span>
            <span className="value">{formData.newTopic || formData.topic}</span>
          </div>
          
          <div className="confirmation-item">
            <span className="label">Number of Cards:</span>
            <span className="value">{formData.numCards}</span>
          </div>
          
          <div className="confirmation-item">
            <span className="label">Question Type:</span>
            <span className="value">
              {QUESTION_TYPES.find(t => t.value === formData.questionType)?.label || formData.questionType}
            </span>
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {isGenerating ? (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Creating {formData.numCards} flashcards for {formData.examBoard} {formData.examType} {subjectDisplay}...</p>
            <p className="loading-subtext">Our AI is analyzing the curriculum and crafting high-quality questions tailored to your specifications.</p>
          </div>
        ) : generatedCards.length > 0 ? (
          <>
            <div className="generated-cards-actions top-actions">
              <button className="secondary-button" onClick={handleRegenerateCards}>
                <span className="button-icon">🔄</span> Regenerate Cards
              </button>
            </div>
            
            <div className="generated-cards-container">
              {generatedCards.map(card => (
                <div 
                  key={card.id} 
                  className="generated-card" 
                  style={{ 
                    backgroundColor: card.cardColor,
                    color: getContrastColor(card.cardColor)
                  }}
                >
                  <div className="card-header">
                    {card.questionType === "multiple_choice" ? "Multiple Choice" : 
                     card.questionType === "short_answer" ? "Short Answer" : 
                     card.questionType === "essay" ? "Essay" : "Acronym"}
                    
                    <button 
                      className="add-card-btn" 
                      onClick={() => handleAddCard(card)}
                      disabled={card.added}
                    >
                      {card.added ? "Added ✓" : "Add to Bank"}
                    </button>
                  </div>
                  
                  <Flashcard 
                    card={card}
                    preview={true}
                    style={{
                      height: '200px',
                      width: '100%',
                      margin: '0',
                      boxShadow: 'none'
                    }}
                    showButtons={false}
                  />
                </div>
              ))}
            </div>
            
            <div className="generated-cards-actions bottom-actions">
              <button 
                className="primary-button add-all-button" 
                onClick={handleAddAllCards}
                disabled={generatedCards.every(card => card.added)}
              >
                <span className="button-icon">💾</span> Add All Cards to Bank
              </button>
              <p className="status-text">
                {generatedCards.filter(card => card.added).length} of {generatedCards.length} cards added
              </p>
            </div>
          </>
        ) : (
          <div className="confirmation-actions">
            <button 
              className="generate-button"
              onClick={generateCards}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Cards"}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Function to handle topic click in the modal
  const handleTopicClick = (topic) => {
    setSelectedTopicForConfirmation(topic);
    setShowTopicConfirmation(true);
  };
  
  // Function to confirm topic selection
  const confirmTopicSelection = () => {
    setFormData(prev => ({ ...prev, topic: selectedTopicForConfirmation, newTopic: '' }));
    setShowTopicConfirmation(false);
    setShowTopicModal(false);
    // No longer auto-advancing to next step - wait for user to click Next
    console.log(`Selected topic: ${selectedTopicForConfirmation}`);
  };

  // Render topic confirmation dialog
  const renderTopicConfirmation = () => {
    if (!showTopicConfirmation) return null;
    
    return (
      <div className="topic-confirmation-overlay">
        <div className="topic-confirmation-dialog">
          <h4>Confirm Topic Selection</h4>
          <div className="selected-topic-preview">
            {selectedTopicForConfirmation}
          </div>
          <p>Would you like to select this topic?</p>
          
          <div className="confirmation-actions">
            <button 
              className="secondary-button" 
              onClick={() => setShowTopicConfirmation(false)}
            >
              Close and choose again
            </button>
            <button 
              className="primary-button" 
              onClick={confirmTopicSelection}
            >
              Select this topic
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render save confirmation dialog
  const renderSaveConfirmation = () => {
    if (!showSaveConfirmation) return null;
    
    return (
      <div className="save-confirmation-overlay">
        <div className="save-confirmation-dialog">
          <h4>Save Topic List?</h4>
          <p>Would you like to save this topic list for future use?</p>
          
          <div className="confirmation-actions">
            <button 
              className="secondary-button" 
              onClick={() => {
                setShowSaveConfirmation(false);
                setShowTopicModal(false);
                handleNextStep();
              }}
            >
              No, Skip
            </button>
            <button 
              className="primary-button" 
              onClick={() => {
                setShowSaveConfirmation(false);
                setShowSaveTopicDialog(true);
              }}
            >
              Yes, Save It
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add consistent sizing to the exam selection part of the modal
  const examSelectorStyle = {
    fontSize: '14px',
    padding: '8px 12px',
    width: '100%',
    maxWidth: '300px',
    margin: '0 auto 20px',
    display: 'block'
  };

  const formLabelStyle = {
    fontSize: '14px',
    marginBottom: '5px',
    fontWeight: 'normal',
    display: 'block'
  };

  // If we have initial values, skip to the appropriate step
  useEffect(() => {
    if (initialSubject && initialTopic) {
      // Skip to question type selection (step 5)
      setCurrentStep(5);
    } else if (initialSubject) {
      // Skip to topic selection (step 4)
      setCurrentStep(4);
    }
  }, [initialSubject, initialTopic]);

  // New function to render topic selection modal
  const renderTopicModal = () => {
    if (!showTopicModal) return null;
    
    return (
      <div className="topic-modal-overlay" onClick={() => setShowTopicModal(false)}>
        <div className="topic-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="topic-modal-header">
            <h3>Topics for {formData.subject || formData.newSubject}</h3>
            <button className="close-modal-button" onClick={() => setShowTopicModal(false)}>×</button>
          </div>
          
          <div className="topic-modal-body">
            {isGenerating ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Generating topics for {formData.subject || formData.newSubject}...</p>
                <p className="loading-subtext">This may take a moment as we analyze the curriculum and create relevant topics.</p>
              </div>
            ) : (
              <>
                {availableTopics.length > 0 ? (
                  <>
                    <div className="topics-header-actions">
                      <h4>Available Topics for {formData.examBoard} {formData.examType}</h4>
                      <button 
                        className="regenerate-topics-button"
                        onClick={handleRegenerateTopics}
                        disabled={isGenerating}
                      >
                        Regenerate Topics
                      </button>
                    </div>
                    <div className="topic-list-container">
                      {availableTopics.map((topic) => (
                        <div 
                          key={topic} 
                          className={`topic-item ${selectedTopicForConfirmation === topic ? 'selected' : ''}`}
                          onClick={() => handleTopicClick(topic)}
                        >
                          {topic}
                        </div>
                      ))}
                    </div>
                    
                    {!topicListSaved && (
                      <div className="save-notice">
                        <span role="img" aria-label="Info">ℹ️</span> These topics haven't been saved yet. Click "Save Topic List" to save them for future use.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-topics-message">
                    <p>No topics available for {formData.subject || formData.newSubject} ({formData.examBoard} {formData.examType}) yet.</p>
                    <p>Click the "Regenerate Topics" button to create topics for this subject.</p>
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="topic-modal-actions">
            {availableTopics.length > 0 && !topicListSaved && (
              <button 
                className="save-button"
                onClick={() => setShowSaveTopicDialog(true)}
                disabled={isGenerating}
              >
                Save Topic List
              </button>
            )}
            
            <button 
              className="generate-topics-button"
              onClick={handleRegenerateTopics}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : availableTopics.length === 0 ? "Generate Topics" : "Regenerate Topics"}
            </button>
            
            <button 
              className="close-button"
              onClick={() => setShowTopicModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ai-card-generator">
      <div className="generator-header">
        <h1>AI Flashcard Generator</h1>
        <button className="close-button" onClick={onClose}>&times;</button>
      </div>
      
      {/* Render the topic modal */}
      {renderTopicModal()}
      
      {/* Render the save topic dialog */}
      {renderSaveTopicDialog()}
      
      <div className="progress-bar">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div 
            key={idx} 
            className={`progress-step ${idx + 1 === currentStep ? 'active' : ''} ${idx + 1 < currentStep ? 'completed' : ''}`}
          >
            {idx + 1}
          </div>
        ))}
      </div>
      
      <div className="generator-content">
        {/* Render saved topic lists before the step content if on step 1 */}
        {currentStep === 1 && renderSavedTopicLists()}
        
        {renderStepContent()}
      </div>
      
      <div className="generator-controls">
        {currentStep > 1 && (
          <button 
            onClick={handlePrevStep} 
            className="back-button"
            disabled={isGenerating}
          >
            Back
          </button>
        )}
        
        {currentStep < totalSteps ? (
          <button 
            onClick={handleNextStep} 
            className="next-button"
            disabled={!canProceed() || isGenerating}
          >
            Next
          </button>
        ) : (
          <button 
            onClick={onClose} 
            className="finish-button"
          >
            Finish
          </button>
        )}
      </div>
      
      {renderSuccessModal()}
      
      {/* Render save confirmation dialog */}
      {renderSaveConfirmation()}
      
      {/* Render topic selection confirmation dialog */}
      {renderTopicConfirmation()}
    </div>
  );
};

export default AICardGenerator;
