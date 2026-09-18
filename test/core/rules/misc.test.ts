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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W002")).toBe(true);
  });

  it("I011: reports missing channel link as info", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>T</title>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I011")).toBe(true);
    expect(result.diagnostics.find((d) => d.id === "I011")?.severity).toBe(
      "info"
    );
  });

  it("W017: warns about informationalUpdate with enclosure (no version conditions)", () => {
    const xml = wrap(`<sparkle:informationalUpdate/>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W017")).toBe(true);
  });

  it("no W017 when informationalUpdate has version conditions", () => {
    // With nested sparkle:version inside informationalUpdate
    const xmlWithVersion = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <sparkle:informationalUpdate>
        <sparkle:version>90</sparkle:version>
      </sparkle:informationalUpdate>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    expect(
      validate(xmlWithVersion).diagnostics.some((d) => d.id === "W017")
    ).toBe(false);

    // With nested sparkle:belowVersion inside informationalUpdate
    const xmlWithBelowVersion = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <sparkle:informationalUpdate>
        <sparkle:belowVersion>95</sparkle:belowVersion>
      </sparkle:informationalUpdate>
      <description>x</description>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    expect(
      validate(xmlWithBelowVersion).diagnostics.some((d) => d.id === "W017")
    ).toBe(false);
  });

  it("W009: warns about missing release notes", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W009")).toBe(true);
  });

  it("E033: reports malformed signature on sparkle:releaseNotesLink", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink sparkle:edSignature="invalid-sig!">https://example.com/notes.html</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E033")).toBe(true);
  });

  it("E034: reports non-integer sparkle:length on releaseNotesLink", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink sparkle:length="abc">https://example.com/notes.html</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E034")).toBe(true);
  });

  it("W050: warns when sparkle:length is 0 on releaseNotesLink", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink sparkle:length="0">https://example.com/notes.html</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W050")).toBe(true);
  });

  it("W051: warns when unqualified length is used on releaseNotesLink", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink length="500">https://example.com/notes.html</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W051")).toBe(true);
  });

  it("E035: reports missing signature or length on releaseNotesLink in signed-feed mode", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink>https://example.com/notes.html</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml, { requireSignedFeed: true });
    expect(result.diagnostics.some((d) => d.id === "E035")).toBe(true);
  });

  it("passes signed-feed mode when releaseNotesLink has valid sparkle:edSignature and sparkle:length", () => {
    const validSig =
      "eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==";
    const xml = wrap(`
      <sparkle:releaseNotesLink sparkle:edSignature="${validSig}" sparkle:length="1024">https://example.com/notes.html</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="${validSig}"/>
    `);
    const result = validate(xml, { requireSignedFeed: true });
    expect(result.diagnostics.some((d) => d.id === "E035")).toBe(false);
    expect(result.valid).toBe(true);
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
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E021")).toBe(true);
  });
});

describe("system requirement rules", () => {
  it("W045: warns about invalid minimumSystemVersion format", () => {
    const xml = wrap(
      `<sparkle:minimumSystemVersion>10.15.x</sparkle:minimumSystemVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W045")).toBe(true);
  });

  it("W046: warns about invalid maximumSystemVersion format", () => {
    const xml = wrap(
      `<sparkle:maximumSystemVersion>10.15.beta</sparkle:maximumSystemVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W046")).toBe(true);
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
    expect(result.diagnostics.some((d) => d.id === "W045")).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "W046")).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "W013")).toBe(false);
  });

  describe("Sparkle 2.10 update context (E036, E037)", () => {
    it("E036: errors when an update bundling Sparkle 2.10 lacks minimumSystemVersion", () => {
      const xml = wrap(`
        <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      `);
      const result = validate(xml, { targetSparkleVersion: "2.10.0" });
      expect(result.diagnostics.some((d) => d.id === "E036")).toBe(true);
      expect(result.valid).toBe(false);
    });

    it("E036: errors when an update bundling Sparkle 2.10 has minimumSystemVersion < 12.0", () => {
      const xml = wrap(`
        <sparkle:minimumSystemVersion>10.15</sparkle:minimumSystemVersion>
        <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      `);
      const result = validate(xml, { targetSparkleVersion: "2.10.0" });
      expect(result.diagnostics.some((d) => d.id === "E036")).toBe(true);
      expect(
        result.diagnostics.find((d) => d.id === "E036")?.message
      ).toContain("12.0");
    });

    it("passes when an update bundling Sparkle 2.10 has minimumSystemVersion >= 12.0", () => {
      const xml = wrap(`
        <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
        <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      `);
      const result = validate(xml, { targetSparkleVersion: "2.10.0" });
      expect(result.diagnostics.some((d) => d.id === "E036")).toBe(false);
    });

    it("mixed history: diagnoses only targeted 2.10 update while preserving older pre-12 release", () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>App</title><link>https://example.com</link>
    <item>
      <title>Version 2.0 (Bundling Sparkle 2.10)</title>
      <pubDate>Thu, 15 Aug 2026 12:00:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
      <description>Update notes</description>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>Version 1.0 (Historical release)</title>
      <pubDate>Wed, 10 May 2023 12:00:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <sparkle:minimumSystemVersion>10.13</sparkle:minimumSystemVersion>
      <description>Old notes</description>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
      // Target only version 200 as bundling Sparkle 2.10
      const result = validate(xml, { targetSparkleVersion: "200=2.10.0" });
      const e036s = result.diagnostics.filter((d) => d.id === "E036");
      expect(e036s.length).toBe(1);
      expect(e036s[0].message).toContain("200");
      // Version 100 must NOT have E036
      expect(
        result.diagnostics.some(
          (d) => d.id === "E036" && d.message.includes("100")
        )
      ).toBe(false);
    });

    it("E037: errors when targetSparkleVersion is ambiguous on multi-item feed without item selector", () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>App</title><link>https://example.com</link>
    <item>
      <title>V2</title><pubDate>Thu, 15 Aug 2026 12:00:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version><description>x</description>
      <enclosure url="https://example.com/v2.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
    <item>
      <title>V1</title><pubDate>Wed, 10 May 2023 12:00:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version><description>x</description>
      <enclosure url="https://example.com/v1.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
      const result = validate(xml, { targetSparkleVersion: "2.10.0" });
      expect(result.diagnostics.some((d) => d.id === "E037")).toBe(true);
      expect(
        result.diagnostics.find((d) => d.id === "E037")?.message
      ).toContain("Ambiguous");
    });

    it("E037: errors when selector does not match any item in feed", () => {
      const xml = wrap(`
        <sparkle:version>100</sparkle:version>
        <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      `);
      const result = validate(xml, { targetSparkleVersion: "999=2.10.0" });
      expect(result.diagnostics.some((d) => d.id === "E037")).toBe(true);
      expect(
        result.diagnostics.find((d) => d.id === "E037")?.message
      ).toContain("No item in feed matches");
    });
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
    const xml = wrap(
      `<sparkle:phasedRolloutInterval>86400</sparkle:phasedRolloutInterval>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I003")).toBe(true);
  });

  it("I006: reports hardware requirements (Sparkle 2.9+)", () => {
    const xml = wrap(
      `<sparkle:hardwareRequirements>arm64</sparkle:hardwareRequirements>`
    );
    const result = validate(xml);
    const diag = result.diagnostics.find((d) => d.id === "I006");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("arm64");
  });

  it("I007: reports minimum update version (Sparkle 2.9+)", () => {
    const xml = wrap(
      `<sparkle:minimumUpdateVersion>50</sparkle:minimumUpdateVersion>`
    );
    const result = validate(xml);
    const diag = result.diagnostics.find((d) => d.id === "I007");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("50");
  });

  it("I008: reports large feed (>50 items)", () => {
    // Create a feed with 51 items
    const items = Array(51)
      .fill(null)
      .map(
        (_, i) => `
        <item>
          <title>V${i}</title>
          <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
          <sparkle:version>${100 + i}</sparkle:version>
          <enclosure url="https://example.com/${i}.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
        </item>
      `
      )
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    ${items}
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I008")).toBe(true);
  });

  it("I009: reports OS version requirements", () => {
    const xml = wrap(
      `<sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "I009")).toBe(true);
  });

  it("W036: warns about unknown hardware architecture", () => {
    const xml = wrap(
      `<sparkle:hardwareRequirements>powerpc</sparkle:hardwareRequirements>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W036")).toBe(true);
  });

  it("W036: warns about not-arm64 (token matching prevents substring bypass)", () => {
    const xml = wrap(
      `<sparkle:hardwareRequirements>not-arm64</sparkle:hardwareRequirements>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W036")).toBe(true);
  });

  it("W036: warns about empty hardwareRequirements", () => {
    const xml = wrap(
      `<sparkle:hardwareRequirements>   </sparkle:hardwareRequirements>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W036")).toBe(true);
  });

  it("no W036 warning for arm64 (case-insensitive)", () => {
    const xmlLower = wrap(
      `<sparkle:hardwareRequirements>arm64</sparkle:hardwareRequirements>`
    );
    expect(validate(xmlLower).diagnostics.some((d) => d.id === "W036")).toBe(
      false
    );

    const xmlUpper = wrap(
      `<sparkle:hardwareRequirements>ARM64</sparkle:hardwareRequirements>`
    );
    expect(validate(xmlUpper).diagnostics.some((d) => d.id === "W036")).toBe(
      false
    );
  });

  it("W048: warns about empty minimumUpdateVersion", () => {
    const xml = wrap(
      `<sparkle:minimumUpdateVersion></sparkle:minimumUpdateVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W048")).toBe(true);
  });

  it("W048: warns about non-numeric minimumUpdateVersion", () => {
    const xml = wrap(
      `<sparkle:minimumUpdateVersion>2.0-beta</sparkle:minimumUpdateVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W048")).toBe(true);
  });

  it("W049: warns when minimumUpdateVersion is greater than item version", () => {
    const xml = wrap(
      `<sparkle:minimumUpdateVersion>200</sparkle:minimumUpdateVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W049")).toBe(true);
  });

  it("no W048/W049 warning when minimumUpdateVersion is valid and <= item version", () => {
    const xml = wrap(
      `<sparkle:minimumUpdateVersion>50</sparkle:minimumUpdateVersion>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W048")).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "W049")).toBe(false);
  });
});

describe("additional best practice rules", () => {
  it("W033: warns about unusual shortVersionString format", () => {
    const xml = wrap(
      `<sparkle:shortVersionString>v2.0-beta</sparkle:shortVersionString>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W033")).toBe(true);
  });

  it("no W033 warning for standard x.y.z format", () => {
    const xml = wrap(
      `<sparkle:shortVersionString>2.0.1</sparkle:shortVersionString>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W033")).toBe(false);
  });

  it("W034: warns about invalid criticalUpdate version attribute", () => {
    const xml = wrap(`<sparkle:criticalUpdate version="v1.0-alpha"/>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W034")).toBe(true);
  });

  it("no W034 warning for valid criticalUpdate version", () => {
    const xml = wrap(`<sparkle:criticalUpdate version="100"/>`);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W034")).toBe(false);
  });

  it("W037: warns about missing xml:lang on multiple releaseNotesLinks", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink>https://example.com/notes-en.html</sparkle:releaseNotesLink>
      <sparkle:releaseNotesLink>https://example.com/notes-de.html</sparkle:releaseNotesLink>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W037")).toBe(true);
  });

  it("no W037 warning when xml:lang is present on multiple releaseNotesLinks", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink xml:lang="en">https://example.com/notes-en.html</sparkle:releaseNotesLink>
      <sparkle:releaseNotesLink xml:lang="de">https://example.com/notes-de.html</sparkle:releaseNotesLink>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W037")).toBe(false);
  });
});

describe("XML format rules", () => {
  it("W039: warns about missing encoding in XML declaration", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W039")).toBe(true);
  });

  it("no W039 warning when encoding is present", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W039")).toBe(false);
  });

  it("W038: warns about CDATA in sparkle:version element", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version><![CDATA[100]]></sparkle:version>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W038")).toBe(true);
  });
});
