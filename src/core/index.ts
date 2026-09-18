export { validate } from "./validator.js";
export { validateRemote } from "./remote.js";
export type { RemoteValidationOptions } from "./remote.js";
export type {
  Diagnostic,
  Severity,
  ValidationResult,
  ValidationRule,
  XmlDocument,
  XmlElement,
  XmlAttribute,
  XmlText,
  XmlNode,
} from "./types.js";
export { SPARKLE_NS } from "./constants.js";
export { parseXml } from "./parser.js";
export { RULE_CATALOG } from "./rules/catalog.js";
export type { RuleMetadata } from "./rules/catalog.js";
