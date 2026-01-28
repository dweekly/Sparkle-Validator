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

  it("missing-enclosure-attrs.xml produces E010, E011, E012, E013", () => {
    const result = validate(
      readFixture("invalid", "missing-enclosure-attrs.xml")
    );
    expect(result.diagnostics.some((d) => d.id === "E010")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "E011")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "E012")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "E013")).toBe(true);
  });

  it("bad-urls.xml produces E014", () => {
    const result = validate(readFixture("invalid", "bad-urls.xml"));
    expect(result.diagnostics.some((d) => d.id === "E014")).toBe(true);
  });

  it("bad-namespace.xml produces E026", () => {
    const result = validate(readFixture("invalid", "bad-namespace.xml"));
    expect(result.diagnostics.some((d) => d.id === "E026")).toBe(true);
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
});
