# Release Process

Releases are **published from GitHub Actions, not from your local machine.**
Pushing a `vX.Y.Z` tag fires `.github/workflows/release.yml`, which is the
sole source of truth for publishes. You never run `npm publish` locally in
the normal path; the workflow is what owns the npm package, the GitHub
Release, and the Homebrew tap update.

What you do locally is bump the version, update the changelog, and push
the tag. The workflow does the rest.

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

The tag push fires two workflows:

- **`ci.yml`** — runs tests on Node 20/22/24, uploads coverage to
  Codecov, builds the web app artifact.
- **`release.yml`** — runs only on `vX.Y.Z` tags (the `v1` major-version
  pointer is deliberately excluded). This is the workflow that ships
  the release.

### What `release.yml` does

1. **`publish-npm`** — Publishes `sparkle-validator@X.Y.Z` to npm via
   **Trusted Publishing (OIDC)**, with full SLSA v1 provenance. No
   `NPM_TOKEN` secret is used; the package's trusted publisher policy
   on npmjs.com authorizes `dweekly/Sparkle-Validator` running
   `release.yml` to publish.

   > **npm version requirement:** OIDC publish needs npm >= 11.5.1.
   > The workflow runs on Node 24, which ships npm 11.x. Node 20 ships
   > npm 10.x and will fail with a 404 on PUT (see [npm/cli#8730](https://github.com/npm/cli/issues/8730),
   > [#8976](https://github.com/npm/cli/issues/8976)). If you ever bump
   > the workflow's Node version, keep it at 24 or higher.

   Has a `Check if version already published` guard, so re-running the
   workflow on a tag whose version already exists on npm is a no-op
   for the publish step (the rest of the workflow still runs).

2. **`github-release`** — Generates an SBOM (`@cyclonedx/cyclonedx-npm`),
   creates the GitHub Release with auto-generated notes and the SBOM as
   an asset, then updates `dweekly/homebrew-sparkle-validator` to point
   at the new tarball and SHA256.

3. **`verify-homebrew`** — Runs on a fresh macOS runner, taps, installs
   via `brew install sparkle-validator`, and asserts the installed
   version matches the tag. Fails the release if the tap update is
   inconsistent.

After the workflow goes green, only two steps remain locally: the `v1`
pointer bump and the website deploy.

## After the workflow succeeds

### Update GitHub Action `v1` tag

Users reference `@v1` for automatic minor/patch updates. Re-point it
at the just-released commit:

```bash
git tag -f v1 vX.Y.Z
git push -f origin v1
```

The `v1` tag is excluded from `release.yml`'s trigger, so this
push does not re-fire the release workflow.

### Deploy the website

The release workflow does **not** deploy https://sparklevalidator.com.
Do this manually:

```bash
npm run build
npx wrangler pages deploy public --project-name=sparkle-validator
```

> **Note:** `src/web/` is the source of truth for the website's HTML
> and CSS; `npm run build` copies them into `public/` and produces
> the bundled `app.global.js`. Never edit `public/index.html` or
> `public/style.css` directly.

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

## Manual fallback (workflow broken)

This is **not** the normal release path. Use it only when
`release.yml` is broken in a way you can't fix quickly and the
release needs to ship anyway.

### Manual npm publish

```bash
npm publish --access public
# Enter OTP when prompted.
```

A local publish cannot generate SLSA provenance — there's no OIDC
token outside CI — so the version on npm will be missing the
attestation until the next CI-driven release. Consumers verifying
provenance with `npm audit signatures` or similar tooling will see
that one version's attestation gap.

### Manual Homebrew tap update

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

### Manual GitHub Release

```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes sbom.json
```

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
