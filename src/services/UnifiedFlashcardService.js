/**
 * UnifiedFlashcardService.js
 * 
 * A unified service for managing all flashcard data in field_3032.
 * This service implements the "single source of truth" architecture, storing
 * subjects, topics, cards, and spaced repetition data in a single field.
 */

// Color palette for subject/topic assignment
const BRIGHT_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
  "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080"
];

// API constants - these will be used for direct API access if needed
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_KEY || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const KNACK_API_URL = "https://api.knack.com/v1";
const FLASHCARD_OBJECT = "object_102";

// Field mappings - focusing only on unified data field
const FIELD_MAPPING = {
  unifiedData: 'field_3032',      // Unified data store - primary source of truth
  lastSaved: 'field_2957'          // Last saved timestamp
};

/**
 * Debug logging helper with consistent styling
 */
const debugLog = (title, data) => {
  console.log(`%c[UnifiedFlashcardService] ${title}`, 'color: #4b0082; font-weight: bold; font-size: 12px;');
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  return data; // Return data for chaining
};

/**
 * Safely parse JSON with recovery options
 * @param {string} jsonString - JSON string to parse
 * @param {Array|Object} defaultValue - Default value if parsing fails
 * @returns {Array|Object} - Parsed JSON or default value
 */
const safeParseJSON = (jsonString, defaultValue = null) => {
  if (!jsonString) return defaultValue;
  
  try {
    // If it's already an object, just return it
    if (typeof jsonString === 'object') return jsonString;
    
    // Regular JSON parse
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("[UnifiedFlashcardService] Error parsing JSON:", error);
    
    // Try recovery methods for common JSON issues
    try {
      // Try to clean up the JSON string
      const cleaned = jsonString
        .replace(/\\"/g, '"')        // Fix escaped quotes
        .replace(/"\s+/g, '"')       // Remove whitespace after quotes
        .replace(/\s+"/g, '"')       // Remove whitespace before quotes
        .replace(/,\s*}/g, '}')      // Remove trailing commas in objects
        .replace(/,\s*\]/g, ']');    // Remove trailing commas in arrays
        
      return JSON.parse(cleaned);
    } catch (secondError) {
      console.error("[UnifiedFlashcardService] JSON recovery failed:", secondError);
      return defaultValue;
    }
  }
};

/**
 * Generate a unique ID
 * @param {string} prefix - Prefix for the ID ('topic', 'subj', 'card', etc.)
 * @returns {string} - Unique ID
 */
const generateId = (prefix = 'item') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate a shade of a base color for topics in a hierarchy
 * @param {string} baseColor - The base color in hex format
 * @param {number} index - The index of the item
 * @param {number} total - Total number of items
 * @returns {string} - Generated shade in hex format
 */
const generateShade = (baseColor, index, total) => {
  if (!baseColor) return BRIGHT_COLORS[0];
  
  try {
    // Convert hex to RGB
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    
    // Calculate lightness adjustment based on shade index
    // Using a range from -20% (darker) to +30% (lighter)
    const adjustment = -20 + (50 * (index / (total - 1)));
    
    // Apply adjustment to RGB values
    let adjustedR = Math.min(255, Math.max(0, r * (1 + adjustment/100)));
    let adjustedG = Math.min(255, Math.max(0, g * (1 + adjustment/100)));
    let adjustedB = Math.min(255, Math.max(0, b * (1 + adjustment/100)));
    
    // Convert back to hex
    const adjustedHex = '#' + 
      Math.round(adjustedR).toString(16).padStart(2, '0') +
      Math.round(adjustedG).toString(16).padStart(2, '0') +
      Math.round(adjustedB).toString(16).padStart(2, '0');
    
    return adjustedHex;
  } catch (error) {
    console.error("[UnifiedFlashcardService] Error generating shade:", error);
    return baseColor; // Default to original color on error
  }
};

/**
 * Create a greyed-out version of a color for empty topic shells
 * @param {string} baseColor - The base color in hex format
 * @returns {string} - Greyed-out color in hex format
 */
const createGreyedOutColor = (baseColor) => {
  if (!baseColor) return '#e0e0e0'; // Default grey if no color provided
  
  try {
    // Remove # if present
    const hex = baseColor.replace('#', '');
    
    // Convert to RGB - fixed parsing for correct RGB extraction
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Mix with grey (desaturate and lighten)
    const greyMix = 0.7; // 70% grey mix
    const greyR = Math.floor(r * (1 - greyMix) + 200 * greyMix);
    const greyG = Math.floor(g * (1 - greyMix) + 200 * greyMix);
    const greyB = Math.floor(b * (1 - greyMix) + 200 * greyMix);
    
    // Convert back to hex
    return `#${greyR.toString(16).padStart(2, '0')}${greyG.toString(16).padStart(2, '0')}${greyB.toString(16).padStart(2, '0')}`;
  } catch (error) {
    console.error("[UnifiedFlashcardService] Error creating greyed-out color:", error);
    return '#e0e0e0'; // Default grey if there's an error
  }
};

/**
 * UnifiedFlashcardService class
 * Central service for managing all flashcard data
 */
class UnifiedFlashcardService {
  /**
   * Initialize empty data structure following the schema
   * @returns {Object} - Empty unified data structure
   */
  initializeEmptyDataStructure() {
    return {
      version: "1.0",
      lastUpdated: new Date().toISOString(),
      subjects: [],
      topics: [],
      cards: [],
      spacedRepetition: {
        box1: [],
        box2: [],
        box3: [],
        box4: [],
        box5: []
      },
      metadata: {
        colorMappings: {},
        lastSaved: new Date().toISOString(),
        schemaVersion: "1.0.0",
        appVersion: "2.1.0"
      }
    };
  }

  /**
   * Save unified data to Knack (via parent window postMessage)
   * @param {Object} unifiedData - The unified data structure to save
   * @returns {Promise<boolean>} - Promise resolving to success status
   */
  saveUnifiedData(unifiedData, recordId) {
    return new Promise((resolve, reject) => {
      try {
        debugLog("Saving unified data", { recordId });
        
        // Update timestamp
        const dataToSave = {
          ...unifiedData,
          lastUpdated: new Date().toISOString(),
          metadata: {
            ...unifiedData.metadata,
            lastSaved: new Date().toISOString()
          }
        };
        
        // Send save message to parent window if available
        if (window.parent && window.parent !== window) {
          // Set up message listener for save result
          const messageHandler = (event) => {
            if (event.data && event.data.type === 'SAVE_RESULT') {
              // Remove the listener once we get a response
              window.removeEventListener('message', messageHandler);
              
              if (event.data.success) {
                debugLog("Save successful", { timestamp: event.data.timestamp });
                resolve(true);
              } else {
                debugLog("Save failed", { error: event.data.error });
                reject(new Error("Failed to save unified data"));
              }
            }
          };
          
          // Add the listener
          window.addEventListener('message', messageHandler);
          
          // Send the save message
          window.parent.postMessage({
            type: "SAVE_DATA",
            data: {
              recordId: recordId,
              unifiedData: dataToSave,
              useUnifiedData: true  // Signal to use the unified data approach
            }
          }, '*');
          
          // Set a timeout to reject the promise if no response after 10 seconds
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error("Save operation timed out after 10 seconds"));
          }, 10000);
        } else {
          // Fallback to localStorage if no parent window
          try {
            localStorage.setItem('unified_flashcards', JSON.stringify(dataToSave));
            debugLog("Saved to localStorage (fallback)");
            resolve(true);
          } catch (error) {
            debugLog("Error saving to localStorage", { error });
            reject(error);
          }
        }
      } catch (error) {
        debugLog("Error in saveUnifiedData", { error });
        reject(error);
      }
    });
  }

  /**
   * Load unified data from Knack or localStorage
   * @returns {Promise<Object>} - Promise resolving to the loaded data
   */
  loadUnifiedData() {
    return new Promise((resolve, reject) => {
      try {
        debugLog("Loading unified data");
        
        // First try to load from parent window (Knack integration)
        if (window.parent && window.parent !== window) {
          // Set up message listener
          const messageHandler = (event) => {
            if (event.data && event.data.type === 'KNACK_USER_INFO') {
              // Remove the listener once we get a response
              window.removeEventListener('message', messageHandler);
              
              try {
                const userData = event.data.data;
                
                if (userData && userData.unifiedData) {
                  debugLog("Loaded unified data from Knack");
                  resolve({
                    data: safeParseJSON(userData.unifiedData, this.initializeEmptyDataStructure()),
                    recordId: userData.recordId || null
                  });
                } else if (userData && userData.userData) {
                  // Fallback to legacy data format
                  debugLog("No unified data found, loading legacy data");
                  
                  // Initialize with empty structure
                  const unifiedData = this.initializeEmptyDataStructure();
                  
                  // Use recordId if available 
                  const recordId = userData.recordId || null;
                  
                  // We don't attempt to migrate legacy data in this implementation
                  // Just return the empty structure
                  resolve({ data: unifiedData, recordId });
                } else {
                  // No data at all, return empty structure
                  debugLog("No data found, returning empty structure");
                  resolve({ 
                    data: this.initializeEmptyDataStructure(),
                    recordId: null
                  });
                }
              } catch (error) {
                debugLog("Error processing KNACK_USER_INFO", { error });
                reject(error);
              }
            }
          };
          
          // Add the listener
          window.addEventListener('message', messageHandler);
          
          // Send message to request user info with unified data
          window.parent.postMessage({
            type: 'APP_READY',
            useUnifiedData: true
          }, '*');
          
          // Set a timeout to reject the promise if no response after 10 seconds
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error("Load operation timed out after 10 seconds"));
          }, 10000);
        } else {
          // Fallback to localStorage if no parent window
          try {
            const savedData = localStorage.getItem('unified_flashcards');
            if (savedData) {
              debugLog("Loaded from localStorage (fallback)");
              resolve({ 
                data: safeParseJSON(savedData, this.initializeEmptyDataStructure()),
                recordId: null
              });
            } else {
              debugLog("No localStorage data found, returning empty structure");
              resolve({ 
                data: this.initializeEmptyDataStructure(),
                recordId: null
              });
            }
          } catch (error) {
            debugLog("Error loading from localStorage", { error });
            reject(error);
          }
        }
      } catch (error) {
        debugLog("Error in loadUnifiedData", { error });
        reject(error);
      }
    });
  }

  /**
   * Add a new subject
   * @param {Object} unifiedData - The current unified data structure
   * @param {Object} subject - Subject object to add
   * @returns {Object} - Updated unified data structure
   */
  addSubject(unifiedData, subject) {
    try {
      debugLog("Adding subject", { subject });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Create a new subject object with required fields
      const newSubject = {
        id: subject.id || generateId('subj'),
        name: subject.name || 'Unnamed Subject',
        color: subject.color || BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)],
        examBoard: subject.examBoard || '',
        examType: subject.examType || '',
        created: subject.created || new Date().toISOString(),
        updated: new Date().toISOString()
      };
      
      // Add to subjects array
      const updatedData = {
        ...data,
        subjects: [...(data.subjects || []), newSubject],
        lastUpdated: new Date().toISOString()
      };
      
      // Update color mappings
      if (!updatedData.metadata.colorMappings) {
        updatedData.metadata.colorMappings = {};
      }
      
      updatedData.metadata.colorMappings[newSubject.name] = {
        base: newSubject.color,
        topics: {}
      };
      
      return updatedData;
    } catch (error) {
      debugLog("Error in addSubject", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Update an existing subject
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} subjectId - ID of the subject to update
   * @param {Object} updates - Updates to apply
   * @returns {Object} - Updated unified data structure
   */
  updateSubject(unifiedData, subjectId, updates) {
    try {
      debugLog("Updating subject", { subjectId, updates });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the subject index
      const subjectIndex = data.subjects.findIndex(s => s.id === subjectId);
      
      if (subjectIndex === -1) {
        debugLog("Subject not found", { subjectId });
        return data; // Return unchanged
      }
      
      // Get the existing subject
      const existingSubject = data.subjects[subjectIndex];
      
      // Create updated subject
      const updatedSubject = {
        ...existingSubject,
        ...updates,
        updated: new Date().toISOString()
      };
      
      // Create a new subjects array with the updated subject
      const updatedSubjects = [...data.subjects];
      updatedSubjects[subjectIndex] = updatedSubject;
      
      // Handle color mapping updates if name or color changed
      const updatedData = {
        ...data,
        subjects: updatedSubjects,
        lastUpdated: new Date().toISOString()
      };
      
      // Update color mappings if needed
      if (!updatedData.metadata.colorMappings) {
        updatedData.metadata.colorMappings = {};
      }
      
      // If the subject name changed, we need to update the color mapping key
      if (updates.name && updates.name !== existingSubject.name) {
        const oldMapping = updatedData.metadata.colorMappings[existingSubject.name];
        delete updatedData.metadata.colorMappings[existingSubject.name];
        updatedData.metadata.colorMappings[updates.name] = oldMapping || {
          base: updatedSubject.color,
          topics: {}
        };
      }
      
      // If the color changed, update the base color in the mapping
      if (updates.color && updates.color !== existingSubject.color) {
        const subjectName = updatedSubject.name;
        if (!updatedData.metadata.colorMappings[subjectName]) {
          updatedData.metadata.colorMappings[subjectName] = {
            base: updatedSubject.color,
            topics: {}
          };
        } else {
          updatedData.metadata.colorMappings[subjectName].base = updatedSubject.color;
        }
      }
      
      return updatedData;
    } catch (error) {
      debugLog("Error in updateSubject", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Delete a subject
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} subjectId - ID of the subject to delete
   * @returns {Object} - Updated unified data structure
   */
  deleteSubject(unifiedData, subjectId) {
    try {
      debugLog("Deleting subject", { subjectId });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the subject
      const subject = data.subjects.find(s => s.id === subjectId);
      
      if (!subject) {
        debugLog("Subject not found", { subjectId });
        return data; // Return unchanged
      }
      
      // Remove from subjects array
      const updatedSubjects = data.subjects.filter(s => s.id !== subjectId);
      
      // Also remove all topics and cards that belong to this subject
      const updatedTopics = data.topics.filter(t => t.subjectId !== subjectId);
      const updatedCards = data.cards.filter(c => c.subjectId !== subjectId);
      
      // Remove from color mappings if present
      const updatedData = {
        ...data,
        subjects: updatedSubjects,
        topics: updatedTopics,
        cards: updatedCards,
        lastUpdated: new Date().toISOString()
      };
      
      // Clean up color mappings
      if (updatedData.metadata.colorMappings && updatedData.metadata.colorMappings[subject.name]) {
        delete updatedData.metadata.colorMappings[subject.name];
      }
      
      return updatedData;
    } catch (error) {
      debugLog("Error in deleteSubject", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Add a new topic with optional parent
   * @param {Object} unifiedData - The current unified data structure
   * @param {Object} topic - Topic object to add
   * @returns {Object} - Updated unified data structure
   */
  addTopic(unifiedData, topic) {
    try {
      debugLog("Adding topic", { topic });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Get parent topic if this is a subtopic
      const parentId = topic.parentId || null;
      let parentTopic = null;
      let level = 1;
      
      if (parentId) {
        parentTopic = data.topics.find(t => t.id === parentId);
        if (parentTopic) {
          level = (parentTopic.level || 1) + 1;
        }
      }
      
      // Get subject for this topic
      const subjectId = topic.subjectId;
      const subject = data.subjects.find(s => s.id === subjectId);
      
      if (!subject) {
        debugLog("Subject not found for topic", { subjectId });
        return data; // Return unchanged
      }
      
      // Generate ID based on hierarchy
      let id = topic.id;
      if (!id) {
        if (parentTopic) {
          // Find how many siblings this topic has to determine the number
          const siblings = data.topics.filter(t => t.parentId === parentId);
          id = `${parentId}.${siblings.length + 1}`;
        } else {
          // Find how many root topics this subject has
          const rootTopics = data.topics.filter(t => t.subjectId === subjectId && !t.parentId);
          id = `topic_${rootTopics.length + 1}`;
        }
      }
      
      // Generate full name based on hierarchy
      let fullName = topic.name;
      if (parentTopic) {
        fullName = `${parentTopic.name}: ${topic.name}`;
      }
      
      // Generate color based on subject and position
      let color;
      if (topic.color) {
        color = topic.color;
      } else if (parentTopic) {
        // For subtopics, shade the parent's color
        const siblings = data.topics.filter(t => t.parentId === parentId);
        color = generateShade(parentTopic.color, siblings.length, Math.max(siblings.length + 1, 5));
      } else {
        // For root topics, shade the subject's color
        const rootTopics = data.topics.filter(t => t.subjectId === subjectId && !t.parentId);
        color = generateShade(subject.color, rootTopics.length, Math.max(rootTopics.length + 1, 5));
      }
      
      // Create a new topic object with required fields
      const newTopic = {
        id,
        parentId,
        subjectId,
        name: topic.name,
        fullName,
        color,
        cards: [],
        isEmpty: true,
        level,
        created: topic.created || new Date().toISOString(),
        updated: new Date().toISOString()
      };
      
      // Add to topics array
      const updatedData = {
        ...data,
        topics: [...(data.topics || []), newTopic],
        lastUpdated: new Date().toISOString()
      };
      
      // Update color mappings
      if (!updatedData.metadata.colorMappings) {
        updatedData.metadata.colorMappings = {};
      }
      
      if (!updatedData.metadata.colorMappings[subject.name]) {
        updatedData.metadata.colorMappings[subject.name] = {
          base: subject.color,
          topics: {}
        };
      }
      
      updatedData.metadata.colorMappings[subject.name].topics[newTopic.fullName] = newTopic.color;
      
      return updatedData;
    } catch (error) {
      debugLog("Error in addTopic", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Update an existing topic
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} topicId - ID of the topic to update
   * @param {Object} updates - Updates to apply
   * @returns {Object} - Updated unified data structure
   */
  updateTopic(unifiedData, topicId, updates) {
    try {
      debugLog("Updating topic", { topicId, updates });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the topic index
      const topicIndex = data.topics.findIndex(t => t.id === topicId);
      
      if (topicIndex === -1) {
        debugLog("Topic not found", { topicId });
        return data; // Return unchanged
      }
      
      // Get the existing topic
      const existingTopic = data.topics[topicIndex];
      
      // Create updated topic
      const updatedTopic = {
        ...existingTopic,
        ...updates,
        updated: new Date().toISOString()
      };
      
      // Update fullName if name changed and this is a subtopic
      if (updates.name && updates.name !== existingTopic.name) {
        if (existingTopic.parentId) {
          const parentTopic = data.topics.find(t => t.id === existingTopic.parentId);
          if (parentTopic) {
            updatedTopic.fullName = `${parentTopic.name}: ${updates.name}`;
          }
        } else {
          updatedTopic.fullName = updates.name;
        }
      }
      
      // Create a new topics array with the updated topic
      const updatedTopics = [...data.topics];
      updatedTopics[topicIndex] = updatedTopic;
      
      // Update the unified data structure
      const updatedData = {
        ...data,
        topics: updatedTopics,
        lastUpdated: new Date().toISOString()
      };
      
      // Update color mappings if needed
      if (updates.name || updates.color) {
        const subject = data.subjects.find(s => s.id === updatedTopic.subjectId);
        
        if (subject && updatedData.metadata.colorMappings && updatedData.metadata.colorMappings[subject.name]) {
          // Remove old entry if fullName changed
          if (existingTopic.fullName !== updatedTopic.fullName) {
            delete updatedData.metadata.colorMappings[subject.name].topics[existingTopic.fullName];
          }
          
          // Add updated entry
          updatedData.metadata.colorMappings[subject.name].topics[updatedTopic.fullName] = updatedTopic.color;
        }
      }
      
      return updatedData;
    } catch (error) {
      debugLog("Error in updateTopic", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Delete a topic
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} topicId - ID of the topic to delete
   * @returns {Object} - Updated unified data structure
   */
  deleteTopic(unifiedData, topicId) {
    try {
      debugLog("Deleting topic", { topicId });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the topic
      const topic = data.topics.find(t => t.id === topicId);
      
      if (!topic) {
        debugLog("Topic not found", { topicId });
        return data; // Return unchanged
      }
      
      // Get all subtopics that need to be deleted
      const getAllChildTopicIds = (parentId) => {
        const childTopics = data.topics.filter(t => t.parentId === parentId);
        const childTopicIds = childTopics.map(t => t.id);
        
        // Recursively get all children of children
        const nestedChildTopicIds = childTopics.flatMap(child => getAllChildTopicIds(child.id));
        
        return [...childTopicIds, ...nestedChildTopicIds];
      };
      
      // Get all topic IDs to delete
      const topicIdsToDelete = [topicId, ...getAllChildTopicIds(topicId)];
      
      // Remove these topics
      const updatedTopics = data.topics.filter(t => !topicIdsToDelete.includes(t.id));
      
      // Remove cards belonging to these topics
      const updatedCards = data.cards.filter(c => !topicIdsToDelete.includes(c.topicId));
      
      // Also remove from spaced repetition data
      const updatedSpacedRepetition = { ...data.spacedRepetition };
      
      // Get all card IDs that need to be removed
      const cardsToRemove = data.cards.filter(c => topicIdsToDelete.includes(c.topicId)).map(c => c.id);
      
      // Filter all boxes to remove the deleted cards
      for (const boxKey of Object.keys(updatedSpacedRepetition)) {
        if (Array.isArray(updatedSpacedRepetition[boxKey])) {
          updatedSpacedRepetition[boxKey] = updatedSpacedRepetition[boxKey].filter(item => {
            // Handle both string IDs and objects with cardId
            if (typeof item === 'string') {
              return !cardsToRemove.includes(item);
            } else if (item && item.cardId) {
              return !cardsToRemove.includes(item.cardId);
            }
            return true;
          });
        }
      }
      
      // Remove from color mappings if present
      const updatedData = {
        ...data,
        topics: updatedTopics,
        cards: updatedCards,
        spacedRepetition: updatedSpacedRepetition,
        lastUpdated: new Date().toISOString()
      };
      
      // Clean up color mappings
      if (topic.subjectId) {
        const subject = data.subjects.find(s => s.id === topic.subjectId);
        if (subject && updatedData.metadata.colorMappings && updatedData.metadata.colorMappings[subject.name]) {
          delete updatedData.metadata.colorMappings[subject.name].topics[topic.fullName];
        }
      }
      
      return updatedData;
    } catch (error) {
      debugLog("Error in deleteTopic", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Add a card to a topic
   * @param {Object} unifiedData - The current unified data structure
   * @param {Object} card - Card object to add
   * @param {string} topicId - ID of the topic to add the card to
   * @returns {Object} - Updated unified data structure
   */
  addCard(unifiedData, card, topicId) {
    try {
      debugLog("Adding card to topic", { topicId });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the topic
      const topic = data.topics.find(t => t.id === topicId);
      
      if (!topic) {
        debugLog("Topic not found", { topicId });
        return data; // Return unchanged
      }
      
      // Find the subject
      const subject = data.subjects.find(s => s.id === topic.subjectId);
      
      if (!subject) {
        debugLog("Subject not found for topic", { topicId, subjectId: topic.subjectId });
        return data; // Return unchanged
      }
      
      // Create a new card object with required fields
      const newCard = {
        id: card.id || generateId('card'),
        topicId,
        subjectId: topic.subjectId,
        subject: subject.name,
        topic: topic.fullName,
        examBoard: subject.examBoard,
        examType: subject.examType,
        question: card.question || '',
        answer: card.answer || '',
        detailedAnswer: card.detailedAnswer || '',
        additionalInfo: card.additionalInfo || '',
        type: card.type || 'short_answer',
        cardColor: card.cardColor || topic.color,
        textColor: card.textColor || '',
        boxNum: 1, // New cards start in box 1
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date().toISOString(), // Immediate review
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to cards array
      const updatedData = {
        ...data,
        cards: [...(data.cards || []), newCard],
        lastUpdated: new Date().toISOString()
      };
      
      // Update topic's cards array and isEmpty status
      const topicIndex = updatedData.topics.findIndex(t => t.id === topicId);
      if (topicIndex !== -1) {
        const updatedTopic = {
          ...updatedData.topics[topicIndex],
          cards: [...(updatedData.topics[topicIndex].cards || []), newCard.id],
          isEmpty: false,
          updated: new Date().toISOString()
        };
        
        // If topic was empty and is now not empty, update the color
        if (updatedData.topics[topicIndex].isEmpty) {
          // Use full color instead of greyed out
          updatedTopic.color = updatedTopic.baseColor || subject.color;
        }
        
        // Update the topic
        updatedData.topics[topicIndex] = updatedTopic;
      }
      
      // Add to spaced repetition box 1
      if (!updatedData.spacedRepetition.box1) {
        updatedData.spacedRepetition.box1 = [];
      }
      
      updatedData.spacedRepetition.box1.push({
        cardId: newCard.id,
        lastReviewed: newCard.lastReviewed,
        nextReviewDate: newCard.nextReviewDate
      });
      
      return updatedData;
    } catch (error) {
      debugLog("Error in addCard", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Update an existing card
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} cardId - ID of the card to update
   * @param {Object} updates - Updates to apply
   * @returns {Object} - Updated unified data structure
   */
  updateCard(unifiedData, cardId, updates) {
    try {
      debugLog("Updating card", { cardId, updates });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the card index
      const cardIndex = data.cards.findIndex(c => c.id === cardId);
      
      if (cardIndex === -1) {
        debugLog("Card not found", { cardId });
        return data; // Return unchanged
      }
      
      // Get the existing card
      const existingCard = data.cards[cardIndex];
      
      // Create updated card
      const updatedCard = {
        ...existingCard,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Create a new cards array with the updated card
      const updatedCards = [...data.cards];
      updatedCards[cardIndex] = updatedCard;
      
      // Update the unified data structure
      const updatedData = {
        ...data,
        cards: updatedCards,
        lastUpdated: new Date().toISOString()
      };
      
      // If the card's topic changed, update both the old and new topics
      if (updates.topicId && updates.topicId !== existingCard.topicId) {
        // Find old topic
        const oldTopicIndex = updatedData.topics.findIndex(t => t.id === existingCard.topicId);
        if (oldTopicIndex !== -1) {
          // Remove card from old topic's cards array
          const oldTopic = updatedData.topics[oldTopicIndex];
          const updatedOldTopic = {
            ...oldTopic,
            cards: oldTopic.cards.filter(id => id !== cardId),
            updated: new Date().toISOString()
          };
          
          // Check if the old topic is now empty
          if (updatedOldTopic.cards.length === 0) {
            updatedOldTopic.isEmpty = true;
            
            // Apply greyed-out color if topic is now empty
            if (updatedOldTopic.baseColor) {
              updatedOldTopic.color = createGreyedOutColor(updatedOldTopic.baseColor);
            }
          }
          
          // Update old topic
          updatedData.topics[oldTopicIndex] = updatedOldTopic;
        }
        
        // Find new topic
        const newTopicIndex = updatedData.topics.findIndex(t => t.id === updates.topicId);
        if (newTopicIndex !== -1) {
          // Add card to new topic's cards array
          const newTopic = updatedData.topics[newTopicIndex];
          const updatedNewTopic = {
            ...newTopic,
            cards: [...(newTopic.cards || []), cardId],
            isEmpty: false,
            updated: new Date().toISOString()
          };
          
          // If topic was empty and is now not empty, update the color
          if (newTopic.isEmpty) {
            // Use full color instead of greyed out
            if (newTopic.baseColor) {
              updatedNewTopic.color = newTopic.baseColor;
            }
          }
          
          // Update new topic
          updatedData.topics[newTopicIndex] = updatedNewTopic;
          
          // Also update card's subject, topic name, examBoard, examType based on new topic
          const subject = updatedData.subjects.find(s => s.id === newTopic.subjectId);
          if (subject) {
            updatedData.cards[cardIndex] = {
              ...updatedData.cards[cardIndex],
              subjectId: newTopic.subjectId,
              subject: subject.name,
              topic: newTopic.fullName,
              examBoard: subject.examBoard,
              examType: subject.examType
            };
          }
        }
      }
      
      return updatedData;
    } catch (error) {
      debugLog("Error in updateCard", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Delete a card
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} cardId - ID of the card to delete
   * @returns {Object} - Updated unified data structure
   */
  deleteCard(unifiedData, cardId) {
    try {
      debugLog("Deleting card", { cardId });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the card
      const card = data.cards.find(c => c.id === cardId);
      
      if (!card) {
        debugLog("Card not found", { cardId });
        return data; // Return unchanged
      }
      
      // Remove card from cards array
      const updatedCards = data.cards.filter(c => c.id !== cardId);
      
      // Remove card from topic's cards array
      const topicIndex = data.topics.findIndex(t => t.id === card.topicId);
      let updatedTopics = [...data.topics];
      
      if (topicIndex !== -1) {
        const topic = data.topics[topicIndex];
        const updatedTopic = {
          ...topic,
          cards: topic.cards.filter(id => id !== cardId),
          updated: new Date().toISOString()
        };
        
        // Check if the topic is now empty
        if (updatedTopic.cards.length === 0) {
          updatedTopic.isEmpty = true;
          
          // Apply greyed-out color if topic is now empty
          if (updatedTopic.baseColor) {
            updatedTopic.color = createGreyedOutColor(updatedTopic.baseColor);
          }
        }
        
        // Update topic
        updatedTopics[topicIndex] = updatedTopic;
      }
      
      // Remove card from spaced repetition data
      const updatedSpacedRepetition = { ...data.spacedRepetition };
      
      // Filter all boxes to remove the deleted card
      for (const boxKey of Object.keys(updatedSpacedRepetition)) {
        if (Array.isArray(updatedSpacedRepetition[boxKey])) {
          updatedSpacedRepetition[boxKey] = updatedSpacedRepetition[boxKey].filter(item => {
            // Handle both string IDs and objects with cardId
            if (typeof item === 'string') {
              return item !== cardId;
            } else if (item && item.cardId) {
              return item.cardId !== cardId;
            }
            return true;
          });
        }
      }
      
      // Update the unified data structure
      const updatedData = {
        ...data,
        cards: updatedCards,
        topics: updatedTopics,
        spacedRepetition: updatedSpacedRepetition,
        lastUpdated: new Date().toISOString()
      };
      
      return updatedData;
    } catch (error) {
      debugLog("Error in deleteCard", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Move a card to a different spaced repetition box
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} cardId - ID of the card to move
   * @param {number} boxNum - Box number to move to (1-5)
   * @returns {Object} - Updated unified data structure
   */
  moveCardToBox(unifiedData, cardId, boxNum) {
    try {
      debugLog("Moving card to box", { cardId, boxNum });
      
      // Validate box number
      if (boxNum < 1 || boxNum > 5) {
        debugLog("Invalid box number", { boxNum });
        return unifiedData; // Return unchanged
      }
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Find the card
      const cardIndex = data.cards.findIndex(c => c.id === cardId);
      
      if (cardIndex === -1) {
        debugLog("Card not found", { cardId });
        return data; // Return unchanged
      }
      
      // Calculate next review date based on box number
      const calculateNextReviewDate = (boxNumber) => {
        const today = new Date();
        let nextDate = new Date(today);
        
        switch (boxNumber) {
          case 1: // Review next day
            nextDate.setDate(today.getDate() + 1);
            break;
          case 2: // Every other day
            nextDate.setDate(today.getDate() + 2);
            break;
          case 3: // Every 3rd day
            nextDate.setDate(today.getDate() + 3);
            break;
          case 4: // Every week (7 days)
            nextDate.setDate(today.getDate() + 7);
            break;
          case 5: // Every 4 weeks (28 days)
            nextDate.setDate(today.getDate() + 28);
            break;
          default:
            nextDate.setDate(today.getDate() + 1);
        }
        
        return nextDate.toISOString();
      };
      
      // Get the next review date
      const nextReviewDate = calculateNextReviewDate(boxNum);
      
      // Update the card's boxNum, lastReviewed, and nextReviewDate
      const updatedCards = [...data.cards];
      updatedCards[cardIndex] = {
        ...updatedCards[cardIndex],
        boxNum,
        lastReviewed: new Date().toISOString(),
        nextReviewDate,
        updatedAt: new Date().toISOString()
      };
      
      // Update spaced repetition data
      const updatedSpacedRepetition = { ...data.spacedRepetition };
      
      // Remove card from all boxes
      for (let i = 1; i <= 5; i++) {
        const boxKey = `box${i}`;
        if (Array.isArray(updatedSpacedRepetition[boxKey])) {
          updatedSpacedRepetition[boxKey] = updatedSpacedRepetition[boxKey].filter(item => {
            // Handle both string IDs and objects with cardId
            if (typeof item === 'string') {
              return item !== cardId;
            } else if (item && item.cardId) {
              return item.cardId !== cardId;
            }
            return true;
          });
        }
      }
      
      // Add card to the new box
      const boxKey = `box${boxNum}`;
      if (!Array.isArray(updatedSpacedRepetition[boxKey])) {
        updatedSpacedRepetition[boxKey] = [];
      }
      
      updatedSpacedRepetition[boxKey].push({
        cardId,
        lastReviewed: new Date().toISOString(),
        nextReviewDate
      });
      
      // Update the unified data structure
      const updatedData = {
        ...data,
        cards: updatedCards,
        spacedRepetition: updatedSpacedRepetition,
        lastUpdated: new Date().toISOString()
      };
      
      return updatedData;
    } catch (error) {
      debugLog("Error in moveCardToBox", { error });
      return unifiedData; // Return unchanged on error
    }
  }

  /**
   * Get cards due for review
   * @param {Object} unifiedData - The current unified data structure
   * @param {number} boxNum - Box number to check (1-5)
   * @returns {Array} - Cards due for review in the specified box
   */
  getCardsForReview(unifiedData, boxNum) {
    try {
      debugLog("Getting cards for review", { boxNum });
      
      // Validate box number
      if (boxNum < 1 || boxNum > 5) {
        debugLog("Invalid box number", { boxNum });
        return []; // Return empty array
      }
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Get the current date
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Set to beginning of day for fair comparison
      
      // Get cards from the specified box
      const boxKey = `box${boxNum}`;
      const boxItems = data.spacedRepetition[boxKey] || [];
      
      // Filter to cards that are due for review
      const dueCardIds = boxItems
        .filter(item => {
          // Handle both string IDs and objects with nextReviewDate
          if (typeof item === 'string') {
            return true; // Always include string IDs (backward compatibility)
          } else if (item && item.nextReviewDate) {
            const reviewDate = new Date(item.nextReviewDate);
            return reviewDate <= now; // Include if review date is today or earlier
          }
          return true; // Include by default
        })
        .map(item => typeof item === 'string' ? item : item.cardId);
      
      // Get the actual card objects
      const dueCards = data.cards.filter(card => dueCardIds.includes(card.id));
      
      return dueCards;
    } catch (error) {
      debugLog("Error in getCardsForReview", { error });
      return []; // Return empty array on error
    }
  }

  /**
   * Get topics for a subject
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} subjectId - ID of the subject
   * @returns {Array} - Array of topics for the subject
   */
  getTopicsForSubject(unifiedData, subjectId) {
    try {
      debugLog("Getting topics for subject", { subjectId });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Filter to topics for this subject
      const topics = data.topics.filter(topic => topic.subjectId === subjectId);
      
      // Sort by ID to maintain hierarchy
      return topics.sort((a, b) => {
        // Sort by level first
        if (a.level !== b.level) {
          return a.level - b.level;
        }
        
        // Then by ID
        return a.id.localeCompare(b.id);
      });
    } catch (error) {
      debugLog("Error in getTopicsForSubject", { error });
      return []; // Return empty array on error
    }
  }

  /**
   * Build a hierarchical topic tree
   * @param {Object} unifiedData - The current unified data structure
   * @param {string} subjectId - Optional ID of the subject to filter by
   * @returns {Array} - Hierarchical topic tree
   */
  buildTopicHierarchy(unifiedData, subjectId = null) {
    try {
      debugLog("Building topic hierarchy", { subjectId });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Filter topics by subject if specified
      let topics = [...data.topics];
      if (subjectId) {
        topics = topics.filter(topic => topic.subjectId === subjectId);
      }
      
      // Helper function to recursively build tree
      const buildTree = (parentId = null) => {
        return topics
          .filter(topic => topic.parentId === parentId)
          .map(topic => ({
            ...topic,
            children: buildTree(topic.id)
          }));
      };
      
      // Build tree from root topics
      return buildTree(null);
    } catch (error) {
      debugLog("Error in buildTopicHierarchy", { error });
      return []; // Return empty array on error
    }
  }

  /**
   * Get filtered cards based on subject and topic
   * @param {Object} unifiedData - The current unified data structure
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered cards
   */
  getFilteredCards(unifiedData, filters = {}) {
    try {
      debugLog("Getting filtered cards", { filters });
      
      // Make sure we have a valid unified data structure
      const data = unifiedData || this.initializeEmptyDataStructure();
      
      // Start with all cards
      let filteredCards = [...data.cards];
      
      // Apply subject filter
      if (filters.subjectId) {
        filteredCards = filteredCards.filter(card => card.subjectId === filters.subjectId);
      }
      
      // Apply topic filter - handle hierarchical topics
      if (filters.topicId) {
        // Get all descendant topic IDs
        const allTopicIds = [filters.topicId];
        
        // Helper function to get all descendant topic IDs
        const addDescendantTopics = (parentId) => {
          const childTopics = data.topics.filter(t => t.parentId === parentId);
          
          childTopics.forEach(topic => {
            allTopicIds.push(topic.id);
            addDescendantTopics(topic.id);
          });
        };
        
        // Add all descendants of the selected topic
        addDescendantTopics(filters.topicId);
        
        // Filter cards to those in the selected topic or its descendants
        filteredCards = filteredCards.filter(card => allTopicIds.includes(card.topicId));
      }
      
      // Apply other filters if needed
      if (filters.boxNum) {
        filteredCards = filteredCards.filter(card => card.boxNum === filters.boxNum);
      }
      
      if (filters.examBoard) {
        filteredCards = filteredCards.filter(card => card.examBoard === filters.examBoard);
      }
      
      if (filters.examType) {
        filteredCards = filteredCards.filter(card => card.examType === filters.examType);
      }
      
      return filteredCards;
    } catch (error) {
      debugLog("Error in getFilteredCards", { error });
      return []; // Return empty array on error
    }
  }
}

// Create and export a singleton instance
const unifiedFlashcardService = new UnifiedFlashcardService();
export default unifiedFlashcardService;
