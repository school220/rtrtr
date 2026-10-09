import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFormQuestions } from '../src/db/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../../');

interface FormExport {
  formId: number;
  title: string;
  totalQuestions: number;
  questions: {
    number: number;
    type: 'multiple_choice' | 'short_answer';
    text: string;
    correctAnswer: string;
    explanation: string;
    options?: { label: string; text: string; isCorrect: boolean }[];
  }[];
}

console.log('Generating all 50 variants with 1000 questions and correct answers...');

const allForms: FormExport[] = [];

for (let formId = 1; formId <= 50; formId++) {
  const qList = generateFormQuestions(formId);
  allForms.push({
    formId,
    title: `Вариант №${formId} (4 класс / Дроби и десятичные числа)`,
    totalQuestions: qList.length,
    questions: qList.map((q) => ({
      number: q.questionNumber,
      type: q.type,
      text: q.text,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      options: q.options,
    })),
  });
}

// 1. Save JSON file
const jsonPath = path.join(rootDir, 'ALL_50_VARIANTS_WITH_ANSWERS.json');
fs.writeFileSync(jsonPath, JSON.stringify(allForms, null, 2), 'utf-8');
console.log(`✅ JSON saved: ${jsonPath}`);

// 2. Save Markdown file
let md = `# Полный реестр всех 50 вариантов с правильными ответами\n`;
md += `**Учебная программа:** 4 класс (Обыкновенные и десятичные дроби, смешанные числа, уравнения, задачи)\n`;
md += `**Количество вариантов:** 50 вариантов\n`;
md += `**Вопросов в каждом варианте:** 20 (№ 1–15: с выбором ответа из 4 вариантов; № 16–20: с открытым вводом)\n`;
md += `**Всего вопросов:** 1 000 вопросов\n`;
md += `**Математические гарантии:** 100% несократимые дроби, 0 отрицательных чисел, строго положительные результаты.\n\n`;
md += `---\n\n`;

for (const f of allForms) {
  md += `## Вариант №${f.formId}\n\n`;
  for (const q of f.questions) {
    md += `### Вопрос №${q.number} (${q.type === 'multiple_choice' ? 'Тестовый с 4 вариантами' : 'Открытый числовой ввод'})\n`;
    md += `**Условие:** ${q.text}\n\n`;

    if (q.type === 'multiple_choice' && q.options) {
      md += `**Варианты ответов:**\n`;
      for (const opt of q.options) {
        if (opt.isCorrect) {
          md += `- **[X] ${opt.label}) ${opt.text}** *(ПРАВИЛЬНЫЙ ОТВЕТ)*\n`;
        } else {
          md += `- [ ] ${opt.label}) ${opt.text}\n`;
        }
      }
      md += `\n**Правильный ответ:** \`${q.correctAnswer}\`\n`;
    } else {
      md += `**Правильный ответ:** \`${q.correctAnswer}\`\n`;
    }

    if (q.explanation) {
      md += `**Решение / Пояснение:** ${q.explanation}\n`;
    }
    md += `\n---\n\n`;
  }
}

const mdPath = path.join(rootDir, 'ALL_50_VARIANTS_WITH_ANSWERS.md');
fs.writeFileSync(mdPath, md, 'utf-8');
console.log(`✅ Markdown saved: ${mdPath}`);

// 3. Save Quick Key Sheet (Таблица ключей для быстрой проверки)
let keysMd = `# Сводная таблица ключей (Ответы ко всем 50 вариантам)\n\n`;
keysMd += `| Вариант | В1 | В2 | В3 | В4 | В5 | В6 | В7 | В8 | В9 | В10 | В11 | В12 | В13 | В14 | В15 | В16 | В17 | В18 | В19 | В20 |\n`;
keysMd += `|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;

for (const f of allForms) {
  const row = [f.formId.toString()];
  for (let i = 1; i <= 20; i++) {
    const q = f.questions.find((item) => item.number === i);
    row.push(q ? q.correctAnswer : '-');
  }
  keysMd += `| ${row.join(' | ')} |\n`;
}

const keysPath = path.join(rootDir, 'ANSWERS_KEY_TABLE.md');
fs.writeFileSync(keysPath, keysMd, 'utf-8');
console.log(`✅ Key table saved: ${keysPath}`);

console.log('Finished exporting all 50 variants successfully!');
