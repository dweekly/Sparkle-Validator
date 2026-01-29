import { describe, it, expect } from "vitest";
import { validate } from "../../../src/core/validator.js";

const wrap = (itemContent: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      ${itemContent}
    </item>
  </channel>
</rss>`;

describe("enclosure rules", () => {
  it("E009: reports missing enclosure and link", () => {
    const xml = wrap("");
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E009")).toBe(true);
  });

  it("does not report E009 when link is present", () => {
    const xml = wrap(`<link>https://example.com/download</link>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E009")).toBe(false);
  });

  it("E010: reports missing url on enclosure", () => {
    const xml = wrap(`<enclosure length="1" type="application/octet-stream"/>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E010")).toBe(true);
  });

  it("W011: warns about missing length on enclosure", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W011")).toBe(true);
  });

  it("W012: warns about missing type on enclosure", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W012")).toBe(true);
  });

  it("E013: reports non-numeric length", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="abc" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E013")).toBe(true);
  });

  it("I010: reports missing signature as info (signatures are optional)", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I010")).toBe(true);
    // Should be info, not warning
    const diag = result.diagnostics.find((d) => d.id === "I010");
    expect(diag?.severity).toBe("info");
  });

  it("W006: warns about DSA-only signature", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:dsaSignature="MC0="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W006")).toBe(true);
  });

  it("W010: warns about non-standard MIME type", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/zip" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W010")).toBe(true);
  });

  it("W019: warns about zero length", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="0" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W019")).toBe(true);
  });

  it("E022: reports invalid installationType", () => {
    const xml = wrap(`
      <sparkle:installationType>invalid-type</sparkle:installationType>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E022")).toBe(true);
  });

  it("accepts valid installationType", () => {
    const xml = wrap(`
      <sparkle:installationType>package</sparkle:installationType>
      <enclosure url="https://example.com/a.pkg" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E022")).toBe(false);
  });

  it("E030: reports invalid sparkle:os value", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:os="linux" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E030")).toBe(true);
  });

  it("accepts valid sparkle:os values (but warns W043)", () => {
    const xmlMacos = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:os="macos" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const xmlWindows = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:os="windows" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    // No E030 for valid values
    expect(validate(xmlMacos).diagnostics.some((d) => d.id === "E030")).toBe(
      false
    );
    expect(validate(xmlWindows).diagnostics.some((d) => d.id === "E030")).toBe(
      false
    );
    // But W043 warning for deprecated sparkle:os usage
    expect(validate(xmlMacos).diagnostics.some((d) => d.id === "W043")).toBe(
      true
    );
    expect(validate(xmlWindows).diagnostics.some((d) => d.id === "W043")).toBe(
      true
    );
  });

  it("W043: warns about sparkle:os attribute being deprecated", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:os="macos" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W043")).toBe(true);
    expect(result.diagnostics.find((d) => d.id === "W043")?.message).toContain(
      "deprecated"
    );
  });

  it("no W043 when sparkle:os not present", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W043")).toBe(false);
  });

  it("E031: errors on invalid base64 signature", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="not-valid-base64!!!"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E031")).toBe(true);
    expect(result.valid).toBe(false); // Should be error, not warning
  });

  it("E031: errors on wrong-length Ed25519 signature", () => {
    // Ed25519 must be exactly 64 bytes; this is too short
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="YWJjZGVmZ2hpamtsbW5vcA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E031")).toBe(true);
    const diag = result.diagnostics.find((d) => d.id === "E031");
    expect(diag?.message).toContain("64 bytes");
  });

  it("accepts valid Ed25519 signature (exactly 64 bytes)", () => {
    // Ed25519 signatures are exactly 64 bytes = 88 base64 chars with == padding
    const validSig =
      "eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==";
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="${validSig}"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E031")).toBe(false);
  });

  it("I012: reports delta referencing non-existent version as info", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V2</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      <sparkle:deltas>
        <enclosure url="https://example.com/delta.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="150" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      </sparkle:deltas>
    </item>
    <item>
      <title>V1</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I012")).toBe(true);
    expect(result.diagnostics.find((d) => d.id === "I012")?.severity).toBe(
      "info"
    );
  });

  it("no I012 when delta references existing version", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V2</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      <sparkle:deltas>
        <enclosure url="https://example.com/delta.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="100" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      </sparkle:deltas>
    </item>
    <item>
      <title>V1</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I012")).toBe(false);
  });

  it("W032: warns about duplicate delta enclosures for same deltaFrom", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V2</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      <sparkle:deltas>
        <enclosure url="https://example.com/delta1.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="100" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
        <enclosure url="https://example.com/delta2.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="100" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      </sparkle:deltas>
    </item>
    <item>
      <title>V1</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W032")).toBe(true);
  });
});
