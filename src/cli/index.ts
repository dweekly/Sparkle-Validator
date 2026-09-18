import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validate } from "../core/validator.js";
import { validateRemote } from "../core/remote.js";
import { parseXml } from "../core/parser.js";
import { formatText } from "./formatters/text.js";
import { formatJson } from "./formatters/json.js";
import { fetchUrl, readStdin } from "./fetch.js";

const program = new Command();

declare const __VERSION__: string;

program
  .name("sparkle-validator")
  .description("Validate Sparkle appcast.xml feeds")
  .version(__VERSION__)
  .argument("<source>", 'File path, URL (http/https), or "-" for stdin')
  .option("-f, --format <type>", "Output format: text or json", "text")
  .option("-s, --strict", "Treat warnings as errors")
  .option("--no-info", "Suppress informational messages")
  .option("--no-color", "Disable colored output")
  .option("-q, --quiet", "Only show errors")
  .option("-c, --check-urls", "Check that URLs exist and sizes match")
  .option("--timeout <ms>", "Timeout for URL checks in milliseconds", "10000")
  .option("--concurrency <n>", "Maximum concurrent URL checks", "5")
  .option("--base-url <url>", "Base URL for resolving relative links")
  .option(
    "--require-signed-feed",
    "Require valid Ed25519 signatures for enclosures and release notes"
  )
  .option(
    "--target-sparkle-version <version>",
    "Target Sparkle version context (e.g. 2.10.0 or 200=2.10.0)"
  )
  .action(async (source: string, options) => {
    try {
      const { xml, feedUrl } = await readSource(source);
      const effectiveBaseUrl = options.baseUrl || feedUrl;
      const result = validate(xml, {
        baseUrl: effectiveBaseUrl,
        requireSignedFeed: options.requireSignedFeed,
        targetSparkleVersion: options.targetSparkleVersion,
      });

      // Run remote validation if --check-urls is specified
      if (options.checkUrls) {
        const timeout = parseInt(options.timeout, 10);
        if (isNaN(timeout) || timeout <= 0) {
          throw new Error(
            `Invalid --timeout value "${options.timeout}": must be a positive number`
          );
        }

        const concurrency = parseInt(options.concurrency, 10);
        if (isNaN(concurrency) || concurrency < 1 || concurrency > 50) {
          throw new Error(
            `Invalid --concurrency value "${options.concurrency}": must be an integer between 1 and 50`
          );
        }

        const { document } = parseXml(xml);
        const remoteDiags = await validateRemote(document, {
          timeout,
          concurrency,
          baseUrl: effectiveBaseUrl,
        });
        result.diagnostics.push(...remoteDiags);

        // Recalculate counts
        result.errorCount = result.diagnostics.filter(
          (d) => d.severity === "error"
        ).length;
        result.warningCount = result.diagnostics.filter(
          (d) => d.severity === "warning"
        ).length;
        result.infoCount = result.diagnostics.filter(
          (d) => d.severity === "info"
        ).length;
        result.valid = result.errorCount === 0;

        // Re-sort diagnostics
        const severityOrder = { error: 0, warning: 1, info: 2 };
        result.diagnostics.sort((a, b) => {
          const sev =
            severityOrder[a.severity as keyof typeof severityOrder] -
            severityOrder[b.severity as keyof typeof severityOrder];
          if (sev !== 0) return sev;
          return (a.line ?? 0) - (b.line ?? 0);
        });
      }

      const useColor =
        options.color !== false &&
        process.stdout.isTTY &&
        !process.env.NO_COLOR;

      let output: string;
      if (options.format === "json") {
        output = formatJson(result, source, {
          quiet: options.quiet ?? false,
          noInfo: !options.info,
        });
      } else {
        output = formatText(result, source, {
          color: useColor,
          quiet: options.quiet ?? false,
          noInfo: !options.info,
        });
      }

      process.stdout.write(output + "\n");

      // Exit code
      if (options.strict && result.warningCount > 0) {
        process.exit(1);
      }
      process.exit(result.valid ? 0 : 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(2);
    }
  });

async function readSource(
  source: string
): Promise<{ xml: string; feedUrl?: string }> {
  // Stdin
  if (source === "-") {
    const xml = await readStdin();
    return { xml };
  }

  // URL
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const { text, finalUrl } = await fetchUrl(source);
    return { xml: text, feedUrl: finalUrl };
  }

  // File path
  const filePath = resolve(source);
  try {
    const xml = readFileSync(filePath, "utf-8");
    return { xml };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`, { cause: err });
    }
    if (code === "EISDIR") {
      throw new Error(`Path is a directory: ${filePath}`, { cause: err });
    }
    throw err;
  }
}

program.parse();
