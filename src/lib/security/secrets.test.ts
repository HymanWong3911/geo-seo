import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, fingerprintSecret } from "./secrets";

describe("CMS secret encryption", () => {
  const previousKey = process.env.CMS_SECRET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CMS_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.CMS_SECRET_ENCRYPTION_KEY;
    else process.env.CMS_SECRET_ENCRYPTION_KEY = previousKey;
  });

  it("round-trips without storing plaintext", () => {
    const value = "cms-api-key-super-secret";
    const encrypted = encryptSecret(value);
    expect(encrypted.encrypted).not.toContain(value);
    expect(decryptSecret(encrypted)).toBe(value);
  });

  it("rejects invalid key material", () => {
    process.env.CMS_SECRET_ENCRYPTION_KEY = "too-short";
    expect(() => encryptSecret("secret")).toThrow(/32 字节/);
  });

  it("creates a stable non-plaintext fingerprint", () => {
    expect(fingerprintSecret("secret")).toHaveLength(64);
    expect(fingerprintSecret("secret")).toBe(fingerprintSecret("secret"));
  });
});
