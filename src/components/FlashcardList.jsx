import React, { useState, useEffect, useMemo, useRef } from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import ReactDOM from 'react-dom';
import "./FlashcardList.css";
import { FaLayerGroup, FaUniversity, FaGraduationCap, FaPrint, FaPlay, FaAngleUp, FaAngleDown, FaPalette, FaBars, FaTimes, FaBolt } from 'react-icons/fa';
import ColorEditor from "./ColorEditor";
import { getContrastColor } from '../helper';
import AICardGenerator from "./AICardGenerator";

// ScrollManager component to handle scrolling to elements
const ScrollManager = ({ expandedSubjects, expandedTopics, subjectRefs, topicRefs }) => {
  // Track if the component is mounted
  const isMounted = useRef(true);
  
  // Effect to handle scrolling when subjects or topics expand
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Function to scroll to an element
  const scrollToElement = (element, offset = 0) => {
    if (!element || !isMounted.current) return;
    
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = rect.top + scrollTop - offset;
    
    // Smooth scroll to the target position
    window.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
  };
  
  // Process any newly expanded subjects
  useEffect(() => {
    const handleNewlyExpandedSubjects = () => {
      // Check if any newly expanded subjects need scrolling
      Object.entries(expandedSubjects).forEach(([subject, isExpanded]) => {
        if (isExpanded) {
          const subjectEl = subjectRefs.current[subject];
          if (subjectEl) {
            // Add a delay to ensure DOM has updated
            setTimeout(() => {
              scrollToElement(subjectEl, 10);
            }, 150);
          }
        }
      });
    };
    
    handleNewlyExpandedSubjects();
  }, [expandedSubjects, subjectRefs]);
  
  // Process any newly expanded topics
  useEffect(() => {
    const handleNewlyExpandedTopics = () => {
      // Check if any newly expanded topics need scrolling
      Object.entries(expandedTopics).forEach(([topicKey, isExpanded]) => {
        if (isExpanded) {
          const topicEl = topicRefs.current[topicKey];
          if (topicEl) {
            // Add a delay to ensure DOM has updated
            setTimeout(() => {
              scrollToElement(topicEl, 20);
            }, 150);
          }
        }
      });
    };
    
    handleNewlyExpandedTopics();
  }, [expandedTopics, topicRefs]);
  
  return null; // This is a utility component with no UI
};

const FlashcardList = ({ cards, onDeleteCard, onUpdateCard, onViewTopicList }) => {
  // State for expanded subjects and topics
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [showCardModal, setShowCardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [showModalAndSelectedCard, setShowModalAndSelectedCard] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(null);
  
  // Add refs for scrolling to subjects and topics
  const subjectRefs = useRef({});
  const topicRefs = useRef({});
  
  // Track last expanded subjects and topics for ScrollManager
  const [lastExpandedSubject, setLastExpandedSubject] = useState(null);
  const [lastExpandedTopic, setLastExpandedTopic] = useState(null);
  
  // Add new state for color editor
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [selectedSubjectForColor, setSelectedSubjectForColor] = useState(null);
  
  // Add new state for mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState({});
  const menuRef = useRef({});
  
  // New state for topic-specific card generation
  const [showTopicCardGenerator, setShowTopicCardGenerator] = useState(false);
  const [selectedTopicForCards, setSelectedTopicForCards] = useState(null);
  
  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(menuRef.current).forEach(subject => {
        if (menuRef.current[subject] && !menuRef.current[subject].contains(event.target)) {
          setMobileMenuOpen(prev => ({...prev, [subject]: false}));
        }
      });
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Check if we're on a mobile device
  const isMobile = window.innerWidth <= 768;
  
  // Toggle mobile menu for a subject
  const toggleMobileMenu = (subject, e) => {
    e.stopPropagation();
    setMobileMenuOpen(prev => ({
      ...prev, 
      [subject]: !prev[subject]
    }));
  };
  
  // Group cards by subject and topic, with special handling for topic shells
  const groupedCards = useMemo(() => {
    const bySubjectAndTopic = {};
    const topicShells = {}; // Track topic shells by ID
    
    // First pass: identify and separate topic shells from regular cards
    cards.forEach(item => {
      if (item.type === 'topic' && item.isShell) {
        // This is a topic shell - store it separately for proper handling
        const subject = item.subject || "General";
        
        if (!topicShells[subject]) {
          topicShells[subject] = {};
        }
        
        // Use the topic's name as the topic key
        const topicName = item.name || item.topic || "Unknown Topic";
        topicShells[subject][item.id] = {
          ...item,
          topicName, // Store the name for reference
        };
        
        // Initialize the subject and topic structure if needed
        if (!bySubjectAndTopic[subject]) {
          bySubjectAndTopic[subject] = {};
        }
        
        if (!bySubjectAndTopic[subject][topicName]) {
          bySubjectAndTopic[subject][topicName] = [];
        }
      }
    });
    
    // Second pass: organize regular cards into their topics
    cards.forEach(item => {
      if (item.type !== 'topic') { // Only process regular cards, not topic shells
        const subject = item.subject || "General";
        const topic = item.topic || "General";
        
        if (!bySubjectAndTopic[subject]) {
          bySubjectAndTopic[subject] = {};
        }
        
        if (!bySubjectAndTopic[subject][topic]) {
          bySubjectAndTopic[subject][topic] = [];
        }
        
        bySubjectAndTopic[subject][topic].push(item);
      }
    });
    
    console.log("FlashcardList processed items with special topic shell handling:", {
      topicShellCount: Object.keys(topicShells).reduce((count, subject) => 
        count + Object.keys(topicShells[subject]).length, 0),
      regularCardCount: Object.keys(bySubjectAndTopic).reduce((count, subject) => {
        return count + Object.keys(bySubjectAndTopic[subject]).reduce((subCount, topic) => 
          subCount + bySubjectAndTopic[subject][topic].length, 0);
      }, 0),
      topicShells
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

  // Function to toggle subject expansion with automatic scrolling
  const toggleSubject = (subject) => {
    // Check if subject is already expanded
    const wasExpanded = expandedSubjects[subject];
    
    setExpandedSubjects(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));
    
    // If we're expanding (not collapsing), track it for scrolling
    if (!wasExpanded) {
      setLastExpandedSubject(subject);
    }
  };
  
  // Function to toggle topic expansion with automatic scrolling
  const toggleTopic = (subject, topic) => {
    const topicKey = `${subject}-${topic}`;
    const wasExpanded = expandedTopics[topicKey];
    
    setExpandedTopics(prev => ({
      ...prev,
      [topicKey]: !prev[topicKey]
    }));
    
    // If we're expanding (not collapsing), track it for scrolling
    if (!wasExpanded) {
      setLastExpandedTopic(topicKey);
    }
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

  // Add the missing function to handle showing modal and setting selected card
  const handleSetShowModalAndSelectedCard = (card) => {
    setSelectedCard(card);
    setShowModalAndSelectedCard(true);
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
      handleSetShowModalAndSelectedCard(slideshowCards[0]);
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

  // CardModal component: Update for better responsiveness
  const CardModal = () => {
    // Determine the current subject from selectedCard
    const currentSubject = selectedCard ? selectedCard.metadata?.subject || selectedCard.subject || "Unknown Subject" : "";
    
    // Find the current topic for this card
    const currentTopic = selectedCard && currentSubject && groupedCards[currentSubject] 
      ? Object.keys(groupedCards[currentSubject] || {}).find(
          topic => groupedCards[currentSubject][topic].some(c => c.id === selectedCard.id)
        )
      : selectedCard?.topic || selectedCard?.metadata?.topic || "Unknown Topic";

    // Get all cards from the current subject or topic
    let modalCards = [];
    
    if (currentSubject && groupedCards[currentSubject]) {
      // Subject-level slideshow
      if (Object.keys(groupedCards[currentSubject]).length > 0) {
        // Get all cards from all topics in this subject
        modalCards = Object.keys(groupedCards[currentSubject]).flatMap(
          topic => groupedCards[currentSubject][topic]
        );
      }
    }

    // CRITICAL: Make sure modalCards is never empty if we have a selectedCard
    if (modalCards.length === 0 && selectedCard) {
      console.log("Using fallback single card mode");
      modalCards = [selectedCard];
    }

    // Ensure selectedCard is included in modalCards
    if (selectedCard && !modalCards.some(c => c.id === selectedCard.id)) {
      modalCards.push(selectedCard);
    }

    // Find the index of the current card in the array
    const currentIndex = modalCards.findIndex(c => c.id === selectedCard.id);
    const totalCards = modalCards.length;
    
    console.log(`CardModal debug - cards: ${totalCards}, currentIndex: ${currentIndex}, subject: ${currentSubject}, topic: ${currentTopic}`);

    // Handler functions for navigation
    const handlePrevCard = (e) => {
      e.stopPropagation(); // Stop the event from propagating
      console.log("Navigating to previous card");
      if (currentIndex > 0) {
        setSelectedCard(modalCards[currentIndex - 1]);
      }
    };
    
    const handleNextCard = (e) => {
      e.stopPropagation(); // Stop the event from propagating
      console.log("Navigating to next card");
      if (currentIndex < totalCards - 1) {
        setSelectedCard(modalCards[currentIndex + 1]);
      }
    };

    // Get topic information for display - ensure we never display "null"
    const topicInfo = currentTopic && currentTopic !== "Unknown Topic"
      ? `${currentSubject} | ${currentTopic}`
      : currentSubject;

    // Responsive layout variables
    const isMobile = window.innerWidth <= 768;
    const isLandscape = window.innerWidth > window.innerHeight;

    // Safely determine card color accounting for missing properties
    const cardBgColor = selectedCard?.cardColor || '#3cb44b';
    const cardTextColor = getContrastColor(cardBgColor);

    return (
      <div className="card-modal-overlay" onClick={() => setShowModalAndSelectedCard(false)}>
        <div 
          className="card-modal-content" 
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="close-modal-button" 
            onClick={(e) => {
              e.stopPropagation();
              setShowModalAndSelectedCard(false);
            }}
          >✕</button>
          
          <div 
            className="card-modal-card-container" 
            style={{ 
              '--card-bg-color': cardBgColor, 
              '--card-text-color': cardTextColor
            }}
          >
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
            <div className="card-info">
              <div className="card-counter">
                {currentIndex + 1} of {totalCards}
              </div>
              <div className="topic-info">{topicInfo}</div>
            </div>
            
            <div className="nav-buttons">
              <button 
                onClick={handlePrevCard} 
                disabled={currentIndex <= 0}
                className="nav-button prev"
              >
                {isMobile ? "← Previous" : "Previous Card"}
              </button>
              
              <button 
                onClick={handleNextCard} 
                disabled={currentIndex >= totalCards - 1}
                className="nav-button next"
              >
                {isMobile ? "Next →" : "Next Card"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Function to delete all cards in a topic
  const deleteTopicCards = (subject, topic) => {
    const topicCards = groupedCards[subject][topic] || [];
    // Confirm before deleting
    setShowDeleteConfirmation({
      type: 'topic',
      subject,
      topic,
      count: topicCards.length,
      onConfirm: () => {
        // Delete all cards in this topic
        topicCards.forEach(card => {
          onDeleteCard(card.id);
        });
        setShowDeleteConfirmation(null);
      }
    });
  };

  // Function to delete all cards in a subject
  const deleteSubjectCards = (subject) => {
    let totalCards = 0;
    const topics = Object.keys(groupedCards[subject] || {});
    topics.forEach(topic => {
      totalCards += groupedCards[subject][topic].length;
    });

    // Confirm before deleting
    setShowDeleteConfirmation({
      type: 'subject',
      subject,
      count: totalCards,
      onConfirm: () => {
        // Delete all cards in this subject
        topics.forEach(topic => {
          groupedCards[subject][topic].forEach(card => {
            onDeleteCard(card.id);
          });
        });
        setShowDeleteConfirmation(null);
      }
    });
  };

  // Render subject header with delete button
  const renderSubjectHeader = ({ id: subject, title, cards, exam_board, exam_type, color }) => {
    const isExpanded = expandedSubjects[subject];
    const cardCount = cards.flat().length;
    // Calculate appropriate text color based on background
    const textColor = getContrastColor(color);

    return (
      <div 
        className="subject-header" 
        style={{ 
          backgroundColor: color,
          color: textColor
        }}
        ref={el => subjectRefs.current[subject] = el}
      >
        <div className="subject-info" onClick={() => toggleSubject(subject)}>
          <h2>{title || subject}</h2>
          <div className="subject-meta">
            {exam_type && <span className={`meta-tag ${exam_type === 'GCSE' ? 'gcse' : 'a-level'}`}>{exam_type}</span>}
            {exam_board && <span className="meta-tag">{exam_board}</span>}
            <span className="card-count">{cardCount} {cardCount === 1 ? 'card' : 'cards'}</span>
          </div>
        </div>
        
        {isMobile ? (
          <div 
            className={`subject-actions ${mobileMenuOpen[subject] ? 'mobile-menu-active' : 'grid-layout'}`}
            ref={el => menuRef.current[subject] = el}
          >
            {mobileMenuOpen[subject] ? (
              <>
                <button
                  className="subject-actions-toggle"
                  onClick={(e) => toggleMobileMenu(subject, e)}
                  title="Close menu"
                >
                  <FaTimes />
                </button>
                <div className={`subject-actions-menu ${mobileMenuOpen[subject] ? 'active' : ''}`}>
                  <button
                    className="slideshow-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Start slideshow with first card in subject
                      const firstCard = cards.flat()[0];
                      if (firstCard) {
                        handleSetShowModalAndSelectedCard(firstCard);
                      }
                    }}
                    title="Start slideshow"
                  >
                    <span role="img" aria-label="Slideshow">▶️</span>
                  </button>
                  
                  <button
                    className="topic-list-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewTopicList && onViewTopicList(subject);
                    }}
                    title="View Topic List"
                  >
                    <span role="img" aria-label="View Topics">📋</span>
                  </button>
                  
                  <button
                    className="print-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintSubject(subject);
                    }}
                    title="Print all cards in this subject"
                  >
                    <span role="img" aria-label="Print">🖨️</span>
                  </button>
                  <button
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSubjectCards(subject);
                    }}
                    title="Delete all cards in this subject"
                    style={{ 
                      backgroundColor: `rgba(255, 0, 0, 0.2)`,
                      color: textColor
                    }}
                  >
                    <span role="img" aria-label="Delete">🗑️</span>
                  </button>
                  <button
                    className="color-edit-button"
                    onClick={(e) => openColorEditor(subject, e)}
                    title="Edit subject color"
                  >
                    <FaPalette />
                  </button>
                </div>
              </>
            ) : (
              <button
                className="subject-actions-toggle"
                onClick={(e) => toggleMobileMenu(subject, e)}
                title="Show actions"
              >
                <FaBars />
              </button>
            )}
          </div>
        ) : (
          <div className="subject-actions">
            <button
              className="slideshow-button"
              onClick={(e) => {
                e.stopPropagation();
                // Start slideshow with first card in subject
                const firstCard = cards.flat()[0];
                if (firstCard) {
                  handleSetShowModalAndSelectedCard(firstCard);
                }
              }}
              title="Start slideshow"
            >
              <span role="img" aria-label="Slideshow">▶️</span>
            </button>
            
            <button
              className="topic-list-button"
              onClick={(e) => {
                e.stopPropagation();
                onViewTopicList && onViewTopicList(subject);
              }}
              title="View Topic List"
            >
              <span role="img" aria-label="View Topics">📋</span>
            </button>
            
            <button
              className="print-button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrintSubject(subject);
              }}
              title="Print all cards in this subject"
            >
              <span role="img" aria-label="Print">🖨️</span>
            </button>
            <button
              className="delete-button"
              onClick={(e) => {
                e.stopPropagation();
                deleteSubjectCards(subject);
              }}
              title="Delete all cards in this subject"
              style={{ 
                backgroundColor: `rgba(255, 0, 0, 0.2)`,
                color: textColor
              }}
            >
              <span role="img" aria-label="Delete">🗑️</span>
            </button>
            <button
              className="color-edit-button"
              onClick={(e) => openColorEditor(subject, e)}
              title="Edit subject color"
            >
              <FaPalette />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Add function to open color editor
  const openColorEditor = (subject, e) => {
    if (e) e.stopPropagation(); // Prevent toggling subject expansion
    setSelectedSubjectForColor(subject);
    setColorEditorOpen(true);
  };
  
  // Add function to close color editor
  const closeColorEditor = () => {
    setColorEditorOpen(false);
  };
  
  // Add function to handle color change
  const handleColorChange = (color, applyToAllTopics = false) => {
    if (selectedSubjectForColor && onUpdateCard) {
      // Update all cards with this subject to have the new color
      const cardsToUpdate = cards.filter(card => 
        (card.subject || "General") === selectedSubjectForColor
      );
      
      cardsToUpdate.forEach(card => {
        const updatedCard = { 
          ...card, 
          cardColor: color,
          baseColor: color // Store the base color as well for reference
        };
        onUpdateCard(updatedCard);
      });
    }
    closeColorEditor();
  };

  // Add this new function to handle clicking the flash icon
  const handleGenerateCardsForTopic = (subject, topicName, topicId, e) => {
    e.stopPropagation(); // Prevent the topic from toggling open/closed
    
    // Get the exam information for this subject
    const { examType, examBoard } = getExamInfo(subject);
    
    // Set the selected topic data
    setSelectedTopicForCards({
      id: topicId,
      name: topicName,
      subject: subject,
      examType: examType,
      examBoard: examBoard
    });
    
    // Show the AICardGenerator for this topic
    setShowTopicCardGenerator(true);
  };

  // Add this new function to handle closing the card generator
  const handleCloseTopicCardGenerator = () => {
    setShowTopicCardGenerator(false);
    setSelectedTopicForCards(null);
  };

  // Render the accordion structure with subjects and topics
  return (
    <div className="flashcard-list">
      {/* Scroll Manager component */}
      <ScrollManager 
        expandedSubjects={expandedSubjects}
        expandedTopics={expandedTopics}
        subjectRefs={subjectRefs}
        topicRefs={topicRefs}
      />
      
      {printModalOpen && (
        <PrintModal 
          cards={cardsToPrint} 
          title={printTitle} 
          onClose={() => setPrintModalOpen(false)} 
        />
      )}
      
      {/* Topic-specific Card Generator */}
      {showTopicCardGenerator && selectedTopicForCards && (
        <div className="topic-card-generator-modal">
          <div className="topic-card-generator-wrapper">
            <button 
              className="close-generator-button"
              onClick={handleCloseTopicCardGenerator}
            >
              <FaTimes />
            </button>
            <AICardGenerator
              onClose={handleCloseTopicCardGenerator}
              onAddCard={(card) => {
                // Handle adding the new card
                // This will typically be handled by the AICardGenerator's internal functions
                handleCloseTopicCardGenerator();
              }}
              initialSubject={selectedTopicForCards.subject}
              initialTopic={selectedTopicForCards.name}
              examBoard={selectedTopicForCards.examBoard}
              examType={selectedTopicForCards.examType}
              subjects={[selectedTopicForCards.subject]}
              auth={true} // Assuming the user is authenticated if they can access this
              userId="current_user" // This should be passed from the parent component
            />
          </div>
        </div>
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
                    
                    // Find the topicId if this is a topic shell
                    const topicShell = topicCards.find(card => card.type === 'topic' && card.isShell);
                    const topicId = topicShell ? topicShell.id : null;
                    
                    return (
                      <div key={topic} className="topic-group">
                        <div 
                          className={`topic-header ${topicCards.length === 0 ? 'empty-topic' : ''}`}
                          onClick={() => toggleTopic(subject, topic)}
                          style={{ 
                            backgroundColor: topicColor,
                            color: topicTextColor,
                            borderLeft: 'none'
                          }}
                          ref={el => topicRefs.current[`${subject}-${topic}`] = el}
                        >
                          <div className="topic-info">
                            <h3 style={{ color: topicTextColor }}>{topic}</h3>
                            {topicDate && <span className="topic-date" style={{ color: topicTextColor }}>Added: {topicDate}</span>}
                          </div>
                          <div className="topic-actions">
                            {/* Always show the generate cards button */}
                            <button
                              className="generate-cards-button"
                              onClick={(e) => handleGenerateCardsForTopic(subject, topic, topicId, e)}
                              title="Generate flashcards for this topic"
                              style={{ color: topicTextColor, backgroundColor: `${topicTextColor}20` }}
                            >
                              <FaBolt />
                            </button>
                            
                            {/* Show slideshow button only when cards exist */}
                            {topicCards.length > 0 && (
                              <button
                                className="slideshow-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetShowModalAndSelectedCard(topicCards[0]);
                                }}
                                title="Start slideshow"
                                style={{ color: topicTextColor, backgroundColor: `${topicTextColor}20` }}
                              >
                                <span role="img" aria-label="Slideshow">▶️</span>
                              </button>
                            )}
                            <button
                              className="print-topic-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintTopic(subject, topic, topicCards);
                              }}
                              title="Print cards in this topic"
                              style={{ color: topicTextColor, backgroundColor: `${topicTextColor}20` }}
                            >
                              <span role="img" aria-label="Print">🖨️</span>
                            </button>
                            <button
                              className="delete-topic-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTopicCards(subject, topic);
                              }}
                              title="Delete all cards in this topic"
                              style={{ 
                                color: topicTextColor, 
                                backgroundColor: 'rgba(255, 0, 0, 0.2)' 
                              }}
                            >
                              <span role="img" aria-label="Delete">🗑️</span>
                            </button>
                            <span className="card-count" style={{ color: topicTextColor }}>{topicCards.length} cards</span>
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

      {showModalAndSelectedCard && <CardModal />}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-modal">
            <h3>Confirm Deletion</h3>
            <p>
              {showDeleteConfirmation.type === 'subject' 
                ? `Are you sure you want to delete all ${showDeleteConfirmation.count} cards in ${showDeleteConfirmation.subject}?` 
                : `Are you sure you want to delete all ${showDeleteConfirmation.count} cards in ${showDeleteConfirmation.topic}?`}
            </p>
            <p>This action cannot be undone.</p>
            <div className="delete-confirm-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowDeleteConfirmation(null)}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn"
                onClick={showDeleteConfirmation.onConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add the color editor modal */}
      {colorEditorOpen && selectedSubjectForColor && (
        <ColorEditor
          subject={selectedSubjectForColor}
          subjectColor={
            cards.find(card => (card.subject || "General") === selectedSubjectForColor)?.cardColor ||
            "#007bff"
          }
          onClose={closeColorEditor}
          onSelectColor={handleColorChange}
        />
      )}
    </div>
  );
};

export default FlashcardList;
