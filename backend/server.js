// backend/server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const fetch = require('node-fetch'); // Or use axios if you installed that
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001; // Use Heroku's port or 5001 locally

// --- Knack Configuration (from Environment Variables) ---
const KNACK_APP_ID = process.env.KNACK_APP_ID;
const KNACK_API_KEY = process.env.KNACK_API_KEY;
const KNACK_API_URL = 'https://api.knack.com/v1';
const FLASHCARD_OBJECT_ID = 'object_102'; // Your flashcard object ID

// --- CORS Configuration ---
const allowedOrigins = [
  process.env.FRONTEND_URL, // Your deployed React app URL
  'http://localhost:3000'   // Your local React dev server
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests) or from allowed origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error(`CORS Error: Origin ${origin} not allowed.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // If you need to handle cookies or authorization headers
}));

// --- Middleware ---
app.use(express.json()); // Parse JSON request bodies

// --- Helper Function for Knack API Calls ---
async function knackApiRequest(endpoint, method = 'GET', body = null, userToken = null) {
  const url = `${KNACK_API_URL}${endpoint}`;
  const headers = {
    'X-Knack-Application-Id': KNACK_APP_ID,
    'X-Knack-REST-API-Key': KNACK_API_KEY,
    'Content-Type': 'application/json',
  };
  if (userToken) {
    // Knack typically uses the token directly in the Authorization header for user context
    headers['Authorization'] = userToken;
  }

  const options = {
    method: method,
    headers: headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  console.log(`[Backend] Knack API Request: ${method} ${url}`);
  try {
    const response = await fetch(url, options); // Use the imported fetch
    const responseBody = await response.text(); // Read body once

    if (!response.ok) {
      console.error(`[Backend] Knack API Error (${response.status}) for ${method} ${url}: ${responseBody}`);
      throw new Error(`Knack API Error (${response.status}): ${responseBody}`);
    }

    // Try to parse JSON only if content-type indicates it
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1 && responseBody) {
        return JSON.parse(responseBody);
    } else {
        // Return success indication for non-JSON or empty responses
        return { success: true, status: response.status, data: responseBody };
    }
  } catch (error) {
    console.error(`[Backend] Fetch error calling Knack API: ${error.message}`);
    throw error;
  }
}

// --- API Endpoints ---

// GET /api/data/:userId - Get Initial User Data (or check existence)
app.get('/api/data/:userId', async (req, res) => {
  const userId = req.params.userId;
  const userToken = req.headers.authorization; // Expecting token directly

  if (!userId) return res.status(400).json({ error: 'User ID is required' });
  if (!userToken) console.warn(`[Backend] No user token provided for GET /api/data/${userId}. Proceeding with API Key only.`);

  console.log(`[Backend] GET /api/data/ for user: ${userId}`);
  try {
    // !! IMPORTANT: Replace 'field_2954' with your actual Knack field ID for the User ID connection !!
    const userFieldId = 'field_2954'; // <<<--- ** CHECK & CHANGE THIS **
    const searchFilter = encodeURIComponent(JSON.stringify({ match: 'and', rules: [{ field: userFieldId, operator: 'is', value: userId }] }));
    const searchUrl = `/objects/${FLASHCARD_OBJECT_ID}/records?filters=${searchFilter}&rows_per_page=1`;

    const searchResponse = await knackApiRequest(searchUrl, 'GET', null, userToken);
    let record;

    if (searchResponse.records && searchResponse.records.length > 0) {
      record = searchResponse.records[0];
      console.log(`[Backend] Found existing record: ${record.id}`);

      // Fetch the full record data
      const recordData = await knackApiRequest(`/objects/${FLASHCARD_OBJECT_ID}/records/${record.id}`, 'GET', null, userToken);

      // !! IMPORTANT: Map Knack field IDs to meaningful names for the React app !!
      // Use your actual field IDs from previous scripts/Knack builder
      const responseData = {
        recordId: recordData.id,
        cards: recordData['field_2979'],         // <<<--- ** CHECK & CHANGE **
        colorMapping: recordData['field_3000'],  // <<<--- ** CHECK & CHANGE **
        topicLists: recordData['field_3011'],    // <<<--- ** CHECK & CHANGE **
        topicMetadata: recordData['field_3030'], // <<<--- ** CHECK & CHANGE **
        spacedRepetition: {
          box1: recordData['field_2986'],       // <<<--- ** CHECK & CHANGE **
          box2: recordData['field_2987'],       // <<<--- ** CHECK & CHANGE **
          box3: recordData['field_2988'],       // <<<--- ** CHECK & CHANGE **
          box4: recordData['field_2989'],       // <<<--- ** CHECK & CHANGE **
          box5: recordData['field_2990'],       // <<<--- ** CHECK & CHANGE **
        },
        // Add any other fields needed by React
      };
      res.status(200).json(responseData);

    } else {
      console.log(`[Backend] No record found for userId: ${userId}. Informing client.`);
      // Let the frontend decide how to handle user creation
      res.status(404).json({ needsCreation: true, message: "User record not found." });
    }
  } catch (error) {
    console.error(`[Backend] Error in GET /api/data/${userId}:`, error);
    if (error.message.includes("401")) {
         res.status(401).json({ error: "Knack authentication failed. Token might be invalid." });
    } else {
        res.status(500).json({ error: 'An error occurred while fetching data.' });
    }
  }
});

// POST /api/save/:recordId - Save User Data
app.post('/api/save/:recordId', async (req, res) => {
  const recordId = req.params.recordId;
  const userToken = req.headers.authorization;
  const dataToSave = req.body;

  if (!recordId) return res.status(400).json({ error: 'Record ID is required' });
  if (!userToken) console.warn(`[Backend] No user token provided for POST /api/save/${recordId}.`);
  if (!dataToSave) return res.status(400).json({ error: 'Data payload is required' });

  console.log(`[Backend] POST /api/save/ for record: ${recordId}`);
  try {
    // !! IMPORTANT: Map data keys from React state back to Knack field IDs !!
    const knackPayload = {
      'field_2979': JSON.stringify(dataToSave.cards || []),         // <<<--- ** CHECK & CHANGE **
      'field_3000': JSON.stringify(dataToSave.colorMapping || {}),  // <<<--- ** CHECK & CHANGE **
      'field_3011': JSON.stringify(dataToSave.topicLists || []),    // <<<--- ** CHECK & CHANGE **
      'field_3030': JSON.stringify(dataToSave.topicMetadata || []), // <<<--- ** CHECK & CHANGE **
      'field_2986': JSON.stringify(dataToSave.spacedRepetition?.box1 || []), // <<<--- ** CHECK & CHANGE **
      'field_2987': JSON.stringify(dataToSave.spacedRepetition?.box2 || []), // <<<--- ** CHECK & CHANGE **
      'field_2988': JSON.stringify(dataToSave.spacedRepetition?.box3 || []), // <<<--- ** CHECK & CHANGE **
      'field_2989': JSON.stringify(dataToSave.spacedRepetition?.box4 || []), // <<<--- ** CHECK & CHANGE **
      'field_2990': JSON.stringify(dataToSave.spacedRepetition?.box5 || []), // <<<--- ** CHECK & CHANGE **
      'field_2957': new Date().toISOString(), // Last Saved   <<<--- ** CHECK & CHANGE **
    };

    const updateResponse = await knackApiRequest(`/objects/${FLASHCARD_OBJECT_ID}/records/${recordId}`, 'PUT', knackPayload, userToken);
    console.log(`[Backend] Save successful for record: ${recordId}`);
    res.status(200).json({ success: true, recordId: recordId }); // Keep response simple

  } catch (error) {
    console.error(`[Backend] Error in POST /api/save/${recordId}:`, error);
    res.status(500).json({ error: 'An error occurred while saving data.' });
  }
});

// --- Optional: Endpoint for creating a new user record ---
app.post('/api/create', async (req, res) => {
  const { userId, email, name } = req.body;
  const userToken = req.headers.authorization;

  if (!userId || !email || !name) {
    return res.status(400).json({ error: 'User ID, Email, and Name are required for creation.' });
  }

  console.log(`[Backend] POST /api/create request received for user: ${userId}, email: ${email}`);

  try {
    // --- 1. Fetch User Account to get School Connection ---
    let schoolRecordId = null;
    try {
      console.log(`[Backend] Fetching user account (object_3) record: ${userId}`);
      const userAccount = await knackApiRequest(`/objects/object_3/records/${userId}`, 'GET', null, userToken);
      // <<<--- CHECK & CHANGE 'field_122' if your school connection field ID is different in object_3
      if (userAccount && userAccount['field_122_raw'] && userAccount['field_122_raw'].length > 0) {
          schoolRecordId = userAccount['field_122_raw'][0].id; // Knack connection fields usually return an array
          console.log(`[Backend] Found school connection ID: ${schoolRecordId}`);
      } else {
          console.warn(`[Backend] User account ${userId} found, but no school connection (field_122) found or it's empty.`);
      }
    } catch (error) {
        console.error(`[Backend] Error fetching user account ${userId} (object_3): ${error.message}. Proceeding without school connection.`);
        // Decide if this is fatal. Here, we proceed without it.
    }

    // --- 2. Find Student Record ID (object_6) using Email ---
    let studentRecordId = null;
    let tutorRecordId = null;
    try {
        // <<<--- CHECK & CHANGE 'field_91' if your email field ID is different in object_6
        const studentSearchFilter = encodeURIComponent(JSON.stringify({ match: 'and', rules: [{ field: 'field_91', operator: 'is', value: email }] }));
        const studentSearchUrl = `/objects/object_6/records?filters=${studentSearchFilter}&rows_per_page=1`;
        console.log(`[Backend] Searching for student record (object_6) using email: ${email}`);
        const studentSearchResponse = await knackApiRequest(studentSearchUrl, 'GET', null, userToken);

        if (studentSearchResponse.records && studentSearchResponse.records.length > 0) {
            studentRecordId = studentSearchResponse.records[0].id;
            console.log(`[Backend] Found student record ID: ${studentRecordId}`);

            // --- 3. Fetch Student Record to get Tutor Connection ---
            try {
                console.log(`[Backend] Fetching student record (object_6) details: ${studentRecordId}`);
                const studentRecord = await knackApiRequest(`/objects/object_6/records/${studentRecordId}`, 'GET', null, userToken);
                // <<<--- CHECK & CHANGE 'field_1682' if your tutor connection field ID is different in object_6
                if (studentRecord && studentRecord['field_1682_raw'] && studentRecord['field_1682_raw'].length > 0) {
                    tutorRecordId = studentRecord['field_1682_raw'][0].id; // Knack connection fields usually return an array
                    console.log(`[Backend] Found tutor connection ID: ${tutorRecordId}`);
                } else {
                    console.warn(`[Backend] Student record ${studentRecordId} found, but no tutor connection (field_1682) found or it's empty.`);
                }
            } catch (error) {
                 console.error(`[Backend] Error fetching student record ${studentRecordId} (object_6): ${error.message}. Proceeding without tutor connection.`);
                 // Decide if this is fatal. Here, we proceed without it.
            }
        } else {
            console.warn(`[Backend] No student record (object_6) found for email: ${email}. Cannot determine tutor connection.`);
        }
    } catch (error) {
        console.error(`[Backend] Error searching for student record (object_6) using email ${email}: ${error.message}. Cannot determine tutor connection.`);
        // Decide if this is fatal. Here, we proceed without tutor connection.
    }


    // --- 4. Construct Payload for the new Flashcard Record (object_102) ---
    const createPayload = {
      'field_2954': userId, // User ID (text field)
      'field_2958': email,  // Email (text field)
      'field_3029': name,   // Name (text field)
      'field_2956': userId, // Account Connection (Connects to object_3) <<<--- CHECK & CHANGE
      // Add other required fields for object_102 with default values if needed
    };

    // Add connections only if the IDs were found
    if (schoolRecordId) {
      // <<<--- CHECK & CHANGE 'field_3008' if your school connection field ID is different in object_102
      createPayload['field_3008'] = schoolRecordId; // School Connection (Connects to object_2)
    }
    if (tutorRecordId) {
      // <<<--- CHECK & CHANGE 'field_3009' if your tutor connection field ID is different in object_102
      createPayload['field_3009'] = tutorRecordId; // Tutor Connection (Connects to object_7)
    }

    console.log('[Backend] Final payload for creating object_102 record:', createPayload);

    // --- 5. Create the Flashcard Record in object_102 ---
    const newRecord = await knackApiRequest(`/objects/${FLASHCARD_OBJECT_ID}/records`, 'POST', createPayload, userToken);
    console.log(`[Backend] Successfully created new flashcard record: ${newRecord.id}`);

    // Return the new record ID and maybe default data structure
    res.status(201).json({
        success: true,
        recordId: newRecord.id,
        message: "User record created successfully.",
        // Optionally include default data structure for the frontend here if needed
        // defaultData: { cards: [], colorMapping: {}, ... }
    });

  } catch (error) {
    console.error(`[Backend] Critical Error in POST /api/create:`, error);
    res.status(500).json({ error: 'An error occurred while creating the user record.' });
  }
});

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
  if (!process.env.KNACK_APP_ID || !process.env.KNACK_API_KEY || !process.env.FRONTEND_URL) {
     console.warn("\n[Backend] WARNING: Missing required environment variables.");
     console.warn("Ensure KNACK_APP_ID, KNACK_API_KEY, and FRONTEND_URL are set in .env (local) or Config Vars (Heroku).\n");
  } else {
     console.log("[Backend] Environment variables loaded successfully.");
  }
}); 