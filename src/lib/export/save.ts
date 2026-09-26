import { Capacitor } from '@capacitor/core';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Hand a file to the user. Android gets the share sheet (save to Drive, send by
 * mail, …), browsers get a download.
 */
export async function saveFile(filename: string, content: string | Uint8Array, mime: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const written =
      typeof content === 'string'
        ? await Filesystem.writeFile({
            path: filename,
            data: content,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          })
        : await Filesystem.writeFile({ path: filename, data: toBase64(content), directory: Directory.Cache });
    await Share.share({ title: filename, files: [written.uri] });
    return;
  }
  const blob = new Blob([content as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Let the user pick a file and return its text. */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
