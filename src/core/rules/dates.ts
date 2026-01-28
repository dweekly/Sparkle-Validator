import type { Diagnostic, XmlDocument, XmlElement } from "../types.js";
import {
  childElements,
  childElement,
  textContent,
  elementPath,
  parseRfc2822Date,
} from "./utils.js";

/**
 * W003: Item missing <pubDate>
 * W004: <pubDate> not RFC 2822 format
 * W018: Items not sorted by pubDate descending
 */
export function dateRules(doc: XmlDocument, diagnostics: Diagnostic[]): void {
  const { root } = doc;
  if (!root || root.name !== "rss") return;

  const channel = childElement(root, "channel");
  if (!channel) return;

  const items = childElements(channel, "item");
  const dates: { item: XmlElement; date: Date }[] = [];

  for (const item of items) {
    const pubDateEl = childElement(item, "pubDate");

    // W003: Missing pubDate
    if (!pubDateEl) {
      diagnostics.push({
        id: "W003",
        severity: "warning",
        message: "Item is missing <pubDate>",
        line: item.line,
        column: item.column,
        path: elementPath(item),
        fix: "Add a <pubDate> element with an RFC 2822 date (e.g., Thu, 13 Jul 2023 14:30:00 -0700)",
      });
      continue;
    }

    const dateStr = textContent(pubDateEl).trim();
    if (!dateStr) {
      diagnostics.push({
        id: "W003",
        severity: "warning",
        message: "Item has empty <pubDate>",
        line: pubDateEl.line,
        column: pubDateEl.column,
        path: elementPath(pubDateEl),
        fix: "Set the <pubDate> content to an RFC 2822 date",
      });
      continue;
    }

    // W004: Not RFC 2822
    const parsedDate = parseRfc2822Date(dateStr);
    if (!parsedDate) {
      diagnostics.push({
        id: "W004",
        severity: "warning",
        message: `<pubDate> "${dateStr}" is not in RFC 2822 format`,
        line: pubDateEl.line,
        column: pubDateEl.column,
        path: elementPath(pubDateEl),
        fix: "Use RFC 2822 format: Day, DD Mon YYYY HH:MM:SS +ZZZZ (e.g., Thu, 13 Jul 2023 14:30:00 -0700)",
      });
    } else {
      dates.push({ item, date: parsedDate });
    }
  }

  // W018: Check sort order (should be newest first)
  if (dates.length >= 2) {
    let sorted = true;
    for (let i = 1; i < dates.length; i++) {
      if (dates[i].date.getTime() > dates[i - 1].date.getTime()) {
        sorted = false;
        break;
      }
    }
    if (!sorted) {
      diagnostics.push({
        id: "W018",
        severity: "warning",
        message: "Items are not sorted by pubDate in descending order (newest first)",
        line: items[0].line,
        column: items[0].column,
        path: elementPath(items[0]),
        fix: "Sort <item> elements so the newest release appears first",
      });
    }
  }
}
