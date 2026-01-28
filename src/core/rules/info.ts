import type { Diagnostic, XmlDocument } from "../types.js";
import {
  childElements,
  childElement,
  sparkleChildElement,
  textContent,
  elementPath,
  sparkleAttr,
} from "./utils.js";

/**
 * I001: Summary: N items across M channels
 * I002: Item contains N delta updates
 * I003: Item uses phased rollout
 * I004: Item marked as critical update
 * I005: Item targets specific OS
 */
export function infoRules(doc: XmlDocument, diagnostics: Diagnostic[]): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");
  const channelNames = new Set<string>();

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
}
