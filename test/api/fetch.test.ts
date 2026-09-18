import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPrivateIP,
  normalizeHostname,
  parseIPv6,
  onRequestGet,
  MAX_RESPONSE_SIZE,
} from "../../functions/api/fetch.js";

interface JsonResponse {
  error?: string;
  xml?: string;
}

type PagesHandlerContext = Parameters<typeof onRequestGet>[0];

describe("SSRF Protection - isPrivateIP", () => {
  describe("should block private IPv4 ranges", () => {
    it("blocks 10.0.0.0/8 (Class A private)", () => {
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("10.255.255.255")).toBe(true);
      expect(isPrivateIP("10.0.0.0")).toBe(true);
    });

    it("blocks 172.16.0.0/12 (Class B private)", () => {
      expect(isPrivateIP("172.16.0.1")).toBe(true);
      expect(isPrivateIP("172.31.255.255")).toBe(true);
      expect(isPrivateIP("172.20.0.1")).toBe(true);
      // Just outside range
      expect(isPrivateIP("172.15.255.255")).toBe(false);
      expect(isPrivateIP("172.32.0.0")).toBe(false);
    });

    it("blocks 192.168.0.0/16 (Class C private)", () => {
      expect(isPrivateIP("192.168.0.1")).toBe(true);
      expect(isPrivateIP("192.168.1.1")).toBe(true);
      expect(isPrivateIP("192.168.255.255")).toBe(true);
    });

    it("blocks 127.0.0.0/8 (loopback)", () => {
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      expect(isPrivateIP("127.255.255.255")).toBe(true);
    });

    it("blocks 169.254.0.0/16 (link-local / cloud metadata)", () => {
      expect(isPrivateIP("169.254.0.1")).toBe(true);
      expect(isPrivateIP("169.254.169.254")).toBe(true); // AWS metadata
      expect(isPrivateIP("169.254.255.255")).toBe(true);
    });

    it("blocks 100.64.0.0/10 (carrier-grade NAT)", () => {
      expect(isPrivateIP("100.64.0.1")).toBe(true);
      expect(isPrivateIP("100.127.255.255")).toBe(true);
      // Just outside range
      expect(isPrivateIP("100.63.255.255")).toBe(false);
      expect(isPrivateIP("100.128.0.0")).toBe(false);
    });

    it("blocks 0.0.0.0/8 (this network)", () => {
      expect(isPrivateIP("0.0.0.0")).toBe(true);
      expect(isPrivateIP("0.255.255.255")).toBe(true);
    });

    it("blocks multicast 224.0.0.0/4", () => {
      expect(isPrivateIP("224.0.0.1")).toBe(true);
      expect(isPrivateIP("239.255.255.255")).toBe(true);
    });

    it("blocks reserved 240.0.0.0/4", () => {
      expect(isPrivateIP("240.0.0.1")).toBe(true);
      expect(isPrivateIP("255.255.255.255")).toBe(true);
    });

    it("blocks TEST-NET ranges", () => {
      expect(isPrivateIP("192.0.2.1")).toBe(true); // TEST-NET-1
      expect(isPrivateIP("198.51.100.1")).toBe(true); // TEST-NET-2
      expect(isPrivateIP("203.0.113.1")).toBe(true); // TEST-NET-3
    });

    it("blocks benchmark testing 198.18.0.0/15", () => {
      expect(isPrivateIP("198.18.0.1")).toBe(true);
      expect(isPrivateIP("198.19.255.255")).toBe(true);
    });

    it("blocks invalid octets (>255)", () => {
      expect(isPrivateIP("256.1.1.1")).toBe(true);
      expect(isPrivateIP("1.256.1.1")).toBe(true);
    });
  });

  describe("should allow public IPv4 addresses", () => {
    it("allows common public IPs", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false); // Google DNS
      expect(isPrivateIP("1.1.1.1")).toBe(false); // Cloudflare DNS
      expect(isPrivateIP("208.67.222.222")).toBe(false); // OpenDNS
      expect(isPrivateIP("151.101.1.140")).toBe(false); // Reddit
    });

    it("allows edge cases near private ranges", () => {
      expect(isPrivateIP("11.0.0.1")).toBe(false); // Just after 10.x
      expect(isPrivateIP("192.167.255.255")).toBe(false); // Just before 192.168.x
      expect(isPrivateIP("172.15.255.255")).toBe(false); // Just before 172.16.x
      expect(isPrivateIP("172.32.0.0")).toBe(false); // Just after 172.31.x
    });
  });

  describe("should handle IPv6 addresses and normalization", () => {
    it("normalizes bracketed and mixed-case hostnames", () => {
      expect(normalizeHostname("[::1]")).toBe("::1");
      expect(normalizeHostname("[2001:4860:4860::8888]")).toBe(
        "2001:4860:4860::8888"
      );
      expect(normalizeHostname("Example.COM")).toBe("example.com");
    });

    it("parses valid IPv6 formats and compression", () => {
      expect(parseIPv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
      expect(parseIPv6("fe80::1")).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1]);
      expect(parseIPv6("::ffff:192.168.1.1")).toEqual([
        0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x0101,
      ]);
    });

    it("blocks loopback ::1, both bare and bracketed", () => {
      expect(isPrivateIP("::1")).toBe(true);
      expect(isPrivateIP("[::1]")).toBe(true);
    });

    it("blocks link-local fe80::", () => {
      expect(isPrivateIP("fe80::1")).toBe(true);
      expect(isPrivateIP("[fe80::1]")).toBe(true);
      expect(isPrivateIP("fe80:0000:0000:0000:0000:0000:0000:0001")).toBe(true);
    });

    it("blocks unique local fc00::/7 (ULA)", () => {
      expect(isPrivateIP("fc00::1")).toBe(true);
      expect(isPrivateIP("[fc00::1]")).toBe(true);
      expect(isPrivateIP("fd00::1")).toBe(true);
      expect(isPrivateIP("[fd00::1]")).toBe(true);
      expect(isPrivateIP("fd12:3456:789a:1::1")).toBe(true);
    });

    it("blocks IPv4-mapped IPv6 with private IPv4", () => {
      expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIP("[::ffff:127.0.0.1]")).toBe(true);
      expect(isPrivateIP("::ffff:10.0.0.1")).toBe(true);
      expect(isPrivateIP("::ffff:192.168.1.1")).toBe(true);
      expect(isPrivateIP("::ffff:169.254.169.254")).toBe(true);
    });

    it("blocks 6to4 (2002::/16) with private embedded IPv4", () => {
      // 2002:7f00:0001:: -> 127.0.0.1
      expect(isPrivateIP("2002:7f00:0001::")).toBe(true);
      // 2002:0a00:0001:: -> 10.0.0.1
      expect(isPrivateIP("2002:0a00:0001::")).toBe(true);
    });

    it("allows IPv4-mapped IPv6 with public IPv4", () => {
      expect(isPrivateIP("::ffff:8.8.8.8")).toBe(false);
      expect(isPrivateIP("[::ffff:8.8.8.8]")).toBe(false);
      expect(isPrivateIP("::ffff:1.1.1.1")).toBe(false);
    });

    it("allows public IPv6 addresses", () => {
      expect(isPrivateIP("2001:4860:4860::8888")).toBe(false); // Google IPv6
      expect(isPrivateIP("[2001:4860:4860::8888]")).toBe(false);
      expect(isPrivateIP("2606:4700:4700::1111")).toBe(false); // Cloudflare IPv6
    });
  });
});

describe("Cloudflare Pages Function Handler (R02 & R04)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeContext(urlParam: string | null): PagesHandlerContext {
    const requestUrl = new URL("https://sparklevalidator.com/api/fetch");
    if (urlParam !== null) {
      requestUrl.searchParams.set("url", urlParam);
    }
    const request = new Request(requestUrl.toString());
    return {
      request,
      functionPath: "/api/fetch",
      waitUntil: vi.fn(),
      next: vi.fn(),
      env: {},
      params: {},
      data: {},
    } as unknown as PagesHandlerContext;
  }

  it("returns 400 if url parameter is missing", async () => {
    const ctx = makeContext(null);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("Missing url parameter");
  });

  it("returns 400 for non-HTTP schemes", async () => {
    const ctx = makeContext("file:///etc/passwd");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("Only HTTP/HTTPS URLs are allowed");
  });

  it("returns 400 for URLs containing credentials", async () => {
    const ctx = makeContext("http://admin:secret@example.com/feed.xml");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("credentials");
  });

  it("blocks private IPv6 literals directly without external fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    for (const privateUrl of [
      "http://[::1]/feed.xml",
      "http://[fd00::1]/feed.xml",
      "http://[fe80::1]/feed.xml",
      "http://[::ffff:127.0.0.1]/feed.xml",
    ]) {
      const ctx = makeContext(privateUrl);
      const res = await onRequestGet(ctx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as JsonResponse;
      expect(body.error).toContain("private/internal addresses");
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks private IPv4 literals directly without external fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    for (const privateUrl of [
      "http://127.0.0.1/feed.xml",
      "http://10.0.0.1/feed.xml",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost/feed.xml",
    ]) {
      const ctx = makeContext(privateUrl);
      const res = await onRequestGet(ctx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as JsonResponse;
      expect(body.error).toContain("private/internal addresses");
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks hostnames that resolve to private IPv4 or IPv6 addresses", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const urlStr = input.toString();
      if (urlStr.includes("cloudflare-dns.com")) {
        if (urlStr.includes("type=A")) {
          return new Response(
            JSON.stringify({
              Answer: [{ type: 1, data: "192.168.1.100" }],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ Answer: [] }), { status: 200 });
      }
      return new Response("OK", { status: 200 });
    }) as unknown as typeof fetch;

    const ctx = makeContext("https://internal.mycorp.test/feed.xml");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("private IP address");
  });

  it("blocks hostnames with mixed public and private DNS records", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const urlStr = input.toString();
      if (urlStr.includes("cloudflare-dns.com")) {
        if (urlStr.includes("type=A")) {
          return new Response(
            JSON.stringify({
              Answer: [
                { type: 1, data: "93.184.216.34" }, // public
                { type: 1, data: "10.0.0.5" }, // private
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ Answer: [] }), { status: 200 });
      }
      return new Response("OK", { status: 200 });
    }) as unknown as typeof fetch;

    const ctx = makeContext("https://mixed.example.com/feed.xml");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("private IP address");
  });

  it("blocks redirects to private IPv4/IPv6 addresses", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const urlStr = input.toString();
      if (urlStr.includes("cloudflare-dns.com")) {
        return new Response(
          JSON.stringify({
            Answer: [{ type: 1, data: "93.184.216.34" }],
          }),
          { status: 200 }
        );
      }
      if (urlStr === "https://example.com/redirect-to-private") {
        return new Response(null, {
          status: 302,
          headers: {
            Location: "http://127.0.0.1/secret",
          },
        });
      }
      return new Response("Should not reach here", { status: 200 });
    }) as unknown as typeof fetch;

    const ctx = makeContext("https://example.com/redirect-to-private");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("private/internal addresses");
  });

  it("detects redirect loops and enforces hop bounds", async () => {
    let hop = 0;
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const urlStr = input.toString();
      if (urlStr.includes("cloudflare-dns.com")) {
        return new Response(
          JSON.stringify({
            Answer: [{ type: 1, data: "93.184.216.34" }],
          }),
          { status: 200 }
        );
      }
      hop++;
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://example.com/step-${hop}`,
        },
      });
    }) as unknown as typeof fetch;

    const ctx = makeContext("https://example.com/step-0");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("Too many redirects");
  });

  it("enforces maximum response size limit (1MB)", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const urlStr = input.toString();
      if (urlStr.includes("cloudflare-dns.com")) {
        return new Response(
          JSON.stringify({
            Answer: [{ type: 1, data: "93.184.216.34" }],
          }),
          { status: 200 }
        );
      }
      // Return 2MB payload
      const hugeXml = "<rss>" + "x".repeat(MAX_RESPONSE_SIZE + 100) + "</rss>";
      return new Response(hugeXml, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    }) as unknown as typeof fetch;

    const ctx = makeContext("https://example.com/huge.xml");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(413);
    const body = (await res.json()) as JsonResponse;
    expect(body.error).toContain("Response too large");
  });

  it("successfully fetches valid appcast XML through proxy", async () => {
    const validXml =
      '<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>';
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const urlStr = input.toString();
      if (urlStr.includes("cloudflare-dns.com")) {
        return new Response(
          JSON.stringify({
            Answer: [{ type: 1, data: "93.184.216.34" }],
          }),
          { status: 200 }
        );
      }
      return new Response(validXml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
        },
      });
    }) as unknown as typeof fetch;

    const ctx = makeContext("https://example.com/appcast.xml");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonResponse;
    expect(body.xml).toBe(validXml);
  });
});
