# CLAUDE.md - Project Guidelines

## Build & Test Commands
- `npm test` - Run all tests (192 tests)
- `npm run lint` - ESLint + TypeScript type checking
- `npm run build` - Build CLI, library, and web app
- `npm run test:xsd` - Test XSD schema against fixtures

## Project Structure
- `src/core/` - Validator library (parser, rules, types)
- `src/cli/` - Command-line interface
- `src/web/` - Web app bundle
- `functions/api/` - Cloudflare Pages Functions (fetch proxy)
- `test/` - Vitest tests
- `appcast.xsd`, `sparkle-appcast.xsd` - XSD schemas for xmllint

## Code Style
- TypeScript with strict mode
- ESM modules (`"type": "module"`)
- Prettier for formatting
- No semicolons in code style

## Shell Command Guidelines
- **Never pipe curl to shasum** - Always download files to disk first, then verify checksums
  ```bash
  # Wrong:
  curl -sL https://example.com/file.tgz | shasum -a 256

  # Correct:
  curl -sL -o /tmp/file.tgz https://example.com/file.tgz
  shasum -a 256 /tmp/file.tgz
  ```
- Use `execFileSync` instead of `execSync` in Node.js to avoid shell injection

## Release Process
1. Update CHANGELOG.md
2. `npm test && npm run lint && npm run build`
3. `npm publish --otp=CODE`
4. `git tag vX.Y.Z && git push --tags`
5. Update Homebrew tap (dweekly/homebrew-sparkle-validator)
6. Create GitHub Release

## Validation Rules
- Errors: E001-E031 (fatal issues)
- Warnings: W001-W042 (non-fatal issues)
- Info: I001-I010 (informational)
- Diagnostic consolidation groups repeated issues
