import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaCheck } from 'react-icons/fa';
import './styles.css';
import TopicGenerationStep from './TopicGenerationStep';
import TopicReviewStep from './TopicReviewStep';
import TopicSaveStep from './TopicSaveStep';

/**
 * NewTopicModal - A completely redesigned modal with a step-by-step flow
 * for topic generation, review, and saving.
 */
const NewTopicModal = ({
  isOpen,
  subject,
  examBoard,
  examType,
  onClose,
  onGenerateCards,
  onSaveTopics,
  initialTopics = []
}) => {
  // Modal step state
  const [currentStep, setCurrentStep] = useState(1);
  const [steps] = useState([
    { id: 1, name: 'Generate' },
    { id: 2, name: 'Review' },
    { id: 3, name: 'Save' }
  ]);

  // Topic data state
  const [topics, setTopics] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Initialize with any provided topics
  useEffect(() => {
    if (initialTopics && initialTopics.length > 0) {
      setTopics(initialTopics);
    }
  }, [initialTopics]);

  // Reset the modal state when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setError(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Topic generation handler
  const handleGenerateTopics = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // In a real implementation, this would call your OpenAI generation function
      // For now, we'll simulate it
      const mockTopics = [
        { id: 'topic_1', name: 'Solo Performance' },
        { id: 'topic_2', name: 'Performance in a Quartet' },
        { id: 'topic_3', name: 'Group Choreography' },
        { id: 'topic_4', name: 'Knowledge, understanding and critical appreciation of performance' },
        { id: 'topic_5', name: 'Critical analysis of professional dance works' }
      ];
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setTopics(mockTopics);
      
      // Automatically move to review step
      goToNextStep();
    } catch (err) {
      console.error('Error generating topics:', err);
      setError('Failed to generate topics: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Topic saving handler
  const handleSaveTopics = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Call the provided save function
      if (onSaveTopics) {
        await onSaveTopics(topics);
      }
      
      // Simulate network delay for demonstration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSaveSuccess(true);
    } catch (err) {
      console.error('Error saving topics:', err);
      setError('Failed to save topics: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Topic manipulation handlers
  const handleAddTopic = (newTopic) => {
    if (typeof newTopic === 'string') {
      // Create a new topic object
      const topicObj = {
        id: `topic_${Date.now()}`,
        name: newTopic.trim()
      };
      setTopics([...topics, topicObj]);
    } else if (typeof newTopic === 'object' && newTopic !== null) {
      // Add the provided topic object
      setTopics([...topics, newTopic]);
    }
  };

  const handleDeleteTopic = (topicId) => {
    setTopics(topics.filter(topic => topic.id !== topicId));
  };

  const handleEditTopic = (topicId, newName) => {
    setTopics(topics.map(topic => 
      topic.id === topicId ? { ...topic, name: newName } : topic
    ));
  };

  // Determine if we can proceed to the next step
  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      // Can only proceed from Step 1 if we have generated topics or have existing topics
      return topics.length > 0 || !isGenerating;
    } else if (currentStep === 2) {
      // Can only proceed from Step 2 if we have at least one topic
      return topics.length > 0;
    }
    return true;
  };

  // Render the current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <TopicGenerationStep
            subject={subject}
            examBoard={examBoard}
            examType={examType}
            isGenerating={isGenerating}
            onGenerate={handleGenerateTopics}
            error={error}
          />
        );
      case 2:
        return (
          <TopicReviewStep
            topics={topics}
            onAddTopic={handleAddTopic}
            onDeleteTopic={handleDeleteTopic}
            onEditTopic={handleEditTopic}
            onGenerateCards={onGenerateCards}
            error={error}
          />
        );
      case 3:
        return (
          <TopicSaveStep
            topics={topics}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            onSave={handleSaveTopics}
            error={error}
          />
        );
      default:
        return null;
    }
  };

  // Don't render anything if the modal is closed
  if (!isOpen) return null;

  // Portal the modal to the body element
  return createPortal(
    <div className="new-topic-modal-root">
      <div className="new-topic-modal-overlay" onClick={onClose}>
        <div className="new-topic-modal" onClick={e => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="new-topic-modal-header">
            <h2>Topics for {subject} ({examBoard} {examType})</h2>
            <button className="close-modal-button" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="step-indicator">
            {steps.map(step => (
              <div 
                key={step.id} 
                className={`step-indicator-item ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
              >
                <div className="step-number">
                  {currentStep > step.id ? <FaCheck /> : step.id}
                </div>
                <span>{step.name}</span>
              </div>
            ))}
          </div>

          {/* Modal Content */}
          <div className="new-topic-modal-content">
            <div className="step-content">
              {renderStepContent()}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="new-topic-modal-footer">
            <button className="footer-button cancel-button" onClick={onClose}>
              Close
            </button>
            <div className="modal-footer-actions">
              {currentStep > 1 && (
                <button 
                  className="footer-button back-button"
                  onClick={goToPreviousStep}
                  disabled={isGenerating || isSaving}
                >
                  Back
                </button>
              )}
              {currentStep < steps.length && (
                <button 
                  className="footer-button next-button"
                  onClick={goToNextStep}
                  disabled={!canProceedToNextStep() || isGenerating || isSaving}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NewTopicModal;
