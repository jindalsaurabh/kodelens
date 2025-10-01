// src/utils.ts
import * as crypto from "crypto";

/**
 * Generate a SHA-256 hash of a string.
 * @param input - string to hash
 * @returns hex digest of the SHA-256 hash
 */
export function generateHash(input: string): string {
    //const crypto = require("crypto");
    return crypto.createHash("sha256").update(input).digest("hex");
}

/** Deterministic hash for a code chunk (filePath + chunk_type + chunk_text) */
export function computeChunkHash(filePath: string, chunkText: string, chunkType?: string): string {
  return generateHash(`${filePath}::${chunkType ?? ""}::${chunkText}`);
}

export function generateChunkId(filePath: string, content: string): string {
    return crypto
        .createHash("sha256")
        .update(`${filePath}:${content}`)
        .digest("hex");
}