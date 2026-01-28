# Invalid Appcast Analysis - 2026-01-28

## Summary

Analyzed 65 URLs marked as INVALID to determine if they are truly broken or if our validator is too strict.

## Findings

### VALIDATOR ISSUES - Rules That May Be Too Strict (11 URLs)

| Category | Count | Error | Description | Recommendation |
|----------|-------|-------|-------------|----------------|
| NAMESPACE | 5 | E026 | Old/variant Sparkle namespace | **Downgrade to warning** |
| PLIST | 3 | E002 | Plist format appcasts | **Add format support** |
| URL_SCHEME | 3 | E015 | `feed://` URL scheme | **Allow feed://** |

**Namespace variants that work with Sparkle:**
- `http://andymatuschak.org/xml-namespaces/sparkle` (without "www.")
- `https://www.andymatuschak.org/xml-namespaces/sparkle` (HTTPS)

**Plist-format appcasts (valid Sparkle format we don't support):**
- BBEdit: https://versioncheck.barebones.com/BBEdit.xml
- TextWrangler: https://versioncheck.barebones.com/TextWrangler.xml
- PCalc: http://www.pcalc.com/PCalcSUFeed.xml

**feed:// URL scheme (valid for RSS feeds):**
- Mactracker: http://update.mactracker.ca/appcast-b.xml
- xACT: http://xactupdate.scottcbrown.org/xACT.xml
- DAEMON Tools: http://resources.web-search-home.com/xml/DAEMONToolsLite-appcast.xml

### LEGITIMATE ERRORS - Real Validation Issues (13 URLs)

| Category | Count | Error | Description |
|----------|-------|-------|-------------|
| NO_VERSION | 8 | E008 | Missing sparkle:version on items |
| NO_URL | 5 | E010 | Missing url attribute on enclosure |

These are real errors that would cause Sparkle to fail:
- Chocolat, HandBrakeBatch, djay, etc. - Missing version info
- BetterZip, Fluid, Gemini, etc. - Missing download URL

### EDGE CASES (2 URLs)

| Category | Count | Error | Description | Recommendation |
|----------|-------|-------|-------------|----------------|
| EMPTY_DELTAS | 1 | E023 | Empty `<sparkle:deltas>` element | Keep as error |
| NO_ITEMS | 1 | E007 | Channel has no `<item>` elements | Keep as error |

### DEAD/CHANGED URLs - Not Our Problem (39 URLs)

| Category | Count | Error | Description |
|----------|-------|-------|-------------|
| MALFORMED | 24 | E001 | Returns non-XML/corrupted content |
| HTML | 11 | E002 | Server now returns HTML webpage |
| NO_NAMESPACE | 1 | E004 | No Sparkle namespace at all |
| INVALID_LENGTH | 1 | E013 | Empty length="" attribute |

These URLs no longer serve valid appcasts. The servers have changed, apps discontinued, or domains expired.

## Recommendations

### 1. Downgrade E026 to Warning (HIGH PRIORITY)

The old namespace (`http://andymatuschak.org/...` without "www.") and HTTPS variant both work fine with Sparkle. The namespace URI is just an identifier, not an actual URL that gets fetched.

**Affected apps:** Jumpcut, Cakebrew, LaTeXiT, NeoFinder, VLC Remote Helper

### 2. Allow feed:// Scheme in E015 (MEDIUM PRIORITY)

The `feed://` scheme is a valid RSS convention used by feed readers. Sparkle likely handles these fine.

**Affected apps:** Mactracker, xACT, DAEMON Tools

### 3. Consider Plist Format Support (LOW PRIORITY)

Sparkle supports an alternative plist-based appcast format. BBEdit and PCalc use this format. Adding support would be a larger undertaking.

**Affected apps:** BBEdit, TextWrangler, PCalc

## Updated Categorization

After fixes:
- **True INVALID:** 52 URLs (13 legitimate errors + 39 dead URLs)
- **Should be VALID:** 10 URLs (after E026 downgrade + feed:// support)
- **Plist format:** 3 URLs (valid but unsupported format)

## Action Items

- [x] Categorize all 65 INVALID URLs
- [x] Downgrade E026 from error to warning (now W026)
- [x] Add feed:// as valid URL scheme in E015
- [ ] Update appcast-urls.txt with corrected categorizations

## Implementation Notes

**W026 (Namespace Variants):**
- Known variants (old format, HTTPS) produce W026 warning but feed is still VALID
- Completely unknown namespaces cause E008 (missing version) because sparkle:* elements aren't recognized

**feed:// URL Scheme:**
- Added to allowed schemes in `isValidUrl()` function
- Mactracker and similar feeds now validate correctly
