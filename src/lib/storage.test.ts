import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage, resetCache } from './storage';

// storage.ts is now a thin client over the real backend (server.ts + SQLite) for
// billing/menu/reports/opportunities — the actual append-dedupe logic and tenant
// isolation now live server-side and are covered end-to-end in tests/api.test.ts
// against the real Express app + an in-memory SQLite DB. These tests instead verify
// storage.ts's own contract: it calls the right endpoint/method, updates its
// in-memory cache on success, and degrades gracefully (ok:false, no throw) on failure.

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const { status, body } = handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  localStorage.clear();
  resetCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage.appendBilling', () => {
  test('POSTs to /api/billing, then refreshes the cache from a follow-up GET', async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url === '/api/billing' && init?.method === 'POST') return { status: 200, body: { added: 2, total: 2 } };
      if (url === '/api/billing') return { status: 200, body: [{ id: '1', date: '2026-08-01', dishName: 'X', quantity: 1, sellingPrice: 10 }] };
      throw new Error(`unexpected fetch: ${url}`);
    });

    const rows = [{ id: '1', date: '2026-08-01', dishName: 'X', quantity: 1, sellingPrice: 10 }];
    const result = await storage.appendBilling(rows);

    expect(result).toEqual({ added: 2, total: 2, ok: true });
    expect(storage.getBilling()).toHaveLength(1); // cache refreshed from the GET
    expect(fetchMock).toHaveBeenCalledWith('/api/billing', expect.objectContaining({ method: 'POST' }));
  });

  test('a network/server failure returns ok:false instead of throwing, and leaves the cache untouched', async () => {
    mockFetch(() => ({ status: 500, body: { error: 'boom' } }));
    const result = await storage.appendBilling([{ id: '1', date: '2026-08-01', dishName: 'X', quantity: 1, sellingPrice: 10 }]);
    expect(result.ok).toBe(false);
    expect(storage.getBilling()).toEqual([]); // cache never populated
  });
});

describe('storage.setMenu', () => {
  test('PUTs the full menu and updates the cache on success', async () => {
    const menu = [{ id: 'x', name: 'X', sellingPrice: 100, rawMaterialCost: 40 }];
    const fetchMock = mockFetch((url, init) => {
      expect(url).toBe('/api/menu');
      expect(init?.method).toBe('PUT');
      return { status: 200, body: { ok: true } };
    });

    const ok = await storage.setMenu(menu);
    expect(ok).toBe(true);
    expect(storage.getMenu()).toEqual(menu);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('failure returns false and does not touch the cache', async () => {
    mockFetch(() => ({ status: 500, body: {} }));
    const ok = await storage.setMenu([{ id: 'x', name: 'X', sellingPrice: 100, rawMaterialCost: 40 }]);
    expect(ok).toBe(false);
    expect(storage.getMenu()).toEqual([]);
  });
});

describe('storage — client-only namespaced keys (per-restaurant chat history)', () => {
  test('chat history is still scoped per biq_restaurant_id (not migrated to the server)', () => {
    localStorage.setItem('biq_restaurant_id', 'restaurant-a');
    storage.appendChat({ id: '1', role: 'user', content: 'hi from A', timestamp: '2026-08-01T00:00:00Z' });

    localStorage.setItem('biq_restaurant_id', 'restaurant-b');
    expect(storage.getChat()).toEqual([]);

    localStorage.setItem('biq_restaurant_id', 'restaurant-a');
    expect(storage.getChat()).toHaveLength(1);
  });
});
