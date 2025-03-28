/**
 * ColorManager.js
 * 
 * Service for managing subject and topic colors consistently throughout the application.
 * Ensures each subject gets a unique color and topics get consistent color variations.
 */

// Palette of bright, distinguishable colors for subjects
const SUBJECT_COLORS = [
  "#e6194b", // Red
  "#3cb44b", // Green
  "#ffe119", // Yellow
  "#0082c8", // Blue
  "#f58231", // Orange
  "#911eb4", // Purple
  "#46f0f0", // Cyan
  "#f032e6", // Magenta
  "#d2f53c", // Lime
  "#fabebe", // Pink
  "#008080", // Teal
  "#e6beff", // Lavender
  "#aa6e28", // Brown
  "#800000", // Maroon
  "#808000", // Olive
  "#000080", // Navy
  "#808080", // Grey
  "#FF4500", // Orange Red
  "#32CD32", // Lime Green
  "#9370DB"  // Medium Purple
];

class ColorManager {
  constructor() {
    // Map to track assigned colors by subject name
    this.subjectColorMap = new Map();
    
    // Track used colors to avoid duplicates
    this.usedColors = new Set();
    
    // Index for color rotation
    this.colorIndex = 0;
    
    // Map to track topic colors within subjects
    this.topicColorMap = new Map();
    
    // Track topic color variation indices
    this.topicIndices = new Map();
  }

  /**
   * Get or create a color for a subject
   * @param {string} subjectName - Name of the subject
   * @param {string|null} existingColor - Optional existing color to reuse
   * @returns {string} - Hex color code
   */
  getSubjectColor(subjectName, existingColor = null) {
    // Normalize subject name
    const normalizedName = this.normalizeSubjectName(subjectName);
    
    // Return existing color if already assigned
    if (this.subjectColorMap.has(normalizedName)) {
      return this.subjectColorMap.get(normalizedName);
    }
    
    // If existing color is provided and not already used, use it
    if (existingColor && this.isValidColor(existingColor) && !this.usedColors.has(existingColor.toLowerCase())) {
      this.subjectColorMap.set(normalizedName, existingColor);
      this.usedColors.add(existingColor.toLowerCase());
      return existingColor;
    }
    
    // Otherwise assign a new unique color
    const color = this.getNextColor();
    this.subjectColorMap.set(normalizedName, color);
    this.usedColors.add(color.toLowerCase());
    
    return color;
  }

  /**
   * Generate variant colors for topics within a subject
   * @param {string} baseColor - Subject's base color
   * @param {number} count - Number of variations needed
   * @returns {string[]} - Array of hex color codes
   */
  generateTopicColors(baseColor, count) {
    const variations = [];
    
    try {
      // Convert hex to HSL for easier manipulation
      const hsl = this.hexToHSL(baseColor);
      
      // Generate variations with different lightness and slight hue shifts
      for (let i = 0; i < count; i++) {
        // Calculate variation parameters
        const hueShift = (i * 5) % 40 - 20; // -20 to +20 degrees
        const lightnessShift = (i % 5 - 2) * 5; // -10 to +10 percent
        
        const newHue = (hsl.h + hueShift + 360) % 360;
        const newLightness = Math.max(20, Math.min(80, hsl.l + lightnessShift));
        
        // Convert back to hex
        const variantColor = this.hslToHex(newHue, hsl.s, newLightness);
        variations.push(variantColor);
      }
    } catch (error) {
      console.error("Error generating topic colors:", error);
      
      // Fallback: create simple variations by adjusting last two hex digits
      const baseDigits = baseColor.replace('#', '');
      
      for (let i = 0; i < count; i++) {
        const modifier = Math.floor(((i + 1) * 50) % 255).toString(16).padStart(2, '0');
        const variantColor = `#${baseDigits.substring(0, 4)}${modifier}`;
        variations.push(variantColor);
      }
    }
    
    return variations;
  }

  /**
   * Create a greyed-out version of a color for empty topics
   * @param {string} baseColor - Base color
   * @returns {string} - Greyed-out color
   */
  createGreyedOutColor(baseColor) {
    if (!this.isValidColor(baseColor)) {
      return '#e0e0e0'; // Default grey
    }
    
    try {
      // Convert to HSL
      const hsl = this.hexToHSL(baseColor);
      
      // Reduce saturation and increase lightness
      return this.hslToHex(hsl.h, Math.max(10, hsl.s - 50), Math.min(90, hsl.l + 20));
    } catch (error) {
      return '#e0e0e0'; // Default grey on error
    }
  }

  /**
   * Get a text color (black or white) that contrasts with the background
   * @param {string} backgroundColor - Background color
   * @returns {string} - Text color (#000000 or #ffffff)
   */
  getContrastColor(backgroundColor) {
    if (!this.isValidColor(backgroundColor)) {
      return '#ffffff'; // Default to white
    }
    
    try {
      // Remove # if present
      const hex = backgroundColor.replace('#', '');
      
      // Convert to RGB
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      
      // Calculate luminance using perceived brightness formula
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Return white for dark colors, black for light colors
      return luminance > 0.5 ? '#000000' : '#ffffff';
    } catch (error) {
      return '#ffffff'; // Default to white on error
    }
  }

  /**
   * Restore color mapping from saved data
   * @param {Object} colorMapping - Saved color mapping
   */
  restoreColorMapping(colorMapping) {
    if (!colorMapping || typeof colorMapping !== 'object') {
      return;
    }
    
    try {
      // Clear existing maps
      this.subjectColorMap.clear();
      this.usedColors.clear();
      
      // Restore from mapping
      Object.entries(colorMapping).forEach(([subject, color]) => {
        if (typeof color === 'string' && this.isValidColor(color)) {
          // Simple string color
          this.subjectColorMap.set(this.normalizeSubjectName(subject), color);
          this.usedColors.add(color.toLowerCase());
        } else if (typeof color === 'object' && color.base && this.isValidColor(color.base)) {
          // Object with base color
          this.subjectColorMap.set(this.normalizeSubjectName(subject), color.base);
          this.usedColors.add(color.base.toLowerCase());
        }
      });
    } catch (error) {
      console.error("Error restoring color mapping:", error);
    }
  }

  /**
   * Generate color mapping for subjects and topics
   * @param {Array} subjects - Array of subjects
   * @param {Array} topics - Array of topics
   * @returns {Object} - Color mapping for saving
   */
  generateColorMapping(subjects, topics) {
    const mapping = {};
    
    // Process subjects
    subjects.forEach(subject => {
      const subjectName = typeof subject === 'string' ? subject : subject.name || subject.subject;
      if (!subjectName) return;
      
      const normalizedName = this.normalizeSubjectName(subjectName);
      const color = this.getSubjectColor(normalizedName, subject.color);
      
      mapping[normalizedName] = {
        base: color,
        topics: {}
      };
      
      // Find topics for this subject
      const subjectTopics = topics.filter(topic => {
        const topicSubject = topic.subject || topic.subjectName;
        return this.normalizeSubjectName(topicSubject) === normalizedName;
      });
      
      // Add topic colors
      subjectTopics.forEach(topic => {
        const topicName = topic.name || topic.topic;
        if (!topicName) return;
        
        mapping[normalizedName].topics[topicName] = topic.color || color;
      });
    });
    
    return mapping;
  }

  /**
   * Get the current color mapping
   * @returns {Object} - Current color mapping
   */
  getCurrentMapping() {
    const mapping = {};
    
    this.subjectColorMap.forEach((color, subject) => {
      mapping[subject] = color;
    });
    
    return mapping;
  }

  /**
   * Get or create a color for a topic within a subject
   * @param {string} subjectName - Name of the parent subject
   * @param {string} topicName - Name of the topic
   * @param {string|null} existingColor - Optional existing color to reuse
   * @returns {string} - Hex color code
   */
  getTopicColor(subjectName, topicName, existingColor = null) {
    if (!subjectName || !topicName) {
      return '#808080'; // Default grey
    }
    
    // Normalize names
    const normalizedSubject = this.normalizeSubjectName(subjectName);
    const normalizedTopic = topicName.trim().toLowerCase();
    
    // Create the key for the topic color map
    const topicKey = `${normalizedSubject}:${normalizedTopic}`;
    
    // Return existing topic color if already assigned
    if (this.topicColorMap.has(topicKey)) {
      return this.topicColorMap.get(topicKey);
    }
    
    // If existing color is provided and valid, use it
    if (existingColor && this.isValidColor(existingColor)) {
      this.topicColorMap.set(topicKey, existingColor);
      return existingColor;
    }
    
    // Get the subject color first
    const subjectColor = this.getSubjectColor(normalizedSubject);
    
    // Calculate a deterministic color variation
    // We'll use the topic name to create a consistent index for variation
    let topicIndex;
    
    // Get or create subject's topic indices map
    if (!this.topicIndices.has(normalizedSubject)) {
      this.topicIndices.set(normalizedSubject, new Map());
    }
    
    const subjectTopicIndices = this.topicIndices.get(normalizedSubject);
    
    if (subjectTopicIndices.has(normalizedTopic)) {
      // Use existing index
      topicIndex = subjectTopicIndices.get(normalizedTopic);
    } else {
      // Create a deterministic index based on topic name
      // Get a simple hash of the topic name
      const hash = this.simpleHash(normalizedTopic);
      
      // Use the hash to determine the index, modulo 10 to keep variations reasonable
      topicIndex = hash % 10;
      
      // Store for future use
      subjectTopicIndices.set(normalizedTopic, topicIndex);
    }
    
    // Generate the color variation
    try {
      // Convert to HSL for easy manipulation
      const hsl = this.hexToHSL(subjectColor);
      
      // For even indices, make slighly darker versions of the subject color
      // For odd indices, make slightly lighter versions
      const isEven = topicIndex % 2 === 0;
      
      // Calculate the lightness adjustment, more extreme for higher indices
      const adjustment = Math.min(20, 5 + Math.floor(topicIndex / 2) * 5);
      const lightnessAdjustment = isEven ? -adjustment : adjustment;
      
      // Slight hue shift for more variety, alternating direction
      const hueShift = isEven ? topicIndex * 3 : -topicIndex * 3;
      
      // Create new HSL values
      const newHue = (hsl.h + hueShift + 360) % 360;
      const newLightness = Math.max(20, Math.min(80, hsl.l + lightnessAdjustment));
      
      // Convert back to hex
      const topicColor = this.hslToHex(newHue, hsl.s, newLightness);
      
      // Store and return
      this.topicColorMap.set(topicKey, topicColor);
      return topicColor;
    } catch (error) {
      console.error("Error creating topic color variation:", error);
      
      // Fallback to subject color
      this.topicColorMap.set(topicKey, subjectColor);
      return subjectColor;
    }
  }
  
  /**
   * Simple string hash function
   * @param {string} str - String to hash
   * @returns {number} - Hash value
   */
  simpleHash(str) {
    let hash = 0;
    if (!str || str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash);
  }

  /* Helper methods */

  /**
   * Get the next color from the palette
   * @returns {string} - Hex color code
   */
  getNextColor() {
    // Find an unused color if possible
    for (let i = 0; i < SUBJECT_COLORS.length; i++) {
      const index = (this.colorIndex + i) % SUBJECT_COLORS.length;
      const color = SUBJECT_COLORS[index];
      
      if (!this.usedColors.has(color.toLowerCase())) {
        this.colorIndex = (index + 1) % SUBJECT_COLORS.length;
        return color;
      }
    }
    
    // If all colors are used, create a slight variation of the next color
    const baseColor = SUBJECT_COLORS[this.colorIndex];
    this.colorIndex = (this.colorIndex + 1) % SUBJECT_COLORS.length;
    
    // Create a variation by adjusting the hue slightly
    try {
      const hsl = this.hexToHSL(baseColor);
      const newHue = (hsl.h + 15) % 360; // Shift hue by 15 degrees
      return this.hslToHex(newHue, hsl.s, hsl.l);
    } catch (error) {
      // If conversion fails, return the base color
      return baseColor;
    }
  }

  /**
   * Check if a string is a valid hex color
   * @param {string} color - Color to check
   * @returns {boolean} - True if valid
   */
  isValidColor(color) {
    return typeof color === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(color);
  }

  /**
   * Normalize subject name for consistent mapping
   * @param {string} name - Subject name
   * @returns {string} - Normalized name
   */
  normalizeSubjectName(name) {
    if (!name) return 'unknown';
    return name.trim().toLowerCase();
  }

  /**
   * Convert hex color to HSL
   * @param {string} hex - Hex color
   * @returns {Object} - HSL values {h, s, l}
   */
  hexToHSL(hex) {
    // Remove the # symbol if present
    hex = hex.replace('#', '');
    
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Convert to RGB values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    // Find maximum and minimum RGB values
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    // Calculate luminance and saturation
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      // Calculate hue
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h = Math.round(h * 60);
    }
    
    // Convert to percentages
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    return { h, s, l };
  }

  /**
   * Convert HSL to hex color
   * @param {number} h - Hue (0-360)
   * @param {number} s - Saturation (0-100)
   * @param {number} l - Lightness (0-100)
   * @returns {string} - Hex color
   */
  hslToHex(h, s, l) {
    // Normalize values
    h = ((h % 360) + 360) % 360; // Ensure hue is 0-359
    s = Math.max(0, Math.min(100, s)) / 100; // Ensure saturation is 0-1
    l = Math.max(0, Math.min(100, l)) / 100; // Ensure lightness is 0-1
    
    // Calculate RGB values
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r, g, b;
    
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    // Convert to hex
    r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    b = Math.round((b + m) * 255).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
  }
}

// Export a singleton instance
const instance = new ColorManager();
export default instance;
