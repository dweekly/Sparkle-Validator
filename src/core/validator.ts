import { parseXml } from "./parser.js";
import { allRules } from "./rules/index.js";
import { xmlFormatRules } from "./rules/xml-format.js";
import type {
  Diagnostic,
  ValidationResult,
  ValidationOptions,
} from "./types.js";

/**
 * Consolidate multiple diagnostics of the same type into single entries.
 * This prevents a "blitz" of repeated warnings/errors for the same issue.
 * The first occurrence is kept, with its message updated to show count.
 */
export function consolidateDiagnostics(
  diagnostics: Diagnostic[]
): Diagnostic[] {
  // Group diagnostics by ID
  const byId = new Map<string, Diagnostic[]>();
  for (const diag of diagnostics) {
    const existing = byId.get(diag.id) || [];
    existing.push(diag);
    byId.set(diag.id, existing);
  }

  const consolidated: Diagnostic[] = [];

  for (const diags of byId.values()) {
    if (diags.length === 1) {
      consolidated.push(diags[0]);
    } else {
      // Keep the first occurrence, but note additional occurrences in message
      const first = diags[0];
      const additionalCount = diags.length - 1;
      consolidated.push({
        ...first,
        message: `${first.message} (and ${additionalCount} more similar issue${additionalCount > 1 ? "s" : ""})`,
      });
    }
  }

  return consolidated;
}

/**
 * Validate an appcast XML string against all Sparkle rules.
 *
 * Runs parser, all rule checks, format rules, and deduplicates/consolidates
 * results into a clean, actionable ValidationResult.
 *
 * @param xml - The raw XML string to validate
 * @param options - Optional validation configuration
 * @returns A ValidationResult with all diagnostics
 */
export function validate(
  xml: string,
  options?: ValidationOptions
): ValidationResult {
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
      rule(document, diagnostics, options);

      // If structural errors were found (E002-E007), skip deeper rules
      // since they require a valid RSS/channel/item structure
      if (
        rule === allRules[0] &&
        diagnostics.some(
          (d) =>
            d.severity === "error" &&
            ["E002", "E003", "E004", "E005", "E006", "E007"].includes(d.id)
        )
      ) {
        // Still run remaining rules if we at least have channel+items
        const hasChannel = diagnostics.every((d) => d.id !== "E005");
        const hasItems = diagnostics.every((d) => d.id !== "E007");
        if (!hasChannel || !hasItems) break;
      }
    }

    // Step 3: Run XML format rules (require raw XML string)
    xmlFormatRules(document, diagnostics, xml);
  }

  // Step 4: Sort diagnostics: errors first, then warnings, then info
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
