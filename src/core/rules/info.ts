import type { Diagnostic, XmlDocument } from "../types.js";
import {
  childElements,
  childElement,
  sparkleChildElement,
  textContent,
  elementPath,
  sparkleAttr,
  isNumericVersion,
  compareVersions,
  getEffectiveVersion,
} from "./utils.js";

/** Known/supported hardware requirement values (Sparkle 2.9+ documents "arm64") */
const KNOWN_HARDWARE_REQUIREMENTS = new Set(["arm64"]);

/**
 * I001: Summary: N items across M channels
 * I002: Item contains N delta updates
 * I003: Item uses phased rollout
 * I004: Item marked as critical update
 * I005: Item targets non-macOS platform
 * I006: Item requires specific hardware (Sparkle 2.9+)
 * I007: Item requires minimum app version to update (Sparkle 2.9+)
 * I008: Feed contains >50 items
 * I009: Summary of OS support range across all items
 * W036: hardwareRequirements contains unknown architecture or is empty
 * W048: minimumUpdateVersion is empty or non-numeric
 * W049: minimumUpdateVersion is greater than item version
 */
export function infoRules(doc: XmlDocument, diagnostics: Diagnostic[]): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");
  const channelNames = new Set<string>();
  // Track OS requirements for I009
  const minOsVersions = new Set<string>();
  const maxOsVersions = new Set<string>();

  for (const item of items) {
    // Collect channel names
    const channelEl = sparkleChildElement(item, "channel");
    if (channelEl) {
      const name = textContent(channelEl).trim();
      if (name) channelNames.add(name);
    }

    // I002: Delta updates
    const deltasEl = sparkleChildElement(item, "deltas");
    if (deltasEl) {
      const deltaCount = childElements(deltasEl, "enclosure").length;
      if (deltaCount > 0) {
        diagnostics.push({
          id: "I002",
          severity: "info",
          message: `Item contains ${deltaCount} delta update${deltaCount > 1 ? "s" : ""}`,
          line: deltasEl.line,
          column: deltasEl.column,
          path: elementPath(deltasEl),
        });
      }
    }

    // I003: Phased rollout
    const rolloutEl = sparkleChildElement(item, "phasedRolloutInterval");
    if (rolloutEl) {
      const interval = textContent(rolloutEl).trim();
      const days = interval ? Math.round(parseInt(interval, 10) / 86400) : 0;
      diagnostics.push({
        id: "I003",
        severity: "info",
        message: `Item uses phased rollout${days > 0 ? ` over ~${days} day${days > 1 ? "s" : ""}` : ""}`,
        line: rolloutEl.line,
        column: rolloutEl.column,
        path: elementPath(rolloutEl),
      });
    }

    // I004: Critical update
    const criticalEl = sparkleChildElement(item, "criticalUpdate");
    if (criticalEl) {
      diagnostics.push({
        id: "I004",
        severity: "info",
        message: "Item is marked as a critical update",
        line: criticalEl.line,
        column: criticalEl.column,
        path: elementPath(criticalEl),
      });
    }

    // I005: OS-specific (only flag non-macos targets as notable)
    const enclosure = childElement(item, "enclosure");
    if (enclosure) {
      const os = sparkleAttr(enclosure, "os");
      // Only flag if targeting non-macOS (sparkle:os="macos" is redundant/default)
      if (os && os.toLowerCase() !== "macos") {
        diagnostics.push({
          id: "I005",
          severity: "info",
          message: `Item targets non-macOS platform: "${os}"`,
          line: enclosure.line,
          column: enclosure.column,
          path: elementPath(enclosure),
        });
      }
    }

    // I006: Hardware requirements (Sparkle 2.9+)
    const hardwareEl = sparkleChildElement(item, "hardwareRequirements");
    if (hardwareEl) {
      const requirements = textContent(hardwareEl).trim();
      diagnostics.push({
        id: "I006",
        severity: "info",
        message: `Item requires specific hardware: "${requirements}"`,
        line: hardwareEl.line,
        column: hardwareEl.column,
        path: elementPath(hardwareEl),
      });

      // W036: Check for unknown architecture values
      // Sparkle documents and supports "arm64" for Apple Silicon hardware requirements.
      // Use exact token matching (not substring matching) to avoid accepting "not-arm64".
      const archValues = requirements
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      if (archValues.length === 0) {
        diagnostics.push({
          id: "W036",
          severity: "warning",
          message: "<sparkle:hardwareRequirements> element is empty",
          line: hardwareEl.line,
          column: hardwareEl.column,
          path: elementPath(hardwareEl),
          fix: 'Specify "arm64" for Apple silicon or remove the element',
        });
      }

      for (const arch of archValues) {
        if (!KNOWN_HARDWARE_REQUIREMENTS.has(arch.toLowerCase())) {
          diagnostics.push({
            id: "W036",
            severity: "warning",
            message: `Unknown hardware architecture "${arch}" in hardwareRequirements (Sparkle documents "arm64" for Apple silicon)`,
            line: hardwareEl.line,
            column: hardwareEl.column,
            path: elementPath(hardwareEl),
            fix: 'Expected "arm64" for Apple silicon',
          });
        }
      }
    }

    // Collect OS version requirements for I009
    const minSysEl = sparkleChildElement(item, "minimumSystemVersion");
    if (minSysEl) {
      const version = textContent(minSysEl).trim();
      if (version) minOsVersions.add(version);
    }
    const maxSysEl = sparkleChildElement(item, "maximumSystemVersion");
    if (maxSysEl) {
      const version = textContent(maxSysEl).trim();
      if (version) maxOsVersions.add(version);
    }

    // I007, W048, W049: Minimum update version (Sparkle 2.9+)
    const minUpdateEl = sparkleChildElement(item, "minimumUpdateVersion");
    if (minUpdateEl) {
      const minVersion = textContent(minUpdateEl).trim();
      if (!minVersion) {
        diagnostics.push({
          id: "W048",
          severity: "warning",
          message: "<sparkle:minimumUpdateVersion> element is empty",
          line: minUpdateEl.line,
          column: minUpdateEl.column,
          path: elementPath(minUpdateEl),
          fix: "Specify a valid version number or remove the <sparkle:minimumUpdateVersion> element",
        });
      } else {
        diagnostics.push({
          id: "I007",
          severity: "info",
          message: `Item requires app version ${minVersion} or later to update`,
          line: minUpdateEl.line,
          column: minUpdateEl.column,
          path: elementPath(minUpdateEl),
        });

        if (!isNumericVersion(minVersion)) {
          diagnostics.push({
            id: "W048",
            severity: "warning",
            message: `minimumUpdateVersion "${minVersion}" contains non-numeric characters; Sparkle's version comparison may fail`,
            line: minUpdateEl.line,
            column: minUpdateEl.column,
            path: elementPath(minUpdateEl),
            fix: "Use a numeric version (e.g., 100 or 1.0.0)",
          });
        } else {
          // Compare with item's own effective version
          const itemEff = getEffectiveVersion(item);
          if (itemEff.version && isNumericVersion(itemEff.version)) {
            if (compareVersions(minVersion, itemEff.version) > 0) {
              diagnostics.push({
                id: "W049",
                severity: "warning",
                message: `minimumUpdateVersion "${minVersion}" is greater than item version "${itemEff.version}"; update may be unreachable`,
                line: minUpdateEl.line,
                column: minUpdateEl.column,
                path: elementPath(minUpdateEl),
                fix: `Set minimumUpdateVersion to a version lower than or equal to "${itemEff.version}"`,
              });
            }
          }
        }
      }
    }
  }

  // I001: Summary
  if (items.length > 0) {
    const channelInfo =
      channelNames.size > 0
        ? ` across ${channelNames.size + 1} channel${channelNames.size + 1 > 1 ? "s" : ""} (default${channelNames.size > 0 ? ", " + [...channelNames].join(", ") : ""})`
        : "";
    diagnostics.push({
      id: "I001",
      severity: "info",
      message: `Found ${items.length} item${items.length > 1 ? "s" : ""}${channelInfo}`,
      line: channel.line,
      column: channel.column,
      path: elementPath(channel),
    });
  }

  // I008: Large feed warning
  if (items.length > 50) {
    diagnostics.push({
      id: "I008",
      severity: "info",
      message: `Feed contains ${items.length} items; large feeds may cause performance issues`,
      line: channel.line,
      column: channel.column,
      path: elementPath(channel),
    });
  }

  // I009: OS support range summary
  if (minOsVersions.size > 0 || maxOsVersions.size > 0) {
    const sortedMin = [...minOsVersions].sort();
    const sortedMax = [...maxOsVersions].sort();
    let osInfo = "";
    if (sortedMin.length > 0) {
      osInfo += `minimum: ${sortedMin[0]}`;
      if (sortedMin.length > 1) {
        osInfo += ` to ${sortedMin[sortedMin.length - 1]}`;
      }
    }
    if (sortedMax.length > 0) {
      if (osInfo) osInfo += ", ";
      osInfo += `maximum: ${sortedMax[0]}`;
      if (sortedMax.length > 1) {
        osInfo += ` to ${sortedMax[sortedMax.length - 1]}`;
      }
    }
    diagnostics.push({
      id: "I009",
      severity: "info",
      message: `OS version requirements across items: ${osInfo}`,
      line: channel.line,
      column: channel.column,
      path: elementPath(channel),
    });
  }
}
