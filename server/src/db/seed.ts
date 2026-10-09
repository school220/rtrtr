import { getDb, withTransaction, closeDb } from './index.js';
import { runMigrations } from './migrate.js';

export interface GeneratedQuestion {
  questionNumber: number;
  text: string;
  type: 'multiple_choice' | 'short_answer';
  correctAnswer: string;
  explanation: string;
  metadata?: Record<string, any>;
  options?: { label: string; text: string; isCorrect: boolean }[];
}

/**
 * Calculates Greatest Common Divisor (Euclidean algorithm)
 */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

/**
 * Builds 4 unique multiple choice options (A, B, C, D)
 * and guarantees exactly 1 correct option with no negative values.
 */
function makeOptions(
  correctVal: string,
  distractors: string[],
  formId: number,
  qNum: number
): { options: { label: string; text: string; isCorrect: boolean }[]; correctLabel: string } {
  const set = new Set<string>();
  set.add(correctVal.trim());
  const cleanDistractors: string[] = [];

  for (const d of distractors) {
    const s = d.trim();
    if (!set.has(s) && cleanDistractors.length < 3) {
      set.add(s);
      cleanDistractors.push(s);
    }
  }

  let fallback = 1;
  while (cleanDistractors.length < 3) {
    const cand = `${correctVal}*${fallback}`;
    if (!set.has(cand)) {
      set.add(cand);
      cleanDistractors.push(cand);
    }
    fallback++;
  }

  const correctIdx = (formId + qNum) % 4;
  const labels = ['A', 'B', 'C', 'D'];
  const options: { label: string; text: string; isCorrect: boolean }[] = [];
  let dIdx = 0;

  for (let i = 0; i < 4; i++) {
    if (i === correctIdx) {
      options.push({ label: labels[i], text: correctVal, isCorrect: true });
    } else {
      options.push({ label: labels[i], text: cleanDistractors[dIdx++], isCorrect: false });
    }
  }

  return { options, correctLabel: labels[correctIdx] };
}

/**
 * Generates 20 mathematically verified Grade 4 curriculum questions
 * personalized for student formId (1..50).
 * Based strictly on user-provided textbook photos:
 * - Ordinary fractions, mixed numbers, and decimals
 * - 100% strictly irreducible fractions (gcd = 1)
 * - 0 negative numbers anywhere in solutions or options
 */
export function generateFormQuestions(formId: number): GeneratedQuestion[] {
  const k = formId; // 1..50
  const questions: GeneratedQuestion[] = [];

  // ==========================================
  // ВОПРОСЫ 1 - 15 (Выбор из 4 вариантов A, B, C, D)
  // ==========================================

  // Q1: Запись чисел цифрами по словесному описанию (Десятичные дроби)
  // «двадцать восемь целых, пять десятых» -> 28,5
  const intWords = [
    { num: 28, text: 'двадцать восемь' },
    { num: 106, text: 'сто шесть' },
    { num: 70, text: 'семьдесят' },
    { num: 212, text: 'двести двенадцать' },
    { num: 45, text: 'сорок пять' },
    { num: 83, text: 'восемьдесят три' },
    { num: 154, text: 'сто пятьдесят четыре' },
    { num: 39, text: 'тридцать девять' },
    { num: 91, text: 'девяносто один' },
    { num: 62, text: 'шестьдесят два' },
  ];
  const decWords = [
    { num: 1, text: 'одна десятая' },
    { num: 3, text: 'три десятых' },
    { num: 5, text: 'пять десятых' },
    { num: 7, text: 'семь десятых' },
    { num: 9, text: 'девять десятых' },
  ];
  const q1Int = intWords[(k * 3) % intWords.length];
  const q1Dec = decWords[(k * 2) % decWords.length];
  const q1Ans = `${q1Int.num},${q1Dec.num}`;
  const q1Opts = makeOptions(
    `$${q1Ans}$`,
    [`$${q1Int.num},0${q1Dec.num}$`, `$${q1Int.num * 10 + q1Dec.num}$`, `$0,${q1Int.num}$`],
    k,
    1
  );
  questions.push({
    questionNumber: 1,
    text: `Запишите число цифрами: **${q1Int.text} целых, ${q1Dec.text}**.`,
    type: 'multiple_choice',
    correctAnswer: q1Opts.correctLabel,
    explanation: `Целая часть равна $${q1Int.num}$, а дробная часть содержит $${q1Dec.num}$ десятых, поэтому число записывается как $${q1Ans}$.`,
    options: q1Opts.options,
  });

  // Q2: Запись обыкновенных дробей со знаменателем 10 или 100 в десятичном виде
  // 7 6/10 -> 7,6; 45 8/10 -> 45,8
  const q2Wholes = [4, 7, 12, 25, 45, 68, 93, 124, 31, 56];
  const q2Numerators = [1, 2, 3, 4, 6, 7, 8, 9];
  const q2W = q2Wholes[(k * 5) % q2Wholes.length];
  const q2N = q2Numerators[(k * 7) % q2Numerators.length];
  const q2Ans = `${q2W},${q2N}`;
  const q2Opts = makeOptions(
    `$${q2Ans}$`,
    [`$${q2W},0${q2N}$`, `$${q2W * 10 + q2N}$`, `$0,${q2W}${q2N}$`],
    k,
    2
  );
  questions.push({
    questionNumber: 2,
    text: `Запишите смешанное число в виде десятичной дроби: $${q2W}\\frac{${q2N}}{10}$`,
    type: 'multiple_choice',
    correctAnswer: q2Opts.correctLabel,
    explanation: `Дробь со знаменателем $10$ имеет один знак после запятой: $${q2W}\\frac{${q2N}}{10} = ${q2Ans}$.`,
    options: q2Opts.options,
  });

  // Q3: Перевод десятичной дроби в несократимую обыкновенную/смешанную дробь
  // 4,81 -> 4 81/100 (gcd(81, 100) = 1)
  const q3Coprimes = [81, 67, 37, 71, 93, 23, 49, 73, 17, 31, 53, 77, 89, 97];
  const q3W = 3 + (k % 7); // 3..9
  const q3Frac = q3Coprimes[(k * 3) % q3Coprimes.length];
  const q3DecStr = `${q3W},${q3Frac}`;
  const q3AnsStr = `$${q3W}\\frac{${q3Frac}}{100}$`;
  const q3Opts = makeOptions(
    q3AnsStr,
    [
      `$${q3W}\\frac{${q3Frac}}{10}$`,
      `$${q3W * 10}\\frac{${q3Frac}}{100}$`,
      `$\\frac{${q3W * 100 + q3Frac}}{10}$`,
    ],
    k,
    3
  );
  questions.push({
    questionNumber: 3,
    text: `Запишите десятичную дробь в виде смешанного числа: $${q3DecStr}$`,
    type: 'multiple_choice',
    correctAnswer: q3Opts.correctLabel,
    explanation: `Два знака после запятой означают сотые доли: $${q3DecStr} = ${q3W}\\frac{${q3Frac}}{100}$. Данная дробь несократима, так как $\\gcd(${q3Frac}, 100) = 1$.`,
    options: q3Opts.options,
  });

  // Q4: Сложение десятичных дробей
  // 5,2 + 4,3 = 9,5; 7,2 + 4,5 = 11,7
  const q4A_int = 4 + (k % 6);
  const q4A_dec = 1 + ((k * 3) % 4); // 1..4
  const q4B_int = 3 + ((k * 2) % 5);
  const q4B_dec = 2 + ((k * 5) % 4); // 2..5
  const q4Sum_int = q4A_int + q4B_int + Math.floor((q4A_dec + q4B_dec) / 10);
  const q4Sum_dec = (q4A_dec + q4B_dec) % 10;
  const q4Ans = `${q4Sum_int},${q4Sum_dec}`;
  const q4Opts = makeOptions(
    `$${q4Ans}$`,
    [`$${q4Sum_int + 1},${q4Sum_dec}$`, `$${q4Sum_int},${(q4Sum_dec + 2) % 10}$`, `$${q4Sum_int - 1},${q4Sum_dec}$`],
    k,
    4
  );
  questions.push({
    questionNumber: 4,
    text: `Вычислите: $${q4A_int},${q4A_dec} + ${q4B_int},${q4B_dec}$`,
    type: 'multiple_choice',
    correctAnswer: q4Opts.correctLabel,
    explanation: `Складываем поразрядно: $${q4A_int},${q4A_dec} + ${q4B_int},${q4B_dec} = ${q4Ans}$.`,
    options: q4Opts.options,
  });

  // Q5: Правильные и неправильные дроби
  // Какая из дробей является неправильной?
  const q5Primes = [7, 11, 13, 17, 19, 23];
  const q5D = q5Primes[k % q5Primes.length];
  const q5ImproperNum = q5D + 2 + (k % 5); // > q5D, gcd = 1
  const q5Prop1 = Math.max(1, q5D - 3);
  const q5Prop2 = Math.max(2, q5D - 2);
  const q5Prop3 = Math.max(1, q5D - 4);
  const q5Opts = makeOptions(
    `$\\frac{${q5ImproperNum}}{${q5D}}$`,
    [
      `$\\frac{${q5Prop1}}{${q5D}}$`,
      `$\\frac{${q5Prop2}}{${q5D}}$`,
      `$\\frac{${q5Prop3}}{${q5D}}$`,
    ],
    k,
    5
  );
  questions.push({
    questionNumber: 5,
    text: `Укажите, какая из следующих дробей является **неправильной**:`,
    type: 'multiple_choice',
    correctAnswer: q5Opts.correctLabel,
    explanation: `Неправильная дробь — это дробь, у которой числитель больше знаменателя или равен ему: $${q5ImproperNum} > ${q5D}$, значит дробь $\\frac{${q5ImproperNum}}{${q5D}}$ неправильная.`,
    options: q5Opts.options,
  });

  // Q6: Вычитание правильной дроби из единицы: 1 - a/b
  // Гарантируем gcd(b - a, b) = 1
  const q6Denoms = [9, 11, 13, 17, 19, 23, 29];
  const q6B = q6Denoms[k % q6Denoms.length];
  let q6A = 2 + (k % (q6B - 3));
  while (gcd(q6A, q6B) !== 1 || gcd(q6B - q6A, q6B) !== 1) {
    q6A = (q6A + 1) % (q6B - 1);
    if (q6A <= 1) q6A = 2;
  }
  const q6Diff = q6B - q6A;
  const q6Opts = makeOptions(
    `$\\frac{${q6Diff}}{${q6B}}$`,
    [
      `$\\frac{${q6A}}{${q6B}}$`,
      `$\\frac{${q6Diff + 1}}{${q6B}}$`,
      `$\\frac{${Math.max(1, q6Diff - 1)}}{${q6B}}$`,
    ],
    k,
    6
  );
  questions.push({
    questionNumber: 6,
    text: `Вычислите: $1 - \\frac{${q6A}}{${q6B}}$`,
    type: 'multiple_choice',
    correctAnswer: q6Opts.correctLabel,
    explanation: `Представляем единицу как $\\frac{${q6B}}{${q6B}}$: $1 - \\frac{${q6A}}{${q6B}} = \\frac{${q6B} - ${q6A}}{${q6B}} = \\frac{${q6Diff}}{${q6B}}$. Данная дробь несократима.`,
    options: q6Opts.options,
  });

  // Q7: Сложение смешанного числа и дроби без перехода через единицу (a + b < d, gcd = 1)
  const q7Denoms = [7, 9, 11, 13, 17];
  const q7D = q7Denoms[k % q7Denoms.length];
  let q7a = 1 + (k % 3);
  let q7b = 1 + ((k * 2) % 3);
  while (q7a + q7b >= q7D || gcd(q7a + q7b, q7D) !== 1) {
    q7b = Math.max(1, (q7b + 1) % (q7D - q7a));
    if (q7a + q7b >= q7D) q7a = 1;
  }
  const q7W1 = 2 + (k % 7);
  const q7W2 = 1 + ((k * 3) % 5);
  const q7SumW = q7W1 + q7W2;
  const q7SumFrac = q7a + q7b;
  const q7Opts = makeOptions(
    `$${q7SumW}\\frac{${q7SumFrac}}{${q7D}}$`,
    [
      `$${q7SumW}\\frac{${q7SumFrac + 1}}{${q7D}}$`,
      `$${q7SumW - 1}\\frac{${q7SumFrac}}{${q7D}}$`,
      `$${q7SumW}\\frac{${Math.max(1, q7SumFrac - 1)}}{${q7D}}$`,
    ],
    k,
    7
  );
  questions.push({
    questionNumber: 7,
    text: `Вычислите: $${q7W1}\\frac{${q7a}}{${q7D}} + ${q7W2}\\frac{${q7b}}{${q7D}}$`,
    type: 'multiple_choice',
    correctAnswer: q7Opts.correctLabel,
    explanation: `Складываем отдельно целые части и дробные части: $(${q7W1} + ${q7W2}) + \\frac{${q7a} + ${q7b}}{${q7D}} = ${q7SumW}\\frac{${q7SumFrac}}{${q7D}}$. Дробь несократима, так как $\\gcd(${q7SumFrac}, ${q7D}) = 1$.`,
    options: q7Opts.options,
  });

  // Q8: Сложение дробей с переходом через единицу (выделение целой части: a/d + b/d = 1 c/d)
  const q8Denoms = [7, 9, 11, 13, 17, 19];
  const q8D = q8Denoms[k % q8Denoms.length];
  let q8Rem = 1 + (k % (q8D - 2));
  while (gcd(q8Rem, q8D) !== 1) {
    q8Rem = (q8Rem + 1) % (q8D - 1);
    if (q8Rem === 0) q8Rem = 1;
  }
  const q8SumNum = q8D + q8Rem;
  const q8A = Math.floor(q8SumNum / 2);
  const q8B = q8SumNum - q8A;
  const q8Opts = makeOptions(
    `$1\\frac{${q8Rem}}{${q8D}}$`,
    [
      `$\\frac{${q8SumNum}}{${q8D + 1}}$`,
      `$1\\frac{${q8Rem + 1}}{${q8D}}$`,
      `$2\\frac{${q8Rem}}{${q8D}}$`,
    ],
    k,
    8
  );
  questions.push({
    questionNumber: 8,
    text: `Вычислите сумму и запишите результат в виде смешанного числа: $\\frac{${q8A}}{${q8D}} + \\frac{${q8B}}{${q8D}}$`,
    type: 'multiple_choice',
    correctAnswer: q8Opts.correctLabel,
    explanation: `Складываем числители: $\\frac{${q8A} + ${q8B}}{${q8D}} = \\frac{${q8SumNum}}{${q8D}}$. Выделяем целую часть: $\\frac{${q8SumNum}}{${q8D}} = 1\\frac{${q8Rem}}{${q8D}}$. Дробь $\\frac{${q8Rem}}{${q8D}}$ несократима.`,
    options: q8Opts.options,
  });

  // Q9: Сложение смешанных чисел с выделением единицы: A a/d + B b/d = (A + B + 1) rem/d
  const q9Denoms = [7, 9, 11, 13, 17];
  const q9D = q9Denoms[k % q9Denoms.length];
  let q9Rem = 1 + (k % (q9D - 2));
  while (gcd(q9Rem, q9D) !== 1) {
    q9Rem = (q9Rem + 1) % (q9D - 1);
    if (q9Rem === 0) q9Rem = 1;
  }
  const q9SumNum = q9D + q9Rem;
  const q9a = Math.floor(q9SumNum / 2);
  const q9b = q9SumNum - q9a;
  const q9W1 = 3 + (k % 6);
  const q9W2 = 2 + ((k * 2) % 5);
  const q9TotalW = q9W1 + q9W2 + 1;
  const q9Opts = makeOptions(
    `$${q9TotalW}\\frac{${q9Rem}}{${q9D}}$`,
    [
      `$${q9W1 + q9W2}\\frac{${q9SumNum}}{${q9D}}$`,
      `$${q9TotalW}\\frac{${q9Rem + 1}}{${q9D}}$`,
      `$${q9TotalW + 1}\\frac{${q9Rem}}{${q9D}}$`,
    ],
    k,
    9
  );
  questions.push({
    questionNumber: 9,
    text: `Вычислите: $${q9W1}\\frac{${q9a}}{${q9D}} + ${q9W2}\\frac{${q9b}}{${q9D}}$`,
    type: 'multiple_choice',
    correctAnswer: q9Opts.correctLabel,
    explanation: `Складываем целые части: $${q9W1} + ${q9W2} = ${q9W1 + q9W2}$. Складываем дроби: $\\frac{${q9a} + ${q9b}}{${q9D}} = \\frac{${q9SumNum}}{${q9D}} = 1\\frac{${q9Rem}}{${q9D}}$. Итого: $${q9W1 + q9W2} + 1\\frac{${q9Rem}}{${q9D}} = ${q9TotalW}\\frac{${q9Rem}}{${q9D}}$. Дробная часть несократима.`,
    options: q9Opts.options,
  });

  // Q10: Вычитание смешанных чисел и дробей: A a/d - B b/d = (A - B) (a - b)/d
  const q10Denoms = [11, 13, 16, 17, 19, 21, 23];
  const q10D = q10Denoms[k % q10Denoms.length];
  let q10DiffNum = 1 + (k % (q10D - 4));
  while (gcd(q10DiffNum, q10D) !== 1) {
    q10DiffNum = (q10DiffNum + 1) % (q10D - 2);
    if (q10DiffNum === 0) q10DiffNum = 1;
  }
  const q10b = 2 + (k % 4);
  const q10a = q10b + q10DiffNum;
  const q10W2 = 2 + (k % 5);
  const q10W1 = q10W2 + 3 + ((k * 3) % 6); // W1 > W2
  const q10DiffW = q10W1 - q10W2;
  const q10Opts = makeOptions(
    `$${q10DiffW}\\frac{${q10DiffNum}}{${q10D}}$`,
    [
      `$${q10DiffW}\\frac{${q10DiffNum + 1}}{${q10D}}$`,
      `$${q10DiffW - 1}\\frac{${q10DiffNum}}{${q10D}}$`,
      `$${q10DiffW + 1}\\frac{${q10DiffNum}}{${q10D}}$`,
    ],
    k,
    10
  );
  questions.push({
    questionNumber: 10,
    text: `Вычислите разность: $${q10W1}\\frac{${q10a}}{${q10D}} - ${q10W2}\\frac{${q10b}}{${q10D}}$`,
    type: 'multiple_choice',
    correctAnswer: q10Opts.correctLabel,
    explanation: `Вычитаем отдельно целые и дробные части: $(${q10W1} - ${q10W2}) + \\frac{${q10a} - ${q10b}}{${q10D}} = ${q10DiffW}\\frac{${q10DiffNum}}{${q10D}}$. Так как $\\gcd(${q10DiffNum}, ${q10D}) = 1$, дробь несократима.`,
    options: q10Opts.options,
  });

  // Q11: Перевод смешанной дроби в неправильную (A a/b -> (A*b + a)/b)
  const q11Denoms = [3, 5, 7, 8, 9, 11];
  const q11B = q11Denoms[k % q11Denoms.length];
  let q11A_num = 1 + (k % (q11B - 1));
  while (gcd(q11A_num, q11B) !== 1) {
    q11A_num = (q11A_num + 1) % q11B;
    if (q11A_num === 0) q11A_num = 1;
  }
  const q11Whole = 3 + (k % 6);
  const q11Top = q11Whole * q11B + q11A_num; // gcd(top, B) = gcd(A_num, B) = 1!
  const q11Opts = makeOptions(
    `$\\frac{${q11Top}}{${q11B}}$`,
    [
      `$\\frac{${q11Top + 2}}{${q11B}}$`,
      `$\\frac{${q11Whole * q11B}}{${q11B}}$`,
      `$\\frac{${q11Top}}{${q11B + 1}}$`,
    ],
    k,
    11
  );
  questions.push({
    questionNumber: 11,
    text: `Запишите смешанное число в виде неправильной дроби: $${q11Whole}\\frac{${q11A_num}}{${q11B}}$`,
    type: 'multiple_choice',
    correctAnswer: q11Opts.correctLabel,
    explanation: `Умножаем целую часть на знаменатель и прибавляем числитель: $\\frac{${q11Whole} \\cdot ${q11B} + ${q11A_num}}{${q11B}} = \\frac{${q11Top}}{${q11B}}$. Данная дробь несократима.`,
    options: q11Opts.options,
  });

  // Q12: Выделение целой части из неправильной дроби (M/d -> q r/d)
  const q12Denoms = [13, 16, 17, 19, 21, 23];
  const q12D = q12Denoms[k % q12Denoms.length];
  let q12Rem = 1 + (k % (q12D - 2));
  while (gcd(q12Rem, q12D) !== 1) {
    q12Rem = (q12Rem + 1) % (q12D - 1);
    if (q12Rem === 0) q12Rem = 1;
  }
  const q12Q = 2 + (k % 4);
  const q12M = q12Q * q12D + q12Rem;
  const q12Opts = makeOptions(
    `$${q12Q}\\frac{${q12Rem}}{${q12D}}$`,
    [
      `$${q12Q + 1}\\frac{${q12Rem}}{${q12D}}$`,
      `$${q12Q}\\frac{${q12Rem + 1}}{${q12D}}$`,
      `$${q12Q - 1}\\frac{${q12Rem}}{${q12D}}$`,
    ],
    k,
    12
  );
  questions.push({
    questionNumber: 12,
    text: `Выделите целую часть из неправильной дроби: $\\frac{${q12M}}{${q12D}}$`,
    type: 'multiple_choice',
    correctAnswer: q12Opts.correctLabel,
    explanation: `Делим $${q12M}$ на $${q12D}$ с остатком: неполное частное $${q12Q}$, остаток $${q12Rem}$. Получаем $${q12Q}\\frac{${q12Rem}}{${q12D}}$. Дробная часть несократима.`,
    options: q12Opts.options,
  });

  // Q13: Порядок действий с дробями со скобками
  // (a/d + b/d - c/d) + (e/d - f/d)
  const q13D = 107; // простое число => любая дробь строго несократима!
  const q13A = 15 + (k % 10);
  const q13B = 30 + ((k * 2) % 15);
  const q13C = 10 + (k % 10);
  const q13E = 40 + ((k * 3) % 20);
  const q13F = 20 + (k % 15);
  const q13AnsNum = (q13A + q13B - q13C) + (q13E - q13F);
  const q13Opts = makeOptions(
    `$\\frac{${q13AnsNum}}{${q13D}}$`,
    [
      `$\\frac{${q13AnsNum + 10}}{${q13D}}$`,
      `$\\frac{${q13AnsNum - 10}}{${q13D}}$`,
      `$\\frac{${q13AnsNum + 1}}{${q13D}}$`,
    ],
    k,
    13
  );
  questions.push({
    questionNumber: 13,
    text: `Вычислите значение выражения: $$\\left(\\frac{${q13A}}{${q13D}} + \\frac{${q13B}}{${q13D}} - \\frac{${q13C}}{${q13D}}\\right) + \\left(\\frac{${q13E}}{${q13D}} - \\frac{${q13F}}{${q13D}}\\right)$$`,
    type: 'multiple_choice',
    correctAnswer: q13Opts.correctLabel,
    explanation: `1) В первых скобках: $\\frac{${q13A} + ${q13B} - ${q13C}}{${q13D}} = \\frac{${q13A + q13B - q13C}}{${q13D}}$; 2) Во вторых скобках: $\\frac{${q13E} - ${q13F}}{${q13D}} = \\frac{${q13E - q13F}}{${q13D}}$; 3) Складываем результаты: $\\frac{${q13AnsNum}}{${q13D}}$. Число $${q13D}$ простое, дробь несократима.`,
    options: q13Opts.options,
  });

  // Q14: Деление многозначного числа нацело (записанное дробной чертой)
  // 4808 / 4 = 1202, 8515 / 5 = 1703
  const q14Divisors = [3, 4, 5, 6];
  const q14D = q14Divisors[k % q14Divisors.length];
  const q14Ans = 1200 + ((k * 17) % 800) + 1; // e.g. 1201..2000
  const q14M = q14Ans * q14D;
  const q14Opts = makeOptions(
    `$${q14Ans}$`,
    [`$${q14Ans + 10}$`, `$${q14Ans - 10}$`, `$${q14Ans + 100}$`],
    k,
    14
  );
  questions.push({
    questionNumber: 14,
    text: `Вычислите: $$\\frac{${q14M}}{${q14D}}$$`,
    type: 'multiple_choice',
    correctAnswer: q14Opts.correctLabel,
    explanation: `Дробная черта означает деление: $${q14M} : ${q14D} = ${q14Ans}$.`,
    options: q14Opts.options,
  });

  // Q15: Порядок действий с многозначными числами и скобками
  // A - (B - C) : D
  const q15D = 3 + (k % 4); // 3, 4, 5, 6
  const q15Quot = 50 + ((k * 7) % 60); // 50..109
  const q15Diff = q15Quot * q15D; // деление нацело
  const q15C = 100 + (k % 50);
  const q15B = q15C + q15Diff;
  const q15A = 1000 + ((k * 23) % 500);
  const q15Ans = q15A - q15Quot; // строго > 0
  const q15Opts = makeOptions(
    `$${q15Ans}$`,
    [`$${q15Ans + 10}$`, `$${q15Ans - 10}$`, `$${q15Ans + q15Quot}$`],
    k,
    15
  );
  questions.push({
    questionNumber: 15,
    text: `Вычислите значение выражения: $$${q15A} - (${q15B} - ${q15C}) : ${q15D}$$`,
    type: 'multiple_choice',
    correctAnswer: q15Opts.correctLabel,
    explanation: `1) Действие в скобках: $${q15B} - ${q15C} = ${q15Diff}$; 2) Деление: $${q15Diff} : ${q15D} = ${q15Quot}$; 3) Вычитание: $${q15A} - ${q15Quot} = ${q15Ans}$.`,
    options: q15Opts.options,
  });

  // ==========================================
  // ВОПРОСЫ 16 - 20 (Открытый числовой ввод)
  // ==========================================

  // Q16: Текстовая задача на нахождение дроби от числа (блинчики с мясом)
  const q16Denom = 8;
  const q16Num = 5;
  const q16Base = 40 + ((k * 3) % 30); // 40..69
  const q16Total = q16Base * q16Denom; // e.g. 320..552 (кратно 8)
  const q16Meat = q16Base * q16Num;
  questions.push({
    questionNumber: 16,
    text: `Повар испёк всего $${q16Total}$ блинчиков. Из них $\\frac{${q16Num}}{${q16Denom}}$ часть блинчиков он сделал с мясом, а остальные — с вареньем. Сколько блинчиков с мясом сделал повар? (Запишите только число)`,
    type: 'short_answer',
    correctAnswer: `${q16Meat}`,
    explanation: `1) Находим массу одной восьмой части: $${q16Total} : ${q16Denom} = ${q16Base}$; 2) Находим количество блинчиков с мясом: $${q16Base} \\cdot ${q16Num} = ${q16Meat}$.`,
  });

  // Q17: Текстовая задача на нахождение остатка от дроби числа (блинчики с вареньем)
  const q17Jam = q16Total - q16Meat;
  questions.push({
    questionNumber: 17,
    text: `Повар испёк $${q16Total}$ блинчиков. $\\frac{${q16Num}}{${q16Denom}}$ всех блинчиков он сделал с мясом, а остальные — с вареньем. Сколько блинчиков с вареньем сделал повар? (Запишите только число)`,
    type: 'short_answer',
    correctAnswer: `${q17Jam}`,
    explanation: `1) Блинчиков с мясом: $${q16Total} : ${q16Denom} \\cdot ${q16Num} = ${q16Meat}$; 2) Блинчиков с вареньем: $${q16Total} - ${q16Meat} = ${q17Jam}$.`,
  });

  // Q18: Части величин (нахождение части величины)
  const q18Denoms = [4, 5, 6, 10];
  const q18D = q18Denoms[k % q18Denoms.length];
  const q18N = 3;
  const q18Part = 20 + ((k * 4) % 25);
  const q18TotalKg = q18Part * q18D;
  const q18Ans = q18Part * q18N;
  questions.push({
    questionNumber: 18,
    text: `В магазин привезли $${q18TotalKg}$ кг яблок. До обеда продали $\\frac{${q18N}}{${q18D}}$ часть всех яблок. Сколько килограммов яблок продали? (Запишите только число)`,
    type: 'short_answer',
    correctAnswer: `${q18Ans}`,
    explanation: `1) Находим $\\frac{1}{${q18D}}$ долю: $${q18TotalKg} : ${q18D} = ${q18Part}$ кг; 2) Умножаем на числитель: $${q18Part} \\cdot ${q18N} = ${q18Ans}$ кг.`,
  });

  // Q19: Сложение десятичных дробей (открытый ввод)
  // 8,1 + 2,5 = 10,6
  const q19A_int = 5 + (k % 6);
  const q19A_dec = 1 + ((k * 2) % 4);
  const q19B_int = 2 + ((k * 3) % 5);
  const q19B_dec = 2 + ((k * 4) % 4);
  const q19Sum_int = q19A_int + q19B_int + Math.floor((q19A_dec + q19B_dec) / 10);
  const q19Sum_dec = (q19A_dec + q19B_dec) % 10;
  const q19Ans = `${q19Sum_int}.${q19Sum_dec}`;
  questions.push({
    questionNumber: 19,
    text: `Вычислите: $$${q19A_int},${q19A_dec} + ${q19B_int},${q19B_dec}$$ (Запишите ответ десятичной дробью через точку или запятую)`,
    type: 'short_answer',
    correctAnswer: `${q19Ans}`,
    metadata: { acceptedAlternates: [`${q19Sum_int},${q19Sum_dec}`] },
    explanation: `Складываем числа: $${q19A_int},${q19A_dec} + ${q19B_int},${q19B_dec} = ${q19Sum_int},${q19Sum_dec}$.`,
  });

  // Q20: Сложное выражение на порядок действий (открытый ввод)
  // (2 * a + b) : c
  const q20C = 5;
  const q20Quot = 120 + ((k * 7) % 80); // 120..199
  const q20Inside = q20Quot * q20C; // кратно 5
  const q20A = 100 + (k % 40);
  const q20B = q20Inside - 2 * q20A; // > 0
  questions.push({
    questionNumber: 20,
    text: `Вычислите значение выражения: $$(2 \\cdot ${q20A} + ${q20B}) : ${q20C}$$ (Запишите только число)`,
    type: 'short_answer',
    correctAnswer: `${q20Quot}`,
    explanation: `1) Умножение в скобках: $2 \\cdot ${q20A} = ${2 * q20A}$; 2) Сложение в скобках: $${2 * q20A} + ${q20B} = ${q20Inside}$; 3) Деление: $${q20Inside} : ${q20C} = ${q20Quot}$.`,
  });

  return questions;
}

/**
 * Seeds the database with all 50 unique forms and their 20 questions (1000 total).
 * @param force If true, drops and re-seeds existing forms and questions.
 */
export async function seedDatabase(force: boolean = false): Promise<void> {
  console.log('🌱 Starting database seed (50 forms × 20 questions = 1000 assignments)...');
  await runMigrations();

  await withTransaction(async (db) => {
    // Delete any previous questions beyond 20
    await db.query('DELETE FROM form_questions WHERE question_number > 20');

    // Check if forms already seeded with exactly 20 questions for Grade 4 fractions
    if (!force) {
      const q20Count = await db.query('SELECT COUNT(*) as count FROM form_questions WHERE question_number = 20');
      const count = parseInt(q20Count.rows[0]?.count || '0', 10);
      const totalCount = await db.query('SELECT COUNT(*) as count FROM form_questions');
      const total = parseInt(totalCount.rows[0]?.count || '0', 10);
      const titleCheck = await db.query("SELECT COUNT(*) as count FROM forms WHERE title LIKE '%Дроби%'");
      const titleCount = parseInt(titleCheck.rows[0]?.count || '0', 10);

      if (count >= 50 && total === 1000 && titleCount >= 50) {
        console.log(`ℹ️ Database already contains 50 4th-grade forms with 20 questions each. Skipping seed.`);
        return;
      }
    }

    console.log('📝 Seeding 50 unique Grade 4 cards, questions, and options (20 questions each)...');

    for (let formId = 1; formId <= 50; formId++) {
      // 1. Insert form
      await db.query(
        `INSERT INTO forms (form_id, title) VALUES ($1, $2)
         ON CONFLICT (form_id) DO UPDATE SET title = EXCLUDED.title`,
        [formId, `Бланк №${formId} (4 класс • Дроби)`]
      );

      const questions = generateFormQuestions(formId);

      for (const q of questions) {
        // Unique code per question in variant
        const qCode = `FORM_${formId}_Q${q.questionNumber}`;

        const qRes = await db.query(
          `INSERT INTO questions (code, text, type, points, correct_answer, explanation, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (code) DO UPDATE SET 
             text = EXCLUDED.text,
             type = EXCLUDED.type,
             points = EXCLUDED.points,
             correct_answer = EXCLUDED.correct_answer,
             explanation = EXCLUDED.explanation,
             metadata = EXCLUDED.metadata
           RETURNING id`,
          [
            qCode,
            q.text,
            q.type,
            1,
            q.correctAnswer,
            q.explanation,
            JSON.stringify(q.metadata || {}),
          ]
        );

        const questionDbId = qRes.rows[0]?.id;

        // Insert into form_questions
        await db.query(
          `INSERT INTO form_questions (form_id, question_id, question_number)
           VALUES ($1, $2, $3)
           ON CONFLICT (form_id, question_number) DO UPDATE SET question_id = EXCLUDED.question_id`,
          [formId, questionDbId, q.questionNumber]
        );

        // If multiple choice, insert or update 4 options safely
        if (q.type === 'multiple_choice' && q.options) {
          const existingOpts = await db.query(
            'SELECT id, option_label FROM answer_options WHERE question_id = $1 ORDER BY sort_order',
            [questionDbId]
          );

          if (existingOpts.rows.length === q.options.length) {
            // Update in place to respect foreign key constraints
            for (const opt of q.options) {
              await db.query(
                `UPDATE answer_options
                 SET option_text = $1, is_correct = $2
                 WHERE question_id = $3 AND option_label = $4`,
                [opt.text, opt.isCorrect, questionDbId, opt.label]
              );
            }
          } else {
            // Fresh insert if not matching
            try {
              await db.query('DELETE FROM answer_options WHERE question_id = $1', [questionDbId]);
            } catch {
              // Ignore FK constraint if rows cannot be deleted
            }
            for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
              const opt = q.options[optIdx];
              await db.query(
                `INSERT INTO answer_options (question_id, option_label, option_text, is_correct, sort_order)
                 VALUES ($1, $2, $3, $4, $5)`,
                [questionDbId, opt.label, opt.text, opt.isCorrect, optIdx]
              );
            }
          }
        }
      }
    }
  });

  console.log('✅ Successfully seeded 50 unique Grade 4 cards with 20 questions each (total 1000 assignments).');
}

// Direct execution
if (process.argv[1] && process.argv[1].includes('seed')) {
  const force = process.argv.includes('--force');
  seedDatabase(force)
    .then(() => closeDb())
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
