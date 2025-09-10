// src/utils.ts
import crypto from "crypto";

/**
 * Generate a SHA-256 hash from a string
 * @param input string to hash
 * @returns hex string of the hash
 */
export function generateHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Sleep for a given number of milliseconds
 * @param ms milliseconds to wait
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a file path to always use forward slashes
 * @param p file path
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}
