# Topic Persistence in VESPA Flashcards

This document outlines the implementation of topic list persistence in the VESPA Flashcards application, explaining how topic lists are saved and retrieved between the React app and Knack.

## Overview

Topic lists are stored in Knack field_3011, which serves as the "single source of truth" for topic data. The persistence mechanism involves several components:

1. **Local storage caching** - For temporary storage during editing and protection against page refreshes
2. **Field-preserving Knack API updates** - To avoid overwriting other data fields
3. **Centralized persistence service** - To ensure consistent saving from all app components

## Persistence Flow

```
┌─────────────────┐       ┌────────────────────┐       ┌─────────────────┐
│  React UI       │       │ TopicPersistence   │       │ Knack API       │
│  Components     │ ───▶  │ Service            │ ───▶  │ (field_3011)    │
└─────────────────┘       └────────────────────┘       └─────────────────┘
       ▲                         │      ▲                      │
       │                         ▼      │                      │
       │                  ┌─────────────────┐                  │
       └──────────────── │ Local Storage    │ ◀────────────── ┘
                         └─────────────────┘
```

## Key Components

### 1. TopicPersistenceService.js

Acts as a centralized service for all topic list operations:

- Provides a consistent API for saving and loading topic lists
- Handles field preservation to avoid overwriting other data
- Implements error handling and retry mechanisms
- Ensures data integrity through validation

### 2. TopicListSyncManager.jsx

Coordinates topic list synchronization between the UI and Knack:

- Manages topic list state for the UI
- Uses the TopicPersistenceService for saving
- Handles local storage caching for protection against refreshes

### 3. Knack Integration (KnackJavascript2.js)

The Knack side script that:

- Handles postMessage communication with the React app
- Provides field preservation when saving topics
- Implements verification to ensure saves were successful
- Validates topic list structure

## Common Persistence Issues & Solutions

### 1. Topic Lists Not Saving to field_3011

If topics are only persisting in local storage but not in field_3011:

- Check that the handleTopicListSave in TopicListSyncManager is completing successfully
- Verify the postMessage communication is working between the iframe and parent window
- Ensure the preserveFields flag is set to true when saving topic data
- Check that completeData is being passed correctly to preserve other fields

### 2. Lost Data After Refresh

If topic data disappears after refreshing:

- Verify the local storage caching mechanism is working
- Check if LocalStorage has any storage limits or permission issues
- Look for errors in the setupPageUnloadProtection function

### 3. Debugging Persistence Issues

To diagnose persistence problems:

- Check browser console for error messages
- Look for "Verification failed" messages in KnackJavascript2.js logs
- Verify the structure of the topic lists being saved matches the expected format
- Check if the topic lists are large enough to potentially hit size limits

## Implementation Details

### Topic List Structure

```json
[
  {
    "id": "list_1234567890",
    "subject": "Mathematics",
    "examBoard": "AQA",
    "examType": "A-Level",
    "topics": [
      {
        "id": "topic_1234567890",
        "name": "Calculus"
      }
    ],
    "lastUpdated": "2025-03-22T10:30:00Z"
  }
]
```

### Field Preservation Approach

When saving topic lists to Knack, we must preserve other fields to avoid data loss:

1. Get complete user data from Knack
2. Extract existing fields (cards, box data, etc.)
3. Update only the topic list data (field_3011)
4. Save back to Knack, preserving all other fields

### Verification Mechanism

After saving, the system:

1. Waits 5 seconds to ensure data is committed
2. Retrieves the record to verify topic lists were saved
3. Validates the structure of the retrieved topic lists
4. Attempts to fix malformed data if detected
