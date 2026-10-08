import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameService } from '../src/services/game.service.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { closeDb } from '../src/db/index.js';

describe('Game Concurrency and ID Allocation', () => {
  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('allocates strictly unique IDs (1..37) and forms (1..37) for 37 concurrent joins', async () => {
    const game = await GameService.createGame({ title: 'Тест 37 учеников' });
    expect(game.code).toMatch(/^[2-9A-Z]{5}$/);

    // 37 simultaneous student join requests
    const joinPromises = Array.from({ length: 37 }, (_, i) =>
      GameService.joinGame({
        gameCode: game.code,
        firstName: `Ученик_${i + 1}`,
        lastName: `Тестовый_${i + 1}`,
      })
    );

    const results = await Promise.all(joinPromises);
    expect(results).toHaveLength(37);

    const assignedIds = results.map((r) => r.studentId);
    const assignedForms = results.map((r) => r.formId);

    // 1. All 37 IDs must be unique
    const uniqueIds = new Set(assignedIds);
    expect(uniqueIds.size).toBe(37);

    // 2. All 37 IDs must be within 1..37
    const sortedIds = [...assignedIds].sort((a, b) => a - b);
    expect(sortedIds).toEqual(Array.from({ length: 37 }, (_, i) => i + 1));

    // 3. Form ID must strictly match Student ID for every student
    for (const r of results) {
      expect(r.formId).toBe(r.studentId);
      expect(r.status).toBe('READY');
      expect(r.sessionToken).toBeDefined();
    }
  });

  it('handles room capacity limit of 50 and rejects the 51st student', async () => {
    const game = await GameService.createGame({ title: 'Тест лимита 50' });

    // Join 50 students
    for (let i = 1; i <= 50; i++) {
      const res = await GameService.joinGame({
        gameCode: game.code,
        firstName: `Студент_${i}`,
        lastName: `Фамилия_${i}`,
      });
      expect(res.studentId).toBe(i);
      expect(res.formId).toBe(i);
    }

    // Attempt 51st student join
    await expect(
      GameService.joinGame({
        gameCode: game.code,
        firstName: 'Лишний',
        lastName: 'Ученик',
      })
    ).rejects.toThrow(/Все доступные места заняты/);
  });

  it('restores existing student session without creating new ID on page refresh', async () => {
    const game = await GameService.createGame({ title: 'Тест сессии' });

    // First join
    const join1 = await GameService.joinGame({
      gameCode: game.code,
      firstName: 'Иван',
      lastName: 'Иванов',
    });
    expect(join1.studentId).toBe(1);
    expect(join1.isReconnection).toBe(false);

    // Refresh simulation: rejoin with same session token
    const join2 = await GameService.joinGame({
      gameCode: game.code,
      firstName: 'Иван',
      lastName: 'Иванов',
      existingSessionToken: join1.sessionToken,
    });

    expect(join2.studentId).toBe(1);
    expect(join2.formId).toBe(1);
    expect(join2.isReconnection).toBe(true);
    expect(join2.sessionToken).toBe(join1.sessionToken);
  });
});
