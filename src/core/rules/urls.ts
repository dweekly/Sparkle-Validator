import type {
  Diagnostic,
  XmlDocument,
  XmlElement,
  ValidationOptions,
} from "../types.js";
import {
  childElements,
  childElement,
  attr,
  textContent,
  elementPath,
  sparkleChildElements,
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
 * W014: Relative URL
 * W016: URL has unencoded special characters
 * W030: URL file extension doesn't match expected type
 * W035: Feed mixes HTTP and HTTPS URLs
 */
export function urlRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[],
  options?: ValidationOptions
): void {
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
        validateResourceUrl(
          url,
          "E014",
          "enclosure url",
          enclosure,
          ["https", "http"],
          options,
          diagnostics,
          trackProtocol,
          true
        );
      }
    }

    // Check <link>
    const link = childElement(item, "link");
    if (link) {
      const url = textContent(link).trim();
      if (url) {
        validateResourceUrl(
          url,
          "E015",
          "item <link>",
          link,
          ["https", "http", "feed"],
          options,
          diagnostics,
          trackProtocol,
          false
        );
      }
    }

    // Check ALL sparkle:releaseNotesLink elements (Finding 12: inspect every localized note link)
    const rnLinks = sparkleChildElements(item, "releaseNotesLink");
    for (const rnLink of rnLinks) {
      const url = textContent(rnLink).trim();
      if (url) {
        validateResourceUrl(
          url,
          "E016",
          "sparkle:releaseNotesLink",
          rnLink,
          ["https", "http"],
          options,
          diagnostics,
          trackProtocol,
          false
        );
      }
    }

    // Check ALL sparkle:fullReleaseNotesLink elements
    const frnLinks = sparkleChildElements(item, "fullReleaseNotesLink");
    for (const frnLink of frnLinks) {
      const url = textContent(frnLink).trim();
      if (url) {
        validateResourceUrl(
          url,
          "E017",
          "sparkle:fullReleaseNotesLink",
          frnLink,
          ["https", "http"],
          options,
          diagnostics,
          trackProtocol,
          false
        );
      }
    }

    // Check delta enclosure URLs
    const deltasEl = childElements(item, "deltas").concat(
      sparkleChildElements(item, "deltas")
    );
    for (const dEl of deltasEl) {
      const deltaEnclosures = childElements(dEl, "enclosure");
      for (const deltaEnc of deltaEnclosures) {
        const url = attr(deltaEnc, "url");
        if (url) {
          validateResourceUrl(
            url,
            "E018",
            "delta enclosure url",
            deltaEnc,
            ["https", "http"],
            options,
            diagnostics,
            trackProtocol,
            true
          );
        }
      }
    }
  }

  // Check channel-level link
  const channelLink = childElement(channel, "link");
  if (channelLink) {
    const url = textContent(channelLink).trim();
    if (url) {
      validateResourceUrl(
        url,
        "E015",
        "channel <link>",
        channelLink,
        ["https", "http", "feed"],
        options,
        diagnostics,
        trackProtocol,
        false
      );
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

function validateResourceUrl(
  rawUrl: string,
  errorId: string,
  context: string,
  element: XmlElement,
  allowedSchemes: string[],
  options: ValidationOptions | undefined,
  diagnostics: Diagnostic[],
  trackProtocol: (url: string, element: XmlElement) => void,
  checkSuspiciousExtension: boolean
): void {
  // W016: Check for unencoded special characters
  const unencodedPattern = /[{}|\\^`[\]<> ]/;
  if (unencodedPattern.test(rawUrl)) {
    diagnostics.push({
      id: "W016",
      severity: "warning",
      message: `URL in ${context} contains unencoded special characters: "${rawUrl}"`,
      line: element.line,
      column: element.column,
      path: elementPath(element),
      fix: "Percent-encode special characters in the URL",
    });
  }

  let parsed: URL | null = null;
  let isRelative = false;

  try {
    parsed = new URL(rawUrl);
  } catch {
    isRelative = true;
  }

  if (isRelative) {
    if (!options?.baseUrl) {
      diagnostics.push({
        id: errorId,
        severity: "error",
        message: `Relative URL in ${context}: "${rawUrl}" cannot be resolved without a base URL context`,
        line: element.line,
        column: element.column,
        path: elementPath(element),
        fix: "Provide an absolute URL (https://...) or specify a base URL for validation",
      });
      return;
    }

    try {
      parsed = new URL(rawUrl, options.baseUrl);
      // Relative URL successfully resolved against base URL
      diagnostics.push({
        id: "W014",
        severity: "warning",
        message: `Relative URL "${rawUrl}" in ${context} resolved against base URL to "${parsed.href}"`,
        line: element.line,
        column: element.column,
        path: elementPath(element),
        fix: "Prefer absolute URLs with https:// scheme",
      });
    } catch {
      diagnostics.push({
        id: errorId,
        severity: "error",
        message: `Invalid relative URL in ${context}: "${rawUrl}" could not be resolved against base URL "${options.baseUrl}"`,
        line: element.line,
        column: element.column,
        path: elementPath(element),
        fix: "Provide a valid URL path",
      });
      return;
    }
  }

  if (!parsed) return;

  // Scheme verification
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (!allowedSchemes.includes(scheme)) {
    diagnostics.push({
      id: errorId,
      severity: "error",
      message: `Invalid URL scheme "${parsed.protocol}" in ${context}: "${rawUrl}". Allowed schemes: ${allowedSchemes.map((s) => s + "://").join(", ")}`,
      line: element.line,
      column: element.column,
      path: elementPath(element),
      fix: `Use a valid URL with ${allowedSchemes.map((s) => s + "://").join(" or ")} scheme`,
    });
    return;
  }

  trackProtocol(parsed.href, element);

  if (checkSuspiciousExtension) {
    const ext = getUrlExtension(parsed.href);
    if (ext && SUSPICIOUS_EXTENSIONS.includes(ext)) {
      diagnostics.push({
        id: "W030",
        severity: "warning",
        message: `URL in ${context} has suspicious extension "${ext}" for a download file`,
        line: element.line,
        column: element.column,
        path: elementPath(element),
        fix: `Download URLs should typically end with ${EXPECTED_DOWNLOAD_EXTENSIONS.slice(0, 3).join(", ")}, etc.`,
      });
    }
  }
}
