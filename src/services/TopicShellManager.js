/**
 * TopicShellManager.js
 * 
 * Central service for managing topic shells across the application.
 * Handles creating, updating, and retrieving topic shells with consistent metadata.
 */

import { generateId } from '../utils/UnifiedDataModel';
import metadataManager from './MetadataManager';
import colorManager from './ColorManager';

class TopicShellManager {
  constructor() {
    // Cache for topic shells to avoid duplication
    this.topicShellCache = new Map();
    
    // Track topic cards relationships
    this.topicCardMap = new Map();
    
    // Debug config
    this.debugEnabled = process.env.NODE_ENV !== 'production';
    
    // Initialize the cache from localStorage if available
    this.initializeFromLocalStorage();
  }

  /**
   * Debug logging helper
   * @param {string} title - Log title
   * @param {any} data - Data to log
   * @returns {any} - The data (for chaining)
   */
  debugLog(title, data) {
    if (!this.debugEnabled) return data;
    
    console.log(`%c[TopicShellManager] ${title}`, 'color: #4caf50; font-weight: bold; font-size: 12px;');
    if (data) console.log(JSON.stringify(data, null, 2));
    return data; // Return data for chaining
  }

  /**
   * Initialize the topic shell cache from localStorage
   */
  initializeFromLocalStorage() {
    try {
      const cachedShells = localStorage.getItem('topicShellCache');
      if (cachedShells) {
        const shells = JSON.parse(cachedShells);
        shells.forEach(shell => {
          if (shell && shell.id) {
            this.topicShellCache.set(shell.id, shell);
          }
        });
        this.debugLog("Initialized topic shell cache from localStorage", { count: this.topicShellCache.size });
      }
    } catch (error) {
      console.error("Error initializing topic shell cache from localStorage", error);
    }
  }

  /**
   * Initialize the topic shell cache from data
   * @param {Object} userData - User data containing topics
   */
  initialize(userData) {
    this.debugLog("Initializing topic shell manager with user data", { hasData: !!userData });
    
    if (!userData) return;
    
    // Process topic shells
    if (userData.topicShells && Array.isArray(userData.topicShells)) {
      userData.topicShells.forEach(shell => {
        if (shell && shell.id) {
          this.topicShellCache.set(shell.id, shell);
        }
      });
    }
    
    // Process cards to build topic-card relationships
    if (userData.cards && Array.isArray(userData.cards)) {
      userData.cards.forEach(card => {
        if (card && card.topicId) {
          // Get or initialize the card list for this topic
          const cardIds = this.topicCardMap.get(card.topicId) || new Set();
          
          // Add this card ID to the set
          cardIds.add(card.id);
          
          // Update the map
          this.topicCardMap.set(card.topicId, cardIds);
          
          // Update the card count in the shell if available
          const shell = this.topicShellCache.get(card.topicId);
          if (shell) {
            // Initialize cards array if needed
            if (!Array.isArray(shell.cards)) {
              shell.cards = [];
            }
            
            // Add card ID if not already present
            if (!shell.cards.includes(card.id)) {
              shell.cards.push(card.id);
            }
            
            // Update isEmpty flag
            shell.isEmpty = shell.cards.length === 0;
          }
        }
      });
    }
    
    this.debugLog("Topic shell manager initialized", {
      shellCount: this.topicShellCache.size,
      topicCardRelations: this.topicCardMap.size
    });
    
    // Save to localStorage for persistence
    this.saveToLocalStorage();
  }

  /**
   * Save the topic shell cache to localStorage
   */
  saveToLocalStorage() {
    try {
      const shells = Array.from(this.topicShellCache.values());
      localStorage.setItem('topicShellCache', JSON.stringify(shells));
      this.debugLog("Saved topic shell cache to localStorage", { count: shells.length });
    } catch (error) {
      console.error("Error saving topic shell cache to localStorage", error);
    }
  }

  /**
   * Create or update a topic shell
   * @param {Object} topicData - Topic data
   * @param {boolean} preserveCards - Whether to preserve existing cards in the shell
   * @returns {Object} - Created or updated topic shell
   */
  createOrUpdateTopicShell(topicData, preserveCards = true) {
    if (!topicData) {
      throw new Error("Missing topic data for shell creation");
    }
    
    if (!topicData.subject) {
      throw new Error("Topic shell must have a subject");
    }
    
    // Use existing ID or generate a new one
    const topicId = topicData.id || generateId('topic');
    
    // Check if we already have this shell in the cache
    const existingShell = this.topicShellCache.get(topicId);
    
    // Apply color management
    const topicColor = colorManager.getTopicColor(topicData.subject, topicData.name || topicData.topic);
    
    // Base shell structure with current timestamp
    const now = new Date().toISOString();
    
    // Apply metadata
    const metadata = metadataManager.getTopicMetadata(topicId) || {
      examBoard: topicData.examBoard || 'General',
      examType: topicData.examType || 'General'
    };
    
    // Create the new shell
    const shell = {
      id: topicId,
      type: 'topic',
      name: topicData.name || topicData.topic || 'Untitled Topic',
      subject: topicData.subject,
      color: topicData.color || topicColor,
      examBoard: metadata.examBoard,
      examType: metadata.examType,
      cards: [],
      isShell: true,
      isEmpty: true,
      created: now,
      updated: now
    };
    
    // If existing shell exists, preserve certain properties
    if (existingShell) {
      // Preserve cards array if requested
      if (preserveCards && Array.isArray(existingShell.cards)) {
        shell.cards = [...existingShell.cards];
      }
      
      // Preserve creation date
      shell.created = existingShell.created || shell.created;
      
      // Only update the timestamp
      shell.updated = now;
      
      // Determine if shell is empty based on cards
      shell.isEmpty = !shell.cards || shell.cards.length === 0;
      
      this.debugLog("Updated existing topic shell", {
        id: topicId,
        cardCount: shell.cards.length,
        subject: shell.subject
      });
    } else {
      this.debugLog("Created new topic shell", {
        id: topicId,
        subject: shell.subject
      });
    }
    
    // Update the topic metadata if needed
    metadataManager.updateMetadata(shell);
    
    // Add to cache
    this.topicShellCache.set(topicId, shell);
    
    // Save to localStorage
    this.saveToLocalStorage();
    
    return shell;
  }

  /**
   * Get a topic shell by ID
   * @param {string} topicId - Topic ID
   * @returns {Object|null} - Topic shell or null if not found
   */
  getTopicShell(topicId) {
    if (!topicId) return null;
    return this.topicShellCache.get(topicId) || null;
  }

  /**
   * Get all topic shells
   * @returns {Array} - Array of all topic shells
   */
  getAllTopicShells() {
    return Array.from(this.topicShellCache.values());
  }

  /**
   * Get topic shells for a specific subject
   * @param {string} subject - Subject name
   * @returns {Array} - Array of topic shells for the subject
   */
  getTopicShellsBySubject(subject) {
    if (!subject) return [];
    
    return Array.from(this.topicShellCache.values())
      .filter(shell => shell.subject === subject);
  }

  /**
   * Link a card to a topic
   * @param {string} topicId - Topic ID
   * @param {string} cardId - Card ID
   * @returns {boolean} - Success status
   */
  linkCardToTopic(topicId, cardId) {
    if (!topicId || !cardId) return false;
    
    // Get the topic shell
    const shell = this.topicShellCache.get(topicId);
    if (!shell) return false;
    
    // Initialize cards array if needed
    if (!Array.isArray(shell.cards)) {
      shell.cards = [];
    }
    
    // Add card ID if not already present
    if (!shell.cards.includes(cardId)) {
      shell.cards.push(cardId);
      
      // Update the topic-card map
      const cardIds = this.topicCardMap.get(topicId) || new Set();
      cardIds.add(cardId);
      this.topicCardMap.set(topicId, cardIds);
      
      // Update isEmpty flag
      shell.isEmpty = false;
      
      // Update timestamp
      shell.updated = new Date().toISOString();
      
      // Save to localStorage
      this.saveToLocalStorage();
      
      this.debugLog("Linked card to topic", { topicId, cardId, cardCount: shell.cards.length });
      return true;
    }
    
    return false;
  }

  /**
   * Unlink a card from a topic
   * @param {string} topicId - Topic ID
   * @param {string} cardId - Card ID
   * @returns {boolean} - Success status
   */
  unlinkCardFromTopic(topicId, cardId) {
    if (!topicId || !cardId) return false;
    
    // Get the topic shell
    const shell = this.topicShellCache.get(topicId);
    if (!shell || !Array.isArray(shell.cards)) return false;
    
    // Remove card ID
    const index = shell.cards.indexOf(cardId);
    if (index >= 0) {
      shell.cards.splice(index, 1);
      
      // Update the topic-card map
      const cardIds = this.topicCardMap.get(topicId);
      if (cardIds) {
        cardIds.delete(cardId);
        
        if (cardIds.size === 0) {
          // Remove the mapping if no cards left
          this.topicCardMap.delete(topicId);
        } else {
          // Update the map
          this.topicCardMap.set(topicId, cardIds);
        }
      }
      
      // Update isEmpty flag
      shell.isEmpty = shell.cards.length === 0;
      
      // Update timestamp
      shell.updated = new Date().toISOString();
      
      // Save to localStorage
      this.saveToLocalStorage();
      
      this.debugLog("Unlinked card from topic", { 
        topicId, 
        cardId, 
        remainingCards: shell.cards.length 
      });
      return true;
    }
    
    return false;
  }

  /**
   * Get cards linked to a topic
   * @param {string} topicId - Topic ID
   * @returns {Set|null} - Set of card IDs or null if topic not found
   */
  getTopicCardIds(topicId) {
    if (!topicId) return null;
    return this.topicCardMap.get(topicId) || new Set();
  }

  /**
   * Delete a topic shell
   * @param {string} topicId - Topic ID
   * @returns {boolean} - Success status
   */
  deleteTopicShell(topicId) {
    if (!topicId) return false;
    
    // Check if topic exists
    if (!this.topicShellCache.has(topicId)) return false;
    
    // Remove from cache
    this.topicShellCache.delete(topicId);
    
    // Remove from topic-card map
    this.topicCardMap.delete(topicId);
    
    // Save to localStorage
    this.saveToLocalStorage();
    
    this.debugLog("Deleted topic shell", { topicId });
    return true;
  }

  /**
   * Get topic statistics
   * @returns {Object} - Statistics about topics
   */
  getTopicStats() {
    const shells = Array.from(this.topicShellCache.values());
    
    // Count topics by subject
    const subjectCounts = {};
    shells.forEach(shell => {
      if (shell.subject) {
        subjectCounts[shell.subject] = (subjectCounts[shell.subject] || 0) + 1;
      }
    });
    
    // Count empty vs. populated topics
    const emptyTopics = shells.filter(shell => shell.isEmpty).length;
    const populatedTopics = shells.length - emptyTopics;
    
    return {
      totalTopics: shells.length,
      emptyTopics,
      populatedTopics,
      subjectCounts,
      averageCardsPerTopic: shells.reduce((sum, shell) => sum + (shell.cards?.length || 0), 0) / shells.length || 0
    };
  }
}

// Export a singleton instance
const topicShellManager = new TopicShellManager();
export default topicShellManager; 