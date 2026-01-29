import type { Diagnostic, XmlDocument, XmlElement } from "../types.js";
import { ENCLOSURE_MIME_TYPE, VALID_INSTALLATION_TYPES } from "../constants.js";
import {
  childElements,
  childElement,
  attr,
  sparkleAttr,
  elementPath,
  isNonNegativeInteger,
  sparkleChildElement,
  textContent,
} from "./utils.js";

/** Valid values for sparkle:os attribute */
const VALID_OS_VALUES = ["macos", "windows"] as const;

/**
 * Validate a base64-encoded signature.
 * Returns { valid: true } or { valid: false, reason: string }.
 *
 * Checks:
 * 1. Valid base64 characters (after stripping whitespace)
 * 2. Proper padding (length % 4 === 0 after padding)
 * 3. EdDSA (Ed25519) signatures must be exactly 64 bytes (88 base64 chars)
 * 4. DSA signatures are typically 46-48 bytes (DER-encoded)
 */
function validateSignature(
  sig: string,
  type: "ed" | "dsa"
): { valid: true } | { valid: false; reason: string } {
  // Strip whitespace - base64 often contains line breaks for readability
  const cleanSig = sig.replace(/\s/g, "");

  // Check for valid base64 characters
  const base64Pattern = /^[A-Za-z0-9+/]*=*$/;
  if (!base64Pattern.test(cleanSig)) {
    return { valid: false, reason: "contains invalid base64 characters" };
  }

  // Check padding is correct (length should be multiple of 4)
  if (cleanSig.length % 4 !== 0) {
    return { valid: false, reason: "base64 padding is incorrect" };
  }

  // Try to calculate decoded byte length
  // Formula: (base64Length * 3/4) - padding
  const paddingCount = (cleanSig.match(/=+$/) || [""])[0].length;
  const decodedBytes = (cleanSig.length * 3) / 4 - paddingCount;

  if (type === "ed") {
    // Ed25519 signatures are EXACTLY 64 bytes
    if (decodedBytes !== 64) {
      return {
        valid: false,
        reason: `Ed25519 signature must be 64 bytes, got ${decodedBytes}`,
      };
    }
  } else {
    // DSA signatures are DER-encoded, typically 46-48 bytes
    // but can vary based on r and s values (40-50 bytes is reasonable)
    if (decodedBytes < 40 || decodedBytes > 150) {
      return {
        valid: false,
        reason: `DSA signature length ${decodedBytes} bytes is unusual`,
      };
    }
  }

  return { valid: true };
}

/**
 * E009: Item has neither <enclosure> with url nor <link>
 * E010: <enclosure> missing url attribute
 * E013: length is not a valid non-negative integer
 * E022: sparkle:installationType not "application" or "package"
 * E023-E025: Delta update structure errors
 * E030: sparkle:os attribute has invalid value
 * I010: Enclosure has no signature (optional but recommended)
 * I012: Delta deltaFrom version not found in feed (info - old versions may be pruned)
 * W006: Only DSA signature, no EdDSA
 * W010: Enclosure type not application/octet-stream
 * W011: <enclosure> missing length attribute (Sparkle works without it)
 * W012: <enclosure> missing type attribute (Sparkle works without it)
 * W019: Enclosure length is 0
 * W043: sparkle:os attribute present (deprecated - prefer separate feeds)
 * E031: Signature is malformed (Sparkle will reject)
 * W032: Multiple delta enclosures for same deltaFrom
 */
export function enclosureRules(
  doc: XmlDocument,
  diagnostics: Diagnostic[]
): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");

  // Collect all versions in the feed for W031 check
  const feedVersions = new Set<string>();
  for (const item of items) {
    const versionEl = sparkleChildElement(item, "version");
    if (versionEl) {
      const version = textContent(versionEl).trim();
      if (version) feedVersions.add(version);
    }
    const enclosure = childElement(item, "enclosure");
    if (enclosure) {
      const enclosureVersion = sparkleAttr(enclosure, "version");
      if (enclosureVersion) feedVersions.add(enclosureVersion);
    }
  }

  for (const item of items) {
    const enclosure = childElement(item, "enclosure");
    const link = childElement(item, "link");
    const informationalUpdate = sparkleChildElement(
      item,
      "informationalUpdate"
    );

    // E009: Must have enclosure with url or link
    if (!enclosure && !link && !informationalUpdate) {
      diagnostics.push({
        id: "E009",
        severity: "error",
        message: "Item has neither <enclosure> with url nor <link>",
        line: item.line,
        column: item.column,
        path: elementPath(item),
        fix: 'Add an <enclosure url="..." length="..." type="..."/> or <link> element',
      });
      continue;
    }

    if (enclosure) {
      validateEnclosure(enclosure, diagnostics);

      // Check sparkle:os attribute
      const os = sparkleAttr(enclosure, "os");
      if (os) {
        // W043: Warn that sparkle:os is deprecated, prefer separate feeds
        diagnostics.push({
          id: "W043",
          severity: "warning",
          message: `sparkle:os attribute is deprecated; prefer using separate appcast feeds per platform`,
          line: enclosure.line,
          column: enclosure.column,
          path: elementPath(enclosure),
          fix: "Create separate appcast.xml files for each platform instead of using sparkle:os",
        });

        // E030: Also check for invalid values
        if (
          !(VALID_OS_VALUES as readonly string[]).includes(os.toLowerCase())
        ) {
          diagnostics.push({
            id: "E030",
            severity: "error",
            message: `Invalid sparkle:os value "${os}"; must be "macos" or "windows"`,
            line: enclosure.line,
            column: enclosure.column,
            path: elementPath(enclosure),
            fix: 'Set sparkle:os to "macos" or "windows"',
          });
        }
      }
    }

    // E022: installationType validation (on item-level element)
    const installationTypeEl = sparkleChildElement(item, "installationType");
    if (installationTypeEl) {
      const val = textContent(installationTypeEl).trim();
      if (!(VALID_INSTALLATION_TYPES as readonly string[]).includes(val)) {
        diagnostics.push({
          id: "E022",
          severity: "error",
          message: `Invalid sparkle:installationType "${val}"; must be "application" or "package"`,
          line: installationTypeEl.line,
          column: installationTypeEl.column,
          path: elementPath(installationTypeEl),
          fix: 'Set installationType to "application" or "package"',
        });
      }
    }

    // Check installationType on enclosure attribute
    if (enclosure) {
      const instType = sparkleAttr(enclosure, "installationType");
      if (
        instType &&
        !(VALID_INSTALLATION_TYPES as readonly string[]).includes(instType)
      ) {
        diagnostics.push({
          id: "E022",
          severity: "error",
          message: `Invalid sparkle:installationType "${instType}" on enclosure; must be "application" or "package"`,
          line: enclosure.line,
          column: enclosure.column,
          path: elementPath(enclosure),
          fix: 'Set installationType to "application" or "package"',
        });
      }
    }

    // Delta updates: check <sparkle:deltas> children
    const deltasEl = sparkleChildElement(item, "deltas");
    if (deltasEl) {
      validateDeltas(deltasEl, feedVersions, diagnostics);
    }
  }
}

function validateEnclosure(
  enclosure: XmlElement,
  diagnostics: Diagnostic[]
): void {
  const url = attr(enclosure, "url");
  const length = attr(enclosure, "length");
  const type = attr(enclosure, "type");

  // E010
  if (!url) {
    diagnostics.push({
      id: "E010",
      severity: "error",
      message: "<enclosure> is missing the url attribute",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Add a url attribute to the <enclosure> element",
    });
  }

  // W011: Missing length (Sparkle works without it, used for progress display)
  if (length === undefined) {
    diagnostics.push({
      id: "W011",
      severity: "warning",
      message: "<enclosure> is missing the length attribute",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Add a length attribute with the file size in bytes",
    });
  }

  // W012: Missing type (Sparkle works without it, can infer from URL)
  if (!type) {
    diagnostics.push({
      id: "W012",
      severity: "warning",
      message: "<enclosure> is missing the type attribute",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: `Add type="${ENCLOSURE_MIME_TYPE}" to the <enclosure> element`,
    });
  }

  // E013
  if (length !== undefined && !isNonNegativeInteger(length)) {
    diagnostics.push({
      id: "E013",
      severity: "error",
      message: `Enclosure length "${length}" is not a valid non-negative integer`,
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Set length to the file size in bytes (a non-negative integer)",
    });
  }

  // W019: length is 0
  if (length === "0") {
    diagnostics.push({
      id: "W019",
      severity: "warning",
      message: "Enclosure length is 0; this is usually a mistake",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Set length to the actual file size in bytes",
    });
  }

  // W010: type not application/octet-stream
  if (type && type !== ENCLOSURE_MIME_TYPE) {
    diagnostics.push({
      id: "W010",
      severity: "warning",
      message: `Enclosure type is "${type}", expected "${ENCLOSURE_MIME_TYPE}"`,
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: `Change type to "${ENCLOSURE_MIME_TYPE}"`,
    });
  }

  // I010/W006: Signature checks
  // Signatures are optional in Sparkle but recommended for security
  const edSig = sparkleAttr(enclosure, "edSignature");
  const dsaSig = sparkleAttr(enclosure, "dsaSignature");

  if (!edSig && !dsaSig) {
    diagnostics.push({
      id: "I010",
      severity: "info",
      message:
        "Enclosure has no signature (signatures are optional but recommended)",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Consider adding a sparkle:edSignature attribute for EdDSA signing",
    });
  } else if (dsaSig && !edSig) {
    diagnostics.push({
      id: "W006",
      severity: "warning",
      message:
        "Enclosure only has a DSA signature; DSA is deprecated in favor of EdDSA",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Add a sparkle:edSignature attribute and consider removing dsaSignature",
    });
  }

  // E031: Check if signatures are valid (error because Sparkle will reject malformed signatures)
  if (edSig) {
    const result = validateSignature(edSig, "ed");
    if (!result.valid) {
      diagnostics.push({
        id: "E031",
        severity: "error",
        message: `edSignature is invalid: ${result.reason}`,
        line: enclosure.line,
        column: enclosure.column,
        path: elementPath(enclosure),
        fix: "Ed25519 signatures must be exactly 64 bytes encoded as base64 (88 characters)",
      });
    }
  }
  if (dsaSig) {
    const result = validateSignature(dsaSig, "dsa");
    if (!result.valid) {
      diagnostics.push({
        id: "E031",
        severity: "error",
        message: `dsaSignature is invalid: ${result.reason}`,
        line: enclosure.line,
        column: enclosure.column,
        path: elementPath(enclosure),
        fix: "Ensure the signature is a valid base64-encoded DSA signature",
      });
    }
  }
}

function validateDeltas(
  deltasEl: XmlElement,
  feedVersions: Set<string>,
  diagnostics: Diagnostic[]
): void {
  const deltaEnclosures = childElements(deltasEl, "enclosure");

  // E023: deltas must contain enclosure elements
  if (deltaEnclosures.length === 0) {
    diagnostics.push({
      id: "E023",
      severity: "error",
      message: "<sparkle:deltas> element has no <enclosure> children",
      line: deltasEl.line,
      column: deltasEl.column,
      path: elementPath(deltasEl),
      fix: "Add <enclosure> elements inside <sparkle:deltas> for each delta update",
    });
    return;
  }

  // Track deltaFrom versions for W032 duplicate check
  const deltaFromVersions = new Map<string, XmlElement[]>();

  for (const deltaEnc of deltaEnclosures) {
    // E024: Delta enclosure must have sparkle:deltaFrom
    const deltaFrom = sparkleAttr(deltaEnc, "deltaFrom");
    if (!deltaFrom) {
      diagnostics.push({
        id: "E024",
        severity: "error",
        message: "Delta <enclosure> is missing sparkle:deltaFrom attribute",
        line: deltaEnc.line,
        column: deltaEnc.column,
        path: elementPath(deltaEnc),
        fix: 'Add sparkle:deltaFrom="<previousVersion>" to the delta enclosure',
      });
    } else {
      // I012: Check if deltaFrom version exists in feed (info - old versions may be pruned)
      if (!feedVersions.has(deltaFrom)) {
        diagnostics.push({
          id: "I012",
          severity: "info",
          message: `Delta references version "${deltaFrom}" which does not exist in the feed`,
          line: deltaEnc.line,
          column: deltaEnc.column,
          path: elementPath(deltaEnc),
          fix: "This is normal if the deltaFrom version has been pruned from the feed",
        });
      }

      // Track for W032 duplicate check
      if (!deltaFromVersions.has(deltaFrom)) {
        deltaFromVersions.set(deltaFrom, []);
      }
      deltaFromVersions.get(deltaFrom)!.push(deltaEnc);
    }

    // E025: Delta enclosure must also have standard enclosure attributes
    if (!attr(deltaEnc, "url")) {
      diagnostics.push({
        id: "E025",
        severity: "error",
        message: "Delta <enclosure> is missing the url attribute",
        line: deltaEnc.line,
        column: deltaEnc.column,
        path: elementPath(deltaEnc),
        fix: "Add a url attribute pointing to the delta update file",
      });
    }

    // Also validate the delta enclosure like a regular one (length, type, signatures)
    validateEnclosure(deltaEnc, diagnostics);
  }

  // W032: Check for duplicate deltaFrom versions
  for (const [version, enclosures] of deltaFromVersions) {
    if (enclosures.length > 1) {
      for (let i = 1; i < enclosures.length; i++) {
        diagnostics.push({
          id: "W032",
          severity: "warning",
          message: `Duplicate delta enclosure for deltaFrom="${version}"`,
          line: enclosures[i].line,
          column: enclosures[i].column,
          path: elementPath(enclosures[i]),
          fix: "Remove duplicate delta enclosures; only one delta per source version is needed",
        });
      }
    }
  }
}
