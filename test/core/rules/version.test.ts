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

  it("E029: reports empty sparkle:version element", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>   </sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E029")).toBe(true);
  });

  it("E029: reports empty sparkle:version attribute", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream"
                 sparkle:version="" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E029")).toBe(true);
  });

  it("W027: warns about non-numeric version strings", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>1.0-beta</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W027")).toBe(true);
  });

  it("W027: accepts purely numeric versions", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>1.0.1</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W027")).toBe(false);
  });

  it("W028: warns when version decreases while pubDate increases", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>Older version with newer date</title>
      <pubDate>Fri, 14 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>99</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
    <item>
      <title>Newer version with older date</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W028")).toBe(true);
  });

  it("W028: no warning when versions and dates are consistent", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>Newer version with newer date</title>
      <pubDate>Fri, 14 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>101</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
    <item>
      <title>Older version with older date</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W028")).toBe(false);
  });
});
