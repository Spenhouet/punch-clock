import { m } from '$lib/paraglide/messages.js';
import { GistError } from './gist';

/** User-facing text for a failed gist call. */
export function syncErrorText(e: unknown): string {
  if (e instanceof GistError) {
    if (e.status === 401 || e.status === 403) return m.gist_err_auth();
    if (e.status === 404) return m.gist_err_not_found();
  }
  const code = (e as Error)?.message;
  if (code === 'wrong_passphrase') return m.gist_err_passphrase();
  if (code === 'invalid_format' || code === 'invalid_json') return m.gist_err_format();
  if (code === 'newer_version') return m.restore_newer();
  if (code === 'GitHub 401' || code === 'GitHub 403') return m.gist_err_auth();
  if (code === 'GitHub 404') return m.gist_err_not_found();
  return m.gist_err_network();
}
