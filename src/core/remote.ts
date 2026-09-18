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
  /** Maximum concurrent requests (default: 5, between 1 and 50) */
  concurrency?: number;
  /** User-Agent header to send (default: "sparkle-validator/1.2") */
  userAgent?: string;
  /** Base URL for resolving relative links */
  baseUrl?: string;
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

interface ExtractedEnclosure {
  url: string;
  rawUrl: string;
  length: number;
  element: XmlElement;
  unresolvable?: boolean;
}

/**
 * Extract all enclosure URLs from a parsed appcast document.
 */
function extractEnclosures(
  doc: XmlDocument,
  baseUrl?: string
): ExtractedEnclosure[] {
  const enclosures: ExtractedEnclosure[] = [];

  if (!doc.root) return enclosures;

  const channel = getChildElement(doc.root, "channel");
  if (!channel) return enclosures;

  const items = getChildElements(channel, "item");

  function processUrl(
    rawUrl: string,
    length: number,
    element: XmlElement
  ): ExtractedEnclosure {
    try {
      // Test if rawUrl is absolute
      new URL(rawUrl);
      return { url: rawUrl, rawUrl, length, element };
    } catch {
      // Relative URL
      if (baseUrl) {
        try {
          const resolved = new URL(rawUrl, baseUrl).href;
          return { url: resolved, rawUrl, length, element };
        } catch {
          return { url: rawUrl, rawUrl, length, element, unresolvable: true };
        }
      } else {
        return { url: rawUrl, rawUrl, length, element, unresolvable: true };
      }
    }
  }

  for (const item of items) {
    // Main enclosure
    const enclosure = getChildElement(item, "enclosure");
    if (enclosure) {
      const url = enclosure.attributes["url"]?.value;
      const lengthStr = enclosure.attributes["length"]?.value;
      if (url) {
        enclosures.push(
          processUrl(url, parseInt(lengthStr || "0", 10) || 0, enclosure)
        );
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
            enclosures.push(
              processUrl(url, parseInt(lengthStr || "0", 10) || 0, deltaEnc)
            );
          }
        }
      }
    }
  }

  // Also check releaseNotesLink and fullReleaseNotesLink URLs
  for (const item of items) {
    for (const child of allChildElements(item)) {
      if (
        (child.name === "releaseNotesLink" ||
          child.name === "fullReleaseNotesLink") &&
        isSparkleNamespace(child.namespace)
      ) {
        const textNode = child.children.find((c) => c.type === "text");
        if (textNode && textNode.type === "text") {
          const rawUrl = textNode.text.trim();
          const lengthStr = sparkleAttr(child, "length");
          if (rawUrl) {
            enclosures.push(
              processUrl(rawUrl, parseInt(lengthStr || "0", 10) || 0, child)
            );
          }
        }
      }
    }
  }

  return enclosures;
}

function normalizeHostname(hostname: string): string {
  let h = hostname.toLowerCase().trim();
  if (h.startsWith("[") && h.endsWith("]")) {
    h = h.slice(1, -1);
  }
  return h;
}

function parseIPv6Words(clean: string): number[] | null {
  const doubleColonCount = (clean.match(/::/g) || []).length;
  if (doubleColonCount > 1) return null;

  let parts: string[];
  if (doubleColonCount === 1) {
    const [head, tail] = clean.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - (headParts.length + tailParts.length);
    if (missing < 1) return null;
    parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
  } else {
    parts = clean.split(":");
    if (parts.length !== 8) return null;
  }

  const words: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(p)) return null;
    words.push(parseInt(p, 16));
  }
  return words;
}

/**
 * Check if a URL points to a local/private address.
 */
export function isLocalOrPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = normalizeHostname(parsed.hostname);

    // localhost and local domain aliases
    if (
      host === "localhost" ||
      host === "localhost.localdomain" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return true;
    }

    // IPv4 check
    const ipv4Match = host.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    );
    if (ipv4Match) {
      const [, a, b, c, d] = ipv4Match.map(Number);
      if (a > 255 || b > 255 || c > 255 || d > 255) return true;
      if (a === 0) return true; // 0.0.0.0/8
      if (a === 10) return true; // 10.0.0.0/8
      if (a === 127) return true; // 127.0.0.0/8 loopback
      if (a === 169 && b === 254) return true; // 169.254.0.0/16
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true; // 192.168.0.0/16
      if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
      return false;
    }

    // IPv6 check
    if (host === "::1" || host === "::") return true;

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    const ipv4MappedMatch = host.match(
      /^(?:::ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/
    );
    if (ipv4MappedMatch) {
      return isLocalOrPrivateUrl(`http://${ipv4MappedMatch[1]}`);
    }

    const words = parseIPv6Words(host);
    if (words) {
      // Loopback ::1
      if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1)
        return true;
      // Unspecified ::
      if (words.every((w) => w === 0)) return true;
      // Unique local: fc00::/7 (first byte 0xfc or 0xfd)
      if ((words[0] & 0xfe00) === 0xfc00) return true;
      // Link-local unicast: fe80::/10
      if ((words[0] & 0xffc0) === 0xfe80) return true;
      // IPv4-mapped in words (::ffff:w7:w8)
      if (words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff) {
        const high = words[6];
        const low = words[7];
        const ip = `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
        return isLocalOrPrivateUrl(`http://${ip}`);
      }
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

    if (cause.message && cause.message !== "fetch failed") {
      return cause.message;
    }
  }

  if (err.message && err.message !== "fetch failed") {
    return err.message;
  }

  return "Network request failed";
}

/**
 * Check a single URL using HEAD request with manual redirect following and SSRF protections.
 */
async function checkUrl(
  enclosure: ExtractedEnclosure,
  options: RemoteValidationOptions
): Promise<UrlCheckResult> {
  const { url, rawUrl, unresolvable } = enclosure;
  const timeout = options.timeout ?? 10000;
  const userAgent = options.userAgent ?? "sparkle-validator/1.2";

  if (unresolvable) {
    return {
      url: rawUrl,
      status: null,
      contentLength: null,
      error: null,
      redirected: false,
      finalUrl: null,
      skipped: true,
      skipReason: "Relative URL without base URL context",
    };
  }

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

  const isHttp = url.toLowerCase().startsWith("http://");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    let currentUrl = url;
    let redirected = false;
    let redirectCount = 0;
    const maxRedirects = 5;
    let response: Response | null = null;

    while (redirectCount <= maxRedirects) {
      if (isLocalOrPrivateUrl(currentUrl)) {
        return {
          url,
          status: null,
          contentLength: null,
          error: null,
          redirected: true,
          finalUrl: currentUrl,
          skipped: true,
          skipReason: "Local/private redirect destination",
          isHttp,
        };
      }

      let res = await fetch(currentUrl, {
        method: "HEAD",
        headers: {
          "User-Agent": userAgent,
        },
        signal: controller.signal,
        redirect: "manual",
      });

      // If HEAD is not supported (405 Method Not Allowed), fall back to GET with range
      if (res.status === 405) {
        if (res.body) {
          try {
            await res.body.cancel();
          } catch {
            // Ignore cancel error
          }
        }
        res = await fetch(currentUrl, {
          method: "GET",
          headers: {
            "User-Agent": userAgent,
            Range: "bytes=0-0",
          },
          signal: controller.signal,
          redirect: "manual",
        });
      }

      // Check redirect codes
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        if (res.body) {
          try {
            await res.body.cancel();
          } catch {
            // Ignore cancel error
          }
        }
        const location = res.headers.get("location");
        if (!location) {
          response = res;
          break;
        }
        try {
          const nextUrl = new URL(location, currentUrl).href;
          currentUrl = nextUrl;
          redirected = true;
          redirectCount++;
          if (redirectCount > maxRedirects) {
            return {
              url,
              status: null,
              contentLength: null,
              error: "Too many redirects (exceeded 5)",
              redirected: true,
              finalUrl: currentUrl,
              skipped: false,
              isHttp,
            };
          }
          continue;
        } catch {
          return {
            url,
            status: null,
            contentLength: null,
            error: `Invalid redirect location: "${location}"`,
            redirected: true,
            finalUrl: location,
            skipped: false,
            isHttp,
          };
        }
      }

      response = res;
      break;
    }

    if (!response) {
      return {
        url,
        status: null,
        contentLength: null,
        error: "No response received",
        redirected,
        finalUrl: redirected ? currentUrl : null,
        skipped: false,
        isHttp,
      };
    }

    // Cancel body immediately to release connections
    if (response.body) {
      try {
        await response.body.cancel();
      } catch {
        // Ignore cancel error
      }
    }

    const contentLengthHeader = response.headers.get("content-length");
    const contentLength = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : null;

    return {
      url,
      status: response.status,
      contentLength,
      error: null,
      redirected,
      finalUrl: redirected ? currentUrl : null,
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
  } finally {
    clearTimeout(timeoutId);
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
  if (options.concurrency !== undefined) {
    if (
      typeof options.concurrency !== "number" ||
      !Number.isInteger(options.concurrency) ||
      options.concurrency < 1 ||
      options.concurrency > 50
    ) {
      throw new Error(
        `Invalid concurrency "${options.concurrency}": must be an integer between 1 and 50`
      );
    }
  }

  if (options.timeout !== undefined) {
    if (
      typeof options.timeout !== "number" ||
      !Number.isFinite(options.timeout) ||
      options.timeout <= 0 ||
      options.timeout > 60000
    ) {
      throw new Error(
        `Invalid timeout "${options.timeout}": must be a positive number up to 60000ms`
      );
    }
  }

  const diagnostics: Diagnostic[] = [];
  const enclosures = extractEnclosures(doc, options.baseUrl);

  if (enclosures.length === 0) {
    return diagnostics;
  }

  const concurrency = options.concurrency ?? 5;

  // Process URLs in batches for concurrency control
  const results: Array<{
    enclosure: ExtractedEnclosure;
    result: UrlCheckResult;
  }> = [];

  for (let i = 0; i < enclosures.length; i += concurrency) {
    const batch = enclosures.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (enc) => ({
        enclosure: enc,
        result: await checkUrl(enc, options),
      }))
    );
    results.push(...batchResults);
  }

  // Generate diagnostics in stable, deterministic order
  for (const { enclosure, result } of results) {
    const { element } = enclosure;
    const path = buildPath(element);

    // W023: URL skipped (local/private or unresolvable relative)
    if (result.skipped) {
      diagnostics.push({
        id: "W023",
        severity: "warning",
        message: `Skipped URL check: ${result.skipReason} (${enclosure.rawUrl})`,
        line: element.line,
        column: element.column,
        path,
        fix: `Use a publicly accessible URL for production appcasts`,
      });
      continue;
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
        const idx = siblings.indexOf(current) + 1;
        part += `[${idx}]`;
      }
    }
    parts.unshift(part);
    current = current.parent;
  }

  return parts.join(" > ");
}
