/**
 * ColorUtils.js - Centralized utility functions for color handling
 * Contains functions for contrast calculation, shade generation, and other color operations
 */

// --- HSL to RGB Conversion Helper ---
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Calculate appropriate text color (black or white) based on background color brightness
 * Uses WCAG luminance formula for accurate contrast perception
 * Handles both HEX and HSL color formats.
 * @param {string} colorInput - Hex color code (e.g., "#ff0000") or HSL string (e.g., "hsl(120, 100%, 50%)")
 * @returns {string} - Either "#000000" (black) or "#ffffff" (white) for best contrast
 */
export const getContrastColor = (colorInput) => {
  // Default to black if no color provided or not a string
  if (!colorInput || typeof colorInput !== 'string') {
    console.warn('Invalid color provided to getContrastColor:', colorInput);
    return '#000000';
  }

  let r, g, b;

  try {
    // Check if input is HSL
    if (colorInput.trim().toLowerCase().startsWith('hsl')) {
      // Extract H, S, L values
      const match = colorInput.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i);
      if (match) {
        const h = parseInt(match[1], 10) / 360;
        const s = parseInt(match[2], 10) / 100;
        const l = parseInt(match[3], 10) / 100;
        // Convert HSL to RGB
        [r, g, b] = hslToRgb(h, s, l);
      } else {
        console.warn('Invalid HSL color format:', colorInput);
        return '#000000'; // Fallback for invalid HSL
      }
    } 
    // Assume HEX format otherwise
    else {
      let hexColor = colorInput.replace('#', '');
      
      // Handle 3-character hex
      if (hexColor.length === 3) {
        hexColor = hexColor[0] + hexColor[0] + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2];
      }
      
      // Validate hex format
      if (!/^[0-9A-F]{6}$/i.test(hexColor)) {
        console.warn('Invalid hex color format:', colorInput);
        return '#000000';
      }
      
      // Convert HEX to RGB
      r = parseInt(hexColor.substring(0, 2), 16);
      g = parseInt(hexColor.substring(2, 4), 16);
      b = parseInt(hexColor.substring(4, 6), 16);
    }
    
    // Handle NaN values that might occur with invalid conversions
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn('Invalid RGB conversion in getContrastColor:', { r, g, b, colorInput });
      return '#000000';
    }
    
    // Use WCAG luminance formula for better contrast perception
    // L = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    
    // Choose text color based on luminance threshold (WCAG AA requires 4.5:1 contrast)
    // Threshold of 0.5 is a common heuristic, but 0.179 is closer to the WCAG boundary
    const chosenColor = luminance > 0.179 ? '#000000' : '#ffffff'; 
    
    // For debugging only - log only in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[getContrastColor] Input: ${colorInput}, RGB: ${r},${g},${b}, Lum: ${luminance.toFixed(3)}, Chosen: ${chosenColor}`);
    }
    
    return chosenColor;

  } catch (error) {
    console.error('Error in getContrastColor:', error, { inputColor: colorInput });
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
 * Ensures a valid, consistent structure for the color mapping object
 * Normalizes legacy string format to the newer object format
 * @param {Object} colorMapping - The color mapping object to validate
 * @returns {Object} - A validated and normalized color mapping object
 */
export const ensureValidColorMapping = (colorMapping) => {
  if (!colorMapping || typeof colorMapping !== 'object') return {};
  
  const updatedMapping = JSON.parse(JSON.stringify(colorMapping));
  
  Object.keys(updatedMapping).forEach(subject => {
    const subjectData = updatedMapping[subject];
    
    // Convert string values to proper structure
    if (typeof subjectData === 'string') {
      updatedMapping[subject] = {
        base: subjectData,
        topics: {}
      };
    } 
    // Ensure each subject has 'base' and 'topics' properties
    else if (typeof subjectData === 'object' && subjectData !== null) {
      if (!subjectData.base) {
        subjectData.base = '#f0f0f0';
      }
      if (!subjectData.topics || typeof subjectData.topics !== 'object') {
        subjectData.topics = {};
      }
    }
    // Replace invalid values with proper structure
    else {
      updatedMapping[subject] = {
        base: '#f0f0f0',
        topics: {}
      };
    }
  });
  
  return updatedMapping;
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
