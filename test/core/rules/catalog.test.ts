import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { validate, consolidateDiagnostics } from "../../../src/core/validator.js";

describe("Rule ID Catalog & Lossless Reporting (R06)", () => {
  it("has strictly unique rule IDs across all rule files", () => {
    const rulesDir = join(process.cwd(), "src/core/rules");
    const ruleFiles = readdirSync(rulesDir).filter(
      (f) => f.endsWith(".ts") && f !== "utils.ts" && f !== "index.ts"
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
});
