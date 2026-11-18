# DeepSeek Harness × Grok Bot 对标分析

> **本文位置**：对标分析三部曲之二。之一为 [01-grok-bot-research.md](01-grok-bot-research.md)（Grok Bot 公开信息调研，11 个维度）；之三为 [03-excluded-cloud-pc-requirements.md](03-excluded-cloud-pc-requirements.md)（排除云电脑后的可执行需求列表）。
> **事实基线**：2026-11-17。Grok Bot 侧取 v1.0.1（2026-11-11）；DSH 侧取本机实装版本（Electron 安装态 + 解包副本 `C:\Temp\dsh-asar-extract\dsh`）。
> **取证口径**：凡标 **【实】** 者为本机可复核证据（源码行号、README、配置文件）；标 **【研】** 者为 01 文档中的调研结论；标 **【判】** 者为本文的分析判断，不含事实断言。

---

## 0. 判定口径

### 0.1 一条前置结论

**DSH 与 Grok Bot 是同一个问题的两种相反解法。**

| 维度 | Grok Bot | DeepSeek Harness |
|---|---|---|
| 执行发生在哪 | 厂商托管的云电脑（Firecracker microVM） | 用户本机的桌面与文件系统（CUA + bash/pwsh） |
| 边界的默认值 | 默认放手，靠 Auto Review 事后拦 | 默认收紧，靠权限预设逐步放开 |
| 产品的主对象 | Bot 名册（会话是一次性的） | 会话（Agent 是运行时的临时形态） |
| 协调方式 | Bot 之间发消息、群聊 | 父 Agent 派生 subagent、任务板 |
| 模型 | 不可选、不可见 | 可选、可见、可分层（pi-ai provider 表） |
| 卖点 | "把活交出去" | "把活干对，且你能看见每一层" |

**【判】** 因此正确对标的姿势不是"复刻 Grok Bot"，而是**借它的产品化外壳（对象模型 / 状态可见性 / 固化路径 / 触发面），补它缺的验证面（审批收件箱 / 规则可检查 / 审计 / dry run）**。凡是把 DSH 往"更放手"的方向推的抄法，都会同时丢掉 DSH 唯一的差异化。

### 0.2 复用等级

| 代号 | 含义 | 判定依据 |
|---|---|---|
| ✅ | **直接可用**：机制已存在于本机实装包，组合即可 | 找到明确 API/槽位/服务 |
| 🔶 | **改造可用**：机制存在但语义不同，需适配层 | 存在同构物，需写胶水 |
| 🛠 | **需新建**：本机 338 个 @deepseek-ai 包中无对应物 | 全包清单检索无命中 |
| 🚫 | **显式不做**：属"云电脑"范围，或与 DSH 形态/平台约束冲突 | 见 03 文档的范围界定 |

### 0.3 一份可复用的 DSH 事实底座

本文所有"DSH 落点"论证依赖以下五条硬事实，均来自本机取证：

1. **扩展的唯一正规入口是装 bundle 包**：`package.json` 里声明 `dsh.bundle.patch`（Host 半）与 `dsh.client`（浏览器半），由 `plugin_manager.install_bundle` 装入 profile。**禁止手改 profile 的 package.json / cordis.patch.yml**。【实】
2. **patch 语义是整行替换，不做深合并**；`inject` 列表是替换而非拼接；行顺序无加载语义（activation 由 service 可用性驱动）。【实】
3. **前端插件装载**：`dsh.client:{platform:'web', inject?, immediately?}` + `exports['./client']`，client.js 必须是 lazy-CJS factory，路由 `/plugins/??<pkg>/client.js&rev=<rev>`，启动 URL ≤ 3 KiB。**改完必须重新构建，无源码直服回退**。【实】
4. **无 URL 路由 / 无深链 / 不能 iframe 挂页 / 不能换 app root**。全仓 grep `pushState`/`location.pathname`/`useRoute` = 0 命中；官方原文 "A separate HTML file, iframe, or replacement app root is not a mounted page"。【实】
5. **授权类动作不能给工具**：批准工具调用、回答提问、放宽策略只能用户做（`references/user-actions.md`）。【实】

---

## 1. 能力清单

按七个能力域组织。每行给出：Grok Bot 的做法 → DSH 现有对应（含证据）→ 判定 → 差距说明。

### 1.1 A 域｜主体与组织（"谁来做"）

| # | 能力 | Grok Bot 做法【研】 | DSH 现有对应【实】 | 判定 | 差距 |
|---|---|---|---|---|---|
| A1 | **具名执行体**（名字/头像/职责/描述） | Bot 是一等对象，有 shape+color 头像、title、description，侧栏常驻 | `dsh-agent-preset` 的 `{id,name,description,order,plugins}` + `dsh-persona` 的 prefix/suffix | 🔶 | preset 是**静态配方**（"这类 Agent 长什么样"），不是**实例**（"这个 Agent 是谁"）。缺实例层：实例 id、头像、生成时间、名下历史 |
| A2 | **Bot 名册作为主界面** | 侧栏=Bot 列表，会话是一次性的，"你几乎不会回看最近五条以外的会话" | `sidebar.panellist` list 槽（全局面板入口）+ `main` keyed 槽（整页面板）+ `ctx.layout.selectPanel` | 🔶 | 机制齐全，但主对象仍是会话。做"名册"必须新开一个 `main` 面板，并把侧栏会话列表降级 |
| A3 | **Bot 级记忆边界**（Tools/Skills 账号级，Memory/Routines 属于 Bot） | 官方设计稿明确这条边界，理由给的是信息质量 | 核心 338 包中**无第一方记忆子系统**；记忆由可选插件 hindsight 提供（仓库级 bank + profile/log/note 三层） | 🛠 | DSH 的记忆是"仓库级"而非"Agent 级"。要做 Bot 记忆，得先有一个实例 id 作为记忆分区键（依赖 A1） |
| A4 | **六态状态**（idle/thinking/working/waiting/blocked/done），头像即状态 | 头像动效 + 侧栏状态点；设计稿承认"动效不可证伪" | `dsh-session-projection`（纯函数派生，快照稳定）+ 生命周期事件 `agent/created`、`agent/pre-step`、`agent/turn-stopping`、`turn/end` | 🛠 | 有原料无装配：没有第一方的"Agent 状态"投影，也没有把状态投到侧栏的槽位 |
| A5 | **群聊协作**（2–6 Bot，@ 指定，Bot 间私信） | 群聊是独立会话类型；沉默是一等公民；每条 Bot 回复都计用量 | `dsh-agent-team` + `dsh-tool-agent-team`（共享任务板 task-*）+ `dsh-subagent`（树形委派）+ `send_message`/`wait_agent` | 🔶 | 语义不同：**任务板 ≠ 消息流**。DSH 没有"多 Agent 同处一个对话里轮流发言"的运行时；也没有群聊级审批归属 |
| A6 | **共享 Bot / 模板市场** | 按团队共享，会话各自私有；Bot 可导出模板生成公开链接 | `dsh-plugin-market` + `dsh-plugin-market-index` + `dsh-creation-recommendations`（Agent 自造插件闭环：`propose_action` → 生成 → 校验 → `installBundle`） | 🔶 | DSH 的"可分享单元"是**插件包**，比 Grok Bot 的"Bot 模板"更彻底（模板不含电脑与登录）。反向缺：模板里带不带记忆/routine 没有定义 |
| A7 | **主 Bot（primary）主动来找你** | 星标主 Bot 会主动跟进并协调其他 Bot | `dsh-goal` + `followup(source:…)` + `schedule` 可主动投递；无"全局主 Agent"概念 | 🛠 | 缺"常驻协调者"这一角色。技术上可用 schedule + goal 拼出近似物，但语义上 DSH 的 Agent 是随会话生灭的 |

### 1.2 B 域｜执行（"在哪做、拿什么做"）

| # | 能力 | Grok Bot 做法【研】 | DSH 现有对应【实】 | 判定 | 差距 |
|---|---|---|---|---|---|
| B1 | **厂商托管云电脑** | 每用户一台 Firecracker microVM，持久化，共享文件系统 + per-agent 桌面 | **无**（DSH 就在用户本机跑） | 🚫 | 显式排除，见 03 文档 |
| B2 | **本机 GUI 操作** | 云电脑上跑浏览器/桌面应用；屏幕观察与接管 | `dsh-cua`（应用/窗口对象 API：`cua.getApp/listApps/findApps`、`app.getAccessibilityTree()`、`window.getScreenshot()`、坐标与键盘输入、`click(holdMs)`）+ `dsh-computer-use`（**一次只能注册一个 provider**）+ macOS 原生 provider | ✅ | 能力面已存在且更"对象化"（AX 树 + 显式窗口 + 坐标映射）。缺的是**产品化外壳**：没有"看它在干什么"的常驻面板，也没有接管交互 |
| B3 | **应用级授权**（不是工具级） | 首次操作某应用时弹授权卡，风险提示标签 | `dsh-cua`：授权发生在启动/观察/截图/输入**之前**；**会话许可按"对话 + 应用身份"持久化**，重启后仍可复用，其他对话需单独授权；撤销会关闭受影响的 Agent 连接 | ✅ | 这是 DSH 少见的**比 Grok Bot 更细**的地方（Grok Bot 只有"本地执行 三档"，DSH 细到单应用、单会话）。缺 UI 汇总面（详情页已有"始终允许/不允许"列表可复用） |
| B4 | **工具面** | 模型可见工具集 | `ctx.tools.register` + `ctx.tools.guard` + `tools/pre-execute`；**同一工具在 host 平面是"服务"、在 preset 里是"暴露给模型的行"**（web 层 disabled 了 24 个 tool 行，注释 "Disabling rather than deleting is deliberate"） | ✅ | DSH 的分层（服务/preset 暴露）比 Grok Bot 的"工具即能力"更可控 |
| B5 | **连接器（OAuth 托管）** | Gmail/Slack/Notion/Linear/Salesforce… OAuth token 存 Cursor 后端，Bot 只调工具 | `dsh-mcp-client` / `dsh-mcp-manager` / `dsh-mcp-resources`，工具名 `mcp__<server>__<tool>`，**默认不启用任何 server**；`plugin.json` 可声明 `mcpServers` | 🔶 | DSH 有 MCP 运行时，但**没有托管 OAuth 的连接器目录**（用户得自己在 `settings.yaml` 里配 server 与密钥）。这是"能力有、获得成本高"的典型 |
| B6 | **浏览器自动化** | 云电脑里的 Chrome，像人一样点 | `dsh-experimental-browser-use-stagehand-native`：`stagehand_act/_extract/_navigate/_observe/_screenshot/_tabs` + `dsh-client-ui-sidebar-browser`（右侧栏 browser tab，支持多实例） | 🔶 | 有 stagehand 版；与 CUA 是两条并行路径（DOM 级 vs 像素级），需要产品化地二选一或分层 |
| B7 | **本机执行授权（三档）** | Ask every time / Always allow / Never allow，按机器登记 | `dsh-permission-presets`：预设把 `sandbox` 与 `approval` 捆绑；`/permission` 切换；`custom` 与 `auto` 为保留名 | ✅ | DSH 的表达力更强（sandbox 分 read-only/workspace-write/danger-full-access 三档 + approval ask/never）。缺"按设备"的维度（DSH 只有一台本机，天然无此需求） |

### 1.3 C 域｜复用（"怎么把经验固化下来"）

| # | 能力 | Grok Bot 做法【研】 | DSH 现有对应【实】 | 判定 | 差距 |
|---|---|---|---|---|---|
| C1 | **Skill**（6 要素：触发/输入与权限/步骤/验证/交付/审批点） | 账号级共享库；私人技能入口在 Connect apps → Private skills | `dsh-skill` + `dsh-skill-filesystem` + `dsh-skill-office` + `dsh-skill-badge`；六级优先序：项目 `.dsh/skills` < `.agents/skills` < `customSkillDirs(300)` < `~/.dsh/skills` < `~/.agents/skills` < bundled(600) | ✅ | DSH 的 Skill 作用域分级比 Grok Bot 更细（项目级/用户级/内置）。缺：Grok Bot 的"Skill 里带审批点"这一约定——DSH 的 skill 是纯提示词，不携带权限声明 |
| C2 | **Teach a task**（录屏 ≤10 分钟 → 草稿 skill） | 仅一对一 + 电脑画面打开时可用；生成草稿；官方标 gradual rollout | **无对应机制**（无用户操作录制、无"演示→技能"编译链） | 🛠 | 成本高（需输入录制 + 步骤抽象 + 人工补决策规则）。但 DSH 有一个 Grok Bot 没有的替代路径：**Agent 自己写 skill 文件**（`skill-creator` 类技能已在本机技能库里） |
| C3 | **模板导出/导入** | Bot → 模板 → 公开链接 → 别人 Add | bundle 包即模板：`plugin_manager install_bundle({target:'<绝对路径>'})`；本机已有 `@local/dsh-rigorous-preset`（纯 YAML preset 范本）可作范式 | ✅ | DSH 的分享单元更干净（不含记忆与凭据）。反向缺：模板里带不带 routines/记忆没有规范 |

### 1.4 D 域｜触发（"什么时候做"）

| # | 能力 | Grok Bot 做法【研】 | DSH 现有对应【实】 | 判定 | 差距 |
|---|---|---|---|---|---|
| D1 | **定时** | 5 字段 cron（用户本地时区），≥5 分钟间隔，支持 `@every 5m`、`CRON_TZ=` 前缀；官方明确反对 `*/30` 这类从 :00 起算的写法 | `dsh-schedule`：`timing.kind ∈ {after, at, every, daily, weekly, cron, rrule}`；三种投递目标 `session / new_once / new`；`deliveryHistoryDays:30`、`deliveryHistoryRecords:200`、`newSessionIntervalSeconds:60`；重启后重复任务只补最近一次 | ✅ | **DSH 明显更强**：rrule + 显式时区 + 三种目标 + 投递历史 + UI（`dsh-client-ui-schedule` 已有 `scheduleTask` 右侧栏 tab 类型） |
| D2 | **事件触发** | Slack（@/关键词/表情/新消息）、GitHub PR、Bot 专属邮箱、Webhook、Linear/Sentry/PagerDuty/MS Teams | 无通用事件总线；但有 `ctx.webServer.register`（可自建 webhook 入口，**无服务器级认证，绑非回环即公开**）+ `dsh-experimental-forge-github`（PR 相关） | 🛠 | 缺"触发源 → routine"的统一抽象。DSH 的 `followup({source:{kind:'schedule'}})` 是唯一带 source 的投递通道，可作为事件源的范式复制 |
| D3 | **Routine 归属 Bot** | Routine 属于单个 Bot；≤50/ Bot；间隔 ≥5 分钟；删 Bot 连带删 Routine | schedule 是 **host 级**，任务自带 `target` 指向会话 | 🔶 | 需要加一层"任务的所属 Agent 实例"字段，才能做出"这个 Bot 的 routines"面板 |
| D4 | **主动触发（不是等你问）** | primary Bot 会主动来找你、协调其他 Bot | `dsh-goal` + goal-round-driver 能做长跑；schedule 可定时投递；但**没有"Agent 主动发起会话"的一等通道** | 🛠 | 待设计：主动投递的消息如何标注来源、如何不打扰（见 F 域通知） |

### 1.5 E 域｜审批与安全（Grok Bot 被骂最多的部分，也是 DSH 最大机会）

| # | 能力 | Grok Bot 做法【研】 | DSH 现有对应【实】 | 判定 | 差距 |
|---|---|---|---|---|---|
| E1 | **逐动作自动审查** | Auto Review 检查每个动作（跑命令、用连接应用、用电脑），**只有当动作匹配用户消息里真正要求的内容才放行；来自邮件/网页的文本不算用户请求** | `dsh-experimental-auto-review`：每次原生或 PTC inner 工具调用前由当前 agent 的 provider+模型评估；三档 low（项目内 + 精确清理本会话创建的对象 → 直接允许）/ medium（不可逆删除、生产操作、外部写入、安全控制变更 → 需用户或直接父级明确授权）/ high（跨信任边界泄露 → 始终拒绝）；效果不明确 → 拒绝 | 🔶 | **机制同构且 DSH 更严**（low/medium/high 三档 + 只认 `source.kind:'user'`）。差距在①**没有"这道题答过了就不再问"的持久规则库**（Grok Bot 的 Always allow → Custom Rules）②**PTC 的直接 Node 效果不在审查范围内**（DSH 自述）③被拒后模型可能仍以 `final.reason: completed` 结束，监督者需自查 |
| E2 | **审批收件箱（一个地方）** | 社区最强烈诉求；Grok Bot **至今没做**（审批卡落在各会话里，用户盯线程时看不到主会话的卡） | 无。`dsh-client-ui-approval` 是 **composer takeover**（占住输入框），一次只能处理一个会话的一个请求；`dsh-client-ui-account-notifications` 是账号级纯文本通知、轮询 600 s、宽 ≤280 px、**不进入模型上下文** | 🛠 | **这是本文判定的第一优先级新建项**。原料齐全：审批请求已走 `approval/request` waterfall，只需一个聚合面板 + 跨会话待办索引 |
| E3 | **规则可检查、可编辑、本机化** | Auto-review 规则最多 **20 条 Allow + 20 条 Ask first**，每条 ≤1000 字符；冲突时 **Ask first 优先**；Allow 满 20 条时新 Always allow 挤掉最旧一条并告知；个人规则存**账号**、跨设备同步；管理员可强制时开关锁定为 "Required by your admin" | 规则形态是**权限预设**（`dsh-permission-presets` 把 `sandbox` 与 `approval` 捆绑）+ `ctx.tools.guard`（同步单调拒绝）+ `tools/pre-execute` 钩子；`permission.defaultPreset` 只影响未来会话 | 🔶 | 有"策略"没有"规则表"。缺：动作模式的持久允许清单、规则冲突语义（DSH 没有 Ask-first 优先的显式规定）、规则条数上限与淘汰告知、管理员锁定态（DSH 有 preset 强制但无 UI 锁定标识） |
| E4 | **审批超时语义** | 聊天内发起的卡片**不超时**；routine / 外部消息 / 后台工作引发的卡片 **30 分钟后过期**（社区教程写 10 分钟，官方文档为准）；发新消息关闭该会话所有开着卡片 | `dsh-user-approval`：`request(req)` 带可选中止信号，**要求处于未结束的轮次中**；空闲/轮次间调用会在审计前抛异常。`policy:'never'` 在交互分发前**确定性拒绝** | 🔶 | DSH 的模型是"请求挂在轮次上"（轮次结束 = 问题消失），Grok Bot 的模型是"卡片有独立生命周期"（可跨轮次存活、可超时）。做收件箱必须先把审批请求从"轮次附属"改成"独立待办对象" |
| E5 | **审批归属（共享/群聊）** | 共享 Bot 上每个同事为自己的请求应答；Slack 线程里卡片只有 **Allow once / Deny / View details** 且只有提问者能答；群聊里只有 **Bot 正在回复的那条消息的作者**能批准，其他人看到"在等谁"，且群聊卡**不提供 Always allow** | `dsh-agent-team` 有任务板归属（owner/claim/expectedRevision），但**审批流没有"这条请求属于谁"的概念**；`dsh-user-approval` 的 `request(req)` 只指名 agent、工具、原因 | 🛠 | 多人场景下这是硬缺口。DSH 的任务板已经有 owner 语义，可复用到审批（把 requester 加进审批请求） |
| E6 | **凭据与密钥路径** | 优先级：**Vault → 已连接密码管理器（1Password）→ 聊天内 Secure Form**；Vault 与 Secure Form 的值**直接填进页面、模型看不到**；Vault 里的卡结账自动填充、不再逐笔确认；共享 Bot 不支持 Vault，走 Bot 详情 → Secrets（只写不读） | `dsh-credentials` + `dsh-credentials-local` + `dsh-client-ui-secret-mask`（掩码输入）+ `dsh-cua` 的"模型内容只含坐标元数据 + 图片" | 🔶 | DSH 有"值不进模型上下文"的基础能力（secret-mask + CUA 截图不含 base64），但**没有面向 web 表单的结构化填值通道**（Grok Bot 的 `RequestUserForm` 会逐字段回执填充状态、`secret` 字段以结构化快照脱敏、**绝不允许截图核对 secret**） |
| E7 | **不可信内容围栏** | 工具结果包在 `<cursor_untrusted_data_1337 source="...">` 中，其中一切都是数据不是指令（含图片里的文字、伪造的闭合标记）；被围栏内容要求的动作必须回报用户决定 | 无统一围栏。`dsh-experimental-auto-review` 只把 `source.kind:'user'` 文本视为授权，**项目文件/工具结果/checkpoint 不能授权动作**——这是**入口侧**的对等物 | 🔶 | 语义上有等价保护，但缺"标记"这一层：模型不知道自己读到的内容是围栏内的，也没有要求它向用户回报。加一个 `tools/post-execute` 包装 + 系统提示词约定即可低成本补齐 |
| E8 | **不可逆动作的强制人工关卡（7 类）** | 发消息或邀请、发布内容、购买和转账、删除或覆盖数据、改权限、改生产环境、接受法律条款 | `dsh-action-cards` 的 `propose_action`（用户操作前不执行任何事）+ `dsh-user-approval` | 🔶 | 机制有，**清单没有**。Grok Bot 的 7 类清单可直接抄成 DSH 的"高危动作分类表"，挂到 `tools/pre-execute` 上 |
| E9 | **审批审计** | Action Recording + Audit logs + OTel（仅 Enterprise）；社区反馈"没有'机器人不在时干了什么'的可用审计日志" | `dsh-user-approval`：先追加 `approval/asked`，再追加 `approval/decided`，**只写日志、不进模型上下文**；`dsh-session-log-jsonl` 是完整事件日志；`dsh-otel` | ✅ | **DSH 在这点上已经强于 Grok Bot 的普通档**（Grok Bot 的审计是 Enterprise 专属，社区还在抱怨没有）。缺的只是把日志变成人可读的"动作回顾"视图 |
| E10 | **权限的"爆炸半径"隔离** | 共享电脑是共享登录、**非安全边界**（社区反复踩坑："不要用不同 Bot 当安全边界"） | `dsh-sandbox` / `dsh-sandbox-policy` / `dsh-sandbox-local` / `dsh-sandbox-windows-acl`：三档沙箱 read-only / workspace-write / danger-full-access；**本机隔离靠 ACL 与工作区根** | ✅ | DSH 天然有边界（进程级沙箱 + 工作区根），Grok Bot 没有。这是 DSH 的结构性优势，应在 UI 上显性表达而不是藏进设置 |

### 1.6 F 域｜可见性与反馈（"我怎么知道它在干什么、干成了没有"）

| # | 能力 | Grok Bot 做法【研】 | DSH 现有对应【实】 | 判定 | 差距 |
|---|---|---|---|---|---|
| F1 | **Agent 状态可见** | 六态（idle/thinking/working/waiting/blocked/done），侧栏 Needs attention / Unread activity / Working 三种行状态；打开即已读；可手动标记已读/未读 | `dsh-session-projection`（纯函数派生、快照稳定）+ 生命周期事件 + `dsh-client-ui-sidebar` 的 `.session.row.{leading,trailing,hover}` 槽 | 🔶 | 有原料、无装配。**社区对 Grok Bot 的核心抱怨正是"侧栏状态说谎"（显示 working 实际在等审批）**——DSH 若做这件事，必须把"等审批"做成独立状态而非 working 的子态 |
| F2 | **执行过程可见（异质时间线）** | transcript = 对话 + 系统事件 + 可交互对象 + 可视化；官方："**transcript 不再是聊天记录，而是审计日志 + 控制面板 + 对话的合体**" | `conversation.view` list 槽：ChatView（id=`chat`）/ TrajectoryView（id=`trajectory`）/ 插件 tab；`conversation.chat.node` keyed 槽位：user / steering / context / turn-trigger / system-prompt / assistant-step / tool-call / command / turn-tail；`tool.call.toolview` 可按工具名注册专用视图 | ✅ | **DSH 明显更强**：Grok Bot 主动**拒绝展示执行细节**（官方设计稿原话："一旦人们能看到一步，他们就想看到其余所有步"），DSH 直接给了 trajectory 视图 + 可插拔工具视图。应保留不要抄回去 |
| F3 | **电脑画面三级可见度** | Status（标题栏图标变紫）→ Preview（固定侧面板）→ Takeover（全屏接管） | `dsh-client-ui-sidebar-right`：`ctx.sidebarRightTabs.register({id, kind, ...})` 支持停靠/分屏/浮动/keepMounted/刷新恢复；已发布 kind 含 files / browser / subagentchat / terminal / plan / scheduleTask / changes-review / guide | 🔶 | 右侧栏就是 Preview 那一级。缺：①"Status"级的轻量状态指示②"Takeover"级（全屏路由被禁，只能用 `main` 面板或 overlay 模拟）③CUA 截图流的常驻 tab 没有实现 |
| F4 | **per-Agent 详情面板** | 点聊天标题里的 agent 名或 Cmd+Shift+I；内容顺序 = 该 agent 电脑实时预览（点击全屏）→ Routines 列表 → Channels → 群聊 Members；X 旁齿轮进 per-agent 设置 | `sidebarRightTabs.register` + `ctx.layout`；`dsh-client-ui-subagent` 已有子代理查看 | 🔶 | 机制对得上（见 2.2），但**没有"这个 Agent 的例行任务 / 它的记忆 / 它的技能"三块内容**可填 |
| F5 | **通知与打扰控制** | per-Bot 通知开关；在用桌面时走桌面而非手机；焦点窗口只对该 Bot 静默；Bot 需要输入时约 3 分钟后才推手机 | `dsh-client-ui-account-notifications`：仅账号级纯文本、轮询 600 s、无模型体验；桌面端无系统托盘/无原生通知集成 | 🛠 | DSH 的通知是"服务端公告"，不是"Agent 要你干活"。要做 F5 需新建：动作级通知 + 打扰分级（同理 F1 依赖同一份状态源） |
| F6 | **应用内错误可见** | 输入框上方的 Notifications 区，可单条 dismiss 或清空，部分带 Copy request ID | 无统一错误区；错误分散在工具结果、会话日志、控制台 | 🛠 | 低成本高收益项：一个 `conversation.input.overlay` 之上的错误条 |
| F7 | **产品变更告知** | 官方在系统提示词里内置 `recent-changes.md` 让 agent 如实转述变更（不许猜原因），示例条目带日期 | 无对应通道；DSH 的变更靠 release notes / 插件市场描述 | 🛠 | 优先级低，但"Agent 能解释自己身上的按钮变了"是很讨巧的信任设计 |
| F8 | **结果以卡片内联** | 邮件/Slack 草稿、文件、图表、表单都在 transcript 里以卡片呈现，值不回传模型 | `dsh-action-cards`（`propose_action`，一轮一卡、可替换、可 reconcile）+ `dsh-client-ui-action-cards` + `dsh-tool-present` / `dsh-deliverable-file-references` | ✅ | DSH 的卡片机制**比 Grok Bot 更完整**（有 zod 校验、有 settled/refused/unconfirmed 收口、有 reconcile）。反向差距：DSH 卡片只允许"提议某个已注册动作"，**没有"自由表单收集值"的卡片**（对应 Grok Bot 的 Secure Form） |

| F9 | **产物归档（Pages / Library）** | Library 汇集 pages / files / links，按 **Today / This week / Older** 分组；Pages 支持多人共同编辑、Bot 代为保持更新 | 产物散在三处：工作区文件（要翻目录）、`dsh-attachment`（绑会话）、`dsh-tool-present` / `dsh-deliverable-file-references`（仅当轮有效） | 🔶 | **没有"最近交付物"的统一入口**。投影原料齐全（session log 的 present 事件 + 附件事件 + 文件 mtime），做成 tab 即可；Pages 本体（在线协同文档）属托管服务，**不做** |

### 1.7 G 域｜设置与配置

| # | 能力 | Grok Bot 做法【研】 | DSH 现有对应【实】 | 判定 | 差距 |
|---|---|---|---|---|---|
| G1 | **设置分区** | 五个 tab：General / Computer / Vault / Usage & Billing / Updates（后两个仅账号启用时出现） | `settings.section` list 槽，内置五区：**account(-10) / general(0) / models(10) / plugins(15) / agent-presets(20)** | ✅ | **结构对得上，一区对一区**：General↔general、Computer↔（无）、Vault↔secret-mask（不成区）、Usage↔account、Updates↔（无）。缺口在"Computer 区"与"Updates 区" |
| G2 | **设置入口** | 左下角侧栏账号按钮 / Cmd+, / 命令面板 "Open settings"；**无齿轮图标、无 macOS Preferences 菜单项** | `dsh-client-ui-settings` 自带入口 + `dsh-client-ui-commands`（`ctx.commands.register`）+ `sidebar.settings` 槽 | ✅ | 一致 |
| G3 | **无模型选择器** | 官方明确"Grok Bot manages model selection, so there is no model picker" | `dsh-client-ui-model-selection` + `conversation.input.model` 槽 + `settings/models` 区 + pi-ai provider 表（本机已配 13+ 模型） | ✅ | **反向优势**：DSH 的模型可见可选是核心差异化（对应 Grok Bot "看不到是哪个模型"的 FAQ 抱怨），不要为了像 Grok Bot 而隐藏 |
| G4 | **per-Agent 设置** | 点 Bot 名 → 齿轮 → 头像/名字/title/description/per-assistant 通知 | 无（DSH 没有 Agent 实例层） | 🛠 | 依赖 A1。若做实例层，这个页面是自然产物 |
| G5 | **生命周期操作** | 删除只能在侧栏右键该行（永久删 agent + transcript，有确认）；**无归档/隐藏**；Bot's computer 另有 Update / Reset | `dsh-session-*` 有归档概念；插件卸载走 `dsh-plugin-manager`；**无"删除 Agent"** | 🛠 | DSH 应做"归档优先"而非"永久删除"——这正是 Grok Bot 被吐槽的点 |
| G6 | **快捷键** | Cmd/Ctrl+D 语音输入、Cmd+Shift+I 详情面板、Cmd+Shift+, Bot settings、Cmd+, 设置 | `dsh-client-ui-shortcuts` 有统一快捷键注册与展示 | ✅ | 机制有；需要为新增面板登记快捷键 |
| G7 | **主题与视觉** | Follow System / Light / Dark；**Accent 用每个 Bot 自己的颜色或黑色** | `ctx.theme.register({id, colorScheme, tokens, icons})`；token：`--dsw-alias-bg-base` / `bg-layer-1` / `bg-layer-2` / `bg-overlay` / `border-l1` / `border-l2` / `brand-primary` / `label-primary` / `label-secondary` / `state-error-primary`；内置仅 light/dark | 🔶 | 主题可注册但**没有"per-Agent 强调色"的语义**。Grok Bot 让每个 Bot 有自己颜色的做法，DSH 可以用"persona 声明 accent token"实现 |

---

## 2. 界面与布局参考

### 2.1 先立一条原则：抄什么、不抄什么

**【判】** Grok Bot 的界面里有三样东西值得整套搬，三样必须反着做。

| 值得搬 | 理由 | DSH 落点 |
|---|---|---|
| **Bot 名册作为主对象** | 会话是一次性的，名册改变的是"责任的归属方式"（官方设计稿原话） | 新 `main` 面板 + `sidebar.panellist` 入口 |
| **三级可见度 Status → Preview → Takeover** | 官方自承"电脑做得越显眼，产品越鼓励用户去监督"；三级给了用户自己选"要不要盯" | 右侧栏 tab（Preview）+ `main` 面板（Takeover）+ 侧栏行状态点（Status） |
| **状态头像 + 六态** | 解决"看不见它在干嘛"的焦虑，且不暴露执行细节 | 会话行的 leading 槽 + `dsh-session-projection` |

| 必须反着做 | Grok Bot 的做法 | 为什么在 DSH 不能抄 |
|---|---|---|
| **拒绝展示执行细节** | 只用头像动效 + 悬停一句话 | DSH 的用户是开发者，trajectory 视图是核心资产；藏起来等于自废武功 |
| **审批面 = 一条提示** | 审批卡落在各会话 composer 里，社区骂了三个月没改 | DSH 已有 composer takeover 的同款缺陷，应直接补收件箱而不是复制 |
| **共享电脑 = 权限边界** | 用"不同 Bot"暗示隔离，实际共享登录 | DSH 有真沙箱，不该学这套"用组织方式假装安全"的做法 |

### 2.2 布局映射表（Grok Bot → DSH 槽位）

| Grok Bot 区域 | 内容 | DSH 对应槽位【实】 | 改造量 |
|---|---|---|---|
| 左侧栏 nav | Bot 名册 + 分组 + 星标主 Bot + 搜索 | `sidebar.panellist`（list，行 + More 菜单） | 🔶 需新面板 entry |
| 左侧栏 session 列表 | 会话/工作区 | `sidebar.workspaces`（含 `.directoryFlow` / `.session.row.{leading,trailing,hover}`） | ✅ 已有，加状态点即可 |
| 左侧栏底部 | 连接应用入口 + 账号按钮 | `sidebar.footer.action` + `sidebar.settings` | ✅ 已有 |
| 中间聊天区 | transcript + 输入框 | `main` → `conversation.view` → `conversation.chat.node` | ✅ 已有且更强 |
| 输入框上方通知区 | 应用内错误 | `conversation.input.overlay` 之上新建 | 🛠 小 |
| 输入框下排 | 附件/权限/计划/模型/活动 | `conversation.input.{attachments,permission,plan,model,activity}` | ✅ **完全对应** |
| per-agent 详情面板 | 电脑预览 + Routines + Channels + Members | `sidebarRightTabs.register` + `sidebar.right.pane.tab` | 🔶 需内容三块 |
| Bot settings（齿轮） | 头像/名字/描述/通知 | 无（无实例层） | 🛠 依赖 A1 |
| Settings 五 tab | General/Computer/Vault/Usage/Updates | `settings.section`：account/general/models/plugins/agent-presets | 🔶 加 Computer 类比"执行环境" |
| 命令面板 | Open settings 等 | `dsh-client-ui-commands`（`ctx.commands.register`，name 小写无斜杠，不产生模型消息） | ✅ 已有 |
| 电脑全屏接管 | Takeover | 被禁（无路由 / 不能 iframe / 不能换 app root）→ 只能用 `main` 面板或 `shell.overlay` | 🔶 降级实现 |

### 2.3 DSH 外壳结构（可直接引用的权威事实）

`root [AppFrame]` 是**唯一内置声明、唯一经 Cordis service 渲染的 key**：

```
root [AppFrame]
├─ sidebar   (single, root)
├─ main      (keyed, root)            ← activePanelId ?? 'conversation'
├─ rightbar  (single, root)
├─ shell.leading / shell.bottom (single, root)
└─ shell.overlay (list, root)
```

- 左侧栏：brand row（`sidebar.brand.mark` / `sidebar.brand.name`）→ nav（`sidebar.panellist` 行 + More 菜单 + officialEntry(`'plugin'`|`'cron'`)）→ 中部 `sidebar.workspaces` → 底部 `sidebar.footer.action` + `sidebar.settings`。
- **官方内置全局面板只有 3 个 key**：conversation / schedule / plugin-manager。**加第 4 个正是本文的核心动作**。
- 整页面板最小范式（真实第三方实录 `@suifei/dsh-ai-team/client.js:4994-5011`）：
  `ctx.slots.inject('sidebar.panellist', ()=>ctx.slots.register({name:'sidebar.panellist', id:'<pkg>', order, label:()=>t('panel')}, PanelIcon))` + `ctx.slots.inject('main', ()=>ctx.slots.register({name:'main', key:'<key>'}, Component))` + `ctx.layout.selectPanel(key)`。
- 右侧栏两种地址：`dsh-resource://<type>/…` 与 `sidebar://<kind>`；**布局是 browser-local，无跨设备同步**；`title()` 只在打开时捕获一次，之后不能改名。

### 2.4 视觉风格对照与 DSH 的取舍

| 视觉要素 | Grok Bot【研】 | 可迁移性 | DSH 做法建议【判】 |
|---|---|---|---|
| 头像系统 | 统一基本构造（简单形状 + 有表情的眼睛）+ 受控变体与配饰；试过首字母/emoji/像素画/水彩/粘土/线描/剪影/identicon，最终否掉水彩与粘土（侧栏尺寸细节太多）与纯简化（不可区分） | 高 | 不做位图头像。用**确定性程序化图标**：`hash(agentId)` → 形状 + 强调色 + 眼型三参数，保证可区分且零素材成本 |
| Bot 专属强调色 | 每个 Bot 有自己的 accent | 高 | 主题 token 已有 `brand-primary`；新增 per-agent accent 覆盖变量 |
| 六态动效 | 头像动效传达状态；官方承认"动效不可证伪" | 中 | **不抄动效，抄状态语义**：侧栏行状态点 + 文字标签（waiting/blocked 必须可见），并保证状态与真实情况一致 |
| 电脑画面视觉 | 实时屏幕预览 + 紫色标题栏图标 + 全屏接管 | 中 | 右侧栏 tab 承载截图流（`dsh-client-ui-sidebar-browser` 是现成范本）；全屏用 `main` 面板 |
| 动态壁纸 | Bot 的云电脑壁纸随时间变化，制造"它有自己的时间感" | 低 | 属云电脑范围，**排除** |
| 整体调性 | 极简、去技术化、去仪表盘（官方明确否决仪表盘/任务分派板/显式交接控件） | 中 | **部分反着做**：DSH 用户要仪表盘。"否决仪表盘"是 Grok Bot 对普通用户做减法的结果，不是普适结论 |
| 主题与语言 | Follow System / Light / Dark；20+ 语言含简繁中文 | 高 | DSH 已有多语言基础设施（插件 `locale/*.json`），沿用 |

---

## 3. 功能优先级

### 3.1 打分模型

每个候选能力按四项打分（1–5），加权求总分：

| 维度 | 权重 | 含义 | 打分依据 |
|---|---|---|---|
| **用户价值 V** | ×3 | 对 DSH 现有用户（开发者/重度 Agent 使用者）的实际收益 | 主要看 Grok Bot 社区反馈里"好评共识"与"差评痛点"是否落在该项上 |
| **复用成本 C** | ×2 | DSH 现有机制的覆盖程度（**分越高越省力**） | ✅=5 / 🔶=3 / 🛠=1 |
| **差异化 D** | ×2 | 能不能强化 DSH 相对 Grok Bot 的独有优势 | 高=5（DSH 已强且 Grok 弱）、中=3、低=1（抄了只是追平） |
| **风险 R** | ×1 | **反向计分**：越安全分越高 | 违反五条事实底座=1；需前端新构建=3；纯 Host 半=5 |

总分 = 3V + 2C + 2D + R（满分 5×(3+2+2+1)=40）

### 3.2 优先级清单

| 优先级 | # | 候选能力 | V | C | D | R | 总分 | 一句话理由 |
|---|---|---|---|---|---|---|---|---|
| **P0** | P0-1 | **审批收件箱**（跨会话待办聚合面板） | 5 | 3 | 5 | 3 | **34** | Grok Bot 社区骂了三个月它没做；DSH 已有 `approval/request` waterfall，是要补的一个视图 |
| **P0** | P0-2 | **执行环境面板**（Computer 设置区的 DSH 版：屏幕/沙箱/应用授权三合一） | 5 | 3 | 5 | 3 | **34** | DSH 的 CUA + 沙箱 + 应用授权三套机制都成熟但**散在三处**，聚起来就是 Grok Bot 的 Computer 区且比它更细 |
| **P0** | P0-3 | **动作审计时间线**（把 approval/asked→decided + 工具调用 + 沙箱拒绝合成人可读回顾） | 4 | 5 | 5 | 5 | **37** | 纯 Host 半、日志已有、Grok Bot 的审计是 Enterprise 专属 → **投入最小、差异化最大** |
| **P1** | P1-1 | **Agent 实例层**（名字/图标/accent/职责/名下 routines 与记忆分区） | 5 | 1 | 4 | 3 | **28** | 是名册、per-agent 面板、Bot 级记忆的共同前置；但要从零建 |
| **P1** | P1-2 | **Bot 名册主面板**（第 4 个 `main` key） | 4 | 3 | 3 | 3 | **28** | 机制齐（新 `main` key + `sidebar.panellist` entry），价值取决于 P1-1 是否成立 |
| **P1** | P1-3 | **规则表**（Always allow / Ask first 的持久模式清单，含冲突语义与上限） | 5 | 3 | 4 | 3 | **32** | 直接治"每天都在重复批准同一件事"；DSH 现在只有整档预设，没有模式级规则 |
| **P1** | P1-4 | **不可信内容围栏**（工具结果加标记 + 系统提示词约定回报） | 4 | 3 | 4 | 5 | **31** | 纯 Host 半 + 提示词，成本极低；DSH 已有"只有 user 文本可授权"的等价语义 |
| **P1** | P1-5 | **动作级会话状态**（waiting/blocked 独立成态，不许混进 working） | 4 | 3 | 4 | 3 | **29** | 直击 Grok Bot"侧栏状态说谎"的骂点；依赖 P0-1 的待办索引 |
| **P2** | P2-1 | **表单卡片**（结构化收集值，secret 字段脱敏、只写不读、绝不截图核对） | 4 | 1 | 4 | 5 | **29** | 对应 Grok Bot 的 Secure Form，但 DSH 有 secret-mask 可复用；成本主要在 schema 与回执 |
| **P2** | P2-2 | **事件触发抽象**（触发源 → routine，先做 webhook + 文件变更两个源） | 4 | 1 | 3 | 3 | **23** | 缺通用事件总线；`webServer.register` 可用但无认证，需先补鉴权 |
| **P2** | P2-3 | **Teach a task（录屏 → 草稿 skill）** | 3 | 1 | 3 | 1 | **17** | 三处高风险：输入录制、步骤抽象、决策补全；且 DSH 有"Agent 自己写 skill"的替代路径 |
| **P2** | P2-4 | **通知与打扰分级** | 3 | 1 | 2 | 1 | **15** | 需新建桌面通知通道，DSH 无原生通知集成；优先度低于"在界面上看得见" |
| **🚫** | X-1 | 厂商托管云电脑 | — | — | — | — | — | **排除**（见 03 文档） |
| **🚫** | X-2 | Take a task 的"接管"交互（人手接管云桌面） | — | 1 | 2 | 1 | — | 依赖云电脑；本机 CUA 的等价物是"用户自己操作同一台电脑"，无需接管协议 |
| **🚫** | X-3 | Bot 专属邮箱 / Slack Team Bot / X 上 @bot | — | 1 | 2 | 1 | — | 属"厂商侧托管服务"，DSH 是本地工具，不提供公共端点 |

### 3.3 依赖图（决定实施顺序）

```
P0-3 动作审计时间线  ──────────────┐（独立，可先做）
P0-1 审批收件箱 ──┬──> P1-5 动作级会话状态
                  └──> P1-3 规则表（共用"审批历史"这一数据源）
P0-2 执行环境面板 ──┬──> （Computer 区）
                    └──> CUA 截图流 tab
P1-1 Agent 实例层 ──┬──> P1-2 Bot 名册
                    ├──> G4 per-agent 设置页
                    └──> A3 Bot 级记忆分区
P1-4 不可信内容围栏（独立，可与 P0 并行）
```

**【判】推荐实施顺序**：P0-3 → P0-1 → P1-3 → P0-2 → P1-4 → P1-5 → P1-1 → P1-2 → P2-1 → P2-2。

理由：先用**纯 Host 半、无前端构建**的 P0-3 建立"审计数据层"，P0-1 与 P1-3 都从它取数；P0-2 是第一次动前端，作为前端工程链路的验证点；P1-1 最重，放到机制层稳定之后。

---

## 4. 与 DeepSeek Harness 现有形态的结合建议

### 4.1 三条不可越过的红线（违反即返工）

1. **只能以 bundle 包形态交付**，不得手改 profile 的 `package.json` / `cordis.patch.yml`。【实】
2. **不得使用 URL 路由 / iframe / 替换 app root / 给工具授予审批权**。【实】
3. **前端 client.js 必须是 lazy-CJS factory**，改完必须重新构建（宿主构建预设 `packages/client/tsdown.client.ts` **不在任何已发布包里**，仓库外要自己复刻）。【实】

### 4.2 推荐交付形态：一个 bundle，五个落地单元

**包名建议** `@local/dsh-agent-ops`（单 bundle 内多入口，避免装五个包）：

```
dsh-agent-ops/
├─ package.json            # dsh.bundle.patch + dsh.client + exports{., ./client}
├─ cordis.patch.yml        # insert: [审批索引服务, 审计投影服务, 执行环境服务, 面板注册]
├─ lib/
│  ├─ approval-index.js    # 监听 approval/request，建跨会话待办索引（Host）
│  ├─ audit-projection.js  # session-log → 人可读动作回顾（Host，纯函数投影）
│  ├─ exec-env.js          # 聚合 cua 应用授权 + sandbox 档位 + computer-use provider（Host）
│  └─ rules-store.js       # Always allow / Ask first 规则表持久化与匹配（Host）
├─ client.js               # lazy-CJS factory：面板 + 右侧栏 tab + 设置区
└─ locale/{zh-CN,en}.json
```

### 4.3 各单元的 DSH 落点（可直接照做）

| 单元 | 挂什么槽 / 用什么服务 | 关键实现点【实】 |
|---|---|---|
| **审批索引服务** | 监听 `approval/request` waterfall（**必须 `return next()`，不拥有决策**）+ 读 `dsh-session-log-jsonl` 的 `approval/asked` / `approval/decided` 事件 | **不要把审批从轮次里摘出来**（会破坏 `request(req)` 的"要求处于未结束轮次中"约束）。索引层只读不写，收件箱点击后跳回原会话的 composer takeover 处理 |
| **审计投影** | `dsh-session-projection` 的纯函数投影模式（快照稳定） | 输出三段：**谁授权的（user/auto/preset）· 做了什么（工具 + 目标）· 结果（allow/deny/cancel/unavailable + 沙箱拒绝码）**。Grok Bot 社区"没有'机器人不在时干了什么'的日志"正是这块 |
| **执行环境面板** | 右侧栏 tab：`ctx.sidebarRightTabs.register({id:'exec-env', kind:'exec-env', title, keepMounted:true})` + `ctx.slots.inject('sidebar.right.pane.tab', …)`；设置区：`settings.section` 插 `order: 5` 的 "execution" 区 | 三块内容：**应用授权表**（读 `cua_permissions_<sha256>.json`，复用其"始终允许/不允许/允许再次询问"三组语义）· **沙箱档位**（读 `permission-presets` 当前值 + 切 `/permission`）· **provider 状态**（`computerUse` 一次只能一个 provider，要显式展示是谁） |
| **规则表** | 设置区内的子页 + `tools/pre-execute` 钩子做匹配 | 抄 Grok Bot 的规格但改进：**Ask first 优先于 Allow**、**20 条上限 + 淘汰告知**、**每条规则必须显示它匹配过几次**（Grok Bot 没有这个，导致"规则到底生效没有"无从判断）、**规则不跨 profile 而跨设备**（DSH 无多设备，改为"存 `~/.dsh/settings.yaml`，可导出"） |
| **Bot 名册 / 实例层** | 新 `main` key `'agents'` + `sidebar.panellist` entry + `{...ctx.layout.selectPanel('agents')}` | 按 `@suifei/dsh-ai-team/client.js:4994-5011` 的真实范式写。**实例 id 必须持久化到 profile 侧**（不写 session 事件，避免违反"不能用新 type 追加 session 事件"） |

### 4.4 三条"反着抄"的具体建议

| Grok Bot 的做法 | DSH 应当怎么做 | 理由 |
|---|---|---|
| 审批 = 各会话 composer 里的一张卡，无收件箱 | **保留 composer takeover（它保证了"必须处理完才能继续输入"的强度），另加只读收件箱做索引与跳转** | 收件箱解决"看不见"，composer 解决"躲不掉"，两者不是替代关系 |
| 状态只有 working，等审批也显示 working | **waiting / blocked 独立成态，且状态来源单一** | 社区"侧栏状态说谎"是信任崩塌的起点，不是小 bug |
| Auto Review 是黑盒，只给 Allow once / Always allow | **每次 Auto 决策都要能在审计里看到"它为什么放行/为什么拦"** | DSH 的 auto-review 输出 reason（`AUTO_REVIEW_DENIED` 可带原始理由），只是没展示出来；展示成本≈0，信任收益最大 |

### 4.5 与现有插件的关系（避免重复造）

| 现有插件/包 | 关系 | 建议 |
|---|---|---|
| `@suifei/dsh-ai-team` | 已有任务板 + 团队面板（右侧栏） | **复用其面板注册范式**；审批归属可借其 owner 语义（E5） |
| `@vectorize-io/hindsight-coding-agents` | 仓库级记忆 | Bot 级记忆应**建在它之上**做分区（bank 名带实例 id），不要另起炉灶（A3） |
| `dsh-experimental-auto-review` | 已有逐调用审查 | 本文只做**展示与规则化**，不动其判定逻辑（E1） |
| `dsh-client-ui-action-cards` | 已有提议卡片 | 表单卡片（P2-1）应作为**新 kind** 注册，不改造现有 kind（F8） |
| `dsh-client-ui-account-notifications` | 账号级公告 | 不要复用（语义不同、轮询 600 s、宽 ≤280 px 放不下动作待办）；新建动作级通道 |

---

## 5. 风险与显式不做清单

### 5.1 风险表

| 风险 | 表现 | 缓解 |
|---|---|---|
| **前端构建链路缺失** | 宿主构建预设不在已发布包里，仓库外复刻失败 → client.js 格式不对，路由 404 | 先用 `@suifei/dsh-ai-team` 的 client.js 作模板逆向出最小 lazy-CJS factory；P0-3 先做纯 Host 半验证链路 |
| **审批索引与轮次约束冲突** | 想把审批抽成独立待办，破坏 `request(req)` 的"未结束轮次"前提 | 索引层只读；处理动作仍回原会话 |
| **面板过多稀释主界面** | 官方内置只 3 个 `main` key 是有意的取舍 | 名册面板默认隐藏，仅在"有 ≥2 个 Agent 实例"时出现在 nav |
| **审计日志体积** | session-log 全量投影可能很大 | 用 projection 缓存 + 只投影最近 N 天（参照 `deliveryHistoryDays:30` 的口径） |
| **状态同步滞后** | 收件箱与真实 composer 状态不一致 → 又一次"状态说谎" | 状态单一来源：以 approval/asked / decided 事件为唯一真值，不另存状态 |
| **规则滥用** | 用户为省事把危险动作 Always allow | 高危 7 类（E8）**不允许**进 Allow 规则，只能 Allow once |

### 5.2 03 文档承接

以下内容不在本文展开，见 [03-excluded-cloud-pc-requirements.md](03-excluded-cloud-pc-requirements.md)：

- "云电脑"的准确定义与排除边界（哪些能力算、哪些不算）
- 排除后的对标范围声明（哪些 Grok Bot 维度仍可对标、哪些失去意义）
- 可执行需求列表（每条含：编号 / 需求描述 / 依据 / DSH 落点 / 验收标准 / 依赖）
- 需求与本文 P0/P1/P2 的映射

### 5.3 一句话结论

**【判】** Grok Bot 给 DSH 的真正启发不是"也做一台云电脑"，而是三件 DSH 缺的产品化工作：**把散落的能力聚成一个可被理解的面（执行环境）、把看不见的决策变成一个可查的账（审计 + 收件箱）、把重复的判断变成一张可编辑的表（规则）**。这三件事全部落在 DSH 已有的服务面上，不需要云，也不需要新的运行时。

