# xAI（SpaceXAI）Grok Bot 产品公开信息调研报告

> **调研对象**：Grok Bot（SpaceXAI / 原 xAI，与 Cursor 团队联合打造）
> **调研日期**：2026-11-17　**版本基线**：1.0.1（2026-11-11 发布）
> **证据分级**：**A** = 官方一手（x.ai 新闻页、docs.x.ai 文档、x.ai/changelog、官方条款）；**B** = 可交叉核对的权威第三方（主流媒体、官方文档镜像站、结构化第三方 wiki、逐版 diff 归档）；**C** = 社区/个人博客/社交平台转述，未经官方确认。
> **取证说明**：本机对 x.ai、docs.x.ai、cursor.com 的直连 `fetch` 全部失败（`TypeError: fetch failed`，`curl` 亦无法出网）。A 级事实经**第三方文档镜像（grok.docs-zh.com，逐字映射 docs.x.ai）**、**官方文档逐版 diff 归档（spybara）**、**搜索引擎整页摘要**三条通道取得，属官方原文转录；凡引用原文处均标出英文原句以便复核，未能取得原文者一律标「未证实」。

---

## 1. 产品定位与版本时间线

### 1.1 一句话定位

Grok Bot 不是可下载的模型、不是 SDK，也不能私有化部署，而是一套**托管式 Computer-use Agent 产品**：xAI 为每个用户账号在云端分配一台**持久化 Firecracker microVM**（「Bot 的电脑」），账号下所有 Bot 共享这台机器，以「AI 同事」的形态出现在聊天列表里，代替用户操作浏览器、桌面应用、CLI 与连接器 [S5][S9][S27]。

官方对外主打三条叙事：
1. **数字劳动力而非助手**——官方标语 "Grok Bot is your team of always-on agents."，强调它是一支团队而非一个聊天窗口 [S1][S31]。
2. **90% 不算完成**——结果必须落进真实工具（发出邮件、改掉生产系统、生成可交付文件），不能停在聊天草稿 [S1][S31]。
3. **像同事一样对话**——消息界面而非画布/DAG 编排；官方明确否决仪表盘、任务分派板与显式交接控件 [S2]。

### 1.2 组织背景：为什么是 Cursor 云

Grok Bot 跑在 **Cursor 云**上，更新走 Cursor 更新器（`api2.cursor.sh`），计费挂在 Cursor 账号体系。原因是公司已合并：2026-02 SpaceX 与 xAI 合并；2026-06 以约 600 亿美元收购 Anysphere（Cursor 母公司）；2026-07 xAI 更名 SpaceXAI。原型是 Cursor 内部 Agent 项目代号「Sand」，计量名 `sand-default` / `sand-automation` / `grok-bot-cua` 沿用至今 [S30][S41]。**因此企业客户的合规凭证是 Anysphere 的 ISO/IEC 27001 与 42001，而非 xAI 自己的** [S25][S31]。

### 1.3 版本时间线

| 日期 | 版本 / 事件 | 关键内容 | 出处 |
|---|---|---|---|
| 2026-08-11 | 公开 early beta | 首发 macOS（Apple silicon + Intel）、Windows、Linux、iOS；仅 SuperGrok Heavy（$300/月）、Cursor Ultra（$200/月）、Cursor Teams Premium（$120/月） | [S1][S6] |
| 2026-08-12 ~ 21 | — | Grok 4.6 接入；五连更（通知按 Bot 分组、远程控电脑、插件多账号、市场改进、`Cmd+D` 听写）；Windows 桌面版与本机执行选项（~0.23→0.24）；放开更多套餐 | [S44] |
| 2026-09-02 / 04 | — | Android / iPad 版上架 | [S44][S31] |
| 2026-09-03 | 企业版 + 设计复盘长文 | 企业版开放；同日发布 `x.ai/news/designing-grok-bot` | [S23][S2] |
| 2026-09-21 | Grok 4.7 | 称专门训练过「原生理解 Grok Bot harness」，256k 标准 / 500k 长上下文 | [S31] |
| 2026-10-07 | 0.68.1 | 幻灯片（PowerPoint / Slides）、Bot 彩色聊天、草稿卡发带格式邮件、Gmail 垃圾箱搜索 | [S4][S33] |
| 2026-10-11 | 0.70.2 + X Subscription | 网页存 PDF、下载保留原名、音频文件、全局搜索、审批卡改大白话；订阅体系上线 | [S4][S22] |
| 2026-10-22 | 0.75.2 | Pages（可共同编辑、Bot 可代管）、视频生成、Library Pinned 跨设备同步 | [S4][S30] |
| 2026-10-23~25 | 0.75.5 / 0.75.8 | Vault（登录/卡/联系人）、Auto-review rule cards、更少审批卡；Bot 可用手机内置 App | [S4] |
| 2026-10-26 | 0.77.0 | Auto review 权限细化、聊天内 rule cards、Vault 改版、1Password 集成、从其他 AI 导入记忆、新模板 | [S4] |
| 2026-10-27 | **0.78.1** | 购物卡（照片/评分/价格/店名/徽章）、Buy now（需审批）、订单跟踪、Vault Payments 接 Shop Pay、3 个订阅模板、拟人化浏览器输入 | [S4] |
| 2026-11-02 | **1.0 公告** | beta → 正式版；宣布 Meetings、Microsoft Teams、shared connectors | [S3] |
| 2026-11-03/04 | — | 电话功能全量开放（仅美国号码）；定时补货（每单一次审批）、Tailscale 插件 | [S37][S4] |
| 2026-11-06 | 0.79.2（未进官方日志） | 自定义 cloud agent modes、浏览器输入更新、routine 严重 bug 修复 | [S44] |
| 2026-11-11 | **1.0.1（最新）** | 含 1.0.0：Meet / Zoom / Teams 参会（会议聊天文字回答、会后摘要）、Team Bots 进 Teams、owners/managers 共享 App 登录、Review learnings 队列 | [S4][S33] |

> **与任务简报的差异**：0.78.1（2026-10-27）在调研时点已被 1.0.1（2026-11-11）取代。两个「1.0 日期」都是官方口径——公告页写 2026-11-02，版本号 11-11 才落地，本报告并列保留。

---

## 2. 功能能力全清单

| # | 能力 | 说明 | 限制 | 出处 | 可信度 |
|---|---|---|---|---|---|
| 1 | 持久云电脑 | 每账号一台 Firecracker microVM，有桌面、`/workspace`、终端、浏览器；关客户端/合盖不中断 | 不支持私有化部署与自带镜像；运行在美国；共享静态出口 IP | [S9][S17] | A |
| 2 | 多 Bot 名册 | 一个账号内多个具名 Bot，各有头像、记忆、routines；上限约 50（Bot + 群聊合计） | 共享同一台电脑，Bot 之间**不是安全边界** | [S2][S9][S31] | A |
| 3 | Bot 屏幕 | 每个 Bot 有独立 screen 可并行浏览；单个 Bot 同时只跑一个 computer-use 任务 | 「分开的工作面，不是分开的安全边界」 | [S9] | A |
| 4 | 屏幕观察与接管 | 右侧 computer preview 看点击/输入/导航；必要时 `Take control` 全屏接管做一步再交还 | 接管只应做被卡住的那一步 | [S9][S27] | A |
| 5 | Skill（技能） | 可复用指令集（何时用/输入与权限/步骤/验证/返回/审批点）；私有 skill 是账号内所有 Bot 共用的一个库；`Teach a task` 可演示流程自动生成草稿 skill | 不能凭 skill 绕过 Auto Review；演示最多 10 分钟、不录麦克风、需人工补决策规则 | [S10][S2] | A |
| 7 | Routine（定时/事件） | 定时（每日/工作日/每 N 分钟）+ 事件（Slack、GitHub/Linear/Sentry/PagerDuty、邮件、webhook） | 单 Bot ≤50 个；间隔 ≥5 分钟；全账号 300 次/小时 | [S10] | A |
| 8 | Auto Review 审批 | 逐动作判定（跑命令/用连接器/用电脑），默认开启 | 不审记忆写入，也不审大部分设置变更 | [S11][S31] | A |
| 9 | Vault | 托管登录凭据、支付卡、联系人；值填入页面但不进模型上下文 | 1Password 集成需 8.12.42+；不含 passkey/SSO/CAPTCHA | [S14] | A |
| 10 | 连接器 / MCP | Gmail、Google Workspace、Slack、Notion、GitHub、Salesforce、Figma、Datadog、Zendesk、X、Outlook 等；可挂自定义 MCP | OAuth token 存 Cursor 后端，Bot 只调工具不拿 token；团队可禁用 | [S7][S17] | A |
| 12 | 本机执行 / 出口路由 | 可授权 Bot 在你自己的电脑上跑命令（`Execution on this computer`），或让云电脑出网走你桌面（目的站看到桌面 IP） | 默认 `Ask every time`；同一时刻只有一台电脑在路由；企业可整体关闭 | [S12][S18] | A |
| 14 | Pages / Library | Pages 可共同编辑、Bot 可代为保持更新；Library 汇集 pages/files/links，按 Today / This week / Older 分组 | 表格预览上限 10,000 行 | [S4][S30] | B |
| 15 | 语音 | 语音输入、语音留言、与单个 Bot 的实时语音通话 | 不支持群聊；同时只能一通 | [S8] | A |
| 16 | 电话代打 | Bot 代你拨打客服电话、走 IVR、等待、与真人对话、实时转写、通话后摘要 | **仅美国号码，Washington 与 Illinois 除外**；须先声明是代表用户拨打的 AI；禁止营销/批量外呼 | [S37][S38] | B |
| 17 | 会议参会 | 从链接加入 Google Meet / Zoom / Microsoft Teams，在会议聊天里用**文字**回答，会后发摘要 | Team / Enterprise / Ultra 可用；**不以语音发言** | [S3][S4] | A |
| 18 | 群聊 | 2–6 个 Bot 同群协作；`@` 指定执行者；Bot 之间可异步私信 | 群内只能传文字（图片走私信）；无 per-Bot 通知开关、无 Always allow | [S8][S2] | A |
| 19 | 共享 Bot / 模板 | 按团队或指定人/组共享，会话各自私有；Bot 可导出为模板生成公开链接 | 共享 Bot 只在云上跑、需 Team 或 Enterprise；模板公开链接暴露 identity/description/skills/routines，不含电脑/登录/历史 | [S13][S3] | A |
| 21 | X / Slack 集成 | X 上 `@bot` 提及帖子或回复即派任务；Slack 频道/线程可 @ 共享 Bot | X 上只回一条确认，工作留在 App；Slack 中未关联账号者不能用 owner 登录 | [S20][S13][S3] | A |
| 23 | X Chat / 记忆导入 | X App 与 x.com 内可与同一批 Bot 聊天；`Import Memory` 可从其他 AI 助手导入记忆 | X Chat 灰度中，需含 Grok Bot 套餐 + 已连 Cursor 账号 + **仅个人账号** | [S8][S12] | A |
| 25 | 企业审计 | Audit Logs（仅 Enterprise）+ OpenTelemetry 导出（带 `cursor.surface=grok_bot`）+ inference hooks | 个人与自助 Teams 无动作审计 | [S17][S19] | A |
| 26 | 私有网络 | 经成员桌面路由，或 Enterprise 用 Team Setup 装网络客户端（Tailscale / Cloudflare Tunnel / VPN / 零信任） | `Network Controls` 仅 Enterprise | [S18] | A |

---

## 3. 典型使用场景

官方用例库共 **56 个示例角色**：Sales 10、Marketing 13、General 6、Ops & Finance 5、Product 5、Engineering 5、CS & Support 4、Recruiting 4、Life & Leverage 4 [S43]。官方给出的递进路径是「先用连接器让 Bot 帮你干活 → 把反复要做的事变成专属 Bot → 几个 Bot 组成团队攻更大目标」，并强调 "Every example stops for your review." [S21]

### 3.1 个人用户

| 场景 | 具体做法 | 来源 |
|---|---|---|
| 收件箱与日程管家 | 预置模板 **Tradbot**：盯邮件与日历，起草回复、抓接送冲突，**绝不代发** | [S6] |
| 订阅断舍离与退款追讨 | 用 0.78.1 三个订阅模板（到期前取消 / 找闲置订阅 / 盯续费涨价）审计，再让 Bot 走网站退款 | [S4][S31] |
| 客服电话代打 | Peter Yang 让 Bot 致电 Comcast 砍价约 25 分钟，月费 84→45 美元且速率提升，一年省近 500 美元；另有 51 分钟追回 $100 礼品卡、当天约到儿科门诊 | [S37] |
| 搭网站 / 买域名 | 让 Bot 在云电脑里买域名并部署 | [S31] |
| 盯第三方提及 | 预置模板 **Overheard**：盯 Reddit/HN/新闻/X 的提及，工作日摘要，无内容时保持安静、绝不代发 | [S6] |

### 3.2 团队（部门级）

| 场景 | 具体做法 | 来源 |
|---|---|---|
| 销售外呼（官方首页主演示） | 新 Bot 自我介绍 → 用户交代夜间外呼 → Bot 改名「Sales Outbound」→ 检查 Hex/Gmail/LinkedIn → 请在它的云电脑登录 Salesforce → 拉 52 个账户、生成 36 条草稿并声明「未经过目不发」→ 用户回「前 10 条可以，每周跑一次」→ Bot 当场建 routine | [S1][S31] |
| SDR 分诊 | 把联系人分 CLEAR / FLAG，CLEAR 只入序列不发信，发送留人工 | [S31] |
| 工程「外环」 | Bot 管理 Cursor Cloud Agents（派任务、读运行记录、查截图、追加或中断）；每 30 分钟巡检 PR；低影响高置信 PR 自动合并；有工程师称可同时管的 cloud agents 从 15 增到 200+ | [S31] |
| 创业公司 GTM | 1 个参谋 Bot + 8 个专家 Bot；routine 默认停用；发送/发布/公开都等到审批 | [S31] |
| 设计 | Figma Bro 走 Figma MCP 精确排版；Motion God 围绕真实动画规格搭本地调参台 | [S31] |
| 市场 | 六件套（调研/定位/广告框架/站点改动/分析/项目管理）；分析角色不许改投放与预算；扩规模前先设「门神 Bot」 | [S31][S44] |

### 3.3 企业

| 场景 | 具体做法 | 来源 |
|---|---|---|
| 客服降本 | 合并后工单量增长 175% 未增员（称否则需多招约 200 人）；单张工单成本 $0.20–0.30 对比传统工具 $1–4；99% 退款请求无需人工；每天聚类 2 万+ 条反馈 | [S31] |
| 运营财务 | 新员工入职、从 Gmail 处理发票；「Haggle Bot」映射约 125 家供应商，自称找出 10 万美元以上节省 | [S31] |
| 招聘 | 夜间筛候选人、早晨出名单、安排面试、提交评分卡 | [S31] |
| 工程 | 审代码 bug 与安全问题；5 人团队借 Team Bots 做到「日均 100+ PR」 | [S31] |
| 销售 / 会议 | 看目标客户 webinar/播客后起草 LinkedIn 与邮件；通话中实时更新演示文稿；1.0 后可直接参会并在会议聊天里答问题 | [S31][S3] |
| 已公开客户 | Legora（瑞典法律 AI）、Supermicro、ServiceTitan（另有报道提及 Harper、Amplitude） | [S23][S41] |

> 官方企业文章自述「**最重度的使用在工程之外**」，即销售、运营、客服才是主战场 [S31]。

---

## 4. 交互流程（端到端）

### 步骤 1：创建 Bot
侧栏顶部 `+` 或 `Cmd/Ctrl+N`（团队版下 `+` 展开菜单选 Create a Bot）→ 填名字、选形状与颜色 → `Create` → 立刻打开与该 Bot 的聊天。首次对话建议先给一段「工作说明书」：职责、可用来源、审批边界，并要求它记住，再发真实首任务。团队账号还会要求设 **primary Bot**（主联系点，主动跟进并协调其它 Bot），共享 Bot 不能当 primary [S7][S27]。

### 步骤 2：首次对话与开工
首任务可用自然语言，也可用官方 starter prompt："Sum up what changed since yesterday in my inbox, calendar, Slack, and docs, and flag what needs me. Draft it as a post for #team; don't send it." [S6]。工具调用、computer use、生成文件、提问、审批请求会**同时**出现在 transcript 里，形成「对话 + 系统事件 + 可交互对象」的异质时间线 [S2]。

### 步骤 3：任务执行（云电脑）
Bot 在自己的 screen 上开浏览器、点界面、敲命令。执行日志刻意不做完整展示——设计团队的理由是「一旦人们能看到一步，就想看到其余所有步」，而用户要细节的真实动机是**安心**而非控制 [S2]。

### 步骤 4：屏幕观察
会话右侧 panel 常驻 **computer preview**；点开可看点击、输入、导航与状态，也可关掉预览让任务在云端继续（关 App 或合盖都不停）[S9][S27]。

### 步骤 5：审批卡片（Auto Review）
Auto Review 默认开启，逐动作判定；多数动作自动放行，命中需确认者弹卡。**三种结果**：

| 结果 | 行为 | 是否留痕 |
|---|---|---|
| **Allow once** | 仅本次执行 | 不留规则 |
| **Always allow** | 执行，并写入 Custom Rules 的 Allow 规则（卡片显示 `Saved to Custom Rules`） | 留规则 |
| **Deny** | 不执行，且在你发下一条消息前不再尝试、不再询问 | 不留 |

变体文案：终端命令卡为 `Allow` / `Skip` + `Manage settings`；被 Ask first 拦下的为 `Allow` / `Not now` + `Edit rule`；无可提议规则时只显示 `Allow`。卡片常带警示语，如 "This can't be undone" [S11][S27]。

**关键语义**（第 9 章会再引用）：
- 审批只控制**待执行的动作**。官方原句："An approval controls the proposed action. It does not reverse work already completed." [S11]
- 停止同理。官方原文："Send a direct 'Stop now' message when work should end immediately. This does not undo actions the Bot already completed." [S8] —— 这就是「**Stop 不撤销副作用**」的依据：邮件已发、订单已下、分支已推之后，Stop 只终止后续步骤。
- Auto Review 只把**你在自己消息里提出的要求**算作你的请求，来自邮件/网页的文字不算——防提示注入的核心设定 [S11]。
- 过期：聊天内的卡不超时；后台（routine / 来信 / 其他 Bot）发起的卡过期后显示 `Expired` 且不执行。**过期时长资料矛盾**（镜像写 30 分钟，第三方写 "about 10 minutes"），标为**未证实** [S11][S31]。

### 步骤 6：Skill 固化
反复要做的事有两条固化路径：(a) 在聊天里口述规则存成 skill；(b) `Teach a task` 演示一遍浏览器流程生成草稿 skill，再补决策规则与审批边界。私有 skill 是账号内**所有 Bot 共用的一个库**；可 `Publish` 到团队（菜单含 `Sync` / `Copy link` / `Unpublish`），但 App 或模板自带的 skill 不可发布 [S10][S2]。

### 步骤 7：Routine 定时
「何时做」独立成 routine：定时或事件触发。Webhook 面板三字段（`POST to`、`key`、`header`），200 只表示「已接受并起跑」，不代表完成。**新 routine 要等到下一个时间点才跑**（8:05 建的 8:00 每日任务要到明天 8:00），立刻验证得用 `Test`；时区在 `Settings → Bot → Timezone`。官方建议「先手工跑通再自动化」，且跑得越勤越烧额度 [S10][S31]。

### 步骤 8：多 Bot 群聊协作
建群 → 拉 2–6 个 Bot → 在群里 `@` 指定执行者。只有**被回复那条消息的发送者**可审批，其他人只能看到在等谁；群聊卡不提供 `Always allow`。Bot 也能私聊你或私聊另一个 Bot 交接（消息落在各自私聊，不进群；群内交接只能是纯文本）。用户自发长出的组织模式是 **Chief of Staff**：一个总入口 Bot 统管一群专职 Bot [S2][S8][S31]。

---

## 5. 界面布局与信息架构

### 5.1 桌面端（Windows / macOS / Linux）
三区布局，多源一致 [S32][S42][S27]：

| 区域 | 内容 |
|---|---|
| **左侧栏** | 顶部 `New` / 搜索；中部 Bot 与群聊列表（Pin 置顶、`Move to new section` 分区、`Needs attention` / `Unread activity` / `Working` 状态点）；底部 `Hidden Bots`、`+` 按钮、`Connect apps`、**account 按钮**（点开为 account menu：Usage、Mobile App、Support、Settings、账号切换、Sign out） |
| **中间对话流** | 消息、工具活动、computer use 步骤、生成文件、提问卡、审批卡、草稿卡、系统事件混排；底部输入框支持文本/链接/图片/附件/听写/语音/`@` |
| **右侧面板** | 默认是该 Bot 的 **computer preview**；点会话顶部 Bot 名（或 `Cmd+Shift+I`）换成 **Bot info pane**：电脑实时预览 + Routines 列表 + Channels + 群成员，右上齿轮进该 Bot 的 Settings 子页（avatar、name、title、description、notifications） |

**关键 UI 事实**：**没有齿轮图标**，也没有 macOS 的 Preferences 菜单项；设置只能从左下角 account 按钮、`Cmd+,` 或命令面板进 [S32]。

### 5.2 移动端（iOS / iPadOS / Android）
- 顶栏左侧为 Bot 名/返回，右侧为 State 与 `Settings` tab；顶部 Bot 名点进 **profile**（`Edit` 改 Name / Title；头像 `Shape` / `Generate` / `Upload` ≤25 MB / `Choose from Photos` / `Take Photo`），profile 内含 **Routines** 区（Active / Schedule / Next run / Instruction / Run history）与 `Share as Template` [S7][S27]。
- 手机可做：看云电脑画面、接管做一步验证、审批、暂停/恢复 routine、`Replace Primary Bot…`、`Duplicate a Bot`（带走 profile、设置、启用中的 skill、routines、头像，**不含**对话历史、记忆、附件）。系统要求 iOS 18+ / iPadOS 18+、Android 9+ [S7][S27]。

### 5.3 信息架构层级树

```
Grok Bot App
├─ 侧栏（Bots 名册）
│  ├─ 搜索 / New Bot
│  ├─ Pin 置顶区
│  ├─ 自定义分区（Move to new section）
│  ├─ 群聊（2–6 Bots）
│  ├─ Hidden Bots（底部分组）
│  ├─ + 菜单：New Bot / Create a Bot / Browse shared Bots
│  └─ account 按钮 → account menu（Usage / Mobile App / Support / Settings / switch / Sign out）
├─ 会话视图
│  ├─ 顶部 Bot 名 → Bot info pane
│  │   ├─ computer preview（点开=全屏接管）
│  │   ├─ Routines（Pause-Resume / Test / Edit / Delete）
│  │   ├─ Channels（Slack / X / Email / Teams）
│  │   └─ 齿轮 → Bot Settings（avatar / name / title / description / notifications）
│  ├─ 对话流（消息 / 工具调用 / 审批卡 / 草稿卡 / 提问卡 / 文件 / Pages）
│  └─ 输入区（附件 / 听写 / 语音 / @ / 中断指令）
├─ Library（pages / files / links，按 Today / This week / Older）
├─ Connect apps（App 与 MCP 连接器 / Bot templates 画廊 / Email 地址申请）
└─ Settings（General / Computer / Vault / Usage & Billing / Updates）
```

---

## 6. 视觉风格

| 维度 | 结论 | 可信度 |
|---|---|---|
| 主题 | `Follow System` / `Light` / `Dark`（`Settings → General → Appearance`） | A [S12] |
| 强调色 | `Accent` 二选一：**Bot color**（默认，按每个 Bot 自己的颜色着色 1:1 消息气泡与卡片）或 **Black**。0.68.1 起 Bot 彩色聊天需 ≥0.64.0 | A [S12][S4] |
| 状态色线索 | 设计复盘原文：电脑活跃时「标题栏图标变紫」——唯一可引用的色彩线索（紫色系）。**具体色值未证实** | B [S2] |
| 图标与卡片 | 头像即状态灯，六态 `idle` / `thinking` / `working` / `waiting` / `blocked` / `done`；构造为「简单形状 + 有表情的眼睛」+ 受控变体 | A [S2] |
| 卡片形态 | 审批卡、草稿卡、商品卡、提问卡、routine 卡、语音卡皆为**内联可交互卡片**，嵌在消息流而非独立面板。官方立场：回答的「形态」也是回答的一部分 | A [S2] |
| 云电脑壁纸 | 随一天时间变化（早亮夜暗），给 Bot 的电脑「自己的时间感」 | B [S2] |
| 品牌一致性 | 共享 Grok 品牌名与深色优先基调；但 **确切色值未公开**。流传的 `#000000` / `#171717` / `#292929` / `#2E72FF` 出自第三方对 **Grok 聊天 App（iOS）** 的分析，**不可**当作 Grok Bot 色值 | C |
| 第三方换肤 | 社区有 CDP 注入换肤工具 `Yellow5A5/Grok-Bot-Skin`（macOS 13+），说明官方只提供黑白外观、皮肤属非官方能力 | C [S51] |

---

## 7. 导航结构

### 7.1 一级入口

| 入口 | 形态 | 备注 |
|---|---|---|
| 桌面 App | 侧栏 Bot 列表 | 主入口 |
| 移动 App | Bot 列表与会话切换 | iOS / iPadOS / Android |
| Web | `grok.com` 的 Grok Bot 入口 | 部分可用，功能不完整 |
| X（`@bot`） | 在 X 上提及即派单 | 只回一条确认，工作留在 App |
| X Chat | X App 与 `x.com` 内聊天 | 灰度，仅个人账号 |
| Slack | 频道/线程 `@` 共享 Bot | 需先连接 |
| Microsoft Teams | 1.0 起 Team Bots 可进 | 需三方批准 |

### 7.2 二级入口（设置内）
`General` / `Computer` / `Vault` / `Usage & Billing` / `Updates`，后两个视账号与灰度出现 [S12][S32]。

### 7.3 路由（可确证的只有 App 内部深链协议）

```
grokbot://app/v1/settings?id=theme
grokbot://app/v1/settings?id=language
grokbot://app/v1/settings?id=update-computer
grokbot://app/v1/settings?id=reset-computer
grokbot://app/v1/settings?id=update-channel
```

`General` 下的行锚点还有 `account`、`accent`、`spell-check`、`microphone`、`hardware-acceleration`、`notification-sound-enabled`、`timezone`、`auto-review`、`auto-review-rules`、`security-keys`；`Computer` 下有 `local-execution`、`computers`、`update-computer`、`reset-computer` [S32]。
**HTTPS 层面的 URL 路由未公开**（`docs.x.ai`、`x.ai` 是文档与营销站），标注为**未证实**。

### 7.4 快捷键

| 快捷键 | 功能 |
|---|---|
| `Cmd/Ctrl + ,` | 设置 |
| `Cmd/Ctrl + Shift + ,` | 该 Bot 的设置 |
| `Cmd/Ctrl + N` | 新 Bot |
| `Cmd/Ctrl + D` | 语音输入（可长按说话） |
| `Cmd + Shift + I` | Bot info pane |
| `Esc` | 关面板 / 取消 |

---

## 8. 设置项清单

| 分组 | 设置项 | 说明 | 出处 |
|---|---|---|---|
| **Account** | Sign In with Cursor / Sign Out、Get Grok Bot for mobile、Support、Switch / Add / Remove account | 多账号时 account menu 与设置里同列表 | [S12] |
| **Appearance** | Theme（Follow System / Light / Dark）、Accent（Bot color / Black）、Language（20+ 语言，含简体/繁体中文） | — | [S12] |
| **System** | Microphone、Use hardware acceleration（macOS/Windows 默认开、Linux 默认关）、Network debugger | — | [S12] |
| **Bot** | Timezone、Auto-review 开关、Custom Rules（Allow ≤20 + Ask first ≤20，单条 ≤1000 字符） | 满 20 时新 `Always allow` 会挤掉最旧的 Allow 规则并告知 | [S12][S11] |
| **Import** | Import Memory：Start Import → 复制提示词到其他 AI → 贴回回答 → Add to Memory | 导入进入 primary Bot | [S12] |
| **Computer** | Your computer（桌面列表、Manage devices、每台独立的 `Execution on this computer`）、Bot's computer（Update / Reset）、Route traffic through this computer | 未列桌面时显示 `Execution on Local Computer` | [S12] |
| **Vault** | New item / 编辑 / 删除 / 从其他密码管理器 Import | Connected apps 不在此处，走侧栏 `Connect apps` | [S12][S14] |
| **Usage & Billing** | weekly included usage、on-demand usage、plan、cancel-trial、billing | 缺失则去 Cursor 账号页或找管理员 | [S12][S22] |
| **Updates** | Grok Bot Updates（版本、Check for Updates、Restart to Update）、Update Track（Stable / Nightly）、Automatic Updates | Linux `.deb`/`.rpm` 走包管理器，无该开关 | [S12][S32] |
| **每 Bot 独立** | avatar / name / title / description / Notifications | **个人 Bot 没有 description 也没有 Bot settings 页**，改行为只能在聊天里说 | [S7][S12] |
| **企业侧** | Team Setup Scripts、Public template sharing、Auto-review instructions、Allow Local Egress Routing、App 白名单 | 均由管理员在 Cursor dashboard 下发 | [S12][S17] |

---

## 9. 权限与限制

### 9.1 套餐与额度

The X Subscription 五档：Free $0 / Plus $8 / **Premium $30** / **Super $100** / **Ultra $200**（年付 Ultra $2000，折 $167/月）。**Plus 是唯一不含 Grok Bot 的付费档**；Premium = SuperGrok + Cursor Pro + X Premium+。以 Plus 为 1x 的标称额度：Premium 4x、Super 15x、Ultra 50x [S22][S27]。

旧路径仍有效：任一付费 Cursor 个人套餐、self-serve Cursor Teams（$40/seat/月）、SuperGrok 各档、X Premium+、Grok Business seat [S6][S22]。

**用量结构**：**included weekly usage**（每周重置）与 **on-demand 月度上限**是两个独立控制，后者不是运行中的硬停 [S22][S31]。用量池是 Grok + Grok Bot + Cursor **共享**的每周池 [S22]。**没有单独的 Grok Bot 支出上限**，条款要求客户自行配置消费限额 [S25]。

### 9.2 容量与频率硬上限
- 账号内 Bot + 群聊合计 **约 50**；单群聊 **2–6** 个 [S2][S31]
- 单 Bot **≤50** 个 routine；每 routine 保留 **20** 条运行记录；routine 最小间隔 **5 分钟** [S10]
- 全账号 **300 次/小时**、单 routine **200 次/小时**，超限报 `Automation run rate limit exceeded` 且**不自动重试** [S10]
- Auto Review 规则：Allow **20** 条 + Ask first **20** 条，单条 ≤**1000** 字符 [S11]

### 9.3 数据驻留与合规
- 云电脑**运行在美国**，数据落在美国服务器；书面驻留承诺需与客户团队单独确认 [S16][S31]。
- 控制面每天加密备份；删账号后 **30 天内**清除 [S31]。
- 合规凭证是 Anysphere 的 ISO/IEC 27001 与 42001（Grok Bot 在范围内），页脚另标 SOC 2 与 AIUC-1 [S25][S31]。
- **Legacy Privacy Mode 不支持**，须先切 Privacy Mode；开启时不用于训练，关闭时 Cursor 可能使用并存储数据训练 [S6][S31]。
- 对模型供应商有零数据留存（ZDR）协议，但供应商滥用分类器可能留存被标记数据 [S31]。

### 9.4 安全边界（最易被误解）
官方原句："Isolation is per user, not per Grok Bot." [S9]。即**用户之间**是硬件级隔离；**同一用户的 Bot 之间不是安全边界**——cookie/登录态、文件、CLI 凭据全部共享，一个 Bot 能接着另一个 Bot 保存的工作干下去 [S9]。需要独立凭据集时，官方建议**换一个 Cursor 用户**（即换一台电脑）[S31]。

### 9.5 Auto Review 的边界
- 覆盖 shell、连接器调用、computer use、routine 与触发器修改、subagent / Cloud Agent 委派；**不覆盖记忆写入与大部分设置变更** [S31]。
- 官方自称是「辅助手段」，需与最小权限原则配合 [S11][S31]。
- 关闭后动作不再检查，Custom Rules **隐藏但保留**，内置安全检查始终生效；团队强制时开关锁定并显示 `Required by your admin`，个人规则只能在团队规则之上**加严**，冲突时 `Ask first` 优先 [S11]。

### 9.6 网络：双通道模型
| 通道 | 走法 | 管控 |
|---|---|---|
| **网站直连** | 云电脑浏览器直接访问公网 | 共享静态出口 IP，可被识别为 Grok Bot 流量；`Network Controls` 仅 Enterprise 可封 |
| **连接器** | OAuth，token 存 Cursor 后端，Bot 只调工具不拿 token | 团队可禁用单个 App（`Disabled by team admin`）；**被禁仍可走网站** |
| **本机路由** | `Route traffic through this computer`，出网走你的桌面 | 同一时刻只有一台电脑在路由；企业可整体关闭 |

### 9.7 模型不可选
官方原句："Grok Bot manages model selection, so there is no model picker." [S12][S24]。产品不绑定单一模型，逐任务挑「最可能给出好结果」的后端模型，且**不显示**底层模型。
> 附带争议：2026-10 有媒体引述马斯克称会使用最适合任务的后端模型（举 Claude Opus、MidJourney、Suno 为例），但 17 天后 changelog 仍无对应条目，官方页面也未提第三方路由——**该说法未证实**（C 级）。

### 9.8 地区与入口限制
- App 本身**未见国家级封锁**（第三方口径）[S48]，但云电脑全在美国。
- **电话仅美国号码，Washington 与 Illinois 除外** [S37][S38]。
- **X Chat 仅个人账号**（企业域邮箱、团队账号、legacy request-based 套餐不可用）[S8]。
- **Team Bots 需 Team 或 Enterprise**；**Meetings 需 Team / Enterprise / Ultra** [S3]。

### 9.9 条款与责任划分
Agentic Actions 被定义为「概率性的、可能出错」，客户对全部代理行为独自负责；审批与自动审查控件**「仅为辅助」**，平台对未拦截动作不负责，并可未通知即禁用动作 [S25]。这与马斯克 2026-08-26 在 X 上 "If Grok Bot messes up, we will make you whole." 的口头承诺**存在张力** [S31]。

---

## 10. 优缺点

### 10.1 优点
1. **常驻与持久性做得最实**：关掉客户端也不停，登录态/文件/凭据长期保留，与「每次开新会话」类 Agent 形成代际差 [S9][S31]。
2. **多 Bot 名册与群聊是一等公民**：Bot 间可异步私信、互相当 helper，用户自发长出 Chief of Staff 模式；同类产品（Manus Cue / OpenAI Dots / Claude Cowork）普遍缺这一组织层 [S2][S31]。
3. **审批模型颗粒度合理**：Allow once / Always allow / Deny 三态 + Custom Rules 双白名单 + 「只把你自己的话当请求」的防注入设定 [S11]。
4. **结果形态完整**：Pages、Library、PDF/PPTX/Slides/表格/音频/视频，产物能真的交付而不是停在聊天里 [S4][S30]。
5. **企业治理到位**：Audit Logs、OpenTelemetry（`cursor.surface=grok_bot`）、inference hooks、私有网络、SSO/SCIM、Team Setup 脚本、Action Recording [S17][S19][S18][S31]。
6. **与 Cursor 生态同源**：同一套 MCP/插件体系，工程团队上手零成本，Bot 可直接当 Cursor Cloud Agents 的「外环」[S31]。

### 10.2 缺点
1. **单点故障面极大**：全账号共享一台电脑，电脑卡死＝所有 Bot 同时停摆；社区有「7 天连不上电脑」「43% 迁移卡死需人工处理」的报告 [S31][S46]。
2. **记忆模型粗糙**：每个 Bot 是一条无上限对话线程，每轮重读全部历史，临近上限才自动摘要；**不能手动压缩、不能开新会话**；「复制 Bot 再隐藏原 Bot」会丢记忆 [S31]。
3. **额度不透明且会变**：无独立支出上限、模型不可见、后台 routine 可能无感知烧掉整周额度 [S10][S34]。
4. **自动化脆弱**：改版、数据中心 IP 被封、CAPTCHA 仍会打断浏览器自动化；多 Bot 讨论容易空转耗额度 [S31]。
5. **合规与信任短板**：数据只在美国、不支持私有化与自带镜像、共享静态出口 IP；审批与审查控件在条款里只是「辅助」，责任全在客户 [S16][S25][S31]。
6. **品牌牵连**：HN 高赞讨论对马斯克个人品牌的顾虑，以及「这不就是 OpenClaw / Hermes 加一个凭据代理」的质疑 [S46][S31]。

---

## 11. 用户反馈与媒体评价

### 11.1 正面
| 评价 | 来源 | 时间 |
|---|---|---|
| 「Bot 之间通信是一等公民」、体验像带了一支小团队；人机协同设计「值得照搬」 | 社区/论坛汇总、HN 高赞 | 2026-08~10 [S31] |
| Lenny Rachitsky 称「久未对一个 AI 产品如此兴奋」；有独立发布者称它取代了自己的 OpenClaw、Hermes 与本地模型 | Marketplace 首批创作者、社区 | 2026-09 [S31] |
| 连接器、持久登录、审批边界（尤其一次性支付卡）设计得好 | HN 讨论 | 2026-08 [S31] |
| journaldunet 实测三件日常事（订火车票、改手机套餐、在 SNCF 网站下单），称其为「目前最自主的 agent，与 Meta Muse 并列」 | 法国媒体 | 2026-10 [S40] |
| 电话实测：Comcast 砍价月费 84→45 美元、追回 $100 礼品卡、当天约到门诊 | 个人实测 | 2026-11 [S37] |
| App Store 评分 4.89（6,564 个评分，生产力类）；Google Play 4.8（6.56K 评价、500K+ 下载） | 应用商店 | 2026-09-30 [S31] |

### 11.2 负面与争议

#### （1）2026-11 额度收紧争议（本次调研最重要的负面事件）

**时间线**：

| 日期 | 事件 | 来源 |
|---|---|---|
| 2026-11-01（周日） | 用户 `@DogecoinNorway` 反映「离重置还有 4 天，额度已 100%」；马斯克回复**"The cost of serving Grok Bot was unsustainably high relative to revenue."** | [S34][S35] |
| 2026-11-02 | **TechCrunch** 报道《Elon Musk throttles Grok Bot limits due to 'unsustainably high' costs》；Business Insider / The Verge / Anadolu / HKET / 财联社跟发 | [S34][S35] |
| 2026-11-08 | Zane Campbell 发约 3 分半视频：同样工作量用量变 4 倍，已从 Ultra 降到 $30 档，称「付钱也没意义因为什么都做不到」；上周一天用掉周额度 30%–40% | [S36][S31] |
| 2026-11-09 | 马斯克称已与工程团队开圆桌、修正当晚推出；帖下约 2,500 条回复多为要求重置额度 | [S36] |
| 2026-11-10 | 官方 `@bot` 账号宣布为**全体用户重置每周额度** | [S47] |

**用户侧症状（多源交叉）**：一觉醒来 50%→100%；1 小时内 56%→100%；只问两个简单问题整周见底；无任务运行时额度翻倍；部分人上限被直接砍半。社区用词 **"indirect rug pull"**（变相抽贷）[S49][S46]。马斯克用过去时（"was"），被普遍解读为有意收紧而非计费故障；官方始终未公布新额度数字、生效时间或补偿 [S34][S35]。

#### （2）稳定性与工程问题
- 额度消耗异常：HN「3 小时实验后只剩 48% 周额度」；Ultra 用户 3 天用掉 99% 周额度；单轮 24.9 万 token（缓存读取可占 84%）；转 on-demand 后 10 分钟花掉 $27 [S31][S46]。
- 云电脑升级卡死 43%（员工逐个手动处理）；「7 天连不上电脑」「长时间卡在 Working」；2026-09-16「发送失败」帖 187 条回复 [S31][S46]。
- 客户端缺陷：Android 输入框不更新、文件只能分享不能下载、Markdown 转 PDF 丢段落、Windows 11 本机执行问题 [S31][S44]。
- 连接器缺陷：Gmail 改写链接、1Password 自动填充失效、插件显示已连接但无可用工具 [S31]。

#### （3）信任与架构质疑
- HN 高赞担心：马斯克品牌牵连、提示注入、凭据被劫持、美国以外难落地；Trending Topics 批评「凭据与记忆锁在云里」形成锁定；发布后 6 周内 HN 出现至少 8 个「开源 Grok Bot」项目（Open Bot、Gawkbot、Errand、OpenVurp 等）[S31][S46]。
- 中文体验文（36氪/蓝字计划 2026-10-13）实测订温州机票给不出可用行程方案、要求退款，评价很差，但承认海外热度高（单条帖子 1000+ 回复）；观猹社区认为 $300/月（Heavy 档）劝退 [S50][S31]。

#### （4）口碑数据
App Store 另有 3.9★ 口径（applecensorship 抽样 5 个 storefront），与上表 4.89/6,564 **口径不同、不可互换**。HN 发布帖 351 分 / 334 评论；官方 `@bot` 账号 32.1 万关注 [S31]。

---

## 12. 关键来源清单与可信度分级

**A 级（官方一手，共 26 条）**

| 编号 | 标题 / 页面 | 类型 | 可信度 | 访问日期 |
|---|---|---|---|---|
| S1 | `x.ai/news/introducing-grok-bot` — Grok Bot 发布公告（2026-08-11） | 官方公告 | A | 2026-11-17 |
| S2 | `x.ai/news/designing-grok-bot` — 设计复盘（2026-09-03） | 官方博文 | A | 2026-11-17 |
| S3 | `x.ai/news/grok-bot-1-0` — 1.0 公告（2026-11-02） | 官方公告 | A | 2026-11-17 |
| S4 | `x.ai/changelog/bot` — 官方更新日志（0.68.1 → 1.0.1） | 官方 changelog | A | 2026-11-17 |
| S5 | `docs.x.ai/grok-bot/overview` | 官方文档 | A | 2026-11-17 |
| S6 | `docs.x.ai/grok-bot/get-started` | 官方文档 | A | 2026-11-17 |
| S7 | `docs.x.ai/grok-bot/bots` | 官方文档 | A | 2026-11-17 |
| S8 | `docs.x.ai/grok-bot/chat-and-collaboration` | 官方文档 | A | 2026-11-17 |
| S9 | `docs.x.ai/grok-bot/computer-and-apps` | 官方文档 | A | 2026-11-17 |
| S10 | `docs.x.ai/grok-bot/skills-routines-and-automations` | 官方文档 | A | 2026-11-17 |
| S11 | `docs.x.ai/grok-bot/approvals-security-and-privacy` | 官方文档 | A | 2026-11-17 |
| S12 | `docs.x.ai/grok-bot/settings-and-notifications` | 官方文档 | A | 2026-11-17 |
| S13 | `docs.x.ai/grok-bot/shared-bots` | 官方文档 | A | 2026-11-17 |
| S14 | `docs.x.ai/grok-bot/vault` | 官方文档 | A | 2026-11-17 |
| S15 | `docs.x.ai/grok-bot/security` | 官方文档 | A | 2026-11-17 |
| S16 | `docs.x.ai/grok-bot/security-faq` | 官方文档 | A | 2026-11-17 |
| S17 | `docs.x.ai/grok-bot/teams-and-enterprises` | 官方文档 | A | 2026-11-17 |
| S18 | `docs.x.ai/grok-bot/private-networks` | 官方文档 | A | 2026-11-17 |
| S19 | `docs.x.ai/grok-bot/inference-hooks` | 官方文档 | A | 2026-11-17 |
| S20 | `docs.x.ai/grok-bot/tag-on-x` | 官方文档 | A | 2026-11-17 |
| S21 | `docs.x.ai/grok-bot/use-cases` | 官方文档 | A | 2026-11-17 |
| S22 | `x.ai/news/x-subscription` — The X Subscription 定价（2026-10-11） | 官方公告 | A | 2026-11-17 |
| S23 | `x.ai/news/grok-bot-for-enterprise`（2026-09-03） | 官方公告 | A | 2026-11-17 |
| S24 | `cursor.com/help/grok-bot/models` — 模型选择说明 | 官方帮助 | A | 2026-11-17 |
| S25 | `cursor.com/terms/grok-bot` — Grok Bot 条款（2026-09-03 更新） | 官方条款 | A | 2026-11-17 |
| S26 | `x.ai/bot` — 产品下载页 | 官方页面 | A | 2026-11-17 |

> A 级说明：上述 26 条均为 xAI / Cursor 官方页面。因本机无法直连，官方原文经 **S27 文档镜像**、**S29 逐版 diff 归档**、**搜索引擎整页摘要**三条通道取得，属官方内容转录而非二手改写，故计 A 级；页面「最后更新时间」与灰度差异无法逐一核实。

**B 级（可交叉核对的权威第三方，共 18 条）**

| 编号 | 标题 / 页面 | 类型 | 可信度 | 访问日期 |
|---|---|---|---|---|
| S27 | `grok.docs-zh.com` — docs.x.ai 的第三方中文镜像（逐页映射） | 文档镜像 | B | 2026-11-17 |
| S28 | `agentwikis.com/wiki/grok-bot` — 结构化第三方 wiki（截至 2026-10-21，31 篇） | 第三方 wiki | B | 2026-11-17 |
| S29 | `spybara.com/xai/grok-bot/history` — 官方文档逐版 diff 归档 | 归档镜像 | B | 2026-11-17 |
| S30 | `grokbot.guru` — 官方 changelog / 文档整理站 | 整理站 | B | 2026-11-17 |
| S31 | `github.com/oratis/LISA` — `grok-bot.md`（37,042 字符，66 条 sources，逐条标注官方/媒体/社区/推测） | 第三方深度研究 | B | 2026-11-17 |
| S32 | `github.com/asgeirtj/system_prompts_leaks` — `app-ui.md`（界面结构反推，含深链与行锚点） | 逆向整理 | B | 2026-11-17 |
| S33 | `ai.agentik-os.com/tools/x.ai/changelog/bot` — changelog 镜像（「Latest v1.0.1 · Nov 11, 2026」版本号证据） | 镜像 | B | 2026-11-17 |
| S34 | TechCrunch《Elon Musk throttles Grok Bot limits due to 'unsustainably high' costs》（2026-11-02） | 主流媒体 | B | 2026-11-17 |
| S35 | Business Insider / The Verge / TechSpot / 财联社同题报道（2026-11-02~03） | 主流媒体 | B | 2026-11-17 |
| S36 | unwire.hk — 1.0 团队会议报道 + 额度修复（2026-11-09、11-12） | 科技媒体 | B | 2026-11-17 |
| S37 | Teslarati《Grok Bot is picking up the phone now》 | 科技媒体 | B | 2026-11-17 |
| S38 | PYMNTS — 电话代打报道 | 财经媒体 | B | 2026-11-17 |
| S39 | flaviocopes.com《What's new in Grok Bot 1.0》— beta→1.0 对比表 | 技术博客 | B | 2026-11-17 |
| S40 | journaldunet — 三项日常任务实测 | 媒体实测 | B | 2026-11-17 |
| S41 | 36氪 / 投资界 — 公司背景与 1.0 报道 | 商业媒体 | B | 2026-11-17 |
| S42 | `macin.top/posts/210c8db2` — 中文上手实录 | 个人博客 | B/C | 2026-11-17 |
| S43 | Grokmag — 官方 56 个示例角色清点 | 垂直媒体 | B | 2026-11-17 |
| S44 | `getgrokbot.com/en/changelog` — 社区 changelog 镜像（混有本站条目，需甄别） | 社区整理 | B/C | 2026-11-17 |

**C 级（社区/个人转述，仅作旁证，共 7 条）**

| 编号 | 来源 | 类型 | 可信度 | 访问日期 |
|---|---|---|---|---|
| S45 | `LJMStark/grok-bot-blackbook` PDF — 版本号与指南转述 | 个人整理 | C | 2026-11-17 |
| S46 | Hacker News / Reddit / 官方论坛帖 — 额度与稳定性反馈 | 社区 | C | 2026-11-17 |
| S47 | blockbeats（2026-11-10）— 官方重置每周额度 | 快讯 | C | 2026-11-17 |
| S48 | `aiagent.nl`（2026-11-06）— 地区可用性口径 | 资讯站 | C | 2026-11-17 |
| S49 | Korben / TechSpot — 「indirect rug pull」社区用词 | 博客 | C | 2026-11-17 |
| S50 | 蓝字计划 / 36氪（2026-10-13）— 中文实测负面体验 | 自媒体 | C | 2026-11-17 |
| S51 | `github.com/Yellow5A5/Grok-Bot-Skin` — CDP 换肤工具 | 社区项目 | C | 2026-11-17 |

---

## 附录：明确未证实 / 未公开的事项

| 事项 | 状态 |
|---|---|
| Grok Bot 官方品牌色值、Hex 色号 | **未公开**（仅知活跃态为紫色系） |
| 云电脑硬件规格（社区传「8 核 / 16GB / 128GB」，无官方确认） | **未证实** |
| 后台审批卡过期时长（30 分钟 vs 约 10 分钟，资料矛盾） | **未证实** |
| 电话通话是否计入每周额度、计入多少 | **未公开** |
| 第三方模型（Claude / MidJourney / Suno）是否真被路由 | **未证实** |
| 产品 Web 端 HTTPS URL 路由、企业版 list price、2026-08-24 预告的整套 Theme 预设 | **未公开 / 未证实** |

---

*全部事实可回溯至 S1–S51 编号来源；无法回溯者已逐条标注「未证实 / 未公开」。*
