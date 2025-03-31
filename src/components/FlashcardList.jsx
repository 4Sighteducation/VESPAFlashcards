import React, {useState, useEffect, useMemo, useRef, useCallback} from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import "./FlashcardList.css";
import { FaPrint, FaPlay, FaAngleUp, FaAngleDown, FaPalette, FaBars, FaTimes, FaBolt } from 'react-icons/fa';
import ColorEditor from "./ColorEditor";
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

const FlashcardList = ({ cards, onDeleteCard, onUpdateCard, onViewTopicList, recordId }) => {
  // State for expanded subjects and topics
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [showModalAndSelectedCard, setShowModalAndSelectedCard] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(null);
  
  // Add refs for scrolling to subjects and topics
  const subjectRefs = useRef({});
  const topicRefs = useRef({});
   
  // Add new state for color editor
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [selectedSubjectForColor, setSelectedSubjectForColor] = useState(null);
  
  // State for ColorEditor visibility and configuration
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [colorEditorState, setColorEditorState] = useState({ color: '#e6194b', subject: null });
  
  // State for AI Card Generator
  const [showAICardGenerator, setShowAICardGenerator] = useState(false);
  const [cardGeneratorState, setCardGeneratorState] = useState({
    subject: '',
    topic: '',
    topicId: '',
    examBoard: '',
    examType: ''
  });
  
  // Add new state for mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState({});
  const menuRef = useRef({});
  
  // Add back state setters for tracking last expanded items for scrolling
  const [, setLastExpandedSubject] = useState(null); 
  const [, setLastExpandedTopic] = useState(null);
  
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
  const { groupedCards, topicShells } = useMemo(() => {
    const bySubjectAndTopic = {};
    const shells = {}; // Rename to avoid conflict in return object

    if (!Array.isArray(cards)) {
      console.error("FlashcardList received non-array cards prop:", cards);
      return { groupedCards: {}, topicShells: {} };
    }

    // Helper function to extract the actual topic name
    const extractTopicName = (item) => {
      const name = item.name || item.topic || "Unknown Topic";
      const subject = item.subject || "General";
      // Check if name starts with subject + colon + space
      if (name.startsWith(subject + ': ')) {
        return name.substring(subject.length + 2).trim(); // Extract part after colon and space
      }
      // Fallback if pattern doesn't match
      return name;
    };

    // First pass: identify and separate topic shells
    cards.forEach(item => {
      if (item.type === 'topic' && item.isShell) {
        const subject = item.subject || "General";
        const topicName = extractTopicName(item); // Use helper function

        if (!shells[subject]) {
          shells[subject] = {};
        }

        // Store the shell using its original ID as the key within the subject
        shells[subject][item.id] = {
          ...item,
          topicName, // Store the extracted topic name
        };

        // Ensure the structure exists in bySubjectAndTopic even for shells
        if (!bySubjectAndTopic[subject]) {
          bySubjectAndTopic[subject] = {};
        }
        if (!bySubjectAndTopic[subject][topicName]) { // Use extracted topicName as key
          bySubjectAndTopic[subject][topicName] = []; // Initialize with empty array for potential cards later
        }
      }
    });

    // Second pass: organize regular cards into their topics
    cards.forEach(item => {
      if (item.type !== 'topic') { // Process actual flashcards
        const subject = item.subject || "General";
        // Use the same logic to find the topic name, assuming cards also have a 'name' or 'topic' field
        // If cards have a different structure, adjust accordingly
        const topicName = item.topic || extractTopicName(item); // Prioritize item.topic if exists for cards

        if (!bySubjectAndTopic[subject]) {
          bySubjectAndTopic[subject] = {};
        }
        if (!bySubjectAndTopic[subject][topicName]) { // Use consistent topicName key
          bySubjectAndTopic[subject][topicName] = [];
        }
        bySubjectAndTopic[subject][topicName].push(item);
      }
    });

    console.log("FlashcardList processed items with topic name extraction:", {
      groupedStructure: bySubjectAndTopic, // Log the final structure
      topicShells: shells // Log the shells object
    });

    // Return both grouped cards and the shells map
    return { groupedCards: bySubjectAndTopic, topicShells: shells };
  }, [cards]);
  
  // Function to get exam type and board directly from the first card in a subject
   const getExamInfo = useCallback((subject) => { 
          try {
            let examBoard = null;
            let examType = null;
            
            // First, try to find a topic shell with this subject that has metadata
            const subjectTopics = groupedCards[subject]; // <-- Uses groupedCards
            if (subjectTopics) {
              // Look through all topics in this subject
              for (const topicName in subjectTopics) {
                const cards = subjectTopics[topicName];
                if (cards && cards.length > 0) {
                  // Find any topic shell or card with metadata
                  const cardWithMetadata = cards.find(
                    card => card.examBoard && card.examType
                  );
                  
                  if (cardWithMetadata) {
                    examBoard = cardWithMetadata.examBoard;
                    examType = cardWithMetadata.examType;
                    console.log(`Found metadata in card for ${subject}:`, { examBoard, examType });
                    break;
                  }
                }
              }
            }
      
      // If metadata not found, try other methods
      if (!examBoard || !examType) {
        // Try to extract exam board and type from the subject name itself
        // Common patterns are: "[Board] [Type] [Subject]" like "Edexcel A-Level Dance"
        
        // List of known exam boards to look for in the subject name
        const knownBoards = ['AQA', 'Edexcel', 'OCR', 'WJEC', 'CCEA', 'Cambridge', 'IB', 'Pearson'];
        // List of known exam types to look for in the subject name
        const knownTypes = ['GCSE', 'A-Level', 'AS-Level', 'BTEC', 'Diploma', 'Certificate', 'Foundation', 'Higher'];
        
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
        const dashPattern = /(.+)\\s*-\\s*(.+)\\s*\\((.+)\\)/;
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
      }
      
      // Set fallback values to ensure metadata displays something
      if (!examType) examType = "Course";
      if (!examBoard) examBoard = "General";
      
      return { examType, examBoard };
    } catch (error) {
      console.error("Error in getExamInfo:", error);
      return { examType: "Course", examBoard: "General" };
    }
  }, [groupedCards]); 
  
  // Function to get the earliest creation date for a subject (based on its first topic)
  const getSubjectDate = useCallback((subject) => { // Add useCallback here
    const topics = Object.keys(groupedCards[subject]); // <-- Uses groupedCards
    if (topics.length === 0) return 0;
    
    const topicDates = topics.map(topic => {
      const cardsInTopic = groupedCards[subject][topic]; // <-- Uses groupedCards
      const dates = cardsInTopic
        .filter(card => card.timestamp)
        .map(card => new Date(card.timestamp).getTime());
      
      return dates.length > 0 ? Math.min(...dates) : Number.MAX_SAFE_INTEGER;
    });
    
    return Math.min(...topicDates);
  }, [groupedCards]);
  
  // Sort subjects based on creation date (earliest first)
  const sortedSubjects = useMemo(() => {
    // Ensure groupedCards is populated before proceeding
    if (Object.keys(groupedCards).length === 0) return [];

    const subjectsWithDates = Object.keys(groupedCards).map(subject => {
        // Use the subject object structure if available, otherwise derive from groupedCards
        const subjectData = cards.find(c => c.subject === subject && c.type === 'subject'); // Example: if subjects are also items

        // Get exam info robustly
        const { examType, examBoard } = getExamInfo(subject);
        // Get color robustly
        const firstItem = cards.find(c => c.subject === subject);
        const color = firstItem?.baseColor || firstItem?.color || '#f0f0f0'; // Use baseColor or fallback

        return {
            id: subject, // The subject name acts as ID here
            title: subjectData?.name || subject, // Use specific title if available
            cards: groupedCards[subject], // Pass the topics map
            exam_type: examType,
            exam_board: examBoard,
            color: color,
            creationDate: getSubjectDate(subject) // Get the earliest date for sorting
        };
    });

    // Sort by creation date
    return subjectsWithDates.sort((a, b) => a.creationDate - b.creationDate);
  }, [groupedCards, cards, getExamInfo, getSubjectDate]);

  // Effect to reset expanded sections when cards change
  useEffect(() => {
    // Initialize all subjects as collapsed by default (changed from auto-expanding the first one)
    setExpandedSubjects({});
    setExpandedTopics({});
  }, [cards]);

  // Handle case where there are no cards (or processing resulted in no groups)
  if (!cards || cards.length === 0 || Object.keys(groupedCards).length === 0) {
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
  const renderSubjectHeader = ({ id: subject, title, displayCount, exam_board, exam_type, color }) => {
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
            <span className="card-count">{displayCount}</span>
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
    
    // Find the color for this subject
    const subjectObj = sortedSubjects.find(s => s.id === subject);
    const currentColor = subjectObj?.color || '#e6194b';
    
    // Update state
    setColorEditorState({
      color: currentColor,
      subject: subject
    });
    setShowColorEditor(true);
  };
  
  // Add function to close color editor
  const closeColorEditor = () => {
    setShowColorEditor(false);
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

  // Function to initiate AI card generation for a specific topic
  const handleGenerateCardsForTopic = (subject, topicName, topicId, e) => {
    if (e) e.stopPropagation(); // Prevent topic expansion toggle

    console.log(`Initiating card generation for Subject: ${subject}, Topic: ${topicName}, Topic ID: ${topicId}`);

    // Ensure we have the necessary info, especially topicId which comes from the topic shell
    if (!topicId) {
      console.warn("Cannot generate cards: Topic ID is missing. Was this topic created via AI Generator?");
      // Optionally show a user-friendly message here
      alert("Cannot generate cards for this topic as its unique ID is missing.");
      return;
    }

    setSelectedTopicForCards({ subject, topicName, topicId });
    setShowTopicCardGenerator(true);
  };

  // Function to close the topic-specific AI card generator modal
  const handleCloseTopicCardGenerator = () => {
    setShowTopicCardGenerator(false);
    setShowAICardGenerator(false);
  };

  // Render a single subject section including its topics
  const renderSubject = (subjectData) => {
    const { id: subject, title, exam_board, exam_type } = subjectData;
    const isExpanded = expandedSubjects[subject];

    // Use the pre-processed groupedCards for topic structure
    const topicsInSubject = groupedCards[subject] || {};
    const topicNames = Object.keys(topicsInSubject).sort((a, b) => a.localeCompare(b));

    // Retrieve subject color from the pre-calculated sortedSubjects data
    const currentSubjectColor = subjectData.color || '#f0f0f0';

    // Count total cards for the subject header
    const totalCardCount = topicNames.reduce((count, topicName) => {
      return count + (topicsInSubject[topicName] || []).length;
    }, 0);
    
    // Count topic shells for the subject header
    const topicShellCount = Object.values(topicShells[subject] || {}).length;
    
    // Display logic for card count: show card count if > 0, else show shell count if > 0
    const displayCount = totalCardCount > 0 ? 
      `${totalCardCount} ${totalCardCount === 1 ? 'card' : 'cards'}` :
      (topicShellCount > 0 ? `${topicShellCount} topic ${topicShellCount === 1 ? 'shell' : 'shells'}` : '0 cards');

    return (
      <div key={subject} className="subject-section">
        {/* Render Subject Header */}
        {renderSubjectHeader({
          id: subject,
          title: title || subject, // Use title if available, else subject name
          displayCount: displayCount, // Pass the calculated display count
          exam_board: exam_board || getExamInfo(subject).examBoard,
          exam_type: exam_type || getExamInfo(subject).examType,
          color: currentSubjectColor // Pass determined color
        })}

        {/* Render Topics within the Subject - Conditionally based on subject expansion */}
        {isExpanded && (
          <div className="topics-container">
            {topicNames.length === 0 ? (
              <div className="no-topics-message">No topics found for this subject.</div>
            ) : (
              topicNames.map((topicName) => {
                const cardsInTopic = topicsInSubject[topicName] || [];
                const topicKey = `${subject}-${topicName}`;
                const isTopicExpanded = expandedTopics[topicKey];
                const topicDate = getTopicDate(cardsInTopic); // Get earliest date for the topic

                // Find the original topic shell object using the topicShells map
                const topicShell = Object.values(topicShells[subject] || {}).find(shell => shell.topicName === topicName);
                const topicId = topicShell ? topicShell.id : null; // Get ID from shell if available
                
                // Assign ref inside the loop using topicKey
                const topicRef = el => topicRefs.current[topicKey] = el; 

                return (
                  <div key={topicKey} className="topic-section">
                    {/* Topic Header */}
                    <div
                      className={`topic-header ${isTopicExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleTopic(subject, topicName)}
                      ref={topicRef} // Assign ref here
                    >
                      <div className="topic-header-content">
                        <span className="topic-title">{topicName}</span>
                        <div className="topic-meta">
                          {topicDate && <span className="topic-date">{topicDate}</span>}
                          <span className="topic-card-count">
                            {/* Display count or "Topic Shell" */}
                            {cardsInTopic.length > 0
                              ? `${cardsInTopic.length} ${cardsInTopic.length === 1 ? 'card' : 'cards'}`
                              : (topicShell ? "(Topic Shell)" : "(Empty Topic)")
                            }
                          </span>
                        </div>
                      </div>
                      <div className="topic-actions">
                         {/* Generate Cards Button - Use topicId */}
                         <button
                          className="action-button generate-topic-cards-button"
                          onClick={(e) => handleGenerateCardsForTopic(subject, topicName, topicId, e)}
                          title={`Generate AI cards for ${topicName}`}
                          disabled={!topicId} // Only enable if it's a shell with an ID
                        >
                          <FaBolt />
                          <span className="tooltip">Generate Cards</span>
                        </button>
                        {/* Slideshow Button */}
                        <button
                          className="action-button slideshow-button"
                          onClick={(e) => startSlideshow(subject, topicName, e)}
                          disabled={cardsInTopic.length === 0}
                          title={`Start slideshow for ${topicName}`}
                        >
                          <FaPlay />
                           <span className="tooltip">Play Topic</span>
                        </button>
                         {/* Print Button */}
                         <button
                          className="action-button print-button"
                          onClick={(e) => handlePrintTopic(subject, topicName, e)}
                          disabled={cardsInTopic.length === 0}
                          title={`Print cards for ${topicName}`}
                         >
                           <FaPrint />
                           <span className="tooltip">Print Topic</span>
                         </button>
                        {/* Delete Topic Button - Deletes cards or shell */}
                        <button
                          className="action-button delete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (cardsInTopic.length > 0) {
                                deleteTopicCards(subject, topicName); // Deletes cards
                            } else if (topicShell) {
                                // TODO: Implement deletion of the topic shell itself if desired
                                // onDeleteTopicShell(topicShell.id); // Example call
                                alert("Deleting topic shells directly is not yet supported.");
                            }
                          }}
                          disabled={cardsInTopic.length === 0 && !topicShell}
                          title={cardsInTopic.length > 0 ? `Delete all cards in ${topicName}` : (topicShell ? `Delete Topic Shell ${topicName}`: `No cards or shell`)}
                        >
                          <FaTimes />
                           <span className="tooltip">{cardsInTopic.length > 0 ? "Delete Cards" : (topicShell ? "Delete Shell" : "No Items")}</span>
                        </button>
                        {/* Toggle Arrow */}
                        <span className="toggle-arrow">
                          {isTopicExpanded ? <FaAngleUp /> : <FaAngleDown />}
                        </span>
                      </div>
                    </div>

                    {/* Render Cards within the Topic - Conditionally */}
                    {isTopicExpanded && (
                        <div className={`topic-cards-container ${cardsInTopic.length === 0 ? 'empty' : ''}`}>
                            {cardsInTopic.length > 0 ? (
                                renderCards(cardsInTopic, subject, topicName, currentSubjectColor)
                            ) : (
                                <div className="no-cards-in-topic-message">
                                    This topic shell is ready. Click the <FaBolt style={{ verticalAlign: 'middle' }} /> button to generate cards.
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  // Main component render return statement
  return (
    <div className="flashcard-list-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showColorEditor && (
        <ColorEditor
          initialColor={colorEditorState.color}
          onClose={closeColorEditor}
          onSave={handleColorChange}
          subject={colorEditorState.subject}
        />
      )}
      
      {showAICardGenerator && (
        <AICardGenerator
          initialSubject={cardGeneratorState.subject}
          initialTopic={cardGeneratorState.topic}
          initialTopicId={cardGeneratorState.topicId}
          examBoard={cardGeneratorState.examBoard}
          examType={cardGeneratorState.examType}
          recordId={recordId}
          onClose={handleCloseTopicCardGenerator}
          onAddCard={onUpdateCard}
        />
      )}
      
      {/* Print modal */}
      {printModalOpen && (
        <PrintModal
          cards={cardsToPrint}
          title={printTitle}
          onClose={() => setPrintModalOpen(false)}
        />
      )}
      
      {/* Card modal */}
      {showModalAndSelectedCard && selectedCard && (
        <CardModal />
      )}
      
      {/* Main accordion container */}
      <div className="accordion-container" style={{ 
        flex: 1, 
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 120px)',
        padding: '0 10px' 
      }}>
        {/* Map over sortedSubjects which contains pre-calculated data */}
        {sortedSubjects.map(subjectData => renderSubject(subjectData))}
      </div>
      
      {/* Scroll manager component */}
      <ScrollManager
        expandedSubjects={expandedSubjects}
        expandedTopics={expandedTopics}
        subjectRefs={subjectRefs}
        topicRefs={topicRefs}
      />
    </div>
  );
};

export default FlashcardList;
