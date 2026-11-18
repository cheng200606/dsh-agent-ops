/**
 * lib/rules/user-rules.js — 用户规则表（A3）
 *
 * 内置分类表（classify.js）回答「这个动作属于哪一类高危动作」；
 * 用户规则表回答「在我这台机器上，这条动作我要不要问一声」。两者的分工是：
 *
 *   内置表 → 决定 deny（不可逆的那一档）与默认 ask 门槛
 *   用户表 → 只能**加严**（ask）或**放宽 ask 档**（allow），永远不能撤销 deny
 *
 * 三条硬规则（04 方案 §3.5）：
 *   1. Ask 优先：一条 allow 规则与一条 ask 规则同时命中时，结果是 ask。
 *   2. 20 条上限：第 21 条被拒并给出提示（存不下，也不该让人存到分不清）。
 *   3. 高危动作永不进 Allow：allow 规则的目标若命中内置表的 critical 规则，
 *      保存时就被拒绝——因为那些动作在 guard 上被**单调拒绝**，allow 规则对它们
 *      根本没有意义，留着只会让人误以为自己放行了什么。
 *
 * 规则形如：
 *   { id: 'ask-before-publish', tool: null, pattern: 'npm publish', effect: 'ask' }
 *   { id: 'allow-fork-push',    tool: 'bash', pattern: 'git push origin fork', effect: 'allow' }
 *
 * pattern 是**字面子串**（不是正则）：用户写规则时不该被迫与正则语法打交道，
 * 而且字面子串让「保存前的安全检查」可以拿它当探针去撞内置规则表。
 */

import { RULES, argumentsText, sortedRules } from './classify.js';

/** 规则表上限（04 方案 A3）。 */
export const MAX_USER_RULES = 20;

/** 允许的效果。 */
export const USER_RULE_EFFECTS = ['ask', 'allow'];

/** 用户规则 id 的前缀：与内置规则 id 区分开，命中计数才不会混。 */
export const USER_RULE_PREFIX = 'user:';

/** id 语法：小写字母数字与连字符，与 DSH 的 skill 名规则一致。 */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** pattern 长度上限：规则是给人看的，不是给正则引擎练手的。 */
const MAX_PATTERN_LENGTH = 200;

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 规则 id 是否合法。 */
export function isValidUserRuleId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 && ID_PATTERN.test(value);
}

/**
 * 保存前的安全检查：allow 规则的目标若撞上内置表的 critical 规则，拒绝保存。
 *
 * 为什么只查 critical：内置表里的七类动作**全部**属于必须人工拍板的类别，
 * 若把七类整体拉黑，allow 规则就永远无法命中任何 ask 档动作——它会变成一个
 * 只能写、不能用的字段。真正需要挡住的是**不可逆**的那一档（格式化磁盘、
 * 删库、提权、发布、转账）：它们由 guard 单调拒绝，allow 规则对它们无效，
 * 所以在保存阶段就告诉用户「这条规则不会生效」。
 *
 * @returns {{ ok: true } | { ok: false, reason: string, ruleId: string, category: string }}
 */
export function checkAllowRuleSafety(rule) {
  if (rule.effect !== 'allow') return { ok: true };
  const probe = (rule.pattern !== null ? rule.pattern : rule.tool ?? '').toLowerCase();
  if (probe.length === 0) return { ok: true };
  for (const builtin of sortedRules(RULES)) {
    if (builtin.risk !== 'critical') continue;
    builtin.pattern.lastIndex = 0;
    if (!builtin.pattern.test(probe)) continue;
    return {
      ok: false,
      reason: '高危动作不可设为自动放行：' + builtin.id + '（' + builtin.category + '）已被围栏硬拦，这条规则不会生效。',
      ruleId: builtin.id,
      category: builtin.category,
    };
  }
  return { ok: true };
}

/**
 * 校验一条规则。
 * @returns {{ ok: true, rule: object } | { ok: false, reason: string }}
 */
export function validateUserRule(raw) {
  if (!isPlainObject(raw)) return { ok: false, reason: '规则必须是对象。' };
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!isValidUserRuleId(id)) {
    return { ok: false, reason: '规则 id 只能是小写字母、数字与连字符（1–64 位）。' };
  }
  const effect = typeof raw.effect === 'string' ? raw.effect.trim() : '';
  if (!USER_RULE_EFFECTS.includes(effect)) {
    return { ok: false, reason: '规则效果只能是 ask 或 allow。' };
  }
  const tool = typeof raw.tool === 'string' && raw.tool.trim().length > 0 ? raw.tool.trim() : null;
  const pattern = typeof raw.pattern === 'string' && raw.pattern.trim().length > 0 ? raw.pattern.trim() : null;
  if (tool === null && pattern === null) {
    return { ok: false, reason: '规则至少要指定工具名或命令片段其中之一。' };
  }
  if (pattern !== null && pattern.length > MAX_PATTERN_LENGTH) {
    return { ok: false, reason: '命令片段最长 ' + String(MAX_PATTERN_LENGTH) + ' 字符。' };
  }
  const note = typeof raw.note === 'string' && raw.note.trim().length > 0 ? raw.note.trim().slice(0, 200) : null;
  const rule = { id, effect, tool, pattern, note };
  const safety = checkAllowRuleSafety(rule);
  if (!safety.ok) {
    return { ok: false, reason: safety.reason, ruleId: safety.ruleId, category: safety.category };
  }
  return { ok: true, rule };
}

/**
 * 归一化一批规则：去重、丢弃非法项、超出上限的按「先到先得」截断。
 *
 * @returns {{ rules: object[], rejected: { rule: unknown, reason: string }[] }}
 */
export function normalizeUserRules(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const rules = [];
  const rejected = [];
  const seen = new Set();
  for (const candidate of list) {
    if (rules.length >= MAX_USER_RULES) {
      rejected.push({ rule: candidate, reason: '规则表最多 ' + String(MAX_USER_RULES) + ' 条，第 ' + String(rules.length + 1) + ' 条起不再保存。' });
      continue;
    }
    const result = validateUserRule(candidate);
    if (!result.ok) {
      rejected.push({ rule: candidate, reason: result.reason });
      continue;
    }
    if (seen.has(result.rule.id)) {
      rejected.push({ rule: candidate, reason: '规则 id 重复：' + result.rule.id });
      continue;
    }
    seen.add(result.rule.id);
    rules.push(result.rule);
  }
  return { rules, rejected };
}

/**
 * 规则是否命中这次调用。
 *
 * 命中条件：tool 与 pattern 都得对上（填了才算）。
 * pattern 是字面子串，比较时统一转小写。
 */
export function ruleMatches(rule, name, args) {
  if (rule.tool !== null && rule.tool.toLowerCase() !== String(name).toLowerCase()) return false;
  if (rule.pattern === null) return true;
  const haystack = argumentsText(args).toLowerCase();
  return haystack.includes(rule.pattern.toLowerCase());
}

/**
 * 在规则表里找命中项。
 *
 * Ask 优先：先找 ask，命中就直接返回 ask；找不到再找 allow。
 *
 * @returns {{ effect: 'ask'|'allow', id: string, note: string|null } | undefined}
 */
export function matchUserRule(rules, name, args) {
  if (!Array.isArray(rules) || rules.length === 0) return undefined;
  let allow;
  for (const rule of rules) {
    if (!isPlainObject(rule)) continue;
    if (!ruleMatches(rule, name, args)) continue;
    if (rule.effect === 'ask') {
      return { effect: 'ask', id: rule.id, note: typeof rule.note === 'string' ? rule.note : null };
    }
    if (allow === undefined) allow = { effect: 'allow', id: rule.id, note: typeof rule.note === 'string' ? rule.note : null };
  }
  return allow;
}

/** 带前缀的规则 id（写进审批理由与命中计数，保证与内置规则不混淆）。 */
export function userRuleId(id) {
  return USER_RULE_PREFIX + id;
}

/** 是否是用户规则的 id。 */
export function isUserRuleId(value) {
  return typeof value === 'string' && value.startsWith(USER_RULE_PREFIX);
}

/** 去掉前缀，取回用户规则自己的 id。 */
export function stripUserRulePrefix(value) {
  return isUserRuleId(value) ? value.slice(USER_RULE_PREFIX.length) : value;
}

/** 可导出成 JSON 的纯数据（导出 YAML 用）。 */
export function userRulesAsJson(rules) {
  return (Array.isArray(rules) ? rules : []).map(rule => ({
    id: rule.id,
    effect: rule.effect,
    tool: rule.tool ?? null,
    pattern: rule.pattern ?? null,
    note: rule.note ?? null,
  }));
}

/**
 * 导出成 YAML 文本（不引第三方 YAML 库：这份 YAML 要能被人读、被 git diff，
 * 结构又只有五个字段，自己拼比拉依赖更可控）。
 */
export function userRulesAsYaml(rules) {
  const lines = ['# Agent Ops 用户规则表', '# effect: ask = 命中就问人；allow = 命中就不问（永远不能撤销围栏的硬拦）', 'rules:'];
  const list = Array.isArray(rules) ? rules : [];
  if (list.length === 0) {
    lines.push('  []');
    return lines.join('\n') + '\n';
  }
  for (const rule of list) {
    lines.push('  - id: ' + yamlScalar(rule.id));
    lines.push('    effect: ' + yamlScalar(rule.effect));
    lines.push('    tool: ' + (rule.tool === null || rule.tool === undefined ? 'null' : yamlScalar(rule.tool)));
    lines.push('    pattern: ' + (rule.pattern === null || rule.pattern === undefined ? 'null' : yamlScalar(rule.pattern)));
    lines.push('    note: ' + (rule.note === null || rule.note === undefined ? 'null' : yamlScalar(rule.note)));
  }
  return lines.join('\n') + '\n';
}

/** YAML 标量转义：带特殊字符就加引号并转义引号与反斜杠。 */
function yamlScalar(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./-]+$/.test(text)) return text;
  return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * 解析 YAML 规则表（只支持我们自己导出的那一种形状）。
 *
 * 为什么自己解析：这份 YAML 是**我们自己导出**的，形状固定（rules 列表 + 五个
 * 字段），不需要支持整个 YAML 方言；而引一个 YAML 库会给插件带来一个纯粹的
 * 依赖负担。解析失败就返回 rejected 列表，交给界面显示，不抛异常。
 *
 * @returns {{ rules: object[], rejected: { rule: unknown, reason: string }[] }}
 */
export function parseUserRulesYaml(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { rules: [], rejected: [{ rule: null, reason: '内容为空。' }] };
  }
  const candidates = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    if (line === 'rules:') continue;
    if (line === '[]') continue;
    const item = /^- \s*([A-Za-z0-9_]+):\s*(.*)$/u.exec(line);
    if (item !== null) {
      current = {};
      candidates.push(current);
      current[item[1]] = parseYamlScalar(item[2]);
      continue;
    }
    const field = /^([A-Za-z0-9_]+):\s*(.*)$/u.exec(line);
    if (field !== null && current !== null) {
      current[field[1]] = parseYamlScalar(field[2]);
      continue;
    }
    return { rules: [], rejected: [{ rule: null, reason: '无法解析的行：' + rawLine }] };
  }
  return normalizeUserRules(candidates);
}

/** YAML 标量解析：null / 引号串 / 裸串。 */
function parseYamlScalar(raw) {
  const text = raw.trim();
  if (text === 'null' || text === '~' || text === '') return null;
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return text;
}
