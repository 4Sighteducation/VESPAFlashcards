import React, { useEffect, useRef, useState } from 'react';

/**
 * Enhanced ScaledText component that aggressively scales text to fit within its container
 * while ensuring all content is visible without scrolling.
 */
const ScaledText = ({ 
  children, 
  className = '', 
  maxFontSize = 24, 
  minFontSize = 6, // Lowered minimum font size significantly
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
      
      // Clear previous styles that might interfere with measurement
      textElement.style.fontSize = '';
      textElement.style.lineHeight = '';
      
      // Determine target container dimensions (use clientHeight/Width)
      const targetHeight = container.clientHeight;
      const targetWidth = container.clientWidth;
      
      // --- More Aggressive Binary Search ---
      let low = minFontSize;
      let high = maxFontSize;
      let optimalSize = minFontSize; // Default to min if nothing fits
      
      // Iterate to find the best fit size
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        textElement.style.fontSize = `${mid}px`;
        // Adjust line-height slightly for options during measurement
        textElement.style.lineHeight = isOption ? '1.15' : '1.3'; 
        
        // Check for overflow using scrollHeight/Width compared to clientHeight/Width
        const isOverflowing = (
          textElement.scrollHeight > targetHeight ||
          textElement.scrollWidth > targetWidth
        );
        
        if (isOverflowing) {
          high = mid - 1; // Too big, try smaller
        } else {
          optimalSize = mid; // Fits, try larger
          low = mid + 1;
        }
      }
      
      // Apply the optimal font size and line height
      textElement.style.fontSize = `${optimalSize}px`;
      textElement.style.lineHeight = isOption ? '1.15' : '1.3'; // Apply final line height
      setFontSize(optimalSize); // Update state
    };
    
    // Use ResizeObserver for more reliable container size detection
    const resizeObserver = new ResizeObserver(entries => {
       // Use requestAnimationFrame to avoid layout thrashing
       window.requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) {
            return;
          }
         // Simple trigger on any resize event
          adjustFontSize();
       });
    });
    
    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
        // Initial adjustment needed as well
        adjustFontSize();
    }
    
    // Adjust on window resize too as a fallback
    window.addEventListener('resize', adjustFontSize);
    
    return () => {
      if (containerRef.current) {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          resizeObserver.unobserve(containerRef.current);
      }
      window.removeEventListener('resize', adjustFontSize);
    };
    // Depend on children content to re-run scaling if text changes
  }, [children, maxFontSize, minFontSize, isInModal, className, isQuestion, isOption]);
  
  return (
    <div
      className={`scaled-text-container ${className || ''}`} // Renamed class for clarity
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',          // Use flexbox for centering
        alignItems: 'center',     // Center vertically
        justifyContent: 'center', // Center horizontally
        textAlign: 'center',      // Ensure text itself is centered
        overflow: 'hidden',       // Critical: prevent container overflow
        padding: '1px 2px'        // Small padding to avoid text touching edges
      }}
    >
      <div
        ref={textRef}
        className="scaled-text-content" // Added class for content
        style={{
          width: '100%',            // Allow text element to use full width for measurement
          fontSize: `${fontSize}px`, // Apply calculated font size
          lineHeight: isOption ? '1.15' : '1.3', // Apply consistent line height
          wordBreak: 'break-word',   // Allow words to break
          overflowWrap: 'break-word',// Ensure wrapping
          overflow: 'hidden',       // Hide any final overflow (shouldn't happen ideally)
          maxHeight: '100%'         // Prevent text element from exceeding container height
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScaledText;
