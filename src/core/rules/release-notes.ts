import type { Diagnostic, XmlDocument, ValidationOptions } from "../types.js";
import {
  childElements,
  childElement,
  sparkleChildElements,
  textContent,
  elementPath,
  sparkleAttr,
  attr,
  isNonNegativeInteger,
} from "./utils.js";
import { validateSignature } from "../signature.js";

/**
 * W009: No release notes (no description or releaseNotesLink)
 * E033: Release note signature is malformed
 * E034: Release note length is not a valid non-negative integer
 * E035: Missing required signature or length in signed-feed mode
 * W050: Release note length is 0
 * W051: Unqualified length attribute on releaseNotesLink
 */
export function releaseNotesRules(
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
    const description = childElement(item, "description");
    const releaseNotesLinks = sparkleChildElements(item, "releaseNotesLink");
    const fullReleaseNotesLinks = sparkleChildElements(
      item,
      "fullReleaseNotesLink"
    );

    const hasDescription =
      description && textContent(description).trim().length > 0;
    const hasReleaseNotesLink = releaseNotesLinks.some(
      (el) => textContent(el).trim().length > 0
    );
    const hasFullReleaseNotesLink = fullReleaseNotesLinks.some(
      (el) => textContent(el).trim().length > 0
    );

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

    const allNoteLinks = [...releaseNotesLinks, ...fullReleaseNotesLinks];
    for (const noteLink of allNoteLinks) {
      const edSig = sparkleAttr(noteLink, "edSignature");
      const dsaSig = sparkleAttr(noteLink, "dsaSignature");

      if (edSig !== undefined) {
        const res = validateSignature(edSig, "ed");
        if (!res.valid) {
          diagnostics.push({
            id: "E033",
            severity: "error",
            message: `Invalid sparkle:edSignature on <${noteLink.qname}>: ${res.reason}`,
            line: noteLink.line,
            column: noteLink.column,
            path: elementPath(noteLink),
            fix: "Ed25519 signatures must be exactly 64 bytes encoded as base64 (88 characters)",
          });
        }
      }

      if (dsaSig !== undefined) {
        const res = validateSignature(dsaSig, "dsa");
        if (!res.valid) {
          diagnostics.push({
            id: "E033",
            severity: "error",
            message: `Invalid sparkle:dsaSignature on <${noteLink.qname}>: ${res.reason}`,
            line: noteLink.line,
            column: noteLink.column,
            path: elementPath(noteLink),
            fix: "Ensure the signature is a valid base64-encoded DSA signature",
          });
        }
      }

      const lengthAttr = sparkleAttr(noteLink, "length");
      const unqualifiedLength = attr(noteLink, "length");

      if (unqualifiedLength !== undefined && lengthAttr === undefined) {
        diagnostics.push({
          id: "W051",
          severity: "warning",
          message: `<${noteLink.qname}> uses unqualified length attribute; should be qualified as sparkle:length`,
          line: noteLink.line,
          column: noteLink.column,
          path: elementPath(noteLink),
          fix: 'Change length="..." to sparkle:length="..."',
        });
      }

      if (lengthAttr !== undefined) {
        if (!isNonNegativeInteger(lengthAttr)) {
          diagnostics.push({
            id: "E034",
            severity: "error",
            message: `sparkle:length "${lengthAttr}" on <${noteLink.qname}> is not a valid non-negative integer`,
            line: noteLink.line,
            column: noteLink.column,
            path: elementPath(noteLink),
            fix: "Set sparkle:length to the file size in bytes (a non-negative integer)",
          });
        } else if (lengthAttr === "0") {
          diagnostics.push({
            id: "W050",
            severity: "warning",
            message: `sparkle:length on <${noteLink.qname}> is 0; this is usually a mistake`,
            line: noteLink.line,
            column: noteLink.column,
            path: elementPath(noteLink),
            fix: "Set sparkle:length to the actual file size in bytes",
          });
        }
      }

      // Only require signatures and length on in-app releaseNotesLink in signed-feed mode.
      // In Sparkle (SUAppcastItem.m), fullReleaseNotesLink is an external browser link and is not verified in signed-feed mode.
      const isReleaseNotesLink =
        noteLink.name === "releaseNotesLink" ||
        noteLink.qname.endsWith(":releaseNotesLink") ||
        noteLink.qname === "releaseNotesLink";

      if (options?.requireSignedFeed && isReleaseNotesLink) {
        if (!edSig) {
          diagnostics.push({
            id: "E035",
            severity: "error",
            message: `<${noteLink.qname}> is missing required sparkle:edSignature attribute in signed-feed mode`,
            line: noteLink.line,
            column: noteLink.column,
            path: elementPath(noteLink),
            fix: "Add a valid sparkle:edSignature attribute for external release notes",
          });
        }
        if (!lengthAttr) {
          diagnostics.push({
            id: "E035",
            severity: "error",
            message: `<${noteLink.qname}> is missing required sparkle:length attribute in signed-feed mode`,
            line: noteLink.line,
            column: noteLink.column,
            path: elementPath(noteLink),
            fix: "Add a qualified sparkle:length attribute specifying the exact file size in bytes",
          });
        }
      }
    }
  }
}
