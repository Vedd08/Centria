import { fmtDateTime } from './date';

/** Longest edge kept after resizing — plenty for a clinical photo, far under the 10MB limit. */
const MAX_EDGE = 2000;
const QUALITY = 0.85;

/**
 * Shrinks a camera photo before upload. Phone cameras produce 4–15MB images, which
 * are slow on clinic Wi-Fi and can exceed the server's 10MB limit. PDFs and small
 * images are returned untouched; if the browser can't decode the image (e.g. HEIC
 * on some desktops), the original file is sent and the server decides.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 1.5 * 1024 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Default title for a photo taken just now, e.g. "Photo 13-11-2026 14:32". */
export const photoTitle = () => `Photo ${fmtDateTime(new Date())}`;
