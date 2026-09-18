# Homebrew Tap for Sparkle Validator

Install the published release with:

```bash
brew tap dweekly/sparkle-validator
brew trust --formula dweekly/sparkle-validator/sparkle-validator
brew install dweekly/sparkle-validator/sparkle-validator
```

The live formula is maintained in
[dweekly/homebrew-sparkle-validator](https://github.com/dweekly/homebrew-sparkle-validator).
The release workflow publishes the npm package, downloads its tarball to compute
SHA256, updates that tap, and verifies installation on macOS.

The formula in this directory is a reference copy of the last published release.
Keep its version and checksum together; do not point it at an unpublished tarball.
After publishing, refresh this copy from the verified live formula.

See [RELEASING.md](../RELEASING.md) for the normal release process and manual
recovery steps if tap automation fails.
