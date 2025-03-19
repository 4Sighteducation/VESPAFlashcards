import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IntegrationTest from './components/test/IntegrationTest';

// Mock auth provider to bypass Knack authentication requirements
const MockAuthProvider = ({ children }) => {
  // Create a mock auth object that mimics what your app expects
  const mockAuth = {
    id: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'student',
    openaiKey: process.env.REACT_APP_OPENAI_API_KEY || ''
  };

  // Set up mock environment
  useEffect(() => {
    // Mock Knack environment
    window.Knack = {
      getUserToken: () => 'mock-token-123456',
      getUserAttributes: () => ({
        name: 'Test User',
        email: 'test@example.com',
        user_id: 'test-user-123'
      })
    };

    // Add a message handler to intercept postMessage API calls
    const handleMessage = (event) => {
      // Log intercepted messages for debugging
      if (event.data && event.data.type) {
        console.log('Intercepted postMessage:', event.data);
        
        // If this is a save request, mock a success response
        if (event.data.type === 'TRIGGER_SAVE') {
          console.log('Mocking successful save operation');
          // You can mock a response here if needed
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Clean up
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return children;
};

const TestRouter = () => {
  return (
    <Router>
      <MockAuthProvider>
        <Routes>
          <Route path="/test" element={<IntegrationTest />} />
          <Route 
            path="*" 
            element={
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                fontFamily: 'system-ui, sans-serif' 
              }}>
                <h1>Integration Test Pages</h1>
                <div style={{ margin: '30px 0' }}>
                  <a 
                    href="/test" 
                    style={{ 
                      display: 'inline-block',
                      padding: '12px 24px',
                      background: '#06206e',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontWeight: '500'
                    }}
                  >
                    Open Test Page
                  </a>
                </div>
                <div style={{ marginTop: '20px', color: '#666' }}>
                  <p>This test environment provides mock authentication to test components without Knack integration.</p>
                </div>
              </div>
            } 
          />
        </Routes>
      </MockAuthProvider>
    </Router>
  );
};

export default TestRouter; 