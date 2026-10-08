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
 * Generates 30 mathematically verified 5th-grade curriculum questions
 * personalized for student formId (1..50).
 * Every student receives unique numbers, options, and answers.
 * Progression: from basic to advanced and Olympiad-level.
 */
export function generateFormQuestions(formId: number): GeneratedQuestion[] {
  const k = formId; // 1..50
  const questions: GeneratedQuestion[] = [];

  // ==========================================
  // ВОПРОСЫ 1 - 20 (Выбор ответа из 4 вариантов)
  // ==========================================

  // Q1: Тема 1. Умножение числа на 10, 100 и 1000 (Базовый уровень)
  const q1Num = 24 + (k * 3) % 65; // 24..88
  const q1Mult = (k % 2 === 0) ? 100 : 10;
  const q1Ans = q1Num * q1Mult;
  questions.push({
    questionNumber: 1,
    text: `Вычислите: $${q1Num} \\cdot ${q1Mult}$`,
    type: 'multiple_choice',
    correctAnswer: `${q1Ans}`,
    explanation: `При умножении числа на $${q1Mult}$ справа приписываем ${q1Mult === 10 ? 'один ноль' : 'два нуля'}: $${q1Num} \\cdot ${q1Mult} = ${q1Ans}$.`,
    options: [
      { label: 'A', text: `$${q1Ans}$`, isCorrect: true },
      { label: 'B', text: `$${q1Ans * 10}$`, isCorrect: false },
      { label: 'C', text: `$${Math.floor(q1Ans / 10)}$`, isCorrect: false },
      { label: 'D', text: `$${q1Num + q1Mult}$`, isCorrect: false },
    ],
  });

  // Q2: Тема 2. Умножение числа на десятки, сотни и тысячи (Базовый уровень)
  const q2A = 12 + (k % 8); // 12..19
  const q2B = (2 + (k % 4)) * 10; // 20, 30, 40, 50
  const q2Ans = q2A * q2B;
  questions.push({
    questionNumber: 2,
    text: `Найдите произведение: $${q2A} \\cdot ${q2B}$`,
    type: 'multiple_choice',
    correctAnswer: `${q2Ans}`,
    explanation: `$${q2A} \\cdot ${q2B} = ${q2A} \\cdot ${q2B / 10} \\cdot 10 = ${q2A * (q2B / 10)} \\cdot 10 = ${q2Ans}$.`,
    options: [
      { label: 'A', text: `$${q2Ans + 20}$`, isCorrect: false },
      { label: 'B', text: `$${q2Ans}$`, isCorrect: true },
      { label: 'C', text: `$${q2A * (q2B / 10)}$`, isCorrect: false },
      { label: 'D', text: `$${q2Ans + 100}$`, isCorrect: false },
    ],
  });

  // Q3: Тема 3. Деление числа на 10, 100 и 1000 (Базовый уровень)
  const q3Quot = 35 + (k % 50); // 35..84
  const q3Div = (k % 3 === 0) ? 1000 : ((k % 2 === 0) ? 100 : 10);
  const q3Dividend = q3Quot * q3Div;
  questions.push({
    questionNumber: 3,
    text: `Вычислите значение частного: $${q3Dividend} : ${q3Div}$`,
    type: 'multiple_choice',
    correctAnswer: `${q3Quot}`,
    explanation: `При делении на $${q3Div}$ убираем справа ${q3Div === 10 ? 'один ноль' : q3Div === 100 ? 'два нуля' : 'три нуля'}: $${q3Dividend} : ${q3Div} = ${q3Quot}$.`,
    options: [
      { label: 'A', text: `$${q3Quot * 10}$`, isCorrect: false },
      { label: 'B', text: `$${q3Quot + 5}$`, isCorrect: false },
      { label: 'C', text: `$${q3Quot}$`, isCorrect: true },
      { label: 'D', text: `$${Math.max(1, Math.floor(q3Quot / 10))}$`, isCorrect: false },
    ],
  });

  // Q4: Тема 4. Деление числа на десятки, сотни и тысячи (Средний уровень)
  const q4Quot = 16 + (k % 15); // 16..30
  const q4Div = (3 + (k % 4)) * 10; // 30, 40, 50, 60
  const q4Dividend = q4Quot * q4Div;
  questions.push({
    questionNumber: 4,
    text: `Выполните деление: $${q4Dividend} : ${q4Div}$`,
    type: 'multiple_choice',
    correctAnswer: `${q4Quot}`,
    explanation: `$${q4Dividend} : ${q4Div} = (${q4Dividend} : 10) : ${q4Div / 10} = ${q4Dividend / 10} : ${q4Div / 10} = ${q4Quot}$.`,
    options: [
      { label: 'A', text: `$${q4Quot}$`, isCorrect: true },
      { label: 'B', text: `$${q4Quot * 10}$`, isCorrect: false },
      { label: 'C', text: `$${q4Quot + 10}$`, isCorrect: false },
      { label: 'D', text: `$${q4Quot - 4}$`, isCorrect: false },
    ],
  });

  // Q5: Тема 5. Деление числа на десятки, сотни и тысячи (Усложнённый уровень: с остатком)
  const q5Div = 30 + (k % 4) * 10; // 30, 40, 50, 60
  const q5Quot = 7 + (k % 6); // 7..12
  const q5Rem = 4 + (k % 8); // 4..11 (< 30)
  const q5Dividend = q5Quot * q5Div + q5Rem;
  questions.push({
    questionNumber: 5,
    text: `Найдите остаток при делении $${q5Dividend}$ на $${q5Div}$.`,
    type: 'multiple_choice',
    correctAnswer: `${q5Rem}`,
    explanation: `$${q5Dividend} = ${q5Quot} \\cdot ${q5Div} + ${q5Rem}$. Значит, остаток равен $${q5Rem}$.`,
    options: [
      { label: 'A', text: `$${q5Rem - 2}$`, isCorrect: false },
      { label: 'B', text: `$${q5Rem + 2}$`, isCorrect: false },
      { label: 'C', text: `$${q5Rem}$`, isCorrect: true },
      { label: 'D', text: `$${q5Rem + 5}$`, isCorrect: false },
    ],
  });

  // Q6: Тема 6. Порядок выполнения действий в выражениях без скобок (Базовый уровень)
  const q6A = 25 + (k % 12) * 2; // 25..47
  const q6B = 4 + (k % 5); // 4..8
  const q6C = 5 + (k % 4); // 5..8
  const q6D = 12 + (k % 6); // 12..17
  const q6Ans = q6A + (q6B * q6C) - q6D;
  const q6Err1 = (q6A + q6B) * q6C - q6D;
  questions.push({
    questionNumber: 6,
    text: `Найдите значение числового выражения: $${q6A} + ${q6B} \\cdot ${q6C} - ${q6D}$`,
    type: 'multiple_choice',
    correctAnswer: `${q6Ans}`,
    explanation: `Первым выполняется умножение: $${q6B} \\cdot ${q6C} = ${q6B * q6C}$. Затем сложение и вычитание слева направо: $${q6A} + ${q6B * q6C} = ${q6A + q6B * q6C}$, и $${q6A + q6B * q6C} - ${q6D} = ${q6Ans}$.`,
    options: [
      { label: 'A', text: `$${q6Ans}$`, isCorrect: true },
      { label: 'B', text: `$${q6Err1}$`, isCorrect: false },
      { label: 'C', text: `$${q6Ans + 10}$`, isCorrect: false },
      { label: 'D', text: `$${q6Ans - 8}$`, isCorrect: false },
    ],
  });

  // Q7: Тема 7. Порядок выполнения действий в выражениях со скобками (Базовый уровень)
  const q7A = 40 + (k % 8) * 2; // 40..54
  const q7B = 15 + (k % 6); // 15..20
  const q7C = 3 + (k % 3); // 3, 4, 5
  const q7D = 18 + (k % 5); // 18..22
  const q7Ans = (q7A - q7B) * q7C + q7D;
  const q7Err1 = q7A - (q7B * q7C) + q7D;
  questions.push({
    questionNumber: 7,
    text: `Вычислите: $$(${q7A} - ${q7B}) \\cdot ${q7C} + ${q7D}$$`,
    type: 'multiple_choice',
    correctAnswer: `${q7Ans}`,
    explanation: `1) Действие в скобках: $${q7A} - ${q7B} = ${q7A - q7B}$. 2) Умножение: $${q7A - q7B} \\cdot ${q7C} = ${(q7A - q7B) * q7C}$. 3) Сложение: ${(q7A - q7B) * q7C} + ${q7D} = ${q7Ans}$.`,
    options: [
      { label: 'A', text: `$${q7Ans + 15}$`, isCorrect: false },
      { label: 'B', text: `$${q7Ans}$`, isCorrect: true },
      { label: 'C', text: `$${q7Err1}$`, isCorrect: false },
      { label: 'D', text: `$${q7Ans - 12}$`, isCorrect: false },
    ],
  });

  // Q8: Тема 8. Текстовые задачи (Базовый уровень: движение)
  const q8Speed = 12 + (k % 6); // 12..17 км/ч
  const q8Time = 3 + (k % 3); // 3, 4, 5 ч
  const q8Dist = q8Speed * q8Time;
  questions.push({
    questionNumber: 8,
    text: `Велосипедист ехал со скоростью $${q8Speed}$ км/ч в течение $${q8Time}$ ч. Какое расстояние он проехал?`,
    type: 'multiple_choice',
    correctAnswer: `${q8Dist} км`,
    explanation: `Расстояние равно произведению скорости на время: $S = v \\cdot t = ${q8Speed} \\cdot ${q8Time} = ${q8Dist}$ км.`,
    options: [
      { label: 'A', text: `$${q8Speed + q8Time}\\text{ км}$`, isCorrect: false },
      { label: 'B', text: `$${q8Dist + 10}\\text{ км}$`, isCorrect: false },
      { label: 'C', text: `$${q8Dist}\\text{ км}$`, isCorrect: true },
      { label: 'D', text: `$${q8Dist - 6}\\text{ км}$`, isCorrect: false },
    ],
  });

  // Q9: Тема 9. Представление деления чисел в виде дроби (Базовый уровень)
  const q9M = 5 + (k % 8); // 5..12
  const q9N = q9M + 3 + (k % 5); // q9N > q9M
  questions.push({
    questionNumber: 9,
    text: `Запишите частное $${q9M} : ${q9N}$ в виде обыкновенной дроби.`,
    type: 'multiple_choice',
    correctAnswer: `\\frac{${q9M}}{${q9N}}`,
    explanation: `Знак деления соответствует дробной черте: делимое становится числителем, делитель — знаменателем: $${q9M} : ${q9N} = \\frac{${q9M}}{${q9N}}$.`,
    options: [
      { label: 'A', text: `$\\frac{${q9M}}{${q9N}}$`, isCorrect: true },
      { label: 'B', text: `$\\frac{${q9N}}{${q9M}}$`, isCorrect: false },
      { label: 'C', text: `$\\frac{${q9M}}{${q9M + q9N}}$`, isCorrect: false },
      { label: 'D', text: `$\\frac{1}{${q9N}}$`, isCorrect: false },
    ],
  });

  // Q10: Тема 10. Преобразование обыкновенных дробей в десятичные (Базовый уровень)
  const fracPairs = [
    { n: 1, d: 2, dec: '0,5', d1: '0,2', d2: '0,05', d3: '1,2' },
    { n: 1, d: 4, dec: '0,25', d1: '0,4', d2: '0,2', d3: '0,14' },
    { n: 3, d: 4, dec: '0,75', d1: '0,34', d2: '0,7', d3: '0,85' },
    { n: 1, d: 5, dec: '0,2', d1: '0,5', d2: '0,15', d3: '0,02' },
    { n: 2, d: 5, dec: '0,4', d1: '0,25', d2: '0,2', d3: '0,04' },
    { n: 3, d: 5, dec: '0,6', d1: '0,35', d2: '0,5', d3: '0,3' },
    { n: 4, d: 5, dec: '0,8', d1: '0,45', d2: '0,4', d3: '0,08' },
  ];
  const q10Pair = fracPairs[k % fracPairs.length];
  questions.push({
    questionNumber: 10,
    text: `Представьте обыкновенную дробь $\\frac{${q10Pair.n}}{${q10Pair.d}}$ в виде десятичной дроби:`,
    type: 'multiple_choice',
    correctAnswer: q10Pair.dec,
    explanation: `$\\frac{${q10Pair.n}}{${q10Pair.d}} = ${q10Pair.n} : ${q10Pair.d} = ${q10Pair.dec}$.`,
    options: [
      { label: 'A', text: `$${q10Pair.d1}$`, isCorrect: false },
      { label: 'B', text: `$${q10Pair.dec}$`, isCorrect: true },
      { label: 'C', text: `$${q10Pair.d2}$`, isCorrect: false },
      { label: 'D', text: `$${q10Pair.d3}$`, isCorrect: false },
    ],
  });

  // Q11: Тема 11. Умножение числа на 10, 100 и 1000 (Усложнённый уровень: десятичные дроби)
  const q11Int = 2 + (k % 6); // 2..7
  const q11Dec = 3 + (k % 7); // 3..9
  const q11Mult = 100;
  const q11Ans = (q11Int * 10 + q11Dec) * (q11Mult / 10);
  questions.push({
    questionNumber: 11,
    text: `Вычислите: $$${q11Int}{,}${q11Dec} \\cdot ${q11Mult}$$`,
    type: 'multiple_choice',
    correctAnswer: `${q11Ans}`,
    explanation: `При умножении десятичной дроби на $100$ переносим запятую вправо на 2 знака: $${q11Int}{,}${q11Dec} \\cdot 100 = ${q11Ans}$.`,
    options: [
      { label: 'A', text: `$${q11Ans / 10}$`, isCorrect: false },
      { label: 'B', text: `$${q11Ans * 10}$`, isCorrect: false },
      { label: 'C', text: `$${q11Ans}$`, isCorrect: true },
      { label: 'D', text: `$${q11Int * 100 + q11Dec}$`, isCorrect: false },
    ],
  });

  // Q12: Тема 12. Порядок действий в выражениях без скобок (Усложнённый: 4 действия)
  const q12A = 14 + (k % 6); // 14..19
  const q12B = 3 + (k % 3); // 3, 4, 5
  const q12D = 2 + (k % 3); // 2, 3, 4
  const q12C = (10 + (k % 6)) * q12D; // cleanly divisible by D
  const q12E = 8 + (k % 5); // 8..12
  const q12Ans = (q12A * q12B) + (q12C / q12D) - q12E;
  questions.push({
    questionNumber: 12,
    text: `Определите значение выражения: $$${q12A} \\cdot ${q12B} + ${q12C} : ${q12D} - ${q12E}$$`,
    type: 'multiple_choice',
    correctAnswer: `${q12Ans}`,
    explanation: `1) $${q12A} \\cdot ${q12B} = ${q12A * q12B}$. 2) $${q12C} : ${q12D} = ${q12C / q12D}$. 3) $${q12A * q12B} + ${q12C / q12D} = ${q12A * q12B + q12C / q12D}$. 4) $${q12A * q12B + q12C / q12D} - ${q12E} = ${q12Ans}$.`,
    options: [
      { label: 'A', text: `$${q12Ans}$`, isCorrect: true },
      { label: 'B', text: `$${q12Ans + 12}$`, isCorrect: false },
      { label: 'C', text: `$${q12Ans - 10}$`, isCorrect: false },
      { label: 'D', text: `$${q12Ans + 20}$`, isCorrect: false },
    ],
  });

  // Q13: Тема 13. Порядок действий в выражениях со скобками (Усложнённый: две скобки)
  const q13A = 18 + (k % 8); // 18..25
  const q13B = 6 + (k % 5);  // 6..10
  const q13C = 15 + (k % 6); // 15..20
  const q13D = 7 + (k % 4);  // 7..10
  const q13Ans = (q13A + q13B) * (q13C - q13D);
  questions.push({
    questionNumber: 13,
    text: `Вычислите: $$(${q13A} + ${q13B}) \\cdot (${q13C} - ${q13D})$$`,
    type: 'multiple_choice',
    correctAnswer: `${q13Ans}`,
    explanation: `1) Первая скобка: $${q13A} + ${q13B} = ${q13A + q13B}$. 2) Вторая скобка: $${q13C} - ${q13D} = ${q13C - q13D}$. 3) Произведение: $${q13A + q13B} \\cdot ${q13C - q13D} = ${q13Ans}$.`,
    options: [
      { label: 'A', text: `$${q13Ans - 20}$`, isCorrect: false },
      { label: 'B', text: `$${q13Ans + 24}$`, isCorrect: false },
      { label: 'C', text: `$${q13Ans}$`, isCorrect: true },
      { label: 'D', text: `$${(q13A + q13B) + (q13C - q13D)}$`, isCorrect: false },
    ],
  });

  // Q14: Тема 14. Текстовые задачи (Усложнённый: встречное движение)
  const q14V1 = 50 + (k % 5) * 5; // 50, 55, 60, 65, 70
  const q14V2 = 60 + (k % 4) * 5; // 60, 65, 70, 75
  const q14T = 2 + (k % 2); // 2, 3 ч
  const q14S = (q14V1 + q14V2) * q14T;
  questions.push({
    questionNumber: 14,
    text: `Из двух посёлков навстречу друг другу одновременно выехали два мотоциклиста со скоростями $${q14V1}$ км/ч и $${q14V2}$ км/ч. Через $${q14T}$ ч они встретились. Найдите расстояние между посёлками.`,
    type: 'multiple_choice',
    correctAnswer: `${q14S} км`,
    explanation: `Скорость сближения: $${q14V1} + ${q14V2} = ${q14V1 + q14V2}$ км/ч. Расстояние: $S = (v_1 + v_2) \\cdot t = ${q14V1 + q14V2} \\cdot ${q14T} = ${q14S}$ км.`,
    options: [
      { label: 'A', text: `$${q14S}\\text{ км}$`, isCorrect: true },
      { label: 'B', text: `$${q14V1 + q14V2}\\text{ км}$`, isCorrect: false },
      { label: 'C', text: `$${q14S + 30}\\text{ км}$`, isCorrect: false },
      { label: 'D', text: `$${q14S - 25}\\text{ км}$`, isCorrect: false },
    ],
  });

  // Q15: Тема 15. Контрольная работа 1 / Арифметика многозначных чисел (Умножение столбиком)
  const q15A = 124 + (k % 12) * 5; // 124..179
  const q15B = 14 + (k % 6) * 3;  // 14..29
  const q15Ans = q15A * q15B;
  questions.push({
    questionNumber: 15,
    text: `Вычислите столбиком: $${q15A} \\cdot ${q15B}$`,
    type: 'multiple_choice',
    correctAnswer: `${q15Ans}`,
    explanation: `$${q15A} \\cdot ${q15B} = ${q15Ans}$.`,
    options: [
      { label: 'A', text: `$${q15Ans + 100}$`, isCorrect: false },
      { label: 'B', text: `$${q15Ans}$`, isCorrect: true },
      { label: 'C', text: `$${q15Ans - 10}$`, isCorrect: false },
      { label: 'D', text: `$${q15Ans + 200}$`, isCorrect: false },
    ],
  });

  // Q16: Арифметика многозначных чисел (Деление многозначного числа на двузначное)
  const q16Div = 18 + (k % 8) * 2; // 18, 20, 22, 24, 26, 28, 30, 32
  const q16Quot = 25 + (k % 10) * 3; // 25..52
  const q16Dividend = q16Div * q16Quot;
  questions.push({
    questionNumber: 16,
    text: `Выполните деление многозначного числа: $${q16Dividend} : ${q16Div}$`,
    type: 'multiple_choice',
    correctAnswer: `${q16Quot}`,
    explanation: `$${q16Dividend} : ${q16Div} = ${q16Quot}$. Проверка: $${q16Quot} \\cdot ${q16Div} = ${q16Dividend}$.`,
    options: [
      { label: 'A', text: `$${q16Quot * 10}$`, isCorrect: false },
      { label: 'B', text: `$${q16Quot + 8}$`, isCorrect: false },
      { label: 'C', text: `$${q16Quot}$`, isCorrect: true },
      { label: 'D', text: `$${q16Quot - 5}$`, isCorrect: false },
    ],
  });

  // Q17: Тема 17. Представление деления чисел в виде дроби (Смешанные числа)
  const q17Den = 4 + (k % 4); // 4, 5, 6, 7
  const q17Whole = 3 + (k % 5); // 3..7
  const q17Rem = 1 + (k % (q17Den - 1)); // 1..den-1
  const q17Num = q17Whole * q17Den + q17Rem;
  questions.push({
    questionNumber: 17,
    text: `Запишите неправильную дробь $\\frac{${q17Num}}{${q17Den}}$ в виде смешанного числа:`,
    type: 'multiple_choice',
    correctAnswer: `${q17Whole}\\frac{${q17Rem}}{${q17Den}}`,
    explanation: `$${q17Num} : ${q17Den} = ${q17Whole}$ (остаток $${q17Rem}$). Значит, $\\frac{${q17Num}}{${q17Den}} = ${q17Whole}\\frac{${q17Rem}}{${q17Den}}$.`,
    options: [
      { label: 'A', text: `$${q17Whole}\\frac{${q17Rem}}{${q17Den}}$`, isCorrect: true },
      { label: 'B', text: `$${q17Whole + 1}\\frac{${q17Rem}}{${q17Den}}$`, isCorrect: false },
      { label: 'C', text: `$${q17Whole}\\frac{${q17Rem + 1}}{${q17Den}}$`, isCorrect: false },
      { label: 'D', text: `$\\frac{${q17Whole}}{${q17Den}}$`, isCorrect: false },
    ],
  });

  // Q18: Преобразование обыкновенных дробей в десятичные (Знаменатели 20, 25, 50)
  const q18Choices = [
    { n: 7, d: 20, dec: '0,35', alt1: '0,7', alt2: '0,25', alt3: '0,14' },
    { n: 9, d: 20, dec: '0,45', alt1: '0,9', alt2: '0,4', alt3: '0,25' },
    { n: 11, d: 25, dec: '0,44', alt1: '0,11', alt2: '0,45', alt3: '0,55' },
    { n: 13, d: 50, dec: '0,26', alt1: '0,13', alt2: '0,36', alt3: '0,5' },
    { n: 17, d: 50, dec: '0,34', alt1: '0,17', alt2: '0,24', alt3: '0,4' },
    { n: 19, d: 25, dec: '0,76', alt1: '0,19', alt2: '0,75', alt3: '0,66' },
  ];
  const q18Item = q18Choices[k % q18Choices.length];
  questions.push({
    questionNumber: 18,
    text: `Переведите обыкновенную дробь $\\frac{${q18Item.n}}{${q18Item.d}}$ в десятичную:`,
    type: 'multiple_choice',
    correctAnswer: q18Item.dec,
    explanation: `Приведём к знаменателю 100: $\\frac{${q18Item.n}}{${q18Item.d}} = \\frac{${q18Item.n * (100 / q18Item.d)}}{100} = ${q18Item.dec}$.`,
    options: [
      { label: 'A', text: `$${q18Item.alt1}$`, isCorrect: false },
      { label: 'B', text: `$${q18Item.alt2}$`, isCorrect: false },
      { label: 'C', text: `$${q18Item.dec}$`, isCorrect: true },
      { label: 'D', text: `$${q18Item.alt3}$`, isCorrect: false },
    ],
  });

  // Q19: Тема 19. Повторение: сложение и вычитание дробей (Базовый уровень)
  const q19Den = 11 + (k % 4); // 11..14
  const q19A = 2 + (k % 3); // 2, 3, 4
  const q19B = 3 + (k % 4); // 3..6 (A + B < Den)
  const q19Sum = q19A + q19B;
  questions.push({
    questionNumber: 19,
    text: `Вычислите сумму дробей: $$\\frac{${q19A}}{${q19Den}} + \\frac{${q19B}}{${q19Den}}$$`,
    type: 'multiple_choice',
    correctAnswer: `\\frac{${q19Sum}}{${q19Den}}`,
    explanation: `При одинаковых знаменателях складываются только числители: $\\frac{${q19A}}{${q19Den}} + \\frac{${q19B}}{${q19Den}} = \\frac{${q19A} + ${q19B}}{${q19Den}} = \\frac{${q19Sum}}{${q19Den}}$.`,
    options: [
      { label: 'A', text: `$\\frac{${q19Sum}}{${q19Den}}$`, isCorrect: true },
      { label: 'B', text: `$\\frac{${q19Sum}}{${q19Den * 2}}$`, isCorrect: false },
      { label: 'C', text: `$\\frac{${q19A * q19B}}{${q19Den}}$`, isCorrect: false },
      { label: 'D', text: `$\\frac{${q19Sum - 1}}{${q19Den}}$`, isCorrect: false },
    ],
  });

  // Q20: Тема 20. Повторение: части множества (Нахождение дроби от числа)
  const q20Q = 5 + (k % 3) * 2; // 5, 7, 9
  const q20P = 2 + (k % 2); // 2, 3 (< Q)
  const q20Step = 6 + (k % 5) * 2; // 6, 8, 10, 12, 14
  const q20Total = q20Q * q20Step;
  const q20Ans = q20P * q20Step;
  questions.push({
    questionNumber: 20,
    text: `В книге $${q20Total}$ страниц. Ученик прочитал $\\frac{${q20P}}{${q20Q}}$ всей книги. Сколько страниц прочитал ученик?`,
    type: 'multiple_choice',
    correctAnswer: `${q20Ans}`,
    explanation: `Чтобы найти дробь от числа, нужно число разделить на знаменатель и умножить на числитель: $${q20Total} : ${q20Q} \\cdot ${q20P} = ${q20Step} \\cdot ${q20P} = ${q20Ans}$ стр.`,
    options: [
      { label: 'A', text: `$${q20Ans - 4}$`, isCorrect: false },
      { label: 'B', text: `$${q20Ans}$`, isCorrect: true },
      { label: 'C', text: `$${q20Ans + 4}$`, isCorrect: false },
      { label: 'D', text: `$${q20Ans + 8}$`, isCorrect: false },
    ],
  });

  // ==========================================
  // ВОПРОСЫ 21 - 30 (Самостоятельный открытый ввод)
  // ==========================================

  // Q21: Умножение и деление числа на 10, 100 и 1000 (Уравнение, открытый ввод)
  const q21A = 18 + (k % 25) * 2; // 18..66
  const q21Mult = 100;
  const q21Ans = q21A * q21Mult;
  questions.push({
    questionNumber: 21,
    text: `Решите уравнение и запишите ответ в виде целого числа: $$x : ${q21Mult} = ${q21A}$$`,
    type: 'short_answer',
    correctAnswer: `${q21Ans}`,
    explanation: `Неизвестное делимое равно произведению делителя на частное: $x = ${q21A} \\cdot ${q21Mult} = ${q21Ans}$.`,
  });

  // Q22: Умножение и деление на десятки, сотни и тысячи (Комбинированное вычисление)
  const q22X = 14 + (k % 12); // 14..25
  const q22M = 300;
  const q22D = 30;
  const q22Ans = (q22X * q22M) / q22D; // q22X * 10
  questions.push({
    questionNumber: 22,
    text: `Вычислите значение выражения и запишите результат: $$(${q22X} \\cdot ${q22M}) : ${q22D}$$`,
    type: 'short_answer',
    correctAnswer: `${q22Ans}`,
    explanation: `$(${q22X} \\cdot 300) : 30 = ${q22X * 300} : 30 = ${q22Ans}$.`,
  });

  // Q23: Порядок действий в выражениях без скобок (Продвинутый уровень)
  const q23A = 22 + (k % 8); // 22..29
  const q23B = 14 + (k % 5); // 14..18
  const q23C = 16 + (k % 6); // 16..21
  const q23D = 8 + (k % 4);  // 8..11
  const q23Ans = (q23A * q23B) - (q23C * q23D);
  questions.push({
    questionNumber: 23,
    text: `Вычислите значение числового выражения: $$${q23A} \\cdot ${q23B} - ${q23C} \\cdot ${q23D}$$`,
    type: 'short_answer',
    correctAnswer: `${q23Ans}`,
    explanation: `1) $${q23A} \\cdot ${q23B} = ${q23A * q23B}$. 2) $${q23C} \\cdot ${q23D} = ${q23C * q23D}$. 3) $${q23A * q23B} - ${q23C * q23D} = ${q23Ans}$.`,
  });

  // Q24: Порядок действий со скобками (Продвинутый уровень)
  const q24C = 3 + (k % 3); // 3, 4, 5
  const q24Q = 7 + (k % 6); // 7..12
  const q24B = q24Q * q24C; // divisible by C
  const q24A = q24Q + 15 + (k % 5); // A - Q > 0
  const q24D = 5 + (k % 4); // 5..8
  const q24Ans = (q24A - q24Q) * q24D;
  questions.push({
    questionNumber: 24,
    text: `Найдите значение выражения со скобками: $$(${q24A} - ${q24B} : ${q24C}) \\cdot ${q24D}$$`,
    type: 'short_answer',
    correctAnswer: `${q24Ans}`,
    explanation: `1) В скобках деление: $${q24B} : ${q24C} = ${q24Q}$. 2) Вычитание: $${q24A} - ${q24Q} = ${q24A - q24Q}$. 3) Умножение: $${q24A - q24Q} \\cdot ${q24D} = ${q24Ans}$.`,
  });

  // Q25: Представление деления чисел в виде дроби (Запись дроби)
  const q25P = 7 + (k % 7) * 2; // 7, 9, 11, 13, 15, 17, 19
  const q25Q = 13 + (k % 5) * 2; // 13, 15, 17, 19, 21
  questions.push({
    questionNumber: 25,
    text: `Запишите результат деления $${q25P} : ${q25Q}$ в виде обыкновенной дроби через слэш (например, $3/7$):`,
    type: 'short_answer',
    correctAnswer: `${q25P}/${q25Q}`,
    metadata: { acceptedAlternates: [`${q25P}/${q25Q}`] },
    explanation: `Частное $a : b$ записывается в виде обыкновенной дроби $\\frac{a}{b}$, то есть $${q25P}/${q25Q}$.`,
  });

  // Q26: Преобразование обыкновенных дробей в десятичные (Открытый ввод)
  const q26Den = 20;
  const q26Num = 3 + (k % 8) * 2; // 3, 5, 7, 9, 11, 13, 15, 17
  const q26ValDot = (q26Num / q26Den).toFixed(2);
  const q26ValComma = q26ValDot.replace('.', ',');
  questions.push({
    questionNumber: 26,
    text: `Запишите обыкновенную дробь $\\frac{${q26Num}}{${q26Den}}$ в виде десятичной дроби (например, $0{,}5$):`,
    type: 'short_answer',
    correctAnswer: q26ValDot,
    metadata: { acceptedAlternates: [q26ValComma, q26ValDot] },
    explanation: `Домножим числитель и знаменатель на 5: $\\frac{${q26Num} \\cdot 5}{20 \\cdot 5} = \\frac{${q26Num * 5}}{100} = ${q26ValComma}$.`,
  });

  // Q27: Сложение и вычитание дробей (Смешанные числа / дробный ввод)
  const q27Den = 17;
  const q27A = 3 + (k % 5); // 3..7
  const q27B = 4 + (k % 5); // 4..8 (A + B <= 15 < 17)
  const q27Sum = q27A + q27B;
  questions.push({
    questionNumber: 27,
    text: `Вычислите сумму дробей и запишите ответ в виде дроби (например, $5/17$): $$\\frac{${q27A}}{${q27Den}} + \\frac{${q27B}}{${q27Den}}$$`,
    type: 'short_answer',
    correctAnswer: `${q27Sum}/${q27Den}`,
    metadata: { acceptedAlternates: [`${q27Sum}/${q27Den}`] },
    explanation: `$\\frac{${q27A}}{${q27Den}} + \\frac{${q27B}}{${q27Den}} = \\frac{${q27Sum}}{${q27Den}}$.`,
  });

  // Q28: Повторение: части множества (Нахождение числа по его дроби)
  const q28N = 7 + (k % 3) * 2; // 7, 9, 11
  const q28M = 2 + (k % 2); // 2, 3
  const q28Unit = 9 + (k % 6) * 3; // 9, 12, 15, 18, 21, 24
  const q28Part = q28M * q28Unit;
  const q28Full = q28N * q28Unit;
  questions.push({
    questionNumber: 28,
    text: `Найдите число, если $\\frac{${q28M}}{${q28N}}$ этого числа равны $${q28Part}$.`,
    type: 'short_answer',
    correctAnswer: `${q28Full}`,
    explanation: `Чтобы найти число по его дроби, нужно значение дроби разделить на числитель и умножить на знаменатель: $${q28Part} : ${q28M} \\cdot ${q28N} = ${q28Unit} \\cdot ${q28N} = ${q28Full}$.`,
  });

  // Q29: Текстовые задачи (Высокий уровень сложности: совместная работа)
  const q29M = 16 + (k % 5) * 2; // 16, 18, 20, 22, 24
  const q29U = 9 + (k % 4) * 2;  // 9, 11, 13, 15
  const q29T = 4 + (k % 3);      // 4, 5, 6 ч
  const q29Total = (q29M + q29U) * q29T;
  questions.push({
    questionNumber: 29,
    text: `Мастер изготавливает $${q29M}$ деталей в час, а ученик — $${q29U}$ деталей в час. Сколько всего деталей они изготовят вместе за $${q29T}$ ч совместной работы? (Запишите только число)`,
    type: 'short_answer',
    correctAnswer: `${q29Total}`,
    explanation: `1) Общая производительность: $${q29M} + ${q29U} = ${q29M + q29U}$ дет./ч. 2) За $${q29T}$ ч: $${q29M + q29U} \\cdot ${q29T} = ${q29Total}$ дет.`,
  });

  // Q30: Контрольная работа 1 / Олимпиадный уровень (Задача на части / уравнивание)
  const q30Part2 = 14 + (k % 10) * 2; // 14, 16, 18, 20, 22, 24, 26, 28, 30, 32
  const q30Multiplier = 3;
  const q30Part1 = q30Part2 * q30Multiplier;
  const q30Sum = q30Part1 + q30Part2; // 4 * q30Part2
  questions.push({
    questionNumber: 30,
    text: `В двух ящиках всего $${q30Sum}$ кг яблок, причём в первом ящике в 3 раза больше яблок, чем во втором. Сколько килограммов яблок в первом ящике? (Запишите только число)`,
    type: 'short_answer',
    correctAnswer: `${q30Part1}`,
    explanation: `Второй ящик — 1 часть, первый — 3 части. Всего $1 + 3 = 4$ части. Масса одной части (во втором ящике): $${q30Sum} : 4 = ${q30Part2}$ кг. В первом ящике: $${q30Part2} \\cdot 3 = ${q30Part1}$ кг.`,
  });

  return questions;
}

/**
 * Seeds the database with all 50 unique forms and their 30 questions (1500 total).
 * @param force If true, drops and re-seeds existing forms and questions.
 */
export async function seedDatabase(force: boolean = false): Promise<void> {
  console.log('🌱 Starting database seed (50 forms × 30 questions = 1500 assignments)...');
  await runMigrations();

  await withTransaction(async (db) => {
    // Check if forms already seeded
    if (!force) {
      const existingForms = await db.query('SELECT COUNT(*) as count FROM forms');
      const count = parseInt(existingForms.rows[0]?.count || '0', 10);
      if (count >= 50) {
        const sampleQ = await db.query('SELECT text FROM questions WHERE code = $1', ['FORM_1_Q1']);
        if (sampleQ.rows[0]?.text?.includes('Вычислите:')) {
          console.log(`ℹ️ Database already contains 50 5th-grade forms. Skipping seed.`);
          return;
        }
      }
    }

    console.log('📝 Seeding 50 unique Grade 5 cards, questions, and options...');

    for (let formId = 1; formId <= 50; formId++) {
      // 1. Insert form
      await db.query(
        `INSERT INTO forms (form_id, title) VALUES ($1, $2) ON CONFLICT (form_id) DO NOTHING`,
        [formId, `Бланк №${formId} (5 класс)`]
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

  console.log('✅ Successfully seeded 50 unique Grade 5 cards with 30 questions each (total 1500 assignments).');
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
