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

export async function runLoadSimulation(studentCount: number = 37) {
  console.log(`\n======================================================`);
  console.log(`🚀 STARTING REAL-TIME LOAD TEST FOR ${studentCount} SIMULTANEOUS STUDENTS`);
  console.log(`======================================================\n`);

  await runMigrations();
  await seedDatabase();

  // Start HTTP server on dynamic port
  const PORT = 3088;
  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });
  console.log(`📡 Test server running on http://127.0.0.1:${PORT}`);

  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Teacher creates game
    console.log('👨‍🏫 Teacher: Creating game...');
    const createRes = await fetch(`${baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Нагрузочный тест ${studentCount} учеников`, durationSeconds: 1200 }),
    });
    const gameData = await createRes.json();
    const gameId = gameData.gameId;
    const gameCode = gameData.code;
    console.log(`✅ Game created. Code: ${gameCode}, Game ID: ${gameId}`);

    // 2. Connect Teacher WebSocket
    const teacherSocket = ioClient(baseUrl);
    await new Promise<void>((resolve) => {
      teacherSocket.on('connect', () => {
        teacherSocket.emit('teacher:join', { gameId });
        resolve();
      });
    });
    console.log('✅ Teacher WebSocket connected.');

    // 3. Connect 37 virtual students concurrently
    console.log(`👥 Connecting ${studentCount} students simultaneously...`);
    const students: VirtualStudent[] = Array.from({ length: studentCount }, (_, i) => ({
      virtualIndex: i + 1,
      firstName: `Ученик_${i + 1}`,
      lastName: `Тестов_${i + 1}`,
      answersSubmitted: 0,
    }));

    const joinPromises = students.map(async (st) => {
      const joinRes = await fetch(`${baseUrl}/api/games/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode,
          firstName: st.firstName,
          lastName: st.lastName,
        }),
      });

      if (!joinRes.ok) {
        const errText = await joinRes.text();
        throw new Error(`Student ${st.virtualIndex} failed to join: ${errText}`);
      }

      const joinJson = await joinRes.json();
      st.studentId = joinJson.studentId;
      st.formId = joinJson.formId;
      st.sessionToken = joinJson.sessionToken;

      // Connect student WebSocket
      const sock = ioClient(baseUrl);
      st.socket = sock;

      await new Promise<void>((resolve) => {
        sock.on('connect', () => {
          sock.emit(
            'student:join',
            {
              gameId,
              studentId: st.studentId,
              sessionToken: st.sessionToken,
            },
            () => resolve()
          );
        });
      });

      return st;
    });

    await Promise.all(joinPromises);
    console.log(`✅ All ${studentCount} students successfully joined and connected WebSockets.`);

    // 4. Verify unique IDs and forms
    const assignedStudentIds = students.map((s) => s.studentId!);
    const assignedFormIds = students.map((s) => s.formId!);

    const uniqueStudentIds = new Set(assignedStudentIds);
    const uniqueFormIds = new Set(assignedFormIds);

    if (uniqueStudentIds.size !== studentCount) {
      throw new Error(`Duplicate student IDs detected! Unique count: ${uniqueStudentIds.size}`);
    }
    if (uniqueFormIds.size !== studentCount) {
      throw new Error(`Duplicate form IDs detected! Unique count: ${uniqueFormIds.size}`);
    }

    console.log(`✅ ID Validation Passed: ${studentCount} strictly unique IDs and ${studentCount} unique Forms.`);

    for (const s of students) {
      if (s.studentId !== s.formId) {
        throw new Error(`Mismatch between studentId ${s.studentId} and formId ${s.formId}`);
      }
    }
    console.log(`✅ Strict Mapping Verified: student_id == form_id for all ${studentCount} participants.`);

    // 5. Teacher starts test
    console.log('▶️ Teacher: Starting test...');
    const startPromises = students.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.socket!.on('game:started', () => {
            resolve();
          });
        })
    );

    const startRes = await fetch(`${baseUrl}/api/games/${gameId}/start`, {
      method: 'POST',
    });
    if (!startRes.ok) {
      const err = await startRes.text();
      throw new Error(`Failed to start game: ${err}`);
    }
    console.log('✅ Game start signal sent by teacher.');

    // Wait for all 37 students to receive WebSocket GAME_STARTED event
    await Promise.all(startPromises);
    console.log('✅ All 37 students received real-time game:started WebSocket event.');

    // 6. All 37 students answer all 20 questions concurrently
    console.log(`📝 Simulating answering: ${studentCount} students × 20 questions = ${studentCount * 20} answers...`);

    const answerAllStudentsPromises = students.map(async (st) => {
      for (let qNum = 1; qNum <= 20; qNum++) {
        // Fetch question projection
        const qRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${st.studentId}/question/${qNum}`);
        if (!qRes.ok) throw new Error(`Student ${st.studentId} failed to fetch question ${qNum}`);
        const qData = await qRes.json();

        let payload: any = { questionNumber: qNum };

        if (qData.type === 'multiple_choice') {
          // Select the second option or first option
          const opt = qData.options[1] || qData.options[0];
          payload.selectedOptionId = opt.id;
        } else {
          // Short answer: submit answers
          payload.answerText = qNum === 18 ? '0.5' : qNum === 19 ? '1/2' : '4';
        }

        const submitRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${st.studentId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!submitRes.ok) {
          const err = await submitRes.text();
          throw new Error(`Student ${st.studentId} failed to submit answer ${qNum}: ${err}`);
        }

        st.answersSubmitted++;
      }

      // Finish student test
      await fetch(`${baseUrl}/api/games/${gameId}/student/${st.studentId}/finish`, {
        method: 'POST',
      });
    });

    await Promise.all(answerAllStudentsPromises);
    console.log(`✅ All ${studentCount * 20} answers successfully submitted!`);

    // 7. Verify Teacher Dashboard and Database Record Integrity
    console.log('🔍 Checking database results and teacher dashboard snapshot...');
    const dashRes = await fetch(`${baseUrl}/api/games/${gameId}/teacher`);
    const dashJson = await dashRes.json();

    console.log(`📊 Total participants reported: ${dashJson.totalConnected}`);
    if (dashJson.totalConnected !== studentCount) {
      throw new Error(`Expected ${studentCount} connected, got ${dashJson.totalConnected}`);
    }

    const db = await getDb();
    const totalAnswersInDb = await db.query(
      `SELECT COUNT(*) as count FROM student_answers WHERE game_id = $1`,
      [gameId]
    );
    const answersRecorded = parseInt(totalAnswersInDb.rows[0].count, 10);
    console.log(`💾 Total answers recorded in database: ${answersRecorded} / ${studentCount * 20}`);

    if (answersRecorded !== studentCount * 20) {
      throw new Error(`Data loss detected! Recorded: ${answersRecorded}, expected: ${studentCount * 20}`);
    }

    console.log('✅ ZERO lost answers! Exactly 100% of responses preserved.');

    // Verify all students have computed reports
    for (const st of dashJson.students) {
      if (!st.scoreReport) {
        throw new Error(`Student ${st.studentId} missing score report.`);
      }
      if (typeof st.scoreReport.percentage !== 'number' || typeof st.scoreReport.grade !== 'number') {
        throw new Error(`Student ${st.studentId} invalid scoreReport formatting.`);
      }
    }
    console.log('✅ 100% of students have valid score, percentage, and 5-point grade.');

    // Clean up sockets
    teacherSocket.disconnect();
    students.forEach((s) => s.socket?.disconnect());

    console.log(`\n======================================================`);
    console.log(`🎉 LOAD TEST COMPLETED WITH 100% SUCCESS!`);
    console.log(`- Students: ${studentCount}`);
    console.log(`- Submissions: ${answersRecorded}`);
    console.log(`- Duplicate IDs: 0`);
    console.log(`- Data Loss: 0`);
    console.log(`======================================================\n`);

    return {
      studentCount,
      answersRecorded,
      dashJson,
    };
  } finally {
    server.close();
  }
}

// Run direct execution
runLoadSimulation(37)
  .then(() => {
    console.log('🏁 Load test execution finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ LOAD TEST FAILED:', err);
    process.exit(1);
  });
