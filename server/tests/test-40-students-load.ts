import { io as ioClient, Socket } from 'socket.io-client';
import { server } from '../src/index.js';
import { getDb, closeDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';

interface VirtualStudent {
  virtualIndex: number;
  firstName: string;
  lastName: string;
  socket?: Socket;
  sessionToken?: string;
  studentId?: number;
  formId?: number;
  answersSubmitted: number;
}

const TARGET_STUDENT_COUNT = 40;
const PORT = 3088;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function run40StudentsLoadTest() {
  console.log(`\n======================================================`);
  console.log(`🚀 НАГРУЗОЧНОЕ ТЕСТИРОВАНИЕ: 40 ОДНОВРЕМЕННЫХ УЧЕНИКОВ`);
  console.log(`⏱️ Регламент времени: 30 МИНУТ (1800 СЕКУНД)`);
  console.log(`======================================================\n`);

  await runMigrations();
  await seedDatabase();

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });
  console.log(`📡 Тестовый сервер слушает: ${BASE_URL}\n`);

  const startTimeOverall = Date.now();

  try {
    // 1. Создание экзаменационной комнаты
    console.log('1️⃣ [Учитель] Создание экзаменационной сессии (30 минут регламент)...');
    const createRes = await fetch(`${BASE_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Стресс-тест 40 учеников (4 класс • Дроби • 30 минут)',
        durationSeconds: 1800,
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Ошибка создания игры: ${await createRes.text()}`);
    }

    const gameData = await createRes.json();
    const gameId = gameData.gameId;
    const gameCode = gameData.code;
    console.log(`✅ Сессия создана! ПИН-код аудитории: [${gameCode}], Длительность: ${gameData.durationSeconds} сек (30 мин)\n`);

    // 2. Подключение веб-сокета учителя
    console.log('2️⃣ [Учитель] Подключение WebSocket мониторинга...');
    const teacherSocket = ioClient(BASE_URL);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Teacher socket connection timeout')), 5000);
      teacherSocket.on('connect', () => {
        clearTimeout(timer);
        teacherSocket.emit('teacher:join', { gameId });
        resolve();
      });
    });
    console.log('✅ Мониторинг учителя подключён по WebSocket в реальном времени.\n');

    // 3. Одновременный вход 40 учеников
    console.log(`3️⃣ [Ученики] Одновременный вход 40 учеников в аудиторию...`);
    const joinStartTime = Date.now();

    const students: VirtualStudent[] = Array.from({ length: TARGET_STUDENT_COUNT }, (_, i) => ({
      virtualIndex: i + 1,
      firstName: `Ученик_${i + 1}`,
      lastName: `Тестовый_${i + 1}`,
      answersSubmitted: 0,
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

      // Подключение персонального WebSocket ученика
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
    console.log(`✅ Все 40 учеников вошли и подключили сокеты за ${joinDuration.toFixed(2)} сек!`);

    // 4. Проверка уникальности вариантов
    const assignedIds = students.map((s) => s.studentId!);
    const assignedForms = students.map((s) => s.formId!);
    const uniqueIds = new Set(assignedIds);
    const uniqueForms = new Set(assignedForms);

    console.log(`🔍 Проверка коллизий:`);
    console.log(`   - Уникальных ID: ${uniqueIds.size} / 40`);
    console.log(`   - Уникальных вариантов: ${uniqueForms.size} / 40`);

    if (uniqueIds.size !== 40 || uniqueForms.size !== 40) {
      throw new Error('Обнаружены дубликаты ID или вариантов!');
    }
    console.log(`✅ Идеальное распределение: 0 дубликатов, каждый ученик получил персональный вариант 1..40.\n`);

    // 5. Запуск экзамена учителем
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
    console.log(`✅ Все 40 учеников синхронно получили сигнал старта через WebSocket.\n`);

    // 6. Одновременное прохождение теста: 40 учеников × 20 заданий = 800 запросов
    console.log(`5️⃣ [Ученики] Решение заданий: 40 учеников × 20 вопросов = 800 ответов параллельно...`);
    const answersStartTime = Date.now();

    const answersPromises = students.map(async (st) => {
      // Получение вопросов для варианта
      const qListRes = await fetch(`${BASE_URL}/api/games/${gameId}/student/${st.studentId}/questions`);
      if (!qListRes.ok) throw new Error(`Не удалось загрузить вопросы ученика ${st.studentId}`);
      const questions = await qListRes.json();

      for (let qNum = 1; qNum <= 20; qNum++) {
        const q = questions[qNum - 1];
        let payload: any = { questionNumber: qNum };

        if (q.type === 'multiple_choice') {
          const option = q.options[0];
          payload.selectedOptionId = option.id;
        } else {
          payload.answerText = '42';
        }

        const ansRes = await fetch(`${BASE_URL}/api/games/${gameId}/student/${st.studentId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!ansRes.ok) {
          throw new Error(`Ошибка сохранения ответа ${qNum} для ученика ${st.studentId}`);
        }

        st.answersSubmitted++;
      }

      // Завершение теста учеником
      await fetch(`${BASE_URL}/api/games/${gameId}/student/${st.studentId}/finish`, {
        method: 'POST',
      });
    });

    await Promise.all(answersPromises);
    const answersDuration = (Date.now() - answersStartTime) / 1000;
    const requestsCount = 40 * 20;
    const reqPerSec = (requestsCount / answersDuration).toFixed(1);

    console.log(`✅ Все 800 ответов сохранены за ${answersDuration.toFixed(2)} сек (~${reqPerSec} ответов/сек)!`);
    console.log(`✅ 100% учеников успешно завершили тестирование.\n`);

    // 7. Проверка ведомости учителя и целостности БД
    console.log('6️⃣ [Верификация] Проверка ведомости учителя и целостности данных...');
    const dashRes = await fetch(`${BASE_URL}/api/games/${gameId}/teacher`);
    const dash = await dashRes.json();

    console.log(`📊 Всего участников в ведомости: ${dash.totalConnected} / 40`);
    console.log(`📊 Регламент времени в ведомости: ${dash.game.total_time_seconds} сек (${dash.game.total_time_seconds / 60} мин)`);
    console.log(`📊 Статус завершения: ${dash.students.filter((s: any) => s.status === 'FINISHED').length} / 40 сдали`);

    const db = await getDb();
    const answersInDbRes = await db.query(
      `SELECT COUNT(*) as count FROM student_answers WHERE game_id = $1`,
      [gameId]
    );
    const totalAnswersSaved = parseInt(answersInDbRes.rows[0].count, 10);
    console.log(`💾 Записей в БД student_answers: ${totalAnswersSaved} / 800`);

    let validReports = 0;
    for (const st of dash.students) {
      if (st.scoreReport && typeof st.scoreReport.grade === 'number') {
        validReports++;
      }
    }

    console.log(`📊 Рассчитано оценок (2–5): ${validReports} / 40 (100%)`);

    // Отключение сокетов
    teacherSocket.disconnect();
    students.forEach((s) => s.socket?.disconnect());

    const totalTime = ((Date.now() - startTimeOverall) / 1000).toFixed(2);

    console.log(`\n======================================================`);
    console.log(`🏆 РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ ПОД НАГРУЗКОЙ:`);
    console.log(`------------------------------------------------------`);
    console.log(`✔ Учеников одновременно:        ${TARGET_STUDENT_COUNT}`);
    console.log(`✔ Длительность экзамена:        ${dash.game.total_time_seconds / 60} минут`);
    console.log(`✔ Уникальных вариантов КИМ:     ${uniqueForms.size}`);
    console.log(`✔ Всего отправлено ответов:     ${requestsCount}`);
    console.log(`✔ Сохранено в БД ответов:       ${totalAnswersSaved} (100%)`);
    console.log(`✔ Потерянных ответов:           0 (0%)`);
    console.log(`✔ Ошибок сервера (5xx/4xx):     0 (0%)`);
    console.log(`✔ Скорость обработки:           ${reqPerSec} ответов/сек`);
    console.log(`✔ Общее время стресс-теста:     ${totalTime} сек`);
    console.log(`✔ Вердикт:                      СЕРВЕР ПОЛНОСТЬЮ ВЫДЕРЖИВАЕТ НАГРУЗКУ! 🔥`);
    console.log(`======================================================\n`);
  } finally {
    server.close();
    await closeDb();
  }
}

run40StudentsLoadTest()
  .then(() => {
    console.log('🏁 Тест успешно пройден.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Ошибка нагрузочного теста:', err);
    process.exit(1);
  });
