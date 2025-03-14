import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "./SpacedRepetition.css";
import Flashcard from "./Flashcard";

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
  const [filteredCards, setFilteredCards] = useState([]);
  
  // State for card review
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [showReviewDateMessage, setShowReviewDateMessage] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // New state for grouped cards by subject and topic
  const [groupedBoxCards, setGroupedBoxCards] = useState({});
  const [boxSubjects, setBoxSubjects] = useState([]);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});
  const [reviewableCards, setReviewableCards] = useState({
    subjects: {},
    topics: {}
  });
  
  // State for study modal
  const [showStudyModal, setShowStudyModal] = useState(false);

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
      setBoxSubjects(Object.keys(grouped));
      
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
  }, [cards, currentBox, selectedSubject, selectedTopic]);
  
  // Update current study cards based on filtering
  const updateCurrentCards = (grouped) => {
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
    
    setCurrentCards(cardsToStudy);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowFlipResponse(false);
    setStudyCompleted(false);
  };

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
    updateCurrentCards(groupedBoxCards);
    setShowStudyModal(true); // Open the study modal
  };
  
  // Select cards in a specific topic for review
  const reviewTopic = (subject, topic) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic);
    updateCurrentCards(groupedBoxCards);
    setShowStudyModal(true); // Open the study modal
  };
  
  // Handle card flip action
  const handleCardFlip = () => {
    // Only allow flipping if card is reviewable
    if (currentCards[currentIndex]?.isReviewable === false) {
      // Show message about review date
      if (currentCards[currentIndex]?.nextReviewDate) {
        setNextReviewDate(new Date(currentCards[currentIndex].nextReviewDate));
        setShowReviewDateMessage(true);
      }
      return;
    }
    
    // For multiple choice questions, only flip if an option is selected
    if (currentCards[currentIndex]?.questionType === 'multiple_choice' && !isFlipped && !selectedOption) {
      return;
    }
    
    setIsFlipped(!isFlipped);
    
    // Show response buttons a short time after flipping to back
    if (!isFlipped) {
      setShowFlipResponse(false);
      
      // If multiple choice and answer selected, show feedback instead of flip response
      if (currentCards[currentIndex]?.questionType === 'multiple_choice' && selectedOption) {
        // Check if answer is correct
        const correctAnswer = currentCards[currentIndex].correctAnswer;
        const isCorrect = selectedOption === correctAnswer;
        setIsCorrectAnswer(isCorrect);
        setTimeout(() => {
          setShowAnswerFeedback(true);
        }, 500);
        
        return;
      }
      
      setTimeout(() => {
        setShowFlipResponse(true);
      }, 300);
    } else {
      setShowFlipResponse(false);
    }
  };

  // Handle next card
  const nextCard = () => {
    if (currentIndex < currentCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetCardState();
    } else {
      setStudyCompleted(true);
    }
  };
  
  // Handle previous card
  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetCardState();
    }
  };
  
  // Reset card state when navigating
  const resetCardState = () => {
    setIsFlipped(false);
    setShowFlipResponse(false);
    setSelectedOption(null);
    setShowAnswerFeedback(false);
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
    // Move the card to the next box (up to box 5)
    const nextBox = Math.min(currentBox + 1, 5);
    const cardToMove = currentCards[currentIndex];
    
    // Calculate next review date based on the target box
    const now = new Date();
    let daysToAdd = 1; // Default for box 1
    
    if (nextBox === 2) daysToAdd = 2;
    else if (nextBox === 3) daysToAdd = 3;
    else if (nextBox === 4) daysToAdd = 7;
    else if (nextBox === 5) daysToAdd = 14;
    
    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(now.getDate() + daysToAdd);
    
    // Update card with next review date
    const updatedCard = {
      ...cardToMove,
      nextReviewDate: nextReviewDate.toISOString(),
    };
    
    // Call the parent component's function to move the card
    onMoveCard(updatedCard, currentBox, nextBox);
    
    // Move to the next card
    nextCard();
  };

  const handleIncorrectAnswer = () => {
    // Move the card back to box 1
    const cardToMove = currentCards[currentIndex];
    
    // Reset review date to tomorrow
    const now = new Date();
    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(now.getDate() + 1);
    
    // Update card with next review date
    const updatedCard = {
      ...cardToMove,
      nextReviewDate: nextReviewDate.toISOString(),
    };
    
    // Call the parent component's function to move the card
    onMoveCard(updatedCard, currentBox, 1);
    
    // Move to the next card
    nextCard();
  };

  // Add function to toggle the info modal
  const toggleInfoModal = (e) => {
    if (e) e.stopPropagation();
    setShowInfoModal(!showInfoModal);
  };

  // Add the renderMultipleChoice function
  const renderMultipleChoice = (card) => {
    if (!card.options || !Array.isArray(card.options)) return null;
    
    return (
      <div className="multiple-choice-options">
        <h4>Choose the correct answer:</h4>
        <ul>
          {card.options.map((option, index) => (
            <li 
              key={index}
              className={`
                ${selectedOption === option ? 'selected-option' : ''}
                ${isFlipped && option === card.correctAnswer ? 'correct-option' : ''}
              `}
              onClick={(e) => {
                e.stopPropagation();
                if (!isFlipped) setSelectedOption(option);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      </div>
    );
  };

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

    if (currentCards.length === 0) {
      return (
        <div className="empty-box">
          <h3>No cards to study</h3>
          <p>
            There are no cards in this box for the selected subject/topic.
            Please select a different box, subject, or topic, or add more cards to your collection.
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
            !currentCards[currentIndex].isReviewable ? "not-reviewable" : ""
          }`}
          onClick={handleCardFlip}
          style={{
            '--card-color': currentCards[currentIndex].cardColor || '#ffffff'
          }}
        >
          <div className="card-inner">
            <div className="card-front">
              <div className="card-subject-topic">
                <span className="card-subject">{currentCards[currentIndex].subject || "General"}</span>
                <span className="card-topic">{currentCards[currentIndex].topic || ""}</span>
              </div>
              {/* Check for either additionalInfo or detailedAnswer */}
              {(currentCards[currentIndex].additionalInfo || currentCards[currentIndex].detailedAnswer) && (
                <button 
                  className="info-btn" 
                  onClick={toggleInfoModal}
                >
                  ℹ️
                </button>
              )}
              
              {/* Next review date display */}
              {currentCards[currentIndex].nextReviewDate && (
                <div className="review-date-indicator">
                  Next review: {new Date(currentCards[currentIndex].nextReviewDate).toLocaleDateString()}
                </div>
              )}
              
              <div
                className="card-content"
                dangerouslySetInnerHTML={{
                  __html:
                    currentCards[currentIndex].front ||
                    currentCards[currentIndex].question ||
                    "No question"
                }}
              />
              {currentCards[currentIndex].questionType === 'multiple_choice' && !isFlipped && renderMultipleChoice(currentCards[currentIndex])}
              
              {!currentCards[currentIndex].isReviewable && (
                <div className="review-date-overlay">
                  <p>This card is locked until</p>
                  <p className="next-review-date">{new Date(currentCards[currentIndex].nextReviewDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
            <div className="card-back">
              <div className="card-subject-topic">
                <span className="card-subject">{currentCards[currentIndex].subject || "General"}</span>
                <span className="card-topic">{currentCards[currentIndex].topic || ""}</span>
              </div>
              {/* Check for either additionalInfo or detailedAnswer */}
              {(currentCards[currentIndex].additionalInfo || currentCards[currentIndex].detailedAnswer) && (
                <button 
                  className="info-btn" 
                  onClick={toggleInfoModal}
                >
                  ℹ️
                </button>
              )}
              <div
                className="card-content"
                dangerouslySetInnerHTML={{
                  __html:
                    currentCards[currentIndex].back ||
                    (currentCards[currentIndex].detailedAnswer && !currentCards[currentIndex].additionalInfo ? 
                      currentCards[currentIndex].detailedAnswer : 
                      currentCards[currentIndex].correctAnswer || 
                      "No answer")
                }}
              />
              {currentCards[currentIndex].questionType === 'multiple_choice' && isFlipped && renderMultipleChoice(currentCards[currentIndex])}
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
        
        {/* Modal and feedback components remain the same */}
        {showFlipResponse && !showAnswerFeedback && currentCards[currentIndex].questionType !== 'multiple_choice' && (
          <div className="flip-response">
            <p>Did you know the answer?</p>
            <div className="response-buttons">
              <button className="correct-button" onClick={handleCorrectAnswer}>
                Correct
              </button>
              <button
                className="incorrect-button"
                onClick={handleIncorrectAnswer}
              >
                Incorrect
              </button>
            </div>
          </div>
        )}
        
        {showAnswerFeedback && currentCards[currentIndex].questionType === 'multiple_choice' && (
          <div className={`answer-feedback ${isCorrectAnswer ? 'correct' : 'incorrect'}`}>
            <h3>{isCorrectAnswer ? 'Congratulations!' : 'Unlucky!'}</h3>
            <p>
              {isCorrectAnswer 
                ? `You got that right! Moving up to Box ${Math.min(currentBox + 1, 5)}.` 
                : `That's incorrect. The correct answer is: ${currentCards[currentIndex].correctAnswer}`}
            </p>
            <div className="feedback-buttons">
              <button 
                className={isCorrectAnswer ? "correct-button" : "incorrect-button"} 
                onClick={() => {
                  // Reset state and process card movement
                  if (isCorrectAnswer) {
                    handleCorrectAnswer();
                  } else {
                    handleIncorrectAnswer();
                  }
                  setSelectedOption(null);
                  setShowAnswerFeedback(false);
                }}
              >
                {isCorrectAnswer ? "Continue" : "Move to Box 1"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render the study interface
  return (
    <div className="spaced-repetition">
      <div className="box-info">
        <h2>Spaced Repetition</h2>
        <p>
          You are viewing cards in Box {currentBox}. {" "}
          {currentBox === 1 && "Review daily."}
          {currentBox === 2 && "Review every 2 days."}
          {currentBox === 3 && "Review every 3 days."}
          {currentBox === 4 && "Review every 7 days."}
          {currentBox === 5 && "These cards are mastered. Occasional review."}
        </p>
      </div>
      
      <div className="box-navigation">
        <div className="box-buttons">
          {[1, 2, 3, 4, 5].map((box) => (
            <button
              key={box}
              className={`box-button ${currentBox === box ? "active" : ""} ${
                (spacedRepetitionData[`box${box}`]?.some(card => 
                  !card.nextReviewDate || new Date(card.nextReviewDate) <= new Date()
                )) ? "has-reviewable" : ""
              }`}
              onClick={() => onSelectBox(box)}
            >
              Box {box}
              <span className="card-count">
                ({spacedRepetitionData[`box${box}`]?.length || 0})
              </span>
            </button>
          ))}
        </div>
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
      {showInfoModal && currentCards.length > 0 && ReactDOM.createPortal(
        <div className="info-modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <h3>Additional Information</h3>
              <button className="close-modal-btn" onClick={() => setShowInfoModal(false)}>✕</button>
            </div>
            <div className="info-modal-content">
              <div dangerouslySetInnerHTML={{ __html: currentCards[currentIndex].additionalInfo || currentCards[currentIndex].detailedAnswer || "No additional information available." }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SpacedRepetition;
