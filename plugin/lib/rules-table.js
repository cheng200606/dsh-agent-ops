/**
 * lib/rules-table.js — 用户规则表的落盘（A3 / D1）
 *
 * 用户规则表存在**会话日志的插件记录**里（plugin:ops.rule），而不是设置文档。
 *
 * 为什么不是设置文档（与 04 方案 §3.5 第 3 条的偏离，记录在案）：
 *   设置文档那套要插件声明一个带 volatile 字段的 Config，于是就得引 schemastery。
 *   插件的其余部分刻意不引 zod/schemastery（避免与宿主 4.6.6、profile 3.25.76 打架），
 *   为了一个规则表把整个包的依赖面扩大，不划算。而且插件记录这条通道已经验证过：
 *   它自动带 ignorable: true（旧版本读到会跳过而不是拒绝整条日志）、分叉与恢复原样带走、
 *   而且**规则改动会留在审计轨迹里**——「谁在什么时候加了这条放行规则」是可查的，
 *   这比一个不透明的设置块更符合这个插件的立身之本。
 *
 * 代价与补偿：
 *   规则是**会话级**的（不是全机器级）。补偿是 D1 的 YAML 导出/导入：
 *   规则表可以导出成 YAML 提交进仓库，换一台机器导入即可——这正是 04 方案说的
 *   「可版本化的资产」，而且比设置文档更便携。
 *
 * 投影 ops.rules 与 ops.chat / ops.bots 同一套写法：apply 必须同步、不关心的事件返回
 * 同一引用、state 纯 JSON、wire.view 复用引用。
 */

import { appendPluginRecord } from '@deepseek-ai/dsh-session';

import {
  MAX_USER_RULES,
  normalizeUserRules,
  parseUserRulesYaml,
  userRulesAsJson,
  userRulesAsYaml,
} from './rules/user-rules.js';

export const RULE_RECORD_TYPE = 'plugin:ops.rule';

// ──────────────────────────────────────────────────────────────
// 写入
// ──────────────────────────────────────────────────────────────

/**
 * 写一份规则表（整表覆盖）。
 *
 * 为什么整表覆盖而不是增删差量：规则表最多 20 条、整体只有几百字节，
 * 整表覆盖让「读到的永远是最后写的那份」，不需要在读取端重放操作序列。
 * 审计轨迹里仍然能看出「规则表在什么时候被改过」。
 *
 * @returns {number} 提交后的会话 seq。
 */
export function writeUserRules(session, rules) {
  const normalized = normalizeUserRules(rules);
  const data = { version: 1, rules: userRulesAsJson(normalized.rules) };
  return appendPluginRecord(session, RULE_RECORD_TYPE, data);
}

/**
 * 加一条规则（已有同 id 则拒绝）。
 * @returns {{ ok: true, rules: object[] } | { ok: false, reason: string }}
 */
export function addUserRule(session, current, rule) {
  const normalized = normalizeUserRules([...(current ?? []), rule]);
  const rejected = normalized.rejected.find((item) => item.reason.indexOf('规则 id 重复') >= 0);
  if (rejected !== undefined) return { ok: false, reason: rejected.reason };
  if (normalized.rejected.length > 0) return { ok: false, reason: normalized.rejected[0].reason };
  if (normalized.rules.length > MAX_USER_RULES) {
    return { ok: false, reason: '规则表最多 ' + String(MAX_USER_RULES) + ' 条。' };
  }
  writeUserRules(session, normalized.rules);
  return { ok: true, rules: normalized.rules };
}

/** 删一条规则（按 id）。 */
export function removeUserRule(session, current, id) {
  const next = (current ?? []).filter((rule) => rule.id !== id);
  if (next.length === (current ?? []).length) return { ok: false, reason: '没有这条规则：' + id };
  writeUserRules(session, next);
  return { ok: true, rules: next };
}

/** 导出成 YAML 文本（D1）。 */
export function exportUserRulesYaml(rules) {
  return userRulesAsYaml(rules);
}

/**
 * 导入 YAML（D1）。解析失败不写盘。
 * @returns {{ ok: true, rules: object[] } | { ok: false, reason: string }}
 */
export function importUserRulesYaml(session, text) {
  const parsed = parseUserRulesYaml(text);
  if (parsed.rejected.length > 0) return { ok: false, reason: parsed.rejected[0].reason };
  writeUserRules(session, parsed.rules);
  return { ok: true, rules: parsed.rules };
}
