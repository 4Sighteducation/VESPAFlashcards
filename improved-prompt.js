const IMPROVED_TOPIC_EXTRACTION_PROMPT = `You are an exam syllabus expert. Return ONLY a valid JSON array with no additional text, explanations, or prefixes.

Find the current {examBoard} {examType} {subject} specification for the {academicYear} academic year from the official source:
- AQA: https://www.aqa.org.uk/
- Edexcel/Pearson: https://qualifications.pearson.com/
- OCR: https://www.ocr.org.uk/
- WJEC/Eduqas: https://www.wjec.co.uk/ or https://www.eduqas.co.uk/
- SQA: https://www.sqa.org.uk/

Extract ALL topics and subtopics in this exact format:
[
  {
    "id": "1.1",
    "topic": "Topic Area 1: Subtopic 1",
    "mainTopic": "Topic Area 1",
    "subtopic": "Subtopic 1"
  },
  {
    "id": "1.2",
    "topic": "Topic Area 1: Subtopic 2",
    "mainTopic": "Topic Area 1",
    "subtopic": "Subtopic 2"
  },
  {
    "id": "2.1",
    "topic": "Topic Area 2: Subtopic 1",
    "mainTopic": "Topic Area 2",
    "subtopic": "Subtopic 1"
  }
]

FORMAT RULES:
1. Each string must follow the pattern "Main Topic: Subtopic"
2. Include EVERY subtopic from the official specification
3. Repeat the main topic name for each of its subtopics
4. Use the exact topic and subtopic names from the official specification
5. No duplicates allowed
6. No extra explanations outside the JSON array
7. Return properly formatted, valid JSON only

SOURCE: Use only the latest official {examBoard} specification document.`;

/**
 * A function to generate the specific prompt based on exam parameters
 * @param {string} examBoard - The exam board (AQA, Edexcel, OCR, WJEC/Eduqas, SQA)
 * @param {string} examType - The exam type (GCSE, A Level)
 * @param {string} subject - The subject name
 * @param {string} academicYear - The academic year (e.g., "2024-2025")
 * @returns {string} The formatted prompt
 */
function generateTopicPrompt(examBoard, examType, subject, academicYear = "2024-2025") {
  return IMPROVED_TOPIC_EXTRACTION_PROMPT
    .replace('{examBoard}', examBoard)
    .replace('{examType}', examType)
    .replace('{subject}', subject)
    .replace('{academicYear}', academicYear);
}

export {
  IMPROVED_TOPIC_EXTRACTION_PROMPT,
  generateTopicPrompt
};
