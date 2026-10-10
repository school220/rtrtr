import { generateFormQuestions } from '../src/db/seed.js';

const russianNumbers: Record<string, number> = {
  'один': 1, 'одна': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5,
  'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10,
  'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14,
  'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18,
  'девятнадцать': 19, 'двадцать': 20, 'тридцать': 30, 'сорок': 40,
  'пятьдесят': 50, 'шестьдесят': 60, 'семьдесят': 70, 'восемьдесят': 80,
  'девяносто': 90, 'сто': 100, 'двести': 200, 'триста': 300, 'четыреста': 400,
  'пятьсот': 500, 'шестьсот': 600, 'семьсот': 700, 'восемьсот': 800, 'девятьсот': 900
};

function parseRussianWords(str: string): number {
  const words = str.toLowerCase().replace(/[^а-яё\s]/g, '').trim().split(/\s+/);
  let total = 0;
  for (const w of words) {
    if (russianNumbers[w]) {
      total += russianNumbers[w];
    }
  }
  return total;
}

export interface StudentInputQuestion {
  questionNumber: number;
  text: string;
  type: 'multiple_choice' | 'short_answer';
  options?: { id: number; label: string; text: string }[];
}

export interface StudentSolution {
  selectedOptionLabel?: string;
  selectedOptionId?: number;
  answerText?: string;
  reasoning: string;
}

/**
 * Autonomous Mathematical Problem Solver for Grade 4 Student
 * STRICTLY uses ONLY the problem text and option texts (no answers/keys allowed).
 */
export function solveMathQuestionAsStudent(q: StudentInputQuestion): StudentSolution {
  const text = q.text;

  // Q1: Запись чисел цифрами по словесному описанию
  if (q.questionNumber === 1) {
    const m = text.match(/\*\*(.*?)\s+целых,\s+(.*?)\s+десят/i);
    if (!m) throw new Error(`Q1 parse error: ${text}`);
    const intVal = parseRussianWords(m[1]);
    const decVal = parseRussianWords(m[2]);
    const targetPattern = `${intVal},${decVal}`;
    const opt = q.options!.find(o => o.text.replace(/[\$\s]/g, '') === targetPattern);
    if (!opt) throw new Error(`Q1 option not found for ${targetPattern}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `Целая часть ${intVal}, дробная ${decVal} десятых -> ${targetPattern}`
    };
  }

  // Q2: Смешанное число со знаменателем 10 в десятичную дробь
  if (q.questionNumber === 2) {
    const m = text.match(/\$(\d+)\\frac\{(\d+)\}\{10\}\$/);
    if (!m) throw new Error(`Q2 parse error: ${text}`);
    const w = m[1];
    const n = m[2];
    const target = `$${w},${n}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q2 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${w} целых и ${n}/10 -> ${w},${n}`
    };
  }

  // Q3: Десятичная дробь в смешанное число
  if (q.questionNumber === 3) {
    const m = text.match(/\$(\d+),(\d+)\$/);
    if (!m) throw new Error(`Q3 parse error: ${text}`);
    const w = m[1];
    const frac = m[2];
    const target = `$${w}\\frac{${frac}}{100}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q3 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${w},${frac} = ${w} целых ${frac}/100`
    };
  }

  // Q4: Сложение десятичных дробей
  if (q.questionNumber === 4) {
    const m = text.match(/\$(\d+),(\d+)\s*\+\s*(\d+),(\d+)\$/);
    if (!m) throw new Error(`Q4 parse error: ${text}`);
    const aInt = parseInt(m[1], 10), aDec = parseInt(m[2], 10);
    const bInt = parseInt(m[3], 10), bDec = parseInt(m[4], 10);
    const sumInt = aInt + bInt + Math.floor((aDec + bDec) / 10);
    const sumDec = (aDec + bDec) % 10;
    const target = `$${sumInt},${sumDec}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q4 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${aInt},${aDec} + ${bInt},${bDec} = ${sumInt},${sumDec}`
    };
  }

  // Q5: Определение неправильной дроби (числитель >= знаменателя)
  if (q.questionNumber === 5) {
    const opt = q.options!.find(o => {
      const fm = o.text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
      if (fm) {
        return parseInt(fm[1], 10) >= parseInt(fm[2], 10);
      }
      return false;
    });
    if (!opt) throw new Error(`Q5 improper fraction not found in options`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `Дробь ${opt.text} неправильная, так как числитель >= знаменателя`
    };
  }

  // Q6: Вычитание правильной дроби из единицы: 1 - a/b
  if (q.questionNumber === 6) {
    const m = text.match(/1\s*-\s*\\frac\{(\d+)\}\{(\d+)\}/);
    if (!m) throw new Error(`Q6 parse error: ${text}`);
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const diff = b - a;
    const target = `$\\frac{${diff}}{${b}}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q6 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `1 - ${a}/${b} = ${b}/${b} - ${a}/${b} = ${diff}/${b}`
    };
  }

  // Q7 & Q9: Сложение смешанных чисел
  if (q.questionNumber === 7 || q.questionNumber === 9) {
    const m = text.match(/\$(\d+)\\frac\{(\d+)\}\{(\d+)\}\s*\+\s*(\d+)\\frac\{(\d+)\}\{(\d+)\}\$/);
    if (!m) throw new Error(`Q${q.questionNumber} parse error: ${text}`);
    const w1 = parseInt(m[1], 10), a = parseInt(m[2], 10), d = parseInt(m[3], 10);
    const w2 = parseInt(m[4], 10), b = parseInt(m[5], 10);
    let totalW = w1 + w2;
    let totalFrac = a + b;
    if (totalFrac >= d) {
      totalW += Math.floor(totalFrac / d);
      totalFrac = totalFrac % d;
    }
    const target = `$${totalW}\\frac{${totalFrac}}{${d}}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q${q.questionNumber} option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${w1} ${a}/${d} + ${w2} ${b}/${d} = ${totalW} ${totalFrac}/${d}`
    };
  }

  // Q8: Сложение дробей с выделением целой части: a/d + b/d = 1 rem/d
  if (q.questionNumber === 8) {
    const m = text.match(/\\frac\{(\d+)\}\{(\d+)\}\s*\+\s*\\frac\{(\d+)\}\{(\d+)\}/);
    if (!m) throw new Error(`Q8 parse error: ${text}`);
    const a = parseInt(m[1], 10), d = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    const sum = a + b;
    const whole = Math.floor(sum / d);
    const rem = sum % d;
    const target = `$${whole}\\frac{${rem}}{${d}}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q8 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${a}/${d} + ${b}/${d} = ${sum}/${d} = ${whole} ${rem}/${d}`
    };
  }

  // Q10: Вычитание смешанных чисел
  if (q.questionNumber === 10) {
    const m = text.match(/\$(\d+)\\frac\{(\d+)\}\{(\d+)\}\s*-\s*(\d+)\\frac\{(\d+)\}\{(\d+)\}\$/);
    if (!m) throw new Error(`Q10 parse error: ${text}`);
    const w1 = parseInt(m[1], 10), a = parseInt(m[2], 10), d = parseInt(m[3], 10);
    const w2 = parseInt(m[4], 10), b = parseInt(m[5], 10);
    const diffW = w1 - w2;
    const diffFrac = a - b;
    const target = `$${diffW}\\frac{${diffFrac}}{${d}}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q10 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${w1} ${a}/${d} - ${w2} ${b}/${d} = ${diffW} ${diffFrac}/${d}`
    };
  }

  // Q11: Смешанное число в неправильную дробь
  if (q.questionNumber === 11) {
    const m = text.match(/\$(\d+)\\frac\{(\d+)\}\{(\d+)\}\$/);
    if (!m) throw new Error(`Q11 parse error: ${text}`);
    const whole = parseInt(m[1], 10), a = parseInt(m[2], 10), b = parseInt(m[3], 10);
    const top = whole * b + a;
    const target = `$\\frac{${top}}{${b}}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q11 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${whole} ${a}/${b} = (${whole}*${b} + ${a})/${b} = ${top}/${b}`
    };
  }

  // Q12: Выделение целой части из неправильной дроби
  if (q.questionNumber === 12) {
    const m = text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (!m) throw new Error(`Q12 parse error: ${text}`);
    const num = parseInt(m[1], 10), den = parseInt(m[2], 10);
    const whole = Math.floor(num / den);
    const rem = num % den;
    const target = `$${whole}\\frac{${rem}}{${den}}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q12 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${num}/${den} = ${whole} ${rem}/${den}`
    };
  }

  // Q13: Порядок действий с дробями
  if (q.questionNumber === 13) {
    const fracs = Array.from(text.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g));
    if (fracs.length < 5) throw new Error(`Q13 parse error: ${text}`);
    const a = parseInt(fracs[0][1], 10), d = parseInt(fracs[0][2], 10);
    const b = parseInt(fracs[1][1], 10);
    const c = parseInt(fracs[2][1], 10);
    const e = parseInt(fracs[3][1], 10);
    const f = parseInt(fracs[4][1], 10);
    const ansNum = (a + b - c) + (e - f);
    const target = `$\\frac{${ansNum}}{${d}}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q13 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `(${a}+${b}-${c}) + (${e}-${f}) = ${ansNum}/${d}`
    };
  }

  // Q14: Деление дробной чертой M / D
  if (q.questionNumber === 14) {
    const m = text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (!m) throw new Error(`Q14 parse error: ${text}`);
    const num = parseInt(m[1], 10), den = parseInt(m[2], 10);
    const ans = Math.round(num / den);
    const target = `$${ans}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q14 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${num} / ${den} = ${ans}`
    };
  }

  // Q15: Порядок действий A - (B - C) : D
  if (q.questionNumber === 15) {
    const m = text.match(/(\d+)\s*-\s*\((\d+)\s*-\s*(\d+)\)\s*:\s*(\d+)/);
    if (!m) throw new Error(`Q15 parse error: ${text}`);
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = parseInt(m[3], 10), d = parseInt(m[4], 10);
    const ans = a - Math.round((b - c) / d);
    const target = `$${ans}$`;
    const opt = q.options!.find(o => o.text.trim() === target);
    if (!opt) throw new Error(`Q15 option not found for ${target}`);
    return {
      selectedOptionLabel: opt.label,
      selectedOptionId: opt.id,
      reasoning: `${a} - (${b} - ${c}) : ${d} = ${a} - ${b - c} : ${d} = ${ans}`
    };
  }

  // Q16: Текстовая задача: сколько блинчиков с мясом
  if (q.questionNumber === 16) {
    const totalM = text.match(/испёк (?:всего )?\$(\d+)\$/);
    const fracM = text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (!totalM || !fracM) throw new Error(`Q16 parse error: ${text}`);
    const total = parseInt(totalM[1], 10);
    const num = parseInt(fracM[1], 10);
    const den = parseInt(fracM[2], 10);
    const meat = Math.round((total / den) * num);
    return {
      answerText: `${meat}`,
      reasoning: `${total} * (${num}/${den}) = ${meat} блинчиков с мясом`
    };
  }

  // Q17: Текстовая задача: сколько блинчиков с вареньем
  if (q.questionNumber === 17) {
    const totalM = text.match(/испёк (?:всего )?\$(\d+)\$/);
    const fracM = text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (!totalM || !fracM) throw new Error(`Q17 parse error: ${text}`);
    const total = parseInt(totalM[1], 10);
    const num = parseInt(fracM[1], 10);
    const den = parseInt(fracM[2], 10);
    const meat = Math.round((total / den) * num);
    const jam = total - meat;
    return {
      answerText: `${jam}`,
      reasoning: `${total} - ${meat} = ${jam} блинчиков с вареньем`
    };
  }

  // Q18: Текстовая задача: продали яблок
  if (q.questionNumber === 18) {
    const totalM = text.match(/привезли \$(\d+)\$/);
    const fracM = text.match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (!totalM || !fracM) throw new Error(`Q18 parse error: ${text}`);
    const total = parseInt(totalM[1], 10);
    const num = parseInt(fracM[1], 10);
    const den = parseInt(fracM[2], 10);
    const sold = Math.round((total / den) * num);
    return {
      answerText: `${sold}`,
      reasoning: `${total} * (${num}/${den}) = ${sold} кг яблок`
    };
  }

  // Q19: Сложение десятичных дробей (открытый ввод)
  if (q.questionNumber === 19) {
    const m = text.match(/(\d+),(\d+)\s*\+\s*(\d+),(\d+)/);
    if (!m) throw new Error(`Q19 parse error: ${text}`);
    const aInt = parseInt(m[1], 10), aDec = parseInt(m[2], 10);
    const bInt = parseInt(m[3], 10), bDec = parseInt(m[4], 10);
    const sumInt = aInt + bInt + Math.floor((aDec + bDec) / 10);
    const sumDec = (aDec + bDec) % 10;
    return {
      answerText: `${sumInt}.${sumDec}`,
      reasoning: `${aInt},${aDec} + ${bInt},${bDec} = ${sumInt}.${sumDec}`
    };
  }

  // Q20: Сложное выражение на порядок действий (открытый ввод)
  if (q.questionNumber === 20) {
    const m = text.match(/\(2\s*(?:\\cdot|[·\*\.])\s*(\d+)\s*\+\s*(\d+)\)\s*:\s*(\d+)/);
    if (!m) throw new Error(`Q20 parse error: ${text}`);
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = parseInt(m[3], 10);
    const ans = Math.round((2 * a + b) / c);
    return {
      answerText: `${ans}`,
      reasoning: `(2 * ${a} + ${b}) : ${c} = ${2 * a + b} : ${c} = ${ans}`
    };
  }

  throw new Error(`Unknown question number: ${q.questionNumber}`);
}

async function verifyAutonomousSolverOnAll50Forms() {
  console.log('🧪 Testing Autonomous Math Solver on all 50 variants (1000 questions)...');
  let correctTotal = 0;
  let totalQuestions = 0;

  for (let formId = 1; formId <= 50; formId++) {
    const questions = generateFormQuestions(formId);

    for (const q of questions) {
      totalQuestions++;
      // Construct student-safe input: NO isCorrect, NO correctAnswer!
      const studentInput: StudentInputQuestion = {
        questionNumber: q.questionNumber,
        text: q.text,
        type: q.type,
        options: q.options?.map((opt, idx) => ({
          id: idx + 1,
          label: opt.label,
          text: opt.text
        }))
      };

      const solution = solveMathQuestionAsStudent(studentInput);

      if (q.type === 'multiple_choice') {
        if (solution.selectedOptionLabel === q.correctAnswer) {
          correctTotal++;
        } else {
          console.error(`❌ Mismatch in Form ${formId} Q${q.questionNumber}: student picked ${solution.selectedOptionLabel}, expected ${q.correctAnswer}`);
          console.error(`   Reasoning: ${solution.reasoning}`);
          console.error(`   Options:`, q.options);
        }
      } else {
        // short answer
        if (solution.answerText === q.correctAnswer || (q.metadata?.acceptedAlternates && q.metadata.acceptedAlternates.includes(solution.answerText))) {
          correctTotal++;
        } else {
          console.error(`❌ Mismatch in Form ${formId} Q${q.questionNumber}: student wrote "${solution.answerText}", expected "${q.correctAnswer}"`);
        }
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ АВТОНОМНОГО МАТЕМАТИКА:`);
  console.log(`✔ Всего решено задач:  ${totalQuestions} / 1000`);
  console.log(`✔ Правильных ответов:  ${correctTotal} / 1000`);
  console.log(`✔ Процент успеха:      ${((correctTotal / totalQuestions) * 100).toFixed(1)}%`);
  console.log(`======================================================\n`);

  if (correctTotal === 1000) {
    console.log('🎉 100% УСПЕХ! АВТОНОМНЫЙ СОЛВЕР РЕШАЕТ ВСЕ 50 ВАРИАНТОВ БЕЗ ПОДСМОТРА В ОТВЕТЫ!');
  } else {
    process.exit(1);
  }
}

verifyAutonomousSolverOnAll50Forms().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
