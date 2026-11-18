# DeepSeek Harness（DSH）本机现有形态盘点

> 目的：为「对标 Grok Bot 开发 DSH 插件」提供现状底图。
> 取证时间：2026-11-17（本机）｜取证方式：文件系统实测 + asar 解包源码阅读 + 进程/端口实测 + 官方文档阅读。
> 铁律：每条结论后标注证据路径；无法取证的写「未验证」。

---

## 0. 一页结论（TL;DR）

1. **DSH 不是「一个应用」，而是「Cordis 插件运行时 + 一层 YAML profile 补丁」**。Electron 只是壳，真正的 agent 宿主是 node 侧的 `@deepseek-ai/dsh-desktop-host`；宿主参数依次是 [dsh 根目录, profile 目录, runtime, pnpm, runtime bin]。
   - 证据：`Get-CimInstance Win32_Process` 中 PID 18940 的完整命令行。
2. **扩展的唯一正规入口是「安装一个 bundle 包」**：包内 `package.json` 声明 `dsh.bundle.patch`（Host 半）与 `dsh.client`（浏览器半），由 `plugin_manager` 的 `install_bundle` 动作装入 profile。**禁止手改 profile 的 package.json / cordis.patch.yml**。
   - 证据：`C:\Temp\dsh-asar-extract\dsh\node_modules\@deepseek-ai\dsh-agent-preset\skills\dsh-doc\references\plugin-development.md`
3. **Web GUI 的 UI 是可组合的「槽位（slot）系统」**，共 115+ 个已发布槽位。做「Grok Bot 式整页 Bot 面板」的最小可行路径 = 一个 `sidebar.panellist` 左侧入口 + 一个 `main` 槽的 keyed 全页面，两次 `ctx.slots.inject` 即可。
   - 证据：`@suifei/dsh-ai-team\client.js:4994-5011`（真实第三方插件写法）、`dsh-client-ui-layout\src\client\index.ts:197`
4. **右侧栏是 Grok Bot per-agent info pane 的最直接对标物**：DSH 有完整的 `ctx.sidebarRight` docking 服务 + `sidebarRightTabs` 类型注册协议，支持保留、分屏、浮动、keepMounted。
   - 证据：`dsh\docs\subsystems\sidebar-right.zh.md`
5. **DSH 已有「Agent 自己写插件」的产品化闭环**：`propose_action(action:'create_personalized_page')` → 卡片 → 用户点「创建」→ 后台子 Agent 在工作区 `.dsh-created-plugins/<id>` 生成插件 → 校验 → `pluginManager.installBundle`。
   - 证据：`dsh-creation-recommendations\README.zh.md`、`dsh-creation-recommendations\src\index.ts:31`
6. **能力边界**：DSH 强在「能力密度」（工具/子代理/团队/定时/记忆/沙箱全都有），弱在「对外服务化」与「UI 自由度」——没有 URL 路由、不能替换 app root、不能 iframe 挂页面、UI 只能在已分配空间的槽位里长。
   - 证据：`dsh-client-ui-layout\src` 全仓 grep `pushState/location.pathname/useRoute` = 0 命中；`references\main-page.md`「A separate HTML file, iframe, or replacement app root is not a mounted page」。

---

## 1. 安装形态与运行形态

### 1.1 安装目录

```
D:\ProfessionalSoftware\agent\dsh\dsh\
├─ DeepSeek Harness.exe              # Electron 壳
└─ resources\
   ├─ app.asar                       # 209,021,953 B（2026-11-13 15:30）
   ├─ app.asar.unpacked\             # 仅原生二进制，无插件/无 schema/无文档
   └─ runtime\                       # 随包运行时
```

- **app.asar 根 package.json**：`name=@deepseek-ai/dsh-desktop`、`version=0.2.2-rc.3`、`main=lib/main.js`、`type=module`、`dshDesktopAppId=com.deepseek.dsh`、`dshBuildCommit=6b729fedde0c8fd03af7afdf5a711aa64fe87c3b`、`dshDesktopUpdateChannel=nightly`。
- **app.asar.unpacked 里没有插件相关文件**（实测仅有 node-pty、koffi、@vscode/ripgrep-win32-x64、@img/sharp-win32-x64、sherpa-onnx-win-x64、@deepseek-ai/libreoffice-kit-win32-x64、node-addon-require-builtin-win32-x64-msvc 等原生包）。
  - 结论：**找插件契约不能看 unpacked 目录，必须读 asar 内源码**。
- **asar 内 @deepseek-ai 约 380 个包**（lead 提供），覆盖 dsh-cua、dsh-computer-use、dsh-action-cards、dsh-experimental-auto-review、dsh-schedule、dsh-goal、dsh-agent-team、dsh-mcp-manager、dsh-skill*、dsh-client-ui-*（约 70 个 UI 包）等。
- 本机存在**前次调研遗留的完整解包副本** `C:\Temp\dsh-asar-extract\dsh\`（含完整 `@deepseek-ai` 包源码与 `docs/`），本次盘点的源码级证据即取自此处。**它不在安装目录内，是解包产物**，可作为后续开发的只读参考。

### 1.2 运行形态（进程 / 端口）

| 进程 | 命令行要点 | 作用 |
| --- | --- | --- |
| PID 18940 | `"…\DeepSeek Harness.exe" --expose-internals …\@deepseek-ai\dsh-desktop-host\lib\index.js <app.asar\dsh> <C:\Users\Lenovo\.dsh\profiles\desktop> <…\primary-runtime> <…\pnpm.mjs> <…\runtime\bin>` | **真正的 agent 宿主**（Electron 只是壳） |
| PID 29260 等 | `--experimental-vm-modules …\dsh-ptc-runtime-node\lib\process.js 134217728` | PTC（`run_code`）执行进程，堆 128 MiB |
| PID 26456 等 | `dsh-subprocess-local\lib\runner.js` 包 `powershell.exe` | 每次 `pwsh` 工具调用的执行进程 |
| PID 25212 | hindsight daemon | 记忆插件守护进程 |

监听端口（`Get-NetTCPConnection -State Listen`）：

- `127.0.0.1:61593` ← PID 18940，**本会话的 Web GUI**
- `127.0.0.1:18787` ← billion-context（`node …\billion-context\dist\index.js start --host 127.0.0.1 --port 18787`）
- `127.0.0.1:9077` ← hindsight daemon

**Web GUI 有准入鉴权**：直接 `web_fetch http://127.0.0.1:61593/` 返回 **401** + 正文 `dsh web authentication required; reopen the URL printed by dsh web.`
- 证据：`dsh-client-connection\src\browser-auth.ts:386-392`
- 影响：**无法通过 HTTP 抓 DOM 取证**，界面结论只能来自客户端源码。

### 1.3 运行时

`C:\Users\Lenovo\.dsh\dsh-runtimes\dsh-primary-runtime\runtime.json`：`desktopVersion 0.2.2-rc.3`、`python 3.12.14`、`node 24.21.0`、`pnpm 11.28.5`；随包 Python 库：numpy 2.3.5 / pandas 3.0.1 / python-docx 1.2.0 / python-pptx 1.0.2 / openpyxl 3.1.5 / Pillow 12.3.0 / lxml 6.1.3 / XlsxWriter 3.2.9。

---

## 2. 用户配置目录结构树

**配置根 = `C:\Users\Lenovo\.dsh`**（实测 `%USERPROFILE%\.config` 与 `AppData\Roaming\DeepSeek Harness` 均不存在）。

```
C:\Users\Lenovo\.dsh\
├─ .credentials.yaml               770 B   # 凭据库：{version:1, refs:{DEEPSEEK_API_KEY,…}, records:{}}
├─ .anonymous-user-id              37 B
├─ .ai-manager-profile-sync.json   28 B
├─ .workbuddy-{device,host-heartbeat,roster-seen.cn}.json
├─ settings.yaml.imported        3398 B   # 用户设置导入快照（UI/模型/权限）
├─ ai-team\desktop\projects.json          # AI Team 项目表（@suifei/dsh-ai-team 落盘）
├─ attachments\v1\{objects,tmp}\         # 附件对象库（f1/ 分片）
├─ dsh-runtimes\dsh-primary-runtime\      # runtime.json + python/node/pnpm
├─ profiles\
│  ├─ desktop\                            # ★ 本机在用的 profile（Web GUI）
│  │  ├─ cordis.yml                223 B  # 内容仅注释 + "[]"
│  │  ├─ cordis.patch.yml        21907 B  # ★ 用户补丁层（13 个顶层 id）
│  │  ├─ package.json             1380 B  # ★ dependencies + dsh.profile.bundles（18 条）
│  │  ├─ pnpm-lock.yaml          60103 B
│  │  ├─ pnpm-workspace.yaml
│  │  ├─ .dsh-market\                     # 市场状态：state.json / discovery-compatibility-v1.json / log.ndjson
│  │  ├─ .plugin-manager\logs\            # 35+ 次插件操作日志 operation-<6字符>\pnpm.log
│  │  └─ node_modules\                    # 已装 bundle 包实体
│  ├─ headless\  web\  node_modules\      # 其他 profile + 公共依赖
├─ sessions\                              # ★ 会话落盘（jsonl），按 workspace 编码建目录
│  ├─ --D-ProfessionalSoftware-Project-dsh-bots--\
│  ├─ --D-ProfessionalSoftware-agent-dsh-creative--\   （共 12 个 workspace 目录、147 个文件）
├─ storages\                              # 域存储
│  ├─ workspace.json 4091 B
│  ├─ dsh-context\overview-cache.v1.json 213569 B
│  └─ session_projcache\                   # 每会话投影缓存（最大单个 442915 B）
└─ workbuddy-vault\                        # WorkBuddy 凭据仓
```

**注意**：`C:\Users\Lenovo\.dsh` 下**没有 `skills\` 目录**——技能来自 bundled 目录与各插件包自带的 `skills/\`（见 §7.5）。

---

## 3. profile 机制（DSH 的「装配层」）

### 3.1 三层叠加

```
cordis.yml（空壳，仅注释 + "[]"）
   ↓ 叠加
package.json 声明的 dsh.profile.bundles[]（18 条，顺序即叠加序）
   ↓ 叠加
cordis.patch.yml（用户补丁层，13 个顶层 id）
   ↓ 叠加
--patch 覆盖（命令行）
```

- `cordis.yml` 全文注释原文：**「dsh profile root — an empty entry list. The tree is composed as patches: each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any --patch overlays. Edit cordis.patch.yml, not this file.」**
- 证据：`C:\Users\Lenovo\.dsh\profiles\desktop\cordis.yml`

### 3.2 profile 的 package.json（18 个 bundle）

`dependencies`（6 个 + 2 官方按需）：`@deepseek-ai/dsh-subagent-claude-code`、`dsh-subagent-codex`、`@local/dsh-rigorous-preset`（`link:D:/ProfessionalSoftware/agent/dsh/creative/dsh-rigorous-preset`）、`@suifei/dsh-ai-team 0.4.121`、`@vectorize-io/hindsight-coding-agents 0.8.7`、`billion-context 0.1.216`、`dsh-connect-workbuddy 5.24.13`、`dsh-context 0.85.1`。

`dsh.profile.bundles`（顺序即叠加序）：
`dsh-base` → `dsh-web-app` → `dsh-experimental-auto-review` → `dsh-experimental-plugin-market-bundle` → `dsh-experimental-forge-bundle` → `dsh-personalized-recommendations` → `dsh-experimental-session-titles-bundle` → `dsh-deepseek-chat-import` → `@vectorize-io/hindsight-coding-agents` → `dsh-subagent-codex` → `dsh-subagent-claude-code` → `dsh-experimental-cot-translation-bundle` → `@local/dsh-rigorous-preset` → `dsh-experimental-voice-input-bundle` → `dsh-context` → `@suifei/dsh-ai-team` → `billion-context` → `dsh-connect-workbuddy`

### 3.3 ★ patch 语义（做插件必须知道）

**patch = 整行替换，不做深合并；`inject` 列表是替换而非拼接。**

- 证据 1：`dsh-web-app\README.zh.md:115`「patch 会替换目标行的整个 `config`，因此每个 Web 行都重述自己拥有的每个键」。
- 证据 2：`billion-context\dsh.bundle.patch.yml` 注释「entry inject lists are REPLACED by patches, not concatenated」、「patch 整体替换 config 不做深合并」。
- 证据 3：`dsh-base\cordis.patch.yml` 注释「A patch replaces the targeted row's whole `config` rather than merging into it」。

**行顺序无加载语义**：`dsh-base\cordis.patch.yml` 注释原文「Row order carries no load semantics (activation is service-availability driven)」。

### 3.4 用户 profile 补丁层实测（13 个顶层 id）

`ui-settings-general`（welcomeNoticeVersion 2026-08-13.1）、`llm-pi-ai`（providers.minimax-cn 三模型，apiKeyEnv MINIMAX_CN_API_KEY）、`agent-default-model`（provider workbuddy / model deepseek-v4.1-flash / reasoningEffort max）、`ui-chat`（transcriptView standard、performanceUsage detailed）、`permission`（三档 + defaultPreset danger-full-access）、`ui-theme`（fontSize 17）、`ui-settings`、`ui-settings-account`（usage detailed、developerTools true）、`agent-preset-registry`（default standard、selectedDefault ptc）、`subagent-model-selection-settings`（allowedModels 3 条）、`plugin-market`（indexes https://cdn.dsh.so/market/index.json）、`cot-translation`（provider bing → zh）、`dsh-connect-workbuddy`（regions.cn.lastCatalog 数十个模型条目，含 creditMultiplier / promos / reasoning.supportedEfforts）。

> **重要事实**：这 13 条**全部是 id-targeted config 覆盖，没有一条用户自定义 `insert` 行**。即：本机所有扩展能力都是「以 bundle 形式安装」进来的，用户在 patch 层只调参、不装插件。
> 证据：`C:\Users\Lenovo\.dsh\profiles\desktop\cordis.patch.yml`（609 行，grep 顶层 id 行号 4/8/34/40/45/59/63/67/77/82/93/98/103）

---

## 4. 已装插件与包结构范本

### 4.1 已装 bundle 清单（profile node_modules 实测）

| 包 | 版本 | 类型 | 关键特征 |
| --- | --- | --- | --- |
| `@suifei/dsh-ai-team` | 0.4.121 | 双端（Host+Client） | `index.js` 171 KB + `client.js` 288 KB + 31 行 patch |
| `@vectorize-io/hindsight-coding-agents` | 0.8.7 | 双端 + MCP + Hooks | `plugin.json` 声明 mcpServers/hooks/skills |
| `billion-context` | 0.1.216 | Host + 前端 | patch 文件名为 `dsh.bundle.patch.yml` |
| `dsh-context` | 0.85.1 | 双端 | client.inject 6 个 UI 包、compatibility 声明 |
| `dsh-connect-workbuddy` | 5.24.13 | 双端（provider） | 复用 WorkBuddy 桌面端登录 |
| `@local/dsh-rigorous-preset` | 1.0.0 | **纯 YAML preset** | 无 JS 入口，仅 patch 12 KB + locale + icon |

### 4.2 范本 A：最小双端插件（`@suifei/dsh-ai-team`）

```
@suifei/dsh-ai-team\
├─ package.json      # exports + dsh.bundle.patch + dsh.client
├─ cordis.patch.yml  # 986 B
├─ index.js          # 171 KB  Host 半（含 ctx.tools.register）
├─ client.js         # 288 KB  浏览器半（window.__ModuleLoader__.load）
├─ icon.svg  locale\  skills\  lib\  README.md  CHANGELOG.md
```

`package.json` 关键段：

```jsonc
{
  "exports": { ".": "./index.js", "./client": "./client.js", "./icon": "./icon.svg" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "immediately": true, "inject": [] }
  },
  "dependencies": { "@deepseek-ai/schemastery": "~3.19.0" }
}
```

`cordis.patch.yml` 注释原文：**「dsh-ai-team bundle patch: mounts the Host half. The Client half is discovered from this package's `dsh.client` declaration.」**

### 4.3 范本 B：纯 YAML preset 包（`@local/dsh-rigorous-preset`）

只有 `cordis.patch.yml`(12 KB) + locale + docs + icon + `package.json`(513 B)，**无任何 JS**。patch 内是一条 `insert: {id: preset-rigorous, name: '@deepseek-ai/dsh-agent-preset', config: {id, name, description, order, plugins: [...]}}`，首项是 persona（`@deepseek-ai/dsh-persona` 的 prefix/suffix 长文）。

> 结论：**preset（人设/工具面组合）也是 bundle 的一种，纯 YAML 即可安装**。

### 4.4 范本 C：带 MCP 与 Hook 的插件（hindsight）

`plugin.json`（371 B）：

```json
{
  "name": "@vectorize-io/hindsight-coding-agents",
  "version": "0.8.7",
  "skills": "./skill",
  "hooks": "./hooks/hooks.json",
  "mcpServers": {
    "hindsight": {
      "command": "node",
      "args": ["${PLUGIN_ROOT}/dist/mcp-server.js"],
      "env": { "HINDSIGHT_MCP_HARNESS": "dcode" }
    }
  }
}
```

`cordis.patch.yml` 全文只有：`- insert: - id: hindsight / name: @vectorize-io/hindsight-coding-agents/dsh`。
`package.json` 还 `bin` 暴露约 40 个 per-harness hook 脚本（claude / cursor / copilot / grok / codex / dcode / antigravity / devin / qwen / zcode / traecode / workbuddy / codebuddy / droid / kimi 各 3 个）。

> 注意第三个：**hindsight 已经把 `grok` 作为目标 harness 之一做了适配**——说明「接入 Grok 生态」在本机已有先例。

### 4.5 插件市场与安装落盘

- `.dsh-market\state.json` 全文：`{"disabled":[],"groups":{},"groupOrder":[],"channel":"stable","region":"china"}`
- 安装日志：`C:\Users\Lenovo\.dsh\profiles\desktop\.plugin-manager\logs\operation-<6字符>\pnpm.log`（35+ 条历史）
- 操作审计：`C:\Users\Lenovo\AppData\Roaming\@deepseek-ai\dsh-desktop\plugin-operations\operations.jsonl`（26 KB）

---

## 5. 扩展点清单（含能力边界）

> 「机制」列给出可直接照做的 API；「证据路径」为源码或文档位置；「能力边界」写做不到的部分。

| # | 扩展点 | 机制 | 证据路径 | 能力边界 |
| --- | --- | --- | --- | --- |
| 1 | **模型可见工具** | `ctx.tools.register(defineTool({name,description,parameters,output,execute}))`；也可直接传裸 JSON-Schema ToolDefinition | `dsh\docs\cookbook\adding-a-tool.zh.md`；`dsh-mcp-client\src\tools.ts:177` | schema 自动进系统提示词；dispose 即注销；**工具名与展示/查找/执行必须一致**（用 `ctx.tools.restrict()` 过滤） |
| 2 | **工具拦截（Hook）** | `ctx.on('tools/pre-execute', async (exec,next)=>…)`；另 `tools/execute`（包裹生命周期，仅可替换 `exec.signal`）、`tools/post-execute`（结果转换）、`tools/result`（只读观察）、`ctx.tools.guard()`（同步单调拒绝） | `dsh\docs\cookbook\extension-cookbook.md`；`dsh-hooks-claude-code` / `dsh-hooks-codex`（把 CC/Codex 的 hook 配置桥接到这些点） | 「native hook = 普通 Cordis 插件挂在拦截点上，不需要外部协议」；不拥有决策必须 `return next()` |
| 3 | **Agent 生命周期事件** | `agent/created`、`agent/pre-step`、`agent/turn-stopping`、`turn/end`、`session/event`、`agent/assistant-stream` | `dsh\docs\cookbook\extension-cookbook.md` | 改写 `agent/pre-step` 决策要展开 `{...decision}` 保住 `startsRequestSeries` 等字段 |
| 4 | **斜杠命令（Host 侧）** | `ctx.commands.register({definitionId, name, description, input:{hint,attachments}, recordInput, handler(invocation)=>CommandResult})` | `dsh-command-feedback\src\index.ts:119`；`dsh-command-goal\src\index.ts:191`；`dsh-plan-mode\src\index.ts:233` | 结果为 UI 直接结果，**不产生模型消息**；`name` 小写无前导斜杠；handler 能拿 `agent` / `rawInput` / `attachments` / `signal` |
| 5 | **斜杠命令（Client 侧）** | `ctx.commandUi` 注册 `CommandContribution`（`popupSelect` 弹窗选择 / `action` 纯前端动作）与 `CommandDecoration`（装饰宿主命令的裸调用） | `dsh-client-ui-commands\src\client\contract.ts:64-132` | 与宿主命令**同名冲突会 fail loud 而非遮蔽**；decoration 不新建行 |
| 6 | **主面板页（整页）** | `ctx.slots.inject('main', ()=>ctx.slots.register({name:'main', key:'<我的key>'}, Component))` + `ctx.layout.selectPanel(key)` | `dsh-client-ui-layout\src\client\index.ts:197`、`service.ts:36`（`selectPanel(panelId|null)`） | **没有 URL 路由**；只能占「中央区」，不能替换 app root / 不能 iframe；官方内置全局面板仅 3 个（conversation / schedule / plugin-manager） |
| 7 | **左侧栏入口** | `ctx.slots.register({name:'sidebar.panellist', id:'<pkg>', order, label:()=>t('panel')}, PanelIcon)` | `dsh-client-ui-sidebar\src\client\contract\slots.ts:47`；第三方实录 `@suifei/dsh-ai-team\client.js:4994` | list 槽；**入口与目标页是两次独立注册**，只注册页不算用户能打开；不要替换侧栏、不要读兄弟 DOM |
| 8 | **右侧栏（per-agent 面板）** | `ctx.sidebarRightTabs.register({id, kind, patterns?, priority?, canOpen?, title, guide?, keepMounted?})` + `ctx.slots.inject('sidebar.right.pane.tab', ()=>ctx.slots.register({name:'sidebar.right.pane.tab', key:<id>}, Body))` | `dsh\docs\subsystems\sidebar-right.zh.md:36,55-74`；`dsh-client-ui-plan\src\client\index.ts:65` | 地址两种：`dsh-resource://<type>/…` 与 `sidebar://<kind>`；**布局是 browser-local，无跨设备同步**；`title()` 只在打开时捕获一次，之后不能改名 |
| 9 | **会话内 Tab（流式视图）** | `ctx.slots.inject('conversation.view', ()=>ctx.slots.register({name:'conversation.view', id, order, label}, View))` | `dsh-client-ui-chat\src\client\apply.ts:237`；`dsh-client-ui-trajectory\src\client\index.ts:81` | list 槽，与 Chat/Trajectory 并列；**只有当前选中的 tab 可见**，要边聊边看得用右侧栏 |
| 10 | **会话头动作区** | `conversation.session.header.actions`（list, session scope）、`.utilities`、`.corner`、`.lineage`、`.views.actions`（root） | `dsh-client-ui-conversation\src\client\apply.ts:446-450` | 只贡献动作按钮，不接管头部布局 |
| 11 | **输入区装饰** | `conversation.composer.dock`、`conversation.input.{left,right,overlay,dock}`、`conversation.input.bar`（含 attachments/permission/plan/model 子槽） | `dsh-client-ui-conversation\src\client\contract\slots.ts` | 官方推荐「简单装饰优先选这里」（有分配空间），浮层才用 `shell.overlay` |
| 12 | **聊天流节点渲染** | `ctx.slots.register({name:'conversation.chat.node', key:'<节点类型>'}, View)`；业务行注册 `ConversationNodeDefinition` | `dsh-client-ui-chat\src\client\chat\register-node-renderers.ts:41-56`；`dsh-client-ui-goal\src\client\index.ts:81` | keyed 槽，key 由 owner 派发（user/steering/context/turn-trigger/system-prompt/tool-call/command/turn-tail…）；**不能凭自定义 session 事件类型扩展**（无 `ignorable:true` 会导致会话无法重开） |
| 13 | **设置页新分区** | `ctx.slots.inject('settings.section', ()=>ctx.slots.register({name:'settings.section', id, order, label, inject, children:{…}}, Section))` | `dsh-client-ui-settings\src\client\contract\slots.ts:57`；内置 5 个：general(0)/models(10)/plugins(15)/agent-presets(20)/account(-10) | list 槽；可自带子槽位；插件自己的「设置卡片」走 plugins 页的 `plugins.detail.{actions,badge,section}` |
| 14 | **插件详情页注入** | `plugins.detail.actions`（页头控件）、`plugins.detail.badge`（标题旁标签）、`plugins.detail.section`（页面下方区块），按 `subject`（bundle/row/item）渲染 | `dsh\docs\cookbook\adding-a-settings-card.zh.md:44-54` | 对无话可说的 subject 返回 null |
| 15 | **主题** | `ctx.theme.register({id, colorScheme, tokens, icons?})` | `dsh-client-ui-theme\src\client\index.ts:148-151,354` | 内置仅 light/dark；覆盖 `--dsw-alias-*` token；`system` 是偏好不是可注册 id；重复 id 抛错 |
| 16 | **Skill** | 文件系统根：项目 `.dsh/skills`、`.agents/skills`、`Config.customSkillDirs`、`~/.dsh/skills`、`~/.agents/skills`、bundled；或插件包带 `skills/` | `dsh-skill-filesystem\lib\index.js:160-197`；`dsh\docs\subsystems\skills.zh.md:72-75` | rank：project-dsh < project-agents < custom(300) < user-dsh < user-agents < bundled(600)；**本机 `~/.dsh/skills` 不存在** |
| 17 | **Preset（人设/工具面组合）** | `@deepseek-ai/dsh-agent-preset` 声明：`{id, name, description, order, plugins:[…]}`，persona 用 `@deepseek-ai/dsh-persona` 的 prefix/suffix | `@local/dsh-rigorous-preset\cordis.patch.yml`；`dsh-web-app\presets\ptc.patch.yml`（138 行） | preset **只能靠安装 bundle 创建/覆盖**，不能直接手写 profile |
| 18 | **MCP 服务器** | 每 server 一行 `dsh-mcp-client`；`plugin.json` 里 `mcpServers`；或 `ctx.mcpManager` 运行时增删 | `dsh-mcp-client\src\tools.ts:177`；`hindsight\plugin.json` | 工具名 `mcp__<server>__<tool>`；**默认不启用任何 server**；支持 stdio 与 Streamable HTTP |
| 19 | **HTTP 路由** | `ctx.webServer.register({…})` / `registerFallback({…})`；RPC 固定 `/api` | `dsh-host-webserver\README.zh.md:12`；`dsh-client-hmr\src\index.ts:181`；`dsh-client-connection\src\api-path.ts:7` | 「它不提供任何文件服务——/api 桥接、插件 bundle、HMR 事件流与 SPA dist 都属于注册它们的插件」；**无服务器级认证**，绑定非回环即公开 |
| 20 | **前端插件装载** | 包声明 `dsh.client:{platform:'web', inject?, immediately?}` + `exports['./client']`；Host 侧 `ctx.clientModules` 扫描 Loader 条目 → 组装 `window.__DSH_BOOT__` | `dsh\docs\subsystems\client-modules.md`；`dsh-web-app\README.zh.md` | 路由 `/plugins/??<pkg>/client.js&rev=<rev>`，启动请求 URL ≤ 3 KiB；未知/改动资源/stale rev 一律 404；**client 必须是 lazy-CJS factory 格式**，宿主的构建预设 `packages/client/tsdown.client.ts` **不在任何已发布包里**，仓库外要自己复刻 |
| 21 | **子代理 provider** | `ctx.subagents` provider registry（spawn/fork/acp/codex/claude-code/dsh-sdk） | `dsh\docs\subsystems\subagent.md`；profile 装了 codex/claude-code 两个 provider | 本会话 delegation depth 已用尽仅是本会话策略，不是产品限制 |
| 22 | **定时任务** | `ctx.schedule` + `schedule_*` 工具；到期经 `followup(..., {source:{kind:'schedule'}})` 投递 | `dsh\docs\subsystems\schedule.md` | 只支持 rrule 子集；本机由 Web 组合自行挂载（`dsh-experimental-schedule-bundle` 已退役） |
| 23 | **投递文件/交付物** | `present` 工具 + `ui-deliverables`（右侧栏 changes-review tab） | `dsh-tool-present`；`dsh-client-ui-deliverables\src\client\index.ts:89` | — |
| 24 | **Agent 自造页面（产品化闭环）** | `propose_action(action:'create_personalized_page', title, brief, details{slot, initialContent})` → 卡片 → 用户点创建 → 子 Agent 生成插件 → `installBundle` | `dsh-creation-recommendations\README.zh.md`、`src\index.ts:31`、`references\{main-page,session-tab,sidebar-entry}.md` | slot 三选 `sidebar-right` / `page` / `sidebar-left`；**只支持新增插件，修改已有插件未支持**；生成代码用现有 Creator 权限执行，**包校验不构成代码沙箱** |
| 25 | **官方可选插件** | `propose_action(action:'enable_official_plugin', details{name})` | `dsh-official-bundles\src\bundles.ts:56-73` `OPTIONAL_BUNDLES`（16 个） | 只在 `OPTIONAL_BUNDLES` 清单内的可一键开 |

### 5.1 明确的能力边界（做方案时先排除）

| 做不到 | 证据 |
| --- | --- |
| **没有 URL 路由 / 深链** | `dsh-client-ui-layout\src` 全仓 grep `pushState/location.pathname/useRoute` = 0 命中；Grok Bot 有 `grokbot://app/v1/settings?id=…` |
| **不能替换 app root、不能 iframe 挂页** | `references\main-page.md`「A separate HTML file, iframe, or replacement app root is not a mounted page」 |
| **不能读别的插件的 DOM/样式/组件源码来定位** | `references\ui-plugin.md`「Do not read another plugin's DOM, stylesheet, or component source to estimate placement」 |
| **不能自定义 session 事件 type**（会让会话无法重开） | `references\practices.md`（envelope 无 `ignorable:true`） |
| **授权类动作不能给工具**（批准工具调用 / 回答提问 / 放宽策略只能用户做） | `references\user-actions.md` |
| **右侧栏布局不能跨设备同步、不能重命名记录** | `dsh\docs\subsystems\sidebar-right.zh.md` 的 Not built 段 |
| **插件市场/安装必须走 plugin_manager**，禁手改 profile、禁在 profile 目录跑 pnpm | `references\plugin-development.md` |
| **前端改完必须重新构建**，无源码直服回退 | `dsh-web-app\README.zh.md:222` |

---

## 6. 内置工具面清单（模型可见）

### 6.1 本会话实际可见（delegation depth 受限，故无 `subagent` 系列）

本地工具：`read` / `write` / `edit` / `glob` / `grep` / `read_image` / `pwsh` / `job_list` / `job_output` / `job_kill` / `present` / `todo_write` / `skill` / `web_search` / `web_fetch` / `ask_user_question` / `working_directory` / `load_workspace_dependencies` / `create_goal` / `get_goal` / `update_goal` / `schedule_create|edit|list|view` / `team` / `team_task_create|get|list|update` / `wait_agent` / `send_message` / `list_agents` / `list_subagent_models` / `compress` / `decompress` / `search_context` / `acp_status` / `acp_cache` / `acp_read_original_image` / `create_worktree` / `hindsight_*` / `skillopt_*` / `run_code`（PTC 执行器）。

### 6.2 全量工具包面（`dsh\docs\tool-catalog.md`，115 个 `##`/`###` 条目）

| 工具包 | 模型可见工具 |
| --- | --- |
| `dsh-plugin-manager` | `plugin_manager`（list_plugins / list_bundles / set_plugin / set_bundle / install_bundle / remove_bundle） |
| `dsh-plugin-market` | `plugin_market` |
| `dsh-mcp-resources` | `list_mcp_resource_templates` / `list_mcp_resources` / `read_mcp_resource` |
| `dsh-experimental-browser-use-stagehand-native` | `stagehand_act` / `_extract` / `_navigate` / `_observe` / `_screenshot` / `_tabs` |
| `dsh-action-cards` | `propose_action` |
| `dsh-tool-ask-user` | `ask_user_question`（支持 `mode: timed`） |
| `dsh-tool-executor-ptc` | `run_code`（**只暴露这一个**，其余能力以生成 SDK 形式给出，内嵌调用走 `tool/ptc-dispatch`） |
| `dsh-plan-mode` | `exit_plan_mode` |
| `dsh-tool-bash` / `dsh-tool-pwsh` | `bash` / `pwsh`（win32 上 bash 禁用，见 §6.3） |
| `dsh-tool-bash-persistent` / `dsh-tool-pwsh-persistent` | 同名 `bash`/`pwsh`（持久会话变体） |
| `dsh-tool-office` | `office_convert` / `office_recalculate` / `office_render` |
| `dsh-tool-present` | `present` |
| `dsh-tool-cordis` | `cordis_inspect_list` / `cordis_inspect_query` |
| `dsh-tool-str-replace-editor` | `str_replace_editor` |
| `dsh-tool-fs` | `apply_patch` / `edit` / `read` / `read_image` / `write` |
| `dsh-tool-fs-search` | `glob` / `grep` |
| `dsh-tool-terminal` | `terminal_open` / `_close` / `_list` / `_read` / `_send` / `_signal`；`user_terminal_list` / `user_terminal_read` |
| `dsh-tool-goal` | `create_goal` / `get_goal` / `update_goal` |
| `dsh-tool-schedule` | `schedule_create` / `_edit` / `_list` / `_view` |
| `dsh-tool-lsp` | `lsp` |
| `dsh-tool-ralph` | `ralph` |
| `dsh-tool-skill` | `skill` |
| `dsh-tool-session-query` | `session_event_read` / `_search` / `_trace` / `session_search` / `session_trace` |
| `dsh-tool-subagent` | `subagent` / `list_subagent_models` |
| `dsh-tool-subagent-control` | `interrupt_agent` / `list_agents` / `send_message` / `wait_agent` |
| `dsh-experimental-tool-subagent-oar` | `subagent_oar` |
| `dsh-tool-jobs` | `job_kill` / `job_list` / `job_output` |
| `dsh-tool-agent-team` | `team_task_create` / `_get` / `_list` / `_update`（+ 第三方包提供的 `team` 面板工具） |
| `dsh-tool-todo` | `todo_write` |
| `dsh-tool-working-directory` | `working_directory` |
| `dsh-experimental-tool-worktree` | `create_worktree` |
| `dsh-tool-workflow` | `workflow` |
| `dsh-tool-workspace-dependencies` | `load_workspace_dependencies` |
| `dsh-tool-web` | `web_fetch` / `web_search` |

### 6.3 本机 profile 的「工具面」是分层裁剪的（关键机制）

`dsh-web-app\cordis.patch.yml` 在 web 层**显式 disabled 了 24 个 model-facing 工具行**（`tool-bash`/`tool-pwsh`/`tool-jobs`/`tool-fs`/`tool-fs-search`/`skill-filesystem`/`tool-skill`/`command-goal`/`tool-goal`/`plan-mode`/`compaction-basic`/`command-compact`/`tool-result-pruner`/`tool-subagent-control`/`tool-subagent`/`tool-subagent-fork`/`workflow-ptc`/`tool-workflow`/`agent-instructions`/`tool-todo`/`tool-web` …），注释解释：**host 平面保留 registry（jobs/skill/token-meter/subagent registry），只有 model-facing 的 tool 行移到 preset**，「Disabling rather than deleting is deliberate」。

→ **结论：同一个工具，在 host 平面是「服务」，在 preset 里是「暴露给模型的行」**。做插件时注册模型工具应考虑挂在 preset 还是在 host 上。

---

## 7. Web GUI 界面结构

### 7.1 三列外壳（`dsh-client-ui-layout`）

```
root [AppFrame]                       ← 唯一内置声明、唯一经 Cordis service 渲染的 key
├─ sidebar   (single, root)
├─ main      (keyed, root)            ← activePanelId ?? 'conversation'
├─ rightbar  (single, root)
├─ shell.leading (single, root)       ← 窗口左侧红绿灯位
├─ shell.bottom  (single, root)
└─ shell.overlay (list, root)         ← 浮层：右键菜单/快捷键/通知/弹窗
```

- `AppFrame.tsx:1-16` 头注释：「Three-column shell frame, registered into the built-in 'root' slot (the web shell renders only 'root'). Owns the grid tracks (sidebar | center | rightbar), the drag handles…」
- `AppFrame.tsx:46-51`：`const panelId = usePanelInfo(info => info.activePanelId)` → `renderSlot('main', {}, { entryKey: panelId ?? 'conversation' })`
- 证据：`dsh-client-ui-layout\src\client\index.ts:192-205`、`AppFrame.tsx:46-51`、`service.ts:19-54`

### 7.2 左侧栏（`dsh-client-ui-sidebar`）

```
┌ brand row（sidebar.brand.mark / sidebar.brand.name）
├ nav：sidebar.panellist 行（list，每行 = 一个全局面板图标）+ More 菜单 + officialEntry('plugin'|'cron')
├ 中部：sidebar.workspaces（会话/工作区列表，含 .directoryFlow / .session.row.{leading,trailing,hover}）
└ 底部：sidebar.footer.action（list）+ sidebar.settings（single）
```

- 证据：`dsh-client-ui-sidebar\src\client\SidebarRoot.tsx:67,440-478`；`contract\slots.ts:47`（`sidebar.panellist` 契约注释：「Global panel icons. Each list id addresses the matching main panel; the sidebar owns the button and resolves its label from list metadata.」）
- `sidebar.panellist` 的 entries 会被同步进 `panels` 列表：`dsh-client-ui-sidebar\src\client\index.ts:58-70`

### 7.3 会话视图（`dsh-client-ui-conversation` + `ui-chat` + `ui-trajectory`）

```
main[key=conversation] → ConversationRoot
├─ conversation.header（session.header → lineage / actions / utilities / views.actions / corner）
├─ conversation.view（list，会话内 Tab）：ChatView(id=chat) ｜ TrajectoryView(id=trajectory) ｜ 插件 tab
│   └─ conversation.chat.flow → conversation.chat.node（keyed：user / steering / context /
│       turn-trigger / system-prompt / assistant-step / tool-call / command / turn-tail …）
│       └─ tool.call.toolview（keyed by tool）
├─ conversation.composer（chain）→ conversation.composer.bar（InputBar）
│   └─ conversation.input.{attachments,permission,plan,model,activity} / .{left,right,overlay,dock}
└─ conversation.hero.frame（hoc）→ brand.mark / workspace / agentPreset / options
```

- 证据：`dsh-client-ui-chat\src\client\apply.ts:225-256`、`dsh-client-ui-conversation\src\client\apply.ts:399,438-450`、`dsh\docs\subsystems\slots.md`

### 7.4 右侧栏（`dsh-client-ui-sidebar-right`）

- **每 Session 一个 docking surface**，存于 session-scoped slot store，刷新恢复保存的布局；root-scoped 控制器保留「选中 Session」与「后台 Session（keepMounted）」两个座位。
- Tab = 两次注册：`ctx.sidebarRightTabs.register(definition)` + `ctx.slots.register({name:'sidebar.right.pane.tab', key:<id>}, Body)`。
- 已发布 tab 类型：`guide`(builtin) / `text`(fallback, `dsh-resource://file/**`) / `files`(builtin) / `browser`(builtin, 多实例) / `subagentchat`(builtin, `dsh-resource://subagentchat/session/<child>?parent=<parent>&mode=<mode>`) / `changes-review`(ui-deliverables) / `scheduleTask`(ui-schedule) / plan / terminal。
- 证据：`dsh\docs\subsystems\sidebar-right.zh.md`；`dsh-client-ui-subagent\src\client\sidebar-chat\index.tsx:21,180`；`dsh-client-ui-deliverables\src\client\index.ts:89`

### 7.5 设置页（`dsh-client-ui-settings`）

5 个内置分区（`settings.section` list 槽）：

| id | order | 来源 |
| --- | --- | --- |
| `account` | -10 | `dsh-client-ui-settings-account\src\client\index.ts:323` |
| `general` | 0 | `dsh-client-ui-settings-general\src\client\index.ts:267` |
| `models` | 10 | `dsh-client-ui-settings-models\src\client\index.ts:137` |
| `plugins` | 15 | `dsh-client-ui-settings-plugins\src\client\index.ts:77`（注释：「This package owns the one Built-in plugins navigation entry and the tab chrome; feature plugins contribute pages without competing for Settings nav rows.」） |
| `agent-presets` | 20 | `dsh-client-ui-agent-preset\src\client\index.ts:284`（注释：「Ordered after Models: choosing a model is routine, and composing an agent is the deployment-shaping act behind it.」） |

### 7.6 其他界面事实

- **标题栏**：Electron 无边框，左侧由 `shell.leading` 让出红绿灯位（`ConversationRoot.module.css:77` 注释「Clears the frame's window-chrome band (traffic lights + shell.leading)」）。
- **文档标题**：`dsh-client-ui-layout\src\client\DocumentTitle.tsx:18`「`activePanelId === null` 时显示会话标题」。
- **命令面板/斜杠菜单**：`/` 触发 `ui-input-trigger` + `ui-commands`，composer 的 `+` 与 `/` 打开同一个菜单（「添加」节 + 「指令」节）。
- **主题 token**：`--dsw-alias-bg-base / bg-layer-1 / bg-layer-2 / bg-overlay / border-l1 / border-l2 / brand-primary / label-primary / label-secondary / state-error-primary`。
- **未验证**：具体 DOM 结构、颜色、间距、真实渲染截图——因 401 鉴权无法抓页面（见 §1.2）。

---

## 8. 可复用机制清单（做 Bot 面板能直接拿的）

| 机制 | 能拿来做什么 | 证据 |
| --- | --- | --- |
| `main` keyed 槽 + `ctx.layout.selectPanel` | 整页 Bot 面板（替换中央对话区） | `dsh-client-ui-layout\src\client\service.ts:36` |
| `sidebar.panellist` list 槽 | 左侧 Bot 入口图标 + 选中态 | `dsh-client-ui-sidebar\src\client\contract\slots.ts:47` |
| `sidebarRightTabs` + `sidebar.right.pane.tab` | 每个 Bot 一个可停靠/分屏/浮动的检查器面板 | `dsh\docs\subsystems\sidebar-right.zh.md` |
| `conversation.view` list 槽 | 会话内 Bot 运行日志/输出 tab | `dsh-client-ui-chat\src\client\apply.ts:237` |
| `settings.section` list 槽 | Bot 全局设置页 | `dsh-client-ui-settings\src\client\contract\slots.ts:57` |
| `ctx.commands.register` | `/bot …` 命令 | `dsh-command-goal\src\index.ts:191` |
| `ctx.commandUi` | Bot 选择器弹窗（像 `/model`） | `dsh-client-ui-commands\src\client\contract.ts:64` |
| `ctx.theme.register` | Bot 品牌主题 | `dsh-client-ui-theme\src\client\index.ts:354` |
| `ctx.tools.register` + `ctx.tools.guard` + `tools/pre-execute` | Bot 专属工具 + 策略闸门 | `dsh\docs\cookbook\extension-cookbook.md` |
| `ctx.subagents` provider registry | Bot = 一种 subagent provider | `dsh\docs\subsystems\subagent.md` |
| `ctx.sessionProjections` | 每会话 Bot 状态派生（纯函数，快照稳定） | `references\practices.md` |
| `ctx.schedule` + `followup(source:'schedule')` | Bot 定时主动执行（Routines） | `dsh\docs\subsystems\schedule.md` |
| `ctx.webServer.register` | Bot 对外 HTTP 出口 | `dsh-host-webserver\README.zh.md:12` |
| `ctx.mcpManager` / `plugin.json mcpServers` | Bot 接 MCP 生态 | `hindsight\plugin.json` |
| `propose_action` + Creator | Agent 自助生成 Bot 面板代码 | `dsh-creation-recommendations\README.zh.md` |
| `plugin_manager install_bundle` | Bot 插件的一键安装/卸载/配置 | `dsh-plugin-manager\src\tools.ts:88` |

---

## 9. 「Grok Bot 式 Bot 面板」在 DSH 现有形态里的复用初判

### 9.1 Grok Bot 已知界面形态（外部参考，仅 UI 层，功能面「未验证」）

- 侧栏：agent 行 + 左下账号按钮；右键 Delete（永久删，含 transcript；**无 archive/hide**）。
- 设置分 General / Computer / Vault / Usage & Billing / Updates；General 内有 account、theme、accent、language、spell-check、microphone、hardware-acceleration、network-debugger、notification-sound、timezone、auto-review、auto-review-rules、security-keys。
- **Per-agent info pane**（复刻核心）：点会话头里 agent 名字（或 `Cmd+Shift+I`）打开，与全局 Settings 分离；内含该 agent 计算机的实时预览（可全屏）+ Routines 列表 + Channels + 群聊 Members；面板 header 有 X 关闭，X 旁齿轮进 per-agent Settings（avatar / name / title / description / notifications）。
- 深链：`grokbot://app/v1/settings?id=<row>`。
- 证据：`D:\ProfessionalSoftware\Project\dsh-bots\research\_src\app-ui.md.txt`（100 KB，HTTP 200 抓取）；完整功能文档 docs.x.ai 抓取失败 → **「未验证」**。

### 9.2 逐项对标判定

| Grok Bot 元素 | DSH 是否有对应机制 | 复用判断 |
| --- | --- | --- |
| **per-agent info pane（右侧/侧边）** | ✅ `sidebarRightTabs` + `sidebar.right.pane.tab` | **可直接复用**。一个 Bot 一个 tab 实现，按 `dsh-resource://bot/<id>` 地址路由，`keepMounted` 保活；分屏/浮动/焦点 API 齐全 |
| **agent 列表（侧栏）** | ✅ `sidebar.workspaces` 已承载会话列表；或自建 `main` 页 | **可复用**：Bot 列表可做独立 `main` 页；若要嵌进现有侧栏列表，需注入 `sidebar.workspaces.session.row.{leading,trailing,hover}` 子槽（能力有限，只能加行内装饰） |
| **agent 名字点击开面板** | ✅ `conversation.session.header.actions`（list, session scope） | **可复用**：在会话头加动作按钮/corner，点击调 `ctx.sidebarRight.openResource(...)` |
| **Bot 全屏「计算机预览」** | ⚠️ 部分 | 右侧栏支持 `float(tabId, rect)` 与 `ctx.layout.openRightbar(track, fullscreen)`；但**无 iframe 宿主**，实时画面要么用 `<img>/<canvas>` 自绘流，要么用内置 `browser` tab 类型（`openTab('browser', {params:{url}})`，仅 desktop 端有） |
| **per-agent Settings 子页** | ✅ `settings.section` + `plugins.detail.*`；或面板内自带子路由（自管状态） | **可复用**，但注意 DSH 无 URL 路由，子页只能是组件内状态 |
| **Routines 列表** | ✅ `ctx.schedule` + `schedule_*` 工具 + `ui-schedule` 已有 `scheduleTask` tab 类型可参照 | **可复用**；Routines ≈ DSH 定时任务（rrule），已有完整 CRUD 与 UI 先例 |
| **Channels（渠道连接器）** | ⚠️ 未发现通用「渠道」抽象 | 需自建（MCP server / webhook 包 `dsh-webhook`、`dsh-webhook-github` 可作底座） |
| **群聊 Members** | ✅ 有 `@suifei/dsh-ai-team`（共享任务板）+ `team_task_*` + Agent Teams | **可复用**（但要区分：DSH 的 team 是「任务板协作」，不是「群聊消息流」） |
| **账号/左下角按钮** | ✅ `ui-settings-account`（order -10）+ `sidebar.settings` | **可复用** |
| **深链 scheme** | ❌ **无** | DSH 无 URL 路由（grep 0 命中）；只能靠 `ctx.layout.selectPanel` + 组件内状态 |
| **主题/强调色** | ✅ `ctx.theme.register({id, colorScheme, tokens, icons})` | **可复用**（覆盖 `--dsw-alias-*`） |
| **通知/声音** | ⚠️ 有 `ui-account-notifications`，无「通知音」设置 | 需自建 |
| **一键新建 Bot** | ✅ `propose_action` 卡片 + Creator + `plugin_manager` | **可复用**：Bot 面板可以做成「一次 `create_personalized_page`（slot: sidebar-left/page/sidebar-right）」 |

### 9.3 推荐落点（最小可行 Bot 面板）

```
一个 bundle 包 dsh-bot-panel
├─ package.json   dsh.bundle.patch=./cordis.patch.yml ; dsh.client={platform:'web', inject:[
│                   '@deepseek-ai/dsh-client-ui-conversation',
│                   '@deepseek-ai/dsh-client-ui-sidebar',
│                   '@deepseek-ai/dsh-client-ui-sidebar-right',
│                   '@deepseek-ai/dsh-client-locale' ]}
├─ cordis.patch.yml  - insert: [{id: bot-panel, name: dsh-bot-panel}]
├─ index.js       Host 半：ctx.tools.register(bot_* 工具)、ctx.subagents?、ctx.sidebarRight 资源 provider
└─ client.js      浏览器半：
                  ctx.slots.inject('sidebar.panellist', …register({id:'bot',order:30,label}) )   ← 左侧入口
                  ctx.slots.inject('main',            …register({name:'main', key:'bot'}, BotPage)) ← 整页
                  ctx.sidebarRightTabs.register({id:'bot:agent', kind:'botagent', …})            ← per-bot 面板
                  ctx.slots.inject('sidebar.right.pane.tab', …register({key:'bot:agent'}, BotPane))
```

**判定：DSH 现有形态对 Grok Bot 的「面板结构」是高度可复用的（槽位、右侧栏 docking、设置分区、主题、定时任务全都有现成机制）；不可复用/需自建的是「深链路由」「iframe/DOM 级自由布局」「渠道连接器抽象」「通知音」四块。**

---

## 10. 与参考材料的差异补充（不重复已有结论）

| 参考材料已给结论 | 本次新增/修正 |
| --- | --- |
| `DSH-vs-Codex-功能差距调研报告.md`：DSH 是「能力密度极高但缺乏对外服务化出口的本地 Agent 运行时」 | **补充证据**：对外出口其实有两条——`ctx.webServer.register`（自定义 HTTP 路由）与 `ctx.connection.fetch.register`（authenticated fetch，见 `dsh-session-log-export\src\index.ts:81` 的 `/export` ZIP 路由）。所以「无对外出口」应修正为「**无通用 API 网关/无 OpenAPI，但插件可自建路由**」 |
| `dsh-inventory.md`：源码级清单 | **补充**：`dsh-web-app\cordis.patch.yml` 在 web 层 disabled 了 24 个 model-facing 工具行（见 §6.3），这是「包存在≠可用」的**具体机制**，不是配置疏漏 |
| `预设方案与测试结论.md`：bundle = 声明 `dsh.bundle.patch` | **补充**：patch 语义是**整行替换、inject 替换不拼接**；且**行顺序无加载语义**（activation 由 service 可用性驱动） |
| 参考材料未覆盖 | **新增**：`dsh-official-bundles\src\bundles.ts` 的 5 个 profile 模板、16 个 `OPTIONAL_BUNDLES`、2 个 `ON_DEMAND_BUNDLES`、2 个 `RETIRED_BUNDLES` —— 这是「官方能提供什么插件」的权威清单 |

---

## 11. 未验证 / 待补清单

| 项 | 原因 |
| --- | --- |
| Web GUI 真实 DOM 结构、颜色、间距、截图 | `http://127.0.0.1:61593` 返回 401（`browser-auth.ts:386-392`），无法抓页面 |
| Grok Bot 完整功能面（Computer / Vault / Channels 的具体行为） | `docs.x.ai/grok-bot/chat-and-collaboration.md` fetch failed；`blockchain.news` 返回 AMP 样板 HTML |
| `dsh-cua` / `dsh-computer-use` 的具体 API | 本次未展开（包存在，lead 已确认；未读其 README） |
| 插件市场 `https://cdn.dsh.so/market/index.json` 的实际内容 | 未抓取 |
| `dsh-experimental-liveshare`（多人协作）能力边界 | 未读 |
| 手机/平板端 UI 适配策略 | 仅在 `ui-commands\README.zh.md` 见「手机和平板需要点击搜索框」，未系统验证 |
| 前端 dist 与 asar 的构建对应关系 | 未验证（`dsh-web-app\README.zh.md:222` 只说 dist 缺失会拒绝启动） |

---

## 12. 关键路径速查（开发时直接抄）

```
# 官方文档（解包副本）
C:\Temp\dsh-asar-extract\dsh\node_modules\@deepseek-ai\dsh\docs\
├─ subsystems\        # 47 页 × 中英（slots / sidebar-right / commands / client-modules / skills / subagent …）
├─ cookbook\          # extension-cookbook / adding-a-tool / adding-a-settings-card / adding-a-package
├─ architecture.md  capability-seams.md  tool-catalog.md  config-catalog.md  persistence-catalog.md
└─ cordis-api\ cordis-tutorial\ upgrade-guide\ user\

# 内置造插件指南（Agent 技能）
C:\Temp\dsh-asar-extract\dsh\node_modules\@deepseek-ai\dsh-agent-preset\skills\dsh-doc\
├─ SKILL.md
├─ references\        # plugin-development / host-plugin / plugin-details / ui-plugin / practices / user-actions …
└─ templates\         # decoration（UI 插件骨架） / mcp（纯配置 MCP bundle）

# 个性化页面 slot 说明
C:\Temp\dsh-asar-extract\dsh\node_modules\@deepseek-ai\dsh-creation-recommendations\references\
├─ main-page.md  session-tab.md  sidebar-entry.md  sidebar-right.md

# 本机 profile（只读参考，勿手改）
C:\Users\Lenovo\.dsh\profiles\desktop\
├─ package.json       # dsh.profile.bundles 18 条
├─ cordis.patch.yml   # 13 个顶层 id
└─ node_modules\      # 已装 bundle 实体

# 已装插件范本
C:\Users\Lenovo\.dsh\profiles\desktop\node_modules\@suifei\dsh-ai-team\        # 双端最小范本
C:\Users\Lenovo\.dsh\profiles\desktop\node_modules\@vectorize-io\hindsight-coding-agents\  # MCP/Hook/Skill 范本
C:\Users\Lenovo\.dsh\profiles\desktop\node_modules\@local\dsh-rigorous-preset\ # 纯 YAML preset 范本
```

---

*本报告所有路径均为本机实测；标注「未验证」处未做推断。*
