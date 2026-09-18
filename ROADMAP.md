# Sparkle Validator Roadmap

Current repository version: **1.2.1**. Updated September 18, 2026.

This is the stack-ranked backlog from the [Sparkle 2.10.0 review](REVIEW-SPARKLE-2.10.0.md). All 14 findings have been fully remediated per the [implementation plan](IMPLEMENTATION-PLAN.md).

The product includes a CLI, JavaScript library, browser validator, Pages fetch proxy, GitHub Action, XSD schemas, metadata/signature-format checks, version analysis, and optional remote URL/length checks. Cryptographic archive/feed verification is not implemented. Comprehensive Sparkle 2.10 compatibility has been achieved.

| Rank | Work item | Scope and completion criterion | Review coverage | Status |
|---|---|---|---|---|
| 1 | R01: Secure the GitHub Action | Treat inputs as data, validate options, run validation once, preserve outputs and exit status; injection regressions pass. | Finding 1 | [x] |
| 2 | R02: Enforce proxy destination policy | Correct IPv6 classification, validate redirects and DNS results, establish enforceable egress protection, and bound requests/bodies. | Findings 2–3 | [x]* |
| 3 | R03: Align and refresh the toolchain | Reconcile Node support with dependencies, update vulnerable packages/lockfile, and complete development and production audits. | Findings 13–14 | [x] |
| 4 | R04: Test and check the actual Function | Replace copied helper tests with handler tests; include Functions in lint/type checks and exercise limits, redirects, DNS, and aborts. | Finding 3 | [x] |
| 5 | R05: Make schemas correct and self-contained | Fix qualified attributes, vendor the XML namespace dependency, distinguish schema failures, require xmllint in CI, and generate public copies. | Findings 4–5; schema-copy follow-up | [x] |
| 6 | R06: Repair diagnostic identity and reporting | Allocate unique rule IDs, preserve occurrences, define count/grouping compatibility, and synchronize the rule catalog. | Finding 6 | [x] |
| 7 | R07: Match Sparkle's item semantics | Correct version precedence, namespace handling, informational destinations/conditions, hardware constraints, and minimum-update validation. | Findings 7–9; hardware/minimum-update follow-up | [x] |
| 8 | R08: Validate signature and release-note metadata | Strict base64/decoded-length checks, all localized-note metadata, and explicit signed-feed requirements without claiming authentication. | Findings 10–11 | [x] |
| 9 | R09: Resolve and validate URLs consistently | Check every localized link, enforce context-specific schemes, and resolve relative URLs using known feed context. | Finding 12 | [x] |
| 10 | R10: Bound and stabilize remote validation | Validate concurrency/timeouts, clean up timers and bodies, bound source fetching, and cover HTTP behavior deterministically. | Finding 3 deadlines; remote-validation follow-up; 2.10 length coverage | [x] |
| 11 | R11: Add explicit Sparkle 2.10 compatibility context | Enforce macOS 12 minimums for identified 2.10 update items while preserving historical releases; expose context consistently. | 2.10 compatibility recommendations | [x] |
| 12 | R12: Make web results keyboard accessible | Use accessible expansion controls, retain focus, expose fetch/result state, and add browser smoke coverage. | Web accessibility follow-up | [x] |
| 13 | R13: Repair documentation and distribution hygiene | Update format/rule/security docs, release procedure, Homebrew template, executable examples, and roadmap status. | Documentation, release, Homebrew, and roadmap follow-ups | [x] |
| 14 | R14: Verify release readiness across all surfaces | Validate the packed library/CLI, Action, web/Function, schema downloads, release metadata, and migration notes before delivery. | Cross-project verification and compatibility risk | [x] |

\* *R02 Status Note (Accepted Platform Limitation):* IPv4/IPv6 classification, DoH pre-checking, redirect filtering, and request boundaries are fully implemented. Connection-level IP-pinning to eliminate 0-TTL DNS rebinding remains an explicitly accepted platform limitation of the Cloudflare Pages serverless runtime (outbound `fetch()` cannot pin destination socket IPs). See [`SECURITY.md`](SECURITY.md) for architectural details.

All security fixes, toolchain refreshes, schema self-containment, diagnostic uniqueness, Sparkle 2.10 semantics, URL resolution, bounded remote checks, accessibility enhancements, and clean-checkout/targeting/range/signed-feed review remediations have been delivered and verified across the entire test suite.

**Release gates**

- All 14 numbered findings and every follow-up have an accepted fix or a documented, evidence-backed resolution.
- Required tests run offline after dependency/tool installation, including schema compilation and actual Function/Action tests. No missing-tool skip may make required CI coverage green.
- The advertised Node floor is exercised in CI; dependency audits distinguish vulnerability findings from unavailable audit service responses.
- CLI, library, web, Action, and XSD behavior agree where they share scope; intentional differences, accepted platform limitations (e.g. DNS rebinding in edge runtimes), and signature-verification limits are documented.
- Package contents, public schema copies, version references, and release instructions are consistent. Publishing/deployment is a separate execution step, not part of writing this plan.

**Deferred until the repair backlog is complete**

- Cryptographic Ed25519 archive verification using a public key, followed by a separately designed signed-feed verification feature. Decide whether legacy DSA verification is worth supporting.
- Release cadence/staleness analysis, version-gap heuristics, timeline visualization, delta-chain analysis, and bandwidth estimates.
- Appcast generation, GitHub Release ingestion, automated feed updates, and release-note templates.
- Editor integration, Homebrew Cask tooling, feed comparisons, and migration assistance.

These remain ideas rather than promised version milestones. The existing GitHub Action, version-order/duplicate checks, and remote URL checks are maintenance work, not future features.
