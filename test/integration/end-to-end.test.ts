import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../../src/core/validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../fixtures");

function readFixture(category: string, name: string): string {
  return readFileSync(resolve(fixturesDir, category, name), "utf-8");
}

describe("valid fixtures", () => {
  it("minimal.xml is valid with no errors", () => {
    const result = validate(readFixture("valid", "minimal.xml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("full-featured.xml is valid with no errors", () => {
    const result = validate(readFixture("valid", "full-featured.xml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("delta-updates.xml is valid and reports delta info", () => {
    const result = validate(readFixture("valid", "delta-updates.xml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.diagnostics.some((d) => d.id === "I002")).toBe(true);
  });

  it("multi-channel.xml is valid and reports channels", () => {
    const result = validate(readFixture("valid", "multi-channel.xml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    const summary = result.diagnostics.find((d) => d.id === "I001");
    expect(summary).toBeDefined();
    expect(summary!.message).toContain("2 items");
  });

  it("real-world-style.xml is valid", () => {
    const result = validate(readFixture("valid", "real-world-style.xml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("iterm2-style.xml is valid", () => {
    const result = validate(readFixture("valid", "iterm2-style.xml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("sparkle-2.9-features.xml is valid and reports I006/I007", () => {
    const result = validate(readFixture("valid", "sparkle-2.9-features.xml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    // Should report hardware requirements (I006)
    const hwDiag = result.diagnostics.find((d) => d.id === "I006");
    expect(hwDiag).toBeDefined();
    expect(hwDiag!.message).toContain("arm64");
    // Should report minimum update version (I007)
    const minUpdateDiag = result.diagnostics.find((d) => d.id === "I007");
    expect(minUpdateDiag).toBeDefined();
    expect(minUpdateDiag!.message).toContain("200");
  });
});

describe("invalid fixtures", () => {
  it("malformed.xml produces E001", () => {
    const result = validate(readFixture("invalid", "malformed.xml"));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "E001")).toBe(true);
  });

  it("missing-version.xml produces E008", () => {
    const result = validate(readFixture("invalid", "missing-version.xml"));
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(true);
  });

  it("bad-date.xml produces W004", () => {
    const result = validate(readFixture("invalid", "bad-date.xml"));
    expect(result.diagnostics.some((d) => d.id === "W004")).toBe(true);
  });

  it("not-rss.xml produces E002", () => {
    const result = validate(readFixture("invalid", "not-rss.xml"));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "E002")).toBe(true);
  });

  it("no-channel.xml produces E005", () => {
    const result = validate(readFixture("invalid", "no-channel.xml"));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "E005")).toBe(true);
  });

  it("no-items.xml produces E007", () => {
    const result = validate(readFixture("invalid", "no-items.xml"));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "E007")).toBe(true);
  });

  it("missing-enclosure-attrs.xml produces E010, W011, W012, E013", () => {
    const result = validate(
      readFixture("invalid", "missing-enclosure-attrs.xml")
    );
    expect(result.diagnostics.some((d) => d.id === "E010")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "W011")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "W012")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "E013")).toBe(true);
  });

  it("bad-urls.xml produces E014", () => {
    const result = validate(readFixture("invalid", "bad-urls.xml"));
    expect(result.diagnostics.some((d) => d.id === "E014")).toBe(true);
  });

  it("bad-namespace.xml is invalid (unknown namespace)", () => {
    const result = validate(readFixture("invalid", "bad-namespace.xml"));
    // With a completely unknown namespace, sparkle:* elements aren't found
    // so E008 (missing version) is reported instead of W026
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(true);
  });

  it("dsa-only.xml produces W006", () => {
    const result = validate(readFixture("invalid", "dsa-only.xml"));
    expect(result.diagnostics.some((d) => d.id === "W006")).toBe(true);
  });

  it("bad-rollout.xml produces E020 and E021", () => {
    const result = validate(readFixture("invalid", "bad-rollout.xml"));
    expect(result.diagnostics.some((d) => d.id === "E020")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "E021")).toBe(true);
  });

  it("bad-delta.xml produces E023 and E024", () => {
    const result = validate(readFixture("invalid", "bad-delta.xml"));
    expect(result.diagnostics.some((d) => d.id === "E023")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "E024")).toBe(true);
  });

  it("real-world-broken.xml produces multiple errors and warnings", () => {
    const result = validate(readFixture("invalid", "real-world-broken.xml"));
    // Should have errors
    expect(result.errorCount).toBeGreaterThan(0);
    // Should have warnings
    expect(result.warningCount).toBeGreaterThan(0);
    // Specific checks
    expect(result.diagnostics.some((d) => d.id === "W004")).toBe(true); // bad date
    expect(result.diagnostics.some((d) => d.id === "W011")).toBe(true); // bad min version
    expect(result.diagnostics.some((d) => d.id === "E022")).toBe(true); // bad installationType
    expect(result.diagnostics.some((d) => d.id === "E019")).toBe(true); // bad channel name
  });

  it("sparkle-2.9-errors.xml produces expected warnings", () => {
    const result = validate(readFixture("invalid", "sparkle-2.9-errors.xml"));
    // W003: Missing pubDate
    expect(result.diagnostics.some((d) => d.id === "W003")).toBe(true);
    // W005: Missing signature
    expect(result.diagnostics.some((d) => d.id === "W005")).toBe(true);
    // E021: Phased rollout without pubDate
    expect(result.diagnostics.some((d) => d.id === "E021")).toBe(true);
    // Should still report I006/I007 for the 2.9 features
    expect(result.diagnostics.some((d) => d.id === "I006")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "I007")).toBe(true);
  });

  it("empty-version.xml produces E029", () => {
    const result = validate(readFixture("invalid", "empty-version.xml"));
    expect(result.diagnostics.some((d) => d.id === "E029")).toBe(true);
  });

  it("non-numeric-version.xml produces W027", () => {
    const result = validate(readFixture("invalid", "non-numeric-version.xml"));
    expect(result.diagnostics.some((d) => d.id === "W027")).toBe(true);
  });

  it("version-date-mismatch.xml produces W028", () => {
    const result = validate(
      readFixture("invalid", "version-date-mismatch.xml")
    );
    expect(result.diagnostics.some((d) => d.id === "W028")).toBe(true);
  });

  it("invalid-os.xml produces E030", () => {
    const result = validate(readFixture("invalid", "invalid-os.xml"));
    expect(result.diagnostics.some((d) => d.id === "E030")).toBe(true);
  });

  it("invalid-signature.xml produces W029", () => {
    const result = validate(readFixture("invalid", "invalid-signature.xml"));
    expect(result.diagnostics.some((d) => d.id === "W029")).toBe(true);
  });

  it("suspicious-url-extension.xml produces W030", () => {
    const result = validate(
      readFixture("invalid", "suspicious-url-extension.xml")
    );
    expect(result.diagnostics.some((d) => d.id === "W030")).toBe(true);
  });

  it("delta-missing-version.xml produces W031", () => {
    const result = validate(
      readFixture("invalid", "delta-missing-version.xml")
    );
    expect(result.diagnostics.some((d) => d.id === "W031")).toBe(true);
  });

  it("duplicate-deltas.xml produces W032", () => {
    const result = validate(readFixture("invalid", "duplicate-deltas.xml"));
    expect(result.diagnostics.some((d) => d.id === "W032")).toBe(true);
  });

  it("mixed-protocols.xml produces W035", () => {
    const result = validate(readFixture("invalid", "mixed-protocols.xml"));
    expect(result.diagnostics.some((d) => d.id === "W035")).toBe(true);
  });

  it("unusual-short-version.xml produces W033", () => {
    const result = validate(
      readFixture("invalid", "unusual-short-version.xml")
    );
    expect(result.diagnostics.some((d) => d.id === "W033")).toBe(true);
  });

  it("bad-critical-version.xml produces W034", () => {
    const result = validate(readFixture("invalid", "bad-critical-version.xml"));
    expect(result.diagnostics.some((d) => d.id === "W034")).toBe(true);
  });

  it("unknown-architecture.xml produces W036", () => {
    const result = validate(readFixture("invalid", "unknown-architecture.xml"));
    expect(result.diagnostics.some((d) => d.id === "W036")).toBe(true);
  });

  it("missing-xml-lang.xml produces W037", () => {
    const result = validate(readFixture("invalid", "missing-xml-lang.xml"));
    expect(result.diagnostics.some((d) => d.id === "W037")).toBe(true);
  });

  it("cdata-version.xml produces W038", () => {
    const result = validate(readFixture("invalid", "cdata-version.xml"));
    expect(result.diagnostics.some((d) => d.id === "W038")).toBe(true);
  });

  it("missing-encoding.xml produces W039", () => {
    const result = validate(readFixture("invalid", "missing-encoding.xml"));
    expect(result.diagnostics.some((d) => d.id === "W039")).toBe(true);
  });

  it("inconsistent-language.xml produces W040", () => {
    const result = validate(
      readFixture("invalid", "inconsistent-language.xml")
    );
    expect(result.diagnostics.some((d) => d.id === "W040")).toBe(true);
  });
});
