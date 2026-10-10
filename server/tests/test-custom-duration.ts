import { io as ioClient } from 'socket.io-client';
import { server } from '../src/index.js';
import { getDb, closeDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { stopTimerTicker } from '../src/socket/socket.handler.js';

const PORT = 3092;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runCustomDurationTest() {
  console.log(`\n======================================================`);
  console.log(`⏱️ ТЕСТ: НАЗНАЧЕНИЕ ПРОИЗВОЛЬНОГО ВРЕМЕНИ ТЕСТА (21/22 МИНУТЫ)`);
  console.log(`======================================================\n`);

  await runMigrations();
  await seedDatabase();

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });

  try {
    // 1. Создание игры
    console.log('1️⃣ Создание экзаменационной сессии...');
    const createRes = await fetch(`${BASE_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Тест гибкого регламента',
      }),
    });
    const game = await createRes.json();
    const gameId = game.gameId;
    console.log(`✅ Сессия создана! Код: [${game.code}], Исходное время: ${game.durationSeconds} сек (30 мин)`);

    // 2. Учитель меняет время на 21 минуту
    console.log('\n2️⃣ Учитель вводит 21 минуту (когда код уже создан)...');
    const patch21Res = await fetch(`${BASE_URL}/api/games/${gameId}/duration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes: 21 }),
    });
    const patch21Json = await patch21Res.json();
    console.log(`✅ Время обновлено: ${patch21Json.durationMinutes} мин (${patch21Json.totalTimeSeconds} сек)`);
    if (patch21Json.totalTimeSeconds !== 21 * 60) {
      throw new Error(`Ожидалось 1260 сек, получено: ${patch21Json.totalTimeSeconds}`);
    }

    // 3. Учитель решает изменить на 22 минуты
    console.log('\n3️⃣ Учитель решает изменить время на 22 минуты...');
    const patch22Res = await fetch(`${BASE_URL}/api/games/${gameId}/duration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes: 22 }),
    });
    const patch22Json = await patch22Res.json();
    console.log(`✅ Время обновлено: ${patch22Json.durationMinutes} мин (${patch22Json.totalTimeSeconds} сек)`);
    if (patch22Json.totalTimeSeconds !== 22 * 60) {
      throw new Error(`Ожидалось 1320 сек, получено: ${patch22Json.totalTimeSeconds}`);
    }

    // 4. Подключение ученика
    console.log('\n4️⃣ Подключение ученика в комнату ожидания...');
    const joinRes = await fetch(`${BASE_URL}/api/games/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameCode: game.code,
        firstName: 'Тест',
        lastName: 'Ученик',
      }),
    });
    const joinJson = await joinRes.json();
    const sock = ioClient(BASE_URL);
    await new Promise<void>((res) => {
      sock.on('connect', () => {
        sock.emit('student:join', {
          gameId,
          studentId: joinJson.studentId,
          sessionToken: joinJson.sessionToken,
        }, () => res());
      });
    });

    // 5. Запуск экзамена учителем
    console.log('\n5️⃣ Учитель запускает экзамен...');
    let initialTickReceived: any = null;
    sock.on('game:timer_tick', (tick) => {
      if (!initialTickReceived) {
        initialTickReceived = tick;
      }
    });

    const startRes = await fetch(`${BASE_URL}/api/games/${gameId}/start`, { method: 'POST' });
    const startJson = await startRes.json();

    const startedMs = new Date(startJson.startedAt).getTime();
    const endsMs = new Date(startJson.endsAt).getTime();
    const diffSecs = Math.round((endsMs - startedMs) / 1000);

    console.log(`✅ Экзамен стартовал!`);
    console.log(`   StartedAt: ${startJson.startedAt}`);
    console.log(`   EndsAt:    ${startJson.endsAt}`);
    console.log(`   Фактическая длительность таймера: ${diffSecs} сек (${diffSecs / 60} мин)`);

    if (diffSecs !== 22 * 60) {
      throw new Error(`Таймер стартовал не на 22 минуты! Длительность: ${diffSecs} сек`);
    }

    // Ждём 1.5 секунды первого тика таймера
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`✅ Тик таймера от сервера: remainingSeconds = ${initialTickReceived?.remainingSeconds} сек`);

    if (Math.abs(initialTickReceived?.remainingSeconds - 1320) > 2) {
      throw new Error(`Неверный оставшийся таймер: ${initialTickReceived?.remainingSeconds}`);
    }

    sock.disconnect();
    console.log(`\n======================================================`);
    console.log(`🎉 ТЕСТ НАЗНАЧЕНИЯ ПРОИЗВОЛЬНОГО ВРЕМЕНИ УСПЕШНО ПРОЙДЕН!`);
    console.log(`======================================================\n`);
  } finally {
    stopTimerTicker();
    server.close();
    await closeDb();
  }
}

runCustomDurationTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Ошибка теста произвольного времени:', err);
    process.exit(1);
  });
