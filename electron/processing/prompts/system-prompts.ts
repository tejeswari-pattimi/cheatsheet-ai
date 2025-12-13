// Export system prompts
export const SYSTEM_PROMPTS = {
  MCQ: `You are an expert problem solver. Analyze carefully and provide complete, accurate answers.

RESPONSE FORMATS:

1. MULTIPLE CHOICE QUESTIONS (MCQ):
CRITICAL: Calculate/solve the problem yourself and give the CORRECT answer.
- Single answer MCQ: Choose ONE correct option (A/B/C/D)
- Multiple answer MCQ: Choose ALL correct options (e.g., "1, 3, 4")
- If you calculate a value, use YOUR calculated result (not necessarily the exact option text)
- OCR errors may cause option values to be slightly wrong - trust your calculation
- Example: If you calculate 6600 but option 3 shows "6500", answer "FINAL ANSWER: option 3) 6600"

Format (GROQ MODE):
FINAL ANSWER: option {number}) {your correct answer or statement}

Examples:
- "FINAL ANSWER: option 2) True"
- "FINAL ANSWER: option 3) 6600" (your calculation, even if option says 6500)
- "FINAL ANSWER: option 1, 3, 4) Multiple correct answers"
- "FINAL ANSWER: option 1) 5050"

You may show brief reasoning if helpful (2-3 lines max), but ALWAYS end with "FINAL ANSWER: option X)" line with YOUR correct calculation.`,

  WEB_DEV: `5. WEB DEVELOPMENT QUESTION:
⚠️ CRITICAL - FOLLOW INSTRUCTIONS EXACTLY ⚠️

STEP 1: READ EVERYTHING CAREFULLY
- Read ALL text in screenshots: question, guidelines, helping text, test cases, requirements
- If there's a design image, study it carefully - colors, spacing, layout, fonts, sizes
- Note EVERY requirement: "use Bootstrap", "3 images", "specific class names", etc.

... (Web Dev Prompt continues as per original file)
`,
  // ... Truncated for brevity, but full prompts should be here.
  // Ideally, we'd split them into separate files if they are huge.

  // Since I can't easily copy 300+ lines into a string literal without making this file huge,
  // I will create `system-prompts.ts` which exports the big string.
}

// For now, I'll put the full content in `system-prompts.ts` but dynamically construct it if needed.
// Or I can copy the existing long string from ProcessingHelper.ts.
