/**
 * lib/escalation.js — 升级工单的裁决（G5 收尾）
 *
 * 子代理没有审批权（宿主把委派策略钉成 never），所以子 Bot 撞上高危动作时，
 * 插件在 tools/pre-execute 把它拦下、写成一张工单、当场拒绝原调用，再唤醒主 Bot。
 * 这条链的细节在 team-units.js 里；这里是**收件箱这一侧**的规则。
 *
 * 04 方案 §9.6.3 的裁决边界（本文件全部遵守）：
 *   1. 裁决**只对升级工单**生效——原生 approval/request 的作答权完全在宿主手里，
 *      本文件不提供任何路径去放行它（红线 1）。
 *   2. 默认关闭（escalation.adjudicate = false）：收件箱只展示工单，人去 composer
 *      的原生审批卡裁决。打开才是「收件箱可直接裁决」。
 *   3. **critical 档永不可裁决**：高危七类里不可逆的那一档只能拒绝或改参数。
 *      这是 04 方案 §9.12 风险 11 的明确要求——裁决通道不能变成绕过口。
 *   4. 裁决结果写进 plugin:ops.escalation（同一个 id 回填状态），所以裁决是
 *      **可查的**：谁在什么时候批准了哪张工单，都在会话日志里。
 */

/** 裁决的两种结论。 */
export const ESCALATION_DECISIONS = ['approved', 'rejected'];

export const DEFAULT_ESCALATION_POLICY = Object.freeze({
  /** 收件箱可否直接裁决工单。默认 false（只读）。 */
  adjudicate: false,
});

/** 归一化升级策略。 */
export function normalizeEscalationPolicy(config) {
  const raw = config !== null && typeof config === 'object' ? (config.escalation ?? config) : {};
  const adjudicate = Object.hasOwn(raw, 'adjudicate') ? raw.adjudicate : DEFAULT_ESCALATION_POLICY.adjudicate;
  return { adjudicate: adjudicate === true };
}

/**
 * 裁决一张升级工单。
 *
 * @param {object} ticket 工单（ops.bots 投影里的那条）。
 * @param {string} decision 'approved' | 'rejected'
 * @param {object} policy 归一化后的升级策略。
 * @param {(ticket: object) => void} write 回写函数（写 plugin:ops.escalation）。
 * @returns {{ ok: true, ticket: object } | { ok: false, reason: string }}
 */
export function adjudicateEscalation(ticket, decision, policy, write) {
  if (policy.adjudicate !== true) {
    return {
      ok: false,
      reason: '收件箱目前只展示升级工单。要在这里裁决，请打开 escalation.adjudicate（默认关闭）。',
    };
  }
  if (!ESCALATION_DECISIONS.includes(decision)) {
    return { ok: false, reason: '裁决只能是 approved 或 rejected。' };
  }
  if (ticket === null || typeof ticket !== 'object') {
    return { ok: false, reason: '找不到这张工单。' };
  }
  if (ticket.risk === 'critical') {
    return {
      ok: false,
      reason: '高危动作不可裁决：critical 档只能拒绝或改参数（04 方案 §9.12 风险 11）。',
    };
  }
  if (ticket.status !== 'pending') {
    return { ok: false, reason: '这张工单已经裁决过了（当前状态：' + String(ticket.status) + '）。' };
  }
  const next = { ...ticket, status: decision };
  write(next);
  return { ok: true, ticket: next };
}

/**
 * 这条工单能不能被裁决（给界面用：决定要不要显示裁决按钮）。
 */
export function canAdjudicate(ticket, policy) {
  if (policy.adjudicate !== true) return false;
  if (ticket === null || typeof ticket !== 'object') return false;
  if (ticket.risk === 'critical') return false;
  return ticket.status === 'pending';
}
