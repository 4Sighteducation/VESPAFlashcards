# Unified Data Model Implementation

This document describes the implementation of a unified data model that consolidates all data into field_2979 as the single source of truth.

## Problem Solved

Previously, the application was using two separate sources of truth:
- `field_2979` - Card bank data storage
- `field_3011` - Topic list storage

This separation caused several issues:
1. Topic names weren't being consistently propagated 
2. Topic shells were being rendered as cards instead of containers
3. When adding cards to the bank, field_2979 was being overwritten, losing topic shells
4. Card-to-topic associations were being lost during save operations

## Solution Overview

We've implemented a comprehensive solution that addresses all these issues:

1. **EnhancedTopicPersistenceService.js**:
   - Fixed topic shell creation to include both `name` and `topic` properties
   - Added proper debugging to track topic shell creation

2. **FlashcardList.jsx**:
   - Updated the component to properly handle items with `type: "topic"`
   - Added special processing to differentiate topic shells from regular cards
   - Implemented two-pass processing to ensure proper organization of data

3. **knack-message-handler.js**:
   - Enhanced the "Add to Bank" function to preserve existing topic shells
   - Improved topic shell updating when adding cards
   - Added comprehensive logging for better diagnostics

## Data Structure

The unified data model uses the following structure in field_2979:

```javascript
[
  // Topic Shells
  {
    "id": "1.1",
    "type": "topic",
    "name": "Biological Molecules", 
    "topic": "Biological Molecules",  // Both name and topic properties
    "subject": "Biology",
    "examBoard": "AQA",
    "examType": "A-Level",
    "color": "#3cb44b",
    "baseColor": "#3cb44b",
    "cards": ["card_id_1", "card_id_2"], // References to cards in this topic
    "isShell": true,
    "isEmpty": false, // False when it has cards
    "created": "2025-03-24T17:17:35.946Z",
    "updated": "2025-03-24T17:17:36.607Z"
  },
  
  // Cards
  {
    "id": "card_id_1",
    "type": "card",
    "question": "What are polysaccharides?",
    "answer": "Complex carbohydrates formed by many monosaccharides joined by glycosidic bonds.",
    "subject": "Biology",
    "topic": "Biological Molecules", // Contains the topic name
    "topicId": "1.1",               // Reference to parent topic
    "examBoard": "AQA",
    "examType": "A-Level",
    "created": "2025-03-24T18:00:00.000Z",
    "updated": "2025-03-24T18:00:00.000Z"
  }
]
```

## How to Test

1. **Create Topic Shells**:
   - Navigate to Topic Hub
   - Generate a list of topics for a subject
   - Save the topics
   - Verify topic shells are created in field_2979 with proper names

2. **Generate and Add Cards**:
   - Select a topic from the list 
   - Generate cards for that topic
   - Click "Add to Bank"
   - Verify:
     - Cards are added to field_2979
     - Cards have proper topic associations (topic name and topicId)
     - Topic shell's cards array is updated with the new card IDs
     - Topic shell's isEmpty is set to false

3. **Verify Display**:
   - Go to the Flashcard view
   - Verify topics are displayed as containers, not as individual cards
   - Verify cards are properly grouped under their topics
   - Verify topic names are displayed correctly

## Sequence of Events

1. Topic shells are created by EnhancedTopicPersistenceService when topics are saved
2. During "Add to Bank", the UnifiedDataService or its fallback adds cards to field_2979 and updates the appropriate topic shell
3. FlashcardList component correctly interprets both topic shells and cards when displaying the data

## Troubleshooting

If you encounter issues:

1. Check the browser console for detailed logging
2. Verify the structure of field_2979 data
3. Ensure topic shells have both `name` and `topic` properties
4. Make sure cards have `topicId` references to their parent topics
5. Check that FlashcardList is properly categorizing items by their `type` property

## Future Improvements

1. Add data integrity validation to ensure topics and cards are properly linked
2. Implement migration utilities to repair any previously corrupted data
3. Add UI elements to manage topic and card relationships
