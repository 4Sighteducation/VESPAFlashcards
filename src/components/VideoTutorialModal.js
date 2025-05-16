import React, { useEffect } from 'react';
import './VideoTutorialModal.css'; // We'll create this CSS file next
import qrCodeImageFromFile from '../assets/QRFlash.png'; // Import the QR code image

const VideoTutorialModal = ({ isOpen, onClose, videoId = "fUYd2Z6" }) => {

  // Moved useEffect hook to the top level, before any early returns.
  useEffect(() => {
    // The logic inside the hook will only run if isOpen is true.
    if (isOpen) {
      const scriptId = 'muse-ai-player-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://muse.ai/static/js/embed-player.min.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
          const existingScript = document.getElementById(scriptId);
          if (existingScript) {
            // Optional: Consider if script removal is needed or if it handles multiple initializations.
            // If other modals/components might use the same script, removing it could be problematic.
            // For now, not removing to avoid potential issues if the script is meant to be persistent.
          }
        };
      } else {
        // If script exists, Muse.ai's script might re-scan for players automatically.
        // If not, and they provide a JS API function to re-initialize or scan, it could be called here.
        if (window.MusePlayer && typeof window.MusePlayer.scan === 'function') {
          // This is a hypothetical function. Check Muse.ai documentation for actual API.
          window.MusePlayer.scan(); 
        }
      }
    }
  }, [isOpen]); // Dependency array ensures this runs when isOpen changes.

  if (!isOpen) {
    return null;
  }

  // The plan is to allow multiple videos in the future.
  // For now, we'll hardcode the first video ID, but it can be made dynamic.
  const currentVideo = {
    id: videoId, // Default to the one you provided
    title: "Welcome to VESPA Flashcards!",
    // The div structure is now the primary way to embed
  };

  return (
    <div className="video-modal-overlay" onClick={onClose}>
      <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="video-modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h3>{currentVideo.title}</h3>
        <div className="video-container">
          {/* Muse.ai Responsive Popout Link */}
          <div 
            className="muse-video-popup" 
            data-video={currentVideo.id} 
            data-links="0" 
            data-width="100%" 
            data-thumbnail="1"
          ></div>
        </div>
        <div className="qr-code-section">
          <h4>Get the Mobile App!</h4>
          {/* Use the imported image */}
          <img src={qrCodeImageFromFile} alt="Download Mobile App QR Code" className="qr-code-image" />
          <p>Scan with your phone</p>
        </div>
        {/* 
          Future enhancement: Add a list or navigation for multiple videos here.
          For example:
          <div className="video-playlist">
            <h4>More Videos:</h4>
            <ul>
              <li>Video 1</li>
              <li>Video 2</li>
            </ul>
          </div>
        */}
      </div>
    </div>
  );
};

export default VideoTutorialModal; 