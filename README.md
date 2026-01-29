<p align="center">
  <img src="https://sparklevalidator.com/icons/android-chrome-192x192.png" alt="Sparkle Validator logo" width="128" height="128">
</p>

<h1 align="center">Sparkle Validator</h1>

<p align="center">
  A comprehensive validator for <a href="https://sparkle-project.org/">Sparkle</a> appcast.xml feeds.<br>
  Available as a CLI tool, JavaScript library, and web application.
</p>

<p align="center">
  <a href="https://github.com/dweekly/Sparkle-Validator/actions/workflows/ci.yml"><img src="https://github.com/dweekly/Sparkle-Validator/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/sparkle-validator"><img src="https://badge.fury.io/js/sparkle-validator.svg" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

> **Note:** This is an independent community project. It is not affiliated with, endorsed by, or sponsored by the official Sparkle project or its maintainers.

## Features

- Validates Sparkle appcast.xml feeds against all known requirements
- Reports errors, warnings, and informational messages with line numbers
- Provides fix suggestions for common issues
- Works as CLI, library, or web app
- Checks:
  - XML structure (RSS 2.0 + Sparkle namespace)
  - Version declarations
  - Enclosure attributes (url, length, type)
  - URL validity
  - Date formats (RFC 2822)
  - Signatures (EdDSA/DSA)
  - System requirements
  - Delta updates
  - Phased rollouts
  - Channel names
  - And more...

## Web App

Try it online at [SparkleValidator.com](https://sparklevalidator.com)

## CLI Installation

```bash
npm install -g sparkle-validator
```

Or run directly without installing:

```bash
npx sparkle-validator https://example.com/appcast.xml
```

Or with Homebrew:

```bash
brew tap dweekly/sparkle-validator
brew install sparkle-validator
```

## CLI Usage

```bash
# Validate a local file
sparkle-validator appcast.xml

# Validate from URL
sparkle-validator https://example.com/appcast.xml

# Validate from stdin
cat appcast.xml | sparkle-validator -

# JSON output
sparkle-validator --format json appcast.xml

# Strict mode (warnings as errors)
sparkle-validator --strict appcast.xml

# Only show errors
sparkle-validator --quiet appcast.xml

# Check that URLs exist and sizes match
sparkle-validator --check-urls appcast.xml

# Check URLs with custom timeout (ms)
sparkle-validator --check-urls --timeout 30000 appcast.xml
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-f, --format <type>` | Output format: `text` (default) or `json` |
| `-s, --strict` | Treat warnings as errors |
| `-c, --check-urls` | Check that URLs exist and sizes match |
| `--timeout <ms>` | Timeout for URL checks (default: 10000ms) |
| `--no-info` | Suppress informational messages |
| `--no-color` | Disable colored output |
| `-q, --quiet` | Only show errors |
| `-v, --version` | Show version number |
| `-h, --help` | Show help |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Valid (no errors) |
| 1 | Invalid (has errors, or warnings with `--strict`) |
| 2 | Input error (file not found, network error, etc.) |

## CI/CD Integration

### GitHub Actions

Add appcast validation to your release workflow:

```yaml
name: Validate Appcast

on:
  push:
    paths:
      - 'appcast.xml'
  pull_request:
    paths:
      - 'appcast.xml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate appcast.xml
        run: npx sparkle-validator appcast.xml

      # Or with strict mode (warnings fail the build)
      - name: Validate appcast.xml (strict)
        run: npx sparkle-validator --strict appcast.xml

      # Or output JSON for further processing
      - name: Validate and capture results
        run: |
          npx sparkle-validator --format json appcast.xml > validation.json
          cat validation.json
```

### Validate Remote Appcast

```yaml
      - name: Validate published appcast
        run: npx sparkle-validator https://example.com/appcast.xml
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/sh
npx sparkle-validator appcast.xml || exit 1
```

## Library Usage

```javascript
import { validate } from 'sparkle-validator';

const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>My App</title>
    <link>https://example.com</link>
    <item>
      <title>Version 2.0</title>
      <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
      <sparkle:version>200</sparkle:version>
      <description><![CDATA[<p>New features!</p>]]></description>
      <enclosure url="https://example.com/app.zip"
                 length="12345678"
                 type="application/octet-stream"
                 sparkle:edSignature="ABC123=" />
    </item>
  </channel>
</rss>`;

const result = validate(xml);

console.log(result.valid);       // true
console.log(result.errorCount);  // 0
console.log(result.diagnostics); // Array of diagnostics
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;           // true if no errors
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

interface Diagnostic {
  id: string;          // e.g. "E008", "W003"
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;       // 1-based
  column?: number;     // 1-based
  path?: string;       // e.g. "rss > channel > item[2] > enclosure"
  fix?: string;        // Suggestion for fixing the issue
}
```

## Validation Rules

### Errors (E001-E030, excluding E026)

| ID | Description |
|----|-------------|
| E001 | Not well-formed XML |
| E002 | Root element is not `<rss>` |
| E003 | Missing `version="2.0"` on `<rss>` |
| E004 | Missing Sparkle namespace declaration |
| E005 | Missing `<channel>` inside `<rss>` |
| E006 | More than one `<channel>` element |
| E007 | No `<item>` elements in `<channel>` |
| E008 | Item missing `sparkle:version` |
| E009 | Item has neither `<enclosure>` with url nor `<link>` |
| E010-E013 | Enclosure missing/invalid attributes |
| E014-E018 | Invalid URLs |
| E019 | Invalid channel name characters |
| E020-E021 | Phased rollout errors |
| E022 | Invalid installationType |
| E023-E025 | Delta update structure errors |
| E027 | URL returns non-2xx status (`--check-urls`) |
| E028 | Content-Length doesn't match declared length (`--check-urls`) |
| E029 | Version string is empty or whitespace-only |
| E030 | Invalid `sparkle:os` value (must be "macos" or "windows") |

### Warnings (W001-W041)

| ID | Description |
|----|-------------|
| W001-W002 | Missing title on channel/item |
| W003-W004 | Missing or invalid pubDate |
| W005-W006 | Missing/deprecated signatures |
| W007-W008 | Redundant version declarations |
| W009 | No release notes |
| W010 | Non-standard MIME type |
| W011-W013 | System version format issues |
| W014 | Missing channel link |
| W015 | Version only on enclosure attribute |
| W016 | Unencoded URL characters |
| W017 | informationalUpdate with enclosure |
| W018 | Items not sorted by date |
| W019 | Enclosure length is 0 |
| W020 | Duplicate version |
| W021 | URL redirects to different location (`--check-urls`) |
| W022 | Content-Length header missing (`--check-urls`) |
| W023 | Local/private URL skipped (`--check-urls`) |
| W024 | URL uses insecure HTTP instead of HTTPS (`--check-urls`) |
| W025 | pubDate is in the future |
| W026 | Non-canonical Sparkle namespace URI (old format or HTTPS variant) |
| W027 | Version string is non-numeric (may cause comparison failures) |
| W028 | Version decreases while pubDate increases |
| W029 | Signature doesn't look like valid base64 |
| W030 | URL file extension doesn't match expected type |
| W031 | Delta `deltaFrom` version not found in feed |
| W032 | Multiple delta enclosures for same `deltaFrom` |
| W033 | `shortVersionString` format unusual (not x.y.z) |
| W034 | `criticalUpdate` version attribute not valid format |
| W035 | Feed mixes HTTP and HTTPS URLs |
| W036 | `hardwareRequirements` contains unknown architecture |
| W037 | `releaseNotesLink` missing `xml:lang` for localization |
| W038 | CDATA section used in version/signature elements |
| W039 | XML declaration missing encoding attribute |
| W040 | Channel has language but items have different lang |
| W041 | Version missing but deducible from filename (Sparkle fallback) |

### Info (I001-I009)

| ID | Description |
|----|-------------|
| I001 | Summary: N items across M channels |
| I002 | Item contains N delta updates |
| I003 | Item uses phased rollout |
| I004 | Item marked as critical update |
| I005 | Item targets non-macOS platform |
| I006 | Item requires specific hardware (Sparkle 2.9+) |
| I007 | Item requires minimum app version to update (Sparkle 2.9+) |
| I008 | Feed contains >50 items (performance consideration) |
| I009 | Summary of OS support range across all items |

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run lint
```

## Supply Chain Security

This package is published with:
- **npm provenance** — cryptographically attests that the package was built from this repository via GitHub Actions
- **SBOM** — Software Bill of Materials (CycloneDX format) attached to each GitHub release

You can verify provenance on npm: `npm audit signatures`

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
