import React, { useEffect } from 'react';
import './VideoTutorialModal.css'; // We'll create this CSS file next
import qrCodeImageFromFile from '../assets/QRFlash.png'; // Import the QR code image

const VideoTutorialModal = ({ isOpen, onClose, videoId = "fUYd2Z6" }) => {
  if (!isOpen) {
    return null;
  }

  // This effect will run when the component mounts and if isOpen changes.
  // It's a more robust way to ensure an external script is loaded if it isn't already global.
  // However, for the Muse.ai player, it's often best to include their script ONCE in your public/index.html.
  // If it IS in index.html, this useEffect might be redundant for script loading but doesn't hurt.
  // If the script initializes players on load, and this modal content is added later,
  // sometimes a re-initialization or a new script load is needed for dynamic content.
  useEffect(() => {
    if (isOpen) {
      const scriptId = 'muse-ai-player-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://muse.ai/static/js/embed-player.min.js';
        script.async = true;
        document.body.appendChild(script);

        // Optional: Clean up script when modal is closed or component unmounts
        // This is good practice but might not be strictly necessary if Muse.ai script handles itself well.
        return () => {
          const existingScript = document.getElementById(scriptId);
          if (existingScript) {
            // document.body.removeChild(existingScript); // Be cautious removing if other modals might use it
          }
        };
      } else {
        // If script exists, sometimes players need a re-scan/re-init for dynamically added divs.
        // Muse.ai's script might handle this automatically. If not, they might offer a JS API function to do so.
        if (window.MusePlayer && typeof window.MusePlayer.scan === 'function') {
          window.MusePlayer.scan();
        }
      }
    }
  }, [isOpen]);

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