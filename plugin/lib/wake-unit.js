/**
 * lib/wake-unit.js — L2 唤醒（G8）
 *
 * 打扰分级三档里只有 L2 会花钱：对根 agent 调 followup() 开一轮。所以它必须住在
 * **Host 侧**（只有 Host 能碰到 agent），而且必须受**每日预算**约束。
 *
 * 三条纪律：
 *   1. 只唤醒根会话——子代理的会话不唤醒（唤醒子代理等于让它在自己那一轮里插话）。
 *   2. 每个候选只唤醒一次（同一 id 不重复）。
 *   3. 预算用完就不再唤醒（默认每天 3 次）。超预算时只记日志，不打扰用户。
 *
 * 用 followup() 而不是 inject()：宿主原文——inject「不唤醒驱动」，那这条建议就永远
 * 不会被处理；followup 才会开新一轮。
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm';

import { candidatesFromEvent, createWakeBudget, gradeCandidate, triggerPolicy } from './triggers.js';

const SIGNAL_EVENTS = new Set(['todo/write', 'goal/change', 'team/task', 'workspace/changes', 'deliverables/presented']);

/**
 * @param {object} ctx 插件上下文。
 * @returns {{ budget: object, dispose: () => void }}
 */
export function makeWakeUnit(ctx) {
  const policy = triggerPolicy();
  const budget = createWakeBudget({ limit: policy.dailyWakeBudget });
  /** sessionId → 已经唤醒过的候选 id。 */
  const woken = new Map();

  function rootAgentOf(session) {
    const agents = ctx.get('agents');
    if (agents === undefined || typeof agents.get !== 'function') return undefined;
    try {
      return agents.get(session.id);
    } catch {
      return undefined;
    }
  }

  async function onSessionEvent(session, event) {
    if (policy.wakeEnabled !== true) return;
    if (session === null || typeof session !== 'object') return;
    // 只唤醒根会话：子代理的会话有自己的轮次结构，插话会打乱它。
    if (session.origin === 'subagent') return;
    if (!SIGNAL_EVENTS.has(event.type)) return;

    const candidates = candidatesFromEvent(event);
    if (candidates.length === 0) return;

    const seen = woken.get(session.id) ?? new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate.id)) continue;
      const graded = gradeCandidate(candidate, policy, { now: Date.now() });
      if (graded.level !== 'L2') continue;
      if (!budget.consume()) {
        ctx.logger?.warn?.('[agent-ops] L2 唤醒预算已用尽（每天 ' + String(budget.limit) + ' 次），本条建议不再唤醒：' + candidate.title);
        seen.add(candidate.id);
        continue;
      }
      const agent = rootAgentOf(session);
      if (agent === undefined) {
        ctx.logger?.warn?.('[agent-ops] 找不到根 agent，无法唤醒：' + candidate.id);
        seen.add(candidate.id);
        continue;
      }
      const text = '[Agent Ops 主动建议] ' + candidate.title
        + '（来源：' + candidate.kind + '，紧急度：' + candidate.urgency + '）'
        + ' 需要你决定是否处理；这条建议可以在运行台的「建议」页忽略。';
      try {
        agent.followup(createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'agent-ops', form: 'notice', summary: 'Agent Ops 有一条建议等你处理' },
        }));
        seen.add(candidate.id);
      } catch (error) {
        ctx.logger?.warn?.('[agent-ops] L2 唤醒失败：' + String(error));
      }
    }
    woken.set(session.id, seen);
  }

  const listener = ctx.on('session/event', onSessionEvent);

  return {
    budget,
    dispose() {
      if (typeof listener === 'function') listener();
    },
  };
}
