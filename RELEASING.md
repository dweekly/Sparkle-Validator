# Release Process

This document outlines the steps to release a new version of Sparkle Validator.

## Pre-Release Checklist

- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] CHANGELOG.md updated with new version section

## Version Bump

1. **Update package.json version:**
   ```bash
   npm version patch  # or minor/major
   ```

2. **Update action.yml** to reference the new npm package version:
   ```yaml
   CMD="npx sparkle-validator@X.Y.Z"
   ```

3. **Update CHANGELOG.md** with release date and changes

4. **Commit the version bump:**
   ```bash
   git add package.json package-lock.json action.yml CHANGELOG.md
   git commit -m "vX.Y.Z"
   ```

## Create and Push Tag

```bash
git tag vX.Y.Z
git push origin main --tags
```

This triggers CI which will:
- Run tests on Node 20, 22, 24
- Upload coverage to Codecov
- Build the web app artifact

A semver tag (`vX.Y.Z`) also fires `release.yml`, which publishes
to npm, creates the GitHub Release, updates the Homebrew tap, and
verifies `brew install` end-to-end. The `v1` major-version pointer
is excluded from this trigger.

## Publish to npm

The release workflow publishes via Trusted Publishing (OIDC). The
package's trusted publisher policy on npmjs.com authorizes
`dweekly/Sparkle-Validator` workflow `release.yml` to publish with
provenance — no NPM_TOKEN secret is required.

> **npm version requirement:** OIDC publish needs npm >= 11.5.1.
> The release workflow runs on Node 24, which ships npm 11.x. Node
> 20 ships npm 10.x and will fail with a 404 on PUT during publish
> (see npm/cli#8730, #8976). If you ever bump the workflow's Node
> version, keep it at 24 or higher.

If the workflow's publish step fails for some other reason and you
need to publish manually:

```bash
npm publish --access public
# Enter OTP when prompted. Local publishes can't generate provenance
# attestations (no OIDC token outside CI), so the version on npm
# will be missing the SLSA attestation until the next release.
```

Verify publication: https://www.npmjs.com/package/sparkle-validator

## Create GitHub Release

1. **Generate SBOM:**
   ```bash
   npx @cyclonedx/cyclonedx-npm --output-file sbom.json
   ```

2. **Create release via CLI:**
   ```bash
   gh release create vX.Y.Z \
     --title "vX.Y.Z" \
     --generate-notes \
     sbom.json
   ```

3. **Edit release notes** to be user-friendly (see v1.2.0 as example)

4. **Verify:** https://github.com/dweekly/Sparkle-Validator/releases

## Update Homebrew Formula

The `Release` workflow updates `dweekly/homebrew-sparkle-validator`
automatically when a `vX.Y.Z` tag is pushed, then runs a `verify-homebrew`
job that taps, installs, and asserts the installed version matches the tag.
No manual steps are required in the normal path.

If the workflow's tap-update step fails (e.g. `HOMEBREW_TAP_TOKEN` revoked,
npm tarball not yet propagated), update the tap by hand:

```bash
VERSION="X.Y.Z"
curl -fsSL -o /tmp/sparkle-validator.tgz \
  "https://registry.npmjs.org/sparkle-validator/-/sparkle-validator-${VERSION}.tgz"
SHA256=$(shasum -a 256 /tmp/sparkle-validator.tgz | cut -d' ' -f1)

git clone https://github.com/dweekly/homebrew-sparkle-validator.git
cd homebrew-sparkle-validator

# Edit Formula/sparkle-validator.rb:
# - Update url to sparkle-validator-${VERSION}.tgz
# - Update sha256 to ${SHA256}

git add Formula/sparkle-validator.rb
git commit -m "Update sparkle-validator to ${VERSION}"
git push
```

Then verify locally: `brew update && brew upgrade sparkle-validator && sparkle-validator --version`.

## Update GitHub Action v1 Tag

Users reference `@v1` for automatic minor/patch updates:

```bash
git tag -f v1 vX.Y.Z
git push -f origin v1
```

## Deploy Website

```bash
npm run build
npx wrangler pages deploy public --project-name=sparkle-validator
```

> **Note:** `src/web/` and `public/` HTML/CSS should be kept in sync. The build outputs JS to `public/`.

Verify: https://sparklevalidator.com (check version in footer)

## Post-Release Verification

- [ ] npm package accessible: `npx sparkle-validator@X.Y.Z --version`
- [ ] Homebrew installs: `brew upgrade sparkle-validator`
- [ ] GitHub Action works: test in a workflow
- [ ] Web app updated: check version at https://sparklevalidator.com

## Marketplace (Major Releases Only)

For major version bumps, update the GitHub Marketplace listing:
1. Go to https://github.com/marketplace/actions/sparkle-validator
2. Edit the listing if description/categories need updating

## Rollback

If a release has critical issues:

1. **Unpublish from npm** (within 72 hours):
   ```bash
   npm unpublish sparkle-validator@X.Y.Z
   ```

2. **Delete the GitHub release and tag:**
   ```bash
   gh release delete vX.Y.Z --yes
   git push origin :refs/tags/vX.Y.Z
   git tag -d vX.Y.Z
   ```

3. **Revert v1 tag** to previous version:
   ```bash
   git tag -f v1 vPREVIOUS
   git push -f origin v1
   ```
