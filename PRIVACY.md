# 数据与隐私 / Privacy

- 模型服务：近期用户/AI文本和用户口吻样例发送给 DSH 配置的 provider/model。不是完全离线，也不是不离开本机。
- 会话：插件生成的摘要和候选作为 ignorable 插件事件写入 DSH 会话。
- 缓存：生成结果写到 `$DSH_HOME/prompt-copilot/db.jsonl`（未设置则 `~/.dsh/prompt-copilot/db.jsonl`）。可能包含对话里的私人信息；它是明文、追加保存，无自动过期。所有使用这个默认路径的 profile 共用缓存文件。可指定独立 dbPath。
- 原文日志：`logSent` 默认 false；显式开启后额外记录发送原文。DSH 自己的聊天记录不受这个开关控制。
- 浏览器：编辑摘要和浮窗位置保存在 `pc.v1.*` localStorage；不会由插件同步到其他设备。
- 无内置分析、广告、作者服务器或自动发送功能。包不包含开发者的聊天记录、API密钥或账号配置。
- 删除插件不会删除这些数据。先退出 DSH，再按 README 中的范围处理缓存；宿主会话数据按 DSH 功能管理。
- 提交问题时只附脱敏的版本、错误和复现步骤，不要上传完整聊天日志、令牌或私人截图。

Recent conversation is sent to your configured model provider. Generated results are stored in DSH sessions and a plaintext local cache. Separate raw-user-message logging is opt-in. Summary edits stay in localStorage. Uninstalling does not erase these records.

手动换一组会再次向已配置的模型服务发送近期对话及最多 30 条旧候选，以减少重复。候选历史保存在会话记录中；刷新命令也会产生宿主命令记录。

输入纠错会在发送消息前，把当前草稿（最多 12000 字符）交给插件配置的模型服务检查。命令使用 recordInput:false，不记录完整草稿参数；宿主仍会保存命令完成记录，其中包含返回的局部原文、修改及原因。插件不将纠错结果另存到 JSONL 缓存。关闭单次提示不等于禁用后续检查。

深度检查仅由双次 Shift+Tab 主动触发：除草稿外，还会发送近期最多8条用户/AI消息（按 maxInputChars 截取）给已配置模型。修改结果和理由仍保存在宿主命令记录。

查看缺少标题或疑似截断标题的旧候选时，会把当前组最多3条候选发送给配置模型补生成短标题；同组在当前页面生命周期内不重复请求，返回标题写入宿主命令记录并在页面内存缓存。

性能缓存：最多20条检查结果及其精确输入键在宿主内存中临时保留，有效期60秒；插件卸载/宿主退出清空，不新增磁盘草稿日志。候选逐条显示、摘要补齐会产生同一组的多条插件状态事件。额外记录各阶段耗时（generation-timing），不附带新的输入或输出正文。

无候选时按Tab会主动调用模型；在已停止且没有AI文字回复的会话，使用已有真实用户文字上下文生成建议，不恢复原会话任务。空会话只有状态提示，不调用模型。

主会话运行时仅手动触发辅助模型请求；预测和深度改写使用触发时已有用户/AI正文快照，不读取内部思考。仍走独立模型请求及现有命令/插件日志，不发送新的主对话消息。主动调用会额外消耗token，可能共享模型服务限额。
