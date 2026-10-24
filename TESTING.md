# Beta validation — 2026-10-24

Environment: Windows Desktop DeepSeek Harness 0.2.1-rc.3; ordinary npm CLI also upgraded and version-checked at 0.2.1-rc.3.

## 0.6.0-beta.4 validation

- Six Node tests and syntax checks pass, including lossless JSON round-trips for legacy candidates without titles and pending/error transitions.
- Replayed the affected local session against the actual DSH isRemoteJsonValue validator: the old code failed on batches[0].titles and pending.error; the fix passes without modifying the session log.

## 0.6.0-beta.1 validation

- Five Node tests pass: keyboard/history navigation and remote dispatch, immutable projection history across pending/failure/replay, plus prior core checks.
- Real Desktop Session SDK with model stub: manual refresh adds a second persistent batch; provider failure preserves both; new-turn cancellation remains intact.
- Installed in Windows Desktop 0.2.1-rc.3. Actual configured model: Right opens the first batch, another Right generates a new batch of three, Left restores all three original suggestions. UI shows batch 2/2 then 1/2. No user prompt was sent.
- Refresh uses the host command entry point; the host records command lifecycle events. Generating a new batch incurs an additional model call, with at most two attempts. Older groups are retained for that assistant reply; a new reply starts a new history.

## 0.5.0-beta.3 update validation (historical)

- Installed beta.3 with the bundled Desktop CLI and restarted Desktop.
- Actual demo UI: default first candidate only; single Tab expands three with an empty draft; Down selects the second; Enter fills that candidate into the draft. The Send button remains available and conversation remains at one turn: adoption did not send.
- Four Node tests and syntax checks pass, including Enter event suppression, modifier/IME/repeat guards and preserving existing drafts.

## 0.5.0-beta.2 update validation (historical)

- Installed the beta.2 tarball over beta.1 using the bundled Desktop CLI; installer exited 0. Restarted the actual Desktop application.
- Actual UI in the existing demo conversation: first candidate only by default; two rapid Tab presses expand three candidates without adopting; Down expands only the second candidate body; Tab inserts the second candidate into the draft without sending.
- Actual UI: Esc collapses to the first candidate; a single Tab inserts that first candidate after the short delay; Tab with a nonempty draft preserves its text.
- Four Node tests and syntax checks pass. Simulated keyboard tests additionally cover cancelling delayed adoption on typing, pointer input, draft changes and session switches, modifier/scope guards and new-batch compact defaults.
- Model generation and summary UI were not changed or rerun for beta.2; earlier beta.1 coverage is listed below.

## 0.5.0-beta.1 validation (historical)

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

Not tested: macOS/Linux, other DSH versions, all provider implementations, or a newly authenticated account in the clean profile. No claim of universal compatibility or guaranteed suggestion quality. The package targets exactly the version above; beta.2 changes the prediction interaction; model generation remains unchanged. The client depends on host composer attributes that may change in future DSH versions.

No credentials, personal chats, account configuration or local test logs are distributed.

CI template: ci.example.yml is provided as an optional example. GitHub Actions is not enabled in this initial release because the publishing OAuth token does not have workflow scope. Local tests above were actually run.
