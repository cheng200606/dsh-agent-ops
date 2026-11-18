/**
 * lib/team-units.js —— v1.1 的三个 Host 单元：群聊记录、群聊命令、升级工单
 *
 * 三个单元共用一个落盘通道：宿主的 plugin record（appendPluginRecord）。
 * 它自动带 ignorable: true，所以：
 *   · 不认识该记录类型的旧版本读者会**跳过**它而不是拒绝整条日志；
 *   · 分叉与恢复原样带走它，群聊历史跟着会话走。
 *
 * 红线（写在这里提醒未来的自己）：
 *   1. 插件**不抢**任何权限判定 —— 升级工单只记录，执行与否仍由宿主的审批链决定。
 *   2. 插件**不自造轮次** —— 唤醒主 Bot 只能用 followup()/steer()，绝不用 inject()（inject 明确不唤醒驱动）。
 *   3. 记录必须是纯 JSON —— 宿主对不可序列化的数据直接抛错。
 */

import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

import { evaluate } from './rules/policy.js';
import { argumentsText } from './rules/classify.js';
import { findRole, roleIds } from './roles.js';
import {
  CHAT_RECORD_TYPE,
  BOT_RECORD_TYPE,
  ESCALATION_RECORD_TYPE,
  chatProjectionDefinition,
  botsProjectionDefinition,
} from './team-projection.js';

const MAX_TEXT = 2048;
const MAX_ARGS = 400;

export const CHAT_COMMAND_NAME = 'ops-say';
export const BOT_COMMAND_NAME = 'ops-bot';

function clamp(value, max) {
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) + '…' : value;
}

function argsSummaryOf(execution) {
  try {
    const text = typeof execution.arguments === 'string'
      ? execution.arguments
      : argumentsText(execution.arguments);
    return clamp(text, MAX_ARGS);
  } catch {
    return '';
  }
}

// ──────────────────────────────────────────────────────────────
// 单元 5：群聊记录写入（插件记录）
// ──────────────────────────────────────────────────────────────

/** 写一条群聊消息。session 必须属于某个 SessionStore（宿主强制）。 */
export function writeChatMessage(session, message) {
  const data = {
    version: 1,
    kind: message.kind === 'system' || message.kind === 'escalation' || message.kind === 'handoff'
      ? message.kind
      : 'message',
    from: typeof message.from === 'string' && message.from.length > 0 ? message.from : 'unknown',
    text: clamp(message.text, MAX_TEXT),
  };
  if (typeof message.to === 'string' && message.to.length > 0) data.to = message.to;
  return appendPluginRecord(session, CHAT_RECORD_TYPE, data);
}

/** 声明一个角色（名册行）。name 为空的声明被忽略，避免名册里出现空行。 */
export function writeBot(session, bot) {
  const name = typeof bot.name === 'string' ? bot.name.trim() : '';
  if (name.length === 0) return undefined;
  const data = { version: 1, name, role: typeof bot.role === 'string' ? bot.role : 'custom' };
  if (typeof bot.title === 'string' && bot.title.length > 0) data.title = bot.title;
  if (bot.main === true) data.main = true;
  // preset：这一行对应哪个角色包（八类开箱角色之一）。留空表示自定义角色。
  if (typeof bot.preset === 'string' && bot.preset.length > 0) data.preset = bot.preset;
  return appendPluginRecord(session, BOT_RECORD_TYPE, data);
}

/**
 * 写升级工单。同一个 id 再写就是状态回填（pending → approved / rejected）。
 * 这是 G5 唯一的落盘出口：审批结论也走这里，不再造第二种记录。
 */
export function writeEscalation(session, ticket) {
  const data = {
    version: 1,
    id: String(ticket.id),
    toolName: typeof ticket.toolName === 'string' ? ticket.toolName : '',
    ruleId: typeof ticket.ruleId === 'string' ? ticket.ruleId : '',
    category: typeof ticket.category === 'string' ? ticket.category : '',
    risk: typeof ticket.risk === 'string' ? ticket.risk : '',
    from: typeof ticket.from === 'string' && ticket.from.length > 0 ? ticket.from : 'unknown',
    status: typeof ticket.status === 'string' ? ticket.status : 'pending',
    argsSummary: clamp(ticket.argsSummary, MAX_ARGS),
  };
  return appendPluginRecord(session, ESCALATION_RECORD_TYPE, data);
}

// ──────────────────────────────────────────────────────────────
// 单元 6：群聊命令（UI → Host 的唯一通道）
// ──────────────────────────────────────────────────────────────

/**
 * 注册 /ops-say 与 /ops-bot。
 *
 * 为什么用 slash 命令而不是自造输入框：宿主的输入管线已经把 `/xxx` 解析成命令并落到
 * command/run + command/done 事件，客户端一条 ctx.remote.commands.execute 就能触发，
 * 不需要我们维护第二条输入通道，也不会绕过宿主的会话锁与排队。
 *
 * 命令名受宿主约束：/^[a-z][a-z0-9_-]*$/u（不许点号、不许大写）。
 */
export function registerChatCommands(ctx) {
  const disposers = [];

  disposers.push(ctx.commands.register({
    name: CHAT_COMMAND_NAME,
    description: '在运行台群聊里说一句话（@名字 指定收件人）。',
    input: { hint: '[@名字] 内容' },
    recordInput: true,
    handler(invocation) {
      const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput.trim() : '';
      if (raw.length === 0) return { kind: 'error', text: '用法：/ops-say [@名字] 内容' };
      let from = 'lead';
      let to;
      let text = raw;
      const mention = /^@([a-z0-9][a-z0-9-]{0,31})\s+([\s\S]*)$/u.exec(raw);
      if (mention !== null) {
        to = mention[1];
        text = mention[2];
        from = 'lead';
      }
      if (text.trim().length === 0) return { kind: 'error', text: '内容不能为空。' };
      const message = { from, text };
      if (to !== undefined) message.to = to;
      let seq;
      try {
        seq = writeChatMessage(invocation.agent.session, message);
      } catch (error) {
        return { kind: 'error', text: '群聊记录写入失败：' + String(error && error.message ? error.message : error) };
      }
      const where = to === undefined ? '全员' : '@' + to;
      return { kind: 'success', text: '已发给' + where + '（seq ' + String(seq) + '）', sourceEventSeq: seq };
    },
  }));

  disposers.push(ctx.commands.register({
    name: BOT_COMMAND_NAME,
    description: '声明一个 Bot 角色：/ops-bot <名字> <角色|preset id> [--main] [--title 标题]。',
    input: { hint: '<名字> <角色> [--main]' },
    recordInput: true,
    handler(invocation) {
      const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput.trim() : '';
      const parts = raw.split(/\s+/u).filter((item) => item.length > 0);
      if (parts.length < 2) {
        return { kind: 'error', text: '用法：/ops-bot <名字> <角色> [--main] [--title 标题]\n可用角色包：' + roleIds().join('、') };
      }
      const name = parts[0];
      if (!/^[a-z0-9][a-z0-9-]{0,31}$/u.test(name)) {
        return { kind: 'error', text: '名字只能用小写字母、数字与连字符（1–32 位）。' };
      }
      if (name === 'lead') return { kind: 'error', text: 'lead 是根代理的保留名，不能再用作角色名。' };
      const flags = new Set();
      let title;
      const positional = [];
      for (let i = 1; i < parts.length; i += 1) {
        const token = parts[i];
        if (token === '--main') { flags.add('main'); continue; }
        if (token === '--title') { title = parts.slice(i + 1).join(' '); break; }
        positional.push(token);
      }
      const role = positional[0];
      if (role === undefined) return { kind: 'error', text: '缺角色，例如 /ops-bot scout researcher。' };
      // 角色名如果正好是八类开箱角色之一，就记下它的 preset id：
      // 名字在名册里显示 preset 的中文名，spawn 时用 subagent 的 agent_preset 参数选它。
      const known = findRole(role);
      const bot = { name, role: known === undefined ? role : known.name };
      if (known !== undefined) bot.preset = known.id;
      if (title !== undefined) bot.title = title;
      if (flags.has('main')) bot.main = true;
      try {
        writeBot(invocation.agent.session, bot);
      } catch (error) {
        return { kind: 'error', text: '名册写入失败：' + String(error && error.message ? error.message : error) };
      }
      const presetHint = known === undefined ? '' : '（角色包 ' + known.id + '：用 subagent 的 agent_preset 选它）';
      return {
        kind: 'success',
        text: '已登记 ' + name + '（' + bot.role + '）' + (bot.main === true ? '，并设为主 Bot' : '') + presetHint,
      };
    },
  }));

  return disposers;
}

// ──────────────────────────────────────────────────────────────
// 单元 7：升级工单（G5）
// ──────────────────────────────────────────────────────────────

export const ESCALATED_ERROR_NAME = 'AgentOpsEscalated';
export const ESCALATED_ERROR_CODE = 'AGENT_OPS_ESCALATED';

/**
 * 子代理没有审批权（宿主把委派策略钉成 never），所以它在高危动作上永远拿不到人的答复。
 * 这一单元把那类调用**转成一张工单交给主 Bot**，并当场拒绝原调用：
 *
 *   子 Bot 想删根目录
 *     → tools/pre-execute 判定命中 ask 档
 *     → 写 plugin:ops.escalation 到**根会话**（只有根会话的名册页能看到它）
 *     → 拒绝本次调用，错误码 AGENT_OPS_ESCALATED，理由里带工单 id
 *     → 唤醒主 Bot（followup）让它自己决定要不要向人申请、要不要重执行
 *
 * 为什么是「拒绝 + 重执行」而不是「挂起等答复」：审批必须发生在**未结束的轮次内**，
 * 子代理的工具调用是另一个 Agent 的另一个轮次，挂起只会留下永不结算的 Promise。
 */
export function makeEscalationUnit(ctx, policy) {
  // 唤醒节流：同一 (工具, 参数) 在窗口内只唤醒一次，避免主 Bot 被反复吵醒。
  const recent = new Map();
  const WINDOW_MS = 60000;

  function shouldWake(key) {
    const now = Date.now();
    const last = recent.get(key);
    if (last !== undefined && now - last < WINDOW_MS) return false;
    recent.set(key, now);
    if (recent.size > 200) {
      const cutoff = now - WINDOW_MS;
      for (const [item, at] of recent) if (at < cutoff) recent.delete(item);
    }
    return true;
  }

  function rootOf(agent) {
    const subagents = ctx.get('subagents');
    if (subagents === undefined || typeof subagents.rootOf !== 'function') return undefined;
    try {
      return subagents.rootOf(agent);
    } catch {
      return undefined;
    }
  }

  function nameOf(agent) {
    const subagents = ctx.get('subagents');
    try {
      const names = subagents === undefined ? undefined : subagents.namesOf(agent);
      return names !== undefined && typeof names.self === 'string' ? names.self : 'bot';
    } catch {
      return 'bot';
    }
  }

  function wake(agent, text) {
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      // 宿主明确允许生产者声明自己的 source kind，未知 kind 由消费者 fall through；
      // 用 notice 形态带一句摘要，模型上下文里它显示为一条提示而不是人类发话。
      source: { kind: 'agent-ops', form: 'notice', summary: clamp(text, 120) },
    });
    // followup 才会唤醒驱动；inject 明确「不唤醒」（宿主原文 without waking the driver）。
    agent.followup(message);
  }

  return async function escalate(execution) {
    if (execution.agent === undefined) return undefined;
    const decision = evaluate(execution.name, execution.arguments, policy);
    // 只有「需要人拍板」的那一档才升级；硬拦档交给 guard，允许档与我们无关。
    if (decision.kind !== 'ask') return undefined;
    const root = rootOf(execution.agent);
    // 根代理自己发起的调用走宿主原生审批链，插件不插手（红线：不抢作答权）。
    if (root === undefined || root === execution.agent) return undefined;

    const rootSession = root.session;
    const ticketId = 'esc-' + String(rootSession.seq) + '-' + Date.now().toString(36);
    const summary = argsSummaryOf(execution);
    const fromName = nameOf(execution.agent);

    try {
      writeEscalation(rootSession, {
        id: ticketId,
        toolName: execution.name,
        ruleId: decision.hit.ruleId,
        category: decision.hit.category,
        risk: decision.hit.risk,
        from: fromName,
        status: 'pending',
        argsSummary: summary,
      });
    } catch (error) {
      ctx.logger?.warn?.('[agent-ops] escalation record failed: ' + String(error));
    }

    if (shouldWake(execution.name + '|' + summary)) {
      try {
        wake(root, [
          '[Agent Ops 升级工单 ' + ticketId + ']',
          '子代理 ' + fromName + ' 想执行 ' + execution.name + '，命中规则 ' + decision.hit.ruleId
            + '（' + decision.hit.category + ' / ' + decision.hit.risk + '）。',
          '该调用已被拒绝，没有产生任何副作用。',
          '工单在运行台「团队」页可见；需要人工拍板时请在本轮内发起审批，获准后再由你重新执行同样动作。',
        ].join(' '));
      } catch (error) {
        ctx.logger?.warn?.('[agent-ops] escalation wake failed: ' + String(error));
      }
    }

    // 当场拒绝原调用：错误码让审计时间线能把这次拦截与围栏硬拦区分开。
    return {
      kind: 'deny',
      reason: 'agent-ops: escalated to ' + ticketId + ' (' + decision.hit.ruleId + ')',
      info: {
        name: ESCALATED_ERROR_NAME,
        code: ESCALATED_ERROR_CODE,
        reason: ticketId + '|' + decision.hit.ruleId + '|' + decision.hit.category + '|' + decision.hit.risk,
      },
    };
  };
}

/**
 * 把两个 v1.1 投影注册进宿主的投影表。注册归本插件 fiber 所有。
 *
 * @returns {Promise<object>} ops.bots 投影的 handle（升级工单裁决要读它的 state）。
 */
export async function registerTeamProjections(ctx) {
  await ctx.sessionProjections.register(chatProjectionDefinition);
  const botsHandle = await ctx.sessionProjections.register(botsProjectionDefinition);
  return botsHandle;
}
