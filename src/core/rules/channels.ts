import type { Diagnostic, XmlDocument } from "../types.js";
import {
  childElements,
  childElement,
  sparkleChildElement,
  textContent,
  elementPath,
} from "./utils.js";

/**
 * E019: <sparkle:channel> contains invalid characters
 * Channel names should be alphanumeric with hyphens/underscores.
 */
export function channelRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");

  for (const item of items) {
    const channelEl = sparkleChildElement(item, "channel");
    if (!channelEl) continue;

    const channelName = textContent(channelEl).trim();
    if (!channelName) continue;

    // Channel names should be simple identifiers
    const validChannelPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
    if (!validChannelPattern.test(channelName)) {
      diagnostics.push({
        id: "E019",
        severity: "error",
        message: `Invalid sparkle:channel name "${channelName}"; must contain only alphanumeric characters, hyphens, underscores, or dots`,
        line: channelEl.line,
        column: channelEl.column,
        path: elementPath(channelEl),
        fix: "Use a simple identifier like 'beta', 'nightly', or 'release-candidate'",
      });
    }
  }
}
