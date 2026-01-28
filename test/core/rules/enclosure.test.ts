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
});
