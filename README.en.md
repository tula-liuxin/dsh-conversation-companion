# Conversation Companion

Concise next-message suggestions and plain-language summaries for DeepSeek Harness.

Third-party plugin, MIT licensed. Beta 0.5.6, targeting Windows Desktop DSH 0.2.1-rc.3 only. The current UI and generation instructions are Chinese-first. Other OS/versions are unverified.

Download the release tarball. Launch Desktop once to initialize its profile, then fully quit through the Application menu. On Windows, use its bundled CLI in PowerShell (adjust the download path):

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\Downloads\dsh-conversation-companion-0.5.6.tgz"
```

Reopen Desktop and check the plugin version. The ordinary npm CLI cannot manage the reserved `desktop` profile. Configure `deepseek-official` / `deepseek-flash` first. Remove the old `@local/prompt-copilot` development bundle before installing this one.

- Up/down selects among up to three useful suggestions; only the selected prompt expands.
- The panel header is a row of icon buttons: checkmark adopts the current candidate, chevron-down expands all, arrows browse batches (refresh icon on the latest one), chevron-up collapses, × hides. Click or tap; no keyboard is needed, so every action works on a phone.
- Click a candidate to insert it into your draft, or press Tab for the selected one; adoption never sends.
- Only the first suggestion is shown by default. Press Down or Right to expand all candidates. Clicking any candidate adopts it without sending; Esc collapses to the first.
- The sparkle button opens an editable, draggable, resizable summary inside DSH.

Each reply triggers an extra model call, with at most one format retry. Recent conversation and short user style samples go to your configured model provider. Generated summaries/suggestions are stored in DSH session records and a local JSONL cache. Separate logging of sent user text is OFF by default. No plugin telemetry server. Summary edits stay in local browser storage. AI output can be wrong.

See [Chinese usage/configuration guide](README.md), [privacy](PRIVACY.md) and [license](LICENSE). Source tests: `npm test`; package: `npm pack`. No build or install scripts are required.

While expanded, Left and Right browse existing batches. Right generates a new batch only when viewing the latest one (an additional model call). History is kept per reply, including while regeneration is pending or fails.

Esc in compact mode hides predictions completely across sessions and restarts on this device. Tab in an empty editor restores the compact view without adopting. Existing drafts retain normal Tab behavior.

## Draft correction

Draft checks are manual only: Shift+Tab requests a conservative check; press Tab twice within 450ms while holding Shift for a deep rewrite. Typing, pasting, deleting and idle time never trigger checks. Red strikethrough marks deletions and green underlines mark additions. Tab accepts without sending; Esc dismisses. Editing invalidates stale suggestions without requesting another check. Drafts over 12,000 characters are skipped. Manual checks use additional model calls and transmit unsent draft text to the configured provider; see PRIVACY.md.

### Manual checks

Shift+Tab requests a conservative check regardless of length or previous checks. Hold Shift and press Tab twice within 450ms for one deep rewrite instead. Deep mode uses recent conversation and may restructure the request or change its direction; reasons are shown. Tab accepts, Esc dismisses. Automatic checks remain conservative. Empty drafts, IME composition and running turns are excluded.

Complete suggestions are validated and shown individually as they arrive, followed by the remaining suggestions and summary in the same batch. The model request, generation instructions, context and validation rules are unchanged. No extra requests are added. First-text latency from the provider remains; timing metadata is recorded locally to distinguish that wait from output delivery.

Tab in an empty composer requests predictions when none exist, showing progress or the reason they cannot be generated. A stopped tool-only turn can use its existing user context without resuming the agent or assuming tool success. A new empty conversation shows a request to send a message first.

While the main session is running, Tab in an empty composer explicitly requests predictions; Shift+Tab checks a draft and double Shift+Tab requests deep rewriting. No automatic predictions, draft checks or title repairs are started during the running turn. Requested predictions use a snapshot of existing user/assistant text, survive further output, and are cleared at the next turn. A turn with manual predictions skips duplicate automatic generation at completion. Clicking prediction whitespace/header focuses the real composer for immediate typing; clicking a candidate adopts it into the draft. Adoption never sends or stops the main task.
