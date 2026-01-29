import type { Diagnostic, XmlDocument } from "../types.js";
import {
  childElements,
  childElement,
  textContent,
  elementPath,
  sparkleChildElement,
  sparkleChildElements,
  attr,
} from "./utils.js";

/**
 * Check if a version string looks like a typical marketing version (x.y.z format).
 */
function isTypicalMarketingVersion(version: string): boolean {
  // Allow formats like "1.0", "1.0.0", "2.3.4", "10.15.7"
  return /^\d+\.\d+(\.\d+)?$/.test(version);
}

/**
 * Check if a version string is a valid numeric format for criticalUpdate version attr.
 */
function isValidCriticalUpdateVersion(version: string): boolean {
  // Should be a numeric version like "100" or "1.0.1"
  return /^\d+(\.\d+)*$/.test(version);
}

/**
 * W001: Missing <title> on channel
 * W002: Missing <title> on item
 * I011: Missing channel-level <link> (not required by Sparkle)
 * W017: informationalUpdate on item that also has enclosure (only if no version conditions)
 * W033: shortVersionString format unusual (not x.y.z)
 * W034: criticalUpdate has version attr that's not valid format
 * W037: releaseNotesLink missing xml:lang for localization
 * W040: Channel has language but items have different lang
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

  // I011: Channel missing <link> (informational - not required by Sparkle)
  const channelLink = childElement(channel, "link");
  if (!channelLink || !textContent(channelLink).trim()) {
    diagnostics.push({
      id: "I011",
      severity: "info",
      message: "Channel is missing a <link> element",
      line: channel.line,
      column: channel.column,
      path: elementPath(channel),
      fix: "Add a <link> element with your app's homepage URL",
    });
  }

  // Get channel-level language for W040
  const channelLangEl = childElement(channel, "language");
  const channelLang = channelLangEl ? textContent(channelLangEl).trim() : null;
  // Track item languages for W040
  const itemLangs = new Set<string>();

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
    // Only warn if there are NO version conditions (minimumSystemVersion, etc.)
    // because informationalUpdate with enclosure is valid when targeting specific versions
    const informationalUpdate = sparkleChildElement(
      item,
      "informationalUpdate"
    );
    const enclosure = childElement(item, "enclosure");
    if (informationalUpdate && enclosure) {
      // Check for version conditions that would make this combination valid
      const hasMinSystemVersion = sparkleChildElement(
        item,
        "minimumSystemVersion"
      );
      const hasMaxSystemVersion = sparkleChildElement(
        item,
        "maximumSystemVersion"
      );
      const hasMinAutoupdateVersion = sparkleChildElement(
        item,
        "minimumAutoupdateVersion"
      );
      const hasIgnoreSkippedUpgradesBelowVersion = sparkleChildElement(
        item,
        "ignoreSkippedUpgradesBelowVersion"
      );

      const hasVersionConditions =
        hasMinSystemVersion ||
        hasMaxSystemVersion ||
        hasMinAutoupdateVersion ||
        hasIgnoreSkippedUpgradesBelowVersion;

      if (!hasVersionConditions) {
        diagnostics.push({
          id: "W017",
          severity: "warning",
          message:
            "Item has both <sparkle:informationalUpdate> and <enclosure> without version conditions; informational updates typically should not include a download",
          line: informationalUpdate.line,
          column: informationalUpdate.column,
          path: elementPath(informationalUpdate),
          fix: "Remove <enclosure> if this is purely informational, add version conditions if targeting specific versions, or remove <sparkle:informationalUpdate> if a download is intended",
        });
      }
    }

    // W033: shortVersionString format unusual
    const svEl = sparkleChildElement(item, "shortVersionString");
    if (svEl) {
      const sv = textContent(svEl).trim();
      if (sv && !isTypicalMarketingVersion(sv)) {
        diagnostics.push({
          id: "W033",
          severity: "warning",
          message: `shortVersionString "${sv}" has an unusual format`,
          line: svEl.line,
          column: svEl.column,
          path: elementPath(svEl),
          fix: "Marketing versions typically follow x.y or x.y.z format (e.g., 2.0 or 2.0.1)",
        });
      }
    }

    // W034: criticalUpdate version attribute not valid format
    const criticalEl = sparkleChildElement(item, "criticalUpdate");
    if (criticalEl) {
      const versionAttr =
        attr(criticalEl, "version") || attr(criticalEl, "sparkle:version");
      if (versionAttr && !isValidCriticalUpdateVersion(versionAttr)) {
        diagnostics.push({
          id: "W034",
          severity: "warning",
          message: `criticalUpdate version attribute "${versionAttr}" has an invalid format`,
          line: criticalEl.line,
          column: criticalEl.column,
          path: elementPath(criticalEl),
          fix: "Use a numeric version format (e.g., 100 or 1.0.1)",
        });
      }
    }

    // W037: releaseNotesLink missing xml:lang for localization
    const rnLinks = sparkleChildElements(item, "releaseNotesLink");
    if (rnLinks.length > 1) {
      // Multiple releaseNotesLinks suggest localization; check for xml:lang
      for (const rnLink of rnLinks) {
        const xmlLang = attr(rnLink, "xml:lang");
        if (!xmlLang) {
          diagnostics.push({
            id: "W037",
            severity: "warning",
            message:
              "Multiple releaseNotesLink elements found but this one is missing xml:lang attribute",
            line: rnLink.line,
            column: rnLink.column,
            path: elementPath(rnLink),
            fix: 'Add xml:lang attribute (e.g., xml:lang="en" or xml:lang="de")',
          });
        } else {
          itemLangs.add(xmlLang);
        }
      }
    }
  }

  // W040: Channel has language but items have different lang
  if (channelLang && itemLangs.size > 0) {
    const differentLangs = [...itemLangs].filter(
      (lang) => !lang.startsWith(channelLang.split("-")[0])
    );
    if (differentLangs.length > 0) {
      diagnostics.push({
        id: "W040",
        severity: "warning",
        message: `Channel language is "${channelLang}" but items contain different languages: ${differentLangs.join(", ")}`,
        line: channelLangEl!.line,
        column: channelLangEl!.column,
        path: elementPath(channelLangEl!),
        fix: "Ensure language settings are consistent or intentional for localization",
      });
    }
  }
}
