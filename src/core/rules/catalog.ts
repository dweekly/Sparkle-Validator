export interface RuleMetadata {
  id: string;
  severity: "error" | "warning" | "info";
  name: string;
  description: string;
}

export const RULE_CATALOG: Record<string, RuleMetadata> = {
  // Errors (E001-E037)
  E001: {
    id: "E001",
    severity: "error",
    name: "xml-parse-error",
    description: "XML parsing error",
  },
  E002: {
    id: "E002",
    severity: "error",
    name: "missing-rss-root",
    description: "Root element is not <rss>",
  },
  E003: {
    id: "E003",
    severity: "error",
    name: "missing-rss-version",
    description: "RSS version is not 2.0",
  },
  E004: {
    id: "E004",
    severity: "error",
    name: "missing-sparkle-namespace",
    description: "Sparkle namespace is missing or incorrect",
  },
  E005: {
    id: "E005",
    severity: "error",
    name: "missing-channel",
    description: "Missing <channel> element",
  },
  E006: {
    id: "E006",
    severity: "error",
    name: "multiple-channels",
    description: "Multiple <channel> elements found",
  },
  E007: {
    id: "E007",
    severity: "error",
    name: "no-items",
    description: "Channel contains no <item> elements",
  },
  E008: {
    id: "E008",
    severity: "error",
    name: "missing-version",
    description: "Item missing version information",
  },
  E009: {
    id: "E009",
    severity: "error",
    name: "missing-enclosure-and-link",
    description: "Item has neither <enclosure> nor <link>",
  },
  E010: {
    id: "E010",
    severity: "error",
    name: "missing-enclosure-url",
    description: "Enclosure missing url attribute",
  },
  E013: {
    id: "E013",
    severity: "error",
    name: "invalid-enclosure-length",
    description: "Enclosure length is not a valid non-negative integer",
  },
  E014: {
    id: "E014",
    severity: "error",
    name: "invalid-enclosure-url",
    description: "Invalid enclosure URL format or unsupported scheme",
  },
  E015: {
    id: "E015",
    severity: "error",
    name: "invalid-link-url",
    description: "Invalid link URL format or unsupported scheme",
  },
  E016: {
    id: "E016",
    severity: "error",
    name: "invalid-release-notes-url",
    description:
      "Invalid sparkle:releaseNotesLink URL format or unsupported scheme",
  },
  E017: {
    id: "E017",
    severity: "error",
    name: "invalid-full-release-notes-url",
    description:
      "Invalid sparkle:fullReleaseNotesLink URL format or unsupported scheme",
  },
  E018: {
    id: "E018",
    severity: "error",
    name: "invalid-delta-enclosure-url",
    description: "Invalid delta enclosure URL format or unsupported scheme",
  },
  E019: {
    id: "E019",
    severity: "error",
    name: "invalid-channel-name",
    description:
      "Invalid sparkle:channel name (must contain only alphanumeric characters, hyphens, underscores, or dots)",
  },
  E020: {
    id: "E020",
    severity: "error",
    name: "invalid-phased-rollout",
    description: "Invalid sparkle:phasedRolloutInterval value",
  },
  E021: {
    id: "E021",
    severity: "error",
    name: "phased-rollout-missing-pubdate",
    description: "phasedRolloutInterval requires pubDate",
  },
  E022: {
    id: "E022",
    severity: "error",
    name: "invalid-installation-type",
    description:
      'Invalid sparkle:installationType (must be "application" or "package")',
  },
  E023: {
    id: "E023",
    severity: "error",
    name: "deltas-missing-enclosure",
    description: "<sparkle:deltas> element has no <enclosure> children",
  },
  E024: {
    id: "E024",
    severity: "error",
    name: "delta-missing-delta-from",
    description: "Delta <enclosure> is missing sparkle:deltaFrom attribute",
  },
  E025: {
    id: "E025",
    severity: "error",
    name: "delta-missing-url",
    description: "Delta <enclosure> is missing url attribute",
  },
  E027: {
    id: "E027",
    severity: "error",
    name: "remote-url-error",
    description: "URL returns non-2xx status",
  },
  E028: {
    id: "E028",
    severity: "error",
    name: "remote-size-mismatch",
    description: "Content-Length does not match declared length",
  },
  E029: {
    id: "E029",
    severity: "error",
    name: "empty-version-string",
    description: "Version string is empty or whitespace-only",
  },
  E030: {
    id: "E030",
    severity: "error",
    name: "invalid-sparkle-os",
    description: "Invalid sparkle:os value (must be macos or windows)",
  },
  E031: {
    id: "E031",
    severity: "error",
    name: "invalid-signature-format",
    description: "Invalid Ed25519/DSA enclosure signature format",
  },
  E032: {
    id: "E032",
    severity: "error",
    name: "missing-ed-signature",
    description:
      "Enclosure missing required sparkle:edSignature in signed-feed mode",
  },
  E033: {
    id: "E033",
    severity: "error",
    name: "invalid-release-notes-signature",
    description: "Release note link signature is malformed",
  },
  E034: {
    id: "E034",
    severity: "error",
    name: "invalid-release-notes-length",
    description:
      "Release note link sparkle:length is not a valid non-negative integer",
  },
  E035: {
    id: "E035",
    severity: "error",
    name: "missing-release-notes-metadata",
    description:
      "Release note link missing required signature or length in signed-feed mode",
  },
  E036: {
    id: "E036",
    severity: "error",
    name: "sparkle-2-10-system-version",
    description:
      "Item bundling Sparkle 2.10+ requires minimumSystemVersion >= 12.0",
  },
  E037: {
    id: "E037",
    severity: "error",
    name: "target-sparkle-selector-error",
    description: "Unmatched or ambiguous target Sparkle version configuration",
  },

  // Warnings (W001-W051)
  W001: {
    id: "W001",
    severity: "warning",
    name: "missing-channel-title",
    description: "Missing channel title",
  },
  W002: {
    id: "W002",
    severity: "warning",
    name: "missing-item-title",
    description: "Missing item title",
  },
  W003: {
    id: "W003",
    severity: "warning",
    name: "missing-pubdate",
    description: "Missing pubDate on item",
  },
  W004: {
    id: "W004",
    severity: "warning",
    name: "invalid-pubdate",
    description: "Invalid pubDate format (RFC 2822 required)",
  },
  W006: {
    id: "W006",
    severity: "warning",
    name: "dsa-only-signature",
    description: "DSA-only signature (deprecated, use EdDSA)",
  },
  W007: {
    id: "W007",
    severity: "warning",
    name: "redundant-version-declaration",
    description:
      "Version declared both as <sparkle:version> element and enclosure attribute",
  },
  W008: {
    id: "W008",
    severity: "warning",
    name: "redundant-short-version-string",
    description:
      "shortVersionString declared both as element and enclosure attribute",
  },
  W009: {
    id: "W009",
    severity: "warning",
    name: "no-release-notes",
    description: "Item has no release notes",
  },
  W010: {
    id: "W010",
    severity: "warning",
    name: "non-standard-mime-type",
    description: "Non-standard enclosure MIME type",
  },
  W011: {
    id: "W011",
    severity: "warning",
    name: "missing-enclosure-length",
    description: "Missing enclosure length attribute",
  },
  W012: {
    id: "W012",
    severity: "warning",
    name: "missing-enclosure-type",
    description: "Missing enclosure type attribute",
  },
  W013: {
    id: "W013",
    severity: "warning",
    name: "min-greater-than-max-system-version",
    description: "minimumSystemVersion is greater than maximumSystemVersion",
  },
  W014: {
    id: "W014",
    severity: "warning",
    name: "relative-url-resolved",
    description: "Relative URL was resolved against base URL",
  },
  W016: {
    id: "W016",
    severity: "warning",
    name: "unencoded-url-characters",
    description: "URL contains unencoded characters",
  },
  W017: {
    id: "W017",
    severity: "warning",
    name: "informational-update-with-enclosure",
    description:
      "informationalUpdate without version conditions has an enclosure",
  },
  W018: {
    id: "W018",
    severity: "warning",
    name: "items-not-sorted-by-version",
    description: "Items not sorted by version (newest first)",
  },
  W019: {
    id: "W019",
    severity: "warning",
    name: "enclosure-length-zero",
    description: "Enclosure length is 0",
  },
  W020: {
    id: "W020",
    severity: "warning",
    name: "duplicate-version",
    description: "Duplicate version found in feed",
  },
  W021: {
    id: "W021",
    severity: "warning",
    name: "url-redirected",
    description: "URL redirects to different location",
  },
  W022: {
    id: "W022",
    severity: "warning",
    name: "content-length-missing",
    description: "Content-Length header missing on remote response",
  },
  W023: {
    id: "W023",
    severity: "warning",
    name: "local-url-skipped",
    description: "Local/private URL skipped during remote validation",
  },
  W024: {
    id: "W024",
    severity: "warning",
    name: "insecure-http-url",
    description: "URL uses insecure HTTP instead of HTTPS",
  },
  W025: {
    id: "W025",
    severity: "warning",
    name: "future-pubdate",
    description: "pubDate is in the future",
  },
  W026: {
    id: "W026",
    severity: "warning",
    name: "ancient-pubdate",
    description: "pubDate is before 2001 (Mac OS X era)",
  },
  W027: {
    id: "W027",
    severity: "warning",
    name: "non-numeric-version",
    description: "Version string is non-numeric",
  },
  W028: {
    id: "W028",
    severity: "warning",
    name: "version-date-inversion",
    description: "Version decreases while pubDate increases",
  },
  W030: {
    id: "W030",
    severity: "warning",
    name: "url-extension-mismatch",
    description: "URL file extension doesn't match expected type",
  },
  W032: {
    id: "W032",
    severity: "warning",
    name: "duplicate-delta-from",
    description: "Multiple delta enclosures for same deltaFrom",
  },
  W033: {
    id: "W033",
    severity: "warning",
    name: "unusual-short-version-string",
    description: "shortVersionString format unusual (not x.y.z)",
  },
  W034: {
    id: "W034",
    severity: "warning",
    name: "invalid-critical-update-version",
    description: "criticalUpdate version attribute not valid format",
  },
  W035: {
    id: "W035",
    severity: "warning",
    name: "mixed-http-https",
    description: "Feed mixes HTTP and HTTPS URLs",
  },
  W036: {
    id: "W036",
    severity: "warning",
    name: "unknown-hardware-architecture",
    description: "hardwareRequirements contains unknown architecture",
  },
  W037: {
    id: "W037",
    severity: "warning",
    name: "missing-xml-lang-on-notes",
    description: "releaseNotesLink missing xml:lang for localization",
  },
  W038: {
    id: "W038",
    severity: "warning",
    name: "cdata-in-version",
    description: "CDATA section used in version/signature elements",
  },
  W039: {
    id: "W039",
    severity: "warning",
    name: "missing-xml-encoding",
    description: "XML declaration missing encoding attribute",
  },
  W040: {
    id: "W040",
    severity: "warning",
    name: "inconsistent-channel-item-language",
    description: "Channel has language but items have different lang",
  },
  W041: {
    id: "W041",
    severity: "warning",
    name: "version-deduced-from-filename",
    description:
      "Version missing but deducible from filename (undocumented Sparkle fallback)",
  },
  W042: {
    id: "W042",
    severity: "warning",
    name: "namespace-variant",
    description: "Sparkle namespace URI differs from canonical",
  },
  W043: {
    id: "W043",
    severity: "warning",
    name: "deprecated-sparkle-os",
    description: "sparkle:os deprecated (prefer separate feeds per platform)",
  },
  W044: {
    id: "W044",
    severity: "warning",
    name: "conflicting-element-enclosure-version",
    description:
      "Conflicting version between <sparkle:version> element and enclosure attribute",
  },
  W045: {
    id: "W045",
    severity: "warning",
    name: "invalid-minimum-system-version",
    description: "minimumSystemVersion not a valid macOS version format",
  },
  W046: {
    id: "W046",
    severity: "warning",
    name: "invalid-maximum-system-version",
    description: "maximumSystemVersion not a valid macOS version format",
  },
  W047: {
    id: "W047",
    severity: "warning",
    name: "version-enclosure-attribute-only",
    description:
      "Version declared only on enclosure attribute (prefer element)",
  },
  W048: {
    id: "W048",
    severity: "warning",
    name: "invalid-minimum-update-version",
    description: "minimumUpdateVersion is empty or non-numeric",
  },
  W049: {
    id: "W049",
    severity: "warning",
    name: "minimum-update-version-exceeds-item",
    description: "minimumUpdateVersion is greater than item version",
  },
  W050: {
    id: "W050",
    severity: "warning",
    name: "release-notes-zero-length",
    description: "sparkle:length on release notes link is 0",
  },
  W051: {
    id: "W051",
    severity: "warning",
    name: "unqualified-release-notes-length",
    description:
      "Release notes link uses unqualified length instead of sparkle:length",
  },

  // Info (I001-I012)
  I001: {
    id: "I001",
    severity: "info",
    name: "feed-summary",
    description: "Summary: N items across M channels",
  },
  I002: {
    id: "I002",
    severity: "info",
    name: "delta-updates-summary",
    description: "Item contains N delta updates",
  },
  I003: {
    id: "I003",
    severity: "info",
    name: "phased-rollout-info",
    description: "Item uses phased rollout",
  },
  I004: {
    id: "I004",
    severity: "info",
    name: "critical-update-info",
    description: "Item marked as critical update",
  },
  I005: {
    id: "I005",
    severity: "info",
    name: "non-macos-platform-info",
    description: "Item targets non-macOS platform",
  },
  I006: {
    id: "I006",
    severity: "info",
    name: "hardware-requirements-info",
    description: "Item requires specific hardware (Sparkle 2.9+)",
  },
  I007: {
    id: "I007",
    severity: "info",
    name: "minimum-update-version-info",
    description: "Item requires minimum app version to update (Sparkle 2.9+)",
  },
  I008: {
    id: "I008",
    severity: "info",
    name: "large-feed-warning",
    description: "Feed contains >50 items (performance consideration)",
  },
  I009: {
    id: "I009",
    severity: "info",
    name: "os-support-range",
    description: "Summary of OS support range across all items",
  },
  I010: {
    id: "I010",
    severity: "info",
    name: "enclosure-no-signature",
    description: "Enclosure has no signature (signatures are optional)",
  },
  I011: {
    id: "I011",
    severity: "info",
    name: "channel-missing-link",
    description: "Missing channel link (informational)",
  },
  I012: {
    id: "I012",
    severity: "info",
    name: "delta-references-pruned-version",
    description:
      "Delta references version not in feed (old versions may be pruned)",
  },
};
