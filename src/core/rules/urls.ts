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

/** Expected file extensions for enclosure downloads */
const EXPECTED_DOWNLOAD_EXTENSIONS = [
  ".zip",
  ".dmg",
  ".pkg",
  ".app",
  ".tar",
  ".tar.gz",
  ".tgz",
  ".tar.bz2",
  ".tbz",
  ".xz",
  ".7z",
];

/** Suspicious extensions for download URLs */
const SUSPICIOUS_EXTENSIONS = [
  ".html",
  ".htm",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".css",
  ".js",
];

/**
 * Get the file extension from a URL path.
 */
function getUrlExtension(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastDot = pathname.lastIndexOf(".");
    if (lastDot === -1 || lastDot === pathname.length - 1) return null;
    return pathname.substring(lastDot).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * E014-E018: URL validation rules
 * W016: URL has unencoded special characters
 * W030: URL file extension doesn't match expected type
 * W035: Feed mixes HTTP and HTTPS URLs
 */
export function urlRules(doc: XmlDocument, diagnostics: Diagnostic[]): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");

  // Track HTTP vs HTTPS URLs for W035
  const httpUrls: { url: string; element: XmlElement }[] = [];
  const httpsUrls: { url: string; element: XmlElement }[] = [];

  function trackProtocol(url: string, element: XmlElement): void {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:") {
        httpUrls.push({ url, element });
      } else if (parsed.protocol === "https:") {
        httpsUrls.push({ url, element });
      }
    } catch {
      // Invalid URL, skip tracking
    }
  }

  for (const item of items) {
    // Check enclosure url
    const enclosure = childElement(item, "enclosure");
    if (enclosure) {
      const url = attr(enclosure, "url");
      if (url) {
        validateUrl(url, "E014", "enclosure url", enclosure, diagnostics);
        trackProtocol(url, enclosure);

        // W030: Check for suspicious file extensions on enclosure URLs
        const ext = getUrlExtension(url);
        if (ext && SUSPICIOUS_EXTENSIONS.includes(ext)) {
          diagnostics.push({
            id: "W030",
            severity: "warning",
            message: `Enclosure URL has suspicious extension "${ext}" for a download file`,
            line: enclosure.line,
            column: enclosure.column,
            path: elementPath(enclosure),
            fix: `Download URLs should typically end with ${EXPECTED_DOWNLOAD_EXTENSIONS.slice(0, 3).join(", ")}, etc.`,
          });
        }
      }
    }

    // Check <link>
    const link = childElement(item, "link");
    if (link) {
      const url = textContent(link).trim();
      if (url) {
        validateUrl(url, "E015", "item <link>", link, diagnostics);
        trackProtocol(url, link);
      }
    }

    // Check sparkle:releaseNotesLink
    const rnLink = sparkleChildElement(item, "releaseNotesLink");
    if (rnLink) {
      const url = textContent(rnLink).trim();
      if (url) {
        validateUrl(
          url,
          "E016",
          "sparkle:releaseNotesLink",
          rnLink,
          diagnostics
        );
        trackProtocol(url, rnLink);
      }
    }

    // Check sparkle:fullReleaseNotesLink
    const frnLink = sparkleChildElement(item, "fullReleaseNotesLink");
    if (frnLink) {
      const url = textContent(frnLink).trim();
      if (url) {
        validateUrl(
          url,
          "E017",
          "sparkle:fullReleaseNotesLink",
          frnLink,
          diagnostics
        );
        trackProtocol(url, frnLink);
      }
    }

    // Check delta enclosure URLs
    const deltasEl = sparkleChildElement(item, "deltas");
    if (deltasEl) {
      const deltaEnclosures = childElements(deltasEl, "enclosure");
      for (const deltaEnc of deltaEnclosures) {
        const url = attr(deltaEnc, "url");
        if (url) {
          validateUrl(
            url,
            "E018",
            "delta enclosure url",
            deltaEnc,
            diagnostics
          );
          trackProtocol(url, deltaEnc);

          // W030: Check for suspicious file extensions on delta enclosure URLs
          const ext = getUrlExtension(url);
          if (ext && SUSPICIOUS_EXTENSIONS.includes(ext)) {
            diagnostics.push({
              id: "W030",
              severity: "warning",
              message: `Delta enclosure URL has suspicious extension "${ext}" for a download file`,
              line: deltaEnc.line,
              column: deltaEnc.column,
              path: elementPath(deltaEnc),
              fix: `Download URLs should typically end with ${EXPECTED_DOWNLOAD_EXTENSIONS.slice(0, 3).join(", ")}, etc.`,
            });
          }
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
      trackProtocol(url, channelLink);
    }
  }

  // W035: Feed mixes HTTP and HTTPS URLs
  if (httpUrls.length > 0 && httpsUrls.length > 0) {
    // Report on the HTTP URLs as they're the less secure ones
    for (const { element } of httpUrls) {
      diagnostics.push({
        id: "W035",
        severity: "warning",
        message:
          "Feed mixes HTTP and HTTPS URLs; consider using HTTPS consistently",
        line: element.line,
        column: element.column,
        path: elementPath(element),
        fix: "Use HTTPS for all URLs for consistent security",
      });
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
