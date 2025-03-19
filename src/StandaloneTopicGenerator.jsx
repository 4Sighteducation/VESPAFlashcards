import React, { useState, useCallback } from 'react';
import TopicGenerationModal from './components/TopicGenerationModal';
import { generateTopicPrompt } from './prompts/topicListPrompt';

/**
 * StandaloneTopicGenerator - A self-contained component for topic generation
 * This component can be imported and used without modifying your existing App.js structure
 * 
 * Usage in App.js:
 * import StandaloneTopicGenerator from './StandaloneTopicGenerator';
 * 
 * Then add this to your return statement:
 * <StandaloneTopicGenerator 
 *   topicListExamBoard={topicListExamBoard}
 *   topicListExamType={topicListExamType}
 *   setUserTopics={setUserTopics}
 *   allCards={allCards}
 *   setAllCards={setAllCards}
 *   saveData={saveData}
 *   showStatus={showStatus}
 *   auth={auth}
 *   setAuth={setAuth}
 * />
 */
function StandaloneTopicGenerator({
  topicListExamBoard = "AQA", // Default value
  topicListExamType = "A-Level", // Default value
  setUserTopics,
  allCards,
  setAllCards,
  saveData,
  showStatus,
  auth,
  setAuth
}) {
  // Local state for the component
  const [topicGenerationModalOpen, setTopicGenerationModalOpen] = useState(false);
  const [subjectsToGenerateTopics, setSubjectsToGenerateTopics] = useState([]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [topicGenerationProgress, setTopicGenerationProgress] = useState({ current: 0, total: 0 });
  const [currentGeneratingSubject, setCurrentGeneratingSubject] = useState(null);
  const [topicReviewComplete, setTopicReviewComplete] = useState(false);

  // Handler for adding topics to a subject
  const handleAddTopicsToSubject = useCallback((subjectName, topics) => {
    console.log(`Adding ${topics.length} topics to subject ${subjectName}`);
    
    // Add the topics to userTopics
    setUserTopics(prevTopics => {
      // Create a key based on subject name and exam info
      const key = `${subjectName}-${topicListExamBoard}-${topicListExamType}`;
      
      // Format topics to include priority
      const formattedTopics = topics.map(topic => {
        // If topic is already an object, preserve its structure
        if (typeof topic === 'object' && topic !== null) {
          return {
            ...topic,
            priority: topic.priority !== undefined ? topic.priority : 1 // Default priority is 1
          };
        }
        // If topic is a string, convert to object with topic property
        return {
          topic: topic,
          priority: 1
        };
      });
      
      return {
        ...prevTopics,
        [key]: formattedTopics
      };
    });

    // Mark the subject card as having topics
    setAllCards(prevCards => {
      return prevCards.map(card => {
        if (card.subject === subjectName && card.template) {
          return {
            ...card,
            hasTopicList: true
          };
        }
        return card;
      });
    });
    
    // Save the updated topics to Knack
    setTimeout(() => {
      saveData();
    }, 100);
    
    // Show confirmation
    showStatus(`Topics added to ${subjectName}!`);
  }, [topicListExamBoard, topicListExamType, saveData, showStatus, setAllCards, setUserTopics]);

  // Handler for completing the topic review process
  const handleTopicReviewComplete = useCallback((finalSubjectsWithTopics) => {
    console.log("Topic review complete:", finalSubjectsWithTopics);
    setTopicReviewComplete(true);
    
    // Update existing topic lists in auth data
    let allTopicLists = [];
    
    try {
      if (auth && auth.field_3011) {
        const existingLists = typeof auth.field_3011 === 'string'
          ? JSON.parse(auth.field_3011)
          : auth.field_3011;
          
        if (Array.isArray(existingLists)) {
          allTopicLists = [...existingLists];
        }
      }
      
      // Update or add topic lists for each subject
      finalSubjectsWithTopics.forEach(subject => {
        const { name, examBoard, examType, topics } = subject;
        
        // Format topics to ensure consistent structure
        const formattedTopics = topics.map(topic => {
          if (typeof topic === 'object' && topic !== null) {
            return {
              ...topic,
              topic: topic.topic || topic.name || String(topic),
              priority: topic.priority !== undefined ? topic.priority : 1
            };
          }
          return { 
            topic: String(topic),
            priority: 1
          };
        });
        
        // Find existing topic list for this subject
        const existingIndex = allTopicLists.findIndex(
          list => list.subject === name && list.examBoard === examBoard && list.examType === examType
        );
        
        if (existingIndex >= 0) {
          // Update existing entry
          allTopicLists[existingIndex] = {
            ...allTopicLists[existingIndex],
            topics: formattedTopics,
            updated: new Date().toISOString()
          };
        } else {
          // Add new entry
          allTopicLists.push({
            id: `topiclist_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            subject: name,
            name: name.toLowerCase(),
            examBoard: examBoard,
            examType: examType,
            topics: formattedTopics,
            created: new Date().toISOString(),
            userId: auth?.id || ""
          });
        }
        
        // Also update userTopics state for this subject
        const topicKey = `${name}-${examBoard}-${examType}`;
        setUserTopics(prevTopics => ({
          ...prevTopics,
          [topicKey]: formattedTopics
        }));
        
        // Update subject card to show it has a topic list
        setAllCards(prevCards => 
          prevCards.map(card => {
            if (card.subject === name && card.template) {
              return {
                ...card,
                hasTopicList: true
              };
            }
            return card;
          })
        );
      });
      
      // Update auth with new topic lists
      if (auth) {
        setAuth(prevAuth => ({
          ...prevAuth,
          field_3011: JSON.stringify(allTopicLists)
        }));
      }
      
      // Save everything to Knack
      saveData();
      
      // Show success message
      showStatus("All topics saved successfully!");
    } catch (error) {
      console.error("Error in handleTopicReviewComplete:", error);
      showStatus("Error saving topics", 3000, "error");
    }
    
    // Close the topic generation modal
    setTopicGenerationModalOpen(false);
  }, [auth, saveData, showStatus, setAllCards, setAuth, setUserTopics]);

  // Handler for generating topic lists
  const handleGenerateTopicLists = useCallback(async () => {
    if (!subjectsToGenerateTopics || subjectsToGenerateTopics.length === 0) {
      console.log("No subjects to generate topics for");
      return;
    }
    
    setGeneratingTopics(true);
    setTopicGenerationProgress({ current: 0, total: subjectsToGenerateTopics.length });
    
    // Generate topics for each subject one by one
    for (let i = 0; i < subjectsToGenerateTopics.length; i++) {
      const subject = subjectsToGenerateTopics[i];
      setCurrentGeneratingSubject(subject.name);
      
      try {
        // Generate the prompt for this subject
        const prompt = generateTopicPrompt({
          subject: subject.name,
          examBoard: subject.examBoard,
          examType: subject.examType,
          level: 'comprehensive'
        });
        
        // Get API response - this is a simplified simulation
        // In a real implementation, you'd make an API call here
        const generatedTopics = [
          `${subject.name} Topic 1`,
          `${subject.name} Topic 2`,
          `${subject.name} Topic 3`,
          `${subject.name} Core Concepts`,
          `${subject.name} Advanced Applications`
        ];
        
        // Update the subject with the generated topics
        setSubjectsToGenerateTopics(prevSubjects => {
          return prevSubjects.map(s => {
            if (s.name === subject.name) {
              return {
                ...s,
                topics: generatedTopics
              };
            }
            return s;
          });
        });
        
        // Update progress
        setTopicGenerationProgress(prev => ({ 
          ...prev, 
          current: i + 1 
        }));
        
        // Short delay to avoid UI freezes
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error generating topics for ${subject.name}:`, error);
      }
    }
    
    setGeneratingTopics(false);
  }, [subjectsToGenerateTopics]);

  // Public method that can be called from parent component
  const openTopicGenerator = (subjects) => {
    setSubjectsToGenerateTopics(subjects);
    setTopicGenerationModalOpen(true);
  };

  return (
    <>
      {/* Expose a button to open the generator */}
      <button 
        className="generate-topics-button" 
        onClick={() => {
          const defaultSubjects = [
            { name: "Mathematics", examBoard: topicListExamBoard, examType: topicListExamType },
            { name: "Physics", examBoard: topicListExamBoard, examType: topicListExamType }
          ];
          openTopicGenerator(defaultSubjects);
        }}
      >
        Generate Topics
      </button>

      {/* Topic Generation Modal */}
      <TopicGenerationModal 
        open={topicGenerationModalOpen}
        subjects={subjectsToGenerateTopics}
        onClose={() => setTopicGenerationModalOpen(false)}
        onGenerate={handleGenerateTopicLists}
        isGenerating={generatingTopics}
        progress={topicGenerationProgress}
        currentSubject={currentGeneratingSubject}
        onAddTopicsToSubject={handleAddTopicsToSubject}
        onReviewComplete={handleTopicReviewComplete}
      />
    </>
  );
}

// Add a reference to the openTopicGenerator method
StandaloneTopicGenerator.openTopicGenerator = (instance, subjects) => {
  if (instance && typeof instance.openTopicGenerator === 'function') {
    instance.openTopicGenerator(subjects);
  }
};

export default StandaloneTopicGenerator;
