const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_KEY,
});

// Exam type complexity levels to guide content difficulty
const examComplexityGuidance = {
  "A-Level": "Focus on in-depth specialized knowledge with emphasis on critical analysis, evaluation and application. Include detailed technical terminology and expect students to demonstrate independent thinking.",
  "GCSE": "Cover foundational knowledge with clear explanations of key concepts. Focus on comprehension and basic application rather than complex analysis. Ensure terminology is appropriate for a broad introduction to the subject.",
  "BTEC": "Focus on practical applications, industry standards, and vocational context.",
  "IB": "Similar to A-Level with critical thinking and application focus, but slightly broader in scope as students take six subjects. Include appropriate technical terminology while balancing depth with the wider curriculum demands."
};

// Standard examples for each card type to improve consistency
const cardExamples = {
  multiple_choice: {
    Biology: {
      question: "Which organelle is primarily responsible for ATP production in eukaryotic cells?",
      options: ["Mitochondria", "Nucleus", "Golgi apparatus", "Lysosome"],
      correctAnswer: "Mitochondria",
      detailedAnswer: "Mitochondria are the powerhouses of the cell where cellular respiration occurs, converting glucose and oxygen into ATP through processes including the Krebs cycle and electron transport chain."
    }
  },
  short_answer: {
    Chemistry: {
      question: "Explain how the rate of reaction is affected by increasing temperature.",
      keyPoints: [
        "Particles gain more kinetic energy",
        "More frequent collisions occur",
        "More collisions exceed the activation energy",
        "Rate of successful collisions increases"
      ],
      detailedAnswer: "When temperature increases, particles gain more kinetic energy, moving faster and colliding more frequently. A greater proportion of these collisions exceed the activation energy required for reaction, resulting in more successful collisions per unit time. This leads to an exponential increase in reaction rate as described by the Arrhenius equation."
    }
  },
  essay: {
    History: {
      question: "To what extent was the Treaty of Versailles responsible for the outbreak of World War II?",
      keyPoints: [
        "Economic impact on Germany",
        "Military restrictions and rearmament",
        "Territorial losses and national humiliation",
        "Rise of extremism and Hitler's exploitation",
        "Other contributing factors (Great Depression, appeasement policy)"
      ],
      detailedAnswer: "Begin by outlining the key provisions of the Treaty of Versailles and their impact on Germany. Analyze how these provisions contributed to economic crisis, national resentment, and political instability. Evaluate how Hitler exploited these grievances. Counter-argue by discussing other significant factors such as the Great Depression and appeasement policy. Conclude with a balanced assessment of the Treaty's significance relative to other factors."
    }
  }
};

function buildPrompt({ subject, topic, examType, examBoard, questionType, numCards }) {
  // Get complexity guidance for the exam type
  const complexityGuidance = examComplexityGuidance[examType] || examComplexityGuidance["GCSE"];
  
  // Create a more efficient base prompt focused on content rather than format
  let basePrompt = `Generate ${numCards} high-quality flashcards for ${examBoard} ${examType} ${subject} on "${topic}".
  
DIFFICULTY LEVEL: ${complexityGuidance}

SPECIFIC INSTRUCTIONS:
1. Each flashcard must be directly relevant to "${topic}" specifically.
2. Include exam-specific terminology and concepts.
3. Ensure content is appropriate for ${examType} level students.
4. Where possible use questions similar to those found in ${examType} exams for ${examBoard}
`;

  // Add question type specific content guidance (without format instructions)
  if (questionType === "multiple_choice") {
    basePrompt += `
CONTENT GUIDANCE:
- Create challenging yet fair multiple choice questions
- Distribute the correct answer randomly among the four positions
- All four options should be plausible and related to ${topic}
- Provide detailed explanations that would help a student understand the concept
`;
  } 
  else if (questionType === "short_answer") {
    basePrompt += `
CONTENT GUIDANCE:
- Questions should require concise, focused answers
- KeyPoints should list exactly what an examiner would look for
- Include 3-5 key points that would earn full marks
- Explanations should be comprehensive and include examples
`;
  } 
  else if (questionType === "essay") {
    basePrompt += `
CONTENT GUIDANCE:
- Questions should match typical ${examType} essay question styles
- KeyPoints should reflect main arguments needed for top marks
- Include ${examType}-appropriate evaluation and analysis guidance
- Detailed answer should provide essay structure with intro, arguments, conclusion
`;
  } 
  else if (questionType === "acronym") {
    basePrompt += `
CONTENT GUIDANCE:
- Create genuinely useful acronyms for key ${topic} concepts
- Acronyms should help remember complex processes, lists or sequences
- Make sure the acronym is memorable and easy to recall
- Explanation should cover what each letter stands for with details
`;
  }

  return basePrompt;
}

async function generateCards({ subject, topic, examType, examBoard, questionType, numCards }) {
  // Build an optimized prompt
  const prompt = buildPrompt({ subject, topic, examType, examBoard, questionType, numCards });

  // Use a more focused system message
  const systemMessage = `You are an expert ${examType} ${subject} educator. Create precise, high-quality flashcards that match ${examBoard} standards for ${examType} students studying ${topic}.`;

  // Choose model based on complexity - use faster model for simpler card types
  const model = questionType === "essay" ? "gpt-4-turbo" : "gpt-3.5-turbo";

  // Define function parameters based on question type
  let cardProperties = {
    subject: { type: "string" },
    topic: { type: "string" },
    questionType: { type: "string" }
  };
  
  // Add question-type specific properties to the schema
  if (questionType === "multiple_choice") {
    cardProperties = {
      ...cardProperties,
      question: { type: "string", description: "The multiple-choice question related to the topic" },
      options: { 
        type: "array", 
        items: { type: "string" },
        description: "Four distinct answer options for the question"
      },
      correctAnswer: { 
        type: "string", 
        description: "The correct answer, must match exactly one of the options"
      },
      detailedAnswer: { 
        type: "string", 
        description: "Thorough explanation with curriculum-specific terminology"
      }
    };
  } else if (questionType === "short_answer") {
    cardProperties = {
      ...cardProperties,
      question: { type: "string", description: "Specific question requiring a short answer" },
      keyPoints: { 
        type: "array", 
        items: { type: "string" },
        description: "3-5 key points that would earn full marks in an exam"
      },
      detailedAnswer: { 
        type: "string", 
        description: "Comprehensive explanation with examples"
      }
    };
  } else if (questionType === "essay") {
    cardProperties = {
      ...cardProperties,
      question: { type: "string", description: "Discussion/analysis essay question" },
      keyPoints: { 
        type: "array", 
        items: { type: "string" },
        description: "Key points or arguments that should be included in the essay"
      },
      detailedAnswer: { 
        type: "string", 
        description: "Essay structure with intro, arguments, and conclusion"
      }
    };
  } else if (questionType === "acronym") {
    cardProperties = {
      ...cardProperties,
      acronym: { type: "string", description: "A memorable acronym for a concept" },
      explanation: { 
        type: "string", 
        description: "What each letter stands for and detailed explanation"
      }
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      functions: [{
        name: "generateFlashcards",
        description: `Generate ${numCards} flashcards for ${examType} ${subject} on the topic of ${topic}`,
        parameters: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: cardProperties,
                required: Object.keys(cardProperties) // Make all defined properties required
              }
            }
          },
          required: ["cards"]
        }
      }],
      function_call: { name: "generateFlashcards" },
      // Keep max tokens and temperature settings
      max_tokens: Math.min(3000, numCards * 250), // Slightly increased for function calling
      temperature: 0.5,
    });
    
    // Extract the function call result
    if (response.choices[0].message.function_call) {
      try {
        const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);
        if (functionArgs.cards && Array.isArray(functionArgs.cards)) {
          console.log(`Successfully generated ${functionArgs.cards.length} cards using function calling`);
          return JSON.stringify(functionArgs.cards);
        } else {
          console.error("Function call returned invalid or missing cards array");
          return JSON.stringify({ error: "Invalid response format from function call" });
        }
      } catch (parseError) {
        console.error("Error parsing function call arguments:", parseError);
        return JSON.stringify({ error: "Failed to parse function response" });
      }
    } else {
      // Fallback to standard response parsing if function calling somehow fails
      console.warn("Function call not used in response, falling back to content parsing");
      const content = response.choices[0].message.content;
      
      try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed) && parsed.cards && Array.isArray(parsed.cards)) {
          return JSON.stringify(parsed.cards);
        }
        return content;
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        return JSON.stringify({ error: "Failed to generate valid flashcards" });
      }
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error; // Throw error for retry mechanism to catch
  }
}

// Optional: Add caching for similar requests to improve performance
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

async function generateWithRetry(params, maxRetries = 3) {
  // Check cache first
  const cacheKey = `${params.subject}|${params.topic}|${params.examType}|${params.examBoard}|${params.questionType}|${params.numCards}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for ${cacheKey}`);
      return cached.data;
    }
  }

  // If not in cache, try with retries
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const result = await generateCards(params);
      
      // Store in cache
      cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    } catch (error) {
      console.log(`API call failed (attempt ${retries+1}/${maxRetries}):`, error.status || error.message);
      
      if (error.status === 429 || error.message?.includes('rate limit')) {
        retries++;
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = Math.pow(2, retries) * 1000;
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Re-throw other errors
      }
    }
  }
  return JSON.stringify({ error: "Rate limit exceeded after multiple retries" });
}

// Parallel processing for large card sets
async function generateLargeCardSet({ subject, topic, examType, examBoard, questionType, numCards }) {
  // For large card sets, split into smaller batches
  if (numCards > 5) { // Lower threshold to 5 for better parallelization
    const batchSize = 3; // Smaller batch size for faster individual responses
    const batches = Math.ceil(numCards / batchSize);
    const promises = [];
    
    console.log(`Splitting ${numCards} cards into ${batches} batches of ~${batchSize} cards`);
    
    for (let i = 0; i < batches; i++) {
      const cardsInBatch = Math.min(batchSize, numCards - (i * batchSize));
      promises.push(generateWithRetry({ 
        subject, topic, examType, examBoard, questionType, numCards: cardsInBatch 
      }));
    }
    
    try {
      const results = await Promise.all(promises);
      // Combine results and return
      const combined = results
        .map(r => {
          try {
            return JSON.parse(r);
          } catch (e) {
            console.error("Error parsing batch result:", e);
            return [];
          }
        })
        .flat();
      return JSON.stringify(combined);
    } catch (error) {
      console.error("Parallel generation error:", error);
      return JSON.stringify({ error: "Failed during parallel generation" });
    }
  }
  
  // For smaller sets, use retry approach
  return generateWithRetry({ subject, topic, examType, examBoard, questionType, numCards });
}

module.exports = { 
  generateCards, 
  generateWithRetry, 
  generateLargeCardSet
};
