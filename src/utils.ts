// src/utils.ts
import * as crypto from "crypto";

/**
 * Generate a SHA-256 hash of a string.
 * @param input - string to hash
 * @returns hex digest of the SHA-256 hash
 */
export function generateHash(input: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(input).digest("hex");
}
