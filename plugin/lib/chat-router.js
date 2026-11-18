/**
 * lib/chat-router.js — 把团队协作的三路信号汇进群聊（G1）
 *
 * 04 方案 §9.4.2 说群聊的数据来自三路复用、一路新写：
 *   1. Bot 的产出与状态（开始 / 结束）—— subagent/start、subagent/end
 *   2. 谁给谁派了活 —— send_message 引起的收件箱插入（agent/inbox/spliced）
 *   3. 需要人拍板 —— approval/asked + approval/decided（v1.0 已折进 ops.audit）
 *   4. 群聊对话本身 —— 无现成事件，走插件记录（plugin:ops.chat）
 *
 * 前三路都不是会话事件（subagent/* 是 Cordis 事件，收件箱插入发生在**子代理自己的**
 * 会话里），所以要汇进**根会话**的群聊，只能由 Host 侧转写：监听到信号后，
 * 往根会话写一条 plugin:ops.chat 记录。
 *
 * 为什么要转写而不是各会话各记各的：群聊页读的是当前会话（根会话）的 ops.chat
 * 投影。如果子代理的状态散在子会话里，根会话的群聊页就永远只看见「用户说了什么」。
 *
 * 红线：
 *   1. 只**记录**，不改变任何协作行为：不代发消息、不替谁派活、不打断。
 *   2. 写的是根会话的日志，所以它跟着根会话分叉与恢复走。
 */

import { writeChatMessage } from './team-units.js';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 取一段文本内容块的纯文本。 */
function textOf(content) {
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (isPlainObject(block) && block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.join('\n').trim();
}

/**
 * 注册三路信号监听。
 *
 * @param {object} ctx 插件上下文。
 * @returns {{ dispose: () => void }}
 */
export function makeChatRouter(ctx) {
  const agents = () => ctx.get('agents');
  const subagents = () => ctx.get('subagents');

  /** 某个 agent 的名字（拿不到就退回会话 id）。 */
  function nameOf(agent, fallback) {
    if (agent === undefined) return fallback;
    try {
      const names = subagents().namesOf(agent);
      if (names !== undefined && typeof names.self === 'string' && names.self.length > 0) return names.self;
    } catch {
      /* 取不到就用兜底 */
    }
    return fallback;
  }

  /** 根 agent（拿不到就返回 undefined）。 */
  function rootOf(agent) {
    if (agent === undefined) return undefined;
    try {
      const runtime = subagents();
      if (runtime === undefined || typeof runtime.rootOf !== 'function') return undefined;
      return runtime.rootOf(agent);
    } catch {
      return undefined;
    }
  }

  /** 按 session id 取 agent。 */
  function agentOf(sessionId) {
    try {
      const registry = agents();
      if (registry === undefined || typeof registry.get !== 'function') return undefined;
      return registry.get(sessionId);
    } catch {
      return undefined;
    }
  }

  /** 往根会话写一条群聊记录。失败不抛（协作信号不该把插件搞崩）。 */
  function toRoot(session, message) {
    if (!isPlainObject(session)) return;
    try {
      const agent = agentOf(session.id);
      const root = rootOf(agent);
      const target = root === undefined ? agent : root;
      if (target === undefined || target.session === undefined) return;
      writeChatMessage(target.session, message);
    } catch (error) {
      ctx.logger?.warn?.('[agent-ops] 群聊转写失败：' + String(error));
    }
  }

  const listeners = [];

  // ── 1. subagent/start ──────────────────────────────────────────
  listeners.push(ctx.on('subagent/start', (info) => {
    if (!isPlainObject(info)) return;
    const child = agentOf(info.id);
    const parent = agentOf(info.parentSessionId);
    const name = nameOf(child, typeof info.id === 'string' ? info.id : 'agent');
    const provider = typeof info.provider === 'string' ? info.provider : '';
    toRoot(parent?.session, {
      kind: 'system',
      from: name,
      text: '开始工作' + (provider.length > 0 ? '（' + provider + '）' : ''),
    });
  }));

  // ── 2. subagent/end ────────────────────────────────────────────
  listeners.push(ctx.on('subagent/end', (info) => {
    if (!isPlainObject(info)) return;
    const child = agentOf(info.id);
    const parent = agentOf(info.parentSessionId);
    const name = nameOf(child, typeof info.id === 'string' ? info.id : 'agent');
    const reason = typeof info.stopReason === 'string' ? info.stopReason : '';
    toRoot(parent?.session, {
      kind: 'system',
      from: name,
      text: '结束' + (reason.length > 0 ? '（' + reason + '）' : ''),
    });
  }));

  // ── 3. send_message → 收件箱插入 ───────────────────────────────
  listeners.push(ctx.on('session/event', (session, event) => {
    if (!isPlainObject(event) || event.type !== 'agent/inbox/spliced') return;
    if (!isPlainObject(session)) return;
    const data = isPlainObject(event.data) ? event.data : {};
    const inserted = Array.isArray(data.inserted) ? data.inserted : [];
    if (inserted.length === 0) return;
    const agent = agentOf(session.id);
    if (agent === undefined) return;
    const root = rootOf(agent);
    // 根会话自己的收件箱插入：会话日志里已经有了，不必再转写。
    if (root === undefined || root === agent) return;
    const names = (() => {
      try {
        return subagents().namesOf(agent);
      } catch {
        return undefined;
      }
    })();
    const to = names !== undefined && typeof names.self === 'string' ? names.self : 'agent';
    const from = names !== undefined && typeof names.parent === 'string' ? names.parent : 'lead';
    for (const message of inserted) {
      const text = textOf(isPlainObject(message) ? message.content : undefined);
      if (text.length === 0) continue;
      toRoot(root.session, { kind: 'handoff', from, to, text: text.slice(0, 2048) });
    }
  }));

  return {
    dispose() {
      for (const listener of listeners) {
        if (typeof listener === 'function') {
          try {
            listener();
          } catch {
            /* ignore */
          }
        }
      }
    },
  };
}
