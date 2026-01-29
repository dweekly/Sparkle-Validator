# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Diagnostic consolidation** — Multiple diagnostics of the same type are now
  consolidated into a single entry with a count (e.g., "message (and 109 more similar issues)").
  This prevents output spam when validating large feeds with repeated issues.

- **Ed25519 signature validation** — E031 now properly validates Ed25519 signatures:
  - Must be exactly 64 bytes (88 base64 characters with padding)
  - Strips whitespace before validation (line-wrapped base64 is valid)
  - Invalid signatures are errors (not warnings) since Sparkle rejects them

- **Website prefill** — The web app now prefills with iTerm2's appcast URL as a working demo

- **Version fallback detection**
  - W041: Warns when version is missing but can be deduced from filename
    (Sparkle's undocumented fallback: splits URL by underscore, e.g., `MyApp_2.5.zip` → `2.5`)

- **Silent failure prevention rules**
  - E029: Reports empty or whitespace-only version strings
  - E030: Reports invalid `sparkle:os` values (must be "macos" or "windows")
  - W027: Warns about non-numeric version strings (may cause comparison failures)
  - W028: Warns when version decreases while pubDate increases

- **Data integrity rules**
  - E031: Errors on invalid Ed25519/DSA signatures (Sparkle will reject malformed signatures)
  - W030: Warns about suspicious URL file extensions (.html, .jpg, etc. for downloads)
  - W031: Warns when delta `deltaFrom` version doesn't exist in feed
  - W032: Warns about duplicate delta enclosures for same `deltaFrom`
  - W035: Warns when feed mixes HTTP and HTTPS URLs

- **Best practice rules**
  - W033: Warns about unusual `shortVersionString` format (not x.y.z)
  - W034: Warns about invalid `criticalUpdate` version attribute format
  - W036: Warns about unknown hardware architectures in `hardwareRequirements`
  - W037: Warns about missing `xml:lang` on multiple `releaseNotesLink` elements
  - W038: Warns about CDATA sections in version/signature elements
  - W039: Warns about missing encoding attribute in XML declaration
  - W040: Warns about inconsistent language settings between channel and items

- **Informational rules**
  - I008: Reports when feed contains >50 items (performance consideration)
  - I009: Summarizes OS version requirements across all items

- **Public appcast URL collection** for testing
  - Added `test/fixtures/remote/appcast-urls.txt` with verified real-world appcasts

### Changed

- **Missing signature is now informational** (signatures are optional in Sparkle)
  - W005 → I010: "Enclosure has no signature" is now info, not warning

- **Removed W015** — Version on enclosure attribute is actually the primary location
  Sparkle checks (it checks enclosure attribute first, then falls back to element).
  This is not a concern, so the warning was removed.

- **Downgraded namespace check to warning** (Sparkle accepts variants)
  - E026 → W042: Non-canonical Sparkle namespace URI (old format without "www.", HTTPS variant)
  - Known variants are now accepted; elements are still recognized correctly

- **Improved URL scheme support**
  - Now accepts `feed://` URLs (common RSS convention) in addition to `http://` and `https://`

- **Smarter version detection**
  - E008 now only fires when version truly cannot be determined
  - If version can be deduced from filename (Sparkle's fallback), emits W041 instead

- **Downgraded enclosure attribute checks to warnings** (Sparkle works without these)
  - E011 → W011: Missing `length` attribute (used for progress display only)
  - E012 → W012: Missing `type` attribute (Sparkle can infer from URL)

## [1.1.0] - 2025-01-28

### Added

- **Remote URL validation** (`--check-urls` flag)
  - Verifies that enclosure URLs return HTTP 2xx status codes (E027)
  - Validates Content-Length header matches declared `length` attribute (E028)
  - Reports URL redirects as warnings (W021)
  - Warns when Content-Length header is missing (W022)
  - Skips local/private URLs with warning (W023)
  - Warns about insecure HTTP URLs (W024)
  - Configurable timeout via `--timeout` flag (default: 10000ms)
  - Checks main enclosures, delta updates, and release notes links
  - Detailed error messages for DNS failures, TLS errors, connection issues

- **Sparkle 2.9+ feature detection**
  - I006: Reports `sparkle:hardwareRequirements` (e.g., arm64, x86_64)
  - I007: Reports `sparkle:minimumUpdateVersion` restrictions

- **Date plausibility checks**
  - W025: Warns when pubDate is in the future
  - W026: Warns when pubDate is implausibly old (before 2001/Mac OS X era)

- **XSD Schema** for xmllint validation
  - `appcast.xsd` - Main RSS 2.0 structure with Sparkle imports
  - `sparkle-appcast.xsd` - Sparkle namespace elements and attributes
  - Usage: `xmllint --schema appcast.xsd --noout yourfile.xml`

- **Documentation**
  - `APPCAST-FORMAT.md` - Comprehensive Sparkle appcast format specification
  - `CLAUDE-SKILL.md` - Instructions for AI assistants working with appcasts
  - `ROADMAP.md` - Future feature plans

### Changed

- I005 now only reports non-macOS targets (sparkle:os="macos" is the default and no longer flagged)

### Fixed

- Corrected handling of `sparkle:os` attribute (was incorrectly looking for `sparkle:osType`)

## [1.0.0] - 2025-01-27

### Added

- Initial release
- XML structure validation (RSS 2.0 + Sparkle namespace)
- 26 error rules (E001-E026)
- 20 warning rules (W001-W020)
- 5 info rules (I001-I005)
- CLI with text/JSON output formats
- stdin support (`-` argument)
- URL fetching (http/https sources)
- `--strict` mode (treat warnings as errors)
- `--quiet` mode (errors only)
- `--no-info` flag (suppress informational messages)
- `--no-color` flag (disable colored output)
- Web application at sparklevalidator.com
- npm package: `sparkle-validator`
- Homebrew tap: `brew install dweekly/sparkle-validator/sparkle-validator`

[Unreleased]: https://github.com/dweekly/sparkle-validator/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/dweekly/sparkle-validator/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dweekly/sparkle-validator/releases/tag/v1.0.0
