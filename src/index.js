import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import IntegrationTest from "./components/test/IntegrationTest";

// Force test mode for development
const FORCE_TEST_MODE = false; // Set this to false to disable test mode

// Get URL parameters and path
const queryParams = new URLSearchParams(window.location.search);
const path = window.location.pathname;

// Check various conditions for test mode
const hasTestParam = queryParams.has("test");
const pathIncludesTest = path.includes("test") || path.includes("Test");
const inTestMode = FORCE_TEST_MODE || hasTestParam || pathIncludesTest;

console.log("URL parameters:", window.location.search);
console.log("Path:", path);
console.log("Application starting in", inTestMode ? "TEST MODE" : "NORMAL MODE");

// Create root
const root = ReactDOM.createRoot(document.getElementById("root"));

// Render the appropriate component based on mode
root.render(
  <React.StrictMode>
    {inTestMode ? <IntegrationTest /> : <App />}
  </React.StrictMode>
);
