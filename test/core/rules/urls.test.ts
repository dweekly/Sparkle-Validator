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

describe("URL rules", () => {
  it("E014: reports invalid enclosure URL", () => {
    const xml = wrap(
      `<enclosure url="not-a-url" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E014")).toBe(true);
  });

  it("E014: reports relative enclosure URL", () => {
    const xml = wrap(
      `<enclosure url="downloads/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E014")).toBe(true);
  });

  it("accepts valid https URL", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E014")).toBe(false);
  });

  it("E016: reports invalid releaseNotesLink URL", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink>not a url</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E016")).toBe(true);
  });

  it("W016: warns about unencoded special characters in URL", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/app with spaces.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W016")).toBe(true);
  });

  it("W030: warns about suspicious .html extension on enclosure URL", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/download.html" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W030")).toBe(true);
  });

  it("W030: warns about suspicious .jpg extension on enclosure URL", () => {
    const xml = wrap(
      `<enclosure url="https://example.com/image.jpg" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W030")).toBe(true);
  });

  it("no W030 warning for expected download extensions", () => {
    const extensions = [".zip", ".dmg", ".pkg", ".tar.gz"];
    for (const ext of extensions) {
      const xml = wrap(
        `<enclosure url="https://example.com/app${ext}" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
      );
      const result = validate(xml);
      expect(result.diagnostics.some((d) => d.id === "W030")).toBe(false);
    }
  });

  it("W035: warns about mixed HTTP and HTTPS URLs", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      <sparkle:releaseNotesLink>http://example.com/notes.html</sparkle:releaseNotesLink>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W035")).toBe(true);
  });

  it("no W035 warning when all URLs use HTTPS", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><link>https://example.com</link>
    <item>
      <title>V1</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
      <sparkle:releaseNotesLink>https://example.com/notes.html</sparkle:releaseNotesLink>
    </item>
  </channel>
</rss>`;
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "W035")).toBe(false);
  });

  it("E014: rejects feed: scheme for enclosure downloads", () => {
    const xml = wrap(
      `<enclosure url="feed://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>`
    );
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E014")).toBe(true);
    expect(result.diagnostics.find((d) => d.id === "E014")?.message).toContain(
      "feed:"
    );
  });

  it("E016: rejects feed: and javascript: schemes for release notes", () => {
    const xmlFeed = wrap(`
      <sparkle:releaseNotesLink>feed://example.com/notes.html</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    expect(validate(xmlFeed).diagnostics.some((d) => d.id === "E016")).toBe(
      true
    );

    const xmlJs = wrap(`
      <sparkle:releaseNotesLink>javascript:alert(1)</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    expect(validate(xmlJs).diagnostics.some((d) => d.id === "E016")).toBe(true);
  });

  it("E016: inspects all localized releaseNotesLinks and catches later invalid URLs (Finding 12)", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink xml:lang="en">https://example.com/notes-en.html</sparkle:releaseNotesLink>
      <sparkle:releaseNotesLink xml:lang="de">javascript:bad</sparkle:releaseNotesLink>
      <enclosure url="https://example.com/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml);
    expect(result.diagnostics.some((d) => d.id === "E016")).toBe(true);
  });

  it("resolves relative URLs against baseUrl and emits W014 warning", () => {
    const xml = wrap(`
      <sparkle:releaseNotesLink>notes.html</sparkle:releaseNotesLink>
      <enclosure url="downloads/app.zip" length="1" type="application/octet-stream" sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA=="/>
    `);
    const result = validate(xml, {
      baseUrl: "https://example.com/updates/appcast.xml",
    });
    // Should NOT error with E014 or E016
    expect(result.diagnostics.some((d) => d.id === "E014")).toBe(false);
    expect(result.diagnostics.some((d) => d.id === "E016")).toBe(false);
    // Should warn with W014
    expect(result.diagnostics.some((d) => d.id === "W014")).toBe(true);
    const w014Enclosure = result.diagnostics.find(
      (d) => d.id === "W014" && d.message.includes("downloads/app.zip")
    );
    expect(w014Enclosure?.message).toContain(
      "https://example.com/updates/downloads/app.zip"
    );
  });
});
