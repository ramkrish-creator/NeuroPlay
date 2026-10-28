import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Pool, type PoolClient } from 'pg';

const PORT = Number(process.env.PORT ?? 3001);
const SESSION_DAYS = 14;
const COOKIE_NAME = 'neuroplay_session';
const PASSWORD_MIN_LENGTH = 12;
const BCRYPT_ROUNDS = 12;
const DEFAULT_DIFFICULTY = {
  'word-recall': 1,
  'pattern-recall': 1,
  'scene-memory': 1,
  'focus-finder': 1,
  'sequence-master': 1,
  'rule-switch': 1,
  'quick-response': 1,
};
const GAME_IDS = Object.keys(DEFAULT_DIFFICULTY);
const GAME_FOR_DOMAIN: Record<string, string | null> = {
  verbalMemory: 'word-recall',
  visualMemory: 'pattern-recall',
  episodicMemory: 'scene-memory',
  attention: 'focus-finder',
  workingMemory: 'sequence-master',
  processingSpeed: 'quick-response',
  cognitiveFlexibility: 'rule-switch',
  executiveFunction: null,
};
const AGE_GROUPS = ['18-39', '40-59', '60-74', '75+'];
const GOALS = ['memory', 'attention', 'overall'];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'player';
  displayName: string;
  ageGroup: string;
  goal: string;
  avatarColor: string;
  createdAt: string;
  mustChangePassword: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
    sessionTokenHash?: string;
  }
}

interface LegacyProfile {
  id: string;
  name: string;
  ageGroup?: string;
  goal?: string;
  createdAt?: string;
  avatarColor?: string;
}

interface LegacyImportUser {
  profile: LegacyProfile;
  sessions: unknown[];
  difficulty?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
    ? value.trim()
    : null;
}

function normalizeDifficulty(value: unknown) {
  const difficulty: Record<string, number> = { ...DEFAULT_DIFFICULTY };
  if (!isRecord(value)) return difficulty;
  for (const gameId of GAME_IDS) {
    const level = value[gameId];
    if (Number.isInteger(level) && Number(level) >= 1 && Number(level) <= 5) difficulty[gameId] = Number(level);
  }
  return difficulty;
}

function setSessionCookie(response: Response, token: string) {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    username: String(row.username),
    role: row.role === 'admin' ? 'admin' : 'player',
    displayName: String(row.display_name),
    ageGroup: String(row.age_group),
    goal: String(row.goal),
    avatarColor: String(row.avatar_color),
    createdAt: new Date(String(row.created_at)).toISOString(),
    mustChangePassword: Boolean(row.must_change_password),
  };
}

function validSession(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (!stringField(value.id, 100) || !stringField(value.gameId, 40)) return false;
  if (!stringField(value.domain, 50) || typeof value.date !== 'string' || Number.isNaN(Date.parse(value.date))) return false;
  if (!Array.isArray(value.trials) || value.trials.length > 1000) return false;
  if (typeof value.accuracy !== 'number' || value.accuracy < 0 || value.accuracy > 100) return false;
  if (value.avgReactionMs !== null && (typeof value.avgReactionMs !== 'number' || value.avgReactionMs < 0)) return false;
  if (![value.difficultyStart, value.difficultyEnd].every((n) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 5)) return false;
  if (typeof value.score !== 'number' || value.score < 0 || value.score > 100) return false;
  if (typeof value.fatigueLevel !== 'number' || value.fatigueLevel < 0 || value.fatigueLevel > 100) return false;
  return value.trials.every((trial: unknown) =>
    isRecord(trial)
    && typeof trial.correct === 'boolean'
    && (trial.reactionTimeMs === null || (typeof trial.reactionTimeMs === 'number' && trial.reactionTimeMs >= 0))
    && Number.isInteger(trial.difficulty)
    && Number(trial.difficulty) >= 1
    && Number(trial.difficulty) <= 5
    && typeof trial.timestamp === 'number'
    && Number.isFinite(trial.timestamp));
}

function recommendationFor(sessions: Record<string, unknown>[]): string[] {
  const scores = new Map<string, number[]>();
  for (const session of sessions) {
    const domain = stringField(session.domain, 50);
    const score = session.score;
    if (domain && typeof score === 'number' && Number.isFinite(score) && GAME_FOR_DOMAIN[domain]) {
      scores.set(domain, [...(scores.get(domain) ?? []), score]);
    }
  }

  const domains = Object.keys(GAME_FOR_DOMAIN).filter((domain) => GAME_FOR_DOMAIN[domain]);
  domains.sort((a, b) => {
    const scoresA = scores.get(a) ?? [];
    const scoresB = scores.get(b) ?? [];
    const averageA = scoresA.length ? scoresA.reduce((sum, score) => sum + score, 0) / scoresA.length : 50;
    const averageB = scoresB.length ? scoresB.reduce((sum, score) => sum + score, 0) / scoresB.length : 50;
    return averageA - averageB;
  });
  return domains.slice(0, 3).map((domain) => GAME_FOR_DOMAIN[domain] as string);
}

async function loadUserData(user: AuthUser) {
  const [sessionsResult, userResult] = await Promise.all([
    pool.query('SELECT result FROM training_sessions WHERE user_id = $1 ORDER BY played_at DESC LIMIT 200', [user.id]),
    pool.query('SELECT difficulty FROM users WHERE id = $1', [user.id]),
  ]);
  const sessions = sessionsResult.rows.map((row) => row.result as Record<string, unknown>);
  return {
    profile: user,
    sessions,
    difficultyByGame: { ...DEFAULT_DIFFICULTY, ...(userResult.rows[0]?.difficulty ?? {}) },
    recommendedGameIds: recommendationFor(sessions),
  };
}

function requireAuth(request: Request, response: Response, next: NextFunction) {
  if (!request.authUser) {
    response.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  next();
}

function requirePasswordUpdated(request: Request, response: Response, next: NextFunction) {
  if (request.authUser?.mustChangePassword) {
    response.status(403).json({ error: 'Change your temporary password before continuing.' });
    return;
  }
  next();
}

function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (request.authUser?.role !== 'admin') {
    response.status(403).json({ error: 'Administrator access is required.' });
    return;
  }
  next();
}

function normalizedUsername(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 24);
  return normalized || 'player';
}

function temporaryPassword(): string {
  return randomBytes(15).toString('base64url');
}

async function insertLegacyUser(client: PoolClient, legacyUser: LegacyImportUser, reservedUsernames: Set<string>) {
  const profile = legacyUser.profile;
  const base = normalizedUsername(profile.name);
  let username = base;
  let suffix = 1;
  while (reservedUsernames.has(username)) {
    username = `${base.slice(0, 21)}.${suffix++}`;
  }
  reservedUsernames.add(username);

  const password = temporaryPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const ageGroup = AGE_GROUPS.includes(profile.ageGroup ?? '') ? profile.ageGroup : '40-59';
  const goal = GOALS.includes(profile.goal ?? '') ? profile.goal : 'overall';
  const avatarColor = typeof profile.avatarColor === 'string' && /^#[0-9a-f]{6}$/i.test(profile.avatarColor)
    ? profile.avatarColor
    : '#2dd4bf';
  const createdAt = typeof profile.createdAt === 'string' && !Number.isNaN(Date.parse(profile.createdAt))
    ? profile.createdAt
    : null;
  const inserted = await client.query(
    `INSERT INTO users (username, password_hash, role, display_name, age_group, goal, avatar_color,
      difficulty, must_change_password, legacy_profile_id, created_at)
     VALUES ($1, $2, 'player', $3, $4, $5, $6, $7, TRUE, $8, COALESCE($9::timestamptz, NOW()))
     ON CONFLICT (legacy_profile_id) DO NOTHING
     RETURNING id`,
    [
      username,
      passwordHash,
      profile.name.trim(),
      ageGroup,
      goal,
      avatarColor,
      JSON.stringify(normalizeDifficulty(legacyUser.difficulty)),
      profile.id,
      createdAt,
    ],
  );
  if (!inserted.rowCount) return null;

  for (const session of legacyUser.sessions) {
    if (!validSession(session)) continue;
    await client.query(
      `INSERT INTO training_sessions (user_id, id, game_id, played_at, result)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, id) DO NOTHING`,
      [inserted.rows[0].id, session.id, session.gameId, session.date, JSON.stringify(session)],
    );
  }

  return { username, password, displayName: profile.name };
}

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured.');
  const adminUsername = stringField(process.env.ADMIN_USERNAME, 64)?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword || adminPassword.length < PASSWORD_MIN_LENGTH || Buffer.byteLength(adminPassword, 'utf8') > 72) {
    throw new Error(`ADMIN_USERNAME and ADMIN_PASSWORD (${PASSWORD_MIN_LENGTH}-72 UTF-8 bytes) must be configured.`);
  }
  if (!/^[a-z0-9._-]{3,64}$/i.test(adminUsername)) {
    throw new Error('ADMIN_USERNAME must be 3-64 letters, numbers, dots, underscores, or hyphens.');
  }

  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  const schemaPath = fileURLToPath(new URL('../server/schema.sql', import.meta.url));
  await pool.query(await readFile(schemaPath, 'utf8'));
  await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');

  const adminHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
  await pool.query(
    `INSERT INTO users (username, password_hash, role, display_name, age_group, goal)
     VALUES ($1, $2, 'admin', $1, '40-59', 'overall')
     ON CONFLICT (username) DO NOTHING`,
    [adminUsername, adminHash],
  );
  const configuredAdmin = await pool.query('SELECT role FROM users WHERE username = $1', [adminUsername]);
  if (configuredAdmin.rows[0]?.role !== 'admin') {
    throw new Error('ADMIN_USERNAME is already assigned to a non-administrator account.');
  }

  const dummyHash = await bcrypt.hash('invalid-password-padding', BCRYPT_ROUNDS);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));
  app.use((request, response, next) => {
    if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.get('origin');
      const expectedOrigin = process.env.APP_ORIGIN;
      let allowedOrigin = false;
      try {
        allowedOrigin = Boolean(origin && (
          expectedOrigin
            ? origin === expectedOrigin
            : new URL(origin).host === request.get('host')
        ));
      } catch {
        allowedOrigin = false;
      }
      if (!allowedOrigin) {
        response.status(403).json({ error: 'A same-origin request is required.' });
        return;
      }
    }
    next();
  });
  app.use(async (request, _response, next) => {
    const token = readSessionToken(request);
    if (!token) {
      next();
      return;
    }
    try {
      const result = await pool.query(
        `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [hashToken(token)],
      );
      if (result.rows[0]) {
        request.authUser = safeUser(result.rows[0]);
        request.sessionTokenHash = hashToken(token);
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

  app.post('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }), async (request, response, next) => {
    try {
      const username = stringField(request.body?.username, 64)?.toLowerCase();
      const password = typeof request.body?.password === 'string' ? request.body.password : '';
      if (!username || !password || Buffer.byteLength(password, 'utf8') > 72) {
        response.status(400).json({ error: 'Enter a username and password.' });
        return;
      }
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = result.rows[0];
      const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
      if (!user || !passwordMatches) {
        response.status(401).json({ error: 'Incorrect username or password.' });
        return;
      }

      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      await pool.query('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
        hashToken(token), user.id, expiresAt,
      ]);
      setSessionCookie(response, token);
      response.json({ user: safeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/me', requireAuth, (request, response) => {
    response.json({ user: request.authUser });
  });

  app.post('/api/auth/logout', requireAuth, async (request, response, next) => {
    try {
      if (request.sessionTokenHash) {
        await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [request.sessionTokenHash]);
      }
      response.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api' });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (request, response, next) => {
    try {
      const password = request.body?.password;
      if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || Buffer.byteLength(password, 'utf8') > 72) {
        response.status(400).json({ error: `Password must be ${PASSWORD_MIN_LENGTH}-72 UTF-8 bytes.` });
        return;
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await pool.query('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [
        passwordHash, request.authUser!.id,
      ]);
      await pool.query('DELETE FROM auth_sessions WHERE user_id = $1 AND token_hash <> $2', [
        request.authUser!.id, request.sessionTokenHash,
      ]);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/me/data', requireAuth, requirePasswordUpdated, async (request, response, next) => {
    try {
      response.json(await loadUserData(request.authUser!));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/me/profile', requireAuth, requirePasswordUpdated, async (request, response, next) => {
    try {
      const displayName = stringField(request.body?.displayName, 100);
      const ageGroup = stringField(request.body?.ageGroup, 10);
      const goal = stringField(request.body?.goal, 30);
      if (!displayName || !ageGroup || !AGE_GROUPS.includes(ageGroup) || !goal || !GOALS.includes(goal)) {
        response.status(400).json({ error: 'Profile details are invalid.' });
        return;
      }
      await pool.query('UPDATE users SET display_name = $1, age_group = $2, goal = $3 WHERE id = $4', [
        displayName, ageGroup, goal, request.authUser!.id,
      ]);
      response.json(await loadUserData({ ...request.authUser!, displayName, ageGroup, goal }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/me/sessions', requireAuth, requirePasswordUpdated, async (request, response, next) => {
    try {
      const session = request.body?.session;
      if (!validSession(session)) {
        response.status(400).json({ error: 'Training session data is invalid.' });
        return;
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO training_sessions (user_id, id, game_id, played_at, result)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, id) DO UPDATE SET result = EXCLUDED.result, played_at = EXCLUDED.played_at`,
          [request.authUser!.id, session.id, session.gameId, session.date, JSON.stringify(session)],
        );
        const difficulty = normalizeDifficulty(request.body?.difficultyByGame);
        await client.query('UPDATE users SET difficulty = $1 WHERE id = $2', [JSON.stringify(difficulty), request.authUser!.id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      response.status(201).json(await loadUserData(request.authUser!));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/me/sessions', requireAuth, requirePasswordUpdated, async (request, response, next) => {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM training_sessions WHERE user_id = $1', [request.authUser!.id]);
        await client.query('UPDATE users SET difficulty = $1 WHERE id = $2', [
          JSON.stringify(DEFAULT_DIFFICULTY), request.authUser!.id,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/users', requireAuth, requirePasswordUpdated, requireAdmin, async (_request, response, next) => {
    try {
      const result = await pool.query(
        `SELECT u.id, u.username, u.role, u.display_name, u.age_group, u.goal, u.avatar_color, u.created_at,
          (SELECT COUNT(*)::int FROM training_sessions s WHERE s.user_id = u.id) AS session_count
         FROM users u ORDER BY u.created_at`,
      );
      response.json({
        users: result.rows.map((row) => ({
          id: String(row.id),
          username: String(row.username),
          role: row.role,
          displayName: String(row.display_name),
          ageGroup: String(row.age_group),
          goal: String(row.goal),
          avatarColor: String(row.avatar_color),
          createdAt: new Date(String(row.created_at)).toISOString(),
          sessionCount: Number(row.session_count),
          mustChangePassword: Boolean(row.must_change_password),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/users', requireAuth, requirePasswordUpdated, requireAdmin, async (request, response, next) => {
    try {
      const username = stringField(request.body?.username, 64)?.toLowerCase();
      const displayName = stringField(request.body?.displayName, 100);
      const ageGroup = stringField(request.body?.ageGroup, 10);
      const goal = stringField(request.body?.goal, 30);
      if (!username || !/^[a-z0-9._-]{3,64}$/.test(username)
        || !displayName || !ageGroup || !AGE_GROUPS.includes(ageGroup)
        || !goal || !GOALS.includes(goal)) {
        response.status(400).json({ error: 'Enter a valid username, display name, age group, and training goal.' });
        return;
      }
      const password = temporaryPassword();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, role, display_name, age_group, goal, must_change_password)
         VALUES ($1, $2, 'player', $3, $4, $5, TRUE)
         RETURNING id, username, role, display_name, age_group, goal, avatar_color, created_at, must_change_password`,
        [username, passwordHash, displayName, ageGroup, goal],
      );
      response.status(201).json({ user: safeUser(result.rows[0]), temporaryPassword: password });
    } catch (error) {
      if (isRecord(error) && error.code === '23505') {
        response.status(409).json({ error: 'That username is already in use.' });
        return;
      }
      next(error);
    }
  });

  app.post('/api/admin/users/:userId/reset-password', requireAuth, requirePasswordUpdated, requireAdmin, async (request, response, next) => {
    try {
      const password = temporaryPassword();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await pool.query(
        `UPDATE users SET password_hash = $1, must_change_password = TRUE
         WHERE id = $2 AND role = 'player' RETURNING username, display_name`,
        [passwordHash, request.params.userId],
      );
      if (!result.rowCount) {
        response.status(404).json({ error: 'Player account not found.' });
        return;
      }
      await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [request.params.userId]);
      response.json({
        username: result.rows[0].username,
        displayName: result.rows[0].display_name,
        temporaryPassword: password,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/import-legacy', requireAuth, requirePasswordUpdated, requireAdmin, async (request, response, next) => {
    try {
      const users = request.body?.users;
      if (!Array.isArray(users) || users.length > 100) {
        response.status(400).json({ error: 'Import must contain up to 100 legacy profiles.' });
        return;
      }
      const legacyUsers: LegacyImportUser[] = [];
      let totalSessions = 0;
      for (const item of users) {
        if (!isRecord(item) || !isRecord(item.profile)) {
          response.status(400).json({ error: 'Legacy profile data is invalid.' });
          return;
        }
        const profile = item.profile;
        if (!stringField(profile.id, 100) || !stringField(profile.name, 100)) {
          response.status(400).json({ error: 'Each legacy profile must have an ID and name.' });
          return;
        }
        const sessions = Array.isArray(item.sessions) ? item.sessions : [];
        totalSessions += sessions.length;
        if (totalSessions > 20_000 || sessions.some((session) => !validSession(session))) {
          response.status(400).json({ error: 'Legacy session data is invalid or too large.' });
          return;
        }
        legacyUsers.push({
          profile: profile as unknown as LegacyProfile,
          sessions,
          difficulty: isRecord(item.difficulty) ? item.difficulty : DEFAULT_DIFFICULTY,
        });
      }

      const client = await pool.connect();
      const credentials: { username: string; password: string; displayName: string }[] = [];
      try {
        await client.query('BEGIN');
        const usernames = await client.query<{ username: string }>('SELECT username FROM users');
        const reservedUsernames = new Set(usernames.rows.map((row) => row.username));
        for (const legacyUser of legacyUsers) {
          const credential = await insertLegacyUser(client, legacyUser, reservedUsernames);
          if (credential) credentials.push(credential);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      response.status(201).json({ imported: credentials.length, credentials });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    console.error('[api] Request failed:', error);
    if (response.headersSent) {
      next(error);
      return;
    }
    response.status(500).json({ error: 'The server could not complete the request.' });
  });

  app.listen(PORT, () => console.info(`NeuroPlay API listening on port ${PORT}.`));
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start NeuroPlay API:', error);
  process.exitCode = 1;
});
