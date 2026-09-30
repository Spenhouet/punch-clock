/**
 * Passphrase encryption for backups stored outside the device: PBKDF2-SHA-256 derives an
 * AES-256-GCM key, the file carries salt, iteration count and IV so any WebCrypto or
 * standard AES-GCM implementation can decrypt it.
 */

export const ENCRYPTED_FORMAT = 'punchclock-encrypted';
export const DEFAULT_ITERATIONS = 600_000;

export interface EncryptedFile {
  format: typeof ENCRYPTED_FORMAT;
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  /** Ciphertext with the 16-byte GCM tag appended, base64. */
  data: string;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/** Raw 256-bit key from the passphrase, base64. Stored instead of the passphrase. */
export async function deriveKey(passphrase: string, salt: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveBits'
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations },
    base,
    256
  );
  return toBase64(new Uint8Array(bits));
}

function aesKey(key: string, usage: KeyUsage) {
  return crypto.subtle.importKey('raw', fromBase64(key), 'AES-GCM', false, [usage]);
}

export async function encrypt(
  plaintext: string,
  key: string,
  salt: string,
  iterations = DEFAULT_ITERATIONS
): Promise<EncryptedFile> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(key, 'encrypt'),
    new TextEncoder().encode(plaintext)
  );
  return {
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(data))
  };
}

export function parseEncrypted(text: string): EncryptedFile {
  let parsed: Partial<EncryptedFile>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid_format');
  }
  if (parsed?.format !== ENCRYPTED_FORMAT || !parsed.kdf?.salt || !parsed.cipher?.iv || !parsed.data) {
    throw new Error('invalid_format');
  }
  if (parsed.version !== 1) throw new Error('newer_version');
  return parsed as EncryptedFile;
}

/** Throws `wrong_passphrase` when the key does not fit. */
export async function decrypt(file: EncryptedFile, key: string): Promise<string> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(file.cipher.iv) },
      await aesKey(key, 'decrypt'),
      fromBase64(file.data)
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('wrong_passphrase');
  }
}

export async function sha256(text: string): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}
