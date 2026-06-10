import path from "node:path";
import fs from "node:fs";

export function getDataDir(): string {
  const dir = process.env.APP_DATA_DIR || "./data";
  return path.resolve(process.cwd(), dir);
}

export function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

/** Reject any path that escapes the given root (path traversal protection). */
export function safeJoin(root: string, ...segments: string[]): string {
  const resolved = path.resolve(root, ...segments);
  const normRoot = path.resolve(root) + path.sep;
  if (resolved !== path.resolve(root) && !resolved.startsWith(normRoot)) {
    throw new Error(`Unsafe path: ${segments.join("/")} escapes ${root}`);
  }
  return resolved;
}

export function isoTimestamp(): string {
  // 2026-05-27T09-30-00Z (filesystem-safe)
  return new Date().toISOString().replace(/\.\d{3}/, "").replace(/:/g, "-");
}

export function isoNow(): string {
  return new Date().toISOString();
}
