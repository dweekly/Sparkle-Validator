import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  validate,
  consolidateDiagnostics,
} from "../../../src/core/validator.js";
import { RULE_CATALOG } from "../../../src/core/rules/catalog.js";

describe("Rule ID Catalog & Lossless Reporting (R06)", () => {
  it("has strictly unique rule IDs across all rule files", () => {
    const rulesDir = join(process.cwd(), "src/core/rules");
    const ruleFiles = readdirSync(rulesDir).filter(
      (f) =>
        f.endsWith(".ts") &&
        f !== "utils.ts" &&
        f !== "index.ts" &&
        f !== "catalog.ts"
    );

    const emittedIds = new Map<string, string[]>();

    for (const file of ruleFiles) {
      const content = readFileSync(join(rulesDir, file), "utf-8");
      // Match diagnostic id declarations: id: "E001" or id: "W011"
      const idMatches = content.matchAll(/id:\s*"([EWI]\d{3})"/g);
      for (const match of idMatches) {
        const id = match[1];
        const files = emittedIds.get(id) || [];
        if (!files.includes(file)) {
          files.push(file);
        }
        emittedIds.set(id, files);
      }
    }

    const collisions: string[] = [];
    for (const [id, files] of emittedIds.entries()) {
      if (files.length > 1) {
        collisions.push(`${id} is shared by ${files.join(", ")}`);
      }
    }

    expect(collisions).toEqual([]);
  });

  it("reports missing enclosure length/type and invalid min/max OS as 4 distinct diagnostics (R06 counterexample)", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Test App</title>
    <link>https://example.com</link>
    <item>
      <title>v1.0</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <sparkle:minimumSystemVersion>invalid-min-os</sparkle:minimumSystemVersion>
      <sparkle:maximumSystemVersion>invalid-max-os</sparkle:maximumSystemVersion>
      <description>Notes</description>
      <!-- Enclosure is missing length and type attributes -->
      <enclosure url="https://example.com/app.zip"
                 sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==" />
    </item>
  </channel>
</rss>`;

    const result = validate(xml);
    const ids = result.diagnostics.map((d) => d.id);

    // All 4 distinct diagnostics must be present
    expect(ids).toContain("W011"); // Missing enclosure length
    expect(ids).toContain("W012"); // Missing enclosure type
    expect(ids).toContain("W045"); // Invalid minimumSystemVersion
    expect(ids).toContain("W046"); // Invalid maximumSystemVersion

    // Ensure none of them clobbered each other
    const w011 = result.diagnostics.find((d) => d.id === "W011");
    const w012 = result.diagnostics.find((d) => d.id === "W012");
    const w045 = result.diagnostics.find((d) => d.id === "W045");
    const w046 = result.diagnostics.find((d) => d.id === "W046");

    expect(w011?.message).toContain("length");
    expect(w012?.message).toContain("type");
    expect(w045?.message).toContain("minimumSystemVersion");
    expect(w046?.message).toContain("maximumSystemVersion");
  });

  it("preserves every occurrence losslessly without discarding line numbers or messages", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Test App</title>
    <link>https://example.com</link>
    <item>
      <title>v2.0</title>
      <pubDate>Fri, 14 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <description>Notes</description>
      <enclosure url="https://example.com/v2.zip"
                 type="application/octet-stream"
                 sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==" />
    </item>
    <item>
      <title>v1.0</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <description>Notes</description>
      <enclosure url="https://example.com/v1.zip"
                 type="application/octet-stream"
                 sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==" />
    </item>
  </channel>
</rss>`;

    const result = validate(xml);
    const w011Occurrences = result.diagnostics.filter((d) => d.id === "W011");

    // Both occurrences must be preserved in result.diagnostics
    expect(w011Occurrences.length).toBe(2);
    expect(w011Occurrences[0].line).toBeDefined();
    expect(w011Occurrences[1].line).toBeDefined();
    expect(w011Occurrences[0].line).not.toEqual(w011Occurrences[1].line);
    expect(w011Occurrences[0].message).not.toContain("similar issue");

    // Consolidate presentation helper can group them when called explicitly
    const consolidated = consolidateDiagnostics(result.diagnostics);
    const consolidatedW011 = consolidated.filter((d) => d.id === "W011");
    expect(consolidatedW011.length).toBe(1);
    expect(consolidatedW011[0].message).toContain("and 1 more similar issue");
  });

  it("RULE_CATALOG includes all defined rule IDs with valid metadata", () => {
    expect(Object.keys(RULE_CATALOG).length).toBeGreaterThan(50);
    for (const [id, meta] of Object.entries(RULE_CATALOG)) {
      expect(meta.id).toBe(id);
      expect(["error", "warning", "info"]).toContain(meta.severity);
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("reconciles RULE_CATALOG against all diagnostic IDs emitted in src/core", () => {
    const srcDir = join(process.cwd(), "src/core");
    const tsFiles: string[] = [];

    function collectFiles(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(full);
        } else if (entry.name.endsWith(".ts") && entry.name !== "catalog.ts") {
          tsFiles.push(full);
        }
      }
    }
    collectFiles(srcDir);

    const emittedIds = new Set<string>();
    for (const file of tsFiles) {
      const content = readFileSync(file, "utf-8");
      for (const m of content.matchAll(/id:\s*["']([EWI]\d{3})["']/g)) {
        emittedIds.add(m[1]);
      }
      for (const m of content.matchAll(
        /validateResourceUrl\([^,]+,\s*["']([EWI]\d{3})["']/g
      )) {
        emittedIds.add(m[1]);
      }
    }

    // Every diagnostic ID emitted in code must exist in RULE_CATALOG
    for (const id of emittedIds) {
      expect(
        RULE_CATALOG[id],
        `Emitted rule ID ${id} must exist in RULE_CATALOG`
      ).toBeDefined();
    }
  });

  it("accurately describes E014-E025, W007, and W008 in RULE_CATALOG", () => {
    // E014-E018: URL rules
    expect(RULE_CATALOG.E014.name).toBe("invalid-enclosure-url");
    expect(RULE_CATALOG.E014.description).toContain("enclosure URL");

    expect(RULE_CATALOG.E015.name).toBe("invalid-link-url");
    expect(RULE_CATALOG.E015.description).toContain("link URL");

    expect(RULE_CATALOG.E016.name).toBe("invalid-release-notes-url");
    expect(RULE_CATALOG.E016.description).toContain("releaseNotesLink");

    expect(RULE_CATALOG.E017.name).toBe("invalid-full-release-notes-url");
    expect(RULE_CATALOG.E017.description).toContain("fullReleaseNotesLink");

    expect(RULE_CATALOG.E018.name).toBe("invalid-delta-enclosure-url");
    expect(RULE_CATALOG.E018.description).toContain("delta enclosure URL");

    // E019: Channel name
    expect(RULE_CATALOG.E019.name).toBe("invalid-channel-name");
    expect(RULE_CATALOG.E019.description).toContain("channel name");

    // E022: installationType
    expect(RULE_CATALOG.E022.name).toBe("invalid-installation-type");
    expect(RULE_CATALOG.E022.description).toContain("installationType");

    // E023-E025: Delta update structure
    expect(RULE_CATALOG.E023.name).toBe("deltas-missing-enclosure");
    expect(RULE_CATALOG.E024.name).toBe("delta-missing-delta-from");
    expect(RULE_CATALOG.E025.name).toBe("delta-missing-url");

    // W007, W008
    expect(RULE_CATALOG.W007.name).toBe("redundant-version-declaration");
    expect(RULE_CATALOG.W007.description).toContain("enclosure attribute");
    expect(RULE_CATALOG.W008.name).toBe("redundant-short-version-string");
    expect(RULE_CATALOG.W008.description).toContain("shortVersionString");
  });

  it("emits E015, E019, and E022 for matching diagnostics as defined in catalog", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Test App</title>
    <link>not-a-valid-url</link>
    <item>
      <title>v1.0</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>100</sparkle:version>
      <sparkle:channel>invalid channel name with spaces!</sparkle:channel>
      <sparkle:installationType>invalid-type</sparkle:installationType>
      <enclosure url="https://example.com/app.zip"
                 length="1234"
                 type="application/octet-stream"
                 sparkle:edSignature="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA==" />
    </item>
  </channel>
</rss>`;

    const result = validate(xml);
    const ids = result.diagnostics.map((d) => d.id);

    expect(ids).toContain("E015");
    expect(ids).toContain("E019");
    expect(ids).toContain("E022");

    const e015 = result.diagnostics.find((d) => d.id === "E015");
    const e019 = result.diagnostics.find((d) => d.id === "E019");
    const e022 = result.diagnostics.find((d) => d.id === "E022");

    expect(e015?.message).toContain("<link>");
    expect(e019?.message).toContain("channel name");
    expect(e022?.message).toContain("installationType");
  });
});
