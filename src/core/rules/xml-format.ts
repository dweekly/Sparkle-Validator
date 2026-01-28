import type { Diagnostic, XmlDocument } from "../types.js";

/**
 * W038: CDATA section used in version/signature elements
 * W039: XML declaration missing encoding attribute
 *
 * These rules require access to the raw XML string.
 */

/**
 * Check for XML formatting issues that require raw XML string access.
 */
export function xmlFormatRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[],
  rawXml: string
): void {
  // W039: Check for missing encoding in XML declaration
  checkXmlDeclaration(rawXml, diagnostics);

  // W038: Check for CDATA in version/signature elements
  if (doc.root) {
    checkCdataInSensitiveElements(rawXml, diagnostics);
  }
}

/**
 * W039: Check if XML declaration has encoding attribute.
 */
function checkXmlDeclaration(rawXml: string, diagnostics: Diagnostic[]): void {
  // Look for XML declaration at the start
  const xmlDeclMatch = rawXml.match(/^<\?xml\s+([^?]*)\?>/i);
  if (xmlDeclMatch) {
    const declaration = xmlDeclMatch[1];
    // Check if encoding is specified
    if (!declaration.includes("encoding=")) {
      diagnostics.push({
        id: "W039",
        severity: "warning",
        message:
          'XML declaration is missing encoding attribute; recommend adding encoding="UTF-8"',
        line: 1,
        column: 1,
        fix: '<?xml version="1.0" encoding="UTF-8"?>',
      });
    }
  }
}

/**
 * W038: Check for CDATA sections in version or signature elements.
 */
function checkCdataInSensitiveElements(
  rawXml: string,
  diagnostics: Diagnostic[]
): void {
  // Pattern to match CDATA in sparkle:version elements
  const versionCdataPattern = /<sparkle:version[^>]*>\s*<!\[CDATA\[/gi;
  const sigCdataPattern =
    /sparkle:(ed|dsa)Signature\s*=\s*["']\s*<!\[CDATA\[/gi;

  // Check for CDATA in sparkle:version elements
  let match;
  while ((match = versionCdataPattern.exec(rawXml)) !== null) {
    const line = getLineNumber(rawXml, match.index);
    diagnostics.push({
      id: "W038",
      severity: "warning",
      message:
        "CDATA section used in <sparkle:version>; this may cause parsing issues",
      line,
      column: 1,
      fix: "Use plain text content instead of CDATA for version elements",
    });
  }

  // Also check for enclosure with CDATA in version attribute (unusual but possible)
  const enclosureVersionCdataPattern =
    /sparkle:version\s*=\s*["']\s*<!\[CDATA\[/gi;
  while ((match = enclosureVersionCdataPattern.exec(rawXml)) !== null) {
    const line = getLineNumber(rawXml, match.index);
    diagnostics.push({
      id: "W038",
      severity: "warning",
      message:
        "CDATA section used in sparkle:version attribute; this may cause parsing issues",
      line,
      column: 1,
      fix: "Use plain text value instead of CDATA for version attributes",
    });
  }

  // Check for CDATA in signature attributes (very unusual but theoretically possible in malformed XML)
  while ((match = sigCdataPattern.exec(rawXml)) !== null) {
    const line = getLineNumber(rawXml, match.index);
    diagnostics.push({
      id: "W038",
      severity: "warning",
      message:
        "CDATA section used in signature attribute; this may cause parsing issues",
      line,
      column: 1,
      fix: "Use plain base64 value instead of CDATA for signature attributes",
    });
  }
}

/**
 * Get the line number for a character position in a string.
 */
function getLineNumber(str: string, position: number): number {
  const lines = str.substring(0, position).split("\n");
  return lines.length;
}
