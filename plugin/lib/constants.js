/**
 * lib/constants.js — 插件级常量（与会话无关，但客户端需要知道）
 *
 * 这些值对所有会话一致，所以它们是**插件级**的，而不是会话状态：
 *   BUILTIN_RULES_VIEW —— 内置高危规则表（classify.js 导出）
 *   POLICY_VIEW        —— 围栏策略（ask / deny 门槛、类别白名单、豁免）
 *   TRIGGER_POLICY_VIEW—— 主动感知策略（通知门槛、唤醒开关、预算）
 *
 * 它们通过 ops.config 投影下发给客户端（见 config-projection.js）。
 * 之所以要专门走一个投影而不是挂在审计视图上：审计投影声明了 summary:false，
 * 挂在那儿的东西在一个还没有事件的新会话里客户端读不到（实测踩过）。
 */

export const BUILTIN_RULES_VIEW = Object.freeze([]);
export const POLICY_VIEW = Object.freeze({
  enabled: true,
  mode: 'enforce',
  askRisk: 'high',
  denyRisk: 'critical',
  categories: null,
  exemptRules: Object.freeze([]),
});
export const TRIGGER_POLICY_VIEW = Object.freeze({
  notifyUrgency: 'normal',
  wakeEnabled: false,
  dailyWakeBudget: 3,
  repeatWindowHours: 24,
  ignoreThreshold: 2,
  downgradeDays: 30,
});

/** 更新内置规则表（插件激活时调用一次）。 */
export function setBuiltinRules(rules) {
  // 规则表本身在 config-projection.js 里与其它常量打包成一个引用，
  // 这里只保留一个便捷入口，避免调用方各自拼对象。
  return Array.isArray(rules) ? rules.slice() : [];
}

/** 更新围栏策略。 */
export function setPolicyView(policy) {
  return {
    enabled: policy?.enabled !== false,
    mode: policy?.mode === 'observe' ? 'observe' : 'enforce',
    askRisk: policy?.askRisk ?? null,
    denyRisk: policy?.denyRisk ?? null,
    categories: Array.isArray(policy?.categories) && policy.categories.length > 0 ? policy.categories.slice() : null,
    exemptRules: Array.isArray(policy?.exemptRules) ? policy.exemptRules.slice() : [],
  };
}
