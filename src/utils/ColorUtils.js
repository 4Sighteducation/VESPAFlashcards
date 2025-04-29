/**
 * ColorUtils.js - Centralized utility functions for color handling
 * Contains functions for contrast calculation, shade generation, and other color operations
 */

/**
 * Calculate appropriate text color (black or white) based on background color brightness
 * Uses WCAG luminance formula for accurate contrast perception
 * @param {string} hexColor - Hex color code (e.g., "#ff0000")
 * @returns {string} - Either "#000000" (black) or "#ffffff" (white) for best contrast
 */
export const getContrastColor = (hexColor) => {
  // Default to black if no color provided
  if (!hexColor || typeof hexColor !== 'string') {
    console.warn('Invalid color provided to getContrastColor:', hexColor);
    return '#000000';
  }
  
  try {
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Handle 3-character hex
    if (hexColor.length === 3) {
      hexColor = hexColor[0] + hexColor[0] + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2];
    }
    
    // Validate hex format
    if (!/^[0-9A-F]{6}$/i.test(hexColor)) {
      console.warn('Invalid hex color format:', hexColor);
      return '#000000';
    }
    
    // Convert to RGB
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    // Handle NaN values that might occur with invalid hex colors
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn('Invalid RGB conversion in getContrastColor:', { r, g, b, hexColor });
      return '#000000';
    }
    
    // Use WCAG luminance formula for better contrast perception
    // L = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    
    // Calculate contrast with white and black
    const contrastWithWhite = (luminance + 0.05) / 0.05;
    const contrastWithBlack = (1.05) / (luminance + 0.05);
    
    // Choose color with better contrast (higher contrast ratio)
    const chosenColor = contrastWithWhite > contrastWithBlack ? '#ffffff' : '#000000';
    
    // For debugging only - log only in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[getContrastColor] Lum: ${luminance.toFixed(3)}, Contrast White: ${contrastWithWhite.toFixed(2)}, Contrast Black: ${contrastWithBlack.toFixed(2)}, Chosen: ${chosenColor}`);
    }
    
    return chosenColor;
  } catch (error) {
    console.error('Error in getContrastColor:', error, { inputColor: hexColor });
    return '#000000'; // Default to black on error
  }
};

/**
 * Generate a shade of a color by lightening or darkening
 * @param {string} color - Hex color code (e.g., "#ff0000")
 * @param {number} percent - Percent to lighten (positive) or darken (negative)
 * @returns {string} - New hex color
 */
export const generateShade = (color, percent) => {
  if (!color || typeof color !== 'string' || !color.startsWith('#')) {
    console.warn("[generateShade] Invalid base color:", color, "Using fallback #f0f0f0");
    color = '#f0f0f0'; // Fallback color
  }
  try {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = Math.max(0, Math.min(255, R)); // Clamp values between 0 and 255
    G = Math.max(0, Math.min(255, G));
    B = Math.max(0, Math.min(255, B));

    const RR = R.toString(16).padStart(2, '0'); // Use padStart for cleaner hex conversion
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return "#" + RR + GG + BB;
  } catch (error) {
    console.error("[generateShade] Error processing color:", color, error);
    return '#f0f0f0'; // Fallback on error
  }
};

/**
 * Standard color palette for cards and topics
 */
export const BRIGHT_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe",
  "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
  "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C"
];

/**
 * Get a random color from the palette
 * @returns {string} - Random hex color
 */
export const getRandomColor = () => {
  return BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
};
