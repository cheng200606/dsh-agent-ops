/**
 * lib/rules/guard.js — 把判定结果翻译成宿主认得的两条通道
 *
 * 通道 1：tools/pre-execute 的 PreToolDecision（可以返回 ask，让人来拍板）
 * 通道 2：tools.guard 的 ToolGuardDenial（只能拒绝，没有 allow 分支）
 *
 * 为什么必须两条都用：PreToolDecision 的 ask 会被后续监听器或审批策略改写成别的东西
 * （例如 approval 策略为 never 时直接变拒绝，或者 auto-review 插件把它变 allow）；
 * 而 guard 在 prepare() 的最后一步、所有 pre-execute 监听器之后执行，
 * 且类型上不存在「放行」这个返回值——所以「硬拦」必须落在 guard 上，顺序无法把它翻回去。
 */

import { evaluate } from './policy.js';

/** 稳定标识，落在 tool/result 的 error.info.code 上，审计投影靠它识别围栏条目。 */
export const FENCE_ERROR_NAME = 'AgentOpsFenceDenied';
export const FENCE_ERROR_CODE = 'AGENT_OPS_FENCED';

/** 拒绝理由里带上规则 id，人读日志时不用再查表。 */
export function fenceReason(hit) {
  return 'blocked by fence: ' + hit.ruleId + ' (' + hit.note.en + ')';
}

/** 提问卡片上显示的中英双语理由。 */
export function askDisplayReason(hit) {
  return {
    en: 'Agent Ops: ' + hit.note.en + ' [' + hit.category + '/' + hit.risk + ']',
    zh: '运行台：' + hit.note.zh + ' [' + hit.category + '/' + hit.risk + ']',
  };
}

/** 通道 2：guard 拒绝值。info.reason 是给投影看的原始结构化细节（模型看不到）。 */
export function toGuardDenial(hit) {
  return {
    reason: fenceReason(hit),
    info: {
      name: FENCE_ERROR_NAME,
      code: FENCE_ERROR_CODE,
      reason: hit.ruleId + '|' + hit.category + '|' + hit.risk,
    },
  };
}

/** 通道 1：pre-execute 的 ask 决定。 */
export function toAskDecision(hit) {
  return {
    kind: 'ask',
    reason: 'agent-ops: ' + hit.ruleId,
    displayReason: askDisplayReason(hit),
  };
}

/** 供 Host 半直接使用的两个入口，保持「判定只有一处」的不变式。 */
export function makeGuard(policy, rulesOf) {
  return function guard(execution) {
    const decision = evaluate(execution.name, execution.arguments, policy, rulesFor(execution, rulesOf));
    return decision.kind === 'deny' ? toGuardDenial(decision.hit) : undefined;
  };
}

export function makePreExecute(policy, rulesOf) {
  return function preExecute(execution) {
    const decision = evaluate(execution.name, execution.arguments, policy, rulesFor(execution, rulesOf));
    return decision.kind === 'ask' ? toAskDecision(decision.hit) : undefined;
  };
}

/**
 * 取本次调用所在会话的用户规则表。
 *
 * 规则表是会话级的（存在会话日志的插件记录里），所以判定时必须按 execution.agent
 * 找到它所属的会话，再读那张表。拿不到就退回策略里的全局表——宁可少几条用户规则，
 * 也不能让整条围栏失效。
 */
function rulesFor(execution, rulesOf) {
  if (typeof rulesOf !== 'function') return undefined;
  try {
    const session = execution.agent === undefined ? undefined : execution.agent.session;
    if (session === undefined) return undefined;
    return rulesOf(session);
  } catch {
    return undefined;
  }
}

/** 解析围栏拒绝条目里的结构化 info.reason（投影侧用）。 */
export function parseDenialDetail(info) {
  if (info === null || typeof info !== 'object') return undefined;
  if (info.code !== FENCE_ERROR_CODE) return undefined;
  const raw = typeof info.reason === 'string' ? info.reason : '';
  const parts = raw.split('|');
  if (parts.length !== 3) return undefined;
  return { ruleId: parts[0], category: parts[1], risk: parts[2] };
}
