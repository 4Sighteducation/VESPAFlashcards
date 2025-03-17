/**
 * Utility functions for the Flashcard application
 */

/**
 * Determines text color (black or white) based on background color brightness
 * @param {string} hexColor - Hex color code (e.g., #FFFFFF)
 * @returns {string} - Black or white color code depending on contrast
 */
export const getContrastColor = (hexColor) => {
  // Default to black if no color provided
  if (!hexColor) return '#000000';
  
  // Extract RGB values
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate brightness using YIQ formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return white for dark backgrounds, black for light backgrounds
  return brightness >= 128 ? '#000000' : '#ffffff';
};

/**
 * Adjusts a color by a percentage (lightens or darkens)
 * @param {string} hexColor - Hex color code to adjust
 * @param {number} percent - Percentage to adjust (-100 to 100)
 * @returns {string} - Adjusted hex color
 */
export const adjustColor = (hexColor, percent) => {
  let hex = hexColor.replace('#', '');
  
  // Convert to RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Adjust each channel
  r = Math.min(255, Math.max(0, r + Math.round((percent / 100) * 255)));
  g = Math.min(255, Math.max(0, g + Math.round((percent / 100) * 255)));
  b = Math.min(255, Math.max(0, b + Math.round((percent / 100) * 255)));
  
  // Convert back to hex
  const newHex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  return `#${newHex}`;
};

/**
 * Generate a hash number from a string (for color variations)
 * @param {string} str - String to hash
 * @returns {number} - Hash in range -20 to 20
 */
export const hashStringToPercent = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (hash % 41) - 20; // Range from -20 to 20
};

/**
 * Formats a date for display
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Truncates text to a specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text with ellipsis if needed
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Generates a unique ID for a card
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} - Unique ID
 */
export const generateUniqueId = (prefix = 'card') => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${randomStr}`;
};

/**
 * Sanitizes HTML content (basic implementation)
 * @param {string} html - HTML string to sanitize
 * @returns {string} - Sanitized HTML
 */
export const sanitizeHtml = (html) => {
  if (!html) return '';
  
  // Basic sanitization to prevent XSS
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Deep clones an object or array
 * @param {Object|Array} obj - Object to clone
 * @returns {Object|Array} - Cloned object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Calculates the next review date for a card based on its box number
 * @param {Object} card - Card object with boxNum property
 * @returns {string} - Formatted next review date string
 */
export const getNextReviewDate = (card) => {
  if (!card || !card.timestamp) return '';
  
  const timestamp = new Date(card.timestamp);
  if (isNaN(timestamp.getTime())) return '';
  
  const boxNum = card.boxNum || 1;
  
  // If card is in box 5, it's "retired"
  if (boxNum === 5) {
    return 'Retired';
  }
  
  // Calculate days to add based on box
  let daysToAdd;
  switch (boxNum) {
    case 1: daysToAdd = 1; break;
    case 2: daysToAdd = 2; break;
    case 3: daysToAdd = 3; break;
    case 4: daysToAdd = 7; break;
    default: daysToAdd = 1;
  }
  
  // Add days to timestamp
  const nextDate = new Date(timestamp);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  
  // Format date
  return formatDate(nextDate.toISOString());
};

/**
 * Check if a card needs review based on its timestamp and box
 * @param {Object} card - Card object
 * @returns {boolean} - True if card needs review
 */
export const needsReview = (card) => {
  if (!card || !card.timestamp || card.boxNum === 5) return false;
  
  const date = new Date(card.timestamp);
  if (isNaN(date.getTime())) return true;
  
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  switch (card.boxNum) {
    case 1: return diffDays >= 1;
    case 2: return diffDays >= 2;
    case 3: return diffDays >= 3;
    case 4: return diffDays >= 7;
    default: return true;
  }
};
