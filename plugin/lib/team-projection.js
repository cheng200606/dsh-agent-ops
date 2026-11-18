/**
 * lib/team-projection.js — 两个 v1.1 投影：ops.chat（群聊流）与 ops.bots（角色与升级工单）
 *
 * 为什么这两个投影读的是**插件记录**而不是宿主事件：
 *   宿主曾有一对团队消息事件（team/message/queued、team/message/delivered），但它们已被标记
 *   Historical（新版本不再写入），所以群聊不能靠它们重建。宿主的 plugin record 通道
 *   （appendPluginRecord / pluginRecordOf）是唯一能写自定义数据、又保证「读不懂的实现安全跳过、
 *   分叉与恢复原样带走」的落盘方式——它自动带 ignorable: true。dsh-session/src/index.ts 的
 *   #appendRecord 原文：不认识的读者「retains and skips the record, which never enters the
 *   model-visible surface, and fork and resume carry it with the rest of the log」。
 *
 * 三条硬约束（与 ops.audit 完全一致，违反会静默失效）：
 *   1. apply 必须同步
 *   2. 不关心的事件必须返回同一个 state 引用（宿主用 Object.is 判定）
 *   3. state 必须是纯 JSON，wire.view 必须复用引用
 *
 * fork 继承过滤：init 收到的 inheritedEventCount 之前的记录属于父会话，群聊页只该显示本会话
 * 新说的话，所以 apply 在读取事件之前先比较 event.seq 与 state.inheritedEventCount
 * （照抄宿主 subagentCatalog 投影的写法）。
 */

export const CHAT_RECORD_TYPE = 'plugin:ops.chat';
export const BOT_RECORD_TYPE = 'plugin:ops.bot';
export const ESCALATION_RECORD_TYPE = 'plugin:ops.escalation';

export const CHAT_PROJECTION_KEY = 'ops.chat';
export const BOTS_PROJECTION_KEY = 'ops.bots';

const MAX_MESSAGES = 500;
const MAX_ESCALATIONS = 200;
const MAX_BOTS = 64;

// ──────────────────────────────────────────────────────────────
// 共用小工具（与 audit-projection.js 同风格：手写 validator，不引 zod，
// 避免宿主 4.6.6 与 profile 3.25.76 的版本冲突）
// ──────────────────────────────────────────────────────────────

function validator(label, check) {
  return {
    parse(value) {
      if (!check(value)) throw new Error('agent-ops: invalid ' + label);
      return value;
    },
  };
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string';
// 折叠出来的条目用 null 表示「没有」（纯 JSON 里 undefined 会被丢掉，字段就消失了），
// 所以校验必须同时接受 undefined、null 与字符串三种形态。
const optionalString = (value) => value === undefined || value === null || typeof value === 'string';

function pushBounded(list, item, max) {
  const next = list.length >= max ? list.slice(list.length - max + 1) : list.slice();
  next.push(item);
  return next;
}

function textOf(value, max) {
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) + '…' : value;
}

// ──────────────────────────────────────────────────────────────
// ops.chat
// ──────────────────────────────────────────────────────────────

const chatMessageSchema = validator('chat message', (value) => isPlainObject(value)
  && typeof value.seq === 'number'
  && typeof value.time === 'number'
  && (value.kind === 'message' || value.kind === 'system' || value.kind === 'escalation' || value.kind === 'handoff')
  && typeof value.from === 'string'
  && optionalString(value.to)
  && typeof value.text === 'string');

const chatCountersSchema = validator('chat counters', (value) => isPlainObject(value)
  && typeof value.messages === 'number'
  && typeof value.system === 'number'
  && typeof value.escalations === 'number');

export const chatStateSchema = validator('chat state', (value) => isPlainObject(value)
  && typeof value.inheritedEventCount === 'number'
  && Array.isArray(value.messages)
  && value.messages.every((item) => chatMessageSchema.parse(item) !== undefined)
  && chatCountersSchema.parse(value.counters) !== undefined);

export const chatViewSchema = validator('chat view', (value) => isPlainObject(value)
  && Array.isArray(value.messages)
  && value.messages.every((item) => chatMessageSchema.parse(item) !== undefined)
  && chatCountersSchema.parse(value.counters) !== undefined);

function emptyChatState(inheritedEventCount) {
  return {
    inheritedEventCount: typeof inheritedEventCount === 'number' ? inheritedEventCount : 0,
    messages: [],
    counters: { messages: 0, system: 0, escalations: 0 },
  };
}

const chatViewMemo = new WeakMap(); // messages → WeakMap(counters → view)

/** 引用复用：同一组 (messages, counters) 永远返回同一个 view 对象。 */
function chatViewOf(state) {
  let byCounters = chatViewMemo.get(state.messages);
  if (byCounters === undefined) {
    byCounters = new WeakMap();
    chatViewMemo.set(state.messages, byCounters);
  }
  let view = byCounters.get(state.counters);
  if (view === undefined) {
    view = { messages: state.messages, counters: state.counters };
    byCounters.set(state.counters, view);
  }
  return view;
}

function foldChatRecord(state, event) {
  const data = isPlainObject(event.data) ? event.data : {};
  const kind = data.kind === 'system' || data.kind === 'escalation' || data.kind === 'handoff' ? data.kind : 'message';
  const from = isString(data.from) && data.from.length > 0 ? data.from : 'unknown';
  const message = {
    seq: event.seq,
    time: event.time,
    kind,
    from,
    to: isString(data.to) && data.to.length > 0 ? data.to : null,
    text: textOf(data.text, 2048),
  };
  const counters = {
    messages: state.counters.messages + (kind === 'message' ? 1 : 0),
    system: state.counters.system + (kind === 'system' ? 1 : 0),
    escalations: state.counters.escalations + (kind === 'escalation' ? 1 : 0),
  };
  return {
    ...state,
    messages: pushBounded(state.messages, message, MAX_MESSAGES),
    counters,
  };
}

export const chatProjectionDefinition = {
  key: CHAT_PROJECTION_KEY,
  stateVersion: 1,
  stateSchema: chatStateSchema,
  init: (_header, inheritedEventCount) => emptyChatState(inheritedEventCount),
  apply(state, event) {
    if (event === null || typeof event !== 'object') return state;
    if (event.type !== CHAT_RECORD_TYPE) return state;
    if (typeof event.seq === 'number' && event.seq < state.inheritedEventCount) return state;
    return foldChatRecord(state, event);
  },
  wire: { viewSchema: chatViewSchema, view: chatViewOf, summary: false },
};

// ──────────────────────────────────────────────────────────────
// ops.bots：角色声明 + 升级工单
// ──────────────────────────────────────────────────────────────

const botSchema = validator('bot', (value) => isPlainObject(value)
  && typeof value.name === 'string'
  && typeof value.role === 'string'
  && optionalString(value.title)
  && optionalString(value.preset)
  && typeof value.main === 'boolean');

const escalationSchema = validator('escalation', (value) => isPlainObject(value)
  && typeof value.id === 'string'
  && typeof value.seq === 'number'
  && typeof value.time === 'number'
  && typeof value.toolName === 'string'
  && typeof value.ruleId === 'string'
  && typeof value.category === 'string'
  && typeof value.risk === 'string'
  && typeof value.from === 'string'
  && typeof value.status === 'string'
  && optionalString(value.argsSummary));

export const botsStateSchema = validator('bots state', (value) => isPlainObject(value)
  && typeof value.inheritedEventCount === 'number'
  && Array.isArray(value.bots)
  && value.bots.every((item) => botSchema.parse(item) !== undefined)
  && Array.isArray(value.escalations)
  && value.escalations.every((item) => escalationSchema.parse(item) !== undefined));

export const botsViewSchema = validator('bots view', (value) => isPlainObject(value)
  && Array.isArray(value.bots)
  && value.bots.every((item) => botSchema.parse(item) !== undefined)
  && Array.isArray(value.escalations)
  && value.escalations.every((item) => escalationSchema.parse(item) !== undefined)
  && typeof value.mainName === 'string');

function emptyBotsState(inheritedEventCount) {
  return {
    inheritedEventCount: typeof inheritedEventCount === 'number' ? inheritedEventCount : 0,
    bots: [],
    escalations: [],
  };
}

const botsViewMemo = new WeakMap();

function botsViewOf(state) {
  let byEscalations = botsViewMemo.get(state.bots);
  if (byEscalations === undefined) {
    byEscalations = new WeakMap();
    botsViewMemo.set(state.bots, byEscalations);
  }
  let view = byEscalations.get(state.escalations);
  if (view === undefined) {
    const main = state.bots.find((bot) => bot.main === true);
    view = {
      bots: state.bots,
      escalations: state.escalations,
      mainName: main === undefined ? '' : main.name,
    };
    byEscalations.set(state.escalations, view);
  }
  return view;
}

/** 同一个名字再声明就覆盖（按 name 去重，保持「名册里一个名字一行」）。 */
function upsertBot(bots, bot) {
  const next = bots.filter((item) => item.name !== bot.name);
  next.push(bot);
  return next.length > MAX_BOTS ? next.slice(next.length - MAX_BOTS) : next;
}

function foldBotRecord(state, event) {
  const data = isPlainObject(event.data) ? event.data : {};
  const name = isString(data.name) ? data.name : '';
  if (name.length === 0) return state;
  const bot = {
    name,
    role: isString(data.role) ? data.role : 'custom',
    title: isString(data.title) ? data.title : null,
    preset: isString(data.preset) && data.preset.length > 0 ? data.preset : null,
    main: data.main === true,
  };
  // 主 Bot 全局唯一：声明新的主 Bot 就把旧的降级。
  const bots = upsertBot(state.bots, bot).map((item) => (
    bot.main && item.name !== bot.name && item.main ? { ...item, main: false } : item
  ));
  return { ...state, bots };
}

function foldEscalationRecord(state, event) {
  const data = isPlainObject(event.data) ? event.data : {};
  const id = isString(data.id) && data.id.length > 0 ? data.id : 'esc-' + event.seq;
  const index = state.escalations.findIndex((item) => item.id === id);
  if (index >= 0) {
    const status = isString(data.status) ? data.status : state.escalations[index].status;
    const escalations = state.escalations.slice();
    escalations[index] = { ...escalations[index], status };
    return { ...state, escalations };
  }
  const ticket = {
    id,
    seq: event.seq,
    time: event.time,
    toolName: isString(data.toolName) ? data.toolName : '',
    ruleId: isString(data.ruleId) ? data.ruleId : '',
    category: isString(data.category) ? data.category : '',
    risk: isString(data.risk) ? data.risk : '',
    from: isString(data.from) ? data.from : 'unknown',
    status: isString(data.status) ? data.status : 'pending',
    argsSummary: textOf(data.argsSummary, 400),
  };
  return { ...state, escalations: pushBounded(state.escalations, ticket, MAX_ESCALATIONS) };
}

export const botsProjectionDefinition = {
  key: BOTS_PROJECTION_KEY,
  stateVersion: 1,
  stateSchema: botsStateSchema,
  init: (_header, inheritedEventCount) => emptyBotsState(inheritedEventCount),
  apply(state, event) {
    if (event === null || typeof event !== 'object') return state;
    if (typeof event.seq === 'number' && event.seq < state.inheritedEventCount) return state;
    if (event.type === BOT_RECORD_TYPE) return foldBotRecord(state, event);
    if (event.type === ESCALATION_RECORD_TYPE) return foldEscalationRecord(state, event);
    return state;
  },
  wire: { viewSchema: botsViewSchema, view: botsViewOf, summary: false },
};
