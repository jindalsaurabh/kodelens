"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHash = generateHash;
/**
 * Generate a SHA-256 hash of a string.
 * @param input - string to hash
 * @returns hex digest of the SHA-256 hash
 */
function generateHash(input) {
    var crypto = require("crypto");
    return crypto.createHash("sha256").update(input).digest("hex");
}
