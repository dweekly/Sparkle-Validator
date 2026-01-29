# Sparkle Validator Roadmap

## Current Version: 1.0.0

### Implemented Features
- XML structure validation (RSS 2.0 + Sparkle namespace)
- 26 error rules, 20 warning rules, 7 info rules
- CLI with text/JSON output, stdin support, URL fetching
- Web application at sparklevalidator.com
- XSD schema for xmllint validation
- Sparkle 2.9+ support (hardwareRequirements, minimumUpdateVersion)

---

## v1.1.0 - Remote Validation (In Progress)

### URL Checking (`--check-urls`)
- [ ] HEAD requests to verify enclosure URLs exist (return 2xx)
- [ ] Verify Content-Length matches declared `length` attribute
- [ ] Report redirects as warnings
- [ ] Handle timeouts gracefully
- [ ] Support for delta update URLs

### New Rules
| ID | Type | Description |
|----|------|-------------|
| E027 | Error | URL returns non-2xx status |
| E028 | Error | Content-Length doesn't match declared length |
| W021 | Warning | URL redirects to different location |
| W022 | Warning | Content-Length header missing (can't verify size) |

---

## v1.2.0 - Signature Verification (Future)

### EdDSA Signature Verification (`--public-key`)
- [ ] Verify `sparkle:edSignature` against downloaded file
- [ ] Accept public key via CLI flag or environment variable
- [ ] Support reading public key from app bundle's Info.plist
- [ ] Clear error messages for signature mismatches

### DSA Signature Verification (Legacy)
- [ ] Verify `sparkle:dsaSignature` for older appcasts
- [ ] Warn that DSA is deprecated

### New Rules
| ID | Type | Description |
|----|------|-------------|
| E029 | Error | EdDSA signature verification failed |
| E030 | Error | DSA signature verification failed |
| I008 | Info | Signature verified successfully |

---

## v1.3.0 - Enhanced Analysis (Future)

### Version Analysis
- [ ] Detect version ordering issues (semantic vs build number)
- [ ] Warn about large version gaps
- [ ] Detect duplicate versions across channels

### Release Cadence Analysis
- [ ] Analyze release frequency
- [ ] Detect stale appcasts (no updates in X months)
- [ ] Timeline visualization in web app

### Delta Update Analysis
- [ ] Verify delta update chains are complete
- [ ] Calculate bandwidth savings from deltas
- [ ] Suggest missing delta updates

---

## v2.0.0 - Appcast Generation (Future)

### Generate Appcast
- [ ] Create appcast from directory of signed archives
- [ ] Auto-detect version from app bundle
- [ ] Generate delta updates
- [ ] Template support for release notes

### GitHub Integration
- [ ] Generate appcast from GitHub releases
- [ ] GitHub Action for CI/CD validation
- [ ] Auto-update appcast on new release

---

## Ideas / Under Consideration

- **VS Code Extension** - Real-time validation in editor
- **Homebrew Cask Integration** - Validate Cask appcast URLs
- **Appcast Diff** - Compare two appcast versions
- **Migration Assistant** - Help migrate from DSA to EdDSA signatures
- **Localization Validation** - Verify localized release notes links
- **Accessibility** - Screen reader improvements for web app

---

## Contributing

Have an idea? Open an issue at https://github.com/dweekly/sparkle-validator/issues
