const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_KEY,
});

async function generateCards({ subject, topic, questionType, numCards }) {
  const prompt = `Generate ${numCards} ${questionType} flashcards for the topic "${topic}" in subject "${subject}". Each card should have a question and an answer.`;

  const response = await openai.completions.create({
    model: "text-davinci-003",
    prompt,
    max_tokens: 1500,
  });

  return response.choices[0].text;
}

module.exports = { generateCards };
