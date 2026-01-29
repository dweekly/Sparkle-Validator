#!/usr/bin/env npx tsx
/**
 * Validate live appcast feeds and generate CSV report
 *
 * Usage: npx tsx scripts/validate-live-feeds.ts
 *
 * Outputs: test/fixtures/remote/validation-report-{version}-{date}.csv
 */

import { readFileSync, writeFileSync } from "fs";
import { validate } from "../src/core/validator.js";
import { version } from "../package.json";

interface FeedResult {
  url: string;
  name: string;
  status: "VALID" | "INVALID" | "FETCH_ERROR" | "TIMEOUT" | "PARSE_ERROR";
  errorCount: number;
  warningCount: number;
  infoCount: number;
  errors: string[];
  warnings: string[];
  fetchTimeMs: number;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 15000
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": `sparkle-validator/${version}`,
        Accept: "application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractName(url: string, comment: string): string {
  // Try to extract name from comment (e.g., "# iTerm2 (2w)")
  const match = comment.match(/^#\s*([^(]+)/);
  if (match) {
    return match[1].trim();
  }
  // Fall back to domain
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function validateFeed(
  url: string,
  name: string
): Promise<FeedResult> {
  const startTime = Date.now();

  try {
    const xml = await fetchWithTimeout(url);
    const fetchTimeMs = Date.now() - startTime;

    const result = validate(xml);

    const errors = result.diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => d.id);
    const warnings = result.diagnostics
      .filter((d) => d.severity === "warning")
      .map((d) => d.id);

    return {
      url,
      name,
      status: result.valid ? "VALID" : "INVALID",
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      infoCount: result.infoCount,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      fetchTimeMs,
    };
  } catch (err) {
    const fetchTimeMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    let status: FeedResult["status"] = "FETCH_ERROR";
    if (message.includes("aborted") || message.includes("timeout")) {
      status = "TIMEOUT";
    } else if (message.includes("HTTP 404")) {
      status = "FETCH_ERROR";
    }

    return {
      url,
      name,
      status,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      errors: [message.substring(0, 50)],
      warnings: [],
      fetchTimeMs,
    };
  }
}

async function main() {
  console.log(`Sparkle Validator v${version} - Live Feed Validation Report\n`);

  // Read URLs from file
  const urlsFile = readFileSync(
    "test/fixtures/remote/appcast-urls.txt",
    "utf-8"
  );

  const urls: { url: string; name: string }[] = [];
  let lastComment = "";

  for (const line of urlsFile.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      if (trimmed.startsWith("#") && !trimmed.startsWith("# =")) {
        lastComment = trimmed;
      }
      continue;
    }

    // Extract URL (may have inline comment)
    const [urlPart, ...commentParts] = trimmed.split(" # ");
    const url = urlPart.trim();
    const inlineComment = commentParts.join(" # ").trim();

    if (url.startsWith("http")) {
      urls.push({
        url,
        name: extractName(url, inlineComment ? `# ${inlineComment}` : lastComment),
      });
    }
  }

  console.log(`Found ${urls.length} URLs to validate\n`);

  const results: FeedResult[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let errorCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const { url, name } = urls[i];
    process.stdout.write(`[${i + 1}/${urls.length}] ${name}... `);

    const result = await validateFeed(url, name);
    results.push(result);

    if (result.status === "VALID") {
      validCount++;
      console.log(
        `\x1b[32mVALID\x1b[0m (${result.warningCount}w, ${result.infoCount}i) [${result.fetchTimeMs}ms]`
      );
    } else if (result.status === "INVALID") {
      invalidCount++;
      console.log(
        `\x1b[31mINVALID\x1b[0m (${result.errorCount}e, ${result.warningCount}w) [${result.fetchTimeMs}ms]`
      );
    } else {
      errorCount++;
      console.log(`\x1b[33m${result.status}\x1b[0m [${result.fetchTimeMs}ms]`);
    }

    // Small delay to be nice to servers
    await new Promise((r) => setTimeout(r, 100));
  }

  // Generate CSV
  const date = new Date().toISOString().split("T")[0];
  const csvFilename = `test/fixtures/remote/validation-report-v${version}-${date}.csv`;

  const csvHeader =
    "URL,Name,Status,Errors,Warnings,Info,Error IDs,Warning IDs,Fetch Time (ms),Version,Date";
  const csvRows = results.map((r) =>
    [
      `"${r.url}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      r.status,
      r.errorCount,
      r.warningCount,
      r.infoCount,
      `"${r.errors.join(";")}"`,
      `"${r.warnings.join(";")}"`,
      r.fetchTimeMs,
      version,
      date,
    ].join(",")
  );

  const csv = [csvHeader, ...csvRows].join("\n");
  writeFileSync(csvFilename, csv);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total feeds tested: ${results.length}`);
  console.log(`  Valid:       ${validCount}`);
  console.log(`  Invalid:     ${invalidCount}`);
  console.log(`  Fetch error: ${errorCount}`);
  console.log(`\nCSV report saved to: ${csvFilename}`);

  // Warning distribution
  const warningCounts = new Map<string, number>();
  for (const r of results) {
    for (const w of r.warnings) {
      warningCounts.set(w, (warningCounts.get(w) || 0) + 1);
    }
  }

  console.log("\nTop warnings across all feeds:");
  const sortedWarnings = [...warningCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [id, count] of sortedWarnings) {
    console.log(`  ${id}: ${count} feeds`);
  }
}

main().catch(console.error);
