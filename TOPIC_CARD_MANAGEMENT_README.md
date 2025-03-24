# VESPA Flashcards: Unified Data Model

This document outlines the new single source of truth architecture for managing both topics and flashcards in the VESPA Flashcards application. The implementation consolidates data storage into `field_2979` while maintaining backward compatibility with the previous architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       field_2979 (Card Bank)                    │
├─────────────────────────────────┬───────────────────────────────┤
│ Topic Shells                    │ Flashcards                    │
│ ┌───────────────────────────┐   │ ┌───────────────────────────┐ │
│ │ {                         │   │ │ {                         │ │
│ │   "id": "topic_123",      │   │ │   "id": "card_456",       │ │
│ │   "type": "topic",        │   │ │   "type": "card",         │ │
│ │   "name": "Momentum",     │   │ │   "topicId": "topic_123", │ │
│ │   "subject": "Physics",   │   │ │   "topic": "Momentum",    │ │
│ │   "examBoard": "AQA",     │   │ │   "subject": "Physics",   │ │
│ │   "examType": "A-Level",  │   │ │   "front": "...",         │ │
│ │   "cards": ["card_456"]   │   │ │   "back": "..."          │ │
│ │ }                         │   │ │ }                         │ │
│ └───────────────────────────┘   │ └───────────────────────────┘ │
└─────────────────────────────────┴───────────────────────────────┘

┌─────────────────────────────────┐   ┌─────────────────────────────┐
│ field_3011 (Topic Lists)        │   │ field_2986 (Box 1)          │
│ - Retains topic lists           │   │ - Retains card IDs for      │
│ - For backward compatibility    │   │   spaced repetition         │
└─────────────────────────────────┘   └─────────────────────────────┘
```

### Key Components

#### 1. UnifiedDataService.js
Provides central services for managing both topic shells and flashcards in `field_2979`.

#### 2. TopicPersistenceService.js
Ensures backward compatibility by saving topics to both:
- `field_3011` (for reference)
- Creating topic shells in `field_2979` (the new source of truth)

#### 3. knack-message-handler.js
Handles browser-to-Knack communication, supporting the new unified model:
- Adds `type` field to distinguish between topics and cards
- Supports the `topicId` parameter to associate cards with topics
- Updates topic shells' `cards` array when adding cards

## Data Structure

### Topic Shell Object

```javascript
{
  "id": "topic_1234567890",
  "type": "topic",                  // Identifies this as a topic
  "name": "Quantum Mechanics",      // Topic name
  "subject": "Physics",
  "examBoard": "AQA",
  "examType": "A-Level",
  "color": "#3cb44b",               // For UI display purposes
  "cards": ["card_123", "card_456"], // References to cards in this topic
  "isShell": true,                  // Identifies this as a topic shell
  "created": "2025-03-24T10:30:00Z",
  "updated": "2025-03-24T10:30:00Z"
}
```

### Card Object

```javascript
{
  "id": "card_1234567890",
  "type": "card",                   // Identifies this as a card
  "topicId": "topic_1234567890",    // Reference to parent topic
  "subject": "Physics",
  "topic": "Quantum Mechanics",      
  "examBoard": "AQA",
  "examType": "A-Level",
  "questionType": "multiple_choice",
  "front": "What is Schrödinger's equation?",
  "back": "Description of wave function...",
  "cardColor": "#3cb44b",           // Inherits color from topic
  "boxNum": 1,                      // For spaced repetition
  "created": "2025-03-24T11:15:00Z",
  "updated": "2025-03-24T11:15:00Z",
  "lastReviewed": "2025-03-24T11:15:00Z",
  "nextReviewDate": "2025-03-25T11:15:00Z"
}
```

## Process Flow

### 1. Topic Creation

The user creates a topic list through the Topic Hub. This triggers:
1. Saving to `field_3011` (backward compatibility)
2. Creating topic shells in `field_2979` (single source of truth)

```javascript
// Flow for Topic Creation
TopicHub → saveTopicList → TopicPersistenceService.saveTopicLists
    → Creates topic list in field_3011
    → Creates topic shells in field_2979 via UnifiedDataService
```

### 2. Card Creation & Association

When the user creates cards for a specific topic:
1. Cards are created with references to the parent topic (`topicId`)
2. The topic shell's `cards` array is updated with the new card IDs
3. Box 1 references are created for the spaced repetition system

```javascript
// Flow for Card Creation
AICardGenerator → handleAddCard → knack-message-handler → ADD_TO_BANK
    → Adds card to field_2979 with topicId reference
    → Updates topic shell's cards array
    → Adds card reference to field_2986 (Box 1)
```

## Accessing Data

To work with this unified model:

1. To get all topics:
```javascript
const topics = await UnifiedDataService.getTopics(userId, auth);
```

2. To get cards for a specific topic:
```javascript
const cards = await UnifiedDataService.getCardsForTopic(topicId, userId, auth);
```

3. To move cards between topics:
```javascript
await UnifiedDataService.moveCardsBetweenTopics(
  cardIds, sourceTopicId, targetTopicId, userId, auth
);
```

## Benefits of the New Architecture

1. **Single Source of Truth**: Both topics and cards live in `field_2979`
2. **Stronger Relationships**: Direct parent-child relationships between topics and cards
3. **Better Organization**: Clear structure to find cards by topic
4. **Backward Compatibility**: Continues to support existing systems through `field_3011`
5. **Improved UI Experience**: Easier to create consistent UIs with properly linked data
