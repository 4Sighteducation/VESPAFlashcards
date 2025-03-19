import React, { useState, useEffect, useMemo, useRef } from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import ReactDOM from 'react-dom';
import "./FlashcardList.css";
import { FaLayerGroup, FaUniversity, FaGraduationCap, FaPrint, FaPlay, FaAngleUp, FaAngleDown, FaPalette, FaBars, FaTimes } from 'react-icons/fa';
import ColorEditor from "./ColorEditor";
import { getContrastColor } from '../helper';
import MobileSlideshow from "./MobileSlideshow";

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
  const [showModalAndSelectedCard, setShowModalAndSelectedCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(null);
  const [showMobileSlideshow, setShowMobileSlideshow] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Add refs for scrolling to subjects and topics
  const subjectRefs = useRef({});
  const topicRefs = useRef({});
  
  // Track last expanded subjects and topics for ScrollManager
  const [lastExpandedSubject, setLastExpandedSubject] = useState(null);
  const [lastExpandedTopic, setLastExpandedTopic] = useState(null);
  
  // Add new state for color editor
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [selectedSubjectForColor, setSelectedSubjectForColor] = useState(null);
  const [selectedSubjectColor, setSelectedSubjectColor] = useState('#ffffff');
  
  // Add new state for mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState({});
  const menuRef = useRef({});
  
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
  
  // Toggle mobile menu for a subject
  const toggleMobileMenu = (subject, e) => {
    e.stopPropagation();
    setMobileMenuOpen(prev => ({
      ...prev, 
      [subject]: !prev[subject]
    }));
  };
  
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

  // Handle card click
  const handleCardClick = (card) => {
    // No longer automatically show slideshow on click
    // We'll use a dedicated button for this instead
  };

  // Function to handle showing modal and selected card
  const handleSetShowModalAndSelectedCard = (card) => {
    setSelectedCard(card);
    
    if (isMobile) {
      // Use mobile slideshow on mobile devices
      setShowMobileSlideshow(true);
    } else {
      // Use traditional modal on desktop
      setShowModalAndSelectedCard(true);
    }
  };

  // Traditional card modal for desktop
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
    const modalCards = getAllCardsForModal();

    // Find the index of the current card in the array
    const currentIndex = getCurrentCardIndex();
    const totalCards = modalCards.length;
    
    // Format the topic info display
    const topicInfo = currentSubject && currentTopic ? `${currentSubject} - ${currentTopic}` : (selectedCard?.subject || '');
    
    // Get the card's background color and text color for styling
    const cardBgColor = selectedCard?.cardColor || '#ffffff';
    const cardTextColor = getContrastColor(cardBgColor);

    // Handler functions for navigation
    const handlePrevCard = (e) => {
      e.stopPropagation();
      if (currentIndex > 0) {
        setSelectedCard(modalCards[currentIndex - 1]);
      }
    };
    
    const handleNextCard = (e) => {
      e.stopPropagation();
      if (currentIndex < modalCards.length - 1) {
        setSelectedCard(modalCards[currentIndex + 1]);
      }
    };

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
                Previous Card
              </button>
              
              <button 
                onClick={handleNextCard} 
                disabled={currentIndex >= totalCards - 1}
                className="nav-button next"
              >
                Next Card
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to get all cards for the modal based on the selected card
  function getAllCardsForModal() {
    if (!selectedCard) return [];
    
    const currentSubject = selectedCard.metadata?.subject || selectedCard.subject || "Unknown Subject";
    
    if (currentSubject && groupedCards[currentSubject]) {
      // Subject-level slideshow
      if (Object.keys(groupedCards[currentSubject]).length > 0) {
        // Get all cards from all topics in this subject
        const allCards = Object.keys(groupedCards[currentSubject]).flatMap(
          topic => groupedCards[currentSubject][topic]
        );
        
        // If we have cards and the selected card isn't in the array, add it
        if (allCards.length > 0 && !allCards.some(c => c.id === selectedCard.id)) {
          allCards.push(selectedCard);
        }
        
        return allCards;
      }
    }
    
    // Fallback to just the selected card
    return [selectedCard];
  }
  
  // Helper function to get the current card index in the modal cards array
  function getCurrentCardIndex() {
    const allCards = getAllCardsForModal();
    return allCards.findIndex(c => c.id === selectedCard.id);
  }

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

  // Function to render cards in a topic
  const renderCards = (topicCards, subject, topic, subjectColor) => {
    const topicKey = `${subject}-${topic}`;
    const isTopicExpanded = expandedTopics[topicKey];
    
    if (!isTopicExpanded) return null;
    
    return (
      <div className="cards-container">
        {topicCards.map(card => (
          <div 
            key={card.id} 
            className="card-wrapper"
            onClick={() => handleSetShowModalAndSelectedCard(card)}
          >
            <Flashcard 
              card={card} 
              onDelete={() => onDeleteCard(card.id)}
              onFlip={(card, isFlipped) => console.log(`Card flipped: ${isFlipped}`)}
              onUpdateCard={onUpdateCard}
              showButtons={false}
            />
          </div>
        ))}
      </div>
    );
  };

  // Check for mobile device on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
                          ref={el => topicRefs.current[`${subject}-${topic}`] = el}
                        >
                          <div className="topic-info">
                            <h3 style={{ color: topicTextColor }}>{topic}</h3>
                            {topicDate && <span className="topic-date" style={{ color: topicTextColor }}>Added: {topicDate}</span>}
                          </div>
                          <div className="topic-actions">
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

      {/* Show traditional card modal for desktop */}
      {showModalAndSelectedCard && !isMobile && selectedCard && <CardModal />}
      
      {/* Show mobile slideshow for mobile devices */}
      {showMobileSlideshow && isMobile && selectedCard && (
        <MobileSlideshow
          cards={getAllCardsForModal()}
          initialCardIndex={getCurrentCardIndex()}
          onClose={() => setShowMobileSlideshow(false)}
          onDeleteCard={onDeleteCard}
          onUpdateCard={onUpdateCard}
        />
      )}
      
      {/* Print modal */}
      {printModalOpen && cardsToPrint.length > 0 && (
        <PrintModal
          cards={cardsToPrint}
          title={printTitle}
          onClose={() => setPrintModalOpen(false)}
        />
      )}
      
      {/* Color editor modal */}
      {colorEditorOpen && selectedSubjectForColor && (
        <ColorEditor
          initialColor={selectedSubjectColor}
          onSave={(color, applyToAll) => handleColorChange(color, applyToAll)}
          onCancel={closeColorEditor}
          showApplyToAll={true}
        />
      )}
      
      {/* Delete confirmation */}
      {showDeleteConfirmation && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-modal">
            <h3>{showDeleteConfirmation.type === 'subject' ? `Are you sure you want to delete all ${showDeleteConfirmation.count} cards in ${showDeleteConfirmation.subject}?` : `Are you sure you want to delete all ${showDeleteConfirmation.count} cards in ${showDeleteConfirmation.topic}?`}</h3>
            <p>This action cannot be undone.</p>
            <div className="delete-confirm-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirmation(null)}>Cancel</button>
              <button className="confirm-btn" onClick={showDeleteConfirmation.onConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardList;


