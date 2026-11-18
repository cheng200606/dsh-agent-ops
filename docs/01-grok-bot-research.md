# Grok Bot 公开信息调研报告

> **文档性质**：公开信息二次整理 + 交叉验证，不含任何未公开的内部资料。
> **时间基线**：2026-11-17（所有"最新"均以此日为准，产品迭代很快，引用时请核对版本号）。
> **调研方式**：官方文档/官方发布页、官方设计复盘、泄露的 agent 系统提示词附件、第三方深度调研、社区一手口碑帖、应用商店与变更日志。
> **可信度分级**（全文每条关键事实后标注）：
>
> | 级别 | 含义 | 典型来源 |
> |---|---|---|
> | **A** | 官方一手：官方文档、官方发布页、官方设备内文案、可复核的产品行为 | docs.x.ai 系列文档、x.ai/news |
> | **A-** | 高可信的准官方：官方系统提示词附件、官方 demo 页面、可运行产品行为记录 | GitHub 泄露的 reference/skills 文件 |
> | **B** | 主流媒体 / 有署名与分级的第三方深度调研 | TechCrunch、gigazine、LISA 研究文档 |
> | **B-** | 社区整理但有出处可追（含一手帖截图说明） | 社区口碑汇编、Awesome 变更日志 |
> | **C** | 二手转述、教程站、个人博客、无法交叉验证 | 中文/日文教程站、聚合站 |
> | **D** | 单条用户帖 / 未证实 | 单条 X 帖、Reddit 单帖 |
>
> **本文的立场**：Grok Bot 是一个**被设计语言刻意弱化其"电脑"存在感**的持久化 Agent 产品。它的产品价值与它最大的风险来自同一个决策——把用户从"操作员"位置移开。后文所有分析都围绕这一条张力展开。

---

## 目录

1. [事实基线](#1-事实基线)
2. [功能能力](#2-功能能力)
3. [使用场景](#3-使用场景)
4. [交互流程](#4-交互流程)
5. [界面布局](#5-界面布局)
6. [信息架构](#6-信息架构)
7. [视觉风格](#7-视觉风格)
8. [导航结构](#8-导航结构)
9. [设置项](#9-设置项)
10. [权限与限制](#10-权限与限制)
11. [优缺点](#11-优缺点)
12. [用户反馈](#12-用户反馈)
13. [来源与可信度表](#13-来源与可信度表)

---

## 1. 事实基线

### 1.1 一句话定义

Grok Bot 是 **xAI（SpaceXAI）出品的"常驻型"（always-on）Agent 产品**：每个 Bot 是一个**有名字、有头像、有记忆、有自己的云电脑**的持久化执行体，用户以"派活"而不是"提问"的方式与它协作，它在用户关掉笔记本之后仍可继续工作。它不是模型、不是可下载的软件包，**是一个被托管的产品形态**。**（A/B 交叉：官方发布页 + LISA 调研 + aiagent.nl 2026-11-06）**

### 1.2 关键事实表

| 项目 | 事实 | 可信度 | 来源 |
|---|---|---|---|
| 出品方 | xAI（2026-02-02 被 SpaceX 全股票收购，2026-07-06 更名 SpaceXAI；Cursor/Anysphere 2026-08-14 并入） | B | LISA 调研文档 |
| 内部代号 | "Sand"；计费标签 sand-default（对话）/ sand-automation（routines） | B- | LISA 调研文档 |
| 首次公开 | 2026-08-11 early beta（仅 SuperGrok Heavy $300/月、Cursor Ultra $200/月、Cursor Teams Premium $120/人/月） | A/B | 官方发布页 + gigazine 2026-08-12 |
| 企业版 | 2026-09-03 | B | LISA 调研文档 |
| 全面铺开 | 2026-08-21 / 08-26 扩至全部付费档；08-26 因额度事故官方重置全体周额度 | B- | Awesome 变更日志 + LISA |
| 最新版本 | **v1.0.1（2026-11-11）**：Bot 可加入 Google Meet / Zoom / Microsoft Teams 会议并会后发纪要；Team Bot 可接入 Microsoft Teams；共享连接器 | B- | AI Radar 变更日志（读取 x.ai/changelog/bot 后的镜像，2026-11-17 更新） |
| 上一批版本 | 0.78.1（2026-10-27）；0.77.0（10-26，1Password 授权 + 从其他 AI 助手导入记忆）；0.75.8（10-24，Bot 可建议增删 Auto Review 规则） | B | aik8s 整理（引官方链接） |
| 产品形态 | 桌面 Electron 应用（macOS / Windows / Linux .deb/.rpm/AppImage）+ iOS + Android + Slack + X Chat + X 上 @bot + 部分网页 grok.com | A/B | 官方文档 + aiagent.nl + LISA |
| 账号体系 | **登录、计费、隐私、客服全部走 Cursor 账户**；删 Grok Bot = 删 Cursor 账号 | B | aiagent.nl + LISA |
| 云电脑位置 | **全部在美国**（安全页明示）；App 本身无国别限制 | A/B | 官方安全页 + aiagent.nl |
| 面向开发者的公共 API | **未找到公开信息**（只有 Webhook 触发器、MCP、企业 Admin API） | B | LISA 调研文档 |

### 1.3 订阅与计费（截至 2026-11-17）

Grok Bot **没有独立订阅**，随 X Subscription 附带。**（A，官方文档 + aiagent.nl 逐项核对官方定价页）**

| 档位 | 价格 | 是否含 Grok Bot | 额度倍率 |
|---|---|---|---|
| X Free / X Plus | $0 / $8 | ❌ | — |
| X Premium | $30/月 | ✅ | 4× |
| X Super | $100/月 | ✅ | 15× |
| X Ultra | $200/月 | ✅ | 50× |
| 付费 Cursor 套餐 / Cursor Teams | —— | ✅ | —— |
| SuperGrok Lite | —— | ❌ | —— |
| Grok Business 席位 | —— | ✅ | —— |

关键计费事实（**这一段的每一条都直接影响对标**）：

- **2026-10-18 起并入 The X Subscription**：Grok Bot 与 Grok、Cursor **共享同一个周额度池**，超出后走**预付 credits**（不是 on-demand）。**（A-，泄露 skills/recent-changes.md）**
- **不存在独立的 Grok Bot 花费上限**；也**不是硬停**——额度耗尽后仍可继续（走 prepaid credits）。**（B，aiagent.nl）**
- 试用期 7 天额度。**（B）**
- **额度收紧事件（2026-11，本报告最重要的一条时效性事实）**：11-01 Musk 原话 "The cost of serving Grok Bot was unsustainably high relative to revenue." → 11-02 TechCrunch 报道部分用户周额度突降 → 11-08 Zane Campbell 视频 → 11-09 圆桌会议 → **11-10 官方重置全体周额度**。**（B）**
- 社区量化：**缓存读取可占单轮 token 的 84%**；Ultra 用户 **3 天用掉 99% 周额度**。**（B）**
- 2026-08-26 曾因额度事故官方**给全体用户重置周额度**。**（B-）**

> ⚠️ 套餐清单自发布以来已多次变更，2026-08 之前的文章写的套餐与现在不同，引用旧文时必须核对日期。**"额度倍率"一列（4×/15×/50×）来自研究者报告的官方口径，与"是否含 Grok Bot"是两件事，不要混用。**

---

## 2. 功能能力

### 2.1 核心对象模型：三个原语 + 一条生命周期轴

官方设计复盘（x.ai/news/designing-grok-bot，2026-09-03）把整个产品收敛为**五个原语**：**（A，官方设计稿）**

| 原语 | 定义 |
|---|---|
| **Bots** | 持久化 Agent，有自己的身份、记忆、运行时和工具 |
| **Chats** | 与 Bot 协作的对话界面 |
| **Prompts** | 给 Bot 的上下文或指令；可一次性使用、可存成 Skill、可作为 Routine 自动触发 |
| **Tools** | 让 Bot 通过软件、API、connector、shell 或 computer use 获取信息和执行动作 |
| **Artifacts** | Bot 产出或修改的持久产物（文档、设计、代码、数据） |

**其中最有方法论价值的一处**：把"一次性提示词 / 可复用技能 / 定时自动化"在概念上压缩成同一个东西（Prompt），区别只在**生命周期**。用户不需要先理解"什么是 Skill"才能存下一段常用指令。

不过在实际界面与系统提示词里，落地的是**三个并列对象**：**（A-/A，泄露 skills + 官方文档）**

- **Bot（谁来做）**：持久身份 + 记忆 + 工具 + 电脑。
- **Skill（怎么做）**：可复用的作业手册，**账号级**共享，所有 Bot 都能调用（但依赖的插件/登录必须在那个 Bot 上存在）。
- **Routine（何时做）**：saved prompt + trigger，**归属单个 Bot**。

### 2.2 云电脑（Computer-use）

> 📌 **本章节内容在最终对标方案中已被明确排除**（见《03-排除云电脑后的需求清单》），此处仅作为产品全貌记录。

- 每个用户**一台**持久化 Linux 机器（Firecracker microVM / 服务端 brokered anyrun pod），**同一用户的所有 Bot 共享同一文件系统与 machine state**；**桌面是 per-agent 的**（各自有屏幕与浏览器窗口，互不可见）。**（A-，泄露 reference/debugging-the-box.md）**
- 能力面：浏览器、文件系统（/workspace 持久 scratch）、终端、桌面应用；能操作**没有 API/MCP 的网站**（像人一样点网页）。**（A/B）**
- 隔离边界在**用户之间**，不在 Bot 之间。官方明示："不要把不同 Bot 当作安全边界。"**（A，官方文档）**
- 空闲一段时间会休眠，文件保留。**（B，aiagent.nl）**
- 内置健康检查 `box-doctor`（探 machine-id、Chrome 版本、DNS/egress、系统时钟、D-Bus），输出 `[box-doctor] PASS|FAIL`。**（A-，泄露 reference）**
- 三级可见性：Status（状态图标）→ Preview（侧栏预览）→ Takeover（全屏接管）。**（A，官方设计稿）**
- 每台电脑有**随时间变化的壁纸**（早上亮、夜里暗），制造"它有自己的时间感"。**（A，官方设计稿）**

### 2.3 连接器（Connector / MCP）

- 插件 = Connector，入口在侧栏 **Connect apps**（旧名 Marketplace / Plugins）；**手机端**点左上角头像再选插件。**（B，grokguide.si 社区教程，引官方链接）**
- **插件是账号级的**：添加一次，所有 Bot 都能用。**（A，官方文档）**
- 已内置/官方支持的集成：**Gmail、Outlook、Google Calendar、Google Drive / Docs / Sheets / Slides、SharePoint、Slack、Notion、Zoom、Linear、X**；另有 GitHub、Sentry、PagerDuty、MS Teams、1Password。**（B，aiagent.nl + A-，泄露 skills）**
- 状态机：Needs auth / Authorized / Connected / Disconnected / Disabled by team admin。**添加 ≠ 授权。**
- 限制：Gmail **一次只能连一个邮箱**（个人与工作不能同时连）；Slack 以**你本人身份**发消息；Notion 等支持多账号；公司 Google 账号可能需管理员批准（Grok Bot 以 "Grok" 应用身份登录 Google）；**不连 X 账号也能搜 X 公开内容**。
- 已知问题：桌面端连 Zoom 报 `4700 Invalid redirect`，无法绕过。

### 2.4 触发器与调度（Routines）

**调度：5 字段 cron，按用户本地时区解释；最快间隔 5 分钟。**（A-，泄露 skills/routines.md）

- 支持 `@hourly` / `@daily` / `@weekly` / `@monthly` / `@every 30m`；可用前缀 `CRON_TZ=<IANA zone>` 固定时区。
- 官方**明确反对** `*/30`、`0,30` 这类"从 :00 起算"的分钟字段，要求写成显式分钟列表或相位偏移（例：`@every 30m/17m`）。
- 命名小时无分钟（"8am"）时，取当前分钟落在该小时 ±15 分钟内，并**告知用户实际保存时间**；只有用户说 "8 sharp/on the hour" 才存整点。
- Routine 的 prompt 必须写成**意图**而非冻结的工具调用配方；**结尾必须有一行平语**写明"结果给谁、送到哪、没有新内容时怎么办"，且不点名工具。

**事件触发器清单**（A，官方设计稿 + A- 泄露 skills）：

- **Slack**：@Bot、关键词命中、表情回应、新消息
- **GitHub**：issue 创建、PR 打开/合并/关闭、推送到 main、PR 检查失败、加 bug 标签、评论含 `/fix`、review 通过、workflow 失败
- **Bot 专属邮箱**
- **Webhook**：POST + `Authorization: Bearer <key>`，返回 200 只代表"已接收"
- **Linear / Sentry / PagerDuty / MS Teams**

官方警告：**不要用"每条新消息都触发"这类宽泛规则。**

**硬性限制**：每 Bot 最多 50 个 Routine；每 Routine 只保留最近 20 次运行记录；两次运行间隔 ≥5 分钟；删除 Bot 连带删除其 Routine；长期不登录时 Routine 可能被暂停；新建 Routine **不会立即运行**，需手动点 Test（真执行、扣额度）。**（A）**

### 2.5 多 Bot 协作

- **群聊 2–6 个 Bot**（A，官方设计稿）；@名字 指定发言对象。**（A）**
- **主 Bot（primary Bot，侧栏星标）**：主动来找你并协调其他 Bot；首次启动弹 "Introducing your primary Bot"（Create primary Bot / Choose an existing Bot → Confirm）；替换路径：侧栏右键 → Replace with different Bot；**共享 Bot 不能设为主 Bot**。**（B，社区教程）**
- **Bot 间通信 `SendToAgent(target_id, message, priority)`**：异步像发短信，立即返回；`priority=true` 立刻唤醒对方（需对方行动/有交接/停下改计划），`false` 不唤醒（信息性/状态/感谢），对方下次回合开头读到；群发总是立即送达；可带 images（file:// 或 https://）。**（A-，泄露系统提示词 1.22）**
- **用量**：每一条 Bot 回复都计用量，**包括群聊里的回复与 Bot 之间的消息**。社区反馈：4 个 Bot 开场即吃掉 25% 额度，5 个 Bot 一天用完周额度。**（D，但多帖重复）**
- **没有"禁止 Bot 互相发消息"的开关**，只能靠指令 + 让它记住。**（B，社区教程）**
- **共享 Bot / Team Bot**：公开分享链接只复制配置，**不共享电脑与登录**；共享 Bot 里 owner 加的 app/secret/skill/文件对每个同事的会话都生效；**共享 Bot 不支持 Vault**（改用 Bot 详情 → Secrets，只写不读）。**（A）**
- 云端 Bot 之间交接 **≠** 本机程序与 Grok Bot 通信（后者需本地 BDK）。**（B）**

### 2.6 教学与固化：Teach a task

- 打开电脑画面 + 一对一对话时可用；**最长 10 分钟、不录麦克风**；录完生成的是**技能草稿**（不是成品）；官方标注 gradual rollout。**（A，官方文档）**
- 价值主张（社区）："录一遍 → 变成技能 → 变成定时 routine"，杀死自动化中最大的成本——**描述工作流**。**（B-/D，Vestra 创始人等多个来源）**

### 2.7 语音

- **听写**（输入框语音转文字，快捷键 Cmd/Ctrl+D）；**实时语音通话**（由第二个 agent 承载，以 `[inbound]` 消息从 `voice:<call>` 地址进来，回复必须 channel 指向该地址、纯文本）；**语音备忘录**（`SendToUser type:text + voice_memo:true`，内容要写成完整口语句、无列表无 markdown）。**（A-，泄露 skills/voice.md）**
- iOS 15 Pro 及以上的 Action Button 可一键语音。**（A-，泄露 recent-changes.md 2026-10-19）**

### 2.8 产物与回答形态

- **内建 inline card / widget**：散文适合就用散文，不适合就用结构化 UI（邮件草稿卡、表格、图表、slides）。**（A，官方设计稿）**
- **异质时间线**：对话、系统事件（创建了 routine、改了设置、给另一个 Bot 发了消息）、可交互对象、可视化**共享同一条 transcript**，有细节可展开。**（A，官方设计稿）**
- 附件：单文件 ≤25MB、视频 ≤200MB、一次最多 6 个。**（B，社区教程）**
- Slides 能力有专门的技能文件（slides.md 15KB / slides-executor.md 24KB）。**（A-，泄露 skills）**

### 2.9 记忆

- 位置：`/tmp/sand-prompt-capture/memory`；`profile.md` 存"用户是谁"（**每回合都带上**），`log/` 存带日期的历史。**（A-，泄露系统提示词 1.20）**
- 工具：`RecallMemory` 检索；`UpdateMemory` 写入（tier: profile / log / note）或 `forget`（给出原文）。**（A-）**
- **记忆是 Bot 级而非账号级**（官方设计稿的明确边界）。**（A）**
- 注意：**Grok 聊天记忆 ≠ Grok Bot 记忆**，两者不互通。**（D，用户帖）**

### 2.10 入口矩阵

| 入口 | 状态 | 限制 | 可信度 |
|---|---|---|---|
| 桌面 App（macOS/Windows/Linux） | 主力管理端 | Teach-a-task 与编辑 routine **只能在桌面完成** | A/B |
| iOS / Android | 同一套 Bot/会话/routine 实时同步 | Android 仅支持文本；应用内订阅仅月付个人档 | B |
| 群聊 | 2–6 Bot | 见上文 | A |
| Slack | 三种用法：以本人身份发帖 / 事件触发 / Team Bot 独立 Slack App | 个人 Slack 只能向 owner 的 DM 发消息 | B |
| X Chat | 可用 | — | B |
| X 上 @bot | 可用 | **需 X 与 Grok 账号关联 + 有 Bot 权限 + 已建 Bot**；共享 Bot 不能接收；**澳大利亚、英国、欧盟、冰岛、列支敦士登、挪威不可用，开 VPN 无效**；同帖也 @grok 时不响应；帖内有视频/GIF 时不响应；周额度用完时不响应 | A |
| 网页 grok.com | 部分 SuperGrok Heavy 用户 | 2026-09-19 起灰度 | B |
| Linux 桌面 | 需装 Grok Build 后走 TUI | 无官方 GUI 之外的等价路径 | C |

### 2.11 v1.0.x 阶段新增能力（2026-11，做对标时的"最新面"）

以下五项在 2026-11 的 v1.0.1 前后上线，是本报告初稿之后补入的增量，**均与"云电脑"耦合度低或无关，属可对标范围**：

| 能力 | 内容 | 关键限制 | 对标价值 | 可信度 |
|---|---|---|---|---|
| **Pages / Library** | Pages 可多人共同编辑、Bot 可代为保持更新；Library 汇集 pages / files / links，按 **Today / This week / Older** 分组 | 表格预览上限 **10,000 行** | ⭐⭐⭐ **高**。这是 Grok Bot 唯一的"产物归档"面——DSH 的产物是工作区文件 + 会话附件，**没有"最近交付物"的统一入口**。见 02 文档 F 域 | B |
| **语音** | 语音输入、语音留言、与单个 Bot 的实时语音通话 | **不支持群聊**；同时只能一通 | ⭐ 低。DSH 已有 `dsh-experimental-voice-input-bundle` 与 `dsh-speech-to-text-sensevoice`，实现形态不同（无实时通话） | A |
| **电话代打** | Bot 代你拨打客服电话、走 IVR、等待、与真人对话、实时转写、通话后摘要 | **仅美国号码，Washington 与 Illinois 除外**；须先声明是代表用户拨打的 AI；禁止营销/批量外呼 | 🚫 **不可对标**（需 PSTN 端点，属厂商侧托管服务） | B |
| **会议参会** | 从链接加入 Google Meet / Zoom / Microsoft Teams，在会议聊天里用**文字**回答，会后发摘要 | 仅 Team / Enterprise / Ultra；**不以语音发言** | ⭐ 低-中。技术上 DSH 的 CUA 可加入会议（操作本机浏览器），但"代表用户参会"是社交风险不是技术风险 | A |
| **私有网络** | 经成员桌面路由，或 Enterprise 用 Team Setup 装网络客户端（Tailscale / Cloudflare Tunnel / VPN / 零信任） | `Network Controls` 仅 Enterprise | ⭐⭐ 中。DSH 本机执行天然在用户网络内，**这个问题在 DSH 不存在**——反过来说，这是 DSH 的结构性优势，值得在文档里显性写出来 | A |

**【判】** 这五项里只有 **Pages / Library** 值得进需求列表（见 03 文档的补充说明：产物归档面），其余三项要么需要厂商侧端点（电话）、要么在 DSH 形态下问题不存在（私有网络）、要么价值低（语音/会议）。

---

## 3. 使用场景

### 3.1 官方内部案例（最有说服力的一组数据）

来自 LISA 第三方调研的整理（**B**，标注为 [官方]/[实测]）：

| 场景 | 量化结果 |
|---|---|
| 客服 | 工单量 **+175%** 而未增员（称否则需多招约 200 人）；单工单成本 **$0.20–0.30**，对比传统 **$1–4**；**99% 退款请求无人干预** |
| 用户反馈分析 | 每天聚类 **2 万+ 条**反馈 |
| 工程"外环" | Bot 作为外环管理 Cursor Cloud Agents（派发、读运行记录、查截图证据、排队追加消息或中断）；每 30 分钟巡检 PR（Bugbot 意见 / CI / 合并冲突），低影响高置信 PR 自动合并；有工程师称可同时管理的 cloud agents 从 **15 → 200+** |
| 销售 | Bot 录 CRM + 写跟进邮件 |
| 工程复现 | Bot 复现 bug + 建 ticket |

### 3.2 典型使用场景分类

| 类别 | 场景 | 人参与程度 |
|---|---|---|
| **流式执行类** | 销售外呼/跟进、招聘筛选、报销单据、数据录入、票据整理 | 低（草稿 + 抽查） |
| **监控巡检类** | 竞品/舆情/行业监测、PR 巡检、CI 失败归因、客服工单分流 | 低（异常才介入） |
| **研究整理类** | 竞品调研、政策追踪、会议纪要、资料汇编 | 中（需核对来源） |
| **跨系统搬运类** | 没有 API 的站点操作、SaaS 间同步 | 低 |
| **需要人拍板类** | 对外发送、付款、发布、改权限、改生产环境 | 高（强制审批） |

### 3.3 官方推荐的任务描述模板（五段式）

**Outcome / Sources / Constraints / Deliverable / Review point**——即"要什么结果 / 从哪取信息 / 有什么限制 / 交付成什么形态 / 在哪里停下来等我确认"。**（A，官方文档 + B 社区教程）**

### 3.4 不适合的场景（从社区失败案例归纳）

- **强一致性、强审计的财务/合规动作**（无法证明"它没做什么"）。
- **需要长期稳定执行的关键定时任务**（第 1 天后可靠性崩塌的报告集中在此）。
- **需要精确判断的公开信息结论**（有 Bot 把被封锁的页面误判成"许可被拒"并忽略公开的批准文件）。
- **多任务混在一条线程里的复杂编排**（有报告称只做了最后一项）。

---

## 4. 交互流程

### 4.1 单回合的机械结构（这是理解 Grok Bot 一切交互的钥匙）

**（A-，泄露系统提示词 1.1；这条比任何 UI 截图都重要）**

> **`SendToUser` 是唯一对用户可见的输出；纯 assistant 文本是私有的。**

一个回合分三步：

1. **Respond** —— 先发一条文本回应，**再干活**。回应要写成"我正在做什么"，而不是"我还不知道"。
2. **Work** —— **里程碑式简报**，不做逐命令旁白；**绝不提 message id / 工具名 / system reminder**。
3. **Finish** —— **所有结果与附件发完之后**才 `end_turn:true`。

内部叫 "box"，**对用户永远说 "my computer"**。**（A-，1.1）**

> 💡 这条机制直接决定了一个对标产品必须回答的问题：**"过程可见性"到底由谁产生**——是模型的自觉汇报，还是系统的强制事件流。Grok Bot 选了前者（模型自觉），代价是第 11 章里"侧栏状态说谎"这类信任问题。

### 4.2 首次使用 / 新建 Bot 的流程（官方 demo 六步，可直接当交互范本）

**（B，LISA 调研引官方首页演示）**

1. 新 Bot **自我介绍**并询问用途；
2. 用户交代"夜间外呼"；
3. Bot **自动改名**为 "Sales Outbound"；
4. 检查已连接的 Hex / Gmail / LinkedIn；
5. **请用户在其云电脑上登录 Salesforce**（登录属于 Bot 可以自己做的动作，但需要凭据）；
6. 拉取 52 个账户、生成 36 条草稿（明示"**未经你过目不发送**"）；
7. 用户回"前 10 条可以，发吧，每周跑一次" → Bot **当场建好 routine**。

**这条流程里可复用的产品手法**：让 Bot 自己承担"配置"这个动作（改名、选场景、查连接器），把用户的工作压缩成一句自然语言的验收。

### 4.3 审批流程

**（A，官方文档 2026-10-30 版）**

- **Auto Review 检查每一个动作**（跑命令、用连接应用、用电脑）。
- **关键判定原则**：只有当动作**匹配用户消息里真正要求的内容**才放行；**来自邮件/网页的文本不算用户请求**（这是防提示注入的核心）。
- **卡片三按钮**：`Allow once`（不存规则）/ `Always allow`（存为 Custom Rules 的 Allow 规则，卡片显示 Saved to Custom Rules）/ `Deny`（不再试也不再问，直到用户发新消息）。
- **终端命令卡**按钮为 `Allow` / `Skip` + Manage settings；被 Ask first 规则拦下的卡片为 `Allow` / `Not now` + Edit rule。
- **警告文案三类**："This can't be undone" / "This changes sign-in or security settings" / "This shares your data outside this chat"。
- **超时**：聊天内发起的卡片**永不超时**；routine / 外部消息 / 后台工作引发的卡片 **30 分钟后过期**（社区教程写 10 分钟，以官方为准）→ 卡片显示 Expired，操作不执行。
- 发新消息会**关闭该会话所有开着的卡片**；改 Auto Review 设置也会关闭。
- **邮件特例**：聊天里要的邮件经 Auto Review 放行即发出；来自 routine / 收到消息 / 非该请求发起的工作，邮件**以草稿等待用户按 Send**；转发或附件 Auto Review 读不全时一律等确认。
- **群聊/共享 Bot 特例**：每个同事在自己会话里为自己的请求应答；Slack 线程里卡片只有 Allow once / Deny / View details 且**只有提问者能答**；群聊里**只有 Bot 正在回复的那条消息的作者能批准**，其他人看到"在等谁"，且**群聊卡不提供 Always allow**。

**审批的四条限制（A，官方文档）**：

1. `Allow once` 与 `Always allow` 语义严格不同，后者会沉淀成规则。
2. **`Stop` 不撤销已产生的副作用**（Stop now 只是停止继续）。
3. Auto Review **不覆盖记忆写入与多数设置变更**。
4. 企业可**强制 Enforce Auto-review**（默认关闭，目录组可例外）。

### 4.4 接管（Takeover）流程

1. Bot 卡住 → 点开电脑画面 → **Take over**；
2. 用户自己完成那一步；
3. 点 **"I'm done"** 交还；
4. **告诉 Bot 继续**。

**（B，社区教程）** 注意：**指纹/面容/Windows Hello/本机 passkey 在云电脑里用不了**——这是接管的常见触发原因。

### 4.5 Teach a task 流程

打开电脑画面 → 开始录制（≤10 分钟、不录麦克风）→ 演示一遍 → 生成**技能草稿** → 人工编辑 → 保存为 Skill 或 Routine。**（A）**

### 4.6 Routine 的创建与验证流程

自然语言描述"每周一早上 8 点做 X" → Bot 转换为 cron 并**回读实际保存的时间** → 用户确认 → 手动 `Test`（真执行、扣额度）→ 上线。**（A-/A）**

### 4.7 群聊回合规则

**（A-，泄露 skills/group-chat-turns.md）**

- 带 `[Group chat: "..."]` 前缀的是群聊回合（无前缀 = 私聊）。
- **群聊里的工具调用与纯文本都是私有草稿**，必须用 `SendToUser` 才算真正发言。
- **不调用 = 保持沉默，且"沉默是一等公民"**（不发言是完全正当的选择）。
- 每条 **1–3 句**，单回合最多 **3 条**消息；可用 `@Name` / `@everyone`。
- 不要复述别人的话；不要去翻队友的私聊、记忆或文件。

### 4.8 错误与异常的呈现

- 应用内错误显示在**输入框上方的 Notifications 区**，可单条 dismiss 或清空；部分带 Copy request ID。**（A，官方文档）**
- **bot 无响应**、**电脑升级卡住**是已发生过的真实事故形态（见 12.4）。

---

## 5. 界面布局

### 5.1 桌面端主界面：三区 + 一浮层

**（B，grokguide.si 社区教程，与 A 级官方设计稿互相印证）**

```
┌──────────────┬─────────────────────────────────┬──────────────┐
│ 左侧边栏      │ 中间聊天区                        │ 详情面板(可开)│
│              │                                 │              │
│ [新建] [搜索] │ ┌─ 标题栏: Bot 名 ▾  [状态图标] ─┐ │ 电脑实时预览  │
│              │ │                                │ │   ↓ 点击全屏 │
│ ▸ 群聊列表    │ │  transcript (异质时间线)         │ │ Routines 列表│
│ ▸ Bot 名册    │ │   · 对话气泡                    │ │ Channels     │
│   · 主Bot★    │ │   · 内联卡片(邮件/表格/图表)      │ │ 群聊 Members │
│   · Bot A     │ │   · 系统事件(建了routine/改设置)  │ │              │
│   · Bot B     │ │   · 可展开的细节                 │ │ [齿轮] 单Bot │
│              │ └────────────────────────────────┘ │      设置    │
│ ─────────────│ ┌─ Notifications 错误区 ─────────┐ │              │
│ [连接应用]    │ │ 输入框 (文字/语音/附件)          │ │              │
│ [账号按钮]    │ └────────────────────────────────┘ │              │
└──────────────┴─────────────────────────────────┴──────────────┘
```

要点：

- **侧栏名称改过多次**（"Marketplace" → "Connect apps"），是理解老教程/老截图的坑。
- **没有齿轮图标**，设置入口是**左下角账号按钮（头像 + 账号名）**。
- **侧栏状态区分三类**：Needs attention（有问题/审批/交接）、Unread activity（有新结果）、Working/typing；打开会话即标记已读；Bot 菜单可手动标记已读/未读。**（A，官方文档）**
- **详情面板**：点聊天标题里的 Bot 名或 `Cmd+Shift+I` 打开，X 关闭；**内容顺序固定**为：该 Bot 电脑实时预览（点击全屏）→ Routines 列表 → Channels（有 channel 连接器时）→ 群聊 Members；**X 旁的齿轮**开 per-Bot 设置子页。
- **删除 Bot 只能侧栏右键 → Delete**（永久删除，含 transcript，有确认）；**无归档、无隐藏**。

### 5.2 云电脑的三级可见性（本报告最重要的布局原则）

**（A，官方设计稿）** 他们试过四种布局并记录了各自的问题：

| 方案 | 问题 |
|---|---|
| 浮动窗口 | 容易够到，但**盖住对话** |
| 左右并排 | 工作持续可见，**鼓励用户一直看着** |
| 模态弹窗 | 查看方便，但把工作区当成**临时打断** |
| 全屏 | 空间充足，但**完全挤掉对话** |

最终方案是**三级访问**，让用户能进入工作区而不被拉进去操作它：

1. **Status** —— 电脑活跃时，**标题栏图标变紫**；
2. **Preview** —— 打开后是**固定的侧面板**，不离开对话就能跟进；
3. **Takeover** —— Bot 需要帮助时**全屏接管**，处理完再交还。

原文结论（值得原样记住）：**"我们把电脑做得越显眼，产品就越是在鼓励用户去监督它。"**

### 5.3 移动端

- 同一套 Bot / 会话 / routine **实时同步**；可派活、审批、看屏幕、接管登录、暂停删除 routine；iOS 有分享扩展（图片/文件/链接），Android 只支持文本。
- 实测者评价：手机更像**"派活入口"**而非管理端。**（B）**

### 5.4 外部入口的界面

- **Slack**：以本人身份发帖；审批卡在 Slack 线程里只有 Allow once / Deny / View details（只有提问者能答）。
- **X**：帖下 @bot 提及。

---

## 6. 信息架构

### 6.1 主对象的选择：从"会话列表"到"Bot 名册"

**（A，官方设计稿）** 官方对 chat 的判断很直接：会话是**一次性**的，"你几乎不会回看最近五条以外的任何会话"；当对面那个东西应该认识你、记得之前的工作、长期承担责任时，这变得很奇怪。所以**主对象是 Bot，不是对话**。

**这个切换改变的是责任的归属方式**：会话列表里责任在每次提问上；名册里责任在一个持续存在的角色上。

### 6.2 状态的三层结构

**（A，官方文档）** Grok Bot 的状态分三层，这是它与其他 Agent 产品最不一样的信息架构：

1. **Bot 状态**：名称 / 岗位 / 对话 / 摘要 / 偏好。
2. **云电脑状态**：文件 / Cookie / 登录 / CLI 凭据。
3. **企业连接器状态**：OAuth + MCP。

> 📌 这条三层结构是**"删除 Bot ≠ 清理数据"**的根源：删 Bot 不删共享电脑的文件与浏览器会话。**（A，官方文档）**

### 6.3 归属边界（一条可直接抄的设计原则）

**（A，官方设计稿）**

> **Tools 和 Skills 属于账号级**，因为很多 Bot 都需要浏览网页、处理文档、发邮件。
> **Memory 和 Routines 属于 Bot**，因为它们反映了这个角色随时间知道什么、做什么。
> 换句话说：**能力可以广泛共享，上下文留在需要它的角色那里。**

理由给的是信息质量：法务 Bot 需要争议历史，财务 Bot 需要多年财务记录，合成一个大记忆反而更难给每个 Bot 相关信息。

> ⚠️ **这条边界同时是一份权限模型，而官方设计稿完全没有从这个角度谈它。**"Tools 属于账号级"翻译成安全语言就是：**哪个 Bot 能发邮件？全都能。** 一篇讲"Agent 会在你不在场时开工"的设计稿里，没有出现 permission / approval / audit 这类词。

### 6.4 数量上限（信息架构的隐性约束）

| 约束 | 数值 | 可信度 |
|---|---|---|
| Bot / 账号 | **~50** | A（官方设计稿，性质未明：硬/软/临时） |
| Bot / 群聊 | **6**（下限 2） | A |
| Routine / Bot | **50** | A |
| 运行记录保留 / Routine | **20** | A |
| Routine 最小间隔 | **5 分钟** | A |
| Auto Review Allow 规则 | **20 条**，每条 ≤1000 字符 | A |
| Auto Review Ask first 规则 | **20 条**，每条 ≤1000 字符 | A |
| 附件 / 次 | 6 个（单文件 ≤25MB，视频 ≤200MB） | B |
| Teach a task 录制 | **10 分钟** | A |

### 6.5 缺失的信息架构（重要，做对标时的机会点）

**（B-/C，社区口碑汇编明确记录"nothing found"）**

- **没有独立的 review-list 界面**（没有"所有待我批准的动作"收件箱）。
- **没有 dry run**。
- **没有"Bot 不在时干了什么"的可用审计日志**（只有聊天记录可翻）。
- 没有归档 / 隐藏 Bot。
- 不支持"每个 Bot 多条线程"（用户明确在要）。

---

## 7. 视觉风格

### 7.1 头像系统：身份 + 状态二合一

**（A，官方设计稿）**

- 目标：名册变长后，用户应能**靠余光从头像认出来**，同时头像之间要**足够统一，读起来像同一个系统**。
- 探索过：首字母、emoji、像素画、水彩、粘土质感、线描、剪影、identicon。结论：**水彩和粘土给了单个 Bot 足够个性，但在侧边栏尺寸下细节太多；更简单的系统在界面里更自然，却让 Bot 们看起来可以互换。**
- 最终方案：**基本构造统一（简单形状 + 有表情的眼睛），差异化靠受控的变体和配饰**。
- **六种状态**：`idle`、`thinking`、`working`、`waiting`、`blocked`、`done`。状态被塞进同一个头像（不做独立指示器），让它自己承载生命周期：静止时安静而略带好奇，任务到达时确认，开始工作时进入状态，等待或需要帮助时动作再变，完成后归于平静。
- 图标本身由 **Grok Build 生成代码动画**，状态/形状/表情可**平滑 morph**。**（B，gigazine）**

### 7.2 一条关键的克制决策：不展示执行细节

**（A，官方设计稿）**

- 先否定了"三个跳动的点"：信息太少，用户分不清 Bot 是在工作还是卡住了。
- 试过**显示当前动作的一句话描述**，结果：**"一旦人们能看到一步，他们就想看到其余所有步。"**
- 用户研究的解释：大家要这些细节，主要是为了**确认它还在跑、方向没错——是要"安心"，不是要"控制"**。
- 最终：**头像动效提供第一层安心；想知道具体在干什么，悬停才看当前动作。**

> ⚠️ 这段推理有一个隐含替换：**用户要的是安心 → 所以我们给安心，而不给信息。** 动效是**不可证伪的**——死循环的 Agent 和稳步推进的 Agent 在头像层面长得一模一样。

### 7.3 主题与配色

- **外观**：Follow System / Light / Dark。**（A）**
- **强调色（Accent）**：可选，**每个 Bot 可以用自己的颜色**，或统一用黑色。**（A，官方文档 Settings → Appearance）**
- **语言**：20+ 种，含简体/繁体中文。**（A）**
- **动态壁纸**：Bot 的电脑壁纸**随一天时间变化**（早上更亮，夜里更暗），理由是让 Bot 的电脑有**自己的时间感**，和用户的桌面区分开。**（A）**

### 7.4 回答的形态即设计

- **inline card / widget** 内建；早期版本"几乎什么都用散文回答"，用户拿到后还得自己重新结构化一遍。**（A）**
- **transcript 是异质的**：对话、系统事件、可交互对象、可视化共享同一条时间线。
- 官方给出的原则：**"当 Agent 会自主执行动作时，transcript 就不再只是聊天记录，而是审计日志 + 控制面板 + 对话的合体。"**

### 7.5 状态视觉的缺陷（社区反馈，直接对应设计稿的赌注）

- **侧栏状态说谎**：显示 "working"，实际在**等审批**。**（D，多帖）**
- 建线程后"像清空了聊天且无法返回主会话"；审批卡落在主会话而用户正盯着线程。

---

## 8. 导航结构

### 8.1 导航层级

| 层级 | 元素 | 备注 | 可信度 |
|---|---|---|---|
| L0 顶层 | 左侧边栏（所有 Bot 与群聊列表） | 顶部"新建" + "搜索"，底部"连接应用"入口 | B |
| L0 账号 | 左下角账号按钮（头像 + 账号名） | **设置唯一可见入口** | A |
| L1 | 聊天区（当前 Bot 或群聊） | 底部输入框 | B |
| L1 | 详情面板（per-agent） | `Cmd+Shift+I` 或点标题里的 Bot 名 | A-/B |
| L2 | per-Bot 设置子页 | 详情面板 X 旁的齿轮 | A-/B |
| L1 | Settings 对话框（5 个标签） | `Cmd+,` / 命令面板 "Open settings" | A |
| L1 | Connect apps（含 Private skills） | 侧栏底部；点标题旁的"已连接数量" | A |

**关键反常识点（A-/A）**：
- **没有齿轮图标**；
- **没有 macOS Preferences 菜单项**；
- **删除 Bot 不在 Settings 里**，只能侧栏右键；
- **Connected apps 不在 Settings 里**。

### 8.2 命令面板

存在命令面板（Command palette），可执行 "Open settings" 等动作。**（A-，reference/app-ui.md）**

### 8.3 快捷键

| 动作 | 快捷键 | 可信度 |
|---|---|---|
| 语音输入 / 听写 | `Cmd/Ctrl+D` | B |
| 打开 per-agent 详情面板 | `Cmd/Ctrl+Shift+I` | A-/B |
| 打开 per-Bot 设置 | `Cmd/Ctrl+Shift+,` | A |
| 打开设置 | `Cmd+,` | A- |

### 8.4 深链

设置页内部 URL 形如 `grokbot://app/v1/settings?id=theme`——说明它是 **Electron 桌面应用**，且**每个设置项都有稳定锚点 id**。**（A-，reference/app-ui.md）**

> 💡 这个"每个设置项一个 id"的做法对做插件的人很有用：它意味着设置项可以被**程序化定位、被文档直接链接、被引导流程跳转**。

### 8.5 导航结构的缺口

- 无归档 / 隐藏 Bot。
- 无"待我审批"收件箱。
- 无审计日志页。
- 无"每个 Bot 多条线程"。

---

## 9. 设置项

### 9.1 Settings 对话框的五个标签

| 标签 | 何时出现 | 锚点行（内部 id） | 可信度 |
|---|---|---|---|
| **General** | 常驻 | account / theme / accent / language / spell-check / microphone / hardware-acceleration / hardware-acceleration-restart / network-debugger / notification-sound-enabled / notification-sound / timezone / auto-review / auto-review-rules / security-keys | A |
| **Computer** | 常驻 | local-execution / computers / update-computer / reset-computer | A |
| **Vault** | 仅账号启用时 | — | A |
| **Usage & Billing** | 仅账号启用时 | usage / plan / cancel-trial / on-demand / billing | A |
| **Updates** | 常驻 | update-status / update-channel / automatic-updates | A |
| （Team Setup Scripts） | 仅 Enterprise，管理员在 Cursor dashboard | 成员看不到 | A |

### 9.2 General 逐项

**（A，官方文档 2026-10-29 版）**

- **Account**：登录/登出 Cursor 账户、Get Grok Bot for mobile、Support → About 显示版本、Switch account / Add account / Remove。
- **Appearance**：Follow System / Light / Dark；**Accent（每个 Bot 自己的颜色或黑色）**；Language（20+ 含简繁中文）；Check Spelling While Typing（默认开）。
- **System**：Microphone；Use hardware acceleration（默认开，Linux 关，附 Restart Now）。
- **Bot**：Timezone；Auto-review 开关 + Custom Rules；**"Grok Bot manages model selection, so there is no model picker"**；Import Memory。
- **Auto-review**：个人规则 + 管理员锁定的团队规则。
- **Security Key**：硬件安全密钥（YubiKey），macOS/Windows 默认开、**Linux 不支持**，每次使用都要批准。

### 9.3 Computer 页逐项

**（A）**

- **Your computer**：Manage devices（可重命名 / 改执行策略 / 离线时移除；**手机不可移除**）；**Execution on this computer**：`Ask every time`（默认）/ `Always allow` / `Never allow`；**Route traffic through this computer**（让 box 流量走本机出口，**仅一个桌面能路由**，私网/VPN 地址默认被拦并显示本次会话拦截数量，Enterprise 管理员可关 `Allow Local Egress Routing`，关闭后 5 分钟内路由停止）。
- **Bot's computer**：
  - **Update**（按钮 "Update"）：把 box 迁到新实例，**保留文件与登录**，但**已装软件需重装**（node_modules、Python venv 都要），**两次点击确认**（"Click Again to Confirm"）。
  - **Reset**（按钮 "Reset"）：从最近快照恢复，**会丢最近未同步工作**，仅最后手段，官方明确 "never direct the user to it"。

### 9.4 Vault

- `New item` / `Import`；支持 Login / Card / Contact info 三类。
- 可从 **1Password / Chrome / Edge / Safari / Firefox / Bitwarden / LastPass 导入 CSV**（**本地读取、<5MB**），需 App 0.75.2+。
- **Vault 条目对账号下每个 Bot 可用，不能限定单个 Bot。**
- **共享 Bot 不支持 Vault** → 改走 Bot 详情 → Secrets（环境变量名 + 描述 + 值；**描述可见、值不可见，只写不读**，改值用 Replace）。

### 9.5 Usage & Billing

weekly included usage、on-demand、Manage Plan / Billing。**（A）**

### 9.6 Updates

- 版本号、`Check for Updates`、`Restart to Update`、**Automatic Updates 默认开**——触发条件是：**屏幕锁定或屏保、空闲 ≥10 分钟、Bot 不忙**；Linux .deb/.rpm 走系统包管理器，无此开关。**（A）**

### 9.7 per-Bot 设置

- 点聊天顶部 Bot 名（View conversation details）可**改名 / 改 label / 换头像**；**个人 Bot 没有 description**（要改行为只能在聊天里说）。**（A）**
- 详情面板齿轮 → per-Bot 子页：头像、名字、title、description、**per-assistant 通知开关**。**（A-）**

### 9.8 通知

- **per-Bot Notifications 开关**。
- 桌面端在用时（打开且已登录、屏幕解锁、最近有使用、系统允许横幅）**通知走桌面而非手机**；焦点窗口只对该 Bot 静默，其它 Bot 仍弹；**已完成的回复不推手机**；**Bot 需要输入时约 3 分钟后才推手机**；Linux 一律在聚焦时抑制。**（A）**

### 9.9 Connect apps（不在 Settings 里）

侧栏底部 → 点标题旁的"已连接数量" → 管理已装应用与 **Private skills**。**（A）**

---

## 10. 权限与限制

### 10.1 Auto Review 是一个"审查层"而不是"确认框"

**（A，官方文档）**

- 被自动审查的动作类型：**Shell、computer actions、MCP 调用、写 routine、CloudAgent 启动/回复**。**（A-，1.12）**
- **被拦时先找更安全的等价路径**；**禁止**用抓 cookie/token、手工驱动已登录会话、编码/改名/拆命令、绕道内部 API 等方式绕过。**（A-，1.12）**
- 确需原动作则带 `request_smart_mode_approval:true` + `smart_mode_block_reason` 重试；Computer / CloudAgent 被拦会**自动弹卡**。**（A-）**
- **一次只申请一个审批；拒绝或过期对该动作是终局。**

### 10.2 规则规格（可直接当需求写）

| 项 | 规格 | 可信度 |
|---|---|---|
| Allow automatically 规则上限 | **20 条** | A |
| Ask first 规则上限 | **20 条** | A |
| 单条规则长度 | **≤1000 字符** | A |
| 冲突判定 | **Ask first 优先** | A |
| Allow 满 20 条时 | 新的 Always allow **挤掉最旧的一条并告知** | A |
| 规则存放位置 | **账号上（跨桌面与手机同步）**（注意：早期社区说法是"规则不跨设备"，官方 2026-10 文档为准） | A |
| 管理员强制 | 开关锁定显示 `Required by your admin`，团队规则同表不可编辑 | A |
| 团队 vs 个人 | **团队规则永远生效，个人规则只能更严** | A |

### 10.3 必须人工拍板的七类动作

**（B，社区教程归纳，与官方审批文案一致）**

1. 发消息或邀请
2. 发布内容
3. 购买和转账
4. 删除或覆盖数据
5. 改权限
6. 改生产环境
7. 接受法律条款

### 10.4 密钥与凭据的路径优先级

**（A，官方文档）**

1. **Vault**（Login / Card / Contact）
2. **已连接的密码管理器**（如 1Password）
3. **聊天内 Secure Form**（原生表单，值 write-only、**连模型都看不到**、回执只报每字段填充状态）

补充（**A-**，泄露 skills/in-chat-forms.md）：

- 页面需要用户输入（登录/收货地址/卡号/电话/OTP）时**必须**用 `RequestUserForm` 弹原生 Secure Form，**绝不让用户在聊天里粘贴**。
- **secret 字段的回执即验证，绝不允许截图去核对 secret 字段**（结构化快照会脱敏，截图不会）。
- iframe（含跨域 Stripe/Shopify 卡框）与 shadow root 内的字段也能定位。
- `request_box_help` 只留给表单表达不了的步骤：CAPTCHA（先让子代理自己试，含按住式 I'm-human）、passkey、3DS、二维码、设备审批、自定义控件。
- **Vault 里存的卡在结账时自动填充、不再逐笔确认**；要逐笔确认就别勾 "Securely save to Bot's vault" 或不存卡。

### 10.5 共享电脑的安全边界（最容易被误读的一条）

**（A，官方文档）**

- 所有 Bot **共用一台云电脑**，文件 / 浏览器会话 / CLI 凭据跨 Bot 可用。
- **不要用不同 Bot 当安全边界。**
- 公开分享链接只复制配置，**不共享电脑与登录**。
- 共享 Bot 里 owner 加的 app / secret / skill / 文件对**每个同事的会话**都生效。
- **删除 Bot 不会删除共享电脑的文件与浏览器会话。**
- 清理访问的正确姿势：暂停/删除 routine、在共享电脑上登出网站、卸载连接器并在源服务撤销授权、从 /workspace 删敏感文件、隐藏或删除 Bot。

### 10.6 双通道策略（两个互相独立的闸门）

**（A，官方文档）**

| 通道 | 管什么 | 谁能配 |
|---|---|---|
| **连接器策略** | MCP allowlist | **企业版** |
| **网络策略（Network Controls）** | Bot 能访问哪些域名 | **仅 Enterprise** |

关键：**禁用插件后仍可走浏览器访问同一网站**——两条通道是独立的，只关一条不构成封堵。Teams 套餐无网络控制 → **默认 allow-all**。官方出站 IP 是**客户共享、非独享**。

### 10.7 套餐能力差异

| 能力 | Teams | Enterprise |
|---|---|---|
| Team Rules | ✅ | ✅ |
| Cloud Agent delegation 开关 | ✅ | ✅ |
| Public template sharing | ✅ | ✅ |
| Connector policy | ✅ | ✅ |
| Execution on Local Computer | ✅ | ✅ |
| **Network Controls** | ❌ | ✅ |
| **Enforce Auto-review** | ❌ | ✅ |
| **Inference Hooks（beta）** | ❌ | ✅ |
| **Team Setup** | ❌ | ✅ |
| **Action Recording** | ❌ | ✅ |
| **Audit logs + OTel** | ❌ | ✅ |
| **SCIM** | ❌ | ✅ |

**Inference Hooks**：检查的是**模型输入**而不是动作；Shadow 模式只记录不拦截；**配置加载失败时放行**（fail-open）。**（A）**

### 10.8 硬性限制汇总（做对标时的"约束清单"）

| 限制 | 值 |
|---|---|
| Bot / 账号 | ~50 |
| Bot / 群聊 | 2–6 |
| Routine / Bot | 50 |
| Routine 运行记录 | 20 |
| Routine 最小间隔 | 5 分钟 |
| Auto Review 规则 | 20 + 20，每条 ≤1000 字符 |
| 附件 | 6 个/次，≤25MB（视频 ≤200MB） |
| Teach a task | 10 分钟 |
| X @bot | 地区限制（澳/英/欧盟/冰岛/列支敦士登/挪威） |
| 云电脑位置 | 仅美国 |
| Linux 硬件安全密钥 | 不支持 |
| Android | 仅文本；应用内订阅仅月付个人档 |
| **Routine 触发总频次** | **全账号 300 次/小时**（单 Bot 50 个 routine 之外的第二道闸） |
| **Pages 表格预览** | 10,000 行 |
| **会议参会** | 仅 Team / Enterprise / Ultra；**只发文字，不以语音发言** |
| **电话代打** | 仅美国号码，**Washington 与 Illinois 除外** |
| **语音** | 不支持群聊；同时只能一通 |
| **共享 Bot** | 只能在云上跑，需 Team 或 Enterprise |
| **X Chat** | 灰度中，需含 Grok Bot 套餐 + 已连 Cursor 账号 + **仅个人账号** |

### 10.9 数据与隐私

- 使用 **Cursor 认证与账号数据设置**，**要求数据存储，不支持 Legacy Privacy Mode**；训练 opt-out 走 Cursor 隐私设置。**（A）**
- 云电脑**全部在美国**。**（A/B）**
- 条款把 **Agentic Actions 的全部责任推给用户**，称审批控件"仅为辅助"；而马斯克在 X 上称"搞砸了我们赔"——**两者冲突**。**（B，LISA 调研）**
- 删 Grok Bot = 删 Cursor 账号。**（B）**

---

## 11. 优缺点

### 11.1 优势（每条附证据）

| # | 优势 | 证据 | 可信度 |
|---|---|---|---|
| 1 | **上手成本极低**：5 分钟跑通两个周期性任务；OAuth "a simple click" | 多个一手帖 | B- |
| 2 | **持久化电脑 + 跨设备接力**：关掉笔记本它还在跑，手机可以接力 | 一手帖 + 官方设计 | B-/A |
| 3 | **对象模型干净**：Bot / Skill / Routine 三件套，用户不需要学 harness 概念 | 官方设计稿 | A |
| 4 | **能力可共享、上下文隔离**：账号级工具 + Bot 级记忆，边界有理由 | 官方设计稿 | A |
| 5 | **草稿优先 + 显式人审关卡**：对外发送默认走草稿卡 | 官方文档 | A |
| 6 | **自然语言审批规则**（Auto Review Custom Rules） | 官方文档 + 用户好评 | A/B- |
| 7 | **Teach a task 一致性好评且 0 例失败报告** | 社区口碑汇编 | B- |
| 8 | **不显眼的设计克制**：三级电脑可见性、头像承载状态、默认折叠执行细节 | 官方设计稿 | A |

### 11.2 缺陷（每条附证据）

| # | 缺陷 | 证据 | 可信度 |
|---|---|---|---|
| 1 | **"Always Allow 不等于不再问"**：2 例独立报告；Windows 本地命令横幅关不掉 | 用户帖 | D |
| 2 | **Auto Review 误伤与升级后锁死**：0.20 后命令跑不了，关掉整个层才恢复 | 3+ 用户帖 | D |
| 3 | **本地执行授权是二元的**：只有"每次问"和"你什么都能干但我看不到你干了什么"，**缺 scoped-folder 读写** | 一手帖 | D |
| 4 | **审批 UI 不在用户看的地方**：审批卡落在主会话而用户盯着线程；建线程后像清空了聊天 | 一手帖 | D |
| 5 | **侧栏状态说谎**：显示 working，实际在等审批 | 多帖 | D |
| 6 | **审批不撤销已完成的工作、没有 dry run** | 官方确认 Stop 不撤销 + 社区"nothing found" | A/B- |
| 7 | **共享电脑 = 共享登录，不是安全边界**："像把生意跑在一台 Mac mini 上" | 官方确认 + 3+ 用户帖 | A/D |
| 8 | **研究输出不可盲信**：把被封锁页面误判成"许可被拒"，忽略公开批准文件 | 一手帖 | D |
| 9 | **第 1 天之后可靠性崩塌**：定时任务集体失效、不认已连的连接器、登录卡死、bot 整夜卡在 working | 3+ 帖 | D |
| 10 | **重置共享电脑是民间偏方且让人害怕**：怕点、点了丢两小时上下文、不重置就全不可用 | 3+ 帖 | D |
| 11 | **多 Bot 协作常塌**：同线程多 Bot "fell apart and accomplished nothing"；气泡消失；一条线程多任务只做最后一项 | 多帖 | D |
| 12 | **额度不透明**：每轮重喂全历史（缓存读取可占 84%），单轮 20–25 万 token；周额度折合美元从未公开 | LISA + 用户帖 | B/D |
| 13 | **无模型选择器**，也看不到是哪个模型在干活 | 官方 FAQ | A/B |
| 14 | **设计语言弱化"电脑"存在感，与安全审计的要求相反** | 官方设计稿自证 | A |

### 11.3 一句话总结优缺点

**Grok Bot 把"委派"做得比任何人好，但它没有为"验证委派结果"提供同等的界面与工具。** 它的设计赌注是"模型已经好到值得这种程度的放手"——**当模型没跟上时，用户手里恰好少了那些用来发现问题的工具。**

---

## 12. 用户反馈

### 12.1 好评共识（3+ 独立来源）

1. **上手快**：@Loganullyott 5 分钟跑通两个 recurring task；@nickgraynews "insanely easy to set up"；r/AI_Agents "第一个普通人能用的界面"。
2. **持久云电脑 + 手机/笔记本接力**：@petergyang "agents their own persistent cloud computer"；HN jjcm "async work feels like it actually works"。
3. **Teach a task 一致好评**：Avi Chawla 录一遍爬 newsletter → 变技能 → 变定时 routine；Vestra 创始人 "This kills the biggest cost in automation: specifying the workflow"。
4. **草稿优先 + 显式人审关卡**（多数人靠自己写 prompt 实现，而非产品化 inbox）。
5. **自然语言 Auto-review 规则**：@kr0der 明确点赞。
6. **多 Bot"主 + 专"编制**：分裂评价（少数称这是最好的 multi-agent fleet 搭建方式）。
7. **第三方一句话定性**：Lenny Rachitsky "像 OpenClaw，但超简单、可靠、不那么吓人"；Alex Finn "本地 agent 与云 agent 最好的整合"。

### 12.2 差评主题聚类（信任与审批是核心）

| 主题 | 具体抱怨 | 占比感受 |
|---|---|---|
| **审批语义不可靠** | Always Allow 仍再问；Auto Review 误伤；升级后锁死 | 最高频 |
| **可见性错位** | 状态说谎、审批卡不在看着的地方、无 dry run、无审计 | 高 |
| **权限粒度粗** | 本地授权二元、无 scoped folder、规则曾经不跟设备走（官方已修） | 高 |
| **共享电脑的连带风险** | 共享登录、非安全边界、"机器人碰撞" | 中 |
| **可靠性** | 定时任务集体失效、连接器失灵、登录死循环、整夜卡 working | 高 |
| **多 Bot 协作失败** | 同线程多 Bot 无产出、气泡消失、只做最后一项 | 中 |
| **成本与额度** | 4 Bot 开场即吃 25% 额度；5 Bot 一天用完周额度 | 中高 |

### 12.3 额度与成本争议（时间线）

- 2026-08-26：官方在额度事故后**给全体用户重置周额度**。**（B-）**
- 2026-11 初：TechCrunch 报道部分用户**周额度突降**；Musk 承认**成本相对收入过高**（"unsustainably high costs"）。**（B）**
- 计费结构变化：2026-10-18 起并入 The X Subscription，**与 Grok、Cursor 共享周额度池**，超出走预付 credits。**（A-）**
- 社区量化：缓存读取可占单轮 84%；Ultra 用户 3 天用掉 99% 周额度。**（B）**

### 12.4 可靠性事故时间线

| 时间 | 事故 | 可信度 |
|---|---|---|
| 2026-09-16 | 大面积"Bot 无响应"（187 帖） | B |
| 2026-09-21 ~ 09-28 | 云电脑升级卡在 43%，部分用户停摆数天 | B |
| 2026-11-11 | v1.0.1 新增会议接入（能力扩张仍在继续） | B- |

### 12.5 评分与市场

- iOS **4.89**（6,564 评分）；Google Play **4.8**（500K+ 下载）；2026-09-30 美区 App Store 生产力免费榜 **#16**。**（B）**
- 企业侧：仅厂商口径"数千家组织"，无第三方验证。**（B）**

### 12.6 反馈里明确"没有找到"的东西（做对标时是机会清单）

- 没有独立的 review-list 界面。
- 没有 dry run。
- 没有"机器人不在时干了什么"的可用审计日志。
- 没有 Teach-a-task 复现失败的报道（== 该能力本身口碑干净）。

### 12.7 社区给出的五条改进方向（可直接映射成我们的需求）

**（B-，oneiron 汇编原文）**

1. 审批面要**"一个地方"**而不是"一条提示"——从每个线程和手机都看得到的 **pending 不可逆动作收件箱**。
2. **Always-Allow 必须窄、可检查、本机化**，并提供 scoped allow-list 与"Require-Approval 优先"。
3. **侧栏状态真实性是信任功能**。
4. **Teach-by-demo 要连审批边界一起产出**——每个 routine 配一份可编辑的 review policy。
5. **不要拿兄弟 bot 当权限系统**，要隔离爆炸半径。

---

## 13. 来源与可信度表

### 13.1 一级来源（A / A-）

| 来源 | URL / 位置 | 类型 | 用于 |
|---|---|---|---|
| 官方文档（全站，16 篇缓存） | docs.x.ai（本机缓存 `research/_src/zh/*.txt`） | 官方文档 | 设置项、权限、审批、限制、套餐差异 |
| 官方设计复盘 | https://x.ai/news/designing-grok-bot （2026-09-03） | 官方发布 | 五原语、头像六态、三级可见性、归属边界、数量上限 |
| 官方变更日志镜像 | https://x.ai/changelog/bot（经 AI Radar 镜像，2026-11-17） | 官方 | 版本时间线 |
| 泄露的 agent 系统提示词 | https://github.com/asgeirtj/system_prompts_leaks → `xAI/grok-bot/grok-bot.md`（211KB） | 官方提示词（非公开发布） | 回合机制、自主性、审批绕过禁令、委派、记忆 |
| 泄露的 UI 参考 | 同上 `reference/app-ui.md` | 同上 | 设置 5 标签与锚点 id、删除路径、per-agent 面板、深链 |
| 泄露的电脑参考 | 同上 `reference/debugging-the-box.md` | 同上 | box 架构、共享文件系统/per-agent 桌面、box-doctor |
| 泄露的 55 个技能文件 | 同上 `skills/*.md` | 同上 | routines cron 规范、Secure Form、草稿发送、群聊回合、语音、变更公告 |

### 13.2 二级来源（B / B-）

| 来源 | URL | 类型 | 用于 |
|---|---|---|---|
| LISA 第三方深度调研 | oratis/LISA `docs/research/always-on-agents-2026-09/grok-bot.md`（2026-09-30） | 有分级标注的深度调研 | 归属、平台矩阵、内部案例数据、额度、事故、条款冲突 |
| gigazine | https://gigazine.net/gsc_news/en/20260812-spacexai-grok-bot（2026-08-12） | 主流科技媒体 | 发布时间、套餐、名人评价、图标动效 |
| TechCrunch | https://techcrunch.com/2026/11/02/elon-musk-throttles-grok-bot-limits-due-to-unsustainably-high-costs/ | 主流媒体 | 额度争议 |
| aiagent.nl | aiagent.nl（2026-11-06，荷兰语/英文站） | 有署名的行业分析 | 套餐与定价、云电脑位置、登录回退、集成清单、FAQ 口径 |
| 社区口碑汇编 | oneiron-dev/oneiron `docs/scour-20260819/grok-grokbot.md`（2026-08-19） | 一手帖汇编（X/Reddit/HN） | 好评/差评聚类、五条改进方向、nothing-found 清单 |
| Awesome 变更日志 | getgrokbot 社区 changelog（52KB） | 社区整理 | 版本与功能上线时间线 |

### 13.3 三级来源（C）

| 来源 | 类型 | 用途与警示 |
|---|---|---|
| grokguide.si（非官方教程，2026-10） | 社区教程站，大量引用官方链接 | 界面布局、快捷键、Vault 优先级、Routine 限制。**个别数字与官方不一致（如审批超时 10 分钟 vs 官方 30 分钟），以官方为准** |
| aik8s 整理的 grok-bot-overview | 个人整理的官方链接汇编 | 版本号、审批四限制、套餐能力矩阵 |
| design-cn.md（2026-09-03 设计稿中文拆解） | 第三方深度解读 | 设计稿的方法论抽取与批判（本报告第 5–7 章的批判视角来自此） |

### 13.4 抓取限制说明（可复现性）

- `docs.x.ai` 全站、`x.ai`、`cursor.com/help` 在调研环境下**直连全部失败**（含 `/en/` 变体）；`r.jina.ai` 代理亦失败。
- 可访问的替代源：`raw.githubusercontent.com`、`gigazine.net`、`grokguide.si`、GitHub API。
- 因此本报告中的官方文档引用均来自**本机缓存副本**（`research/_src/`），未经二次在线核对；引用前请以官方页面为准。

---

## 附：本报告未覆盖的部分

- **具体定价页面金额的时效性**（$30 / $100 / $200 为 2026-11-06 快照）。
- **移动端的精确布局**（缺一手截图，仅文字描述）。
- **视觉规范的精确色值 / 字号 / 间距**（官方设计稿只给原则不给规范）。
- **Enterprise 管理后台的具体界面**（成员看不到，仅有文档描述）。

