import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';

// Same in-memory-DB setup as tests/api.test.ts (see that file for why this has
// to be a dynamic import). Kept in its own file, each test building its own
// `createApp()` instance, because express-rate-limit's in-memory store is
// per-app and cumulative across a file's whole test run — sharing one app
// with tests/api.test.ts's dozens of signup/login calls would trip these
// limiters partway through unrelated tests.
process.env.BIQ_DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key-for-vitest-only';

const { createApp } = await import('../server.ts');
const { db } = await import('../db.ts');

beforeEach(() => {
  db.prepare('DELETE FROM refresh_tokens').run();
  db.prepare('DELETE FROM restaurants').run();
});

describe('auth rate limiting (POST /api/auth/login, /api/auth/signup)', () => {
  test('6th rapid login attempt from the same source in the window is blocked with 429', async () => {
    const app = createApp(); // production defaults: 5 attempts / 15 min, shared across login+signup

    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(await request(app).post('/api/auth/login').send({ email: 'nobody@cafe.test', password: 'wrong' }));
    }

    const first5 = attempts.slice(0, 5);
    const sixth = attempts[5];

    for (const res of first5) expect(res.status).not.toBe(429);
    expect(sixth.status).toBe(429);
    expect(sixth.body.error).toBe('Too many attempts, please try again in a few minutes');
    expect(sixth.headers).toHaveProperty('ratelimit-limit');
  });

  test('a single normal login is never affected by the limiter', async () => {
    const app = createApp();
    await request(app).post('/api/auth/signup').send({ name: 'Solo Cafe', email: 'solo@cafe.test', password: 'password123' });

    const res = await request(app).post('/api/auth/login').send({ email: 'solo@cafe.test', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(429);
  });

  test('signup and login share one budget — switching endpoints does not reset it', async () => {
    const app = createApp({ authLimiterMax: 3 });

    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send({ email: `x${i}@cafe.test`, password: 'wrong' });
    }
    const blockedSignup = await request(app).post('/api/auth/signup').send({ name: 'X', email: 'blocked@cafe.test', password: 'password123' });
    expect(blockedSignup.status).toBe(429);
  });
});

describe('general /api/* rate limiting', () => {
  test('requests beyond the general limit get 429; requests within it pass through', async () => {
    const app = createApp({ apiLimiterMax: 3, apiLimiterWindowMs: 60_000 });

    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await request(app).get('/api/import/status'));
    }

    expect(results.slice(0, 3).every(r => r.status !== 429)).toBe(true);
    expect(results[3].status).toBe(429);
  });

  test('createApp({ rateLimit: false }) disables both limiters entirely', async () => {
    const app = createApp({ rateLimit: false, authLimiterMax: 1 });
    const attempts = [];
    for (let i = 0; i < 5; i++) {
      attempts.push(await request(app).post('/api/auth/login').send({ email: 'nobody@cafe.test', password: 'wrong' }));
    }
    expect(attempts.every(r => r.status !== 429)).toBe(true);
  });
});
