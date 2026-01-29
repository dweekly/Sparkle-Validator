import { describe, it, expect } from "vitest";
import { validate } from "../../../src/core/validator.js";

const wrap = (itemContent: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>${itemContent}</item>
  </channel>
</rss>`;

describe("version rules", () => {
  it("E008: reports missing version when cannot deduce from filename", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("W041: warns when version can be deduced from filename", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/MyApp_2.5.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W041")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(false);
    expect(result.valid).toBe(true); // Warning, not error
    // Check the deduced version is in the message
    const w041 = result.diagnostics.find((d) => d.id === "W041");
    expect(w041?.message).toContain("2.5");
  });

  it("W041: handles multiple underscores in filename", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/My_Cool_App_1.2.3.dmg" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W041")).toBe(true);
    const w041 = result.diagnostics.find((d) => d.id === "W041");
    expect(w041?.message).toContain("1.2.3"); // Takes last component
  });

  it("E008: fails when filename has no underscore", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/MyApp-v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(true);
    expect(result.diagnostics.some((d) => d.id === "W041")).toBe(false);
  });

  it("accepts version as sparkle:version element", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
                 sparkle:version="100" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E008")).toBe(false);
    // W015 was removed - enclosure attribute is actually the primary location Sparkle checks
  });

  it("W007: warns about redundant version", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream"
                 sparkle:version="100" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>V1 dup</title>
      <pubDate>Wed, 12 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
                 sparkle:version="" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>Newer version with older date</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>Older version with older date</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W028")).toBe(false);
  });

  it("W028: no warning for different channels (update branches)", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>Stable release</title>
      <pubDate>Fri, 14 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>99</sparkle:version>
      <sparkle:channel>stable</sparkle:channel>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>Beta release (older date but higher version)</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <sparkle:channel>beta</sparkle:channel>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    // No W028 because items are on different channels
    expect(result.diagnostics.some((d) => d.id === "W028")).toBe(false);
  });

  it("W042: warns when version only in enclosure attribute", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream"
                 sparkle:version="100" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W042")).toBe(true);
  });

  it("no W042 when version is in sparkle:version element", () => {
    const xml = wrap(`
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W042")).toBe(false);
  });

  it("W018: warns when items not sorted by version", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>Lower version first</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>99</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>Higher version second (wrong order)</title>
      <pubDate>Fri, 14 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W018")).toBe(true);
  });

  it("no W018 when items properly sorted by version descending", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>Higher version first</title>
      <pubDate>Fri, 14 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>Lower version second</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>99</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/b.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W018")).toBe(false);
  });
});
