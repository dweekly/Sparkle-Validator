import type { PagesFunction } from "@cloudflare/workers-types";

export type Env = Record<string, unknown>;

// Maximum allowed response size (1MB - appcast files are typically <100KB)
export const MAX_RESPONSE_SIZE = 1024 * 1024;

// Valid XML content types
const XML_CONTENT_TYPES = [
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
  "text/xml",
  "text/plain", // Some servers misconfigure this
];

/**
 * Normalize a hostname by removing enclosing square brackets from IPv6 literals
 * and converting to lowercase.
 */
export function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse an IPv6 address string into 8 16-bit integer words.
 * Handles compression (::), leading/trailing zeros, and embedded IPv4.
 * Returns null if invalid IPv6.
 */
export function parseIPv6(ip: string): number[] | null {
  let clean = ip.trim().toLowerCase();
  if (clean.startsWith("[") && clean.endsWith("]")) {
    clean = clean.slice(1, -1);
  }

  // Strip zone index if present (e.g. fe80::1%eth0)
  const zoneIndex = clean.indexOf("%");
  if (zoneIndex !== -1) {
    clean = clean.slice(0, zoneIndex);
  }

  // Check for embedded IPv4 at the end (e.g., ::ffff:192.168.1.1)
  const ipv4Match = clean.match(/:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (ipv4Match) {
    const ipv4Str = ipv4Match[1];
    const octets = ipv4Str.split(".").map(Number);
    if (octets.some((n) => isNaN(n) || n < 0 || n > 255)) {
      return null;
    }
    const part1 = ((octets[0] << 8) | octets[1]).toString(16);
    const part2 = ((octets[2] << 8) | octets[3]).toString(16);
    clean = clean.slice(0, ipv4Match.index) + `:${part1}:${part2}`;
  }

  // Check compression
  const doubleColonCount = (clean.match(/::/g) || []).length;
  if (doubleColonCount > 1) {
    return null;
  }

  let parts: string[];
  if (doubleColonCount === 1) {
    const [head, tail] = clean.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - (headParts.length + tailParts.length);
    if (missing < 1) {
      return null;
    }
    parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
  } else {
    parts = clean.split(":");
    if (parts.length !== 8) {
      return null;
    }
  }

  const words: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(p)) {
      return null;
    }
    words.push(parseInt(p, 16));
  }

  return words;
}

/**
 * Check if a string looks like an IPv4 or IPv6 address.
 */
export function isIP(address: string): boolean {
  const norm = normalizeHostname(address);
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(norm)) {
    return true;
  }
  return norm.includes(":") && parseIPv6(norm) !== null;
}

/**
 * Check if an IP address is private, loopback, or reserved.
 */
export function isPrivateIP(rawIp: string): boolean {
  const ip = normalizeHostname(rawIp);

  // IPv4 check
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // Validate octets
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;

    // 0.0.0.0/8 - Current network ("this" host)
    if (a === 0) return true;
    // 10.0.0.0/8 - Private
    if (a === 10) return true;
    // 100.64.0.0/10 - Carrier-grade NAT
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;
    // 169.254.0.0/16 - Link-local
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 - Private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 - IETF Protocol Assignments
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 - TEST-NET-1
    if (a === 192 && b === 0 && c === 2) return true;
    // 192.88.99.0/24 - 6to4 relay anycast
    if (a === 192 && b === 88 && c === 99) return true;
    // 192.168.0.0/16 - Private
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 - Benchmark testing
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24 - TEST-NET-2
    if (a === 198 && b === 51 && c === 100) return true;
    // 203.0.113.0/24 - TEST-NET-3
    if (a === 203 && b === 0 && c === 113) return true;
    // 224.0.0.0/4 - Multicast
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 - Reserved (includes 255.255.255.255 broadcast)
    if (a >= 240) return true;

    return false;
  }

  // IPv6 check
  const words = parseIPv6(ip);
  if (!words) {
    // If not valid IPv4 and not valid IPv6, block if contains colon or numbers (malformed)
    return true;
  }

  // :: (Unspecified)
  if (words.every((w) => w === 0)) return true;

  // ::1 (Loopback)
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return true;

  // ::ffff:0:0/96 (IPv4-mapped IPv6)
  if (words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff) {
    const embeddedIpv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
    return isPrivateIP(embeddedIpv4);
  }

  // ::/96 (IPv4-compatible IPv6, deprecated)
  if (
    words.slice(0, 6).every((w) => w === 0) &&
    (words[6] !== 0 || words[7] > 1)
  ) {
    const embeddedIpv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
    return isPrivateIP(embeddedIpv4);
  }

  // 2002::/16 (6to4) - check if embedded IPv4 is private
  if (words[0] === 0x2002) {
    const embeddedIpv4 = `${words[1] >> 8}.${words[1] & 0xff}.${words[2] >> 8}.${words[2] & 0xff}`;
    if (isPrivateIP(embeddedIpv4)) return true;
  }

  // fc00::/7 (Unique Local Address) - fc00:: to fdff::
  if ((words[0] & 0xfe00) === 0xfc00) return true;

  // fe80::/10 (Link-Local) - fe80:: to febf::
  if ((words[0] & 0xffc0) === 0xfe80) return true;

  // ff00::/8 (Multicast)
  if ((words[0] & 0xff00) === 0xff00) return true;

  // 100::/64 (Discard prefix)
  if (words[0] === 0x100 && words[1] === 0 && words[2] === 0 && words[3] === 0)
    return true;

  // 2001:db8::/32 (Documentation)
  if (words[0] === 0x2001 && words[1] === 0xdb8) return true;

  // 2001:2::/48 (Benchmarking)
  if (words[0] === 0x2001 && words[1] === 0x2 && words[2] === 0) return true;

  return false;
}

/**
 * Resolve hostname to IP addresses (A and AAAA) using Cloudflare DNS-over-HTTPS.
 */
export async function resolveHostname(
  hostname: string,
  signal?: AbortSignal
): Promise<{ ips: string[]; error?: string } | null> {
  const queryDoh = async (type: "A" | "AAAA"): Promise<string[]> => {
    try {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
        {
          headers: {
            Accept: "application/dns-json",
          },
          signal,
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as {
        Answer?: Array<{ type: number; data: string }>;
      };

      const recordType = type === "A" ? 1 : 28;
      return (
        data.Answer?.filter((r) => r.type === recordType).map((r) => r.data) ||
        []
      );
    } catch {
      return [];
    }
  };

  try {
    const [ipv4List, ipv6List] = await Promise.all([
      queryDoh("A"),
      queryDoh("AAAA"),
    ]);
    const ips = [...ipv4List, ...ipv6List];

    if (ips.length === 0) {
      return { ips: [], error: "DNS resolution failed or returned no records" };
    }

    return { ips };
  } catch {
    return { ips: [], error: "DNS resolution failed" };
  }
}

export function jsonResponse(
  data: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function looksLikeXml(content: string): boolean {
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<rss") ||
    trimmed.startsWith("<feed") ||
    trimmed.startsWith("<!DOCTYPE")
  );
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rawUrl = new URL(context.request.url).searchParams.get("url");

  if (!rawUrl) {
    return jsonResponse({ error: "Missing url parameter" }, 400);
  }

  let currentUrl = rawUrl;
  const visited = new Set<string>();
  const MAX_REDIRECTS = 5;
  let redirectCount = 0;

  // Global deadline of 10s for the entire operation
  const overallController = new AbortController();
  const overallTimeoutId = setTimeout(() => overallController.abort(), 10000);

  try {
    while (true) {
      if (redirectCount > MAX_REDIRECTS) {
        return jsonResponse({ error: "Too many redirects" }, 400);
      }

      if (visited.has(currentUrl)) {
        return jsonResponse({ error: "Redirect loop detected" }, 400);
      }
      visited.add(currentUrl);

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(currentUrl);
      } catch {
        return jsonResponse({ error: "Invalid URL" }, 400);
      }

      // Only allow http/https
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return jsonResponse({ error: "Only HTTP/HTTPS URLs are allowed" }, 400);
      }

      // Prohibit userinfo/credentials in URLs
      if (parsedUrl.username || parsedUrl.password) {
        return jsonResponse(
          { error: "URLs with credentials are not allowed" },
          400
        );
      }

      const rawHostname = parsedUrl.hostname;
      const cleanHostname = normalizeHostname(rawHostname);

      // Quick check for obvious private hostnames
      if (
        cleanHostname === "localhost" ||
        cleanHostname === "localhost.localdomain" ||
        cleanHostname.endsWith(".localhost") ||
        cleanHostname.endsWith(".local")
      ) {
        return jsonResponse(
          { error: "URLs to private/internal addresses are not allowed" },
          400
        );
      }

      // If hostname is already an IP, check it directly
      if (isIP(cleanHostname)) {
        if (isPrivateIP(cleanHostname)) {
          return jsonResponse(
            { error: "URLs to private/internal addresses are not allowed" },
            400
          );
        }
      } else {
        // Resolve hostname and check all IPs
        const resolved = await resolveHostname(
          cleanHostname,
          overallController.signal
        );

        if (!resolved || resolved.ips.length === 0) {
          return jsonResponse(
            { error: resolved?.error || "Could not resolve hostname" },
            400
          );
        }

        // Check if ANY resolved IP is private (block if so)
        const privateIP = resolved.ips.find((ip) => isPrivateIP(ip));
        if (privateIP) {
          return jsonResponse(
            {
              error: `Hostname resolves to private IP address (${privateIP})`,
            },
            400
          );
        }
      }

      // Perform fetch with manual redirect handling
      const response = await fetch(currentUrl, {
        headers: {
          "User-Agent": "SparkleValidator/1.0 (https://sparklevalidator.com)",
          Accept: "application/xml, application/rss+xml, text/xml, */*",
        },
        redirect: "manual",
        signal: overallController.signal,
      });

      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return jsonResponse(
            { error: "Redirect missing location header" },
            502
          );
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          return jsonResponse({ error: "Invalid redirect location URL" }, 400);
        }

        // Strip credentials
        nextUrl.username = "";
        nextUrl.password = "";

        currentUrl = nextUrl.href;
        redirectCount++;
        continue;
      }

      if (!response.ok) {
        return jsonResponse(
          {
            error: `Failed to fetch: ${response.status} ${response.statusText}`,
          },
          502
        );
      }

      // Check Content-Length if available
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        return jsonResponse(
          {
            error:
              "Response too large (max 1MB). This doesn't look like an appcast file.",
          },
          413
        );
      }

      // Check Content-Type (allow if missing, since some servers misconfigure)
      const contentType =
        response.headers.get("content-type")?.toLowerCase() || "";
      const hasValidType =
        !contentType || XML_CONTENT_TYPES.some((t) => contentType.includes(t));
      if (!hasValidType) {
        return jsonResponse(
          { error: `Invalid content type: ${contentType}. Expected XML.` },
          415
        );
      }

      // Read response with size limit
      const reader = response.body?.getReader();
      if (!reader) {
        return jsonResponse({ error: "Failed to read response" }, 502);
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          totalSize += value.length;
          if (totalSize > MAX_RESPONSE_SIZE) {
            await reader.cancel();
            return jsonResponse(
              {
                error:
                  "Response too large (max 1MB). This doesn't look like an appcast file.",
              },
              413
            );
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const merged = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      const xml = new TextDecoder("utf-8").decode(merged);

      // Verify it looks like XML
      if (!looksLikeXml(xml)) {
        return jsonResponse(
          {
            error:
              "Response doesn't appear to be XML. Expected an appcast file.",
          },
          415
        );
      }

      return new Response(JSON.stringify({ xml }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60",
        },
      });
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return jsonResponse({ error: "Request timed out" }, 504);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: `Fetch failed: ${message}` }, 502);
  } finally {
    clearTimeout(overallTimeoutId);
  }
};
