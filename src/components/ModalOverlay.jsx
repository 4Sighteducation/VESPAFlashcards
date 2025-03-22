import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ModalOverlay.css';

/**
 * A reusable modal overlay component that properly handles positioning,
 * z-index, backdrop, and keyboard events for all modals in the application.
 */
const ModalOverlay = ({ children, isOpen, onClose, zIndex = 1000, className = '', preventScroll = true }) => {
  const overlayRef = useRef(null);

  useEffect(() => {
    // Prevent scrolling of body when modal is open
    if (preventScroll && isOpen) {
      document.body.style.overflow = 'hidden';
    }
    
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      // Restore scrolling when modal is closed
      if (preventScroll) {
        document.body.style.overflow = '';
      }
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, preventScroll]);
  
  useEffect(() => {
    // Focus trap - focus first focusable element in modal
    if (isOpen && overlayRef.current) {
      const focusableElements = overlayRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [isOpen]);
  
  const handleOverlayClick = (event) => {
    // Close modal when clicking overlay background (not modal content)
    if (event.target === overlayRef.current) {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  // Use createPortal to render modal at the root level of the DOM
  return createPortal(
    <div 
      className={`modal-overlay ${className}`}
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{ zIndex }}
      aria-modal="true"
      role="dialog"
      data-testid="modal-overlay"
    >
      <div className="modal-container">
        {children}
      </div>
    </div>,
    document.body
  );
};

export default ModalOverlay; 