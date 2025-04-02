// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001; // Use Heroku's assigned port or 3001 locally

// --- Express Setup ---

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handles any requests that don't match the ones above by serving index.html
// This is important for Single Page Applications like React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// --- HTTP Server Setup ---
// Create an HTTP server using the Express app
const server = http.createServer(app);

// --- WebSocket Server Setup ---
// Create a WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

console.log('WebSocket server setup complete.');

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Handle messages received from the client
  ws.on('message', (message) => {
    try {
      const messageString = message.toString(); // Ensure message is a string
      console.log('Received:', messageString);

      // Basic message processing placeholder
      // TODO: Add logic to parse the message and perform actions
      // For now, just echo the message back
      ws.send(`Server received: ${messageString}`);

    } catch (error) {
      console.error('Failed to process message or send response:', error);
       // Inform the client about the error if possible
       try {
           ws.send(JSON.stringify({ type: 'error', message: 'Server error processing message.' }));
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

// --- Start Server ---
server.listen(port, () => {
  console.log(`HTTP server listening on port ${port}`);
}); 