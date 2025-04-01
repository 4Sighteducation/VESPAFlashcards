import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// Define the WebSocket URL based on the Heroku app
const WEBSOCKET_URL = 'wss://vespa-flashcards-e7f31e9ff3c9.herokuapp.com/';

// Create the context
const WebSocketContext = createContext(null);

// Custom hook to use the WebSocket context
export const useWebSocket = () => {
  return useContext(WebSocketContext);
};

// Provider component
export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5; // Limit reconnection attempts
  const reconnectTimeout = useRef(null);

  const connectWebSocket = () => {
    console.log(`[WebSocketProvider] Attempting to connect to ${WEBSOCKET_URL}...`);
    setError(null); // Clear previous errors on new attempt

    // Ensure WebSocket is available (it should be in modern browsers)
    if (!window.WebSocket) {
        console.error("[WebSocketProvider] WebSocket API not supported by this browser.");
        setError("WebSocket is not supported by your browser.");
        return;
    }

    const ws = new WebSocket(WEBSOCKET_URL);

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
    };

    ws.onclose = (event) => {
      console.log('[WebSocketProvider] WebSocket Disconnected:', event.code, event.reason);
      setIsConnected(false);
      setSocket(null); // Clear the socket instance

      // Attempt to reconnect only if not a normal closure (1000) and within limits
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
        console.log(`[WebSocketProvider] Attempting reconnect ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay / 1000}s...`);
        reconnectTimeout.current = setTimeout(connectWebSocket, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
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

    // Note: onmessage is not handled globally here.
    // Components like TopicCreationModal should add specific listeners
    // to the 'socket' instance provided by this context if they need to react to messages.
    // Example in component:
    // const { socket } = useWebSocket();
    // useEffect(() => {
    //   if (socket) {
    //     const messageHandler = (event) => { /* process event.data */ };
    //     socket.addEventListener('message', messageHandler);
    //     return () => socket.removeEventListener('message', messageHandler);
    //   }
    // }, [socket]);

    // We don't set the socket state here immediately anymore, only on 'onopen'
    // setSocket(ws);
  };

  useEffect(() => {
    connectWebSocket(); // Initial connection attempt

    // Cleanup function when the provider unmounts
    return () => {
      console.log('[WebSocketProvider] Cleaning up WebSocket connection.');
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (socket) {
        // Remove listeners before closing to prevent state updates on unmounted component
         socket.onopen = null;
         socket.onclose = null;
         socket.onerror = null;
         socket.onmessage = null; // Ensure no message listeners linger
        socket.close(1000, 'Component unmounting'); // Normal closure code
      }
      setIsConnected(false);
      setSocket(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // Value provided by the context
  const contextValue = {
    socket,        // The WebSocket instance (or null if not connected)
    isConnected,   // Boolean indicating connection status
    error,         // Any connection error message
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider; // Optional: export default for convenience