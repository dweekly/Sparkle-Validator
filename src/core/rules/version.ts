import type { Diagnostic, XmlDocument, XmlElement } from "../types.js";
import {
  childElements,
  sparkleChildElement,
  textContent,
  sparkleAttr,
  elementPath,
  childElement,
  parseRfc2822Date,
  isNumericVersion,
  compareVersions,
  getEffectiveVersion,
} from "./utils.js";

/**
 * E008: Item missing sparkle:version and cannot be deduced from filename
 * E029: Version string is empty or whitespace-only
 * W007: Redundant version - both element and enclosure attribute with same value
 * W008: Redundant shortVersionString - both element and enclosure attribute with same value
 * W018: Items not sorted by version descending (Sparkle sorts by version, not date)
 * W020: Duplicate version without differing os/channel
 * W027: Version string is non-numeric (contains letters/symbols)
 * W028: Version decreases while pubDate increases (accounting for update branches)
 * W041: Version missing but can be deduced from filename (undocumented Sparkle fallback)
 * W044: Conflicting version - element and enclosure attribute have different values
 * W047: Version only in enclosure attribute, not as sparkle:version element
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
  // Track items with versions for W018 (version sort check)
  const itemsWithVersions: {
    item: XmlElement;
    version: string;
    channel: string | undefined;
  }[] = [];

  for (const item of items) {
    const versionEl = sparkleChildElement(item, "version");
    const enclosure = childElement(item, "enclosure");

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
    if (enclosure) {
      const rawEncVer = sparkleAttr(enclosure, "version");
      if (rawEncVer !== undefined && rawEncVer.trim() === "") {
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
    }

    const eff = getEffectiveVersion(item);

    if (!eff.version) {
      // E008: No version and can't deduce from filename
      diagnostics.push({
        id: "E008",
        severity: "error",
        message:
          "Item is missing sparkle:version (neither element nor enclosure attribute, and cannot be deduced from filename)",
        line: item.line,
        column: item.column,
        path: elementPath(item),
        fix: "Add a <sparkle:version> element or sparkle:version attribute on <enclosure>",
      });
      continue;
    }

    if (eff.source === "filename") {
      // W041: Version deduced from filename (undocumented Sparkle fallback)
      diagnostics.push({
        id: "W041",
        severity: "warning",
        message: `Item has no sparkle:version; Sparkle may deduce "${eff.filenameVersion}" from filename, but this is undocumented and not officially supported`,
        line: item.line,
        column: item.column,
        path: elementPath(item),
        fix: `Add <sparkle:version>${eff.filenameVersion}</sparkle:version> explicitly; do not rely on undocumented filename parsing behavior`,
      });
    }

    // W044: Conflicting version between element and enclosure attribute
    if (eff.hasConflict) {
      diagnostics.push({
        id: "W044",
        severity: "warning",
        message: `Conflicting version: <sparkle:version> element has "${eff.elementVersion}" but enclosure sparkle:version attribute has "${eff.enclosureVersion}". Sparkle prioritizes the enclosure attribute ("${eff.enclosureVersion}")`,
        line: enclosure!.line,
        column: enclosure!.column,
        path: elementPath(enclosure!),
        fix: "Ensure <sparkle:version> and enclosure sparkle:version match, or remove one",
      });
    } else if (eff.elementVersion && eff.enclosureVersion) {
      // W007: Redundant version (both element and enclosure attribute with same value)
      diagnostics.push({
        id: "W007",
        severity: "warning",
        message: `Version "${eff.version}" is declared both as a <sparkle:version> element and enclosure attribute`,
        line: enclosure!.line,
        column: enclosure!.column,
        path: elementPath(enclosure!),
        fix: "Remove the sparkle:version attribute from <enclosure>; the element is sufficient",
      });
    } else if (!eff.elementVersion && eff.enclosureVersion) {
      // W047: Version only in enclosure attribute, not as sparkle:version element
      diagnostics.push({
        id: "W047",
        severity: "warning",
        message: `Version "${eff.enclosureVersion}" is only specified as enclosure attribute, not as <sparkle:version> element`,
        line: enclosure!.line,
        column: enclosure!.column,
        path: elementPath(enclosure!),
        fix: `Add <sparkle:version>${eff.enclosureVersion}</sparkle:version> element for clarity`,
      });
    }

    // Effective version for subsequent checks (enclosure attribute takes precedence in Sparkle)
    const version = eff.version;

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

    // Track for W018 (version sort check)
    if (isNumericVersion(version)) {
      itemsWithVersions.push({ item, version, channel: channelName });
    }
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
  // Now accounts for update branches - only check within same channel
  if (itemsWithDateAndVersion.length >= 2) {
    // Group by channel to account for update branches
    const byChannel = new Map<string, typeof itemsWithDateAndVersion>();
    for (const entry of itemsWithDateAndVersion) {
      const channelEl = sparkleChildElement(entry.item, "channel");
      const channel = channelEl ? textContent(channelEl).trim() : "";
      if (!byChannel.has(channel)) {
        byChannel.set(channel, []);
      }
      byChannel.get(channel)!.push(entry);
    }

    // Check within each channel
    for (const [, channelItems] of byChannel) {
      if (channelItems.length < 2) continue;

      const sortedByDate = [...channelItems].sort(
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
            fix: "Verify that the version and pubDate are correct; newer dates should have newer versions (within the same channel)",
          });
        }
      }
    }
  }

  // W018: Check version sort order (should be highest version first)
  // Only check items on the same channel
  if (itemsWithVersions.length >= 2) {
    // Group by channel
    const byChannel = new Map<
      string,
      { item: XmlElement; version: string }[]
    >();
    for (const entry of itemsWithVersions) {
      const ch = entry.channel || "";
      if (!byChannel.has(ch)) {
        byChannel.set(ch, []);
      }
      byChannel.get(ch)!.push(entry);
    }

    // Check sort order within each channel
    for (const [, channelItems] of byChannel) {
      if (channelItems.length < 2) continue;

      let sorted = true;
      for (let i = 1; i < channelItems.length; i++) {
        if (
          compareVersions(
            channelItems[i].version,
            channelItems[i - 1].version
          ) > 0
        ) {
          sorted = false;
          break;
        }
      }

      if (!sorted) {
        diagnostics.push({
          id: "W018",
          severity: "warning",
          message:
            "Items are not sorted by version in descending order (highest version first)",
          line: channelItems[0].item.line,
          column: channelItems[0].item.column,
          path: elementPath(channelItems[0].item),
          fix: "Sort <item> elements so the highest version appears first (Sparkle sorts by version, not date)",
        });
      }
    }
  }
}
