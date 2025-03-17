import React, { useEffect, useRef } from 'react';

/**
 * ScaledText component that automatically scales text to fit within its container
 * while ensuring minimum readability standards.
 */
const ScaledText = ({ 
  children, 
  className = '', 
  maxFontSize = 24, 
  minFontSize = 14, 
  isInModal = false,
  isQuestion = false 
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  
  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current || !textRef.current) return;
      
      const container = containerRef.current;
      const textElement = textRef.current;
      const contentLength = children ? children.toString().length : 0;
      
      // Check device properties
      const isMobile = window.innerWidth <= 768;
      const isSmallScreen = window.innerWidth <= 480;
      
      // Start with a more reasonable font size based on context
      let startFontSize = maxFontSize;
      
      // Questions should be more readable
      if (isQuestion || className.includes('question')) {
        // Higher starting size for questions
        startFontSize = isInModal 
          ? (isMobile ? 20 : 28) // Modal questions
          : (isMobile ? 18 : 24); // Regular questions
          
        // Still adjust based on length, but more conservatively
        if (contentLength > 300) startFontSize -= 2;
        if (contentLength > 500) startFontSize -= 2;
      } else {
        // Regular text sizing
        startFontSize = isInModal 
          ? (isMobile ? 18 : 24) // Modal text
          : (isMobile ? 16 : 20); // Regular text
          
        // More aggressive adjustment for regular text
        if (contentLength > 200) startFontSize -= 2;
        if (contentLength > 300) startFontSize -= 2;
        if (contentLength > 400) startFontSize -= 2;
      }
      
      // Special handling for multiple choice questions
      if (className.includes('question-title') && 
          container.closest('.flashcard-front')?.querySelector('.options-container')) {
        // Leave more room for options, but don't go too small
        startFontSize = Math.min(startFontSize, isMobile ? 18 : 22);
      }
      
      // For debugging
      console.log(`ScaledText (${className}) length: ${contentLength}, starting fontSize: ${startFontSize}`);
      
      // Set initial font size
      textElement.style.fontSize = `${startFontSize}px`;
      
      // Check if text overflows
      let isOverflowing = (
        textElement.scrollHeight > container.clientHeight || 
        textElement.scrollWidth > container.clientWidth
      );
      
      // If overflowing, reduce size until it fits
      if (isOverflowing) {
        let currentSize = startFontSize;
        
        while (isOverflowing && currentSize > minFontSize) {
          currentSize -= 1;
          textElement.style.fontSize = `${currentSize}px`;
          
          isOverflowing = (
            textElement.scrollHeight > container.clientHeight || 
            textElement.scrollWidth > container.clientWidth
          );
        }
        
        console.log(`ScaledText adjusted to fontSize: ${currentSize}px`);
      }
      
      // Ensure questions meet minimum requirements
      if (isQuestion || className.includes('question')) {
        const currentFontSize = parseFloat(textElement.style.fontSize);
        const enforcedMinimum = isMobile ? 14 : 16;
        
        if (currentFontSize < enforcedMinimum) {
          textElement.style.fontSize = `${enforcedMinimum}px`;
          console.log(`ScaledText enforced minimum: ${enforcedMinimum}px for question`);
          
          // If we're enforcing a minimum that causes overflow, allow scrolling
          if (textElement.scrollHeight > container.clientHeight) {
            container.style.overflowY = 'auto';
          }
        }
      }
    };
    
    // Initial adjustment
    adjustFontSize();
    
    // Adjust on resize
    window.addEventListener('resize', adjustFontSize);
    
    return () => window.removeEventListener('resize', adjustFontSize);
  }, [children, maxFontSize, minFontSize, isInModal, className, isQuestion]);
  
  return (
    <div className={`scaled-text ${className}`} ref={containerRef}>
      <div ref={textRef}>{children}</div>
    </div>
  );
};

export default ScaledText; 