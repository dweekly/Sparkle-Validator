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
- Run tests on Node 18, 20, 22
- Upload coverage to Codecov
- Build the web app artifact

## Publish to npm

> **Note:** Trusted Publishing via OIDC is configured but may have issues.
> If the automated release fails, publish manually:

```bash
npm publish --provenance false --access public
# Enter OTP when prompted
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

```bash
# Get the SHA256 of the npm tarball
VERSION="X.Y.Z"
curl -sL "https://registry.npmjs.org/sparkle-validator/-/sparkle-validator-${VERSION}.tgz" | shasum -a 256

# Clone and update the tap
git clone https://github.com/dweekly/homebrew-sparkle-validator.git
cd homebrew-sparkle-validator

# Edit Formula/sparkle-validator.rb:
# - Update url to new version
# - Update sha256 to new hash

git add Formula/sparkle-validator.rb
git commit -m "Update sparkle-validator to ${VERSION}"
git push
```

## Update GitHub Action v1 Tag

Users reference `@v1` for automatic minor/patch updates:

```bash
git tag -f v1 vX.Y.Z
git push -f origin v1
```

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
