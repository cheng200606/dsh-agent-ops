/**
 * lib/rules/policy.js — 策略归并与判定
 *
 * 把「用户配置」与「分类结果」合成一个决定：allow / ask / deny。
 * 这里刻意只有一个出口函数 evaluate()，因为护栏的正确性来自「决定是单调的」：
 * 越靠后的判定只能更严，不能把 deny 翻回 allow。
 *
 * 判定分两层：
 *   内置层（classify.js）—— 决定 deny 与默认 ask 门槛
 *   用户层（user-rules.js）—— 只能加严（ask）或放宽 ask 档（allow），永不撤销 deny
 *
 * 默认值的选择理由（可被 config 覆盖）：
 *   - askRisk 默认 'high'：高危动作先问人，符合「敏感节点主动发起审批」的产品语义。
 *   - denyRisk 默认 'critical'：只拦「不可逆且明显越过常识」的那一档（格式化磁盘、drop database、
 *     强推覆盖远端、提权执行）。用户可以设成 null 关掉硬拦，或设成 'high' 收紧。
 *   - mode 默认 'enforce'；'observe' 只读不拦，方便先观察一段时间再开。
 */

import { atLeast, classifyToolCall, RISK_LEVELS } from './classify.js';
import { matchUserRule, normalizeUserRules, userRuleId } from './user-rules.js';

export const DEFAULT_POLICY = Object.freeze({
  /** 总开关。false 时完全不介入工具调用（投影仍然工作）。 */
  enabled: true,
  /** 'enforce' 真的提问/拦截；'observe' 只记录判定结果，一律放行。 */
  mode: 'enforce',
  /** 达到此风险就问人；null 表示从不提问。 */
  askRisk: 'high',
  /** 达到此风险就硬拦；null 表示从不硬拦。 */
  denyRisk: 'critical',
  /** 只对这些类别生效；null 表示全部七类。 */
  categories: null,
  /** 显式豁免的规则 id（critical 永不可豁免——那是这张表存在的理由）。 */
  exemptRules: [],
  /** 用户规则表（A3）：ask 加严、allow 放宽 ask 档。 */
  userRules: [],
});

function asRisk(value, fallback) {
  if (value === null) return null;
  return typeof value === 'string' && RISK_LEVELS.includes(value) ? value : fallback;
}

/** 把任意配置（可能来自 cordis config、可能是 undefined）归一成完整的策略对象。 */
export function normalizePolicy(config) {
  const raw = config !== null && typeof config === 'object' ? (config.policy ?? config) : {};
  const pick = (key) => (Object.hasOwn(raw, key) ? raw[key] : DEFAULT_POLICY[key]);
  const categories = pick('categories');
  const exempt = pick('exemptRules');
  const normalized = normalizeUserRules(pick('userRules'));
  return {
    enabled: pick('enabled') !== false,
    mode: pick('mode') === 'observe' ? 'observe' : 'enforce',
    askRisk: asRisk(pick('askRisk'), DEFAULT_POLICY.askRisk),
    denyRisk: asRisk(pick('denyRisk'), DEFAULT_POLICY.denyRisk),
    categories: Array.isArray(categories) && categories.length > 0 ? categories.slice() : null,
    exemptRules: Array.isArray(exempt) ? exempt.filter(item => typeof item === 'string') : [],
    userRules: normalized.rules,
    userRuleRejected: normalized.rejected,
  };
}

/**
 * 用户规则命中时构造的 hit。
 *
 * category 用 'custom' 而不是复用七类之一：用户规则不属于任何一类高危动作，
 * 它只是用户自己的一条约定。混进七类会让审计条目里出现「删除或覆盖数据 →
 * custom」这种自相矛盾的记录。
 */
function userHit(user) {
  const note = typeof user.note === 'string' && user.note.length > 0 ? user.note : user.id;
  return {
    ruleId: userRuleId(user.id),
    category: 'custom',
    risk: 'high',
    note: { zh: '自定义规则：' + note, en: 'Custom rule: ' + note },
    user: true,
  };
}

/**
 * 判定一次工具调用。
 *
 * @param {string} name 工具名。
 * @param {unknown} args 工具参数。
 * @param {object} policy 归一化后的策略。
 * @param {object[]} [userRules] 本次调用所在会话的用户规则表；不给就用策略里的那份。
 * @returns {{ kind: 'allow' } | { kind: 'ask', hit: object } | { kind: 'deny', hit: object }}
 */
export function evaluate(name, args, policy, userRules = policy.userRules) {
  if (!policy.enabled) return { kind: 'allow' };

  const hit = classifyToolCall(name, args);
  const user = matchUserRule(userRules, name, args);

  // 用户 ask 规则是「加严」：任何时候命中都问人，包括内置表完全没覆盖的动作。
  // 但 observe 模式是「只看不动」，所以它也不问。
  const userAsk = user !== undefined && user.effect === 'ask' ? userHit(user) : undefined;
  if (policy.mode === 'observe') {
    return hit === undefined ? { kind: 'allow' } : { kind: 'allow', hit };
  }
  if (hit === undefined) {
    return userAsk === undefined ? { kind: 'allow' } : { kind: 'ask', hit: userAsk };
  }

  // 内置层的类别白名单只约束内置表，不约束用户自己的规则。
  if (policy.categories !== null && !policy.categories.includes(hit.category)) {
    return userAsk === undefined ? { kind: 'allow' } : { kind: 'ask', hit: userAsk };
  }

  // 豁免：只对非 critical 生效。critical 永远走完整判定。
  const exempt = hit.risk !== 'critical' && policy.exemptRules.includes(hit.ruleId);
  if (exempt) {
    return userAsk === undefined ? { kind: 'allow' } : { kind: 'ask', hit: userAsk };
  }

  // deny 是终局：用户规则不能撤销它（guard 是单调拒绝，类型上就没有 allow 分支）。
  if (policy.denyRisk !== null && atLeast(hit.risk, policy.denyRisk)) {
    return { kind: 'deny', hit };
  }

  // 用户 ask 与内置 ask 合并：谁先命中都问，且 ask 优先于 allow。
  if (policy.askRisk !== null && atLeast(hit.risk, policy.askRisk)) {
    if (userAsk !== undefined) return { kind: 'ask', hit: userAsk };
    // 用户 allow 只能放宽 ask 档，永远放宽不了 deny（上面已经返回了）。
    if (user !== undefined && user.effect === 'allow') return { kind: 'allow', hit };
    return { kind: 'ask', hit };
  }

  if (userAsk !== undefined) return { kind: 'ask', hit: userAsk };
  return { kind: 'allow', hit };
}
