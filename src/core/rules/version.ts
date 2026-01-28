import type { Diagnostic, XmlDocument, XmlElement } from "../types.js";
import {
  childElements,
  sparkleChildElement,
  textContent,
  sparkleAttr,
  elementPath,
  childElement,
  parseRfc2822Date,
} from "./utils.js";

/**
 * Check if a version string is numeric (can include dots for semver-like versions).
 * Valid: "100", "1.0", "1.0.1", "2023.1"
 * Invalid: "1.0-beta", "v2.0", "1.0rc1"
 */
function isNumericVersion(version: string): boolean {
  return /^\d+(\.\d+)*$/.test(version);
}

/**
 * Compare two version strings numerically.
 * Returns negative if v1 < v2, positive if v1 > v2, 0 if equal.
 * Handles versions like "1.0", "1.0.1", "100", "2023.1"
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split(".").map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) return p1 - p2;
  }
  return 0;
}

/**
 * E008: Item missing sparkle:version (not as element or enclosure attribute)
 * E029: Version string is empty or whitespace-only
 * W007: Redundant version - both element and enclosure attribute with same value
 * W008: Redundant shortVersionString - both element and enclosure attribute with same value
 * W015: Version on enclosure attribute instead of top-level element
 * W020: Duplicate version without differing os/channel
 * W027: Version string is non-numeric (contains letters/symbols)
 * W028: Version decreases while pubDate increases
 */
export function versionRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");
  const versionMap = new Map<string, XmlElement[]>();
  // Track items with valid dates and versions for W028
  const itemsWithDateAndVersion: {
    item: XmlElement;
    version: string;
    date: Date;
  }[] = [];

  for (const item of items) {
    // Gather version from sparkle:version element
    const versionEl = sparkleChildElement(item, "version");
    const versionElText = versionEl ? textContent(versionEl).trim() : undefined;

    // Gather version from enclosure sparkle:version attribute
    const enclosure = childElement(item, "enclosure");
    const enclosureVersion = enclosure
      ? sparkleAttr(enclosure, "version")
      : undefined;

    // E029: Check for empty/whitespace-only versions
    if (versionEl) {
      const rawText = textContent(versionEl);
      if (!rawText || rawText.trim() === "") {
        diagnostics.push({
          id: "E029",
          severity: "error",
          message: "<sparkle:version> element is empty or whitespace-only",
          line: versionEl.line,
          column: versionEl.column,
          path: elementPath(versionEl),
          fix: "Set the version to a valid build number (e.g., 100 or 1.0.0)",
        });
      }
    }
    if (
      enclosure &&
      enclosureVersion !== undefined &&
      enclosureVersion.trim() === ""
    ) {
      diagnostics.push({
        id: "E029",
        severity: "error",
        message: "sparkle:version attribute on enclosure is empty",
        line: enclosure.line,
        column: enclosure.column,
        path: elementPath(enclosure),
        fix: "Set the version to a valid build number (e.g., 100 or 1.0.0)",
      });
    }

    const version = versionElText || enclosureVersion;

    // E008: No version anywhere
    if (!version) {
      diagnostics.push({
        id: "E008",
        severity: "error",
        message:
          "Item is missing sparkle:version (neither element nor enclosure attribute)",
        line: item.line,
        column: item.column,
        path: elementPath(item),
        fix: "Add a <sparkle:version> element or sparkle:version attribute on <enclosure>",
      });
      continue;
    }

    // W027: Non-numeric version string
    if (!isNumericVersion(version)) {
      const versionLocation = versionEl || enclosure;
      diagnostics.push({
        id: "W027",
        severity: "warning",
        message: `Version "${version}" contains non-numeric characters; Sparkle's version comparison may fail`,
        line: versionLocation!.line,
        column: versionLocation!.column,
        path: elementPath(versionLocation!),
        fix: "Use a purely numeric version (e.g., 100 or 1.0.0) for reliable comparisons",
      });
    }

    // Collect date for W028 check
    const pubDateEl = childElement(item, "pubDate");
    if (pubDateEl && isNumericVersion(version)) {
      const dateStr = textContent(pubDateEl).trim();
      const parsedDate = parseRfc2822Date(dateStr);
      if (parsedDate) {
        itemsWithDateAndVersion.push({ item, version, date: parsedDate });
      }
    }

    // W015: Version only on enclosure attribute, not as top-level element
    if (!versionElText && enclosureVersion) {
      diagnostics.push({
        id: "W015",
        severity: "warning",
        message: `Version "${enclosureVersion}" is only specified as an enclosure attribute; prefer a <sparkle:version> element`,
        line: enclosure!.line,
        column: enclosure!.column,
        path: elementPath(enclosure!),
        fix: `Add <sparkle:version>${enclosureVersion}</sparkle:version> as a child of <item>`,
      });
    }

    // W007: Redundant version
    if (
      versionElText &&
      enclosureVersion &&
      versionElText === enclosureVersion
    ) {
      diagnostics.push({
        id: "W007",
        severity: "warning",
        message: `Version "${version}" is declared both as a <sparkle:version> element and enclosure attribute`,
        line: enclosure!.line,
        column: enclosure!.column,
        path: elementPath(enclosure!),
        fix: "Remove the sparkle:version attribute from <enclosure>; the element is sufficient",
      });
    }

    // W008: Redundant shortVersionString
    const svEl = sparkleChildElement(item, "shortVersionString");
    const svElText = svEl ? textContent(svEl).trim() : undefined;
    const enclosureSv = enclosure
      ? sparkleAttr(enclosure, "shortVersionString")
      : undefined;
    if (svElText && enclosureSv && svElText === enclosureSv) {
      diagnostics.push({
        id: "W008",
        severity: "warning",
        message: `shortVersionString "${svElText}" is declared both as element and enclosure attribute`,
        line: enclosure!.line,
        column: enclosure!.column,
        path: elementPath(enclosure!),
        fix: "Remove the sparkle:shortVersionString attribute from <enclosure>",
      });
    }

    // Track versions for W020
    const os = enclosure ? sparkleAttr(enclosure, "os") : undefined;
    const channelEl = sparkleChildElement(item, "channel");
    const channelName = channelEl ? textContent(channelEl).trim() : undefined;
    const key = `${version}|${os || ""}|${channelName || ""}`;
    if (!versionMap.has(key)) {
      versionMap.set(key, []);
    }
    versionMap.get(key)!.push(item);
  }

  // W020: Duplicate version without differing os/channel
  for (const [key, dupes] of versionMap) {
    if (dupes.length > 1) {
      const version = key.split("|")[0];
      for (let i = 1; i < dupes.length; i++) {
        diagnostics.push({
          id: "W020",
          severity: "warning",
          message: `Duplicate version "${version}" found without differing os or channel`,
          line: dupes[i].line,
          column: dupes[i].column,
          path: elementPath(dupes[i]),
          fix: "Ensure each version is unique per os/channel combination, or remove the duplicate item",
        });
      }
    }
  }

  // W028: Version decreases while pubDate increases
  // Sort by date ascending and check if versions are also ascending
  if (itemsWithDateAndVersion.length >= 2) {
    const sortedByDate = [...itemsWithDateAndVersion].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    for (let i = 1; i < sortedByDate.length; i++) {
      const prev = sortedByDate[i - 1];
      const curr = sortedByDate[i];

      // If current date is later but version is lower, that's suspicious
      if (compareVersions(curr.version, prev.version) < 0) {
        diagnostics.push({
          id: "W028",
          severity: "warning",
          message: `Version "${curr.version}" is older than "${prev.version}" but has a newer pubDate`,
          line: curr.item.line,
          column: curr.item.column,
          path: elementPath(curr.item),
          fix: "Verify that the version and pubDate are correct; newer dates should have newer versions",
        });
      }
    }
  }
}
