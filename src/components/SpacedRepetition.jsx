import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import "./SpacedRepetition.css";

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
  const [selectedOption, setSelectedOption] = useState(null);
  const [showReviewDateMessage, setShowReviewDateMessage] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // New state for grouped cards by subject and topic
  const [groupedBoxCards, setGroupedBoxCards] = useState({});
  const [boxSubjects, setBoxSubjects] = useState([]);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [reviewableCards, setReviewableCards] = useState({ subjects: {}, topics: {} });
  
  // State for study modal
  const [showStudyModal, setShowStudyModal] = useState(false);

  // Add these new state variables
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [hasSelectedOnce, setHasSelectedOnce] = useState(false);
  
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
  
  // Update current study cards based on filtering
  const updateCurrentCards = useCallback((grouped) => {
    let cardsToStudy = [];
    
    if (selectedSubject && selectedTopic) {
      // Filter by both subject and topic
      cardsToStudy = grouped[selectedSubject]?.[selectedTopic] || [];
    } else if (selectedSubject) {
      // Filter by subject only
      const topicsForSubject = grouped[selectedSubject] || {};
      cardsToStudy = Object.values(topicsForSubject).flat();
    } else {
      // No filters, include all cards for current box
      cardsToStudy = Object.values(grouped)
        .map(topicMap => Object.values(topicMap).flat())
        .flat();
    }

    // Filter out cards that have been reviewed and should no longer be in this box
    const today = new Date();
    const reviewableCards = cardsToStudy.filter(card => {
      // If card has no next review date or is due for review
      return !card.nextReviewDate || new Date(card.nextReviewDate) <= today;
    });
    
    // If we have no reviewable cards but the study modal is open, we should close it
    if (reviewableCards.length === 0 && showStudyModal) {
      setShowStudyModal(false);
      // Show a message to the user
      alert("No cards available for review at this time. Please check back later.");
      // Reset selection
      setSelectedSubject(null);
      setSelectedTopic(null);
    }
    
    setCurrentCards(reviewableCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowFlipResponse(false);
    setShowFlipResponseOverlay(false);
    setStudyCompleted(false);
  }, [selectedSubject, selectedTopic, showStudyModal]);
  
  // Group cards by subject and topic and filter for review availability
  useEffect(() => {
    if (cards && cards.length > 0) {
      // Group cards by subject and topic
      const grouped = cards.reduce((acc, card) => {
        const subject = card.subject || "General";
        const topic = card.topic || "General";
        
        if (!acc[subject]) {
          acc[subject] = {};
        }
        
        if (!acc[subject][topic]) {
          acc[subject][topic] = [];
        }
        
        acc[subject][topic].push(card);
        return acc;
      }, {});
      
      setGroupedBoxCards(grouped);
      setBoxSubjects(Object.keys(grouped).sort());
      
      // Mark reviewable subjects and topics
      const reviewable = {
        subjects: {},
        topics: {}
      };
      
      Object.keys(grouped).forEach(subject => {
        reviewable.subjects[subject] = false;
        
        Object.keys(grouped[subject]).forEach(topic => {
          const topicKey = `${subject}-${topic}`;
          const cardsInTopic = grouped[subject][topic];
          
          // Check if any cards in this topic are reviewable
          const hasReviewableCards = cardsInTopic.some(card => {
            if (!card.nextReviewDate) return true;
            const reviewDate = new Date(card.nextReviewDate);
            return reviewDate <= new Date();
          });
          
          reviewable.topics[topicKey] = hasReviewableCards;
          
          // If any topic has reviewable cards, mark the subject as reviewable
          if (hasReviewableCards) {
            reviewable.subjects[subject] = true;
          }
        });
      });
      
      setReviewableCards(reviewable);
      
      // Initialize currently selected cards based on filtering
      updateCurrentCards(grouped);
    } else {
      // If no cards in this box, clear the grouped data
      setGroupedBoxCards({});
      setBoxSubjects([]);
      setReviewableCards({ subjects: {}, topics: {} });
      setCurrentCards([]);
    }
  }, [cards, currentBox, selectedSubject, selectedTopic, spacedRepetitionData, updateCurrentCards]);
  
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
    
    // Get all cards for this subject
    const subjectCards = Object.values(groupedBoxCards[subject] || {}).flat();
    
    // Check if there are any reviewable cards for this subject
    const today = new Date();
    const reviewableCards = subjectCards.filter(card => 
      !card.nextReviewDate || new Date(card.nextReviewDate) <= today
    );
    
    // Only open the modal if there are cards to review
    if (reviewableCards.length > 0) {
      updateCurrentCards(groupedBoxCards);
      setShowStudyModal(true); // Open the study modal
    } else {
      // Show a message that no cards are available for review yet
      alert(`No cards in "${subject}" are ready for review today. Check back tomorrow!`);
    }
  };
  
  // Select cards in a specific topic for review
  const reviewTopic = (subject, topic) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic);
    
    // Get all cards for this topic
    const topicCards = groupedBoxCards[subject]?.[topic] || [];
    
    // Check if there are any reviewable cards for this topic
    const today = new Date();
    const reviewableCards = topicCards.filter(card => 
      !card.nextReviewDate || new Date(card.nextReviewDate) <= today
    );
    
    // Only open the modal if there are cards to review
    if (reviewableCards.length > 0) {
      updateCurrentCards(groupedBoxCards);
      setShowStudyModal(true); // Open the study modal
    } else {
      // Show a message that no cards are available for review yet
      alert(`No cards in "${topic}" are ready for review today. Check back tomorrow!`);
    }
  };
  
  // Handle card flip action
  const handleCardFlip = () => {
    // If this is a multiple choice card and we have a selected option but haven't shown confirmation yet
    if (
      currentCards[currentIndex]?.questionType === 'multiple_choice' && 
      selectedOption && 
      !hasSelectedOnce && 
      !showConfirmationModal && 
      !isFlipped
    ) {
      // Show confirmation modal instead of flipping immediately
      setShowConfirmationModal(true);
      return;
    }
    
    // If we have already selected once or this isn't multiple choice, flip the card
    if (!isFlipped) {
      setIsFlipped(true);
    } else {
      // Only show flip response if it's not a multiple choice card
      // For multiple choice, we'll show it automatically based on their answer
      if (currentCards[currentIndex]?.questionType !== 'multiple_choice') {
        setShowFlipResponse(true);
        setShowFlipResponseOverlay(true);
      }
    }
  };

  // Handle multiple choice selection
  const handleOptionSelect = (option, e) => {
    e.stopPropagation();
    
    if (isFlipped) return; // Don't allow selecting after flip
    
    setSelectedOption(option);
    
    // If this is the first selection, show confirmation
    if (!hasSelectedOnce) {
      setShowConfirmationModal(true);
    } else {
      // If they've already selected once before, just flip the card
      setIsFlipped(true);
      
      
      setTimeout(() => {
        setShowFlipResponse(true);
        setShowFlipResponseOverlay(true);
      }, 500);
    }
  };
  
  // Handle confirmation response
  const handleConfirmationResponse = (confirmed) => {
    setShowConfirmationModal(false);
    
    if (confirmed) {
      // They confirmed, so flip the card
      setIsFlipped(true);
      
      
      setTimeout(() => {
        setShowFlipResponse(true);
        setShowFlipResponseOverlay(true);
      }, 500);
    } else {
      // They canceled, so allow them to select again
      setHasSelectedOnce(true);
      setSelectedOption(null);
    }
  };
  
  // Reset selection state when moving to a new card
  const resetSelectionState = () => {
    setSelectedOption(null);
    setHasSelectedOnce(false);
    setShowConfirmationModal(false);
    setIsFlipped(false);
    setShowFlipResponse(false);
    setShowFlipResponseOverlay(false);
  };
  
  // Update nextCard and prevCard to use resetSelectionState
  const nextCard = () => {
    if (currentIndex < currentCards.length - 1) {
      resetSelectionState();
      setCurrentIndex(currentIndex + 1);
    } else {
      setStudyCompleted(true);
    }
  };
  
  const prevCard = () => {
    if (currentIndex > 0) {
      resetSelectionState();
      setCurrentIndex(currentIndex - 1);
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

  // Add handler functions for correct/incorrect answers (these were missing)
  const handleCorrectAnswer = () => {
    // First check if we have a valid card
    if (!isValidCard || !currentCard) {
      console.error("Cannot move card: No valid card found at index", currentIndex);
      return;
    }

    try {
      // Hide response overlay
      setShowFlipResponse(false);
      setShowFlipResponseOverlay(false);
      
      // Move the card to the next box (up to box 5)
      const nextBox = Math.min(currentBox + 1, 5);
      const cardToMove = currentCard;
      
      // Calculate next review date based on the target box
      const now = new Date();
      let daysToAdd = 1; // Default for box 1
      
      if (nextBox === 2) daysToAdd = 2;
      else if (nextBox === 3) daysToAdd = 3;
      else if (nextBox === 4) daysToAdd = 7;
      else if (nextBox === 5) daysToAdd = 14;
      
      const nextReviewDate = new Date(now);
      nextReviewDate.setDate(now.getDate() + daysToAdd);
      
      
      // Update card in the deck
      onMoveCard(cardToMove.id, nextBox);
      
      // Update the current cards array to mark this card as reviewed
      setCurrentCards(prev => 
        prev.map(card => 
          card.id === cardToMove.id 
            ? { ...card, isReviewable: false, nextReviewDate: nextReviewDate.toISOString() } 
            : card
        )
      );
      
      // Show a confirmation message
      setShowReviewDateMessage(true);
      setNextReviewDate(nextReviewDate);
      
      // Move to the next card after a delay
      setTimeout(() => {
        setShowReviewDateMessage(false);
        nextCard();
      }, 1500);
    } catch (error) {
      console.error("Error handling correct answer:", error);
      // Still try to move to next card to recover
      setTimeout(nextCard, 1500);
    }
  };

  const handleIncorrectAnswer = () => {
    // First check if we have a valid card
    if (!isValidCard || !currentCard) {
      console.error("Cannot move card: No valid card found at index", currentIndex);
      return;
    }

    try {
      // Hide response overlay
      setShowFlipResponse(false);
      setShowFlipResponseOverlay(false);
      
      // Move the card back to box 1
      const cardToMove = currentCard;
      
      // Calculate next review date (same day for box 1)
      const now = new Date();
      const nextReviewDate = new Date(now);
      
      
      // Update card in the deck
      onMoveCard(cardToMove.id, 1);
      
      // Update the current cards array to mark this card as reviewed
      setCurrentCards(prev => 
        prev.map(card => 
          card.id === cardToMove.id 
            ? { ...card, isReviewable: false, nextReviewDate: nextReviewDate.toISOString() } 
            : card
        )
      );
      
      // Show a confirmation message
      setShowReviewDateMessage(true);
      setNextReviewDate(nextReviewDate);
      
      // Move to the next card after a delay
      setTimeout(() => {
        setShowReviewDateMessage(false);
        nextCard();
      }, 1500);
    } catch (error) {
      console.error("Error handling incorrect answer:", error);
      // Still try to move to next card to recover
      setTimeout(nextCard, 1500);
    }
  };

  // Add function to toggle the info modal
  const toggleInfoModal = (e) => {
    if (e) e.stopPropagation();
    setShowInfoModal(!showInfoModal);
  };

  // Improved multiple choice rendering to ensure questions display better on mobile
  const renderMultipleChoice = (card) => {
    // First validate the card and its options
    if (!card || !isValidCard) {
      console.warn("Cannot render multiple choice: Card is not valid");
      return (
        <div className="multiple-choice-options">
          <h4>Multiple choice unavailable</h4>
          <p className="error-message">The card data is not valid.</p>
        </div>
      );
    }
    
    // Add defensive checks
    if (!card.options || !Array.isArray(card.options) || card.options.length === 0) {
      console.warn("Cannot render multiple choice: Invalid card or missing options", card);
      return (
        <div className="multiple-choice-options">
          <h4>Multiple choice options unavailable</h4>
          <p className="error-message">This card appears to be missing its options.</p>
        </div>
      );
    }
    
    return (
      <div className="multiple-choice-options">
        <ul className="multiple-choice-list">
          {card.options.map((option, index) => (
            <li 
              key={index}
              className={`
                multiple-choice-option
                ${selectedOption === option ? 'selected-option' : ''}
                ${isFlipped && option === card.correctAnswer ? 'correct-option' : ''}
              `}
              onClick={(e) => {
                if (!isFlipped) handleOptionSelect(option, e);
              }}
            >
              <span className="option-letter">{String.fromCharCode(65 + index)}.</span> 
              <span className="option-text">{option}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Add a function to render the simplified back of multiple choice cards
  const renderMultipleChoiceBack = (card) => {
    if (!card || !card.correctAnswer) {
      console.warn("Cannot render multiple choice back: Missing correct answer", card);
      return (
        <div className="multiple-choice-answer error">
          <h3>Correct Answer:</h3>
          <div className="correct-answer-display error">
            <span className="answer-text">No answer available</span>
          </div>
        </div>
      );
    }
    
    try {
      // Find the index of the correct answer to get its letter
      const correctIndex = card.options ? card.options.findIndex(option => option === card.correctAnswer) : -1;
      const optionLetter = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : '';
      
      return (
        <div className="multiple-choice-answer">
          <h3>Correct Answer:</h3>
          <div className="correct-answer-display">
            {optionLetter && <span className="answer-letter">{optionLetter}.</span>}
            <span className="answer-text">{card.correctAnswer}</span>
          </div>
        </div>
      );
    } catch (error) {
      console.error("Error rendering multiple choice back:", error);
      return (
        <div className="multiple-choice-answer error">
          <h3>Correct Answer:</h3>
          <div className="correct-answer-display error">
            <span className="answer-text">{card.correctAnswer || "Error displaying answer"}</span>
          </div>
        </div>
      );
    }
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
          const subjectCards = Object.values(groupedBoxCards[subject]).flat();
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
                    ({Object.values(groupedBoxCards[subject]).flat().length} cards)
                  </span>
                </div>
                <button 
                  className="review-btn" 
                  onClick={() => reviewSubject(subject)}
                  style={{ color: textColor }}
                >
                  <span className="review-icon">👁️</span>
                </button>
              </div>

              {expandedSubjects[subject] && Object.keys(groupedBoxCards[subject]).map((topic) => {
                // Get the first card's color for the topic
                const topicColor = groupedBoxCards[subject][topic][0]?.cardColor || '#e0e0e0';
                const textColor = getContrastColor(topicColor);
                const topicKey = `${subject}-${topic}`;
                const isTopicReviewable = reviewableCards.topics[topicKey];
                
                return (
                  <div key={topicKey} className="topic-group">
                    <div 
                      className="topic-header"
                      style={{ 
                        backgroundColor: topicColor,
                        color: textColor 
                      }}
                    >
                      <div className="topic-content" onClick={() => toggleExpandTopic(topicKey)}>
                        <div className="topic-info">
                          <h3>{topic}</h3>
                        </div>
                        <div className="topic-meta">
                          <span className="card-count">
                            ({groupedBoxCards[subject][topic].length} cards)
                          </span>
                          {isTopicReviewable && <span className="topic-reviewable-badge">Ready</span>}
                        </div>
                      </div>
                      <button 
                        className="review-btn small" 
                        onClick={() => reviewTopic(subject, topic)}
                        style={{ color: textColor }}
                      >
                        <span className="review-icon">👁️</span>
                      </button>
                    </div>

                    {expandedTopics[topicKey] && (
                      <div className="topic-cards expanded-topic">
                        {groupedBoxCards[subject][topic].map((card) => (
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
                                {!card.nextReviewDate || new Date(card.nextReviewDate) <= new Date() ? (
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
                        ))}
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

    // Show humorous empty state message when there are no cards to review
    // This should trigger when either:
    // 1. No cards in currentCards array
    // 2. Cards exist but none are available for review (all reviewed already)
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

    // If we don't have a valid card, don't try to render it
    // This handles edge cases where currentIndex is invalid
    if (currentIndex < 0 || currentIndex >= currentCards.length || !currentCards[currentIndex]) {
      return (
        <div className="empty-box">
          <h3>Oops! Something went wrong</h3>
          <p>
            We couldn't load this card properly. Let's try another subject or box.
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

    // Additional safety check - if we have cards but the current card is invalid or missing properties
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
        
        <div
          className={`study-card ${isFlipped ? "flipped" : ""} ${
            !currentCard.isReviewable ? "not-reviewable" : ""
          }`}
          onClick={currentCard.questionType === 'multiple_choice' ? null : handleCardFlip}
          style={{
            '--card-color': currentCard.cardColor || '#ffffff'
          }}
        >
          <div className="card-inner">
            <div 
              className={`card-front ${currentCard.questionType === 'multiple_choice' ? 'has-multiple-choice' : ''}`}
              onClick={currentCard.questionType === 'multiple_choice' ? null : handleCardFlip}
            >
              <div className="card-subject-topic">
                <span className="card-subject">{currentCard.subject || "General"}</span>
                <span className="card-topic">{currentCard.topic || ""}</span>
              </div>
              {/* Check for either additionalInfo or detailedAnswer */}
              {((currentCard.additionalInfo || currentCard.detailedAnswer)) && (
                <button 
                  className="info-btn" 
                  onClick={toggleInfoModal}
                >
                  ℹ️
                </button>
              )}
              
              {/* Next review date display */}
              {currentCard.nextReviewDate && (
                <div className="review-date-indicator">
                  Next review: {new Date(currentCard.nextReviewDate).toLocaleDateString()}
                </div>
              )}
              
              {/* Enhanced question display for multiple choice */}
              {currentCard.questionType === 'multiple_choice' ? (
                <>
                  <div className="multiple-choice-header-container">
                    <h4 className="multiple-choice-header">Choose the correct answer:</h4>
                  </div>
                  
                  <div
                    className="card-content multiple-choice-question"
                    dangerouslySetInnerHTML={{
                      __html:
                        currentCard.front ||
                        currentCard.question ||
                        "No question"
                    }}
                  />
                  
                  {!isFlipped && renderMultipleChoice(currentCard)}
                </>
              ) : (
                <div
                  className="card-content"
                  dangerouslySetInnerHTML={{
                    __html:
                      currentCard.front ||
                      currentCard.question ||
                      "No question"
                  }}
                />
              )}
              
              {!currentCard.isReviewable && (
                <div className="review-date-overlay">
                  <p>This card has been reviewed already</p>
                  <p>The next review date is:</p>
                  <p className="next-review-date">{new Date(currentCard.nextReviewDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
            <div className="card-back">
              <div className="card-subject-topic">
                <span className="card-subject">{currentCard.subject || "General"}</span>
                <span className="card-topic">{currentCard.topic || ""}</span>
              </div>
              {/* Check for either additionalInfo or detailedAnswer */}
              {((currentCard.additionalInfo || currentCard.detailedAnswer)) && (
                <button 
                  className="info-btn" 
                  onClick={toggleInfoModal}
                >
                  ℹ️
                </button>
              )}
              
              {/* For multiple choice, show simplified back */}
              {currentCard.questionType === 'multiple_choice' ? (
                renderMultipleChoiceBack(currentCard)
              ) : (
                <div
                  className="card-content"
                  dangerouslySetInnerHTML={{
                    __html:
                      currentCard.back ||
                      (currentCard.detailedAnswer && !currentCard.additionalInfo ? 
                        currentCard.detailedAnswer : 
                        currentCard.correctAnswer || 
                        "No answer")
                  }}
                />
              )}
            </div>
          </div>
        </div>

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
        
        {showFlipResponse && isValidCard && (
          <>
            <div className={`flip-response-overlay ${showFlipResponseOverlay ? 'active' : ''}`}></div>
            <div className="flip-response">
              {currentCard.questionType === 'multiple_choice' ? (
                // For multiple choice questions, check if they got it right automatically
                <div>
                  <p>
                    {selectedOption === currentCard.correctAnswer 
                      ? "You selected the correct answer!" 
                      : "Your answer was incorrect."}
                  </p>
                  <div className="response-buttons">
                    {selectedOption === currentCard.correctAnswer ? (
                      <button className="correct-button" onClick={handleCorrectAnswer}>
                        Move to Box {Math.min(currentBox + 1, 5)}
                      </button>
                    ) : (
                      <button className="incorrect-button" onClick={handleIncorrectAnswer}>
                        Move to Box 1
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // For regular cards, let them self-assess
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
              )}
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
      
      {/* Review date message */}
      {showReviewDateMessage && (
        <div className="review-date-message">
          <h3>Card Locked Until Next Review Date</h3>
          <p>
            This card has already been reviewed and is currently locked. It will be available for review on{" "}
            <strong>{nextReviewDate ? nextReviewDate.toLocaleDateString() : "a future date"}</strong>.
          </p>
          <p>
            This spacing helps reinforce your memory according to proven spaced repetition techniques.
          </p>
          <div className="review-date-actions">
            <button onClick={() => setShowReviewDateMessage(false)}>Got it</button>
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

      {/* Confirmation modal */}
      {showConfirmationModal && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Confirm Your Answer</h3>
            <p>Are you sure about your answer? This is your last chance to change your mind!</p>
            <div className="confirmation-buttons">
              <button className="confirm-no" onClick={() => handleConfirmationResponse(false)}>
                No, let me select again
              </button>
              <button className="confirm-yes" onClick={() => handleConfirmationResponse(true)}>
                Yes, I'm sure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpacedRepetition;