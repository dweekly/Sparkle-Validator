# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Sparkle Validator, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: David@weekly.org
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Resolution target**: Within 30 days for critical issues

## Security Considerations

This tool validates XML input. While we take precautions:

- The XML parser (saxes) is configured in strict mode
- No external entity resolution (XXE protection)
- No network requests during validation (except explicit URL fetch)
- All validation runs client-side in the web app

## Supply Chain Security

- npm packages are published with [provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
- SBOM (Software Bill of Materials) is attached to each GitHub release
- Verify package integrity: `npm audit signatures`

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with permission).
