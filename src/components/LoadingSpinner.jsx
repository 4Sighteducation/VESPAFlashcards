import React from "react";
import "./LoadingSpinner.css";

const LoadingSpinner = ({ message = "Loading...", size = "default", fullScreen = false }) => {
  // Define size classes
  const sizeClasses = {
    small: "spinner-small",
    medium: "spinner-medium",
    large: "spinner-large",
    default: ""
  };
  
  const sizeClass = sizeClasses[size] || "";
  const containerClass = fullScreen ? "loading-container fullscreen" : "loading-container";
  
  return (
    <div className={containerClass}>
      <div className={`spinner ${sizeClass}`}></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
