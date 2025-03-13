import React, { useState, useEffect } from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import "./FlashcardList.css";

const FlashcardList = ({ cards, onDeleteCard, onUpdateCard }) => {
  // State to track expanded topics
  const [expandedTopics, setExpandedTopics] = useState({});
  // State for print modal
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  
  // Group cards by subject and topic
  const groupedCards = cards.reduce((acc, card) => {
    const subject = card.subject || "General";
    const topic = card.topic || "General";

    if (!acc[subject]) {
      acc[subject] = {};
    }

    if (!acc[subject][topic]) {
      acc[subject][topic] = [];
    }

    acc[subject][topic].push(card);
    return acc;
  }, {});
  
  // Initialize expanded state when cards change
  useEffect(() => {
    const initialExpandedState = {};
    Object.keys(groupedCards).forEach(subject => {
      initialExpandedState[subject] = false;
      Object.keys(groupedCards[subject]).forEach(topic => {
        initialExpandedState[`${subject}-${topic}`] = false;
      });
    });
    setExpandedTopics(initialExpandedState);
  }, [cards]);
  
  // Toggle expansion of a subject or topic
  const toggleExpand = (key) => {
    setExpandedTopics(prev => ({
      ...prev,
      [key]: !prev[key]
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
        const cards = Object.values(groupedCards[subject]).flat();
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
    const subjectCards = Object.values(groupedCards[subject]).flat();
    openPrintModal(subjectCards, subject);
  };

  // Print topic cards
  const handlePrintTopic = (subject, topic, e) => {
    e.stopPropagation(); // Prevent toggling the topic expansion
    openPrintModal(groupedCards[subject][topic], `${subject} - ${topic}`);
  };

  // If no cards, show empty state
  if (cards.length === 0) {
    return (
      <div className="empty-card-bank">
        <h3>No Flashcards Found</h3>
        <p>Create new cards or adjust your filters to see cards here.</p>
      </div>
    );
  }

  return (
    <div className={`flashcard-list ${Object.keys(groupedCards).length === 1 ? 'flashcard-list-single-subject' : ''}`}>
      {printModalOpen && (
        <PrintModal 
          cards={cardsToPrint} 
          title={printTitle} 
          onClose={() => setPrintModalOpen(false)} 
        />
      )}
      
      {Object.keys(groupedCards).map((subject) => {
        // Get subject color for styling
        const subjectCards = Object.values(groupedCards[subject]).flat();
        const subjectColor = subjectCards[0]?.baseColor || subjectCards[0]?.cardColor || '#e0e0e0';
        const { examType, examBoard } = getExamInfo(subject);
        const textColor = getContrastColor(subjectColor);
        
        // Debug logging
        console.log(`Rendering ${subject} with type=${examType}, board=${examBoard}`);
        
        return (
          <div key={subject} className="subject-container">
            <div 
              className="subject-header"
              style={{ 
                boxShadow: `0 0 8px ${subjectColor}`,
                borderBottom: `1px solid ${subjectColor}`,
                color: textColor,
                backgroundColor: subjectColor,
                position: 'relative'
              }}
            >
              <div className="subject-content" onClick={() => toggleExpand(subject)}>
                <div className="subject-info">
                  <h2>{subject}</h2>
                  <div className="subject-meta">
                    {examType && <span className="meta-tag exam-type">{examType}</span>}
                    {examBoard && <span className="meta-tag exam-board">{examBoard}</span>}
                  </div>
                </div>
                <span className="card-count">
                  ({Object.values(groupedCards[subject]).flat().length} cards)
                </span>
              </div>
              <button 
                className="print-btn" 
                onClick={(e) => handlePrintSubject(subject, e)}
                style={{ color: textColor }}
              >
                <span className="print-icon">🖨️</span>
              </button>
            </div>

            {expandedTopics[subject] && Object.keys(groupedCards[subject]).map((topic) => {
              // Get the first card's color for the topic
              const topicColor = groupedCards[subject][topic][0]?.cardColor || '#e0e0e0';
              const textColor = getContrastColor(topicColor);
              const topicDate = getTopicDate(groupedCards[subject][topic]);
              
              return (
                <div key={`${subject}-${topic}`} className="topic-group">
                  <div 
                    className="topic-header"
                    style={{ 
                      backgroundColor: topicColor,
                      color: textColor 
                    }}
                  >
                    <div className="topic-content" onClick={() => toggleExpand(`${subject}-${topic}`)}>
                      <div className="topic-info">
                        <h3>{topic}</h3>
                        {topicDate && <span className="topic-date">Created: {topicDate}</span>}
                      </div>
                      <span className="card-count">
                        ({groupedCards[subject][topic].length} cards)
                      </span>
                    </div>
                    <button 
                      className="print-btn" 
                      onClick={(e) => handlePrintTopic(subject, topic, e)}
                      style={{ color: textColor }}
                    >
                      <span className="print-icon">🖨️</span>
                    </button>
                  </div>

                  {expandedTopics[`${subject}-${topic}`] && (
                    <div className="topic-cards expanded-topic">
                      {groupedCards[subject][topic].map((card) => (
                        <Flashcard
                          key={card.id}
                          card={card}
                          onDelete={() => onDeleteCard(card.id)}
                          onUpdateCard={(updatedCard) => onUpdateCard(updatedCard)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default FlashcardList;
