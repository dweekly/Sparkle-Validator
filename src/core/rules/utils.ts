import type { XmlElement } from "../types.js";
import { SPARKLE_NS } from "../constants.js";

/**
 * Find all direct child elements with the given local name (no namespace).
 */
export function childElements(
  parent: XmlElement,
  localName: string
): XmlElement[] {
  return parent.children.filter(
    (c): c is XmlElement =>
      c.type === "element" && c.name === localName && !c.namespace
  );
}

/**
 * Find all direct child elements with the given local name in the Sparkle namespace.
 */
export function sparkleChildElements(
  parent: XmlElement,
  localName: string
): XmlElement[] {
  return parent.children.filter(
    (c): c is XmlElement =>
      c.type === "element" && c.name === localName && c.namespace === SPARKLE_NS
  );
}

/**
 * Get the first direct child element with the given local name (no namespace).
 */
export function childElement(
  parent: XmlElement,
  localName: string
): XmlElement | undefined {
  return childElements(parent, localName)[0];
}

/**
 * Get the first direct child element with the given local name in Sparkle namespace.
 */
export function sparkleChildElement(
  parent: XmlElement,
  localName: string
): XmlElement | undefined {
  return sparkleChildElements(parent, localName)[0];
}

/**
 * Get the text content of an element (concatenated text nodes).
 */
export function textContent(element: XmlElement): string {
  return element.children
    .filter(
      (c): c is { type: "text"; text: string; line: number; column: number } =>
        c.type === "text"
    )
    .map((c) => c.text)
    .join("");
}

/**
 * Get an attribute value by qualified name.
 */
export function attr(element: XmlElement, qname: string): string | undefined {
  return element.attributes[qname]?.value;
}

/**
 * Get an attribute that might appear with or without a sparkle: prefix.
 * Checks sparkle-namespaced attributes first, then falls back to un-namespaced.
 */
export function sparkleAttr(
  element: XmlElement,
  localName: string
): string | undefined {
  // Check for sparkle:localName (namespaced)
  for (const a of Object.values(element.attributes)) {
    if (a.namespace === SPARKLE_NS && a.name === localName) {
      return a.value;
    }
  }
  // Check for sparkle:localName (prefix-based, in case namespace resolution differs)
  const prefixed = element.attributes[`sparkle:${localName}`];
  if (prefixed) return prefixed.value;
  return undefined;
}

/**
 * Build a human-readable path to an element, e.g. "rss > channel > item[2] > enclosure"
 */
export function elementPath(element: XmlElement): string {
  const parts: string[] = [];
  let current: XmlElement | undefined = element;
  while (current) {
    let label =
      current.namespace === SPARKLE_NS
        ? `sparkle:${current.name}`
        : current.name;

    // Add index if there are sibling elements with the same name
    if (current.parent) {
      const siblings = current.parent.children.filter(
        (c): c is XmlElement =>
          c.type === "element" &&
          c.name === current!.name &&
          c.namespace === current!.namespace
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        label += `[${idx}]`;
      }
    }

    parts.unshift(label);
    current = current.parent;
  }
  return parts.join(" > ");
}

/**
 * Get all <item> elements from a channel element.
 */
export function getItems(channel: XmlElement): XmlElement[] {
  return childElements(channel, "item");
}

/**
 * Check if a string is a valid absolute URL with an allowed scheme.
 */
export function isValidUrl(
  url: string,
  allowedSchemes = ["https", "http"]
): boolean {
  try {
    const parsed = new URL(url);
    return allowedSchemes.includes(parsed.protocol.replace(":", ""));
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid non-negative integer.
 */
export function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Try to parse an RFC 2822 date string. Returns the Date or null if invalid.
 */
export function parseRfc2822Date(dateStr: string): Date | null {
  // RFC 2822 format: "Thu, 13 Jul 2023 14:30:00 -0700"
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  // Basic sanity check: RFC 2822 dates should include day-of-week and timezone
  const rfc2822Pattern =
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}(:\d{2})?\s+[+-]\d{4}$/;
  if (!rfc2822Pattern.test(dateStr.trim())) return null;

  return d;
}
