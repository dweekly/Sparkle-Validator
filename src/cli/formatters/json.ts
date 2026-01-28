import type { ValidationResult } from "../../core/types.js";

export interface JsonFormatOptions {
  quiet: boolean;
  noInfo: boolean;
}

export function formatJson(
  result: ValidationResult,
  source: string,
  options: JsonFormatOptions
): string {
  let diagnostics = result.diagnostics;
  if (options.quiet) {
    diagnostics = diagnostics.filter((d) => d.severity === "error");
  } else if (options.noInfo) {
    diagnostics = diagnostics.filter((d) => d.severity !== "info");
  }

  const output = {
    valid: result.valid,
    source,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    infoCount: result.infoCount,
    diagnostics: diagnostics.map((d) => ({
      id: d.id,
      severity: d.severity,
      message: d.message,
      ...(d.line !== undefined && { line: d.line }),
      ...(d.column !== undefined && { column: d.column }),
      ...(d.path && { path: d.path }),
      ...(d.fix && { fix: d.fix }),
    })),
  };

  return JSON.stringify(output, null, 2);
}
