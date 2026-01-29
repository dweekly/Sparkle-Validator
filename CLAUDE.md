# CLAUDE.md - Project Guidelines

## Build & Test Commands
- `npm test` - Run all tests (202 tests)
- `npm run test:coverage` - Run tests with coverage report
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
- `action.yml` - GitHub Action definition

## Website Deployment
- **Hosted on:** Cloudflare Pages
- **URL:** https://sparklevalidator.com
- **Deploy command:** `npm run build && npx wrangler pages deploy public --project-name=sparkle-validator`
- `src/web/` contains source HTML/CSS/TS
- `public/` contains production assets (HTML, CSS, built JS, icons, etc.)
- Keep `src/web/index.html` and `public/index.html` in sync (same for style.css)

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
See RELEASING.md for complete release checklist including:
- npm publish, GitHub release, Homebrew update
- GitHub Action v1 tag update
- Website deployment

## Validation Rules
- Errors: E001-E031 (fatal issues)
- Warnings: W001-W043 (non-fatal issues)
- Info: I001-I012 (informational)
- Diagnostic consolidation groups repeated issues

## GitHub Action
- Marketplace: https://github.com/marketplace/actions/sparkle-validator
- Users reference `@v1` (update with `git tag -f v1 vX.Y.Z && git push -f origin v1`)
