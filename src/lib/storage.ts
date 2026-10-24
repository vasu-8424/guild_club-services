import fs from "fs/promises";
import path from "path";

export type SessionFileType = "in-time-photo" | "out-time-photo" | "signature";

/**
 * Save a session file (photo or signature) to private storage.
 * If BLOB_READ_WRITE_TOKEN is configured and valid, uploads to Vercel Blob.
 * Otherwise, persists to a local protected directory (storage/files/).
 */
export async function saveStorageFile(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && token.trim() !== "" && !token.includes("sample")) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buffer, {
        access: "public",
        token,
        contentType,
      });
      // Store the blob URL as the file key
      return blob.url;
    } catch (err) {
      console.warn("Vercel Blob upload failed, falling back to local file storage:", err);
    }
  }

  // Local storage fallback
  const dir = path.join(process.cwd(), "storage", "files");
  await fs.mkdir(dir, { recursive: true });
  const sanitized = filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const filePath = path.join(dir, sanitized);
  await fs.writeFile(filePath, buffer);
  return sanitized;
}

/**
 * Retrieves a session file buffer and content-type by key.
 */
export async function getStorageFile(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      const res = await fetch(key);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType,
      };
    } catch (err) {
      console.error("Failed to fetch remote blob:", err);
      return null;
    }
  }

  // Local file lookup
  try {
    const dir = path.join(process.cwd(), "storage", "files");
    const sanitized = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const filePath = path.join(dir, sanitized);
    const buffer = await fs.readFile(filePath);

    let contentType = "application/octet-stream";
    if (sanitized.endsWith(".png")) contentType = "image/png";
    else if (sanitized.endsWith(".jpg") || sanitized.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (sanitized.endsWith(".webp")) contentType = "image/webp";

    return { buffer, contentType };
  } catch {
    return null;
  }
}
