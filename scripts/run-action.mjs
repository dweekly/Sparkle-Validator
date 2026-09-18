#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";

function fail(message, exitCode = 1) {
  process.stderr.write(`::error::${message}\n`);
  process.exit(exitCode);
}

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  const strVal = String(value);
  if (strVal.includes("\n")) {
    const delimiter = `EOF_${crypto.randomUUID().replace(/-/g, "")}`;
    fs.appendFileSync(
      outputPath,
      `${name}<<${delimiter}\n${strVal}\n${delimiter}\n`
    );
  } else {
    fs.appendFileSync(outputPath, `${name}=${strVal}\n`);
  }
}

// 1. Extract & validate inputs
const file = process.env.INPUT_FILE;
if (!file || file.trim() === "") {
  fail("Input 'file' is required and cannot be empty.");
}

const strict = process.env.INPUT_STRICT ?? "false";
const checkUrls = process.env.INPUT_CHECK_URLS ?? "false";
const quiet = process.env.INPUT_QUIET ?? "false";
const noInfo = process.env.INPUT_NO_INFO ?? "false";
const requireSignedFeed = process.env.INPUT_REQUIRE_SIGNED_FEED ?? "false";
const format = process.env.INPUT_FORMAT ?? "text";
const timeout = process.env.INPUT_TIMEOUT ?? "10000";
const targetSparkleVersion = process.env.INPUT_TARGET_SPARKLE_VERSION;
const baseUrl = process.env.INPUT_BASE_URL;

for (const [name, val] of [
  ["strict", strict],
  ["check-urls", checkUrls],
  ["quiet", quiet],
  ["no-info", noInfo],
  ["require-signed-feed", requireSignedFeed],
]) {
  if (val !== "true" && val !== "false") {
    fail(`Invalid boolean value for '${name}': '${val}'. Expected 'true' or 'false'.`);
  }
}

if (format !== "text" && format !== "json") {
  fail(`Invalid format: '${format}'. Expected 'text' or 'json'.`);
}

if (!/^\d+$/.test(timeout)) {
  fail(`Invalid timeout: '${timeout}'. Must be a positive integer.`);
}
const timeoutNum = parseInt(timeout, 10);
if (timeoutNum <= 0 || timeoutNum > 300000) {
  fail(`Timeout out of bounds: '${timeout}'. Must be between 1 and 300000 ms.`);
}

// 2. Build command arguments
const cmdArgs = [];
if (strict === "true") cmdArgs.push("--strict");
if (checkUrls === "true") cmdArgs.push("--check-urls", "--timeout", timeout);
if (quiet === "true") cmdArgs.push("--quiet");
if (noInfo === "true") cmdArgs.push("--no-info");
if (requireSignedFeed === "true") cmdArgs.push("--require-signed-feed");
if (targetSparkleVersion && targetSparkleVersion.trim() !== "") {
  cmdArgs.push("--target-sparkle-version", targetSparkleVersion.trim());
}
if (baseUrl && baseUrl.trim() !== "") {
  cmdArgs.push("--base-url", baseUrl.trim());
}
cmdArgs.push("--format", "json");
cmdArgs.push("--", file);

// 3. Resolve command to execute
const rawCmd = process.env.SPARKLE_VALIDATOR_CMD || "npx sparkle-validator@1.3.0";
const cmdParts = rawCmd.trim().split(/\s+/);
const executable = cmdParts[0];
const fullArgs = [...cmdParts.slice(1), ...cmdArgs];

// 4. Run validation ONCE
const child = spawnSync(executable, fullArgs, {
  encoding: "utf-8",
  shell: false,
});

const stdout = child.stdout ? child.stdout.trim() : "";
const stderr = child.stderr ? child.stderr.trim() : "";

let result = null;
try {
  result = JSON.parse(stdout);
} catch {
  // Not valid JSON (e.g. CLI crash, missing file, startup error)
}

if (!result || typeof result !== "object") {
  if (stderr) process.stderr.write(stderr + "\n");
  if (stdout) process.stderr.write(stdout + "\n");

  setOutput("valid", "false");
  setOutput("error_count", "1");
  setOutput("warning_count", "0");
  setOutput("info_count", "0");
  setOutput("json", "");

  const exitCode = child.status !== null && child.status !== 0 ? child.status : 1;
  process.exit(exitCode);
}

// 5. Output GITHUB_OUTPUT variables
const isValid = Boolean(result.valid);
const errorCount = result.errorCount ?? 0;
const warningCount = result.warningCount ?? 0;
const infoCount = result.infoCount ?? 0;

setOutput("valid", String(isValid));
setOutput("error_count", String(errorCount));
setOutput("warning_count", String(warningCount));
setOutput("info_count", String(infoCount));
setOutput("json", JSON.stringify(result, null, 2));

// 6. Display human-readable text or JSON
if (format === "json") {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} else {
  // Format human-readable text
  process.stdout.write(`\n${isValid ? "✓ VALID" : "✗ INVALID"}: ${result.source || file}\n\n`);

  const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      const loc = d.line ? ` [line ${d.column ? `${d.line}:${d.column}` : d.line}]` : "";
      process.stdout.write(`  ${d.severity.toUpperCase().padEnd(5)} ${d.id}${loc}\n`);
      process.stdout.write(`        ${d.message}\n`);
      if (d.path) {
        process.stdout.write(`        at ${d.path}\n`);
      }
      if (d.fix) {
        process.stdout.write(`        Fix: ${d.fix}\n`);
      }
      process.stdout.write("\n");
    }
  }

  process.stdout.write(
    `${errorCount} error${errorCount !== 1 ? "s" : ""}, ` +
    `${warningCount} warning${warningCount !== 1 ? "s" : ""}, ` +
    `${infoCount} info\n\n`
  );
}

// 7. Exit code calculation
if (!isValid) {
  process.exit(1);
}
if (strict === "true" && warningCount > 0) {
  process.exit(1);
}
if (child.status !== null && child.status !== 0) {
  process.exit(child.status);
}

process.exit(0);
