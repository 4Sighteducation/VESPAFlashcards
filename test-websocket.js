// Simple WebSocket client to test the connection to the Heroku server
// Run with: node test-websocket.js

const WebSocket = require('ws');

// Connect to the WebSocket server
const ws = new WebSocket('wss://vespa-flashcards-e7f31e9ff3c9.herokuapp.com/');

console.log('Connecting to WebSocket server...');

// Connection opened
ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // Send a ping message
  ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
  console.log('Ping sent to server');
  
  // Keep the connection alive for a while to observe heartbeats
  console.log('Waiting for pong response and server-side pings...');
  
  // Setup periodic logging of connection state
  setInterval(() => {
    console.log(`WebSocket state: ${ws.readyState === WebSocket.OPEN ? 'CONNECTED' : 'DISCONNECTED'}`);
  }, 15000); // Log every 15 seconds
});

// Listen for messages
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`Received message: ${JSON.stringify(message, null, 2)}`);
    
    // Check for pong response
    if (message.type === 'pong') {
      console.log(`Received pong from server. Round trip time: ${Date.now() - message.timestamp}ms`);
    }
    
    // Check for server ping
    if (message.type === 'ping') {
      console.log(`Received ping from server at ${new Date(message.timestamp).toLocaleTimeString()}`);
      // You might want to respond with a pong here if implementing bidirectional heartbeat
    }
  } catch (error) {
    console.error('Error parsing message:', error);
    console.log('Raw message:', data.toString());
  }
});

// Handle errors
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Handle close
ws.on('close', (code, reason) => {
  console.log(`WebSocket closed: ${code} - ${reason || 'No reason provided'}`);
});

// Listen for process termination to clean up
process.on('SIGINT', () => {
  console.log('Closing WebSocket connection...');
  ws.close(1000, 'Client shutdown');
  process.exit(0);
});

console.log('Press Ctrl+C to stop the test');
