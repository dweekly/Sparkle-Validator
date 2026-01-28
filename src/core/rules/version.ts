import type { Diagnostic, XmlDocument, XmlElement } from "../types.js";
import {
  childElements,
  sparkleChildElement,
  textContent,
  sparkleAttr,
  elementPath,
  childElement,
} from "./utils.js";

/**
 * E008: Item missing sparkle:version (not as element or enclosure attribute)
 * W007: Redundant version - both element and enclosure attribute with same value
 * W008: Redundant shortVersionString - both element and enclosure attribute with same value
 * W015: Version on enclosure attribute instead of top-level element
 * W020: Duplicate version without differing os/channel
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

  for (const item of items) {
    // Gather version from sparkle:version element
    const versionEl = sparkleChildElement(item, "version");
    const versionElText = versionEl ? textContent(versionEl).trim() : undefined;

    // Gather version from enclosure sparkle:version attribute
    const enclosure = childElement(item, "enclosure");
    const enclosureVersion = enclosure
      ? sparkleAttr(enclosure, "version")
      : undefined;

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
}
