import type { Diagnostic, ValidationResult } from "../../core/types.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const BLUE = "\x1b[34m";

export interface TextFormatOptions {
  color: boolean;
  quiet: boolean;
  noInfo: boolean;
}

function c(text: string, code: string, options: TextFormatOptions): string {
  return options.color ? `${code}${text}${RESET}` : text;
}

function severityIcon(severity: string, options: TextFormatOptions): string {
  switch (severity) {
    case "error":
      return c("ERROR", `${BOLD}${RED}`, options);
    case "warning":
      return c("WARN ", `${BOLD}${YELLOW}`, options);
    case "info":
      return c("INFO ", `${BOLD}${BLUE}`, options);
    default:
      return severity;
  }
}

function formatDiagnostic(
  diag: Diagnostic,
  options: TextFormatOptions
): string {
  const parts: string[] = [];

  // Severity + ID
  parts.push(
    `  ${severityIcon(diag.severity, options)} ${c(diag.id, BOLD, options)}`
  );

  // Location
  if (diag.line) {
    const loc = diag.column ? `${diag.line}:${diag.column}` : `${diag.line}`;
    parts[0] += ` ${c(`[line ${loc}]`, DIM, options)}`;
  }

  // Message
  parts.push(`       ${diag.message}`);

  // Path
  if (diag.path) {
    parts.push(`       ${c(`at ${diag.path}`, DIM, options)}`);
  }

  // Fix suggestion
  if (diag.fix) {
    parts.push(`       ${c(`Fix: ${diag.fix}`, CYAN, options)}`);
  }

  return parts.join("\n");
}

export function formatText(
  result: ValidationResult,
  source: string,
  options: TextFormatOptions
): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(
    c(
      result.valid ? "VALID" : "INVALID",
      result.valid ? `${BOLD}${GREEN}` : `${BOLD}${RED}`,
      options
    ) + ` ${c(source, DIM, options)}`
  );
  lines.push("");

  // Filter diagnostics based on options
  let diags = result.diagnostics;
  if (options.quiet) {
    diags = diags.filter((d) => d.severity === "error");
  } else if (options.noInfo) {
    diags = diags.filter((d) => d.severity !== "info");
  }

  // Group by severity
  const errors = diags.filter((d) => d.severity === "error");
  const warnings = diags.filter((d) => d.severity === "warning");
  const infos = diags.filter((d) => d.severity === "info");

  if (errors.length > 0) {
    lines.push(c(`Errors (${errors.length})`, `${BOLD}${RED}`, options));
    for (const d of errors) {
      lines.push(formatDiagnostic(d, options));
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push(c(`Warnings (${warnings.length})`, `${BOLD}${YELLOW}`, options));
    for (const d of warnings) {
      lines.push(formatDiagnostic(d, options));
    }
    lines.push("");
  }

  if (infos.length > 0) {
    lines.push(c(`Info (${infos.length})`, `${BOLD}${BLUE}`, options));
    for (const d of infos) {
      lines.push(formatDiagnostic(d, options));
    }
    lines.push("");
  }

  // Summary line
  const summary: string[] = [];
  summary.push(
    `${result.errorCount} error${result.errorCount !== 1 ? "s" : ""}`
  );
  summary.push(
    `${result.warningCount} warning${result.warningCount !== 1 ? "s" : ""}`
  );
  if (!options.noInfo) {
    summary.push(`${result.infoCount} info`);
  }
  lines.push(c(summary.join(", "), DIM, options));
  lines.push("");

  return lines.join("\n");
}
