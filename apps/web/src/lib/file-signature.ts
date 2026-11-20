/**
 * Detect an image type from its first bytes. The browser-provided MIME type
 * is never trusted on its own.
 */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export const EXTENSION_FOR: Record<"image/jpeg" | "image/png" | "image/webp", string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/** Images plus PDF ("%PDF-" header). */
export function sniffUploadType(bytes: Uint8Array): UploadType | null {
  const image = sniffImageType(bytes);
  if (image) return image;
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export const UPLOAD_EXTENSION: Record<UploadType, string> = { ...EXTENSION_FOR, "application/pdf": "pdf" };
