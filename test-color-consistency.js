// Test script to verify color consistency between subjects and topics
// This helps identify issues with color inheritance and management

// Mock color assignments to simulate what happens in the application
const subjectColorMapping = {};

// Generate a random color (similar to the function in App.js)
function getRandomColor() {
  // Default bright colors palette
  const brightColors = [
    "#e6194b", "#3cb44b", "#ffe119", "#0082c8", "#f58231", 
    "#911eb4", "#46f0f0", "#f032e6", "#d2f53c", "#fabebe"
  ];
  
  // Return a random color from the palette
  return brightColors[Math.floor(Math.random() * brightColors.length)];
}

// Generate a shade of a base color (similar to function in App.js)
function generateShade(baseColor, shadeIndex, totalShades) {
  // Convert hex to RGB
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  
  // Calculate lightness and saturation adjustments based on shade index
  const lightnessAdjustment = -20 + (50 * (shadeIndex / Math.max(totalShades - 1, 1)));
  const saturationAdjustment = 10 - (20 * (shadeIndex / Math.max(totalShades - 1, 1)));
  
  // Convert RGB to HSL
  const rgbToHsl = (r, g, b) => {
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
  };
  
  // Convert HSL back to RGB
  const hslToRgb = (h, s, l) => {
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
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };
  
  // Convert to HSL, adjust, and convert back
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Calculate new saturation and lightness with constraints
  const newS = Math.min(Math.max(s * (1 + saturationAdjustment/100), 0.1), 1);
  const newL = Math.min(Math.max(l * (1 + lightnessAdjustment/100), 0.2), 0.8);
  
  // Convert back to RGB
  const [newR, newG, newB] = hslToRgb(h, newS, newL);
  
  // Convert back to hex
  const toHex = c => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return '#' + toHex(newR) + toHex(newG) + toHex(newB);
}

// Update color mapping (similar to updateColorMapping in App.js)
function updateColorMapping(subject, topic, color, updateTopics = false) {
  if (!subject) return;
  
  // If color is null, use a default color or generate one
  const colorToUse = color || getRandomColor();
  console.log(`Updating color for subject: ${subject}, topic: ${topic || "none"}, color: ${colorToUse}, updateTopics: ${updateTopics}`);
  
  // Create subject entry if it doesn't exist
  if (!subjectColorMapping[subject]) {
    subjectColorMapping[subject] = { base: colorToUse, topics: {} };
  } else if (typeof subjectColorMapping[subject] === 'string') {
    // Convert legacy string format to object format
    const baseColor = subjectColorMapping[subject];
    subjectColorMapping[subject] = { base: baseColor, topics: {} };
  }

  // If it's a subject-level color update
  if (!topic || updateTopics) {
    // Update the base subject color
    subjectColorMapping[subject].base = colorToUse;
    
    // If we should update topic colors automatically
    if (updateTopics) {
      console.log(`Updating all topic colors for subject ${subject} based on ${colorToUse}`);
      
      // Mock topics for this subject
      const topicsForSubject = [
        `${subject} Topic 1`,
        `${subject} Topic 2`,
        `${subject} Topic 3`,
        `${subject} Topic 4`,
        `${subject} Topic 5`
      ];
      
      // Remove duplicates and sort
      const uniqueTopics = [...new Set(topicsForSubject)].filter(t => t !== "General").sort();
      
      console.log(`Found topics for subject ${subject}:`, uniqueTopics);
      
      // Generate a color for each topic
      if (uniqueTopics.length > 0) {
        // Ensure the topics object exists
        if (!subjectColorMapping[subject].topics) {
          subjectColorMapping[subject].topics = {};
        }
        
        uniqueTopics.forEach((topicName, index) => {
          // Skip the "General" topic as it should use the base color
          if (topicName === "General") return;
          
          // Generate a shade of the base color for this topic
          const topicColor = generateShade(colorToUse, index, uniqueTopics.length);
          console.log(`Generated color for ${topicName}: ${topicColor}`);
          
          // Update the topic color
          subjectColorMapping[subject].topics[topicName] = topicColor;
        });
      }
    }
  } 
  // If it's a topic-level color update
  else if (topic) {
    // Ensure the subject exists in mapping with the correct structure
    if (!subjectColorMapping[subject]) {
      subjectColorMapping[subject] = { base: colorToUse, topics: {} };
    } else if (typeof subjectColorMapping[subject] === 'string') {
      // Convert string color to proper object structure
      const baseColor = subjectColorMapping[subject];
      subjectColorMapping[subject] = { base: baseColor, topics: {} };
    } else if (!subjectColorMapping[subject].topics) {
      // Ensure topics object exists
      subjectColorMapping[subject].topics = {};
    }
    
    // Update the specified topic color
    subjectColorMapping[subject].topics[topic] = colorToUse;
  }
}

// Get color for a subject/topic pair
function getColorForSubjectTopic(subject, topic) {
  if (!subject || !topic) return "#007bff"; // Default blue
  
  // Default color if nothing else works
  const defaultColor = "#007bff";

  // Check if we have a color mapping for this subject
  if (subjectColorMapping && subjectColorMapping[subject]) {
    // Try to get a topic-specific color first
    if (subjectColorMapping[subject].topics && 
        subjectColorMapping[subject].topics[topic]) {
      return subjectColorMapping[subject].topics[topic];
    }
    
    // If topic is not in mapping but we have a base color, generate a color
    else if (topic && topic !== "General" && subjectColorMapping[subject].base) {
      // Get topic index
      const topicsForSubject = [
        `${subject} Topic 1`,
        `${subject} Topic 2`,
        `${subject} Topic 3`,
        `${subject} Topic 4`,
        `${subject} Topic 5`
      ];
      
      // Remove duplicates and sort
      const uniqueTopics = [...new Set(topicsForSubject)].filter(t => t !== "General").sort();
      
      // Find index of this topic
      const topicIndex = uniqueTopics.indexOf(topic);
      
      if (topicIndex !== -1) {
        // Generate a shade and return it
        const shade = generateShade(
          subjectColorMapping[subject].base, 
          topicIndex, 
          Math.max(uniqueTopics.length, 5)
        );
        
        // Store it for future use
        subjectColorMapping[subject].topics[topic] = shade;
        
        return shade;
      }
    }
    
    // Fall back to the subject base color if no topic color
    return subjectColorMapping[subject].base;
  }
  
  // Default color if no mapping exists
  return defaultColor;
}

// Test the color system
function runTests() {
  console.log("=== Testing Color System ===\n");
  
  // Test 1: Single subject with multiple topics
  console.log("TEST 1: Single subject with multiple topics");
  updateColorMapping("Physics", null, "#ff0000", true); // Red for Physics
  
  // Check colors for Physics topics
  console.log("Physics (Base):", subjectColorMapping["Physics"].base);
  console.log("Physics Topic 1:", getColorForSubjectTopic("Physics", "Physics Topic 1"));
  console.log("Physics Topic 2:", getColorForSubjectTopic("Physics", "Physics Topic 2"));
  console.log("Physics Topic 3:", getColorForSubjectTopic("Physics", "Physics Topic 3"));
  console.log("\n");
  
  // Test 2: Multiple subjects
  console.log("TEST 2: Multiple subjects");
  updateColorMapping("Chemistry", null, "#00ff00", true); // Green for Chemistry
  updateColorMapping("Biology", null, "#0000ff", true); // Blue for Biology
  
  // Check colors for subjects
  console.log("Chemistry (Base):", subjectColorMapping["Chemistry"].base);
  console.log("Biology (Base):", subjectColorMapping["Biology"].base);
  console.log("\n");
  
  // Test 3: Override topic color
  console.log("TEST 3: Override topic color");
  updateColorMapping("Physics", "Physics Topic 2", "#ff00ff"); // Magenta for Physics Topic 2
  console.log("Physics Topic 2 (After override):", getColorForSubjectTopic("Physics", "Physics Topic 2"));
  console.log("\n");
  
  // Test 4: Complete subject override
  console.log("TEST 4: Complete subject override");
  updateColorMapping("Chemistry", null, "#00ffff", true); // Cyan for Chemistry (with topic updates)
  console.log("Chemistry (Base after override):", subjectColorMapping["Chemistry"].base);
  console.log("Chemistry Topic 1 (After override):", getColorForSubjectTopic("Chemistry", "Chemistry Topic 1"));
  console.log("\n");
  
  // Test 5: Check color consistency and inheritance
  console.log("TEST 5: Color consistency and inheritance");
  // Get the same topic color multiple times to ensure consistency
  const color1 = getColorForSubjectTopic("Biology", "Biology Topic 1");
  const color2 = getColorForSubjectTopic("Biology", "Biology Topic 1");
  console.log("Biology Topic 1 (First lookup):", color1);
  console.log("Biology Topic 1 (Second lookup):", color2);
  console.log("Colors match:", color1 === color2);
  console.log("\n");
  
  // Print final color mapping state
  console.log("=== Final Color Mapping State ===");
  console.log(JSON.stringify(subjectColorMapping, null, 2));
}

// Run the tests
runTests();
