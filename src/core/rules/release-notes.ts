import type { Diagnostic, XmlDocument } from "../types.js";
import {
  childElements,
  childElement,
  sparkleChildElement,
  textContent,
  elementPath,
} from "./utils.js";

/**
 * W009: No release notes (no description or releaseNotesLink)
 */
export function releaseNotesRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");

  for (const item of items) {
    const description = childElement(item, "description");
    const releaseNotesLink = sparkleChildElement(item, "releaseNotesLink");
    const fullReleaseNotesLink = sparkleChildElement(item, "fullReleaseNotesLink");

    const hasDescription =
      description && textContent(description).trim().length > 0;
    const hasReleaseNotesLink =
      releaseNotesLink && textContent(releaseNotesLink).trim().length > 0;
    const hasFullReleaseNotesLink =
      fullReleaseNotesLink && textContent(fullReleaseNotesLink).trim().length > 0;

    if (!hasDescription && !hasReleaseNotesLink && !hasFullReleaseNotesLink) {
      diagnostics.push({
        id: "W009",
        severity: "warning",
        message:
          "Item has no release notes (no <description>, <sparkle:releaseNotesLink>, or <sparkle:fullReleaseNotesLink>)",
        line: item.line,
        column: item.column,
        path: elementPath(item),
        fix: "Add a <description> with HTML release notes or a <sparkle:releaseNotesLink> URL",
      });
    }
  }
}
