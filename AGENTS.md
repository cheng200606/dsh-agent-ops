# AGENTS.md — dsh-bots

## 这是什么

「为 DeepSeek Harness（DSH）做一个 Grok Bot 式插件」的完整交付：先做公开信息调研，再做能力对标，
最后落成一个可安装的 DSH 插件 bundle —— **Agent Ops 运行台**（`@local/dsh-agent-ops`），
把「谁批准了什么、什么被拦下了」变成一条可读的审计时间线。

需求与验收口径的权威出处是 `docs/04-dsh-plugin-plan.md`（**§5 + §9 是 24 条需求，§14 是落地后的
实现记录与六条偏离**——改行为前先读 §14，它记录了实测结论）。

不是 git 仓库（本次交付会初始化）。文档与代码注释一律中文。

## 目录

| 路径 | 内容 |
|---|---|
| `docs/` | 调研与方案四篇：`01` Grok Bot 调研 → `02` DSH 对标 → `03` 排除云电脑后的需求 → `04` 开发方案（**权威**，含 §14 实现记录） |
| `plugin/` | 插件包本体，**唯一可发布产物**。`lib/` = Host 半，`client.js` = 浏览器半（零构建），`skills/` = 八份岗位手册 + `ops-form` 技能，`scripts/embed-rules.mjs` = 打包前生成器 |
| `_verify/` | Playwright 截图/探测脚本（CommonJS），跑浏览器端验证 |
| `dist/` | 打包产物与运行日志 + `shots/` 截图。**不手改，不入库**（含会话 token） |
| `research/` | 调研原始产物；`research/_src/` 是抓取缓存；`research/dsh-current-form.md` 是本机 DSH 取证盘点 |

## 命令

```bash
# 单测（唯一质量闸门；当前 157 passed / 0 fail）
cd plugin && node --test          # 等价于 npm test

# 打包 → dist/local-dsh-agent-ops-<version>.tgz（@local/ 作用域在文件名里变成 local-）
cd plugin && npm pack --pack-destination ../dist
#   prepack 会先跑 scripts/embed-rules.mjs：从 lib/rules/classify.js 重新生成
#   client.js 里的 RULES_TABLE 块。改了规则表只要改 classify.js，然后重新打包。

# 装进 profile（dsh CLI 来自 DeepSeek Harness 安装目录，不在 PATH 上）
dsh plugin --profile <demo|web|headless> add ./dist/local-dsh-agent-ops-<v>.tgz

# 起 Web UI（打印带 token 的 URL）
dsh --profile web --port <port> --no-open

# 浏览器端截图验证
cd _verify && npm i               # 首次：装 playwright
DSH_TOKEN=<url 里的 token> DSH_PORT=<port> node shot16.js   # 产物落在 ../dist/shots/
```

本机 profile 在 `C:\Users\Lenovo\.dsh\profiles\{demo,web,headless}\`；它们的 `package.json`
以 `file:` 指向 `dist/` 里的 tgz。**不要手改 profile 的 package.json / cordis.patch.yml**。

### 本地开发的两个前置

1. **peer 依赖**：插件 `import` 了 `@deepseek-ai/dsh-session` 与 `@deepseek-ai/dsh-llm`。
   本机没有 npm 网络源时，把 `plugin/node_modules` 指向 DSH 运行时自带的依赖树即可：
   `ln -s "C:/Temp/dsh-asar-extract/dsh/node_modules" plugin/node_modules`
   （那个目录是 DSH app.asar 的解包副本，只读参考用；`npm pack` 不会把 node_modules 打进包里。）
2. **DSH CLI**：本机 DSH 装在 `D:\ProfessionalSoftware\agent\dsh\dsh\`，CLI 入口在 app.asar 里。
   解包副本里的 `node_modules/@deepseek-ai/dsh/lib/bin.js` 可以直接用 node 跑，但**原生模块**
   （node-addon-require-builtin / node-pty / koffi / sharp）要从 `app.asar.unpacked` 复制过去，
   否则 web profile 起不来。

## 架构红线（违反即返工）

1. **不拥有决策**：`approval/request` 监听器只观察，必须原样 `return next()` 透传，**绝不代答**。
2. **不动轮次结构**：审批必须在**未结束的轮次内**发生，不做异步审批队列；子代理的调用属于另一个
   Agent 的另一个轮次，挂起等待只会留下永不结算的 Promise。
3. **不改内核、不重写既有能力**：审批 UI、jobs、deliverables、action-cards、schedule、subagent
   都是现成服务，只做薄胶水；不 fork DSH。
4. **不新建存储 / 消息栈 / 身份体系 / 审批引擎**：能表达成「同一条会话日志上的新投影 + 新纵切页」
   就属于窄路，否则出界。
5. **不新建传输层**：读走 `useProjection`（有标准 props 时）或
   `ctx.sessions.binding(id).session.projections.faceOf(...)`；写走 `ctx.settings` /
   slash 命令 / `appendPluginRecord`；导出走既有 deliverables 链路。
6. **不写模型上下文**：插件不注入任何模型可见内容。
7. **不手改 profile**（见上）。

## 关键契约（改动前先读对应文件头注释，那里是权威）

- **投影四硬约束**（`lib/audit-projection.js` 顶部）：`apply` 必须同步；不关心的事件必须
  返回**同一个 state 引用**（宿主用 `Object.is` 判定）；state 必须是纯 JSON；`wire.view` 必须复用
  引用。改了 state 形状 → `stateVersion` +1（不迁移）。
- **两个投影，别混**：
  - `ops.audit` —— 会话数据（条目 / 计数 / 命中 / 环境），`summary: false`。
  - `ops.config` —— 与会话无关但客户端要知道的常量（内置规则表 / 策略 / 连接器 / 主动感知策略 /
    用户规则表），**默认成员资格**。
  - 为什么分开（实测坑）：投影值只会在「会话被客户端订阅」或「会话已发生过事件」时到达客户端，
    挂 `summary: false` 的审计投影上的常量，在一个刚创建的新会话里客户端根本读不到。
- **客户端拿不到投影时的兜底**：`/ops-config` 命令（宿主命令通道）+ client.js 里内嵌的
  `RULES_TABLE`（打包时从 `lib/rules/classify.js` 生成）。规则表页因此在任何会话里都有内容。
- **围栏两条通道不能互换**：`tools/pre-execute` 返回 `ask`（会被后续监听器/审批策略改写）；
  `ctx.tools.guard` 只能拒绝、类型上没有 allow 分支，所以硬拦必须落在 guard（它在所有
  pre-execute 之后执行）。判定入口只有 `lib/rules/policy.js` 的 `evaluate()`。
- **三个错误码形状不同，别混**：围栏硬拦 `AGENT_OPS_FENCED`（落 `error.info.code`）、
  升级工单拒绝 `AGENT_OPS_ESCALATED`（落 `error.info.code`）、
  宿主 auto-review `AUTO_REVIEW_DENIED`（落 `error.code` **顶层**）。
- **子代理没有审批权**：宿主的 `captureDelegatedPolicyOverrides()` 把子代理 approval 钉死 `never`。
  子代理高危调用只能走升级工单（写工单 + **当场拒绝原调用** + `followup()` 唤醒主 Bot）。
  唤醒只能用 `followup()` / `steer()`，**绝不能用 `inject()`**（inject 不唤醒驱动）。
- **plugin record 必须纯 JSON**，且靠 `appendPluginRecord` 自带的 `ignorable: true` 让旧版本读者
  跳过而不是拒绝整条日志。
- **Host 半**：可选服务用 `ctx.get('subagents')` 之类读取，**缺席要能降级**（如升级工单退化成
  「只登记不唤醒」），不能让整个插件激活失败；`apply()` 的返回值是生命周期 effect，只能是
  function（disposer）或 null/undefined，返回对象会抛 `TypeError: Invalid effect` 并让插件条目
  激活失败。
- **客户端半零构建**：`window.__ModuleLoader__.load({ id, factory(require) {...} })`；只
  `require('react')`；CSS 注入与 slot 注册全部留在 factory 闭包内，模块执行期只注册 factory。

## 命令一览（客户端 → Host 的唯一写入通道）

| 命令 | 作用 |
|---|---|
| `/ops-say [@名字] 内容` | 群聊发言 |
| `/ops-bot <名字> <角色> [--main] [--title 标题]` | 声明名册行；角色名命中八类角色包时自动记下 preset id |
| `/ops-rule list \| add \| remove \| export \| import` | 用户规则表（A3 / D1） |
| `/ops-config` | 读配置面（规则表 / 策略 / 连接器）——客户端的兜底通道 |
| `/ops-adjudicate <工单 id> <approve\|reject>` | 裁决升级工单（G5，`escalation.adjudicate` 打开时） |
| `/ops-ignore <类别>` | 忽略一类主动建议（G8 降级的前提） |
| `/ops-teach <技能名> [save]` | 从会话轨迹生成例程草稿（G6）；`save` 才落盘 |

命令名受宿主约束：`/^[a-z][a-z0-9_-]*$/u`（不许点号、不许大写）；`input.hint` **不能为空串**
（宿主会拒绝整个命令条目 → 插件条目不激活）。

## 代码约定

- ESM（`"type": "module"`），Node 24；相对导入带 `.js` 后缀。
- 中文注释写「**为什么**」，尤其是不变式、宿主契约、以及引用宿主源码位置（形如
  `dsh-session-projection/src/index.ts:915-930`）。
- 客户端 CSS 类统一 `ao-` 前缀；文案字典**必须扁平**（宿主 locale `bind()` 只做直接属性查表，
  不支持点号路径）；中英文案成对提供。
- 日志用 `ctx.logger?.debug?.() / ?.warn?.()`。
- 测试用 `node:test` + `node:assert/strict`；测试名以需求编号开头（`A3 …`、`G5 …`），
  断言要覆盖**引用相等性**与**边界值**（上限、截断、豁免对 critical 无效等）。

## 动插件前必读

- `docs/04-dsh-plugin-plan.md` §5 / §9（需求与验收标准）与 **§14（实现记录与六条偏离）**。
- `plugin/lib/audit-projection.js` 与 `plugin/lib/config-projection.js` 的文件头注释 —— 投影契约。
- `plugin/lib/rules/{policy,guard,classify,user-rules}.js` —— 围栏与规则判定链路。
- `plugin/lib/triggers.js` / `plugin/lib/teach.js` / `plugin/lib/escalation.js` —— v1.1 的三个新单元。
- `plugin/docs/DETAIL.zh.md` —— 面向用户的能力边界（改行为前先确认没越过这些边界）。
- DSH 官方文档（只读参考）：`C:\Temp\dsh-asar-extract\dsh\node_modules\@deepseek-ai\dsh\docs\`
  （`subsystems/`、`cookbook/`、`cordis-api/`），以及同目录 `@deepseek-ai/dsh-agent-preset/skills/dsh-doc/`。

## 已知坑

- `engines.dsh` 锁在 `>=0.2.2-rc.3 <0.3.0`；DSH 升级后要同步改，否则加载失败。
- 包里带 `skills/` 时 pnpm 会提示「Agent skills awaiting approval」——那是 pnpm 对**依赖包**
  自带技能的政策提示，本插件的技能由插件自己注册（`ctx.skills.register`），不受影响。
- 规则表与策略是**插件级**的（对所有会话一致），不是会话状态；用户规则表是**会话级**的
  （存在会话日志的插件记录里）。
- 会话状态有上限：审计条目留最近 1000 条，wire 视图取最近 500 条。
- `dist/` 里的旧 tgz 与日志是历史快照，别当成当前状态；当前版本看 `plugin/package.json`。
- `dist/` 里有会话 token（`dsh web:` 打印的 URL），**不要入库**。
