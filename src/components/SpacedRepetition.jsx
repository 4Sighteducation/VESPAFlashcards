import React, { useState, useEffect, useCallback } from "react";
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
      cardsToStudy = Object.values(grouped)
        .map(topicMap => Object.values(topicMap).flat())
        .flat();
    }

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0); // Start of current day in UTC

    const filteredReviewableCards = cardsToStudy.filter(card => {
      return !card.nextReviewDate || new Date(card.nextReviewDate) <= todayUTC;
    });
    
    setCurrentCards(filteredReviewableCards);
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
          const hasReviewableCards = cardsInTopic.some(card => 
            !card.nextReviewDate || new Date(card.nextReviewDate) <= todayUTC // Compare with todayUTC
          );
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
    if (!showStudyModal) {
      // If modal is closed, reset study-specific states
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowFlipResponse(false);
      setShowFlipResponseOverlay(false);
      setStudyCompleted(false);
      return;
    }

    // If modal is open and currentCards is populated:
    if (currentCards.length > 0) {
      // If currentIndex is out of bounds (e.g., after a card was removed), adjust it.
      // Or, if it's simply the start of a new set of cards, ensure it's 0.
      if (currentIndex >= currentCards.length || currentIndex < 0) {
        setCurrentIndex(0);
      }
      setStudyCompleted(false); // Not completed if there are cards
    } else {
      // If currentCards is empty (and modal is open), the study session for this selection is complete.
      setStudyCompleted(true);
    }
    
    // Always reset flip state for the new/current card.
    setIsFlipped(false);
    setShowFlipResponse(false);
    setShowFlipResponseOverlay(false);

  }, [currentCards, showStudyModal, currentIndex]); // Added currentIndex to re-evaluate if it goes out of bounds.

  
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
    setSelectedSubject(subject);
    setSelectedTopic(null);
    
    // updateCurrentCardsInternal will be called by the main useEffect due to state change.
    // Then the new useEffect (watching currentCards) will set currentIndex etc.

    // Check if there are actually reviewable cards before opening the modal
    const subjectCards = Object.values(groupedBoxCards[subject] || {}).flat();
    const todayUTC = new Date(); // Use UTC for check
    todayUTC.setUTCHours(0,0,0,0);
    const hasAnyReviewable = subjectCards.some(card => 
      !card.nextReviewDate || new Date(card.nextReviewDate) <= todayUTC // Compare with todayUTC
    );

    if (hasAnyReviewable) {
      setShowStudyModal(true);
    } else {
      alert(`No cards in "${subject}" are ready for review today. Check back tomorrow!`);
    }
  };
  
  // Select cards in a specific topic for review
  const reviewTopic = (subject, topic) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic);
    // updateCurrentCardsInternal will be called by the main useEffect.
    // Then the new useEffect (watching currentCards) will set currentIndex etc.
    
    const topicCards = groupedBoxCards[subject]?.[topic] || [];
    const todayUTC = new Date(); // Use UTC for check
    todayUTC.setUTCHours(0,0,0,0);
    const hasAnyReviewable = topicCards.some(card => 
      !card.nextReviewDate || new Date(card.nextReviewDate) <= todayUTC // Compare with todayUTC
    );

    if (hasAnyReviewable) {
      setShowStudyModal(true);
    } else {
      alert(`No cards in "${topic}" are ready for review today. Check back tomorrow!`);
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

    setTimeout(() => {
      if (isCorrect) {
        handleCorrectAnswer();
      } else {
        handleIncorrectAnswer();
      }
      // No need to setShowFlipResponse(true) for MCQs here, as box movement is immediate.
      // FlippableCard handles its own internal feedback display (correct/incorrect option styling).
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
  const nextCard = () => {
    if (currentIndex < currentCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Flip state reset will be handled by the new useEffect watching currentCards & currentIndex
    } else {
      setStudyCompleted(true); // All cards in the current session are done
    }
  };
  
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

      onMoveCard(cardToMoveId, nextBoxNumber); // This prop change will trigger useEffects
      
      setFeedbackMessage(`Card moved to Box ${nextBoxNumber}.`);
      setShowReviewDateMessage(true); // Show feedback popup

      // Delay hiding feedback and then let useEffect handle card advancement/completion
      setTimeout(() => {
        setShowReviewDateMessage(false);
        setFeedbackMessage("");
        // The main useEffect reacting to currentCards change will now advance or complete.
      }, 1500);
    } catch (error) {
      console.error("Error handling correct answer:", error);
      setFeedbackMessage("Error moving card. Please try again.");
      setShowReviewDateMessage(true);
      setTimeout(() => {
          setShowReviewDateMessage(false);
          setFeedbackMessage("");
          // Let useEffect handle advancement/completion
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

      onMoveCard(cardToMoveId, targetBoxNumber);
      
      setFeedbackMessage(`Card moved to Box ${targetBoxNumber}.`);
      setShowReviewDateMessage(true);

      setTimeout(() => {
        setShowReviewDateMessage(false);
        setFeedbackMessage("");
        // Let useEffect handle advancement/completion
      }, 1500);
    } catch (error) {
      console.error("Error handling incorrect answer:", error);
      setFeedbackMessage("Error moving card. Please try again.");
      setShowReviewDateMessage(true);
      setTimeout(() => {
          setShowReviewDateMessage(false);
          setFeedbackMessage("");
          // Let useEffect handle advancement/completion
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
          // Get subject color for styling
          const subjectCards = Object.values(groupedBoxCards[subject] || {} ).flat();
          const subjectColor = subjectCards[0]?.baseColor || subjectCards[0]?.cardColor || '#e0e0e0';
          const textColor = getContrastColor(subjectColor);
          const isReviewable = reviewableCards.subjects[subject];
          
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
                      {isReviewable && <span className="reviewable-badge">Ready for Review</span>}
                    </div>
                  </div>
                  <span className="card-count">
                    ({Object.values(groupedBoxCards[subject] || {} ).flat().length} cards)
                  </span>
                </div>
                <button 
                  className="review-btn" 
                  onClick={() => reviewSubject(subject)}
                  style={{ color: textColor }}
                  disabled={!isReviewable} // Disable if no reviewable cards in subject
                  title={isReviewable ? "Review this subject" : "No cards ready for review in this subject"}
                >
                  <span className="review-icon">👁️</span>
                </button>
              </div>

              {expandedSubjects[subject] && Object.keys(groupedBoxCards[subject] || {} ).map((topic) => {
                // Get the first card's color for the topic
                const topicColor = groupedBoxCards[subject][topic]?.[0]?.cardColor || '#e0e0e0';
                const textColorTopic = getContrastColor(topicColor); // Renamed to avoid conflict
                const topicKey = `${subject}-${topic}`;
                const isTopicReviewable = reviewableCards.topics[topicKey];
                
                return (
                  <div key={topicKey} className="topic-group">
                    <div 
                      className="topic-header"
                      style={{ 
                        backgroundColor: topicColor,
                        color: textColorTopic // Use renamed variable
                      }}
                    >
                      <div className="topic-content" onClick={() => toggleExpandTopic(topicKey)}>
                        <div className="topic-info">
                          <h3>{topic}</h3>
                        </div>
                        <div className="topic-meta">
                          <span className="card-count">
                            ({(groupedBoxCards[subject][topic] || []).length} cards)
                          </span>
                          {isTopicReviewable && <span className="topic-reviewable-badge">Ready</span>}
                        </div>
                      </div>
                      <button 
                        className="review-btn small" 
                        onClick={() => reviewTopic(subject, topic)}
                        style={{ color: textColorTopic }} // Use renamed variable
                        disabled={!isTopicReviewable} // Disable if no reviewable cards in topic
                        title={isTopicReviewable ? "Review this topic" : "No cards ready for review in this topic"}
                      >
                        <span className="review-icon">👁️</span>
                      </button>
                    </div>

                    {expandedTopics[topicKey] && (
                      <div className="topic-cards expanded-topic">
                        {(groupedBoxCards[subject][topic] || []).map((card) => {
                           const todayUTC = new Date(); // Use UTC for check
                           todayUTC.setUTCHours(0,0,0,0);
                           const cardIsCurrentlyReviewable = !card.nextReviewDate || new Date(card.nextReviewDate) <= todayUTC;
                          return (
                            <div 
                              key={card.id} 
                              className="card-preview"
                              style={{
                                backgroundColor: card.cardColor,
                                color: getContrastColor(card.cardColor)
                              }}
                            >
                              <div className="card-preview-header">
                                <span className="card-type">{card.questionType}</span>
                                <div className="card-review-status">
                                  {cardIsCurrentlyReviewable ? (
                                    <span className="review-ready">Ready for Review</span>
                                  ) : (
                                    <span className="review-waiting">
                                      Next: {new Date(card.nextReviewDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="card-preview-content">
                                <div dangerouslySetInnerHTML={{ __html: card.front || card.question }} />
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
        })}
      </div>
    );
  };

  // Render the flashcard review interface when a subject/topic is selected
  const renderCardReview = () => {
    // If we have completed studying all available cards
    if (studyCompleted) {
      return (
        <div className="completion-message">
          <h3>Session Complete!</h3>
          <p>
            You've completed reviewing all cards in this session.
          </p>
          <button 
            className="return-button" 
            onClick={() => {
              setSelectedSubject(null);
              setSelectedTopic(null);
              setStudyCompleted(false);
              setShowStudyModal(false); // Close the modal
            }}
          >
            Return to Box View
          </button>
        </div>
      );
    }

    if (!currentCards || currentCards.length === 0) {
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
              setShowStudyModal(false); // Close the modal
            }}
          >
            Return to Box View
          </button>
        </div>
      );
    }

    if (currentIndex < 0 || currentIndex >= currentCards.length || !currentCards[currentIndex]) {
      // This state should ideally be caught by the useEffect that manages currentIndex.
      // If it still happens, it means currentCards might have become empty unexpectedly.
      return (
        <div className="empty-box">
          <h3>All cards for this selection reviewed!</h3>
          <p>
            You've gone through all available cards for this specific filter.
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
    
    if (!currentCard || (!currentCard.front && !currentCard.question)) {
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
        
        {currentCard && (
          <FlippableCard
            card={currentCard}
            isFlipped={isFlipped}
            onFlip={handleCardFlip}
            onAnswer={currentCard.questionType === 'multiple_choice' ? handleMcqAnswer : undefined}
            isInModal={true}
          />
        )}

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
      <div className="box-info">
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
      
      {/* Review date message / Feedback Message */}
      {showReviewDateMessage && (
        <div className="review-date-message"> {/* Can rename class if styling differs */} 
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
          <div className="review-date-actions">
            <button onClick={() => { setShowReviewDateMessage(false); setFeedbackMessage(""); }}>Got it</button>
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