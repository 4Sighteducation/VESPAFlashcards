# Data Persistence Fix for Topic Shells and Cards

## Issue Summary

The app was experiencing data loss issues where topic shells would disappear when adding cards to the bank. This happened because:

1. Multiple save paths (normal save, preserveFields, add to bank) were not preserving the type-based structure
2. Card data was being saved without proper separation between topic shells and cards
3. The data in field_2979 was being overwritten completely rather than merged by type

## Implemented Fixes

### 1. KnackJavascript4.js Changes
- Added `getSyncService` helper function to manage type handling
- Implemented type-based splitting in `handleAddToBank` and `saveFlashcardUserData`
- Ensured topic shells are preserved by merging them back into final data

### 2. knack-message-handler.js Changes
- Added `getTopicCardSyncService` helper function
- Implemented type-based data preservation in `addCardsToCardBank` 
- Fixed `addCardsToTopicFallback` to properly split and merge topics and cards

### 3. Improved Data Structure
- Ensured all items have proper `type` property ('topic' or 'card')
- Maintained proper relationship between topics and cards
- Preserved both field_3011 (topic lists) and field_2979 (card bank with topic shells)

## Core Pattern Used

The solution implements a consistent split-and-merge pattern across all data saving paths:

```javascript
// 1. Split items by type to preserve topic shells
const topicShells = existingItems.filter(item => item.type === 'topic');
const existingCards = existingItems.filter(item => item.type !== 'topic');

// 2. Process cards as needed
const updatedCards = [...existingCards, ...processedCards];

// 3. Create final data by combining topic shells and cards
const finalBankData = [...topicShells, ...updatedCards];
```

This ensures topic shells are always preserved regardless of which save path is triggered.
