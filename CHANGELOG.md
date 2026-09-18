# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **GitHub Action Hardening (R01):** Replaced shell interpolation in `action.yml` with positional data arguments passed to a dedicated runner (`scripts/run-action.mjs`), eliminating shell command injection vulnerabilities. Single-pass execution eliminates redundant network calls.
- **Proxy Egress & SSRF Protection (R02, R04):** Hardened Cloudflare fetch proxy (`functions/api/fetch.ts`) against SSRF attacks:
  - Added IPv6 filtering for loopback (`::1`), link-local (`fe80::/10`), unique local (`fc00::/7`), and IPv4-mapped IPv6 (`::ffff:0:0/96`).
  - Enforced egress security across redirect chains (up to 3 hops).
  - Explicitly blocked internal cloud metadata endpoints (e.g., `169.254.169.254`, `metadata.google.internal`).
  - Bounded response bodies to 10 MB and timeouts to 5 seconds.
- **Remote Validation Bounds (R10):** Enforced concurrency (1–50) and timeout (1–60000ms) bounds in `src/core/remote.ts`. Added guaranteed timer cleanup in `finally` blocks and stream cancellation on probe aborts.

### Added

- **Sparkle 2.10 Compatibility (R11):** Added `E036` enforcing `sparkle:minimumSystemVersion >= 12.0` for items bundling Sparkle 2.10+, with item targeting (`--target-sparkle-version`) to preserve older releases in mixed-history feeds without false positives.
- **Strict Signature & Signed-Feed Validation (R08):**
  - Pure browser-safe base64 decoding with canonical padding and length verification.
  - `E031`: Invalid Ed25519 signature format (must decode to exactly 64 bytes).
  - `E033`: Malformed release notes link signature.
  - `E034`: Malformed `sparkle:length` on release notes link.
  - `E032` / `E035`: Enforce signatures and lengths on all updates and release notes in signed-feed mode (`requireSignedFeed`).
  - `W050`: Warn if release notes length is 0 bytes.
  - `W051`: Warn if release notes length uses unqualified `length` instead of `sparkle:length`.
- **Sparkle 2.9 Feature Validation (R07):** Added validation for `sparkle:hardwareRequirements` (`I006`, `W036`) and `sparkle:minimumUpdateVersion` (`I007`, `W048`, `W049`).
- **Web UI Keyboard Accessibility (R12):** Converted collapsible section headers to native `<button type="button">` controls with `aria-expanded` and `aria-controls` linked to section regions. Added automatic focus restoration to `#results` on run completion and visible `:focus-visible` styling.
- **Offline Self-Contained XSD Validation (R05):** Vendored `xml.xsd` to allow offline schema compilation without network fetches. Qualified `sparkle:version` on `criticalUpdate` and `xml:lang` on `releaseNotesLink`.

### Changed

- **Node.js Baseline (R03):** Raised minimum Node.js engine baseline from `>=20` to `>=22`. Updated CI matrix to `[22, 24]`.
- **Lossless Diagnostics & ID Disambiguation (R06):**
  - Resolved rule ID collisions: assigned unique IDs `W044` (conflicting version), `W045` (invalid min macOS), `W046` (invalid max macOS), and `W047` (enclosure-only version).
  - `result.diagnostics` now preserves every occurrence losslessly without dropping distinct messages or line numbers. Added `consolidateDiagnostics()` presentation helper.
  - Enforced strict ID uniqueness across all rule files via automated tests.
- **Item Interpretation & Precedence (R07):** `<sparkle:version>` element now strictly takes precedence over `<enclosure sparkle:version>` attribute, matching Sparkle framework behavior. Supported both canonical and legacy Sparkle namespace URI aliases.
- **URL Resolution (R09):** Validates all localized release notes links and supports relative URL resolution against `--base-url` (or remote feed URL in web proxy).

## [1.2.1] - 2026-04-29

Maintenance release. No user-facing validator behavior changes.

### Fixed

- Resolved 8 npm audit vulnerabilities (3 moderate, 5 high) in
  devDependencies via `npm audit fix`
- Release workflow no longer corrupts the Homebrew tap on partial
  failures, and now verifies `brew install` succeeds end-to-end
- Stabilized XSD schema test under parallel `xmllint` load (raised
  per-test timeout to 30s)

### Changed

- **Minimum Node.js bumped from 18 to 20.** Node 18 went EOL in
  April 2025 and the new vitest/rolldown toolchain requires Node 20+
- TypeScript 5.9.3 → 6.0.3
- ESLint 9 → 10
- CI matrix now tests Node 20, 22, 24
- All other devDependencies updated to latest minor/patch

## [1.2.0] - 2026-01-28

### Changed

Based on feedback from [zorgiepoo](https://github.com/sparkle-project/Sparkle/discussions/2845#discussioncomment-15635499) (Sparkle maintainer):

- **W014 → I011**: Channel missing `<link>` downgraded from warning to info
  (not required by Sparkle)

- **W031 → I012**: Delta referencing non-existent version downgraded to info
  (normal when old versions are pruned from feed)

- **W018**: Now checks version sort order instead of date sort order
  (Sparkle sorts items by version, not by publication date)

- **W028**: Now accounts for update branches/channels
  (no longer warns when items on different channels have version/date mismatches)

- **W017**: Only warns about `informationalUpdate` + `enclosure` when there are
  no version conditions (having minimumSystemVersion, minimumAutoupdateVersion,
  etc. makes this combination valid)

- **W041**: Updated message to emphasize that filename-based version deduction
  is undocumented and not officially supported by Sparkle

### Added

- **W042**: Warns when version is only specified as enclosure attribute
  (prefer `<sparkle:version>` element for clarity)

- **W043**: Warns when `sparkle:os` attribute is used
  (deprecated; prefer separate appcast feeds per platform)

- **GitHub Action** (`action.yml`) for easy CI/CD integration
  - Use with `uses: dweekly/Sparkle-Validator@v1`
  - Inputs: `file`, `strict`, `check-urls`, `timeout`, `quiet`, `format`
  - Outputs: `valid`, `error-count`, `warning-count`, `info-count`, `json`

- **Live feed validation script** (`scripts/validate-live-feeds.ts`)
  - Tests against 500+ real-world appcasts
  - Generates timestamped CSV reports with per-feed diagnostics

- **README methodology section** documenting empirical approach:
  - Analysis of 500+ production appcasts
  - Feedback integration from Sparkle maintainer
  - Real-world pattern identification

### Testing

- Added 10 new tests for rule changes (202 total tests)
- Live validation of 84 active feeds (83 valid, 1 invalid)

## [1.1.0] - 2026-01-28

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

- **Diagnostic consolidation** — Multiple diagnostics of the same type are now
  consolidated into a single entry with a count (e.g., "message (and 109 more similar issues)").
  This prevents output spam when validating large feeds with repeated issues.

- **Ed25519 signature validation** — E031 properly validates Ed25519 signatures:
  - Must be exactly 64 bytes (88 base64 characters with padding)
  - Strips whitespace before validation (line-wrapped base64 is valid)
  - Invalid signatures are errors (not warnings) since Sparkle rejects them

- **Sparkle 2.9+ feature detection**
  - I006: Reports `sparkle:hardwareRequirements` (e.g., arm64, x86_64)
  - I007: Reports `sparkle:minimumUpdateVersion` restrictions

- **Date plausibility checks**
  - W025: Warns when pubDate is in the future
  - W026: Warns when pubDate is implausibly old (before 2001/Mac OS X era)

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
  - I010: Notes when enclosure has no signature (signatures are optional)

- **XSD Schema** for xmllint validation
  - `appcast.xsd` - Main RSS 2.0 structure with Sparkle imports
  - `sparkle-appcast.xsd` - Sparkle namespace elements and attributes
  - Usage: `xmllint --schema appcast.xsd --noout yourfile.xml`

- **Documentation**
  - `APPCAST-FORMAT.md` - Comprehensive Sparkle appcast format specification
  - `CLAUDE-SKILL.md` - Instructions for AI assistants working with appcasts
  - `ROADMAP.md` - Future feature plans

- **Testing infrastructure**
  - XSD schema validation tests (23 tests via xmllint)
  - Public appcast URL collection (`test/fixtures/remote/appcast-urls.txt`)
  - 192 total tests

- **Website improvements**
  - Prefills with iTerm2's appcast URL as a working demo

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

- I005 now only reports non-macOS targets (sparkle:os="macos" is the default and no longer flagged)

### Fixed

- Corrected handling of `sparkle:os` attribute (was incorrectly looking for `sparkle:osType`)

### Security

- **SSRF protection in fetch proxy** — The web app's URL fetching proxy now:
  - Resolves hostnames via Cloudflare DNS-over-HTTPS before fetching
  - Blocks requests to private/internal IP ranges (RFC 1918, loopback, link-local,
    carrier-grade NAT, cloud metadata 169.254.x.x, multicast, reserved)
  - Prevents SSRF attacks targeting internal services

## [1.0.0] - 2026-01-27

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

[1.2.0]: https://github.com/dweekly/sparkle-validator/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/dweekly/sparkle-validator/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dweekly/sparkle-validator/releases/tag/v1.0.0
