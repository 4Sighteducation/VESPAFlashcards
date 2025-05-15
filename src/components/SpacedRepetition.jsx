import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import "./SpacedRepetition.css";
import FlippableCard from './FlippableCard';

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

  // Enhanced function to get a random message that avoids repeating the last message
  const getRandomEmptyStateMessage = () => {
    if (emptyStateMessages.length <= 1) return emptyStateMessages[0];
    
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * emptyStateMessages.length);
    } while (randomIndex === lastEmptyMessageIndex);
    
    // Store this index for next time
    setLastEmptyMessageIndex(randomIndex);
    return emptyStateMessages[randomIndex];
  };
  
  // Renamed and simplified: This function now only filters cards based on selection.
  // It does NOT reset currentIndex or other session states directly.
  const updateCurrentCardsInternal = useCallback((grouped) => {
    let cardsToStudy = [];
    
    if (selectedSubject && selectedTopic) {
      cardsToStudy = grouped[selectedSubject]?.[selectedTopic] || [];
    } else if (selectedSubject) {
      const topicsForSubject = grouped[selectedSubject] || {};
      cardsToStudy = Object.values(topicsForSubject).flat();
    } else {
      // If no subject is selected, we might be in the main box view,
      // or this function might be called in a context where "all cards" means all in the current box.
      // For the study modal, a subject/topic will typically be selected.
      // If we want to study "all cards in the box", this needs specific handling.
      // For now, assume if a subject/topic isn't selected, we are not in the study modal context
      // or the cards are already appropriately filtered by the parent `cards` prop.
      cardsToStudy = Object.values(grouped)
        .map(topicMap => Object.values(topicMap).flat())
        .flat();
    }

    // We no longer filter by reviewability here.
    // The 'isReviewable' and 'nextReviewDate' properties on each card object
    // (passed via the `cards` prop, likely from App.js's getCardsForCurrentBox)
    // will be used by FlippableCard to determine its locked/display state.
    setCurrentCards(cardsToStudy);
    // DO NOT reset currentIndex, isFlipped, etc. here. This will be handled by a new useEffect.

  }, [selectedSubject, selectedTopic]); // Removed showStudyModal as it's not directly used for filtering logic here

  // Effect for when the base `cards` prop (from App.js) or selection changes
  useEffect(() => {
    if (cards && cards.length > 0) {
      const grouped = cards.reduce((acc, card) => {
        const subject = card.subject || "General";
        const topic = card.topic || "General";
        if (!acc[subject]) acc[subject] = {};
        if (!acc[subject][topic]) acc[subject][topic] = [];
        acc[subject][topic].push(card);
        return acc;
      }, {});
      
      setGroupedBoxCards(grouped);
      setBoxSubjects(Object.keys(grouped).sort());
      
      const reviewable = { subjects: {}, topics: {} };
      const todayUTC = new Date(); // Use UTC for reviewability check
      todayUTC.setUTCHours(0, 0, 0, 0);

      Object.keys(grouped).forEach(subject => {
        reviewable.subjects[subject] = false;
        Object.keys(grouped[subject]).forEach(topic => {
          const topicKey = `${subject}-${topic}`;
          const cardsInTopic = grouped[subject][topic];
          const hasReviewableCards = cardsInTopic.some(card => card.isReviewable === true);
          reviewable.topics[topicKey] = hasReviewableCards;
          if (hasReviewableCards) reviewable.subjects[subject] = true;
        });
      });
      setReviewableCards(reviewable);
      
      // Update the study session cards based on current filters
      updateCurrentCardsInternal(grouped);

    } else {
      setGroupedBoxCards({});
      setBoxSubjects([]);
      setReviewableCards({ subjects: {}, topics: {} });
      setCurrentCards([]); // Clear current cards if the box is empty
    }
  }, [cards, currentBox, selectedSubject, selectedTopic, spacedRepetitionData, updateCurrentCardsInternal]); // updateCurrentCardsInternal is now a dependency


  // New useEffect to manage study session state (currentIndex, studyCompleted, flip states)
  // This reacts to changes in `currentCards` (after filtering) and when the study modal opens/closes.
  useEffect(() => {
    console.log('[SR Effect] Running. showStudyModal:', showStudyModal, 'currentCards.length:', currentCards.length, 'currentIndex:', currentIndex, 'studyCompleted (before):', studyCompleted);
    if (!showStudyModal) {
      // Modal closed: Reset session states
      setCurrentIndex(0);
      setStudyCompleted(false);
      setShowHumorousCompletionModal(false); // Ensure modal is hidden when study modal closes
      resetCardVisualState();
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (answerFeedbackTimeoutRef.current) clearTimeout(answerFeedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
      answerFeedbackTimeoutRef.current = null;
      return;
    }

    // Modal is open: Adjust state based on currentCards
    if (currentCards.length > 0) {
      const newIndex = Math.min(Math.max(currentIndex, 0), currentCards.length - 1);
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
      // If we have cards, and study was marked completed (e.g. by mistake or race condition),
      // reset studyCompleted to false as we are now in an active session with cards.
      if (studyCompleted) {
        console.log('[SR Effect] Has cards, but studyCompleted was true. Resetting studyCompleted to false.');
        setStudyCompleted(false);
      }
      setShowHumorousCompletionModal(false); // If we have cards, ensure humorous modal is not shown
      console.log('[SR Effect] Has cards. newIndex:', newIndex);
    } else { // currentCards.length is 0
      // No cards available for the current filter OR user has finished all cards.
      // If studyCompleted is true (meaning user went through cards and finished),
      // OR if it wasn't completed but now there are no cards (e.g. initial empty set for filter).
      if (studyCompleted || !showHumorousCompletionModal) { // Show if completed OR if not already shown for empty set
        console.log('[SR Effect] No cards or studyCompleted. Triggering humorous modal. studyCompleted:', studyCompleted);
        if (!studyCompleted) setStudyCompleted(true); // Ensure it is marked as completed
        setCurrentIndex(0);
        const message = getRandomEmptyStateMessage();
        setHumorousCompletionMessage(message);
        if (!showHumorousCompletionModal) setShowHumorousCompletionModal(true);
      } else {
        console.log('[SR Effect] No cards, but humorous modal already shown or not meeting condition. studyCompleted:', studyCompleted);
      }
    }

    resetCardVisualState();

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    if (answerFeedbackTimeoutRef.current) {
      clearTimeout(answerFeedbackTimeoutRef.current);
      answerFeedbackTimeoutRef.current = null;
    }
  }, [currentCards, showStudyModal, currentIndex, studyCompleted]); // Added studyCompleted to dependencies

  
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
    // This function is primarily for non-MCQ cards, or for MCQs if user explicitly flips after answering.
    if (!isFlipped) {
      setIsFlipped(true);
      // For non-MCQ, flipping reveals the answer. Show response buttons after a brief moment.
      if (currentCard?.questionType !== 'multiple_choice') {
        setTimeout(() => {
          setShowFlipResponse(true);
          setShowFlipResponseOverlay(true);
        }, 300); // Delay to allow flip animation
      }
    } else {
      // If card is already flipped (showing answer) and it's not an MCQ,
      // this means they might be re-clicking to hide the correct/incorrect buttons.
      // However, the primary action here is to show the response buttons if not already shown.
      if (currentCard?.questionType !== 'multiple_choice' && !showFlipResponse) {
        setShowFlipResponse(true);
        setShowFlipResponseOverlay(true);
      }
      // For MCQs, the FlippableCard handles its own feedback display upon option selection.
      // The `onAnswer` prop in FlippableCard will trigger handleCorrect/Incorrect.
    }
  };

  // Handle multiple choice selection (via FlippableCard's onAnswer prop)
  // This function is now called by FlippableCard's onAnswer
  const handleMcqAnswer = (isCorrect, selectedOptionIndex) => {
    if (isFlipped) return; // Should not happen if onAnswer is called before manual flip

    // Directly proceed to handleCorrectAnswer or handleIncorrectAnswer
    // FlippableCard has already provided feedback to the user.
    setIsFlipped(true); // Ensure card is visually flipped to show "back" if not already.

    // Set timeout to hide feedback after a delay
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      if (isCorrect) {
        handleCorrectAnswer();
      } else {
        handleIncorrectAnswer();
      }
      answerFeedbackTimeoutRef.current = null; // Clear ref after execution
    }, 300); // Small delay for user to see FlippableCard's feedback
  };

  // Reset selection state when moving to a new card (now mainly for flip state)
  const resetCardVisualState = () => {
    setIsFlipped(false);
    setShowFlipResponse(false);
    setShowFlipResponseOverlay(false);
  };
  
  // Simplified nextCard: only changes index or sets studyCompleted.
  // The new useEffect will handle resetting flip state.
  const nextCard = useCallback(() => { // Make it a useCallback
    if (currentIndex < currentCards.length - 1) {
      setCurrentIndex(prevIndex => prevIndex + 1); // Use functional update
    } else {
      setStudyCompleted(true); 
    }
    // Flip state reset will be handled by the useEffect watching currentIndex and currentCard
  }, [currentIndex, currentCards.length]);

  // Simplified prevCard
  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      // Flip state reset will be handled by the new useEffect
    }
  };
  
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

  // Handle correct/incorrect answers
  // These functions will trigger onMoveCard, which causes `props.cards` to update.
  // The new useEffect watching `currentCards` will then handle UI updates (advancing card, etc.).
  const handleCorrectAnswer = () => {
    if (!isValidCard || !currentCard) {
      console.error("Cannot move card: No valid card found at index", currentIndex);
      return;
    }
    try {
      const nextBoxNumber = Math.min(currentBox + 1, 5);
      const cardToMoveId = currentCard.id;
      const wasLastCard = currentIndex === currentCards.length - 1;

      onMoveCard(cardToMoveId, nextBoxNumber); 
      
      setFeedbackMessage(`Card moved to Box ${nextBoxNumber}.`);
      setShowReviewDateMessage(true);

      if (wasLastCard) {
        console.log('[SR handleCorrectAnswer] Last card answered correctly. Setting studyCompleted=true, currentIndex=0.');
        setStudyCompleted(true);
        setCurrentIndex(0); 
      }

      feedbackTimeoutRef.current = setTimeout(() => {
        setShowReviewDateMessage(false);
        setFeedbackMessage("");
        feedbackTimeoutRef.current = null; 
      }, 1500);
    } catch (error) {
      console.error("Error handling correct answer:", error);
      setFeedbackMessage("Error moving card. Please try again.");
      setShowReviewDateMessage(true);
      setTimeout(() => {
          setShowReviewDateMessage(false);
          setFeedbackMessage("");
      }, 1500);
    }
  };

  const handleIncorrectAnswer = () => {
    if (!isValidCard || !currentCard) {
      console.error("Cannot move card: No valid card found at index", currentIndex);
      return;
    }
    try {
      const targetBoxNumber = 1;
      const cardToMoveId = currentCard.id;
      const wasLastCard = currentIndex === currentCards.length - 1;

      onMoveCard(cardToMoveId, targetBoxNumber);
      
      setFeedbackMessage(`Card moved to Box ${targetBoxNumber}.`);
      setShowReviewDateMessage(true);

      if (wasLastCard) {
        console.log('[SR handleIncorrectAnswer] Last card answered incorrectly. Setting studyCompleted=true, currentIndex=0.');
        setStudyCompleted(true);
        setCurrentIndex(0);
      }

      feedbackTimeoutRef.current = setTimeout(() => {
        setShowReviewDateMessage(false);
        setFeedbackMessage("");
        feedbackTimeoutRef.current = null; 
      }, 1500);
    } catch (error) {
      console.error("Error handling incorrect answer:", error);
      setFeedbackMessage("Error moving card. Please try again.");
      setShowReviewDateMessage(true);
      setTimeout(() => {
          setShowReviewDateMessage(false);
          setFeedbackMessage("");
      }, 1500);
    }
  };

  // Add function to toggle the info modal
  const toggleInfoModal = (e) => {
    if (e) e.stopPropagation();
    setShowInfoModal(!showInfoModal);
  };

  // Computed property to check if we have a valid card to work with
  const isValidCard = currentCards && 
                     currentCards.length > 0 && 
                     currentIndex >= 0 && 
                     currentIndex < currentCards.length && 
                     currentCards[currentIndex] !== undefined;

  // Get the current card if it's valid
  const currentCard = isValidCard ? currentCards[currentIndex] : null;

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
    console.log('[SR renderCardReview] Rendering. studyCompleted:', studyCompleted, 'currentCards.length:', currentCards.length, 'currentIndex:', currentIndex);

    // PRIORITY CHECK 1: If study is marked as completed (and humorous modal isn't already up), show completion message.
    // The humorous modal takes precedence if it's active.
    if (studyCompleted && !showHumorousCompletionModal) {
      console.log('[SR renderCardReview] Rendering completion message because studyCompleted is true and humorous modal is not active.');
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
      console.log('[SR renderCardReview] Rendering empty box message (no currentCards, and humorous modal not active).');
      return (
        <div className="empty-box">
          <h3>Wow! You're keen!!</h3>
          <p>
            There are no cards to review here at the moment, you can go and...
          </p>
          <p className="empty-message">
            {getRandomEmptyStateMessage()}
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
      console.log('[SR renderCardReview] currentIndex is out of bounds or card is undefined. currentCards.length:', currentCards.length, 'currentIndex:', currentIndex, '. This likely means the last card was just processed.');
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
    console.log('[SR renderCardReview] isValidCardCheck: true (implied by passing guards), currentCardForRender ID:', currentCardForRender?.id);


    if (!currentCardForRender || (!currentCardForRender.front && !currentCardForRender.question)) {
      console.log('[SR renderCardReview] Rendering invalid card message. currentCardForRender:', currentCardForRender);
      return (
        <div className="empty-box">
          <h3>Invalid Card Detected</h3>
          <p>
            This card appears to be missing critical data and cannot be displayed properly.
          </p>
          <div className="card-navigation">
            {currentIndex > 0 && (
              <button className="prev-button" onClick={prevCard}>Previous</button>
            )}
            {currentIndex < currentCards.length - 1 && (
              <button className="next-button" onClick={nextCard}>Next</button>
            )}
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
            onAnswer={currentCardForRender.questionType === 'multiple_choice' ? handleMcqAnswer : undefined}
            isInModal={true}
            // Pass lock status and review date for "already studied" cards
            isLocked={!currentCardForRender.isReviewable}
            lockedNextReviewDate={currentCardForRender.nextReviewDate}
          />
        )}
        {console.log('[SR renderCardReview] Proceeding to render FlippableCard for card ID:', currentCardForRender?.id, 'isReviewable:', currentCardForRender.isReviewable)}

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
        
        {showFlipResponse && currentCard?.questionType !== 'multiple_choice' && isValidCard && (
          <>
            <div className={`flip-response-overlay ${showFlipResponseOverlay ? 'active' : ''}`}></div>
            <div className="flip-response">
                <div>
                  <p>How did you do? Mark your card as correct or incorrect:</p>
                  <div className="response-buttons">
                    <button className="incorrect-button" onClick={handleIncorrectAnswer}>
                      Incorrect (Box 1)
                    </button>
                    <button className="correct-button" onClick={handleCorrectAnswer}>
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

  // Render the study interface
  return (
    <div className="spaced-repetition">
      {/* Box Info */}
      <div className={`box-info box-info-${currentBox}`}>
        <h2>Box {currentBox}</h2>
        <p>
          {currentBox === 1 && "Review daily."}
          {currentBox === 2 && "Review every 2 days."}
          {currentBox === 3 && "Review every 3 days."}
          {currentBox === 4 && "Review every 7 days."}
          {currentBox === 5 && "These cards are mastered. Occasional review."}
        </p>
      </div>

      {/* Always render subject containers */}
      {renderSubjectContainers()}
      
      {/* Study modal */}
      {showStudyModal && (
        <div className="study-modal-overlay" onClick={() => setShowStudyModal(false)}>
          <div className="study-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="study-modal-close" 
              onClick={() => setShowStudyModal(false)}
              aria-label="Close study modal"
            >
              ✕
            </button>
            {renderCardReview()}
          </div>
        </div>
      )}
      
      {/* Review date message / Feedback Message Modal */}
      {showReviewDateMessage && (
        <div className="feedback-modal-overlay" onClick={() => { setShowReviewDateMessage(false); setFeedbackMessage(""); }}>
          <div className="feedback-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{feedbackMessage.includes("Error") ? "Error" : "Update"}</h3>
            <p>
              {feedbackMessage}
            </p>
            {/* Only show next review date if it's part of the message (e.g. locked card) */}
            {nextReviewDate && !feedbackMessage.includes("Box") && (
              <p>
                This card has already been reviewed and is currently locked. It will be available for review on{" "}
                <strong>{nextReviewDate ? new Date(nextReviewDate).toLocaleDateString() : "a future date"}</strong>.
              </p>
            )}
            <div className="feedback-modal-actions">
              <button onClick={() => { setShowReviewDateMessage(false); setFeedbackMessage(""); }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Humorous Completion Modal */}
      {showHumorousCompletionModal && (
        <div className="feedback-modal-overlay" onClick={() => {
          setShowHumorousCompletionModal(false);
          setHumorousCompletionMessage("");
          // Also fully exit study mode
          setSelectedSubject(null);
          setSelectedTopic(null);
          setStudyCompleted(false); 
          setShowStudyModal(false);
        }}>
          <div className="feedback-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Session Complete!</h3>
            <p className="humorous-completion-message">{humorousCompletionMessage}</p>
            <div className="feedback-modal-actions">
              <button onClick={() => {
                setShowHumorousCompletionModal(false);
                setHumorousCompletionMessage("");
                setSelectedSubject(null);
                setSelectedTopic(null);
                setStudyCompleted(false); 
                setShowStudyModal(false);
              }}>Return to Box View</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Info modal */}
      {showInfoModal && isValidCard && currentCard && ReactDOM.createPortal(
        <div className="info-modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <h3>Additional Information</h3>
              <button className="close-modal-btn" onClick={() => setShowInfoModal(false)}>✕</button>
            </div>
            <div className="info-modal-content">
              <div dangerouslySetInnerHTML={{ __html: currentCard.additionalInfo || currentCard.detailedAnswer || "No additional information available." }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SpacedRepetition;
