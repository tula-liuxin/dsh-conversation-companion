# Beta validation — 2026-10-24

Environment: Windows Desktop DeepSeek Harness 0.2.1-rc.3; ordinary npm CLI also upgraded and version-checked at 0.2.1-rc.3.

## Completed

- Four Node tests: candidate boundaries/deduplication, configuration/defaults, timeouts/cancellation, simulated keyboard/scope behavior.
- JavaScript syntax checks and npm tarball file allowlist checks.
- Extracted tarball regression using the real Desktop Session SDK and a model stub: event projection, ignorable records, actual JSONL writes, user-source filtering, provider error and stale-generation cancellation. Tested raw-message logging both enabled and disabled.
- Separate DSH_HOME initialized by Desktop; installed the tarball with Desktop's bundled CLI into its clean profile. Exit code 0, correct bundle registration, actual plugin boot at 0.5.0-beta.1. Fresh-home model/UI testing stops at the account onboarding screen.
- Removed the development bundle and installed the same release tarball into an already authenticated Desktop profile. UI confirmed the release version, tarball source, correct title/icon and one running component.
- New isolated demo workspace/conversation, real configured provider: actual AI reply followed by three short suggestions and a summary. No tools or file edits requested.
- Actual UI: Esc hides; first Tab reopens with empty draft; down arrow switches expanded candidate; second Tab inserts the selected prompt without sending; Tab with a nonempty draft performs normal focus navigation without overwriting it.
- Actual UI: summary opens, resizing works, an edit remains after close/reopen. Same client code was also exercised for dragging and background scrolling without light-dismiss.
- Test-session cache contains generated output but no `sent` raw-user-message record under default settings.
- User's previous conversation draft was restored empty after earlier interaction testing. A separate test conversation remains as a local verification artifact, with an unsent candidate and a local summary edit.

## Boundaries

Not tested: macOS/Linux, other DSH versions, all provider implementations, or a newly authenticated account in the clean profile. No claim of universal compatibility or guaranteed suggestion quality. The package targets exactly the version above; no new runtime code changes were needed after live validation. The client depends on host composer attributes that may change in future DSH versions.

No credentials, personal chats, account configuration or local test logs are distributed.

CI template: ci.example.yml is provided as an optional example. GitHub Actions is not enabled in this initial release because the publishing OAuth token does not have workflow scope. Local tests above were actually run.
