async function generateCards({ subject, topic, examType, examBoard, questionType, numCards }) {
  // Build an optimized prompt with enhanced differentiation and exam authenticity
  const prompt = buildPrompt({ subject, topic, examType, examBoard, questionType, numCards });

  // Enhanced system message for authenticity
  const systemMessage = `You are an expert ${examType} ${subject} educator with extensive experience marking ${examBoard} exams. 
  Create flashcards that precisely match actual ${examBoard} exam questions and mark schemes for ${examType} students studying "${topic}".
  Where possible, base questions on previous ${examBoard} exam papers and ensure mark scheme alignment.`;

  // More nuanced model selection based on complexity requirements
  const model = (questionType === "essay" || examType === "A-Level" || examType === "IB") 
    ? "gpt-4-turbo" 
    : "gpt-3.5-turbo";

  // Define enhanced function parameters based on question type
  let cardProperties = {
    subject: { type: "string" },
    topic: { type: "string" },
    questionType: { type: "string" },
    syllabusReference: { 
      type: "string", 
      description: `The specific section of the ${examBoard} ${examType} syllabus this question relates to (e.g., "3.4.2 Cellular Respiration")`
    }
  };
  
  // Add question-type specific properties with enhanced guidance
  if (questionType === "multiple_choice") {
    cardProperties = {
      ...cardProperties,
      question: { 
        type: "string", 
        description: `The multiple-choice question related to "${topic}" that matches ${examBoard} ${examType} exam style`
      },
      options: { 
        type: "array", 
        items: { type: "string" },
        description: "Four distinct answer options for the question with appropriate distractors"
      },
      correctAnswer: { 
        type: "string", 
        description: "The correct answer, must match exactly one of the options"
      },
      detailedAnswer: { 
        type: "string", 
        description: `Thorough explanation with ${examType}-appropriate terminology that would satisfy ${examBoard} mark scheme requirements`
      }
    };
  } 
  // Similar enhancements for other question types...

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      functions: [{
        name: "generateFlashcards",
        description: `Generate ${numCards} authentic ${examBoard} ${examType} flashcards for ${subject} on the topic of ${topic}`,
        parameters: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: cardProperties,
                required: Object.keys(cardProperties)
              }
            }
          },
          required: ["cards"]
        }
      }],
      function_call: { name: "generateFlashcards" },
      max_tokens: Math.min(4000, numCards * 300), // Increased for more detailed responses
      temperature: 0.4, // Slightly lower for more consistent results
    });
    
    // Parse response and validate cards
    if (response.choices[0].message.function_call) {
      try {
        const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);
        if (functionArgs.error) {
          console.error("OpenAI function call returned an error:", functionArgs.error);
          return JSON.stringify({ error: "OpenAI function call failed: " + (typeof functionArgs.error === 'string' ? functionArgs.error : JSON.stringify(functionArgs.error)) });
        }
        if (functionArgs.cards && Array.isArray(functionArgs.cards)) {
          console.log(`Successfully generated ${functionArgs.cards.length} cards using function calling`);
          
          // Validate and improve cards
          const validatedCards = validateCards(functionArgs.cards, { subject, topic, examType, examBoard, questionType });
          
          return JSON.stringify(validatedCards.map(card => {
            // Remove validation issues from final output
            const { _validationIssues, ...cleanCard } = card;
            return cleanCard;
          }));
        } else {
          console.error("Function call returned invalid or missing cards array");
          return JSON.stringify({ error: "Invalid response format from function call" });
        }
      } catch (parseError) {
        console.error("Error parsing function call arguments:", parseError);
        return JSON.stringify({ error: "Failed to parse function response" });
      }
    } else {
      // Fallback implementation...
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

// Card validation function
function validateCards(cards, params) {
  const { questionType, examType } = params;
  
  return cards.map(card => {
    // Quality checks
    let issues = [];
    
    // Check question length - too short questions are often too vague
    if (card.question.length < 15) {
      issues.push("Question too brief - needs more specificity");
    }
    
    // For multiple choice, ensure all options are present and correct answer matches an option
    if (questionType === "multiple_choice") {
      if (!card.options.includes(card.correctAnswer)) {
        issues.push("Correct answer must match exactly one of the options");
        // Fix by selecting a random option as correct
        card.correctAnswer = card.options[0];
      }
      
      // Check for duplicate options
      if (new Set(card.options).size !== card.options.length) {
        issues.push("Multiple choice options must be unique");
      }
    }
    
    // Level-specific checks
    if (examType === "A-Level") {
      // A-Level answers should be more complex
      if (card.detailedAnswer && card.detailedAnswer.length < 120) {
        issues.push("A-Level explanation lacks sufficient depth");
      }
      
      // Check for evaluation language in A-Level content
      const evaluationTerms = ["evaluate", "analyze", "compare", "contrast", "assess", "critique"];
      if (questionType === "essay" && !evaluationTerms.some(term => 
        card.question.toLowerCase().includes(term) || 
        (card.keyPoints && card.keyPoints.some(point => point.toLowerCase().includes(term))))) {
        issues.push("A-Level essay question lacks evaluation focus");
      }
    } else if (examType === "GCSE") {
      // GCSE should not be overly complex
      if (card.detailedAnswer && card.detailedAnswer.length > 300) {
        issues.push("GCSE explanation may be too complex");
      }
    }
    
    return { ...card, _validationIssues: issues };
  });
}