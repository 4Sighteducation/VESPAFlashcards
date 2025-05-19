import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import "./SpacedRepetition.css";
import FlippableCard from './FlippableCard';
import { dlog, dwarn, derr } from '../utils/logger'; // Import the logger
import StudySubjectDisplay from './StudySubjectDisplay'; // <-- Import
import StudyTopicSelectionModal from './StudyTopicSelectionModal'; // <-- Import

// Store the humorous messages
const boxMessages = {
  1: [
    "Welcome to the proving grounds! These cards need your daily attention.",
    "Back to basics! Master these cards and watch them climb the ranks.",
    "The journey of a thousand miles begins with Box 1!",
    "These cards are eager to meet you... every single day.",
    "Fresh recruits reporting for duty! Let's train them well.",
    "Box 1: Where flashcard careers begin!",
    "These need a little extra love before they can graduate.",
    "Daily practice makes perfect! Let's get started."
  ],
  2: [
    "Look who made it to Box 2! See you again in a couple days.",
    "Moving up in the world! These cards are making progress.",
    "These cards have been promoted! They only need attention every other day now.",
    "You're doing great! These cards are starting to stick.",
    "Box 2: The 'every-other-day' club. Exclusive membership!",
    "These cards are getting comfortable. Just don't get too comfortable!",
    "Good job! These cards are on their way up the ladder."
  ],
  3: [
    "Box 3 already? These cards are really coming along!",
    "These cards only need a check-in every three days. They're growing up so fast!",
    "Welcome to Box 3: The 'see you in three days' zone.",
    "Your memory is strengthening! These cards are proof.",
    "These cards have earned some breathing room. Check back in three days!",
    "Box 3: Where good flashcards go to become great flashcards.",
    "These cards are like fine wine - they get better with time!"
  ],
  4: [
    "Box 4! These cards are practically experts now.",
    "Weekly check-ins only? These cards are nearly mastered!",
    "Welcome to the VIP section! These cards only need weekly attention.",
    "Box 4: The penthouse of flashcard achievement!",
    "Just one weekly visit to keep these cards fresh in your mind.",
    "These cards have almost graduated! Just checking in weekly now.",
    "You've practically mastered these! Just a weekly refresher to stay sharp.",
    "Box 4: The waiting room for retirement. Just one weekly review to go!"
  ],
  5: [
    "Congratulations! These cards have earned their gold watch and pension plan.",
    "Box 5: The flashcard hall of fame! Only an occasional visit required.",
    "These cards have graduated with honors! Just checking in every few weeks.",
    "Welcome to flashcard retirement! These cards are just enjoying the view now.",
    "Box 5: Where flashcards go to enjoy their golden years.",
    "Memory mastery achieved! These cards are just here for the occasional reunion.",
    "You've conquered these cards! They're just hanging out for the occasional refresher.",
    "These cards are practically part of your permanent memory now!",
    "Box 5: The exclusive club for your most mastered knowledge.",
    "Three-week vacations for these cards - they've earned it!",
    "Knowledge unlocked! These cards are now in long-term storage.",
    "Mission accomplished! These cards are now just old friends you visit occasionally."
  ]
};

const SpacedRepetition = ({
  cards,
  currentBox,
  spacedRepetitionData,
  onSelectBox,
  onMoveCard,
  onReturnToBank,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCards, setCurrentCards] = useState([]);
  const [showFlipResponse, setShowFlipResponse] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyCompleted, setStudyCompleted] = useState(false);
  
  // State for subject and topic selection
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  
  // Add a state variable to track the last shown empty message
  const [lastEmptyMessageIndex, setLastEmptyMessageIndex] = useState(-1);
  
  // State for card review
  const [showReviewDateMessage, setShowReviewDateMessage] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // New state for feedback message after card movement
  const [feedbackMessage, setFeedbackMessage] = useState("");
  // State for humorous completion modal
  const [humorousCompletionMessage, setHumorousCompletionMessage] = useState("");
  const [showHumorousCompletionModal, setShowHumorousCompletionModal] = useState(false);
  
  // New state for grouped cards by subject and topic
  const [groupedBoxCards, setGroupedBoxCards] = useState({});
  const [boxSubjects, setBoxSubjects] = useState([]);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [reviewableCards, setReviewableCards] = useState({ subjects: {}, topics: {} });
  
  // State for study modal
  const [showStudyModal, setShowStudyModal] = useState(false);

  // Add a new state to manage flip response overlay
  const [showFlipResponseOverlay, setShowFlipResponseOverlay] = useState(false);
  
  // Refs for timeouts
  const feedbackTimeoutRef = useRef(null);
  const answerFeedbackTimeoutRef = useRef(null); // For MCQ immediate feedback

  // New state for Study Topic Selection Modal
  const [isStudyTopicModalOpen, setIsStudyTopicModalOpen] = useState(false);
  const [activeStudySubjectForModal, setActiveStudySubjectForModal] = useState(null); // { name, color, topicsWithDueCards }

  // State for review session
  const [shuffledCards, setShuffledCards] = useState([]);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, reviewedCount: 0 });
  const [showSummary, setShowSummary] = useState(false);
  const [isLoadingNextCard, setIsLoadingNextCard] = useState(false);

  // Add state for the current box message
  const [currentBoxMessage, setCurrentBoxMessage] = useState("");
  // State for the detailed message when a box is completely empty
  const [emptyBoxDetailMessage, setEmptyBoxDetailMessage] = useState("");
  const [lastRandomMessageIndices, setLastRandomMessageIndices] = useState({});

  // Define shuffleArray EARLIER
  const shuffleArray = useCallback((array) => {
    let currentIndex = array.length, randomIndex;
    const newArray = [...array];
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [newArray[currentIndex], newArray[randomIndex]] = [
        newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
  }, []);

  // Define startReviewSession EARLIER, it uses shuffleArray
  const startReviewSession = useCallback((cardsToReview) => {
    if (cardsToReview && cardsToReview.length > 0) {
      dlog("[SpacedRepetition] Starting review session with", cardsToReview.length, "cards.");
      setShuffledCards(shuffleArray([...cardsToReview])); // shuffleArray is used here
      setCurrentIndex(0);
      setSessionStats({ correct: 0, incorrect: 0, reviewedCount: 0 });
      setShowSummary(false);
      setStudyCompleted(false);
      setIsStudyTopicModalOpen(false); 
      setActiveStudySubjectForModal(null); 
    } else {
      dwarn("[SpacedRepetition] Attempted to start review session with no cards.");
    }
  }, [shuffleArray, setShuffledCards, setCurrentIndex, setSessionStats, setShowSummary, setStudyCompleted, setIsStudyTopicModalOpen, setActiveStudySubjectForModal]); // Added all state setters used

  const cleanSubjectNameForDisplay = (name) => name.replace(/\s*\((A-Level|GCSE|AS-Level|BTEC|IB Diploma|National 5|Higher|Advanced Higher)\)$/i, '').trim();

  // Data grouping for study section
  const groupedSubjectsForStudy = useMemo(() => {
    if (!cards || cards.length === 0) {
      return [];
    }
    dlog("[SpacedRepetition] Grouping cards for study view. Total cards in box:", cards.length);

    const subjectsMap = new Map();

    cards.forEach(card => {
      if (!card || !card.subject) return;

      const originalSubjectName = card.subject;
      const displaySubjectName = cleanSubjectNameForDisplay(originalSubjectName);
      const topicName = card.topic || 'General';

      if (!subjectsMap.has(displaySubjectName)) {
        subjectsMap.set(displaySubjectName, {
          name: displaySubjectName, // Use cleaned name for display and as key
          originalName: originalSubjectName, // Keep original for any lookups if needed
          color: card.subjectColor || '#808080',
          cardsDueInSubject: 0,
          topics: new Map()
        });
      }

      const currentSubject = subjectsMap.get(displaySubjectName);
      currentSubject.cardsDueInSubject++;

      if (!currentSubject.topics.has(topicName)) {
        currentSubject.topics.set(topicName, {
          id: card.topicId || `${displaySubjectName}_${topicName}`.replace(/\s+/g, '_'),
          name: topicName,
          color: card.topicColor || card.cardColor || currentSubject.color,
          cardsDueInTopicCount: 0,
        });
      }
      currentSubject.topics.get(topicName).cardsDueInTopicCount++;
    });

    const result = Array.from(subjectsMap.values()).map(subject => ({
      ...subject,
      topics: Array.from(subject.topics.values()).sort((a, b) => a.name.localeCompare(b.name))
    }));
    
    result.sort((a,b) => a.name.localeCompare(b.name));
    dlog("[SpacedRepetition] Grouped subjects for study (cleaned names):", result);
    return result;
  }, [cards]);

  // Add this array of humorous empty state messages
  const emptyStateMessages = [
    "Actually enjoy your free time (shocking concept, we know)",
    "Touch some grass (it's that green stuff outside)",
    "Tell your friends you've \"completed education\" (they'll be so impressed)",
    "Grab a celebratory snack (you've earned it, memory master)",
    "Take a screenshot as proof this app actually lets you finish sometimes",
    "Write more flashcards because apparently you're some kind of knowledge glutton",
    "Practice explaining to non-students what spaced repetition is (good luck)",
    "Do a victory dance (we won't judge, your webcam might)",
    "Check back later when we've cooked up more brain food for you",
    "Wonder briefly if this is a glitch (it's not, you're just that good)"
  ];

  // New useEffect to pick a random message when currentBox changes
  useEffect(() => {
    const messagesForBox = boxMessages[currentBox];
    if (messagesForBox && messagesForBox.length > 0) {
      let randomIndex;
      // Avoid repeating the last message shown for this box if possible
      if (messagesForBox.length > 1) {
        do {
          randomIndex = Math.floor(Math.random() * messagesForBox.length);
        } while (randomIndex === lastRandomMessageIndices[currentBox]);
      } else {
        randomIndex = 0;
      }
      setCurrentBoxMessage(messagesForBox[randomIndex]);
      setLastRandomMessageIndices(prev => ({ ...prev, [currentBox]: randomIndex }));
    } else {
      setCurrentBoxMessage(""); // Default if no messages for the box
    }
  }, [currentBox]);

  // New useEffect to set the detailed empty box message
  useEffect(() => {
    // Only update if there are no subjects to display AND no active review session
    if (groupedSubjectsForStudy.length === 0 && (!shuffledCards || shuffledCards.length === 0)) {
      const messages = emptyStateMessages; // Use the correct array
      if (messages && messages.length > 0) {
        let randomIndex;
        const contextKey = `emptyBox-${currentBox}`;
        if (messages.length > 1) {
          do {
            randomIndex = Math.floor(Math.random() * messages.length);
          } while (randomIndex === lastRandomMessageIndices[contextKey]);
        } else {
          randomIndex = 0;
        }
        setEmptyBoxDetailMessage(messages[randomIndex]);
        setLastRandomMessageIndices(prev => ({ ...prev, [contextKey]: randomIndex }));
      } else {
        setEmptyBoxDetailMessage("This box is currently empty. Great job keeping up!");
      }
    }
  }, [currentBox, groupedSubjectsForStudy, shuffledCards, lastRandomMessageIndices]); // lastRandomMessageIndices is needed here to prevent re-picking same if other deps change

  // New useEffect to manage study session state (currentIndex, studyCompleted, flip states)
  // This reacts to changes in `shuffledCards` (instead of currentCards) when a session starts.
  useEffect(() => {
    dlog('[SR Effect] Running. showStudyModal:', showStudyModal, 'shuffledCards.length:', shuffledCards.length, 'currentIndex:', currentIndex, 'studyCompleted (before):', studyCompleted);
    // If not in study modal (i.e., review session not active via this modal flow), reset session.
    // The primary condition for an active review session is shuffledCards.length > 0
    if (shuffledCards.length === 0) { 
      setCurrentIndex(0);
      // setStudyCompleted(false); // Only set studyCompleted to true when a session genuinely ends.
      // setShowHumorousCompletionModal(false); // This should be handled by session end logic
      resetCardVisualState();
      // Clear timeouts
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (answerFeedbackTimeoutRef.current) clearTimeout(answerFeedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
      answerFeedbackTimeoutRef.current = null;
      return;
    }

    // If we have shuffled cards, ensure currentIndex is valid.
    const newIndex = Math.min(Math.max(currentIndex, 0), shuffledCards.length - 1);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }

    // Reset visual state for the new card if index changed or shuffledCards updated
    resetCardVisualState();

  }, [shuffledCards, currentIndex]); // Depend on shuffledCards and currentIndex

  
  // Toggle expansion of a subject
  const toggleExpandSubject = (subject) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));
  };
  
  // Toggle expansion of a topic
  const toggleExpandTopic = (subjectTopic) => {
    setExpandedTopics(prev => ({
      ...prev,
      [subjectTopic]: !prev[subjectTopic]
    }));
  };
  
  // Select all cards in a subject for review
  const reviewSubject = (subject) => {
    const currentPropsCards = cards || [];
    const subjectCards = currentPropsCards.filter(card => (card.subject || "General") === subject);

    // Check if there are *any* cards in this subject, not just reviewable ones
    if (subjectCards.length > 0) {
      setSelectedSubject(subject);
      setSelectedTopic(null);
      setShowStudyModal(true); // This will trigger the useEffect to filter currentCards for study
    } else {
      // Keep an alert if the subject is truly empty, or handle as desired
      alert(`There are no cards in the subject "${subject}".`);
    }
  };
  
  // Select cards in a specific topic for review
  const reviewTopic = (subject, topic) => {
    const currentPropsCards = cards || [];
    const topicCards = currentPropsCards.filter(card =>
        (card.subject || "General") === subject &&
        (card.topic || "General") === topic
    );

    // Check if there are *any* cards in this topic
    if (topicCards.length > 0) {
      setSelectedSubject(subject);
      setSelectedTopic(topic);
      setShowStudyModal(true);
    } else {
      // Keep an alert if the topic is truly empty, or handle as desired
      alert(`There are no cards in the topic "${topic}" under "${subject}".`);
    }
  };
  
  // Handle card flip action
  const handleCardFlip = () => {
    const cardToEvaluate = shuffledCards[currentIndex]; // Use shuffledCards
    if (!isFlipped) {
      setIsFlipped(true);
      if (cardToEvaluate?.questionType !== 'multiple_choice') {
        setTimeout(() => {
          setShowFlipResponse(true);
          setShowFlipResponseOverlay(true);
        }, 300);
      }
    } else {
      if (cardToEvaluate?.questionType !== 'multiple_choice' && !showFlipResponse) {
        setShowFlipResponse(true);
        setShowFlipResponseOverlay(true);
      }
    }
  };

  // This is the main handler for when FlippableCard reports an answer (for MCQs)
  // or when manual correct/incorrect buttons are pressed for non-MCQs.
  const handleAnswer = useCallback((isCorrect, selectedOptionIndexOrNil) => {
    const cardAnswered = shuffledCards[currentIndex];
    if (!cardAnswered) {
      derr("[SpacedRepetition] handleAnswer called but no card at currentIndex.");
      return;
    }

    dlog(`[SpacedRepetition] handleAnswer: Card ID ${cardAnswered.id}, Correct: ${isCorrect}`);
    setSessionStats(prev => ({
      ...prev,
      reviewedCount: prev.reviewedCount + 1,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect,
    }));

    setIsFlipped(true); // Ensure card is visually flipped

    // Determine next box
    const nextBox = isCorrect ? Math.min(currentBox + 1, 5) : 1;
    onMoveCard(cardAnswered.id, nextBox);
    
    setFeedbackMessage(`Card moved to Box ${nextBox}.`);
    setShowReviewDateMessage(true); // Show feedback briefly

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setShowReviewDateMessage(false);
      setFeedbackMessage("");
      // Proceed to next card or show summary
      if (currentIndex < shuffledCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        // Visual state reset will be handled by the useEffect watching currentIndex
      } else {
        dlog("[SpacedRepetition] Last card answered. Showing summary.");
        setShowSummary(true);
        // Potentially show humorous completion if all cards in the box are done.
        // This logic might need refinement based on whether all *reviewable* cards are done.
      }
    }, 1200); // Duration to show feedback before moving

  }, [currentIndex, shuffledCards, currentBox, onMoveCard]);

  // Reset selection state when moving to a new card (now mainly for flip state)
  const resetCardVisualState = () => {
    setIsFlipped(false);
    setShowFlipResponse(false);
    setShowFlipResponseOverlay(false);
  };
  
  // Restore prevCard and nextCard, ensure they use setShuffledCards if modifying the deck directly,
  // or rely on onMoveCard to trigger re-filtering if that's the flow.
  // For now, they just navigate the current shuffledCards deck.
  const nextCard = useCallback(() => {
    if (currentIndex < shuffledCards.length - 1) {
      setCurrentIndex(prevIndex => prevIndex + 1);
    } else {
      // If it's the last card, and not already in summary view, show summary.
      if (!showSummary) {
        dlog('[SR nextCard] Reached end of cards, setting showSummary to true.');
        setShowSummary(true); 
        setStudyCompleted(true); // Mark study as completed when summary is shown
      }
    }
  }, [currentIndex, shuffledCards.length, showSummary]);

  const prevCard = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Get contrast color for text
  const getContrastColor = (hexColor) => {
    if (!hexColor) return '#000000';
    
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

  // Add function to toggle the info modal
  const toggleInfoModal = (e) => {
    if (e) e.stopPropagation();
    setShowInfoModal(!showInfoModal);
  };

  // Computed property to check if we have a valid card to work with
  const isValidCard = shuffledCards && 
                     shuffledCards.length > 0 && 
                     currentIndex >= 0 && 
                     currentIndex < shuffledCards.length && 
                     shuffledCards[currentIndex] !== undefined;

  // Get the current card if it's valid
  const currentCardToDisplay = isValidCard ? shuffledCards[currentIndex] : null;

  const handleCloseReviewSession = useCallback(() => {
    dlog("[SpacedRepetition] Closing active review session.");
    setShuffledCards([]);
    setCurrentIndex(0);
    setSessionStats({ correct: 0, incorrect: 0, reviewedCount: 0 });
    setShowSummary(false);
    setIsFlipped(false); // Reset flip state
    // No need to call onReturnToBank as we are returning to the box view, not the main card bank
  }, []);

  // Render subject containers for the current box
  const renderSubjectContainers = () => {
    if (boxSubjects.length === 0) {
      return (
        <div className="empty-box">
          <h3>No cards in Box {currentBox}</h3>
          <p>
            There are no cards in this box. Move cards from other boxes or add new cards to your collection.
          </p>
        </div>
      );
    }
    
    return (
      <div className="subjects-container">
        {boxSubjects.map((subject) => {
          const subjectCardsFlat = Object.values(groupedBoxCards[subject] || {} ).flat();
          const subjectColor = subjectCardsFlat[0]?.baseColor || subjectCardsFlat[0]?.cardColor || '#e0e0e0';
          const textColor = getContrastColor(subjectColor);
          const subjectHasCards = subjectCardsFlat.length > 0;
          
          return (
            <div key={subject} className="subject-box">
              <div 
                className="subject-header"
                style={{ 
                  backgroundColor: subjectColor,
                  color: textColor
                }}
              >
                <div className="subject-content" onClick={() => toggleExpandSubject(subject)}>
                  <div className="subject-info">
                    <h2>{subject}</h2>
                    <div className="subject-meta">
                      <span className="box-badge">Box {currentBox}</span>
                      {subjectCardsFlat.some(card => card.isReviewable === true) && <span className="reviewable-badge">Ready for Review</span>}
                    </div>
                  </div>
                  <span className="card-count">
                    ({subjectCardsFlat.length} cards)
                  </span>
                </div>
                <button 
                  className="review-btn" 
                  onClick={() => reviewSubject(subject)}
                  style={{ color: textColor }}
                  disabled={!subjectHasCards}
                  title={subjectHasCards ? "View cards in this subject" : "No cards in this subject"}
                >
                  <span className="review-icon">👁️</span>
                </button>
              </div>

              {expandedSubjects[subject] && (
                <div className="topics-list-container">
                  {Object.keys(groupedBoxCards[subject] || {} ).map((topic) => {
                    const topicCardsFlat = groupedBoxCards[subject][topic] || [];
                    const topicColor = topicCardsFlat[0]?.cardColor || '#e0e0e0';
                    const textColorTopic = getContrastColor(topicColor);
                    const topicKey = `${subject}-${topic}`;
                    const topicHasCards = topicCardsFlat.length > 0;
                    
                    return (
                      <div key={topicKey} className="topic-group">
                        <div 
                          className="topic-header"
                          style={{ 
                            backgroundColor: topicColor,
                            color: textColorTopic
                          }}
                          onClick={() => topicHasCards ? reviewTopic(subject, topic) : null}
                        >
                          <div className="topic-content">
                            <div className="topic-info">
                              <h3>{topic}</h3>
                            </div>
                            <div className="topic-meta">
                              <span className="card-count">
                                ({topicCardsFlat.length} cards)
                              </span>
                              {topicCardsFlat.some(card => card.isReviewable === true) && <span className="topic-reviewable-badge">Ready</span>}
                            </div>
                          </div>
                          <button 
                            className="review-btn small" 
                            onClick={(e) => { 
                              e.stopPropagation();
                              if (topicHasCards) reviewTopic(subject, topic);
                            }}
                            style={{ color: textColorTopic }}
                            disabled={!topicHasCards}
                            title={topicHasCards ? "View cards in this topic" : "No cards in this topic"}
                          >
                            <span className="review-icon">👁️</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render the flashcard review interface when a subject/topic is selected
  const renderCardReview = () => {
    dlog('[SR renderCardReview] Rendering. studyCompleted:', studyCompleted, 'currentCards.length:', currentCards.length, 'currentIndex:', currentIndex);

    // PRIORITY CHECK 1: If study is marked as completed (and humorous modal isn't already up), show completion message.
    // The humorous modal takes precedence if it's active.
    if (studyCompleted && !showHumorousCompletionModal) {
      dlog('[SR renderCardReview] Rendering completion message because studyCompleted is true and humorous modal is not active.');
      // This might be redundant if humorous modal is always shown on completion, but good as a fallback.
      return (
        <div className="completion-message">
          <h3>Session Complete!</h3>
          <p>You've reviewed all available cards for this selection.</p>
          <button 
            className="return-button" 
            onClick={() => {
              setSelectedSubject(null);
              setSelectedTopic(null);
              setStudyCompleted(false); 
              setShowStudyModal(false); 
            }}
          >
            Return to Box View
          </button>
        </div>
      );
    }

    // PRIORITY CHECK 2: If no cards are available for the current filter
    // This check is important if studyCompleted hasn't been set yet by the effect,
    // or if the humorous modal isn't the desired display for an initially empty filter.
    if ((!currentCards || currentCards.length === 0) && !showHumorousCompletionModal) {
      dlog('[SR renderCardReview] Rendering empty box message (no currentCards, and humorous modal not active).');
      return (
        <div className="empty-box">
          <h3>Wow! You're keen!!</h3>
          <p>
            There are no cards to review here at the moment, you can go and...
          </p>
          <p className="empty-message">
            {emptyBoxDetailMessage}
          </p>
          <p className="pro-tip">
            Pro tip: This empty screen is actually a flashcard testing if you remember what free time feels like. How'd you do?
          </p>
          <button 
            className="return-button" 
            onClick={() => {
              setSelectedSubject(null);
              setSelectedTopic(null);
              setShowStudyModal(false); 
            }}
          >
            Return to Box View
          </button>
        </div>
      );
    }

    // PRIORITY CHECK 3: If currentIndex is out of bounds for the currentCards array.
    if (currentIndex < 0 || currentIndex >= currentCards.length || !currentCards[currentIndex]) {
      dlog('[SR renderCardReview] currentIndex is out of bounds or card is undefined. currentCards.length:', currentCards.length, 'currentIndex:', currentIndex, '. This likely means the last card was just processed.');
      return (
        <div className="completion-message"> {/* Using completion message as it's more accurate */}
          <h3>All cards for this selection reviewed!</h3>
          <p>You've gone through all available cards for this specific filter.</p>
          <button 
            className="return-button" 
            onClick={() => {
              setSelectedSubject(null);
              setSelectedTopic(null);
              setStudyCompleted(false); // Ensure reset
              setShowStudyModal(false);
            }}
          >
            Return to Box View
          </button>
        </div>
      );
    }
    
    const currentCardForRender = currentCards[currentIndex]; // Define after checks
    dlog('[SR renderCardReview] isValidCardCheck: true (implied by passing guards), currentCardForRender ID:', currentCardForRender?.id);


    if (!currentCardForRender || (!currentCardForRender.front && !currentCardForRender.question)) {
      dlog('[SR renderCardReview] Rendering invalid card message. currentCardForRender:', currentCardForRender);
      return (
        <div className="empty-box">
          <h3>Invalid Card Detected</h3>
          <p>
            This card appears to be missing critical data and cannot be displayed properly.
          </p>
          <div className="card-navigation">
            <button className="prev-button" onClick={prevCard}>Previous</button>
            <button className="next-button" onClick={nextCard}>Next</button>
          </div>
          <button 
            className="return-button" 
            onClick={() => {
              setSelectedSubject(null);
              setSelectedTopic(null);
              setShowStudyModal(false);
            }}
          >
            Return to Box View
          </button>
        </div>
      );
    }

    return (
      <div className="card-study-area">
        <div className="study-context">
          <button 
            className="back-to-box-button" 
            onClick={() => {
              setSelectedSubject(null);
              setSelectedTopic(null);
              setShowStudyModal(false); // Close the modal
            }}
          >
            ← Back to Box
          </button>
          <div className="current-study-info">
            Studying: {selectedSubject || "All Subjects"} {selectedTopic ? `> ${selectedTopic}` : ""}
          </div>
        </div>
        
        {currentCardForRender && (
          <FlippableCard
            card={currentCardForRender}
            isFlipped={isFlipped}
            onFlip={handleCardFlip}
            onAnswer={currentCardForRender.questionType === 'multiple_choice' ? handleAnswer : undefined}
            isInModal={true}
            // Pass lock status and review date for "already studied" cards
            isLocked={!currentCardForRender.isReviewable}
            lockedNextReviewDate={currentCardForRender.nextReviewDate}
          />
        )}
        {dlog('[SR renderCardReview] Proceeding to render FlippableCard for card ID:', currentCardForRender?.id, 'isReviewable:', currentCardForRender.isReviewable)}

        <div className="card-navigation">
          <button
            className="prev-button"
            onClick={prevCard}
            disabled={currentIndex === 0}
          >
            Previous
          </button>
          <div className="card-counter">
            <span className="card-index">
              {currentIndex + 1} / {currentCards.length}
            </span>
          </div>
          <button
            className="next-button"
            onClick={nextCard}
            disabled={currentIndex === currentCards.length - 1}
          >
            Next
          </button>
        </div>
        
        {showFlipResponse && currentCardToDisplay?.questionType !== 'multiple_choice' && isValidCard && (
          <>
            <div className={`flip-response-overlay ${showFlipResponseOverlay ? 'active' : ''}`}></div>
            <div className="flip-response">
                <div>
                  <p>How did you do? Mark your card as correct or incorrect:</p>
                  <div className="response-buttons">
                    <button className="incorrect-button" onClick={() => handleAnswer(false)}>
                      Incorrect (Box 1)
                    </button>
                    <button className="correct-button" onClick={() => handleAnswer(true)}>
                      Correct (Box {Math.min(currentBox + 1, 5)})
                    </button>
                  </div>
                </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Handlers for the new Study Subject/Topic selection flow
  const handleOpenStudyTopicsModal = useCallback((subjectData) => {
    dlog("[SpacedRepetition] Opening study topics modal for:", subjectData.name);
    setActiveStudySubjectForModal(subjectData); 
    setIsStudyTopicModalOpen(true);
  }, [setActiveStudySubjectForModal, setIsStudyTopicModalOpen]); // Added dependencies

  const handleCloseStudyTopicsModal = useCallback(() => {
    setIsStudyTopicModalOpen(false);
    setActiveStudySubjectForModal(null);
  }, [setIsStudyTopicModalOpen, setActiveStudySubjectForModal]); // Added dependencies

  const handleReviewAllSubjectCardsInBox = useCallback((subjectDisplayData) => {
    dlog("[SpacedRepetition] Reviewing all cards in box for subject:", subjectDisplayData.name);
    const cardsForSubjectInBox = cards.filter(card => card.subject === subjectDisplayData.originalName);
    startReviewSession(cardsForSubjectInBox);
  }, [cards, startReviewSession]);

  const handleReviewTopicCardsFromModal = useCallback((subjectDisplayData, topicData) => {
    dlog("[SpacedRepetition] Reviewing cards from modal for topic:", topicData.name, "in subject:", subjectDisplayData.name);
    const cardsForTopicInBox = cards.filter(card => 
        card.subject === subjectDisplayData.originalName && 
        card.topic === topicData.name
    );
    startReviewSession(cardsForTopicInBox);
  }, [cards, startReviewSession]);

  // Main return statement
  return (
    <div className="spaced-repetition-container">
      {!showSummary && shuffledCards.length > 0 && currentIndex < shuffledCards.length && currentCardToDisplay ? (
        // Active Review Session View
        <div className="review-session-active">
          <div className="card-progression-header">
            <button onClick={handleCloseReviewSession} className="close-review-session-button" title="Close Study Session">&times;</button>
            <div className="card-counter">
              Card {currentIndex + 1} of {shuffledCards.length} (Box {currentBox})
            </div>
            <div className="session-stats-display">
              Correct: {sessionStats.correct} | Incorrect: {sessionStats.incorrect}
            </div>
          </div>
          
          {isLoadingNextCard ? (
            <div className="loading-next-card">
              <div className="spinner"></div>
              <p>Loading next card...</p>
            </div>
          ) : (
            <FlippableCard
              key={currentCardToDisplay.id} 
              card={currentCardToDisplay}
              isFlipped={isFlipped}
              onFlip={handleCardFlip}
              onAnswer={handleAnswer}
              isLocked={!currentCardToDisplay.isReviewable}
              lockedNextReviewDate={currentCardToDisplay.nextReviewDate}
            />
          )}
          {isFlipped && currentCardToDisplay && currentCardToDisplay.questionType !== 'multiple_choice' && (
            <div className="flip-response manual-judgment-buttons">
                <p>How did you do?</p>
                <div className="response-buttons">
                  <button className="incorrect-button" onClick={() => handleAnswer(false)}>
                    Incorrect (Box 1)
                  </button>
                  <button className="correct-button" onClick={() => handleAnswer(true)}>
                    Correct (Box {Math.min(currentBox + 1, 5)})
                  </button>
                </div>
            </div>
          )}
        </div>
      ) : !showSummary ? (
        // Initial View: Select Subject/Topic or No Cards View
        <div className={`study-selection-view box-info box-info-${currentBox}`}>
          <div className="study-selection-header">
            <button onClick={onReturnToBank} className="return-to-bank-button top-right-button">&larr; Back to Bank</button>
            <h2>Study Box {currentBox}</h2>
            {currentBoxMessage && <p className="box-humorous-message">{currentBoxMessage}</p>}
            <p>Select a subject to study, or review all cards for a subject in this box.</p>
          </div>

          {groupedSubjectsForStudy.length === 0 ? (
            <div className="no-cards-for-study-box">
              <h3>🎉 All Clear! 🎉</h3>
              <p>{emptyBoxDetailMessage}</p>
              <p>There are no cards to review in Box {currentBox} right now.</p>
              <button onClick={onReturnToBank} className="return-to-bank-button spaced-rep-button large-empty-button">
                Go to Card Bank
              </button>
            </div>
          ) : (
            <div className="study-subject-list">
              {groupedSubjectsForStudy.map(subject => (
                <StudySubjectDisplay
                  key={subject.name}
                  subjectName={subject.name}
                  subjectColor={subject.color}
                  cardsDueInSubject={subject.cardsDueInSubject}
                  onReviewAll={() => handleReviewAllSubjectCardsInBox(subject)}
                  onOpenTopicsModal={() => handleOpenStudyTopicsModal(subject)}
                />
              ))}
            </div>
          )}
          
          {activeStudySubjectForModal && (
            <StudyTopicSelectionModal
              isOpen={isStudyTopicModalOpen}
              onClose={handleCloseStudyTopicsModal}
              subjectName={activeStudySubjectForModal.name}
              subjectColor={activeStudySubjectForModal.color}
              topicsWithDueCards={activeStudySubjectForModal.topics}
              onReviewTopic={(subjectName, topicData) => handleReviewTopicCardsFromModal(activeStudySubjectForModal, topicData)}
            />
          )}
        </div>
      ) : showSummary ? (
        <div className="session-summary-view">
          <h3>Session Summary (Box {currentBox})</h3>
          <p>Cards Reviewed: {sessionStats.reviewedCount}</p>
          <p>Correct: {sessionStats.correct}</p>
          <p>Incorrect: {sessionStats.incorrect}</p>
          <button onClick={() => {
            setShowSummary(false);
            setShuffledCards([]); // Clear shuffled cards to return to selection view
            setCurrentIndex(0);
          }}>Review More in this Box</button>
          <button onClick={onReturnToBank} style={{marginLeft: '10px'}}>Back to Card Bank</button>
        </div>
      ) : (
        <div className={`study-selection-view box-info box-info-${currentBox}`}>
          <div className="study-selection-header">
            <button onClick={onReturnToBank} className="return-to-bank-button top-right-button">&larr; Back to Bank</button>
            <h2>Study Box {currentBox}</h2>
            {currentBoxMessage && <p className="box-humorous-message">{currentBoxMessage}</p>}
          </div>
          <div className="no-cards-for-study-box">
            <h3>🎉 All Clear! 🎉</h3>
            <p>{emptyBoxDetailMessage}</p>
            <p>There are no cards to review in Box {currentBox} right now.</p>
            <button onClick={onReturnToBank} className="return-to-bank-button spaced-rep-button large-empty-button">
              Go to Card Bank
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpacedRepetition;
