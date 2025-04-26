// MultiSubjectBridge.js - Enhanced loader for multi-subject support

/**
 * This module provides enhanced bridging functions for safe loading and saving 
 * of multi-subject data between Knack and the flashcards app
 */

import { safeDecodeKnackTopicLists, safeDecodeKnackCards, 
         processKnackUserData, prepareKnackSaveData } from '../utils/KnackAuthUpdates';

/**
 * Enhanced loader for flashcard user data that properly handles URI malformed errors
 * with multiple subjects.
 * 
 * @param {string} userId - The user ID to load data for
 * @param {Object} record - The raw record from Knack
 * @param {Object} FIELD_MAPPING - Map of field IDs
 * @returns {Object} Processed user data with properly handled multi-subject data
 */
export function loadUserDataSafely(userId, record, FIELD_MAPPING) {
    if (!record || !record.id) {
        console.error("[MultiSubjectBridge] Invalid record provided:", record);
        return { recordId: null, cards: [], topicLists: [], colorMapping: {} };
    }

    // Prepare the basic userData structure
    let userData = { 
        recordId: record.id,
        cards: [],
        spacedRepetition: { box1: [], box2: [], box3: [], box4: [], box5: [] },
        topicLists: [],
        colorMapping: {},
        topicMetadata: [],
        lastSaved: record[FIELD_MAPPING.lastSaved] || null
    };

    try {
        // Enhanced parsing for cardBankData (handles URI malformed errors)
        const rawCardData = record[FIELD_MAPPING.cardBankData];
        userData.cards = safeDecodeKnackCards(rawCardData) || [];
        console.log(`[MultiSubjectBridge] Loaded ${userData.cards.length} cards/shells from bank.`);

        // Enhanced parsing for spaced repetition data
        for (let i = 1; i <= 5; i++) {
            const fieldKey = FIELD_MAPPING[`box${i}Data`];
            const boxData = record[fieldKey];
            try {
                userData.spacedRepetition[`box${i}`] = safeDecodeKnackCards(boxData) || [];
            } catch (boxError) {
                console.error(`[MultiSubjectBridge] Error parsing box${i} data, using empty array:`, boxError);
                userData.spacedRepetition[`box${i}`] = [];
            }
        }
        console.log(`[MultiSubjectBridge] Loaded spaced repetition data.`);

        // Enhanced parsing for topic lists - critical for multi-subject support
        const rawTopicLists = record[FIELD_MAPPING.topicLists];
        userData.topicLists = safeDecodeKnackTopicLists(rawTopicLists) || [];
        console.log(`[MultiSubjectBridge] Loaded ${userData.topicLists.length} topic lists.`);

        // Enhanced parsing for color mapping
        const rawColorData = record[FIELD_MAPPING.colorMapping];
        try {
            // Use our more robust parsing utility
            userData.colorMapping = typeof rawColorData === 'string' ? 
                JSON.parse(rawColorData) : (rawColorData || {});
            
            // Ensure color mapping has proper structure
            if (typeof userData.colorMapping !== 'object') {
                userData.colorMapping = {};
            }
            console.log(`[MultiSubjectBridge] Loaded color mapping.`);
        } catch (colorError) {
            console.error(`[MultiSubjectBridge] Error parsing color mapping, using empty object:`, colorError);
            userData.colorMapping = {};
        }

        // Enhanced parsing for topic metadata
        const rawMetaData = record[FIELD_MAPPING.topicMetadata];
        try {
            userData.topicMetadata = typeof rawMetaData === 'string' ? 
                JSON.parse(rawMetaData) : (rawMetaData || []);
            
            // Ensure it's an array
            if (!Array.isArray(userData.topicMetadata)) {
                userData.topicMetadata = [];
            }
            console.log(`[MultiSubjectBridge] Loaded ${userData.topicMetadata.length} topic metadata items.`);
        } catch (metaError) {
            console.error(`[MultiSubjectBridge] Error parsing topic metadata, using empty array:`, metaError);
            userData.topicMetadata = [];
        }

        return userData;
    } catch (e) {
        console.error("[MultiSubjectBridge] Error processing user data fields:", e);
        return userData; // Return partially assembled data
    }
}

/**
 * Prepares data for saving to Knack with proper encoding to avoid multi-subject issues
 * 
 * @param {Object} data - The data to prepare for saving
 * @returns {Object} The prepared data ready for Knack storage
 */
export function prepareDataForSaving(data) {
    return prepareKnackSaveData(data);
}

/**
 * Enhanced loader to replace the Knack app's loadFlashcardUserData function
 * 
 * @param {string} userId - The user ID to load data for
 * @param {Function} callback - Callback to receive processed data
 * @param {Object} FIELD_MAPPING - Map of field IDs
 * @param {Function} getExistingData - Function to get existing data from Knack
 */
export function loadFlashcardUserDataEnhanced(userId, callback, FIELD_MAPPING, getExistingData) {
    console.log(`[MultiSubjectBridge] Loading flashcard user data for user ID: ${userId}`);
    
    getExistingData(userId)
        .then((response) => {
            if (response && response.records && response.records.length > 0) {
                const record = response.records[0];
                console.log(`[MultiSubjectBridge] Found existing flashcard record: ${record.id}`);
                
                // Use our enhanced user data processor
                const userData = loadUserDataSafely(userId, record, FIELD_MAPPING);
                callback(userData);
            } else {
                console.log(`[MultiSubjectBridge] No existing data found for user ${userId}`);
                callback(null); // Signal no data found
            }
        })
        .catch((error) => {
            console.error("[MultiSubjectBridge] Error loading flashcard user data:", error);
            callback(null); // Indicate failure
        });
}
