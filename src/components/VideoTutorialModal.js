import React from 'react';
import './VideoTutorialModal.css';
import qrCodeImageFromFile from '../assets/QRFlash.png';

const VideoTutorialModal = ({ isOpen, onClose, videoId = "fUYd2Z6" }) => {

  if (!isOpen) {
    return null;
  }

  const currentVideo = {
    id: videoId,
    title: "Welcome to VESPA Flashcards!",
    embedUrl: `https://muse.ai/embed/${videoId}?links=0` // For the iframe
  };

  return (
    <div className="video-modal-overlay" onClick={onClose}>
      <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="video-modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h3>{currentVideo.title}</h3>
        <div className="video-container">
          {/* Switched back to iframe embed */}
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', maxWidth: '100%' }}>
            <iframe
              src={currentVideo.embedUrl}
              style={{ width: '100%', height: '100%', position: 'absolute', left: 0, top: 0 }}
              frameBorder="0"
              allowFullScreen // Standard attribute for fullscreen
              title={currentVideo.title}
            ></iframe>
          </div>
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