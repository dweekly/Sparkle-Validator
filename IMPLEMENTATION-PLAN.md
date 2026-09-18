# Sparkle 2.10 Compatibility and Validator Repair Plan

Written September 17, 2026, against repository version 1.2.0. This plan implements the [stack-ranked roadmap](ROADMAP.md) and resolves the [review](REVIEW-SPARKLE-2.10.0.md). It records intended work; it does not mark implementation, audits, publication, or deployment complete.

The outcome is a validator whose diagnostics match Sparkle's behavior, whose network and Action boundaries treat input safely, and whose supported environments, documentation, and distributed artifacts agree. Each R-number is a reviewable work package. Ship focused security repairs first, with their regression tests. Keep unrelated refactors out of those changes.

**Baseline and working method**

The reviewed build, lint, and formatting checks passed on Node 22.23.2. The suite reported 186 passing and 16 failing tests; failures came from the external XML schema dependency. The initial audit reported 14 dependency findings, but a later production-only audit could not resolve the registry. These are baseline observations, not future acceptance results.

For each package: add a meaningful regression using the review's counterexample, implement the correction, run affected checks, and update the public contract/docs. Required tests use local fixtures and mocked network responses; live-feed checks stay opt-in. Compare compatibility decisions with tagged Sparkle 2.10.0 source and official documentation, recording subtle upstream expectations alongside fixtures. Verify current tool/platform requirements at implementation time.

Use the existing test framework and build where possible. Tests must import production code or execute the shipped script. Introduce shared helpers only where production callers need shared behavior. Documentation accompanies changes throughout rather than waiting for the final package.

**R01 — Secure and simplify the GitHub Action**

Priority: P1. Dependencies: none for the security fix; coordinate runtime changes with R03. Files: `action.yml`, a checked-in Action runner/helper if needed, and new Action integration tests.

1. Move every input from inline shell interpolation into environment variables or structured arguments. If keeping Bash, use an argument array; never use `eval` or a re-parsed command string. Place `--` before the source argument where supported.
2. Validate Boolean inputs, restrict output format, and require a finite positive integer timeout within a documented bound. Reject malformed inputs clearly instead of silently coercing them.
3. Invoke validation once. Capture exit code, stdout, and stderr separately; derive Action outputs and human-readable text from the same result. Preserve strict-warning behavior and treat quiet/no-info as display controls.
4. Distinguish invalid feeds from missing files, package startup failures, and invalid JSON. Empty output must never become successful validation. Preserve multiline output safely and quote the output-file path.

Acceptance: execute the actual runner using a local stub or packed validator. Inputs containing spaces, quotes, backticks, dollar signs, `$(...)`, newlines, and leading dashes remain literal; no marker command executes. Assert one validator invocation, correct exit behavior, and consistent JSON/text outputs. Preserve documented Action output names.

**R02 — Repair the proxy's outbound destination boundary**

Priority: P1. Dependencies: none to start; include the minimal actual-handler tests from R04 in this fix. Files: `functions/api/fetch.ts` and narrowly scoped address/fetch helpers.

1. Parse URLs once; restrict schemes and reject unexpected credential-bearing URLs. Normalize bracketed IPv6, compressed/expanded forms, and IPv4-mapped addresses. Use a reviewed IP parser or tested binary-address classification rather than substring matching. Cover private, loopback, unspecified, link-local, multicast, and reserved ranges.
2. Resolve A and AAAA records with deadlines. Handle CNAMEs, resolver failures, empty answers, and mixed public/private results explicitly. Refuse targets with prohibited usable addresses while supporting public IPv6-only hosts.
3. Follow redirects manually, resolving relative Location headers and validating each new destination. Impose a hop limit and do not forward credentials between origins.
4. Resolve the DNS check/fetch race explicitly. Determine what the Cloudflare runtime can enforce for outbound connections; use a demonstrably protected egress mechanism if independent DNS prechecks cannot constrain the actual fetch. Do not label prechecking as rebinding protection. If arbitrary public fetching cannot be made enforceable, contain that endpoint's scope until a safe implementation is available and document the product impact.
5. Bound the entire operation, including DNS, redirects, headers, and body reads. Retain a streaming byte limit regardless of Content-Length; cancel and await cleanup on timeout, overflow, or abandoned responses. Replace repeated chunk-array spreading with a bounded linear copy or streaming decoder.

Acceptance: actual-handler tests block `[::1]`, `[fd00::1]`, mapped private IPv4, private redirect targets, and mixed DNS answers before unsafe fetches. Public IPv4/IPv6 and allowed redirects work. Loops, slow DNS, stalled bodies, deceptive lengths, and oversized chunked responses terminate predictably. Record connection-level enforcement evidence separately from mocked policy tests; do not probe unrelated private services.
Accepted Platform Limitation: The Cloudflare Pages serverless runtime cannot pin destination socket IPs for global fetch(). Independent DoH pre-checking and redirect filtering are enforced, but connection-level rebinding protection is recorded as an accepted platform constraint.

**R03 — Establish a truthful Node and dependency baseline**

Priority: P2. Dependencies: none. Files: `package.json`, lockfile, CI/release workflows, Action runtime setup, and contributor docs.

1. Choose a supported Node floor and LTS test matrix using current dependency requirements/support policies. Preferred direction: a supported modern LTS baseline. If Node 18 support is deliberately retained, select and test compatible dependencies instead of keeping an unsupported promise.
2. Align engines, Node types, Action setup, release jobs, and documentation. Exercise the minimum supported minor version as well as matrix targets.
3. Refresh vulnerable direct/transitive packages with reviewed lockfile changes. Keep Vitest and coverage versions compatible. Evaluate advisory exposure rather than equating development-tool findings with deployed vulnerabilities.
4. Complete full and production-only audits. A registry failure is unavailable evidence, not a clean audit. Resolve the existing high-severity CI gate or record narrowly justified exceptions with a reason, owner, and expiry.

Acceptance: clean install, affected tests, build, and CLI/library smoke checks pass on the declared floor and matrix. Audit results distinguish development/production scope. Decide semantic-version impact before changing the public Node promise; keep it separate from any compatible urgent security patch.

**R04 — Exercise the actual Function in CI**

Priority: P2. Dependencies: R03 for the final toolchain; share minimal setup with R02. Files: `test/api/fetch.test.ts`, Function runtime types, TypeScript/ESLint configuration, and scripts.

1. Delete the duplicated helper implementation from tests. Import the actual handler/helpers and mock only external services.
2. Include `functions/` in lint and type checks, using a separate TypeScript configuration if `rootDir: src` requires it. Supply real platform types for `PagesFunction` and fetch extensions.
3. Cover input parsing, DNS/redirect policy, content types, XML detection, response shape/status, body limits, aborts, cleanup, failures, and success. Add a Function bundle/runtime smoke check; type checking alone does not establish runtime compatibility.

Acceptance: required CI exercises shipped Function code. A deliberate handler regression fails tests. Malicious-address, redirect, chunked-body, and timeout cases cannot pass by testing an unused copy.

**R05 — Correct and package the schemas**

Priority: P2. Dependencies: coordinate CI/tool installation with R03/R04. Files: root XSDs, vendored XML namespace schema, public schema assets, `tsup.config.ts`, schema tests, and `scripts/test-xsd.sh`.

1. Vendor the XML namespace schema needed for `xml:lang`, preserving license/attribution. Make imports relative and include every transitive dependency in downloadable assets.
2. Use qualified references for release-note `edSignature`/`length` and critical-update `version`; keep enclosure `length` unqualified. Verify full-release-note attributes against upstream rather than assuming identical semantics.
3. Add valid fixtures for signed notes, localization, conditional critical updates, and aliases; add wrong-qualification/type counterparts. Include the appcast-guide examples.
4. Distinguish tool/schema compilation failures from document rejection. Run a known-valid compilation check before negative fixtures, preserve stderr/exit information, and use `--nonet`. Install xmllint explicitly in CI; fail required coverage if it is missing.
5. Generate public schemas/imports from canonical files during the build. Exercise the standalone downloadable directory. Ensure the shell runner completes the entire fixture set and reports aggregate failures on supported shells.

Acceptance: no network is needed to compile schemas. Valid fixtures pass and invalid ones fail for intended reasons. A broken import fails infrastructure checks rather than counting as a successful rejection. Public copies match canonical files and resolve dependencies locally.

**R06 — Make diagnostics uniquely identifiable and lossless**

Priority: P2. Dependencies: finish before allocating new diagnostics in R07–R11. Files: rules, `types.ts`, `validator.ts`, CLI formatters, web results, catalog documentation, and tests.

1. Inventory emitted/documented IDs and their meanings, including W011/W012/W042 collisions. Establish one catalog for ID, severity, and description; do not reserve IDs speculatively in the roadmap.
2. Give each distinct rule a unique ID and publish a migration table. Preserve established meanings where possible; describe unavoidable ambiguity in formerly shared IDs.
3. Preserve every occurrence's message, location, and fix. Group only in presentation. Define whether counts mean groups or occurrences and apply the same contract to core and remote diagnostics.
4. Choose a compatible rollout: additive lossless fields/opt-in mode for the current major, or an explicitly documented new-major default contract. Do not silently change consumers' count/array semantics. Display filtering must not change validity or strict-mode decisions.

Acceptance: missing enclosure length/type plus malformed min/max OS exposes four independent diagnostics. Namespace and version warnings remain distinct. All repeated locations are retrievable. Catalog uniqueness/emitted-ID membership is checked; library, CLI, Action, and web agree on the result contract, with migration examples.

**R07 — Correct item interpretation and constraints**

Priority: P2. Dependencies: R06; coordinate URL context with R09. Files: parser, constants/utilities, structure/version/enclosure/best-practice/info/system-requirement rules, and fixtures.

1. Centralize enclosure-first effective-version selection. Warn on conflicts and use the selected version for duplicates, ordering, date comparisons, and delta-source analysis. Cover equal/conflicting values, blanks, missing values, and filename fallback. Verify fallback behavior in signed-feed context.
2. Use resolved namespaces and actual scope. Accept aliases for the canonical URI; test nested rebinding, default namespaces, and unrelated declarations. Distinguish verified legacy prefix compatibility from arbitrary URI equivalence.
3. Require a usable enclosure or information URL even with `informationalUpdate`; empty links are not destinations. Interpret the nested `version`/`belowVersion` conditions for W017 rather than unrelated OS/upgrade elements.
4. Verify supported hardware tokens in upstream code and replace substring matching. Test `arm64`, `not-arm64`, aliases, delimiters, case, and blanks. Warn on unsupported values without asserting Sparkle enforces them.
5. Validate `minimumUpdateVersion` content using appropriate version semantics. Investigate whether a minimum above the offered build makes the update unreachable and select a justified diagnostic. Avoid unconditional errors based on unverified comparator assumptions.

Acceptance: the review's precedence, alias, and destination counterexamples are fixed. Hardware/minimum-update diagnostics describe actual behavior. Subtle fixtures cite the upstream expectation, and supported legacy feeds retain correct behavior.

**R08 — Validate signatures and signed-note metadata**

Priority: P2. Dependencies: R06/R07; share fixtures with R05. Files: enclosure/release-note rules, a browser-compatible signature-format helper, options/types, and tests.

1. Share strict encoding checks across archives, deltas, and notes. Validate characters, grouping, supported whitespace, padding, and actual decoded length without introducing Node-only browser dependencies. Treat noncanonical encodings according to verified Sparkle decoder behavior.
2. Require 64 decoded bytes for Ed25519 and reject the reproduced 87-`A`/five-padding-character value. Clarify the limited checks possible for legacy DSA; size heuristics are not authentication.
3. Check present signatures and qualified lengths on every localized note link. Distinguish missing, empty, malformed, zero, and out-of-range values, with justified severities.
4. Add explicit signed-feed-required context for required metadata. Distinguish external from embedded notes and verify upstream requirements before enforcing them. This setting describes the consuming client's configuration, not the framework bundled in an offered update.

Acceptance: valid encodings pass; bad characters/padding/decoded size and invalid note lengths produce specific diagnostics. Missing metadata is diagnosed when the relevant requirements are known. Docs/UI explicitly state that format validation does not authenticate the key, downloaded bytes, or feed.

**R09 — Unify URL validation and resolution**

Priority: P2. Dependencies: R06/R07; share resolution with R10. Files: URL utilities/rules, remote extraction, CLI source reader, proxy response/web handling, and public options.

1. Check every localized release-note/full-note link and use context-specific schemes. Reject `feed:`, executable, and file schemes where Sparkle requires HTTP(S).
2. Add optional feed/base-URL context. Use the final validated response URL for fetched feeds, carrying it through the web proxy. Expose explicit base context for file/stdin sources.
3. Resolve URLs consistently for diagnostics and remote checks. Without a base, report unresolved context instead of asserting all relative URLs are invalid or issuing an unintended request. Preserve the original source value in diagnostics and show the resolved destination when helpful.
4. Keep URL interpretation separate from fetch authorization: even a syntactically valid/resolved destination must satisfy network policy.

Acceptance: later localized bad links fail; `feed://` enclosures fail; supported relative paths resolve against the correct redirected feed URL. Missing context is clear. Library/CLI/web semantics agree and remote requests cannot bypass destination policy through resolution.

**R10 — Bound and deterministically test network work**

Priority: P2. Dependencies: R02, R06, R09. Files: `src/core/remote.ts`, `src/cli/fetch.ts`, CLI options, narrowly shared request helpers, and remote tests.

1. Reject zero, negative, fractional, nonfinite, or excessive concurrency/timeouts before work starts. Document defaults/limits and an overall budget where needed.
2. Clear timers in `finally`; cancel/abort bodies and requests on all exit paths. Bound remote source size and body-read time. Document local-file/stdin behavior separately.
3. Apply destination/redirect protection to requests extracted automatically from untrusted feeds. Explicitly decide how user-supplied CLI sources can access local feeds; avoid undocumented behavioral changes from shared helpers.
4. Mock HEAD results for success/failure, missing/malformed/matching/mismatched Content-Length, redirects, aborts, archive/delta URLs, and qualified note lengths. Define HEAD-unsupported behavior; any GET fallback must be bounded and cancel unused bodies.
5. Preserve useful error categories and stable diagnostic ordering. Use the common reporting contract for remote results; missing HTTP size must not become a fabricated mismatch.

Acceptance: invalid concurrency fails promptly instead of hanging, request counts respect the bound, rejected requests leave no live timers, and stalled sources terminate. All mandatory network tests run without live endpoints. Optional feed checks are clearly separate.

**R11 — Add explicit Sparkle 2.10 update context**

Priority: P2 completeness. Dependencies: R06–R10. Files: public types/options, system rules, CLI/Action config adapters, web form/state, fixtures, and API docs.

1. Design optional per-item context for the Sparkle version bundled in the update. Proposed selection: effective build version plus optional channel/enclosure URL, paired with `bundledSparkleVersion`. Reject unmatched or ambiguous selectors; never silently apply it to all historical items.
2. Keep this separate from consuming-client version/configuration and `requireSignedFeed`. Preserve `validate(xml)` without context. Explain unknowns without implying bundle contents were inspected.
3. For an item identified as bundling Sparkle 2.10, diagnose missing, blank, malformed, or below-12 minimum OS metadata. Honor a higher application minimum and detect inconsistent bounds. Preserve legitimate older releases' pre-12 support.
4. Expose the same context through CLI/config, Action, and clear per-item web selection. Define precedence once. Do not invent appcast elements for validator-only context.
5. Add a mixed-history fixture and regressions for signed-note/HTTP lengths relevant to 2.10. Verify the profile against tagged upstream behavior before claiming support.

Acceptance: a feed containing an older compatible release and a 2.10 update diagnoses only the targeted item's insufficient OS floor. Ambiguous configuration fails clearly. All front ends agree, and generic validation remains available without extra metadata.

**R12 — Make web results accessible**

Priority: P2 usability. Dependencies: R06 result shape; coordinate R11 controls. Files: `src/web/app.ts`, source HTML/CSS, and browser tests.

1. Replace clickable header divs with native buttons linked to result regions, with `aria-expanded`, keyboard activation, and visible focus.
2. Verify tabs, progress, errors, result announcements, and predictable focus when replacing results. Label new context controls and explain their scope plainly.
3. Smoke-test paste, upload, and URL flows using controlled endpoints, including failure recovery and fetch-button reenabling.

Acceptance: keyboard-only users can operate every result section/context control; expansion state matches visibility. Automated checks plus a manual keyboard pass cover success and error paths without live feeds.

**R13 — Synchronize documentation and distribution guidance**

Priority: P2/P3 hygiene. Dependencies: update alongside fixes; final pass after R01–R12. Files: README, appcast guide, SECURITY, CONTRIBUTING, CLAUDE/skill guidance, CHANGELOG, RELEASING, Homebrew files, and roadmap.

1. Synchronize rule/support information with the catalog and tested compatibility matrix. Explain metadata, profile, remote, and authentication boundaries; add the 2.10 mixed-history example, base-URL behavior, and Node/diagnostic migration guidance.
2. Turn examples advertised as valid into executable fixtures. Label placeholders clearly; valid signature encoding must not imply authentication of a real artifact.
3. Use one release sequence: update version without automatic commit/tag, update Action/changelog/lockfile references, run gates, commit, and tag once. Ensure tested/tagged content matches; build before manual publication and document actual workflow triggers.
4. Verify npm provenance/publishing setup before recommending fallback. Separate registry failures from unpublished versions. Download successfully to disk before checksumming; remove contradictory pipelines. Handle release reruns/already-created artifacts/no-op tap updates deliberately.
5. Compare the bundled formula with the separate live tap read-only during implementation. Choose one maintained source; retire the obsolete placeholder template clearly, or supply a verified version/hash and valid smoke fixture. Identify which repository receives real releases.
6. Keep generated web/schema assets tied to their sources. Mark roadmap work complete only after acceptance, retaining future ideas without fictional version milestones or reserved IDs.

Acceptance: follow documented preparation in a disposable checkout through build/package creation without publishing. Examples pass their claimed mode, release/tag instructions are consistent, support claims match tests, and the Homebrew copy is usable or unambiguously retired.

**R14 — Verify release readiness and handoff**

Priority: release gate. Dependencies: preceding packages relevant to the release; an urgent security release can apply these gates to its focused scope.

1. Run clean install, lint/types including Functions, formatting, unit/integration/Action/browser tests, offline XSD checks, and build on the supported matrix. Complete full/production audits with a working registry; infrastructure errors are failures to verify.
2. Pack/install in a disposable consumer project. Exercise ESM, CommonJS, TypeScript declarations, CLI file/stdin/URL input, JSON/text, strict mode, and operational exits. Verify runtime files are present and local build residue is unnecessary.
3. Test the Action against the intended package and web/Function against preview/local assets. Check standalone schema downloads offline, version references, catalog, compatibility docs, SBOM/provenance expectations, and migration notes.
4. Record the tested commit/package identity, limitations, and rollback procedure. Publishing, moving Action tags, changing the separate tap, and deploying the website are subsequent release actions; writing this plan performs none of them.
5. After an authorized release, smoke-test installed npm, Action, deployed UI/Function, downloadable schemas, and Homebrew distribution. Update status from verified results, not merely merged code.

Acceptance: evidence covers every delivered surface/finding. No P1 remains open for a security release. The complete 2.10 claim waits for its acceptance matrix. Deferred features are clearly distinguished from correctness defects and unverified results.

**Traceability and sequencing**

| Review item | Owning work packages |
|---|---|
| 1: Action injection and duplicate execution | R01 |
| 2: Proxy IPv6/redirect/DNS protection | R02, R04 |
| 3: Copied tests, unchecked Functions, missing deadlines | R02, R04, R10 |
| 4: XSD attribute namespaces | R05 |
| 5: External XSD dependency and false-positive rejection tests | R05 |
| 6: Colliding/lossy diagnostics | R06 |
| 7: Version precedence | R07 |
| 8: Namespace aliases/scope | R07 |
| 9: Informational destinations and conditions | R07, R09 |
| 10: Signed release-note metadata | R08 |
| 11: Malformed base64 accepted | R08 |
| 12: Localized links, schemes, relative URLs | R09 |
| 13: Node support mismatch | R03 |
| 14: Dependency advisories | R03, R14 |
| Hardware/minimum-update completeness | R07 |
| Remote concurrency and timer cleanup | R10 |
| Web accessibility | R12 |
| Stale roadmap | Planning update to ROADMAP; R13 maintenance |
| Release/provenance/checksum hygiene | R13, R14 |
| Obsolete Homebrew template | R13, R14 |
| Public schema duplication | R05 |
| Format guide/executable examples | R05, R13 |
| 2.10 OS floor, mixed histories, signed-note/HTTP lengths | R08, R10, R11 |
| Accurate validation/authentication scope | R08, R11, R13 |

Delivery sequence: security repairs (R01/R02 with minimal R04 tests); toolchain/infrastructure (R03–R05); diagnostic contract (R06); semantics/signatures/URLs/network fixes (R07–R10); compatibility/accessibility (R11/R12); final documentation/release verification (R13/R14). Possible Node/diagnostic breaking changes and enforceable proxy egress are explicit design decisions to settle in their owning work packages.
