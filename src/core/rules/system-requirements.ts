import type {
  Diagnostic,
  XmlDocument,
  XmlElement,
  ValidationOptions,
  SparkleItemTarget,
} from "../types.js";
import { MACOS_VERSION_REGEX } from "../constants.js";
import {
  childElements,
  childElement,
  sparkleChildElement,
  textContent,
  elementPath,
  sparkleAttr,
  attr,
} from "./utils.js";

/**
 * Get the effective build version of an item.
 * Enclosure version takes precedence over <sparkle:version> element.
 */
function getItemVersion(item: XmlElement): string | undefined {
  const enclosure = childElement(item, "enclosure");
  const encVer = enclosure ? sparkleAttr(enclosure, "version") : undefined;
  if (encVer && encVer.trim().length > 0) return encVer.trim();

  const verEl = sparkleChildElement(item, "version");
  if (verEl) {
    const text = textContent(verEl).trim();
    if (text.length > 0) return text;
  }
  return undefined;
}

/**
 * Get enclosure URL of an item for disambiguation.
 */
function getItemEnclosureUrl(item: XmlElement): string | undefined {
  const enclosure = childElement(item, "enclosure");
  return enclosure ? attr(enclosure, "url") : undefined;
}

/**
 * W013: minimumSystemVersion > maximumSystemVersion
 * W045: minimumSystemVersion not a valid macOS version format
 * W046: maximumSystemVersion not a valid macOS version format
 * E036: Item bundling Sparkle 2.10+ requires macOS >= 12.0
 * E037: Unmatched or ambiguous target Sparkle version configuration
 */
export function systemRequirementRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[],
  options?: ValidationOptions
): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");

  for (const item of items) {
    const minVerEl = sparkleChildElement(item, "minimumSystemVersion");
    const maxVerEl = sparkleChildElement(item, "maximumSystemVersion");

    let minVer: string | undefined;
    let maxVer: string | undefined;

    // W045: minimumSystemVersion format
    if (minVerEl) {
      minVer = textContent(minVerEl).trim();
      if (minVer && !MACOS_VERSION_REGEX.test(minVer)) {
        diagnostics.push({
          id: "W045",
          severity: "warning",
          message: `minimumSystemVersion "${minVer}" is not a valid macOS version format`,
          line: minVerEl.line,
          column: minVerEl.column,
          path: elementPath(minVerEl),
          fix: "Use a version format like 10.13, 11.0, or 14.0",
        });
      }
    }

    // W046: maximumSystemVersion format
    if (maxVerEl) {
      maxVer = textContent(maxVerEl).trim();
      if (maxVer && !MACOS_VERSION_REGEX.test(maxVer)) {
        diagnostics.push({
          id: "W046",
          severity: "warning",
          message: `maximumSystemVersion "${maxVer}" is not a valid macOS version format`,
          line: maxVerEl.line,
          column: maxVerEl.column,
          path: elementPath(maxVerEl),
          fix: "Use a version format like 10.13, 11.0, or 14.0",
        });
      }
    }

    // W013: min > max
    if (
      minVer &&
      maxVer &&
      MACOS_VERSION_REGEX.test(minVer) &&
      MACOS_VERSION_REGEX.test(maxVer)
    ) {
      if (compareVersions(minVer, maxVer) > 0) {
        diagnostics.push({
          id: "W013",
          severity: "warning",
          message: `minimumSystemVersion (${minVer}) is greater than maximumSystemVersion (${maxVer})`,
          line: minVerEl!.line,
          column: minVerEl!.column,
          path: elementPath(minVerEl!),
          fix: "Swap the values or correct the version requirements",
        });
      }
    }
  }

  // Sparkle bundled update context evaluation (Finding 1 & 11)
  const targets: SparkleItemTarget[] = [];
  if (options?.sparkleItemTargets) {
    targets.push(...options.sparkleItemTargets);
  }

  if (options?.targetSparkleVersion) {
    const raw = options.targetSparkleVersion.trim();
    if (raw.includes("=")) {
      const [itemVer, spkVer] = raw.split("=").map((s) => s.trim());
      targets.push({ itemVersion: itemVer, sparkleVersion: spkVer });
    } else if (raw.includes(":")) {
      const [itemVer, spkVer] = raw.split(":").map((s) => s.trim());
      targets.push({ itemVersion: itemVer, sparkleVersion: spkVer });
    } else {
      // Bare version like "2.10.0"
      if (items.length === 1) {
        const itemVer = getItemVersion(items[0]);
        targets.push({ itemVersion: itemVer, sparkleVersion: raw });
      } else if (items.length > 1) {
        diagnostics.push({
          id: "E037",
          severity: "error",
          message: `Ambiguous targetSparkleVersion "${raw}": feed contains ${items.length} items. Specify which item bundles this Sparkle version (e.g. itemVersion=${raw}) to avoid applying constraints to historical releases.`,
          line: channel.line,
          column: channel.column,
          path: elementPath(channel),
          fix: `Use format "itemVersion=${raw}" (e.g. "${getItemVersion(items[0]) || "1.0"}=${raw}")`,
        });
      }
    }
  }

  // Match targets to items and validate OS floor for Sparkle 2.10+
  for (const target of targets) {
    const matched = items.filter((item) => {
      if (target.itemVersion !== undefined) {
        if (getItemVersion(item) !== target.itemVersion) return false;
      }
      if (target.enclosureUrl !== undefined) {
        if (getItemEnclosureUrl(item) !== target.enclosureUrl) return false;
      }
      return true;
    });

    if (matched.length === 0) {
      diagnostics.push({
        id: "E037",
        severity: "error",
        message: `No item in feed matches target selector: itemVersion="${target.itemVersion ?? ""}" ${target.enclosureUrl ? `enclosureUrl="${target.enclosureUrl}"` : ""}`,
        line: channel.line,
        column: channel.column,
        path: elementPath(channel),
        fix: "Ensure the item version or enclosure URL matches an item in the feed",
      });
      continue;
    }

    if (matched.length > 1) {
      diagnostics.push({
        id: "E037",
        severity: "error",
        message:
          `Ambiguous target selector: ${matched.length} items match selector ${target.itemVersion ? `itemVersion="${target.itemVersion}"` : ""} ${target.enclosureUrl ? `enclosureUrl="${target.enclosureUrl}"` : ""}`.trim(),
        line: channel.line,
        column: channel.column,
        path: elementPath(channel),
        fix: "Ensure target selector unambiguously identifies a single item",
      });
    }

    for (const targetItem of matched) {
      if (compareVersions(target.sparkleVersion, "2.10") >= 0) {
        const minVerEl = sparkleChildElement(
          targetItem,
          "minimumSystemVersion"
        );
        const minVer = minVerEl ? textContent(minVerEl).trim() : undefined;
        const itemVer = getItemVersion(targetItem) || "unknown";

        if (!minVer || minVer.length === 0) {
          diagnostics.push({
            id: "E036",
            severity: "error",
            message: `Item version "${itemVer}" bundles Sparkle ${target.sparkleVersion} which requires macOS 12.0 or later, but no <sparkle:minimumSystemVersion> is specified`,
            line: targetItem.line,
            column: targetItem.column,
            path: elementPath(targetItem),
            fix: "Add <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>",
          });
        } else if (!MACOS_VERSION_REGEX.test(minVer)) {
          diagnostics.push({
            id: "E036",
            severity: "error",
            message: `Item version "${itemVer}" bundles Sparkle ${target.sparkleVersion} which requires macOS 12.0 or later, but minimumSystemVersion "${minVer}" is invalid`,
            line: minVerEl!.line,
            column: minVerEl!.column,
            path: elementPath(minVerEl!),
            fix: "Use a valid macOS version format of at least 12.0",
          });
        } else if (compareVersions(minVer, "12.0") < 0) {
          diagnostics.push({
            id: "E036",
            severity: "error",
            message: `Item version "${itemVer}" bundles Sparkle ${target.sparkleVersion} which requires macOS 12.0 or later, but minimumSystemVersion is set to "${minVer}"`,
            line: minVerEl!.line,
            column: minVerEl!.column,
            path: elementPath(minVerEl!),
            fix: "Set <sparkle:minimumSystemVersion> to at least 12.0",
          });
        }
      }
    }
  }
}

/**
 * Compare two dot-separated version strings.
 * Returns -1, 0, or 1.
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aN = aParts[i] ?? 0;
    const bN = bParts[i] ?? 0;
    if (aN < bN) return -1;
    if (aN > bN) return 1;
  }
  return 0;
}
