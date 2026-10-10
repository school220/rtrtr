import http from 'http';
import { app } from '../src/index.js';
import { config } from '../src/config.js';
import { sanitizeName } from '../src/middleware/security.middleware.js';

let server: http.Server;
let baseUrl: string;

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function runSecurityTests() {
  console.log('🛡️  Starting Automated Security & Anti-Hacking Tests...\n');

  // Test 1: Input Sanitization
  console.log('1️⃣  Testing Input Sanitization & Anti-XSS / Anti-CSV-Injection:');
  const xssName = "<script>alert('pwned')</script>Иван";
  const sanitizedXss = sanitizeName(xssName);
  console.log(`   Raw: "${xssName}" -> Sanitized: "${sanitizedXss}"`);
  if (sanitizedXss === 'Иван') {
    console.log('   ✅ XSS script tag successfully stripped!');
  } else {
    throw new Error(`XSS sanitization failed: got ${sanitizedXss}`);
  }

  const csvInjection = "=cmd|' /C calc'!A0Петров";
  const sanitizedCsv = sanitizeName(csvInjection);
  console.log(`   Raw: "${csvInjection}" -> Sanitized: "${sanitizedCsv}"`);
  if (!sanitizedCsv.startsWith('=')) {
    console.log('   ✅ Formula injection prefix successfully neutralized!');
  } else {
    throw new Error(`CSV injection sanitization failed: got ${sanitizedCsv}`);
  }

  await startServer();

  try {
    // Test 2: OWASP Security Headers
    console.log('\n2️⃣  Testing HTTP Security Headers:');
    const headRes = await fetch(`${baseUrl}/health`);
    const xFrame = headRes.headers.get('x-frame-options');
    const xContentType = headRes.headers.get('x-content-type-options');
    const xPoweredBy = headRes.headers.get('x-powered-by');
    const csp = headRes.headers.get('content-security-policy');

    console.log(`   X-Frame-Options: ${xFrame}`);
    console.log(`   X-Content-Type-Options: ${xContentType}`);
    console.log(`   X-Powered-By: ${xPoweredBy || 'None (Hidden)'}`);
    console.log(`   CSP Present: ${Boolean(csp)}`);

    if (xFrame === 'SAMEORIGIN' && xContentType === 'nosniff' && !xPoweredBy && csp) {
      console.log('   ✅ Security headers correctly configured!');
    } else {
      throw new Error('Security headers check failed');
    }

    // Test 3: Unauthorized Teacher Access Block
    console.log('\n3️⃣  Testing Unauthorized Access to Teacher Endpoints:');
    
    // Attempt 3a: Create game without auth
    const createRes = await fetch(`${baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacked Room' }),
    });
    console.log(`   POST /api/games (No Token) -> Status: ${createRes.status}`);
    if (createRes.status === 401) {
      console.log('   ✅ Blocked! 401 Unauthorized returned.');
    } else {
      throw new Error(`Expected 401 on unauthorized game creation, got ${createRes.status}`);
    }

    // Attempt 3b: Access teacher dashboard without auth
    const dashRes = await fetch(`${baseUrl}/api/games/any-id/teacher`);
    console.log(`   GET /api/games/any-id/teacher (No Token) -> Status: ${dashRes.status}`);
    if (dashRes.status === 401) {
      console.log('   ✅ Blocked! Teacher dashboard protected.');
    } else {
      throw new Error(`Expected 401 on teacher dashboard, got ${dashRes.status}`);
    }

    // Attempt 3c: Excel export without auth
    const excelRes = await fetch(`${baseUrl}/api/games/any-id/export/excel`);
    console.log(`   GET /api/games/any-id/export/excel (No Token) -> Status: ${excelRes.status}`);
    if (excelRes.status === 401) {
      console.log('   ✅ Blocked! Excel grade export protected.');
    } else {
      throw new Error(`Expected 401 on Excel export, got ${excelRes.status}`);
    }

    // Attempt 3d: Access questions import without auth
    const importRes = await fetch(`${baseUrl}/api/import/forms-status`);
    console.log(`   GET /api/import/forms-status (No Token) -> Status: ${importRes.status}`);
    if (importRes.status === 401) {
      console.log('   ✅ Blocked! Question bank protected.');
    } else {
      throw new Error(`Expected 401 on import routes, got ${importRes.status}`);
    }

    // Test 4: Student cross-hijacking protection
    console.log('\n4️⃣  Testing Student Session Protection:');
    const answerRes = await fetch(`${baseUrl}/api/games/any-game/student/1/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionNumber: 1, selectedOptionId: 2 }),
    });
    console.log(`   POST /api/games/.../student/1/answer (No Student Token) -> Status: ${answerRes.status}`);
    if (answerRes.status === 401 || answerRes.status === 403) {
      console.log('   ✅ Blocked! Unauthorized student answer rejected.');
    } else {
      throw new Error(`Expected 401/403 on unauthenticated student answer, got ${answerRes.status}`);
    }

    // Test 5: Teacher Login with valid credentials
    console.log('\n5️⃣  Testing Legitimate Teacher Login:');
    const loginRes = await fetch(`${baseUrl}/api/teacher/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: config.teacherAuth.username,
        password: config.teacherAuth.password,
      }),
    });
    const loginData = await loginRes.json();
    console.log(`   Login Status: ${loginRes.status}, Received Token: ${loginData.token ? 'YES' : 'NO'}`);
    if (loginRes.ok && loginData.token) {
      console.log('   ✅ Legitimate login works perfectly!');

      // Verify token allows authorized teacher actions
      const authGameRes = await fetch(`${baseUrl}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginData.token}`,
        },
        body: JSON.stringify({ title: 'Аудитория безопасности' }),
      });
      console.log(`   POST /api/games (With Bearer Token) -> Status: ${authGameRes.status}`);
      if (authGameRes.status === 201) {
        console.log('   ✅ Authorized teacher room creation succeeded!');
      } else {
        throw new Error(`Failed to create game with valid token: ${authGameRes.status}`);
      }
    } else {
      throw new Error('Teacher login failed');
    }

    console.log('\n🎉 ALL SECURITY TESTS PASSED! System is fully hardened.');
  } finally {
    await stopServer();
  }
}

runSecurityTests().catch((err) => {
  console.error('❌ Security test failed:', err);
  process.exit(1);
});
