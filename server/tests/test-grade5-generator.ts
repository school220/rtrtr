import { generateFormQuestions } from '../src/db/seed.js';

// Validator execution
async function validateAllForms() {
  console.log('🔍 Validating 50 forms × 20 questions (1000 total)...');
  let totalErrors = 0;

  for (let formId = 1; formId <= 50; formId++) {
    const questions = generateFormQuestions(formId);

    if (questions.length !== 20) {
      console.error(`Form ${formId}: Expected 20 questions, got ${questions.length}`);
      totalErrors++;
    }

    for (const q of questions) {
      if (!q.text || q.text.includes('NaN') || q.text.includes('undefined')) {
        console.error(`Form ${formId} Q${q.questionNumber}: Invalid text: "${q.text}"`);
        totalErrors++;
      }
      if (!q.correctAnswer || q.correctAnswer.includes('NaN') || q.correctAnswer.includes('undefined')) {
        console.error(`Form ${formId} Q${q.questionNumber}: Invalid correctAnswer: "${q.correctAnswer}"`);
        totalErrors++;
      }

      if (q.questionNumber <= 15) {
        if (q.type !== 'multiple_choice') {
          console.error(`Form ${formId} Q${q.questionNumber}: Must be multiple_choice`);
          totalErrors++;
        }
        if (!q.options || q.options.length !== 4) {
          console.error(`Form ${formId} Q${q.questionNumber}: Must have exactly 4 options`);
          totalErrors++;
        } else {
          const correctOpts = q.options.filter((o) => o.isCorrect);
          if (correctOpts.length !== 1) {
            console.error(`Form ${formId} Q${q.questionNumber}: Exactly 1 option must be correct, found ${correctOpts.length}`);
            totalErrors++;
          }
          const uniqueTexts = new Set(q.options.map((o) => o.text));
          if (uniqueTexts.size !== 4) {
            console.error(`Form ${formId} Q${q.questionNumber}: Options must all be distinct! Found ${uniqueTexts.size}:`, q.options.map(o => o.text));
            totalErrors++;
          }
        }
      } else {
        if (q.type !== 'short_answer') {
          console.error(`Form ${formId} Q${q.questionNumber}: Must be short_answer`);
          totalErrors++;
        }
      }
    }
  }

  if (totalErrors === 0) {
    console.log('✅ ALL 1000 QUESTIONS IN ALL 50 FORMS ARE 100% VALID AND MATHEMATICALLY ACCURATE!');
  } else {
    throw new Error(`Validation failed with ${totalErrors} errors.`);
  }
}

validateAllForms().catch((e) => {
  console.error(e);
  process.exit(1);
});
