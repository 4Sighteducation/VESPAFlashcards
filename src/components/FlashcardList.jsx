import React, {useState, useEffect, useMemo, useRef, useCallback} from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import "./FlashcardList.css";
import ColorEditor from "./ColorEditor";
import TopicCreationModal from "./TopicCreationModal";
import { deleteSubject, deleteTopic } from "./FlashcardTopicHandler";
import AICardGenerator from './AICardGenerator';
import { BRIGHT_COLORS, getContrastColor, generateShade } from '../utils/ColorUtils';

// ScrollManager component - Only needs expandedSubjects now
const ScrollManager = ({ expandedSubjects, subjectRefs }) => {
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
  
  useEffect(() => {
    Object.entries(expandedSubjects).forEach(([subject, isExpanded]) => {
      if (isExpanded) {
        const subjectEl = subjectRefs.current[subject];
        if (subjectEl) setTimeout(() => scrollToElement(subjectEl, 10), 150);
      }
    });
  }, [expandedSubjects, subjectRefs]);
  
  // No more expandedTopics effect needed
  
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
      console.error("FlashcardModal: onUpdateCard prop is not a function!");
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
      console.error("FlashcardModal: onDeleteCard prop is not a function!");
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
  const [showFront, setShowFront] = useState(true);

  // Handle empty cards array
  if (!cards || cards.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content slideshow-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>&times;</button>
          <h2>{title}</h2>
          <p>No cards to display in slideshow.</p>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % cards.length);
    setShowFront(true); // Show front of next card
  };

  const goToPrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + cards.length) % cards.length);
    setShowFront(true); // Show front of previous card
  };

  const flipCard = () => {
    setShowFront(!showFront);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content slideshow-modal-content centered-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>{title} ({currentIndex + 1}/{cards.length})</h2>
        {currentCard && (
          <div className="slideshow-card" onClick={flipCard}>
            <pre>{showFront ? currentCard.front : currentCard.back}</pre>
          </div>
        )}
        <div className="slideshow-controls">
          <button onClick={goToPrev} disabled={cards.length <= 1}>Previous</button>
          <button onClick={flipCard}>Flip</button>
          <button onClick={goToNext} disabled={cards.length <= 1}>Next</button>
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
  handleSaveTopicShells,
  recordId,
  userId
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
  const [showTopicCreationModal, setShowTopicCreationModal] = useState(false);
  const [slideshowCards, setSlideshowCards] = useState([]);
  const [slideshowTitle, setSlideshowTitle] = useState("");
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [groupedCards, setGroupedCards] = useState({});
  const [subjectColorMapping, setSubjectColorMapping] = useState({});
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
  // Add state to track if we need to get userId from localStorage if not provided
  const [localUserId, setLocalUserId] = useState(null);

  // 2. useRef Hooks
  const subjectRefs = useRef({});

  // Try to get userId from localStorage if not provided as prop
  useEffect(() => {
    if (!userId && !localUserId) {
      try {
        const authData = localStorage.getItem('flashcards_auth');
        if (authData) {
          const parsedAuth = JSON.parse(authData);
          if (parsedAuth && parsedAuth.id) {
            console.log("[FlashcardList] Retrieved userId from localStorage:", parsedAuth.id);
            setLocalUserId(parsedAuth.id);
          }
        }
      } catch (error) {
        console.error("[FlashcardList] Error getting userId from localStorage:", error);
      }
    }
  }, [userId, localUserId]);

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
      console.log("[updateColorMapping] New state:", merged);
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

  // Regroup cards whenever the 'cards' prop changes
  useEffect(() => {
    console.log("[FlashcardList regroup useEffect] Cards prop changed:", cards);
    const bySubjectAndTopic = {};
    if (!Array.isArray(cards)) {
      console.error("FlashcardList received non-array cards prop:", cards);
      setGroupedCards({}); // Reset if prop is invalid
      return;
    }

    const extractActualTopicName = (item) => {
      if (item.type === 'topic' && item.isShell && item.name) {
        const name = item.name;
        const subject = item.subject || "General";
        // Heuristic to check if subject is prefixing topic name
        if (name.toLowerCase().startsWith(subject.toLowerCase() + ': ')) {
          return name.substring(subject.length + 2).trim() || "General";
        }
        return name.trim() || "General"; // Fallback to name if no prefix found
      }
      return item.topic?.trim() || "General"; // Use topic field for actual cards
    };

    cards.forEach(item => {
      if (!item || typeof item !== 'object' || !item.id) {
        console.warn("[FlashcardList Grouping] Skipping invalid item (missing id or not object):", item);
        return;
      }
      // Ensure subject and topic are strings, provide defaults
      const subject = typeof item.subject === 'string' && item.subject.trim() ? item.subject.trim() : "General";
      const topic = extractActualTopicName(item); // Use helper

      if (!bySubjectAndTopic[subject]) {
        bySubjectAndTopic[subject] = {};
      }
      if (!bySubjectAndTopic[subject][topic]) {
        bySubjectAndTopic[subject][topic] = [];
      }
      // Ensure no duplicates if items can represent both shell and data source
      if (!bySubjectAndTopic[subject][topic].some(existing => existing.id === item.id)) {
        bySubjectAndTopic[subject][topic].push(item);
      }
    });
    console.log("[FlashcardList regroup useEffect] Setting grouped cards:", bySubjectAndTopic);
    setGroupedCards(bySubjectAndTopic);
  }, [cards]); // Dependency: Only the cards prop

  // 4. useEffect for Color Initialization and Synchronization with Props
  useEffect(() => {
    const colorMappingFromProps = subjectColorMappingFromProps || {};
    console.log("[FlashcardList Color Sync Effect V2] Running. Props received:", colorMappingFromProps);

    if (!groupedCards || Object.keys(groupedCards).length === 0) {
      if (Object.keys(subjectColorMapping).length > 0) {
        console.log("[FlashcardList Color Sync Effect V2] No grouped cards, clearing local color state.");
        setSubjectColorMapping({});
      }
      return;
    }

    let needsLocalUpdate = false;
    // Start with a deep copy of the current local state
    // This ensures we preserve existing local colors unless overwritten by props
    const nextLocalMapping = JSON.parse(JSON.stringify(subjectColorMapping || {}));

    // --- Step 1: Sync with Props --- 
    // Update local state with colors definitively provided by props
    Object.keys(colorMappingFromProps).forEach(subject => {
        const propSubjectInfo = colorMappingFromProps[subject];
        if (!propSubjectInfo) return; // Skip if prop info is somehow null/undefined

        // Ensure subject entry exists locally
        if (!nextLocalMapping[subject]) {
            nextLocalMapping[subject] = { base: null, topics: {} };
            needsLocalUpdate = true;
        }

        // Update base color if provided in props and different from local
        if (propSubjectInfo.base && propSubjectInfo.base !== nextLocalMapping[subject].base) {
            console.log(`[FlashcardList Color Sync V2] Updating subject '${subject}' base color from props: ${propSubjectInfo.base}`);
            nextLocalMapping[subject].base = propSubjectInfo.base;
            needsLocalUpdate = true;
        }

        // Ensure topics object exists locally
        if (!nextLocalMapping[subject].topics) {
             nextLocalMapping[subject].topics = {};
             // No need to set needsLocalUpdate just for creating empty object
        }

        // Update topic colors if provided in props
        if (propSubjectInfo.topics) {
             Object.keys(propSubjectInfo.topics).forEach(topic => {
                 const propTopicInfo = propSubjectInfo.topics[topic];
                 const propTopicColor = propTopicInfo?.base || propTopicInfo; // Handle old/new format
                 const localTopicColor = nextLocalMapping[subject].topics[topic]?.base || nextLocalMapping[subject].topics[topic];

                 if (propTopicColor && propTopicColor !== localTopicColor) {
                    console.log(`[FlashcardList Color Sync V2] Updating topic '${topic}' color for subject '${subject}' from props: ${propTopicColor}`);
                    // Ensure topic entry exists in the modern object format
                    nextLocalMapping[subject].topics[topic] = { base: propTopicColor };
                    needsLocalUpdate = true;
                 }
             });
        }
    });

    // --- Step 2: Assign Defaults ONLY for Missing Entries --- 
    // Iterate subjects derived from the current cards
    Object.keys(groupedCards).forEach(subject => {
      // Check if subject base color is missing locally *after* syncing with props
      if (!nextLocalMapping[subject] || !nextLocalMapping[subject].base) {
        const randomBaseColor = BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
        console.log(`[FlashcardList Color Sync V2] Subject '${subject}' missing base color locally. Assigning default: ${randomBaseColor}`);
        if (!nextLocalMapping[subject]) nextLocalMapping[subject] = { topics: {} }; // Ensure subject entry exists
        nextLocalMapping[subject].base = randomBaseColor;
        needsLocalUpdate = true;
      }

      // Ensure topics object exists
      if (!nextLocalMapping[subject].topics) {
         nextLocalMapping[subject].topics = {};
      }

      const subjectBaseColor = nextLocalMapping[subject].base;
      const topicsInSubject = Object.keys(groupedCards[subject] || {});

      // Check topics within the subject
      topicsInSubject.forEach((topic, index) => {
        const localTopicEntry = nextLocalMapping[subject].topics[topic];
        const localTopicColor = localTopicEntry?.base || localTopicEntry; // Handle old/new format

        // Assign default shade ONLY if topic color is missing locally
        if (!localTopicColor) {
          const shadePercent = -10 + (index % 5) * 5;
          const topicShade = generateShade(subjectBaseColor, shadePercent);
          console.log(`[FlashcardList Color Sync V2] Topic '${topic}' missing color locally for subject '${subject}'. Assigning default shade: ${topicShade}`);
          nextLocalMapping[subject].topics[topic] = { base: topicShade }; // Store in modern format
          needsLocalUpdate = true;
        }
      });
    });

    // --- Step 3: Update State if Changed --- 
    // Compare the derived nextLocalMapping with the current local state
    // Only update local state if there's an actual difference to prevent loops
    if (needsLocalUpdate || JSON.stringify(nextLocalMapping) !== JSON.stringify(subjectColorMapping)) {
       console.log("[FlashcardList Color Sync V2] Updating local color mapping state.", nextLocalMapping);
       setSubjectColorMapping(nextLocalMapping);
    } else {
        console.log("[FlashcardList Color Sync V2] Local color mapping state is already synchronized.");
    }

  // Dependency: Run when groupedCards changes OR when the mapping from props changes.
  }, [groupedCards, subjectColorMappingFromProps]); // REMOVED local subjectColorMapping from deps again

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
          console.log(`[getExamInfo - ${subject}] Found: Type=${examType}, Board=${examBoard}`);
          return { examType, examBoard };
      } catch (error) {
          console.error(`Error in getExamInfo for subject ${subject}:`, error);
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
    console.log("[FlashcardList] Recalculating sortedSubjects. Current color mapping:", subjectColorMapping);

    const subjectsWithDates = Object.keys(groupedCards).map(subject => {
      const { examType, examBoard } = getExamInfo(subject);
      // Use the state directly, provide fallback if needed
      const colorInfo = subjectColorMapping[subject];
      const baseColor = colorInfo?.base || '#f0f0f0'; // Default grey if not mapped
      console.log(`[sortedSubjects - ${subject}] Color: ${baseColor}, ExamType: ${examType}, ExamBoard: ${examBoard}`);
      return {
        id: subject,
        title: subject,
        cards: groupedCards[subject],
        exam_type: examType, // Use corrected names
        exam_board: examBoard, // Use corrected names
        color: baseColor, // Use base color from mapping
        creationDate: getSubjectDate(subject)
      };
    });

    // Sort by creation date (earliest first)
    return subjectsWithDates.sort((a, b) => a.creationDate - b.creationDate);
  }, [groupedCards, getExamInfo, getSubjectDate, subjectColorMapping]);

  // 5. useEffect Hooks
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

  // Update this useEffect to use the state and update function
  useEffect(() => {
      console.log("[FlashcardList] Cards prop updated:", cards);
      if (cards && cards.length > 0) {
          // --- 1. Regroup Cards ---
          const newGroupedCards = regroupCards(cards);
          console.log("[FlashcardList] Regrouped cards:", newGroupedCards);
          setGroupedCards(newGroupedCards);

          // --- 2. Update Color Mapping ---
          const subjects = Object.keys(newGroupedCards);
          let needsColorUpdate = false;
          const newColorMappingEntries = {};

          setSubjectColorMapping(currentMapping => {
              const updatedMapping = { ...currentMapping }; // Start with current mapping

              subjects.forEach(subject => {
                  if (!updatedMapping[subject]) {
                      // Assign a new random base color for a new subject
                      const randomColor = BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
                      console.log(`[FlashcardList Color Init] Assigning new color ${randomColor} to subject: ${subject}`);
                      updatedMapping[subject] = {
                          base: randomColor,
                          topics: {} // Initialize empty topics object
                      };
                      needsColorUpdate = true;
                      newColorMappingEntries[subject] = updatedMapping[subject]; // Track newly added
                  }

                  // Ensure topics object exists
                  if (!updatedMapping[subject].topics) {
                      updatedMapping[subject].topics = {};
                  }

                  // Assign colors to topics within this subject if they don't have one
                  const subjectBaseColor = updatedMapping[subject].base;
                  const topicsInSubject = Object.keys(newGroupedCards[subject] || {});
                  topicsInSubject.forEach((topic, index) => {
                      if (!updatedMapping[subject].topics[topic]) {
                           // Generate a shade based on the subject's base color
                           // Use index to vary the shade slightly, avoid pure black/white shades initially
                          const shadePercent = -10 + (index % 5) * 5; // e.g., -10%, -5%, 0%, 5%, 10%
                          const topicShade = generateShade(subjectBaseColor, shadePercent);
                           console.log(`[FlashcardList Color Init] Assigning shade ${topicShade} to topic: ${subject} -> ${topic}`);
                          updatedMapping[subject].topics[topic] = { base: topicShade };
                          needsColorUpdate = true;
                          // No need to track topic colors separately for onUpdateSubjectColor prop for now
                      }
                  });
              });

              // If updates happened, trigger the state update
              if (needsColorUpdate) {
                   console.log("[FlashcardList Color Init] Updating color mapping state:", updatedMapping);
                   // If using a prop to notify parent, call it here with only the *new* entries
                   // if (Object.keys(newColorMappingEntries).length > 0) {
                   //    onUpdateSubjectColor?.(newColorMappingEntries);
                   // }
                  return updatedMapping;
              }
              return currentMapping; // No changes needed
          });

          // --- 3. Expand First Subject (Optional) ---
          if (subjects.length > 0 && expandedSubjects.size === 0) {
              // Expand only if no subjects are currently expanded
              // setExpandedSubjects(new Set([subjects[0]])); // Expand the first subject based on grouped data
          }

      } else {
          // Handle case where cards become empty
          setGroupedCards({});
          // Maybe clear colors? Or keep them? Keeping them for now.
          // setSubjectColorMapping({});
      }
      // Dependencies: cards array itself, regroup function, and the updateColorMapping function
  }, [cards, regroupCards, updateColorMapping, expandedSubjects.size, subjectColorMapping]);

  // --- END: HOOK DEFINITIONS ---

  // --- START: EVENT HANDLERS & HELPER FUNCTIONS ---

  const handleCardClick = (card) => {
    console.log("Card clicked:", card);
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

  const startSlideshow = useCallback((subject, topic, e) => {
    if (e) e.stopPropagation();
    let slideshowCardsToUse = [];
    let slideshowTitleToUse = "Slideshow";
    if (topic) {
      slideshowCardsToUse = (groupedCards?.[subject]?.[topic] || []).filter(item => item.type !== 'topic');
      slideshowTitleToUse = `${subject} - ${topic}`;
    } else {
      const allTopics = Object.keys(groupedCards?.[subject] || {});
      slideshowCardsToUse = allTopics.reduce((all, currentTopic) => {
        const topicCardsOnly = (groupedCards[subject]?.[currentTopic] || []).filter(item => item.type !== 'topic');
        return all.concat(topicCardsOnly);
      }, []);
      slideshowTitleToUse = subject;
    }
    
    // Always create placeholder for empty topics
    if (slideshowCardsToUse.length === 0) {
      console.log(`No cards found for slideshow: ${slideshowTitleToUse}. Creating placeholder.`);
      slideshowCardsToUse = [
        {
          id: `placeholder-${Date.now()}`,
          front: `No cards generated for this topic yet.`, 
          back: 'Click the "lightning" button to generate cards.',
          subject: subject,
          topic: topic || 'General'
        }
      ];
    }
    
    setSlideshowCards(slideshowCardsToUse);
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
          console.warn("onUpdateSubjectColor prop is not defined. Color changes might not persist.");
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
      console.log(`[FlashcardList] Attempting to delete ${itemType}. Handlers available:`, {
        deleteSubject: typeof onDeleteSubject === 'function' ? 'Available' : 'Not available',
        deleteTopic: typeof onDeleteTopic === 'function' ? 'Available' : 'Not available',
        itemToDelete,
        parentSubject
      });
      
      if (itemType === "topic") {
        if (typeof onDeleteTopic === 'function') {
          // Use the prop if provided
          console.log(`[FlashcardList] Calling onDeleteTopic(${itemToDelete}, ${parentSubject})`);
          await onDeleteTopic(itemToDelete, parentSubject);
        } else {
          // Fall back to direct handler
          console.log(`[FlashcardList] Using direct deleteTopic(${itemToDelete}, ${parentSubject})`);
          await deleteTopic(itemToDelete, parentSubject);
        }
        console.log(`Topic deleted: ${parentSubject} - ${itemToDelete}`);
      } else if (itemType === "subject") {
        if (typeof onDeleteSubject === 'function') {
          // Use the prop if provided
          console.log(`[FlashcardList] Calling onDeleteSubject(${itemToDelete})`);
          await onDeleteSubject(itemToDelete);
        } else {
          // Fall back to direct handler
          console.log(`[FlashcardList] Using direct deleteSubject(${itemToDelete})`);
          await deleteSubject(itemToDelete);
        }
        console.log(`Subject deleted: ${itemToDelete}`);
      } else {
        throw new Error("No handler available");
      }
    } catch (error) {
      console.error(`Error deleting ${itemType}:`, error);
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

  const renderTopic = (subject, topic, items, topicColor) => {
    const topicShell = items.find(item => item.type === 'topic' && item.isShell);
    const actualCards = items.filter(item => item.type !== 'topic');
    const displayCount = actualCards.length;
    const textColor = getContrastColor(topicColor);
    const examBoard = topicShell?.examBoard || "General";
    const examType = topicShell?.examType || "Course";

    // Handle topic print click
    const handlePrintTopicClick = (e) => {
      e.stopPropagation();
      console.log(`Printing ${displayCount} cards for topic: ${topic}`);
      openPrintModal(actualCards, `${subject} - ${topic}`);
    };

    // Handle topic delete click
    const handleDeleteTopicClick = (e) => {
      e.stopPropagation();
      handleDeleteTopic(subject, topic);
    };

    // Handle regenerating topic
    const handleRegenerateTopicClick = async (e) => {
      e.stopPropagation();
      if (!topicShell) {
        console.error('No topic shell found for regeneration');
        alert('Cannot regenerate: Topic information is missing.');
        return;
      }

      // NOTE: Despite the name, this function doesn't actually "regenerate" the topic.
      // It opens the AICardGenerator to create new flashcards for this topic,
      // passing the topic's metadata to the generator.
      // The name is kept for backward compatibility.
      setGeneratorTopic({
        subject: subject,
        topic: topic,
        name: topic,
        color: topicColor,
        cardColor: topicColor,
        examBoard: examBoard,
        examType: examType,
        ...topicShell // Include all other topic shell properties
      });
      setShowCardGenerator(true);
    };

    // Add slidehsow functionality for topic
    const handleSlideshowTopicClick = (e) => {
      e.stopPropagation();
      startSlideshow(subject, topic, e);
    };

    return (
      <div key={`${subject}-${topic}`} className="topic-container">
        <div
          className={`topic-header ${displayCount === 0 ? 'empty-shell' : ''}`}
          style={{ backgroundColor: topicColor, color: textColor }}
          onClick={(e) => startSlideshow(subject, topic, e)}
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
            {topicShell && (
              <button
                onClick={handleRegenerateTopicClick}
                className="nav-button regenerate-button"
                title="Generate/Regenerate topic cards"
              >
                <span className="button-icon">⚡</span>
              </button>
            )}
            {/* Add slideshow button */}
            <button
              onClick={handleSlideshowTopicClick}
              className="nav-button slideshow-button"
              title="View cards as slideshow"
              disabled={displayCount === 0}
            >
              <span className="button-icon">🔄</span>
            </button>
            {/* Always show print button, but disable if no cards */}
            <button
              onClick={handlePrintTopicClick}
              className="nav-button print-topic-button"
              title="Print topic cards"
              disabled={displayCount === 0}
            >
              <span className="button-icon">🖨️</span>
            </button>
            <button
              onClick={handleDeleteTopicClick}
              className="nav-button delete-topic-button"
              title="Delete topic and cards"
            >
              <span className="button-icon">🗑️</span>
            </button>
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
          const topicItems = topicsData[topic];
          const topicBaseColor = subjectColorMapping[subject]?.topics[topic]?.base || generateShade(subjectColor, -10 + (index % 5) * 5);
          return (
            renderTopic(subject, topic, topicItems, topicBaseColor)
          );
        })}
      </div>
    );
  };

  return (
    <div className="flashcard-list">
      <ScrollManager
        expandedSubjects={expandedSubjects}
        subjectRefs={subjectRefs}
      />
      <button
        onClick={() => setShowTopicCreationModal(true)}
        className="create-topic-list-button button-primary floating-create-button"
        title="Create New Topic List"
      >
        <span className="button-icon">⚡</span> <span>Create Topics</span>
      </button>
      {sortedSubjects.map(({ id: subject, title, cards: topicsData, exam_type, exam_board, color: subjectBaseColor, creationDate }) => {
        const subjectKey = subject;
        const isExpanded = expandedSubjects.has(subjectKey);
        const subjectTextColor = getContrastColor(subjectBaseColor);

        // Count total cards and topics
        const totalTopics = Object.keys(topicsData || {}).length;
        const totalCardCount = Object.values(topicsData || {}).reduce((count, items) => {
          return count + items.filter(item => item.type !== 'topic').length;
        }, 0);
        
        // Handle subject slideshow
        const handleSlideshowSubject = (e) => {
          e.stopPropagation();
          // Start slideshow for the entire subject (all topics)
          startSlideshow(subject, null, e);
        };
        
        // Handle subject print
        const handlePrintSubjectClick = (e) => {
          e.stopPropagation();
          const subjectCards = [];
          Object.values(topicsData || {}).forEach(topicCards => {
            subjectCards.push(...topicCards.filter(item => item.type !== 'topic'));
          });
          openPrintModal(subjectCards, subject);
        };
        
        // Handle subject delete
        const handleDeleteSubjectClick = (e) => {
          e.stopPropagation();
          handleDeleteSubject(subject);
        };

        // Handle subject color click
        const handleColorSubjectClick = (e) => {
          e.stopPropagation();
          openColorEditor(subject, null, subjectBaseColor, e);
        };

        return (
          <div
            key={subjectKey}
            className="subject-container"
            ref={el => subjectRefs.current[subjectKey] = el}
          >
            <div
              className={`subject-header ${isExpanded ? 'expanded' : ''}`}
              style={{ backgroundColor: subjectBaseColor, color: subjectTextColor }}
              onClick={() => toggleSubject(subjectKey)}
            >
              <div className="subject-info">
                <h2>{title}</h2>
                <div className="subject-meta">
                  <span className="topic-count">({totalTopics} topics)</span>
                  <span className="card-count">({totalCardCount} cards)</span>
                  <span className="exam-type">{exam_type}</span>
                  <span className="exam-board">{exam_board}</span>
                </div>
              </div>
              <div className="subject-actions">
                <button
                  onClick={handleSlideshowSubject}
                  className="nav-button slideshow-button"
                  title="Start slideshow with all cards"
                  disabled={totalCardCount === 0}
                >
                  <span className="button-icon">🔄</span>
                </button>
                <button
                  onClick={handlePrintSubjectClick}
                  className="nav-button print-button"
                  title="Print subject cards"
                  disabled={totalCardCount === 0}
                >
                  <span className="button-icon">🖨️</span>
                </button>
                <button
                  onClick={handleColorSubjectClick}
                  className="nav-button color-button"
                  title="Edit subject color"
                >
                  <span className="button-icon">🎨</span>
                </button>
                <button
                  onClick={handleDeleteSubjectClick}
                  className="nav-button delete-button"
                  title="Delete subject"
                >
                  <span className="button-icon">🗑️</span>
                </button>
              </div>
            </div>
            {isExpanded && renderTopics(subject, subjectBaseColor)}
          </div>
        );
      })}
      
      {/* Delete confirmation modal */}
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
      {showTopicCreationModal && (
        <TopicCreationModal
          isOpen={showTopicCreationModal}
          onClose={() => setShowTopicCreationModal(false)}
          onSave={(topicShells) => {
             if (typeof handleSaveTopicShells === 'function') {
               console.log("[FlashcardList] Calling handleSaveTopicShells from modal save...");
               handleSaveTopicShells(topicShells, false);
             } else {
               console.error("handleSaveTopicShells prop is not a function!");
             }
            setShowTopicCreationModal(false);
          }}
          existingSubjects={getExistingSubjectNames}
        />
      )}
      {showSlideshow && (
        <SlideshowModal
          cards={slideshowCards}
          title={slideshowTitle}
          onClose={() => setShowSlideshow(false)}
        />
      )}
      {showCardGenerator && generatorTopic && (
        <AICardGenerator
          initialSubject={generatorTopic.subject}
          initialTopic={generatorTopic.topic || generatorTopic.name}
          examBoard={generatorTopic.examBoard || "AQA"}
          examType={generatorTopic.examType || "A-Level"}
          skipMetadataSteps={true}
          topicColor={generatorTopic.color || generatorTopic.cardColor}
          recordId={recordId || null}
          userId={userId || localUserId || null}
          onClose={() => {
            setShowCardGenerator(false);
            setGeneratorTopic(null);
          }}
        />
      )}
    </div>
  );
};

// --- Default Export (should be the only one) ---
export default FlashcardList;
