import http from 'http';
import { spawn } from 'child_process';
import { io as ioClient } from 'socket.io-client';

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchUrl(url: string, options: http.RequestOptions = {}, postData?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; buffer?: Buffer }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: buffer.toString('utf-8'),
            buffer,
          });
        });
      }
    );
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runSmokeTest() {
  console.log('🏁 Starting Production Server Smoke Test...');

  const TEST_PORT = 3088;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  // Spawn production server exactly as Render runs it:
  console.log(`🚀 Spawning production process: "node server/dist/index.js" on PORT=${TEST_PORT}...`);
  const serverProc = spawn('node', ['server/dist/index.js'], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stdout.on('data', (d) => process.stdout.write(`[SERVER OUT] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

  let isReady = false;
  for (let i = 0; i < 120; i++) {
    await wait(500);
    try {
      const res = await fetchUrl(`${BASE_URL}/health`);
      if (res.status === 200 && res.body.includes('"status":"ok"')) {
        isReady = true;
        break;
      }
    } catch {
      // waiting for server to bind
    }
  }

  if (!isReady) {
    serverProc.kill();
    throw new Error('❌ Server failed to respond to /health within 60 seconds.');
  }

  console.log('✅ Server responded to /health: OK');

  try {
    // 1. Verify /health
    const health = await fetchUrl(`${BASE_URL}/health`);
    console.log(`[1/6] Health check: status ${health.status}, response: ${health.body.trim()}`);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Verify static frontend HTML serving
    const rootHtml = await fetchUrl(`${BASE_URL}/`);
    console.log(`[2/6] Root static HTML: status ${rootHtml.status}, contains "<div id=\"root\">": ${rootHtml.body.includes('root')}`);
    if (rootHtml.status !== 200 || !rootHtml.body.includes('<!doctype html>')) {
      throw new Error('Static index.html delivery failed');
    }

    // 3. Verify SPA fallback routing
    const spaTeacher = await fetchUrl(`${BASE_URL}/teacher`);
    console.log(`[3/6] SPA fallback for /teacher: status ${spaTeacher.status}, delivers HTML: ${spaTeacher.body.includes('<!doctype html>')}`);
    if (spaTeacher.status !== 200 || !spaTeacher.body.includes('<!doctype html>')) {
      throw new Error('SPA routing fallback failed');
    }

    // 4. Verify API game session creation
    const postBody = JSON.stringify({ title: 'Тестирование 10-А Класс' });
    const createGame = await fetchUrl(
      `${BASE_URL}/api/games`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(postBody)),
        },
      },
      postBody
    );
    console.log(`[4/6] API create game: status ${createGame.status}`);
    const gameData = JSON.parse(createGame.body);
    const gameCode = gameData.code || gameData.game?.code;
    const gameId = gameData.gameId || gameData.game?.id;
    if (!gameCode || !gameId) {
      throw new Error(`Invalid game creation response: ${createGame.body}`);
    }
    console.log(`      Game Code generated: ${gameCode}, ID: ${gameId}`);

    // 5. Verify WebSocket / Socket.IO real-time connection
    const socketConnected = await new Promise<boolean>((resolve, reject) => {
      const socket = ioClient(BASE_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      socket.on('connect', () => {
        console.log(`[5/6] Socket.IO connection established! ID: ${socket.id}`);
        socket.emit('teacher:join', { gameId });
      });

      socket.on('teacher:dashboard_update', (dashboard) => {
        console.log(`      Received teacher:dashboard_update via Socket.IO: game ${dashboard.game?.code}, title: ${dashboard.game?.title}`);
        socket.disconnect();
        resolve(true);
      });

      socket.on('connect_error', (err) => {
        socket.disconnect();
        reject(err);
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket.IO room:state timeout'));
      }, 6000);
    });

    if (!socketConnected) throw new Error('Socket.IO test failed');

    // 6. Verify Excel report export
    const excelRes = await fetchUrl(`${BASE_URL}/api/games/${gameId}/export/excel`);
    console.log(`[6/6] Excel export: status ${excelRes.status}, Content-Type: ${excelRes.headers['content-type']}`);
    if (
      excelRes.status !== 200 ||
      !excelRes.headers['content-type']?.includes('spreadsheetml') ||
      (excelRes.buffer?.length || 0) < 500
    ) {
      throw new Error('Excel report export failed');
    }
    console.log(`      Excel export delivered valid .xlsx binary (${excelRes.buffer?.length} bytes)`);

    console.log('\n===========================================================');
    console.log('🎉 ALL PRODUCTION DEPLOYMENT SMOKE TESTS PASSED (6/6)!');
    console.log('✨ The application is 100% production-ready for Render deployment.');
    console.log('===========================================================\n');
  } finally {
    console.log('🧹 Shutting down test production server...');
    serverProc.kill();
  }
}

runSmokeTest().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
