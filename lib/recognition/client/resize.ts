import imageCompression from 'browser-image-compression';

/** Long edge in pixels: the API's standard-tier native limit, so it never downscales again (ADR-42). */
export const UPLOAD_LONG_EDGE = 1568;
export const UPLOAD_QUALITY = 0.85;

/**
 * Prepares a camera photo for upload: orientation is applied to the pixels, the long edge is
 * capped at 1568 px, and the image is re-encoded as JPEG at 0.85 with EXIF dropped (ADR-42).
 * Re-encoding through a canvas is what strips the metadata, so `preserveExif` stays off.
 * The web worker is disabled because the library would otherwise fetch its worker script from a
 * CDN, which the app's CSP does not allow.
 */
export async function resizeForUpload(file: File): Promise<Blob> {
  const out = await imageCompression(file, {
    maxWidthOrHeight: UPLOAD_LONG_EDGE,
    initialQuality: UPLOAD_QUALITY,
    fileType: 'image/jpeg',
    preserveExif: false,
    useWebWorker: false,
  });
  return out;
}
