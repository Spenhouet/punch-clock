import { describe, expect, it } from 'vitest';
import { decrypt, deriveKey, encrypt, parseEncrypted, randomSalt } from './crypto';
import { gistIdFrom } from './gist';

describe('backup encryption', () => {
  it('round-trips and rejects a wrong passphrase', async () => {
    const salt = randomSalt();
    const key = await deriveKey('correct horse', salt, 1000);
    const file = parseEncrypted(JSON.stringify(await encrypt('{"hello":"wörld"}', key, salt, 1000)));
    expect(file.kdf).toEqual({ name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, salt });
    expect(await decrypt(file, key)).toBe('{"hello":"wörld"}');
    const wrong = await deriveKey('battery staple', salt, 1000);
    await expect(decrypt(file, wrong)).rejects.toThrow('wrong_passphrase');
  });

  it('rejects other files', () => {
    expect(() => parseEncrypted('{"format":"punchclock-backup"}')).toThrow('invalid_format');
    expect(() => parseEncrypted('nope')).toThrow('invalid_format');
  });

  it('reads gist IDs from URLs', () => {
    expect(gistIdFrom('https://gist.github.com/someone/0123456789abcdef0123')).toBe('0123456789abcdef0123');
    expect(gistIdFrom(' 0123456789abcdef0123 ')).toBe('0123456789abcdef0123');
  });
});
