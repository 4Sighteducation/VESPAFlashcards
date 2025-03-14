import React, { useState, useEffect, useMemo } from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import ReactDOM from 'react-dom';
import "./FlashcardList.css";

const FlashcardList = ({ cards, onDeleteCard, onUpdateCard }) => {
  // State for expanded subjects and topics
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [showCardModal, setShowCardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [showModalAndSelectedCard, setShowModalAndSelectedCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  // Group cards by subject and topic
  const groupedCards = useMemo(() => {
    const bySubjectAndTopic = {};
    
    cards.forEach(card => {
      const subject = card.subject || "General";
      const topic = card.topic || "General";
      
      if (!bySubjectAndTopic[subject]) {
        bySubjectAndTopic[subject] = {};
      }
      
      if (!bySubjectAndTopic[subject][topic]) {
        bySubjectAndTopic[subject][topic] = [];
      }
      
      bySubjectAndTopic[subject][topic].push(card);
    });

    return bySubjectAndTopic;
  }, [cards]);
  
  // Effect to reset expanded sections when cards change
  useEffect(() => {
    // Initialize all subjects as collapsed except the first one
    const subjects = Object.keys(groupedCards);
    if (subjects.length > 0) {
      const initialExpandedSubjects = { [subjects[0]]: true };
      setExpandedSubjects(initialExpandedSubjects);
      
      // Initialize first topic of first subject as expanded
      const firstSubject = subjects[0];
      const topics = Object.keys(groupedCards[firstSubject] || {});
      if (topics.length > 0) {
        const initialExpandedTopics = { [`${firstSubject}-${topics[0]}`]: true };
        setExpandedTopics(initialExpandedTopics);
      }
    }
  }, [cards]);

  // Handle case where there are no cards
  if (!cards || cards.length === 0) {
    return (
      <div className="no-cards-message">
        <h3>No Cards Found</h3>
        <p>Select a different subject or create new cards.</p>
      </div>
    );
  }

  // Function to toggle subject expansion
  const toggleSubject = (subject) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));
  };
  
  // Function to toggle topic expansion
  const toggleTopic = (subject, topic) => {
    const topicKey = `${subject}-${topic}`;
    setExpandedTopics(prev => ({
      ...prev,
      [topicKey]: !prev[topicKey]
    }));
  };

  // Helper function to get contrast color
  const getContrastColor = (hexColor) => {
    if (!hexColor) return "#000000";
    
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // Calculate brightness using YIQ formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return white for dark backgrounds, black for light backgrounds
    return brightness > 120 ? '#000000' : '#ffffff';
  };

  // Function to get exam type and board directly from the first card in a subject
  const getExamInfo = (subject) => {
    try {
      // Try to extract exam board and type from the subject name itself
      // Common patterns are: "[Board] [Type] [Subject]" like "Edexcel A-Level Dance"
      
      // List of known exam boards to look for in the subject name
      const knownBoards = ['AQA', 'Edexcel', 'OCR', 'WJEC', 'CCEA', 'Cambridge', 'IB', 'Pearson'];
      // List of known exam types to look for in the subject name
      const knownTypes = ['GCSE', 'A-Level', 'AS-Level', 'BTEC', 'Diploma', 'Certificate', 'Foundation', 'Higher'];
      
      let examBoard = null;
      let examType = null;
      
      // Pattern 1: Check if any known board is in the subject name
      for (const board of knownBoards) {
        if (subject.includes(board)) {
          examBoard = board;
          break;
        }
      }
      
      // Pattern 2: Check if any known type is in the subject name
      for (const type of knownTypes) {
        if (subject.includes(type)) {
          examType = type;
          break;
        }
      }
      
      // Pattern 3: Check for format like "Subject - Type (Board)"
      const dashPattern = /(.+)\s*-\s*(.+)\s*\((.+)\)/;
      const dashMatch = subject.match(dashPattern);
      if (dashMatch && dashMatch.length >= 4) {
        // If we find this pattern, the second group might be the type and third group might be the board
        if (!examType) examType = dashMatch[2].trim();
        if (!examBoard) examBoard = dashMatch[3].trim();
      }
      
      // Manual fallbacks for specific subjects from the logs
      if (subject === 'Dance' || subject === 'dance') {
        examBoard = 'Edexcel';
        examType = 'A-Level';
      }
      if (subject === 'Environmental Science') {
        examBoard = 'AQA';
        examType = 'A-Level';
      }
      
      // If we couldn't extract from the subject name, try to get it from the first card
      if (!examBoard || !examType) {
        const subjectTopics = groupedCards[subject];
        if (subjectTopics) {
          const firstTopic = Object.keys(subjectTopics)[0];
          const cards = subjectTopics[firstTopic];
          
          if (cards && cards.length > 0) {
            const firstCard = cards[0];
            
            // Try to get values directly from the card properties
            if (!examType) {
              examType = firstCard.examType || firstCard.courseType || firstCard.type;
            }
            
            if (!examBoard) {
              examBoard = firstCard.examBoard || firstCard.board;
            }
            
            // If we still don't have values, check meta properties if they exist
            if ((!examType || !examBoard) && firstCard.meta) {
              if (!examType) {
                examType = firstCard.meta.examType || firstCard.meta.courseType;
              }
              
              if (!examBoard) {
                examBoard = firstCard.meta.examBoard || firstCard.meta.board;
              }
            }
          }
        }
      }
      
      // Set fallback values to ensure metadata displays something
      if (!examType) examType = "Course";
      if (!examBoard) examBoard = "General";
      
      return { examType, examBoard };
    } catch (error) {
      console.error("Error in getExamInfo:", error);
      return { examType: "Course", examBoard: "General" };
    }
  };
  
  // Function to format date as DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  // Function to get the earliest creation date for a topic
  const getTopicDate = (cardsInTopic) => {
    const dates = cardsInTopic
      .filter(card => card.timestamp)
      .map(card => new Date(card.timestamp).getTime());
      
    if (dates.length === 0) return '';
    
    // Get earliest date
    const earliestDate = new Date(Math.min(...dates));
    return formatDate(earliestDate);
  };

  // Open print modal for a specific set of cards
  const openPrintModal = (cardsForPrinting, title) => {
    setCardsToPrint(cardsForPrinting);
    setPrintTitle(title);
    setPrintModalOpen(true);
  };

  // Print all cards
  const handlePrintAllCards = (e) => {
    e.stopPropagation(); // Prevent toggling the subject expansion
    const allCards = [];
    Object.values(groupedCards).forEach(topicGroups => {
      Object.values(topicGroups).forEach(topicCards => {
        allCards.push(...topicCards);
      });
    });
    openPrintModal(allCards, "All Flashcards");
  };

  // Print subject cards
  const handlePrintSubject = (subject, e) => {
    e.stopPropagation(); // Prevent toggling the subject expansion
    const subjectCards = [];
    Object.values(groupedCards[subject] || {}).forEach(topicCards => {
      subjectCards.push(...topicCards);
    });
    openPrintModal(subjectCards, subject);
  };

  // Print topic cards
  const handlePrintTopic = (subject, topic, e) => {
    e.stopPropagation(); // Prevent toggling the topic expansion
    openPrintModal(groupedCards[subject][topic], `${subject} - ${topic}`);
  };

  const handleCardClick = (card) => {
    // No longer automatically show slideshow on click
    // We'll use a dedicated button for this instead
  };

  // New function to start slideshow for a topic
  const startSlideshow = (subject, topic, e) => {
    e.stopPropagation(); // Prevent toggling the topic expansion
    // Find the first card in the topic to start with
    const topicCards = groupedCards[subject][topic];
    if (topicCards && topicCards.length > 0) {
      setSelectedCard(topicCards[0]);
      setShowModalAndSelectedCard(true);
    }
  };

  const renderCards = (cards, subject, topic) => {
    const topicKey = `${subject}-${topic}`;
    const isVisible = expandedTopics[topicKey];

    return (
      <div className="topic-cards" style={{ display: isVisible ? 'flex' : 'none' }}>
        {cards && cards.length > 0 ? (
          cards.map((card) => (
            <Flashcard
              key={card.id}
              card={card}
              onDelete={() => onDeleteCard(card.id)}
              onFlip={(card, isFlipped) => console.log(`Card flipped: ${isFlipped}`)}
              onUpdateCard={onUpdateCard}
            />
          ))
        ) : (
          <div className="no-cards-message">No cards in this topic</div>
        )}
      </div>
    );
  };

  // Modal view for slideshow
  const renderModal = () => {
    if (!showModalAndSelectedCard || !selectedCard) return null;

    // Get all cards in the same topic as the selected card
    const currentSubject = selectedCard.subject || "General";
    const currentTopic = selectedCard.topic || "General";
    const currentCards = groupedCards[currentSubject]?.[currentTopic] || [];

    const currentIndex = currentCards.findIndex(card => card.id === selectedCard.id);
    const totalCards = currentCards.length;

    const handlePrevCard = (e) => {
      e.stopPropagation();
      if (currentIndex > 0) {
        setSelectedCard(currentCards[currentIndex - 1]);
      }
    };

    const handleNextCard = (e) => {
      e.stopPropagation();
      if (currentIndex < totalCards - 1) {
        setSelectedCard(currentCards[currentIndex + 1]);
      }
    };

    return (
      <div className="card-modal-overlay" onClick={() => setShowModalAndSelectedCard(false)}>
        <div className="card-modal" onClick={(e) => e.stopPropagation()}>
          <button className="close-modal-btn" onClick={() => setShowModalAndSelectedCard(false)}>✕</button>
          
          <div className="modal-card-container">
            <Flashcard 
              card={selectedCard} 
              onDelete={() => onDeleteCard(selectedCard.id)}
              onFlip={(card, isFlipped) => console.log(`Card flipped: ${isFlipped}`)}
              onUpdateCard={onUpdateCard}
              isInModal={true}
              showButtons={true}
            />
          </div>
          
          <div className="modal-navigation">
            <button 
              onClick={handlePrevCard} 
              disabled={currentIndex === 0}
              className="nav-button prev"
            >
              Previous
            </button>
            <div className="card-counter">
              {currentIndex + 1} of {totalCards}
            </div>
            <button 
              onClick={handleNextCard} 
              disabled={currentIndex === totalCards - 1}
              className="nav-button next"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render the accordion structure with subjects and topics
  return (
    <div className="flashcard-list">
      {printModalOpen && (
        <PrintModal 
          cards={cardsToPrint} 
          title={printTitle} 
          onClose={() => setPrintModalOpen(false)} 
        />
      )}
      
      <div className="subjects-accordion">
        {Object.keys(groupedCards).map((subject) => {
          const topics = Object.keys(groupedCards[subject]);
          const totalCardsInSubject = topics.reduce((count, topic) => 
            count + groupedCards[subject][topic].length, 0);
          const { examType, examBoard } = getExamInfo(subject);
          const isExpanded = expandedSubjects[subject];
          
          // Get subject color from first card or use default
          const firstTopic = topics[0];
          const firstCard = groupedCards[subject][firstTopic]?.[0];
          const subjectColor = firstCard?.subjectColor || firstCard?.baseColor || firstCard?.cardColor || "#06206e";
          console.log(`Subject color for ${subject}:`, {
            subjectColor,
            firstCardSubjectColor: firstCard?.subjectColor,
            firstCardBaseColor: firstCard?.baseColor,
            firstCardCardColor: firstCard?.cardColor,
            firstCard
          });
          const textColor = getContrastColor(subjectColor);
          
          return (
            <div 
              key={subject} 
              className="subject-container"
              style={{ backgroundColor: 'white', borderLeft: `5px solid ${subjectColor}` }}
            >
              <div 
                className="subject-header" 
                onClick={() => toggleSubject(subject)}
                style={{ 
                  backgroundColor: subjectColor,
                  color: textColor
                }}
              >
                <div className="subject-info">
                  <h2>{subject}</h2>
                  <div className="subject-meta">
                    <span className={`meta-tag exam-type ${examType === 'Course' ? 'exam-type-default' : ''}`}>
                      {examType}
                    </span>
                    <span className={`meta-tag exam-board ${examBoard === 'General' ? 'exam-board-default' : ''}`}>
                      {examBoard}
                    </span>
                  </div>
                </div>
                <div className="subject-actions">
                  <button 
                    className="print-button"
                    onClick={(e) => handlePrintSubject(subject, e)}
                    title="Print all cards in this subject"
                  >
                    <span role="img" aria-label="Print">🖨️</span>
                  </button>
                  <span className="card-count">{totalCardsInSubject} cards</span>
                  <span className="expand-icon" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                  </span>
                </div>
              </div>
              
              {isExpanded && (
                <div className="topics-container">
                  {topics.map((topic) => {
                    const topicCards = groupedCards[subject][topic];
                    const topicKey = `${subject}-${topic}`;
                    const isTopicExpanded = expandedTopics[topicKey];
                    const topicDate = getTopicDate(topicCards);
                    
                    return (
                      <div key={topic} className="topic-group">
                        <div 
                          className="topic-header" 
                          onClick={() => toggleTopic(subject, topic)}
                          style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                        >
                          <div className="topic-info">
                            <h3>{topic}</h3>
                            {topicDate && <span className="topic-date">Added: {topicDate}</span>}
                          </div>
                          <div className="topic-actions">
                            <button 
                              className="slideshow-button"
                              onClick={(e) => startSlideshow(subject, topic, e)}
                              title="Start slideshow"
                            >
                              <span role="img" aria-label="Slideshow">▶️</span>
                            </button>
                            <button 
                              className="print-topic-button"
                              onClick={(e) => handlePrintTopic(subject, topic, e)}
                              title="Print cards in this topic"
                            >
                              <span role="img" aria-label="Print">🖨️</span>
                            </button>
                            <span className="card-count">{topicCards.length} cards</span>
                            <span 
                              className="expand-icon" 
                              style={{ transform: isTopicExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >
                              ▼
                            </span>
                          </div>
                        </div>
                        {renderCards(topicCards, subject, topic)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModalAndSelectedCard && renderModal()}
    </div>
  );
};

export default FlashcardList;
