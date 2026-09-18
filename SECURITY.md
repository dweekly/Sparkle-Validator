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

This tool validates XML input and optionally fetches remote feeds and assets. Our defense-in-depth security model includes:

### XML Parsing & Processing
- The XML parser (saxes) is configured in strict mode with XML namespace processing enabled.
- External entity resolution is disabled (complete XXE protection).
- Validation engine runs purely in-memory with zero disk or runtime shell side effects.

### Egress & SSRF Protection (Web Proxy)
The Cloudflare Pages fetch proxy (`functions/api/fetch.ts`) enforces strict egress protection:
- **IPv4 Protection:** Blocks private, loopback, broadcast, and link-local ranges (RFC 1918, RFC 3927, RFC 5735, RFC 6598) across standard dotted-decimal, hex, octal, and single-integer formats.
- **IPv6 Protection:** Blocks IPv6 loopback (`::1`), link-local (`fe80::/10`), unique local (`fc00::/7`), and IPv4-mapped IPv6 (`::ffff:0:0/96`).
- **Cloud Metadata Protection:** Explicitly denies access to internal cloud metadata endpoints (e.g. `169.254.169.254`, `metadata.google.internal`).
- **Redirect Policy:** Enforces egress policy on every redirect hop (up to 3 hops max); disallows redirects to restricted destinations or non-HTTP(S) schemes.
- **Resource Bounds:** Enforces response size ceilings (max 10 MB) and request timeout limits (5s default, abort signal enforced).

### GitHub Action Security
- Inputs are passed directly as data arguments to the runner script (`scripts/run-action.mjs`), completely eliminating shell injection vectors.
- Runs validation in a single pass to eliminate redundant network or computational overhead.

### Runtime Baseline
- Node.js runtime baseline is enforced at `>=22` to ensure modern security fixes, TLS baselines, and package compatibility.

---

- npm packages are published with [provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
- SBOM (Software Bill of Materials) is attached to each GitHub release
- Verify package integrity: `npm audit signatures`

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with permission).
