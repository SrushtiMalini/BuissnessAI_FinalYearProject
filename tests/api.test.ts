import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';

// Static `import` declarations are hoisted above any other top-level code in an ESM
// module — so setting process.env here would run AFTER server.ts (and, transitively,
// db.ts, which opens its DB connection at module-load time) had already been imported
// if we used a static import. A dynamic import() is a real expression, evaluated in
// place, so this ordering actually holds: every test in this file runs against a
// private in-memory SQLite instance, never the real dev database file.
process.env.BIQ_DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key-for-vitest-only';

const { createApp, requireAuth } = await import('../server.ts');
const { db } = await import('../db.ts');

const app = createApp();
// A minimal route mounted purely for tests, so we can exercise the real requireAuth
// middleware end-to-end (no /api/* route in server.ts is unauthenticated+identity-only).
app.get('/api/_test/whoami', requireAuth, (req: any, res) => res.json({ restaurantId: req.restaurantId }));

beforeEach(() => {
  // Child table first — billing_entries.restaurant_id has a FOREIGN KEY on restaurants(id).
  db.prepare('DELETE FROM billing_entries').run();
  db.prepare('DELETE FROM restaurants').run();
});

async function signup(email: string, name = 'Test Cafe', password = 'password123') {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password });
  return res;
}

describe('POST /api/auth/signup + /api/auth/login', () => {
  test('signup returns a token and restaurantId; that token authenticates further requests', async () => {
    const res = await signup('owner@cafe.test');
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.restaurantId).toEqual(expect.any(String));

    const who = await request(app).get('/api/_test/whoami').set('Authorization', `Bearer ${res.body.token}`);
    expect(who.status).toBe(200);
    expect(who.body.restaurantId).toBe(res.body.restaurantId);
  });

  test('login with the correct password returns a valid JWT', async () => {
    await signup('owner2@cafe.test', 'Cafe Two', 'password123');
    const res = await request(app).post('/api/auth/login').send({ email: 'owner2@cafe.test', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));

    const who = await request(app).get('/api/_test/whoami').set('Authorization', `Bearer ${res.body.token}`);
    expect(who.status).toBe(200);
  });

  test('login with the wrong password is rejected', async () => {
    await signup('owner3@cafe.test', 'Cafe Three', 'password123');
    const res = await request(app).post('/api/auth/login').send({ email: 'owner3@cafe.test', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  test('signing up twice with the same email is rejected (409)', async () => {
    await signup('dup@cafe.test');
    const res = await signup('dup@cafe.test');
    expect(res.status).toBe(409);
  });
});

describe('requireAuth — protected routes reject missing/invalid tokens', () => {
  test('no Authorization header -> 401', async () => {
    const res = await request(app).get('/api/billing');
    expect(res.status).toBe(401);
  });

  test('garbage bearer token -> 401', async () => {
    const res = await request(app).get('/api/billing').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('GET/POST /api/billing — tenant isolation', () => {
  test('two different restaurant accounts each only ever see their own billing rows', async () => {
    const a = await signup('tenant-a@cafe.test');
    const b = await signup('tenant-b@cafe.test');
    const tokenA = a.body.token;
    const tokenB = b.body.token;

    await request(app).post('/api/billing').set('Authorization', `Bearer ${tokenA}`)
      .send([{ id: '1', date: '2026-08-01', dishName: 'A-Dish', quantity: 1, sellingPrice: 100 }]);
    await request(app).post('/api/billing').set('Authorization', `Bearer ${tokenB}`)
      .send([{ id: '2', date: '2026-08-01', dishName: 'B-Dish', quantity: 1, sellingPrice: 200 }]);

    const billingA = await request(app).get('/api/billing').set('Authorization', `Bearer ${tokenA}`);
    const billingB = await request(app).get('/api/billing').set('Authorization', `Bearer ${tokenB}`);

    expect(billingA.body).toHaveLength(1);
    expect(billingA.body[0].dishName).toBe('A-Dish');
    expect(billingB.body).toHaveLength(1);
    expect(billingB.body[0].dishName).toBe('B-Dish');
  });
});

describe('POST /api/billing — append + dedupe', () => {
  test('posting the same rows twice adds them only once (added=0 the second time)', async () => {
    const signupRes = await signup('dedupe@cafe.test');
    const token = signupRes.body.token;
    const rows = [
      { id: '1', date: '2026-08-01', time: '12:00', dishName: 'Dal Fry', quantity: 2, sellingPrice: 100 },
      { id: '2', date: '2026-08-01', time: '13:00', dishName: 'Rice', quantity: 1, sellingPrice: 50 },
    ];

    const first = await request(app).post('/api/billing').set('Authorization', `Bearer ${token}`).send(rows);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ added: 2, total: 2 });

    const second = await request(app).post('/api/billing').set('Authorization', `Bearer ${token}`).send(rows);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ added: 0, total: 2 });

    const listing = await request(app).get('/api/billing').set('Authorization', `Bearer ${token}`);
    expect(listing.body).toHaveLength(2);
  });
});
