import { describe, it, expect } from "vitest";
import { validate } from "../../src/core/validator.js";

describe("validate", () => {
  const MINIMAL_VALID = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>App</title>
    <link>https://example.com</link>
    <item>
      <title>Version 1.0</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description><![CDATA[<p>Notes</p>]]></description>
      <enclosure url="https://example.com/app.zip"
                 length="12345"
                 type="application/octet-stream"
                 sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==" />
    </item>
  </channel>
</rss>`;

  it("returns valid=true for a correct minimal appcast", () => {
    const result = validate(MINIMAL_VALID);
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("returns valid=false for malformed XML", () => {
    const result = validate("<rss><unclosed>");
    expect(result.valid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("returns valid=false when root is not <rss>", () => {
    const result = validate(`<feed><entry/></feed>`);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "E002")).toBe(true);
  });

  it("returns diagnostics sorted by severity then line", () => {
    const result = validate(MINIMAL_VALID);
    const severityOrder = { error: 0, warning: 1, info: 2 };
    for (let i = 1; i < result.diagnostics.length; i++) {
      const prev = severityOrder[result.diagnostics[i - 1].severity];
      const curr = severityOrder[result.diagnostics[i].severity];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it("counts errors, warnings, and info correctly", () => {
    const result = validate(MINIMAL_VALID);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    const warnings = result.diagnostics.filter((d) => d.severity === "warning");
    const infos = result.diagnostics.filter((d) => d.severity === "info");
    expect(result.errorCount).toBe(errors.length);
    expect(result.warningCount).toBe(warnings.length);
    expect(result.infoCount).toBe(infos.length);
  });

  it("produces I001 summary info for valid feed", () => {
    const result = validate(MINIMAL_VALID);
    expect(result.diagnostics.some((d) => d.id === "I001")).toBe(true);
  });
});
