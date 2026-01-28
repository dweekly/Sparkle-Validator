import { describe, it, expect } from "vitest";
import { validate } from "../../../src/core/validator.js";

const wrap = (itemContent: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>${itemContent}</item>
  </channel>
</rss>`;

describe("version rules", () => {
  it("E008: reports missing version", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(true);
  });

  it("accepts version as sparkle:version element", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(false);
  });

  it("accepts version as enclosure attribute", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream"
                 sparkle:version="100" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(false);
    // Should warn W015 about version only on enclosure
    expect(result.diagnostics.some((d) => d.id === "W015")).toBe(true);
  });

  it("W007: warns about redundant version", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream"
                 sparkle:version="100" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W007")).toBe(true);
  });

  it("W020: warns about duplicate versions", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
    <item>
      <title>V1 dup</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W020")).toBe(true);
  });
});
