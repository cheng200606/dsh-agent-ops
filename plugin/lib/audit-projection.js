/**
 * lib/audit-projection.js — ops.audit 会话投影
 *
 * 这是本插件「只读审计面」的全部数据来源。之所以做成投影而不是自建 HTTP 通道：
 * 投影由宿主按会话日志增量维护并自动 wire 给客户端，插件不需要任何传输层、
 * 不需要额外权限、也不会在日志里塞进非标准事件（我们只折叠宿主已有的事件类型）。
 *
 * 折叠的事件（全部是 KNOWN_SESSION_EVENT_TYPES 里的，零兼容风险）：
 *   approval/asked      → 一条 pending 审批条目，counters.asked++
 *   approval/decided    → 回填该条目的 outcome，counters.allowed/denied++
 *   tool/result         → 若 error.info.code === 'AGENT_OPS_FENCED'，记一条围栏条目，counters.blocked++
 *                         若 error.code === 'AUTO_REVIEW_DENIED'，记一条自动拒绝条目，counters.reviewed++
 *                         两种 error 形状不同：围栏走 error.info（我们自己的 guard 返回的 detail），
 *                         自动拒绝走 error 顶层（宿主 AutoReviewDeniedError 的 code/name/reason）。
 *   tool/call           → 只为围栏条目记住「哪个工具被拦了」（有界 FIFO，不进 wire）
 *   sandbox/mode        → env.sandbox
 *   approval/policy     → env.approval
 *   permission/preset   → env.preset
 *
 * 四条硬约束（宿主契约，违反会静默失效或破坏一致性）：
 *   1. apply 必须同步（不能返回 Promise）
 *   2. 不关心的事件必须返回**同一个 state 引用**（宿主用 Object.is 判定，相同即零下游工作）
 *   3. state 必须是纯 JSON（宿主会做 JSON 快照并 freeze）
 *   4. wire.view 必须复用引用（宿主比较相邻两次 view() 返回值的 Object.is 身份，见下文 viewOf）
 *
 * stateVersion 变更史：
 *   1 — 初版（M0/M1）
 *   2 — decided 条目补 decidedTime（收件箱要算等待时长）；view 改为引用复用
 *   3 — 新增第三种条目 kind:'review'（Auto review 拒绝）与 counters.reviewed。
 *       加版本号是必须的：旧 checkpoint 里没有这个计数器，宿主会丢弃陈旧 checkpoint 重放尾部。
 *   4 — 新增 hits（规则命中计数：ruleId → 次数 + 最后命中时间，A3 的验收口径）。
 *       同样必须 +1：旧 checkpoint 里没有这张表，宿主会丢弃陈旧 checkpoint 重放尾部。
 *
 * view 的构成（M3 起）：entries / counters / env 来自 state，rules / policy 是**常量引用**
 * （规则表与当前策略在插件生命周期内不变）。放进 view 而不是另开通道，是因为客户端 bundle
 * 是零构建的、import 不到宿主模块——把静态表挂在已有的投影通道上，既不新增传输层，
 * 也不会每次折叠都换引用（常量对象身份恒定，Object.is 判定依旧成立）。
 */

/** 落在 tool/result 的 error.info.code 上，与 rules/guard.js 的 FENCE_ERROR_CODE 必须一致。 */
const FENCE_ERROR_CODE = 'AGENT_OPS_FENCED';

/**
 * 宿主的 Auto review 拒绝码（@deepseek-ai/dsh-experimental-auto-review）。
 *
 * 落盘形状（从宿主源码三段串起来看，别只看渲染端）：
 *   1. 拦截决策本身（auto-review/src/index.ts:696-706 denied()）：
 *        { kind:'deny', reason, info: { name:'AutoReviewDeniedError', code:'AUTO_REVIEW_DENIED', ...reason? } }
 *   2. dsh-tools/src/pipeline.ts:216-224 把它装成 ToolExecutionResult：
 *        error: { message: denialReason, info: denialInfo }
 *   3. dsh-tools/src/batch.ts:252-266（BatchSettlement.commit）写会话日志时**只取 info**：
 *        ...result.error?.info ? { error: result.error.info } : {}
 *
 *   ⇒ 持久化到 tool/result.data.error 的就是那个 info 对象本体：
 *        { name:'AutoReviewDeniedError', code:'AUTO_REVIEW_DENIED', reason?: string }
 *   code 在 data.error **顶层**，跟我们的围栏（FENCE_ERROR_CODE 同样来自 guard 的 info）**同一层**。
 *   宿主渲染端也是这么读的：error?.name !== 'AutoReviewDeniedError' || error.code !== 'AUTO_REVIEW_DENIED'。
 *
 * reviewInfoOf 额外兼容 error.info.code 的嵌套形态：纯粹为了跨宿主版本时不会静默丢条目，
 * 不是因为我们猜它有第二种形状。
 */
const AUTO_REVIEW_DENIED_CODE = 'AUTO_REVIEW_DENIED';

/** 从 tool/result 的 data.error 里取出 Auto review 拒绝的 info，取不到返回 undefined。 */
function reviewInfoOf(error) {
  if (!isPlainObject(error)) return undefined;
  if (error.code === AUTO_REVIEW_DENIED_CODE) return error;
  if (isPlainObject(error.info) && error.info.code === AUTO_REVIEW_DENIED_CODE) return error.info;
  return undefined;
}

/** state 里保留的条目上限（防止投影状态随会话无限增长）。 */
const MAX_ENTRIES = 1000;
/** wire 一次性下发给客户端的条目上限。 */
const VIEW_ENTRIES = 500;
/** tool/call 名字缓存上限（只用于给围栏条目补上工具名）。 */
const MAX_NAME_CACHE = 200;

// ──────────────────────────────────────────────────────────────
// wire.view 的引用复用（硬约束 4）
//
// 宿主（dsh-session-projection/src/index.ts:915-930）判定链是：
//   state 引用变 → views[0] = 上一次 view() 的返回值 → views[1] = 本次 view() 的返回值
//   → Object.is(views[0], views[1]) 为 false 才 viewSchema.parse 并通知所有订阅者。
//
// 所以 view() 每次 new 一个外层对象就等于「只要 state 变了就一定下发」，
// 而 state 变的最常见原因恰恰是 tool/call（只更新 names/callOrder，视图内容没变）。
// 修法：按 view 的三个组成引用做三层记忆化——同一组 (entries, counters, env) 永远返回同一个对象。
// 三级 WeakMap 天然按内容分桶，多会话互不干扰，也不会泄漏（随 state 一起被回收）。
// ──────────────────────────────────────────────────────────────
const truncatedEntries = new WeakMap(); // 完整 entries 数组 → 截断后的数组
const viewMemo = new WeakMap(); // entriesView → WeakMap(counters → WeakMap(env → WeakMap(hits → view)))

function entriesViewOf(entries) {
  if (entries.length <= VIEW_ENTRIES) return entries;
  let cached = truncatedEntries.get(entries);
  if (cached === undefined) {
    cached = entries.slice(entries.length - VIEW_ENTRIES);
    truncatedEntries.set(entries, cached);
  }
  return cached;
}

/**
 * 常量：规则表与当前策略。模块级而非 per-session，因为策略是**插件配置**（对所有会话一致），
 * 不是会话状态——它们走另一个投影（ops.config，见 config-projection.js）。
 * 为什么分开：审计投影声明了 summary:false（审计条目不该进会话摘要），
 * 挂在这儿的常量在一个还没有任何事件的新会话里客户端根本读不到。
 */
function viewOf(state) {
  const entries = entriesViewOf(state.entries);
  let byCounters = viewMemo.get(entries);
  if (byCounters === undefined) {
    byCounters = new WeakMap();
    viewMemo.set(entries, byCounters);
  }
  let byEnv = byCounters.get(state.counters);
  if (byEnv === undefined) {
    byEnv = new WeakMap();
    byCounters.set(state.counters, byEnv);
  }
  let byHits = byEnv.get(state.env);
  if (byHits === undefined) {
    byHits = new WeakMap();
    byEnv.set(state.env, byHits);
  }
  let view = byHits.get(state.hits);
  if (view === undefined) {
    view = {
      entries,
      counters: state.counters,
      env: state.env,
      hits: state.hits,
    };
    byHits.set(state.hits, view);
  }
  return view;
}

// ──────────────────────────────────────────────────────────────
// schema：宿主只要求对象带 parse(value)。这里不引入 zod，
// 是为了避免与宿主内部的 zod 版本（4.6.6）以及 profile 里的 zod（3.25.76）冲突。
// 校验必须真实——宿主在 checkpoint 恢复与每次 wire 前后都会调用它。
// ──────────────────────────────────────────────────────────────

function validator(label, check) {
  return {
    parse(value) {
      if (!check(value)) {
        throw new Error('agent-ops: invalid ' + label);
      }
      return value;
    },
  };
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const optionalNumber = value => value === undefined || typeof value === 'number';

const entrySchema = validator('audit entry', value => isPlainObject(value)
  && typeof value.seq === 'number'
  && typeof value.time === 'number'
  && (value.kind === 'approval' || value.kind === 'fence' || value.kind === 'review')
  && typeof value.outcome === 'string'
  && optionalNumber(value.decidedSeq)
  && optionalNumber(value.decidedTime));

const countersSchema = validator('audit counters', value => isPlainObject(value)
  && typeof value.asked === 'number'
  && typeof value.allowed === 'number'
  && typeof value.denied === 'number'
  && typeof value.blocked === 'number'
  && typeof value.reviewed === 'number');

/** 规则命中计数：ruleId → { count, lastAt }。 */
const hitsSchema = validator('audit hits', value => isPlainObject(value)
  && Object.values(value).every(item => isPlainObject(item)
    && typeof item.count === 'number'
    && typeof item.lastAt === 'number'));

const envSchema = validator('audit env', value => isPlainObject(value)
  && (value.sandbox === null || typeof value.sandbox === 'string')
  && (value.approval === null || typeof value.approval === 'string')
  && (value.preset === null || typeof value.preset === 'string'));

export const auditStateSchema = validator('audit state', value => isPlainObject(value)
  && Array.isArray(value.entries)
  && value.entries.every(entry => entrySchema.parse(entry) !== undefined)
  && countersSchema.parse(value.counters) !== undefined
  && hitsSchema.parse(value.hits) !== undefined
  && envSchema.parse(value.env) !== undefined
  && isPlainObject(value.names)
  && Array.isArray(value.callOrder));

export const auditViewSchema = validator('audit view', value => isPlainObject(value)
  && Array.isArray(value.entries)
  && value.entries.every(entry => entrySchema.parse(entry) !== undefined)
  && countersSchema.parse(value.counters) !== undefined
  && hitsSchema.parse(value.hits) !== undefined
  && envSchema.parse(value.env) !== undefined
  );

// ──────────────────────────────────────────────────────────────
// 折叠
// ──────────────────────────────────────────────────────────────

function emptyState() {
  return {
    entries: [],
    counters: { asked: 0, allowed: 0, denied: 0, blocked: 0, reviewed: 0 },
    hits: {},
    env: { sandbox: null, approval: null, preset: null },
    names: {},
    callOrder: [],
  };
}

/**
 * 记一次规则命中（A3 的「命中次数 / 最后一次命中时间」）。
 *
 * 两路来源都在会话日志里，所以不需要额外的通道：
 *   ask  —— approval/asked 的 reason 形如 'agent-ops: <ruleId>'（我们写的）
 *   deny —— tool/result 的 AGENT_OPS_FENCED（info.reason 里带 ruleId）
 */
function countHit(state, ruleId, at) {
  if (typeof ruleId !== 'string' || ruleId.length === 0) return state;
  const previous = state.hits[ruleId];
  const next = previous === undefined
    ? { count: 1, lastAt: at }
    : { count: previous.count + 1, lastAt: at };
  return { ...state, hits: { ...state.hits, [ruleId]: next } };
}

/** 从审批理由里认出「这是我们这条规则问出来的」。 */
const AGENT_OPS_REASON_PREFIX = 'agent-ops: ';

function ruleIdOfReason(reason) {
  if (typeof reason !== 'string') return undefined;
  if (!reason.startsWith(AGENT_OPS_REASON_PREFIX)) return undefined;
  const id = reason.slice(AGENT_OPS_REASON_PREFIX.length).trim();
  return id.length > 0 ? id : undefined;
}

/** 只在需要裁剪时复制数组，避免每个事件都产生新引用。 */
function pushBounded(entries, entry) {
  const next = entries.length >= MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES + 1) : entries.slice();
  next.push(entry);
  return next;
}

function rememberCall(state, callId, name) {
  if (typeof callId !== 'string' || callId.length === 0 || typeof name !== 'string') return state;
  if (state.names[callId] === name) return state;
  const names = { ...state.names, [callId]: name };
  const callOrder = state.callOrder.concat(callId);
  while (callOrder.length > MAX_NAME_CACHE) {
    const evicted = callOrder.shift();
    delete names[evicted];
  }
  return { ...state, names, callOrder };
}

function foldAsked(state, event) {
  const data = isPlainObject(event.data) ? event.data : {};
  const id = typeof data.id === 'string' ? data.id : String(event.seq);
  const entry = {
    seq: event.seq,
    time: event.time,
    kind: 'approval',
    id,
    tool: typeof data.toolName === 'string' ? data.toolName : '',
    callId: typeof data.callId === 'string' ? data.callId : null,
    reason: typeof data.reason === 'string' ? data.reason : null,
    outcome: 'pending',
  };
  const counted = countHit(state, ruleIdOfReason(entry.reason), event.time);
  return {
    ...counted,
    entries: pushBounded(counted.entries, entry),
    counters: { ...counted.counters, asked: counted.counters.asked + 1 },
  };
}

function foldDecided(state, event) {
  const data = isPlainObject(event.data) ? event.data : {};
  const id = typeof data.id === 'string' ? data.id : String(event.seq);
  const outcome = typeof data.outcome === 'string' ? data.outcome : 'unavailable';

  let index = -1;
  for (let cursor = state.entries.length - 1; cursor >= 0; cursor -= 1) {
    const entry = state.entries[cursor];
    if (entry.kind === 'approval' && entry.id === id) {
      index = cursor;
      break;
    }
  }

  const entries = state.entries.slice();
  if (index >= 0) {
    entries[index] = { ...entries[index], outcome, decidedSeq: event.seq, decidedTime: event.time };
  } else {
    // 条目已被裁剪或 asked 发生在更早的日志段：补一条只有结论的条目，不丢信息。
    entries.push({
      seq: event.seq,
      time: event.time,
      kind: 'approval',
      id,
      tool: '',
      callId: null,
      reason: null,
      outcome,
      decidedSeq: event.seq,
      decidedTime: event.time,
    });
  }

  const counters = { ...state.counters };
  if (outcome === 'allowed-once') counters.allowed += 1;
  else counters.denied += 1;
  return { ...state, entries, counters };
}

function detailOf(info) {
  if (!isPlainObject(info) || info.code !== FENCE_ERROR_CODE) return undefined;
  const raw = typeof info.reason === 'string' ? info.reason : '';
  const parts = raw.split('|');
  if (parts.length !== 3) return { ruleId: raw, category: '', risk: '' };
  return { ruleId: parts[0], category: parts[1], risk: parts[2] };
}

/**
 * Auto review 拒绝的折叠。它跟围栏是**两种不同的拦截**：
 * 围栏是本地规则表在 pre-execute 直接拒绝（策略性、可解释、带 ruleId），
 * Auto review 是模型裁判在看懂上下文后说「这次不该做」（语义性、理由自然语言）。
 * 分开记条目、分开计数，界面上一眼能分清「被规则拦了」还是「被裁判拦了」。
 */
function foldReviewDenied(state, event, error) {
  const reason = typeof error.reason === 'string' && error.reason.length > 0 ? error.reason : null;
  const message = isPlainObject(event.data?.message) ? event.data.message : {};
  const callId = typeof message.toolCallId === 'string' ? message.toolCallId : null;
  const entry = {
    seq: event.seq,
    time: event.time,
    kind: 'review',
    id: null,
    callId,
    tool: callId !== null && Object.hasOwn(state.names, callId) ? state.names[callId] : '',
    reason,
    outcome: 'reviewed',
  };
  return {
    ...state,
    entries: pushBounded(state.entries, entry),
    counters: { ...state.counters, reviewed: state.counters.reviewed + 1 },
  };
}

function foldToolResult(state, event) {
  const data = isPlainObject(event.data) ? event.data : {};
  const reviewInfo = reviewInfoOf(data.error);
  if (reviewInfo !== undefined) return foldReviewDenied(state, event, reviewInfo);
  const detail = detailOf(data.error);
  if (detail === undefined) return state;
  const message = isPlainObject(data.message) ? data.message : {};
  const callId = typeof message.toolCallId === 'string' ? message.toolCallId : null;
  const entry = {
    seq: event.seq,
    time: event.time,
    kind: 'fence',
    id: null,
    callId,
    tool: callId !== null && Object.hasOwn(state.names, callId) ? state.names[callId] : '',
    ruleId: detail.ruleId,
    category: detail.category,
    risk: detail.risk,
    reason: typeof data.error?.reason === 'string' ? data.error.reason : detail.ruleId,
    outcome: 'blocked',
  };
  const counted = countHit(state, detail.ruleId, event.time);
  return {
    ...counted,
    entries: pushBounded(counted.entries, entry),
    counters: { ...counted.counters, blocked: counted.counters.blocked + 1 },
  };
}

function foldEnv(state, key, value) {
  if (typeof value !== 'string' || state.env[key] === value) return state;
  return { ...state, env: { ...state.env, [key]: value } };
}

/** 投影定义本体。宿主调用顺序：init → apply(逐事件) → wire.view。 */
export const auditProjectionDefinition = {
  key: 'ops.audit',
  stateVersion: 4,
  stateSchema: auditStateSchema,
  init: () => emptyState(),
  apply: (state, event) => {
    if (event === null || typeof event !== 'object') return state;
    switch (event.type) {
      case 'approval/asked':
        return foldAsked(state, event);
      case 'approval/decided':
        return foldDecided(state, event);
      case 'tool/result':
        return foldToolResult(state, event);
      case 'tool/call': {
        const data = isPlainObject(event.data) ? event.data : {};
        return rememberCall(state, data.callId, data.name);
      }
      case 'sandbox/mode':
        return foldEnv(state, 'sandbox', isPlainObject(event.data) ? event.data.mode : undefined);
      case 'approval/policy':
        return foldEnv(state, 'approval', isPlainObject(event.data) ? event.data.policy : undefined);
      case 'permission/preset':
        return foldEnv(state, 'preset', isPlainObject(event.data) ? event.data.preset : undefined);
      default:
        // 硬约束 2：不关心的事件必须返回同一引用。
        return state;
    }
  },
  wire: {
    viewSchema: auditViewSchema,
    // 硬约束 4：必须复用引用，否则每个 tool/call 都会触发一次下发。见 viewOf。
    view: viewOf,
    // 硬约束：不进会话列表摘要——审计条目是给本会话的运维面看的，不是会话的一句话简介。
    summary: false,
  },
};

export const AUDIT_PROJECTION_KEY = 'ops.audit';
