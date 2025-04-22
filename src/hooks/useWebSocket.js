import { useState, useEffect, useRef } from 'react';
import { useWebSocket as useWebSocketContext } from '../contexts/WebSocketContext';

// Enum for ready state constants (from WebSocket spec) - kept for backward compatibility
const ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

// This hook now uses the centralized WebSocketContext instead of creating its own connection
export const useWebSocket = (url) => {
  // Get the WebSocket state from our centralized context
  const {
    socket,
    isConnected,
    error,
    sendMessage: contextSendMessage,
    reconnect,
    lastMessage: contextLastMessage,
    readyState: contextReadyState
  } = useWebSocketContext();

  // If url is provided, show deprecation warning once
  const deprecationWarningShown = useRef(false);
  useEffect(() => {
    if (url && !deprecationWarningShown.current) {
      console.warn('[DEPRECATED] Passing URL directly to useWebSocket() is deprecated. The URL is now configured via environment variables and WebSocketContext.');
      deprecationWarningShown.current = true;
    }
  }, [url]);

  // State to track last message for backwards compatibility
  const [lastMessage, setLastMessage] = useState(null);

  // Update lastMessage when a new message comes from WebSocket context
  useEffect(() => {
    if (socket) {
      const messageHandler = (event) => {
        setLastMessage(event);
      };
      
      socket.addEventListener('message', messageHandler);
      return () => socket.removeEventListener('message', messageHandler);
    }
  }, [socket]);

  // Return an interface that matches the original useWebSocket hook
  return {
    sendMessage: contextSendMessage,
    lastMessage: lastMessage || contextLastMessage?.current,
    readyState: contextReadyState,
    reconnect, // New feature - ability to manually trigger reconnect
    isConnected, // New feature - explicit connection status
    error       // New feature - error information
  };
};

// Export ReadyState enum for backward compatibility
export { ReadyState };
