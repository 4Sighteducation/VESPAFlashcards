/**
 * MultiSubjectBridge.js
 * Service to handle multiple subject operations seamlessly,
 * fixing URI encoding issues with multiple subjects
 */

/**
 * Safely encodes topic lists for storage in Knack
 * Uses proper encoding to handle multi-subject data
 */
export const encodeTopicListsForKnack = (topicLists) => {
  try {
    if (!Array.isArray(topicLists) || topicLists.length === 0) {
      return '[]';
    }

    // Sanitize topic lists to prevent encoding issues
    const sanitizedLists = topicLists.map(list => {
      // Clone the list to avoid modifying the original
      const sanitizedList = {
        ...list,

        // Handle topics array specially - this is where most issues occur
        topics: list.topics?.map(topic => ({
          id: topic.id,
          name: topic.name,
          examBoard: topic.examBoard || '',
          examType: topic.examType || '',
          color: topic.color || '#cccccc',
          subjectColor: topic.subjectColor || '#3cb44b',
          // Minimize extra properties that might cause encoding issues
        })) || []
      };

      return sanitizedList;
    });

    // First do a standard JSON stringify
    const jsonString = JSON.stringify(sanitizedLists);

    // Encode special characters that can cause issues in Knack's storage
    // but DON'T do a full encodeURIComponent which causes decoding issues
    return jsonString
      .replace(/\+/g, '%2B') // Plus signs often cause issues
      .replace(/\//g, '%2F') // Forward slashes can be problematic
      .replace(/\\/g, '%5C') // Backslashes need escaping
      .replace(/"/g, '\\"')  // Double quotes need escaping for REST API
      .replace(/\n/g, '\\n') // Newlines need escaping
      .replace(/\r/g, '\\r') // Carriage returns need escaping
      .replace(/\t/g, '\\t'); // Tabs need escaping
  } catch (error) {
    console.error('Error encoding topic lists for Knack:', error);
    // Return empty array as fallback
    return '[]';
  }
};

/**
 * Safely encodes cards for storage in Knack
 * Uses proper encoding to handle multi-subject data
 */
export const encodeCardsForKnack = (cards) => {
  try {
    if (!Array.isArray(cards) || cards.length === 0) {
      return '[]';
    }

    // Sanitize cards to prevent encoding issues
    const sanitizedCards = cards.map(card => {
      // Skip null/undefined cards
      if (!card) return null;

      // Create a clean copy with only essential properties
      const sanitizedCard = {
        id: card.id,
        type: card.type || 'card',
        subject: card.subject || 'General',
        topic: card.topic || '',
        name: card.name || '',
        question: card.question || '',
        answer: card.answer || '',
        examBoard: card.examBoard || '',
        examType: card.examType || '',
        questionType: card.questionType || 'short_answer',
        boxNum: card.boxNum || 1,
        isShell: !!card.isShell,
        isEmpty: !!card.isEmpty,
        lastReviewed: card.lastReviewed || null,
        nextReviewDate: card.nextReviewDate || null,
        // Only include arrays if they exist
        ...(Array.isArray(card.keyPoints) ? { keyPoints: card.keyPoints } : {}),
        ...(Array.isArray(card.options) ? { options: card.options } : {}),
        ...(Array.isArray(card.savedOptions) ? { savedOptions: card.savedOptions } : {}),
        // Other properties
        cardColor: card.cardColor || card.color || '#cccccc',
        subjectColor: card.subjectColor || '',
        detailedAnswer: card.detailedAnswer || '',
        additionalInfo: card.additionalInfo || '',
        createdAt: card.createdAt || new Date().toISOString(),
        updatedAt: card.updatedAt || new Date().toISOString(),
      };

      return sanitizedCard;
    }).filter(Boolean); // Remove any null entries

    // First do a standard JSON stringify
    const jsonString = JSON.stringify(sanitizedCards);

    // Apply the same encoding to prevent issues
    return jsonString
      .replace(/\+/g, '%2B')
      .replace(/\//g, '%2F')
      .replace(/\\/g, '%5C')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  } catch (error) {
    console.error('Error encoding cards for Knack:', error);
    // Return empty array as fallback
    return '[]';
  }
};

/**
 * Prepare data for Knack storage with proper multi-subject handling
 */
export const prepareDataForKnack = (data) => {
  if (!data) return {};

  const preparedData = { ...data }; // Start with a clone

  // Handle the cards field specially if it exists
  if (Array.isArray(data.cards)) {
    preparedData.cards = encodeCardsForKnack(data.cards);
  }

  // Handle topic lists specially if they exist
  if (Array.isArray(data.topicLists)) {
    preparedData.topicLists = encodeTopicListsForKnack(data.topicLists);
  }

  // Handle color mapping - convert to JSON string if it's an object
  if (data.colorMapping && typeof data.colorMapping === 'object') {
    preparedData.colorMapping = JSON.stringify(data.colorMapping);
  }

  return preparedData;
};

/**
 * Fix issues with the current handler references in TopicCreationModal
 * This is a workaround until direct code fixes can be applied
 */
export const fixHandlerReferences = () => {
  // Wait for the DOM to be ready
  setTimeout(() => {
    // Try to find any TopicCreationModal instances
    const modalInstances = document.querySelectorAll('.topic-creation-modal-overlay');
    
    if (modalInstances.length > 0) {
      console.log('[MultiSubjectBridge] Found TopicCreationModal instance(s), applying fixes');
      
      // Add a global handler for the custom saveTopicShells event
      window.addEventListener('saveTopicShells', (event) => {
        console.log('[MultiSubjectBridge] Global saveTopicShells event handler activated');
        
        // Try to find the App component's handler function
        if (window.App && typeof window.App.handleSaveTopicShellsAndRefresh === 'function') {
          window.App.handleSaveTopicShellsAndRefresh(event.detail.shells);
        }
      });
      
      console.log('[MultiSubjectBridge] Added global event handler for saveTopicShells');
    }
  }, 500); // Short delay to ensure DOM is ready
};

// Export a default object for import convenience
export default {
  encodeTopicListsForKnack,
  encodeCardsForKnack,
  prepareDataForKnack,
  fixHandlerReferences
};
