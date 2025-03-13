import React, { useState, useEffect, useMemo } from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import ReactDOM from 'react-dom';
import "./FlashcardList.css";

const FlashcardList = ({ cards, onDeleteCard, onUpdateCard }) => {
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [showCardModal, setShowCardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [currentCards, setCurrentCards] = useState([]);
  const [showModalAndSelectedCard, setShowModalAndSelectedCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  // Group cards by topic
  const groupedCards = useMemo(() => {
    const groups = {};
    
    cards.forEach(card => {
      const topic = card.topic || "General";
      if (!groups[topic]) {
        groups[topic] = [];
      }
      groups[topic].push(card);
    });

    // Convert to an array of topics and sort them
    const topics = Object.keys(groups).sort();

    return { topics, cardsByTopic: groups };
  }, [cards]);
  
  // Reset topic selection when cards change
  useEffect(() => {
    setSelectedTopicIndex(0);
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

  // Get selected topic and its cards
  const selectedTopic = groupedCards.topics[selectedTopicIndex] || "General";
  const selectedTopicCards = groupedCards.cardsByTopic[selectedTopic] || [];

  // Function to open the card modal at a specific index
  const openCardModal = (index) => {
    setCurrentCardIndex(index);
    setShowCardModal(true);
  };

  // Navigation functions for modal
  const goToPrevCard = () => {
    setCurrentCardIndex((prevIndex) => 
      prevIndex > 0 ? prevIndex - 1 : selectedTopicCards.length - 1
    );
  };

  const goToNextCard = () => {
    setCurrentCardIndex((prevIndex) => 
      prevIndex < selectedTopicCards.length - 1 ? prevIndex + 1 : 0
    );
  };

  // Helper to close the modal
  const closeCardModal = () => {
    setShowCardModal(false);
  };

  // Determine if this is a single subject view based on the groupedCards
  const isSingleSubjectView = groupedCards.topics.length === 1;

  // Debug output
  console.log("FlashcardList render:", {
    cardsCount: cards.length,
    topicsCount: groupedCards.topics.length,
    selectedTopic,
    cardsInSelectedTopic: selectedTopicCards.length,
    isSingleSubjectView
  });

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
    // Using a lower threshold to ensure more text is white on dark backgrounds
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
        const cards = Object.values(groupedCards.cardsByTopic[subject]).flat();
        if (cards.length > 0) {
          const firstCard = cards[0];
          
          // Enhanced debugging: Log complete card structure for analysis
          console.log(`DETAILED CARD DATA FOR "${subject}":`, JSON.stringify(firstCard, null, 2));
          
          // Try to get values directly from the card properties
          console.log(`Checking fields directly on card:`, {
            examType: firstCard.examType,
            courseType: firstCard.courseType,
            type: firstCard.type,
            examBoard: firstCard.examBoard,
            board: firstCard.board
          });
          
          if (!examType && firstCard.examType) {
            examType = firstCard.examType;
            console.log(`Found examType directly on card: ${examType}`);
          } else if (!examType && firstCard.courseType) {
            examType = firstCard.courseType;
            console.log(`Found courseType directly on card: ${examType}`);
          } else if (!examType && firstCard.type) {
            examType = firstCard.type;
            console.log(`Found type directly on card: ${examType}`);
          }
          
          if (!examBoard && firstCard.examBoard) {
            examBoard = firstCard.examBoard;
            console.log(`Found examBoard directly on card: ${examBoard}`);
          } else if (!examBoard && firstCard.board) {
            examBoard = firstCard.board;
            console.log(`Found board directly on card: ${examBoard}`);
          }
          
          // If we still don't have values, check meta properties if they exist
          if ((!examType || !examBoard) && firstCard.meta) {
            console.log(`Checking meta data for ${subject}:`, firstCard.meta);
            if (!examType && firstCard.meta.examType) {
              examType = firstCard.meta.examType;
              console.log(`Found examType in meta: ${examType}`);
            } else if (!examType && firstCard.meta.courseType) {
              examType = firstCard.meta.courseType;
              console.log(`Found courseType in meta: ${examType}`);
            }
            
            if (!examBoard && firstCard.meta.examBoard) {
              examBoard = firstCard.meta.examBoard;
              console.log(`Found examBoard in meta: ${examBoard}`);
            } else if (!examBoard && firstCard.meta.board) {
              examBoard = firstCard.meta.board;
              console.log(`Found board in meta: ${examBoard}`);
            }
          }
        }
      }
      
      // Set fallback values to ensure metadata displays something
      if (!examType) examType = "Course";
      if (!examBoard) examBoard = "General";
      
      console.log(`FINAL EXTRACTED FOR "${subject}": Type=${examType}, Board=${examBoard}`);
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
    openPrintModal(cards, "All Flashcards");
  };

  // Print subject cards
  const handlePrintSubject = (subject, e) => {
    e.stopPropagation(); // Prevent toggling the subject expansion
    const subjectCards = Object.values(groupedCards.cardsByTopic[subject]).flat();
    openPrintModal(subjectCards, subject);
  };

  // Print topic cards
  const handlePrintTopic = (subject, topic, e) => {
    e.stopPropagation(); // Prevent toggling the topic expansion
    openPrintModal(groupedCards.cardsByTopic[subject][topic], `${subject} - ${topic}`);
  };

  const handleCardClick = (card) => {
    setSelectedCard(card);
    setShowModalAndSelectedCard(true);
  };

  const renderCards = (cards, topicKey = null, isVisibleTopic = true) => {
    if (showModalAndSelectedCard) return null; // Don't render cards normally if modal is shown

    return (
      <div className="topic-cards" style={{ display: isVisibleTopic ? 'flex' : 'none' }}>
        {cards && cards.length > 0 ? (
          cards.map((card) => (
            <Flashcard
              key={card.id}
              card={card}
              onDelete={() => onDeleteCard(card.id)}
              onFlip={(card, isFlipped) => console.log(`Card flipped: ${isFlipped}`)}
              onUpdateCard={onUpdateCard}
              onClick={(e) => handleCardClick(card)}
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

    const currentCards = cards.filter(card => 
      card.topic === selectedCard.topic
    );

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

  return (
    <div className={`flashcard-list ${isSingleSubjectView ? 'flashcard-list-single-subject' : ''}`}>
      {printModalOpen && (
        <PrintModal 
          cards={cardsToPrint} 
          title={printTitle} 
          onClose={() => setPrintModalOpen(false)} 
        />
      )}
      
      {/* Topic tabs */}
      <div className="topics-tabs">
        {groupedCards.topics.map((topic, index) => (
          <button
            key={topic}
            className={`topic-tab ${index === selectedTopicIndex ? "active" : ""}`}
            onClick={() => setSelectedTopicIndex(index)}
          >
            {topic} ({groupedCards.cardsByTopic[topic].length})
          </button>
        ))}
      </div>

      {renderCards(selectedTopicCards, selectedTopic)}

      {showModalAndSelectedCard && renderModal()}
    </div>
  );
};

export default FlashcardList;
