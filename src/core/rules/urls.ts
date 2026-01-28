import type { Diagnostic, XmlDocument, XmlElement } from "../types.js";
import {
  childElements,
  childElement,
  attr,
  textContent,
  elementPath,
  isValidUrl,
  sparkleChildElement,
} from "./utils.js";

/**
 * E014-E018: URL validation rules
 * W016: URL has unencoded special characters
 */
export function urlRules(doc: XmlDocument, diagnostics: Diagnostic[]): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");

  for (const item of items) {
    // Check enclosure url
    const enclosure = childElement(item, "enclosure");
    if (enclosure) {
      const url = attr(enclosure, "url");
      if (url) {
        validateUrl(url, "E014", "enclosure url", enclosure, diagnostics);
      }
    }

    // Check <link>
    const link = childElement(item, "link");
    if (link) {
      const url = textContent(link).trim();
      if (url) {
        validateUrl(url, "E015", "item <link>", link, diagnostics);
      }
    }

    // Check sparkle:releaseNotesLink
    const rnLink = sparkleChildElement(item, "releaseNotesLink");
    if (rnLink) {
      const url = textContent(rnLink).trim();
      if (url) {
        validateUrl(url, "E016", "sparkle:releaseNotesLink", rnLink, diagnostics);
      }
    }

    // Check sparkle:fullReleaseNotesLink
    const frnLink = sparkleChildElement(item, "fullReleaseNotesLink");
    if (frnLink) {
      const url = textContent(frnLink).trim();
      if (url) {
        validateUrl(url, "E017", "sparkle:fullReleaseNotesLink", frnLink, diagnostics);
      }
    }

    // Check delta enclosure URLs
    const deltasEl = sparkleChildElement(item, "deltas");
    if (deltasEl) {
      const deltaEnclosures = childElements(deltasEl, "enclosure");
      for (const deltaEnc of deltaEnclosures) {
        const url = attr(deltaEnc, "url");
        if (url) {
          validateUrl(url, "E018", "delta enclosure url", deltaEnc, diagnostics);
        }
      }
    }
  }

  // Check channel-level link
  const channelLink = childElement(channel, "link");
  if (channelLink) {
    const url = textContent(channelLink).trim();
    if (url) {
      validateUrl(url, "E015", "channel <link>", channelLink, diagnostics);
    }
  }
}

function validateUrl(
  url: string,
  errorId: string,
  context: string,
  element: XmlElement,
  diagnostics: Diagnostic[]
): void {
  if (!isValidUrl(url)) {
    diagnostics.push({
      id: errorId,
      severity: "error",
      message: `Invalid URL in ${context}: "${url}"`,
      line: element.line,
      column: element.column,
      path: elementPath(element),
      fix: "Use a valid absolute URL with https:// or http:// scheme",
    });
    return;
  }

  // W016: Check for unencoded special characters
  // Characters that should be percent-encoded in URLs
  const unencodedPattern = /[{}|\\^`[\]<> ]/;
  if (unencodedPattern.test(url)) {
    diagnostics.push({
      id: "W016",
      severity: "warning",
      message: `URL in ${context} contains unencoded special characters: "${url}"`,
      line: element.line,
      column: element.column,
      path: elementPath(element),
      fix: "Percent-encode special characters in the URL",
    });
  }
}
