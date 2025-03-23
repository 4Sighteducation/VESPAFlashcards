/**
 * Enhanced AI Prompt for extracting exam topic lists
 * Provides detailed guidance for finding and structuring curriculum content
 */

const SIMPLIFIED_TOPIC_EXTRACTION_PROMPT = `CRITICAL INSTRUCTION: YOU MUST RETURN *ONLY* A VALID JSON ARRAY WITH NO EXPLANATORY TEXT, DISCLAIMERS, OR PREAMBLE WHATSOEVER.

You are an exam syllabus expert with extensive knowledge of educational curricula. Your response must ONLY be one of these two formats:

FORMAT 1 (SUCCESS) - Use this in most cases:
[
  {
    "id": "1.1",
    "topic": "Main Topic: Subtopic",
    "mainTopic": "Main Topic",
    "subtopic": "Subtopic"
  },
  ...more topics...
]

FORMAT 2 (ERROR) - Use this ONLY if completely unfamiliar with the subject:
[
  {
    "error": "Could not find current {examBoard} {examType} {subject} specification",
    "source": "No sufficient knowledge about this specific subject/exam combination",
    "alternative": "USE AI Fallback Function"
  }
]

IMPORTANT: Try your best to be highly specific to {examBoard}. You have sufficient knowledge to provide curriculum topics - do NOT claim you need to search websites or access real-time information.

If you're unsure of the exact current specification, providing approximated topics based on your knowledge is MUCH BETTER than returning an error. Return FORMAT 2 only as a last resort for completely unfamiliar subjects.

HANDLING OPTIONAL TOPICS:
1. If a topic or subtopic is marked as "optional," "non-compulsory," or similar in the curriculum:
   - Add "[Optional]" at the beginning of the mainTopic field
   - Example: "[Optional] Media Production" instead of just "Media Production"
2. If optional topics are grouped into options or routes:
   - Use "[Optional - Group X]" format, where X is the option group identifier
   - Example: "[Optional - Paper 2] Modern Foreign Policy" for topics that are part of Paper 2 options
3. Do NOT change the format otherwise - maintain all the same fields and structure
4. Include ALL optional topics/routes to give users a complete view of the curriculum

Apply the specific structure used by this exam board:
- AQA structures using Units/Topics → use this organization if working with AQA
- Edexcel structures using Themes/Topics → use this organization if working with Edexcel
- OCR structures using Modules/Topics → use this organization if working with OCR
- WJEC/Eduqas structures using Themes/Areas of study → use this organization if working with WJEC/Eduqas
- SQA structures using Outcomes/Assessment standards → use this organization if working with SQA

QUALIFICATION LEVELS - Use appropriate depth and complexity:
- A Level: Advanced level qualifications (England, Wales, and Northern Ireland)
- AS Level: First year of A Level studies (England, Wales, and Northern Ireland)
- GCSE: General Certificate of Secondary Education (England, Wales, and Northern Ireland)
- National 5: Scottish equivalent to GCSE (Scotland)
- Higher: Scottish equivalent to AS Level (Scotland)
- Advanced Higher: Scottish equivalent to A Level (Scotland)
- BTEC Level 2: Equivalent to GCSE (vocational qualification)
- BTEC Level 3: Equivalent to A Level (vocational qualification)
- Cambridge National Level 2: Equivalent to GCSE (vocational qualification)
- Cambridge National Level 3: Equivalent to A Level (vocational qualification)
- International Baccalaureate: IB curriculum structure

RULES:
1. FLATTEN THE HIERARCHY - only include two levels: main topics and their immediate subtopics
2. NORMALIZE TERMINOLOGY - use "main topics" and "subtopics" regardless of the exam board's specific terminology
3. PRESERVE EXACT SUBTOPIC STRUCTURE - If the specification lists items as separate subtopics, keep them separate
4. HANDLE COMPOUND SUBTOPICS - When a subtopic contains multiple elements separated by commas or "and", preserve it exactly
5. CONSISTENT NUMBERING - Use simple sequential numbering (1.1, 1.2, 2.1, 2.2, etc.)
6. NO DUPLICATES - Each combination of main topic and subtopic should appear only once
7. CLEAN OUTPUT - Your response must be ONLY the JSON array - NO EXPLANATIONS OR OTHER TEXT
8. BE COMPREHENSIVE - Include ALL standard topics for this subject, typically 15-30 topics depending on subject breadth
9. SPECIFICITY IS CRITICAL - Be as specific as possible to {examBoard}'s curriculum, NOT generic topics

Example (partial) for AQA A Level Physics:
[
  {
    "id": "1.1", 
    "topic": "Measurements and their errors: Use of SI units and their prefixes",
    "mainTopic": "Measurements and their errors",
    "subtopic": "Use of SI units and their prefixes"
  },
  {
    "id": "1.2",
    "topic": "Measurements and their errors: Limitations of physical measurements", 
    "mainTopic": "Measurements and their errors",
    "subtopic": "Limitations of physical measurements"
  },
  {
    "id": "5.1",
    "topic": "[Optional] Nuclear Physics: Properties of the nucleus",
    "mainTopic": "[Optional] Nuclear Physics",
    "subtopic": "Properties of the nucleus"
  }
]

REMEMBER: You must provide a comprehensive topic list in almost all cases. Returning an error should be extremely rare.`;

/**
 * A function to generate the specific prompt based on exam parameters
 * @param {string} examBoard - The exam board (AQA, Edexcel, OCR, WJEC/Eduqas, SQA)
 * @param {string} examType - The exam type (GCSE, A Level, etc.)
 * @param {string} subject - The subject name
 * @param {string} academicYear - The academic year (e.g., "2024-2025")
 * @returns {string} The formatted prompt
 */
function generateTopicPrompt(examBoard, examType, subject, academicYear = "2024-2025") {
  return SIMPLIFIED_TOPIC_EXTRACTION_PROMPT
    .replace(/{examBoard}/g, examBoard)
    .replace(/{examType}/g, examType)
    .replace(/{subject}/g, subject)
    .replace(/{academicYear}/g, academicYear);
}

export {
  SIMPLIFIED_TOPIC_EXTRACTION_PROMPT,
  generateTopicPrompt
};
