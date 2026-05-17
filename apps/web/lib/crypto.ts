import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Get the encryption key from environment or derive a default.
 * In production, always set ENCRYPTION_KEY to a unique 64-char hex string.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (secret) {
    // Accept hex or raw string; hash to get exactly 32 bytes
    const key = Buffer.from(secret, "hex");
    if (key.length === 32) return key;
    // If not 32 bytes hex, SHA-256 hash it to get a 32-byte key
    return createHash("sha256").update(secret).digest();
  }
  // Fallback: derive from a known string (WARN: this is not secure for production)
  if (typeof process.env.NODE_ENV !== "undefined" && process.env.NODE_ENV !== "production") {
    return createHash("sha256").update("agent-web-dev-key-do-not-use-in-production").digest();
  }
  throw new Error(
    "ENCRYPTION_KEY environment variable is required in production mode."
  );
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string encoding: iv (16) + authTag (16) + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Pack: iv + authTag + ciphertext (all base64, separated by dots)
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted}`;
}

/**
 * Decrypt a previously encrypted string back to plaintext.
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();

  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
