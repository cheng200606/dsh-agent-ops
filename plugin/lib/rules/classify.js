/**
 * lib/rules/classify.js — 高危动作分类表
 *
 * 只做一件事：给定「工具名 + 参数」，判断这次调用属于哪一类高危动作、风险等级多高。
 * 表本身是纯数据 + 纯函数，可被测试、可被导出成 JSON（04 方案 A5 的验收口径）。
 *
 * 七个类别不是随意定的：它们逐条对应 Grok Bot 文档里「必须人工拍板」的七类动作
 * （发消息/发布/付款/删除数据/改权限/改生产/接受条款）。这样「对标」就不是形容词，
 * 而是同一条清单：Grok Bot 靠文档约定，我们靠这里的表 + guard 的单调拒绝。
 */

/** 七类必须人工拍板的高危动作（与 Grok Bot 的七类一一对应）。 */
export const FENCE_CATEGORIES = {
  destructive: { zh: '删除或覆盖数据', en: 'Destroy or overwrite data' },
  permission: { zh: '修改权限', en: 'Change permissions' },
  production: { zh: '变更生产环境', en: 'Change production' },
  publishing: { zh: '发布内容', en: 'Publish content' },
  messaging: { zh: '发消息或邀请', en: 'Send messages or invites' },
  payment: { zh: '购买或转账', en: 'Purchase or transfer' },
  legal: { zh: '接受法律条款', en: 'Accept legal terms' },
};

/** 风险等级，从高到低。 */
export const RISK_LEVELS = ['critical', 'high', 'medium'];

const RISK_WEIGHT = { critical: 3, high: 2, medium: 1, low: 0 };

/** 会被当成 shell 解释器的工具名（参数里带命令字符串）。 */
export const SHELL_TOOLS = new Set(['pwsh', 'bash', 'shell', 'terminal', 'run_command', 'run_command_line']);

/** 只读工具：无论参数如何都不该进入高危表，提前短路省掉一次分类。 */
export const READ_ONLY_TOOLS = new Set(['read', 'glob', 'grep', 'read_image', 'web_search', 'web_fetch', 'todo_write', 'skill']);

/**
 * 执行器工具：参数里装的是「别的程序的源码」，不是命令本身。
 * 对它们做文本分类几乎没有命中率、误报率却很高（一段示例代码里出现 drop table 就会被判高危），
 * 而且执行器内部真正跑的工具调用会各自触发一次 pre-execute，本来就会被分类到。
 * 所以这里直接跳过。
 */
export const EXECUTOR_TOOLS = new Set(['run_code', 'workflow', 'ralph']);

/**
 * 规则表。字段含义：
 *   id      稳定标识，会写进审计条目（改 id 视为破坏性变更）
 *   category 七个类别之一
 *   risk     critical / high / medium
 *   scope    'shell'（只看命令文本）| 'tool'（只看工具名与参数）| 'both'
 *   pattern  在 haystack（小写）上匹配的正则
 *   note     中英文短说明，进审计条目的 reason
 *
 * 顺序即优先级：先声明的先命中。critical 一律排在 high 之前（见 sortedRules）。
 */
export const RULES = [
  // ── 破坏性文件/磁盘操作 ───────────────────────────────────────────
  { id: 'disk-format', category: 'destructive', risk: 'critical', scope: 'shell',
    pattern: /\b(mkfs(\.\w+)?|format\s+[a-z]:|format-volume|clear-disk|initialize-disk|diskpart|fdisk|wipefs)\b/,
    note: { zh: '格式化或重写磁盘分区', en: 'Format or rewrite a disk partition' } },
  { id: 'disk-raw-write', category: 'destructive', risk: 'critical', scope: 'shell',
    pattern: /\bdd\s+[^|]*of=\/dev\//,
    note: { zh: '向块设备直接写入', en: 'Write directly to a block device' } },
  { id: 'rm-root', category: 'destructive', risk: 'critical', scope: 'shell',
    pattern: /\brm\s+(-[a-z]*[rf][a-z]*\s+)+(-[a-z]*\s+)*(\/|~|\$home|\.\.?\/?$|[a-z]:\\)/,
    note: { zh: '递归删除根目录或用户目录', en: 'Recursively delete a root or home directory' } },
  { id: 'rm-wildcard-recursive', category: 'destructive', risk: 'high', scope: 'shell',
    pattern: /\brm\s+(-[a-z]*[rf][a-z]*\s+)+[^|;&]*\*/,
    note: { zh: '递归删除通配符匹配的文件', en: 'Recursively delete wildcard-matched files' } },
  { id: 'remove-item-recursive-force', category: 'destructive', risk: 'critical', scope: 'shell',
    pattern: /remove-item[^\n]*(-recurse|-r\b)[^\n]*(-force|-f\b)/,
    note: { zh: 'PowerShell 递归强制删除', en: 'PowerShell recursive forced delete' } },
  { id: 'sql-drop', category: 'destructive', risk: 'critical', scope: 'both',
    pattern: /\bdrop\s+(table|database|schema|index|view)\b/,
    note: { zh: '删除数据库对象', en: 'Drop a database object' } },
  { id: 'sql-truncate', category: 'destructive', risk: 'critical', scope: 'both',
    pattern: /\btruncate\s+(table\s+)?["`\[]?[\w.]+/,
    note: { zh: '清空数据表', en: 'Truncate a table' } },
  { id: 'sql-delete-all', category: 'destructive', risk: 'high', scope: 'both',
    pattern: /\bdelete\s+from\s+[\w."]+\s*(;|$)/,
    note: { zh: '不带 WHERE 的全表删除', en: 'DELETE without a WHERE clause' } },
  { id: 'git-history-rewrite', category: 'destructive', risk: 'high', scope: 'shell',
    pattern: /\bgit\s+(filter-branch|reset\s+--hard|clean\s+-[a-z]*[fd])/,
    note: { zh: '重写或丢弃本地提交历史', en: 'Rewrite or discard local history' } },
  { id: 'git-force-push', category: 'destructive', risk: 'high', scope: 'shell',
    pattern: /\bgit\s+push\b[^\n]*(--force\b|-f\b)/,
    note: { zh: '强制推送覆盖远端历史', en: 'Force-push over remote history' } },
  { id: 'registry-delete', category: 'destructive', risk: 'high', scope: 'shell',
    pattern: /\breg(\.exe)?\s+delete\b/,
    note: { zh: '删除注册表键', en: 'Delete a registry key' } },

  // ── 权限 ──────────────────────────────────────────────────────────
  { id: 'chmod-world-writable', category: 'permission', risk: 'high', scope: 'shell',
    pattern: /\bchmod\s+(-[a-z]+\s+)*(777|666|a\+w)\b/,
    note: { zh: '把文件权限放开到所有人可写', en: 'Make a file world-writable' } },
  { id: 'ipc-permission-change', category: 'permission', risk: 'high', scope: 'shell',
    pattern: /\b(chown|chgrp|icacls|takeown|set-acl)\b/,
    note: { zh: '变更文件所有者或 ACL', en: 'Change ownership or ACLs' } },
  { id: 'privilege-escalation', category: 'permission', risk: 'critical', scope: 'shell',
    pattern: /^\s*(sudo|doas|runas|su\s+-)\b/,
    note: { zh: '提权执行', en: 'Execute with elevated privileges' } },
  { id: 'execution-policy-weaken', category: 'permission', risk: 'high', scope: 'shell',
    pattern: /set-executionpolicy\s+(bypass|unrestricted)/,
    note: { zh: '关闭 PowerShell 脚本执行策略限制', en: 'Weaken the PowerShell execution policy' } },

  // ── 生产环境 ──────────────────────────────────────────────────────
  { id: 'k8s-mutate-prod', category: 'production', risk: 'critical', scope: 'shell',
    pattern: /\bkubectl\s+(delete|apply|replace|scale|rollout\s+(undo|restart|status)?)\b/,
    note: { zh: '对 Kubernetes 集群做写操作', en: 'Mutate a Kubernetes cluster' } },
  { id: 'terraform-apply-destroy', category: 'production', risk: 'critical', scope: 'shell',
    pattern: /\bterraform\s+(apply|destroy)\b/,
    note: { zh: '对基础设施执行 plan 或 destroy', en: 'Apply or destroy infrastructure' } },
  { id: 'container-forced-removal', category: 'production', risk: 'high', scope: 'shell',
    pattern: /\bdocker\s+(rm\s+-f|system\s+prune|volume\s+rm|network\s+rm)\b/,
    note: { zh: '强制删除容器或清理卷', en: 'Force-remove containers or prune volumes' } },
  { id: 'db-migration-run', category: 'production', risk: 'high', scope: 'shell',
    pattern: /\b(prisma\s+migrate\s+deploy|sequelize\s+db:migrate|alembic\s+upgrade|flyway\s+migrate)\b/,
    note: { zh: '在目标库上执行迁移', en: 'Run database migrations' } },

  // ── 发布 ──────────────────────────────────────────────────────────
  { id: 'package-publish', category: 'publishing', risk: 'critical', scope: 'shell',
    pattern: /\b(npm|pnpm|yarn|bun)\s+publish\b/,
    note: { zh: '向包仓库发布版本', en: 'Publish a package to a registry' } },
  { id: 'release-publish', category: 'publishing', risk: 'high', scope: 'both',
    pattern: /\b(gh\s+release\s+create|twine\s+upload|cargo\s+publish|gem\s+push)\b/,
    note: { zh: '创建对外发布', en: 'Create a public release' } },
  { id: 'deploy-command', category: 'publishing', risk: 'high', scope: 'both',
    pattern: /\b(vercel\s+(deploy|--prod)|netlify\s+deploy|firebase\s+deploy|serverless\s+deploy)\b/,
    note: { zh: '触发一次部署', en: 'Trigger a deployment' } },

  // ── 消息 / 邀请 ──────────────────────────────────────────────────
  { id: 'send-message-tool', category: 'messaging', risk: 'high', scope: 'tool',
    pattern: /(send[_-]?(email|mail|message|sms|dm)|invite[_-]?(user|member)|post[_-]?(message|comment))/,
    note: { zh: '以你的身份对外发送消息或邀请', en: 'Send a message or invite as you' } },
  { id: 'http-write-verb', category: 'messaging', risk: 'medium', scope: 'shell',
    pattern: /\bcurl\b[^\n]*(-x\s*(post|put|delete)|--data|--request\s+(post|put|delete))/,
    note: { zh: '用 curl 发起写请求', en: 'Issue a write request with curl' } },

  // ── 付款 ─────────────────────────────────────────────────────────
  { id: 'payment-tool', category: 'payment', risk: 'critical', scope: 'tool',
    pattern: /(purchase|checkout|pay[_-]?(order|invoice|now)|transfer[_-]?funds|stripe[_-]?charge)/,
    note: { zh: '完成一笔购买或转账', en: 'Complete a purchase or transfer' } },

  // ── 法律条款 ──────────────────────────────────────────────────────
  { id: 'accept-terms-tool', category: 'legal', risk: 'high', scope: 'tool',
    pattern: /(accept[_-]?(terms|tos|eula|agreement)|sign[_-]?contract)/,
    note: { zh: '代表你接受条款或签署协议', en: 'Accept terms or sign an agreement for you' } },
];

/** 按风险从高到低稳定排序后的规则表（导出与测试用）。 */
export function sortedRules(rules = RULES) {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((left, right) => (RISK_WEIGHT[right.rule.risk] - RISK_WEIGHT[left.rule.risk]) || (left.index - right.index))
    .map(entry => entry.rule);
}

const SORTED = sortedRules();

/**
 * 从一次工具调用里取出「会被 shell 解释的文本」。
 * 不是 shell 工具就返回 undefined —— 这样 shell 规则不会误伤 read/edit。
 */
export function shellCommandOf(name, args) {
  if (typeof name !== 'string' || !SHELL_TOOLS.has(name)) return undefined;
  if (typeof args === 'string') return args;
  if (args === null || typeof args !== 'object') return undefined;
  for (const key of ['command', 'commands', 'script', 'cmd', 'line', 'input']) {
    const value = args[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const parts = value.filter(item => typeof item === 'string');
      if (parts.length > 0) return parts.join('\n');
    }
  }
  return undefined;
}

/** 把参数安全地转成一段可匹配的文本。参数是 JSON 字符串时先解开。 */
export function argumentsText(rawArgs) {
  if (rawArgs === undefined || rawArgs === null) return '';
  if (typeof rawArgs === 'string') {
    const trimmed = rawArgs.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  try {
    return JSON.stringify(rawArgs);
  } catch {
    return String(rawArgs);
  }
}

/**
 * 分类一次工具调用。
 * @returns {{ ruleId: string, category: string, risk: string, note: {zh: string, en: string} } | undefined}
 */
export function classifyToolCall(name, rawArgs, rules = SORTED) {
  if (typeof name !== 'string' || name.length === 0) return undefined;
  if (READ_ONLY_TOOLS.has(name)) return undefined;
  if (EXECUTOR_TOOLS.has(name)) return undefined;

  const command = shellCommandOf(name, rawArgs);
  const toolText = (name + ' ' + argumentsText(rawArgs)).toLowerCase();
  const shellText = command === undefined ? undefined : command.toLowerCase();
  const isShellTool = shellText !== undefined;

  for (const rule of rules) {
    const scope = rule.scope === undefined ? 'both' : rule.scope;
    let haystack;
    if (scope === 'shell') haystack = shellText;
    else if (scope === 'tool') haystack = toolText;
    else haystack = isShellTool ? shellText : toolText;
    if (haystack === undefined) continue;
    // 每次 reset 是因为规则正则是共享实例（无 g 标志其实不需要，但便宜且稳妥）
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(haystack)) {
      return { ruleId: rule.id, category: rule.category, risk: rule.risk, note: rule.note };
    }
  }
  return undefined;
}

/**
 * 风险是否达到某个门槛（含）。
 * 门槛为 null / undefined / 未知值时一律 false —— 「没有门槛」不等于「最低门槛」，
 * 否则把 askRisk 设成 null 关掉审批时，所有动作都会被判成达到门槛。
 */
export function atLeast(risk, threshold) {
  if (threshold === null || threshold === undefined) return false;
  const bar = RISK_WEIGHT[threshold];
  if (bar === undefined) return false;
  return (RISK_WEIGHT[risk] ?? 0) >= bar;
}

/** 可导出成 JSON 的纯数据表（A5 验收：导出的表与运行时分类结果一致）。 */
export function rulesAsJson(rules = RULES) {
  return rules.map(rule => ({
    id: rule.id,
    category: rule.category,
    risk: rule.risk,
    scope: rule.scope === undefined ? 'both' : rule.scope,
    pattern: rule.pattern.source,
    flags: rule.pattern.flags,
    note: { zh: rule.note.zh, en: rule.note.en },
  }));
}
