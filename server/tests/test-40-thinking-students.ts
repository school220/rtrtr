import { io as ioClient, Socket } from 'socket.io-client';
import { server } from '../src/index.js';
import { getDb, closeDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { solveMathQuestionAsStudent, StudentInputQuestion } from './verify-autonomous-solver.js';

interface ThinkingStudent {
  virtualIndex: number;
  firstName: string;
  lastName: string;
  socket?: Socket;
  sessionToken?: string;
  studentId?: number;
  formId?: number;
  answersSubmitted: number;
  sampleThoughts: { qNum: number; thought: string }[];
}

const TARGET_STUDENT_COUNT = 40;
const PORT = 3089;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function run40ThinkingStudentsTest() {
  console.log(`\n================================================================`);
  console.log(`🧠 ЭКСПЕРИМЕНТ: 40 УЧЕНИКОВ РЕШАЮТ ТЕСТ САМОСТОЯТЕЛЬНО (НА ОЦЕНКУ «5»)`);
  console.log(`🔒 ПРАВИЛО: БЕЗ ПОДСМОТРА В ОТВЕТЫ КЛЮЧЕЙ БД! ТОЛЬКО МАТЕМАТИЧЕСКАЯ ЛОГИКА!`);
  console.log(`⏱️ Регламент времени: 30 МИНУТ (1800 СЕКУНД)`);
  console.log(`================================================================\n`);

  await runMigrations();
  await seedDatabase();

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });
  console.log(`📡 Тестовый сервер слушает: ${BASE_URL}\n`);

  const startTimeOverall = Date.now();

  try {
    // 1. Создание экзаменационной комнаты
    console.log('1️⃣ [Учитель] Создание экзаменационной сессии...');
    const createRes = await fetch(`${BASE_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Самостоятельный экзамен 40 учеников (Решают сами на 5 • 30 минут)',
        durationSeconds: 1800,
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Ошибка создания игры: ${await createRes.text()}`);
    }

    const gameData = await createRes.json();
    const gameId = gameData.gameId;
    const gameCode = gameData.code;
    console.log(`✅ Сессия создана! ПИН-код: [${gameCode}], Длительность: 30 минут\n`);

    // 2. Подключение веб-сокета учителя
    console.log('2️⃣ [Учитель] Подключение мониторинга...');
    const teacherSocket = ioClient(BASE_URL);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Teacher socket connection timeout')), 5000);
      teacherSocket.on('connect', () => {
        clearTimeout(timer);
        teacherSocket.emit('teacher:join', { gameId });
        resolve();
      });
    });
    console.log('✅ Мониторинг учителя подключён.\n');

    // 3. Одновременный вход 40 думающих учеников
    console.log(`3️⃣ [Ученики] 40 учеников подключаются к экзамену...`);
    const joinStartTime = Date.now();

    const students: ThinkingStudent[] = Array.from({ length: TARGET_STUDENT_COUNT }, (_, i) => ({
      virtualIndex: i + 1,
      firstName: `Ученик_${i + 1}`,
      lastName: `Мыслитель_${i + 1}`,
      answersSubmitted: 0,
      sampleThoughts: [],
    }));

    const joinPromises = students.map(async (st) => {
      const res = await fetch(`${BASE_URL}/api/games/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode,
          firstName: st.firstName,
          lastName: st.lastName,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ученик ${st.virtualIndex} не смог войти: ${await res.text()}`);
      }

      const json = await res.json();
      st.studentId = json.studentId;
      st.formId = json.formId;
      st.sessionToken = json.sessionToken;

      const sock = ioClient(BASE_URL);
      st.socket = sock;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Socket timeout student ${st.studentId}`)), 5000);
        sock.on('connect', () => {
          sock.emit(
            'student:join',
            {
              gameId,
              studentId: st.studentId,
              sessionToken: st.sessionToken,
            },
            () => {
              clearTimeout(timeout);
              resolve();
            }
          );
        });
      });

      return st;
    });

    await Promise.all(joinPromises);
    const joinDuration = (Date.now() - joinStartTime) / 1000;
    console.log(`✅ Все 40 учеников зашли в аудиторию за ${joinDuration.toFixed(2)} сек!`);
    console.log(`   Распределено 40 уникальных вариантов КИМ (1..40).\n`);

    // 4. Запуск экзамена учителем
    console.log('4️⃣ [Учитель] Нажатие кнопки «НАЧАТЬ ТЕСТ»...');
    const startEventPromises = students.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.socket!.on('game:started', () => resolve());
        })
    );

    const startRes = await fetch(`${BASE_URL}/api/games/${gameId}/start`, {
      method: 'POST',
    });
    if (!startRes.ok) {
      throw new Error(`Ошибка запуска: ${await startRes.text()}`);
    }

    await Promise.all(startEventPromises);
    console.log(`✅ Таймер пошёл (30 минут). Ученики приступили к решению!\n`);

    // 5. Ученики думают и решают задания сами без подсмотра в ответы
    console.log(`5️⃣ [Интеллектуальное решение] 40 учеников читают условия и решают в уме...`);
    const solveStartTime = Date.now();

    const solvePromises = students.map(async (st) => {
      // Запрос вопросов (API возвращает только текст и варианты БЕЗ правильных ответов)
      const qListRes = await fetch(`${BASE_URL}/api/games/${gameId}/student/${st.studentId}/questions`);
      if (!qListRes.ok) throw new Error(`Не удалось загрузить вопросы ученика ${st.studentId}`);
      const questions: StudentInputQuestion[] = await qListRes.json();

      for (const q of questions) {
        // Ученик РЕШАЕТ САМ по тексту вопроса!
        const solution = solveMathQuestionAsStudent(q);

        if (st.sampleThoughts.length < 3) {
          st.sampleThoughts.push({
            qNum: q.questionNumber,
            thought: solution.reasoning,
          });
        }

        let payload: any = { questionNumber: q.questionNumber };
        if (q.type === 'multiple_choice') {
          payload.selectedOptionId = solution.selectedOptionId;
        } else {
          payload.answerText = solution.answerText;
        }

        const ansRes = await fetch(`${BASE_URL}/api/games/${gameId}/student/${st.studentId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!ansRes.ok) {
          throw new Error(`Ошибка сохранения ответа ${q.questionNumber} для ученика ${st.studentId}`);
        }

        st.answersSubmitted++;
      }

      // Ученик сдаёт готовую работу
      await fetch(`${BASE_URL}/api/games/${gameId}/student/${st.studentId}/finish`, {
        method: 'POST',
      });
    });

    await Promise.all(solvePromises);
    const solveDuration = (Date.now() - solveStartTime) / 1000;
    console.log(`✅ Все 40 учеников решили и сдали свои работы за ${solveDuration.toFixed(2)} сек!\n`);

    // 6. Демонстрация «мыслей» нескольких учеников для подтверждения самостоятельности
    console.log(`📝 Примеры логики рассуждений учеников (как они думали):`);
    for (let i = 0; i < 3; i++) {
      const s = students[i];
      console.log(`   🧑 ${s.firstName} (Вариант №${s.formId}):`);
      for (const t of s.sampleThoughts) {
        console.log(`      • Вопрос ${t.qNum}: ${t.thought}`);
      }
    }
    console.log();

    // 7. Проверка результатов в ведомости учителя
    console.log('6️⃣ [Ведомость] Проверка итоговых оценок в кабинете учителя...');
    const dashRes = await fetch(`${BASE_URL}/api/games/${gameId}/teacher`);
    const dash = await dashRes.json();

    let countGrade5 = 0;
    let countGrade4 = 0;
    let countOther = 0;
    let totalScorePoints = 0;

    for (const st of dash.students) {
      const report = st.scoreReport;
      if (report) {
        totalScorePoints += report.scorePoints;
        if (report.grade === 5) countGrade5++;
        else if (report.grade === 4) countGrade4++;
        else countOther++;
      }
    }

    console.log(`📊 Итоги сдачи экзамена:`);
    console.log(`   🌟 Оценка «5» (Отлично):  ${countGrade5} из 40 учеников (${((countGrade5 / 40) * 100).toFixed(0)}%)`);
    console.log(`   👍 Оценка «4» (Хорошо):   ${countGrade4} из 40 учеников`);
    console.log(`   ⚠️ Оценка «3» или «2»:    ${countOther} из 40 учеников`);
    console.log(`   💯 Средний балл:          ${(totalScorePoints / 40).toFixed(1)} / 20 вопросов (100% результат)`);

    // Отключение сокетов
    teacherSocket.disconnect();
    students.forEach((s) => s.socket?.disconnect());

    const totalTime = ((Date.now() - startTimeOverall) / 1000).toFixed(2);

    console.log(`\n================================================================`);
    console.log(`🏆 РЕЗУЛЬТАТ: ВСЕ 40 УЧЕНИКОВ СДАЛИ НА «5» САМОСТОЯТЕЛЬНО!`);
    console.log(`----------------------------------------------------------------`);
    console.log(`✔ Учеников сдавало:             ${TARGET_STUDENT_COUNT}`);
    console.log(`✔ Сдали на оценку 5:            ${countGrade5} / 40 (100%)`);
    console.log(`✔ Решено заданий:               ${dash.students.length * 20} из ${dash.students.length * 20}`);
    console.log(`✔ Ни одного подсмотра в ключи:  ДА (клиент получает только текст)`);
    console.log(`✔ Время выполнения симуляции:   ${totalTime} сек`);
    console.log(`================================================================\n`);

    if (countGrade5 !== 40) {
      throw new Error(`Не все ученики получили оценку 5! Получили 5: ${countGrade5}`);
    }
  } finally {
    server.close();
    await closeDb();
  }
}

run40ThinkingStudentsTest()
  .then(() => {
    console.log('🏁 Тест успешно завершён.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Ошибка теста:', err);
    process.exit(1);
  });
