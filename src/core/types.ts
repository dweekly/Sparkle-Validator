/** Severity of a diagnostic message */
export type Severity = "error" | "warning" | "info";

/** A single diagnostic produced by the validator */
export interface Diagnostic {
  /** Rule identifier, e.g. "E001", "W003", "I002" */
  id: string;
  /** Severity level */
  severity: Severity;
  /** Human-readable message */
  message: string;
  /** Line number (1-based), if available */
  line?: number;
  /** Column number (1-based), if available */
  column?: number;
  /** Element path, e.g. "rss > channel > item[2] > enclosure" */
  path?: string;
  /** Optional suggestion for how to fix the issue */
  fix?: string;
}

/** Result of validating an appcast XML string */
export interface ValidationResult {
  /** Whether the feed is valid (no errors) */
  valid: boolean;
  /** All diagnostics (errors, warnings, info) */
  diagnostics: Diagnostic[];
  /** Count of errors */
  errorCount: number;
  /** Count of warnings */
  warningCount: number;
  /** Count of informational messages */
  infoCount: number;
}

/** Represents a parsed XML element node */
export interface XmlElement {
  type: "element";
  /** Local name (without prefix) */
  name: string;
  /** Full qualified name (with prefix if present) */
  qname: string;
  /** Namespace URI, if any */
  namespace: string;
  /** Prefix used, if any */
  prefix: string;
  /** Attributes as key-value pairs, keyed by qualified name */
  attributes: Record<string, XmlAttribute>;
  /** Child nodes (elements and text) */
  children: XmlNode[];
  /** Start line (1-based) */
  line: number;
  /** Start column (1-based) */
  column: number;
  /** Parent element (undefined for root) */
  parent?: XmlElement;
}

/** An XML attribute */
export interface XmlAttribute {
  /** Local name */
  name: string;
  /** Qualified name */
  qname: string;
  /** Namespace URI */
  namespace: string;
  /** Prefix */
  prefix: string;
  /** Attribute value */
  value: string;
}

/** A text node */
export interface XmlText {
  type: "text";
  /** Text content */
  text: string;
  /** Line (1-based) */
  line: number;
  /** Column (1-based) */
  column: number;
}

/** Union type for any XML node */
export type XmlNode = XmlElement | XmlText;

/** Parsed XML document */
export interface XmlDocument {
  /** Root element, if parsed successfully */
  root?: XmlElement;
  /** All namespace declarations found (prefix -> URI) */
  namespaces: Record<string, string>;
}

/** A validation rule function */
export type ValidationRule = (
  doc: XmlDocument,
  diagnostics: Diagnostic[]
) => void;
