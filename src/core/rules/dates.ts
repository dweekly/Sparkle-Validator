import type { Diagnostic, XmlDocument, XmlElement } from "../types.js";
import {
  childElements,
  childElement,
  textContent,
  elementPath,
  parseRfc2822Date,
} from "./utils.js";

// Sparkle was first released in 2006, Mac OS X in 2001
// We'll use 2001 as a reasonable lower bound
const EARLIEST_REASONABLE_DATE = new Date("2001-01-01T00:00:00Z");

// Allow a small grace period for timezone differences (1 day in the future)
const FUTURE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * W003: Item missing <pubDate>
 * W004: <pubDate> not RFC 2822 format
 * W018: Items not sorted by pubDate descending
 * W025: <pubDate> is in the future
 * W026: <pubDate> is unreasonably old
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
      const now = new Date();

      // W025: Date is in the future
      if (parsedDate.getTime() > now.getTime() + FUTURE_GRACE_MS) {
        diagnostics.push({
          id: "W025",
          severity: "warning",
          message: `<pubDate> "${dateStr}" is in the future`,
          line: pubDateEl.line,
          column: pubDateEl.column,
          path: elementPath(pubDateEl),
          fix: "Set the publication date to when the release was actually published",
        });
      }

      // W026: Date is unreasonably old (before Mac OS X existed)
      if (parsedDate.getTime() < EARLIEST_REASONABLE_DATE.getTime()) {
        const year = parsedDate.getFullYear();
        diagnostics.push({
          id: "W026",
          severity: "warning",
          message: `<pubDate> "${dateStr}" (year ${year}) is implausibly old for a macOS app update`,
          line: pubDateEl.line,
          column: pubDateEl.column,
          path: elementPath(pubDateEl),
          fix: "Verify the publication date is correct",
        });
      }

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
        message:
          "Items are not sorted by pubDate in descending order (newest first)",
        line: items[0].line,
        column: items[0].column,
        path: elementPath(items[0]),
        fix: "Sort <item> elements so the newest release appears first",
      });
    }
  }
}
