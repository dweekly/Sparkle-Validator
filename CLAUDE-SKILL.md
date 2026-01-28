# Claude Skill: Sparkle Appcast Creation & Debugging

Use this skill when helping users create, edit, or debug Sparkle appcast.xml files for macOS application updates.

## Quick Reference

### Minimal Valid Appcast

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>App Name Updates</title>
    <link>https://example.com/</link>
    <item>
      <title>Version 1.0</title>
      <pubDate>Mon, 28 Jan 2026 12:00:00 -0800</pubDate>
      <sparkle:version>100</sparkle:version>
      <sparkle:shortVersionString>1.0</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
      <description><![CDATA[<ul><li>Initial release</li></ul>]]></description>
      <enclosure
        url="https://example.com/downloads/App-1.0.zip"
        sparkle:edSignature="BASE64_SIGNATURE_HERE"
        length="12345678"
        type="application/octet-stream"
      />
    </item>
  </channel>
</rss>
```

### Required Elements

| Element | Location | Description |
|---------|----------|-------------|
| `xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"` | `<rss>` attribute | **Must be exact** |
| `version="2.0"` | `<rss>` attribute | RSS version |
| `<channel>` | Inside `<rss>` | Exactly one |
| `<item>` | Inside `<channel>` | At least one |
| `<sparkle:version>` | Inside `<item>` | Build number |
| `<enclosure>` | Inside `<item>` | With `url`, `length`, `type`, `sparkle:edSignature` |

### Common Mistakes to Avoid

1. **Wrong namespace URI** - Must be exactly `http://www.andymatuschak.org/xml-namespaces/sparkle`
2. **Missing signature** - `sparkle:edSignature` is required on `<enclosure>`
3. **Invalid pubDate format** - Must be RFC 2822: `Day, DD Mon YYYY HH:MM:SS +/-ZZZZ`
4. **Version on enclosure only** - Prefer `<sparkle:version>` as child of `<item>`, not just enclosure attribute
5. **Missing minimumSystemVersion** - Recommended for all items

### pubDate Format

```
Day, DD Mon YYYY HH:MM:SS +/-ZZZZ
```

Examples:
- `Mon, 28 Jan 2026 12:00:00 -0800`
- `Thu, 15 Aug 2025 09:30:00 +0000`

Day names: Mon, Tue, Wed, Thu, Fri, Sat, Sun
Month names: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec

### Signature Generation

Users generate signatures with Sparkle's `sign_update` tool:

```bash
./bin/sign_update path/to/App-1.0.zip
```

This outputs a base64 EdDSA signature for the `sparkle:edSignature` attribute.

---

## Feature-Specific Guidance

### Release Notes

**Option 1: Inline HTML**
```xml
<description><![CDATA[
<h2>What's New</h2>
<ul>
  <li>New feature</li>
  <li>Bug fix</li>
</ul>
]]></description>
```

**Option 2: External Link**
```xml
<sparkle:releaseNotesLink>https://example.com/notes/1.0.html</sparkle:releaseNotesLink>
```

**Option 3: Markdown (Sparkle 2.4+)**
```xml
<description sparkle:format="markdown">
## What's New
- New feature
- Bug fix
</description>
```

### Delta Updates

```xml
<sparkle:deltas>
  <enclosure
    url="https://example.com/App-0.9-to-1.0.delta"
    sparkle:deltaFrom="90"
    sparkle:edSignature="DELTA_SIGNATURE"
    length="1234567"
    type="application/octet-stream"
  />
</sparkle:deltas>
```

- `sparkle:deltaFrom` = build number of the version this patch upgrades FROM
- Generate deltas with Sparkle's `generate_delta` tool
- Sparkle falls back to full download if delta fails

### Phased Rollouts

```xml
<sparkle:phasedRolloutInterval>86400</sparkle:phasedRolloutInterval>
```

- Value is in **seconds** between rollout phases
- Fixed at 7 groups
- 86400 = 1 day per group = 7 days total rollout
- Requires `<pubDate>` to be present
- Does NOT affect critical updates or manual update checks

### Critical Updates

```xml
<sparkle:criticalUpdate/>
```

Or with version targeting:
```xml
<sparkle:criticalUpdate sparkle:version="50"/>
```

Critical updates:
- Cannot be skipped by users
- Bypass phased rollouts
- Use sparingly (security fixes only)

### Channels (Beta/Stable)

```xml
<sparkle:channel>beta</sparkle:channel>
```

- Channel names: alphanumeric, hyphens, underscores, periods only
- Items without channel = "default" channel
- Users opt into channels via app settings

### Package Installers (.pkg)

```xml
<enclosure
  url="https://example.com/App-1.0.pkg"
  sparkle:installationType="package"
  sparkle:edSignature="..."
  length="12345678"
  type="application/octet-stream"
/>
```

### Architecture Requirements (Sparkle 2.9+)

```xml
<sparkle:hardwareRequirements>arm64</sparkle:hardwareRequirements>
```

Use when update only supports Apple Silicon.

### Minimum Update Version (Sparkle 2.9+)

```xml
<sparkle:minimumUpdateVersion>50</sparkle:minimumUpdateVersion>
```

Users on versions below 50 must update to an intermediate version first.

### Informational Updates (No Auto-Install)

```xml
<sparkle:informationalUpdate/>
<link>https://example.com/manual-download</link>
```

Shows notification but doesn't auto-download. Useful for:
- Major version upgrades requiring user action
- Breaking changes needing manual migration

---

## Validation

Recommend users validate their appcast:

**Online:**
https://sparklevalidator.com

**CLI:**
```bash
npx sparkle-validator appcast.xml
npx sparkle-validator https://example.com/appcast.xml
```

**CI/CD:**
```yaml
- name: Validate appcast
  run: npx sparkle-validator --strict appcast.xml
```

---

## Common Error Solutions

### E001: Not well-formed XML
- Check for unclosed tags
- Verify CDATA sections are properly closed
- Check for invalid characters

### E004: Missing Sparkle namespace
Add to `<rss>`:
```xml
xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"
```

### E008: Missing sparkle:version
Add as child of `<item>`:
```xml
<sparkle:version>100</sparkle:version>
```

### W003: Missing pubDate
Add RFC 2822 date:
```xml
<pubDate>Mon, 28 Jan 2026 12:00:00 -0800</pubDate>
```

### W004: Invalid pubDate format
Must be RFC 2822. Common fixes:
- Use 3-letter day/month names
- Include timezone offset
- Use 24-hour time

### W005: Missing signature
Add EdDSA signature to enclosure:
```xml
sparkle:edSignature="BASE64_SIGNATURE"
```

### W007/W008: Redundant version declarations
Remove `sparkle:version` and `sparkle:shortVersionString` attributes from `<enclosure>` - keep only the elements.

---

## Full Example with All Features

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>My App Updates</title>
    <link>https://example.com/</link>
    <description>Updates for My App</description>
    <language>en</language>

    <!-- Latest stable release -->
    <item>
      <title>Version 2.0</title>
      <pubDate>Mon, 28 Jan 2026 12:00:00 -0800</pubDate>
      <sparkle:version>200</sparkle:version>
      <sparkle:shortVersionString>2.0</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
      <sparkle:phasedRolloutInterval>86400</sparkle:phasedRolloutInterval>

      <sparkle:releaseNotesLink xml:lang="en">https://example.com/notes/2.0-en.html</sparkle:releaseNotesLink>
      <sparkle:releaseNotesLink xml:lang="de">https://example.com/notes/2.0-de.html</sparkle:releaseNotesLink>

      <enclosure
        url="https://example.com/downloads/MyApp-2.0.zip"
        sparkle:edSignature="ABC123..."
        length="15000000"
        type="application/octet-stream"
      />

      <sparkle:deltas>
        <enclosure
          url="https://example.com/downloads/MyApp-1.9-to-2.0.delta"
          sparkle:deltaFrom="190"
          sparkle:edSignature="DEF456..."
          length="2000000"
          type="application/octet-stream"
        />
      </sparkle:deltas>
    </item>

    <!-- Beta channel -->
    <item>
      <title>Version 2.1 Beta 1</title>
      <pubDate>Tue, 29 Jan 2026 10:00:00 -0800</pubDate>
      <sparkle:version>210</sparkle:version>
      <sparkle:shortVersionString>2.1b1</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
      <sparkle:channel>beta</sparkle:channel>

      <description><![CDATA[
        <h2>Beta Release</h2>
        <p>Testing new features. Please report issues!</p>
      ]]></description>

      <enclosure
        url="https://example.com/downloads/MyApp-2.1b1.zip"
        sparkle:edSignature="GHI789..."
        length="15500000"
        type="application/octet-stream"
      />
    </item>

    <!-- Previous stable (for rollback) -->
    <item>
      <title>Version 1.9</title>
      <pubDate>Sun, 15 Dec 2025 10:00:00 -0800</pubDate>
      <sparkle:version>190</sparkle:version>
      <sparkle:shortVersionString>1.9</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>

      <description><![CDATA[<ul><li>Bug fixes</li></ul>]]></description>

      <enclosure
        url="https://example.com/downloads/MyApp-1.9.zip"
        sparkle:edSignature="JKL012..."
        length="14000000"
        type="application/octet-stream"
      />
    </item>
  </channel>
</rss>
```

---

## References

- [Sparkle Documentation](https://sparkle-project.org/documentation/)
- [Sparkle GitHub](https://github.com/sparkle-project/Sparkle)
- [Sparkle Validator](https://sparklevalidator.com)
- [RFC 2822 Date Format](https://tools.ietf.org/html/rfc2822#section-3.3)
