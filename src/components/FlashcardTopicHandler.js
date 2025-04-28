// FlashcardTopicHandler.js - Utilities for topic management

/**
 * Send a message to delete a subject
 * @param {string} subject - The subject name to delete
 * @returns {Promise<Object>} - Promise resolving to the deletion result
 */
export const deleteSubject = async (subject) => {
  console.log(`[FlashcardTopicHandler] Requesting deletion of subject: ${subject}`);
  
  // Get the current record ID
  const recordId = await getRecordId();
  if (!recordId) {
    console.error("[FlashcardTopicHandler] Cannot delete subject - record ID not found");
    throw new Error("Record ID not found");
  }
  
  // Create the message
  const message = {
    type: 'DELETE_SUBJECT',
    subject: subject,
    recordId: recordId
  };
  
  // Send the message to the parent window
  window.parent.postMessage(message, '*');
  
  // Return a promise that resolves when we get a response
  return new Promise((resolve, reject) => {
    const handleResponse = (event) => {
      // Check if this is a response to our delete request
      if (event.data && event.data.type === 'DELETE_SUBJECT_RESULT' && event.data.subject === subject) {
        // Remove the event listener
        window.removeEventListener('message', handleResponse);
        
        // Resolve or reject based on the result
        if (event.data.success) {
          console.log(`[FlashcardTopicHandler] Subject deleted successfully: ${subject}`);
          resolve(event.data);
        } else {
          console.error(`[FlashcardTopicHandler] Error deleting subject: ${subject}`, event.data.error);
          reject(new Error(event.data.error || "Error deleting subject"));
        }
      }
    };
    
    // Listen for the response
    window.addEventListener('message', handleResponse);
    
    // Set a timeout to prevent hanging if no response
    setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      reject(new Error("Timeout waiting for deletion response"));
    }, 10000);
  });
};

/**
 * Send a message to delete a topic
 * @param {string} topic - The topic name to delete
 * @param {string} subject - The subject the topic belongs to
 * @returns {Promise<Object>} - Promise resolving to the deletion result
 */
export const deleteTopic = async (topic, subject) => {
  console.log(`[FlashcardTopicHandler] Requesting deletion of topic: ${topic} in subject: ${subject}`);
  
  // Get the current record ID
  const recordId = await getRecordId();
  if (!recordId) {
    console.error("[FlashcardTopicHandler] Cannot delete topic - record ID not found");
    throw new Error("Record ID not found");
  }
  
  // Create the message
  const message = {
    type: 'DELETE_TOPIC',
    topic: topic,
    subject: subject,
    recordId: recordId
  };
  
  // Send the message to the parent window
  window.parent.postMessage(message, '*');
  
  // Return a promise that resolves when we get a response
  return new Promise((resolve, reject) => {
    const handleResponse = (event) => {
      // Check if this is a response to our delete request
      if (
        event.data && 
        event.data.type === 'DELETE_TOPIC_RESULT' && 
        event.data.topic === topic &&
        event.data.subject === subject
      ) {
        // Remove the event listener
        window.removeEventListener('message', handleResponse);
        
        // Resolve or reject based on the result
        if (event.data.success) {
          console.log(`[FlashcardTopicHandler] Topic deleted successfully: ${topic} in ${subject}`);
          resolve(event.data);
        } else {
          console.error(`[FlashcardTopicHandler] Error deleting topic: ${topic} in ${subject}`, event.data.error);
          reject(new Error(event.data.error || "Error deleting topic"));
        }
      }
    };
    
    // Listen for the response
    window.addEventListener('message', handleResponse);
    
    // Set a timeout to prevent hanging if no response
    setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      reject(new Error("Timeout waiting for deletion response"));
    }, 10000);
  });
};

/**
 * Get the current record ID from the parent window
 * @returns {Promise<string>} - Promise resolving to the record ID
 */
const getRecordId = async () => {
  return new Promise((resolve, reject) => {
    // Check if we already have the record ID in localStorage
    try {
      const storedData = localStorage.getItem('flashcards_app_recordId');
      if (storedData) {
        return resolve(storedData);
      }
    } catch (e) {
      console.warn("[FlashcardTopicHandler] Error reading recordId from localStorage:", e);
    }
    
    // Function to handle the response
    const handleRecordIdResponse = (event) => {
      if (event.data && event.data.type === 'RECORD_ID_RESPONSE' && event.data.recordId) {
        // Remove the event listener
        window.removeEventListener('message', handleRecordIdResponse);
        
        // Save to localStorage for future use
        try {
          localStorage.setItem('flashcards_app_recordId', event.data.recordId);
        } catch (e) {
          console.warn("[FlashcardTopicHandler] Error saving recordId to localStorage:", e);
        }
        
        // Return the record ID
        resolve(event.data.recordId);
      } else if (event.data && event.data.type === 'RECORD_ID_ERROR') {
        // Remove the event listener
        window.removeEventListener('message', handleRecordIdResponse);
        
        // Reject with the error
        reject(new Error(event.data.error || "Error getting record ID"));
      }
    };
    
    // Listen for the response
    window.addEventListener('message', handleRecordIdResponse);
    
    // Request the record ID
    window.parent.postMessage({ type: 'REQUEST_RECORD_ID' }, '*');
    
    // Set a timeout to avoid hanging
    setTimeout(() => {
      window.removeEventListener('message', handleRecordIdResponse);
      reject(new Error("Timeout waiting for record ID"));
    }, 5000);
  });
}; 