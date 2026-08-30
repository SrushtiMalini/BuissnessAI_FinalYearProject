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

// Rate limiting is covered by its own dedicated tests (tests/rateLimit.test.ts),
// which construct their own small-budget apps. This shared app makes dozens of
// signup/login calls across the file, so it opts out — otherwise the strict
// auth limiter would start rejecting unrelated tests partway through the run.
const app = createApp({ rateLimit: false });
// A minimal route mounted purely for tests, so we can exercise the real requireAuth
// middleware end-to-end (no /api/* route in server.ts is unauthenticated+identity-only).
app.get('/api/_test/whoami', requireAuth, (req: any, res) => res.json({ restaurantId: req.restaurantId }));

beforeEach(() => {
  // Child tables first — each has a FOREIGN KEY on restaurants(id).
  db.prepare('DELETE FROM billing_entries').run();
  db.prepare('DELETE FROM menu_items').run();
  db.prepare('DELETE FROM forecast_accuracy').run();
  db.prepare('DELETE FROM refresh_tokens').run();
  db.prepare('DELETE FROM restaurant_profile').run();
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
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.restaurantId).toEqual(expect.any(String));

    const who = await request(app).get('/api/_test/whoami').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(who.status).toBe(200);
    expect(who.body.restaurantId).toBe(res.body.restaurantId);
  });

  test('login with the correct password returns a valid JWT', async () => {
    await signup('owner2@cafe.test', 'Cafe Two', 'password123');
    const res = await request(app).post('/api/auth/login').send({ email: 'owner2@cafe.test', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));

    const who = await request(app).get('/api/_test/whoami').set('Authorization', `Bearer ${res.body.accessToken}`);
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
    const tokenA = a.body.accessToken;
    const tokenB = b.body.accessToken;

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
    const token = signupRes.body.accessToken;
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

describe('POST/GET /api/forecast-accuracy — insert, backfill, and aggregation', () => {
  test('inserts predictions with null actuals, then backfilling computes absolute_error and shows up in the aggregated series', async () => {
    const signupRes = await signup('forecast@cafe.test');
    const token = signupRes.body.accessToken;
    const auth = (req: any) => req.set('Authorization', `Bearer ${token}`);

    const insertRes = await auth(request(app).post('/api/forecast-accuracy')).send({
      inserts: [
        { date: '2026-08-10', dishName: 'Dal Fry', predictedValue: 20 },
        { date: '2026-08-11', dishName: 'Dal Fry', predictedValue: 22 },
      ],
      updates: [],
    });
    expect(insertRes.status).toBe(200);

    const rawAfterInsert = await auth(request(app).get('/api/forecast-accuracy/raw'));
    expect(rawAfterInsert.body).toHaveLength(2);
    expect(rawAfterInsert.body.every((r: any) => r.actualValue === null)).toBe(true);

    const seriesBeforeBackfill = await auth(request(app).get('/api/forecast-accuracy'));
    expect(seriesBeforeBackfill.body).toEqual([]); // nothing resolved yet

    const target = rawAfterInsert.body.find((r: any) => r.date === '2026-08-10');
    const backfillRes = await auth(request(app).post('/api/forecast-accuracy')).send({
      inserts: [],
      updates: [{ id: target.id, actualValue: 25, absoluteError: 5 }],
    });
    expect(backfillRes.status).toBe(200);

    const seriesAfterBackfill = await auth(request(app).get('/api/forecast-accuracy'));
    expect(seriesAfterBackfill.body).toEqual([{ date: '2026-08-10', mae: 5 }]);

    const rawAfterBackfill = await auth(request(app).get('/api/forecast-accuracy/raw'));
    const resolved = rawAfterBackfill.body.find((r: any) => r.id === target.id);
    expect(resolved.actualValue).toBe(25);
    expect(resolved.absoluteError).toBe(5);
    const stillPending = rawAfterBackfill.body.find((r: any) => r.date === '2026-08-11');
    expect(stillPending.actualValue).toBeNull();
  });

  test('two restaurants never see each other\'s forecast accuracy rows', async () => {
    const a = await signup('forecast-a@cafe.test');
    const b = await signup('forecast-b@cafe.test');

    await request(app).post('/api/forecast-accuracy').set('Authorization', `Bearer ${a.body.accessToken}`)
      .send({ inserts: [{ date: '2026-08-10', dishName: 'A-Dish', predictedValue: 10 }], updates: [] });
    await request(app).post('/api/forecast-accuracy').set('Authorization', `Bearer ${b.body.accessToken}`)
      .send({ inserts: [{ date: '2026-08-10', dishName: 'B-Dish', predictedValue: 10 }], updates: [] });

    const rawA = await request(app).get('/api/forecast-accuracy/raw').set('Authorization', `Bearer ${a.body.accessToken}`);
    expect(rawA.body).toHaveLength(1);
    expect(rawA.body[0].dishName).toBe('A-Dish');
  });
});

describe('GET/PUT /api/restaurant-profile — server-backed onboarding state', () => {
  test('a fresh account has no profile yet (null, not 404/error)', async () => {
    const signupRes = await signup('profile-fresh@cafe.test');
    const res = await request(app).get('/api/restaurant-profile').set('Authorization', `Bearer ${signupRes.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test('PUT saves the profile; a subsequent GET (simulating a fresh device/session) returns it', async () => {
    const signupRes = await signup('profile-save@cafe.test');
    const token = signupRes.body.accessToken;
    const profile = { name: 'Test Cafe', ownerName: 'Owner', city: 'Bengaluru', cuisine: 'North Indian',
      establishmentType: 'cafe', daysOpenPerWeek: 7, mealPeriods: ['lunch', 'dinner'], trackingMethod: 'manual', priorities: ['all'] };

    const putRes = await request(app).put('/api/restaurant-profile').set('Authorization', `Bearer ${token}`).send(profile);
    expect(putRes.status).toBe(200);

    const getRes = await request(app).get('/api/restaurant-profile').set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(profile);
  });

  test('PUT again (re-onboarding never happens, but editing the profile does) overwrites the existing row rather than erroring', async () => {
    const signupRes = await signup('profile-overwrite@cafe.test');
    const token = signupRes.body.accessToken;
    await request(app).put('/api/restaurant-profile').set('Authorization', `Bearer ${token}`).send({ name: 'First' });
    const secondPut = await request(app).put('/api/restaurant-profile').set('Authorization', `Bearer ${token}`).send({ name: 'Second' });
    expect(secondPut.status).toBe(200);

    const getRes = await request(app).get('/api/restaurant-profile').set('Authorization', `Bearer ${token}`);
    expect(getRes.body).toEqual({ name: 'Second' });
  });

  test('two restaurants never see each other\'s profile', async () => {
    const a = await signup('profile-a@cafe.test');
    const b = await signup('profile-b@cafe.test');
    await request(app).put('/api/restaurant-profile').set('Authorization', `Bearer ${a.body.accessToken}`).send({ name: 'A Cafe' });

    const bProfile = await request(app).get('/api/restaurant-profile').set('Authorization', `Bearer ${b.body.accessToken}`);
    expect(bProfile.body).toBeNull();
  });

  test('unauthenticated requests are rejected', async () => {
    const getRes = await request(app).get('/api/restaurant-profile');
    expect(getRes.status).toBe(401);
    const putRes = await request(app).put('/api/restaurant-profile').send({ name: 'X' });
    expect(putRes.status).toBe(401);
  });
});

describe('POST /api/auth/refresh — refresh token rotation', () => {
  test('signup/login also return a refreshToken', async () => {
    const res = await signup('refresh-issue@cafe.test');
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  test('a valid refresh token exchanges for a new access+refresh pair', async () => {
    const signupRes = await signup('refresh-ok@cafe.test');
    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: signupRes.body.refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    expect(refreshRes.body.refreshToken).toEqual(expect.any(String));
    expect(refreshRes.body.refreshToken).not.toBe(signupRes.body.refreshToken);

    const who = await request(app).get('/api/_test/whoami').set('Authorization', `Bearer ${refreshRes.body.accessToken}`);
    expect(who.status).toBe(200);
    expect(who.body.restaurantId).toBe(signupRes.body.restaurantId);
  });

  test('rotation: reusing an already-refreshed (old) refresh token is rejected', async () => {
    const signupRes = await signup('refresh-rotate@cafe.test');
    const firstRefresh = signupRes.body.refreshToken;

    const firstUse = await request(app).post('/api/auth/refresh').send({ refreshToken: firstRefresh });
    expect(firstUse.status).toBe(200);

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: firstRefresh });
    expect(reuse.status).toBe(401);
  });

  test('an unknown/garbage refresh token is rejected', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not-a-real-refresh-token' });
    expect(res.status).toBe(401);
  });

  test('a missing refreshToken body is rejected with 400', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout — revokes the refresh token server-side', () => {
  test('after logout, the refresh token can no longer be used to get a new access token', async () => {
    const signupRes = await signup('logout@cafe.test');
    const refreshToken = signupRes.body.refreshToken;

    const logoutRes = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  test('logout with no refresh token still succeeds (best-effort, e.g. already-expired session)', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

describe('POST /api/test-data/generate-next-day, confirm-next-day, discard-next-day — "Generate Next Day" testing tool', () => {
  async function signupWithMenu(email: string) {
    const signupRes = await signup(email);
    const token = signupRes.body.accessToken;
    await request(app).put('/api/menu').set('Authorization', `Bearer ${token}`).send([
      { id: 'dal-fry', name: 'Dal Fry', sellingPrice: 100, rawMaterialCost: 35 },
      { id: 'naan', name: 'Naan', sellingPrice: 30, rawMaterialCost: 10 },
    ]);
    return token;
  }

  test('a restaurant with no menu yet gets a 400, not a generated (empty) day', async () => {
    const signupRes = await signup('testgen-no-menu@cafe.test');
    const res = await request(app).post('/api/test-data/generate-next-day')
      .set('Authorization', `Bearer ${signupRes.body.accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  test('with no billing history, generates for today\'s date and only menu dish names', async () => {
    const token = await signupWithMenu('testgen-first-day@cafe.test');
    const res = await request(app).post('/api/test-data/generate-next-day').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(new Date().toISOString().slice(0, 10));
    expect(res.body.rowCount).toBeGreaterThan(0);
    expect(res.body.totalOrders).toBeGreaterThan(0);
    expect(res.body.totalRevenue).toBeGreaterThan(0);
    expect(res.body.requestId).toEqual(expect.any(String));
  });

  test('with existing billing history, generates for the day after the most recent date on file', async () => {
    const token = await signupWithMenu('testgen-next-day@cafe.test');
    await request(app).post('/api/billing').set('Authorization', `Bearer ${token}`)
      .send([{ id: '1', date: '2026-03-01', dishName: 'Dal Fry', quantity: 5, sellingPrice: 100 }]);

    const res = await request(app).post('/api/test-data/generate-next-day').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-03-02');
  });

  test('confirm imports the generated rows into billing_entries, dated and dish-named as previewed', async () => {
    const token = await signupWithMenu('testgen-confirm@cafe.test');
    const gen = await request(app).post('/api/test-data/generate-next-day').set('Authorization', `Bearer ${token}`);

    const confirm = await request(app).post('/api/test-data/confirm-next-day').set('Authorization', `Bearer ${token}`)
      .send({ requestId: gen.body.requestId });
    expect(confirm.status).toBe(200);
    expect(confirm.body.added).toBe(gen.body.rowCount);
    expect(confirm.body.entries).toHaveLength(gen.body.rowCount);

    const billing = await request(app).get('/api/billing').set('Authorization', `Bearer ${token}`);
    expect(billing.body).toHaveLength(gen.body.rowCount);
    const menuNames = new Set(['Dal Fry', 'Naan']);
    for (const row of billing.body) {
      expect(row.date).toBe(gen.body.date);
      expect(menuNames.has(row.dishName)).toBe(true);
    }
  });

  test('discard drops the pending generation without touching billing_entries', async () => {
    const token = await signupWithMenu('testgen-discard@cafe.test');
    const gen = await request(app).post('/api/test-data/generate-next-day').set('Authorization', `Bearer ${token}`);

    const discard = await request(app).post('/api/test-data/discard-next-day').set('Authorization', `Bearer ${token}`)
      .send({ requestId: gen.body.requestId });
    expect(discard.status).toBe(200);

    const billing = await request(app).get('/api/billing').set('Authorization', `Bearer ${token}`);
    expect(billing.body).toHaveLength(0);

    // The discarded request is gone — confirming it afterward is a 404, not a stale import.
    const confirmAfterDiscard = await request(app).post('/api/test-data/confirm-next-day').set('Authorization', `Bearer ${token}`)
      .send({ requestId: gen.body.requestId });
    expect(confirmAfterDiscard.status).toBe(404);
  });

  test('only one pending generation per restaurant: a second generate invalidates the first requestId', async () => {
    const token = await signupWithMenu('testgen-single-pending@cafe.test');
    const first = await request(app).post('/api/test-data/generate-next-day').set('Authorization', `Bearer ${token}`);
    const second = await request(app).post('/api/test-data/generate-next-day').set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);

    const confirmFirst = await request(app).post('/api/test-data/confirm-next-day').set('Authorization', `Bearer ${token}`)
      .send({ requestId: first.body.requestId });
    expect(confirmFirst.status).toBe(404);

    const confirmSecond = await request(app).post('/api/test-data/confirm-next-day').set('Authorization', `Bearer ${token}`)
      .send({ requestId: second.body.requestId });
    expect(confirmSecond.status).toBe(200);
  });

  test('confirming with no matching pending generation returns 404', async () => {
    const token = await signupWithMenu('testgen-no-pending@cafe.test');
    const res = await request(app).post('/api/test-data/confirm-next-day').set('Authorization', `Bearer ${token}`)
      .send({ requestId: 'not-a-real-request-id' });
    expect(res.status).toBe(404);
  });

  test('tenant isolation: restaurant B cannot confirm restaurant A\'s pending generation', async () => {
    const tokenA = await signupWithMenu('testgen-tenant-a@cafe.test');
    const tokenB = await signupWithMenu('testgen-tenant-b@cafe.test');
    const genA = await request(app).post('/api/test-data/generate-next-day').set('Authorization', `Bearer ${tokenA}`);

    const crossConfirm = await request(app).post('/api/test-data/confirm-next-day').set('Authorization', `Bearer ${tokenB}`)
      .send({ requestId: genA.body.requestId });
    expect(crossConfirm.status).toBe(404);

    const billingB = await request(app).get('/api/billing').set('Authorization', `Bearer ${tokenB}`);
    expect(billingB.body).toHaveLength(0);
  });

  test('unauthenticated requests to all three routes are rejected', async () => {
    const gen = await request(app).post('/api/test-data/generate-next-day');
    expect(gen.status).toBe(401);
    const confirm = await request(app).post('/api/test-data/confirm-next-day').send({ requestId: 'x' });
    expect(confirm.status).toBe(401);
    const discard = await request(app).post('/api/test-data/discard-next-day').send({ requestId: 'x' });
    expect(discard.status).toBe(401);
  });
});
