# Conversation Companion

Concise next-message suggestions and plain-language summaries for DeepSeek Harness.

Third-party plugin, MIT licensed. Beta 0.5.0-beta.1, targeting Windows Desktop DSH 0.2.1-rc.3 only. The current UI and generation instructions are Chinese-first. Other OS/versions are unverified.

Download the release tarball. Launch Desktop once to initialize its profile, then fully quit through the Application menu. On Windows, use its bundled CLI in PowerShell (adjust the download path):

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\Downloads\dsh-conversation-companion-0.5.0-beta.1.tgz"
```

Reopen Desktop and check the plugin version. The ordinary npm CLI cannot manage the reserved `desktop` profile. Configure `deepseek-official` / `deepseek-flash` first. Remove the old `@local/prompt-copilot` development bundle before installing this one.

- Up/down selects among up to three useful suggestions; only the selected prompt expands.
- Tab inserts it into your draft, never sends it.
- Esc hides suggestions. Tab in the empty editor reopens them; another Tab adopts one.
- The sparkle button opens an editable, draggable, resizable summary inside DSH.

Each reply triggers an extra model call, with at most one format retry. Recent conversation and short user style samples go to your configured model provider. Generated summaries/suggestions are stored in DSH session records and a local JSONL cache. Separate logging of sent user text is OFF by default. No plugin telemetry server. Summary edits stay in local browser storage. AI output can be wrong.

See [Chinese usage/configuration guide](README.md), [privacy](PRIVACY.md) and [license](LICENSE). Source tests: `npm test`; package: `npm pack`. No build or install scripts are required.
