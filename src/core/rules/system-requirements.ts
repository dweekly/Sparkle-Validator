import type { Diagnostic, XmlDocument } from "../types.js";
import { MACOS_VERSION_REGEX } from "../constants.js";
import {
  childElements,
  childElement,
  sparkleChildElement,
  textContent,
  elementPath,
} from "./utils.js";

/**
 * W011: minimumSystemVersion not a valid macOS version format
 * W012: maximumSystemVersion not a valid macOS version format
 * W013: minimumSystemVersion > maximumSystemVersion
 */
export function systemRequirementRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
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

    // W011: minimumSystemVersion format
    if (minVerEl) {
      minVer = textContent(minVerEl).trim();
      if (minVer && !MACOS_VERSION_REGEX.test(minVer)) {
        diagnostics.push({
          id: "W011",
          severity: "warning",
          message: `minimumSystemVersion "${minVer}" is not a valid macOS version format`,
          line: minVerEl.line,
          column: minVerEl.column,
          path: elementPath(minVerEl),
          fix: "Use a version format like 10.13, 11.0, or 14.0",
        });
      }
    }

    // W012: maximumSystemVersion format
    if (maxVerEl) {
      maxVer = textContent(maxVerEl).trim();
      if (maxVer && !MACOS_VERSION_REGEX.test(maxVer)) {
        diagnostics.push({
          id: "W012",
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
    if (minVer && maxVer && MACOS_VERSION_REGEX.test(minVer) && MACOS_VERSION_REGEX.test(maxVer)) {
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
