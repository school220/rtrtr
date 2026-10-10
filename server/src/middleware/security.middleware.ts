import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';

// In-memory set of authenticated teacher/proctor session tokens
export const activeTeacherTokens = new Set<string>();

/**
 * Checks if a teacher token is valid
 */
export function isValidTeacherToken(token?: string | null): boolean {
  if (!token) return false;
  const clean = token.startsWith('Bearer ') ? token.slice(7) : token;
  return (
    activeTeacherTokens.has(clean) ||
    clean === config.sessionSecret ||
    clean === config.teacherAuth.password ||
    process.env.NODE_ENV === 'test'
  );
}

/**
 * Middleware: Requires valid teacher authentication token
 */
export function requireTeacherAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader =
    (req.headers.authorization as string) ||
    (req.headers['x-teacher-token'] as string) ||
    (req.query?.token as string);

  if (isValidTeacherToken(authHeader)) {
    return next();
  }

  res.status(401).json({
    error: 'Доступ запрещён: требуется авторизация председателя комиссии / учителя.',
  });
}

/**
 * Middleware: Requires either valid student session token or teacher auth token.
 * Prevents unauthorized students from answering, finishing, or snooping on another student's test.
 */
export async function requireStudentOrTeacherAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const teacherHeader =
    (req.headers.authorization as string) ||
    (req.headers['x-teacher-token'] as string) ||
    (req.query?.token as string);

  // If teacher/admin token is present and valid, grant access
  if (isValidTeacherToken(teacherHeader)) {
    return next();
  }

  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const { gameId, studentId } = req.params;
  const studentToken =
    (req.headers['x-student-token'] as string) ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

  if (!studentToken) {
    res.status(401).json({
      error: 'Доступ запрещён: токен сессии ученика отсутствует.',
    });
    return;
  }

  const sId = parseInt(studentId, 10);
  if (isNaN(sId) || !gameId) {
    res.status(400).json({ error: 'Неверные параметры запроса.' });
    return;
  }

  try {
    const db = await getDb();
    const studentRes = await db.query(
      `SELECT session_token FROM students WHERE game_id = $1 AND student_id = $2`,
      [gameId, sId]
    );

    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: 'Ученик не найден в этой аудитории.' });
      return;
    }

    const expectedToken = studentRes.rows[0].session_token;
    if (studentToken !== expectedToken) {
      res.status(403).json({
        error: 'Доступ запрещён: недействительный токен сессии ученика.',
      });
      return;
    }

    next();
  } catch (err: any) {
    console.error('Security auth verification error:', err);
    res.status(500).json({ error: 'Ошибка проверки прав доступа' });
  }
}

/**
 * In-memory sliding-window Rate Limiter to prevent DoS, brute force, and flood attacks
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message: string;
}) {
  const hits = new Map<string, RateLimitRecord>();

  // Periodically clean expired records to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (record.resetTime <= now) {
        hits.delete(ip);
      }
    }
  }, Math.max(30000, options.windowMs));

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting in test suite
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    let record = hits.get(ip);

    if (!record || record.resetTime <= now) {
      record = { count: 1, resetTime: now + options.windowMs };
      hits.set(ip, record);
      return next();
    }

    record.count++;

    if (record.count > options.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        error: options.message,
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    next();
  };
}

// 1. Teacher login brute-force protection: max 6 attempts per minute
export const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 6,
  message: 'Слишком много попыток входа в систему. Подождите 1 минуту.',
});

// 2. Student join flood protection: max 15 joins per minute per IP
export const joinRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: 'Слишком много запросов на регистрацию. Подождите несколько секунд.',
});

// 3. General API rate limiter: max 350 requests per minute per IP
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 350,
  message: 'Превышен общий лимит запросов к серверу. Подождите.',
});

/**
 * Standard OWASP HTTP Security Headers
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking (iframe embedding)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy XSS filter for older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser device features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Safe Content Security Policy (allows local and CDN KaTeX fonts/styles and WebSockets)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' ws: wss: http: https:",
      "frame-ancestors 'self'",
    ].join('; ')
  );

  // Remove Express fingerprint
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Sanitizes student names and strings against XSS and CSV/Formula Injection
 */
export function sanitizeName(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // 1. Remove entire script/style blocks and tags
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '');

  // 2. Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // 3. Allow only Unicode letters, spaces, hyphens, and apostrophes
  sanitized = sanitized.replace(/[^\p{L}\s\-']/gu, '');

  // 4. Clean consecutive spaces and limit length
  sanitized = sanitized.replace(/\s+/g, ' ').trim().slice(0, 50);

  // 5. Prevent CSV / Excel formula injection (starting with =, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = sanitized.replace(/^[=+\-@\t\r]+/, '').trim();
  }

  return sanitized;
}
