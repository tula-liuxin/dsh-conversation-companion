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

## 0.2.0 输入纠错验证（2026-10-25）

- 8 项 Node 测试通过：新增30字阈值、过期响应丢弃、Tab采用、Esc关闭、会话隔离、已有草稿恢复不触发；原候选和lossless JSON回归通过。
- Windows DSH 0.2.1-rc.3 实际安装并重启，使用已登录的测试会话调用真实模型：例句两处“没”建议改成“每”，红删绿增可见；Tab只填草稿，轮次仍为1轮1步。Esc关闭后原文保持。
- 对照否定句返回 edits:[]，无建议框；宿主命令记录确认未记录完整输入参数。模型准确性仅验证这些样例，不代表所有歧义都能判断正确。
- 测试草稿已清空，其他会话原有草稿未修改。

## 0.2.1 降频验证

8 项测试通过。虚拟时钟覆盖：30字在1499ms不请求、1500ms请求；不足30字在4999ms不请求、5000ms请求；继续输入重置计时；纯删除触发慢档；未变化草稿与已采用结果不重复检查。


## 0.2.2 桌面复验（2026-10-25）

真实桌面重新加载后：长例句输入动作开始到command/run为1591ms，模型1613ms返回两处修正，Tab采用后仅改变草稿。短句“帮我解决这个问提。”输入到command/run为5100ms，模型957ms返回一处纠错。人工目视确认正文缩小且左右对齐。8项自动化测试通过，新增无错误提示2.5秒自动关闭验证。时间含输入动作开销，非精确浏览器计时。

## 0.3.0 验证（2026-10-25）

9项测试通过，覆盖单次450ms分流、双次仅发一次deep、Esc及编辑取消、IME/重复键/其他输入框保护、主动检查绕过同文去重、60字5秒与小修改15秒自动触发、深度模式独立提示词及近期上下文、允许整体改写并校验片段。真实桌面Shift+Tab已触发basic并返回“问提→问题”。双击手势与deep模型请求使用模拟事件/模型验证，未声称完成真实桌面双击验收。额外尝试在聊天框输入内部命令被宿主当作普通消息，测试轮次已停止，生成的临时探测文件已清理；这不属于插件快捷键调用路径。

## 0.3.1

9项既有回归测试、JavaScript语法检查通过。改写理由使用CSS hover/focus-within即时显示的tooltip，不依赖浏览器原生title延迟。该次未进行真实鼠标悬停验收。

## 0.3.2

10项测试及语法检查通过。真实桌面重新打开原会话并翻到第1/5组，模型补标题后显示：刷新试试看、先保留文档、下一步怎么做。原候选正文与5组历史保留。


## 0.4.0 提速验证（2026-10-25）

- 14 项 Node 测试、JavaScript 语法检查、git diff --check 通过。新增覆盖：相同检查合并、成功结果60秒复用、草稿/模式/深度上下文隔离、到期重算、错误不缓存、新输入取消旧请求、完整候选数组才提前发布、摘要更新同一历史组。
- 使用 Windows Desktop 0.2.1-rc.3 的真实 Session SDK 和受控流式模型：三条候选发布时摘要仍未返回；重复轮次事件没有重启生成；摘要完成后仍为同一组；事件投影可无损 JSON 重放。该项为真实宿主数据结构测试，模型为桩。
- 将0.4.0安装到已登录桌面profile并完全退出重启。真实界面在独立测试会话对同一句错别字连续按Shift+Tab，首次命令705ms，随后相同检查0ms（宿主毫秒计时精度），两次返回文本完全相同。这里不含450ms快捷键分流和界面刷新，也不代表全新草稿能瞬时完成。测试草稿已清空，没有发送聊天消息。
- 真实模型新一组候选：pending事件到完整候选为6337ms，到摘要完成为7271ms。候选比等待完整结果提前934ms（这一样本约13%），界面显示第7/7组且仍保留历史；最终摘要没有增加第二个历史组。这是一次观测，不是平均延迟承诺。
- 模型、推理设置、上下文长度、候选/纠错校验保持；本轮没有做系统性的语义质量盲评。首次请求仍受模型与网络延迟影响。自动触发等待仍为60字+5秒/少量编辑15秒，未用增加调用频率换取速度。
