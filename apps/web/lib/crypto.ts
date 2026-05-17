import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * ENCRYPTION_KEY must be set to a 64-char hex string in all environments.
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
  throw new Error(
    "ENCRYPTION_KEY environment variable is required. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
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
