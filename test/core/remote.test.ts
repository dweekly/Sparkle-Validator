import { describe, it, expect } from "vitest";
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

describe("remote validation - local fixtures (no network)", () => {
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
});

// These tests require network access - skip in CI
const SKIP_NETWORK_TESTS = process.env.CI === "true";

describe.skipIf(SKIP_NETWORK_TESTS)("remote validation - network tests", () => {
  it("W024: warns about HTTP URLs", async () => {
    const xml = readFixture("http-url.xml");
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document, { timeout: 10000 });

    const w024 = diagnostics.find((d) => d.id === "W024");
    expect(w024).toBeDefined();
    expect(w024?.message).toContain("insecure HTTP");
  });

  it("E027: errors on non-existent domain", async () => {
    const xml = readFixture("nonexistent-domain.xml");
    const { document } = parseXml(xml);
    const diagnostics = await validateRemote(document, { timeout: 5000 });

    const e027 = diagnostics.find((d) => d.id === "E027");
    expect(e027).toBeDefined();
    expect(e027?.message).toContain("DNS lookup failed");
  });
});
