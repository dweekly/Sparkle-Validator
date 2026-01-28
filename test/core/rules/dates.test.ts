import { describe, it, expect } from "vitest";
import { validate } from "../../../src/core/validator.js";

const wrap = (itemContent: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      ${itemContent}
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;

describe("date rules", () => {
  it("W003: warns about missing pubDate", () => {
    const xml = wrap("");
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W003")).toBe(true);
  });

  it("W004: warns about non-RFC 2822 date", () => {
    const xml = wrap(`<pubDate>2023-07-13T14:30:00Z</pubDate>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W004")).toBe(true);
  });

  it("accepts valid RFC 2822 date", () => {
    const xml = wrap(`<pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W004")).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "W003")).toBe(false);
  });

  it("W018: warns about unsorted items", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>Old</title>
      <pubDate>Mon, 01 Jan 2024 10:00:00 -0800</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
    <item>
      <title>New</title>
      <pubDate>Fri, 15 Mar 2024 10:00:00 -0800</pubDate>
      <sparkle:version>200</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W018")).toBe(true);
  });

  it("W025: warns about future pubDate", () => {
    // Create a date 1 year in the future
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toUTCString().replace("GMT", "+0000");

    const xml = wrap(`<pubDate>${futureDateStr}</pubDate>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W025")).toBe(true);
  });

  it("W026: warns about implausibly old pubDate", () => {
    const xml = wrap(`<pubDate>Thu, 13 Jul 1995 14:30:00 -0700</pubDate>`);
    const result = validate(xml);
    const diag = result.diagnostics.find((d) => d.id === "W026");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("1995");
    expect(diag?.message).toContain("implausibly old");
  });

  it("accepts dates from 2001 onwards", () => {
    const xml = wrap(`<pubDate>Thu, 13 Jul 2006 14:30:00 -0700</pubDate>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W026")).toBe(false);
  });
});
