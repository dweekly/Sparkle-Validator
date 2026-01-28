import { parseXml } from "./parser.js";
import { allRules } from "./rules/index.js";
import type { Diagnostic, ValidationResult } from "./types.js";

/**
 * Validate an appcast XML string.
 *
 * @param xml - The raw XML string to validate
 * @returns A ValidationResult with all diagnostics
 */
export function validate(xml: string): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  // Step 1: Parse the XML
  const { document, diagnostics: parseDiags } = parseXml(xml);
  diagnostics.push(...parseDiags);

  // If parsing produced fatal errors (no root element), still run
  // structural rules to give a useful error like E002
  const hasFatalParseError =
    parseDiags.some((d) => d.severity === "error") && !document.root;

  if (!hasFatalParseError) {
    // Step 2: Run all validation rules
    for (const rule of allRules) {
      rule(document, diagnostics);

      // If structural errors were found (E002-E007), skip deeper rules
      // since they require a valid RSS/channel/item structure
      if (
        rule === allRules[0] &&
        diagnostics.some(
          (d) =>
            d.severity === "error" &&
            ["E002", "E003", "E004", "E005", "E006", "E007", "E026"].includes(
              d.id
            )
        )
      ) {
        // Still run remaining rules if we at least have channel+items
        const hasChannel = diagnostics.every((d) => d.id !== "E005");
        const hasItems = diagnostics.every((d) => d.id !== "E007");
        if (!hasChannel || !hasItems) break;
      }
    }
  }

  // Sort diagnostics: errors first, then warnings, then info
  const severityOrder = { error: 0, warning: 1, info: 2 };
  diagnostics.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    // Within same severity, sort by line number
    return (a.line ?? 0) - (b.line ?? 0);
  });

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === "warning"
  ).length;
  const infoCount = diagnostics.filter((d) => d.severity === "info").length;

  return {
    valid: errorCount === 0,
    diagnostics,
    errorCount,
    warningCount,
    infoCount,
  };
}
