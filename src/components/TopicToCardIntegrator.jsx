import React, { useState, useEffect } from 'react';
import AICardGenerator from './AICardGenerator';
import { generateCardsFromTopic } from './AICardGeneratorTopicSync';

/**
 * TopicToCardIntegrator - Handles the integration between topic selection and card generation
 * 
 * This component serves as a bridge between the TopicButtonsModal and AICardGenerator,
 * allowing users to generate cards directly from selected topics.
 */
const TopicToCardIntegrator = ({
  isOpen,
  onClose,
  selectedTopic = null,
  auth,
  userId,
  onCardsGenerated,
  onError
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  
  // When a topic is selected, show the AI Generator with prefilled fields
  useEffect(() => {
    if (selectedTopic && isOpen) {
      setShowAIGenerator(true);
      setError(null);
    } else {
      setShowAIGenerator(false);
    }
  }, [selectedTopic, isOpen]);

  // Function to handle direct card generation from topic
  const handleDirectCardGeneration = async (generatedCards) => {
    if (!selectedTopic || !auth || !userId) {
      setError("Missing required information to generate cards");
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // Format the topic object for the sync service
      const topicObj = {
        name: selectedTopic.name || selectedTopic.topic || selectedTopic.parsedName,
        subject: selectedTopic.subject,
        examBoard: selectedTopic.examBoard,
        examType: selectedTopic.examType,
        id: selectedTopic.id
      };
      
      console.log("Generating cards for topic:", topicObj);
      
      // Use the sync service to generate and append cards
      const result = await generateCardsFromTopic(topicObj, generatedCards, userId, auth);
      
      if (result.success) {
        console.log(`Successfully generated ${result.newCardCount} cards for topic ${topicObj.name}`);
        
        // Call the callback with success info
        if (typeof onCardsGenerated === 'function') {
          onCardsGenerated({
            topic: topicObj,
            newCardCount: result.newCardCount,
            existingCardCount: result.existingCardCount,
            success: true
          });
        }
        
        // Close the generator after successful generation
        onClose();
      } else {
        setError(`Failed to generate cards: ${result.error || 'Unknown error'}`);
        
        // Call the error callback
        if (typeof onError === 'function') {
          onError(result.error || 'Failed to generate cards');
        }
      }
    } catch (error) {
      console.error("Error in handleDirectCardGeneration:", error);
      setError(`Error generating cards: ${error.message}`);
      
      // Call the error callback
      if (typeof onError === 'function') {
        onError(error.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  // If not open, don't render anything
  if (!isOpen) return null;
  
  // If there's an error, render error message
  if (error) {
    return (
      <div className="topic-card-integrator-error">
        <div className="error-message">
          <h3>Error Generating Cards</h3>
          <p>{error}</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }
  
  // Render the AICardGenerator with prefilled fields
  return (
    <div className="topic-card-integrator">
      {showAIGenerator && selectedTopic && (
        <AICardGenerator
          onClose={onClose}
          onAddCard={(card) => console.log("Card added:", card)}
          auth={auth}
          userId={userId}
          initialSubject={selectedTopic.subject}
          initialTopic={selectedTopic.name || selectedTopic.topic || selectedTopic.parsedName}
          examBoard={selectedTopic.examBoard}
          examType={selectedTopic.examType}
          // Pass a callback to handle direct card generation
          onCardsGenerated={handleDirectCardGeneration}
        />
      )}
      
      {isGenerating && (
        <div className="generating-overlay">
          <div className="generating-spinner"></div>
          <p>Generating cards for {selectedTopic?.name || selectedTopic?.topic || 'selected topic'}...</p>
        </div>
      )}
    </div>
  );
};

export default TopicToCardIntegrator;
