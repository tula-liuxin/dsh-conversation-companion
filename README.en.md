# Conversation Companion

Concise next-message suggestions and plain-language summaries for DeepSeek Harness.

Third-party plugin, MIT licensed. Beta 0.1.0, targeting Windows Desktop DSH 0.2.1-rc.3 only. The current UI and generation instructions are Chinese-first. Other OS/versions are unverified.

Download the release tarball. Launch Desktop once to initialize its profile, then fully quit through the Application menu. On Windows, use its bundled CLI in PowerShell (adjust the download path):

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\Downloads\dsh-conversation-companion-0.1.0.tgz"
```

Reopen Desktop and check the plugin version. The ordinary npm CLI cannot manage the reserved `desktop` profile. Configure `deepseek-official` / `deepseek-flash` first. Remove the old `@local/prompt-copilot` development bundle before installing this one.

- Up/down selects among up to three useful suggestions; only the selected prompt expands.
- Tab inserts it into your draft, never sends it.
- Only the first suggestion is shown by default. Press Down or Right to expand all candidates. Tab adopts the selected candidate without sending; Esc collapses to the first.
- The sparkle button opens an editable, draggable, resizable summary inside DSH.

Each reply triggers an extra model call, with at most one format retry. Recent conversation and short user style samples go to your configured model provider. Generated summaries/suggestions are stored in DSH session records and a local JSONL cache. Separate logging of sent user text is OFF by default. No plugin telemetry server. Summary edits stay in local browser storage. AI output can be wrong.

See [Chinese usage/configuration guide](README.md), [privacy](PRIVACY.md) and [license](LICENSE). Source tests: `npm test`; package: `npm pack`. No build or install scripts are required.

While expanded, Left and Right browse existing batches. Right generates a new batch only when viewing the latest one (an additional model call). History is kept per reply, including while regeneration is pending or fails.

Esc in compact mode hides predictions completely across sessions and restarts on this device. Tab in an empty editor restores the compact view without adopting. Existing drafts retain normal Tab behavior.
