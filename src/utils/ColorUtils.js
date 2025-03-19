/**
 * Utility functions for generating and managing colors
 */

/**
 * Generate a shade of a base color for topics
 * @param {string} baseColor - The base color in hex format (e.g. #FF0000)
 * @param {number} topicIndex - The index of the topic in the list
 * @param {number} totalTopics - The total number of topics
 * @returns {string} - A hex color code
 */
export const generateTopicShade = (baseColor, topicIndex, totalTopics) => {
  // Remove # if present
  const hex = baseColor.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Handle invalid color values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn("Invalid color format", baseColor);
    return baseColor;
  }
  
  // Convert to HSL (easier to adjust lightness)
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Calculate lightness adjustment factor
  // We want to create a range of variations where each topic is distinct
  // but maintains a relationship to the base color
  const minLightness = Math.max(l - 0.15, 0.15); // Don't go too dark
  const maxLightness = Math.min(l + 0.25, 0.85); // Don't go too light
  
  // Create a range of lightness values that spans from min to max
  const lightnessRange = maxLightness - minLightness;
  // Distribute the topics evenly across the range
  const adjustedLightness = minLightness + (lightnessRange * (topicIndex / Math.max(totalTopics - 1, 1)));
  
  // Slightly adjust saturation too for more variation
  const adjustedSaturation = Math.min(s * 1.1, 1.0);
  
  // Convert back to RGB
  const [adjustedR, adjustedG, adjustedB] = hslToRgb(h, adjustedSaturation, adjustedLightness);
  
  // Convert to hex
  return '#' + 
    Math.round(adjustedR).toString(16).padStart(2, '0') +
    Math.round(adjustedG).toString(16).padStart(2, '0') +
    Math.round(adjustedB).toString(16).padStart(2, '0');
};

/**
 * Determine if a color is dark (needs white text) or light (needs black text)
 * @param {string} hexColor - Hex color code
 * @returns {string} - Either "#ffffff" for dark backgrounds or "#000000" for light backgrounds
 */
export const getContrastColor = (hexColor) => {
  if (!hexColor) return "#000000";
  
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);
  
  // Calculate brightness using YIQ formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return white for dark backgrounds, black for light backgrounds
  return brightness > 125 ? "#000000" : "#ffffff";
};

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Array} - [h, s, l] where h is 0-360, s and l are 0-1
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    
    h /= 6;
  }

  return [h, s, l];
}

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {Array} - [r, g, b] where r, g, b are 0-255
 */
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [r * 255, g * 255, b * 255];
}

/**
 * Generate a random vibrant color
 * @returns {string} - A hex color code
 */
export const getRandomColor = () => {
  // Default bright colors palette
  const brightColors = [
    "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231", 
    "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe", 
    "#008080", "#e6beff", "#aa6e28", "#fffac8", "#800000", 
    "#aaffc3", "#808000", "#ffd8b1", "#000080", "#808080",
    "#FF69B4", "#8B4513", "#00CED1", "#ADFF2F", "#DC143C",
  ];
  
  // Return a random color from the palette
  return brightColors[Math.floor(Math.random() * brightColors.length)];
};
