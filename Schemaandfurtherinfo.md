Unified Data Schema for VESPA Flashcards
Core Entity Structure
UnifiedDataContainer
├── version: "2.0"
├── lastUpdated: ISO8601 timestamp
├── userId: string
├── recordId: string
├── subjects: Subject[]
├── topics: Topic[]
└── cards: Card[]
Entity Definitions
Subject
{
  id: string,                 // Format: "subj_{timestamp}_{random}"
  name: string,               // Subject name (e.g., "Biology")
  color: string,              // Hex color code (e.g., "#3cb44b")
  examBoard: string,          // Exam board (e.g., "AQA")
  examType: string,           // Exam type (e.g., "A-Level")
  metadata: {                 // Extensible metadata object
    created: ISO8601 timestamp,
    updated: ISO8601 timestamp,
    createdBy: string,        // User ID who created this subject
    isHidden: boolean,        // Whether subject is hidden in UI
    sortOrder: number         // For custom sorting
  }
}
Topic
{
  id: string,                 // Format: "topic_{timestamp}_{random}"
  subjectId: string,          // Reference to parent subject
  parentId: string | null,    // For hierarchical topics (null for root topics)
  name: string,               // Topic name (e.g., "Cell Structure")
  fullName: string,           // Full path name (e.g., "Biology: Cell Structure")
  color: string,              // Hex color code (derived from subject color)
  isEmpty: boolean,           // Flag for topics with no cards
  level: number,              // Hierarchy level (1 for root topics, 2+ for subtopics)
  cardIds: string[],          // Array of card IDs belonging to this topic
  metadata: {
    created: ISO8601 timestamp,
    updated: ISO8601 timestamp, 
    examBoard: string,        // Inherited from subject, can be overridden
    examType: string,         // Inherited from subject, can be overridden
    description: string,      // Optional topic description
    isShell: boolean,         // Whether this is a topic shell (topic with no cards yet)
    sortOrder: number         // For custom sorting
  }
}
Card
{
  id: string,                 // Format: "card_{timestamp}_{random}"
  topicId: string,            // Reference to parent topic
  subjectId: string,          // Reference to subject
  type: "card",               // Entity type identifier
  question: string,           // Card question/front
  answer: string,             // Card answer/back
  questionType: string,       // One of: "short_answer", "multiple_choice", "essay", "acronym"
  cardColor: string,          // Hex color code (inherited from topic)
  textColor: string,          // Contrast text color based on cardColor
  
  // Spaced repetition properties
  boxNum: number,             // Current spaced repetition box (1-5)
  lastReviewed: ISO8601 timestamp | null,
  nextReviewDate: ISO8601 timestamp,
  
  // Type-specific properties
  // Only present for relevant question types
  options?: {                 // For multiple_choice
    text: string,
    isCorrect: boolean
  }[],
  correctAnswer?: string,     // For multiple_choice
  detailedAnswer?: string,    // Additional explanation
  
  // Metadata
  metadata: {
    created: ISO8601 timestamp,
    updated: ISO8601 timestamp,
    version: number,          // Card revision version
    examBoard: string,        // From topic/subject
    examType: string,         // From topic/subject
    difficulty: number,       // Optional difficulty rating (1-5)
    tags: string[],           // Custom tags for filtering
    source: string,           // Where the card came from (e.g., "AI Generated", "User Created")
    aiModel?: string          // If AI generated, which model was used
  }
}
Color Management System
Color Inheritance Chain
Subject (base color)
   ↓
Topic (shade variation of subject color)
   ↓
Card (inherits topic color)
Color Calculation Functions
// Generate a topic color from subject color
function generateTopicColor(subjectColor, topicIndex, totalTopics) {
  // HSL offers better control for generating color variations
  const hsl = hexToHSL(subjectColor);
  
  // Adjust lightness based on topic index (within bounds)
  const lightnessVariation = 15; // percentage points
  const newLightness = Math.max(
    20, 
    Math.min(
      80, 
      hsl.l + (topicIndex / totalTopics * lightnessVariation - lightnessVariation/2)
    )
  );
  
  // Adjust saturation slightly to create visual interest
  const saturationVariation = 10; // percentage points
  const newSaturation = Math.max(
    30,
    Math.min(
      90,
      hsl.s + ((topicIndex % 3) - 1) * saturationVariation
    )
  );
  
  return hslToHex({ h: hsl.h, s: newSaturation, l: newLightness });
}

// Calculate contrast text color
function getContrastTextColor(backgroundColor) {
  // Convert hex to RGB
  const rgb = hexToRGB(backgroundColor);
  
  // Calculate relative luminance
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 128 ? "#000000" : "#ffffff";
}

// Refresh topic colors when subject color changes
function refreshTopicColors(subjectId, newColor) {
  const subject = subjects.find(s => s.id === subjectId);
  if (!subject) return;
  
  // Update subject color
  subject.color = newColor;
  
  // Get topics for this subject
  const subjectTopics = topics.filter(t => t.subjectId === subjectId);
  
  // Update each topic's color
  subjectTopics.forEach((topic, index) => {
    topic.color = generateTopicColor(newColor, index, subjectTopics.length);
    
    // Update cards in this topic
    cards
      .filter(card => card.topicId === topic.id)
      .forEach(card => {
        card.cardColor = topic.color;
        card.textColor = getContrastTextColor(topic.color);
      });
  });
}
Knack Field Mapping
Knack Placeholder scene_1206 / view_3005

// Define schema field mapping to Knack fields
const FIELD_MAPPING = {
  // Primary data storage - using the unified structure instead of separate fields
  unifiedData: 'field_2679',     // Main unified data container (JSON)
  
  // These fields are for backward compatibility and search functionality
  topicLists: 'field_3011',      // Legacy topic lists (now derived from unified)
  colorMapping: 'field_3000',    // Generated from subject/topic colors in unified data
  
  // Spaced repetition tracking (referenced for quick filtering but data stored in cards too)
  box1: 'field_2986',            // IDs of cards in box 1
  box2: 'field_2987',            // IDs of cards in box 2
  box3: 'field_2988',            // IDs of cards in box 3 
  box4: 'field_2989',            // IDs of cards in box 4
  box5: 'field_2990',            // IDs of cards in box 5
  
  // Metadata tracking
  lastSaved: 'field_2957',       // Last saved timestamp
  userEmail: 'field_2958',       // User's email (for account matching)
  userId: 'field_2954',          // User's ID (primary reference)
  
Key Schema Benefits
Clearly Defined Relationships
Cards explicitly linked to topics via topicId
Topics explicitly linked to subjects via subjectId
Nested topics supported via parentId
Improved Color Management
Colors flow from subjects → topics → cards
Automatic contrast calculation for text
Support for theme color refreshing
Type Safety & Validation
Explicit types for different card variants
Clear validation rules for each entity type
Versioned schema with migration support
Enhanced Metadata
Extensible metadata object on all entities
Support for timestamps, versioning and authorship
Customizable tags and attributes
Performance Optimization
Indexed lookups via ID references
Card-Topic-Subject traversal in either direction
Efficient filtering and grouping

Complete Implementation Plan: Unified Save/Load System
After analyzing all the components including the TopicHub and messaging system, I've prepared this comprehensive implementation plan. The core of the issue is that while topic shells are created correctly during the initial save, the system fails to properly associate cards with these topic shells in subsequent operations.
1. Topic Shell Understanding
I now see exactly how topic shells work:
Creation Flow:
User selects metadata (examBoard, examType, subject) in AICardGenerator
User enters TopicHub to generate/organize topics
Topics are saved as "empty shells" with isEmpty: true flag
These shells serve as containers for cards with matching topic names
Current Issues:
Card-to-topic relationships break after initial save
Metadata loss during save operations
Race conditions between multiple save requests
Missing verification after topic shell creation
2. Implementation Plan
Phase 1: SaveQueueManager Service (Core Component)
// src/services/SaveQueueManager.js
export default class SaveQueueManager {
  constructor() {
    this.queue = [];
    this.inProgress = false;
    this.timer = null;
    this.listeners = [];
    this.lastSaveResult = null;
  }
  
  // Add an operation to the queue - deduplicates and prioritizes operations
  enqueue(operation) {
    // Deduplicate based on type
    const existing = this.queue.findIndex(op => op.type === operation.type);
    if (existing >= 0) {
      // Update existing operation with new data
      this.queue[existing] = {
        ...this.queue[existing],
        ...operation,
        timestamp: new Date().toISOString()
      };
    } else {
      // Add new operation to queue
      this.queue.push({
        ...operation,
        timestamp: new Date().toISOString()
      });
    }
    
    // Start processing if not already in progress
    if (!this.inProgress) {
      this.processQueue();
    }
    
    return Promise.resolve();
  }
  
  // Process next item in queue
  processQueue() {
    if (this.queue.length === 0) {
      this.inProgress = false;
      return;
    }
    
    this.inProgress = true;
    const operation = this.queue.shift();
    
    // Process based on operation type
    switch(operation.type) {
      case 'SAVE_DATA':
        this.processSaveData(operation);
        break;
      case 'ADD_TO_BANK':
        this.processAddToBank(operation);
        break;
      // Add other operation types as needed
      default:
        console.warn(`Unknown operation type: ${operation.type}`);
        this.processQueue();
    }
  }
  
  // Process save data operation with verification
  processSaveData(operation) {
    // Implementation includes:
    // 1. Process the save operation
    // 2. Verify topic-card relationships
    // 3. Notify listeners when complete
    // 4. Process next item in queue
  }
  
  // Add more methods for other operations...
}
Phase 2: New Core Data Schema - UnifiedDataManager Implementation
// src/services/UnifiedDataManager.js
import SaveQueueManager from './SaveQueueManager';
import { ENTITY_TYPES, SCHEMA_VERSION } from '../utils/UnifiedDataModel';

export default class UnifiedDataManager {
  constructor() {
    this.saveQueue = new SaveQueueManager();
    this.currentData = null;
    this.recordId = null;
    this.baseColors = {}; // Track base colors by subject
  }

  // Initialize with data
  initialize(data, recordId) {
    this.currentData = this.ensureSchemaVersion(data);
    this.recordId = recordId;
    this.extractBaseColors();
    return this;
  }
  
  // Create a topic shell with proper relationship management
  createTopicShell(subject, topic, metadata = {}) {
    // Find or create subject
    let subjectId = this.findOrCreateSubject(subject, metadata);
    
    // Create topic shell with proper parent relationship
    const topicId = this.generateId('topic');
    const topicColor = this.generateTopicColor(subjectId, topic);
    
    const topicShell = {
      id: topicId,
      type: ENTITY_TYPES.TOPIC,
      subjectId: subjectId,
      name: topic,
      fullName: `${subject}: ${topic}`,
      color: topicColor,
      isEmpty: true,
      cardIds: [],
      metadata: {
        ...metadata,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    };
    
    this.currentData.topics.push(topicShell);
    return topicId;
  }
  
  // Add cards with proper relationship management
  addCards(cards, topicId = null) {
    const processedCards = cards.map(card => {
      // Find the appropriate topic ID if not specified
      const targetTopicId = topicId || this.findMatchingTopicId(card);
      
      // Find the subject ID through the topic
      const topic = this.findTopicById(targetTopicId);
      const subjectId = topic ? topic.subjectId : null;
      
      // Create a properly structured card with relationships
      return {
        id: card.id || this.generateId('card'),
        type: ENTITY_TYPES.CARD,
        topicId: targetTopicId,
        subjectId: subjectId,
        question: card.question || card.front || '',
        answer: card.answer || card.back || '',
        cardColor: topic ? topic.color : card.cardColor,
        // ... other card properties
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          // ... metadata from the card
        }
      };
    });
    
    // Add to data model
    this.currentData.cards = [...this.currentData.cards, ...processedCards];
    
    // Update isEmpty flag for topics
    this.updateTopicShellStatus();
    
    return processedCards;
  }
  
  // Save data through queue manager
  save() {
    return this.saveQueue.enqueue({
      type: 'SAVE_DATA',
      data: this.currentData,
      recordId: this.recordId
    });
  }
  
  // Color management methods
  generateTopicColor(subjectId, topicName) {
    const subject = this.findSubjectById(subjectId);
    if (!subject) return '#e0e0e0';
    
    const baseColor = subject.color;
    // Generate color variation based on topic name
    // ... implementation of HSL-based color generation
    return topicColor;
  }
  
  // Refresh all colors in a subject
  refreshSubjectColors(subjectId, newBaseColor) {
    const subject = this.findSubjectById(subjectId);
    if (!subject) return;
    
    // Update subject color
    subject.color = newBaseColor;
    this.baseColors[subject.id] = newBaseColor;
    
    // Get all topics for this subject
    const topics = this.currentData.topics.filter(t => t.subjectId === subjectId);
    
    // Update each topic's color
    topics.forEach((topic, index) => {
      topic.color = this.generateTopicColor(subjectId, topic.name, index, topics.length);
      
      // Update cards in this topic
      this.currentData.cards
        .filter(card => card.topicId === topic.id)
        .forEach(card => {
          card.cardColor = topic.color;
        });
    });
  }
  
  // Helper methods...
}
Phase 3: Enhanced MessageHandler for React-Knack Communication
// src/utils/MessageHandler.js
import { saveUserData } from '../services/UnifiedDataService';

class MessageHandler {
  constructor() {
    this.pendingOperations = new Map();
    this.retryCount = 0;
    this.maxRetries = 3;
    this.listeners = new Map();
    this.queuedMessages = [];
    this.initialize();
  }
  
  initialize() {
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Set up periodic health check to detect disconnections
    setInterval(() => this.checkPendingOperations(), 10000);
  }
  
  handleMessage(event) {
    if (!event.data || !event.data.type) return;
    
    const { type, data, timestamp } = event.data;
    
    // Process message based on type
    switch(type) {
      case 'SAVE_OPERATION_QUEUED':
        this.handleSaveQueued(data);
        break;
      case 'TOPIC_SHELLS_CREATED':
        this.handleTopicShellsCreated(data);
        break;
      case 'KNACK_DATA':
        this.handleKnackData(data);
        break;
      // Other message types...
    }
    
    // Notify listeners
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => callback(data));
    }
  }
  
  sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      // Generate unique ID for this operation
      const operationId = `${type}_${Date.now()}`;
      
      // Add to pending operations
      this.pendingOperations.set(operationId, {
        type,
        data,
        timestamp: Date.now(),
        resolve,
        reject,
        retries: 0
      });
      
      // If parent window available, send message
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type,
          data,
          operationId,
          timestamp: new Date().toISOString()
        }, '*');
        
        // Set timeout for operation
        setTimeout(() => {
          this.handleOperationTimeout(operationId);
        }, 8000);
      } else {
        reject(new Error('No parent window available for communication'));
      }
    });
  }
  
  // Handle operation timeout
  handleOperationTimeout(operationId) {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) return;
    
    // If max retries reached, reject and clean up
    if (operation.retries >= this.maxRetries) {
      operation.reject(new Error(`Operation ${operation.type} timed out after ${this.maxRetries} retries`));
      this.pendingOperations.delete(operationId);
      return;
    }
    
    // Retry the operation
    operation.retries++;
    this.pendingOperations.set(operationId, operation);
    
    // Resend the message
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: operation.type,
        data: operation.data,
        operationId,
        retry: operation.retries,
        timestamp: new Date().toISOString()
      }, '*');
    }
  }
  
  // Other methods...
}

export default new MessageHandler();
Phase 4: Enhanced TopicCardSyncService
// src/services/TopicCardSyncService.js
export default class TopicCardSyncService {
  // Split items by type with enhanced detection logic
  static splitByType(items) {
    if (!Array.isArray(items)) return { topics: [], cards: [] };
    
    const topics = [];
    const cards = [];
    
    items.forEach(item => {
      if (!item) return;
      
      // Enhanced type detection with explicit and implicit checks
      if (this.isTopicShell(item)) {
        topics.push(this.normalizeTopicShell(item));
      } else if (this.isCard(item)) {
        cards.push(this.normalizeCard(item));
      } else {
        // If we can't determine, log warning and skip
        console.warn('Unknown item type:', item);
      }
    });
    
    return { topics, cards };
  }
  
  // Check if item is a topic shell
  static isTopicShell(item) {
    return (
      item.type === 'topic' || 
      item.isShell === true ||
      // Detect topic shells implicitly
      (item.subtopic && !item.question && !item.answer && !item.front && !item.back)
    );
  }
  
  // Check if item is a card
  static isCard(item) {
    return (
      item.type === 'card' || 
      // Detect cards implicitly 
      (item.question || item.answer || item.front || item.back || 
       (item.options && Array.isArray(item.options)))
    );
  }
  
  // Normalize topic shell to consistent format
  static normalizeTopicShell(item) {
    const normalized = { ...item };
    
    // Ensure required fields
    normalized.type = 'topic';
    normalized.id = normalized.id || `topic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    normalized.isShell = true;
    
    // Ensure topic and subtopic fields
    if (normalized.topic && !normalized.subtopic) {
      const parts = normalized.topic.split(':');
      if (parts.length > 1) {
        normalized.mainTopic = parts[0].trim();
        normalized.subtopic = parts.slice(1).join(':').trim();
      } else {
        normalized.subtopic = normalized.topic;
      }
    }
    
    return normalized;
  }
  
  // Normalize card to consistent format
  static normalizeCard(item) {
    const normalized = { ...item };
    
    // Ensure required fields
    normalized.type = 'card';
    normalized.id = normalized.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Standardize on question/answer naming
    if (!normalized.question && normalized.front) {
      normalized.question = normalized.front;
    }
    if (!normalized.answer && normalized.back) {
      normalized.answer = normalized.back;
    }
    
    // Multiple choice card fixes
    if (normalized.questionType === 'multiple_choice' || 
        (normalized.options && Array.isArray(normalized.options))) {
      normalized.questionType = 'multiple_choice';
      
      // Ensure options and savedOptions
      if (normalized.options && !normalized.savedOptions) {
        normalized.savedOptions = [...normalized.options];
      } else if (!normalized.options && normalized.savedOptions) {
        normalized.options = [...normalized.savedOptions];
      }
    }
    
    return normalized;
  }
  
  // Additional methods...
}
Phase 5: Migration System
// src/services/DataMigrator.js
import { SCHEMA_VERSION } from '../utils/UnifiedDataModel';

const migrations = [
  {
    version: '1.0',
    migrate: (data) => {
      console.log('Running migration to version 1.0');
      // Migration logic...
      return data;
    }
  },
  {
    version: '2.0',
    migrate: (data) => {
      console.log('Running migration to version 2.0');
      
      // Start with a clean slate but preserve existing data
      const migratedData = {
        version: '2.0',
        lastUpdated: new Date().toISOString(),
        subjects: [],
        topics: [],
        cards: []
      };
      
      // Extract subjects, topics, and cards from old format
      // ... migration logic
      
      return migratedData;
    }
  }
];

export function migrateData(data) {
  // Check if data needs migration
  if (!data) return createEmptyData();
  if (!data.version) {
    // Legacy data without version
    return migrateFromLegacy(data);
  }
  
  // Find migrations needed
  const currentVersion = data.version;
  const neededMigrations = migrations.filter(m => 
    compareVersions(m.version, currentVersion) > 0
  ).sort((a, b) => compareVersions(a.version, b.version));
  
  // Apply migrations in sequence
  let migratedData = { ...data };
  for (const migration of neededMigrations) {
    console.log(`Migrating from ${migratedData.version} to ${migration.version}`);
    migratedData = migration.migrate(migratedData);
    migratedData.version = migration.version;
  }
  
  return migratedData;
}
