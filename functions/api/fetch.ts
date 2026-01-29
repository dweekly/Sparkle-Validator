interface Env {}

// Maximum allowed response size (1MB - appcast files are typically <100KB)
const MAX_RESPONSE_SIZE = 1024 * 1024;

// Valid XML content types
const XML_CONTENT_TYPES = [
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
  "text/xml",
  "text/plain", // Some servers misconfigure this
];

/**
 * Check if an IP address is private/internal.
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 check
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // Validate octets
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;

    // 0.0.0.0/8 - "This" network
    if (a === 0) return true;
    // 10.0.0.0/8 - Private
    if (a === 10) return true;
    // 100.64.0.0/10 - Carrier-grade NAT
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;
    // 169.254.0.0/16 - Link-local (cloud metadata)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 - Private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 - IETF Protocol Assignments
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 - TEST-NET-1
    if (a === 192 && b === 0 && c === 2) return true;
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
    // 240.0.0.0/4 - Reserved
    if (a >= 240) return true;

    return false;
  }

  // IPv6 check
  const ipv6 = ip.toLowerCase();
  // Loopback
  if (ipv6 === "::1") return true;
  // Link-local
  if (ipv6.startsWith("fe80:")) return true;
  // Unique local (fc00::/7)
  if (ipv6.startsWith("fc") || ipv6.startsWith("fd")) return true;
  // IPv4-mapped IPv6 - check the embedded IPv4
  if (ipv6.startsWith("::ffff:")) {
    const embedded = ipv6.slice(7);
    return isPrivateIP(embedded);
  }

  return false;
}

/**
 * Resolve hostname to IP addresses using Cloudflare DNS-over-HTTPS.
 * Returns null if resolution fails.
 */
async function resolveHostname(
  hostname: string
): Promise<{ ips: string[]; error?: string } | null> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      {
        headers: {
          Accept: "application/dns-json",
        },
      }
    );

    if (!response.ok) {
      return { ips: [], error: "DNS resolution failed" };
    }

    const data = (await response.json()) as {
      Answer?: Array<{ type: number; data: string }>;
    };

    // Extract A records (type 1)
    const ips =
      data.Answer?.filter((r) => r.type === 1).map((r) => r.data) || [];

    return { ips };
  } catch {
    return { ips: [], error: "DNS resolution failed" };
  }
}

function jsonResponse(
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

function looksLikeXml(content: string): boolean {
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<rss") ||
    trimmed.startsWith("<feed") ||
    trimmed.startsWith("<!DOCTYPE")
  );
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url).searchParams.get("url");

  if (!url) {
    return jsonResponse({ error: "Missing url parameter" }, 400);
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return jsonResponse({ error: "Only HTTP/HTTPS URLs are allowed" }, 400);
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Quick check for obvious private hostnames
  if (hostname === "localhost" || hostname === "localhost.localdomain") {
    return jsonResponse(
      { error: "URLs to private/internal addresses are not allowed" },
      400
    );
  }

  // If hostname is already an IP, check it directly
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateIP(hostname)) {
      return jsonResponse(
        { error: "URLs to private/internal addresses are not allowed" },
        400
      );
    }
  } else {
    // Resolve hostname and check all IPs
    const resolved = await resolveHostname(hostname);

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

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SparkleValidator/1.0 (https://sparklevalidator.com)",
        Accept: "application/xml, application/rss+xml, text/xml, */*",
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      return jsonResponse(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > MAX_RESPONSE_SIZE) {
        reader.cancel();
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

    const xml = new TextDecoder().decode(
      new Uint8Array(
        chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[])
      )
    );

    // Verify it looks like XML
    if (!looksLikeXml(xml)) {
      return jsonResponse(
        { error: "Response doesn't appear to be XML. Expected an appcast file." },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: `Fetch failed: ${message}` }, 502);
  }
};
