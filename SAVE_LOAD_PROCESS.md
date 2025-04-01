# Save/Load Process Documentation

## Save Process

### Entry Points

1. **Direct Save Calls**
   ```javascript
   saveData(data?: any[], preserveFields?: boolean)
   ```
   - Called directly after major state changes
   - Optional `data` parameter for immediate saves
   - `preserveFields` to prevent overwriting certain fields

2. **Automatic Saves**
   - After topic shell creation
   - After color changes
   - After card updates
   - Periodic backup saves

### Save Flow

1. **Pre-Save Processing**
   ```javascript
   // Current process (needs improvement)
   const safeData = {
     recordId: safeRecordId,
     cards: safeSerializeData(data || allCards),
     colorMapping: safeSerializeData(subjectColorMapping),
     // ... other fields
   };
   ```

2. **Data Validation**
   - Ensure all required fields exist
   - Validate data types
   - Check for undefined/null values

3. **Local Storage Backup**
   ```javascript
   // Save to localStorage with versioning
   const versionedData = {
     version: '1.0',
     timestamp: new Date().toISOString(),
     data: safeData
   };
   localStorage.setItem('flashcards_app', JSON.stringify(versionedData));
   ```

4. **Knack Integration**
   ```javascript
   // Convert to Knack format
   const knackData = {
     field_2979: JSON.stringify(safeData.cards),
     field_3000: JSON.stringify(safeData.colorMapping),
     // ... other fields
   };
   
   // Send to parent window (Knack)
   window.parent.postMessage({
     type: 'SAVE_DATA',
     payload: knackData
   }, '*');
   ```

## Load Process

### Initial Load

1. **Knack Data Reception**
   ```javascript
   // Receive data from Knack
   window.addEventListener('message', (event) => {
     if (event.data.type === 'KNACK_USER_INFO') {
       const userData = event.data.userData;
       // Process user data
     }
   });
   ```

2. **Data Processing**
   - Parse JSON strings
   - Validate data structure
   - Transform to app format

3. **State Initialization**
   ```javascript
   // Initialize app state
   setAllCards(processedCards);
   setSubjectColorMapping(processedColorMapping);
   // ... other state initialization
   ```

### Recovery/Backup Load

1. **Local Storage Check**
   ```javascript
   const savedData = localStorage.getItem('flashcards_app');
   if (savedData) {
     const parsed = JSON.parse(savedData);
     if (parsed.version === '1.0') {
       // Use saved data
     }
   }
   ```

2. **Validation & Recovery**
   - Check data integrity
   - Fall back to defaults if needed
   - Log recovery attempts

## Current Issues

1. **Race Conditions**
   ```javascript
   // Problem: State not settled before save
   setAllCards(newCards);
   saveData(); // Might use old state
   
   // Solution: Use callbacks/promises
   setAllCards(newCards, () => {
     saveData(newCards); // Guaranteed to use new state
   });
   ```

2. **Data Corruption**
   - Incomplete saves
   - Missing validation
   - Type mismatches

3. **Knack Integration**
   - Message handling timing
   - Error recovery
   - Data format consistency

## Proposed Improvements

1. **Robust Save Queue**
   ```javascript
   class SaveQueue {
     queue = [];
     isSaving = false;
     
     add(data) {
       this.queue.push(data);
       this.process();
     }
     
     async process() {
       if (this.isSaving) return;
       this.isSaving = true;
       
       while (this.queue.length > 0) {
         const data = this.queue.shift();
         await this.save(data);
       }
       
       this.isSaving = false;
     }
   }
   ```

2. **Data Validation Layer**
   ```javascript
   const validateData = (data) => {
     const schema = {
       cards: Array,
       colorMapping: Object,
       // ... schema definition
     };
     
     return validate(data, schema);
   };
   ```

3. **Error Recovery**
   - Automatic retries
   - Backup restoration
   - User notifications

## Testing Strategy

1. **Unit Tests**
   - Data validation
   - State transformations
   - Error handling

2. **Integration Tests**
   - Save/load cycles
   - State consistency
   - Recovery procedures

3. **End-to-End Tests**
   - Complete user workflows
   - Error scenarios
   - Performance testing 