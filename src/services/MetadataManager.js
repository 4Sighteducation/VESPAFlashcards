/**
 * MetadataManager.js
 * 
 * Central service for managing metadata across all entities (subjects, topics, cards)
 * Ensures consistent metadata propagation throughout the application
 */

class MetadataManager {
  constructor() {
    this.metadataCache = new Map();
    this.topicMetadataCache = new Map();
    this.subjectMetadataCache = new Map();
    this.debugEnabled = process.env.NODE_ENV !== 'production';
  }

  /**
   * Debug logging helper
   */
  debugLog(title, data) {
    if (!this.debugEnabled) return data;
    
    console.log(`%c[MetadataManager] ${title}`, 'color: #ff9800; font-weight: bold; font-size: 12px;');
    if (data) console.log(JSON.stringify(data, null, 2));
    return data; // Return data for chaining
  }

  /**
   * Initialize metadata cache from stored data
   * @param {Object} userData - User data containing topics and metadata
   */
  initializeCache(userData) {
    this.debugLog("Initializing metadata cache", { dataAvailable: !!userData });
    
    if (!userData) return;

    // Clear existing caches
    this.metadataCache.clear();
    this.topicMetadataCache.clear();
    this.subjectMetadataCache.clear();

    // Process topic metadata
    if (userData.topicMetadata && Array.isArray(userData.topicMetadata)) {
      userData.topicMetadata.forEach(meta => {
        if (meta && meta.id) {
          this.topicMetadataCache.set(meta.id, meta);
        }
      });
    }

    // Process topic shells for subject metadata
    if (userData.topicShells && Array.isArray(userData.topicShells)) {
      userData.topicShells.forEach(shell => {
        if (shell && shell.id) {
          // Cache topic metadata
          if (!this.topicMetadataCache.has(shell.id)) {
            this.topicMetadataCache.set(shell.id, {
              id: shell.id,
              name: shell.name,
              subject: shell.subject,
              examBoard: shell.examBoard || 'General',
              examType: shell.examType || 'General'
            });
          }

          // Cache subject metadata
          if (shell.subject && !this.subjectMetadataCache.has(shell.subject)) {
            this.subjectMetadataCache.set(shell.subject, {
              name: shell.subject,
              examBoard: shell.examBoard || 'General',
              examType: shell.examType || 'General',
              color: shell.subjectColor || shell.color
            });
          }
        }
      });
    }

    this.debugLog("Metadata cache initialized", {
      topicCount: this.topicMetadataCache.size,
      subjectCount: this.subjectMetadataCache.size
    });
  }

  /**
   * Get metadata for a specific topic
   * @param {string} topicId - Topic ID
   * @returns {Object} - Topic metadata or null if not found
   */
  getTopicMetadata(topicId) {
    if (!topicId) return null;
    return this.topicMetadataCache.get(topicId) || null;
  }

  /**
   * Get metadata for a specific subject
   * @param {string} subjectName - Subject name
   * @returns {Object} - Subject metadata or null if not found
   */
  getSubjectMetadata(subjectName) {
    if (!subjectName) return null;
    return this.subjectMetadataCache.get(subjectName) || null;
  }

  /**
   * Apply metadata to an entity (topic, card, etc.)
   * @param {Object} entity - Entity to apply metadata to
   * @param {Object} options - Options for metadata application
   * @returns {Object} - Entity with applied metadata
   */
  applyMetadata(entity, options = {}) {
    if (!entity) return entity;
    
    const { forceUpdate = false, source = null } = options;
    
    // Clone the entity to avoid modifying the original
    const result = { ...entity };

    // For topic entities
    if (entity.type === 'topic') {
      // If topic already has complete metadata and no force update, return as is
      if (!forceUpdate && entity.examBoard && entity.examType) {
        return result;
      }
      
      // Look for existing topic metadata
      const topicMeta = this.topicMetadataCache.get(entity.id);
      if (topicMeta) {
        // Apply topic metadata
        result.examBoard = topicMeta.examBoard || result.examBoard || 'General';
        result.examType = topicMeta.examType || result.examType || 'General';
      } 
      // If no topic metadata but has subject, try to get from subject
      else if (entity.subject) {
        const subjectMeta = this.subjectMetadataCache.get(entity.subject);
        if (subjectMeta) {
          result.examBoard = subjectMeta.examBoard || result.examBoard || 'General';
          result.examType = subjectMeta.examType || result.examType || 'General';
        }
      }
    } 
    // For card entities
    else if (entity.type === 'card' || !entity.type) {
      // If card has a topicId, apply topic metadata
      if (entity.topicId) {
        const topicMeta = this.topicMetadataCache.get(entity.topicId);
        if (topicMeta) {
          result.subject = topicMeta.subject || result.subject;
          result.examBoard = topicMeta.examBoard || result.examBoard || 'General';
          result.examType = topicMeta.examType || result.examType || 'General';
        }
      }
    }

    return result;
  }

  /**
   * Update metadata for an entity
   * @param {Object} entity - Entity with updated metadata
   * @returns {boolean} - Success status
   */
  updateMetadata(entity) {
    if (!entity || !entity.id) return false;

    // For topic entities
    if (entity.type === 'topic') {
      const metadata = {
        id: entity.id,
        name: entity.name || entity.topic,
        subject: entity.subject,
        examBoard: entity.examBoard || 'General',
        examType: entity.examType || 'General'
      };
      
      // Update topic metadata cache
      this.topicMetadataCache.set(entity.id, metadata);
      
      // Update subject metadata if needed
      if (entity.subject && !this.subjectMetadataCache.has(entity.subject)) {
        this.subjectMetadataCache.set(entity.subject, {
          name: entity.subject,
          examBoard: entity.examBoard || 'General',
          examType: entity.examType || 'General',
          color: entity.subjectColor || entity.color
        });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Get all topic metadata
   * @returns {Array} - Array of topic metadata objects
   */
  getAllTopicMetadata() {
    return Array.from(this.topicMetadataCache.values());
  }

  /**
   * Get all subject metadata
   * @returns {Array} - Array of subject metadata objects
   */
  getAllSubjectMetadata() {
    return Array.from(this.subjectMetadataCache.values());
  }

  /**
   * Propagate metadata updates across all related entities
   * @param {Object} source - Source entity with updated metadata
   * @param {Array} entities - Array of entities to update
   * @returns {Array} - Updated entities
   */
  propagateMetadata(source, entities) {
    if (!source || !source.id || !Array.isArray(entities)) {
      return entities;
    }

    // Update source metadata first
    this.updateMetadata(source);

    // Track updated entities
    const updatedEntities = [...entities];

    // If source is a topic, update all cards with this topicId
    if (source.type === 'topic') {
      for (let i = 0; i < updatedEntities.length; i++) {
        const entity = updatedEntities[i];
        
        // Update cards belonging to this topic
        if ((entity.type === 'card' || !entity.type) && entity.topicId === source.id) {
          updatedEntities[i] = this.applyMetadata(entity, { forceUpdate: true, source });
        }
      }
    }

    return updatedEntities;
  }
}

// Export singleton instance
const metadataManager = new MetadataManager();
export default metadataManager; 