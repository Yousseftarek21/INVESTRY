import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended nonce size for GCM

function getKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("DATA_ENCRYPTION_KEY environment variable is required but was not provided.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`DATA_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}.`);
  }
  return key;
}

export interface EncryptedEnvelope {
  __enc: 1;
  iv: string;
  ct: string;
  tag: string;
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__enc === 1 &&
    typeof (value as Record<string, unknown>).iv === "string" &&
    typeof (value as Record<string, unknown>).ct === "string" &&
    typeof (value as Record<string, unknown>).tag === "string"
  );
}

/** Encrypts a JSON-serializable value for storage in a jsonb column. */
export function encryptForStorage(data: unknown): EncryptedEnvelope {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __enc: 1,
    iv: iv.toString("base64"),
    ct: ciphertext.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts a value previously written by encryptForStorage. Tolerant of
 * legacy plaintext rows written before encryption was introduced — those
 * are returned as-is instead of failing, so existing data keeps working
 * during the transition until it's backfilled.
 */
export function decryptFromStorage(stored: unknown): unknown {
  if (!isEncryptedEnvelope(stored)) {
    return stored;
  }
  const key = getKey();
  const iv = Buffer.from(stored.iv, "base64");
  const ciphertext = Buffer.from(stored.ct, "base64");
  const tag = Buffer.from(stored.tag, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
