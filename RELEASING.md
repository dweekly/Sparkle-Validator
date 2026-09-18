# Release Process

Releases are **published from GitHub Actions, not from your local machine.**
Pushing a `vX.Y.Z` tag fires `.github/workflows/release.yml`, which is the
sole source of truth for publishes. You never run `npm publish` locally in
the normal path; the workflow is what owns the npm package, the GitHub
Release, and the Homebrew tap update.

What you do locally is bump the version, update the changelog, and push
the tag. The workflow does the rest.

## Pre-Release Checklist

- [ ] Node.js baseline verified: `>=22` (`node -v`)
- [ ] All unit and integration tests pass: `npm test`
- [ ] XSD schema validation passes: `npm run test:xsd`
- [ ] Linting and type-checking pass: `npm run lint`
- [ ] Code formatting check passes: `npm run format:check`
- [ ] Build succeeds: `npm run build`
- [ ] Full and production dependency audits pass: `npm audit` and `npm audit --omit=dev`
- [ ] Packaging dry-run succeeds: `npm pack --dry-run`
- [ ] CHANGELOG.md updated with new version section
- [ ] Website copy and options verified in the built `public/` site
- [ ] Package version, lockfile version, Action npm pin, and intended tag agree

## Version Bump

1. **Update package.json version:**
   ```bash
   npm version minor --no-git-tag-version  # or patch/major
   ```

2. **Update scripts/run-action.mjs** to reference the new npm package version:
   The composite Action delegates execution to `scripts/run-action.mjs`, which pins the default npm package release:
   ```javascript
   // scripts/run-action.mjs line 84:
   const rawCmd = process.env.SPARKLE_VALIDATOR_CMD || "npx sparkle-validator@X.Y.Z";
   ```

3. **Update CHANGELOG.md** with release date and changes

4. **Commit the version bump:**
   ```bash
   git add package.json package-lock.json scripts/run-action.mjs CHANGELOG.md
   git commit -m "vX.Y.Z"
   ```

## Create and Push Tag

```bash
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

The tag push fires two workflows:

- **`ci.yml`** — runs tests on Node 22/24, uploads coverage to
  Codecov. On pushes to main, it also builds the web app artifact.
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

The Homebrew update waits up to ten minutes for npm tarball availability. If
npm is still processing the package after that, verify the tarball is available
and re-run the failed jobs; do not republish or move the version tag.

Homebrew verification trusts only `dweekly/sparkle-validator/sparkle-validator`.
To verify an already published release independently (including after fixing
the verification workflow), run:

```bash
gh workflow run verify-homebrew.yml --ref main -f version=vX.Y.Z
```

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

> **Note:** In standard releases, step 2 (`github-release`) in `.github/workflows/release.yml` automatically downloads the newly published npm tarball, calculates the SHA256 checksum, updates `Formula/sparkle-validator.rb` in `dweekly/homebrew-sparkle-validator`, and verifies the tap install. This manual procedure is only necessary if CI tap automation failed.

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
# - Ensure `depends_on "node" => ">=22"` is present

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
