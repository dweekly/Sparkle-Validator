import type { Diagnostic, XmlDocument } from "../types.js";
import { SPARKLE_NS } from "../constants.js";
import { childElements, elementPath } from "./utils.js";

/**
 * E002: Root element must be <rss>
 * E003: Missing version="2.0" on <rss>
 * E004: Missing Sparkle namespace declaration
 * E005: Missing <channel> inside <rss>
 * E006: More than one <channel> element
 * E007: No <item> elements in <channel>
 * W026: Sparkle namespace URI variant (old format or HTTPS)
 */
export function structureRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
): void {
  const { root } = doc;
  if (!root) return; // E001 already reported by parser

  // E002: Root must be <rss>
  if (root.name !== "rss") {
    diagnostics.push({
      id: "E002",
      severity: "error",
      message: `Root element is <${root.qname}>, expected <rss>`,
      line: root.line,
      column: root.column,
      path: elementPath(root),
      fix: "Change the root element to <rss>",
    });
    return; // Can't check further structure
  }

  // E003: version="2.0"
  const version = root.attributes["version"]?.value;
  if (version !== "2.0") {
    diagnostics.push({
      id: "E003",
      severity: "error",
      message: version
        ? `<rss> version is "${version}", expected "2.0"`
        : `<rss> is missing version="2.0" attribute`,
      line: root.line,
      column: root.column,
      path: elementPath(root),
      fix: 'Add version="2.0" to the <rss> element',
    });
  }

  // E004 / E026: Sparkle namespace
  const sparkleNsUri = doc.namespaces["sparkle"];
  if (!sparkleNsUri) {
    diagnostics.push({
      id: "E004",
      severity: "error",
      message: "Missing Sparkle namespace declaration (xmlns:sparkle)",
      line: root.line,
      column: root.column,
      path: elementPath(root),
      fix: `Add xmlns:sparkle="${SPARKLE_NS}" to the <rss> element`,
    });
  } else if (sparkleNsUri !== SPARKLE_NS) {
    // W026: Namespace variant - old format or HTTPS version
    // These work fine with Sparkle; the URI is just an identifier, not fetched
    diagnostics.push({
      id: "W026",
      severity: "warning",
      message: `Sparkle namespace URI "${sparkleNsUri}" differs from canonical "${SPARKLE_NS}"`,
      line: root.line,
      column: root.column,
      path: elementPath(root),
      fix: `Consider using the canonical namespace URI "${SPARKLE_NS}"`,
    });
  }

  // E005/E006: <channel>
  const channels = childElements(root, "channel");
  if (channels.length === 0) {
    diagnostics.push({
      id: "E005",
      severity: "error",
      message: "Missing <channel> element inside <rss>",
      line: root.line,
      column: root.column,
      path: elementPath(root),
      fix: "Add a <channel> element as a child of <rss>",
    });
    return;
  }
  if (channels.length > 1) {
    diagnostics.push({
      id: "E006",
      severity: "error",
      message: `Found ${channels.length} <channel> elements, expected exactly 1`,
      line: channels[1].line,
      column: channels[1].column,
      path: elementPath(channels[1]),
      fix: "Remove extra <channel> elements; RSS 2.0 allows only one",
    });
  }

  // E007: at least one <item>
  const channel = channels[0];
  const items = childElements(channel, "item");
  if (items.length === 0) {
    diagnostics.push({
      id: "E007",
      severity: "error",
      message: "No <item> elements found in <channel>",
      line: channel.line,
      column: channel.column,
      path: elementPath(channel),
      fix: "Add at least one <item> element to the channel",
    });
  }
}
