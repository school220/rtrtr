import { getDb } from '../db/index.js';

export type GameEventType =
  | 'STUDENT_JOINED'
  | 'STUDENT_RECONNECTED'
  | 'STUDENT_DISCONNECTED'
  | 'PAGE_HIDDEN'
  | 'FULLSCREEN_EXIT'
  | 'TEST_STARTED'
  | 'QUESTION_ANSWERED'
  | 'TEST_FINISHED'
  | 'TIME_EXPIRED';

export class EventService {
  /**
   * Records a security or lifecycle game event
   */
  public static async logEvent(
    gameId: string,
    studentId: number | null,
    eventType: GameEventType | string,
    metadata: Record<string, any> = {},
    dbClient?: any
  ): Promise<void> {
    try {
      const db = dbClient || (await getDb());
      await db.query(
        `INSERT INTO game_events (game_id, student_id, event_type, metadata, timestamp)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [gameId, studentId, eventType, JSON.stringify(metadata)]
      );
    } catch (err) {
      console.error('Failed to log game event:', err);
    }
  }

  /**
   * Retrieves security incident counts per student in a game
   */
  public static async getStudentSecuritySummary(gameId: string): Promise<Record<number, { pageHidden: number; fullscreenExit: number; disconnected: number; totalSuspicious: number }>> {
    const db = await getDb();
    const res = await db.query(
      `SELECT student_id, event_type, COUNT(*) as count
       FROM game_events
       WHERE game_id = $1 AND student_id IS NOT NULL
       GROUP BY student_id, event_type`,
      [gameId]
    );

    const summary: Record<number, { pageHidden: number; fullscreenExit: number; disconnected: number; totalSuspicious: number }> = {};

    for (const row of res.rows) {
      const sid = parseInt(row.student_id, 10);
      if (!summary[sid]) {
        summary[sid] = { pageHidden: 0, fullscreenExit: 0, disconnected: 0, totalSuspicious: 0 };
      }
      const cnt = parseInt(row.count, 10);
      if (row.event_type === 'PAGE_HIDDEN') {
        summary[sid].pageHidden += cnt;
        summary[sid].totalSuspicious += cnt;
      } else if (row.event_type === 'FULLSCREEN_EXIT') {
        summary[sid].fullscreenExit += cnt;
        summary[sid].totalSuspicious += cnt;
      } else if (row.event_type === 'STUDENT_DISCONNECTED') {
        summary[sid].disconnected += cnt;
      }
    }

    return summary;
  }
}
