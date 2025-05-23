import React, {useState, useEffect, useMemo, useRef, useCallback} from "react";
import Flashcard from "./Flashcard";
import FlippableCard from "./FlippableCard"; // Add import for FlippableCard
import PrintModal from "./PrintModal";
import "./FlashcardList.css";
import ColorEditor from "./ColorEditor";
import TopicCreationModal from "./TopicCreationModal";
import { deleteSubject, deleteTopic } from "./FlashcardTopicHandler";
import FlashcardGeneratorBridge from './FlashcardGeneratorBridge';
import ErrorBoundary from './ErrorBoundary';
import { BRIGHT_COLORS, getContrastColor, generateShade, ensureValidColorMapping } from '../utils/ColorUtils';
import { dlog, dwarn, derr } from '../utils/logger'; 
import SubjectButton from './SubjectButton'; // <-- Import SubjectButton
import TopicListModal from './TopicListModal'; // <-- Import TopicListModal

// Helper function to chunk an array
const chunkArray = (array, size) => {
  const chunkedArr = [];
  if (!Array.isArray(array)) return chunkedArr; // Handle cases where array might not be ready
  for (let i = 0; i < array.length; i += size) {
    chunkedArr.push(array.slice(i, i + size));
  }
  return chunkedArr;
};

// ScrollManager component - Now handles subjects AND topics
const ScrollManager = ({ expandedSubjects, expandedTopics, subjectRefs, topicRefs }) => {
  // Track if the component is mounted
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const scrollToElement = (element, offset = 0) => {
    if (!element || !isMounted.current) return;
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = rect.top + scrollTop - offset;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };
  
  // Scroll to expanded subjects
  useEffect(() => {
    Object.entries(expandedSubjects).forEach(([subject, isExpanded]) => {
      if (isExpanded) {
        const subjectEl = subjectRefs.current[subject];
        if (subjectEl) setTimeout(() => scrollToElement(subjectEl, 10), 150);
      }
    });
  }, [expandedSubjects, subjectRefs]);
  
  // Scroll to expanded topics
  useEffect(() => {
    Object.entries(expandedTopics).forEach(([topicKey, isExpanded]) => {
      if (isExpanded) {
        const topicEl = topicRefs.current[topicKey];
        if (topicEl) setTimeout(() => scrollToElement(topicEl, 10), 150); // Scroll slightly below topic header
      }
    });
  }, [expandedTopics, topicRefs]); // Add dependencies
  
  return null;
};

// --- Define Helper Modals BEFORE FlashcardList ---

const FlashcardModal = ({ card, onClose, onUpdateCard, onDeleteCard }) => {
  const [isEditing, setIsEditing] = useState(false);
  // Ensure card properties exist before accessing
  const [editedFront, setEditedFront] = useState(card?.front || '');
  const [editedBack, setEditedBack] = useState(card?.back || '');

  // Update state if card prop changes
  useEffect(() => {
    setEditedFront(card?.front || '');
    setEditedBack(card?.back || '');
  }, [card]);

  const handleSave = () => {
    if (typeof onUpdateCard === 'function') {
      onUpdateCard({ ...card, front: editedFront, back: editedBack });
      setIsEditing(false);
    } else {
      derr("FlashcardModal: onUpdateCard prop is not a function!");
    }
    // onClose(); // Optionally close after save
  };

  const handleDelete = () => {
    if (typeof onDeleteCard === 'function') {
      if (window.confirm('Are you sure you want to delete this card?')) {
        onDeleteCard(card.id);
        onClose(); // Close after delete confirmation
      }
    } else {
      derr("FlashcardModal: onDeleteCard prop is not a function!");
    }
  };

  // Handle potential missing card prop
  if (!card) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content flashcard-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>&times;</button>
          <p>Error: Card data is missing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content flashcard-modal-content centered-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h3>Edit Flashcard</h3>
        {isEditing ? (
          <>
            <label>Front:</label>
            <textarea value={editedFront} onChange={(e) => setEditedFront(e.target.value)} />
            <label>Back:</label>
            <textarea value={editedBack} onChange={(e) => setEditedBack(e.target.value)} />
            <button onClick={handleSave}>Save Changes</button>
            <button onClick={() => setIsEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <div className="modal-card-front"><strong>Front:</strong> <pre>{card.front}</pre></div>
            <div className="modal-card-back"><strong>Back:</strong> <pre>{card.back}</pre></div>
            <button onClick={() => setIsEditing(true)}>Edit</button>
          </>
        )}
        <button onClick={handleDelete} className="delete-button" style={{ marginLeft: '10px' }}>Delete Card</button>
      </div>
    </div>
  );
};

const SlideshowModal = ({ cards, title, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Handle empty cards array
  if (!cards || cards.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content slideshow-modal-content centered-modal" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>&times;</button>
          <h2>{title}</h2>
          <p>No cards to display in slideshow.</p>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  // Extract topic color from card or use default
  const topicColor = currentCard?.cardColor || currentCard?.topicColor || currentCard?.subjectColor || '#3cb44b';
  
  // Reset flip state when changing cards
  const goToNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      // Loop back to beginning
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    } else {
      // Loop to end
      setCurrentIndex(cards.length - 1);
      setIsFlipped(false);
    }
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content slideshow-modal-content centered-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>{title} ({currentIndex + 1}/{cards.length})</h2>
        <div className="slideshow-card-container" style={{ width: '100%', height: '300px', margin: '20px 0' }}>
          <FlippableCard
            card={currentCard}
            isFlipped={isFlipped}
            onFlip={flipCard}
            isInModal={true}
          />
        </div>
        <div className="slideshow-controls">
          <button onClick={goToPrev} className="nav-button">Previous</button>
          <button onClick={flipCard} className="nav-button">Flip</button>
          <button onClick={goToNext} className="nav-button">Next</button>
        </div>
      </div>
    </div>
  );
};

// Delete confirmation modal - add this component
const DeleteConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="delete-confirm-actions">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
};

// --- Main FlashcardList Component ---

const FlashcardList = ({
  cards,
  onCardClick,
  onSubjectClick,
  onDeleteCard,
  onDeleteTopic,
  onDeleteSubject,
  onRegenerateTopic,
  onUpdateCard,
  onUpdateSubjectColor,
  subjectColorMapping: subjectColorMappingFromProps,
  propagateSaveToBridge,
  handleSaveTopicShells,
  recordId,
  userId,
  onOpenCreateTopicModal,
}) => {
  // --- START: HOOK DEFINITIONS ---

  // 1. useState Hooks
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [cardsToPrint, setCardsToPrint] = useState([]);
  const [printTitle, setPrintTitle] = useState("");
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCardForModal, setSelectedCardForModal] = useState(null);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [colorEditorState, setColorEditorState] = useState({ subject: null, topic: null, color: '#e6194b' });
  const [slideshowCards, setSlideshowCards] = useState([]);
  const [slideshowTitle, setSlideshowTitle] = useState("");
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [groupedCards, setGroupedCards] = useState({});
  const [subjectColorMapping, setSubjectColorMapping] = useState(() => ensureValidColorMapping(subjectColorMappingFromProps || {}));


  // Add new state for delete confirmation
  const [deleteConfirmState, setDeleteConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    itemToDelete: null,
    itemType: null, // "topic" or "subject"
    parentSubject: null // only for topics
  });
  const [showCardGenerator, setShowCardGenerator] = useState(false);
  const [generatorTopic, setGeneratorTopic] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState(new Set()); // State for expanded topics
  // Add state to track if we need to get userId from localStorage if not provided
  const [localUserId, setLocalUserId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // State to track open topic action menus
  const [openTopicMenus, setOpenTopicMenus] = useState({});

  // State to track open subject action menus
  const [openSubjectMenus, setOpenSubjectMenus] = useState({});

  // New state for TopicListModal
  const [isTopicListModalOpen, setIsTopicListModalOpen] = useState(false);
  const [activeSubjectForModal, setActiveSubjectForModal] = useState(null);

  // 2. useRef Hooks
  const subjectRefs = useRef({});
  const topicRefs = useRef({}); // Refs for topic elements

  // --- Define regroupCards and getExistingSubjectNames earlier --- 
  const regroupCards = useCallback((allCardsData, currentSubjectColorMapping) => {
    const bySubject = {};
    if (!Array.isArray(allCardsData)) return {};

    const cleanSubjectNameForDisplay = (name) => name.replace(/\s*\((A-Level|GCSE|AS-Level|BTEC|IB Diploma|National 5|Higher|Advanced Higher)\)$/i, '').trim();

    allCardsData.forEach(item => {
      if (!item || typeof item !== 'object' || !item.id || !item.subject) return;

      const originalSubjectName = item.subject || "General";
      const displaySubjectName = cleanSubjectNameForDisplay(originalSubjectName);
      const topicName = item.topic || "General";
      
      dlog(`[regroupCards] Processing item ID: ${item.id}, Original Subject: "${originalSubjectName}", Display Subject: "${displaySubjectName}", Topic: "${topicName}"`);

      if (!bySubject[displaySubjectName]) {
        const subjectColorInfo = currentSubjectColorMapping[originalSubjectName]; // Still use original for color mapping lookup
        bySubject[displaySubjectName] = {
          name: displaySubjectName, // Store the cleaned name for display
          originalName: originalSubjectName, // Store original for lookups if needed
          color: subjectColorInfo?.base || BRIGHT_COLORS[Object.keys(bySubject).length % BRIGHT_COLORS.length],
          examBoard: item.examBoard || "General",
          examType: item.examType || "Course",
          totalCardsInSubject: 0,
          topics: {}
        };
      }
      dlog(`[regroupCards] Subject entry for "${displaySubjectName}":`, JSON.parse(JSON.stringify(bySubject[displaySubjectName])));

      if (!bySubject[displaySubjectName].topics[topicName]) {
        const topicShell = allCardsData.find(shell => 
          shell.type === 'topic' && 
          shell.isShell && 
          (shell.subject === originalSubjectName || shell.subject === displaySubjectName) && // Check both original and display name
          (shell.topic === topicName || shell.name === topicName)
        );
        const subjectColorInfo = currentSubjectColorMapping[originalSubjectName]; // Use original for color mapping
        let topicDisplayColor = topicShell?.topicColor || 
                                topicShell?.cardColor || 
                                (subjectColorInfo?.topics?.[topicName]) ||
                                subjectColorInfo?.base ||
                                bySubject[displaySubjectName].color;

        bySubject[displaySubjectName].topics[topicName] = {
          id: topicShell?.id || `temp_topic_${displaySubjectName}_${topicName}`.replace(/\s+/g, '_'),
          name: topicName,
          color: topicDisplayColor,
          examBoard: topicShell?.examBoard || bySubject[displaySubjectName].examBoard,
          examType: topicShell?.examType || bySubject[displaySubjectName].examType,
          cardCount: 0,
          cards: []
        };
      }
      dlog(`[regroupCards] Topic entry for "${topicName}" under "${displaySubjectName}":`, JSON.parse(JSON.stringify(bySubject[displaySubjectName].topics[topicName])));
      
      dlog(`[regroupCards] Checking if item ID ${item.id} (${item.type}, isShell: ${item.isShell}) is a card to be added.`);
      if (item.type !== 'topic' && !item.isShell) {
        bySubject[displaySubjectName].topics[topicName].cards.push(item);
        bySubject[displaySubjectName].topics[topicName].cardCount++;
        bySubject[displaySubjectName].totalCardsInSubject++;
        dlog(`[regroupCards] ADDED card ID ${item.id} to ${displaySubjectName} -> ${topicName}. Current topic card count: ${bySubject[displaySubjectName].topics[topicName].cardCount}`);
        dlog(`[regroupCards] Total cards for subject ${displaySubjectName}: ${bySubject[displaySubjectName].totalCardsInSubject}`);
      }
    });
    dlog("[regroupCards] Final grouped structure:", JSON.parse(JSON.stringify(bySubject)));
    return bySubject;
  }, [BRIGHT_COLORS]);

  const getExistingSubjectNames = useMemo(() => {
    // Depends on groupedCards which is defined above this point in component flow
    return Object.keys(groupedCards || {});
  }, [groupedCards]);
  // --- End moved definitions ---

  // Try to get userId from localStorage if not provided
  useEffect(() => {
    if (!userId && !localUserId) {
      try {
        const authData = localStorage.getItem('flashcards_auth');
        if (authData) {
          const parsedAuth = JSON.parse(authData);
          if (parsedAuth && parsedAuth.id) {
            dlog("[FlashcardList] Retrieved userId from localStorage:", parsedAuth.id);
            setLocalUserId(parsedAuth.id);
          }
        }
      } catch (error) {
        derr("[FlashcardList] Error getting userId from localStorage:", error);
      }
    }
  }, [userId, localUserId]);

useEffect(() => {
  dlog("[FlashcardList] subjectColorMappingFromProps updated in prop, syncing local state:", subjectColorMappingFromProps);
  setSubjectColorMapping(ensureValidColorMapping(subjectColorMappingFromProps || {}));
}, [subjectColorMappingFromProps]);

  
  // 3. useCallback Hooks for State Updates & Grouping
  const updateColorMapping = useCallback((newMapping) => {
    setSubjectColorMapping(prev => {
      const merged = { ...prev };
      for (const subject in newMapping) {
        merged[subject] = {
          base: newMapping[subject].base || prev[subject]?.base || '#cccccc', // Ensure base exists
          topics: { ...(prev[subject]?.topics || {}), ...(newMapping[subject].topics || {}) } // Merge topics
        };
      }
      dlog("[updateColorMapping] New state:", merged);
      return merged;
    });
  }, []);

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
    // Call the optional prop if provided
    if (typeof onSubjectClick === 'function') {
      onSubjectClick(subject);
    }
  }, [onSubjectClick]);

  // Toggle topic expansion
  const toggleTopic = useCallback((topicKey) => {
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

  // Regroup cards whenever the 'cards' prop changes
  useEffect(() => {
    dlog("[FlashcardList regroup useEffect] Cards prop changed:", cards);
    // Pass the current subjectColorMapping to regroupCards
    const bySubjectAndTopic = regroupCards(cards, subjectColorMapping);
    dlog("[FlashcardList regroup useEffect] Setting grouped cards:", bySubjectAndTopic);
    setGroupedCards(bySubjectAndTopic);
  }, [cards, regroupCards, subjectColorMapping]); // Add subjectColorMapping dependency

  // --- START: Function to toggle topic menus ---
  const toggleTopicMenu = useCallback((topicKey, e) => {
    e.stopPropagation();
    const buttonElement = e.currentTarget;
    const topicParentContainer = buttonElement.closest('.topic-container'); // The li/div for the specific topic
    const menuElement = buttonElement.nextElementSibling; // Should be .topic-actions-menu
    const subjectGrandparentContainer = topicParentContainer?.closest('.subject-container');
    // Attempt to find the scrollable topics list within the current subject
    const topicsListContainer = subjectGrandparentContainer?.querySelector('.topics-container');

    setOpenTopicMenus(prev => {
      const isCurrentlyOpen = !!prev[topicKey];
      const isOpeningNow = !isCurrentlyOpen;

      // Reset styles for previously open menus and their containers
      Object.keys(prev).forEach(key => {
        if (prev[key] && key !== topicKey) {
          const oldTopicRef = topicRefs.current[key];
          if (oldTopicRef) {
            oldTopicRef.style.overflow = '';
            oldTopicRef.classList.remove('topic-menu-active');
            const oldMenu = oldTopicRef.querySelector('.topic-actions-menu');
            if (oldMenu) oldMenu.classList.remove('menu-opens-downward');
            
            const oldSubjectContainer = oldTopicRef.closest('.subject-container');
            if (oldSubjectContainer) {
              oldSubjectContainer.style.overflow = '';
              oldSubjectContainer.classList.remove('subject-hosting-active-topic-menu');
              const oldTopicsList = oldSubjectContainer.querySelector('.topics-container');
              if (oldTopicsList) oldTopicsList.style.overflowY = 'auto'; // Restore scroll
            }
          }
        }
      });

      if (isOpeningNow) {
        if (topicParentContainer && menuElement && subjectGrandparentContainer) {
          topicParentContainer.style.overflow = 'visible'; // Topic item itself
          topicParentContainer.classList.add('topic-menu-active');
          subjectGrandparentContainer.style.overflow = 'visible'; // Subject container
          subjectGrandparentContainer.classList.add('subject-hosting-active-topic-menu');

          setTimeout(() => {
            if (menuElement && menuElement.classList.contains('active')) {
              const buttonRect = buttonElement.getBoundingClientRect();
              const menuHeight = menuElement.offsetHeight;
              const subjectHeader = subjectGrandparentContainer.querySelector('.subject-header');
              let subjectHeaderBottom = 0;
              if (subjectHeader) subjectHeaderBottom = subjectHeader.getBoundingClientRect().bottom;
              const thresholdBelowHeader = 5;

              // dlog(`[Topic: ${topicKey}] Menu Active. BT: ${buttonRect.top.toFixed(2)}, MH: ${menuHeight}, SHB: ${subjectHeaderBottom.toFixed(2)}`);

              if (menuHeight > 0 && (buttonRect.top - menuHeight) < (subjectHeaderBottom + thresholdBelowHeader)) {
                // dlog(`%c[Topic: ${topicKey}] Decision: Opening Downwards (clipped by subject header)`, 'color: blue;');
                menuElement.classList.add('menu-opens-downward');
                // AGGRESSIVE OVERRIDE FOR TOPICS LIST SCROLLING
                if (topicsListContainer) topicsListContainer.style.overflowY = 'visible';
              } else {
                // dlog(`%c[Topic: ${topicKey}] Decision: Opening Upwards`, 'color: green;');
                menuElement.classList.remove('menu-opens-downward');
                // Ensure topics list is scrollable if menu opens upwards normally
                if (topicsListContainer) topicsListContainer.style.overflowY = 'auto';
              }
            } else {
              // dwarn(`[Topic: ${topicKey}] Menu NOT active in setTimeout.`);
            }
          }, 50);
        }
      } else { // Closing menu
        if (topicParentContainer) {
          topicParentContainer.style.overflow = '';
          topicParentContainer.classList.remove('topic-menu-active');
        }
        if (menuElement) menuElement.classList.remove('menu-opens-downward');
        if (subjectGrandparentContainer) {
          if (!subjectGrandparentContainer.classList.contains('subject-menu-active')) {
            subjectGrandparentContainer.style.overflow = '';
          }
          subjectGrandparentContainer.classList.remove('subject-hosting-active-topic-menu');
        }
        // Restore scrolling on the topics list when any topic menu is closed
        if (topicsListContainer) topicsListContainer.style.overflowY = 'auto';
      }
      return isOpeningNow ? { [topicKey]: true } : {}; 
    });
  }, [topicRefs]);
  // --- END: Function to toggle topic menus ---

  // --- START: Function to toggle subject menus ---
  const toggleSubjectMenu = useCallback((subjectKey, e) => {
    e.stopPropagation();
    const buttonElement = e.currentTarget;
    const parentContainer = buttonElement.closest('.subject-container');
    const menuElement = buttonElement.nextElementSibling; // Should be .subject-actions-menu

    setOpenSubjectMenus(prev => {
      const isCurrentlyOpen = !!prev[subjectKey];
      const isOpeningNow = !isCurrentlyOpen;

      Object.keys(prev).forEach(key => {
        if (prev[key] && key !== subjectKey) {
          const previouslyAttachedRef = subjectRefs.current[key];
          if (previouslyAttachedRef) {
            previouslyAttachedRef.style.overflow = '';
            previouslyAttachedRef.classList.remove('subject-menu-active');
            const oldMenu = previouslyAttachedRef.querySelector('.subject-actions-menu');
            if (oldMenu) oldMenu.classList.remove('menu-opens-downward');
          }
        }
      });
      
      if (isOpeningNow) {
        if (parentContainer && menuElement) {
          parentContainer.style.overflow = 'visible';
          parentContainer.classList.add('subject-menu-active');
          setTimeout(() => {
            if (menuElement && menuElement.classList.contains('active')) {
              const buttonRect = buttonElement.getBoundingClientRect();
              const menuHeight = menuElement.offsetHeight;
              const viewportHeight = window.innerHeight;
              const viewportTopThreshold = 10;
              dlog(`[Subject: ${subjectKey}] Menu Active. ButtonTop: ${buttonRect.top.toFixed(2)}, MenuHeight: ${menuHeight}, ViewportHeight: ${viewportHeight}`);
              if (menuHeight > 0 && (buttonRect.top - menuHeight) < viewportTopThreshold) {
                dlog(`%c[Subject: ${subjectKey}] সিদ্ধান্ত: Opening Downwards`, 'color: blue;');
                menuElement.classList.add('menu-opens-downward');
              } else {
                dlog(`%c[Subject: ${subjectKey}] সিদ্ধান্ত: Opening Upwards (or menuHeight is 0 or not enough space above)`, 'color: green;');
                menuElement.classList.remove('menu-opens-downward');
              }
            } else {
              dwarn(`[Subject: ${subjectKey}] Menu NOT active or not found in setTimeout when trying to set direction.`);
            }
          }, 50); // Increased timeout slightly to 50ms
        }
      } else {
        if (parentContainer) {
          parentContainer.style.overflow = '';
          parentContainer.classList.remove('subject-menu-active');
        }
        if (menuElement) menuElement.classList.remove('menu-opens-downward');
      }
      return isOpeningNow ? { [subjectKey]: true } : {};
    });
  }, [subjectRefs]);
  // --- END: Function to toggle subject menus ---

  // 4. useCallback Hooks (Define functions needed by useMemo/useEffect first)
   const getExamInfo = useCallback((subject) => {
      if (!groupedCards || !groupedCards[subject]) return { examType: "Course", examBoard: "General" };
      try {
          let examBoard = "General"; // Default
          let examType = "Course"; // Default
          let foundMetadata = false;

          const subjectTopics = groupedCards[subject];
          if (subjectTopics) {
              for (const topicName in subjectTopics) {
                  const itemsInTopic = subjectTopics[topicName]; // Can contain shells and cards
                  if (itemsInTopic && itemsInTopic.length > 0) {
                      // Prioritize finding a topic shell with metadata
                      const topicShell = itemsInTopic.find(item =>
                          item.type === 'topic' && item.isShell && (item.examBoard || item.examType)
                      );
                      if (topicShell) {
                          examBoard = topicShell.examBoard || examBoard; // Use shell's or keep default
                          examType = topicShell.examType || examType; // Use shell's or keep default
                          foundMetadata = true;
                          break; // Found definitive metadata from shell
                      }

                      // If no shell with metadata, try to find *any* card with metadata
                      if (!foundMetadata) {
                          const cardWithMetadata = itemsInTopic.find(item =>
                              item.type !== 'topic' && (item.examBoard || item.examType)
                          );
                          if (cardWithMetadata) {
                              examBoard = cardWithMetadata.examBoard || examBoard;
                              examType = cardWithMetadata.examType || examType;
                              // Don't break here, a shell might still exist in another topic
                          }
                      }
                  }
              }
          }
          dlog(`[getExamInfo - ${subject}] Found: Type=${examType}, Board=${examBoard}`);
          return { examType, examBoard };
      } catch (error) {
          derr(`Error in getExamInfo for subject ${subject}:`, error);
          return { examType: "Course", examBoard: "General" }; // Fallback on error
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
    dlog("[FlashcardList] Recalculating sortedSubjects. Current groupedCards:", groupedCards);

    const subjectsArray = Object.values(groupedCards).map(subjectDetails => ({
      id: subjectDetails.name,
      title: subjectDetails.name,
      color: subjectDetails.color,
      exam_type: subjectDetails.examType,
      exam_board: subjectDetails.examBoard,
      totalTopics: Object.keys(subjectDetails.topics).length,
      totalCards: subjectDetails.totalCardsInSubject,
      // creationDate can be derived if needed, or we can simplify this part
      // For now, let's sort by name for predictability
    }));

    return subjectsArray.sort((a, b) => a.title.localeCompare(b.title));
  }, [groupedCards]);

  // Chunk subjects for rendering
  const subjectChunks = useMemo(() => chunkArray(sortedSubjects, 3), [sortedSubjects]);

  // 5. useEffect Hooks
  useEffect(() => {
    if (cards && cards.length > 0) {
      dlog("[FlashcardList] Initial load with cards:", cards);
      
      // Group cards by subject
      const subjects = [...new Set(cards.map(card => card.subject))];
      dlog("[FlashcardList] Found subjects:", subjects);
      
      // Expand the first subject by default
      if (subjects.length > 0) {
        setExpandedSubjects(new Set(subjects.map(subject => `${subject}-General`)));
      }

      // Force a re-render of the grouped cards
      const newGroupedCards = regroupCards(cards, subjectColorMapping);
      dlog("[FlashcardList] Grouped cards:", newGroupedCards);
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

  // Update this useEffect to use the state and update function
 useEffect(() => {
    dlog("[FlashcardList] Cards prop updated:", cards);
    if (cards && cards.length > 0) {
        // --- 1. Regroup Cards ---
        const newGroupedCards = regroupCards(cards, subjectColorMapping);
        dlog("[FlashcardList] Regrouped cards:", newGroupedCards);
        setGroupedCards(newGroupedCards);

        // --- 2. Update Color Mapping --- // THIS SECTION IS NOW GONE

        // --- 3. Expand First Subject (Optional) ---
        // const subjects = Object.keys(newGroupedCards); // You'd need this if re-enabling below
        // if (subjects.length > 0 && expandedSubjects.size === 0) {
        //     // setExpandedSubjects(new Set([subjects[0]])); 
        // }

    } else {
        setGroupedCards({});
    }
}, [cards, regroupCards, expandedSubjects.size, subjectColorMapping]); // REMOVED subjectColorMapping and updateColorMapping from dependencies here


  // --- Modify handleAddGeneratedCards ---
  const handleAddGeneratedCards = useCallback((generatedCards) => {
    dlog("[FlashcardList] handleAddGeneratedCards called with:", generatedCards);
    if (!recordId) {
      derr("[FlashcardList] Cannot add generated cards: Missing recordId.");
      alert("Error: Cannot save cards, record ID is missing.");
      return;
    }
    if (!Array.isArray(generatedCards) || generatedCards.length === 0) {
      dwarn("[FlashcardList] No valid cards received to add.");
      return;
    }

    // Show saving indicator
    setIsSaving(true);
    setSaveError(null);

    try {
      // --- Use the prop function instead of finding iframe directly ---
      if (typeof propagateSaveToBridge === 'function') {
        dlog("[FlashcardList] Calling propagateSaveToBridge for ADD_TO_BANK");
        
        // Call the save bridge method
        propagateSaveToBridge({
          type: 'ADD_TO_BANK',
          recordId: recordId,
          cards: generatedCards // Send the array of card objects
        });

        // Set a timeout to auto-refresh the page if we don't get a response
        const timeoutId = setTimeout(() => {
          dlog("[FlashcardList] Save operation (ADD_TO_BANK) timeout - refreshing page"); // Clarified log
          setIsSaving(false);
          window.location.reload(); // Consider less drastic fallback? Maybe just show error?
        }, 15000); // Increased timeout slightly to 15 seconds

        // Listen for the ADD_TO_BANK_RESULT message from the parent
        // --- FIX: Listen for ADD_TO_BANK_RESULT specifically --- 
        const handleAddResult = (event) => {
          // --- FIX: Check for ADD_TO_BANK_RESULT type --- 
          if (event.data && event.data.type === 'ADD_TO_BANK_RESULT') {
            clearTimeout(timeoutId); // Clear the timeout
            window.removeEventListener('message', handleAddResult); // Clean up listener
            setIsSaving(false); // Hide saving indicator
            
            if (event.data.success) {
              dlog("[FlashcardList] ADD_TO_BANK operation successful. Requesting data refresh.");
              // --- Request data refresh AFTER successful add --- 
              if (propagateSaveToBridge) {
                  dlog(`[FlashcardList] Sending REQUEST_UPDATED_DATA for recordId: ${recordId}`);
                  propagateSaveToBridge({
                      type: 'REQUEST_UPDATED_DATA',
                      recordId: recordId // FIX: Ensure recordId is directly on the payload
                  });
              } else {
                  dwarn("[FlashcardList] Cannot request updated data: propagateSaveToBridge is missing.");
              }
              // -------------------------------------------------
            } else {
              derr("[FlashcardList] ADD_TO_BANK operation failed:", event.data.error);
              setSaveError(event.data.error || "Failed to add cards to bank"); // Use error from message
            }
          }
        };

        window.addEventListener('message', handleAddResult); // Use the correct listener name
      } else {
        setIsSaving(false);
        derr("[FlashcardList] propagateSaveToBridge function is not available.");
        alert("Error: Could not communicate with the saving mechanism (prop missing).");
      }
    } catch (error) {
      setIsSaving(false);
      setSaveError(error.message || "An error occurred while saving cards");
      derr("[FlashcardList] Error in handleAddGeneratedCards:", error);
    }
  }, [recordId, propagateSaveToBridge]); // Add propagateSaveToBridge dependency
  // -------------------------------------------

  // Loading overlay component for save operation
  const SaveLoadingOverlay = () => {
    if (!isSaving) return null;
    
    return (
      <div className="save-loading-overlay">
        <div className="save-loading-content">
          <div className="save-spinner"></div>
          <p>Saving cards to your collection...</p>
          <p className="save-tip">This may take a few seconds. Please don't close this window.</p>
        </div>
      </div>
    );
  };

  // Error message component for save operation
  const SaveErrorMessage = () => {
    if (!saveError) return null;
    
    return (
      <div className="save-error-message">
        <p>Error saving cards: {saveError}</p>
        <button onClick={() => setSaveError(null)}>Dismiss</button>
      </div>
    );
  };

  // --- END: HOOK DEFINITIONS ---

  // --- START: EVENT HANDLERS & HELPER FUNCTIONS ---

  const handleCardClick = (card) => {
    dlog("Card clicked:", card);
    setSelectedCardForModal(card);
    setShowCardModal(true);
    if (typeof onCardClick === 'function') {
      onCardClick(card);
    }
  };

  // Helper functions (defined after hooks)
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

  const startSlideshow = useCallback((subject, topic, e, cardsForSlideshow = null) => {
    if (e) e.stopPropagation(); // Keep this if called from event handlers

    let actualCards = cardsForSlideshow;
    let slideshowTitleToUse = "Slideshow";

    if (!actualCards) { // If cards not directly passed, derive them
        if (topic && subject && groupedCards?.[subject]?.topics?.[topic]) {
            actualCards = (groupedCards[subject].topics[topic].cards || []).filter(item => item.type !== 'topic');
            slideshowTitleToUse = subject; // Only subject name for title as per previous request
        } else if (subject && groupedCards?.[subject]) {
            actualCards = [];
            Object.values(groupedCards[subject].topics).forEach(topicDetails => {
                actualCards.push(...(topicDetails.cards || []).filter(item => item.type !== 'topic'));
            });
            slideshowTitleToUse = subject;
        } else {
            actualCards = []; // Fallback
        }
    } else { // Cards were passed directly, use them
        slideshowTitleToUse = subject; // Still only subject for title
        if(topic) slideshowTitleToUse = subject; // Keep it as subject even if topic context was there
    }
    
    // Always create placeholder for empty topics/subjects
    if (actualCards.length === 0) {
      dlog(`No cards found for slideshow: ${slideshowTitleToUse}. Creating placeholder.`);
      actualCards = [
        {
          id: `placeholder-${Date.now()}`,
          front: `No cards generated for this topic yet.`, 
          back: 'Click the "lightning" button to generate cards.',
          subject: subject,
          topic: topic || 'General'
        }
      ];
    }
    
    setSlideshowCards(actualCards);
    setSlideshowTitle(slideshowTitleToUse);
    setShowSlideshow(true);
  }, [groupedCards]);

  const openColorEditor = (subject, topic = null, currentColor, e) => {
    e.stopPropagation();
    // Use the color from the state mapping if available, otherwise fallback
    const colorFromState = topic
      ? subjectColorMapping[subject]?.topics[topic]?.base
      : subjectColorMapping[subject]?.base;
    setColorEditorState({ subject, topic, color: colorFromState || currentColor || '#e6194b' });
    setColorEditorOpen(true);
  };

  const closeColorEditor = () => {
    setColorEditorOpen(false);
    setColorEditorState({ subject: null, topic: null, color: '#e6194b' });
  };

  const handleColorChange = (newColor, applyToTopics = false) => {
    const { subject, topic } = colorEditorState;
    if (subject) {
      // Update local state immediately for responsiveness
      setSubjectColorMapping(prev => {
        const newMapping = { ...prev };
        if (topic && !applyToTopics) { // Only update specific topic if applyToTopics is false
          // Update topic color
          if (!newMapping[subject]) newMapping[subject] = { base: '#f0f0f0', topics: {} }; // Initialize if somehow missing
          if (!newMapping[subject].topics) newMapping[subject].topics = {};
          newMapping[subject].topics[topic] = { base: newColor };
        } else { // Update subject base color (and potentially all topics if applyToTopics is true)
          // Update subject base color
           if (!newMapping[subject]) newMapping[subject] = { topics: {} }; // Initialize if somehow missing
          newMapping[subject].base = newColor;
          // Logic to update topic shades based on new subject color will be handled by parent if applyToTopics is true
        }
        return newMapping;
      });

      // Notify parent component to handle persistence/global state
      if (typeof onUpdateSubjectColor === 'function') {
          // Pass subject, topic (or null), new color, AND the applyToTopics flag
          onUpdateSubjectColor(subject, topic, newColor, applyToTopics);
      } else {
          dwarn("onUpdateSubjectColor prop is not defined. Color changes might not persist.");
      }
    }
    closeColorEditor();
  };

  // Handle delete topic
  const handleDeleteTopic = async (subject, topic) => {
    // Open delete confirm modal instead of using window.confirm
    setDeleteConfirmState({
      isOpen: true,
      title: "Delete Topic",
      message: `Are you sure you want to delete the topic "${topic}" and all its cards? This cannot be undone.`,
      itemToDelete: topic,
      itemType: "topic",
      parentSubject: subject
    });
  };
  
  // Handle delete subject
  const handleDeleteSubject = async (subject) => {
    // Open delete confirm modal instead of using window.confirm
    setDeleteConfirmState({
      isOpen: true,
      title: "Delete Subject",
      message: `Are you sure you want to delete the subject "${subject}" and ALL its topics and cards? This cannot be undone.`,
      itemToDelete: subject,
      itemType: "subject",
      parentSubject: null
    });
  };
  
  // Modify the confirmDelete function to use the handlers directly if props aren't provided
  const confirmDelete = async () => {
    const { itemToDelete, itemType, parentSubject } = deleteConfirmState;
    
    try {
      // Add debug logging
      dlog(`[FlashcardList] Attempting to delete ${itemType}. Handlers available:`, {
        deleteSubject: typeof onDeleteSubject === 'function' ? 'Available' : 'Not available',
        deleteTopic: typeof onDeleteTopic === 'function' ? 'Available' : 'Not available',
        itemToDelete,
        parentSubject
      });
      
      if (itemType === "topic") {
        if (typeof onDeleteTopic === 'function') {
          // Use the prop if provided
          dlog(`[FlashcardList] Calling onDeleteTopic(${itemToDelete}, ${parentSubject})`);
          await onDeleteTopic(itemToDelete, parentSubject);
        } else {
          // Fall back to direct handler
          dlog(`[FlashcardList] Using direct deleteTopic(${itemToDelete}, ${parentSubject})`);
          await deleteTopic(itemToDelete, parentSubject);
        }
        dlog(`Topic deleted: ${parentSubject} - ${itemToDelete}`);
      } else if (itemType === "subject") {
        if (typeof onDeleteSubject === 'function') {
          // Use the prop if provided
          dlog(`[FlashcardList] Calling onDeleteSubject(${itemToDelete})`);
          await onDeleteSubject(itemToDelete);
        } else {
          // Fall back to direct handler
          dlog(`[FlashcardList] Using direct deleteSubject(${itemToDelete})`);
          await deleteSubject(itemToDelete);
        }
        dlog(`Subject deleted: ${itemToDelete}`);
      } else {
        throw new Error("No handler available");
      }
    } catch (error) {
      derr(`Error deleting ${itemType}:`, error);
      alert(`Error deleting ${itemType}: ${error.message}`);
    } finally {
      // Close the modal regardless of outcome
      setDeleteConfirmState({ isOpen: false, title: "", message: "", itemToDelete: null, itemType: null, parentSubject: null });
    }
  };
  
  // Cancel deletion
  const cancelDelete = () => {
    setDeleteConfirmState({ isOpen: false, title: "", message: "", itemToDelete: null, itemType: null, parentSubject: null });
  };

  // --- Handle Card Deletion from List View ---
  const handleCardDeleteInList = useCallback((cardId) => {
    if (typeof onDeleteCard === 'function') {
      // Confirmation might be desired here as well, but for now, directly call onDeleteCard prop
      dlog(`[FlashcardList] Deleting card ${cardId} from list view.`);
      onDeleteCard(cardId); 
    } else {
      derr("[FlashcardList] onDeleteCard prop is not available.");
    }
  }, [onDeleteCard]);

  const renderTopic = (subject, topic, items, topicColor) => {
    // --- Ensure items is an array ---
    const validItems = Array.isArray(items) ? items : [];
    // --------------------------------
    const topicShell = validItems.find(item => item.type === 'topic' && item.isShell);
    const actualCards = validItems.filter(item => item.type !== 'topic');
    const displayCount = actualCards.length;
    const textColor = getContrastColor(topicColor);
    const examBoard = topicShell?.examBoard || "General";
    const examType = topicShell?.examType || "Course";
    const topicKey = `${subject}-${topic}`; // Unique key for state/refs

    // Handle topic print click
    const handlePrintTopicClick = (e) => {
      e.stopPropagation();
      dlog(`Printing ${displayCount} cards for topic: ${topic}`);
      openPrintModal(actualCards, `${subject} - ${topic}`);
    };

    // Handle topic delete click
    const handleDeleteTopicClick = (e) => {
      e.stopPropagation();
      handleDeleteTopic(subject, topic);
    };

    // Handle regenerating topic / opening generator
    const handleRegenerateTopicClick = async (e) => {
      e.stopPropagation();
      // Find the shell - crucial for metadata
      const topicShell = validItems.find(item => item.type === 'topic' && item.isShell);

      if (!topicShell && validItems.length > 0) {
        // Fallback: If no shell, try to use metadata from the first actual card
        const firstCard = validItems.find(item => item.type === 'card');
        dwarn(`No topic shell found for regeneration of '${topic}'. Using first card's metadata as fallback.`);
        setGeneratorTopic({
          subject: subject,
          topic: topic,
          name: topic, // Keep name consistent with topic
          color: topicColor,
          cardColor: topicColor,
          examBoard: firstCard?.examBoard || "AQA", // Use card's or default
          examType: firstCard?.examType || "A-Level", // Use card's or default
          id: `topic_${subject}_${topic}` // Generate a temporary ID if shell ID is missing
        });
      } else if (topicShell) {
        setGeneratorTopic({
          subject: subject,
          topic: topic,
          name: topicShell.name || topic, // Use shell name or topic name
          color: topicColor,
          cardColor: topicColor,
          examBoard: topicShell.examBoard || "AQA",
          examType: topicShell.examType || "A-Level",
          id: topicShell.id, // Use the shell's ID
          ...topicShell // Include all other topic shell properties
        });
      } else {
        derr('No topic shell or cards found to derive metadata for regeneration');
        alert('Cannot generate cards: Topic information is missing.');
        return;
      }

      setShowCardGenerator(true);
    };

    // Handle slideshow functionality for topic - this will now be the primary action when clicking the topic
    const handleSlideshowTopicClick = (e) => {
      e.stopPropagation();
      startSlideshow(subject, topic, e);
    };

    return (
      <div 
        key={topicKey} 
        className="topic-container"
        ref={el => topicRefs.current[topicKey] = el}
        onClick={handleSlideshowTopicClick} // Open slideshow on click of entire topic
      >
        <div
  className={`topic-header ${displayCount === 0 ? 'empty-shell' : ''}`}
style={{ backgroundColor: topicColor, color: getContrastColor(topicColor) }}
>

          <div className="topic-info">
            <h3>{topic}</h3>
            <div className="topic-meta">
              <span className="card-count">({displayCount} cards)</span>
              <span className="exam-type">{examType}</span>
              <span className="exam-board">{examBoard}</span>
            </div>
          </div>
          <div className="topic-actions">
            {/* Hamburger Toggle Button - Add mobile-only class */}
            <button 
              className="topic-actions-toggle mobile-only"
              onClick={(e) => toggleTopicMenu(topicKey, e)}
              aria-label="Toggle topic actions"
            >
              &#x22EE; {/* Vertical ellipsis */} 
            </button>

            {/* Action Buttons Menu - Hidden on mobile unless active */}
            <div className={`topic-actions-menu ${openTopicMenus[topicKey] ? 'active' : ''}`}>
              <button
                onClick={handleRegenerateTopicClick}
                className="nav-button regenerate-button"
                title="Generate topic cards"
              >
                <span className="button-icon">⚡</span>
                <span className="button-text mobile-only">Generate Cards</span> {/* Text for menu view */}
              </button>
              <button
                onClick={handleSlideshowTopicClick}
                className="nav-button slideshow-button"
                title="View cards as slideshow"
                disabled={displayCount === 0}
              >
                <span className="button-icon">🔄</span>
                <span className="button-text mobile-only">Slideshow</span>
              </button>
              <button
                onClick={handlePrintTopicClick}
                className="nav-button print-topic-button"
                title="Print topic cards"
                disabled={displayCount === 0}
              >
                <span className="button-icon">🖨️</span>
                <span className="button-text mobile-only">Print</span>
              </button>
              <button
                onClick={handleDeleteTopicClick}
                className="nav-button delete-topic-button"
                title="Delete topic and cards"
              >
                <span className="button-icon">🗑️</span>
                <span className="button-text mobile-only">Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

    const renderTopics = (subject, subjectColor) => {
    const topicsData = groupedCards[subject] || {};
    const topicNames = Object.keys(topicsData).sort((a, b) => a.localeCompare(b));

    return (
      <div className="topics-container">
        {topicNames.map((topic, index) => {
          const topicItems = topicsData[topic] || []; // Get items for the current topic, default to empty array

          // Now, correctly define topicShellOrFirstCard using topicItems
          const topicShellOrFirstCard = topicItems.find(item => item.type === 'topic' && item.isShell) || topicItems[0];
          
          let topicDisplayColor = topicShellOrFirstCard?.topicColor || 
                                 topicShellOrFirstCard?.cardColor ||   
                                 (subjectColorMapping[subject]?.topics?.[topic]) || 
                                 subjectColor; 
          
          if (!topicDisplayColor || (typeof topicDisplayColor === 'string' && !topicDisplayColor.startsWith('#') && !topicDisplayColor.toLowerCase().startsWith('hsl'))) {
              dwarn(`[FlashcardList renderTopics] Invalid topicDisplayColor for ${subject} - ${topic}: '${topicDisplayColor}'. Defaulting to subject color '${subjectColor}'.`);
              topicDisplayColor = subjectColor; 
          }
          
          return (
            renderTopic(subject, topic, topicItems, topicDisplayColor) // Pass the calculated topicDisplayColor
          );
        })}
      </div>
    );
  };

  const handleOpenTopicListModal = useCallback((subjectDataForModal) => {
    dlog("[FlashcardList] Opening TopicListModal for subject:", subjectDataForModal);
    // The subjectDataForModal should be the rich object from sortedSubjects
    // We need to find the full subject detail from groupedCards to pass all topics
    const fullSubjectDetails = groupedCards[subjectDataForModal.id];
    if (fullSubjectDetails) {
      setActiveSubjectForModal(fullSubjectDetails); // Pass the full subject object with its topics
      setIsTopicListModalOpen(true);
    } else {
      derr("Could not find full details for subject to open modal:", subjectDataForModal.id);
    }
  }, [groupedCards]);

  const handleCloseTopicListModal = useCallback(() => {
    setIsTopicListModalOpen(false);
    setActiveSubjectForModal(null);
  }, []);

  const handleSubjectAction = useCallback((actionType, subjectName) => {
    dlog(`[FlashcardList] Subject Action: ${actionType} for ${subjectName}`);
    const subjectDetails = groupedCards[subjectName];
    if (!subjectDetails) {
      derr(`Cannot perform action ${actionType}, subject ${subjectName} not found in groupedCards.`);
      return;
    }

    switch (actionType) {
      case 'slideshow':
        // Collect all cards from all topics of this subject
        let allCardsForSubjectSlideshow = [];
        Object.values(subjectDetails.topics).forEach(topic => {
          allCardsForSubjectSlideshow.push(...(topic.cards || []));
        });
        startSlideshow(subjectName, null, null, allCardsForSubjectSlideshow); // Pass cards directly
        break;
      case 'print':
        const allCardsForSubjectPrint = [];
        Object.values(subjectDetails.topics).forEach(topic => {
          allCardsForSubjectPrint.push(...(topic.cards || []));
        });
        openPrintModal(allCardsForSubjectPrint, subjectName);
        break;
      case 'color':
        openColorEditor(subjectName, null, subjectDetails.color, { stopPropagation: () => {} });
        break;
      case 'delete':
        handleDeleteSubject(subjectName);
        break;
      default:
        dwarn("Unknown subject action:", actionType);
    }
  }, [groupedCards, startSlideshow, openPrintModal, openColorEditor, handleDeleteSubject]);

  const handleTopicActionInModal = useCallback((actionType, subjectName, topicData) => {
    dlog(`[FlashcardList] Topic Action from Modal: ${actionType} for ${subjectName} - ${topicData.name}`);
    const subjectDetails = groupedCards[subjectName];
    const targetTopic = subjectDetails?.topics[topicData.name];

    if (!targetTopic) {
      derr(`Cannot perform action ${actionType}, topic ${topicData.name} not found in subject ${subjectName}.`);
      return;
    }

    switch (actionType) {
      case 'ai_generate':
        // This might need to open the FlashcardGeneratorBridge or navigate.
        // For now, let's assume it triggers a global event or a function passed from App.js
        // For simplicity, we can reuse setGeneratorTopic and setShowCardGenerator if they are still relevant
        // Or pass this up to App.js to handle navigation/modal opening for AI generator.
        // Let's open FlashcardGeneratorBridge directly for now
        setGeneratorTopic({ // Assuming setGeneratorTopic and setShowCardGenerator are still available
            subject: subjectName,
            topic: topicData.name,
            name: topicData.name,
            color: topicData.color,
            cardColor: topicData.color,
            examBoard: topicData.examBoard,
            examType: topicData.examType,
            id: topicData.id,
            cards: topicData.cards || []
        });
        setShowCardGenerator(true);
        setIsTopicListModalOpen(false); // Close topic list modal
        break;
      // Slideshow is handled internally by TopicListModal now.
      // case 'slideshow':
      //   startSlideshow(subjectName, topicData.name, null, targetTopic.cards);
      //   break;
      case 'print':
        openPrintModal(targetTopic.cards || [], `${subjectName} - ${topicData.name}`);
        break;
      case 'delete':
        handleDeleteTopic(subjectName, topicData.name); // Existing handler
        break;
      default:
        dwarn("Unknown topic action from modal:", actionType);
    }
  }, [groupedCards, /*startSlideshow,*/ openPrintModal, handleDeleteTopic, setGeneratorTopic, setShowCardGenerator]);

  return (
    <div className="flashcard-list">
      <div className="subject-buttons-grid"> {/* New container for subject buttons */}
        {sortedSubjects.map(subjectDisplayData => {
          // Find the full subject data from groupedCards using the id/title from sortedSubjects
          const fullSubjectDataFromGrouped = groupedCards[subjectDisplayData.id];
          if (!fullSubjectDataFromGrouped) {
            derr("Mismatch: Subject in sortedSubjects not found in groupedCards:", subjectDisplayData.id);
            return null;
          }
          
          // Prepare a data object specifically for SubjectButton props
          const subjectButtonPropsData = {
            name: fullSubjectDataFromGrouped.name,
            color: fullSubjectDataFromGrouped.color,
            totalTopics: Object.keys(fullSubjectDataFromGrouped.topics).length,
            totalCards: fullSubjectDataFromGrouped.totalCardsInSubject,
            examBoard: fullSubjectDataFromGrouped.examBoard,
            examType: fullSubjectDataFromGrouped.examType,
            id: fullSubjectDataFromGrouped.name // Use name as ID for button key if no other unique ID
          };

          return (
            <SubjectButton
              key={subjectButtonPropsData.id}
              subjectData={subjectButtonPropsData}
              onClick={() => handleOpenTopicListModal(subjectButtonPropsData)} // Pass the display data, modal will use activeSubjectForModal
              onAction={handleSubjectAction}
            />
          );
        })}
      </div>
      
      <DeleteConfirmModal
        isOpen={deleteConfirmState.isOpen}
        title={deleteConfirmState.title}
        message={deleteConfirmState.message}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
      
      {printModalOpen && (
        <PrintModal
          cards={cardsToPrint}
          title={printTitle}
          onClose={() => setPrintModalOpen(false)}
        />
      )}
      {showCardModal && selectedCardForModal && (
        <FlashcardModal
          card={selectedCardForModal}
          onClose={() => {
            setShowCardModal(false);
            setSelectedCardForModal(null);
          }}
          onUpdateCard={onUpdateCard}
          onDeleteCard={onDeleteCard}
        />
      )}
      {colorEditorOpen && (
        <ColorEditor
          subject={colorEditorState.subject}
          subjectColor={colorEditorState.color}
          onClose={closeColorEditor}
          onSelectColor={handleColorChange}
        />
      )}
      {showSlideshow && (
        <SlideshowModal
          cards={slideshowCards}
          title={slideshowTitle}
          onClose={() => setShowSlideshow(false)}
        />
      )}
      {activeSubjectForModal && (
        <TopicListModal
          isOpen={isTopicListModalOpen}
          onClose={handleCloseTopicListModal}
          subjectData={{ // Pass basic subject info for modal header
            name: activeSubjectForModal.name,
            color: activeSubjectForModal.color,
          }}
          // Convert topics object to array for easier mapping in modal
          topicsForSubject={Object.values(activeSubjectForModal.topics || {})}
          onTopicAction={handleTopicActionInModal}
        />
      )}
      {showCardGenerator && generatorTopic && (
        <ErrorBoundary>
          <FlashcardGeneratorBridge
            topic={generatorTopic}
            recordId={recordId || null}
            userId={userId || localUserId || null}
            onClose={() => {
              setShowCardGenerator(false);
              setGeneratorTopic(null);
            }}
            onAddCards={handleAddGeneratedCards}
          />
        </ErrorBoundary>
      )}
      <SaveLoadingOverlay />
      <SaveErrorMessage />
    </div>
  );
};

// --- Default Export (should be the only one) ---
export default FlashcardList;
