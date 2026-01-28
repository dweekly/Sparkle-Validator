/** The Sparkle XML namespace URI */
export const SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle";

/** Common Sparkle namespace prefixes */
export const SPARKLE_PREFIXES = ["sparkle"];

/** RSS 2.0 element and attribute names (no namespace) */
export const RSS = {
  ROOT: "rss",
  CHANNEL: "channel",
  ITEM: "item",
  TITLE: "title",
  LINK: "link",
  DESCRIPTION: "description",
  PUB_DATE: "pubDate",
  ENCLOSURE: "enclosure",
  LANGUAGE: "language",
} as const;

/** Sparkle-specific element names (local names, used with SPARKLE_NS) */
export const SPARKLE = {
  VERSION: "version",
  SHORT_VERSION_STRING: "shortVersionString",
  RELEASE_NOTES_LINK: "releaseNotesLink",
  FULL_RELEASE_NOTES_LINK: "fullReleaseNotesLink",
  MINIMUM_SYSTEM_VERSION: "minimumSystemVersion",
  MAXIMUM_SYSTEM_VERSION: "maximumSystemVersion",
  MINIMUM_AUTO_UPDATE_VERSION: "minimumAutoupdateVersion",
  IGNORE_SKIPPED_UPGRADES_BELOW_VERSION: "ignoreSkippedUpgradesBelowVersion",
  CRITICAL_UPDATE: "criticalUpdate",
  TAGS: "tags",
  TAG: "tag",
  PHASED_ROLLOUT_INTERVAL: "phasedRolloutInterval",
  CHANNEL: "channel",
  INSTALLATION_TYPE: "installationType",
  INFORMATIONAL_UPDATE: "informationalUpdate",
  DELTA_FROM: "deltas",
} as const;

/** Enclosure attribute names */
export const ENCLOSURE_ATTRS = {
  URL: "url",
  LENGTH: "length",
  TYPE: "type",
  /** Sparkle-namespaced attributes on enclosure */
  SPARKLE_VERSION: "sparkle:version",
  SPARKLE_SHORT_VERSION_STRING: "sparkle:shortVersionString",
  SPARKLE_ED_SIGNATURE: "sparkle:edSignature",
  SPARKLE_DSA_SIGNATURE: "sparkle:dsaSignature",
  SPARKLE_OS: "sparkle:os",
  SPARKLE_DELTA_FROM: "sparkle:deltaFrom",
  SPARKLE_DELTA_FROM_SHORT: "sparkle:deltaFromShortVersionString",
  SPARKLE_INSTALLATION_TYPE: "sparkle:installationType",
} as const;

/** Valid installation type values */
export const VALID_INSTALLATION_TYPES = ["application", "package"] as const;

/** Allowed URL schemes */
export const ALLOWED_URL_SCHEMES = ["https", "http"] as const;

/** Standard enclosure MIME type */
export const ENCLOSURE_MIME_TYPE = "application/octet-stream";

/** macOS version regex pattern (e.g. "10.13", "11.0", "14.0") */
export const MACOS_VERSION_REGEX = /^\d+(\.\d+){0,2}$/;
