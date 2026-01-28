import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validate } from "../core/validator.js";
import { formatText } from "./formatters/text.js";
import { formatJson } from "./formatters/json.js";
import { fetchUrl, readStdin } from "./fetch.js";

const program = new Command();

program
  .name("sparkle-validator")
  .description("Validate Sparkle appcast.xml feeds")
  .version("1.0.0")
  .argument("<source>", 'File path, URL (http/https), or "-" for stdin')
  .option("-f, --format <type>", "Output format: text or json", "text")
  .option("-s, --strict", "Treat warnings as errors")
  .option("--no-info", "Suppress informational messages")
  .option("--no-color", "Disable colored output")
  .option("-q, --quiet", "Only show errors")
  .action(async (source: string, options) => {
    try {
      const xml = await readSource(source);
      const result = validate(xml);

      const useColor =
        options.color !== false && process.stdout.isTTY && !process.env.NO_COLOR;

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

async function readSource(source: string): Promise<string> {
  // Stdin
  if (source === "-") {
    return readStdin();
  }

  // URL
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return fetchUrl(source);
  }

  // File path
  const filePath = resolve(source);
  try {
    return readFileSync(filePath, "utf-8");
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    if (code === "EISDIR") {
      throw new Error(`Path is a directory: ${filePath}`);
    }
    throw err;
  }
}

program.parse();
