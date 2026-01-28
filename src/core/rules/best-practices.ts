import type { Diagnostic, XmlDocument } from "../types.js";
import {
  childElements,
  childElement,
  textContent,
  elementPath,
  sparkleChildElement,
} from "./utils.js";

/**
 * W001: Missing <title> on channel
 * W002: Missing <title> on item
 * W014: Missing channel-level <link>
 * W017: informationalUpdate on item that also has enclosure
 */
export function bestPracticeRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  // W001: Channel missing <title>
  const channelTitle = childElement(channel, "title");
  if (!channelTitle || !textContent(channelTitle).trim()) {
    diagnostics.push({
      id: "W001",
      severity: "warning",
      message: "Channel is missing a <title> element",
      line: channel.line,
      column: channel.column,
      path: elementPath(channel),
      fix: "Add a <title> element with your app name",
    });
  }

  // W014: Channel missing <link>
  const channelLink = childElement(channel, "link");
  if (!channelLink || !textContent(channelLink).trim()) {
    diagnostics.push({
      id: "W014",
      severity: "warning",
      message: "Channel is missing a <link> element",
      line: channel.line,
      column: channel.column,
      path: elementPath(channel),
      fix: "Add a <link> element with your app's homepage URL",
    });
  }

  const items = childElements(channel, "item");

  for (const item of items) {
    // W002: Item missing <title>
    const itemTitle = childElement(item, "title");
    if (!itemTitle || !textContent(itemTitle).trim()) {
      diagnostics.push({
        id: "W002",
        severity: "warning",
        message: "Item is missing a <title> element",
        line: item.line,
        column: item.column,
        path: elementPath(item),
        fix: "Add a <title> element (e.g., 'Version 2.0')",
      });
    }

    // W017: informationalUpdate on item that also has enclosure
    const informationalUpdate = sparkleChildElement(item, "informationalUpdate");
    const enclosure = childElement(item, "enclosure");
    if (informationalUpdate && enclosure) {
      diagnostics.push({
        id: "W017",
        severity: "warning",
        message: "Item has both <sparkle:informationalUpdate> and <enclosure>; informational updates typically should not include a download",
        line: informationalUpdate.line,
        column: informationalUpdate.column,
        path: elementPath(informationalUpdate),
        fix: "Remove <enclosure> if this is purely informational, or remove <sparkle:informationalUpdate> if a download is intended",
      });
    }
  }
}
