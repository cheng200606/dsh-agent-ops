/**
 * client.js — @local/dsh-agent-ops 的浏览器半
 *
 * 形态说明（与官方 client bundle 等价，但零构建）：
 *   宿主通过 <script> 加载本文件，文件执行时只做一件事——把 factory 注册进
 *   window.__ModuleLoader__。真正的副作用（CSS 注入、slot 注册）全部发生在
 *   factory 闭包内，等到宿主物化这个模块时才跑。
 *
 * 依赖：只 require('react')。PLATFORM_MODULES 的静态种子里有 react，
 *       所以不需要 dsh.client.external，也不需要安装期构建。
 *
 * 落点（M1 + M2）：
 *   1. sidebar.panellist（root）  —— 左侧栏一行导航「运行台」
 *   2. main（keyed 'agent-ops'） —— 与上面 id 同名的主面板（layout.selectPanel 要求两者一致）
 *   3. conversation.session.header.actions（session）—— 会话标题右侧的徽标按钮，数字 = 待处理审批数
 *   4. sidebar.right.pane.tab（keyed = 包名）—— 右侧栏 ops tab 的正文（三个纵切页）
 *   5. sidebarRightTabs.register      —— 上面那个 tab 的类型（kind 'ops'）
 *
 * 读取面：不走 HTTP、不走 Typert Remote。投影由宿主自动 wire 给浏览器：
 *   - 右侧栏 tab 与会话头部动作都有标准 props 的 useProjection（session 作用域）；
 *   - 左侧栏 panellist 是 root 作用域，没有 useProjection，只能走
 *     ctx.sessions.binding(id).session.projections.faceOf('ops.audit')。
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-agent-ops',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* AUTO-GENERATED:RULES_BEGIN */
    // 本块由 scripts/embed-rules.mjs 从 lib/rules/classify.js 生成，请勿手改。
    // 唯一真源是 classify.js：改规则改那里，然后重新打包（npm pack 会自动重生成）。
    const RULES_TABLE = [
      {
        "id": "disk-format",
        "category": "destructive",
        "risk": "critical",
        "scope": "shell",
        "pattern": "\\b(mkfs(\\.\\w+)?|format\\s+[a-z]:|format-volume|clear-disk|initialize-disk|diskpart|fdisk|wipefs)\\b",
        "flags": "",
        "note": {
          "zh": "格式化或重写磁盘分区",
          "en": "Format or rewrite a disk partition"
        }
      },
      {
        "id": "disk-raw-write",
        "category": "destructive",
        "risk": "critical",
        "scope": "shell",
        "pattern": "\\bdd\\s+[^|]*of=\\/dev\\/",
        "flags": "",
        "note": {
          "zh": "向块设备直接写入",
          "en": "Write directly to a block device"
        }
      },
      {
        "id": "rm-root",
        "category": "destructive",
        "risk": "critical",
        "scope": "shell",
        "pattern": "\\brm\\s+(-[a-z]*[rf][a-z]*\\s+)+(-[a-z]*\\s+)*(\\/|~|\\$home|\\.\\.?\\/?$|[a-z]:\\\\)",
        "flags": "",
        "note": {
          "zh": "递归删除根目录或用户目录",
          "en": "Recursively delete a root or home directory"
        }
      },
      {
        "id": "remove-item-recursive-force",
        "category": "destructive",
        "risk": "critical",
        "scope": "shell",
        "pattern": "remove-item[^\\n]*(-recurse|-r\\b)[^\\n]*(-force|-f\\b)",
        "flags": "",
        "note": {
          "zh": "PowerShell 递归强制删除",
          "en": "PowerShell recursive forced delete"
        }
      },
      {
        "id": "sql-drop",
        "category": "destructive",
        "risk": "critical",
        "scope": "both",
        "pattern": "\\bdrop\\s+(table|database|schema|index|view)\\b",
        "flags": "",
        "note": {
          "zh": "删除数据库对象",
          "en": "Drop a database object"
        }
      },
      {
        "id": "sql-truncate",
        "category": "destructive",
        "risk": "critical",
        "scope": "both",
        "pattern": "\\btruncate\\s+(table\\s+)?[\"`\\[]?[\\w.]+",
        "flags": "",
        "note": {
          "zh": "清空数据表",
          "en": "Truncate a table"
        }
      },
      {
        "id": "privilege-escalation",
        "category": "permission",
        "risk": "critical",
        "scope": "shell",
        "pattern": "^\\s*(sudo|doas|runas|su\\s+-)\\b",
        "flags": "",
        "note": {
          "zh": "提权执行",
          "en": "Execute with elevated privileges"
        }
      },
      {
        "id": "k8s-mutate-prod",
        "category": "production",
        "risk": "critical",
        "scope": "shell",
        "pattern": "\\bkubectl\\s+(delete|apply|replace|scale|rollout\\s+(undo|restart|status)?)\\b",
        "flags": "",
        "note": {
          "zh": "对 Kubernetes 集群做写操作",
          "en": "Mutate a Kubernetes cluster"
        }
      },
      {
        "id": "terraform-apply-destroy",
        "category": "production",
        "risk": "critical",
        "scope": "shell",
        "pattern": "\\bterraform\\s+(apply|destroy)\\b",
        "flags": "",
        "note": {
          "zh": "对基础设施执行 plan 或 destroy",
          "en": "Apply or destroy infrastructure"
        }
      },
      {
        "id": "package-publish",
        "category": "publishing",
        "risk": "critical",
        "scope": "shell",
        "pattern": "\\b(npm|pnpm|yarn|bun)\\s+publish\\b",
        "flags": "",
        "note": {
          "zh": "向包仓库发布版本",
          "en": "Publish a package to a registry"
        }
      },
      {
        "id": "payment-tool",
        "category": "payment",
        "risk": "critical",
        "scope": "tool",
        "pattern": "(purchase|checkout|pay[_-]?(order|invoice|now)|transfer[_-]?funds|stripe[_-]?charge)",
        "flags": "",
        "note": {
          "zh": "完成一笔购买或转账",
          "en": "Complete a purchase or transfer"
        }
      },
      {
        "id": "rm-wildcard-recursive",
        "category": "destructive",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\brm\\s+(-[a-z]*[rf][a-z]*\\s+)+[^|;&]*\\*",
        "flags": "",
        "note": {
          "zh": "递归删除通配符匹配的文件",
          "en": "Recursively delete wildcard-matched files"
        }
      },
      {
        "id": "sql-delete-all",
        "category": "destructive",
        "risk": "high",
        "scope": "both",
        "pattern": "\\bdelete\\s+from\\s+[\\w.\"]+\\s*(;|$)",
        "flags": "",
        "note": {
          "zh": "不带 WHERE 的全表删除",
          "en": "DELETE without a WHERE clause"
        }
      },
      {
        "id": "git-history-rewrite",
        "category": "destructive",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\bgit\\s+(filter-branch|reset\\s+--hard|clean\\s+-[a-z]*[fd])",
        "flags": "",
        "note": {
          "zh": "重写或丢弃本地提交历史",
          "en": "Rewrite or discard local history"
        }
      },
      {
        "id": "git-force-push",
        "category": "destructive",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\bgit\\s+push\\b[^\\n]*(--force\\b|-f\\b)",
        "flags": "",
        "note": {
          "zh": "强制推送覆盖远端历史",
          "en": "Force-push over remote history"
        }
      },
      {
        "id": "registry-delete",
        "category": "destructive",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\breg(\\.exe)?\\s+delete\\b",
        "flags": "",
        "note": {
          "zh": "删除注册表键",
          "en": "Delete a registry key"
        }
      },
      {
        "id": "chmod-world-writable",
        "category": "permission",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\bchmod\\s+(-[a-z]+\\s+)*(777|666|a\\+w)\\b",
        "flags": "",
        "note": {
          "zh": "把文件权限放开到所有人可写",
          "en": "Make a file world-writable"
        }
      },
      {
        "id": "ipc-permission-change",
        "category": "permission",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\b(chown|chgrp|icacls|takeown|set-acl)\\b",
        "flags": "",
        "note": {
          "zh": "变更文件所有者或 ACL",
          "en": "Change ownership or ACLs"
        }
      },
      {
        "id": "execution-policy-weaken",
        "category": "permission",
        "risk": "high",
        "scope": "shell",
        "pattern": "set-executionpolicy\\s+(bypass|unrestricted)",
        "flags": "",
        "note": {
          "zh": "关闭 PowerShell 脚本执行策略限制",
          "en": "Weaken the PowerShell execution policy"
        }
      },
      {
        "id": "container-forced-removal",
        "category": "production",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\bdocker\\s+(rm\\s+-f|system\\s+prune|volume\\s+rm|network\\s+rm)\\b",
        "flags": "",
        "note": {
          "zh": "强制删除容器或清理卷",
          "en": "Force-remove containers or prune volumes"
        }
      },
      {
        "id": "db-migration-run",
        "category": "production",
        "risk": "high",
        "scope": "shell",
        "pattern": "\\b(prisma\\s+migrate\\s+deploy|sequelize\\s+db:migrate|alembic\\s+upgrade|flyway\\s+migrate)\\b",
        "flags": "",
        "note": {
          "zh": "在目标库上执行迁移",
          "en": "Run database migrations"
        }
      },
      {
        "id": "release-publish",
        "category": "publishing",
        "risk": "high",
        "scope": "both",
        "pattern": "\\b(gh\\s+release\\s+create|twine\\s+upload|cargo\\s+publish|gem\\s+push)\\b",
        "flags": "",
        "note": {
          "zh": "创建对外发布",
          "en": "Create a public release"
        }
      },
      {
        "id": "deploy-command",
        "category": "publishing",
        "risk": "high",
        "scope": "both",
        "pattern": "\\b(vercel\\s+(deploy|--prod)|netlify\\s+deploy|firebase\\s+deploy|serverless\\s+deploy)\\b",
        "flags": "",
        "note": {
          "zh": "触发一次部署",
          "en": "Trigger a deployment"
        }
      },
      {
        "id": "send-message-tool",
        "category": "messaging",
        "risk": "high",
        "scope": "tool",
        "pattern": "(send[_-]?(email|mail|message|sms|dm)|invite[_-]?(user|member)|post[_-]?(message|comment))",
        "flags": "",
        "note": {
          "zh": "以你的身份对外发送消息或邀请",
          "en": "Send a message or invite as you"
        }
      },
      {
        "id": "accept-terms-tool",
        "category": "legal",
        "risk": "high",
        "scope": "tool",
        "pattern": "(accept[_-]?(terms|tos|eula|agreement)|sign[_-]?contract)",
        "flags": "",
        "note": {
          "zh": "代表你接受条款或签署协议",
          "en": "Accept terms or sign an agreement for you"
        }
      },
      {
        "id": "http-write-verb",
        "category": "messaging",
        "risk": "medium",
        "scope": "shell",
        "pattern": "\\bcurl\\b[^\\n]*(-x\\s*(post|put|delete)|--data|--request\\s+(post|put|delete))",
        "flags": "",
        "note": {
          "zh": "用 curl 发起写请求",
          "en": "Issue a write request with curl"
        }
      }
    ];
    /* AUTO-GENERATED:RULES_END */
    const NS = 'agentOps';
    const PKG = '@local/dsh-agent-ops';
    const PANEL_ID = 'agent-ops';
    const PROJECTION_KEY = 'ops.audit';
    const CHAT_KEY = 'ops.chat';
    const BOTS_KEY = 'ops.bots';
    /** v1.1 收尾：配置面（规则表 / 策略 / 连接器 / 用户规则）与主动感知候选。 */
    const CONFIG_KEY = 'ops.config';
    const TRIGGERS_KEY = 'ops.triggers';
    /** 裁决与忽略走的命令（与 Host 半 ops-commands.js 的命令名一致）。 */
    const ADJUDICATE_COMMAND_LINE = '/ops-adjudicate ';
    const IGNORE_COMMAND_LINE = '/ops-ignore ';
    /** 配置面（规则表 / 策略 / 连接器）的兜底通道。 */
    const CONFIG_COMMAND_LINE = '/ops-config';
    /** 群聊发话命令的调用前缀，必须与 Host 半 team-units.js 的 CHAT_COMMAND_NAME 一致。 */
    const CHAT_COMMAND_LINE = '/ops-say ';
    const OPS_KIND = 'ops';
    const BADGE_ID = 'agent-ops-badge';

    // ── 文案（扁平字典：宿主 locale 的 bind() 只做直接属性查表，不支持点号路径）──
    const zh = {
      panel: '运行台',
      tabTitle: '运行台',
      title: 'Agent Ops 运行台',
      subtitle: '审批与围栏的只读审计面',
      empty: '本会话还没有审批或围栏记录。',
      emptyInbox: '本会话还没有审批记录。',
      emptyTimeline: '本会话还没有审计记录。',
      loading: '读取中…',
      unsupported: '当前 DSH 版本未提供会话投影读取能力，运行台降级为只读空态。',
      noSession: '还没有打开任何会话。',
      filterAll: '全部',
      filterApproval: '审批',
      filterFence: '围栏',
      navInbox: '收件箱',
      navTimeline: '时间线',
      navEnv: '执行环境',
      inboxTitle: '审批收件箱',
      inboxSub: '本会话的审批请求与围栏拦截，只读',
      timelineTitle: '审计时间线',
      timelineSub: '授权 → 动作 → 结果，按时间正序',
      envTitle: '执行环境',
      envSub: '本次会话的权限边界，只读',
      asked: '审批请求',
      allowed: '放行',
      denied: '拒绝',
      blocked: '围栏拦截',
      sandbox: '沙箱',
      approval: '审批策略',
      preset: '权限预设',
      notReported: '未上报',
      colTime: '时间',
      colEvent: '事件',
      colTool: '工具',
      colOutcome: '结果',
      colReason: '原因',
      colRisk: '风险',
      colDecider: '决策人',
      kindApproval: '审批',
      kindFence: '围栏',
      kindReview: '自动拒绝',
      reviewerAuto: 'Auto review 裁判',
      reviewed: '自动拒绝',
      statusPending: '待处理',
      statusAllowed: '已批准',
      statusDenied: '已拒绝',
      deciderNote: '审批结论进日志，决策人未进日志——approval/decided 只记录 outcome，所以这里不臆测。',
      segAuth: '授权',
      segAction: '动作',
      segResult: '结果',
      waited: '等待 ',
      outcomeAllowedOnce: '放行一次',
      outcomeRejected: '拒绝',
      outcomeCancelled: '取消',
      outcomeUnavailable: '无人应答',
      outcomePending: '待决定',
      outcomeBlocked: '已拦截',
      outcomeReviewed: '被 Auto review 拒绝',
      riskCritical: '高危',
      riskHigh: '中危',
      riskMedium: '低危',
      catDestructive: '删除或覆盖数据',
      catPermission: '修改权限',
      catProduction: '变更生产环境',
      catPublishing: '发布内容',
      catMessaging: '发消息或邀请',
      catPayment: '购买或转账',
      catLegal: '接受法律条款',
      envSandboxHint: '沙箱模式决定文件可写范围与网络边界，由宿主按会话维护。',
      envApprovalHint: '审批策略 ask 时高危动作会弹审批卡；never 时一律拒绝。',
      envPresetHint: '权限预设是沙箱模式 + 审批策略的组合命名。',
      envChangeHint: '改这两项请用官方 /permission 入口，运行台不提供第二个权限入口。',
      envUnset: '本次会话尚未上报',
      badgeAria: '打开 Agent Ops 运行台',
      badgeTitle: '待处理审批',
      badgeIdle: '无待处理审批',
      truncated: '（状态仅保留最近 {n} 条）',
      navRules: '规则表',
      rulesTitle: '高危动作规则表',
      rulesSub: '只要命中就按风险等级提问或拦截，共 {n} 条',
      rulesPolicy: '生效策略',
      rulesPolicyAsk: '达到该等级提问',
      rulesPolicyDeny: '达到该等级硬拦',
      rulesPolicyMode: '运行方式',
      rulesModeEnforce: '拦截生效',
      rulesModeObserve: '只观察不拦',
      rulesHit: '本会话命中 {n} 次',
      rulesNone: '从不',
      rulesGroupCritical: '高危 · 硬拦',
      rulesGroupHigh: '中危 · 提问',
      rulesGroupMedium: '低危 · 记录',
      exportMd: '导出 Markdown',
      exportDone: '已导出',
      exportEmpty: '本会话还没有可导出的审计记录。',
      toastTitle: '有新的审批请求',
      toastBody: '运行台已记录，点此查看',
      toastClose: '关闭',
      navTeam: '团队',
      navChat: '群聊',
      teamTitle: '团队名册',
      teamSub: '本会话的 Bot 角色与主 Bot 标记，来自会话日志折叠',
      teamEmpty: '还没有登记任何 Bot。用 /ops-bot <名字> <角色> [--main] 登记一个。',
      teamRole: '角色',
      teamMain: '主 Bot',
      teamMainNone: '未指定主 Bot',
      teamHint: '名册是声明而不是权限：角色能力由 agent preset 决定，这里只做索引。',
      teamEscTitle: '升级工单',
      teamEscEmpty: '还没有升级工单。子代理命中高危动作时会在这里生成一张。',
      teamEscPending: '待处理',
      teamEscApproved: '已批准',
      teamEscRejected: '已拒绝',
      chatTitle: '群聊',
      chatSub: '与 Bot 团队的协作流；@名字 指定收件人，不写则发给全员',
      chatEmpty: '群聊还是空的。在下面说第一句，或用输入框发送 /ops-say 内容。',
      chatPlaceholder: '说点什么，@名字 指定收件人…',
      chatSend: '发送',
      chatSending: '发送中…',
      chatSent: '已发送',
      chatFailed: '发送失败：',
      chatNeedSession: '先打开一个会话再说话。',
      chatAll: '全员',
      chatFrom: '来自',
      chatCounters: '消息 {n}',
      chatNoCommand: '宿主未提供命令通道，群聊只能查看不能发言。',
      envConnectors: '连接器',
      envNoConnectors: '当前没有已配置的 MCP 连接器。',
      // ── v1.1 收尾：规则表编辑 / 建议 / 裁决 ────────────────────
      rulesUserTitle: '我的规则',
      rulesUserSub: '你自己的约定：命中就问，或命中就不问。最多 {n} 条。',
      rulesUserEmpty: '还没有自定义规则。用 /ops-rule add <id> <ask|allow> <片段> 添加。',
      rulesUserAsk: '命中就问',
      rulesUserAllow: '命中不问',
      rulesUserTool: '限定工具',
      rulesUserCount: '共 {n} 条',
      rulesHitAt: '最后命中 {t}',
      catCustom: '自定义规则',
      navSuggest: '建议',
      suggestTitle: '主动建议',
      suggestSub: '从目标、待办、上下文里折出来的候选；只会提醒，不会替你决定。',
      suggestEmpty: '现在没有值得打断你的事。',
      suggestLevel: '打扰级别',
      suggestL0: '静默',
      suggestL1: '通知条',
      suggestL2: '唤醒主 Bot',
      suggestIgnore: '忽略这一类',
      suggestIgnored: '已忽略',
      suggestKindGoal: '目标',
      suggestKindTodo: '待办',
      suggestKindWorkspace: '工作区改动',
      suggestKindTeamTask: '团队任务',
      suggestKindDeliverable: '交付物',
      suggestCount: '候选 {n} 条',
      suggestNoCommand: '宿主未提供命令通道，建议只能查看不能忽略。',
      escApprove: '批准',
      escReject: '拒绝',
      escAdjudicateOff: '裁决通道未打开（escalation.adjudicate = false）',
      escCannot: '这张工单不可裁决。',
      roleTitle: '开箱角色',
      roleSub: '八个角色包：preset 决定人设与工具白名单，用 subagent 的 agent_preset 选择。',
      rolePreset: '角色包',
      roleSkill: '岗位手册',
    };
    const en = {
      panel: 'Ops',
      tabTitle: 'Ops',
      title: 'Agent Ops Console',
      subtitle: 'A read-only audit surface for approvals and fences',
      empty: 'No approval or fence records in this session yet.',
      emptyInbox: 'No approval requests in this session yet.',
      emptyTimeline: 'No audit records in this session yet.',
      loading: 'Loading…',
      unsupported: 'This DSH build does not expose session projections; the console is degraded to an empty read-only state.',
      noSession: 'No session is open yet.',
      filterAll: 'All',
      filterApproval: 'Approvals',
      filterFence: 'Fences',
      navInbox: 'Inbox',
      navTimeline: 'Timeline',
      navEnv: 'Runtime',
      inboxTitle: 'Approval inbox',
      inboxSub: 'Approval requests and fence hits in this session, read-only',
      timelineTitle: 'Audit timeline',
      timelineSub: 'Authorization, action, result, in time order',
      envTitle: 'Runtime environment',
      envSub: 'The permission boundary of this session, read-only',
      asked: 'Asked',
      allowed: 'Allowed',
      denied: 'Denied',
      blocked: 'Fenced',
      sandbox: 'Sandbox',
      approval: 'Approval',
      preset: 'Preset',
      notReported: 'not reported',
      colTime: 'Time',
      colEvent: 'Event',
      colTool: 'Tool',
      colOutcome: 'Outcome',
      colReason: 'Reason',
      colRisk: 'Risk',
      colDecider: 'Decider',
      kindApproval: 'Approval',
      kindFence: 'Fence',
      kindReview: 'Auto review',
      reviewerAuto: 'Auto review judge',
      reviewed: 'Auto review',
      statusPending: 'pending',
      statusAllowed: 'allowed',
      statusDenied: 'denied',
      deciderNote: 'The decision is logged, the decider is not: approval/decided records only the outcome, so this column stays empty rather than guessing.',
      segAuth: 'Auth',
      segAction: 'Action',
      segResult: 'Result',
      waited: 'waited ',
      outcomeAllowedOnce: 'allowed once',
      outcomeRejected: 'rejected',
      outcomeCancelled: 'cancelled',
      outcomeUnavailable: 'unavailable',
      outcomePending: 'pending',
      outcomeBlocked: 'blocked',
      outcomeReviewed: 'Rejected by Auto review',
      riskCritical: 'critical',
      riskHigh: 'high',
      riskMedium: 'medium',
      catDestructive: 'destroy data',
      catPermission: 'change permissions',
      catProduction: 'change production',
      catPublishing: 'publish',
      catMessaging: 'send messages',
      catPayment: 'pay',
      catLegal: 'accept terms',
      envSandboxHint: 'The sandbox mode bounds writable paths and network access; the host keeps it per session.',
      envApprovalHint: 'Under ask, risky calls raise an approval card; under never they are rejected outright.',
      envPresetHint: 'A preset is a named pairing of sandbox mode and approval policy.',
      envChangeHint: 'Change these through the official /permission entry point; the console deliberately adds no second permission knob.',
      envUnset: 'not reported in this session',
      badgeAria: 'Open the Agent Ops console',
      badgeTitle: 'Pending approvals',
      badgeIdle: 'No pending approvals',
      truncated: '(state keeps the last {n} entries)',
      navRules: 'Rules',
      rulesTitle: 'Risky-action rules',
      rulesSub: 'Each rule asks or blocks by risk level; {n} rules in total',
      rulesPolicy: 'Effective policy',
      rulesPolicyAsk: 'Ask at or above',
      rulesPolicyDeny: 'Hard-block at or above',
      rulesPolicyMode: 'Mode',
      rulesModeEnforce: 'enforcing',
      rulesModeObserve: 'observing only',
      rulesHit: 'hit {n} times in this session',
      rulesNone: 'never',
      rulesGroupCritical: 'critical · blocked',
      rulesGroupHigh: 'high · asked',
      rulesGroupMedium: 'medium · recorded',
      exportMd: 'Export Markdown',
      exportDone: 'Exported',
      exportEmpty: 'No audit records to export in this session yet.',
      toastTitle: 'New approval request',
      toastBody: 'The console recorded it; click to open',
      toastClose: 'Dismiss',
      navTeam: 'Team',
      navChat: 'Chat',
      teamTitle: 'Team roster',
      teamSub: 'Bot roles and the primary-Bot mark, folded from the session log',
      teamEmpty: 'No Bot registered yet. Run /ops-bot <name> <role> [--main] to add one.',
      teamRole: 'Role',
      teamMain: 'Primary Bot',
      teamMainNone: 'No primary Bot',
      teamHint: 'The roster is a declaration, not a permission: capabilities come from the agent preset.',
      teamEscTitle: 'Escalations',
      teamEscEmpty: 'No escalation yet. One appears here when a subagent hits a high-risk action.',
      teamEscPending: 'pending',
      teamEscApproved: 'approved',
      teamEscRejected: 'rejected',
      chatTitle: 'Group chat',
      chatSub: 'The team collaboration stream; @name addresses one recipient, otherwise everyone',
      chatEmpty: 'No messages yet. Say the first one below, or send /ops-say from the composer.',
      chatPlaceholder: 'Say something, @name to address one Bot…',
      chatSend: 'Send',
      chatSending: 'Sending…',
      chatSent: 'Sent',
      chatFailed: 'Send failed: ',
      chatNeedSession: 'Open a session before speaking.',
      chatAll: 'everyone',
      chatFrom: 'from',
      chatCounters: '{n} messages',
      chatNoCommand: 'The host exposes no command channel; chat is read-only.',
      envConnectors: 'Connectors',
      envNoConnectors: 'No MCP connector is configured.',
      // ── v1.1 tail: rule table editing / suggestions / adjudication ──
      rulesUserTitle: 'My rules',
      rulesUserSub: 'Your own conventions: ask on a match, or do not ask. Up to {n} entries.',
      rulesUserEmpty: 'No custom rules yet. Run /ops-rule add <id> <ask|allow> <fragment>.',
      rulesUserAsk: 'Ask on match',
      rulesUserAllow: 'Do not ask',
      rulesUserTool: 'tool',
      rulesUserCount: '{n} rules',
      rulesHitAt: 'last hit {t}',
      catCustom: 'Custom rule',
      navSuggest: 'Suggestions',
      suggestTitle: 'Proactive suggestions',
      suggestSub: 'Candidates folded from goals, todos and context. They notify; they never decide for you.',
      suggestEmpty: 'Nothing worth interrupting you for right now.',
      suggestLevel: 'Interruption level',
      suggestL0: 'silent',
      suggestL1: 'toast',
      suggestL2: 'wake the lead',
      suggestIgnore: 'Ignore this kind',
      suggestIgnored: 'ignored',
      suggestKindGoal: 'goal',
      suggestKindTodo: 'todo',
      suggestKindWorkspace: 'workspace changes',
      suggestKindTeamTask: 'team task',
      suggestKindDeliverable: 'deliverable',
      suggestCount: '{n} candidates',
      suggestNoCommand: 'The host exposes no command channel; suggestions are read-only.',
      escApprove: 'Approve',
      escReject: 'Reject',
      escAdjudicateOff: 'Adjudication is off (escalation.adjudicate = false)',
      escCannot: 'This escalation cannot be adjudicated.',
      roleTitle: 'Ready-made roles',
      roleSub: 'Eight role packs: the preset fixes persona and tool allowlist; pick one with the subagent agent_preset argument.',
      rolePreset: 'role pack',
      roleSkill: 'handbook',
    };

    // ── 样式（只用宿主 token，跟随主题与深浅色）──────────────────────
    const CSS = [
      '.ao-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,#111);font-family:var(--dsw-font-family,inherit);}',
      '.ao-head{padding:12px 14px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));}',
      '.ao-title{font-size:15px;font-weight:600;line-height:22px;margin:0;}',
      '.ao-sub{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#888);}',
      '.ao-counters{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}',
      '.ao-pill{display:inline-flex;align-items:baseline;gap:5px;padding:3px 9px;border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.04));font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#555);}',
      '.ao-pill b{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#111);font-variant-numeric:tabular-nums;}',
      '.ao-pill.is-allowed b{color:var(--dsw-alias-state-success-primary,#12805c);}',
      '.ao-pill.is-denied b{color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-pill.is-blocked b{color:var(--dsw-alias-state-warning-primary,#b26a00);}',
      '.ao-pill.is-review b{color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-env{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#888);}',
      '.ao-env i{font-style:normal;color:var(--dsw-alias-label-secondary,#555);}',
      '.ao-ws{display:flex;flex:1;min-height:0;}',
      '.ao-nav{width:96px;flex:none;display:flex;flex-direction:column;gap:2px;padding:10px 6px;border-right:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));}',
      '.ao-navitem{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#555);font:inherit;font-size:12px;line-height:18px;text-align:left;padding:6px 8px;border-radius:var(--dsw-radius-sm,6px);cursor:pointer;}',
      '.ao-navitem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));}',
      '.ao-navitem[aria-selected="true"]{background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.07));color:var(--dsw-alias-label-primary,#111);font-weight:600;}',
      '.ao-content{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;}',
      '.ao-page{flex:1;min-height:0;overflow:auto;padding:12px 14px 28px;}',
      '.ao-h2{font-size:13px;line-height:20px;font-weight:600;margin:0;}',
      '.ao-h2sub{margin:2px 0 10px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#888);}',
      '.ao-card{position:relative;padding:8px 10px;margin-bottom:6px;border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.03));border-left:2px solid transparent;}',
      '.ao-card.is-pending{border-left-color:var(--dsw-alias-state-business-primary,#2f6fe4);}',
      '.ao-card.is-ok{border-left-color:var(--dsw-alias-state-success-primary,#12805c);}',
      '.ao-card.is-bad{border-left-color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-card.is-warn{border-left-color:var(--dsw-alias-state-warning-primary,#b26a00);}',
      '.ao-cardtop{display:flex;align-items:baseline;gap:8px;}',
      '.ao-cardname{font-size:12px;line-height:18px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.ao-cardtime{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999);font-variant-numeric:tabular-nums;flex:none;}',
      '.ao-cardline{margin-top:2px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.ao-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;}',
      '.ao-chip{font-size:10px;line-height:15px;padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05));color:var(--dsw-alias-label-secondary,#666);white-space:nowrap;}',
      '.ao-chip.is-critical{background:var(--dsw-alias-state-error-tertiary,rgba(198,40,40,.12));color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-chip.is-high{background:var(--dsw-alias-state-warn-tertiary,rgba(226,140,0,.16));color:var(--dsw-alias-state-warn-primary,#a56200);}',
      '.ao-chip.is-ok{background:var(--dsw-alias-state-success-tertiary,rgba(18,128,92,.12));color:var(--dsw-alias-state-success-primary,#12805c);}',
      '.ao-seg{display:grid;grid-template-columns:52px 1fr;gap:6px;font-size:11px;line-height:16px;padding:2px 0;}',
      '.ao-seglabel{color:var(--dsw-alias-label-caption,#aaa);}',
      '.ao-segtext{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#555);}',
      '.ao-segtext.is-strong{color:var(--dsw-alias-label-primary,#111);font-weight:600;}',
      '.ao-kv{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));}',
      '.ao-kv:last-child{border-bottom:0;}',
      '.ao-kvkey{width:76px;flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#555);}',
      '.ao-kvval{min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#111);}',
      '.ao-kvhint{margin-top:2px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999);white-space:normal;}',
      '.ao-mono{font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace);}',
      '.ao-out{font-size:11px;line-height:16px;font-weight:600;white-space:nowrap;flex:none;}',
      '.ao-out.is-ok{color:var(--dsw-alias-state-success-primary,#12805c);}',
      '.ao-out.is-bad{color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-out.is-idle{color:var(--dsw-alias-state-idle-primary,#8a8a8a);}',
      '.ao-empty.is-compact{min-height:0;padding:24px 8px;justify-content:flex-start;}',
      '.ao-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;min-height:120px;padding:36px 18px;text-align:center;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;line-height:20px;}',
      '.ao-note{margin:10px 0 0;font-size:10px;line-height:15px;color:var(--dsw-alias-label-caption,#aaa);}',
      '.ao-icon{display:inline-flex;align-items:center;justify-content:center;color:inherit;}',
      '.ao-badge{appearance:none;display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 6px;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary,#555);font:inherit;font-size:11px;line-height:16px;cursor:pointer;font-variant-numeric:tabular-nums;}',
      '.ao-badge:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#111);}',
      '.ao-badge.is-live{color:var(--dsw-alias-state-business-primary,#2f6fe4);}',
      '.ao-badge b{font-weight:600;}',
      '.ao-toolbar{display:flex;align-items:center;gap:8px;margin-left:auto;}',
      '.ao-headrow{display:flex;align-items:flex-start;gap:8px;}',
      '.ao-act{appearance:none;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));background:transparent;color:var(--dsw-alias-label-secondary,#555);font:inherit;font-size:11px;line-height:16px;padding:3px 8px;border-radius:var(--dsw-radius-sm,6px);cursor:pointer;white-space:nowrap;}',
      '.ao-act:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111);}',
      '.ao-act:disabled{opacity:.45;cursor:default;}',
      '.ao-rule{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:7px 10px;margin-bottom:5px;border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.03));border-left:2px solid transparent;}',
      '.ao-rule.is-critical{border-left-color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-rule.is-high{border-left-color:var(--dsw-alias-state-warning-primary,#b26a00);}',
      '.ao-rule.is-medium{border-left-color:var(--dsw-alias-border-l2,rgba(0,0,0,.15));}',
      '.ao-ruleid{font-size:11px;line-height:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.ao-rulenote{grid-column:1/2;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999);}',
      '.ao-ruletag{font-size:10px;line-height:15px;padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05));color:var(--dsw-alias-label-secondary,#666);white-space:nowrap;}',
      '.ao-ruletag.is-critical{background:var(--dsw-alias-state-error-tertiary,rgba(198,40,40,.12));color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-ruletag.is-high{background:var(--dsw-alias-state-warn-tertiary,rgba(226,140,0,.16));color:var(--dsw-alias-state-warn-primary,#a56200);}',
      '.ao-ruletag.is-hit{background:var(--dsw-alias-state-business-tertiary,rgba(47,111,228,.14));color:var(--dsw-alias-state-business-primary,#2f6fe4);}',
      '.ao-grouphd{margin:12px 0 6px;font-size:11px;line-height:16px;font-weight:600;color:var(--dsw-alias-label-secondary,#555);}',
      '.ao-grouphd:first-child{margin-top:0;}',
      '.ao-toaster{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;flex-direction:column;gap:8px;pointer-events:none;}',
      '.ao-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:8px;max-width:320px;padding:9px 11px;border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-3,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));box-shadow:0 6px 20px rgba(0,0,0,.16);cursor:pointer;text-align:left;font:inherit;}',
      '.ao-toastbody{min-width:0;}',
      '.ao-toasttitle{font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary,#111);}',
      '.ao-toasttext{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999);}',
      '.ao-toastx{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#999);font:inherit;font-size:13px;line-height:1;padding:2px 4px;cursor:pointer;border-radius:var(--dsw-radius-sm,6px);}',
      '.ao-toastx:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));}',
      // ── v1.1：团队名册 / 升级工单 / 群聊 ──────────────────────────
      '.ao-bot{display:flex;align-items:baseline;gap:8px;padding:8px 10px;margin-bottom:6px;border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.03));border-left:2px solid transparent;}',
      '.ao-bot.is-main{border-left-color:var(--dsw-alias-state-business-primary,#2f6fe4);}',
      '.ao-botname{font-size:12px;line-height:18px;font-weight:600;flex:none;font-family:var(--dsw-font-family-mono,ui-monospace,monospace);}',
      '.ao-botrole{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}',
      '.ao-botstar{font-size:10px;line-height:15px;padding:0 6px;border-radius:999px;background:var(--dsw-alias-state-business-tertiary,rgba(47,111,228,.14));color:var(--dsw-alias-state-business-primary,#2f6fe4);white-space:nowrap;flex:none;}',
      '.ao-esc{border-left-color:var(--dsw-alias-state-warning-primary,#b26a00);}',
      '.ao-esc.is-approved{border-left-color:var(--dsw-alias-state-success-primary,#12805c);}',
      '.ao-esc.is-rejected{border-left-color:var(--dsw-alias-state-error-primary,#c62828);}',
      '.ao-chat{display:flex;flex-direction:column;flex:1;min-height:0;}',
      '.ao-chatlist{flex:1;min-height:0;overflow:auto;padding:2px 0 10px;display:flex;flex-direction:column;gap:6px;}',
      '.ao-msg{display:flex;flex-direction:column;gap:1px;padding:6px 9px;border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.03));}',
      '.ao-msg.is-system{background:transparent;color:var(--dsw-alias-label-tertiary,#999);}',
      '.ao-msg.is-escalation{border-left:2px solid var(--dsw-alias-state-warning-primary,#b26a00);}',
      '.ao-msg.is-mine{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05));}',
      '.ao-msghead{display:flex;align-items:baseline;gap:6px;font-size:11px;line-height:16px;}',
      '.ao-msgfrom{font-weight:600;color:var(--dsw-alias-label-primary,#111);font-family:var(--dsw-font-family-mono,ui-monospace,monospace);}',
      '.ao-msgto{color:var(--dsw-alias-label-tertiary,#999);}',
      '.ao-msgtime{margin-left:auto;color:var(--dsw-alias-label-caption,#aaa);font-variant-numeric:tabular-nums;flex:none;}',
      '.ao-msgtext{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#111);word-break:break-word;}',
      '.ao-composer{flex:none;display:flex;gap:6px;align-items:flex-end;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));}',
      '.ao-input{flex:1;min-width:0;resize:none;min-height:34px;max-height:96px;padding:7px 9px;border-radius:var(--dsw-radius-sm,6px);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.9));color:var(--dsw-alias-label-primary,#111);font:inherit;font-size:12px;line-height:18px;}',
      '.ao-input:focus{outline:2px solid var(--dsw-alias-state-business-primary,#2f6fe4);outline-offset:-1px;}',
      '.ao-send{appearance:none;border:0;border-radius:var(--dsw-radius-sm,6px);padding:0 12px;height:34px;background:var(--dsw-alias-state-business-primary,#2f6fe4);color:#fff;font:inherit;font-size:12px;font-weight:600;cursor:pointer;}',
      '.ao-send:disabled{opacity:.5;cursor:default;}',
      '.ao-note{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999);padding:6px 0;}',
    ].join('\n');

    // ── 小工具 ────────────────────────────────────────────────
    function timeOf(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
      try {
        return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch (error) {
        return '';
      }
    }

    function durationOf(fromMs, toMs) {
      if (typeof fromMs !== 'number' || typeof toMs !== 'number') return '';
      const delta = toMs - fromMs;
      if (!Number.isFinite(delta) || delta < 0) return '';
      if (delta < 1000) return '0s';
      const seconds = Math.round(delta / 1000);
      if (seconds < 60) return String(seconds) + 's';
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      return String(minutes) + 'm ' + String(rest) + 's';
    }

    function fill(template, value) {
      return String(template).replace('{n}', String(value));
    }

    function labelOf(t, outcome) {
      if (outcome === 'allowed-once') return t('outcomeAllowedOnce');
      if (outcome === 'rejected') return t('outcomeRejected');
      if (outcome === 'cancelled') return t('outcomeCancelled');
      if (outcome === 'unavailable') return t('outcomeUnavailable');
      if (outcome === 'blocked') return t('outcomeBlocked');
      if (outcome === 'reviewed') return t('outcomeReviewed');
      return t('outcomePending');
    }

    function outcomeClass(outcome) {
      if (outcome === 'allowed-once') return 'ao-out is-ok';
      if (outcome === 'pending') return 'ao-out is-idle';
      return 'ao-out is-bad';
    }

    function cardClass(entry) {
      if (entry.kind === 'review') return 'ao-card is-bad';
      if (entry.kind === 'fence') return 'ao-card is-warn';
      if (entry.outcome === 'pending') return 'ao-card is-pending';
      if (entry.outcome === 'allowed-once') return 'ao-card is-ok';
      return 'ao-card is-bad';
    }

    function riskLabel(t, risk) {
      if (risk === 'critical') return t('riskCritical');
      if (risk === 'high') return t('riskHigh');
      if (risk === 'medium') return t('riskMedium');
      return risk || '';
    }

    function categoryLabel(t, category) {
      if (category === 'destructive') return t('catDestructive');
      if (category === 'permission') return t('catPermission');
      if (category === 'production') return t('catProduction');
      if (category === 'publishing') return t('catPublishing');
      if (category === 'messaging') return t('catMessaging');
      if (category === 'payment') return t('catPayment');
      if (category === 'legal') return t('catLegal');
      return category || '';
    }

    function entriesOf(view) {
      return view && Array.isArray(view.entries) ? view.entries : [];
    }

    function countersOf(view) {
      return (view && view.counters) || { asked: 0, allowed: 0, denied: 0, blocked: 0, reviewed: 0 };
    }

    function envOf(view) {
      return (view && view.env) || {};
    }

    function policyOf(view) {
      const fallback = { enabled: true, mode: 'enforce', askRisk: 'high', denyRisk: 'critical' };
      return (view && view.policy && typeof view.policy === 'object') ? view.policy : fallback;
    }

    /**
     * 审计导出（A2b）。把当前视图渲染成一段 Markdown 文本。
     * 为什么在客户端拼文本而不在 Host 侧生成文件：Host 侧要写文件就得碰沙箱策略，
     * 而导出物是「用户自己点出来的」——用浏览器下载通道最直接，也天然跟随用户
     * 的下载目录，不需要在 workspace 里留垃圾文件。
     */
    function toMarkdown(view, configView, t) {
      const counters = countersOf(view);
      const env = envOf(view);
      const policy = policyOf(configView);
      const entries = entriesOf(view);
      const lines = [];
      lines.push('# ' + t('title'));
      lines.push('');
      lines.push('- ' + t('asked') + ': ' + String(counters.asked));
      lines.push('- ' + t('allowed') + ': ' + String(counters.allowed));
      lines.push('- ' + t('denied') + ': ' + String(counters.denied));
      lines.push('- ' + t('blocked') + ': ' + String(counters.blocked));
      lines.push('');
      lines.push('| ' + [t('colTime'), t('colEvent'), t('colTool'), t('colRisk'), t('colOutcome'), t('colReason')].join(' | ') + ' |');
      lines.push('|' + ' --- |'.repeat(6));
      for (const entry of entries) {
        const isFence = entry.kind === 'fence';
        const row = [
          timeOf(entry.time),
          isFence ? t('kindFence') : t('kindApproval'),
          (isFence ? (entry.ruleId || '') : (entry.tool || '')).replace(/\|/g, '\\|'),
          isFence && entry.risk ? riskLabel(t, entry.risk) : '',
          labelOf(t, entry.outcome),
          String(isFence ? (entry.reason || '') : (entry.reason || '')).replace(/\|/g, '\\|'),
        ];
        lines.push('| ' + row.join(' | ') + ' |');
      }
      lines.push('');
      lines.push('## ' + t('rulesPolicy'));
      lines.push('');
      lines.push('- ' + t('rulesPolicyMode') + ': ' + (policy.mode === 'observe' ? t('rulesModeObserve') : t('rulesModeEnforce')));
      lines.push('- ' + t('rulesPolicyAsk') + ': ' + (policy.askRisk === null ? t('rulesNone') : policy.askRisk));
      lines.push('- ' + t('rulesPolicyDeny') + ': ' + (policy.denyRisk === null ? t('rulesNone') : policy.denyRisk));
      lines.push('');
      lines.push('- ' + t('sandbox') + ': ' + (env.sandbox || t('envUnset')));
      lines.push('- ' + t('approval') + ': ' + (env.approval || t('envUnset')));
      lines.push('- ' + t('preset') + ': ' + (env.preset || t('envUnset')));
      lines.push('');
      return lines.join('\n');
    }

    /** 触发浏览器下载；失败时静默（下载通道在某些 webview 里不存在，不该让整个面板崩）。 */
    function downloadMarkdown(text, filename) {
      try {
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (error) { /* ignore */ } }, 4000);
        return true;
      } catch (error) {
        return false;
      }
    }

    /** 规则说明是中英双语的（来自 Host 的规则表），按当前文档语言挑一个。 */
    function langOf() {
      try {
        const lang = document.documentElement.getAttribute('lang') || '';
        return lang.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
      } catch (error) {
        return 'en';
      }
    }

    /** 本会话里每条规则被围栏拦下的次数（按 ruleId 聚合）。 */
    function ruleHitsOf(view) {
      const hits = {};
      for (const entry of entriesOf(view)) {
        if (entry.kind !== 'fence') continue;
        const id = entry.ruleId || entry.reason || '';
        if (!id) continue;
        hits[id] = (hits[id] || 0) + 1;
      }
      return hits;
    }

    function countPending(view) {
      let total = 0;
      for (const entry of entriesOf(view)) if (entry.outcome === 'pending') total += 1;
      return total;
    }

    /** useProjection 缺席时的替身（DSH 版本过旧才可能发生，hook 顺序保持稳定）。 */
    function useNoProjection() {
      return undefined;
    }

    /** 标准 props 的 useProjection 可能缺席：统一包一层，避免条件调用 hook。 */
    function projectionReader(useProjection) {
      return typeof useProjection === 'function' ? useProjection : useNoProjection;
    }

    // ── v1.1：群聊与名册的读法 ──────────────────────────────────
    function messagesOf(view) {
      return view && Array.isArray(view.messages) ? view.messages : [];
    }

    function chatCountersOf(view) {
      const counters = view && view.counters ? view.counters : undefined;
      if (counters === undefined) return { messages: 0, system: 0, escalations: 0 };
      return {
        messages: typeof counters.messages === 'number' ? counters.messages : 0,
        system: typeof counters.system === 'number' ? counters.system : 0,
        escalations: typeof counters.escalations === 'number' ? counters.escalations : 0,
      };
    }

    function botsOf(view) {
      return view && Array.isArray(view.bots) ? view.bots : [];
    }

    function escalationsOf(view) {
      return view && Array.isArray(view.escalations) ? view.escalations : [];
    }

    function mainNameOf(view) {
      return view && typeof view.mainName === 'string' ? view.mainName : '';
    }

    /**
     * 内置规则表。
     *
     * 三个来源，按优先级：ops.config 投影 → 命令通道兜底 → **内嵌表**。
     * 内嵌表是打包时从 lib/rules/classify.js 生成的（scripts/embed-rules.mjs），
     * 因为投影与命令都要求会话「活着」，而规则表跟会话有没有活动无关。
     */
    function builtinRulesOf(view) {
      if (view && Array.isArray(view.rules) && view.rules.length > 0) return view.rules;
      return RULES_TABLE;
    }

    /**
     * 合并两个来源的配置面：投影优先，命令通道兜底。
     *
     * 为什么需要兜底：投影值只会在「会话被客户端订阅」或「会话已有事件」时到达。
     * 一个刚创建、还没跑过一轮的新会话里客户端拿不到任何投影，而规则表恰恰是
     * 用户打开面板第一眼要看的东西。
     */
    function mergeConfig(projection, fallback) {
      if (projection === undefined || projection === null) return fallback;
      if (fallback === undefined || fallback === null) return projection;
      return {
        rules: Array.isArray(projection.rules) && projection.rules.length > 0 ? projection.rules : fallback.rules,
        policy: projection.policy !== undefined && projection.policy !== null ? projection.policy : fallback.policy,
        connectors: Array.isArray(projection.connectors) ? projection.connectors : fallback.connectors,
        triggers: projection.triggers !== undefined && projection.triggers !== null ? projection.triggers : fallback.triggers,
        userRules: Array.isArray(projection.userRules) ? projection.userRules : (fallback.userRules ?? []),
        updatedAt: projection.updatedAt ?? fallback.updatedAt ?? 0,
      };
    }

    /** 用户规则表（ops.config 投影的 userRules）。 */
    function userRulesOf(view) {
      return view && Array.isArray(view.userRules) ? view.userRules : [];
    }

    /** 连接器清单（ops.config 投影）。 */
    function connectorsOf(view) {
      return view && Array.isArray(view.connectors) ? view.connectors : [];
    }

    /** 主动感知候选（ops.triggers 投影）。 */
    function candidatesOf(view) {
      return view && Array.isArray(view.candidates) ? view.candidates : [];
    }

    /** 规则命中计数（ops.audit 视图的 hits 表）。 */
    function hitsOf(view) {
      return view && view.hits && typeof view.hits === 'object' ? view.hits : {};
    }

    /** 候选类别的文案键。 */
    function suggestKindLabel(t, kind) {
      if (kind === 'goal') return t('suggestKindGoal');
      if (kind === 'todo') return t('suggestKindTodo');
      if (kind === 'workspace') return t('suggestKindWorkspace');
      if (kind === 'team-task') return t('suggestKindTeamTask');
      if (kind === 'deliverable') return t('suggestKindDeliverable');
      return kind || '';
    }

    /** 打扰级别的文案。 */
    function suggestLevelLabel(t, level) {
      if (level === 'L2') return t('suggestL2');
      if (level === 'L1') return t('suggestL1');
      return t('suggestL0');
    }

    function escStatusLabel(t, status) {
      if (status === 'approved') return t('teamEscApproved');
      if (status === 'rejected') return t('teamEscRejected');
      return t('teamEscPending');
    }
    // ── root 作用域的读法（panellist / main 没有 session 绑定）────────────
    /** 主会话 id：优先取被主视图 retain 的那个，否则退到最近的顶层会话。 */
    let stickySessionId;

    function pickSessionId(ctx) {
      let list;
      try {
        list = ctx.sessions && ctx.sessions.list ? ctx.sessions.list.getSnapshot() : undefined;
      } catch (error) {
        list = undefined;
      }
      if (!list || !list.byId) return undefined;
      const byId = list.byId;
      if (stickySessionId !== undefined && byId[stickySessionId] !== undefined) return stickySessionId;
      const rows = Object.keys(byId).map((id) => byId[id]).filter((row) => row && row.id !== undefined);
      const main = rows.filter((row) => row.retainedBy && (row.retainedBy.mainView || 0) > 0);
      const pool = main.length > 0 ? main : rows.filter((row) => row.parentId === undefined || row.origin !== 'subagent');
      if (pool.length === 0) return undefined;
      pool.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      stickySessionId = pool[0].id;
      return stickySessionId;
    }

    function faceOf(ctx, sessionId, key) {
      try {
        const binding = ctx.sessions.binding(sessionId);
        return binding && binding.session && binding.session.projections
          ? binding.session.projections.faceOf(key === undefined ? PROJECTION_KEY : key)
          : undefined;
      } catch (error) {
        return undefined;
      }
    }

    /** 读一份投影：先问 face（最实时），再退到列表快照里的缓存值。 */
    function readOne(ctx, sessionId, key) {
      try {
        const face = faceOf(ctx, sessionId, key);
        if (face && typeof face.getSnapshot === 'function') {
          const value = face.getSnapshot();
          if (value !== undefined) return value;
        }
      } catch (error) { /* 降级到缓存值 */ }
      try {
        const list = ctx.sessions.list.getSnapshot();
        const snap = list.projectionsBySession ? list.projectionsBySession[sessionId] : undefined;
        const cached = snap && snap.values ? snap.values[key] : undefined;
        if (cached !== undefined) return cached;
      } catch (error) { /* 无缓存 */ }
      return undefined;
    }

    function readView(ctx) {
      const sessionId = pickSessionId(ctx);
      if (sessionId === undefined) {
        return {
          sessionId: undefined,
          view: undefined,
          botsView: undefined,
          chatView: undefined,
          configView: undefined,
          triggersView: undefined,
        };
      }
      return {
        sessionId,
        view: readOne(ctx, sessionId, PROJECTION_KEY),
        botsView: readOne(ctx, sessionId, BOTS_KEY),
        chatView: readOne(ctx, sessionId, CHAT_KEY),
        configView: readOne(ctx, sessionId, CONFIG_KEY),
        triggersView: readOne(ctx, sessionId, TRIGGERS_KEY),
      };
    }

    /** 订阅会话列表 + 当前会话的投影 face，两者任一变化就重读。 */
    function useAuditView(ctx) {
      const [state, setState] = React.useState(() => readView(ctx));
      React.useEffect(() => {
        let alive = true;
        const detachFaces = [];
        let faceSession;
        const cleanups = [];

        const read = () => {
          if (!alive) return;
          const next = readView(ctx);
          setState(next);
          attach(next.sessionId);
        };

        const detachAllFaces = () => {
          while (detachFaces.length > 0) {
            const stop = detachFaces.pop();
            try { if (typeof stop === 'function') stop(); } catch (error) { /* ignore */ }
          }
        };

        const attach = (sessionId) => {
          if (sessionId === faceSession) return;
          detachAllFaces();
          faceSession = sessionId;
          if (sessionId === undefined) return;
          for (const key of [PROJECTION_KEY, BOTS_KEY, CHAT_KEY, CONFIG_KEY, TRIGGERS_KEY]) {
            const face = faceOf(ctx, sessionId, key);
            if (!face || typeof face.subscribe !== 'function') continue;
            try {
              const stop = face.subscribe(() => { if (alive) setState(readView(ctx)); });
              if (typeof stop === 'function') detachFaces.push(stop);
            } catch (error) { /* 订阅失败不致命 */ }
          }
        };

        try {
          if (ctx.sessions && ctx.sessions.list && typeof ctx.sessions.list.subscribe === 'function') {
            const stop = ctx.sessions.list.subscribe(read);
            if (typeof stop === 'function') cleanups.push(stop);
          }
        } catch (error) { /* ignore */ }

        read();

        return () => {
          alive = false;
          detachAllFaces();
          for (const stop of cleanups) {
            try { stop(); } catch (error) { /* ignore */ }
          }
        };
      }, [ctx]);
      return state;
    }

    // ── 三个纵切页 ─────────────────────────────────────────────
    function Counters({ view, t }) {
      const counters = countersOf(view);
      return h('div', { className: 'ao-counters' },
        h('span', { className: 'ao-pill' }, t('asked'), ' ', h('b', null, String(counters.asked))),
        h('span', { className: 'ao-pill is-allowed' }, t('allowed'), ' ', h('b', null, String(counters.allowed))),
        h('span', { className: 'ao-pill is-denied' }, t('denied'), ' ', h('b', null, String(counters.denied))),
        h('span', { className: 'ao-pill is-blocked' }, t('blocked'), ' ', h('b', null, String(counters.blocked))),
        h('span', { className: 'ao-pill is-review' }, t('reviewed'), ' ', h('b', null, String(counters.reviewed || 0))));
    }

    function Empty({ text, compact }) {
      return h('div', { className: compact ? 'ao-empty is-compact' : 'ao-empty' }, h('span', null, text));
    }

    /**
     * 收件箱（A2）。04 方案 §3.2 的七列在窄栏里改成卡片式：
     *   状态（左边条 + 结论文字）/ 工具 / 时间 / 风险 / 理由 / 决策人。
     * 决策人一栏固定留白并加脚注——日志里没有这个信息，宁可空着也不臆测。
     */
    function InboxPage({ view, t }) {
      const entries = entriesOf(view);
      const head = [
        h('h2', { key: 'h2', className: 'ao-h2' }, t('inboxTitle')),
        h('p', { key: 'sub', className: 'ao-h2sub' }, t('inboxSub')),
      ];
      if (entries.length === 0) {
        return h('div', null, ...head, h(Empty, { text: t('emptyInbox'), compact: true }));
      }
      const rows = entries.slice().reverse();
      return h('div', null,
        ...head,
        ...rows.map((entry, index) => {
          const isFence = entry.kind === 'fence';
          const isReview = entry.kind === 'review';
          const kindText = isReview ? t('kindReview') : (isFence ? t('kindFence') : t('kindApproval'));
          const name = isReview
            ? (entry.tool || t('kindReview'))
            : isFence ? (entry.ruleId || t('kindFence')) : (entry.tool || t('kindApproval'));
          const detail = isFence
            ? (categoryLabel(t, entry.category) || '')
            : (entry.reason || '');
          const chips = [];
          if (isFence && entry.risk) {
            chips.push(h('span', {
              key: 'risk',
              className: 'ao-chip ' + (entry.risk === 'critical' ? 'is-critical' : entry.risk === 'high' ? 'is-high' : ''),
            }, riskLabel(t, entry.risk)));
          }
          if (isFence && entry.ruleId) {
            chips.push(h('span', { key: 'rule', className: 'ao-chip ao-mono' }, entry.ruleId));
          }
          if (!isFence && !isReview && entry.outcome === 'pending') {
            chips.push(h('span', { key: 'waiting', className: 'ao-chip' }, t('statusPending')));
          }
          // 决策人一栏只对审批条目有意义；围栏与自动拒绝没有「谁批的」这个概念。
          if (!isFence && !isReview) {
            chips.push(h('span', { key: 'decider', className: 'ao-chip' }, t('colDecider') + ': —'));
          }
          if (isReview) {
            chips.push(h('span', { key: 'auto', className: 'ao-chip' }, t('reviewerAuto')));
          }
          return h('div', { key: String(entry.seq) + ':' + String(index), className: cardClass(entry) },
            h('div', { className: 'ao-cardtop' },
              h('span', { className: 'ao-cardname', title: name }, kindText + ' · ' + name),
              entry.outcome === 'pending'
                ? h('span', { className: 'ao-out is-idle' }, t('statusPending'))
                : h('span', { className: outcomeClass(entry.outcome) }, labelOf(t, entry.outcome))),
            detail ? h('div', { className: 'ao-cardline', title: detail }, detail) : null,
            h('div', { className: 'ao-cardline' }, timeOf(entry.time)),
            chips.length > 0 ? h('div', { className: 'ao-chips' }, ...chips) : null);
        }),
        h('p', { className: 'ao-note' }, t('deciderNote')));
    }

    /**
     * 时间线（C2 的首版）。每一条都是三段式：授权 → 动作 → 结果。
     * 授权段给出「谁在什么时间放行/拒绝 + 等了多久」，动作段给出工具与风险，
     * 结果段给出最终结论与原始理由。这正是 Grok Bot 把审批做成终局、
     * 而我们把它做成可查记录的差别所在。
     */
    function TimelinePage({ view, t }) {
      const entries = entriesOf(view);
      const head = [
        h('h2', { key: 'h2', className: 'ao-h2' }, t('timelineTitle')),
        h('p', { key: 'sub', className: 'ao-h2sub' }, t('timelineSub')),
      ];
      if (entries.length === 0) {
        return h('div', null, ...head, h(Empty, { text: t('emptyTimeline'), compact: true }));
      }
      return h('div', null,
        ...head,
        ...entries.map((entry, index) => {
          const isFence = entry.kind === 'fence';
          const isReview = entry.kind === 'review';
          const waited = durationOf(entry.time, entry.decidedTime);
          // 授权段：三类条目的「谁决定的」各不相同，这是 Grok Bot 的 Expired 终局所没有的信息。
          const authText = isReview
            ? t('reviewerAuto')
            : isFence
              ? (entry.category ? categoryLabel(t, entry.category) : t('kindFence'))
              : (entry.outcome === 'pending' ? t('statusPending') : labelOf(t, entry.outcome));
          const actionText = isFence
            ? [entry.tool || '', entry.ruleId || ''].filter(Boolean).join(' · ')
            : (entry.tool || '');
          const riskText = isFence && entry.risk
            ? riskLabel(t, entry.risk)
            : '';
          const resultText = isFence
            ? (entry.reason || t('outcomeBlocked'))
            : isReview
              ? (entry.reason || t('outcomeReviewed'))
              : (entry.outcome === 'pending' ? t('outcomePending') : labelOf(t, entry.outcome));
          const kindLabel = isReview ? t('kindReview') : (isFence ? t('kindFence') : t('kindApproval'));
          return h('div', { key: String(entry.seq) + ':' + String(index), className: cardClass(entry) },
            h('div', { className: 'ao-cardtop' },
              h('span', { className: 'ao-cardname' }, timeOf(entry.time)),
              h('span', { className: outcomeClass(isReview ? 'rejected' : (isFence ? 'blocked' : entry.outcome)) }, kindLabel)),
            h('div', { className: 'ao-seg' },
              h('span', { className: 'ao-seglabel' }, t('segAuth')),
              h('span', { className: 'ao-segtext is-strong' }, authText + (waited ? ' · ' + t('waited') + waited : ''))),
            h('div', { className: 'ao-seg' },
              h('span', { className: 'ao-seglabel' }, t('segAction')),
              h('span', { className: 'ao-segtext ao-mono', title: actionText }, actionText || '—')),
            h('div', { className: 'ao-seg' },
              h('span', { className: 'ao-seglabel' }, t('segResult')),
              h('span', { className: 'ao-segtext', title: resultText }, resultText + (riskText ? ' · ' + riskText : ''))));
        }));
    }

    /**
     * 执行环境（只读）。04 方案 §3.4 明确不抄云电脑的 Update / Recover / Reset：
     * 本地对应的是「改沙箱模式」「改审批策略」，而这些已经有官方 /permission 入口，
     * 插件再造一个就是第二个权限入口，只会带来不一致。
     */
    function EnvPage({ view, configView, t }) {
      const env = envOf(view);
      const connectors = connectorsOf(configView);
      const row = (key, label, value, hint) => h('div', { key, className: 'ao-kv' },
        h('span', { className: 'ao-kvkey' }, label),
        h('div', { className: 'ao-kvval' },
          h('div', { className: 'ao-mono' }, value || t('envUnset')),
          hint ? h('div', { className: 'ao-kvhint' }, hint) : null));
      const connectorRows = connectors.length === 0
        ? [h('div', { key: 'c-empty', className: 'ao-note' }, t('envNoConnectors'))]
        : connectors.map((item) => h('div', { key: 'c-' + item.name, className: 'ao-kv' },
          h('span', { className: 'ao-kvkey' }, t('envConnectors')),
          h('div', { className: 'ao-kvval' },
            h('div', { className: 'ao-mono' }, item.name),
            h('span', {
              className: 'ao-chip' + (item.status === 'connected' ? ' is-ok' : item.status === 'disabled' ? '' : ' is-high'),
            }, item.status))));
      return h('div', null,
        h('h2', { className: 'ao-h2' }, t('envTitle')),
        h('p', { className: 'ao-h2sub' }, t('envSub')),
        row('sandbox', t('sandbox'), env.sandbox, t('envSandboxHint')),
        row('approval', t('approval'), env.approval, t('envApprovalHint')),
        row('preset', t('preset'), env.preset, t('envPresetHint')),
        h('div', { className: 'ao-grouphd' }, t('envConnectors')),
        ...connectorRows,
        h('p', { className: 'ao-note' }, t('envChangeHint')));
    }

    /**
     * 规则表（A3）。内置规则按风险分三组直接渲染，外加当前生效策略，
     * 下面再列本会话的用户规则与命中次数。
     *
     * 为什么用户规则只在这里呈现、编辑走命令：编辑入口是 `/ops-rule` 命令
     * （客户端 → Host 的唯一写入通道），判定在 Host 侧的 guard/pre-execute。
     * 两处若有第二份可写副本，就会出现「界面显示 ask、实际 allow」的不一致。
     */
    function RulesPage({ view, configView, t }) {
      const rules = builtinRulesOf(configView);
      const policy = policyOf(configView);
      const hits = hitsOf(view);
      const fenceHits = ruleHitsOf(view);
      const userRules = userRulesOf(configView);
      const total = rules.length;
      const head = [
        h('h2', { key: 'h2', className: 'ao-h2' }, t('rulesTitle')),
        h('p', { key: 'sub', className: 'ao-h2sub' }, fill(t('rulesSub'), total)),
      ];
      if (total === 0) {
        return h('div', null, ...head, h(Empty, { text: t('loading'), compact: true }));
      }
      const groups = [
        { risk: 'critical', label: 'rulesGroupCritical' },
        { risk: 'high', label: 'rulesGroupHigh' },
        { risk: 'medium', label: 'rulesGroupMedium' },
      ];
      const blocks = [];
      for (const group of groups) {
        const rows = rules.filter((rule) => rule.risk === group.risk);
        if (rows.length === 0) continue;
        blocks.push(h('div', { key: 'grp-' + group.risk, className: 'ao-grouphd' }, t(group.label) + ' · ' + String(rows.length)));
        for (const rule of rows) {
          const name = rule.note && typeof rule.note === 'object' ? rule.note : {};
              const noteText = name[langOf()] || name.zh || name.en || '';
          const hitCount = fenceHits[rule.id] || 0;
          const hit = hits[rule.id];
          const hitTotal = hitCount + (hit === undefined ? 0 : hit.count);
          blocks.push(h('div', { key: 'rule-' + rule.id, className: 'ao-rule is-' + group.risk },
            h('div', { className: 'ao-ruleid ao-mono', title: rule.id }, rule.id),
            h('span', {
              className: 'ao-ruletag is-' + group.risk + (hitTotal > 0 ? ' is-hit' : ''),
              title: hitTotal > 0 ? fill(t('rulesHit'), hitTotal) : '',
            }, riskLabel(t, rule.risk)),
            h('div', { className: 'ao-rulenote', title: noteText }, noteText),
            h('div'),
            hitTotal > 0
              ? h('div', { className: 'ao-rulenote' }, fill(t('rulesHit'), hitTotal))
              : null));
        }
      }
      const policyRows = [
        h('div', { key: 'p-hd', className: 'ao-grouphd' }, t('rulesPolicy')),
        h('div', { key: 'p-mode', className: 'ao-kv' },
          h('span', { className: 'ao-kvkey' }, t('rulesPolicyMode')),
          h('div', { className: 'ao-kvval ao-mono' }, policy.mode === 'observe' ? t('rulesModeObserve') : t('rulesModeEnforce'))),
        h('div', { key: 'p-ask', className: 'ao-kv' },
          h('span', { className: 'ao-kvkey' }, t('rulesPolicyAsk')),
          h('div', { className: 'ao-kvval ao-mono' }, policy.askRisk === null ? t('rulesNone') : riskLabel(t, policy.askRisk))),
        h('div', { key: 'p-deny', className: 'ao-kv' },
          h('span', { className: 'ao-kvkey' }, t('rulesPolicyDeny')),
          h('div', { className: 'ao-kvval ao-mono' }, policy.denyRisk === null ? t('rulesNone') : riskLabel(t, policy.denyRisk))),
      ];
      // 用户规则区：自己的约定 + 各自的命中次数。
      const userBlocks = [
        h('div', { key: 'u-hd', className: 'ao-grouphd' }, t('rulesUserTitle') + ' · ' + fill(t('rulesUserCount'), userRules.length)),
        h('div', { key: 'u-sub', className: 'ao-h2sub' }, fill(t('rulesUserSub'), 20)),
      ];
      if (userRules.length === 0) {
        userBlocks.push(h('div', { key: 'u-empty', className: 'ao-note' }, t('rulesUserEmpty')));
      } else {
        for (const rule of userRules) {
          const hit = hits['user:' + rule.id];
          const hitCount = hit === undefined ? 0 : hit.count;
          const lastAt = hit === undefined ? undefined : hit.lastAt;
          userBlocks.push(h('div', { key: 'u-' + rule.id, className: 'ao-rule is-medium' },
            h('div', { className: 'ao-ruleid ao-mono', title: rule.id }, rule.id),
            h('span', {
              className: 'ao-ruletag' + (rule.effect === 'ask' ? ' is-high' : ' is-ok'),
            }, rule.effect === 'ask' ? t('rulesUserAsk') : t('rulesUserAllow')),
            h('div', { className: 'ao-rulenote' },
              (rule.pattern ? '「' + rule.pattern + '」' : '')
              + (rule.tool ? ' @' + rule.tool : '')
              + (rule.note ? '（' + rule.note + '）' : '')),
            h('div'),
            hitCount > 0
              ? h('div', { className: 'ao-rulenote' },
                fill(t('rulesHit'), hitCount)
                + (lastAt === undefined ? '' : ' · ' + fill(t('rulesHitAt'), timeOf(lastAt))))
              : null));
        }
      }
      return h('div', null, ...head, ...policyRows, ...blocks, ...userBlocks);
    }

    // ── v1.1 纵切页：团队名册 ───────────────────────────────────
    /**
     * 名册页只读 ops.bots：Bot 行 + 升级工单。
     * 为什么名册不合并 subagentCatalog：那两份投影的数据源不同（一份是我们写的声明，
     * 一份是宿主的 catalog），合并会让人分不清「声明了」与「真跑起来了」。
     */
    function TeamPage({ view, botsView, t, sessionId, runCommand }) {
      const bots = botsOf(botsView);
      const escalations = escalationsOf(botsView);
      const mainName = mainNameOf(botsView);
      const [note, setNote] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const canRun = sessionId !== undefined && typeof runCommand === 'function';

      /** 裁决一张工单：写进会话日志，主 Bot 会读到。 */
      const adjudicate = (id, verb) => {
        if (!canRun || busy) return;
        setBusy(true);
        Promise.resolve(runCommand(sessionId, ADJUDICATE_COMMAND_LINE + id + ' ' + verb))
          .then((failure) => {
            setNote(failure === null || failure === undefined ? '' : t('escCannot') + ' ' + failure);
          })
          .catch((error) => setNote(t('escCannot') + ' ' + String(error && error.message ? error.message : error)))
          .finally(() => setBusy(false));
      };

      const botRows = bots.length === 0
        ? [h('div', { key: 'e', className: 'ao-note' }, t('teamEmpty'))]
        : bots.map((bot) => h('div', {
          key: bot.name,
          className: 'ao-bot' + (bot.main === true ? ' is-main' : ''),
        },
          h('span', { className: 'ao-botname' }, bot.name),
          h('span', { className: 'ao-botrole' }, (bot.title ? bot.title + ' · ' : '') + bot.role),
          bot.preset ? h('span', { className: 'ao-chip' }, t('rolePreset') + ' ' + bot.preset) : null,
          bot.main === true ? h('span', { className: 'ao-botstar' }, t('teamMain')) : null));
      const escRows = escalations.length === 0
        ? [h('div', { key: 'e', className: 'ao-note' }, t('teamEscEmpty'))]
        : escalations.slice().reverse().map((item) => {
          // critical 档永不可裁决；其余只在裁决开关打开且工单仍待处理时可裁决。
          const adjudicable = canRun && item.status === 'pending' && item.risk !== 'critical';
          return h('div', {
            key: item.id + ':' + String(item.seq),
            className: 'ao-card ao-esc' + (item.status === 'approved' ? ' is-approved' : item.status === 'rejected' ? ' is-rejected' : ''),
          },
            h('div', { className: 'ao-cardtop' },
              h('span', { className: 'ao-cardname' }, item.toolName || item.ruleId),
              h('span', { className: 'ao-cardtime' }, timeOf(item.time))),
            item.argsSummary ? h('div', { className: 'ao-cardline ao-mono' }, item.argsSummary) : null,
            h('div', { className: 'ao-chips' },
              h('span', { className: 'ao-chip' }, escStatusLabel(t, item.status)),
              h('span', { className: 'ao-chip' }, item.from),
              item.risk ? h('span', { className: 'ao-chip is-' + (item.risk === 'critical' ? 'critical' : 'high') }, riskLabel(t, item.risk)) : null,
              item.ruleId ? h('span', { className: 'ao-chip ao-mono' }, item.ruleId) : null),
            adjudicable
              ? h('div', { className: 'ao-toolbar', style: { marginLeft: 0, marginTop: '4px' } },
                h('button', {
                  type: 'button', className: 'ao-act', disabled: busy,
                  onClick: () => adjudicate(item.id, 'approve'),
                }, t('escApprove')),
                h('button', {
                  type: 'button', className: 'ao-act', disabled: busy,
                  onClick: () => adjudicate(item.id, 'reject'),
                }, t('escReject')))
              : (item.status === 'pending' && item.risk === 'critical'
                ? h('div', { className: 'ao-note' }, t('escCannot'))
                : null));
        });
      return h('div', { className: 'ao-page' },
        h('h2', { className: 'ao-h2' }, t('teamTitle')),
        h('p', { className: 'ao-h2sub' }, t('teamSub')),
        mainName === '' ? h('div', { className: 'ao-note' }, t('teamMainNone')) : null,
        ...botRows,
        h('div', { className: 'ao-grouphd' }, t('teamEscTitle')),
        ...escRows,
        note ? h('div', { className: 'ao-note' }, note) : null,
        h('div', { className: 'ao-note' }, t('teamHint')));
    }

    // ── v1.1 纵切页：群聊 ───────────────────────────────────────
    /**
     * 群聊页 = 只读消息流 + 一个输入框。
     * 发送**必须**走宿主命令通道（ctx.remote.commands.execute），因为客户端 bundle 拿不到
     * Host 侧的 appendPluginRecord；命令是宿主已经验证过的 UI→Host 写入路径。
     * 命令不可用（旧宿主）时输入框禁用并给出说明，不静默失败。
     */
    function ChatPage({ chatView, t, sessionId, sendCommand, inputActions }) {
      // Workspace 同时拿着三份投影：view=ops.audit，botsView=ops.bots，chatView=ops.chat。
      // 群聊页必须读 chatView——0.6.2 曾误读 view（审计投影），导致消息永远为空。
      const messages = messagesOf(chatView);
      const counters = chatCountersOf(chatView);
      const [draft, setDraft] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [note, setNote] = React.useState(null);
      const canSend = sessionId !== undefined
        && (typeof sendCommand === 'function' || (inputActions !== undefined && typeof inputActions.setDraft === 'function'));
      /**
       * 两条发送通道，优先级如下：
       * 1) remote.commands.execute —— 宿主命令通道，能拿到 success/error 回执；
       * 2) inputActions.setDraft + submit —— 退回原生 composer，把 /ops-say 交给它解析。
       * 都没有时输入框禁用并说明（旧宿主上不假装能发）。
       */
      const send = () => {
        const text = draft.trim();
        if (text.length === 0 || busy || !canSend) return;
        setBusy(true);
        setNote(null);
        const settle = (message) => { setNote(message); setBusy(false); };
        if (typeof sendCommand === 'function') {
          Promise.resolve(sendCommand(sessionId, text))
            .then((failure) => {
              if (typeof failure === 'string' && failure.length > 0) { settle(t('chatFailed') + failure); return; }
              setDraft('');
              settle(t('chatSent'));
            })
            .catch((error) => settle(t('chatFailed') + String(error && error.message ? error.message : error)));
          return;
        }
        try {
          inputActions.setDraft('/ops-say ' + text);
          inputActions.submit();
          setDraft('');
          settle(t('chatSent'));
        } catch (error) {
          settle(t('chatFailed') + String(error && error.message ? error.message : error));
        }
      };
      const rows = messages.length === 0
        ? [h('div', { key: 'e', className: 'ao-note' }, t('chatEmpty'))]
        : messages.map((message) => h('div', {
          key: String(message.seq),
          className: 'ao-msg' + (message.kind === 'system' ? ' is-system' : message.kind === 'escalation' ? ' is-escalation' : '')
            + (message.from === 'lead' ? ' is-mine' : ''),
        },
          h('div', { className: 'ao-msghead' },
            h('span', { className: 'ao-msgfrom' }, message.from),
            message.to ? h('span', { className: 'ao-msgto' }, '@' + message.to) : null,
            h('span', { className: 'ao-msgtime' }, timeOf(message.time))),
          h('div', { className: 'ao-msgtext' }, message.text)));
      const disabled = !canSend || busy;
      return h('div', { className: 'ao-page ao-chat' },
        h('h2', { className: 'ao-h2' }, t('chatTitle')),
        h('p', { className: 'ao-h2sub' }, t('chatSub')),
        h('div', { className: 'ao-chatlist' }, ...rows),
        h('div', { className: 'ao-composer' },
          h('textarea', {
            className: 'ao-input',
            rows: 1,
            value: draft,
            placeholder: canSend ? t('chatPlaceholder') : t('chatNoCommand'),
            disabled,
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            },
          }),
          h('button', { type: 'button', className: 'ao-send', disabled: disabled || draft.trim().length === 0, onClick: send },
            busy ? t('chatSending') : t('chatSend'))),
        canSend ? null : h('div', { className: 'ao-note' }, t('chatNoCommand')),
        note === null ? null : h('div', { className: 'ao-note' }, note),
        h('div', { className: 'ao-note' }, t('chatCounters').replace('{n}', String(counters.messages))));
    }
    // ── v1.1 收尾纵切页：主动建议 ─────────────────────────────────
    /**
     * 建议页（G7 / G8）：把「目标 / 待办 / 工作区改动 / 团队任务 / 交付物」折成的
     * 候选列出来，并标出它的打扰级别。
     *
     * 这一页**只提醒，不代替人决定**：L0 静默（只在列表里）、L1 通知条、
     * L2 唤醒主 Bot（唯一会花钱的一级，Host 侧按每日预算执行）。
     * 「忽略这一类」走 `/ops-ignore` 命令：连续忽略两次后该类自动降级 30 天。
     */
    function SuggestPage({ triggersView, t, sessionId, runCommand }) {
      const candidates = candidatesOf(triggersView);
      const [note, setNote] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const canRun = sessionId !== undefined && typeof runCommand === 'function';

      const ignore = (kind) => {
        if (!canRun || busy) return;
        setBusy(true);
        Promise.resolve(runCommand(sessionId, IGNORE_COMMAND_LINE + kind))
          .then((failure) => {
            setNote(failure === null || failure === undefined ? t('suggestIgnored') : t('suggestNoCommand') + failure);
          })
          .catch((error) => setNote(t('suggestNoCommand') + String(error && error.message ? error.message : error)))
          .finally(() => setBusy(false));
      };

      const head = [
        h('h2', { key: 'h2', className: 'ao-h2' }, t('suggestTitle')),
        h('p', { key: 'sub', className: 'ao-h2sub' }, t('suggestSub')),
      ];
      if (candidates.length === 0) {
        return h('div', null, ...head, h(Empty, { text: t('suggestEmpty'), compact: true }));
      }
      const kinds = [];
      for (const candidate of candidates) {
        if (!kinds.includes(candidate.kind)) kinds.push(candidate.kind);
      }
      const rows = candidates.map((candidate) => h('div', {
        key: candidate.id,
        className: 'ao-card' + (candidate.level === 'L2' ? ' is-pending' : candidate.level === 'L1' ? ' is-warn' : ''),
      },
        h('div', { className: 'ao-cardtop' },
          h('span', { className: 'ao-cardname', title: candidate.title }, candidate.title),
          h('span', { className: 'ao-out is-idle' }, suggestLevelLabel(t, candidate.level))),
        h('div', { className: 'ao-cardline' }, suggestKindLabel(t, candidate.kind)),
        h('div', { className: 'ao-chips' },
          h('span', { className: 'ao-chip' }, suggestLevelLabel(t, candidate.level)),
          candidate.count > 1 ? h('span', { className: 'ao-chip' }, '×' + String(candidate.count)) : null,
          candidate.ignored ? h('span', { className: 'ao-chip' }, t('suggestIgnored')) : null,
          h('span', { className: 'ao-chip' }, timeOf(candidate.at)))));

      const kindButtons = kinds.map((kind) => h('button', {
        key: 'ig-' + kind,
        type: 'button',
        className: 'ao-act',
        disabled: !canRun || busy,
        title: canRun ? t('suggestIgnore') : t('suggestNoCommand'),
        onClick: () => ignore(kind),
      }, t('suggestIgnore') + '：' + suggestKindLabel(t, kind)));

      return h('div', null,
        ...head,
        h('div', { className: 'ao-toolbar', style: { marginLeft: 0, marginBottom: '8px' } }, ...kindButtons),
        fill(t('suggestCount'), candidates.length),
        ...rows,
        note === null ? null : h('div', { className: 'ao-note' }, note));
    }

    const PAGES = [
      { id: 'inbox', label: 'navInbox', render: InboxPage },
      { id: 'timeline', label: 'navTimeline', render: TimelinePage },
      { id: 'rules', label: 'navRules', render: RulesPage },
      { id: 'suggest', label: 'navSuggest', render: SuggestPage },
      { id: 'env', label: 'navEnv', render: EnvPage },
      { id: 'team', label: 'navTeam', render: TeamPage },
      { id: 'chat', label: 'navChat', render: ChatPage },
    ];

    /**
     * 三视图共用同一套纵切页实现：右侧栏 tab 与主面板都渲染它，避免两份 UI。
     * 主面板宽、有独立标题位，所以带上 h1；右侧栏 tab 的标题在 chip 上，不重复画。
     */
    function Workspace({ view, botsView, chatView, configView, triggersView, t, showTitle, sessionId, sendCommand, runCommand, runCommandText, inputActions }) {
      const [page, setPage] = React.useState('inbox');
      const [exported, setExported] = React.useState(false);
      const current = PAGES.find((item) => item.id === page) || PAGES[0];
      const Body = current.render;
      const entryCount = entriesOf(view).length;
      // 配置面兜底：投影里没有的时候，用命令通道取一次（取过就不再取）。
      const [fallbackConfig, setFallbackConfig] = React.useState(undefined);
      React.useEffect(() => {
        if (sessionId === undefined || typeof runCommandText !== 'function') return;
        if (configView !== undefined && configView !== null) return;
        let alive = true;
        Promise.resolve(runCommandText(sessionId, CONFIG_COMMAND_LINE))
          .then((text) => {
            if (!alive || text === undefined) return;
            try {
              const parsed = JSON.parse(text);
              setFallbackConfig(parsed);
            } catch (error) { /* 通道不可用就保持空态 */ }
          })
          .catch(() => { /* 忽略 */ });
        return () => { alive = false; };
      }, [sessionId, configView]);
      const effectiveConfig = mergeConfig(configView, fallbackConfig);
      const doExport = () => {
        if (entryCount === 0) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadMarkdown(toMarkdown(view, configView, t), 'agent-ops-audit-' + stamp + '.md');
        setExported(true);
        setTimeout(() => setExported(false), 2000);
      };
      return h('div', { className: 'ao-root' },
        h('div', { className: 'ao-head' },
          h('div', { className: 'ao-headrow' },
            h('div', null,
              showTitle ? h('h1', { className: 'ao-title' }, t('title')) : null,
              showTitle ? h('p', { className: 'ao-sub' }, t('subtitle')) : null),
            h('div', { className: 'ao-toolbar' },
              h('button', {
                type: 'button',
                className: 'ao-act',
                disabled: entryCount === 0,
                title: entryCount === 0 ? t('exportEmpty') : t('exportMd'),
                onClick: doExport,
              }, exported ? t('exportDone') : t('exportMd')))),
          h(Counters, { view, t })),
        h('div', { className: 'ao-ws' },
          h('div', { className: 'ao-nav', role: 'tablist' },
            ...PAGES.map((item) => h('button', {
              key: item.id,
              type: 'button',
              role: 'tab',
              className: 'ao-navitem',
              'aria-selected': page === item.id ? 'true' : 'false',
              onClick: () => setPage(item.id),
            }, t(item.label)))),
          h('div', { className: 'ao-content' },
            h(Body, {
              view,
              botsView,
              chatView,
              configView: effectiveConfig,
              triggersView,
              t,
              sessionId,
              sendCommand,
              runCommand,
              inputActions,
            }))));
    }

    // ── 通知条（E2）────────────────────────────────────────────
    /**
     * 进程内的待处理计数总线。shell.overlay 的 standardProps 里**没有** useProjection
     * （宿主只为 session 作用域与若干 header 席位提供它），所以通知条拿不到投影。
     * 解法：让能读投影的徽标（会话头部，有 useProjection）把计数推进总线，
     * 通知条订阅总线。这样既不新增 Host 通道，也不需要在 overlay 里伪造 hook。
     */
    const pendingBus = (() => {
      let value = 0;
      const listeners = new Set();
      return {
        get: () => value,
        set(next) {
          if (next === value) return;
          value = next;
          for (const listener of listeners) { try { listener(value); } catch (error) { /* ignore */ } }
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
      };
    })();

    function usePendingBus() {
      const [value, setValue] = React.useState(pendingBus.get());
      React.useEffect(() => pendingBus.subscribe(setValue), []);
      return value;
    }

    /**
     * 通知条本体。只在新审批**刚出现**时弹一次（记住已提示过的最大计数），
     * 关闭后同一批不再弹；点它打开 ops tab。整层 pointer-events:none，
     * 只有卡片自己 opt-in，符合宿主对 shell.overlay 的约定。
     */
    function OpsToaster({ t, openOps }) {
      const pending = usePendingBus();
      const [visible, setVisible] = React.useState(false);
      const ackedRef = React.useRef(-1);
      React.useEffect(() => {
        if (pending > 0 && pending !== ackedRef.current) {
          setVisible(true);
          return;
        }
        if (pending === 0) {
          ackedRef.current = -1;
          setVisible(false);
        }
      }, [pending]);
      if (!visible) return null;
      const dismiss = (event) => {
        if (event) event.stopPropagation();
        ackedRef.current = pending;
        setVisible(false);
      };
      return h('div', { className: 'ao-toaster' },
        h('div', {
          className: 'ao-toast',
          role: 'status',
          onClick: () => { dismiss(null); if (typeof openOps === 'function') openOps(); },
        },
          h(PanelIcon, { size: 16 }),
          h('div', { className: 'ao-toastbody' },
            h('div', { className: 'ao-toasttitle' }, t('toastTitle') + ' · ' + String(pending)),
            h('div', { className: 'ao-toasttext' }, t('toastBody'))),
          h('button', { type: 'button', className: 'ao-toastx', 'aria-label': t('toastClose'), onClick: dismiss }, '×')));
    }

    // ── 右侧栏 tab 正文 ─────────────────────────────────────────
    /**
     * tab body 的 key 必须是 tab 类型的 definition.id（不是 kind）。
     * 这里不调 useTabInfo()：它要求 layout/tab/navigation 三者齐备，缺一就 throw，
     * 而正文并不需要 tab 元信息（refresh/close 都不做），少一个 throw 点更稳。
     */
    function OpsTabBody(props) {
      const t = props.t;
      const useProjection = projectionReader(props.useProjection);
      // 五个 hook 必须无条件、同序调用（React 契约），所以先全读再决定渲染。
      const view = useProjection(PROJECTION_KEY);
      const botsView = useProjection(BOTS_KEY);
      const chatView = useProjection(CHAT_KEY);
      const configView = useProjection(CONFIG_KEY);
      const triggersView = useProjection(TRIGGERS_KEY);
      if (view === undefined) {
        return h('div', { className: 'ao-root' }, h(Empty, { text: t('loading') }));
      }
      return h(Workspace, {
        view,
        botsView,
        chatView,
        configView,
        triggersView,
        t,
        sessionId: props.sessionId,
        sendCommand: typeof props.sendCommand === 'function' ? props.sendCommand : undefined,
        runCommand: typeof props.runCommand === 'function' ? props.runCommand : undefined,
        runCommandText: typeof props.runCommandText === 'function' ? props.runCommandText : undefined,
        inputActions: props.inputActions,
      });
    }

    // ── 会话头部的徽标按钮（B1b）────────────────────────────────
    /**
     * 数字 = 待处理审批数。留在头部而不是只在右栏，是因为「新审批到达时抬头就能看见」
     * 是这套运维面唯一有实时价值的信息。
     */
    function OpsBadge(props) {
      const t = props.t;
      const useProjection = projectionReader(props.useProjection);
      const view = useProjection(PROJECTION_KEY);
      const pending = countPending(view);
      React.useEffect(() => { pendingBus.set(pending); }, [pending]);
      const open = typeof props.openOps === 'function' ? props.openOps : () => {};
      return h('button', {
        type: 'button',
        className: 'ao-badge' + (pending > 0 ? ' is-live' : ''),
        title: pending > 0 ? t('badgeTitle') + ': ' + String(pending) : t('badgeIdle'),
        'aria-label': t('badgeAria'),
        onClick: open,
      },
        h(PanelIcon, { size: 14 }),
        pending > 0 ? h('b', null, String(pending)) : null);
    }

    // ── 主面板（M1 的落点，保留）──────────────────────────────────
    function MainPanel({ ctx, t, sendCommand, runCommand, runCommandText }) {
      const state = useAuditView(ctx);
      if (state.sessionId === undefined) return h(Empty, { text: t('noSession') });
      return h(Workspace, {
        view: state.view,
        botsView: state.botsView,
        chatView: state.chatView,
        configView: state.configView,
        triggersView: state.triggersView,
        t,
        showTitle: true,
        sessionId: state.sessionId,
        sendCommand: typeof sendCommand === 'function' ? sendCommand() : undefined,
        runCommand: typeof runCommand === 'function' ? runCommand() : undefined,
        runCommandText: typeof runCommandText === 'function' ? runCommandText() : undefined,
      });
    }

    // ── 错误边界 ───────────────────────────────────────────────
    function ErrorBoundary({ children, t }) {
      const [error, setError] = React.useState(null);
      if (error !== null) {
        return h('div', { className: 'ao-root' },
          h('div', { className: 'ao-empty' },
            h('span', null, t('unsupported')),
            h('span', { style: { fontSize: 11, opacity: 0.7 } }, String(error && error.message ? error.message : error))));
      }
      return h(ErrorCatcher, { onError: setError }, children);
    }

    class ErrorCatcher extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        if (this.props.onError) this.props.onError(error);
      }
      render() {
        return this.state.failed ? null : this.props.children;
      }
    }

    function PanelIcon({ size }) {
      const px = typeof size === 'number' ? size : 18;
      return h('span', { className: 'ao-icon' },
        h('svg', {
          width: px, height: px, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
          h('path', { d: 'M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z' }),
          h('path', { d: 'M9 11.5l2 2 4-4' }),
        ));
    }

    // ── 装配 ───────────────────────────────────────────────────
    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = PKG;
        tag.textContent = CSS;
        document.head.append(tag);
        return () => tag.remove();
      }, PKG + ': styles');

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), PKG + ': locale');

      const t = ctx.locale.bind(NS);

      /**
       * 群聊发送通道：客户端侧唯一被宿主验证过的 UI→Host 写入路径是命令通道
       * （remote.commands.execute）。命令名与 Host 半注册的 CHAT_COMMAND_NAME 必须一致。
       * 通道不可用（旧宿主）时保持 undefined，页面据此禁用输入框。
       */
      let sendCommand;
      let runCommand;
      let runCommandText;
      /**
       * 两级注入：'remote' 由 api-gateway 提供，'remote.commands' 由 api-remotes 在
       * 异步挂载命名空间后才 provide。只写 'remote' 会在命名空间挂载前就触发回调，
       * 此刻 remote.commands 还是 undefined（这就是 0.6.1 输入框被禁用的原因）。
       */
      ctx.inject(['remote', 'remote.commands'], (scope) => {
        const resolveCommands = () => {
          const service = scope.remote;
          return service && service.commands ? service.commands : undefined;
        };
        /**
         * 执行一条完整命令行。返回 null 表示成功，返回字符串表示失败原因。
         * 所有 UI→Host 的写入都走这里（群聊发言、裁决工单、忽略建议）。
         */
        runCommand = async (sessionId, commandLine) => {
          const commands = resolveCommands();
          if (!commands || typeof commands.execute !== 'function') return 'command channel unavailable';
          const result = await commands.execute(sessionId, commandLine, []);
          if (!result || result.ok !== true) {
            return result && result.error ? result.error.code + ': ' + result.error.message : 'unknown error';
          }
          const value = result.value;
          if (value === undefined || value === null) return 'command not available';
          if (value.kind === 'error') return String(value.text || 'command failed');
          return null;
        };
        /**
         * 执行一条命令并取回它的正文。
         * 数据通道：宿主命令的返回值是 {kind:'success', text}，这里把 text 交出去。
         */
        runCommandText = async (sessionId, commandLine) => {
          const commands = resolveCommands();
          if (!commands || typeof commands.execute !== 'function') return undefined;
          const result = await commands.execute(sessionId, commandLine, []);
          if (!result || result.ok !== true) return undefined;
          const value = result.value;
          if (value === undefined || value === null || value.kind === 'error') return undefined;
          return typeof value.text === 'string' ? value.text : undefined;
        };
        sendCommand = (sessionId, text) => runCommand(sessionId, CHAT_COMMAND_LINE + text);
      });

      // 左侧栏导航行：id 必须与 main 槽的 key 一致。
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 60,
        label: () => ctx.locale.bind(NS)('panel'),
      }, () => h(PanelIcon, { size: 18 })));

      // 主面板：keyed slot 的键即上面注册的 panel id。
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
      }, () => h(ErrorBoundary, { t }, h(MainPanel, {
        ctx,
        t,
        sendCommand: () => sendCommand,
        runCommand: () => runCommand,
        runCommandText: () => runCommandText,
      }))));

      // sidebarRight 只能在可选注入作用域里拿到（它不在顶层 inject 里，缺服务时插件仍要能用）。
      let openOps = () => {};
      ctx.inject(['sidebarRight'], (scope) => {
        openOps = () => {
          try {
            scope.sidebarRight.openTab(OPS_KIND);
          } catch (error) {
            try { scope.logger && scope.logger.warn('[agent-ops] openTab failed: ' + String(error)); } catch (ignored) { /* ignore */ }
          }
        };
      });

      // 会话头部徽标：在 jobs(20) 之后。
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: BADGE_ID,
        order: 30,
        locale: NS,
        inject: () => ({ openOps: () => openOps() }),
      }, (props) => h(ErrorBoundary, { t: props.t || t }, h(OpsBadge, props))));

      // 右侧栏 ops tab：可选注入，宿主没有这套服务时其余部分照常工作。
      ctx.inject(['sidebarRightTabs'], (scope) => {
        scope.effect(() => scope.sidebarRightTabs.register({
          id: PKG,
          kind: OPS_KIND,
          multiple: false,
          keepMounted: true,
          priority: 'extension',
          title: () => ctx.locale.bind(NS)('tabTitle'),
        }), PKG + ': sidebar tab type');

        scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
          name: 'sidebar.right.pane.tab',
          key: PKG,
          locale: NS,
        }, (props) => h(ErrorBoundary, { t: props.t || t },
          h(OpsTabBody, {
            ...props,
            sendCommand: typeof sendCommand === 'function' ? sendCommand : undefined,
            runCommand: typeof runCommand === 'function' ? runCommand : undefined,
            runCommandText: typeof runCommandText === 'function' ? runCommandText : undefined,
          }))));
      });

      // 全域浮层里的通知条（E2）。shell.overlay 是 root 作用域的 list 槽，
      // 整层 click-through，所以卡片自己 opt-in pointer-events（见 .ao-toast）。
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'agent-ops.toast',
        order: 40,
      }, () => h(OpsToaster, { t, openOps })));
    }

    return { inject: ['slots', 'locale', 'sessions'], apply };
  },
});
