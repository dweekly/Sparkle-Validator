import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const RUNNER_PATH = path.resolve(process.cwd(), "scripts/run-action.mjs");
const CLI_PATH = path.resolve(process.cwd(), "dist/cli/index.js");

describe("GitHub Action Runner (R01)", () => {
  let tempDir: string;
  let outputFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "action-test-"));
    outputFile = path.join(tempDir, "github_output");
    fs.writeFileSync(outputFile, "");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function parseGithubOutput(content: string): Record<string, string> {
    const outputs: Record<string, string> = {};
    const lines = content.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }
      if (line.includes("<<")) {
        const [name, delimiter] = line.split("<<");
        i++;
        const multiline: string[] = [];
        while (i < lines.length && lines[i] !== delimiter) {
          multiline.push(lines[i]);
          i++;
        }
        outputs[name] = multiline.join("\n");
        i++;
      } else {
        const [name, val] = line.split("=");
        outputs[name] = val;
        i++;
      }
    }
    return outputs;
  }

  function runRunner(
    env: Record<string, string>,
    allowFailure = false
  ): { status: number; stdout: string; stderr: string; outputs: Record<string, string> } {
    try {
      const stdout = execFileSync("node", [RUNNER_PATH], {
        env: {
          ...process.env,
          GITHUB_OUTPUT: outputFile,
          SPARKLE_VALIDATOR_CMD: `node ${CLI_PATH}`,
          ...env,
        },
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const outputContent = fs.readFileSync(outputFile, "utf-8");
      return {
        status: 0,
        stdout,
        stderr: "",
        outputs: parseGithubOutput(outputContent),
      };
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      const outputContent = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf-8") : "";
      if (!allowFailure) {
        throw new Error(`Command failed with status ${err.status}: ${err.stderr || err.stdout}`);
      }
      return {
        status: err.status ?? 1,
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        outputs: parseGithubOutput(outputContent),
      };
    }
  }

  it("successfully validates a valid feed and sets action outputs", () => {
    const res = runRunner({
      INPUT_FILE: "test/fixtures/valid/minimal.xml",
      INPUT_STRICT: "false",
      INPUT_FORMAT: "text",
    });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("VALID: test/fixtures/valid/minimal.xml");
    expect(res.outputs.valid).toBe("true");
    expect(res.outputs.error_count).toBe("0");
    expect(res.outputs.warning_count).toBe("0");
    expect(res.outputs.info_count).toBe("1");

    const json = JSON.parse(res.outputs.json);
    expect(json.valid).toBe(true);
  });

  it("outputs formatted JSON when format=json", () => {
    const res = runRunner({
      INPUT_FILE: "test/fixtures/valid/minimal.xml",
      INPUT_FORMAT: "json",
    });

    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.valid).toBe(true);
    expect(res.outputs.valid).toBe("true");
  });

  it("fails validation for an invalid feed", () => {
    const res = runRunner(
      {
        INPUT_FILE: "test/fixtures/invalid/malformed.xml",
        INPUT_FORMAT: "text",
      },
      true
    );

    expect(res.status).toBe(1);
    expect(res.stdout).toContain("INVALID");
    expect(res.outputs.valid).toBe("false");
    expect(parseInt(res.outputs.error_count, 10)).toBeGreaterThan(0);
  });

  it("enforces strict mode on warnings", () => {
    const res = runRunner(
      {
        INPUT_FILE: "test/fixtures/invalid/bad-date.xml",
        INPUT_STRICT: "true",
      },
      true
    );

    expect(res.status).toBe(1);
  });

  it("prevents shell injection and evaluates inputs literally", () => {
    const maliciousProbe = path.join(tempDir, "probe.txt");
    const maliciousInput = `$(touch "${maliciousProbe}") " \`touch "${maliciousProbe}"\` ' ; touch "${maliciousProbe}"`;

    const res = runRunner(
      {
        INPUT_FILE: maliciousInput,
      },
      true
    );

    // Ensure the malicious command was NOT executed
    expect(fs.existsSync(maliciousProbe)).toBe(false);
    expect(res.status).not.toBe(0);
  });

  it("handles files with leading dashes and spaces safely", () => {
    const spaceFile = path.join(tempDir, "--test file with spaces.xml");
    const validXml = fs.readFileSync("test/fixtures/valid/minimal.xml", "utf-8");
    fs.writeFileSync(spaceFile, validXml);

    const res = runRunner({
      INPUT_FILE: spaceFile,
    });

    expect(res.status).toBe(0);
    expect(res.outputs.valid).toBe("true");
  });

  it("rejects invalid boolean inputs", () => {
    const res = runRunner(
      {
        INPUT_FILE: "test/fixtures/valid/minimal.xml",
        INPUT_STRICT: "not-a-bool",
      },
      true
    );

    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Invalid boolean value for 'strict'");
  });

  it("rejects invalid timeout values", () => {
    const res = runRunner(
      {
        INPUT_FILE: "test/fixtures/valid/minimal.xml",
        INPUT_TIMEOUT: "-50",
      },
      true
    );

    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Invalid timeout");
  });

  it("rejects invalid format values", () => {
    const res = runRunner(
      {
        INPUT_FILE: "test/fixtures/valid/minimal.xml",
        INPUT_FORMAT: "yaml",
      },
      true
    );

    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Invalid format");
  });

  it("invokes the validator exactly once", () => {
    const countFile = path.join(tempDir, "invocation_count.txt");
    fs.writeFileSync(countFile, "0");

    // Wrapper script to count invocations
    const counterScript = path.join(tempDir, "counter_validator.mjs");
    fs.writeFileSync(
      counterScript,
      `
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const current = parseInt(fs.readFileSync(${JSON.stringify(countFile)}, 'utf-8'), 10);
fs.writeFileSync(${JSON.stringify(countFile)}, String(current + 1));
const res = spawnSync('node', [${JSON.stringify(CLI_PATH)}, ...process.argv.slice(2)], { encoding: 'utf-8' });
if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);
process.exit(res.status ?? 0);
`
    );

    const res = runRunner({
      INPUT_FILE: "test/fixtures/valid/minimal.xml",
      INPUT_FORMAT: "text",
      SPARKLE_VALIDATOR_CMD: `node ${counterScript}`,
    });

    expect(res.status).toBe(0);
    const count = parseInt(fs.readFileSync(countFile, "utf-8"), 10);
    expect(count).toBe(1);
  });
});
