import React, {useState, useEffect, useMemo, useRef, useCallback} from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import "./FlashcardList.css";
import { FaPrint, FaPlay, FaAngleUp, FaAngleDown, FaPalette, FaBars, FaTimes, FaBolt } from 'react-icons/fa';
import ColorEditor from "./ColorEditor";
import TopicCreationModal from "./TopicCreationModal";

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

const FlashcardList = ({ cards, onDeleteCard, onUpdateCard, onViewTopicList, recordId, onUpdateSubjectColor, subjectColorMapping, handleSaveTopicShells }) => {
  // --- START: HOOK DEFINITIONS ---

  // 1. useState Hooks
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [showModalAndSelectedCard, setShowModalAndSelectedCard] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(null);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [colorEditorState, setColorEditorState] = useState({ subject: null, topic: null, color: '#e6194b' });
  const [showTopicCreationModal, setShowTopicCreationModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState({});
  const [, setLastExpandedSubject] = useState(null);
  const [, setLastExpandedTopic] = useState(null);
  const [slideshowCards, setSlideshowCards] = useState([]);
  const [slideshowTitle, setSlideshowTitle] = useState("");
  const [showSlideshow, setShowSlideshow] = useState(false);

  // 2. useRef Hooks
  const subjectRefs = useRef({});
  const topicRefs = useRef({});
  const menuRef = useRef({});

  // 3. useMemo Hooks
  const { groupedCards } = useMemo(() => {
    const bySubjectAndTopic = {};
    if (!Array.isArray(cards)) {
      console.error("FlashcardList received non-array cards prop:", cards);
          return { groupedCards: {} };
      }
      const extractActualTopicName = (item) => {
        if (item.type === 'topic' && item.isShell && item.name) {
          const name = item.name;
          const subject = item.subject || "General";
          if (name.startsWith(subject + ': ')) {
            return name.substring(subject.length + 2).trim() || "General";
          }
          return name;
        }
        return item.topic || "General";
      };
      cards.forEach(item => {
          if (!item || typeof item !== 'object' || !item.id || !item.subject) {
            console.warn("[FlashcardList Grouping] Skipping invalid item:", item);
            return;
          }
          const subject = item.subject || "General";
          const actualTopicName = extractActualTopicName(item);
          if (!bySubjectAndTopic[subject]) {
            bySubjectAndTopic[subject] = {};
          }
          if (!bySubjectAndTopic[subject][actualTopicName]) {
              bySubjectAndTopic[subject][actualTopicName] = [];
          }
          bySubjectAndTopic[subject][actualTopicName].push(item);
      });
      console.log("FlashcardList processed items (Revised Grouping):", { groupedStructure: bySubjectAndTopic });
      return { groupedCards: bySubjectAndTopic };
  }, [cards]);

  const getExistingSubjectNames = useMemo(() => {
    // Now depends on groupedCards which is defined above
    return Object.keys(groupedCards || {});
  }, [groupedCards]);

  const sortedSubjects = useMemo(() => {
    if (Object.keys(groupedCards).length === 0) return [];
    const subjectsWithDates = Object.keys(groupedCards).map(subject => {
        const { examType, examBoard } = getExamInfo(subject);
        const color = subjectColorMapping[subject]?.base || '#f0f0f0';
        return {
            id: subject,
            title: subject,
            cards: groupedCards[subject],
            exam_type: examType,
            exam_board: examBoard,
            color: color,
            creationDate: getSubjectDate(subject)
        };
    });
    return subjectsWithDates.sort((a, b) => a.creationDate - b.creationDate);
  }, [groupedCards, getExamInfo, getSubjectDate, subjectColorMapping]);

  // 4. useCallback Hooks (Define functions needed by useMemo/useEffect first)
  const getExamInfo = useCallback((subject) => {
          if (!groupedCards) return { examType: "Course", examBoard: "General" };
          try {
            let examBoard = null;
            let examType = null;
            const subjectTopics = groupedCards[subject];
            if (subjectTopics) {
              for (const topicName in subjectTopics) {
                const cardsInTopic = subjectTopics[topicName];
                if (cardsInTopic && cardsInTopic.length > 0) {
                  const cardWithMetadata = cardsInTopic.find(card => card.examBoard && card.examType);
                  if (cardWithMetadata) {
                    examBoard = cardWithMetadata.examBoard;
                    examType = cardWithMetadata.examType;
                    break;
                  }
                }
              }
            }
      
      if (!examType) examType = "Course";
      if (!examBoard) examBoard = "General";
      
      return { examType, examBoard };
    } catch (error) {
      console.error("Error in getExamInfo:", error);
      return { examType: "Course", examBoard: "General" };
    }
  }, [groupedCards]);

  const getSubjectDate = useCallback((subject) => {
    if (!groupedCards || !groupedCards[subject]) return 0;
    const topics = Object.keys(groupedCards[subject]);
    if (topics.length === 0) return 0;
    const topicDates = topics.map(topic => {
      const cardsInTopic = groupedCards[subject][topic];
      const dates = cardsInTopic
        .filter(card => card.timestamp)
        .map(card => new Date(card.timestamp).getTime());
      return dates.length > 0 ? Math.min(...dates) : Number.MAX_SAFE_INTEGER;
    });
    const minDate = Math.min(...topicDates);
    return minDate === Number.MAX_SAFE_INTEGER ? 0 : minDate;
  }, [groupedCards]);

  // 5. useEffect Hooks
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

  useEffect(() => {
    setExpandedSubjects({});
    setExpandedTopics({});
  }, [cards]);

  // --- END: HOOK DEFINITIONS ---

  // --- START: REGULAR LOGIC & HELPER FUNCTIONS ---

  // Log initial props
  console.log("[FlashcardList] Received cards prop:", cards);

  // Early return check (NOW AFTER ALL HOOKS)
  if (!cards || cards.length === 0 || Object.keys(groupedCards).length === 0) {
    return (
      <div className="no-cards-message">
        <h3>No Cards Found</h3>
        <p>Select a different subject or create new cards.</p>
         {/* Optionally add button to trigger Topic Creation Modal */}
         <button
            onClick={() => setShowTopicCreationModal(true)}
            className="create-topic-list-button button-primary"
            style={{ marginTop: '20px' }}
          >
            <FaBolt style={{ marginRight: '8px' }} /> Create New Topic List
          </button>
      </div>
    );
  }

  // Helper functions (defined after hooks)
  const isMobile = window.innerWidth <= 768;

  const toggleMobileMenu = (subject, e) => {
    e.stopPropagation();
    setMobileMenuOpen(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));
  };

  const toggleSubject = (subject) => {
    const wasExpanded = expandedSubjects[subject];
    setExpandedSubjects(prev => ({ ...prev, [subject]: !prev[subject] }));
    if (!wasExpanded) setLastExpandedSubject(subject);
  };

  const toggleTopic = (subject, topic) => {
    const topicKey = `${subject}-${topic}`;
    const wasExpanded = expandedTopics[topicKey];
    setExpandedTopics(prev => ({ ...prev, [topicKey]: !prev[topicKey] }));
    if (!wasExpanded) setLastExpandedTopic(topicKey);
  };

  const getContrastColor = (hexColor) => {
    if (!hexColor) return "#000000";
    try {
      hexColor = hexColor.replace("#", "");
      if (hexColor.length === 3) { hexColor = hexColor[0] + hexColor[0] + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2]; }
      const r = parseInt(hexColor.substring(0, 2), 16);
      const g = parseInt(hexColor.substring(2, 4), 16);
      const b = parseInt(hexColor.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? "#000000" : "#ffffff";
    } catch (error) { return "#000000"; }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getTopicDate = (cardsInTopic) => {
    const dates = cardsInTopic.filter(card => card.timestamp).map(card => new Date(card.timestamp).getTime());
    if (dates.length === 0) return '';
    const earliestDate = new Date(Math.min(...dates));
    return formatDate(earliestDate);
  };

  const openPrintModal = (cardsForPrinting, title) => {
    setCardsToPrint(cardsForPrinting);
    setPrintTitle(title);
    setPrintModalOpen(true);
  };

  const handlePrintSubject = (subject, e) => {
    e.stopPropagation();
    const subjectCards = [];
    Object.values(groupedCards[subject] || {}).forEach(topicCards => {
      subjectCards.push(...topicCards.filter(item => item.type !== 'topic'));
    });
    openPrintModal(subjectCards, subject);
  };

  const handlePrintTopic = (subject, topic, e) => {
    e.stopPropagation();
    const topicCards = (groupedCards[subject]?.[topic] || []).filter(item => item.type !== 'topic');
    openPrintModal(topicCards, `${subject} - ${topic}`);
  };

  const handleSetShowModalAndSelectedCard = (card) => {
    setSelectedCard(card);
    setShowModalAndSelectedCard(true);
  };

  const startSlideshow = (subject, topic, e) => {
    if (e) e.stopPropagation();
    let slideshowCardsToUse = [];
    let slideshowTitleToUse = "Slideshow";
    if (topic) {
      slideshowCardsToUse = (groupedCards[subject]?.[topic] || []).filter(item => item.type !== 'topic');
      slideshowTitleToUse = `${subject} - ${topic}`;
    } else {
      const allTopics = Object.keys(groupedCards[subject] || {});
      slideshowCardsToUse = allTopics.reduce((all, currentTopic) => {
        const topicCardsOnly = (groupedCards[subject][currentTopic] || []).filter(item => item.type !== 'topic');
        return all.concat(topicCardsOnly || []);
      }, []);
      slideshowTitleToUse = subject;
    }
    if (slideshowCardsToUse.length > 0) {
      setSlideshowCards(slideshowCardsToUse);
      setSlideshowTitle(slideshowTitleToUse);
      setShowSlideshow(true);
    } else {
      console.warn(`No cards found for slideshow: ${slideshowTitleToUse}`);
    }
  };

  const openColorEditor = (subject, topic = null, currentColor, e) => {
    e.stopPropagation();
    setColorEditorState({ subject, topic, color: currentColor || '#e6194b' });
    setColorEditorOpen(true);
  };

  const closeColorEditor = () => {
    setColorEditorOpen(false);
    setColorEditorState({ subject: null, topic: null, color: '#e6194b' });
  };

  const handleColorChange = (newColor) => {
    if (colorEditorState.subject) {
      if (colorEditorState.topic) {
        onUpdateSubjectColor(colorEditorState.subject, colorEditorState.topic, newColor, false);
      } else {
        onUpdateSubjectColor(colorEditorState.subject, null, newColor, true);
      }
    }
    closeColorEditor();
  };

  // Render functions (can remain here or be moved outside if preferred)
  const renderCards = (cardsInTopic, subject, topic, topicColor) => {
    const topicKey = `${subject}-${topic}`;
    const isVisible = expandedTopics[topicKey];
    return (
      <div className={`topic-cards ${isVisible ? 'visible' : ''}`}>
        {cardsInTopic && cardsInTopic.length > 0 ? (
          cardsInTopic.map((card) => (
            <Flashcard
              key={card.id}
              card={{ ...card, cardColor: topicColor }}
              onDelete={() => onDeleteCard(card.id)}
              onFlip={() => {}}
              onUpdateCard={onUpdateCard}
              onSelectCard={() => handleSetShowModalAndSelectedCard(card)}
            />
          ))
        ) : (
          <div className="no-cards-message">No cards in this topic</div>
        )}
      </div>
    );
  };

  const renderTopicControls = (subject, topic, topicColor, topicCards) => {
    const hasCards = topicCards && topicCards.length > 0;
    return (
      <div className="topic-controls">
        <button className="generate-cards-btn" title="Generate cards for topic" onClick={(e) => { e.stopPropagation(); /* Add AI generation trigger here */ }}>⚡</button>
        {hasCards && (
          <>
            <button className="print-btn" title="Print topic cards" onClick={(e) => handlePrintTopic(subject, topic, e)}><FaPrint /></button>
            <button className="slideshow-btn" title="Start slideshow for topic" onClick={(e) => startSlideshow(subject, topic, e)}><FaPlay /></button>
          </>
        )}
        <button className="color-picker-btn" title="Change topic color" onClick={(e) => openColorEditor(subject, topic, topicColor, e)}><FaPalette /></button>
      </div>
    );
  };

  const renderTopics = (subject, subjectColor) => {
    const topicsData = groupedCards[subject] || {};
    const topicNames = Object.keys(topicsData).sort((a, b) => {
        const dateA = getTopicDate(topicsData[a]);
        const dateB = getTopicDate(topicsData[b]);
        if (!dateA && !dateB) return a.localeCompare(b);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA) - new Date(dateB);
    });

    return (
      <div className="topics-container">
        {topicNames.map((topic, index) => {
          const topicKey = `${subject}-${topic}`;
          const isExpanded = expandedTopics[topicKey];
          const itemsInTopic = topicsData[topic] || [];
          const topicShell = itemsInTopic.find(item => item.type === 'topic' && item.isShell);
          const actualCards = itemsInTopic.filter(item => item.type !== 'topic');
          const displayCount = actualCards.length;
          const topicColor = subjectColorMapping[subject]?.topics?.[topic] || subjectColor;
          const textColor = getContrastColor(topicColor);

          return (
            <div key={topicKey} className="topic-item" ref={el => topicRefs.current[topicKey] = el}>
              <div
                className={`topic-header ${isExpanded ? 'expanded' : ''} ${displayCount === 0 ? 'empty-shell' : ''}`}
                style={{ backgroundColor: topicColor, color: textColor }}
                onClick={() => toggleTopic(subject, topic)}
              >
                <span className="topic-name">{topic} ({displayCount})</span>
                <div className="topic-header-controls">
                    {renderTopicControls(subject, topic, topicColor, actualCards)}
                    <span className="expand-icon">{isExpanded ? <FaAngleUp /> : <FaAngleDown />}</span>
                </div>
              </div>
              {isExpanded && renderCards(actualCards, subject, topic, topicColor)}
            </div>
          );
        })}
      </div>
    );
  };

 const renderSubjectHeader = ({ id: subject, title, exam_board, exam_type, color }) => {
    const textColor = getContrastColor(color);
    const subjectCards = [];
     Object.values(groupedCards[subject] || {}).forEach(topicCards => {
        subjectCards.push(...topicCards.filter(item => item.type !== 'topic'));
     });
     const displayCount = subjectCards.length;

    return (
      <div
        className="subject-header"
        style={{ backgroundColor: color, color: textColor }}
      >
        <span className="subject-title">{title} ({displayCount})</span>
        <div className="subject-header-controls">
           <button className="subject-action-button" onClick={(e) => handlePrintSubject(subject, e)} title="Print all cards in subject"> <FaPrint /> </button>
           <button className="subject-action-button" onClick={(e) => startSlideshow(subject, null, e)} title="Start slideshow for subject"> <FaPlay /> </button>
           <button className="subject-action-button" onClick={(e) => openColorEditor(subject, null, color, e)} title="Change subject color"> <FaPalette /> </button>
           <span className="expand-icon" onClick={(e) => { e.stopPropagation(); toggleSubject(subject); }}> {expandedSubjects[subject] ? <FaAngleUp /> : <FaAngleDown />} </span>
        </div>
      </div>
    );
  };

  const renderSubject = (subjectData) => {
    const { id: subject, title, color } = subjectData;
    const isExpanded = expandedSubjects[subject];
    let displayCount = 0;
    const topicsMap = groupedCards[subject] || {};
    Object.values(topicsMap).forEach(items => {
        displayCount += items.filter(item => item.type !== 'topic').length;
    });

    return (
      <div key={subject} className="subject-group" ref={el => subjectRefs.current[subject] = el}>
        {renderSubjectHeader({ ...subjectData, displayCount })}
        {isExpanded && (
          <div className="subject-content">
            {renderTopics(subject, color)}
          </div>
        )}
      </div>
    );
  };

  // CardModal component needs to be defined or imported if used
   const CardModal = () => {
       if (!selectedCard) return null;
       const currentSubject = selectedCard.subject || "Unknown";
       const currentTopic = selectedCard.topic || "Unknown";
       const modalCards = (groupedCards[currentSubject]?.[currentTopic] || []).filter(c => c.type !== 'topic');
       const currentIndex = modalCards.findIndex(c => c.id === selectedCard.id);
       const totalCards = modalCards.length;

       const handlePrevCard = (e) => { e.stopPropagation(); if (currentIndex > 0) setSelectedCard(modalCards[currentIndex - 1]); };
       const handleNextCard = (e) => { e.stopPropagation(); if (currentIndex < totalCards - 1) setSelectedCard(modalCards[currentIndex + 1]); };

       return (
         <div className="card-modal-overlay" onClick={() => setShowModalAndSelectedCard(false)}>
           <div className="card-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal-button" onClick={() => setShowModalAndSelectedCard(false)}>✕</button>
              <Flashcard card={selectedCard} onUpdateCard={onUpdateCard} isInModal={true} showButtons={true} />
              <div className="card-modal-actions">
                 <div className="card-info">({currentIndex + 1} of {totalCards}) {currentSubject} | {currentTopic}</div>
                 <div className="nav-buttons">
                    <button onClick={handlePrevCard} disabled={currentIndex <= 0}>← Prev</button>
                    <button onClick={handleNextCard} disabled={currentIndex >= totalCards - 1}>Next →</button>
                 </div>
              </div>
           </div>
         </div>
       );
   };

  // --- END: REGULAR LOGIC & HELPER FUNCTIONS ---

  // --- START: JSX RETURN ---
  return (
    <div className="flashcard-list-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Color Editor Modal */}
      {colorEditorOpen && (
        <ColorEditor
          subjectColor={colorEditorState.color}
          onClose={closeColorEditor}
          onSelectColor={handleColorChange}
          subject={colorEditorState.subject}
        />
      )}

      {/* Print Modal */}
      {printModalOpen && (
        <PrintModal
          cards={cardsToPrint}
          title={printTitle}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {/* Card Modal */}
      {showModalAndSelectedCard && selectedCard && <CardModal />}

      {/* Main Accordion */}
      <div className="accordion-container" style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', padding: '0 10px' }}>
        {sortedSubjects.map(subjectData => renderSubject(subjectData))}
      </div>

      {/* Scroll Manager */}
      <ScrollManager
        expandedSubjects={expandedSubjects}
        expandedTopics={expandedTopics}
        subjectRefs={subjectRefs}
        topicRefs={topicRefs}
      />

      {/* Action Buttons */}
      <div className="list-actions">
        <button
          onClick={() => setShowTopicCreationModal(true)}
          className="create-topic-list-button button-primary"
        >
          <FaBolt style={{ marginRight: '8px' }} /> Create New Topic List
        </button>
      </div>

      {/* Topic Creation Modal */}
      {showTopicCreationModal && (
        <TopicCreationModal
          onClose={() => setShowTopicCreationModal(false)}
          onSaveTopicShells={handleSaveTopicShells}
          userId={"user123"}
          recordId={recordId}
          existingSubjects={getExistingSubjectNames}
        />
      )}

       {/* Delete Confirmation Modal Placeholder */}
       {showDeleteConfirmation && (
           <div className="confirmation-modal-overlay">
             <div className="confirmation-modal-content">
               <h4>Confirm Deletion</h4>
               <p>Are you sure you want to delete all {showDeleteConfirmation.count} cards for {showDeleteConfirmation.type === 'topic' ? `topic "${showDeleteConfirmation.topic}"` : `subject "${showDeleteConfirmation.subject}"`}?</p>
               <div className="confirmation-buttons">
                   <button className="button-danger" onClick={() => { showDeleteConfirmation.onConfirm(); }}>Yes, Delete</button>
                   <button className="button-secondary" onClick={() => setShowDeleteConfirmation(null)}>Cancel</button>
               </div>
             </div>
           </div>
       )}

    </div>
  );
  // --- END: JSX RETURN ---
};

export default FlashcardList;
