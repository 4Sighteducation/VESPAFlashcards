# Spaced Repetition System - VespaFlashcards App

This document outlines the workings, dependencies, and identified issues related to the Spaced Repetition feature in the VespaFlashcards application.

## 1. Overview of the Spaced Repetition Process

The spaced repetition system is designed to help users review flashcards at optimal intervals to improve memory retention. It uses a Leitner box system, where cards move between boxes based on whether the user answers them correctly or incorrectly.

- **Boxes:** There are 5 boxes.
    - **Box 1:** Cards answered incorrectly are moved here. Cards in Box 1 are typically reviewed daily.
    - **Boxes 2-5:** Cards answered correctly move to the next higher box. The review interval increases with each box (e.g., Box 2 every 2 days, Box 3 every 3 days, Box 4 weekly, Box 5 every 4 weeks).
- **Review Session:** Users select a box to review. They can then choose to review all cards in that box or filter by subject and/or topic.
- **Card State:** Each card has properties like `boxNum`, `lastReviewed`, `nextReviewDate`, and `isReviewable` to manage its state within the system.

## 2. Core Components and File Interactions

The spaced repetition feature involves several key components interacting with each other:

*   **`App.js` (Main Application Logic):**
    *   **State Management:** Holds the master state for `allCards`, `spacedRepetitionData` (which tracks card IDs and review dates per box), `subjectColorMapping`, `userTopics`, `topicLists`, etc.
    *   **Data Persistence:** Handles saving all data to local storage and, if applicable (when `isKnack` is true), to the Knack backend via `copyofknackbridgingfile.js` (through `SaveQueueService`).
    *   **`moveCardToBox(cardId, box, nextReviewDateParam)` function:** This is the central function for updating a card's box, `lastReviewed` date, `nextReviewDate`, and `isReviewable` status. It updates both `allCards` and `spacedRepetitionData`.
    *   **`getCardsForCurrentBox()` function:** Prepares the list of cards to be reviewed for a selected box by filtering `allCards` based on IDs in `spacedRepetitionData` for that box and checking their `isReviewable` status and `nextReviewDate`.
    *   **Communication:** Sends data to and receives messages from the Knack backend (via `copyofknackbridgingfile.js`) for loading and saving user data when running in an iframe.

*   **`SpacedRepetition.jsx` (UI for Spaced Repetition View):**
    *   **Display:** Renders the box selection interface, subject/topic lists within the current box, and the card review modal.
    *   **Session Management:**
        *   Receives the `cards` prop (from `App.js`'s `getCardsForCurrentBox`) which are the cards potentially reviewable in the selected box.
        *   `prepareStudySessionCards()`: Filters these cards further based on user's subject/topic selection for the *current study session*.
        *   Manages `currentIndex` for navigating through the `currentCards` in a study session.
        *   Handles user interactions like selecting a box, starting a review session for a subject/topic.
    *   **`calculateNextReviewDate(boxNumber)` function:** Determines the next review date based on the target box.
    *   **`onMoveCard(cardId, box, newNextReviewDate)` prop:** Calls this function (passed from `App.js`) when a card is answered correctly or incorrectly, providing the card ID, target box, and the *newly calculated next review date*.
    *   **`useEffect` hook (watching `cards`, `selectedSubject`, `selectedTopic`):** Updates the `currentCards` for the active study session. Critically, this hook also adjusts `currentIndex` and `studyCompleted` status based on the (potentially shrinking) list of reviewable cards.

*   **`FlippableCard.jsx` (Individual Card Display):**
    *   **Rendering:** Displays the front (question) and back (answer) of a flashcard.
    *   **Interaction:** Handles card flips and, for multiple-choice questions, option selection.
    *   **`onAnswer(isCorrect, selectedOptionIndex)` prop:** Called when a multiple-choice option is selected, passing the correctness to `SpacedRepetition.jsx`.

*   **`copyofknackbridgingfile.js` (Knack Backend Integration):**
    *   **`SaveQueueService`:** Manages a queue for saving data to Knack to prevent race conditions and handle retries.
    *   **Data Mapping:** Contains `FIELD_MAPPING` to map app data fields to Knack object fields.
    *   **API Calls:** Makes AJAX calls to the Knack API for loading user data (`loadFlashcardUserData`) and saving data (via `SaveQueue` which calls `performSave`).
    *   **Message Handling:** Listens for messages from the React app (e.g., `SAVE_DATA`, `REQUEST_UPDATED_DATA`) and sends responses/data back.

## 3. Key Data Flow and Interactions for Spaced Repetition

1.  **Loading Data:**
    *   `App.js` loads initial data from local storage or Knack (via `copyofknackbridgingfile.js`).
    *   `spacedRepetitionData` (e.g., `box1: [{cardId: 'xyz', nextReviewDate: '...'}, ...]`) and `allCards` (containing full card objects with `boxNum`, `isReviewable`, etc.) are populated.

2.  **Starting a Review Session (`SpacedRepetition.jsx`):**
    *   User selects a box (`currentBox` state in `App.js` updated).
    *   `App.js` calls `getCardsForCurrentBox()`, which filters `allCards` based on `spacedRepetitionData` for that box and the `isReviewable` status of each card. This list is passed as the `cards` prop to `SpacedRepetition.jsx`.
    *   User may further filter by subject/topic. `SpacedRepetition.jsx` uses `prepareStudySessionCards()` to get `currentCards` for the active session.
    *   `currentIndex` is set to `0`.

3.  **Reviewing a Card (`SpacedRepetition.jsx` & `FlippableCard.jsx`):**
    *   `FlippableCard` displays `currentCards[currentIndex]`.
    *   User flips card. For MCQs, user selects an option. `FlippableCard` calls `onAnswer`.
    *   `SpacedRepetition.jsx` (`handleMcqAnswer`, `handleCorrectAnswer`, `handleIncorrectAnswer`):
        *   Determines correctness.
        *   Calculates the `nextBoxNumber` and the `newNextReviewDate`.
        *   Calls `onMoveCard(cardId, nextBoxNumber, newNextReviewDate)`.

4.  **Moving a Card (`App.js`):**
    *   `moveCardToBox(cardId, box, nextReviewDateParam)` is called:
        *   Updates the specific card in `allCards` state: sets new `boxNum`, `lastReviewed`, `nextReviewDate` (from `nextReviewDateParam`), and importantly, `isReviewable` (based on whether `nextReviewDateParam` is today or in the past).
        *   Updates `spacedRepetitionData`: removes card ID from old box array, adds `{cardId, lastReviewed, nextReviewDate}` to new box array.
        *   Triggers a save operation (via `saveData` which uses `SaveQueueService`).

5.  **Updating the Session (`SpacedRepetition.jsx`):**
    *   The change in the `cards` prop (from `App.js`, which reflects the updated `allCards` and `isReviewable` states) triggers the main `useEffect` in `SpacedRepetition.jsx`.
    *   `currentCards` is re-calculated by `prepareStudySessionCards()`. Since the just-answered card is now (ideally) `isReviewable: false` for the current session, it's filtered out.
    *   The `useEffect` adjusts `currentIndex` if needed (e.g., if the last card was removed, `currentIndex` might point beyond the new list length). This effectively moves to the "next" available card.
    *   If `currentCards` becomes empty, `studyCompleted` is set.

## 4. Identified Issues and Fixes/Proposals

*   **Issue 1: Cards not disappearing / Incorrect `isReviewable` status.**
    *   **Root Cause:** `App.js`'s `moveCardToBox` was not correctly calculating or using the `nextReviewDate` when updating the card's `isReviewable` status, especially for cards staying in Box 1. It relied on an internal `calculateNextReviewDate` which was not properly defined or accessible in its immediate scope, leading to potentially undefined `nextReviewDate` values.
    *   **Fix Implemented:**
        *   Modified `SpacedRepetition.jsx` (`handleCorrectAnswer`, `handleIncorrectAnswer`) to calculate `newNextReviewDate` using its local `calculateNextReviewDate` function and pass this new date as a third argument to the `onMoveCard` prop.
        *   Updated `App.js`'s `moveCardToBox` to accept `nextReviewDateParam` and use this parameter directly to set the card's `nextReviewDate` and correctly derive its `isReviewable` status.

*   **Issue 2: Erratic slideshow / Always returning to the first card.**
    *   **Root Cause:** Likely due to `currentIndex` management in `SpacedRepetition.jsx`. If `currentIndex` was a dependency in the `useEffect` that updates `currentCards`, it could cause infinite loops or undesired resets. Also, `currentIndex` might not have been explicitly reset to `0` when starting a new filtered session.
    *   **Fix Implemented:**
        *   Removed `currentIndex` from the dependency array of the main `useEffect` in `SpacedRepetition.jsx` that sets `currentCards`.
        *   Ensured `currentIndex` is set to `0` in `reviewSubject` and `reviewTopic` when a new study session is initiated.
        *   Ensured `resetSelectionState()` is called from within the main `useEffect` (when `sessionCards` changes) to correctly reset flip states for the newly displayed card.

*   **Issue 3: Cards not moving up to the next box after a session.**
    *   **Root Cause:** Primarily linked to Issue 1. If `isReviewable` was not correctly set to `false` after a card was answered, `getCardsForCurrentBox` in `App.js` might still include it in the "reviewable" list for the current box, even if `spacedRepetitionData` in `App.js` might have correctly moved the *ID* to the next box's array. The visual representation relied heavily on `allCards[cardIndex].isReviewable`.
    *   **Fix Implemented:** The fix for Issue 1 is the primary solution here. Correctly updating `isReviewable` and `nextReviewDate` in `allCards` ensures that `getCardsForCurrentBox` provides an accurate list of *actually reviewable* cards for `SpacedRepetition.jsx`.

## 5. Data Structures (Simplified)

*   **`allCards` (in `App.js` state):**
    ```javascript
    [
      {
        id: "card_1",
        question: "...",
        answer: "...",
        boxNum: 1,
        lastReviewed: "ISO_date_string",
        nextReviewDate: "ISO_date_string",
        isReviewable: true/false,
        // ... other card properties
      },
      // ... more cards
    ]
    ```

*   **`spacedRepetitionData` (in `App.js` state):**
    ```javascript
    {
      box1: [{cardId: "card_1", lastReviewed: "...", nextReviewDate: "..."}, ...],
      box2: [{cardId: "card_2", lastReviewed: "...", nextReviewDate: "..."}, ...],
      // ... box3, box4, box5
    }
    ```

*   **`currentCards` (in `SpacedRepetition.jsx` state):**
    *   A filtered subset of `allCards` (via the `cards` prop from `App.js`) that are relevant to the current box and active study session (subject/topic filters applied) AND are currently reviewable.

## 6. Further Considerations

*   **State Synchronization:** The delay (`setTimeout`) before `saveData` calls is a workaround. A more robust solution might involve a state management library or more sophisticated effect management to ensure saves happen after all state updates are fully processed and reflected.
*   **Error Handling:** Ensure robust error handling for API calls and data parsing in `copyofknackbridgingfile.js` and `App.js`.
*   **Knack Data Encoding/Decoding:** The `safeDecodeURIComponent` and `safeParseJSON` functions in `copyofknackbridgingfile.js` are crucial for handling potentially malformed data from Knack. Ensuring these are robust is key.
*   **`ensureRecordId` in `App.js`:** This function is important for recovering the Knack `recordId` if it's lost, which is critical for saving data when in Knack mode.

This summary should provide a good overview for future debugging and development of the spaced repetition feature.
