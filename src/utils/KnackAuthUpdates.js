// KnackAuthUpdates.js - Functions to support multiple subjects by enhancing data parsing
import SaveQueueService from '../services/SaveQueueService';
import { safeParseJSON, safeDecodeURIComponent } from './DataUtils';

// Safely decode Knack topic lists with robust error recovery
export function safeDecodeKnackTopicLists(topicListsData) {
  try {
    if (!topicListsData) return [];
    
    // First try to decode URI if needed
    let decodedData = topicListsData;
    if (typeof topicListsData === 'string' && topicListsData.includes('%')) {
      try {
        decodedData = safeDecodeURIComponent(topicListsData);
      } catch (decodeError) {
        console.error('Error decoding topic lists URI component:', decodeError);
        // Try advanced recovery by escaping problematic characters
        decodedData = topicListsData.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
        try {
          decodedData = decodeURIComponent(decodedData);
        } catch (secondError) {
          console.error('Advanced URI decode failed, using original:', secondError);
          decodedData = topicListsData;
        }
      }
    }
    
    // Now safely parse as JSON
    const parsedLists = safeParseJSON(decodedData, []);
    if (!Array.isArray(parsedLists)) {
      console.warn('Topic lists data is not an array after parsing:', parsedLists);
      return [];
    }
    
    // Add basic validation for expected topic list structure
    return parsedLists.map(list => {
      // Ensure minimal valid structure
      if (!list || typeof list !== 'object') return null;
      
      // Ensure subject exists
      const subject = list.subject || "Unknown Subject";
      
      // Ensure topics array exists and has proper structure
      let topics = [];
      if (Array.isArray(list.topics)) {
        topics = list.topics.map(topic => {
          if (!topic || typeof topic !== 'object') return null;
          
          // Create consistent topic structure
          return {
            id: topic.id || `topic_${Date.now()}_${Math.random().toString(36).substring(2,9)}`,
            name: topic.name || 'Unknown Topic',
            // Include other critical fields if available
            examBoard: topic.examBoard || '',
            examType: topic.examType || '',
            color: topic.color || '#808080',
            subjectColor: topic.subjectColor || ''
          };
        }).filter(Boolean); // Remove any null/invalid topics
      }
      
      // Return validated topic list
      return {
        subject,
        topics,
        color: list.color || '#808080'
      };
    }).filter(Boolean); // Remove any null/invalid lists
  } catch (error) {
    console.error('Fatal error processing topic lists:', error);
    return []; // Return empty array on catastrophic failure
  }
}

// Safely decode Knack card data with robust error recovery
export function safeDecodeKnackCards(cardsData) {
  try {
    if (!cardsData) return [];
    
    // First try to decode URI if needed
    let decodedData = cardsData;
    if (typeof cardsData === 'string' && cardsData.includes('%')) {
      try {
        decodedData = safeDecodeURIComponent(cardsData);
      } catch (decodeError) {
        console.error('Error decoding cards URI component:', decodeError);
        // Try advanced recovery by escaping problematic characters
        decodedData = cardsData.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
        try {
          decodedData = decodeURIComponent(decodedData);
        } catch (secondError) {
          console.error('Advanced URI decode failed for cards, using original:', secondError);
          decodedData = cardsData;
        }
      }
    }
    
    // Now safely parse as JSON
    const parsedCards = safeParseJSON(decodedData, []);
    if (!Array.isArray(parsedCards)) {
      console.warn('Cards data is not an array after parsing:', parsedCards);
      return [];
    }
    
    // Filter out any invalid cards and ensure minimal structure
    return parsedCards.filter(card => {
      return card && typeof card === 'object' && card.id;
    });
  } catch (error) {
    console.error('Fatal error processing cards data:', error);
    return []; // Return empty array on catastrophic failure
  }
}

// Process Knack user data safely when loading
export function processKnackUserData(userData) {
  if (!userData) return { cards: [], topicLists: [], colorMapping: {}, spacedRepetition: {} };
  
  try {
    // Process basic structure check
    const processedData = {
      recordId: userData.recordId || null,
      cards: [],
      colorMapping: {},
      spacedRepetition: { box1: [], box2: [], box3: [], box4: [], box5: [] },
      topicLists: [],
      topicMetadata: []
    };
    
    // Process cards safely
    if (userData.cards) {
      processedData.cards = safeDecodeKnackCards(userData.cards);
      console.log(`Processed ${processedData.cards.length} cards from Knack data`);
    }
    
    // Process topic lists safely
    if (userData.topicLists) {
      processedData.topicLists = safeDecodeKnackTopicLists(userData.topicLists);
      console.log(`Processed ${processedData.topicLists.length} topic lists from Knack data`);
    }
    
    // Process color mapping safely
    if (userData.colorMapping) {
      processedData.colorMapping = safeParseJSON(userData.colorMapping, {});
      console.log('Processed color mapping from Knack data');
    }
    
    // Process spaced repetition data safely
    if (userData.spacedRepetition) {
      processedData.spacedRepetition = safeParseJSON(userData.spacedRepetition, 
        { box1: [], box2: [], box3: [], box4: [], box5: [] });
      console.log('Processed spaced repetition data from Knack data');
    }
    
    // Process topic metadata safely
    if (userData.topicMetadata) {
      processedData.topicMetadata = safeParseJSON(userData.topicMetadata, []);
      console.log(`Processed ${processedData.topicMetadata.length} topic metadata items from Knack data`);
    }
    
    return processedData;
  } catch (error) {
    console.error('Error processing Knack user data:', error);
    return { 
      recordId: userData.recordId || null,
      cards: [], 
      topicLists: [], 
      colorMapping: {}, 
      spacedRepetition: { box1: [], box2: [], box3: [], box4: [], box5: [] },
      topicMetadata: []
    };
  }
}

// Safely encode topic lists for storage in Knack
export function safeEncodeKnackTopicLists(topicLists) {
  try {
    if (!Array.isArray(topicLists)) return '[]';
    
    // First validate and clean the topic lists
    const cleanedLists = topicLists.map(list => {
      if (!list || typeof list !== 'object') return null;
      
      // Ensure subject exists
      const subject = list.subject || "Unknown Subject";
      
      // Clean and validate topics array
      let topics = [];
      if (Array.isArray(list.topics)) {
        topics = list.topics.filter(topic => 
          topic && typeof topic === 'object' && (topic.id || topic.name)
        );
      }
      
      return {
        subject,
        topics,
        color: list.color || '#808080'
      };
    }).filter(Boolean); // Remove any null/invalid lists
    
    // Convert to JSON string
    const jsonString = JSON.stringify(cleanedLists);
    
    // No need to URI encode here - let the server handle that if needed
    return jsonString;
  } catch (error) {
    console.error('Error encoding topic lists for Knack:', error);
    return '[]'; // Return empty array string on failure
  }
}

// Functions to ensure consistency when saving data to Knack
export function prepareKnackSaveData(data) {
  const prepared = { ...data };
  
  // Ensure topic lists are properly processed
  if (prepared.topicLists) {
    prepared.topicLists = safeEncodeKnackTopicLists(prepared.topicLists);
  }
  
  // Ensure other data fields are properly JSON stringified
  if (prepared.colorMapping && typeof prepared.colorMapping !== 'string') {
    prepared.colorMapping = JSON.stringify(prepared.colorMapping);
  }
  
  if (prepared.spacedRepetition && typeof prepared.spacedRepetition !== 'string') {
    prepared.spacedRepetition = JSON.stringify(prepared.spacedRepetition);
  }
  
  if (prepared.topicMetadata && typeof prepared.topicMetadata !== 'string') {
    prepared.topicMetadata = JSON.stringify(prepared.topicMetadata);
  }
  
  return prepared;
}
