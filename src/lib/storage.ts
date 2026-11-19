import fs from "fs/promises";
import path from "path";

export type SessionFileType = "in-time-photo" | "out-time-photo" | "signature";

/**
 * Save a session file (photo or signature) to private storage.
 * 1. If BLOB_READ_WRITE_TOKEN is configured and valid, uploads to Vercel Blob.
 * 2. If running on Vercel/Serverless (where local filesystem is read-only /var/task),
 *    persists directly as a persistent Data URI so it is safely stored in PostgreSQL.
 * 3. On local development, attempts to persist to local directory (storage/files/).
 *    If local filesystem fails for any reason, falls back seamlessly to Data URI.
 */
export async function saveStorageFile(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const mime = contentType || "image/jpeg";

  // 1. Vercel Blob storage (if token configured)
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && token.trim() !== "" && !token.includes("sample")) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buffer, {
        access: "public",
        token,
        contentType: mime,
      });
      // Store the blob URL as the file key
      return blob.url;
    } catch (err) {
      console.warn("Vercel Blob upload failed, falling back to database/persistent storage:", err);
    }
  }

  // 2. Serverless detection: on Vercel / AWS Lambda, local disk (/var/task) is read-only and ephemeral
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (isServerless) {
    // Store directly as a base64 Data URI in the database text column
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }

  // 3. Local storage fallback (for local development)
  try {
    const dir = path.join(process.cwd(), "storage", "files");
    await fs.mkdir(dir, { recursive: true });
    const sanitized = filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const filePath = path.join(dir, sanitized);
    await fs.writeFile(filePath, buffer);
    return sanitized;
  } catch (err: any) {
    console.warn("Local disk storage failed, falling back to persistent Data URI:", err?.message);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
}

/**
 * Retrieves a session file buffer and content-type by key.
 * Supports:
 * - Data URIs (data:image/...;base64,...)
 * - Remote URLs (https://...)
 * - Local files (storage/files/...)
 */
export async function getStorageFile(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!key) return null;

  // 1. Data URI
  if (key.startsWith("data:")) {
    try {
      const commaIdx = key.indexOf(",");
      if (commaIdx === -1) return null;
      const header = key.slice(0, commaIdx);
      const base64Data = key.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;]+)/);
      const contentType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
      return {
        buffer: Buffer.from(base64Data, "base64"),
        contentType,
      };
    } catch (err) {
      console.error("Failed to parse data URI storage key:", err);
      return null;
    }
  }

  // 2. Remote URL (Vercel Blob or CDN)
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

  // 3. Local file lookup
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
    // Check /tmp fallback
    try {
      const tmpDir = path.join("/tmp", "storage", "files");
      const sanitized = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const filePath = path.join(tmpDir, sanitized);
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
}
