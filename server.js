// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fetch = require('node-fetch'); // Added node-fetch

// --- Prompts (Copied from src/prompts/topicListPrompt.js - Needs Verification) ---
// IMPORTANT: Verify this function and any dependencies match your actual prompt file
const generateTopicPrompt = (examBoard, examType, subject, academicYear = "current") => {
  // Basic validation
  if (!examBoard || !examType || !subject) {
    console.error("[Prompt] Missing required parameters for topic prompt.");
    return "Generate general topics for the subject provided."; // Basic fallback
  }

  // Ensure values are strings
  const safeExamBoard = String(examBoard);
  const safeExamType = String(examType);
  const safeSubject = String(subject);
  const safeAcademicYear = String(academicYear);


  return `You are an expert educational content creator specializing in ${safeExamBoard} ${safeExamType} curricula.
Generate a comprehensive list of main topics and subtopics for ${safeSubject} specifically for the ${safeExamBoard} ${safeExamType} specification for the ${safeAcademicYear} academic year.

YOUR RESPONSE MUST BE ONLY A VALID JSON ARRAY OF OBJECTS, WITH NO OTHER TEXT BEFORE OR AFTER. THIS IS CRITICAL FOR PARSING.

Use this exact JSON structure for each topic:
[
  {
    "id": "A unique identifier (e.g., '1.1', '2.3.a')",
    "topic": "Full Topic Name (e.g., 'Biological Molecules: Carbohydrates')",
    "mainTopic": "The overarching main topic category (e.g., 'Biological Molecules')",
    "subtopic": "The specific subtopic (e.g., 'Carbohydrates')"
  },
  ... more topics
]

Ensure the topics cover the breadth and depth appropriate for ${safeExamType} level study. Base the list strictly on the official ${safeExamBoard} specification documents. If the exact specification is unavailable, use the most common structure for this subject at this level. Provide around 15-30 topics unless the subject naturally has significantly more or fewer core areas.`;
};
// --- End Prompts ---

// Copied/adapted prompt logic for card generation from AICardGenerator.jsx
// IMPORTANT: Verify this function and logic match your needs
const generateCardPrompt = (data) => {
  const {
    examBoard = "General",
    examType = "Course",
    subject = "General",
    topic = "General",
    numCards = 5,
    questionType = "short_answer"
  } = data || {};

  // Determine complexity based on exam type
  let complexityInstruction;
  if (examType === "A-Level") {
    complexityInstruction = "Make these appropriate for A-Level students (age 16-18). Questions should be challenging and involve deeper thinking. Include sufficient detail in answers and use appropriate technical language.";
  } else { // GCSE or other
    complexityInstruction = "Make these appropriate for GCSE students (age 14-16). Questions should be clear but still challenging. Explanations should be thorough but accessible.";
  }

  // Construct the core prompt
  let prompt = `Return only a valid JSON array of objects with no other text before or after - this is critical. Please output all mathematical expressions in plain text (avoid markdown or LaTeX formatting).\nGenerate ${numCards} high-quality ${examBoard} ${examType} ${subject} flashcards for the specific topic \"${topic}\".\n${complexityInstruction}\n\nBefore generating questions, mentally reference the latest ${examBoard} ${examType} ${subject} specification to ensure the content aligns with typical curriculum expectations.\n\nUse this exact JSON structure:\n[\n  {\n    \"question\": \"Clear, focused question based on the curriculum for ${topic}\"`,

  // Add specific fields based on question type
  if (questionType === 'multiple_choice') {
    prompt += `,\n    \"options\": [\"Option A text\", \"Option B text\", \"Option C text\", \"Option D text\"],\n    \"correctAnswer\": \"The correct option's text exactly as written in the options array\"`;
  } else if (questionType === 'acronym') {
    // Slightly different structure for acronyms
    prompt = `Return only a valid JSON array of objects with no other text before or after. Please output all mathematical expressions in plain text.\nGenerate ${numCards} useful acronyms based on essential course knowledge for ${examBoard} ${examType} ${subject}, focusing on the topic \"${topic}\". Be creative and ensure the explanations are detailed and relevant.\nUse this exact JSON structure:\n[\n  {\n    \"acronym\": \"YOUR_ACRONYM\",\n    \"explanation\": \"Detailed explanation of what the acronym stands for and its significance in ${topic}.\"\n  }\n]`;
    // No detailedAnswer needed for acronym type in this structure
    return prompt; // Return early for acronyms as structure is different
  }

  // Add detailedAnswer for non-acronym types
  prompt += `,\n    \"detailedAnswer\": \"Detailed explanation of the correct answer, including key concepts, relevant details, and examples pertaining to ${topic}\"\n  }\n]`; // Close the JSON structure string

  return prompt;
};
// --- End Prompts ---


const app = express();
// Use the port Heroku assigns, or 8080 for local development
const port = process.env.PORT || 8080; 

// --- Express Setup ---

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// --- HTTP Server Setup ---
// Create an HTTP server using the Express app
const server = http.createServer(app);

// --- WebSocket Server Setup ---
// Create a WebSocket server attached to the *HTTP server*
const wss = new WebSocket.Server({ server });

console.log('WebSocket server setup complete, attached to HTTP server.');

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (message) => {
    let requestData;
    try {
      const messageString = message.toString();
      requestData = JSON.parse(messageString);
      console.log('Received:', requestData);

      switch (requestData.action) {
        case 'generateTopics':
          await handleGenerateTopics(ws, requestData.data);
          break;
        case 'generateCards':
          await handleGenerateCards(ws, requestData.data); // Call the new handler
          break;
        default:
          console.warn('Unknown action:', requestData.action);
          ws.send(JSON.stringify({ type: 'error', message: `Unknown action: ${requestData.action}` }));
      }

    } catch (error) {
      console.error('Failed to process message or send response:', error);
      try {
        const action = requestData?.action || 'unknown';
        ws.send(JSON.stringify({ type: 'error', action: action, message: `Server error processing message: ${error.message}` }));
      } catch (sendError) {
        console.error('Failed to send error message to client:', sendError);
      }
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Optional: Send a welcome message on connection
  try {
      ws.send(JSON.stringify({ type: 'info', message: 'Connected to WebSocket server.' }));
  } catch (error) {
       console.error('Failed to send welcome message:', error);
  }
});

// --- AI Generation Handlers ---

async function handleGenerateTopics(ws, data) {
  console.log('Handling generateTopics request:', data);
  const { examBoard, examType, subject } = data || {};

  if (!examBoard || !examType || !subject) {
     console.error('Missing parameters for topic generation');
     ws.send(JSON.stringify({ type: 'error', action: 'generateTopics', message: 'Missing examBoard, examType, or subject.' }));
     return;
  }

  // Let the client know we've started
  ws.send(JSON.stringify({ type: 'status', action: 'generateTopics', message: 'Generating topics...' }));


  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured on the server.');
    }

    const prompt = generateTopicPrompt(examBoard, examType, subject); // Use the copied prompt function

    console.log('Calling OpenAI API for topics...');
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Or your preferred model
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000, // Increased for potentially longer topic lists
        temperature: 0.5 // Lower temperature for more factual lists
      })
    });

    if (!response.ok) {
      // Attempt to get error details from OpenAI response
      let errorBody = 'Unknown API Error';
      try {
        const errorData = await response.json();
        errorBody = errorData?.error?.message || JSON.stringify(errorData);
      } catch (parseError) {
         console.error("Could not parse OpenAI error response:", parseError);
         errorBody = await response.text(); // Fallback to raw text
      }
      throw new Error(`OpenAI API Error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI API.');
    }

    console.log("Raw topic response from OpenAI:", content);

    // Basic cleaning - remove ```json blocks if present
    const cleanedContent = content.replace(/```json|```/g, '').trim();
    let topics;
    try {
      topics = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI topic response as JSON:", parseError);
      // TODO: Implement fallback parsing (e.g., splitting by lines) if needed
      throw new Error(`Failed to parse AI topic response. Raw content: ${cleanedContent.substring(0, 100)}...`);
    }

    if (!Array.isArray(topics)) {
        throw new Error('AI response was not a valid JSON array.');
    }

    console.log(`Successfully generated ${topics.length} topics.`);

    // Send results back to the specific client
    ws.send(JSON.stringify({
      type: 'topicResults',
      action: 'generateTopics',
      topics: topics
    }));

  } catch (error) {
    console.error("Error in handleGenerateTopics:", error);
    ws.send(JSON.stringify({
      type: 'error',
      action: 'generateTopics',
      message: `Failed to generate topics: ${error.message}`
    }));
  }
}

// New handler for card generation
async function handleGenerateCards(ws, data) {
  console.log('Handling generateCards request:', data);
  // Extract necessary data, providing defaults if needed
   const {
      examBoard = "General",
      examType = "Course",
      subject = "General",
      topic = "General",
      numCards = 5,
      questionType = "short_answer"
    } = data || {};


  // Basic validation
  if (!subject || !topic) {
     console.error('Missing parameters for card generation');
     ws.send(JSON.stringify({ type: 'error', action: 'generateCards', message: 'Missing subject or topic.' }));
     return;
  }

   // Let the client know we've started
   ws.send(JSON.stringify({ type: 'status', action: 'generateCards', message: 'Generating cards...' }));


  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured on the server.');
    }

    const prompt = generateCardPrompt(data); // Pass the whole data object

    console.log('Calling OpenAI API for cards...');
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Or your preferred model
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500, // Allow more tokens for multiple cards
        temperature: 0.7
      })
    });

    if (!response.ok) {
      let errorBody = 'Unknown API Error';
      try {
        const errorData = await response.json();
        errorBody = errorData?.error?.message || JSON.stringify(errorData);
      } catch (parseError) {
         console.error("Could not parse OpenAI error response:", parseError);
         errorBody = await response.text();
      }
      throw new Error(`OpenAI API Error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI API.');
    }

    console.log("Raw card response from OpenAI:", content);

    // Basic cleaning - remove ```json blocks if present
    const cleanedContent = content.replace(/```json|```/g, '').trim();
    let cards;
    try {
      cards = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI card response as JSON:", parseError);
      throw new Error(`Failed to parse AI card response. Raw content: ${cleanedContent.substring(0, 100)}...`);
    }

     if (!Array.isArray(cards)) {
         throw new Error('AI card response was not a valid JSON array.');
     }

    console.log(`Successfully generated ${cards.length} cards.`);

    // Send results back to the specific client
    ws.send(JSON.stringify({
      type: 'cardResults',
      action: 'generateCards',
      cards: cards // Send the raw cards, let frontend enrich if needed
    }));

  } catch (error) {
    console.error("Error in handleGenerateCards:", error);
    ws.send(JSON.stringify({
      type: 'error',
      action: 'generateCards',
      message: `Failed to generate cards: ${error.message}`
    }));
  }
}

// --- Fallback Route for React Router ---
// Handles any requests that don't match the static files or API routes (if any)
// by serving the main index.html file. CRITICAL for Single Page Apps.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'), (err) => {
    if (err) {
      console.error("Error sending index.html:", err);
      res.status(500).send(err);
    }
  });
});

// --- Start Server ---
// Start the *HTTP server* (which includes WebSocket server)
server.listen(port, () => {
  console.log(`HTTP server (with WebSocket) listening on port ${port}`);
}); 