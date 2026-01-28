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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
      ${itemContent}
    </item>
  </channel>
</rss>`;

describe("best practice rules", () => {
  it("W001: warns about missing channel title", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W001")).toBe(true);
  });

  it("W002: warns about missing item title", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>T</title>
    <link>https://example.com</link>
    <item>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W002")).toBe(true);
  });

  it("W014: warns about missing channel link", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>T</title>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W014")).toBe(true);
  });

  it("W017: warns about informationalUpdate with enclosure", () => {
    const xml = wrap(`<sparkle:informationalUpdate/>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W017")).toBe(true);
  });

  it("W009: warns about missing release notes", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W009")).toBe(true);
  });
});

describe("channel rules", () => {
  it("E019: reports invalid channel name", () => {
    const xml = wrap(`<sparkle:channel>beta channel!</sparkle:channel>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E019")).toBe(true);
  });

  it("accepts valid channel name", () => {
    const xml = wrap(`<sparkle:channel>beta</sparkle:channel>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E019")).toBe(false);
  });
});

describe("rollout rules", () => {
  it("E020: reports non-integer rollout interval", () => {
    const xml = wrap(
      `<sparkle:phasedRolloutInterval>not-a-number</sparkle:phasedRolloutInterval>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E020")).toBe(true);
  });

  it("E021: reports rollout without pubDate", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <sparkle:version>100</sparkle:version>
      <sparkle:phasedRolloutInterval>86400</sparkle:phasedRolloutInterval>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E021")).toBe(true);
  });
});

describe("system requirement rules", () => {
  it("W011: warns about invalid minimumSystemVersion format", () => {
    const xml = wrap(
      `<sparkle:minimumSystemVersion>10.15.x</sparkle:minimumSystemVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W011")).toBe(true);
  });

  it("W013: warns when min > max system version", () => {
    const xml = wrap(`
      <sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>
      <sparkle:maximumSystemVersion>12.0</sparkle:maximumSystemVersion>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W013")).toBe(true);
  });

  it("accepts valid system versions", () => {
    const xml = wrap(`
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
      <sparkle:maximumSystemVersion>14.0</sparkle:maximumSystemVersion>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W011")).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "W012")).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "W013")).toBe(false);
  });
});

describe("info rules", () => {
  it("I001: produces item summary", () => {
    const xml = wrap("");
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I001")).toBe(true);
  });

  it("I004: reports critical update", () => {
    const xml = wrap(`<sparkle:criticalUpdate/>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I004")).toBe(true);
  });

  it("I003: reports phased rollout", () => {
    const xml = wrap(`<sparkle:phasedRolloutInterval>86400</sparkle:phasedRolloutInterval>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I003")).toBe(true);
  });
});
