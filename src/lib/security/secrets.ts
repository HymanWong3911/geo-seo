import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export interface EncryptedSecret {
  encrypted: string;
  iv: string;
  tag: string;
}

function encryptionKey(): Buffer {
  const value = process.env.CMS_SECRET_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error("CMS_SECRET_ENCRYPTION_KEY 未配置");
  }

  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("CMS_SECRET_ENCRYPTION_KEY 必须是 32 字节的 hex 或 base64");
  }
  return key;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function fingerprintSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
