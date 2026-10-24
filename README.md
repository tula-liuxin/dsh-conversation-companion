# 对话助手 · Conversation Companion

让 AI 帮你想下一句，也把长回复讲明白。

[English](README.en.md) · MIT · 0.6.0-beta.2

这是 DeepSeek Harness 的第三方插件，不适用于普通 DeepSeek 网页聊天。

## 有什么用

- 回复结束后生成最多三个简短的下一句建议，有用优先，不强行凑数。
- ↑ / ↓ 选择，选中项展开全文，Tab 填入草稿；仍由你决定是否发送。
- 展开后按 → 重新生成一组（会额外调用模型），按 ← 查看旧组；生成中或失败时保留旧建议。每轮回复的候选历史独立保存。
- 默认只显示第一条。按 ↓ 或 → 展开全部候选；Tab 填入选中项，不发送。展开后按 Esc 或点击“收起”回到第一条。
- ✨ 打开通俗摘要；浮窗可拖动、缩放、编辑，不妨碍操作外面的对话。
- 参考近期说话方式，尽量避免扩写需求；AI 仍可能理解偏差，请先看再采用。

## 兼容性

首版锁定 DeepSeek Harness **0.2.1-rc.3**，以 Windows Desktop 为验证环境。
macOS、Linux、其他 DSH 版本及无图形界面的 CLI 未完成验证，不承诺支持。
摘要只在 DSH 页面内置顶，不是跨应用系统置顶窗口。当前界面和生成指令以中文为主。

## 安装

需要已配置可用的 `deepseek-official` / `deepseek-flash`；没有这个模型配置时先配置模型服务。

下载 Release 的 `.tgz` 安装包。Windows Desktop 用户：

1. 至少启动过一次 DSH Desktop，让它初始化 profile，然后从“应用 → 退出”完全退出（只关窗口可能仍在托盘运行）。
2. 在 PowerShell 使用桌面版自带的命令安装；下面适用于默认安装路径，修改 tgz 路径为你的下载位置：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\Downloads\dsh-conversation-companion-0.6.0-beta.2.tgz"
```

3. 重新打开 DSH，插件页应显示“对话助手”及 `0.6.0-beta.2`。

注意：npm 安装的普通 `dsh` CLI 与桌面版自带 CLI 不同；普通 CLI 不允许管理保留的 `desktop` profile。不要直接用 PATH 中来源不明的 `dsh plugin --profile desktop`。界面安装也可在 DSH 中让 Creator 安装解压后包含 `package.json` 的本地 bundle 目录，通过 DSH 安装确认流程完成。

官方 npm 截至本次验证：`latest` 为 rc.2，`next` 为 rc.3。如需单独更新普通命令行，使用 `npm install -g @deepseek-ai/dsh@0.2.1-rc.3`；这不替代上述桌面安装命令。

如之前装过开发版 `@local/prompt-copilot`，先在插件页移除旧版，再安装此版本；不要同时启用两个版本。旧摘要和本地缓存不会自动删除。

## 使用

1. 正常发送一条消息，等待 AI 回复及插件额外生成结束。
2. 空输入框里出现建议，↑ / ↓ 或鼠标选一个，Tab 填入后可修改，再自行发送。
3. 展开后按 Esc 回到第一条；按 ↓ 或 → 查看更多。Shift+Tab、输入法组合和已有草稿不拦截。
4. 点 ✨ 查看摘要；失败时摘要窗口显示错误。检查模型服务后，下一轮回复会重新尝试。

## 模型用量与数据

每轮额外调用一次配置模型；格式不符合要求时最多再试一次，每次默认超时 60 秒。
会发送最近最多八条用户/AI 文本（默认截取 6000 字符），另附最近三条真实用户原话（各最多 400 字符）作为口吻参考。没有专用上传服务器或遥测。

生成结果会进入 DSH 会话记录，并缓存到本机 JSONL；默认不在这份 JSONL 中额外记录你发出的原文。DSH 自己的聊天记录仍按宿主规则保存。详见 [隐私说明](PRIVACY.md)。

## 高级配置

本地安装目录的 `cordis.patch.yml` 包含默认配置，修改后重启。升级可能覆盖包内配置，请保留自己的配置副本。

| 字段 | 默认 | 范围/含义 |
| --- | --- | --- |
| provider | deepseek-official | DSH 中已配置的服务 ID |
| model | deepseek-flash | 该服务可用模型 ID |
| count | 3 | 1–3，最多提供几条候选 |
| maxInputChars | 6000 | 500–24000，近期对话字符上限；不包含口吻样例 |
| timeoutMs | 60000 | 1000–180000，每次模型调用超时 |
| logSent | false | 是否额外在本地日志记录实际发送原文 |
| dbPath | 空 | 默认 `$DSH_HOME/prompt-copilot/db.jsonl`，无 DSH_HOME 时为 `~/.dsh/prompt-copilot/db.jsonl` |

## 卸载与开发

插件页移除即可停止运行；数据不会自动删除。若需要清除，退出 DSH 后删除对应 JSONL，并通过浏览器/DSH 支持的存储管理删除 `pc.v1.*`；不要为此直接删除全部宿主数据。会话里的插件记录随宿主会话保留。

```sh
npm test
npm run check
npm pack
```

无需构建、无安装脚本、无第三方运行时依赖。Session SDK 从运行中的 Desktop 分发包解析；此版本依赖宿主槽位和 DOM 属性，DSH 升级可能需要适配。

本版本是可分发 Beta，不等于跨平台稳定版。源目录含测试；安装包只含必要代码、文档和图标。

验收范围与结果见 [TESTING.md](TESTING.md)。
