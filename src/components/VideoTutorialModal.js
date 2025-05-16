import React from 'react';
import './VideoTutorialModal.css'; // We'll create this CSS file next

const VideoTutorialModal = ({ isOpen, onClose, videoId = "fUYd2Z6" }) => {
  if (!isOpen) {
    return null;
  }

  // The plan is to allow multiple videos in the future.
  // For now, we'll hardcode the first video ID, but it can be made dynamic.
  const currentVideo = {
    id: videoId, // Default to the one you provided
    title: "Welcome to VESPA Flashcards!",
    embedUrl: `https://muse.ai/embed/${videoId}?links=0`
  };

  return (
    <div className="video-modal-overlay" onClick={onClose}>
      <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="video-modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h3>{currentVideo.title}</h3>
        <div className="video-container">
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', maxWidth: '100%' }}>
            <iframe
              src={currentVideo.embedUrl}
              style={{ width: '100%', height: '100%', position: 'absolute', left: 0, top: 0 }}
              frameBorder="0"
              allowFullScreen
              title={currentVideo.title}
            ></iframe>
          </div>
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