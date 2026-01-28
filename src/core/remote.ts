import type { Diagnostic, XmlDocument, XmlElement } from "./types.js";
import { sparkleAttr } from "./rules/utils.js";
import { isSparkleNamespace } from "./constants.js";

/**
 * Get all direct child elements of a parent.
 */
function allChildElements(parent: XmlElement): XmlElement[] {
  return parent.children.filter((c): c is XmlElement => c.type === "element");
}

/**
 * Get a direct child element by local name (no namespace).
 */
function getChildElement(
  parent: XmlElement,
  localName: string
): XmlElement | undefined {
  return parent.children.find(
    (c): c is XmlElement =>
      c.type === "element" && c.name === localName && !c.namespace
  );
}

/**
 * Get all direct child elements by local name (no namespace).
 */
function getChildElements(parent: XmlElement, localName: string): XmlElement[] {
  return parent.children.filter(
    (c): c is XmlElement =>
      c.type === "element" && c.name === localName && !c.namespace
  );
}

/** Options for remote validation */
export interface RemoteValidationOptions {
  /** Timeout for each request in milliseconds (default: 10000) */
  timeout?: number;
  /** Maximum concurrent requests (default: 5) */
  concurrency?: number;
  /** User-Agent header to send (default: "sparkle-validator/1.0") */
  userAgent?: string;
}

/** Result of checking a single URL */
interface UrlCheckResult {
  url: string;
  status: number | null;
  contentLength: number | null;
  error: string | null;
  redirected: boolean;
  finalUrl: string | null;
  skipped?: boolean;
  skipReason?: string;
  isHttp?: boolean;
}

/**
 * Extract all enclosure URLs from a parsed appcast document.
 */
function extractEnclosures(
  doc: XmlDocument
): Array<{ url: string; length: number; element: XmlElement }> {
  const enclosures: Array<{
    url: string;
    length: number;
    element: XmlElement;
  }> = [];

  if (!doc.root) return enclosures;

  const channel = getChildElement(doc.root, "channel");
  if (!channel) return enclosures;

  const items = getChildElements(channel, "item");

  for (const item of items) {
    // Main enclosure
    const enclosure = getChildElement(item, "enclosure");
    if (enclosure) {
      const url = enclosure.attributes["url"]?.value;
      const lengthStr = enclosure.attributes["length"]?.value;
      if (url) {
        enclosures.push({
          url,
          length: parseInt(lengthStr || "0", 10) || 0,
          element: enclosure,
        });
      }
    }

    // Delta enclosures inside sparkle:deltas
    const deltas = allChildElements(item).find(
      (el) => el.name === "deltas" && isSparkleNamespace(el.namespace)
    );
    if (deltas) {
      for (const deltaEnc of allChildElements(deltas)) {
        if (deltaEnc.name === "enclosure") {
          const url = deltaEnc.attributes["url"]?.value;
          const lengthStr = deltaEnc.attributes["length"]?.value;
          if (url) {
            enclosures.push({
              url,
              length: parseInt(lengthStr || "0", 10) || 0,
              element: deltaEnc,
            });
          }
        }
      }
    }
  }

  // Also check releaseNotesLink URLs
  for (const item of items) {
    for (const child of allChildElements(item)) {
      if (
        (child.name === "releaseNotesLink" ||
          child.name === "fullReleaseNotesLink") &&
        isSparkleNamespace(child.namespace)
      ) {
        // Get text content as URL
        const textNode = child.children.find((c) => c.type === "text");
        if (textNode && textNode.type === "text") {
          const url = textNode.text.trim();
          // releaseNotesLink can have length attribute for verification
          const lengthStr = sparkleAttr(child, "length");
          if (
            url &&
            (url.startsWith("http://") || url.startsWith("https://"))
          ) {
            enclosures.push({
              url,
              length: parseInt(lengthStr || "0", 10) || 0,
              element: child,
            });
          }
        }
      }
    }
  }

  return enclosures;
}

/**
 * Check if a URL points to a local/private address.
 */
function isLocalOrPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // localhost
    if (hostname === "localhost" || hostname === "localhost.localdomain") {
      return true;
    }

    // IPv4 loopback (127.x.x.x)
    if (hostname.startsWith("127.")) {
      return true;
    }

    // IPv6 loopback
    if (hostname === "::1" || hostname === "[::1]") {
      return true;
    }

    // Private IPv4 ranges
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // 10.x.x.x
      if (a === 10) return true;
      // 172.16.x.x - 172.31.x.x
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.x.x
      if (a === 192 && b === 168) return true;
      // 169.254.x.x (link-local)
      if (a === 169 && b === 254) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract a helpful error message from a fetch error.
 */
function getFetchErrorMessage(err: unknown, url: string): string {
  if (!(err instanceof Error)) {
    return String(err);
  }

  // Handle AbortError (timeout)
  if (err.name === "AbortError") {
    return "Request timed out";
  }

  // Try to get the underlying cause for better messages
  const cause = (err as { cause?: Error }).cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;

    // DNS resolution failed
    if (code === "ENOTFOUND") {
      try {
        const hostname = new URL(url).hostname;
        return `DNS lookup failed for "${hostname}"`;
      } catch {
        return "DNS lookup failed";
      }
    }

    // Connection refused
    if (code === "ECONNREFUSED") {
      return "Connection refused (no server listening)";
    }

    // Connection reset
    if (code === "ECONNRESET") {
      return "Connection reset by server";
    }

    // TLS/SSL errors
    if (code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
      return "TLS certificate verification failed (untrusted CA)";
    }
    if (code === "CERT_HAS_EXPIRED") {
      return "TLS certificate has expired";
    }
    if (code === "ERR_TLS_CERT_ALTNAME_INVALID") {
      return "TLS certificate hostname mismatch";
    }
    if (code === "DEPTH_ZERO_SELF_SIGNED_CERT") {
      return "TLS certificate is self-signed";
    }
    if (code?.startsWith("ERR_TLS") || code?.startsWith("CERT_")) {
      return `TLS error: ${code}`;
    }

    // Network unreachable
    if (code === "ENETUNREACH") {
      return "Network unreachable";
    }

    // Host unreachable
    if (code === "EHOSTUNREACH") {
      return "Host unreachable";
    }

    // Use cause message if it's more descriptive
    if (cause.message && cause.message !== "fetch failed") {
      return cause.message;
    }
  }

  // Fallback to original error message
  if (err.message && err.message !== "fetch failed") {
    return err.message;
  }

  return "Network request failed";
}

/**
 * Check a single URL using HEAD request.
 */
async function checkUrl(
  url: string,
  options: RemoteValidationOptions
): Promise<UrlCheckResult> {
  const timeout = options.timeout ?? 10000;
  const userAgent = options.userAgent ?? "sparkle-validator/1.1";

  // Check for local/private URLs
  if (isLocalOrPrivateUrl(url)) {
    return {
      url,
      status: null,
      contentLength: null,
      error: null,
      redirected: false,
      finalUrl: null,
      skipped: true,
      skipReason: "Local/private URL",
    };
  }

  // Check if URL uses HTTP (insecure)
  const isHttp = url.toLowerCase().startsWith("http://");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": userAgent,
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    const contentLengthHeader = response.headers.get("content-length");
    const contentLength = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : null;

    return {
      url,
      status: response.status,
      contentLength,
      error: null,
      redirected: response.redirected,
      finalUrl: response.redirected ? response.url : null,
      skipped: false,
      isHttp,
    };
  } catch (err) {
    return {
      url,
      status: null,
      contentLength: null,
      error: getFetchErrorMessage(err, url),
      redirected: false,
      finalUrl: null,
      skipped: false,
      isHttp,
    };
  }
}

/**
 * Run remote validation checks on all URLs in the appcast.
 * Returns additional diagnostics for URL issues.
 */
export async function validateRemote(
  doc: XmlDocument,
  options: RemoteValidationOptions = {}
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const enclosures = extractEnclosures(doc);

  if (enclosures.length === 0) {
    return diagnostics;
  }

  const concurrency = options.concurrency ?? 5;

  // Process URLs in batches for concurrency control
  const results: Array<{
    enclosure: (typeof enclosures)[0];
    result: UrlCheckResult;
  }> = [];

  for (let i = 0; i < enclosures.length; i += concurrency) {
    const batch = enclosures.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (enc) => ({
        enclosure: enc,
        result: await checkUrl(enc.url, options),
      }))
    );
    results.push(...batchResults);
  }

  // Generate diagnostics from results
  for (const { enclosure, result } of results) {
    const { element } = enclosure;
    const path = buildPath(element);

    // W023: URL skipped (local/private)
    if (result.skipped) {
      diagnostics.push({
        id: "W023",
        severity: "warning",
        message: `Skipped URL check: ${result.skipReason} (${enclosure.url})`,
        line: element.line,
        column: element.column,
        path,
        fix: `Use a publicly accessible URL for production appcasts`,
      });
      continue; // Skip other checks for skipped URLs
    }

    // W024: URL uses HTTP instead of HTTPS
    if (result.isHttp) {
      diagnostics.push({
        id: "W024",
        severity: "warning",
        message: `URL uses insecure HTTP instead of HTTPS`,
        line: element.line,
        column: element.column,
        path,
        fix: `Use HTTPS for secure downloads: ${enclosure.url.replace(/^http:/, "https:")}`,
      });
    }

    // E027: URL returns non-2xx status or failed to fetch
    if (result.error) {
      diagnostics.push({
        id: "E027",
        severity: "error",
        message: `Failed to fetch URL: ${result.error}`,
        line: element.line,
        column: element.column,
        path,
        fix: `Verify the URL is accessible: ${enclosure.url}`,
      });
    } else if (result.status && (result.status < 200 || result.status >= 300)) {
      diagnostics.push({
        id: "E027",
        severity: "error",
        message: `URL returned HTTP ${result.status}: ${enclosure.url}`,
        line: element.line,
        column: element.column,
        path,
        fix: `Ensure the URL returns a successful status code`,
      });
    }

    // E028: Content-Length doesn't match declared length
    if (
      result.contentLength !== null &&
      enclosure.length > 0 &&
      result.contentLength !== enclosure.length
    ) {
      diagnostics.push({
        id: "E028",
        severity: "error",
        message: `Content-Length mismatch: declared ${enclosure.length} bytes, server reports ${result.contentLength} bytes`,
        line: element.line,
        column: element.column,
        path,
        fix: `Update the length attribute to ${result.contentLength}`,
      });
    }

    // W021: URL redirects
    if (result.redirected && result.finalUrl) {
      diagnostics.push({
        id: "W021",
        severity: "warning",
        message: `URL redirects to: ${result.finalUrl}`,
        line: element.line,
        column: element.column,
        path,
        fix: `Consider using the final URL directly: ${result.finalUrl}`,
      });
    }

    // W022: Content-Length header missing (can't verify size)
    if (
      result.status &&
      result.status >= 200 &&
      result.status < 300 &&
      result.contentLength === null &&
      enclosure.length > 0
    ) {
      diagnostics.push({
        id: "W022",
        severity: "warning",
        message: `Server did not return Content-Length header, cannot verify declared size of ${enclosure.length} bytes`,
        line: element.line,
        column: element.column,
        path,
      });
    }
  }

  return diagnostics;
}

/**
 * Build element path string.
 */
function buildPath(element: XmlElement): string {
  const parts: string[] = [];
  let current: XmlElement | undefined = element;

  while (current) {
    let part = current.qname || current.name;
    if (current.parent) {
      const siblings = current.parent.children.filter(
        (c) => c.type === "element" && c.name === current!.name
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current);
        part += `[${index + 1}]`;
      }
    }
    parts.unshift(part);
    current = current.parent;
  }

  return parts.join(" > ");
}
