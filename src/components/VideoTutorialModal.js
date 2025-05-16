import React from 'react';
import './VideoTutorialModal.css';
import qrCodeImageFromFile from '../assets/QRFlash.png';

const VideoTutorialModal = ({ isOpen, onClose, videoId = "fUYd2Z6" }) => {

  if (!isOpen) {
    return null;
  }

  // Use the direct video content URL provided by the user
  const videoWatchUrl = `https://muse.ai/vc/${videoId}`;
  const videoTitle = "Welcome to VESPA Flashcards!";

  const handlePlayVideo = () => {
    window.open(videoWatchUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="video-modal-overlay" onClick={onClose}>
      <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="video-modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h3>{videoTitle}</h3>
        
        <div className="video-placeholder-section">
          <p>Click the button below to watch our quick welcome tutorial!</p>
          <button className="modal-play-video-btn" onClick={handlePlayVideo}>
            🎬 Watch Welcome Tutorial
          </button>
        </div>

        <div className="qr-code-section">
          <h4>Get the Mobile App!</h4>
          <img src={qrCodeImageFromFile} alt="Download Mobile App QR Code" className="qr-code-image" />
          <p>Scan with your phone</p>
        </div>
      </div>
    </div>
  );
};

export default VideoTutorialModal; 