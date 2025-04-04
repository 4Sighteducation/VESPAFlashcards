import React, {useState, useEffect, useMemo, useRef, useCallback} from "react";
import Flashcard from "./Flashcard";
import PrintModal from "./PrintModal";
import "./FlashcardList.css";
import { FaPrint, FaPlay, FaAngleUp, FaAngleDown, FaPalette, FaBolt, FaTrash } from 'react-icons/fa';
import ColorEditor from "./ColorEditor";
import TopicCreationModal from "./TopicCreationModal";

// Define bright colors constant
const BRIGHT_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
  '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000' // Added black & white
];

// Helper function to generate shades (can be moved to utils if needed)
const generateShade = (color, percent) => {
  if (!color || typeof color !== 'string' || !color.startsWith('#')) {
    console.warn("[generateShade] Invalid base color:", color, "Using fallback #f0f0f0");
    color = '#f0f0f0'; // Fallback color
  }
  try {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = Math.max(0, Math.min(255, R)); // Clamp values between 0 and 255
    G = Math.max(0, Math.min(255, G));
    B = Math.max(0, Math.min(255, B));

    const RR = R.toString(16).padStart(2, '0'); // Use padStart for cleaner hex conversion
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return "#" + RR + GG + BB;
  } catch (error) {
    console.error("[generateShade] Error processing color:", color, error);
    return '#f0f0f0'; // Fallback on error
  }
};

// Helper function for contrast color - IMPROVED VERSION
const getContrastColor = (hexColor) => {
    // DEBUG: Log input color
    console.log("[getContrastColor] Input:", hexColor);

    if (!hexColor || typeof hexColor !== 'string') {
       console.warn("[getContrastColor] Invalid hexcolor input (not a string or null):", hexColor);
       return '#000000'; // Default to black
    }
    hexColor = hexColor.startsWith('#') ? hexColor : `#${hexColor}`; // Ensure # prefix
    if (!/^#[0-9A-F]{6}$/i.test(hexColor) && !/^#[0-9A-F]{3}$/i.test(hexColor)) {
        console.warn("[getContrastColor] Invalid hex format:", hexColor, "Using fallback #000000");
        return '#000000';
    }

    try {
        let hex = hexColor.substring(1); // Remove #
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        if (hex.length !== 6) {
            throw new Error("Invalid hex color code length after expansion.");
        }

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Calculate luminance using the WCAG standard formula
        // https://www.w3.org/TR/WCAG20/#relativeluminancedef
        const lum = (c) => {
            const channel = c / 255;
            return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        };
        const luminance = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);

        // Determine contrast ratio against white and black
        // Luminance of white = 1, black = 0
        const contrastWithWhite = (1 + 0.05) / (luminance + 0.05);
        const contrastWithBlack = (luminance + 0.05) / (0 + 0.05);

        // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
        // We'll aim for 4.5:1, choosing the color with better contrast
        const chosenColor = contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';

        // DEBUG: Log calculation results
        console.log(`[getContrastColor] Lum: ${luminance.toFixed(3)}, Contrast White: ${contrastWithWhite.toFixed(2)}, Contrast Black: ${contrastWithBlack.toFixed(2)}, Chosen: ${chosenColor}`);

        return chosenColor;

    } catch (error) {
        console.error("[getContrastColor] Error processing color:", hexColor, error);
        return '#000000'; // Fallback on error
    }
};

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
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content flashcard-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>&times;</button>
          <p>Error: Card data is missing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content flashcard-modal-content" onClick={(e) => e.stopPropagation()}>
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
      <div className="modal-backdrop" onClick={onClose}>
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content slideshow-modal-content" onClick={(e) => e.stopPropagation()}>
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

// --- Main FlashcardList Component ---

const FlashcardList = ({
  cards,
  onCardClick,
  onTopicClick,
  onSubjectClick,
  onDeleteCard,
  onDeleteTopic,
  onDeleteSubject,
  onRegenerateTopic,
  onUpdateCard,
  onUpdateSubjectColor,
  handleSaveTopicShells
}) => {
  // --- START: HOOK DEFINITIONS ---

  // 1. useState Hooks
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [expandedTopics, setExpandedTopics] = useState(new Set());
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

  // 2. useRef Hooks
  const subjectRefs = useRef({});
  const topicRefs = useRef({});

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
    // Call the optional prop if provided
    if (typeof onTopicClick === 'function') {
      onTopicClick(topic, subject);
    }
  }, [onTopicClick]);

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

  // 4. useEffect for Color Initialization and Update
  useEffect(() => {
    console.log("[FlashcardList Color useEffect] Running. Grouped cards:", groupedCards);
    if (!groupedCards || Object.keys(groupedCards).length === 0) {
      console.log("[FlashcardList Color useEffect] No grouped cards, skipping color update.");
      // Optionally clear colors if needed: setSubjectColorMapping({});
      return; // No subjects, nothing to color
    }

    const currentSubjects = Object.keys(groupedCards);
    let needsUpdate = false;
    const updatedMapping = { ...subjectColorMapping }; // Create mutable copy

    // Prune colors for subjects that no longer exist
    Object.keys(updatedMapping).forEach(existingSubject => {
      if (!groupedCards[existingSubject]) {
        console.log(`[FlashcardList Color useEffect] Pruning color for removed subject: ${existingSubject}`);
        delete updatedMapping[existingSubject];
        needsUpdate = true;
      }
    });

    // Iterate through current subjects and topics from groupedCards
    currentSubjects.forEach(subject => {
      // Assign base color if subject is new or missing it
      if (!updatedMapping[subject] || !updatedMapping[subject].base) {
        const randomBaseColor = BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
        console.log(`[FlashcardList Color useEffect] Assigning NEW base color ${randomBaseColor} to subject: ${subject}`);
        updatedMapping[subject] = {
          base: randomBaseColor,
          topics: updatedMapping[subject]?.topics || {} // Preserve existing topics if base was missing
        };
        needsUpdate = true;
      }

      // Ensure topics object exists
      if (!updatedMapping[subject].topics) {
        updatedMapping[subject].topics = {};
      }

      const subjectBaseColor = updatedMapping[subject].base;
      const currentTopicsInSubject = Object.keys(groupedCards[subject] || {});

      // Prune colors for topics that no longer exist within this subject
      Object.keys(updatedMapping[subject].topics).forEach(existingTopic => {
        if (!groupedCards[subject]?.[existingTopic]) {
          console.log(`[FlashcardList Color useEffect] Pruning color for removed topic: ${subject} -> ${existingTopic}`);
          delete updatedMapping[subject].topics[existingTopic];
          needsUpdate = true;
        }
      });

      // Assign topic colors if they are new or missing
      currentTopicsInSubject.forEach((topic, index) => {
        if (!updatedMapping[subject].topics[topic] || !updatedMapping[subject].topics[topic].base) {
          const shadePercent = -10 + (index % 5) * 5; // e.g., -10%, -5%, 0%, 5%, 10%
          const topicShade = generateShade(subjectBaseColor, shadePercent);
          console.log(`[FlashcardList Color useEffect] Assigning NEW shade ${topicShade} to topic: ${subject} -> ${topic}`);
          updatedMapping[subject].topics[topic] = { base: topicShade };
          needsUpdate = true;
        }
      });
    });

    // Update state only if changes occurred
    if (needsUpdate) {
      console.log("[FlashcardList Color useEffect] Updating subjectColorMapping state:", updatedMapping);
      setSubjectColorMapping(updatedMapping); // Update the state
      // No need to call updateColorMapping here, we're setting directly
    } else {
      console.log("[FlashcardList Color useEffect] No color changes needed.");
    }
  }, [groupedCards]);

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

  const handleColorChange = (newColor) => {
    const { subject, topic } = colorEditorState;
    if (subject) {
      // Update local state immediately for responsiveness
      setSubjectColorMapping(prev => {
        const newMapping = { ...prev };
        if (topic) {
          // Update topic color
          if (!newMapping[subject]) newMapping[subject] = { base: '#f0f0f0', topics: {} }; // Initialize if somehow missing
          if (!newMapping[subject].topics) newMapping[subject].topics = {};
          newMapping[subject].topics[topic] = { base: newColor };
        } else {
          // Update subject base color
           if (!newMapping[subject]) newMapping[subject] = { topics: {} }; // Initialize if somehow missing
          newMapping[subject].base = newColor;
           // Optional: Update topic shades based on new subject color? Maybe later.
        }
        return newMapping;
      });

      // Notify parent component to handle persistence/global state
      if (typeof onUpdateSubjectColor === 'function') {
          onUpdateSubjectColor(subject, topic, newColor); // Pass subject, topic (or null), and new color
      } else {
          console.warn("onUpdateSubjectColor prop is not defined. Color changes might not persist.");
      }
    }
    closeColorEditor();
  };

  // Render functions (can remain here or be moved outside if preferred)
  const renderCards = (cardsInTopic, subject, topic, topicColor) => {
    const topicKey = `${subject}-${topic}`;
    const isVisible = expandedTopics.has(topicKey);
    // Filter out topic shells before rendering cards
    const actualCards = cardsInTopic.filter(item => item.type !== 'topic');

    return (
      <div className={`topic-cards ${isVisible ? 'visible' : ''}`}>
        {actualCards.length > 0 ? (
          actualCards.map((card) => (
            <Flashcard
              key={card.id}
              card={{ ...card, cardColor: topicColor }}
              onDelete={() => onDeleteCard(card.id)}
              onFlip={() => {}}
              onUpdateCard={onUpdateCard}
              onSelectCard={() => handleCardClick(card)}
            />
          ))
        ) : (
          <div className="no-cards-message">No cards generated for this topic yet.</div>
        )}
      </div>
    );
  };

  const renderTopic = (subject, topic, items, topicColor) => {
    const topicKey = `${subject}-${topic}`;
    const isExpanded = expandedTopics.has(topicKey);
    const topicShell = items.find(item => item.type === 'topic' && item.isShell);
    const actualCards = items.filter(item => item.type !== 'topic');
    const displayCount = actualCards.length;
    const textColor = getContrastColor(topicColor);
    // Get metadata from the shell if available
    const examBoard = topicShell?.examBoard || "General";
    const examType = topicShell?.examType || "Course";

    // Add regeneration handler
    const handleRegenerateTopicClick = async (e) => {
      e.stopPropagation();
      if (!topicShell) {
        console.error('No topic shell found for regeneration');
        alert('Cannot regenerate: Topic information is missing.');
        return;
      }

      if (window.confirm(`This will generate new cards for "${topic}". Existing cards will remain. Continue?`)) {
        // Call the WebSocket-based generation via the passed prop
        if (typeof handleSaveTopicShells === 'function') {
          console.log(`[Regen Trigger] Regenerating topic: ${subject} - ${topic}`);
          const shellToRegen = {
            ...topicShell,
            subject: subject,
            topic: topic,
            regenerate: true
          };
          await handleSaveTopicShells([shellToRegen], true);
        } else {
           console.error("handleSaveTopicShells prop is not available for regeneration!");
           alert("Error: Regeneration function is not available.");
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
              <span className="exam-type">{examType}</span>
              <span className="exam-board">{examBoard}</span>
            </div>
          </div>
          <div className="topic-actions">
            {topicShell && (
              <button
                onClick={handleRegenerateTopicClick}
                className="action-button regenerate-button"
                title="Generate/Regenerate topic cards"
              >
                <FaBolt />
              </button>
            )}
            {displayCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startSlideshow(subject, topic, e);
                }}
                className="action-button slideshow-button"
                title="Start slideshow"
              >
                <FaPlay />
              </button>
            )}
            {displayCount > 0 && (
              <button
                onClick={(e) => handlePrintTopic(subject, topic, e)}
                className="action-button print-topic-button"
                title="Print topic cards"
              >
                <FaPrint />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openColorEditor(subject, topic, topicColor, e);
              }}
              className="action-button color-edit-button"
              title="Edit topic color"
            >
              <FaPalette />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onDeleteTopic === 'function') {
                    if (window.confirm(`Are you sure you want to delete the topic "${topic}" and all its cards?`)) {
                       console.log(`[Delete Topic] Deleting: ${subject} - ${topic}`);
                       onDeleteTopic(topic, subject);
                    }
                } else {
                    console.error("onDeleteTopic prop is not a function!");
                }
              }}
              className="action-button delete-topic-button"
              title="Delete topic and cards"
            >
              <FaTrash />
            </button>
            <span className="expand-icon">
              {isExpanded ? <FaAngleUp /> : <FaAngleDown />}
            </span>
          </div>
        </div>
        {isExpanded && renderCards(actualCards, subject, topic, topicColor)}
      </div>
    );
  };

  const renderTopics = (subject, subjectColor) => {
    const topicsData = groupedCards[subject] || {};
    const topicNames = Object.keys(topicsData).sort((a, b) => a.localeCompare(b));

    return (
      <div className="topics-container">
        {topicNames.map((topic, index) => {
          const topicKey = `${subject}-${topic}`;
          const topicItems = topicsData[topic];
          const topicColor = subjectColorMapping[subject]?.topics[topic]?.base || generateShade(subjectColor, -10 + (index % 5) * 5);
          return (
            renderTopic(subject, topic, topicItems, topicColor)
          );
        })}
      </div>
    );
  };

  return (
    <div className="flashcard-list">
      <ScrollManager
        expandedSubjects={expandedSubjects}
        expandedTopics={expandedTopics}
        subjectRefs={subjectRefs}
        topicRefs={topicRefs}
      />
      <button
        onClick={() => setShowTopicCreationModal(true)}
        className="create-topic-list-button button-primary floating-create-button"
        title="Create New Topic List"
      >
        <FaBolt /> <span>Create Topics</span>
      </button>
      {sortedSubjects.map(({ id: subject, title, cards: topicsData, exam_type, exam_board, color: subjectBaseColor, creationDate }) => {
        const subjectKey = subject;
        const isExpanded = expandedSubjects.has(subjectKey);
        const subjectTextColor = getContrastColor(subjectBaseColor);

        const totalCardCount = Object.values(topicsData || {}).reduce((count, items) => {
            return count + items.filter(item => item.type !== 'topic').length;
        }, 0);

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
                  <span className="card-count">({totalCardCount} cards total)</span>
                  <span className="exam-type">{exam_type}</span>
                  <span className="exam-board">{exam_board}</span>
                </div>
              </div>
              <div className="subject-actions">
                <button
                  onClick={(e) => { e.stopPropagation(); startSlideshow(subject, null, e); }}
                  className="action-button subject-slideshow-button"
                  title="Start slideshow for subject"
                  disabled={totalCardCount === 0}
                >
                  <FaPlay />
                </button>
                <button
                  onClick={(e) => handlePrintSubject(subject, e)}
                  className="action-button subject-print-button"
                  title="Print subject cards"
                  disabled={totalCardCount === 0}
                >
                  <FaPrint />
                </button>
                <button
                  onClick={(e) => openColorEditor(subject, null, subjectBaseColor, e)}
                  className="action-button subject-color-button"
                  title="Edit subject color"
                >
                  <FaPalette />
                </button>
                <button
                  onClick={(e) => {
                      e.stopPropagation();
                      if (typeof onDeleteSubject === 'function') {
                           if (window.confirm(`Are you sure you want to delete the subject "${subject}" and ALL its topics and cards? This cannot be undone.`)) {
                              console.log(`[Delete Subject] Deleting: ${subject}`);
                              onDeleteSubject(subject);
                           }
                      } else {
                           console.error("onDeleteSubject prop is not defined!");
                      }
                  }}
                  className="action-button subject-delete-button"
                  title="Delete subject"
                >
                  <FaTrash />
                </button>
                <span className="expand-icon">
                  {isExpanded ? <FaAngleUp /> : <FaAngleDown />}
                </span>
              </div>
            </div>
            {isExpanded && renderTopics(subject, subjectBaseColor)}
          </div>
        );
      })}
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
          isOpen={colorEditorOpen}
          onClose={closeColorEditor}
          currentColor={colorEditorState.color}
          onChange={handleColorChange}
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
    </div>
  );
};

// --- Default Export (should be the only one) ---
export default FlashcardList;