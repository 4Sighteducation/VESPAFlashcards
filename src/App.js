import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import FlashcardList from "./components/FlashcardList";
import SubjectsList from "./components/SubjectsList";
import TopicsList from "./components/TopicsList";
import CardCreator from "./components/CardCreator";
import SpacedRepetition from "./components/SpacedRepetition";
import LoadingSpinner from "./components/LoadingSpinner";
import Header from "./components/Header";
import UserProfile from "./components/UserProfile";
import AICardGenerator from './components/AICardGenerator';
import PrintModal from './components/PrintModal';
import { getContrastColor, formatDate, calculateNextReviewDate, isCardDueForReview } from './helper';
import TopicListModal from './components/TopicListModal';
import SubjectSelectionWizard from './components/SubjectSelectionWizard';
import TopicGenerationModal from './components/TopicGenerationModal';
import { generateTopicPrompt } from './prompts/topicListPrompt';
import HighPriorityTopicsModal from './components/HighPriorityTopicsModal';
import StandaloneTopicGenerator from './StandaloneTopicGenerator';

function App() {
  // All the state setup from the original App.js
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState([]);
  const [currentCards, setCurrentCards] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicListExamBoard, setTopicListExamBoard] = useState("AQA");
  const [topicListExamType, setTopicListExamType] = useState("A-Level");
  const [subjectColorMapping, setSubjectColorMapping] = useState({});
  const [userTopics, setUserTopics] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [showAICardGenerator, setShowAICardGenerator] = useState(false);
  const [topicListModalOpen, setTopicListModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [view, setView] = useState("cardBank");
  const [recordId, setRecordId] = useState("");

  // Fix 1: Add getUniqueSubjects function at the top level
  const getUniqueSubjects = useCallback(() => {
    const subjects = [...new Set(allCards.map((card) => card.subject || "General"))];
    return subjects.sort();
  }, [allCards]);

  // Fix 2: Add handleSubjectClick function at the top level
  const handleSubjectClick = useCallback((subject) => {
    setSelectedSubject(subject);
    setSelectedTopic(null);
    
    const filteredCards = allCards.filter(card => 
      (card.subject || "General") === subject
    );
    
    setCurrentCards(filteredCards);
  }, [allCards]);

  // Fix 3: Add handleTopicClick function at the top level
  const handleTopicClick = useCallback((topic) => {
    setSelectedTopic(topic);
    
    const filteredCards = allCards.filter(card => 
      (card.subject || "General") === selectedSubject && 
      (card.topic || "General") === topic
    );
    
    setCurrentCards(filteredCards);
  }, [allCards, selectedSubject]);

  // Simple status helper
  const showStatus = useCallback((message, duration = 3000) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(""), duration);
  }, []);

  // Simple save data function
  const saveData = useCallback(() => {
    // Simplified version - you can add back the full implementation later
    console.log("Saving data...");
    showStatus("Saving your flashcards...");
  }, [showStatus]);

  // App's return statement
  return (
    <div className="app">
      <Header />
      
      {/* Main content based on current view */}
      {view === "cardBank" && (
        <div className="main-content">
          <div className="sidebar">
            <SubjectsList
              subjects={getUniqueSubjects()}
              selectedSubject={selectedSubject}
              onSubjectClick={handleSubjectClick}
              subjectColorMapping={subjectColorMapping}
              onUpdateColor={() => {}} // Placeholder
              onRefreshColors={() => {}} // Placeholder
            />
            <TopicsList
              subject={selectedSubject}
              topics={selectedSubject ? [...new Set(allCards.filter(card => card.subject === selectedSubject).map(card => card.topic || "General"))] : []}
              selectedTopic={selectedTopic}
              onTopicClick={handleTopicClick}
              subjectColorMapping={subjectColorMapping}
              onUpdateColor={() => {}} // Placeholder
            />
          </div>
          <FlashcardList
            flashcards={currentCards}
          />
        </div>
      )}
      {view === "createCard" && <CardCreator />}
      {view === "spacedRepetition" && <SpacedRepetition />}
      
      {/* StandaloneTopicGenerator - THIS IS THE KEY ADDITION */}
      <StandaloneTopicGenerator 
        topicListExamBoard={topicListExamBoard}
        topicListExamType={topicListExamType}
        setUserTopics={setUserTopics}
        allCards={allCards}
        setAllCards={setAllCards}
        saveData={saveData}
        showStatus={showStatus}
        auth={auth}
        setAuth={setAuth}
      />
      
      {/* Modals */}
      {topicListModalOpen && <TopicListModal />}
      {showAICardGenerator && <AICardGenerator />}
      {printModalOpen && <PrintModal />}
      {loading && <LoadingSpinner />}
      {statusMessage && <div className="status-message">{statusMessage}</div>}
    </div>
  );
}

export default App;
