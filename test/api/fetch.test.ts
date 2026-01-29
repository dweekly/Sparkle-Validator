import { describe, it, expect } from "vitest";

/**
 * Tests for the fetch proxy SSRF protection.
 *
 * These test the isPrivateIP function extracted from functions/api/fetch.ts.
 * The actual function runs in Cloudflare Workers, so we duplicate the logic here for testing.
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

  describe("should handle IPv6 addresses", () => {
    it("blocks loopback ::1", () => {
      expect(isPrivateIP("::1")).toBe(true);
    });

    it("blocks link-local fe80::", () => {
      expect(isPrivateIP("fe80::1")).toBe(true);
      expect(isPrivateIP("fe80:0000:0000:0000:0000:0000:0000:0001")).toBe(true);
    });

    it("blocks unique local fc00::/7", () => {
      expect(isPrivateIP("fc00::1")).toBe(true);
      expect(isPrivateIP("fd00::1")).toBe(true);
    });

    it("blocks IPv4-mapped IPv6 with private IPv4", () => {
      expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIP("::ffff:10.0.0.1")).toBe(true);
      expect(isPrivateIP("::ffff:192.168.1.1")).toBe(true);
      expect(isPrivateIP("::ffff:169.254.169.254")).toBe(true);
    });

    it("allows IPv4-mapped IPv6 with public IPv4", () => {
      expect(isPrivateIP("::ffff:8.8.8.8")).toBe(false);
      expect(isPrivateIP("::ffff:1.1.1.1")).toBe(false);
    });

    it("allows public IPv6 (falls through)", () => {
      expect(isPrivateIP("2001:4860:4860::8888")).toBe(false); // Google IPv6
    });
  });

  describe("SSRF attack vectors", () => {
    it("blocks cloud metadata endpoints", () => {
      // AWS metadata
      expect(isPrivateIP("169.254.169.254")).toBe(true);
      // Common internal IPs
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("192.168.1.1")).toBe(true);
    });

    it("blocks localhost variants", () => {
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      expect(isPrivateIP("127.0.0.2")).toBe(true);
      expect(isPrivateIP("127.1.1.1")).toBe(true);
    });
  });
});
