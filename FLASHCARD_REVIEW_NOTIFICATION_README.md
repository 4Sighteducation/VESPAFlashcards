# Flashcard App - Reviewable Cards Notification Guide

This document outlines how to determine if a user has flashcards due for review in the Vespa Flashcards application by querying specific fields in the Knack database. This information can be used by a landing page application to display a notification icon, indicating to the user that they have cards ready for study.

## 1. Overview

The Vespa Flashcards application uses Knack to store user data, including information about spaced repetition boxes. Each user has a dedicated record in a Knack object (referred to as `object_102` in the flashcard app's integration code). Within this record, specific boolean fields indicate whether any cards are due for review in each of the five spaced repetition boxes.

## 2. Knack Object and Fields

*   **Main User Flashcard Data Object:** `object_102`
    *   This object stores the primary flashcard data for each user. Each record is linked to a user.
*   **User Identifier Field:** `field_2954` (within `object_102`)
    *   This field in `object_102` stores the Knack record ID of the user from the main User object (e.g., `object_3`). This is used to find the specific user's flashcard data record.
*   **Review Notification Boolean Fields (within `object_102`):**
    *   **Box 1 Ready for Review:** `field_2991` (Boolean: Yes/No or True/False)
    *   **Box 2 Ready for Review:** `field_2992` (Boolean: Yes/No or True/False)
    *   **Box 3 Ready for Review:** `field_2993` (Boolean: Yes/No or True/False)
    *   **Box 4 Ready for Review:** `field_2994` (Boolean: Yes/No or True/False)
    *   **Box 5 Ready for Review:** `field_2995` (Boolean: Yes/No or True/False)

    The flashcard application itself updates these boolean fields. If any of these fields are `true` (or "Yes"), it means there is at least one card in the corresponding box that is due for review for that user.

## 3. How to Check for Reviewable Cards

To determine if a notification should be shown for a given user, the landing page application (or its backend) needs to:

1.  **Identify the User:** Obtain the logged-in user's Knack record ID (from the main User object, e.g., `object_3`).
2.  **Query `object_102`:**
    *   Perform a GET request to the Knack API for records in `object_102`.
    *   Filter these records where `field_2954` (the user identifier field in `object_102`) matches the logged-in user's Knack record ID. This should ideally return one record.
3.  **Inspect Notification Fields:**
    *   Once the user's specific record in `object_102` is retrieved, check the values of the boolean fields: `field_2991`, `field_2992`, `field_2993`, `field_2994`, and `field_2995`.
4.  **Determine Notification Status:**
    *   If **any** of these five fields (`field_2991` through `field_2995`) are `true` (or the Knack equivalent, e.g., "Yes"), then the user has cards due for review, and the notification icon should be displayed on the landing page.
    *   If **all** of these fields are `false` (or "No"), then no cards are currently due for review, and the notification icon should not be displayed.

## 4. Example API Call Structure (Conceptual)

This is a conceptual example of how you might query Knack. The exact implementation will depend on the landing page's backend language and Knack API library used.

**Assumptions:**
*   `USER_KNACK_ID`: The Knack record ID of the logged-in user.
*   `YOUR_KNACK_APP_ID`: Your Knack Application ID.
*   `YOUR_KNACK_API_KEY`: Your Knack REST API Key.

**Endpoint:**
`GET https://api.knack.com/v1/objects/object_102/records`

**Headers:**
*   `X-Knack-Application-Id: YOUR_KNACK_APP_ID`
*   `X-Knack-REST-API-Key: YOUR_KNACK_API_KEY`
*   `Authorization: KNACK_USER_TOKEN` (if user-context specific, otherwise API key might suffice for read if permissions allow)

**Query Parameters (Filters):**
```json
{
  "match": "and",
  "rules": [
    {
      "field": "field_2954",
      "operator": "is",
      "value": "USER_KNACK_ID"
    }
  ]
}
```
This filter should be URL-encoded and passed as a `filters` query parameter.

**Expected Response (Simplified):**
If a record is found, the response will contain an array of records. You'll typically expect one record.
```json
{
  "records": [
    {
      "id": "RECORD_ID_IN_OBJECT_102",
      "field_2954": "USER_KNACK_ID",
      // ... other fields ...
      "field_2991": true,  // Example: Box 1 has reviewable cards
      "field_2992": false,
      "field_2993": false,
      "field_2994": true,  // Example: Box 4 has reviewable cards
      "field_2995": false
      // ... other fields ...
    }
  ]
}
```

**Logic in Landing Page Backend:**
```javascript
// Pseudocode
function hasReviewableFlashcards(userKnackDataFromObject102) {
  if (!userKnackDataFromObject102) {
    return false;
  }
  return userKnackDataFromObject102.field_2991 ||
         userKnackDataFromObject102.field_2992 ||
         userKnackDataFromObject102.field_2993 ||
         userKnackDataFromObject102.field_2994 ||
         userKnackDataFromObject102.field_2995;
}

// Fetch data for the user from object_102
// const userData = fetchUserDataFromKnack(USER_KNACK_ID, "object_102", filter_on_field_2954);
// if (userData && userData.records.length > 0) {
//   const flashcardDataRecord = userData.records[0];
//   if (hasReviewableFlashcards(flashcardDataRecord)) {
//     // Show notification icon
//   } else {
//     // Hide notification icon
//   }
// }
```

## 5. Important Considerations

*   **API Rate Limits:** Be mindful of Knack API rate limits if this check is performed frequently. Consider caching the result for a short period on the landing page backend if appropriate.
*   **Permissions:** Ensure the API key used has the necessary read permissions for `object_102`.
*   **Data Synchronization:** The boolean fields (`field_2991` to `field_2995`) are updated by the flashcard application itself. There might be a slight delay between when a card becomes reviewable within the app and when these fields are updated in Knack, depending on the app's save queue and Knack's processing time. The notification is therefore based on the last known synchronized state.
*   **Error Handling:** Implement robust error handling for API calls (e.g., user not found, API errors).

This guide should provide the necessary information for the landing page AI to integrate the reviewable cards notification.
