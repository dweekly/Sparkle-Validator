# Sparkle Appcast Format Specification

> This document describes the appcast.xml format used by the [Sparkle](https://sparkle-project.org/) software update framework for macOS. It is derived from [official Sparkle documentation](https://sparkle-project.org/documentation/publishing/) and the [Sparkle 2.x source code](https://github.com/sparkle-project/Sparkle/tree/2.x).

## Overview

An appcast is an RSS 2.0 feed with Sparkle-specific XML namespace extensions. Sparkle clients fetch this feed to check for available updates.

## Basic Structure

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>My App Updates</title>
    <link>https://example.com/</link>
    <description>Updates for My App</description>
    <language>en</language>

    <item>
      <!-- Update item -->
    </item>
  </channel>
</rss>
```

### Namespace

The Sparkle namespace **must** be declared on the `<rss>` element:

```
xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"
```

---

## Channel Elements

| Element | Required | Description |
|---------|----------|-------------|
| `<title>` | Recommended | Feed title (app name) |
| `<link>` | Recommended | App homepage URL |
| `<description>` | Optional | Feed description |
| `<language>` | Optional | Feed language (e.g., "en") |

---

## Item Elements

Each `<item>` represents an available update.

### Required Elements

| Element | Description | Example |
|---------|-------------|---------|
| `<sparkle:version>` | Build number (machine-comparable) | `<sparkle:version>245</sparkle:version>` |
| `<enclosure>` | Download metadata (see below) | — |

> **Note:** Either `<enclosure>` with a `url` attribute OR `<link>` is required. Items with only `<link>` are treated as informational updates.

### Recommended Elements

| Element | Description | Example |
|---------|-------------|---------|
| `<title>` | Human-readable release title | `<title>Version 2.0</title>` |
| `<pubDate>` | Publication date ([RFC 2822](https://tools.ietf.org/html/rfc2822#section-3.3)) | `<pubDate>Mon, 28 Jan 2026 12:00:00 -0800</pubDate>` |
| `<sparkle:shortVersionString>` | Marketing version | `<sparkle:shortVersionString>2.0.1</sparkle:shortVersionString>` |
| `<sparkle:minimumSystemVersion>` | Minimum macOS version | `<sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>` |

### Release Notes

| Element | Description |
|---------|-------------|
| `<description>` | Inline HTML release notes (use CDATA) |
| `<sparkle:releaseNotesLink>` | URL to external HTML release notes |
| `<sparkle:fullReleaseNotesLink>` | URL to full version history page |

Release notes support localization via `xml:lang`:

```xml
<sparkle:releaseNotesLink xml:lang="en">https://example.com/notes/2.0-en.html</sparkle:releaseNotesLink>
<sparkle:releaseNotesLink xml:lang="de">https://example.com/notes/2.0-de.html</sparkle:releaseNotesLink>
```

The `<description>` element supports format hints (Sparkle 2.4+):

```xml
<description sparkle:format="markdown">## What's New
- Feature 1
- Bug fix 2</description>
```

Valid formats: `html` (default), `plain-text`, `markdown`

### System Requirements

| Element | Description | Added |
|---------|-------------|-------|
| `<sparkle:minimumSystemVersion>` | Minimum macOS version (e.g., "12.0") | 1.x |
| `<sparkle:maximumSystemVersion>` | Maximum macOS version | 2.0 |
| `<sparkle:hardwareRequirements>` | Hardware constraint (e.g., "arm64") | 2.9 |
| `<sparkle:minimumUpdateVersion>` | Minimum current app version to update from | 2.9 |

**Hardware requirements** restrict updates to specific architectures:

```xml
<sparkle:hardwareRequirements>arm64</sparkle:hardwareRequirements>
```

### Update Classification

| Element | Description |
|---------|-------------|
| `<sparkle:criticalUpdate>` | Marks update as critical (cannot be skipped) |
| `<sparkle:informationalUpdate>` | Shows download link instead of auto-installing |
| `<sparkle:minimumAutoupdateVersion>` | Requires manual approval if current version is below this |
| `<sparkle:ignoreSkippedUpgradesBelowVersion>` | Re-notifies users who skipped versions below this |

**Critical updates** can include version constraints:

```xml
<sparkle:criticalUpdate sparkle:version="150"></sparkle:criticalUpdate>
```

This marks the update critical only for users on version 150 or below.

**Informational updates** can specify version bounds:

```xml
<sparkle:informationalUpdate>
  <sparkle:version>100</sparkle:version>
  <sparkle:belowVersion>150</sparkle:belowVersion>
</sparkle:informationalUpdate>
```

### Distribution Control

| Element | Description |
|---------|-------------|
| `<sparkle:channel>` | Distribution channel (e.g., "beta") |
| `<sparkle:phasedRolloutInterval>` | Seconds between rollout phases |

**Channels** allow separate update tracks:

```xml
<sparkle:channel>beta</sparkle:channel>
```

Channel names must contain only alphanumeric characters, hyphens, underscores, and periods.

**Phased rollouts** distribute updates gradually across 7 groups:

```xml
<sparkle:phasedRolloutInterval>86400</sparkle:phasedRolloutInterval>
```

With 86400 seconds (1 day), full rollout completes in 7 days. Requires `<pubDate>`. Does not affect critical updates or manual update checks.

### Tags

```xml
<sparkle:tags>
  <sparkle:criticalUpdate/>
</sparkle:tags>
```

---

## Enclosure Element

The `<enclosure>` element specifies the downloadable update archive.

### Required Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `url` | Download URL (HTTPS recommended) | `https://example.com/MyApp-2.0.zip` |

### Recommended Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `sparkle:edSignature` | EdDSA signature (88-char Base64) | `eHh4eHh4eHh4...eA==` |
| `length` | File size in bytes | `12345678` |
| `type` | MIME type | `application/octet-stream` |

### Optional Attributes

| Attribute | Description | Added |
|-----------|-------------|-------|
| `sparkle:version` | Build number (prefer `<sparkle:version>` element) | 1.x |
| `sparkle:shortVersionString` | Marketing version (prefer element) | 1.x |
| `sparkle:dsaSignature` | DSA signature (deprecated, use EdDSA) | 1.x |
| `sparkle:os` | Target OS (deprecated; prefer separate feeds) | 1.x |
| `sparkle:installationType` | "application" or "package" | 2.0 |

**OS Type** (deprecated) enables multi-platform appcasts:

```xml
<enclosure sparkle:os="macos" ... />
<enclosure sparkle:os="windows" ... />
```

If omitted, defaults to macOS. Non-macOS items are ignored by Sparkle.

> **Note:** Using `sparkle:os` is deprecated. Sparkle recommends maintaining separate appcast feeds per platform instead of combining platforms in a single feed.

**Installation Type** specifies the archive contents:

- `application` (default): Contains a `.app` bundle
- `package`: Contains a `.pkg` installer

```xml
<enclosure sparkle:installationType="package" ... />
```

### Supported Archive Formats

- `.zip` — Most common
- `.dmg` — Disk image
- `.tar.gz`, `.tar.bz2`, `.tar.xz` — Compressed tarballs
- `.aar` — Apple Archive (Sparkle 2.7+)

---

## Delta Updates

Delta updates provide incremental patches from specific versions.

```xml
<sparkle:deltas>
  <enclosure
    url="https://example.com/MyApp-1.9-to-2.0.delta"
    sparkle:deltaFrom="189"
    sparkle:edSignature="XYZ789..."
    length="1234567"
    type="application/octet-stream"
  />
  <enclosure
    sparkle:deltaFrom="195"
    ...
  />
</sparkle:deltas>
```

### Delta Enclosure Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | Delta file URL |
| `sparkle:deltaFrom` | Yes | Source version build number |
| `sparkle:edSignature` | Yes | EdDSA signature |
| `length` | Yes | File size in bytes |
| `type` | Yes | MIME type |
| `sparkle:deltaFromSparkleExecutableSize` | No | Expected Sparkle binary size (validation) |
| `sparkle:deltaFromSparkleLocales` | No | Expected locales (comma-separated) |

If delta application fails, Sparkle falls back to the full download.

---

## Signatures

Signatures are **recommended** but not strictly required. If your app is configured
to require signatures (the default for apps distributed outside the Mac App Store),
Sparkle will reject unsigned or malformed updates. EdDSA (Ed25519) is strongly recommended.

### EdDSA (Recommended)

Ed25519 signatures are exactly 64 bytes, encoded as 88 base64 characters (with padding).

```xml
<enclosure sparkle:edSignature="BASE64_ED25519_SIGNATURE_HERE==" ... />
```

Generate with:
```bash
./bin/sign_update MyApp-2.0.zip
```

### DSA (Deprecated)

```xml
<enclosure sparkle:dsaSignature="BASE64_SIGNATURE_HERE" ... />
```

DSA is deprecated. Migrate to EdDSA.

### Signed Release Notes

If `SURequireSignedFeed` is enabled:

```xml
<sparkle:releaseNotesLink
  sparkle:edSignature="..."
  sparkle:length="12345">
  https://example.com/notes/2.0.html
</sparkle:releaseNotesLink>
```

> **Important:** Note that `sparkle:length` on release notes elements must be namespace-qualified with `sparkle:`. Unqualified `length` is only standard RSS on `<enclosure>`.

### Signature Validation vs Cryptographic Authentication

Sparkle Validator performs **structural and format validation** of signatures:
- Base64 format verification with canonical padding check.
- Verification that decoded Ed25519 signatures are exactly 64 bytes (88 base64 characters).
- Verification that legacy DSA signatures are non-empty base64 strings.
- Validation that signed-feed mode (`requireSignedFeed`) requires all updates and release notes to include signatures and lengths.

Sparkle Validator **does not** perform cryptographic verification of signatures against archive binaries or developer public keys (which requires downloading the entire archive payload and possessing the private/public Ed25519 key pair).

---

## Sparkle 2.10 Migration & Compatibility

Sparkle 2.10 introduced several important changes to requirements and best practices:

### 1. Minimum System Version (macOS 12.0+)
Items bundling Sparkle 2.10 or newer must specify a `sparkle:minimumSystemVersion` of at least `12.0` (macOS Monterey), because the Sparkle 2.10 framework itself drops support for macOS 11 and earlier.
When validating feeds with historical releases, specify target versions (e.g. `--target-sparkle-version 200=2.10.0`) so older releases targeting earlier macOS versions (e.g. macOS 10.13+) are preserved without false positives.

### 2. Signed Release Notes Metadata
When running in signed feed mode (`SURequireSignedFeed`), Sparkle 2.10 enforces that all release notes links (`sparkle:releaseNotesLink` and `sparkle:fullReleaseNotesLink`) across all locales have:
- A valid `sparkle:edSignature` attribute
- A valid, positive `sparkle:length` attribute (qualified with the `sparkle:` namespace)

### 3. Qualified Length Attribute
On `<sparkle:releaseNotesLink>` and `<sparkle:fullReleaseNotesLink>`, the byte length attribute must be qualified as `sparkle:length="..."`. Unqualified `length="..."` is reserved for RSS standard `<enclosure>` elements.

---

## Complete Example

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>My App Updates</title>
    <link>https://example.com/</link>
    <description>Updates for My App</description>
    <language>en</language>

    <item>
      <title>Version 2.0</title>
      <pubDate>Mon, 28 Jan 2026 12:00:00 -0800</pubDate>
      <sparkle:version>200</sparkle:version>
      <sparkle:shortVersionString>2.0</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
      <sparkle:releaseNotesLink>https://example.com/notes/2.0.html</sparkle:releaseNotesLink>

      <enclosure
        url="https://example.com/downloads/MyApp-2.0.zip"
        sparkle:edSignature="ABC123..."
        length="12345678"
        type="application/octet-stream"
      />

      <sparkle:deltas>
        <enclosure
          url="https://example.com/downloads/MyApp-1.9-to-2.0.delta"
          sparkle:deltaFrom="190"
          sparkle:edSignature="XYZ789..."
          length="1234567"
          type="application/octet-stream"
        />
      </sparkle:deltas>
    </item>

    <item>
      <title>Version 1.9</title>
      <pubDate>Sun, 15 Dec 2025 10:00:00 -0800</pubDate>
      <sparkle:version>190</sparkle:version>
      <sparkle:shortVersionString>1.9</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
      <description><![CDATA[
        <h2>What's New</h2>
        <ul>
          <li>Bug fixes</li>
          <li>Performance improvements</li>
        </ul>
      ]]></description>

      <enclosure
        url="https://example.com/downloads/MyApp-1.9.zip"
        sparkle:edSignature="DEF456..."
        length="11234567"
        type="application/octet-stream"
      />
    </item>
  </channel>
</rss>
```

---

## Version History

| Sparkle Version | Notable Appcast Changes |
|-----------------|------------------------|
| 2.10 | Framework requirement raised to macOS 12.0; signed release notes metadata enforcement; Apple Archive improvements |
| 2.9 | `sparkle:hardwareRequirements`, `sparkle:minimumUpdateVersion` |
| 2.7 | Apple Archive (`.aar`) support |
| 2.4 | `sparkle:format` attribute for description |
| 2.3 | Delta validation attributes |
| 2.1 | `sparkle:belowVersion` for informational updates |
| 2.0 | `sparkle:installationType`, `sparkle:fullReleaseNotesLink`, top-level version elements recommended |
| 1.x | Initial format with DSA signatures |

---

## References

- [Sparkle Documentation: Publishing an Appcast](https://sparkle-project.org/documentation/publishing/)
- [Sparkle Documentation: Delta Updates](https://sparkle-project.org/documentation/delta-updates/)
- [Sparkle GitHub Repository](https://github.com/sparkle-project/Sparkle)
- [RSS 2.0 Specification](https://www.rssboard.org/rss-specification)
- [RFC 2822: Date and Time Specification](https://tools.ietf.org/html/rfc2822#section-3.3)
