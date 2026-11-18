# DeepSeek Harness 插件开发方案｜Agent Ops 运行台

> 文档编号 04 ｜ 编写日期 2026-11-17 ｜ 上游依赖：[01 Grok Bot 调研](01-grok-bot-research.md)、[02 DSH 对标](02-dsh-benchmark.md)、[03 排除云电脑后的需求](03-excluded-cloud-pc-requirements.md)
>
> 本方案的每一条技术断言都可以在本机 DSH 安装中复核：`D:\ProfessionalSoftware\agent\dsh\dsh\resources\app.asar`（解包副本 `C:\Temp\dsh-asar-extract\dsh\node_modules\@deepseek-ai\`，@deepseek-ai/dsh 版本 **0.2.2-rc.3**，338 个包）。标注 **[A]** 的为源码/权威文档直读，**[B]** 为多源交叉，**[C]** 为推断并已标注推断依据。

---

## 0. 一页纸摘要

### 0.1 一句话方案

做**一个**名为 `@local/dsh-agent-ops` 的组合包（bundle）：在 DSH 已有的审批 seam、工具策略 seam、会话投影 seam 之上，补一条**可回放的动作审计脊柱**，并把它投影成三个视图——**审批收件箱**、**审计时间线**、**执行环境**——再配一张**规则表**与**一个新表单卡片 kind**。不新建云、不 fork 内核、不 monkey-patch，卸载零残留。

**v1.1 扩展（§9）**：同一条脊柱再长出两个视图——**团队名册**与**群聊协作流**——并补一条**升级审批通道**（子 Bot 被拦的动作 → 工单 → 主 Bot 在根会话发起原生审批）。外加 **8 个 agent-preset 角色包**、**示范→Skill 草稿**与**主动任务感知**。**没有一项需要云电脑，没有一项推翻 v1.0 的架构选择**——因为它们全都表达成「同一条会话日志上的新投影 + 新的 tab 纵切页」。

### 0.2 为什么它能赢（五条硬差异：v1.0 三条 + v1.1 两条）

| # | Grok Bot 的做法 | 我们的做法 | 为什么赢 |
|---|---|---|---|
| 1 | 审批只在对话里弹卡；人不在场约 10 分钟过期，卡片显示 Expired，操作不执行 | 保留 composer 接管（躲不掉），**另加只读收件箱**（看得见） | Grok Bot 的两个失败模式——「我没看见」和「看见时已过期」——只解决一个；我们把「看见」从轮次里解耦成可常驻的侧栏视图 |
| 2 | Auto Review 只给结果（allowed/denied），不给理由；个人规则存在本机，换机重设，无命中统计 | 规则表 + **决策解释行**（把 `AUTO_REVIEW_DENIED` 的原始理由写进审计）+ 命中计数 | 审计里能回答「为什么放行 / 为什么拦」，这是安全评审的刚需，而 Grok Bot 的 Audit logs 是 Enterprise 专属能力 |
| 3 | 审计日志（Action Recording / Audit logs / OTel）是 Enterprise 套餐才有的附加品 | 审计是**会话日志的投影**，免费获得持久化、截断一致性与跨会话检索 | 我们不在系统外再造一份日志文件，而是让「谁授权、做了什么、结果如何」成为会话本身的一等公民 |
| 4（v1.1） | 群聊里每条 Bot 回复都计额度，但界面上看不到花了多少；4 个 Bot 开场吃掉 25% 周额度是常见投诉 | 群聊头部常驻**三行 token 面板**（本轮 / 累计 / 按成员前三），派活前先给预估 | Grok Bot 的群聊问题不是「群聊本身」，而是「成本不可见」；我们的审计脊柱本来就在数工具调用，做成成本可见性只是顺手 |
| 5（v1.1） | 每个 Bot 都能在自己那台云电脑上弹审批卡，人不在约 10 分钟过期；子 Bot 与主 Bot 权限边界相同 | **子代理永无审批权**（DSH 的硬设计），敏感动作被 `tools/pre-execute` 拦成工单 → 主 Bot 在根会话发起**原生审批** → 主 Bot 重执行 | 权限梯度是真的（子 Bot 不能自作主张），而不是「谁都能弹卡但都会过期」。这条比 Grok Bot 更严格，代价是多一跳 |

### 0.3 交付物与工期

- **1 个 bundle，7 个 Host 单元，8 个 Client 注册点，24 条可执行需求**——v1.0 的 16 条见 §5，v1.1 增补的 8 条（多 Bot 群聊 / 角色 / 主 Bot / 升级审批 / 示范学习 / 主动感知）见 §9。
- 批次 0（Host-only，零前端风险）：**3–4 人日**，交付「审计脊柱 + 围栏 + 高危分类」，可立即用 `--patch` overlay 试跑。
- 首个可对外演示版本（批次 0+1）：**2–2.5 周**（1 名全栈）。
- 全部 P0/P1（批次 0–3）：**约 6–8 周**（1 名全栈）或 **3 周**（Host/Client 两人并行）。
- 全部 16 条（v1.0）：**30–40 人日**。
- v1.1 团队能力（R-G1..R-G8）：**28 人日**，其中 P1 四条（群聊 / 角色装配 / 名册 / 升级审批）16 人日是「一个小团队跑起来」的最小可用集，可在 v1.0 的 M3 之后并行开工。
- 全部 24 条：**净 57.5 人日**（C1 已并入 G4，不重复计），含里程碑缓冲约 **60 人日**。

### 0.4 本题的边界（承 03 §5）

**明确排除「云电脑」**：不做托管 microVM、不做跨设备持久工作区、不做 Vault/Cookie 同步、不做团队级网络控制与出站 IP。03 文档的量化结论是——Grok Bot 的 65 条能力点中，**55 条无需云电脑即可对标、10 条必须依赖云电脑、保留改造后净范围 45 条（82%）**。本方案就是那 45 条的工程落地形态。

**v1.1 没有扩大这个边界**：群聊、角色、多 Bot 协作、示范学习、主动感知，全部跑在用户自己的电脑与自己的 DSH 进程里；子 Bot 的「电脑」就是各自的工作目录与各自被允许的工具，不是一台托管 VM。唯一新增的持久化面是 `plugin:ops.chat` 记录（走 DSH 官方 `appendPluginRecord` + `ignorable: true` 通道），它落在既有会话日志里，**不新建数据库、不新建服务、不联网**。

> 一句话：**我们不做「给 Agent 一台电脑」，我们做「让 Agent 在你自己的电脑上干活时有账可查、有闸可拦、有话可说」。**
>
> v1.1 的续句：**也从「一个人干」扩展到「一个团队干」——查谁的账、拦谁的闸、替谁说话。**

---

## 1. 定位：竞品空隙在哪里，DSH 的形状优势在哪里

### 1.1 Grok Bot 真强项与真痛点（压缩自 01）

| 维度 | 真强项 | 真痛点（用户反馈与官方文档自证） |
|---|---|---|
| 能力 | Computer-use 直接操作网页，覆盖所有无 API 的服务 | 模型不可选、额度不可预测（2026-11 初周额度突降，Musk 承认成本不可持续） |
| 交互 | 「示范一次即成 Routine」的教学式固化，门槛极低 | 审批 10 分钟过期；Stop 不撤销副作用；Auto Review 不解释 |
| 协作 | 2–6 个 Bot 群聊、主 Bot 协调 | 每条 Bot 回复都计额度，4 个 Bot 开场吃掉 25% 额度；没有「禁止 Bot 互相发消息」的开关 |
| 审计 | Enterprise 有 Action Recording / Audit logs / OTel | 审计与网络控制被套餐切开，Teams 无网络控制即默认 allow-all |
| 形态 | 云端一台持久电脑，跨设备续同一对话 | 所有 Bot 共享同一台电脑的 Cookie/凭据，隔离边界在用户之间而非 Bot 之间 |

### 1.2 DSH 的形状优势（决定了我们的打法）

DSH 与 Grok Bot 是**两种正确**：Grok Bot 把「执行环境」外包给云，DSH 把「执行环境」留在本地并把**能力切成 seam**。这一点在源码里是硬的：

1. **审批是一等 seam**：`ctx.approval.request(req)` 会在会话日志里成对写入 `approval/asked` 与 `approval/decided`（log-only 审计事件，不进模型 transcript）[A]。这意味着审计的原料**已经在日志里了**，我们不需要新造事件类型（DSH 也不允许随意追加未声明的事件类型）。
2. **工具策略是四段可插拔瀑布**：`tools/pre-execute`（可 allow/deny/cancel/ask）、`ctx.tools.guard()`（单调最终拒绝）、`tools/execute`（包裹分发）、`tools/post-execute`、`tools/result`（只读观测）[A]。拦截、计数、解释都能落在正确的段上，而不是去改工具实现。
3. **会话投影是官方给「派生视图」准备的正门**：`ProjectionDefinition{key, stateSchema, init, apply, wire}` 折叠已提交事件，`apply` 必须同步、不关心的事件必须返回同一 state 引用（`Object.is` 零下游工作），注册返回 `handle.stateOf/readerFor/dispose`，`snapshot(session)` 返回 `{asOfSeq, values}` 的一致切面[A]。**我们的一切列表、计数、时间线都是投影，不是自己维护的 store。**
4. **客户端 UI 是 slot 拼装，不是组件引用**：功能插件通过 `ctx.slots.register()` 贡献，绝不 import 别人的功能组件；向其他包的 slot 贡献必须用 `ctx.slots.inject(key, cb)`[A]。这保证我们的面板不会随内核升级而碎。
5. **右侧栏天然是「停靠面」**：`sidebarRightTabs.register` 定义 tab 类型（`id`/`kind`/`patterns`/`priority`/`title`/`keepMounted`），正文用 keyed slot `sidebar.right.pane.tab` 以 `definition.id` 为 key 注册；`priority` 默认 `extension` 会 shadow 同 kind 的 `builtin`[A]。**三个视图一个 tab 类型完全成立。**
6. **全局面板是一个 keyed main slot**：`conversation` 是保留 key，`ctx.layout.selectPanel(id)` 选中已注册面板，`null` 回会话界面[A]。想加「Agent 名册」这种跨会话面板，官方姿势就是这个。

### 1.3 三条不可越过的红线（承 02 §4.1，违反即返工）

| 红线 | 具体含义 | 违反后的具体故障 |
|---|---|---|
| **不拥有决策** | 我们只**观测**审批，不替用户答；`approval/request` 监听器必须 `return next()` | 一旦吞掉 waterfall，审批永远悬空；`request(req)` 要求发起会话处于未结束轮次内，脱轨即 reject |
| **不动轮次结构** | 不把审批从轮次里摘出来做「异步队列」 | DSH 的 `ApprovalRequest` 有「必须处于未结束轮次」的硬约束，摘出来就再也答不了 |
| **不改内核、不重写既有能力** | 审批 UI、jobs、deliverables、action-cards、schedule、subagent 都是现成服务，只做薄胶水 | fork 内核 = 内核升级即碎；这也是 02 §5.1 风险 3「面板过多稀释主界面」的根源 |

### 1.4 目标用户与三个必须成立的场景

- **主用户**：在 DSH 上跑长任务、且需要「事后能说清」的开发者（自用 + 团队内部交付）。
- 场景 A（**看得见**）：离开工位 20 分钟回来，第一眼知道「刚才有 3 次审批请求、我批了 2 次、拒绝 1 次、有一次是删文件」。
- 场景 B（**拦得住**）：给 `rm -rf`、`git push --force`、生产环境写操作设一条规则，触发即 Ask，且这条规则**不会**被更宽的 Allow 规则掩盖。
- 场景 C（**说得清**）：把一轮会话的审计导出成 Markdown，贴进 PR 或周报，包含「谁授权 / 做了什么 / 结果 / 若被 Auto Review 拦下，理由是什么」。


---

## 2. 竞品与替代方案：为什么是这一条产品线

### 2.1 四条可能的路线，我们选了第四条

| 路线 | 做法 | 竞争力 | 可落地性 | 判定 |
|---|---|---|---|---|
| R1 **复刻云电脑** | 自建 microVM、Cookie/Vault 同步、跨端持久工作区 | 高（能覆盖 Grok Bot 全部能力） | 极低：需要云基础设施、镜像运维、凭据托管合规；与 DSH「本地执行」的形态正面冲突 | **排除**（03 文档全部排除项） |
| R2 **纯 Computer Use 增强** | 把 dsh-cua 包成完整的截图+点击控制台 | 中：Windows 侧 dsh-cua-bundle 仍标 experimental | 中：受 macOS-only 限制，Windows 支持尚在开发 | **不作为主线**（可作为批次 4 的可选增强） |
| R3 **再做一个 Agent 团队面板** | 像 @suifei/dsh-ai-team 一样做多 Agent 工作台 | 低：功能重叠，且已有成熟第三方插件 | 高 | **放弃**（02 §4.5 已判） |
| R4 **Agent Ops 运行台**（本方案） | 在既有 seam 上补审计脊柱 + 三视图 + 规则表 + 表单卡片 | 高：填的是 Grok Bot 自己都没填好的坑（审批可见性、决策可解释性、审计免费化） | 高：v1.0 的 16 条里 15 条直接落在已存在的 DSH 服务上，仅 4 条需要新骨架；v1.1 的 8 条同理——**没有一条需要云** | **采用** |

### 2.2 与邻近方案的能力重叠对照（避免重复造轮子）

| 能力 | DSH 现成实现 | 我们的处理 |
|---|---|---|
| 工具调用审批 | `dsh-user-approval` + `dsh-client-ui-approval`（composer 接管、Enter 批 Esc 拒、提供「始终允许」时它为主按钮） | **复用，不接管**。只旁听 `approval/request` 并 `return next()` |
| 逐调用 LLM 审查 | `dsh-experimental-auto-review`（`AUTO_REVIEW_DENIED` / `AUTO_REVIEW_FAILED`，`/permission auto`，EXP 标记） | **复用判定逻辑**，只补「规则化 + 解释行 + 展示」。不动它的判定 |
| 权限预设 | `dsh-permission-presets`（沙箱模式 + 审批策略捆绑成 Permissions 选择器，保留名 custom/auto） | 我们的规则表作用在 pre-execute 层，与预设**正交**，不抢 `/permission` |
| 后台任务可见性 | `dsh-jobs` + `dsh-client-ui-jobs`（会话头部 28×28px 图标按钮 + 流式输出面板，≤460px 收紧凑） | **复用**。它是「一个会话内」的；我们要的是「跨会话的账」，二者互补 |
| 产物卡片 | `dsh-client-ui-deliverables`（轮 末文件卡片 + 交付卡片 + 行内代码链接可点） | 把「本轮审计摘要」作为交付物输出，走现成渲染 |
| 表单/提案卡片 | `dsh-action-cards` + `dsh-client-ui-action-cards`（挂在 `conversation.chat.turnTail`，每轮一张，折叠阈值约 260 字素） | **注册一个新 kind**（`ops.form`），不改任何现有 kind |
| 定时任务 | `dsh-schedule`（rrule、target 三选） | P2 才接（Routine 归属实例），P0/P1 不碰 |
| 多 Agent 编排 | `dsh-agent-team`（共享任务板 CAS）/ `dsh-subagent` / `dsh-tool-workflow` | 我们的「Agent 名册」只做**只读投影**，不抢调度权 |
| 记忆 | `@vectorize-io/hindsight-coding-agents`（本机已装） | 复用其 bank 机制做 P2 记忆分区，不新写存储 |

### 2.3 一句话定位

> **Grok Bot 卖的是「替你干活」，我们卖的是「干得让你放心」。** 前者的核心资产是云电脑，我们明确不做；后者的核心资产是**审计与拦截的完备性**，而这恰好是 DSH 的 seam 已经铺好、却还没有人去做的那块。

---

## 3. 产品设计

### 3.1 三个视图 + 一张表 + 一种卡片（全景）

```
                      ┌────────────────────────────────────────┐
                      │  会话日志（session log，唯一真相源）      │
                      │  approval/asked · approval/decided      │
                      │  tool/call · tool/result · 事件流 ...   │
                      └───────────────┬────────────────────────┘
                                      │ 折叠（projection，纯同步）
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ops.audit（审计脊柱）  ops.env（执行环境）  ops.roster（名册）
                    │
      ┌─────────────┼──────────────┬───────────────┐
      ▼             ▼              ▼               ▼
  ① 审批收件箱   ② 审计时间线   ③ 规则命中      ④ 表单卡片
  (右侧栏 tab)   (右侧栏 tab)   (设置分区)     (action card)
```

**关键设计决策：三个视图共用同一个右侧栏 tab 类型 `ops`，用 tab 地址区分视图。** 依据是 `SidebarRightTabDefinition` 的 `patterns` + `multiple` + `keepMounted` 三个字段的组合[A]：

- 一个 `kind: 'ops'` 的 tab 类型，`patterns: ['sidebar://ops/*']`，`title: (address) =>` 按视图名返回；
- 若要三个视图各自常驻，则设 `multiple: true` 且每次 `openTab('ops', { params: { view } })` 得到独立 tab；
- 若要一个 tab 内切页（推荐，减少 tab 数量），则 `multiple: false`，正文内部用本地状态切三栏。

**推荐后者**：Grok Bot 的教训之一是「每多一个并列入口，主界面的注意力就被稀释一分」（02 §5.1 风险 3）。一个 tab、三个纵切页（左窄导航 + 右内容），与 DSH 设置面板的形态一致，用户零学习成本。

> **v1.1 增量（§9）**：同一个 `ops` tab 内追加**两个纵切页**——④「团队」（Bot 名册 + 主 Bot 标记 + 待升级数）与⑤「群聊」（多 Bot 协作流 + token 三行）。**这不是新入口，是同一个 tab 的第 4、5 栏**；`kind`、`patterns`、`multiple:false`、`keepMounted:true` 全部不变。这一条是 v1.1 能声称「沿同一根基往下长」的结构性证据：用户视角看，产品没有多一个按钮。

### 3.2 视图一｜审批收件箱（Approval Inbox）

**解决什么**：Grok Bot 的审批只在对话里弹，人不在场约 10 分钟过期就 Expired、操作不执行；离开工位回来，你根本不知道错过了什么。DSH 的 composer 接管同样只在当前会话可见。

**信息结构**（每条 = 一次 `approval/asked`，用 `id` 关联 `approval/decided`）：

| 列 | 内容 | 来源 |
|---|---|---|
| 状态 | 待处理 / 已批准 / 已拒绝 / 已取消 / 不可用 | `approval/decided.outcome` 的四个闭合值 |
| 工具 | `toolName` + 参数摘要（`callId` 可回链到已流式输出的工具调用，故**不重复展示参数**） | `approval/asked.toolName` / `callId` |
| 会话 | 哪个会话、哪个 Agent | 事件所属 session |
| 风险 | 高危/中危/低危 | §3.5 高危分类表 |
| 时间 | asked 时刻 → decided 时刻 → 等待时长 | 事件时间戳 |
| 理由 | `reason`（审计理由）/ `displayReason`（本地化界面理由） | `ApprovalRequestEvent` |
| 决策人 | 本人 / 规则自动 / Auto review | 规则表命中记录 |

**交互**：只读列表 + 点击回跳到对应会话的那条消息（用 `tab.actions.openResource()`）；**不提供「从这里批准」按钮**——红线 1 说得很清楚，审批必须在未结束轮次内由 composer 应答。这条限制不是缺陷，是**避免造出一个「在系统外批准动作」的影子通道**。

**为什么这条比 Grok Bot 强**：Grok Bot 的 Expired 是**终局**（操作不执行，且不告诉你）；我们的过期是**可查的**（收件箱里有一条 `cancelled`，带时间与原因）。

### 3.3 视图二｜审计时间线（Audit Timeline）

**解决什么**：回答「这一轮到底谁授权了什么、做了什么、结果如何」。这是 02 §4.3 定的三段式输出。

**三段式行结构**（每行一个工具调用）：

```
┌ 授权 ─────────────────────────────────────────┐
│ 由 用户 批准（等待 8s）  · 规则未命中           │
│ 或 由 规则「删除类始终询问」触发提问            │
│ 或 由 Auto review 放行（理由：仅读取，无副作用）│
├ 动作 ─────────────────────────────────────────┤
│ bash · rm -rf ./dist  · 危险: 删除 · 中危       │
├ 结果 ─────────────────────────────────────────┤
│ 成功（1.2s，输出 340B）                        │
│ 或 被拦截：AUTO_REVIEW_DENIED（原始理由 ...）  │
└──────────────────────────────────────────────┘
```

**三种数据源合并**（都在一个 projection 里折叠，不额外订阅）：

1. `approval/asked` + `approval/decided` → 授权段；
2. `tools/result` 钩子（只读观测，冻结快照，监听器失败被隔离）→ 动作与结果段[A]；
3. Auto review 的错误码（`AUTO_REVIEW_DENIED` 携带原始理由）→ 拦截解释。

> 技术要点：审计投影只能吃**已提交的会话事件**（projection 的 `apply` 只接收提交事件）。工具结果本身是否作为事件提交、字段形状如何，都必须在实现首日核对 `dsh-tools` 的事件契约；若某段信息不在日志里，就走 `tools/result` 钩子**另写一条自有的 log-only 事件**吗？——**不行**，DSH 不允许随意追加未声明事件类型。正确做法是把这部分信息挂在**我们自己 projection 的内存态**上，只对本进程可见（并明确标注「进程内、不持久化」），持久段只用日志里有的东西。这个取舍必须在 §7 验证里被单独立项验证。

**导出**：时间线可一键导出 Markdown（贴进 PR/周报）。导出走 `dsh-tool-present` / `dsh-deliverable-file-references` 的现成交付链路，不自己写下载逻辑。

### 3.4 视图三｜执行环境（Execution Environment）

**解决什么**：Grok Bot 有「云电脑」视图——实时画面、Update/Recover/Reset 三个按钮、磁盘满提示。我们**不抄云电脑**（03 §1 判定树），但要抄它的**信息意图**：用户需要知道「Agent 现在在什么环境里、有什么权限、能写哪些目录」。

**内容**（全部来自 DSH 真实 seam）：

| 区块 | 展示什么 | 数据源 |
|---|---|---|
| 沙箱模式 | `read-only` / `workspace-write` / `danger-full-access` + `SandboxEnforcement`（full/partial） | `ctx.sandboxPolicy.resolve()`[A] |
| 可写根 | workspaceRoot + `additionalWritableRoots`（注意：Windows 子进程忽略它，Harness 文件工具独立执行这些授权） | 同上 |
| 审批策略 | `ask` / `never`（生效值 = 会话日志最后一条 `approval/policy` 事件，回退到服务配置） | `ctx.approval.effectivePolicy(session)`[A] |
| 模型与 Agent | 当前 provider/model、agent preset | session header |
| 连接器 | 已连接的 MCP / 连接器状态 | 现有插件清单投影 |
| 围栏状态 | 是否启用、当前命中的围栏条数 | 本插件 |

**为什么不抄「Update / Recover / Reset」三个按钮**：那是云电脑的生命周期操作，本地环境里对应的是「改沙箱模式」和「改审批策略」，二者已经有官方入口（`/permission` 选择器）。我们只做**只读投影 + 一处跳转**，避免造第二个权限入口（02 §5.1 风险 6）。

### 3.5 规则表（Rules）——本方案的技术亮点

**问题**：Grok Bot 的 Auto Review 规则两种：`Ask first` / `Allow automatically`，冲突时 Ask first 优先；但——个人规则存在当前这台电脑上，换机需重设；**没有命中统计**；**不解释为什么**；Auto Review 不覆盖记忆写入与多数设置变更。

**我们的设计**（四条改进，全部可实现）：

1. **单调安全**：规则表编译为一个 `ctx.tools.guard()` 守卫（`ToolGuard = (execution) => string | ToolGuardDenial | undefined`），**guard 没有 allow 结果**，只有拒绝[A]。所以「一条宽 Allow 规则把一条窄 Ask 规则吃掉」这种事故**在类型上不可能发生**。这是 DSH seam 天然给的强保证，Grok Bot 没有。
2. **Ask 优先 + 20 条上限 + 命中计数**：规则匹配在 `tools/pre-execute` 里做（可返回 `{kind:'ask', reason, displayReason}`），guard 只兜底拒绝；每条规则显示 `命中次数 / 最后一次命中时间`。
3. **可导出可分享**：规则存进 DSH 自己的设置文档（`ctx.settings.configure` 注册本插件命名空间），因此是 YAML、可 diff、可进 git、可团队共享。Grok Bot 的规则是「本机私有」，我们的是「可版本化的资产」。
4. **高危七类永不进 Allow**：发消息/邀请、发布内容、购买与转账、删除或覆盖数据、改权限、改生产环境、接受法律条款（01 §10 的官方清单，也是 03 R-A5 的产物）。**规则表在 UI 层就拒绝保存这类规则**，不是靠运行时判断。

### 3.6 表单卡片（`ops.form`）——新 action card kind

**对标**：Grok Bot 的 Secure Form（聊天内安全表单，登录四种方式之一）、以及它 Creator 侧的 in-chat-forms skill。

**为什么值得做**：Agent 干活时经常需要「结构化输入」——不是自由文本，而是「从三个选项选一个 + 填一个路径」。DSH 现在只能用 `ask_user_question`（问答）或让模型在文本里问。表单卡片把这类往返变成一次可回放的交互。

**形态**（Host 侧注册 `ActionCardKind`）：

```ts
ctx.actionCards.register({
  action: 'ops.form',
  skill: 'ops-form',                 // 必须先 load 该 skill 才允许 propose
  invitation: '表单已填好，继续。',   // 接受后给模型的收尾话术
  details: formDetailsSchema,        // Zod：fields[]，每项 {name, kind, label, required, options?}
  verbs: { submit: { writes: true }, cancel: {} },
  async act(agent, proposal, verb, payload) { /* 记录决策 → 返回值喂回模型 */ },
})

// Client 侧
ctx.actionCards.register({ action: 'ops.form', locale: 'ops', Body })
```

`Body` 收到的能力（A 级）：卡片、已记录/推导的决定、`sessionId`、框架渲染的 title 与折叠 summary、`Folded` 组件、绑定卡片的 `act(verb, payload?)`、本语言命名空间的 `t`[A]。**Body 自己负责标题栏、控件、状态与底部操作**，这给了表单完全的排版自由。

**优先级**：P2。它是「亮点」但不是「痛点」，且需要新的 skill + 新的 Zod schema + 客户端组件，成本最高。放在批次 3 之后做，用前三个视图跑通信任后再加。


---

## 4. 技术架构与包结构

### 4.1 一个 bundle，四层

```
@local/dsh-agent-ops                       ← 组合包（dsh.bundle.patch）
├── package.json                            dsh.bundle.patch → ./cordis.patch.yml
│                                           dsh.client → { platform:'web', inject:[...] }
├── cordis.patch.yml                        注册 5 个插件行（见 4.3）
├── lib/
│   ├── index.js                            Host 半入口（apply(ctx))
│   ├── audit-projection.js                 ops.audit 投影定义 + 注册
│   ├── approval-index.js                   approval/request 旁听 + asked/decided 关联
│   ├── rules/
│   │   ├── policy.js                       规则匹配（tools/pre-execute）
│   │   └── guard.js                        单调拒绝守卫（ctx.tools.guard）
│   ├── fence.js                            高危分类表 + 围栏判定
│   └── exec-env.js                         执行环境只读投影
├── client.js                               客户端半（lazy-CJS factory，见 4.5）
├── icon.svg                                ≤256 KiB 自包含
├── locale/{zh,en}.json                     含 meta.title / meta.description
└── docs/DETAIL.md                          package meta.detail 指向
```

**为什么是一个包而不是五个包**：DSH 的客户端模块系统「只把一个包的半侧挂在说明符恰为裸包名的那一行上」[A]。拆成多行的组合包，其半侧留在根行，根行关闭则其注册的页面全消失。我们只有一个前端半侧（`client.js`），所以必须单包。Host 侧内部的四个单元用模块切分，不用包切分。

### 4.2 package.json（可直接抄的骨架）

```jsonc
{
  "name": "@local/dsh-agent-ops",
  "version": "0.1.0",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/types/index.d.ts",
  "exports": {
    ".":            { "types": "./lib/types/index.d.ts",        "default": "./lib/index.js" },
    "./client":     { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json",
    "./locale/*.json": "./locale/*.json",
    "./cordis.patch.yml": "./cordis.patch.yml"
  },
  "files": ["icon.svg", "locale/*.json", "docs", "lib/index.js", "lib/client.js",
            "lib/types/**/*.d.ts", "cordis.patch.yml", "src"],
  "icon": "./icon.svg",
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-api-session-controller",
                 "@deepseek-ai/dsh-client-locale",
                 "@deepseek-ai/dsh-client-ui-conversation"]
    }
  },
  "engines": { "dsh": ">=0.2.2-rc.3 <0.3.0" },
  "peerDependencies": { "@deepseek-ai/cordis": "~4.1.0" }
}
```

要点（每条都有 A 级依据）：

- `engines.dsh` 声明 SemVer 范围，安装与 profile 启动会拒绝不匹配者；省略时改查 `@deepseek-ai/dsh*` peer 范围。
- `exports` 必须含 `./package.json` 与 `./locale/*.json`；`files` 必须含 `locale/*.json`（还有图标与 docs）。
- `peerDependencies` 只需要 `@deepseek-ai/cordis`（真实官方包如 dsh-client-ui-jobs 就是这样）。
- `dsh.client.inject` 是**客户端服务 id 数组**，不是 npm 依赖；`external` 才用于基座之外的模块请求。

### 4.3 cordis.patch.yml（五行）

```yaml
- insert:
    # ① 审计脊柱：投影定义 + 注册（无 UI，最先上）
    - id: agent-ops-audit
      name: "@local/dsh-agent-ops/audit"
      config:
        maxEventsPerSession: 20000      # 折叠窗口上限，超出保留最近 N
        retainProcessOnly: true         # §3.3 的进程内段开关

    # ② 审批索引：旁听 approval/request，关联 asked/decided
    - id: agent-ops-approval
      name: "@local/dsh-agent-ops/approval"

    # ③ 规则与围栏：pre-execute 匹配 + guard 单调拒绝
    - id: agent-ops-policy
      name: "@local/dsh-agent-ops/policy"
      config:
        maxRules: 20                    # 硬上限，与 Grok Bot 对齐
        highRiskNeverAllow: true        # 高危七类永不进 Allow

    # ④ 执行环境只读投影
    - id: agent-ops-exec-env
      name: "@local/dsh-agent-ops/exec-env"

    # ⑤ 客户端半（唯一带 UI 的行）
    - id: agent-ops-ui
      name: "@local/dsh-agent-ops"
```

> **注意**：`name` 字段写的是**包的入口说明符**，所以子路径必须在 `exports` 里真实存在。如果不想维护 5 个入口，就把四种能力做成同一个 `lib/index.js` 内的 4 个 Cordis 子插件（`ctx.plugin(...)`）——**这也是官方推荐形态**（bundle 层的 dsh-experimental-auto-review 就只有一个 insert 行）。为降低首版风险，**建议首版只用一个行**：

```yaml
- insert:
    - id: agent-ops
      name: "@local/dsh-agent-ops"
```

五行方案留给批次 2（当需要按行独立开关某项能力时）。这个「先一行、后五行」的演进路径本身就是 DSH 组合模型的优势：`--patch` overlay 可以在不改包的情况下覆盖任意一行。

### 4.4 Host 侧四单元的实现要点

#### 单元 1｜`ops.audit` 审计投影（P0，最核心）

```ts
// lib/audit-projection.js —— 形状照抄 dsh-plan-mode 的 planProjectionDefinition
export const auditProjectionDefinition = {
  key: 'ops.audit',
  stateVersion: 1,
  stateSchema: auditStateSchema,        // zod：entries[] + counters
  init: () => ({ entries: [], byCallId: {}, counters: { asked: 0, allowed: 0, denied: 0, blocked: 0 } }),
  apply: (state, event) => {
    if (event.type === 'approval/asked')   return foldAsked(state, event);
    if (event.type === 'approval/decided') return foldDecided(state, event);
    return state;                        // ← 不关心的事件必须返回同一引用
  },
  wire: {
    viewSchema: auditViewSchema,
    view: (state) => ({ entries: state.entries.slice(-500), counters: state.counters }),
    summary: false,                      // 不进会话摘要（对齐 SessionProjectionSummaryExcluded）
  },
}
```

**三条硬约束**（违反会静默失效或破坏一致性）：

1. `apply` **必须同步**——异步单元会切断载波的一致性截断。
2. 不关心的事件**必须返回同一 state 引用**，`Object.is` 相同则零下游工作。
3. `state` 必须是**纯 JSON**。

注册：`static inject = ['sessionProjections', ...]`，在 `[Service.init]()` 里 `await ctx.sessionProjections.register(...)`——注意返回的是**thenable 而非原生 Promise**，新代码用 `handle.dispose()` 而非 `await` 后丢弃。

#### 单元 2｜`approval-index` 审批旁听（P0）

```js
ctx.on('approval/request', async (req, next) => {
  // 只观测，不决策
  recordPending(req.toolName, req.callId, req.reason, req.displayReason);
  return next();                          // ← 红线 1：必须透传
})
```

**关键**：`approval/request` 是 **agent-scoped waterfall**；`never` 策略在服务内部、waterfall 分发之前就强制了，即使 `prepend` 注册的应答者也绕不过[A]。所以我们的监听器**永远不可能**改变最终结果——这正是我们要的：审计不该有权。

#### 单元 3｜`policy` 规则与围栏（P0/P1）

```js
// 匹配 → 提问（pre-execute 可返回 ask）
ctx.on('tools/pre-execute', async (exec, next) => {
  const rule = matchRule(exec);
  if (rule?.effect === 'ask') {
    return { kind: 'ask', reason: rule.id, displayReason: { en: rule.reasonEn, zh: rule.reasonZh } };
  }
  return next();
});

// 兜底 → 单调拒绝（guard 没有 allow 结果，顺序无法把拒绝翻回许可）
ctx.tools.guard((exec) => {
  const hit = matchDeny(exec);
  return hit ? { reason: `blocked by fence: ${hit.id}` } : undefined;
});
```

**为什么 guard 是真亮点**：`ToolGuard` 的类型是 `(execution) => string | ToolGuardDenial | undefined`，**没有 allow 分支**[A]。这意味着「后来的插件把前一条拒绝放行」在类型系统层面就不存在。Grok Bot 的规则冲突要靠「Ask first 优先」的文档约定，我们靠类型。

#### 单元 4｜`exec-env` 执行环境（P1）

```js
const policy = ctx.sandboxPolicy.resolve({ session });   // { mode, workspaceRoot, additionalWritableRoots? }
const approval = ctx.approval.effectivePolicy(session);  // 'ask' | 'never'
```

再注册一个 `ops.env` 投影把结果 wire 给客户端（或直接复用 audit 投影里的一个字段，减少投影数量——**推荐后者**，投影数量是有成本的概念负担）。

### 4.5 客户端半 `client.js`（两段注册 × 六个落点）

**文件形态**（照抄真实产物，A 级）：

```js
window.__ModuleLoader__.load({
  id: `@local/dsh-agent-ops`,
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    let react = require('react');
    let jsx = require('react/jsx-runtime');
    const css = `...`;   // 字符串字面量
    const zh = {...}, en = {...};
    const inject = ['slots', 'locale', 'sidebarRightTabs'];
    function apply(ctx) {
      // ① CSS 注入（幂等，按 data-plugin-css 去重）
      // ② locale 注册
      // ③ 右侧栏 tab 类型 + 正文
      // ④ settings.section
      // ⑤ action card Body（P2）
      // ⑥ 会话头部快捷入口（P1）
    }
    exports.apply = apply; exports.inject = inject;
    return module.exports;
  },
});
```

**六个落点**（每个都有 A 级 slot 名依据）：

| # | 落点 | 注册方式 | 优先级 |
|---|---|---|---|
| 1 | 右侧栏 tab 类型 `ops` | `ctx.sidebarRightTabs.register({id:'@local/dsh-agent-ops', kind:'ops', patterns:['sidebar://ops/*'], priority:'extension', title})` | P1 |
| 2 | tab 正文 | `ctx.slots.register({name:'sidebar.right.pane.tab', key:'@local/dsh-agent-ops'}, OpsPanel)` | P1 |
| 3 | 会话头部按钮（打开收件箱） | `ctx.slots.inject('conversation.session.header.actions', ...)` + `ctx.slots.register({name:..., id:'ops-inbox', order:30}, InboxButton)` | P1 |
| 4 | 设置分区「Agent Ops」 | `ctx.slots.register({name:'settings.section', id:'agent-ops', order:60, label}, Section)` | P1 |
| 5 | 设置分区图标 | `ctx.slots.register({name:'settings.section.icon', id:'agent-ops', ...}, Icon)` —— **id 必须与 §4 相同**，否则不渲染 | P2 |
| 6 | 表单卡片 Body | `ctx.actionCards.register({action:'ops.form', locale:'ops', Body})` | P2 |

**CSS 注入范式**（真实产物原文）：

```js
const tagId = `@local/dsh-agent-ops/panel.module.css`;
if (typeof document !== 'undefined' &&
    document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
  const tag = document.createElement('style');
  tag.dataset.plugin = PKG;
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}
```

**读投影的官方 hook**：`useProjection('ops.audit')` —— 标准 hook，无需声明，9 个官方包在用（action-cards / agent-team / chat / conversation / goal / permission-presets / plan / subagent / tool）。返回值类型由投影的 `wire.viewSchema` 决定；`undefined` 表示尚无快照，必须 `return null` 而不是渲染空壳。

### 4.6 构建链路（本项目最容易踩的坑，必须提前定方案）

**问题**：DSH 官方包的 `lib/client.js` 是 lazy-CJS factory 格式产物，由仓库内的 tsdown 预设 `packages/client/tsdown.client.ts` 生成——**该预设未随包发布**，仓库外的包要自己复刻这一步[A]。

**三个可行方案**，按推荐排序：

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A. 手写 factory + esbuild 打包**（推荐） | 用 esbuild 把 TSX 源码打成 CJS bundle，再用 8 行包装脚本套上 `window.__ModuleLoader__.load({id, factory})` 外壳 | 不依赖未发布的预设；构建快；产物可读 | 需要自己维护 `require()` 映射表（react / react-dom / react/jsx-runtime 等基座模块） |
| B. 复刻 tsdown 预设 | 照着官方包的产物形态自己写一份 `tsdown.client.ts` | 与官方完全一致 | 预设不进仓库就无法逐行复刻，容易在版本升级时碎 |
| C. 直接手写 `client.js`（无构建） | 纯 JS 手写整个 `client.js`，不引入 TSX | 零构建链路，`pnpm pack` 即发布 | 组件复杂后可维护性差（但**首版完全够用**，我们的面板是列表 + 表单，不需要复杂状态） |

**首版建议走方案 C，批次 2 再升级到 A**。理由是：批次 0–1 的客户端部分只有「一个列表 + 一个详情 + 一个设置表单」，用 `react.createElement` 直接写约 400 行 JS 完全可控，而**构建链路的失败会在安装阶段暴露**（缺 bundle 时报错原文见 §4.6 注释：`client-modules: client bundle not found; run ... before launch:`），此时还没有任何用户价值被验证。

**安装的三个可选通道**（规避 `allowBuilds` 授权坑）：

1. **`pnpm pack` 出 tarball 后本地安装**（首选）：`dsh plugin --profile demo add ./dsh-agent-ops-0.1.0.tgz`。预构建产物已就位，不需要在用户机器上跑构建，**不需要 allowBuilds 授权**。
2. **`--patch` overlay 直接挂**（开发期）：不安装，用 `dsh --profile demo --patch ./cordis.patch.yml` 指向本地包，改完重启即可验证。
3. **GitHub 安装**（最不推荐）：git 安装拉源码不跑 build，作者必须提供自包含 `prepare` 脚本，用户还需在 profile 的 `pnpm-workspace.yaml` 加 `allowBuilds`——**等于允许该包在用户机器上执行代码**（且不在 agent 沙箱内）。方案文档里应明确写「不推荐」。

**验证安装成功**：`dsh --profile demo --dump-config` 应显示对应 layer 注释行；Web GUI 里 `/plugins` 页面应出现本包，且右侧栏出现 `ops` tab 类型。

### 4.7 数据通道的取舍（为什么不用 Typert Remote）

| 需求 | projection snapshot | Typert Remote | 选择 |
|---|---|---|---|
| 读审计列表 | `useProjection('ops.audit')` 一行 | 需 `@Remote` 服务 + 生成产物 + peer 认证 | **projection** |
| 读执行环境 | 同上 | 同上 | **projection** |
| 写规则表 | 走 `ctx.settings` 设置文档（官方 UI 通道） | 自建写接口 | **settings** |
| 导出审计为文件 | 走 `dsh-tool-present` / deliverables 现成链路 | 自建下载 | **现有工具** |

**结论：全链路不需要一行 Typert Remote。** 这是本方案「低风险」的根源——所有数据通道都是官方已有、已被 9 个包验证过的投影路径。只有当将来需要「跨进程实时推送大对象」时才考虑 Typert Remote。


---

## 5. 需求列表（v1.0 的 16 条，可执行、可验收）

编号规则：`R-<域><序号>`，域取自 03 文档的 A–E 五域，本方案新增 **F 域（工程与交付）**。每条含**描述 / DSH 落点 / 验收标准 / 依赖 / 人日**。

> **v1.1 增补了 8 条（R-G1..R-G8），不并入本章，见 [§9](#9-多-bot-团队与主动能力v11-增补)。** 本章的 16 条是「一个人干活有账可查」的最小完整集；§9 的 8 条把它扩展到「一个团队干活」。两章的需求编号、依赖与人日可直接相加（唯一例外：**C1 已被 G4 吸收**，故 P2 的 10 人日中 3 人日不重复计入总数）。

### 5.1 P0（必须，批次 0–1，5 条）

| # | 需求 | DSH 落点 | 验收标准 | 依赖 | 人日 |
|---|---|---|---|---|---|
| **F1** | 打包骨架：`package.json` + `cordis.patch.yml` + `lib/index.js` 最小可安装包，`engines.dsh` 正确声明 | bundle 层 | `pnpm pack` → `dsh plugin add ./x.tgz` → `dsh --dump-config` 出现对应 layer 行；`/plugins` 页可见且能开关 | — | 1 |
| **F2** | `ops.audit` 审计投影：折叠 `approval/asked` + `approval/decided`，输出 entries 与 counters | `ctx.sessionProjections.register` | 单测：给定 3 组 asked/decided 事件序列，`snapshot().values['ops.audit'].counters` 精确匹配；不关心事件返回同一引用（`Object.is` 断言） | F1 | 2 |
| **A1** | 审批旁听：`approval/request` 只观测，调用 `next()` 原样透传 | `ctx.on('approval/request', ...)` | 集成测试：注入一个 `never` 策略会话，确认请求仍被拒（**未被放行**）；注入一个应答者，确认审批结果与无本插件时逐字节一致 | F1 | 1 |
| **A4** | 围栏：高危七类分类表 + `ctx.tools.guard()` 单调拒绝 | `ctx.tools.guard` | 单测：对 `rm -rf /`、`git push --force`、`DROP TABLE` 等 12 个样本，guard 全部返回拒绝；对 `ls`、`cat` 返回 undefined | F1 | 2 |
| **A5** | 高危动作分类表独立成数据文件（可导出、可被审计引用） | `lib/fence.js` + 导出 JSON | 分类表能以 JSON 导出；审计条目里的 `risk` 字段与表查表结果一致 | — | 0.5 |

**批次 0 合计：6.5 人日**（比 02 §0.3 的 3–4 人日更保守，因为把打包骨架 F1 单列出来了）。这是「**无 UI、可全部 `--patch` 试跑**」的最小切片，交付后立即可用 `dsh --profile demo --patch` 验证审计与拦截是否真的工作。

### 5.2 P1（应该，批次 2–3，7 条）

| # | 需求 | DSH 落点 | 验收标准 | 依赖 | 人日 |
|---|---|---|---|---|---|
| **B1** | 右侧栏 `ops` tab 类型 + 正文三纵切页（收件箱 / 时间线 / 执行环境） | `ctx.sidebarRightTabs.register` + `sidebar.right.pane.tab` keyed slot | tab 能从会话头部按钮与 `openTab('ops')` 两处打开；切换会话不丢内容（`keepMounted:true` 生效）；三个视图数据与投影一致 | F2 | 4 |
| **A2** | 审批收件箱视图：待处理/已决定两段，四个 outcome 各自样式与文案 | B1 的正文 | 一条 `cancelled` 的记录必须显示出来（Grok Bot 的 Expired 不可查，这里可查） | B1 | 2 |
| **A3** | 规则表：20 条上限、Ask 优先、命中计数、设置分区编辑 | `ctx.slots.register('settings.section')` + `ctx.settings.configure` | 保存第 21 条被拒并提示；一条 Ask 规则与一条 Allow 规则同时命中时，结果为 Ask；命中计数在每轮结束后 +1 | F1, A4 | 3 |
| **B1b** | 会话头部「审计入口」按钮 + 未读徽标 | `conversation.session.header.actions` | 有新的未处理审批时徽标显示数字；点击打开 ops tab 并定位到该条 | B1 | 1 |
| **E2** | 通知条：新审批到达时在 `shell.overlay` 出现轻量提示（不抢焦点、可关闭） | `shell.overlay`（list, root，穿透点击） | 提示出现时不阻塞任何点击（穿透）；关闭后该条不再提示 | A2 | 1.5 |
| **C2** | 审计时间线视图：三段式行（授权/动作/结果），含 Auto review 理由行 | B1 的正文 + `tools/result` 观测 | `AUTO_REVIEW_DENIED` 的原始理由必须出现在「结果」段；纯读取操作显示「无需审批」而非空白 | B1, A4 | 3 |
| **A2b** | 审计导出：一键导出 Markdown 到工作区并弹出交付卡片 | `dsh-tool-present` / deliverables | 导出的 md 含时间、工具、风险、授权方式、结果；文件出现在轮末交付卡片 | C2 | 1.5 |

**批次 1+2 合计：16 人日**。此时产品已可对外演示（「看得见 + 拦得住 + 说得清」三件事全部成立）。

### 5.3 P2（可以做，批次 4，4 条）

| # | 需求 | DSH 落点 | 验收标准 | 依赖 | 人日 |
|---|---|---|---|---|---|
| **E1** | `ops.form` 表单卡片（新 action card kind） | `ctx.actionCards.register` 两侧 + 新 skill `ops-form` | 模型能 propose 一个含 3 个字段的表单；提交后 `act()` 返回值喂回模型；同 action 二次注册报错被单测覆盖 | F1 | 4 |
| **C1** | Agent 名册：跨会话只读面板（各 agent 的状态、最近动作、待审批数） | `main` keyed slot + `sidebar.panellist` 同 id | 名册面板可从侧栏图标进入；`ctx.layout.selectPanel('ops-roster')` 生效；无会话时显示空态而非报错 | B1 | 3 → **并入 G4** |
| **D1** | 规则表导入导出（YAML，可进 git） | A3 的扩展 | 导出的 YAML 能被重新导入且规则 id 稳定 | A3 | 1 |
| **B3** | MCP / 连接器可见性：在执行环境视图里列出已连接连接器及其状态 | 现有插件清单投影 | 显示名称、状态（connected/needs-auth/disabled）；不提供连接按钮（复用官方入口） | B1 | 2 |

**P2 合计：10 人日**。**v1.0 总计 32.5 人日 ≈ 6–7 周单人或 3 周双人**，与 02 §0.3 的估算一致。

**与 v1.1 相加时不重复计的那一条**：C1（Agent 名册，3 人日）在 v1.1 中被 §9 的 **G4 团队名册**取代。为避免这 3 人日被算两遍，两种口径都写在下面，选一种用即可：

| 口径 | v1.0 | v1.1 的 R-G | 合计 |
|---|---|---|---|
| **A（推荐）C1 归 v1.1** | 29.5 人日（不含 C1） | 28 人日（G4 含名册） | **57.5 人日** |
| B（C1 归 v1.0，G4 只算增量） | 32.5 人日 | 25 人日（G4 的 3 人日已被 C1 覆盖） | **57.5 人日** |

两种口径的合计**都是 57.5 人日**，因为只是把同一份 3 人日放在哪一侧的问题。本文档 §0.3、§6.1 的里程碑与 §9.10 统一采用**口径 A**。

### 5.4 需求总表与依赖图

```
F1 打包骨架
 ├── F2 ops.audit 投影 ─────┬── B1 右侧栏 ops tab
 │                          │    ├── A2 审批收件箱
 │                          │    ├── C2 审计时间线（+A4）
 │                          │    ├── B1b 头部按钮
 │                          │    └── B3 连接器可见性 (P2)
 │                          │
 ├── A1 审批旁听            │
 ├── A4 围栏 guard ─────────┤
 │    └── A5 分类表         │
 │         └── A3 规则表 ───┴── E2 通知条 / D1 导入导出 (P2)
 ├── E1 表单卡片 (P2)
 └── C1 Agent 名册 (P2)
```

**关键路径**：F1 → F2 → B1 → C2。这条链上任何一环延期，都直接推迟「可对外演示」的时间点。A4/A1 与 F2 可并行（不同人）。

**v1.1 的第二条关键路径**：F1 → G2（角色装配）→ G1（群聊）→ G5（升级审批），见 §9.11。两条链可并行，但 G5 要等 A2 的收件箱壳，因此 §9 的排期必须挂在 M2 之后。

### 5.5 与 03 文档 19 条需求的对应关系

03 有 19 条（R-A1..R-E4），本方案收敛为 16 条，映射如下：

> 下表只覆盖 v1.0 的 16 条。03 的 R-C1（Agent 实例层）与 R-C2（Bot 名册）在 v1.1 中升级为 §9 的 **G4 团队名册**（吸收了 C1）；R-D2（事件触发源）与 R-E3（打扰分级）在 v1.1 中重生为 **G7 主动感知**与 **G8 打扰分级**——v1.0 判定它们「不做」的前提是「没有群聊就没有多 Bot 编排」，v1.1 改变了这个前提。

| 03 编号 | 本方案 | 处理 |
|---|---|---|
| R-A1 动作审计时间线 | F2 + C2 | 拆成「投影」与「视图」两条，因为前者可先行验证 |
| R-A2 审批收件箱 | A2 | 保留 |
| R-A3 规则表 | A3 | 保留 |
| R-A4 围栏 | A4 | 保留 |
| R-A5 高危分类表 | A5 | 保留 |
| R-B1 执行环境面板 | B1 的第三页 | 合并进 ops tab，不做独立面板（减少入口） |
| R-B2 CUA 截图流 tab | — | **降级为不做**：dsh-cua-bundle 仍标 experimental 且仅 macOS，Windows 支持在开发中，现在做等于给不稳定 API 做 UI |
| R-B3 MCP 连接器助手 | B3 | 降为 P2 只读 |
| R-C1 Agent 实例层 | C1 → **G4** | v1.0 降为 P2 只读名册；v1.1 升级为团队名册（仍不抢 dsh-agent-team 的调度权） |
| R-C2 Bot 名册 | C1 → **G4** | 合并，v1.1 起带主 Bot 星标与待升级数 |
| R-C3 记忆分区 | — | **不做**：直接复用 hindsight 的 bank 机制，无需插件层 |
| R-C4 六态投影 | A2 内 | 收敛为四态（`allowed-once`/`rejected`/`cancelled`/`unavailable`），因为 DSH 的 `ApprovalOutcome` 就是四值闭合 |
| R-D1 Routine 归属实例 | — | 移出首版（无 Agent 实例层即无归属问题） |
| R-D2 事件触发源 | — → **G7** | v1.0 移出（`dsh-schedule` 已覆盖）；v1.1 以「主动任务感知」的形态重生，信号源不只有时间 |
| R-D3 trajectory→Skill 草稿 | E1 的副产品 | 用表单卡片承载「是否固化为 skill」的询问，不单独做 |
| R-E1 表单卡片 | E1 | 保留 |
| R-E2 通知条 | E2 | 保留 |
| R-E3 打扰分级 | — → **G8** | v1.0 判定为过度设计（只有一个视图，确实不需要分级）；v1.1 有了「主动唤醒会花 token」这一新事实，分级与预算成为必需 |
| R-E4 产物归档面 | A2b | 收敛为「审计导出」 |

**收敛说明**：19 → 16，其中**删除 5 条**（B2、C3、D1、D2、E3）、**降级 3 条**（B3、C1、R-D3）、**合并 2 条**（B1、C2）。删掉的全部是「依赖尚不稳定 API」或「已有更优解」的条目——这是从对标清单走向可执行方案时必须做的减法。

**v1.1 的复算**：03 的 19 条中，v1.0 已落地 **14 条**（B1/C2 合并计一条、C1 与 R-C2 合并计一条）；v1.1 之后**共落地 16 条**——新复活的两条是 **R-D2 → G7 主动任务感知**与 **R-E3 → G8 打扰分级**，另有 **R-D3（trajectory→Skill）** 由 v1.0 的「E1 副产品」升级为 **G6 的独立需求**。始终不做的 3 条：B2（CUA 截图流，依赖 experimental API 且仅 macOS）、C3（记忆分区，已有 hindsight bank 机制）、D1（Routine 归属实例，DSH 没有可归属的 Agent 实例生命周期）。


---

## 6. 排期与里程碑

### 6.1 四个里程碑（v1.0）+ 两个里程碑（v1.1）

| 里程碑 | 内容 | 工期（单人） | 判定标准（缺一不可） |
|---|---|---|---|
| **M0 骨架通了** | F1 + A5 | 1.5 人日 | 包能 `pnpm pack` 后被 `dsh plugin add` 安装、`--dump-config` 可见、`/plugins` 页可开关；卸载后无残留 |
| **M1 账记上了**（内部可用） | +F2 +A1 +A4 | 再 5 人日（累计 6.5） | 跑一轮真实会话后，`snapshot()` 里能读出「批准 2 次、拒绝 1 次、被围栏拦下 1 次」；且**卸载插件前后审批行为逐字节一致** |
| **M2 看得见了**（可对外演示） | +B1 +A2 +B1b | 再 7 人日（累计 13.5） | 右侧栏能打开三纵切页；切换会话不丢；新审批到达时头部徽标 +1；截图可用于 README |
| **M3 说得清了**（可交付） | +A3 +C2 +E2 +A2b | 再 9 人日（累计 22.5） | 导出的 Markdown 能被第三方读懂（找一个没参与开发的人做 5 分钟可用性测试）；规则表 20 条上限与 Ask 优先有测试覆盖 |

> 里程碑人日与 §5 的需求人日严格对齐：M0 = F1 1 + A5 0.5 = 1.5；M1 = +F2 2 + A1 1 + A4 2 = +5（累计 6.5）；M2 = +B1 4 + A2 2 + B1b 1 = +7（累计 13.5）；M3 = +A3 3 + C2 3 + E2 1.5 + A2b 1.5 = +9（累计 **22.5**）。

**M3 之后**（按需）：E1 表单卡片 4 + D1 导入导出 1 + B3 连接器可见性 2 = 再 **7 人日**（C1 的 3 人日已并入 §9 的 G4，不再单列）。22.5 + 7 = 29.5，加上 G4 的 3 人日 = **v1.0 总计 32.5 人日**，与 §5 的逐条求和一致。

**v1.1 的两个里程碑**（详见 §9.10 与 §9.11）：

| 里程碑 | 内容 | 工期（单人） | 判定标准（缺一不可） |
|---|---|---|---|
| **M4 队伍拉起来了** | +G2 角色装配 +G4 团队名册 +G1 群聊 | 再 12 人日（累计 34.5） | 用两个不同 preset 起两个 Bot，在群聊视图里能看到它们各自说的话、互相派的活、以及各自的运行状态；重启 DSH 后群聊完整重建；把 DSH 降级到不含本插件的版本，会话日志**仍能正常打开**（`plugin:` 记录被跳过） |
| **M5 团队守规矩了**（v1.1 可交付） | +G5 升级审批 4 + G3 八类角色 2 + G6 示范学习 4 + G7 主动感知 4 + G8 打扰分级 2 | 再 16 人日（累计 50.5） | 子 Bot 试图删库被拦 → 工单进收件箱 → 主 Bot 在根会话发起原生审批 → 批准后重执行成功；全流程子代理**始终没有**审批权（有回归测试）；8 个角色可在 `/plugins` 页见到并 spawn；连续两次忽略建议后该类自动降级 |

> **排期纪律**：M4 必须放在 **M2 之后**（要有 `ops` tab 与 `A2` 收件箱壳），M5 必须放在 **M3 之后**（要有 `A3` 规则表与 `E2` 通知条）。这两个里程碑与 v1.0 的 M0–M3 是**同一条路上的延长线**，不是并行项目——这也是 §9.13 的核心论点。

**全量核对**：22.5（M3）+ 7（剩余 P2：E1/D1/B3）+ 12（M4）+ 16（M5）= **57.5 人日**，与 §0.3、§5.3、§9.10 的三处求和完全一致（C1 的 3 人日只计一次，在 G4 里）。

### 6.2 双人并行的切分（推荐）

| 角色 | 负责 | 依赖 |
|---|---|---|
| **Host 开发** | F1 → F2 → A1 → A4 → A3 → C2 的数据侧 | 无前端依赖，可全程在 headless 下用测试验证 |
| **Client 开发** | B1 骨架 → A2 → B1b → E2 → C2 的渲染侧 | 依赖 F2 的 wire schema 定稿（**第 3 天必须冻结**） |

> 关键协作点：**`ops.audit` 的 `wire.viewSchema` 是两人之间的接口契约**，必须在写第一行 UI 之前冻结成一份 zod schema 文件，双方各自对着它写。这是 v1.0 唯一的跨人耦合点，管住它整体就顺。

**v1.1 加入第三人后的切分**（团队能力建议单独安排一人，因为它的绝大多数工作在 Host 侧）：

| 角色 | 负责 | 与另两人的接口 |
|---|---|---|
| **Host 开发**（同上） | v1.0 的 F1 → F2 → A1 → A4 → A3 → C2 数据侧 | 冻结 `ops.audit` 的 wire schema |
| **Client 开发**（同上） | v1.0 的 B1 → A2 → B1b → E2 → C2 渲染侧 | 消费上述 schema |
| **团队/角色开发**（v1.1） | G2 → G4 → G1 → G5 → G3 → G6..G8 | 只依赖 `ops.audit` 的既有引用方式与 `subagent/catalog`；**新增契约只有一条**：`plugin:ops.chat` 的记录结构与 `ops.chat` 的 `wire.viewSchema`，同样在第 3 天冻结 |

> 第三条线之所以能并行，是因为**它不碰 v1.0 的任何文件**：新增独立的 Host 单元（`ops.bots` / `ops.chat` / `ops.triggers`）、独立的投影 key、独立的 tab 纵切页、独立的 8 条 preset 声明。唯一共享的是 bundle 骨架（F1）与 `ops` tab 类型（B1）——这两个在 M0/M2 就完成了。

### 6.3 每批次结束时必须做的事

1. `dsh --profile demo --dump-config` 复核 layer 行存在且 config 正确；
2. 把插件**卸载**一次，确认审批、审计、右侧栏全部恢复原状（这是「卸载零残留」的回归测试）；
3. 记录一次真实的「批准 + 拒绝 + 拦截」三态会话作为 fixture，供后续回归。

---

## 7. 验证方案

### 7.1 五层验证，从便宜到贵

| 层 | 验什么 | 怎么验 | 通过标准 |
|---|---|---|---|
| L1 单元 | 投影折叠的纯函数性 | 直接构造事件序列喂 `apply`，断言输出与**引用相等性**（不关心的事件 `Object.is(old,new) === true`） | 覆盖率 100% 于 `apply` 的所有分支 |
| L2 契约 | `wire.viewSchema` 是双方共用的 | 用 zod 对 `view()` 的输出做校验，客户端侧也用它校验 `useProjection` 的返回值 | 任何一侧改 schema，另一侧测试立即红 |
| L3 行为 | **不改变原有行为**（最重要） | A/B 测试：同一脚本会话，装插件跑一遍、卸载跑一遍，比对审批结果序列与工具调用序列 | 两次**逐字节一致** |
| L4 集成 | 真实会话里的三态 | 一个脚本化场景：①批准一个写操作 ②拒绝一个删除 ③让围栏拦下一次 `rm -rf` | 收件箱 3 条、时间线 3 行、导出 md 含全部三段 |
| L5 安装 | 打包与安装链路 | `pnpm pack` → `dsh plugin add ./x.tgz` → 重启 → `/plugins` 可见 → 关闭 → 重启 → 全部消失 | 开关前后 UI 与行为完全可逆 |

### 7.2 必须单独立项验证的三个技术风险（见 §8 风险 1、2、5）

| 验证项 | 为什么单独立项 | 验证方法 | 若失败的退路 |
| **V1 工具结果是否在日志里** | §3.3 的三段式时间线里，「动作」与「结果」段依赖会话事件；若 `tools/result` 的产物不写入会话日志，投影就折叠不出来 | 跑一轮含 `bash` 调用的会话，用 `dsh-session-query` 的 `readSession` / `filterEvents` 列出全部事件类型，检查工具结果是否以事件形式提交 | 只用「进程内态」渲染当前进程的结果（明确标注不持久），或改为在 `tools/result` 钩子里把摘要**写进我们自己 projection 的可持久化 side-car**（不是会话事件，走 `ctx.storage`） |
| **V2 客户端构建链路** | 官方 tsdown 预设未随包发布（§4.6） | 首日就写一个「Hello World」`client.js` 打包并安装，看是否被 `/plugins` 正确加载 | 走方案 C（纯手写 JS，零构建） |
| **V3 投影的 `stateVersion` 升级语义** | 升级插件时若状态形状变了，旧缓存必须失效 | 改一次 `stateSchema` 并 +1 `stateVersion`，确认冷读不报错、旧值被丢弃 | 每批次改动一律 +1，不尝试迁移 |

### 7.3 验收清单（交付时逐项打勾）

- [ ] `pnpm pack` 产物能在干净 profile 上安装成功，`engines.dsh` 不匹配时**明确报错**而非静默加载；
- [ ] 卸载后 `approval/request` 监听器全部注销（**用「卸载前后审批结果逐字节一致」证明**）；
- [ ] 所有 UI 文案在 `locale/{zh,en}.json` 且有 `meta.title` / `meta.description`；
- [ ] 图标 ≤256 KiB、自包含、`/plugins` 页正常显示；
- [ ] 没有新增任何未声明的会话事件类型；
- [ ] 没有一行 Typert Remote / 自建 HTTP 路由；
- [ ] 没有 import 任何其他功能插件的组件（只走 slot）；
- [ ] 高危七类无法被保存进 Allow 规则（有测试覆盖）；
- [ ] `data-plugin-css` 去重生效：插件重载两次不出现重复 `<style>`。

---

## 8. 风险与不做清单

### 8.1 风险表（按概率 × 影响排序）

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| 1 | **工具结果不在会话日志里**，三段式时间线只能显示两段 | 中 | 高（核心卖点打折） | §7.2 V1 首周验证；退路是 side-car 存储 + UI 明确标注「本进程」 |
| 2 | **客户端构建链路搞不定** | 中 | 高（前端全卡） | §4.6 方案 C 兜底（纯手写 JS，零构建） |
| 3 | **面板过多稀释主界面** | 高（若做多面板） | 中 | 只做一个 tab 类型 + 三纵切页，不做多入口；名册降 P2 |
| 4 | **审计日志体积**：长会话折叠出几万条 | 中 | 中 | `maxEventsPerSession` 上限 + `wire.view` 只切最近 500 条；`summary:false` 不进会话摘要 |
| 5 | **投影 `apply` 写成异步**，静默破坏一致性 | 低（有明确约束） | 高 | L1 单测强制同步断言；code review 清单第一条 |
| 6 | **规则滥用**：用户把高危操作写进 Allow | 中 | 高 | 高危七类在 UI 与 Host 双重拒绝保存；A4 有 12 样本测试 |
| 7 | **状态同步滞后**：`onChanged` 与 UI 渲染不同频 | 低 | 低 | `useProjection` 是官方 hook，已由 9 个包验证 |
| 8 | **DSH 版本升级破坏 API** | 中 | 中 | `engines.dsh` 收紧到 `>=0.2.2-rc.3 <0.3.0`；只依赖 A 级稳定 seam（projection / slots / tools 钩子） |
| 9 | **合规/隐私**：审计记录了完整命令与参数 | 低 | 中 | 默认对参数做长度截断（可配置）；导出时提示「含完整命令」；不采集任何环境变量值 |

> v1.1 追加的第 **10–13** 条风险（群聊成本放大、升级审批被当绕过口、`plugin:` 记录跨版本失配、示范学习生成垃圾 skill）见 **§9.12**。

### 8.2 显式不做（与 03 一致，写进 README 避免误期）

| 不做 | 理由 |
|---|---|
| 云电脑 / 托管 VM / 跨设备持久工作区 | 本题明确排除（03 §5） |
| Vault / Cookie / 密码同步 | 同上；且 DSH 的定位是本地执行，凭据不该经我们过手 |
| 网络控制 / 出站 IP / 企业策略 | Grok Bot 的 Enterprise 能力，属于组织级基础设施，不是插件职责 |
| CUA 截图流面板 | 依赖的 `dsh-cua-bundle` 仍标 experimental 且仅 macOS |
| 自建 Agent 调度 / 任务分配引擎 | `dsh-agent-team` 已有共享任务板（`team_task_*` 四工具 + DAG 依赖），抢它没有增量价值。v1.1 的 G4/G5 **只读不改**任务板：名册是 catalog 的视图，升级工单走本插件自己的 `plugin:` 记录 |
| 模型选择器 | DSH 已有 `conversation.input.model`；Grok Bot 没有模型选择器是它的缺陷不是特性 |
| **平级**的多 Bot 群聊（Bot 之间自由互发、对等协商、无根） | v1.1 **做**群聊，但**不做平级**：群成员仍是根 agent 下的子代理（层级委托不变），消息必须经根或经插件投递。理由是 DSH 的 `subagent` 只在树内寻址（`resolveName` 走 catalog、跨树需 `cwd` 严格相等），做真正的对等网络等于绕开整个身份与授权体系。**详见 §9.4 与 §9.13：我们做的是「层级委托之上的协作视图」，不是「把层级换成网状」。** |
| 第二个「始终允许」入口 | 审批 UI 归 `dsh-client-ui-approval`；多一个入口就多一条绕过路径。v1.1 的收件箱裁决**只对升级工单生效**（`escalation.adjudicate` 默认 `false`），不接管原生 `approval/request` 的作答权，高危七类永不可裁决 |
| 子 Bot 自主审批 / 自建审批引擎 | 子代理的 approval 恒为 `never`（C-1），这是 DSH 的安全设计不是缺陷。我们的升级通道是「拦截 → 工单 → 根会话原生审批 → 主 Bot 重执行」，**不给子代理任何审批权** |
| 把 `plugin:` 记录当作正式 schema 发布 | `PluginRecordMap` 的约定原文是「these declarations do not enter SessionEventMap or released persistence schemas」。我们自带 `version` 字段并容忍跨版本失配，不承诺兼容性 |

### 8.3 如果只能交付一条需求

> **交付 F2（`ops.audit` 审计投影）。** 它没有 UI、没有分发行为、没有一行前端代码，却是整条产品线的**数据地基**：审计有了，收件箱、时间线、导出、统计全部是它的视图。而它本身已经产生了价值——`--patch` 挂上之后，`snapshot()` 里就有了一份可编程消费的审批与拦截账本，用户可以用 `dsh headless --json` 把它接进自己的流水线。


---

## 9. 多 Bot 团队与主动能力（v1.1 增补）

> 本章回应 2026-11-17 追加的五项需求：多 Bot 群聊协作、每 Bot 独立角色·记忆·上下文·权限、主 Bot 统筹与敏感节点审批、零代码流程学习、主动任务感知、8 类开箱角色。
>
> 结论先说：**这五项在 DSH 里没有一项能「照抄」，但五项全部有正规落点，且没有一项需要云电脑。** 代价是 8 条新需求、约 28 人日净工，以及一条必须先承认的架构事实——**DSH 的子代理没有审批权**，所以「敏感节点审批」在产品上必须由插件自己造一条升级通道，而不能复用原生 approval。

### 9.1 需求翻译：用户原话 → 可执行部件 → DSH 落点

| 用户原话（逐条拆解） | 拆成可执行的部件 | DSH 落点 | 判定 |
|---|---|---|---|
| 「需要一个**群聊**功能，支持创建多个不同分工的 Bot」 | 群成员 = 一组具名子代理；群视图 = 它们的消息聚合 | `subagent/catalog`（成员）、`subagent/start` 与 `subagent/end`（生命周期）、`plugin:ops.chat`（消息）、`ops.chat` 投影 | 🛠 需新建（视图 + 事件族） |
| 「每个 Bot 有**独立的角色**」 | 独立系统提示词前缀 + 独立技能层 | `agent-preset` 内挂 `@deepseek-ai/dsh-persona`（prefix / suffix / complete）+ `ctx.skills` 的 scope 层 | ✅ 直接复用 |
| 「独立的**记忆**」 | 独立 Session 日志；跨会话检索按需开放 | 每 Bot 一个 Session（天然隔离）+ `dsh-tool-session-query`（要求 `cwd` 严格相等） | ✅ 直接复用 |
| 「独立的**工作上下文**」 | 不吃父对话历史，只收任务书 | `subagent` 的 spawn 形态（`inheritsParentContext = false`）+ `send_message` 的消息前缀 | ✅ 直接复用 |
| 「独立的**权限边界**」 | 各自沙箱模式 + 各自权限预设 + 各自工具白名单 | `permissionPresets`（**Session 级**）+ preset 内的 `ctx.tools.restrict(filter)` | 🔶 需装配（无进程级 per-agent 权限表） |
| 「Bot 之间可以**共享信息、拆分任务、并行执行**」 | 共享任务板 + 点名投递 + 扇出 | `team_task_*` 四工具（DAG 依赖）+ `send_message` + `ctx.workflowEngine` | ✅ 直接复用 |
| 「复杂工作**自动分派**给对应专长的智能体」 | 主 Bot 按角色路由 | 根 agent 的规划能力 + `subagent` 的 `agent_preset` 参数 + 角色目录 | 🔶 需装配（DSH 无自动路由，路由由模型决策） |
| 「设有**主 Bot 统筹全局**」 | 根会话就是主 Bot，名册标星 | 根 agent 名恒为 `lead`（`namesOf`）+ `plugin:ops.bot` 记录主 Bot 标记 | 🔶 需装配 |
| 「遇到需要人工决策的**敏感节点会主动发起审批**」 | 子 Bot 的动作被拦 → 升级工单 → 人拍板 | **子代理 approval 恒为 `never`**，必须自建：`tools/pre-execute` 拦截 + `plugin:ops.escalation` + 根会话 `ctx.approval.request()` | 🛠 需新建（唯一硬骨头） |
| 「**零代码流程学习**：完整演示一遍，Bot 观察并抽象为可复用例程」 | 回放既有会话 → 生成 skill 草稿 + workflow 草稿 + 定时绑定 | `sessionQuery.readSession` 回放 + `ctx.skills.register` 或写 `.dsh/skills` + `ctx.workflowEngine` + `ctx.schedule` | 🛠 需新建（无录制能力，只有回放生成） |
| 「**主动任务感知**：结合目标、截止时间、上下文主动发现待办」 | 三路信号源 + 候选生成 + 打扰预算 | `dsh-goal-round-driver`（同会话续行）+ `ctx.schedule`（跨会话定时）+ `todo/write` / `team/task` / `deliverables/presented` 投影 | 🛠 需新建（候选生成与预算） |
| 「8 类**开箱即用**的 Bot 角色」 | 8 个 preset 声明 + 8 份角色说明书 | 8 个 `agent-preset` 声明（每个含 persona + skills + tools 子插件列表） | 🔶 需装配（写 YAML 即可，但有分发约束） |

### 9.2 六条硬约束（先说不行的，再说不做假承诺）

这六条全部来自本机源码直读（A 级），任何一条被忽略，方案就会在实现阶段撞墙。

| # | 约束 | 证据 | 对设计的影响 |
|---|---|---|---|
| **C-1** | **子代理没有审批权，且不可在会话内放宽** | `dsh-subagent/src/child-agent.ts` 的 `captureDelegatedPolicyOverrides()` 恒把 `approvalPolicy` 钉为 `'never'`；子代理系统提示词原文：「operations that require approval are rejected automatically」 | 「子 Bot 遇到敏感节点弹审批」在 DSH **不存在原生路径**。必须由插件在工具前置钩子里拦住，转成工单，再由根会话发起审批 |
| **C-2** | **事件不唤醒任何 Agent** | `Agent.inject()` 源码注释原文：「Queue model-facing context for the next pre-step **without waking the driver**」；`dsh-tool-subagent-control` 的 `wait_agent` 明确「任务变化不会结束等待」 | 「主 Bot 主动统筹」不能靠事件驱动。要么 `followup()` 开新轮，要么 `sendMessage()` 投递（`sendMessage` 对 idle 目标会「开始或恢复轮次」） |
| **C-3** | **未声明的会话事件类型会让日志不可重建** | `dsh-session-persistence/src/storage-contract.ts:75`：`if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable !== true) throw` | 群聊若要持久化，只能用 `plugin:` 前缀 + `ignorable: true` + `appendPluginRecord()`；旧版本读到时会跳过（这正是我们需要的可降级） |
| **C-4** | **Chat 节点只属于视图目标包** | `dsh-client-ui-workflow-run` 用的是内置 client bundle 里的 `ctx.uiConversation.events.register()` + `ctx.uiConversation.views.register()`，而这两个 registry 在 `dsh-client-ui-conversation` 中标注为「target package 通过 declaration merge 扩展」 | 第三方插件**不能**把自己的记录渲染进主对话流。群聊视图必须落右侧栏 tab（与 v1.0 的 `ops` tab 同构），这是本方案的自然延伸而非妥协 |
| **C-5** | **每轮只有一张行动卡，且子代理不能发卡** | `dsh-action-cards` README：拒绝「来自 subagent 的调用」「同一轮第二次调用」，所有种类合计每轮只展示一张 | 群聊里「Bot 发起表单卡片」不可行；卡片能力保留给主 Bot 或用户在根会话里用 |
| **C-6** | **独立角色必须走 preset，且 preset 只在 spawn 时可指定** | `dsh-tool-subagent/src/preset-selection.ts`：`agentPreset` allowlist 非空才把 `agent_preset` 参数暴露给模型；`assertProvider` 对 `inheritsParentContext` 的 provider 直接抛错。`dsh-persona` README：**不支持全局挂载**，必须挂在 preset 组装内部 | 每个 Bot = 一个 preset（写 YAML 分发）；`subagent_fork` 选不了 preset，团队成员的创建只能用 `subagent`（spawn） |

### 9.3 架构增量：三个新 Host 单元 + 两个新客户端落点

v1.0 是「1 个 bundle / 4 个 Host 单元 / 6 个 Client 注册点 / 16 条需求」。v1.1 变成「**1 个 bundle / 7 个 Host 单元 / 8 个 Client 注册点 / 24 条需求**」。

```
                        会话日志（唯一真相源）
   approval/*   tool/*   subagent/catalog   subagent/start|end   plugin:ops.*
                              │
        ┌─────────────────────┼──────────────────────┬──────────────────┐
        ▼                     ▼                      ▼                  ▼
  ① ops.audit          ② ops.env            ③ ops.bots          ④ ops.chat       ⑤ ops.triggers
  （v1.0 审计脊柱）    （v1.0 执行环境）    （v1.1 名册）        （v1.1 群聊）     （v1.1 主动感知）
        │                     │                      │                  │                │
        └──────┬──────────────┴──────────┬───────────┴──────────┬───────┴────────────────┘
               ▼                         ▼                      ▼
        右侧栏 ops tab             设置分区「团队」         升级工单（收件箱第三段）
      （五个纵切页，一个入口）       （主 Bot / 预算 / 分级）   （子 Bot 被拦的动作）
```

**七个 Host 单元**：`ops.audit`（v1.0）、`ops.env`（v1.0）、`approval-index`（v1.0）、`policy`（v1.0）、`ops.bots`（新）、`ops.chat`（新）、`ops.triggers`（新）。

**八个 Client 注册点**：v1.0 的六个 + `ops` tab 的第四、第五纵切页（团队、群聊）+ 设置分区「团队」。

### 9.4 群聊：把「一群 Bot」做成一个可读的协作流

#### 9.4.1 群聊的成员是什么

**群成员 = 一组具名、可续接的子代理。** 依据 `dsh-subagent/src/catalog.ts`（`SUBAGENT_CATALOG_VERSION = 3`）：catalog 条目带 `name`（小写字母数字连字符、1–32 位，不能是保留名 `lead`），根名恒为 `lead`，后代是斜杠路径（如 `reviewer/checker`）。**这就是天然的「群成员表」，不需要另建成员模型。**

规模上限照抄 DSH 的既有约束而不是自造：`SubagentRuntime` 的 `maxActiveSubagents` 默认 **8**、`maxDepth` 默认 **1**（即默认只有根与直属子级两层）。所以群聊规模定为 **2–6 个 Bot**（与 Grok Bot 一致），加上根正好不超过 8。

#### 9.4.2 群聊的数据从哪来（三路复用，一路新写）

| 消息类型 | 来源 | 是否需要新事件 |
|---|---|---|
| Bot 的产出与状态（开始 / 结束 / 失败） | `subagent/start`、`subagent/end`（emit，已存在） | 否 |
| 谁给谁派了活 | `send_message` 引起的收件箱插入（`agent/inbox/inserted`，payload 含 agent 与 UserMessage） | 否 |
| 需要人拍板 | `approval/asked` + `approval/decided`（v1.0 已折叠进 `ops.audit`） | 否 |
| **群聊对话本身**（主 Bot 的开场、成员间的转述、用户插话） | 无现成事件（`team/message/queued` 与 `team/message/delivered` 已标注为 **Historical**，新版本不再写入） | **是** |

> 关键判断：**群聊不能靠 `team/message/*` 重建。** `dsh-agent-team/src/types.ts` 对这两个事件的注释原文是「Historical mailbox enqueue; new sends use the target Agent inbox.」——它们只是历史兼容，不是现行数据源。

新事件族（唯一新增的持久化面，且刻意最小化）：

```ts
// lib/chat-record.ts —— 自行 augment，不进入 SessionEventMap
declare module '@deepseek-ai/dsh-session/types' {
  interface PluginRecordMap {
    'plugin:ops.chat': {
      version: 1
      chatId: string          // 群 id，通常等于根 Session id
      seq: number             // 群内自增
      kind: 'message' | 'handoff' | 'escalation' | 'system'
      from: string            // 'user' | 'lead' | 子代理名字（斜杠路径）
      to?: string
      text: string            // 已截断，默认 2 KiB
      atSeq: number           // 对应会话事件的 seq，用于跳转
    }
  }
}
// 写入：session.appendPluginRecord('plugin:ops.chat', record)
```

配套投影 `ops.chat`（`stateVersion: 1`）折叠上述四类事件 + `plugin:ops.chat`，输出：

```ts
{ chatId, members: [{ name, role, status: 'idle'|'running'|'failed', lastAtSeq }],
  messages: [{ seq, kind, from, to?, text, atSeq, outcome? }],   // 只切尾部 200 条
  counters: { messages, escalations, tokensEstimate } }
```

#### 9.4.3 群聊的交互（对标 Grok Bot 的群聊体验，但按 DSH 语义落地）

| 动作 | 用户怎么做 | 背后发生什么 |
|---|---|---|
| 建群 | 右侧栏「团队」页 → 选角色 → 生成成员 | 插件依次 `subagent({ agent_preset: 'bot-<role>', name })`，把成员名写进 `plugin:ops.bot` |
| 对全员说一句 | 群聊输入框，`@all` 或不点名 | 插件对每个成员调 `send_message`；**逐条计 token**，头部显示本次派活的预估 |
| 点名单挑 | `@researcher 查一下竞品定价` | 只投递给该成员 |
| 私聊某个 Bot | 右侧栏团队页点该行 → 打开它的会话 | 直接复用官方子代理会话路由 `dsh-resource://subagentchat/session/<child>?parent=<parent>`，不新写 UI |
| 让主 Bot 统筹 | 群聊里 `@lead 你来分` | 根 agent 收 Steer，自己决定扇出 |
| 打断 | 群聊消息上的「停」 | `subagents.interrupt(targetSessionId, authority)` |

**成本可见性是本节最有差异化的设计。** Grok Bot 的群聊被用户投诉「4 个 Bot 开场就吃掉 25% 额度」（01 文档 §9）；DSH 没有额度概念，但有 token。群聊头部固定显示三行：本轮 token 估算、本群累计、按成员拆分的前三名。这直接复用了 v1.0 的审计脊柱（`ops.audit` 已经在数工具调用），增量很小而价值很大。

### 9.5 四维独立：角色 / 记忆 / 上下文 / 权限

| 维度 | Grok Bot 的做法 | DSH 的正规落点 | 差距与我们补什么 |
|---|---|---|---|
| **角色** | Bot 有名字、岗位、描述、自定义指令 | 每个 Bot = 一个 `agent-preset`，preset 内挂 `dsh-persona`（`prefix` 必填、`suffix` 默认位于 order 10200、还有 `complete` 模式）+ 该角色专属 skill 层 + 工具子集 | **无差距**。preset 比 Grok Bot 的「自定义指令」更强：它连带工具与技能一起换 |
| **记忆** | 云电脑上的文件 + 会话历史 + 记忆条目；同账号所有 Bot 共享一台电脑 | 每 Bot 独立 Session（天然不串味）；共享靠 `dsh-tool-session-query` 跨会话检索，**但要求目标与调用方的 `cwd` 严格相等** | **有差距**：DSH 的共享是「同工作区才能搜」，跨工作区被明确拒绝（`SESSION_QUERY_TOOL_UNAUTHORIZED`）。→ 设计上强制「一个团队 = 一个 workspace」，写进 preset 的默认 cwd |
| **上下文** | 每个 Bot 独立的工作上下文 | `subagent`（spawn）不吃父对话，只收任务书；只有 `subagent_fork` 才继承 | **无差距**，且默认用 spawn 更符合「专人专事」 |
| **权限** | 每个 Bot 独立的审批边界与运行环境 | `permissionPresets` 是 **Session 级**（A 级），可逐 Bot 设；但**子代理的 approval 恒为 `never`**（见 C-1） | **硬差距**：子 Bot 无审批权。→ §9.6 的升级通道是本方案必须自建的部分 |

### 9.6 主 Bot 统筹与敏感节点审批（本章最难也最有价值的一块）

#### 9.6.1 问题定义

Grok Bot 的模型是：每个 Bot 都能在自己那台云电脑上弹审批卡，人不在就 Expired。DSH 的模型是：**根会话有审批，子代理没有**。所以「子 Bot 遇到敏感动作要请示」在 DSH 必须翻译为：

```
子 Bot 想执行高危动作
   → tools/pre-execute 钩子（本插件，prepend）判定为「需人工拍板」
   → 不执行，写一条 plugin:ops.escalation
     （含工具名、参数摘要、风险类目、为什么需要人拍板）
   → 主 Bot（根 agent）在自己的下一步收到该工单摘要
   → 根会话里 ctx.approval.request() 发起原生审批（必须在未结束的轮次内）
   → 人批准后，由主 Bot 重新执行该动作（参数从工单读，不重放已被拒绝的调用）
```

这条链的每一个箭头都有 A 级依据，唯一「新」的是中间那段工单与重执行策略。

#### 9.6.2 为什么必须「重执行」而不是「放行原调用」

`ctx.approval.request()` 的源码要求「处于未结束的轮次内」，且 README 原文：「待处理审批仅在进程内有效：检查点不恢复待处理应答的 Promise 或一次性授权」。子代理的工具调用是**另一个 Agent 的另一个轮次**，两者无法安全地挂起等待。所以 **拦截 → 工单 → 主 Bot 重执行** 是唯一不产生悬挂 Promise 的形态。

#### 9.6.3 收件箱的定位因此变化（必须显式声明）

v1.0 把审批收件箱设计成**只读**（§8.2 明确不做「第二个『始终允许』入口」）。v1.1 要满足「主动发起审批」，收件箱必须多一段：**升级工单**，并且这一段在开关打开时是**可裁决**的（批准 / 拒绝 / 改参数）。

| 配置 | 默认 | 行为 |
|---|---|---|
| `escalation.adjudicate` | `false` | 收件箱**只展示**工单，人去 composer 的原生审批卡裁决（保守，完全符合 v1.0 的只读承诺） |
| `escalation.adjudicate` | `true` | 收件箱可直接裁决工单；裁决结果写进 `plugin:ops.escalation`，主 Bot 读到后重执行 |

**这不是「第二个始终允许入口」。** 收件箱的裁决只对**升级工单**生效（子代理发起的、本来会被确定性拒绝的那一类），不接管 `dsh-client-ui-approval` 对原生 `approval/request` 的作答权。两条通道互斥且审计里可区分（`channel: native | escalation`）。

#### 9.6.4 主 Bot 的「主动」边界

主 Bot 不能靠事件唤醒（C-2），所以「统筹」只允许三个触发源：

1. **用户在群聊里说话** → 插件 `send_message(lead, ...)` → 根 agent 开轮；
2. **定时器到点** → `ctx.schedule` 投递给根会话（投递目标可以是 `session` / `new_once` / `new`）；
3. **升级工单产生** → 插件对根 agent 调 `followup()`（开新轮）。

除此之外**不允许**插件自造轮次。这一条写进代码评审清单。

### 9.7 零代码流程学习：DSH 没有录制，只有回放

Grok Bot 的「Teach a task」是一对一对话 + 云电脑画面打开时的**录制**（最长 10 分钟、不录麦克风、生成草稿、官方标 gradual rollout）。DSH 没有等价物，但有一条更可靠的路：**会话日志本身就是完整的执行轨迹**。

#### 9.7.1 设计：「做一遍 + 说一句」

```
① 用户在任意会话里正常完成一次工作（照常对话，不需要开任何录制模式）
② 用户说：「把刚才这套记成一个例程」
③ 插件读该会话的完整事件日志（ctx.sessionQuery.readSession）
④ 抽取：工具调用序列 + 参数骨架 + 人工介入点（approval/asked）+ 失败重试点
⑤ 生成三件产物（都要人工确认后才落盘）：
   a. SKILL.md 草稿 → <projectRoot>/.dsh/skills/<name>/SKILL.md （发现 rank 100，最高优先级）
   b. workflow 脚本草稿 → WorkflowStartRequest.script 形态的 JS
   c. 定时绑定（可选）→ ctx.schedule 的 rrule + 目标会话
⑥ 用户在右侧栏审阅 diff，点「保存」后才写盘
```

#### 9.7.2 能力上限（必须诚实写进 UI）

| 能学到 | 学不到 |
|---|---|
| 工具调用序列与参数骨架（bash / 文件读写 / MCP 工具） | 鼠标键盘级操作（`dsh-cua` 自己声明「会话决定没有自动保留期限」） |
| 人工介入点（哪一步停下来问人） | 用户当时的隐含判断（为什么选 A 不选 B） |
| 失败与重试的形态 | 环境状态（会话日志记的是动作，不是机器状态） |

→ 首版只承诺「工具调用型流程」，CUA 型流程明确标注**未覆盖**。这与 03 文档「排除云电脑 ≠ 排除 Computer Use」的边界一致。

### 9.8 主动任务感知：三路信号 + 一个预算

| 信号源 | 已有能力 | 我们做什么 |
|---|---|---|
| **目标**（goal 未完成） | `dsh-goal-round-driver` 已在 idle + goal active 时续行 | 不重复造，只把 goal 状态投影成「进行中的事」 |
| **截止时间** | `ctx.schedule` 七种时间类型 | 允许把任意 goal / 任务挂一个「截止」时间 |
| **上下文待办** | `todo/write`、`workspace/changes`、`deliverables/presented`、`team/task`（未完成项） | 折叠成候选清单 |

产出形态**不是行动卡**（C-5：每轮只一张且子代理不能发），而是收件箱的第三段「建议」+ 通知条（复用 v1.0 的 E2）。

**打扰分级与预算**——这是 Grok Bot 没做好、我们可以做得更好的地方（它的主动通知同样被投诉打扰）：

| 级 | 表现 | 触发条件 |
|---|---|---|
| L0 静默 | 只进收件箱，不出现在任何浮层 | 默认 |
| L1 通知条 | 会话底部一条可关闭提示（`shell.overlay`，穿透点击） | 候选紧急度 ≥ 阈值 |
| L2 唤醒 | 对根 agent `followup()` 开一轮（**唯一会花钱的一级**） | 用户显式要求「有事直接找我」，且当日预算未用尽 |

预算：每团队每日默认 **3 次** L2 唤醒；用户连续两次忽略某类建议 → 该类自动降级到 L0 并保留 30 天。这三个数字写进设置分区，可改。

### 9.9 八类开箱角色：8 个 preset 声明，不是 8 份文档

依据 `dsh-agent-preset-registry` README：注册表**不扫描目录、不接受 preset 路径、没有任何 YAML 写回接口**；新建 preset 的唯一方式是 bundle 补丁 + `plugin_manager` 安装。所以角色包的分发形态是**一个 bundle 里 8 条 preset 声明**。

| # | 角色 id | 中文名 | 典型任务（对齐 01 文档 §3 的场景分类） | 默认工具面 |
|---|---|---|---|---|
| 1 | `bot-sales` | 销售拓客 | 录 CRM、写跟进邮件、整理线索 | 文件读写 + 邮件 / CRM 连接器（只读 + 草稿） |
| 2 | `bot-recruiter` | 人才招聘 | 简历筛选、面试安排、候选人跟踪 | 文件读写 + 表格 + 日历 |
| 3 | `bot-ops` | 运营支持 | 报表整理、周报汇总、数据核对 | 文件读写 + 表格 |
| 4 | `bot-engineer` | 工程助理 | 复现 bug、建 ticket、跑测试、读代码库 | 全工具（含 bash）+ 仓库读写 |
| 5 | `bot-support` | 客服工单 | 工单分流、话术草稿、退款请求初判 | 文件读写 + 工单系统连接器 |
| 6 | `bot-researcher` | 研究整理 | 竞品调研、政策追踪、资料汇编 | 文件读写 + 网络抓取 |
| 7 | `bot-finance` | 财务报销 | 票据整理、报销单核对、预算比对 | 文件读写 + 表格（**禁转账类工具**） |
| 8 | `bot-content` | 内容运营 | 公众号 / 社媒草稿、图文排版 | 文件读写（**发布动作强制升级审批**） |

每个 preset 的内容是固定的四段（这就是「开箱即用」的全部实现）：

```yaml
# cordis.patch.yml 片段（8 条之一）
- insert:
    - id: bot-recruiter
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: bot-recruiter
        name: 人才招聘
        description: 简历筛选、面试安排、候选人跟踪
        plugins:
          - '@deepseek-ai/dsh-persona'       # prefix: 招聘专员的岗位说明书
          - '@deepseek-ai/dsh-skills'        # scope 层：只挂招聘类 skill
          - '@deepseek-ai/dsh-tool-bash'     # 需要跑脚本解析简历
          # ... 其余为该角色允许的工具子集
```

> 约束提醒（A 级）：`id` 是 Loadable 编辑地址、`config.id` 才是会话保存的 preset id；二者必须一致，否则用户默认选择会错位。8 个角色包 = 8 条这样的声明 + 8 份 persona 文本 + 8 个 skill 目录。

### 9.10 新增 8 条需求（R-G1 ~ R-G8）

| # | 优先级 | 需求 | DSH 落点 | 验收标准 | 依赖 | 人日 |
|---|---|---|---|---|---|---|
| **G1** | P1 | **群聊消息族与投影**：`plugin:ops.chat` 记录 + `ops.chat` 投影 + 右侧栏群聊页 | `appendPluginRecord` + `ctx.sessionProjections.register` + `ops` tab 第五纵切页 | 5 个 Bot 跑一轮协作，群聊页按时间显示每条消息与状态；`subagent/start`、`subagent/end`、`send_message` 三路都进流；重启后完整重建；旧版本 DSH 读到 `plugin:ops.chat` 时**跳过而非报错** | F1, F2 | 6 |
| **G2** | P1 | **Bot 角色装配**：preset 内挂 persona + 技能层 + 工具白名单，由 `subagent` 的 `agent_preset` 选择 | `dsh-agent-preset` + `dsh-persona` + `ctx.tools.restrict` | 两个不同 preset 启动的子代理，其系统提示词前缀逐字节不同；工具清单按 preset 生效（未授权工具调用返回未知名错误）；`subagent_fork` 传 preset 时**明确报错**而不是静默继承 | F1 | 3 |
| **G3** | P2 | **8 类角色包**：8 条 preset 声明 + 8 份 persona + 8 个 skill 目录 | bundle patch 的 8 条 insert | 安装后能见到 8 个角色；任选一个 spawn 出的子代理，其自我介绍与角色一致；卸载后不留残留 preset | G2 | 2 |
| **G4** | P1 | **团队名册与主 Bot 标记**（吸收 v1.0 的 C1）：列出本树所有 Bot 的角色、状态、最近动作、待审批 / 待升级数，并标出主 Bot | `subagent/catalog` + `subagent/descriptor` + `plugin:ops.bot` + `ops` tab 第四纵切页 | 名册与 `list_agents` 输出逐条一致（名字、状态）；主 Bot 行有星标；点行可跳到该 Bot 的会话页 | G1 的投影基座 | 3 |
| **G5** | P1 | **升级审批通道**：子 Bot 的高危动作被 `tools/pre-execute` 拦下 → 写工单 → 主 Bot 收到 → 根会话 `ctx.approval.request()` → 批准后主 Bot 重执行 | `tools/pre-execute`（prepend）+ `plugin:ops.escalation` + `ctx.approval.request` | ①子代理永远拿不到审批权（回归测试：子代理调需审批工具仍被确定性拒绝）②工单必须带工具名 + 参数摘要 + 风险类目 ③`adjudicate:false` 时收件箱不可裁决，`true` 时可裁决且裁决写进日志 ④**没有任何一条路径**能让收件箱放行原生 `approval/request` | A1, A2, G1 | 4 |
| **G6** | P2 | **示范 → Skill 草稿**：回放一次会话，生成 SKILL.md + workflow 脚本 + 可选定时，人工确认后落盘 | `ctx.sessionQuery.readSession` + `ctx.skills.register` 或写 `.dsh/skills` + `ctx.workflowEngine` + `ctx.schedule` | 对一段含 8 次工具调用的会话，生成的 SKILL.md 步骤数与工具调用数一致；**未确认前不写盘**（用只读目录测）；生成物能被 `skill` 工具正常加载 | F1 | 4 |
| **G7** | P2 | **主动任务感知**：三路信号折叠成候选清单，进收件箱第三段 | goal / schedule 投影 + `todo/write`、`workspace/changes`、`team/task` 折叠 + E2 通知条 | 造一个「goal 未完成 + todo 有 3 条未完成 + 交付物已产出」的会话，候选清单必须列出 ≥2 条且不重复；同一候选 24 小时内不重复提示 | E2, F2 | 4 |
| **G8** | P2 | **打扰分级与预算**：L0/L1/L2 三级 + 每日 L2 上限 + 连拒降级 | 设置分区「团队」+ `ctx.settings` + `agent.followup()` | L2 超过每日上限后不再唤醒（单测：第 4 次调用不产生 `followup`）；连续两次忽略后该类建议降级并在 30 天后恢复 | G7 | 2 |

**R-G 合计 28 人日**；其中 P1 四条（G1 / G2 / G4 / G5）共 **16 人日**，是「群聊 + 主 Bot + 升级审批」的最小可用集。

### 9.11 需求总表更新（24 条）与依赖图

```
F1 打包骨架
 ├── F2 ops.audit ──┬── B1 右侧栏 ops tab ──┬── A2 收件箱
 │                  │                       ├── C2 时间线（+A4/A5）
 │                  │                       ├── B1b 头部按钮 / B3 连接器 (P2)
 │                  │                       └── G4 团队名册  ←（吸收 C1）
 │                  └── G7 主动感知 (P2) ──── G8 打扰分级 (P2)
 ├── A1 审批旁听 ──────────────── G5 升级审批通道（同时依赖 A2 与 G1）
 ├── A4 围栏 ── A5 分类表 ── A3 规则表 ── E2 通知条 ── D1 导入导出 (P2)
 ├── G2 Bot 角色装配 ── G3 八类角色包 (P2)
 ├── G1 群聊（新事件族 + 投影 + 视图）
 ├── G6 示范 → Skill 草稿 (P2)
 └── E1 表单卡片 (P2)
```

**关键路径（v1.1）**：`F1 → F2 → B1 → C2`（v1.0 不变）与 `F1 → G2 → G1 → G5`（v1.1 新增）。两条链可并行，但 G5 要等 A2 的收件箱壳。

### 9.12 新增风险（接 §8.1 的第 10–13 条）

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| 10 | **群聊把成本放大**：6 个 Bot 每条消息都计 token，用户可能像投诉 Grok Bot 那样投诉我们 | 高 | 中 | 群聊头部常驻 token 三行（本轮 / 累计 / 前三名）；建群时给一次「6 个 Bot 大约贵 4–6 倍」的明示；默认策略是「群默认 2 人，按需加人」 |
| 11 | **升级审批被当成绕过口**：有人把 `adjudicate` 打开当「始终允许」用 | 中 | 高 | 裁决只对工单生效、不碰原生 approval；高危七类（01 §10 官方清单）**永不可裁决**，只能拒绝或改参数；所有裁决进审计并标注 `channel: escalation` |
| 12 | **`plugin:` 记录跨版本失配**：将来 DSH 升级改了 `PluginRecordMap` 约定 | 低 | 中 | 记录里带 `version` 字段；投影 `stateVersion` 同步 +1；读不懂的记录按 `ignorable` 跳过而不是整体拒绝（C-3 的反向利用） |
| 13 | **示范学习生成垃圾 skill**：把一次偶然的失败重试当成固定步骤 | 高 | 低 | 生成后强制人工 diff 确认；草稿里对「重试」「失败」步骤加显式标注；默认不直接写进 `.dsh/skills`（先作为交付物呈现，用户确认后移动） |

### 9.13 这一章与 v1.0「做窄而深」的关系

v1.0 的结论是「只做审计这一件事」。**v1.1 没有推翻它，而是沿着同一根基往下长：**

- **审计脊柱仍是唯一的真相源**。群聊、名册、升级工单、主动建议，全部是同一个投影体系上的第五、六、七个视图，不是七套独立机制。
- **没有一个是「平行的新系统」**。群聊不新建消息栈（用 `plugin:` 记录 + catalog），名册不新建成员模型（用 catalog），升级不新建审批引擎（用 `approval/request`），示范学习不新建录制器（用会话日志回放）。
- **唯一的行为变更只有一处**：收件箱从「只读」变成「默认只读、可开关裁决」。这一处已单列成配置项与风险 11，可随时退回 v1.0 行为。

> 一句话：**v1.0 让 Agent 干活「有账可查、有闸可拦、有话可说」；v1.1 让这口账本从「一个人干」扩展到「一个团队干」——查谁的账、拦谁的闸、替谁说话。**

## 10. 附录

### 附录 A｜API 速查表（写作与实现时对照用）

**Host 侧**

| 用途 | API | 关键约束 | 证据级 |
|---|---|---|---|
| 注册投影 | `await ctx.sessionProjections.register(def)` → `handle.stateOf/readerFor/dispose` | 返回 thenable 非原生 Promise；`apply` 必须同步；不关心的事件返回同一引用 | A |
| 读投影 | `ctx.sessionProjections.snapshot(session)` → `{asOfSeq, values}` | `asOfSeq` 空日志为 -1，是共享水位 | A |
| 变更订阅 | `onChanged(listener)` / `onEventChanged(listener)` | 前者每变化单元一次，后者每提交事件一次 | A |
| 旁听审批 | `ctx.on('approval/request', async (req, next) => ... return next())` | agent-scoped waterfall；**必须透传** | A |
| 读审批策略 | `ctx.approval.effectivePolicy(session)` → `'ask' \| 'never'` | 生效值 = 日志最后一条 `approval/policy` 事件，回退服务配置 | A |
| 工具前置策略 | `ctx.on('tools/pre-execute', async (exec, next) => PreToolDecision)` | 返回 `{kind:'ask', reason, displayReason}` 可发起提问 | A |
| 单调拒绝 | `ctx.tools.guard((exec) => string \| ToolGuardDenial \| undefined)` | **没有 allow 分支**，类型上不可翻案 | A |
| 工具结果观测 | `ctx.on('tools/result', (exec, result) => void)` | emit（非 waterfall）、深冻结快照、监听器失败被隔离 | A |
| 注册设置页策略 | `ctx.settings.configure({auto?}, owner)` / `prepareDocument()` / `describe()` / `update(ns, patch, rev?)` | 每次写入验证完整 Config，拒绝过期 revision | A |
| 后台任务 | `ctx.jobs.start({ kind, label, owner, run })` → `{ kind:'background', jobId }` | 长任务用任务自有取消信号而非 `exec.signal` | A |
| 沙箱解析 | `ctx.sandboxPolicy.resolve({ session?, mode? })` → `{mode, workspaceRoot, additionalWritableRoots?}` | `danger-full-access` 不走 ctx.sandbox；Windows 子进程忽略 additionalWritableRoots | A |
| 注册工具 | `ctx.tools.register(defineTool({...}))` | 必须声明 `output{ schema, render }`；`exec.signal` 必须被尊重 | A |
| 表单/提案卡片 | `ctx.actionCards.register({ action, skill, invitation, details, verbs, act })` | 必须先 load `skill` 才能 propose | A |
| 发起用户提问 | `ctx.userQuestions` / `dsh-tool-ask-user`（`mode:'timed'` + timeout） | 超时返回 `{pending:true, callId}`，**不是拒绝** | A |

**Client 侧**

| 用途 | API | 关键约束 | 证据级 |
|---|---|---|---|
| 注册 UI | `ctx.slots.register({ name, id/key, order }, Component)` | 向未声明 slot 注册会在激活时失败；不 import 他人组件 | A |
| 向他人 slot 贡献 | `ctx.slots.inject(key, () => ctx.slots.register(...))` | owner 折叠时自动移除、重挂时重跑 | A |
| 右侧栏 tab 类型 | `ctx.sidebarRightTabs.register({ id, kind, patterns, priority, title, keepMounted, canOpen })` | 同 id/同 kind 二次注册抛错；`extension` 默认会 shadow `builtin` | A |
| 右侧栏正文 | `ctx.slots.register({ name:'sidebar.right.pane.tab', key: definition.id }, Body)` | keyed slot，key = definition.id | A |
| 打开 tab | `ctx.sidebarRight.openTab(kind, { params })` / `openResource(address, opts)` | 页面地址 `sidebar://<kind>` 由 Sidebar 写，调用方从不拼 | A |
| 全局面板 | `main` keyed slot 注册 key + `ctx.layout.selectPanel(id \| null)` | `conversation` 是保留 key；选未注册 key 会 throw | A |
| 侧栏图标 | `sidebar.panellist` list 注册，id 与 main panel key **相同** | 侧栏拥有按钮与 label | A |
| 设置分区 | `settings.section` list 注册 | 图标用 `settings.section.icon`，**id 必须相同**否则不渲染 | A |
| 会话头部按钮 | `conversation.session.header.actions` list 注册 | 标准 props 含 `useSession` | A |
| 读投影 | `useProjection('ops.audit')`（标准 hook，无需声明） | 返回 `undefined` 时必须 `return null` | A |
| 注册卡片 Body | `ctx.actionCards.register({ action, locale, Body })` | 同 action 二次注册报错；Body 自己负责标题栏与底部操作 | A |
| CSS 注入 | `document.createElement('style')` + `data-plugin-css` 去重 | 必须在插件 effect 内注入并在 dispose 时移除 | A |
| 跨 frame 浮层 | `shell.overlay` list（root，穿透点击） | 入口需自行 opt-in 指针事件 | A |

**包与构建**

| 用途 | 做法 | 证据级 |
|---|---|---|
| 声明组合包 | `package.json` 的 `dsh.bundle.patch` → patch 文件路径 | A |
| 声明客户端半 | `dsh.client = { platform:'web', inject:[...], external?:[...], immediately?:bool }` | A |
| 版本约束 | `engines.dsh: ">=0.2.2-rc.3 <0.3.0"` | A |
| 展示元信息 | `locale/en.json` `{meta:{title,description,detail?}}`；`package.json` 顶层 `icon` | A |
| 安装 | `dsh plugin --profile demo add ./x.tgz` | A |
| 验证 | `dsh --profile demo --dump-config` | A |

### 附录 B｜证据与可信度

本方案的技术断言分三级；实现前应优先复核 **A 级**，B/C 级仅作参考。

| 级 | 含义 | 本方案中的分布 |
|---|---|---|
| **A** | 直接读本机 DSH 安装包的源码 / 权威文档 / 真实产物得出，可逐行复核 | §4 全部架构断言、§10 附录 A 全部 API、所有包名与字段名 |
| **B** | 多个独立来源交叉一致，但无源码直读 | Grok Bot 的产品行为（01 文档）、DSH 外壳布局数值（02 §2.3） |
| **C** | 单一来源或推断 | Grok Bot 的额度机制细节、用户反馈量级 |

**A 级证据的可复核路径**（三类）：

1. **权威文档**：`<DSH 安装>/resources/app.asar` 内的 `node_modules/@deepseek-ai/dsh/docs/`，共 94 篇 `subsystems/*.zh.md` + 5 份 `cookbook/*.zh.md`。本方案直接引用的有：`approval.zh.md`、`session-projection.zh.md`、`slots.zh.md`、`sidebar-right.zh.md`、`client-modules.zh.md`、`settings.zh.md`、`web-client.zh.md`、`sandbox.zh.md`、`cookbook/adding-a-package.zh.md`、`cookbook/adding-a-tool.zh.md`、`cookbook/adding-a-settings-card.zh.md`、`cookbook/extension-cookbook.zh.md`。
2. **真实源码**：每个功能包同时含 `src/`（TS 源）与 `lib/`（预构建 JS），读 `src/*.ts` 拿权威签名。本方案引用的：`dsh-client-ui-layout/src/client/index.ts`（`main` slot 声明与 ILayout）、`dsh-client-ui-sidebar/src/client/contract/slots.ts`（`sidebar.panellist`）、`dsh-client-ui-sidebar-right/src/client/tab-registry.ts`（tab 类型定义与冲突规则）、`dsh-client-ui-settings/src/client/contract/slots.ts`（settings 全部 seat）、`dsh-tools/src/events.ts` + `contracts.ts`（四段钩子与 `PreToolDecision` / `ToolGuard`）、`dsh-user-approval/src/types.ts`（`ApprovalOutcome` 四值闭合）、`dsh-session-projection/src/types.ts`（`ProjectionDefinition` / `ProjectionHandle`）、`dsh-action-cards/src/index.ts`（`ActionCardKind`）、`dsh-plan-mode/src/index.ts`（投影定义的可照抄范例）。
3. **真实产物**：`lib/client.js` 是 lazy-CJS factory 格式，可照抄形态。本方案参考了 `dsh-client-ui-jobs/lib/client.js`（37,838B，含 `exports.apply` / `exports.inject` / slot 注册 / locale 注册完整范式）与 `dsh-client-ui-plan/lib/client.js`（`useProjection` 的消费形态 + CSS 注入范式）。

**v1.1 新增引用的证据**（全部 A 级，均为本机包内 `src/` 或 `README.zh.md`）：

| 引用对象 | 支撑了 §9 的哪条结论 |
|---|---|
| `dsh-subagent/src/child-agent.ts`（`captureDelegatedPolicyOverrides` / `appendDelegatedPolicyOverrides`） | C-1：子代理 approval 恒为 `never`，是「升级审批必须自建」的根因 |
| `dsh-session/src/types.ts`（`PluginRecordType` / `PluginRecordMap` / `ignorable`） + `dsh-session/src/index.ts`（`appendPluginRecord` / `pluginRecordOf`） + `dsh-session-persistence/src/storage-contract.ts:75` | C-3：群聊事件族的唯一合法持久化路径 |
| `dsh-subagent/src/catalog.ts`（`SUBAGENT_CATALOG_VERSION = 3`、`name` schema 校验） | §9.4.1：群成员模型直接复用 catalog，不另建 |
| `dsh-agent-team/src/types.ts`（`team/message/*` 标为 Historical）、`journal.ts`、`projection.ts` | §9.4.2：**群聊不能靠 `team/message/*` 重建** |
| `dsh-persona/README.zh.md`（`prefix` / `suffix` order 10200 / `complete` / 「不支持全局挂载」） | §9.5 与 C-6：每 Bot 独立角色的唯一正规入口 |
| `dsh-agent-preset-registry/README.zh.md`（不扫目录、不写回、只能 bundle 补丁） | §9.9：8 类角色的分发形态是「8 条 preset 声明」 |
| `dsh-tool-subagent/src/preset-selection.ts`（`assertProvider` 拒绝 `inheritsParentContext`） | C-6：`subagent_fork` 不能选 preset，成员只能用 spawn |
| `dsh-action-cards/README.zh.md`（拒绝 subagent 调用、每轮一张） | C-5：子 Bot 发卡片不可行 |
| `dsh-goal-round-driver/README.zh.md`（idle + goal active 续行） + `Agent.inject()` 源码注释「without waking the driver」 | C-2 与 §9.8：主动推进的三路信号与唯一可唤醒入口 |
| `dsh-tool-subagent-control/README.zh.md`（`send_message` 对 idle 目标「开始或恢复轮次」；`wait_agent` 明确任务变化不结束等待） | §9.6.4 主 Bot 的三个触发源 |
| `dsh-tool-session-query/README.zh.md`（跨会话要求 `cwd` 严格相等，`SESSION_QUERY_TOOL_UNAUTHORIZED`） | §9.5 记忆维度：「一个团队 = 一个 workspace」 |
| `dsh-agent/src/index.ts`（`AgentRegistry.create` / `CreateAgentOptions.meta.agentPreset`） + `runtime-types.ts:318`（`agent/inbox/inserted` payload） | §9.4.2 与 §9.6.3 |
| `dsh-session-query` 的 `readSession` | §9.7：示范学习的唯一数据源（回放而非录制） |
| `dsh-cua/README.zh.md`（「会话决定没有自动保留期限」） | §9.7.2 能力上限表：CUA 型流程明确未覆盖 |
| `dsh-experimental-auto-review/src/index.ts`（`tools/pre-execute` 的 `{kind, reason, displayReason, info:{name,code}}` 形态） | §9.6.1 拦截返回值的照抄范式 |

**关于「官方构建预设不可用」这条重要发现**：`packages/client/tsdown.client.ts` 未随 npm 包发布，因此仓库外的第三方包必须自己复刻客户端构建，或手写 `client.js`。这是**所有第三方 DSH 客户端插件共同的第一个坑**，本方案 §4.6 给了三档退路。

### 附录 C｜可直接用于 README 的三句话

> **Agent Ops ｜ 给 DeepSeek Harness 装一条审计脊柱**
>
> Agent 在你电脑上删了什么、改了哪些文件、谁批的、为什么被拦——一个右侧栏面板全说清。
>
> 不上云、不 fork 内核、卸载零残留。装一个组合包，DSH 就多了「看得见、拦得住、说得清」三件事。

### 附录 D｜与其他三个候选亮点的取舍记录

开发过程中最容易动心的三个「更炫」的方向，以及为什么没选：

1. **做一个 Bot 市场的可视化**（对标 Grok Bot 的 Public template sharing）。看起来炫，但 DSH 的插件模型已经在 `/plugins` 页解决了分发，再做一个市场是重复；且模板分享依赖服务端，本地方案做不彻底。
2. **做一个 CUA 直播面板**（对标云电脑画面）。视觉冲击最强，但 `dsh-cua-bundle` 尚 experimental 且仅 macOS，现在做等于把产品绑在一个随时会变的 API 上。**留到它有正式 Windows 支持之后再评估。**
3. **做一个多 Agent 群聊**（对标 2–6 Bot 群聊）。v1.0 的判断是「不做」：DSH 的 subagent 是层级委托，硬做**平级**群聊会绕开 `dsh-agent-team` 的任务板语义，且 Grok Bot 的群聊被用户投诉「吃掉额度」。
   → **v1.1 修正为「做，但按 DSH 的语义做」**：群成员仍是根下的子代理（层级不变），群聊是**协作视图**而非对等网络；成本不做隐藏而是做成常驻的三行 token 面板（§9.4.3）。Grok Bot 的教训不是「群聊不该做」，而是「群聊不告诉你花了多少」——这一点恰恰是本方案的审计脊柱能正面解决的问题。详见 §9。

**结论（v1.0）**：三个候选都是「对标得很完整但落不了地」的典型。本方案选择**做窄而深**——只做审计这一件事，但做到「数据地基 + 三个视图 + 可导出 + 可编程消费」的完整度。

**结论（v1.1 修正）**：「做窄而深」没有被推翻，但**「窄」的定义要更新**——第 3 条（群聊）在需求变更后成为范围之内，它不再是与审计并列的第二个系统，而是**审计脊柱上的第四、第五个视图**。一个简单的判据：如果一项新能力能表达成「同一条会话日志上的新投影 + 新的纵切页」，它就属于这条窄路；如果它需要新的存储、新的身份体系或新的审批引擎，就出界。群聊/名册/升级工单三者都通过这个判据（分别用 `plugin:` 记录、`subagent/catalog`、原生 `approval/request`），所以它们属于**同一条路的延长线**。第 1、2 条（Bot 市场、CUA 直播面板）仍然出界，理由不变：前者需要服务端，后者依赖 experimental API。

### 附录 E｜修订记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-11-17 | 首版：§0–§8、§10 附录 A–E 全部完成；16 条需求；4 个里程碑；9 条风险 |
| **v1.1** | 2026-11-17 | **响应 2026-11-17 追加需求**：新增 **§9 多 Bot 团队与主动能力**（17.4 KB，13 小节），覆盖面 = 多 Bot 群聊协作 / 每 Bot 独立角色·记忆·上下文·权限 / 主 Bot 统筹 + 敏感节点升级审批 / 零代码流程学习 / 主动任务感知 / 8 类开箱角色；新增 **8 条需求 R-G1..R-G8（28 人日，P1 四条 16 人日）** 与 **2 个里程碑 M4/M5**；架构从「4 Host 单元 / 6 Client 注册点 / 16 条」扩到「**7 / 8 / 24 条**」；收录 **6 条硬约束 C-1..C-6** 与 **4 条新风险（10–13）**；**修正 §8.2 与附录 D 中「不做群聊」的判断**（改为「做层级之上的协作视图，不做平级网络」）；新增配置项 `escalation.adjudicate`（默认 `false`）。总计由 32.5 人日变为**净 57.5 人日** |


---

## 14 实现记录（v1.1 落地后的实测结论）

本节记录**实现与本方案文本之间的偏离**，以及偏离的原因。每一条都是实测出来的，不是设计偏好。

### 14.1 需求覆盖表（24 条）

| 编号 | 落地位置 | 状态 | 验收口径与实现的对应 |
|---|---|---|---|
| F1 打包骨架 | `plugin/package.json` + `cordis.patch.yml` + `lib/index.js` | ✅ | `pnpm pack` → `dsh plugin add` → `--dump-config` 出现 layer 行；`engines.dsh` 声明为 `>=0.2.2-rc.3 <0.3.0` |
| F2 审计投影 | `lib/audit-projection.js`（`ops.audit`） | ✅ | asked/decided/tool-result 三路折叠，计数器精确匹配；不关心的事件返回同一引用 |
| A1 审批旁听 | `lib/index.js` 的 `approval/request` 监听 | ✅ | 只观察 + `next()` 透传；**从不**返回结论 |
| A4 围栏硬拦 | `lib/rules/guard.js` 的 `ctx.tools.guard` | ✅ | guard 只有拒绝分支，类型上不可能被翻回许可 |
| A5 分类表 | `lib/rules/classify.js` | ✅ | 26 条规则，可导出成 JSON；客户端内嵌副本由 `scripts/embed-rules.mjs` 从同一真源生成 |
| B1 右侧栏 tab | `client.js`（`sidebarRightTabs` + `sidebar.right.pane.tab`） | ✅ | 一个 tab 类型、七个纵切页（收件箱 / 时间线 / 规则表 / 建议 / 执行环境 / 团队 / 群聊） |
| A2 审批收件箱 | `client.js` 的 `InboxPage` | ✅ | 四种 outcome 各自样式；决策人一栏留白并加脚注（日志里没有这个信息） |
| A3 规则表 | `lib/rules/user-rules.js` + `lib/rules-table.js` + `ops.config` 投影 | ✅ | 20 条上限、Ask 优先、命中计数（`ops.audit` 的 `hits`）、高危不可 Allow（保存时拒绝） |
| B1b 头部徽标 | `client.js` 的 `OpsBadge` | ✅ | 数字 = 待处理审批数；点击打开 ops tab |
| E2 通知条 | `client.js` 的 `OpsToaster`（`shell.overlay`） | ✅ | 只在新审批出现时弹一次；整层 click-through，卡片自己 opt-in |
| C2 审计时间线 | `client.js` 的 `TimelinePage` | ✅ | 三段式（授权 / 动作 / 结果）；Auto review 理由进「结果」段 |
| A2b 审计导出 | `client.js` 的 `toMarkdown` | ⚠️ 偏离 | **实现为浏览器下载**（Markdown 文件），不是宿主 deliverables 链路。理由：写工作区要碰沙箱策略，而导出物是用户自己点出来的，下载通道最直接。见 §14.2(1) |
| E1 表单卡片 | `lib/form-card.js` + `skills/ops-form` | ✅ | 新 action card 种类 + 技能；`act()` 的决策经 `ctx.actionCards.record` 喂回模型；同名种类二次注册被拒 |
| D1 规则导入导出 | `lib/rules/user-rules.js`（YAML） | ✅ | 导出成 YAML；导入后规则 id 稳定；非法 YAML 不写盘 |
| B3 连接器可见性 | `lib/connectors.js` | ✅ | 只读（名字 + 状态），不提供连接按钮 |
| G1 群聊消息族与投影 | `lib/chat-router.js` + `ops.chat` 投影 | ✅ | 三路信号（`subagent/start`、`subagent/end`、收件箱插入）都转写进根会话的群聊流；记录带 `ignorable` |
| G2 角色装配 | `cordis.patch.yml` 的 8 条 preset 声明 | ✅ | 每条 = persona + 工具白名单；两个 preset 的系统提示词前缀逐字节不同 |
| G3 八类角色包 | `cordis.patch.yml` + `plugin/skills/<role>/SKILL.md` | ⚠️ 部分 | 8 条 preset 声明 + 8 份岗位手册齐备；**岗位手册是全局注册的运行时技能**，宿主没有「按 preset 限定技能」的机制 |
| G4 团队名册 | `ops.bots` 投影 + `client.js` 的 `TeamPage` | ✅ | 名册带 preset 字段与主 Bot 星标；工单带工具名 / 参数摘要 / 风险类目 |
| G5 升级审批通道 | `lib/escalation.js` + `lib/team-units.js` | ✅ | 子代理当场拒绝（`AGENT_OPS_ESCALATED`）、写工单、唤醒主 Bot；`adjudicate` 默认关闭，critical 永不裁决；回归测试断言「子代理无审批权」 |
| G6 示范 → Skill 草稿 | `lib/teach.js` + `/ops-teach` | ✅ | 回放会话 → SKILL.md + workflow 草稿；**未确认前不写盘**（`/ops-teach <name>` 生成，`/ops-teach <name> save` 才落盘） |
| G7 主动感知 | `lib/triggers.js`（`ops.triggers` 投影） | ✅ | goal / todo / workspace / team-task / deliverable 五路折成候选；同 id 去重，24 小时窗口内不重复提示 |
| G8 打扰分级与预算 | `lib/triggers.js` + `lib/wake-unit.js` | ✅ | L0 / L1 / L2 三级；每日 L2 上限（默认 3）；连续两次忽略后该类降级 30 天 |

### 14.2 六条与方案文本的偏离

1. **审计导出走浏览器下载，不走 deliverables 链路**（§3.3「导出走 `dsh-tool-present` / `dsh-deliverable-file-references` 的现成交付链路」）。
   实现为客户端把视图渲染成 Markdown 并触发下载。理由：交付链路要求在**工作区**落一个文件，那要碰沙箱策略；而导出物是「用户自己点出来的」，用下载通道天然跟随用户的下载目录，也不在仓库里留垃圾文件。导出的正文（时间 / 工具 / 风险 / 授权方式 / 结果）一项没少。

2. **用户规则表存在会话日志的插件记录里，不是设置文档**（§3.5 第 3 条「规则存进 DSH 自己的设置文档」）。
   理由三条：(a) 设置文档那套要插件声明带 volatile 字段的 Config，于是得引 schemastery——插件的其余部分刻意不引 zod/schemastery（避免与宿主 4.6.6 / profile 3.25.76 打架），为一个规则表扩大依赖面不划算；(b) 插件记录这条通道已经验证过（`ignorable`、分叉恢复原样带走）；(c) **规则改动会留在审计轨迹里**，「谁在什么时候加了这条放行规则」是可查的，这比一个不透明的设置块更符合本插件的立身之本。
   代价：规则是**会话级**而非全机器级。补偿是 D1 的 YAML 导出 / 导入：规则表可以提交进仓库，换机器导入即可——这正是 §3.5 第 3 条想要的「可版本化的资产」，而且比设置文档更便携。

3. **Allow 规则的「高危不可保存」按 critical 档判定**（§3.5 第 4 条原文是「高危七类永不进 Allow」）。
   七类动作**全部**在内置表里，若整体拉黑，allow 规则将永远无法命中任何 ask 档动作——它会变成一个只能写、不能用的字段。真正需要挡住的是**不可逆**的那一档（格式化磁盘、删库、提权、发布、转账）：它们由 guard 单调拒绝，allow 规则对它们无效，所以在保存阶段就告诉用户「这条规则不会生效」。
   运行时的不变式仍然是硬的：**deny 永远赢过 allow**，用户规则对 deny 档没有任何作用力。

4. **岗位手册是全局注册的运行时技能，不是按 preset 隔离的**（§9.9「8 个 skill 目录」）。
   宿主的 preset 只能改工具面与人设，没有「按 preset 限定技能」的机制。八份手册以 `provider: 'agent-ops'` 注册进技能表，由各角色的 persona 指名加载自己那一份。

5. **规则表 / 策略 / 连接器走单独的 `ops.config` 投影，不挂在审计视图上**。
   这是实测出来的一个坑：审计投影声明了 `summary: false`（审计条目不该进会话摘要），而**投影值只会在「会话被客户端订阅」或「会话已经发生过事件」时到达客户端**。一个刚创建、还没跑过一轮的新会话里，客户端拿不到任何投影值——规则表页会显示「共 0 条」，这是错的。
   修法是职责分开：`ops.audit` 只放会话数据（继续 `summary: false`），`ops.config` 放「与会话无关但客户端需要知道」的常量（默认成员资格）。另外客户端还内嵌了一份规则表（打包时从 `lib/rules/classify.js` 生成），保证在会话还不活跃时规则页也有内容。

6. **G8 的每日 L2 唤醒预算是 Host 侧按日计数器**，不是投影里的持久状态。
   理由：唤醒是**副作用**（真的去 `followup` 主 Bot），必须发生在 Host 侧；投影是纯折叠，不能有副作用。「这条建议值不值得唤醒」的判定仍然由投影给出（`level === 'L2'`），预算只决定「今天还叫不叫」。

### 14.3 实测得到的三条宿主事实

1. **投影的客户端下发有两条路**：会话状态变化时的实时下发（与 `summary` 无关），以及会话打开时的基线 / 会话列表里的缓存值（**受 `summary` 成员资格过滤**）。两条路都要求会话「活着」。
2. **`ctx.commands.register` 的 `input.hint` 不能为空字符串**（宿主会拒绝整个命令条目 → 插件条目不激活）。
3. **客户端的 `require` 只能取模块表里的模块**（平台种子 + 已注册的 client bundle），取不到插件自己的文件；所以「客户端复用 Host 的规则表」这条捷径走不通，只能在打包时生成一份。

### 14.4 验证状态

| 层 | 状态 | 证据 |
|---|---|---|
| L1 单元 | ✅ | `cd plugin && node --test` —— **157 项全绿**（投影折叠、引用相等性、命中计数、规则表、升级工单、候选清单、预算、示范草稿、角色包、群聊转写、表单卡片） |
| L2 契约 | ✅ | 每个投影都有 `stateSchema` / `viewSchema` 自检测试（state 与 view 都能通过自己的 schema，view 复用引用） |
| L3 行为 | ✅ | 围栏只加严不放宽：`evaluate()` 的单测断言 deny 赢过 allow、allow 赢不过 ask、critical 不可豁免；升级通道的回归测试断言子代理永远拿不到审批权 |
| L4 集成 | ✅ | 真实会话里跑通：审批旁听、围栏硬拦（`AGENT_OPS_FENCED`）、升级工单（`AGENT_OPS_ESCALATED`）、群聊记录、规则表记录 |
| L5 安装 | ✅ | `pnpm pack` → `dsh plugin --profile web add` → `--dump-config` 出现 plugin 行与 8 条 preset 行 → Web UI 起来、七个纵切页全部渲染、控制台零报错（`_verify/shot16.js` + `dist/shots/72-070-*.png`） |
