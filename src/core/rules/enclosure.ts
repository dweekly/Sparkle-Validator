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

/**
 * E009: Item has neither <enclosure> with url nor <link>
 * E010: <enclosure> missing url attribute
 * E011: <enclosure> missing length attribute
 * E012: <enclosure> missing type attribute
 * E013: length is not a valid non-negative integer
 * E022: sparkle:installationType not "application" or "package"
 * E023-E025: Delta update structure errors
 * W005: Enclosure has no signature at all
 * W006: Only DSA signature, no EdDSA
 * W010: Enclosure type not application/octet-stream
 * W019: Enclosure length is 0
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
      validateDeltas(deltasEl, diagnostics);
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

  // E011
  if (length === undefined) {
    diagnostics.push({
      id: "E011",
      severity: "error",
      message: "<enclosure> is missing the length attribute",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Add a length attribute with the file size in bytes",
    });
  }

  // E012
  if (!type) {
    diagnostics.push({
      id: "E012",
      severity: "error",
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

  // W005/W006: Signature checks
  const edSig = sparkleAttr(enclosure, "edSignature");
  const dsaSig = sparkleAttr(enclosure, "dsaSignature");

  if (!edSig && !dsaSig) {
    diagnostics.push({
      id: "W005",
      severity: "warning",
      message: "Enclosure has no signature (no edSignature or dsaSignature)",
      line: enclosure.line,
      column: enclosure.column,
      path: elementPath(enclosure),
      fix: "Add a sparkle:edSignature attribute for EdDSA signing",
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
}

function validateDeltas(deltasEl: XmlElement, diagnostics: Diagnostic[]): void {
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
}
