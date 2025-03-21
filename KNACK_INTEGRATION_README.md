# Knack Integration Script Documentation

## Overview
This script provides integration between the VESPA Flashcards application and the Knack database platform. It handles communication between the embedded React app and the Knack backend, including user authentication, data retrieval, and data saving.

## Recent Updates (March 2025)

### 1. Fixed Data Preservation Issue
- **Problem:** When saving topic lists, other data fields (card bank, color mapping, study boxes) were being wiped out
- **Solution:** Added new `handlePreserveFieldsDataSave` function that only updates specific fields (topic lists and metadata) while preserving all other fields

### 2. Enhanced "Add to Bank" Functionality 
- **Problem:** Cards added to Box 1 weren't being simultaneously added to the card bank (field_2979)
- **Solution:** Added new `handleAddToBank` function that adds cards to both the card bank and Box 1 in a single operation

### 3. Enhanced Message Handler
- Added support for detecting new message types
- Added special handling for messages with `preserveFields` flag

## Key Components

### Field Mappings
The script uses these field mappings to interact with Knack:
- `field_2979`: Card Bank JSON Store
- `field_2986`: Box 1 JSON (study box)
- `field_3000`: Color Mapping
- `field_3011`: Topic Lists JSON
- `field_3030`: Topic Metadata JSON

### New Functions

#### `handlePreserveFieldsDataSave(userId, data, callback)`
This function saves topic list data while preserving all other fields:
- Takes a user ID, message data, and a callback function
- Only updates the topic lists and topic metadata fields
- Leaves all other fields intact in the database

#### `handleAddToBank(userId, data, callback)`
This function adds cards to both the card bank and Box 1:
- Takes a user ID, message data with cards, and a callback function
- Retrieves existing card bank and Box 1 data
- Adds new cards to both locations
- Saves the combined data back to Knack

## Implementation Instructions

1. Replace the existing Knack integration script with this updated version
2. Update the TopicListModal.jsx component to use the `preserveFields` flag:
   ```javascript
   window.parent.postMessage({
     type: 'SAVE_DATA',
     data: {
       recordId: recordId,
       topicLists: updatedTopicLists,
       topicMetadata: updatedMetadata,
       preserveFields: true,
       completeData: completeUserData
     }
   }, '*');
   ```

3. Verify that "Add to Bank" operations now properly update both the card bank and Box 1

## Testing

After implementation, verify:
1. Saving topic lists preserves cards in the card bank
2. Saving topic lists preserves color mapping
3. Saving topic lists preserves the content of all study boxes
4. Adding cards to the bank adds them to both the card bank and Box 1

## Troubleshooting

If issues persist:
- Check browser console for error messages
- Verify proper message format is being sent from React app
- Ensure Knack record ID is correctly retrieved and passed
