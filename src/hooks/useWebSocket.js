import { useState, useEffect, useRef, useCallback } from 'react';

// Default WebSocket URL (use environment variable, fallback for local dev)
const DEFAULT_WS_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080';

console.log(`WebSocket Hook connecting to: ${DEFAULT_WS_URL}`);

// Enum for ready state constants (from WebSocket spec)
const ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

export const useWebSocket = (url = DEFAULT_WS_URL) => {
  const [readyState, setReadyState] = useState(ReadyState.CLOSED);
  const [lastMessage, setLastMessage] = useState(null);
  const ws = useRef(null); // Ref to store the WebSocket instance
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectInterval = useRef(1000); // Initial reconnect interval 1 second

  const connect = useCallback(() => {
    if (ws.current && ws.current.readyState !== ReadyState.CLOSED) {
        console.log('WebSocket already connecting/open.');
        return;
    }

    if (!url) {
        console.error('WebSocket URL is not defined!');
        setReadyState(ReadyState.CLOSED);
        return;
    }

    console.log(`Attempting to connect WebSocket to ${url}...`);
    setReadyState(ReadyState.CONNECTING);

    try {
        ws.current = new WebSocket(url);
    } catch (error) {
        console.error("WebSocket instantiation failed:", error);
        setReadyState(ReadyState.CLOSED);
        // Schedule reconnect attempt immediately if instantiation fails
        if (reconnectAttempts.current < maxReconnectAttempts) {
             setTimeout(connect, reconnectInterval.current);
             reconnectAttempts.current++;
             reconnectInterval.current = Math.min(reconnectInterval.current * 2, 30000); // Exponential backoff up to 30s
        }
        return;
    }

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setReadyState(ReadyState.OPEN);
      reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      reconnectInterval.current = 1000; // Reset reconnect interval
      // Optionally send an init message upon connection
      // sendMessage(JSON.stringify({ type: 'client_init', message: 'React client connected' }));
    };

    ws.current.onmessage = (event) => {
      // console.log('WebSocket message received:', event.data);
      setLastMessage(event); // Store the entire event object
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket Error:', error);
      // The 'onclose' event will likely fire after an error, handling reconnection there.
      // However, ensure readyState reflects an issue if needed, though CLOSED is typical.
       if (ws.current?.readyState !== ReadyState.OPEN) {
           setReadyState(ReadyState.CLOSED); // Ensure state reflects closure on error if not already open
       }
    };

    ws.current.onclose = (event) => {
      console.log(`WebSocket Closed: Code=${event.code}, Reason=${event.reason}, Clean=${event.wasClean}`);
      setReadyState(ReadyState.CLOSED);
      ws.current = null; // Clear the ref

      // Reconnection logic
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const timeout = reconnectInterval.current;
        console.log(`Attempting WebSocket reconnect in ${timeout / 1000} seconds (Attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})...`);
        setTimeout(connect, timeout);
        reconnectAttempts.current++;
        reconnectInterval.current = Math.min(reconnectInterval.current * 2, 30000); // Exponential backoff
      } else {
        console.error('WebSocket max reconnect attempts reached.');
      }
    };

  }, [url]); // Rerun connect if the URL changes

  // Effect to establish connection and handle cleanup
  useEffect(() => {
    connect(); // Initial connection attempt

    // Cleanup function
    return () => {
        if (ws.current) {
            console.log('Closing WebSocket connection (hook cleanup)');
            reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnect attempts after deliberate close
            ws.current.close(1000, "Component unmounted"); // Close gracefully
            ws.current = null;
        }
    };
  }, [connect]); // Re-run effect if connect function instance changes (due to URL change)

  // Stable sendMessage function
  const sendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === ReadyState.OPEN) {
      try {
            // console.log('Sending WebSocket message:', message);
            ws.current.send(message);
      } catch (error) {
          console.error("WebSocket failed to send message:", error);
      }
    } else {
      console.warn('WebSocket not connected. Message not sent:', message);
      // Optionally queue the message or notify the user
    }
  }, []); // No dependencies, ws.current is a ref

  return { sendMessage, lastMessage, readyState };
};

// Export ReadyState enum if components need to check specific states
export { ReadyState };