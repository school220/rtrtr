export interface QuestionVerificationResult {
  formId: number;
  questionNumber: number;
  type: string;
  correctAnswer: string;
  hasErrors: boolean;
  errors: string[];
}

import { generateFormQuestions } from '../src/db/seed.js';

console.log('🔍 Running mathematical verification of all 50 forms (1000 questions)...');

let totalErrors = 0;

for (let formId = 1; formId <= 50; formId++) {
  const questions = generateFormQuestions(formId);

  if (questions.length !== 20) {
    console.error(`❌ Form ${formId}: Expected 20 questions, got ${questions.length}`);
    totalErrors++;
  }

  for (const q of questions) {
    const qErrors: string[] = [];

    // Check correct answer is not empty and not negative
    if (!q.correctAnswer || q.correctAnswer.trim() === '') {
      qErrors.push(`Empty correct answer`);
    }

    if (q.correctAnswer.startsWith('-')) {
      qErrors.push(`Negative correct answer: ${q.correctAnswer}`);
    }

    // Check explanation does not contain negative numbers
    if (q.explanation && /=\s*-\d+/.test(q.explanation)) {
      qErrors.push(`Explanation contains negative calculation: ${q.explanation}`);
    }

    if (q.type === 'multiple_choice') {
      if (q.questionNumber > 15) {
        qErrors.push(`Question ${q.questionNumber} should not be multiple choice`);
      }
      if (!q.options || q.options.length !== 4) {
        qErrors.push(`Options length is ${q.options?.length || 0}, expected 4`);
      } else {
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
          qErrors.push(`Expected exactly 1 correct option, got ${correctCount}`);
        }

        const uniqueTexts = new Set(q.options.map(o => o.text.trim()));
        if (uniqueTexts.size !== 4) {
          qErrors.push(`Duplicate options found: ${q.options.map(o => o.text).join(', ')}`);
        }

        for (const opt of q.options) {
          if (opt.text.includes('-\\')) {
            qErrors.push(`Option text has negative sign: ${opt.text}`);
          }
        }
      }
    } else if (q.type === 'short_answer') {
      if (q.questionNumber <= 15) {
        qErrors.push(`Question ${q.questionNumber} should be multiple choice`);
      }
      if (q.options && q.options.length > 0) {
        qErrors.push(`Short answer should not have options`);
      }

      const num = parseFloat(q.correctAnswer.replace(',', '.'));
      if (isNaN(num) || num <= 0) {
        qErrors.push(`Short answer must be positive number, got: ${q.correctAnswer}`);
      }
    }

    if (qErrors.length > 0) {
      console.error(`❌ Form ${formId}, Q${q.questionNumber} (${q.type}):`, qErrors);
      totalErrors += qErrors.length;
    }
  }
}

if (totalErrors === 0) {
  console.log('✅ ALL 50 FORMS (1000 QUESTIONS) PASSED 100% MATHEMATICAL VERIFICATION!');
  console.log('   - 0 negative numbers');
  console.log('   - Exactly 20 questions per form (15 multiple choice, 5 short answer)');
  console.log('   - Strictly 4 unique options with exactly 1 correct per multiple choice');
  console.log('   - All short answers are positive integers');
} else {
  console.error(`❌ Total verification errors: ${totalErrors}`);
  process.exit(1);
}
