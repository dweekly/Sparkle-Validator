import type { Diagnostic, XmlDocument } from "../types.js";
import {
  childElements,
  childElement,
  sparkleChildElement,
  textContent,
  elementPath,
  isNonNegativeInteger,
} from "./utils.js";

/**
 * E020: sparkle:phasedRolloutInterval not a valid non-negative integer
 * E021: Phased rollout present but item has no <pubDate>
 */
export function rolloutRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");

  for (const item of items) {
    const rolloutEl = sparkleChildElement(item, "phasedRolloutInterval");
    if (!rolloutEl) continue;

    const value = textContent(rolloutEl).trim();

    // E020: Must be valid non-negative integer
    if (!isNonNegativeInteger(value)) {
      diagnostics.push({
        id: "E020",
        severity: "error",
        message: `sparkle:phasedRolloutInterval "${value}" is not a valid non-negative integer`,
        line: rolloutEl.line,
        column: rolloutEl.column,
        path: elementPath(rolloutEl),
        fix: "Set to an integer representing seconds (e.g., 86400 for 1 day)",
      });
    }

    // E021: Requires pubDate
    const pubDateEl = childElement(item, "pubDate");
    if (!pubDateEl || !textContent(pubDateEl).trim()) {
      diagnostics.push({
        id: "E021",
        severity: "error",
        message: "Phased rollout requires a <pubDate> on the item",
        line: rolloutEl.line,
        column: rolloutEl.column,
        path: elementPath(rolloutEl),
        fix: "Add a <pubDate> element to this item",
      });
    }
  }
}
