import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseXml } from "../../src/core/parser.js";
import { validateRemote } from "../../src/core/remote.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../fixtures/remote");

function readFixture(name: string): string {
  return readFileSync(resolve(fixturesDir, name), "utf-8");
}

describe("remote validation - input validation", () => {
  it("rejects invalid concurrency values", async () => {
    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="100"/></item></channel></rss>`;
    const { document } = parseXml(xml);

    await expect(validateRemote(document, { concurrency: 0 })).rejects.toThrow(
      "concurrency"
    );

    await expect(validateRemote(document, { concurrency: -1 })).rejects.toThrow(
      "concurrency"
    );

    await expect(
      validateRemote(document, { concurrency: 1.5 })
    ).rejects.toThrow("concurrency");

    await expect(validateRemote(document, { concurrency: 51 })).rejects.toThrow(
      "concurrency"
    );
  });

  it("rejects invalid timeout values", async () => {
    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="100"/></item></channel></rss>`;
    const { document } = parseXml(xml);

    await expect(validateRemote(document, { timeout: 0 })).rejects.toThrow(
      "timeout"
    );

    await expect(validateRemote(document, { timeout: -100 })).rejects.toThrow(
      "timeout"
    );

    await expect(validateRemote(document, { timeout: 70000 })).rejects.toThrow(
      "timeout"
    );
  });
});

describe("remote validation - local fixtures and address filtering", () => {
  it("W023: warns about localhost URLs and skips check", async () => {
    const xml = readFixture("localhost-url.xml");
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document, { timeout: 1000 });

    const w023 = diagnostics.find((d) => d.id === "W023");
    expect(w023).toBeDefined();
    expect(w023?.message).toContain("Local/private URL");
    expect(w023?.message).toContain("localhost");

    // Should NOT have E027 since we skip the check
    const e027 = diagnostics.find((d) => d.id === "E027");
    expect(e027).toBeUndefined();
  });

  it("W023: warns about private IP URLs and skips check", async () => {
    const xml = readFixture("private-ip-url.xml");
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document, { timeout: 1000 });

    const w023s = diagnostics.filter((d) => d.id === "W023");
    expect(w023s.length).toBe(2); // Two items with private IPs

    expect(w023s[0]?.message).toContain("192.168");
    expect(w023s[1]?.message).toContain("10.0.0");
  });

  it("W023: skips IPv6 loopback and private IPv6 addresses", async () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><enclosure url="http://[::1]/app.zip" length="100"/></item>
    <item><enclosure url="http://[fd00::1]/app.zip" length="100"/></item>
    <item><enclosure url="http://[::ffff:127.0.0.1]/app.zip" length="100"/></item>
  </channel>
</rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);
    const w023s = diagnostics.filter((d) => d.id === "W023");
    expect(w023s.length).toBe(3);
  });
});

describe("remote validation - deterministic mocked network checks", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("E028: detects Content-Length mismatch against declared size", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "Content-Length": "2048" },
      })
    );

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    const e028 = diagnostics.find((d) => d.id === "E028");
    expect(e028).toBeDefined();
    expect(e028?.message).toContain(
      "declared 1024 bytes, server reports 2048 bytes"
    );
  });

  it("W022: detects missing Content-Length header", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {},
      })
    );

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    const w022 = diagnostics.find((d) => d.id === "W022");
    expect(w022).toBeDefined();
    expect(w022?.message).toContain("did not return Content-Length header");
  });

  it("E027: detects HTTP error status codes (e.g. 404)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 404,
      })
    );

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/notfound.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    const e027 = diagnostics.find((d) => d.id === "E027");
    expect(e027).toBeDefined();
    expect(e027?.message).toContain("HTTP 404");
  });

  it("W021: tracks redirects to new locations", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "https://cdn.example.com/app.zip" },
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "Content-Length": "1024" },
        })
      );

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    const w021 = diagnostics.find((d) => d.id === "W021");
    expect(w021).toBeDefined();
    expect(w021?.message).toContain("https://cdn.example.com/app.zip");
  });

  it("W023: blocks redirects targeting private/internal network addresses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/private.zip" },
      })
    );

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    const w023 = diagnostics.find((d) => d.id === "W023");
    expect(w023).toBeDefined();
    expect(w023?.message).toContain("Local/private redirect destination");
  });

  it("falls back to GET if HEAD returns 405 Method Not Allowed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 405,
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "Content-Length": "1024" },
        })
      );
    globalThis.fetch = fetchMock;

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("GET");
    expect(diagnostics.filter((d) => d.severity === "error").length).toBe(0);
  });

  it("resolves relative enclosure URLs when baseUrl is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "Content-Length": "1024" },
      })
    );
    globalThis.fetch = fetchMock;

    const xml = `<rss version="2.0"><channel><item><enclosure url="downloads/app.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    await validateRemote(document, {
      baseUrl: "https://example.com/feed/appcast.xml",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/feed/downloads/app.zip",
      expect.anything()
    );
  });

  it("W023: skips relative enclosure URLs when baseUrl is absent", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const xml = `<rss version="2.0"><channel><item><enclosure url="downloads/app.zip" length="1024"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    expect(fetchMock).not.toHaveBeenCalled();
    const w023 = diagnostics.find((d) => d.id === "W023");
    expect(w023).toBeDefined();
    expect(w023?.message).toContain("Relative URL without base URL context");
  });

  it("handles 405 Method Not Allowed fallback to GET Range and parses total from Content-Range", async () => {
    const fetchMock = vi
      .fn()
      // First call is HEAD -> return 405
      .mockResolvedValueOnce(
        new Response(null, {
          status: 405,
          statusText: "Method Not Allowed",
        })
      )
      // Second call is GET with Range: bytes=0-0 -> return 206 with Content-Range
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0]), {
          status: 206,
          statusText: "Partial Content",
          headers: {
            "Content-Length": "1",
            "Content-Range": "bytes 0-0/12345678",
          },
        })
      );
    globalThis.fetch = fetchMock;

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="12345678"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    // Should NOT report E028 mismatch (1 byte vs 12345678)
    const e028 = diagnostics.find((d) => d.id === "E028");
    expect(e028).toBeUndefined();

    // Verify both requests were made
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("HEAD");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("GET");
    expect(fetchMock.mock.calls[1][1]?.headers?.Range).toBe("bytes=0-0");
  });

  it("handles RFC 9110 unknown total size in Content-Range (bytes 0-0/*) on HTTP 206 as unknown size (W022, not E028)", async () => {
    const fetchMock = vi
      .fn()
      // First call HEAD -> 405 Method Not Allowed
      .mockResolvedValueOnce(
        new Response(null, {
          status: 405,
          statusText: "Method Not Allowed",
        })
      )
      // Second call GET Range: bytes=0-0 -> return 206 with Content-Range: bytes 0-0/* and Content-Length: 1
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0]), {
          status: 206,
          statusText: "Partial Content",
          headers: {
            "Content-Length": "1",
            "Content-Range": "bytes 0-0/*",
          },
        })
      );
    globalThis.fetch = fetchMock;

    const xml = `<rss version="2.0"><channel><item><enclosure url="https://example.com/app.zip" length="52428800"/></item></channel></rss>`;
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document);

    // MUST NOT report E028 (mismatch claiming server size is 1 byte)
    const e028 = diagnostics.find((d) => d.id === "E028");
    expect(e028).toBeUndefined();

    // MUST report W022 (server did not return complete size, cannot verify declared size)
    const w022 = diagnostics.find((d) => d.id === "W022");
    expect(w022).toBeDefined();
    expect(w022?.message).toContain("cannot verify declared size");
  });
});

// Optional live network tests - skip in CI
const SKIP_NETWORK_TESTS = process.env.CI === "true";

describe.skipIf(SKIP_NETWORK_TESTS)(
  "remote validation - live network tests",
  () => {
    it(
      "W024: warns about HTTP URLs",
      async () => {
        const xml = readFixture("http-url.xml");
        const { document } = parseXml(xml);
        const diagnostics = await validateRemote(document, { timeout: 10000 });

        const w024 = diagnostics.find((d) => d.id === "W024");
        expect(w024).toBeDefined();
        expect(w024?.message).toContain("insecure HTTP");
      },
      15000
    );

    it("E027: errors on non-existent domain", async () => {
      const xml = readFixture("nonexistent-domain.xml");
      const { document } = parseXml(xml);
      const diagnostics = await validateRemote(document, { timeout: 5000 });

      const e027 = diagnostics.find((d) => d.id === "E027");
      expect(e027).toBeDefined();
      expect(e027?.message).toContain("DNS lookup failed");
    });
  }
);
