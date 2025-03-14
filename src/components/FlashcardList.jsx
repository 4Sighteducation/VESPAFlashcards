import React, { useState, useEffect, useMemo } from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import ReactDOM from 'react-dom';
import "./FlashcardList.css";
import { FaLayerGroup, FaUniversity, FaGraduationCap, FaPrint, FaPlay, FaAngleUp, FaAngleDown } from 'react-icons/fa';

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
    // Initialize all subjects as collapsed by default (changed from auto-expanding the first one)
    setExpandedSubjects({});
    setExpandedTopics({});
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
  
  // Function to get the earliest creation date for a subject (based on its first topic)
  const getSubjectDate = (subject) => {
    const topics = Object.keys(groupedCards[subject]);
    if (topics.length === 0) return 0;
    
    const topicDates = topics.map(topic => {
      const cardsInTopic = groupedCards[subject][topic];
      const dates = cardsInTopic
        .filter(card => card.timestamp)
        .map(card => new Date(card.timestamp).getTime());
      
      return dates.length > 0 ? Math.min(...dates) : Number.MAX_SAFE_INTEGER;
    });
    
    return Math.min(...topicDates);
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

  // Modified function to start slideshow for a subject or topic
  const startSlideshow = (subject, topic, e) => {
    if (e) e.stopPropagation(); // Prevent toggling the expansion

    let slideshowCards = [];
    
    if (topic) {
      // Topic-level slideshow: Use cards from this specific topic
      slideshowCards = groupedCards[subject][topic];
    } else {
      // Subject-level slideshow: Flatten all cards from all topics in this subject
      const allTopics = Object.keys(groupedCards[subject] || {});
      slideshowCards = allTopics.reduce((allCards, currentTopic) => {
        return allCards.concat(groupedCards[subject][currentTopic] || []);
      }, []);
    }
    
    // Start slideshow if we have cards
    if (slideshowCards && slideshowCards.length > 0) {
      setSelectedCard(slideshowCards[0]);
      setShowModalAndSelectedCard(true);
    }
  };

  const renderCards = (cards, subject, topic, subjectColor) => {
    const topicKey = `${subject}-${topic}`;
    const isVisible = expandedTopics[topicKey];

    // Function to create a slightly lighter version of the subject color for cards
    const getCardColor = (baseColor) => {
      if (!baseColor) return '#3cb44b'; // Default card color
      
      // Create a slightly lighter version (30% lighter)
      const lightenColor = (color, percent) => {
        // Remove the # if present
        let hex = color.replace('#', '');
        
        // Convert to RGB
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        
        // Lighten
        r = Math.min(255, Math.floor(r + (255 - r) * percent));
        g = Math.min(255, Math.floor(g + (255 - g) * percent));
        b = Math.min(255, Math.floor(b + (255 - b) * percent));
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      };
      
      return lightenColor(baseColor, 0.3); // 30% lighter version
    };

    return (
      <div className="topic-cards" style={{ display: isVisible ? 'flex' : 'none' }}>
        {cards && cards.length > 0 ? (
          cards.map((card) => {
            // Apply the topic's color to cards without a specific color
            const cardWithColor = {
              ...card,
              cardColor: card.cardColor || card.baseColor || getCardColor(subjectColor)
            };
            
            return (
              <Flashcard
                key={card.id}
                card={cardWithColor}
                onDelete={() => onDeleteCard(card.id)}
                onFlip={(card, isFlipped) => console.log(`Card flipped: ${isFlipped}`)}
                onUpdateCard={onUpdateCard}
              />
            );
          })
        ) : (
          <div className="no-cards-message">No cards in this topic</div>
        )}
      </div>
    );
  };

  // Modal view for slideshow
  const renderModal = () => {
    if (!showModalAndSelectedCard || !selectedCard) return null;

    // Get current subject and topic
    const currentSubject = selectedCard.subject || "General";
    const currentTopic = selectedCard.topic || "General";
    
    // Get all cards for the current subject+topic or just all cards in the subject
    let currentCards = [];
    
    // Check if we're viewing all cards from a subject (we determine this by checking if the
    // next and previous cards have different topics when navigating in the slideshow)
    const isSubjectSlideshow = groupedCards[currentSubject] && 
      Object.keys(groupedCards[currentSubject]).length > 1;
      
    if (isSubjectSlideshow) {
      // Flatten all topics in the subject into a single array
      const allTopics = Object.keys(groupedCards[currentSubject] || {});
      currentCards = allTopics.reduce((allCards, topic) => {
        return allCards.concat(groupedCards[currentSubject][topic] || []);
      }, []);
    } else {
      // Just use cards from the specific topic
      currentCards = groupedCards[currentSubject]?.[currentTopic] || [];
    }

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

    // Topic display in navigation
    const topicInfo = isSubjectSlideshow 
      ? `${currentSubject} (All Topics)` 
      : `${currentSubject} | ${currentTopic}`;
      
    // Detect if we're on mobile
    const isMobile = window.innerWidth <= 768;

    return (
      <div className="card-modal-overlay" onClick={() => setShowModalAndSelectedCard(false)}>
        <div className="card-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-modal-button" onClick={() => setShowModalAndSelectedCard(false)}>✕</button>
          
          <div className="card-modal-card-container">
            <Flashcard 
              card={selectedCard} 
              onDelete={() => onDeleteCard(selectedCard.id)}
              onFlip={(card, isFlipped) => console.log(`Card flipped: ${isFlipped}`)}
              onUpdateCard={onUpdateCard}
              isInModal={true}
              showButtons={true}
            />
          </div>
          
          <div className="card-modal-actions">
            <div className="nav-buttons">
              <button 
                onClick={handlePrevCard} 
                disabled={currentIndex === 0}
                className="nav-button prev"
              >
                Previous
              </button>
              <button 
                onClick={handleNextCard} 
                disabled={currentIndex >= totalCards - 1}
                className="nav-button next"
              >
                Next
              </button>
            </div>
            <div className="card-info">
              <div className="card-counter">
                {currentIndex + 1} of {totalCards}
              </div>
              <div className="topic-info">{topicInfo}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSubjectHeader = (subject) => {
    const { id, title, cards, exam_board, exam_type, color } = subject;
    const totalCards = cards.flat().length;
    
    return (
      <div 
        className="subject-header" 
        onClick={() => toggleSubject(id)}
        style={{ backgroundColor: color }}
      >
        <div className="subject-info">
          <h2>{title}</h2>
          <div className="subject-meta">
            <span>
              <FaLayerGroup /> {totalCards} {totalCards === 1 ? 'card' : 'cards'}
            </span>
            {exam_board && exam_board !== 'default' && (
              <span>
                <FaUniversity /> {exam_board}
              </span>
            )}
            {exam_type && exam_type !== 'default' && (
              <span>
                <FaGraduationCap /> {exam_type}
              </span>
            )}
          </div>
        </div>
        
        <div className="subject-actions">
          <button 
            title="Print all cards" 
            onClick={(e) => { e.stopPropagation(); handlePrintSubject(id, e); }}
            style={{ color: getContrastColor(color) }}
          >
            <FaPrint />
          </button>
          <button 
            title="Slideshow" 
            onClick={(e) => { e.stopPropagation(); startSlideshow(id); }}
            style={{ color: getContrastColor(color) }}
          >
            <FaPlay />
          </button>
          <span style={{ color: getContrastColor(color) }}>
            {expandedSubjects[id] ? <FaAngleUp /> : <FaAngleDown />}
          </span>
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
        {Object.keys(groupedCards)
          // Sort subjects by the date of their earliest topic
          .sort((a, b) => getSubjectDate(a) - getSubjectDate(b))
          .map((subject) => {
          const topics = Object.keys(groupedCards[subject])
            // Sort topics by their earliest date
            .sort((a, b) => {
              const aCards = groupedCards[subject][a];
              const bCards = groupedCards[subject][b];
              
              const aDate = aCards.filter(card => card.timestamp)
                .map(card => new Date(card.timestamp).getTime());
              const bDate = bCards.filter(card => card.timestamp)
                .map(card => new Date(card.timestamp).getTime());
              
              const aMin = aDate.length > 0 ? Math.min(...aDate) : Number.MAX_SAFE_INTEGER;
              const bMin = bDate.length > 0 ? Math.min(...bDate) : Number.MAX_SAFE_INTEGER;
              
              return aMin - bMin;
            });
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
              data-color={subjectColor}
              style={{ 
                '--subject-color': subjectColor 
              }}
            >
              {renderSubjectHeader({ 
                id: subject, 
                title: subject, 
                cards: topics.map(topic => groupedCards[subject][topic]), 
                exam_board: examBoard, 
                exam_type: examType,
                color: subjectColor
              })}
              
              {isExpanded && (
                <div className="topics-container">
                  {topics.map((topic) => {
                    const topicCards = groupedCards[subject][topic];
                    const topicKey = `${subject}-${topic}`;
                    const isTopicExpanded = expandedTopics[topicKey];
                    const topicDate = getTopicDate(topicCards);
                    
                    // Use the first card's color for the topic header
                    const firstCardInTopic = topicCards[0];
                    const topicColor = firstCardInTopic?.cardColor || firstCardInTopic?.baseColor || '#e0e0e0';
                    const topicTextColor = getContrastColor(topicColor);
                    
                    return (
                      <div key={topic} className="topic-group">
                        <div 
                          className="topic-header" 
                          onClick={() => toggleTopic(subject, topic)}
                          style={{ 
                            backgroundColor: topicColor,
                            color: topicTextColor,
                            borderLeft: 'none'
                          }}
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
                        {renderCards(topicCards, subject, topic, subjectColor)}
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
