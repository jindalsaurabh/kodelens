import { createHash } from "crypto";

/**
 * Deterministic SHA-256 hash of a string.
 */
export function sha256Hex(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
