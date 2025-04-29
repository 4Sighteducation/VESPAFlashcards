const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_KEY,
});

function buildPrompt({ subject, topic, examType, examBoard, questionType, numCards }) {
  let prompt = "";

  if (questionType === "acronym") {
    prompt = `Return only a valid JSON array with no additional text. Generate ${numCards} exam-style flashcards for ${examBoard} ${examType} ${subject} with focus on ${topic}. Create a useful acronym from some essential course knowledge. Be creative and playful. Format exactly as: [{"acronym": "Your acronym", "explanation": "Detailed explanation here"}]`;
  } else {
    let complexityInstruction = examType === "A-Level"
      ? "Make these appropriate for A-Level students (age 16-18). Questions should be challenging and involve deeper thinking. Include sufficient detail in answers and use appropriate technical language."
      : "Make these appropriate for GCSE students (age 14-16). Questions should be clear but still challenging. Explanations should be thorough but accessible.";

    prompt = `Return only a valid JSON array with no additional text. Generate ${numCards} high-quality ${examBoard} ${examType} ${subject} flashcards for the specific topic \"${topic}\". ${complexityInstruction}

Use this format for different question types:
`;

    if (questionType === "multiple_choice") {
      prompt += `Each object should have:
- subject
- topic
- questionType
- question
- options (an array of 4 strings)
- correctAnswer (must match one of the options exactly)
- detailedAnswer

For each question, randomly assign the correct answer to any of the four options. Do not always use the same position for the correct answer. The correctAnswer field must exactly match one of the options.

Example:
[
  {
    "subject": "${subject}",
    "topic": "${topic}",
    "questionType": "multiple_choice",
    "question": "What is the main pigment in photosynthesis?",
    "options": ["Chlorophyll", "Hemoglobin", "Keratin", "Melanin"],
    "correctAnswer": "Chlorophyll",
    "detailedAnswer": "Chlorophyll is the main pigment that absorbs light for photosynthesis."
  }
]
Generate ${numCards} such objects.`;
    } else if (questionType === "short_answer") {
      prompt += `[
  {
    "subject": "${subject}",
    "topic": "${topic}",
    "questionType": "short_answer",
    "question": "Clear, focused question from the curriculum",
    "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "detailedAnswer": "Complete and thorough explanation with all necessary information"
  }
]`;
    } else if (questionType === "essay") {
      prompt += `[
  {
    "subject": "${subject}",
    "topic": "${topic}",
    "questionType": "essay",
    "question": "Thought-provoking essay question matching the curriculum",
    "keyPoints": ["Important point 1", "Important point 2", "Important point 3", "Important point 4"],
    "detailedAnswer": "Structured essay plan with introduction, key arguments, and conclusion guidance"
  }
]`;
    }
  }

  return prompt;
}

async function generateCards({ subject, topic, examType, examBoard, questionType, numCards }) {
  const prompt = buildPrompt({ subject, topic, examType, examBoard, questionType, numCards });

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo", // Use gpt-4-turbo if available, fallback to gpt-3.5-turbo if needed
    messages: [
      { role: "system", content: "You are a helpful assistant that generates flashcards." },
      { role: "user", content: prompt }
    ],
    max_tokens: 2000,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

module.exports = { generateCards };