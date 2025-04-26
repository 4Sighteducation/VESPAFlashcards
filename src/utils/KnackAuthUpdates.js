// KnackAuthUpdates.js - Functions to support multiple subjects by enhancing data parsing
import SaveQueueService from '../services/SaveQueueService';
import { safeParseJSON, safeDecodeURIComponent } from './DataUtils';
// import MultiSubjectBridge from '../services/MultiSubjectBridge'; // Bridge likely not needed here now

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
      topicMetadata: []
    };
    
    // Process cards safely
    if (userData.cards) {
      processedData.cards = safeDecodeKnackCards(userData.cards);
      console.log(`Processed ${processedData.cards.length} cards from Knack data`);
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

// Safely encode card data for Knack
export function safeEncodeKnackCards(cards) {
  try {
    if (!Array.isArray(cards)) return '[]';
    
    // First validate and clean the cards
    const cleanedCards = cards.map(card => {
      if (!card || typeof card !== 'object') return null;
      
      // Handle topic shells differently
      if (card.type === 'topic' && card.isShell) {
        return {
          id: card.id,
          type: 'topic',
          subject: card.subject || 'General',
          topic: card.topic || '',
          name: card.name || card.topic || 'Unknown Topic',
          isShell: true,
          isEmpty: !!card.isEmpty,
          examBoard: card.examBoard || '',
          examType: card.examType || '',
          cardColor: card.cardColor || card.color || '#cccccc',
          subjectColor: card.subjectColor || '',
          timestamp: card.timestamp || new Date().toISOString(),
          // We don't need all the card-specific fields for shells
        };
      }
      
      // Regular cards
      return {
        id: card.id,
        type: card.type || 'card',
        subject: card.subject || 'General',
        topic: card.topic || '',
        question: card.question || '',
        answer: card.answer || '',
        examBoard: card.examBoard || '',
        examType: card.examType || '',
        questionType: card.questionType || 'short_answer',
        boxNum: card.boxNum || 1,
        // Only include arrays if they exist and are valid
        ...(Array.isArray(card.keyPoints) ? { keyPoints: card.keyPoints } : {}),
        ...(Array.isArray(card.options) ? { options: card.options } : {}),
        ...(Array.isArray(card.savedOptions) ? { savedOptions: card.savedOptions } : {}),
        cardColor: card.cardColor || card.color || '#cccccc',
        subjectColor: card.subjectColor || '',
        detailedAnswer: card.detailedAnswer || '',
        additionalInfo: card.additionalInfo || '',
        lastReviewed: card.lastReviewed || null,
        nextReviewDate: card.nextReviewDate || null,
        createdAt: card.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }).filter(Boolean); // Remove any null entries
    
    // Convert to JSON string
    const jsonString = JSON.stringify(cleanedCards);
    
    // --- OMITTING additional encoding steps for debugging ---
    // return jsonString
    //   .replace(/\+/g, '%2B')
    //   .replace(/\//g, '%2F')
    //   .replace(/\\/g, '%5C');
    return jsonString; // Return plain JSON string
  } catch (error) {
    console.error('Error encoding cards for Knack:', error);
    return '[]'; // Return empty array string on failure
  }
}

// Functions to ensure consistency when saving data to Knack
export function prepareKnackSaveData(data) {
  if (!data) return {};
  
  try {
    // Create a deep copy to avoid modifying the original
    const prepared = JSON.parse(JSON.stringify({ ...data }));
    
    // Enhanced logging to help debug
    console.log(`[prepareKnackSaveData] Processing data for Knack save:`);
    console.log(`- Cards: ${Array.isArray(prepared.cards) ? prepared.cards.length : 'None'}`);
    
    // --- OMITTING ENCODING/STRINGIFYING --- 
    // // Process cards with enhanced encoding
    // if (Array.isArray(prepared.cards)) {
    //   prepared.cards = safeEncodeKnackCards(prepared.cards);
    //   console.log(`[prepareKnackSaveData] Encoded ${data.cards.length} cards for Knack`);
    // }
    
    // // Ensure other data fields are properly JSON stringified
    // if (prepared.colorMapping && typeof prepared.colorMapping !== 'string') {
    //   prepared.colorMapping = JSON.stringify(prepared.colorMapping);
    // }
    // 
    // if (prepared.spacedRepetition && typeof prepared.spacedRepetition !== 'string') {
    //   prepared.spacedRepetition = JSON.stringify(prepared.spacedRepetition);
    // }
    // 
    // if (prepared.topicMetadata && typeof prepared.topicMetadata !== 'string') {
    //   prepared.topicMetadata = JSON.stringify(prepared.topicMetadata);
    // }
    // --- END OMITTING --- 
    
    // Set a flag to indicate this data was specially prepared for multi-subject support
    prepared._multiSubjectEnabled = true; // Keep this flag if needed elsewhere
    
    delete prepared.topicLists; // Keep this removed
    
    // Return the data with RAW JS objects/arrays for cards, colors, etc.
    return prepared;
  } catch (error) {
    console.error('[prepareKnackSaveData] Error preparing data for Knack:', error);
    // Try to recover with a simpler approach
    // --- OMITTING STRINGIFY IN FALLBACK TOO ---
    const fallback = { ...data };
    // if (fallback.cards && typeof fallback.cards !== 'string') {
    //   fallback.cards = JSON.stringify(fallback.cards);
    // }
    // --- END OMITTING --- 
    return fallback;
  }
}

// Initialize the handler fixes
// --- OMITTING MultiSubjectBridge initialization if no longer needed ---
/*
setTimeout(() => {
  try {
    console.log('[KnackAuthUpdates] Initializing MultiSubjectBridge handler fixes');
    MultiSubjectBridge.fixHandlerReferences();
  } catch (e) {
    console.error('[KnackAuthUpdates] Error initializing MultiSubjectBridge:', e);
  }
}, 1000);
*/
