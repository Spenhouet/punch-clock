import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { db, ensureDefaults } from '$lib/db';
import { decrypt, deriveKey, parseEncrypted } from './crypto';
import { GIST_FILE } from './gist';
import { sync } from './index.svelte';

// A fake gist store behind a mocked fetch
const gists = new Map<string, string>();
const calls: string[] = [];
function fakeFetch(url: string, init: RequestInit = {}) {
  const method = init.method ?? 'GET';
  calls.push(method);
  if (!String(init.headers && (init.headers as Record<string, string>).Authorization).startsWith('Bearer ')) {
    return Promise.resolve(new Response('', { status: 401 }));
  }
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  let id = url.split('/gists/')[1];
  if (method === 'POST') id = `gist${gists.size + 1}`;
  if (method !== 'GET') gists.set(id, body.files[GIST_FILE].content);
  if (!gists.has(id)) return Promise.resolve(new Response('', { status: 404 }));
  return Promise.resolve(Response.json({ id, files: { [GIST_FILE]: { content: gists.get(id) } } }));
}

beforeAll(async () => {
  await ensureDefaults();
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});
afterEach(() => (calls.length = 0));

describe('gist sync', () => {
  it('creates a gist, skips unchanged data, updates after changes', async () => {
    await sync.enable('tok', 'correct horse battery');
    const id = sync.config!.gistId;
    expect(id).toBe('gist1');
    expect(calls).toEqual(['POST']);

    const file = parseEncrypted(gists.get(id)!);
    const key = await deriveKey('correct horse battery', file.kdf.salt, file.kdf.iterations);
    expect(JSON.parse(await decrypt(file, key)).format).toBe('punchclock-backup');
    // The token never ends up in the uploaded backup
    expect(await decrypt(file, key)).not.toContain('tok');

    calls.length = 0;
    await sync.push();
    expect(calls).toEqual([]);

    await db.segments.add({ id: 's1', date: '2026-09-21', kind: 'work', start: 1, end: 2, source: 'manual' });
    await sync.push();
    expect(calls).toEqual(['PATCH']);
    expect(sync.config!.lastError).toBeUndefined();
  });

  it('opens an existing backup without connecting until adopted', async () => {
    await sync.disconnect();
    await expect(sync.open('tok', 'wrong passphrase', 'gist1')).rejects.toThrow('wrong_passphrase');
    const { backup, config } = await sync.open('tok', 'correct horse battery', 'gist1');
    expect(backup.data.segments.map((s) => s.id)).toEqual(['s1']);
    expect(sync.config).toBeNull();
    await sync.adopt(config);
    expect(sync.config!.gistId).toBe('gist1');
    expect((await db.kv.get('sync'))?.value).toMatchObject({ gistId: 'gist1' });
  });

  it('records a failed upload', async () => {
    sync.config!.token = '';
    expect(await sync.push(true)).toBe(false);
    expect(sync.config!.lastError).toBe('GitHub 401');
  });
});
