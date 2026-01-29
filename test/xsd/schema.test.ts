import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readdirSync } from "fs";
import { join } from "path";

/**
 * XSD Schema Validation Tests
 *
 * These tests validate our XSD schema against fixtures.
 * Requires xmllint to be installed (comes with libxml2).
 */

const FIXTURES_DIR = join(process.cwd(), "test/fixtures");
const SCHEMA_PATH = join(process.cwd(), "appcast.xsd");

function validateWithXsd(xmlPath: string): { valid: boolean; error?: string } {
  try {
    execFileSync("xmllint", ["--schema", SCHEMA_PATH, "--noout", xmlPath], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { valid: true };
  } catch (e) {
    const error = e as { stdout?: string; stderr?: string; message?: string };
    return {
      valid: false,
      error: error.stdout || error.stderr || error.message,
    };
  }
}

function hasXmllint(): boolean {
  try {
    execFileSync("which", ["xmllint"], { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasXmllint())("XSD Schema Validation", () => {
  describe("Valid fixtures should pass XSD", () => {
    const validFixtures = readdirSync(join(FIXTURES_DIR, "valid")).filter((f) =>
      f.endsWith(".xml")
    );

    it.each(validFixtures)("%s", (filename) => {
      const result = validateWithXsd(join(FIXTURES_DIR, "valid", filename));
      expect(result.valid, result.error).toBe(true);
    });
  });

  describe("Structurally invalid fixtures should fail XSD", () => {
    // These have XML structure issues that XSD catches
    const structurallyInvalid = [
      "malformed.xml", // Not well-formed XML
      "not-rss.xml", // Root is not <rss>
      "no-channel.xml", // Missing <channel>
      "bad-namespace.xml", // Wrong namespace
    ];

    it.each(structurallyInvalid)("%s should be rejected", (filename) => {
      const result = validateWithXsd(join(FIXTURES_DIR, "invalid", filename));
      expect(result.valid).toBe(false);
    });
  });

  describe("Type-invalid fixtures should fail XSD", () => {
    // These have type/format errors that XSD catches
    const typeInvalid = [
      "bad-rollout.xml", // "not-a-number" for phasedRolloutInterval
      "invalid-os.xml", // "linux" is not valid (only macos/windows)
      "real-world-broken.xml", // Invalid version format, channel name
    ];

    it.each(typeInvalid)("%s should be rejected", (filename) => {
      const result = validateWithXsd(join(FIXTURES_DIR, "invalid", filename));
      expect(result.valid).toBe(false);
    });
  });

  describe("Semantically invalid fixtures should pass XSD", () => {
    // These are structurally valid XML but have semantic issues
    // that only our validator catches (not XSD)
    const semanticOnly = [
      "missing-version.xml",
      "empty-version.xml",
      "bad-date.xml",
      "invalid-signature.xml",
      "no-items.xml",
      "dsa-only.xml",
      "version-date-mismatch.xml",
      "mixed-protocols.xml",
    ];

    it.each(semanticOnly)(
      "%s should pass XSD (validator catches)",
      (filename) => {
        const result = validateWithXsd(join(FIXTURES_DIR, "invalid", filename));
        expect(result.valid, `Expected to pass: ${result.error}`).toBe(true);
      }
    );
  });
});
