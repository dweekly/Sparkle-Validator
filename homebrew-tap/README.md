# Homebrew Tap for Sparkle Validator

This directory contains the Homebrew formula for sparkle-validator.

## Setup

To use this tap, you need to:

1. Create a separate repository named `homebrew-sparkle-validator`
2. Copy the `Formula` directory to that repository
3. Update the `sha256` hash in the formula after publishing to npm

## Installation

Users can then install with:

```bash
brew tap dweekly/sparkle-validator
brew install sparkle-validator
```

## Updating the Formula

When releasing a new version:

1. Publish the new version to npm: `npm publish`
2. Get the SHA256 of the tarball:
   ```bash
   curl -sL https://registry.npmjs.org/sparkle-validator/-/sparkle-validator-VERSION.tgz | shasum -a 256
   ```
3. Update the formula with the new version and SHA256
4. Push to the homebrew-sparkle-validator repository
