# VESPA Flashcards Architecture

## Data Flow & State Management

### Core State Objects

1. **Cards/Topic Shells**
   ```typescript
   interface TopicShell {
     id: string;
     type: 'topic';
     name: string;
     subject: string;
     examBoard: string;
     examType: string;
     color: string;
     isShell: true;
     isEmpty: boolean;
     cards: [];
     created: string;
     updated: string;
   }

   interface Card {
     id: string;
     type: 'card';
     subject: string;
     topic: string;
     question: string;
     answer: string;
     cardColor: string;
     subjectColor: string;
     // ... other card fields
   }
   ```

2. **Color Management**
   ```typescript
   interface SubjectColorMapping {
     [subject: string]: {
       base: string;
       topics?: {
         [topicName: string]: string;
       };
     };
   }
   ```

### Save/Load Flow

1. **Save Operations**
   - `saveData(data?: any[], preserveFields?: boolean)` in App.js
   - Triggered by:
     * Topic shell creation
     * Color changes
     * Card updates
   - Flow:
     1. Serialize current state
     2. Save to localStorage (backup)
     3. Send to Knack via postMessage

2. **Load Operations**
   - Initial load from Knack on app start
   - Subsequent loads after login
   - Data validation and transformation

### Critical Paths

1. **Topic Shell Creation & Save**
   ```mermaid
   graph TD
   A[AI Generator] --> B[Create Shells]
   B --> C[Update allCards State]
   C --> D[Save to Knack]
   D --> E[Save to localStorage]
   ```

2. **Color Management**
   ```mermaid
   graph TD
   A[Color Editor] --> B[Update subjectColorMapping]
   B --> C[Update UI]
   C --> D[Save to Knack]
   D --> E[Save to localStorage]
   ```

## Component Hierarchy

1. **App.js**
   - Main state container
   - Knack integration
   - Save/Load orchestration

2. **FlashcardList**
   - Renders subjects/topics
   - Manages UI state
   - Color editor integration

3. **TopicHub**
   - Topic shell creation
   - AI integration
   - Topic list management

## Knack Integration

1. **Data Fields**
   ```typescript
   interface KnackFields {
     field_2979: string; // Cards/Shells JSON
     field_3000: string; // Color Mapping JSON
     // ... other fields
   }
   ```

2. **Save Process**
   - Data validation
   - Field mapping
   - Error handling

## Known Issues & Solutions

1. **Save Corruption**
   - Root cause: Race conditions in state updates
   - Solution: Ensure state stability before save

2. **Color Persistence**
   - Issue: Color updates not properly saved
   - Solution: Centralize color management

3. **Topic Shell Preservation**
   - Issue: Shells converting to cards
   - Solution: Validate data structure during save/load

## Next Steps

1. **Immediate Fixes**
   - [ ] Stabilize save process
   - [ ] Fix color persistence
   - [ ] Ensure topic shell preservation

2. **Architectural Improvements**
   - [ ] Implement proper state management
   - [ ] Add data validation layer
   - [ ] Improve error handling

3. **Testing Strategy**
   - [ ] Add unit tests for critical paths
   - [ ] Implement integration tests
   - [ ] Create automated UI tests 