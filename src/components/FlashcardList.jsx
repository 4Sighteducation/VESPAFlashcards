import React, {useState, useEffect, useMemo, useRef, useCallback} from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import "./FlashcardList.css";
import { FaPrint, FaPlay, FaAngleUp, FaAngleDown, FaPalette, FaBars, FaTimes, FaBolt, FaTrash } from 'react-icons/fa';
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

const FlashcardList = ({ cards, onCardClick, onTopicClick, onSubjectClick, onDeleteCard, onDeleteTopic, onDeleteSubject, onRegenerateTopic }) => {
  // --- START: HOOK DEFINITIONS ---

  // 1. useState Hooks
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [expandedTopics, setExpandedTopics] = useState(new Set());
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
  const [slideshowCards, setSlideshowCards] = useState([]);
  const [slideshowTitle, setSlideshowTitle] = useState("");
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [groupedCards, setGroupedCards] = useState({});

  // 2. useRef Hooks
  const subjectRefs = useRef({});
  const topicRefs = useRef({});
  const menuRef = useRef({});
  
  // Define callbacks before any conditional returns
  const toggleSubject = useCallback((subject) => {
    setExpandedSubjects(prev => {
      const newState = new Set(prev);
      if (newState.has(subject)) {
        newState.delete(subject);
      } else {
        newState.add(subject);
      }
      return newState;
    });
  }, []);

  const toggleTopic = useCallback((subject, topic) => {
    const topicKey = `${subject}-${topic}`;
    setExpandedTopics(prev => {
      const newState = new Set(prev);
      if (newState.has(topicKey)) {
        newState.delete(topicKey);
      } else {
        newState.add(topicKey);
      }
      return newState;
    });
  }, []);
  
  // 3. useMemo Hooks
  const { groupedCards: memoizedGroupedCards } = useMemo(() => {
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

  // Add regroupCards callback here, before the early return
  const regroupCards = useCallback((cards) => {
    const bySubjectAndTopic = {};
    if (!Array.isArray(cards)) return {};

    cards.forEach(item => {
      if (!item || typeof item !== 'object' || !item.id || !item.subject) return;
      
        const subject = item.subject || "General";
        const topic = item.topic || "General";
        
        if (!bySubjectAndTopic[subject]) {
          bySubjectAndTopic[subject] = {};
        }
        if (!bySubjectAndTopic[subject][topic]) {
          bySubjectAndTopic[subject][topic] = [];
        }
        bySubjectAndTopic[subject][topic].push(item);
    });

    return bySubjectAndTopic;
  }, []);

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
            // First try to find a topic shell with metadata
            const topicShell = cardsInTopic.find(card => card.type === 'topic' && card.isShell);
            if (topicShell) {
              examBoard = topicShell.examBoard;
              examType = topicShell.examType;
              break;
            }
            // If no shell, try to find a card with metadata
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
    if (cards && cards.length > 0) {
      console.log("[FlashcardList] Initial load with cards:", cards);
      
      // Group cards by subject
      const subjects = [...new Set(cards.map(card => card.subject))];
      console.log("[FlashcardList] Found subjects:", subjects);
      
      // Expand the first subject by default
      if (subjects.length > 0) {
        setExpandedSubjects(new Set(subjects.map(subject => `${subject}-General`)));
      }

      // Force a re-render of the grouped cards
      const newGroupedCards = regroupCards(cards);
      console.log("[FlashcardList] Grouped cards:", newGroupedCards);
      setGroupedCards(newGroupedCards);

      // Initialize color mapping if not exists
      if (!subjectColorMapping || Object.keys(subjectColorMapping).length === 0) {
        const newColorMapping = {};
        subjects.forEach(subject => {
          if (!subjectColorMapping[subject]) {
            newColorMapping[subject] = {
              base: BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)],
              topics: {}
            };
          }
        });
        if (Object.keys(newColorMapping).length > 0) {
          updateColorMapping(newColorMapping);
        }
      }
    }
  }, [cards, regroupCards, subjectColorMapping, updateColorMapping]);

  // Add a new useEffect for handling card updates
  useEffect(() => {
    if (cards && cards.length > 0) {
      console.log("[FlashcardList] Cards updated, regrouping...");
      const newGroupedCards = regroupCards(cards);
      setGroupedCards(newGroupedCards);
    }
  }, [cards, regroupCards]);

  // Add a new useEffect for handling color mapping updates
  useEffect(() => {
    if (subjectColorMapping && Object.keys(subjectColorMapping).length > 0) {
      console.log("[FlashcardList] Color mapping updated:", subjectColorMapping);
      // Force a re-render to apply new colors
      setGroupedCards(prev => ({ ...prev }));
    }
  }, [subjectColorMapping]);

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

  const getContrastColor = (hexcolor) => {
    // Remove the # if present
    const hex = hexcolor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black or white based on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff';
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
    const isVisible = expandedTopics.has(topicKey);
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

  const renderTopic = (subject, topic, cards, topicColor) => {
    const topicKey = `${subject}-${topic}`;
    const isExpanded = expandedTopics.has(topicKey);
    const actualCards = cards.filter(item => item.type !== 'topic');
    const displayCount = actualCards.length;
    const textColor = getContrastColor(topicColor);

    // Add regeneration handler
    const handleRegenerateTopic = async (e) => {
              e.stopPropagation();
      const topicData = cards.find(card => card.type === 'topic' && card.isShell);
      if (!topicData) {
        console.error('No topic shell found for regeneration');
        return;
      }

      if (window.confirm('This will regenerate all cards for this topic. Existing cards will be preserved. Continue?')) {
        // Get metadata from the topic shell
        const { examBoard, examType } = topicData;
        
        // Call the WebSocket-based generation
        if (typeof handleSaveTopicShells === 'function') {
          const shell = {
            id: topicData.id,
            subject: subject,
            topic: topic,
            examBoard: examBoard,
            examType: examType,
            isShell: true,
      type: 'topic',
            regenerate: true // Add this flag to indicate regeneration
          };
          await handleSaveTopicShells([shell], true); // true indicates regeneration
        }
      }
    };

    return (
      <div key={topicKey} className="topic-container" ref={el => topicRefs.current[topicKey] = el}>
        <div
          className={`topic-header ${isExpanded ? 'expanded' : ''} ${displayCount === 0 ? 'empty-shell' : ''}`}
          style={{ backgroundColor: topicColor, color: textColor }}
          onClick={() => toggleTopic(subject, topic)}
        >
          <div className="topic-info">
            <h3>{topic}</h3>
            <div className="topic-meta">
              <span className="card-count">({displayCount} cards)</span>
              {cards.find(card => card.examType && card.examBoard) && (
                <>
                  <span className="exam-type">{cards[0].examType}</span>
                  <span className="exam-board">{cards[0].examBoard}</span>
                </>
              )}
          </div>
        </div>
          <div className="topic-actions">
                <button
              onClick={handleRegenerateTopic}
              className="regenerate-button"
              title="Regenerate topic cards"
            >
              <FaBolt />
                </button>
            {displayCount > 0 && (
              <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    startSlideshow(subject, topic, e);
                  }}
                  className="slideshow-button"
                    title="Start slideshow"
                  >
                  <FaPlay />
                  </button>
                  <button
                  onClick={(e) => handlePrintTopic(subject, topic, e)}
                  className="print-topic-button"
                  title="Print topic cards"
                >
                  <FaPrint />
                  </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openColorEditor(subject, topic, topicColor, e);
              }}
              className="color-edit-button"
              title="Edit topic color"
            >
              <FaPalette />
            </button>
            {isExpanded ? <FaAngleUp /> : <FaAngleDown />}
          </div>
        </div>
        {isExpanded && (
          <div className="topic-cards">
            {actualCards.map(card => (
              <Flashcard
                key={card.id}
                card={{ ...card, cardColor: topicColor }}
                onDelete={() => onDeleteCard(card.id)}
                onFlip={() => {}}
                onUpdateCard={onUpdateCard}
                onSelectCard={() => handleSetShowModalAndSelectedCard(card)}
              />
            ))}
          </div>
        )}
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
          const topicData = topicsData[topic];
          const topicColor = subjectColorMapping[subject]?.topics[topic]?.base || BRIGHT_COLORS[index % BRIGHT_COLORS.length];
          return (
            <div key={topicKey} className="topic-container">
              {renderTopic(subject, topic, topicData, topicColor)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSubjectMeta = (subject, metadata) => (
    <div className="subject-meta">
      <span className="exam-type">{metadata.examType}</span>
      <span className="exam-board">{metadata.examBoard}</span>
      <span className="last-modified">
        Last modified: {new Date(metadata.lastModified).toLocaleDateString()}
      </span>
    </div>
  );

  const renderTopicMeta = (topic, metadata) => (
    <div className="topic-meta">
      <span className="exam-type">{metadata.examType}</span>
      <span className="exam-board">{metadata.examBoard}</span>
      <span className="last-modified">
        Last modified: {new Date(metadata.lastModified).toLocaleDateString()}
      </span>
    </div>
  );

                return (
    <div className="flashcard-list">
      {Object.entries(groupedCards).map(([subject, subjectData]) => (
        <div 
          key={subject}
          className="subject-container"
          style={{ backgroundColor: subjectData.color }}
        >
          <div 
            className="subject-header"
            onClick={() => {
              toggleSubject(subject);
              onSubjectClick?.(subject);
            }}
          >
            <div className="subject-info">
              <h2>{subject}</h2>
              {renderSubjectMeta(subject, subjectData.metadata)}
                        </div>
            <div className="subject-actions">
              <button onClick={(e) => {
                e.stopPropagation();
                onDeleteSubject?.(subject);
              }}>
                <FaTrash />
              </button>
            </div>
          </div>

          {expandedSubjects.has(subject) && (
            <div className="topics">
              {Object.entries(subjectData.topics).map(([topic, topicData]) => (
                <div 
                  key={topic}
                  className="topic-container"
                  style={{ backgroundColor: topicData.color }}
                >
                  <div 
                    className="topic-header"
                    onClick={() => {
                      toggleTopic(subject, topic);
                      onTopicClick?.(topic);
                    }}
                  >
                    <div className="topic-info">
                      <h3>{topic}</h3>
                      {renderTopicMeta(topic, topicData.metadata)}
                      </div>
                      <div className="topic-actions">
                         <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegenerateTopic?.(topic, subject);
                        }}
                        title="Regenerate topic"
                        >
                          <FaBolt />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          onDeleteTopic?.(topic, subject);
                        }}
                        title="Delete topic"
                      >
                        <FaTrash />
                        </button>
                      </div>
                    </div>

                  {expandedTopics.has(topic) && (
                    <div className="cards">
                      {topicData.cards.map(card => (
                        <div 
                          key={card.id}
                          className="card"
                          onClick={() => onCardClick?.(card)}
                        >
                          <div className="card-content">
                            {card.question}
                                </div>
            <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCard?.(card);
                            }}
                            className="delete-card"
                          >
                            <FaTrash />
            </button>
          </div>
                      ))}
        </div>
      )}
      </div>
              ))}
        </div>
      )}
        </div>
      ))}
    </div>
  );
};

export default FlashcardList;