/**
 * lib/approval-index.js — 审批旁听索引（进程内，不落盘）
 *
 * 这是「只观测、不改写」的那一半：Host 半挂一个 approval/request 监听器，
 * 在把请求交给真正的应答者之前先记一笔，再 await next() 拿到最终结论。
 *
 * 为什么必须 next() 透传而不是自己作答：
 *   宿主的分发是 waterfall，第一个返回结论的监听器就终结整条链。
 *   我们一旦直接 return 'allowed-once' 或 'rejected'，就等于抢走了
 *   桌面 GUI 审批卡片的作答权——这是本插件第一条红线。
 *
 * 索引只活在内存里，不写会话日志：会话日志的权威审计是 ops.audit 投影
 * （它折叠宿主自己的 approval/asked + approval/decided）。这里存在的意义是
 * 「此刻有哪些审批在飞、刚刚那笔花了多久」，属于运行时状态，不适合落盘。
 */

/**
 * @param {{limit?: number}} [options] 保留多少条最近记录。
 */
export function createApprovalIndex(options = {}) {
  const limit = Number.isSafeInteger(options.limit) && options.limit > 0 ? options.limit : 200;
  /** @type {Map<string, {key: string, startedAt: number, tool: string, reason: string | null}>} */
  const pending = new Map();
  /** @type {Array<object>} */
  const recent = [];
  let counter = 0;

  /** 记下一条即将进入审批的请求。 */
  function begin(request) {
    counter += 1;
    const callId = request !== null && typeof request === 'object' && typeof request.callId === 'string' && request.callId.length > 0
      ? request.callId
      : 'pending-' + counter;
    const ticket = {
      key: callId,
      startedAt: Date.now(),
      tool: request !== null && typeof request === 'object' && typeof request.toolName === 'string' ? request.toolName : '',
      reason: request !== null && typeof request === 'object' && typeof request.reason === 'string' ? request.reason : null,
    };
    pending.set(callId, ticket);
    return ticket;
  }

  /** 记下结论并清掉在飞标记。outcome 是宿主词表：allowed-once / rejected / cancelled / unavailable。 */
  function settle(ticket, outcome, error) {
    if (ticket === undefined || ticket === null) return;
    pending.delete(ticket.key);
    recent.push({
      key: ticket.key,
      tool: ticket.tool,
      reason: ticket.reason,
      startedAt: ticket.startedAt,
      outcome: typeof outcome === 'string' ? outcome : 'unavailable',
      durationMs: Date.now() - ticket.startedAt,
      ...(error === undefined ? {} : { error: String(error && error.message ? error.message : error) }),
    });
    while (recent.length > limit) recent.shift();
  }

  return {
    begin,
    settle,
    /** 只读快照，给未来的「审批收件箱」（R-A2）用。 */
    snapshot: () => ({ pending: [...pending.values()], recent: recent.slice() }),
    get size() {
      return pending.size;
    },
  };
}
