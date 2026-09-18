import { describe, it, expect } from "vitest";
import { decodeBase64, validateSignature } from "../../src/core/signature.js";

describe("Base64 & Signature validation", () => {
  describe("decodeBase64", () => {
    it("decodes valid base64 strings with different padding lengths", () => {
      // 0 padding characters (length 4 -> 3 bytes)
      const res0 = decodeBase64("QUJD"); // "ABC"
      expect(res0.error).toBeUndefined();
      expect(res0.data).toEqual(new Uint8Array([65, 66, 67]));

      // 1 padding character (length 4 -> 2 bytes)
      const res1 = decodeBase64("QUI="); // "AB"
      expect(res1.error).toBeUndefined();
      expect(res1.data).toEqual(new Uint8Array([65, 66]));

      // 2 padding characters (length 4 -> 1 byte)
      const res2 = decodeBase64("QQ=="); // "A"
      expect(res2.error).toBeUndefined();
      expect(res2.data).toEqual(new Uint8Array([65]));
    });

    it("handles embedded whitespace and newlines correctly", () => {
      const res = decodeBase64("  QU\n  JD \r\n ");
      expect(res.error).toBeUndefined();
      expect(res.data).toEqual(new Uint8Array([65, 66, 67]));
    });

    it("rejects empty or whitespace-only inputs", () => {
      expect(decodeBase64("").error).toBeDefined();
      expect(decodeBase64("   \n\t ").error).toBeDefined();
    });

    it("rejects lengths that are not multiples of 4", () => {
      expect(decodeBase64("QUJ").error).toContain("multiple of 4");
      expect(decodeBase64("QUJDQ").error).toContain("multiple of 4");
    });

    it("rejects '=' padding characters within data", () => {
      expect(decodeBase64("QU=D").error).toContain("before the end");
      expect(decodeBase64("=UJD").error).toContain("before the end");
      expect(decodeBase64("QUJD====").error).toContain("before the end");
    });

    it("rejects excessive padding and invalid padding sequences (e.g. 87 'A's + 5 '=')", () => {
      // 87 'A's + 5 '=' = 92 characters (multiple of 4) but 5 '=' padding characters
      const exploit = "A".repeat(87) + "=".repeat(5);
      const res = decodeBase64(exploit);
      expect(res.error).toBeDefined();
    });

    it("rejects invalid characters outside RFC 4648 standard alphabet", () => {
      expect(decodeBase64("QU-D").error).toContain("Invalid base64 character");
      expect(decodeBase64("QU_D").error).toContain("Invalid base64 character");
      expect(decodeBase64("QU!D").error).toContain("Invalid base64 character");
    });
  });

  describe("validateSignature", () => {
    // 64 bytes of 0x78 ('x') encoded in base64: length 88
    const validEd25519 =
      "eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==";

    it("accepts valid 64-byte Ed25519 signature", () => {
      const res = validateSignature(validEd25519, "ed");
      expect(res.valid).toBe(true);
      expect(res.decodedBytes).toBe(64);
    });

    it("rejects Ed25519 signatures that decode to != 64 bytes", () => {
      // 16 bytes ("abcdefghijklmnop")
      const shortSig = "YWJjZGVmZ2hpamtsbW5vcA==";
      const resShort = validateSignature(shortSig, "ed");
      expect(resShort.valid).toBe(false);
      expect(resShort.reason).toContain("64 bytes");

      // 63 bytes (84 base64 chars, no padding)
      const sig63 = "A".repeat(84);
      const res63 = validateSignature(sig63, "ed");
      expect(res63.valid).toBe(false);
      expect(res63.reason).toContain("64 bytes");
    });

    it("rejects 87 'A's + 5 '=' exploit probe in Ed25519 validation", () => {
      const exploit = "A".repeat(87) + "=".repeat(5);
      const res = validateSignature(exploit, "ed");
      expect(res.valid).toBe(false);
    });

    it("accepts valid DER-encoded DSA signature within typical range (40-150 bytes)", () => {
      // 48 bytes of data
      const dsaSig = "A".repeat(64);
      const res = validateSignature(dsaSig, "dsa");
      expect(res.valid).toBe(true);
      expect(res.decodedBytes).toBe(48);
    });

    it("rejects DSA signatures outside 40-150 byte range", () => {
      // 16 bytes
      const shortDsa = "YWJjZGVmZ2hpamtsbW5vcA==";
      const resShort = validateSignature(shortDsa, "dsa");
      expect(resShort.valid).toBe(false);
      expect(resShort.reason).toContain("outside typical range");

      // 200 bytes
      const longDsa = "A".repeat(268);
      const resLong = validateSignature(longDsa, "dsa");
      expect(resLong.valid).toBe(false);
      expect(resLong.reason).toContain("outside typical range");
    });
  });
});
