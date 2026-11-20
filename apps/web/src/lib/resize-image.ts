"use client";

/**
 * Downscale a photo in the browser before upload: smaller files, faster
 * uploads, and EXIF metadata (including GPS location) is stripped because the
 * image is re-encoded. Returns null when the browser cannot decode the file
 * (corrupt or unsupported format). The server validates the result either way.
 */
export async function prepareImage(file: File, maxSide = 1600, quality = 0.85): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") {
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      return jpeg ? new File([jpeg], "photo.jpg", { type: "image/jpeg" }) : file;
    }
    return new File([blob], "photo.webp", { type: "image/webp" });
  } catch {
    return null;
  }
}
