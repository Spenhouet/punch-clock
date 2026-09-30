/** Minimal GitHub Gist client. The GitHub API allows cross-origin calls, so plain fetch works. */

export const GIST_FILE = 'punchclock-backup.json.enc';
const API = 'https://api.github.com';

interface GistResponse {
  id: string;
  files: Record<string, { content?: string; truncated?: boolean; raw_url?: string } | undefined>;
}

export class GistError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function call(path: string, token: string | undefined, init: RequestInit = {}): Promise<GistResponse> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  if (!res.ok) throw new GistError(res.status, `GitHub ${res.status}`);
  return res.json();
}

/** Create a secret gist holding the file. Returns its ID. */
export async function createGist(token: string, content: string): Promise<string> {
  const gist = await call('/gists', token, {
    method: 'POST',
    body: JSON.stringify({
      description: 'PunchClock backup (encrypted)',
      public: false,
      files: { [GIST_FILE]: { content } }
    })
  });
  return gist.id;
}

export async function updateGist(token: string, id: string, content: string): Promise<void> {
  await call(`/gists/${encodeURIComponent(id)}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILE]: { content } } })
  });
}

export async function readGist(id: string, token?: string): Promise<string> {
  const gist = await call(`/gists/${encodeURIComponent(id)}`, token);
  const file = gist.files[GIST_FILE];
  if (!file) throw new GistError(404, 'file missing');
  // Large files are cut off in the API response and have to be fetched raw
  if (file.truncated && file.raw_url) {
    const res = await fetch(file.raw_url);
    if (!res.ok) throw new GistError(res.status, `GitHub ${res.status}`);
    return res.text();
  }
  return file.content ?? '';
}

/** Accept a bare ID or a gist URL. */
export function gistIdFrom(input: string): string {
  const s = input.trim();
  const match = s.match(/gist\.github(?:usercontent)?\.com\/(?:[^/]+\/)?([0-9a-f]{20,})/i);
  return match ? match[1] : s;
}
