# Unified Data Model Implementation

## Problem
The application was previously using two separate fields as sources of truth:
- `field_2979` for card bank data
- `field_3011` for topic lists

This separation caused synchronization issues and made it difficult to maintain proper relationships between topics and cards.

## Solution
We've implemented a unified data model approach where:

1. `field_2979` becomes the single source of truth containing both:
   - Topic shells (structured topic objects with metadata)
   - Cards (with references to their parent topic)

2. `field_3011` is maintained for backward compatibility, but is no longer the primary source for topic data.

## Implementation Details

### 1. UnifiedDataService
This service (already implemented) provides core functionality for working with the unified data model:

- `saveTopicShells()`: Save topic objects to field_2979
- `addCardsToTopic()`: Add cards to field_2979 and link them to a topic
- `getTopics()`: Retrieve topics from field_2979
- `getCardsForTopic()`: Get cards for a specific topic
- `moveCardsBetweenTopics()`: Move cards from one topic to another

### 2. EnhancedTopicPersistenceService
New bridge service that ensures topics are saved both to:
- `field_3011` (for backward compatibility)
- `field_2979` (as topic shells in the unified model)

### 3. Component Updates
Updated the following components to use the unified approach:
- `TopicListSyncManager`: Uses EnhancedTopicPersistenceService to save topics to both places
- `AICardGenerator`: Updates topic persistence to create topic shells in field_2979

## Topic Shells
Topic shells are empty containers in field_2979 that represent topics. They have:
- Unique ID
- Type: "topic"
- Metadata (subject, exam type, etc.)
- Empty cards array (initially)
- Visual state (isShell: true, isEmpty: true)

When cards are created and linked to a topic, they reference the topic's ID, and the topic shell's `cards` array is updated to include the card IDs.

## Usage Flow
1. User creates topics (saved to both field_3011 and field_2979 as topic shells)
2. User creates cards for a topic (saved to field_2979 with references to the topic)
3. When viewing/querying topic data, the system now gets it from field_2979

## Benefits
- Single source of truth for both topics and cards
- Direct relationship between topics and cards
- Easier synchronization and data integrity
- Backward compatibility with existing code
