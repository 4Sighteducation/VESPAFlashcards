/**
 * AI Prompt for extracting exam topic lists
 * This prompt guides the AI to extract structured topic information from exam board websites
 */

const TOPIC_EXTRACTION_PROMPT = `You are tasked with extracting the most current topic list for UK exam courses. Follow these steps precisely:

Use the user's selections to identify the correct exam board website:

AQA: https://www.aqa.org.uk/
Edexcel: https://qualifications.pearson.com/
OCR: https://www.ocr.org.uk/
WJEC/Eduqas: https://www.wjec.co.uk/ or https://www.eduqas.co.uk/
SQA: https://www.sqa.org.uk/


Navigate to the specific qualification page by:

Identifying the correct URL structure for the exam board
Using the qualification level (GCSE/A Level) and subject to find the specific page
Looking for "Specification" or "Subject content" sections


Extract the complete topic list, focusing on:

Main content areas/units
Sub-topics within each area
Any specified practical elements or coursework requirements
Assessment objectives where relevant


Check for the most recent specification by:

Verifying the "valid from" date (typically shown as academic years, e.g., "2023-2025")
Confirming if it's the current specification or if there are upcoming changes


Structure the extracted data in a clean JSON format as follows:

{
  "metadata": {
    "exam_board": "BOARD_NAME",
    "qualification": "GCSE/A_LEVEL",
    "subject": "SUBJECT_NAME",
    "specification_code": "CODE",
    "valid_from": "DATE/YEAR",
    "valid_until": "DATE/YEAR",
    "specification_url": "FULL_URL_TO_SPECIFICATION",
    "last_updated": "EXTRACTION_DATE"
  },
  "topics": [
    {
      "unit_number": "1",
      "unit_title": "MAIN_TOPIC",
      "weighting": "PERCENTAGE_IF_AVAILABLE",
      "subtopics": [
        {
          "subtopic_id": "1.1",
          "title": "SUBTOPIC_TITLE",
          "description": "BRIEF_DESCRIPTION",
          "required_practicals": ["PRACTICAL_1", "PRACTICAL_2"],
          "assessment_objectives": ["AO1", "AO2"]
        }
      ]
    }
  ],
  "assessment": {
    "components": [
      {
        "title": "PAPER/COMPONENT_NAME",
        "type": "EXAM/COURSEWORK/PRACTICAL",
        "duration": "TIME_IN_MINUTES",
        "weighting": "PERCENTAGE",
        "total_marks": "NUMBER"
      }
    ]
  }
}

Important handling instructions:

If multiple specifications exist (e.g., Foundation and Higher tiers for GCSE), include both with clear labeling
If the latest specification is not yet available online, provide the most recent one with a note about its status
If a specification is being phased out, include information about both the current and upcoming specifications
Always include direct URLs to the source pages where the information was extracted from
Check for any recent updates or notices about specification changes


Always verify the data against the official specification PDF where available, as this is the authoritative source
If unable to access or parse certain information, include specific notes in the response about what's missing and why
For subjects with optional routes/topics (e.g., History with different period options), include all available paths in a structured format
`;

/**
 * An improved prompt for extracting topic lists with better structure and organization
 */
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
 * @param {string} examBoard - The exam board (AQA, Edexcel, etc.)
 * @param {string} examType - The exam type (GCSE, A Level)
 * @param {string} subject - The subject name
 * @param {boolean} detailed - Whether to use the detailed or structured prompt
 * @param {string} academicYear - The academic year (e.g., "2024-2025")
 * @returns {string} The formatted prompt
 */
function generateTopicPrompt(examBoard, examType, subject, detailed = false, academicYear = "2024-2025") {
  if (detailed) {
    return TOPIC_EXTRACTION_PROMPT
      .replace('BOARD_NAME', examBoard)
      .replace('GCSE/A_LEVEL', examType)
      .replace('SUBJECT_NAME', subject);
  } else {
    return IMPROVED_TOPIC_EXTRACTION_PROMPT
      .replace('{examBoard}', examBoard)
      .replace('{examType}', examType)
      .replace('{subject}', subject)
      .replace('{academicYear}', academicYear);
  }
}

export {
  TOPIC_EXTRACTION_PROMPT,
  IMPROVED_TOPIC_EXTRACTION_PROMPT,
  generateTopicPrompt
};
