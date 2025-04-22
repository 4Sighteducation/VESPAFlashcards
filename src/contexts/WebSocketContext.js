import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// Define the WebSocket URL from environment variable or fallback to Heroku URL
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'wss://vespa-flashcards-e7f31e9ff3c9.herokuapp.com/';

// Constants for WebSocket management
const PING_INTERVAL = 45000; // 45 seconds - just under Heroku's 55s idle timeout
const MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5 to be more persistent
const INITIAL_RECONNECT_DELAY = 2000; // Start with 2 seconds delay

// Create the context
const WebSocketContext = createContext(null);

// Custom hook to use the WebSocket context
export const useWebSocket = () => {
  return useContext(WebSocketContext);
};

// Helper function to stringify messages safely
const safeStringify = (data) => {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error("[WebSocketContext] Error stringifying message:", error);
    return JSON.stringify({ type: "error", message: "Failed to stringify data" });
  }
};

// Provider component
export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef(null);
  const pingInterval = useRef(null);
  const webSocketRef = useRef(null); // Reference to keep track of the current socket

  // Send ping message to keep connection alive
  const sendPing = useCallback(() => {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      try {
        webSocketRef.current.send(safeStringify({ type: 'ping', timestamp: Date.now() }));
        console.log('[WebSocketProvider] Ping sent to keep connection alive');
      } catch (err) {
        console.error('[WebSocketProvider] Error sending ping:', err);
      }
    }
  }, []);

  // Function to send messages through the WebSocket
  const sendMessage = useCallback((message) => {
    if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WebSocketProvider] Cannot send message - WebSocket not connected');
      return false;
    }

    try {
      // If message is already a string, use it directly, otherwise stringify
      const messageToSend = typeof message === 'string' ? message : safeStringify(message);
      webSocketRef.current.send(messageToSend);
      return true;
    } catch (error) {
      console.error('[WebSocketProvider] Error sending message:', error);
      return false;
    }
  }, []);

  // Setup connection to WebSocket server
  const connectWebSocket = useCallback(() => {
    console.log(`[WebSocketProvider] Attempting to connect to ${WEBSOCKET_URL}...`);
    setError(null); // Clear previous errors on new attempt

    // Ensure WebSocket is available (it should be in modern browsers)
    if (!window.WebSocket) {
        console.error("[WebSocketProvider] WebSocket API not supported by this browser.");
        setError("WebSocket is not supported by your browser.");
        return;
    }

    // Clear any existing ping interval
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }

    const ws = new WebSocket(WEBSOCKET_URL);
    webSocketRef.current = ws; // Store in ref for direct access

    ws.onopen = () => {
      console.log('[WebSocketProvider] WebSocket Connected');
      setIsConnected(true);
      setSocket(ws);
      setError(null);
      reconnectAttempts.current = 0; // Reset attempts on successful connection
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Setup ping interval to keep connection alive (prevent Heroku H15 errors)
      pingInterval.current = setInterval(sendPing, PING_INTERVAL);
    };

    ws.onclose = (event) => {
      console.log('[WebSocketProvider] WebSocket Disconnected:', event.code, event.reason);
      setIsConnected(false);
      setSocket(null); // Clear the socket instance
      webSocketRef.current = null;

      // Clear ping interval on disconnection
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }

      // Attempt to reconnect only if not a normal closure (1000) and within limits
      if (event.code !== 1000 && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts.current), 
          60000 // cap at 1 minute
        );
        console.log(`[WebSocketProvider] Attempting reconnect ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`);
        reconnectTimeout.current = setTimeout(connectWebSocket, delay);
      } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error('[WebSocketProvider] Max reconnection attempts reached.');
          setError('Failed to reconnect after multiple attempts.');
      }
    };

    ws.onerror = (err) => {
      // The browser's WebSocket API often just gives a generic 'error' event
      // The actual reason is usually found in the 'onclose' event that follows
      console.error('[WebSocketProvider] WebSocket Error Event. See console/onclose for details.');
      setError('WebSocket connection error. Check console for details.');
      // No need to explicitly call ws.close() here, onerror is usually followed by onclose
    };

    // Central message handler to handle pong responses and pass other messages to components
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle ping/pong responses internally
        if (data.type === 'pong') {
          console.log('[WebSocketProvider] Received pong from server');
          return; // Don't propagate ping/pong messages to application
        }
        
        // All other messages are propagated to components via the socket state
        // Components will set up their own message listeners
      } catch (error) {
        console.error('[WebSocketProvider] Error parsing WebSocket message:', error);
      }
    };

    // Return the WebSocket instance for cleanup
    return ws;
  }, [sendPing]);

  useEffect(() => {
    const ws = connectWebSocket(); // Initial connection attempt

    // Cleanup function when the provider unmounts
    return () => {
      console.log('[WebSocketProvider] Cleaning up WebSocket connection.');
      
      // Clear any reconnect attempts
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      
      // Clear ping interval
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }
      
      // Close socket if it exists
      if (ws) {
        // Remove listeners before closing to prevent state updates on unmounted component
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null; // Ensure no message listeners linger
        
        // Close with normal closure code
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Component unmounting');
        }
      }
      
      // Reset state
      setIsConnected(false);
      setSocket(null);
      webSocketRef.current = null;
    };
  }, [connectWebSocket]); // Dependency on connectWebSocket (which has stable reference due to useCallback)

  // Enhanced context value to include more functionality
  const contextValue = {
    socket,        // The WebSocket instance (or null if not connected)
    isConnected,   // Boolean indicating connection status
    error,         // Any connection error message
    sendMessage,   // Function to send messages through the WebSocket
    reconnect: connectWebSocket, // Function to manually trigger reconnection
    lastMessage: useRef(null),   // Reference to the last received message
    readyState: socket?.readyState || 0, // WebSocket readyState (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider; // Optional: export default for convenience
