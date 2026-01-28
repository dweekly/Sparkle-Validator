import { describe, it, expect } from "vitest";
import { validate } from "../../../src/core/validator.js";

describe("structure rules", () => {
  it("E002: reports when root is not <rss>", () => {
    const result = validate(`<feed><entry/></feed>`);
    expect(result.diagnostics.some((d) => d.id === "E002")).toBe(true);
  });

  it("E003: reports missing version attribute", () => {
    const xml = `<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
      <channel><title>T</title><item><sparkle:version>1</sparkle:version>
      <enclosure url="https://x.com/a" length="1" type="application/octet-stream" sparkle:edSignature="s"/></item></channel></rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E003")).toBe(true);
  });

  it("E003: reports wrong version value", () => {
    const xml = `<rss version="1.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
      <channel><title>T</title><item><sparkle:version>1</sparkle:version>
      <enclosure url="https://x.com/a" length="1" type="application/octet-stream" sparkle:edSignature="s"/></item></channel></rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E003")).toBe(true);
  });

  it("E004: reports missing sparkle namespace", () => {
    const xml = `<rss version="2.0"><channel><title>T</title><item><enclosure url="https://x.com/a" length="1" type="t"/></item></channel></rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E004")).toBe(true);
  });

  it("E005: reports missing channel", () => {
    const xml = `<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"></rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E005")).toBe(true);
  });

  it("E006: reports multiple channels", () => {
    const xml = `<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
      <channel><title>T</title><item><sparkle:version>1</sparkle:version>
      <enclosure url="https://x.com/a" length="1" type="application/octet-stream" sparkle:edSignature="s"/></item></channel>
      <channel><title>T2</title><item><sparkle:version>2</sparkle:version>
      <enclosure url="https://x.com/b" length="1" type="application/octet-stream" sparkle:edSignature="s"/></item></channel></rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E006")).toBe(true);
  });

  it("E007: reports no items in channel", () => {
    const xml = `<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
      <channel><title>T</title></channel></rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E007")).toBe(true);
  });

  it("W026: warns about non-canonical sparkle namespace URI", () => {
    // Use the old namespace format (missing www.) - a known variant that works with Sparkle
    const xml = `<rss version="2.0" xmlns:sparkle="http://andymatuschak.org/xml-namespaces/sparkle">
      <channel><title>T</title><item><sparkle:version>1</sparkle:version>
      <enclosure url="https://x.com/a" length="1" type="application/octet-stream" sparkle:edSignature="sig"/></item></channel></rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W026")).toBe(true);
    expect(result.valid).toBe(true); // Should still be valid (warning, not error)
  });
});
