# Topic-Card Relationship Management

This document describes the enhanced topic-card relationship management system implemented in the VESPA Flashcards application. The system ensures proper synchronization between topics and their associated cards, with advanced features for card management when topics are deleted or modified.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Topic Lists    │◄────┤ Topic Buttons   │◄────┤   Card Bank     │
│  (field_3011)   │     │    Modal        │     │  (field_2979)   │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │                 │              │
         └──────────────┤ Topic-Card Sync ├──────────────┘
                        │    Service      │
                        │                 │
                        └────────┬────────┘
                                 │
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │ Spaced Rep Sys  │
                        │(field_2986-2990)│
                        │                 │
                        └─────────────────┘
```

## Key Components

### 1. TopicCardSyncService
Central service that manages the relationship between topics and cards. Provides:
- Card lookup by topic
- Orphaned card deletion
- Card reassignment between topics
- Card generation and appending for topics

### 2. OrphanedCardsPreview
Component to preview cards that would be deleted when a topic is removed.
- Groups cards by spaced repetition box
- Shows interactive cards with front and back sides
- Provides clear warnings about card deletion

### 3. TopicReassignmentModal
UI for reassigning cards from one topic to another.
- Allows searching for destination topics
- Handles card metadata updates during reassignment
- Preserves card progress in spaced repetition system

### 4. TopicToCardIntegrator
Bridge between topic selection and card generation.
- Uses AICardGenerator with prefilled fields for topic metadata
- Ensures new cards are properly associated with topics
- Appends rather than replaces existing cards

### 5. Enhanced TopicButtonsModal
Improved modal for topic management with:
- Card impact analysis before topic deletion
- Options to view affected cards
- Options to reassign cards to other topics
- Direct card generation from topic buttons

## Data Flow

1. When a user selects a topic in the TopicButtonsModal and clicks the "Generate Cards" icon:
   - The TopicToCardIntegrator opens with prefilled subject, topic & exam metadata
   - AICardGenerator creates cards with the topic metadata
   - TopicCardSyncService appends the new cards to existing ones with the same topic

2. When a user wants to delete a topic:
   - TopicButtonsModal calls verifyTopicHasCards to check for associated cards
   - If cards exist, it shows options to view or reassign cards
   - The user can view cards with OrphanedCardsPreview
   - The user can reassign cards with TopicReassignmentModal
   - If user proceeds with deletion, cleanupDeletedTopic removes all associated cards

3. When a user reassigns cards:
   - TopicReassignmentModal displays all available topics
   - User selects a destination topic
   - reassignCards updates metadata on all affected cards
   - The original topic can be safely deleted without orphaning cards

## Knack Field References

The system interacts with these Knack fields:
- **field_3011** - Topic lists storage
- **field_2979** - Card bank (all flashcards)
- **field_2986** - Spaced repetition Box 1
- **field_2987** - Spaced repetition Box 2
- **field_2988** - Spaced repetition Box 3
- **field_2989** - Spaced repetition Box 4
- **field_2990** - Spaced repetition Box 5
- **field_2957** - Last saved timestamp

## Card-Topic Association

Cards are associated with topics using these metadata fields:
- subject
- topic
- examBoard
- examType

When a topic is deleted, the system:
1. Finds all cards matching the topic's metadata
2. Removes these cards from the card bank (field_2979)
3. Removes these cards from all spaced repetition boxes (fields 2986-2990)

## Using the Components

### Generating Cards from a Topic

```jsx
// Example of generating cards from a topic
import { generateCardsFromTopic } from './AICardGeneratorTopicSync';

// In a component:
const handleGenerateCards = async (topic) => {
  const cards = [/* generated cards */];
  
  const result = await generateCardsFromTopic(topic, cards, userId, auth);
  
  if (result.success) {
    console.log(`Generated ${result.newCardCount} cards for topic ${topic.name}`);
  }
};
```

### Checking for Cards Before Topic Deletion

```jsx
// Example of checking for cards before topic deletion
import { verifyTopicHasCards } from '../services/TopicCardSyncService';

// In a component:
const handleTopicDelete = async (topic) => {
  const result = await verifyTopicHasCards(topic, userId, auth);
  
  if (result.hasCards) {
    // Show options to view or reassign
    showDeleteOptionsDialog(topic, result.count);
  } else {
    // Safe to delete, no cards will be orphaned
    confirmTopicDeletion(topic);
  }
};
```

### Reassigning Cards

```jsx
// Example of reassigning cards
import { reassignCards } from '../services/TopicCardSyncService';

// In a component:
const handleReassignCards = async (cards, targetTopic) => {
  const success = await reassignCards(cards, targetTopic, userId, auth);
  
  if (success) {
    console.log(`Successfully reassigned ${cards.length} cards to ${targetTopic.name}`);
  }
};
```

## Implementation Notes

1. All operations that modify data include proper error handling and retry mechanisms
2. The system preserves all card data (including progress in spaced repetition system) when reassigning
3. When generating cards for an existing topic, new cards are appended rather than replacing existing ones
4. The user interface always shows clear warnings before destructive operations like topic deletion
5. The entire system is tied to the user's authentication state for proper security

## Future Enhancements

Possible future improvements:
1. Card analytics by topic (success rates, difficulty ratings)
2. Topic merging (combining two topics and their cards)
3. Topic prioritization for study planning
4. Topic hierarchies with parent-child relationships
5. Automatic topic suggestions based on card content
