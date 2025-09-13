"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = sha256Hex;
const crypto_1 = require("crypto");
/**
 * Deterministic SHA-256 hash of a string.
 */
function sha256Hex(s) {
    return (0, crypto_1.createHash)("sha256").update(s, "utf8").digest("hex");
}
