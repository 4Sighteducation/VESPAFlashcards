# Flashcard Generator Update

This update resolves the React error #301 and introduces a more reliable flashcard generation system with a simpler, more focused UI. The updates include:

## New Components

1. **FlippableCard.jsx** - A simplified flashcard component that handles front/back flipping
2. **FlashcardSlideshowModal.jsx** - A modal component that displays flashcards in a slideshow format
3. **FlashcardGenerator.jsx** - A simplified generator UI that replaces the complex AICardGenerator
4. **CardService.js** - A service for handling card generation and processing

## Integration Instructions

### 1. Replace AICardGenerator with FlashcardGenerator

Find where you're currently using `AICardGenerator` and replace with `FlashcardGenerator`:

```jsx
// Old code
<AICardGenerator 
  initialSubject={subject}
  initialTopic={topic}
  examBoard={examBoard}
  examType={examType}
  skipMetadataSteps={true}
  // ... other props
/>

// New code
<FlashcardGenerator
  isOpen={true}
  onClose={handleClose}
  onSaveCards={handleSaveCards}
  topicId={topicId}
  topicName={topic}
  subject={subject}
  examType={examType}
  examBoard={examBoard}
  topicColor={topicColor}
/>
```

### 2. Add FlashcardSlideshowModal for Viewing Cards

In your topic component or wherever you're showing cards, use the new `FlashcardSlideshowModal`:

```jsx
const [showSlideshow, setShowSlideshow] = useState(false);
const [topicCards, setTopicCards] = useState([]);

// Later in your JSX:
{showSlideshow && (
  <FlashcardSlideshowModal
    cards={topicCards}
    topicName={topic.name}
    isOpen={showSlideshow}
    onClose={() => setShowSlideshow(false)}
    onUpdateCard={handleUpdateCard}
    mode="bank" // or "review"
    topicColor={topic.color}
  />
)}

// Button to open slideshow
<button onClick={() => setShowSlideshow(true)}>
  View Cards
</button>
```

### 3. Using the CardService

The `CardService` can be used anywhere you need to interact with cards:

```js
import CardService from '../services/CardService';

// Generate cards
const cards = await CardService.generateCards({
  subject: 'Physics',
  topic: 'Mechanics',
  examType: 'A-Level',
  examBoard: 'AQA',
  questionType: 'multiple_choice',
  numCards: 5,
  topicId: 'topic_123',
  topicColor: '#3cb44b'
});

// Process existing cards with metadata
const processedCards = CardService.processCards(rawCards, {
  topicId: 'topic_123',
  topicName: 'Mechanics',
  subject: 'Physics',
  examType: 'A-Level',
  examBoard: 'AQA',
  cardColor: '#3cb44b'
});

// Update card box status (Leitner system)
const updatedCard = CardService.updateCardBoxStatus(card, true); // Correct answer
const updatedCard = CardService.updateCardBoxStatus(card, false); // Incorrect answer
```

## Leitner System Implementation

The new components fully implement the Leitner spaced repetition system:

- Cards are assigned to box 1 when created
- When reviewing, correct answers move cards up one box (max box 5)
- Incorrect answers move cards back to box 1
- Box determines review schedule:
  - Box 1: Review daily
  - Box 2: Review every other day
  - Box 3: Review every 3 days
  - Box 4: Review weekly
  - Box 5: Review monthly

## Mobile Optimization

All components are fully mobile-optimized:
- Responsive layouts
- Touch-friendly buttons and controls
- Proper handling of portrait and landscape orientations
- Optimized text sizing for small screens

## Troubleshooting

If you encounter issues:

1. Check browser console for errors
2. Verify your API endpoints are correct in CardService.js
3. Ensure you're passing all required props to FlashcardGenerator
4. Check that the card data structure is compatible with FlippableCard

## Contributing

To extend this implementation:

1. Follow the component structure and separation of concerns
2. Use CardService for all card data manipulation
3. Keep UI components focused on specific tasks
4. Test on both desktop and mobile 