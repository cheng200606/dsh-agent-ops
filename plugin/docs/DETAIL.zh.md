# Agent Ops 运行台

把「谁批准了什么、什么被拦下了」变成一条可读的时间线。

## 它做什么

DSH 的审批流本来就在会话日志里留下了 `approval/asked` 与 `approval/decided` 两条事件，
只是没人把它们排成一行给你看。本插件把这两条事件、加上围栏自己的拦截记录，
折叠成一份只读的审计视图，挂在左侧栏的「运行台」页上。

三件事：

1. **审计时间线**：每次审批请求一行，包含时间、工具名、原因、最终结论
   （放行一次 / 拒绝 / 取消 / 无人应答）。没等人来决定的记作「待决定」。
2. **围栏**：对七类高风险动作（删除或覆盖数据、修改权限、变更生产环境、发布内容、
   发消息或邀请、购买与转账、接受法律条款）按风险分级处理。
   - `critical` 档直接硬拦，模型看到的是 `Error: blocked by fence: <规则> (<说明>)`；
   - `high` 档走审批，弹原生审批卡片。
3. **执行环境**：顶部显示当前会话的沙箱模式、审批策略、权限预设，
   数据来自会话日志里的 `sandbox/mode`、`approval/policy`、`permission/preset` 事件。

## 它不做什么

- **不代为作答审批**。插件在 `approval/request` waterfall 上只观察，永远 `next()` 透传。
  审批卡片的作答权完全留在宿主与人类手里。
- **不改写任何工具结果**。拦住的动作只是拒绝执行，不改参数、不伪造返回。
- **不新建存储**。审计数据是会话日志的纯函数投影；进程内只保留一个不落盘的飞行索引。
- **不写模型上下文**。没有任何注入给模型的内容。

## 配置

插件配置（profile 的 `cordis.patch.yml` 里覆写 `agent-ops` 行的 `config`）：

```yaml
- id: agent-ops
  config:
    policy:
      enabled: true          # false = 完全关闭围栏（审计仍然工作）
      mode: enforce          # enforce | observe（observe 只记录不拦，适合先观察几天）
      askRisk: high          # 达到该风险等级走审批：high | critical | null（关）
      denyRisk: critical     # 达到该风险等级直接拦：critical | high | null（关）
      categories: null       # null = 全部七类；也可写 [destructive, payment]
      exemptRules: []        # 豁免具体规则 id（critical 永不豁免）
```

默认值：`enabled: true, mode: enforce, askRisk: high, denyRisk: critical`。

## 读法

- 计数器的 `审批请求` 与 `放行`/`拒绝` 是同一批事件的两端：`asked` 每来一条 +1，
  `decided` 落到 `allowed-once` 时 `放行` +1，其余三值（rejected / cancelled / unavailable）
  一律计入 `拒绝`——「没人应答」在语义上就是没被批准。
- `围栏拦截` 来自工具结果的 `error.code === 'AGENT_OPS_FENCED'`，是实际发生的拒绝，
  与审批链无关，所以单列。

## 已知边界

- 会话状态最多保留最近 1000 条审计条目，视图取最近 500 条。
- 子代理的审批策略恒为 `never`，所以子代理里凡是需要审批的动作都会直接变成拒绝，
  时间线上表现为 `无人应答`。这是宿主的设计，不是本插件的行为。
