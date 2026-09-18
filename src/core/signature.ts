/**
 * Browser-compatible, pure-JavaScript base64 decoder and signature validator for Sparkle.
 * Supports Node.js, Cloudflare Workers/Pages, and browsers without Node-specific modules (e.g. Buffer).
 *
 * Validates:
 * - RFC 4648 Base64 alphabet ([A-Za-z0-9+/])
 * - Proper whitespace stripping (spaces, tabs, \r, \n)
 * - Strict padding checks (no misplaced padding, at most 2 '=' chars at the end)
 * - Decoded byte length verification (e.g. Ed25519 signatures must be exactly 64 decoded bytes)
 */

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_MAP = new Uint8Array(256);
for (let i = 0; i < 256; i++) B64_MAP[i] = 255;
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_MAP[B64_CHARS.charCodeAt(i)] = i;
}

export interface Base64DecodeResult {
  data?: Uint8Array;
  error?: string;
}

/**
 * Decodes a base64 string into a Uint8Array with strict syntax and padding validation.
 */
export function decodeBase64(input: string): Base64DecodeResult {
  const clean = input.replace(/\s+/g, "");
  if (clean.length === 0) {
    return { error: "Signature string is empty" };
  }

  if (clean.length % 4 !== 0) {
    return { error: `Base64 length (${clean.length}) is not a multiple of 4` };
  }

  // Determine padding count: must be 0, 1, or 2 '=' characters at the end
  let padding = 0;
  if (clean.endsWith("==")) {
    padding = 2;
  } else if (clean.endsWith("=")) {
    padding = 1;
  }

  // Verify that '=' only appears as padding at the end
  const paddingStart = clean.length - padding;
  for (let i = 0; i < paddingStart; i++) {
    if (clean[i] === "=") {
      return {
        error:
          "Base64 padding '=' character appears before the end of the string",
      };
    }
  }

  // Verify that any characters after paddingStart are '='
  for (let i = paddingStart; i < clean.length; i++) {
    if (clean[i] !== "=") {
      return { error: "Invalid base64 character after padding" };
    }
  }

  // Verify characters in data portion
  for (let i = 0; i < paddingStart; i++) {
    const code = clean.charCodeAt(i);
    if (code > 255 || B64_MAP[code] === 255) {
      return { error: `Invalid base64 character '${clean[i]}'` };
    }
  }

  const outLen = (clean.length / 4) * 3 - padding;
  const out = new Uint8Array(outLen);
  let outIdx = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_MAP[clean.charCodeAt(i)];
    const c1 = B64_MAP[clean.charCodeAt(i + 1)];
    const isPad2 = clean[i + 2] === "=";
    const isPad3 = clean[i + 3] === "=";

    const c2 = isPad2 ? 0 : B64_MAP[clean.charCodeAt(i + 2)];
    const c3 = isPad3 ? 0 : B64_MAP[clean.charCodeAt(i + 3)];

    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;

    out[outIdx++] = (triple >> 16) & 255;
    if (!isPad2) {
      out[outIdx++] = (triple >> 8) & 255;
    }
    if (!isPad3) {
      out[outIdx++] = triple & 255;
    }
  }

  return { data: out };
}

export interface SignatureValidationResult {
  valid: boolean;
  reason?: string;
  decodedBytes?: number;
}

/**
 * Validate a base64-encoded signature.
 *
 * Checks:
 * 1. Valid base64 characters (after stripping whitespace)
 * 2. Proper padding (length multiple of 4, at most 2 '=' padding chars at end)
 * 3. Actual decoded byte count:
 *    - EdDSA (Ed25519) signatures must be EXACTLY 64 decoded bytes (88 base64 chars).
 *    - DSA signatures are DER-encoded, typically 46-48 bytes (40-150 bytes acceptable).
 *
 * NOTE: Format validation only verifies base64 encoding structure and signature size;
 * it does NOT authenticate cryptographic keys or download contents.
 */
export function validateSignature(
  sig: string,
  type: "ed" | "dsa"
): SignatureValidationResult {
  const decoded = decodeBase64(sig);
  if (!decoded.data) {
    return { valid: false, reason: decoded.error };
  }

  const decodedBytes = decoded.data.length;

  if (type === "ed") {
    if (decodedBytes !== 64) {
      return {
        valid: false,
        reason: `Ed25519 signature must decode to exactly 64 bytes, got ${decodedBytes}`,
        decodedBytes,
      };
    }
  } else {
    // DSA signatures are DER-encoded (sequence of two integers)
    if (decodedBytes < 40 || decodedBytes > 150) {
      return {
        valid: false,
        reason: `DSA signature length (${decodedBytes} bytes) is outside typical range (40-150 bytes)`,
        decodedBytes,
      };
    }
  }

  return { valid: true, decodedBytes };
}
