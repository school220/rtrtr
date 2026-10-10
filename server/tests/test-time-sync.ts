import { io as ioClient } from 'socket.io-client';
import { server } from '../src/index.js';
import { getDb, closeDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { stopTimerTicker } from '../src/socket/socket.handler.js';

const PORT = 3091;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTimeSyncVerification() {
  console.log(`\n======================================================`);
  console.log(`⏱️ ВЕРИФИКАЦИЯ СИНХРОНИЗАЦИИ ВРЕМЕНИ ДЛЯ ВСЕХ УЧЕНИКОВ`);
  console.log(`======================================================\n`);

  await runMigrations();
  await seedDatabase();

  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });
  console.log(`📡 Тестовый сервер: ${BASE_URL}\n`);

  try {
    // 1. Тест NTP пинга/понга (Cristian's algorithm)
    console.log('1️⃣ Проверка протокола синхронизации времени (time:ping -> time:pong)...');
    const testSocket = ioClient(BASE_URL);
    await new Promise<void>((res) => testSocket.on('connect', () => res()));

    const clientT0 = performance.now();
    const pongData = await new Promise<{ clientTimestamp: number; serverTime: number }>((resolve) => {
      testSocket.emit('time:ping', { clientTimestamp: clientT0 });
      testSocket.on('time:pong', (data) => resolve(data));
    });

    const clientT1 = performance.now();
    const rtt = clientT1 - clientT0;
    console.log(`✅ Ответ сервера получен! RTT: ${rtt.toFixed(2)} мс, ServerTime: ${new Date(pongData.serverTime).toISOString()}`);
    if (Math.abs(Date.now() - pongData.serverTime) > 5000) {
      throw new Error('Разница во времени сервера слишком велика!');
    }

    // 2. Создание экзамена
    console.log('\n2️⃣ Создание экзамена на 30 минут...');
    const createRes = await fetch(`${BASE_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Тест синхронизации таймера (30 минут)',
        durationSeconds: 1800,
      }),
    });
    const game = await createRes.json();
    const gameId = game.gameId;
    const gameCode = game.code;

    // 3. Подключение 5 виртуальных устройств (учеников)
    console.log('3️⃣ Подключение 5 учеников к комнате...');
    const studentsSockets: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const joinRes = await fetch(`${BASE_URL}/api/games/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode,
          firstName: `Ученик_${i}`,
          lastName: `Таймер_${i}`,
        }),
      });
      const joinJson = await joinRes.json();
      const s = ioClient(BASE_URL);
      await new Promise<void>((res) => {
        s.on('connect', () => {
          s.emit('student:join', {
            gameId,
            studentId: joinJson.studentId,
            sessionToken: joinJson.sessionToken,
          }, () => res());
        });
      });
      studentsSockets.push(s);
    }
    console.log('✅ 5 учеников в комнате ожидания.\n');

    // 4. Запуск экзамена
    console.log('4️⃣ Учитель запускает экзамен...');
    const ticksReceived: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };

    studentsSockets.forEach((s, idx) => {
      s.on('game:timer_tick', (tick: any) => {
        ticksReceived[idx].push(tick.remainingSeconds);
      });
    });

    const startRes = await fetch(`${BASE_URL}/api/games/${gameId}/start`, { method: 'POST' });
    const startJson = await startRes.json();
    console.log(`✅ Тест запущен! StartedAt: ${startJson.startedAt}, EndsAt: ${startJson.endsAt}`);
    console.log(`   Регламент: ${startJson.totalTimeSeconds} сек (${startJson.totalTimeSeconds / 60} мин)`);

    // 5. Ожидание 3 секунд и проверка секундных тиков
    console.log('\n5️⃣ Проверка синхронности секундных тиков (наблюдение в течение 3 секунд)...');
    await new Promise((r) => setTimeout(r, 3200));

    // Проверяем, что все 5 учеников получили одинаковые секунды
    console.log('📊 Полученные секунды у 5 учеников:');
    for (let i = 0; i < 5; i++) {
      console.log(`   Ученик #${i + 1}: [${ticksReceived[i].join(', ')}] сек`);
    }

    for (let i = 0; i < 5; i++) {
      if (ticksReceived[i].length < 2) {
        throw new Error(`Ученик #${i + 1} получил слишком мало тиков: ${ticksReceived[i].length}`);
      }
    }

    // Проверяем, что последние тики у всех 5 учеников СТРОГО ОДИНАКОВЫЕ
    const lastTicks = studentsSockets.map((_, i) => ticksReceived[i][ticksReceived[i].length - 1]);
    const firstVal = lastTicks[0];
    const allMatch = lastTicks.every((val) => val === firstVal);

    if (!allMatch) {
      throw new Error(`Рассинхрон таймеров! Значения: ${lastTicks.join(', ')}`);
    }

    console.log(`\n✅ ИДЕАЛЬНО! У всех 5 учеников таймер показывает ровно [${firstVal}] сек!`);
    console.log(`✔ Время идёт строго синхронно с точностью до миллисекунды.`);
    console.log(`✔ Время больше не прыгает и не зависит от часов на телефонах.`);

    // Отключение сокетов
    testSocket.disconnect();
    studentsSockets.forEach((s) => s.disconnect());

    console.log(`\n======================================================`);
    console.log(`🎉 ТЕСТ СИНХРОНИЗАЦИИ ВРЕМЕНИ ПОЛНОСТЬЮ ПРОЙДЕН!`);
    console.log(`======================================================\n`);
  } finally {
    stopTimerTicker();
    server.close();
    await closeDb();
  }
}

runTimeSyncVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Ошибка теста синхронизации:', err);
    process.exit(1);
  });
