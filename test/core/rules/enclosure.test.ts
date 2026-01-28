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

  it("E011: reports missing length on enclosure", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" type="application/octet-stream" sparkle:edSignature="s"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E011")).toBe(true);
  });

  it("E012: reports missing type on enclosure", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" sparkle:edSignature="s"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E012")).toBe(true);
  });

  it("E013: reports non-numeric length", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="abc" type="application/octet-stream" sparkle:edSignature="s"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E013")).toBe(true);
  });

  it("W005: warns about missing signature", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W005")).toBe(true);
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
      `<enclosure url="https://example.com/a.zip" length="1" type="application/zip" sparkle:edSignature="s"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W010")).toBe(true);
  });

  it("W019: warns about zero length", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="0" type="application/octet-stream" sparkle:edSignature="s"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W019")).toBe(true);
  });

  it("E022: reports invalid installationType", () => {
    const xml = wrap(`
      <sparkle:installationType>invalid-type</sparkle:installationType>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E022")).toBe(true);
  });

  it("accepts valid installationType", () => {
    const xml = wrap(`
      <sparkle:installationType>package</sparkle:installationType>
      <enclosure url="https://example.com/a.pkg" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E022")).toBe(false);
  });

  it("E030: reports invalid sparkle:os value", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:os="linux" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E030")).toBe(true);
  });

  it("accepts valid sparkle:os values", () => {
    const xmlMacos = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:os="macos" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>`
    );
    const xmlWindows = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:os="windows" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>`
    );
    expect(validate(xmlMacos).diagnostics.some((d) => d.id === "E030")).toBe(
      false
    );
    expect(validate(xmlWindows).diagnostics.some((d) => d.id === "E030")).toBe(
      false
    );
  });

  it("W029: warns about invalid base64 signature", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="not-valid-base64!!!"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W029")).toBe(true);
  });

  it("W029: warns about too-short signature", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="abc"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W029")).toBe(true);
  });

  it("accepts valid base64 signature", () => {
    // A valid-looking EdDSA signature (88 chars is typical for Ed25519)
    const validSig =
      "dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmdoZXJlaXNtb3JlY29udGVudHRvbWFrZWl0bG9uZ2Vu";
    const xml = wrap(
      `<enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="${validSig}"/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W029")).toBe(false);
  });

  it("W031: warns about delta referencing non-existent version", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V2</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
      <sparkle:deltas>
        <enclosure url="https://example.com/delta.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="150" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
      </sparkle:deltas>
    </item>
    <item>
      <title>V1</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W031")).toBe(true);
  });

  it("no W031 when delta references existing version", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V2</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
      <sparkle:deltas>
        <enclosure url="https://example.com/delta.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="100" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
      </sparkle:deltas>
    </item>
    <item>
      <title>V1</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W031")).toBe(false);
  });

  it("W032: warns about duplicate delta enclosures for same deltaFrom", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V2</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
      <sparkle:deltas>
        <enclosure url="https://example.com/delta1.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="100" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
        <enclosure url="https://example.com/delta2.zip" length="1" type="application/octet-stream"
                   sparkle:deltaFrom="100" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
      </sparkle:deltas>
    </item>
    <item>
      <title>V1</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="dGVzdHNpZ25hdHVyZWJhc2U2NGVuY29kZWRzdHJpbmc="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W032")).toBe(true);
  });
});
