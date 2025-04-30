import React, { useEffect, useRef, useState } from 'react';

/**
 * Enhanced ScaledText component that aggressively scales text to fit within its container
 * while ensuring all content is visible without scrolling.
 */
const ScaledText = ({ 
  children, 
  className = '', 
  maxFontSize = 24, 
  minFontSize = 8, // Lower minimum to allow extreme shrinking for long content
  isInModal = false,
  isQuestion = false,
  isOption = false // New prop to identify if this is an option, which needs special handling
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState(maxFontSize);
  
  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current || !textRef.current) return;
      
      const container = containerRef.current;
      const textElement = textRef.current;
      
      // Convert children to string for length checking, handling React elements
      const contentText = React.isValidElement(children) 
        ? textElement.textContent || ''
        : children ? children.toString() : '';
      
      const contentLength = contentText.length;
      
      // Check device properties
      const isMobile = window.innerWidth <= 768;
      
      // Determine appropriate starting font size based on context and content length
      let startFontSize = maxFontSize;
      
      // More aggressive content-based scaling
      if (isOption) {
        // Options need to be very small for long content
        startFontSize = Math.min(maxFontSize, 14); // Always start smaller for options
        
        // Scale down progressively based on content length
        if (contentLength > 50) startFontSize = 12;
        if (contentLength > 100) startFontSize = 10;
        if (contentLength > 150) startFontSize = 9;
        if (contentLength > 200) startFontSize = 8;
      } else if (isQuestion) {
        // Questions should remain readable but adapt to length
        startFontSize = isInModal 
          ? (isMobile ? 18 : 22) // Modal questions
          : (isMobile ? 16 : 20); // Regular questions
          
        // More aggressive question scaling based on length
        if (contentLength > 100) startFontSize -= 2;
        if (contentLength > 200) startFontSize -= 2;
        if (contentLength > 300) startFontSize -= 3;
        if (contentLength > 400) startFontSize -= 3;
      } else {
        // Regular text (like answers)
        startFontSize = isInModal 
          ? (isMobile ? 16 : 20) // Modal text
          : (isMobile ? 14 : 18); // Regular text
          
        // Progressive scaling for answer text
        if (contentLength > 100) startFontSize -= 2;
        if (contentLength > 200) startFontSize -= 2;
        if (contentLength > 300) startFontSize -= 3;
        if (contentLength > 500) startFontSize -= 3;
      }
      
      // Set initial font size
      textElement.style.fontSize = `${startFontSize}px`;
      
      // Binary search for optimal font size
      const findOptimalSize = (min, max) => {
        if (max - min <= 1) return min; // Stop when we're within 1px
        
        const mid = Math.floor((min + max) / 2);
        textElement.style.fontSize = `${mid}px`;
        
        const isOverflowing = (
          textElement.scrollHeight > container.clientHeight || 
          textElement.scrollWidth > container.clientWidth
        );
        
        return isOverflowing ? findOptimalSize(min, mid) : findOptimalSize(mid, max);
      };
      
      // Check if initial size overflows
      const isInitiallyOverflowing = (
        textElement.scrollHeight > container.clientHeight || 
        textElement.scrollWidth > container.clientWidth
      );
      
      if (isInitiallyOverflowing) {
        // Use binary search to find optimal size more efficiently
        const optimalSize = findOptimalSize(minFontSize, startFontSize);
        textElement.style.fontSize = `${optimalSize}px`;
        setFontSize(optimalSize);
      } else {
        setFontSize(startFontSize);
      }
      
      // If this is an option, ensure line height is tight for better space usage
      if (isOption) {
        textElement.style.lineHeight = '1.1';
      }
    };
    
    // Run adjustment after a short delay to ensure DOM has updated
    const timeoutId = setTimeout(adjustFontSize, 50);
    
    // Also adjust on resize
    window.addEventListener('resize', adjustFontSize);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', adjustFontSize);
    };
  }, [children, maxFontSize, minFontSize, isInModal, className, isQuestion, isOption]);
  
  return (
    <div className={`scaled-text ${className || ''}`} ref={containerRef} style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <div ref={textRef} style={{
        width: '100%',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: `${fontSize}px` // Use the state to ensure consistent rendering
      }}>
        {children}
      </div>
    </div>
  );
};

export default ScaledText;
