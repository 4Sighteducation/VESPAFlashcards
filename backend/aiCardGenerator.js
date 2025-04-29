const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_KEY,
});

async function generateCards({ subject, topic, questionType, numCards }) {
  const prompt = `Generate ${numCards} ${questionType} flashcards for the topic "${topic}" in subject "${subject}". Each card should have a question and an answer.`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant that generates flashcards." },
      { role: "user", content: prompt }
    ],
    max_tokens: 1500,
  });

  return response.choices[0].message.content;
}

module.exports = { generateCards };