/**
 * lib/triggers.js — 主动任务感知（G7）与打扰分级（G8）
 *
 * 三路信号折叠成一张候选清单（04 方案 §9.8）：
 *   目标   goal/change           —— 有目标还没做完
 *   待办   todo/write            —— 未完成的 todo
 *   上下文 workspace/changes     —— 工作区有改动
 *        team/task              —— 团队任务未完成
 *        deliverables/presented —— 交付物已产出（提醒你看一眼）
 *
 * 产出形态**不是行动卡**（宿主规定每轮只一张卡，且子代理不能发卡），而是收件箱的
 * 第三段「建议」+ 通知条（复用 E2）。
 *
 * 打扰分级（G8）：
 *   L0 静默   只进收件箱，不出现在任何浮层
 *   L1 通知条 一条可关闭的提示
 *   L2 唤醒   对根 agent followup() 开一轮——**唯一会花钱的一级**
 *
 * 三条纪律：
 *   1. 候选清单按 id 去重，同一候选 24 小时内不重复提示。
 *   2. 同一类建议连续被忽略两次 → 该类降级到 L0，30 天后恢复。
 *   3. L2 唤醒受**每日预算**约束（默认 3 次），预算用完就不再唤醒主 Bot。
 *
 * 状态放在**会话日志的插件记录**里（plugin:ops.trigger），所以忽略次数、降级、
 * 预算这些都会跟着会话分叉与恢复走，也能在审计里回看。
 */

import { appendPluginRecord } from '@deepseek-ai/dsh-session';

// ──────────────────────────────────────────────────────────────
// 策略常量（模块级，与 audit-projection.js 的 RULES_VIEW/POLICY_VIEW 同思路：
// 策略是插件配置，对所有会话一致，不是会话状态）
// ──────────────────────────────────────────────────────────────

export const TRIGGER_RECORD_TYPE = 'plugin:ops.trigger';
export const TRIGGERS_PROJECTION_KEY = 'ops.triggers';

/** 候选的类别。 */
export const CANDIDATE_KINDS = ['goal', 'todo', 'workspace', 'team-task', 'deliverable'];

/** 打扰级别。 */
export const LEVELS = ['L0', 'L1', 'L2'];

export const DEFAULT_TRIGGER_POLICY = Object.freeze({
  /** urgency ≥ 该值的候选进 L1（其余 L0）。 */
  notifyUrgency: 'normal',
  /** 是否允许 L2 唤醒（用户显式要求「有事直接找我」才开）。 */
  wakeEnabled: false,
  /** 每团队每日 L2 唤醒上限。 */
  dailyWakeBudget: 3,
  /** 同一候选多少小时内不重复提示。 */
  repeatWindowHours: 24,
  /** 连续忽略多少次后该类降级。 */
  ignoreThreshold: 2,
  /** 降级持续多少天。 */
  downgradeDays: 30,
});

let TRIGGER_POLICY_VIEW = Object.freeze({ ...DEFAULT_TRIGGER_POLICY });

/** 由 lib/index.js 在注册投影前调用一次。 */
export function setTriggerPolicyView(policy) {
  TRIGGER_POLICY_VIEW = Object.freeze({
    notifyUrgency: typeof policy?.notifyUrgency === 'string' ? policy.notifyUrgency : DEFAULT_TRIGGER_POLICY.notifyUrgency,
    wakeEnabled: policy?.wakeEnabled === true,
    dailyWakeBudget: Number.isSafeInteger(policy?.dailyWakeBudget) && policy.dailyWakeBudget >= 0
      ? policy.dailyWakeBudget
      : DEFAULT_TRIGGER_POLICY.dailyWakeBudget,
    repeatWindowHours: Number.isSafeInteger(policy?.repeatWindowHours) && policy.repeatWindowHours > 0
      ? policy.repeatWindowHours
      : DEFAULT_TRIGGER_POLICY.repeatWindowHours,
    ignoreThreshold: Number.isSafeInteger(policy?.ignoreThreshold) && policy.ignoreThreshold > 0
      ? policy.ignoreThreshold
      : DEFAULT_TRIGGER_POLICY.ignoreThreshold,
    downgradeDays: Number.isSafeInteger(policy?.downgradeDays) && policy.downgradeDays > 0
      ? policy.downgradeDays
      : DEFAULT_TRIGGER_POLICY.downgradeDays,
  });
}

/** 当前策略（只读快照）。 */
export function triggerPolicy() {
  return TRIGGER_POLICY_VIEW;
}

/** 策略的字面快照（给 config-projection 的常量组用）。 */
export function triggerPolicySnapshot() {
  return { ...TRIGGER_POLICY_VIEW };
}

// ──────────────────────────────────────────────────────────────
// 纯函数：候选抽取 / 分级 / 降级
// ──────────────────────────────────────────────────────────────

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 取对象里第一个非空字符串字段。 */
function firstString(source, keys) {
  if (!isPlainObject(source)) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

const URGENCY_WEIGHT = { high: 3, normal: 2, low: 1 };

/** urgency 是否达到门槛。 */
export function atLeastUrgency(urgency, threshold) {
  const bar = URGENCY_WEIGHT[threshold];
  if (bar === undefined) return false;
  return (URGENCY_WEIGHT[urgency] ?? 0) >= bar;
}

/**
 * 从一条会话事件里抽出候选。
 *
 * @returns {object[]} 候选数组（可能为空）。
 */
export function candidatesFromEvent(event) {
  if (!isPlainObject(event) || typeof event.type !== 'string') return [];
  const data = isPlainObject(event.data) ? event.data : {};
  const at = typeof event.time === 'number' ? event.time : 0;

  switch (event.type) {
    case 'todo/write': {
      const todos = Array.isArray(data.todos) ? data.todos : [];
      return todos
        .filter((todo) => isPlainObject(todo) && todo.status !== 'completed')
        .map((todo) => {
          const title = firstString(todo, ['content', 'title', 'text']);
          if (title.length === 0) return undefined;
          return {
            id: 'todo:' + title,
            kind: 'todo',
            title,
            urgency: todo.status === 'in_progress' ? 'normal' : 'low',
            at,
          };
        })
        .filter((item) => item !== undefined);
    }
    case 'goal/change': {
      if (data.operation === 'clear') return [];
      const goal = isPlainObject(data.goal) ? data.goal : {};
      const title = firstString(goal, ['objective', 'text', 'title', 'description', 'summary']);
      if (title.length === 0) return [];
      return [{
        id: 'goal:' + title,
        kind: 'goal',
        title,
        urgency: 'high',
        at: typeof data.updatedAt === 'number' ? data.updatedAt : at,
      }];
    }
    case 'team/task': {
      const task = isPlainObject(data.task) ? data.task : {};
      const status = typeof task.status === 'string' ? task.status : '';
      if (status === 'completed' || status === 'done' || status === 'cancelled') return [];
      const title = firstString(task, ['subject', 'title', 'description']);
      if (title.length === 0) return [];
      return [{
        id: 'team-task:' + (typeof task.id === 'string' ? task.id : title),
        kind: 'team-task',
        title,
        urgency: status === 'blocked' ? 'high' : 'normal',
        at,
      }];
    }
    case 'workspace/changes': {
      const turn = typeof data.turn === 'number' ? data.turn : 0;
      return [{
        id: 'workspace:' + String(turn),
        kind: 'workspace',
        title: '工作区有未处理的改动（turn ' + String(turn) + '）',
        urgency: 'low',
        at,
      }];
    }
    case 'deliverables/presented': {
      const files = Array.isArray(data.files) ? data.files : [];
      const names = files
        .map((file) => firstString(file, ['name', 'path', 'title']))
        .filter((name) => name.length > 0)
        .slice(0, 3);
      const title = names.length > 0
        ? '交付物已产出：' + names.join('、')
        : '交付物已产出';
      return [{
        id: 'deliverable:' + (typeof data.callId === 'string' ? data.callId : title),
        kind: 'deliverable',
        title,
        urgency: 'low',
        at,
      }];
    }
    default:
      return [];
  }
}

/**
 * 给候选定级。
 *
 * @param {object} candidate 候选。
 * @param {object} policy 策略快照。
 * @param {object} [context] { ignored: 该类被忽略的次数, downgradedUntil: 该类降级截止时间, now: 当前时间 }
 * @returns {{ level: 'L0'|'L1'|'L2', reason: string }}
 */
export function gradeCandidate(candidate, policy = TRIGGER_POLICY_VIEW, context = {}) {
  const now = typeof context.now === 'number' ? context.now : 0;
  const downgradedUntil = typeof context.downgradedUntil === 'number' ? context.downgradedUntil : 0;
  if (downgradedUntil > now) {
    return { level: 'L0', reason: 'ignored-twice' };
  }
  if (!atLeastUrgency(candidate.urgency, policy.notifyUrgency)) {
    return { level: 'L0', reason: 'below-threshold' };
  }
  if (policy.wakeEnabled) {
    return { level: 'L2', reason: 'wake-enabled' };
  }
  return { level: 'L1', reason: 'notify' };
}

/**
 * 计算某类建议的降级截止时间。
 *
 * 连续忽略达到阈值 → 从最后一次忽略起算，降级 downgradeDays 天。
 */
export function downgradeUntilOf(ignores, kind, policy = TRIGGER_POLICY_VIEW) {
  const times = ignores[kind];
  if (!Array.isArray(times) || times.length < policy.ignoreThreshold) return 0;
  const last = times[times.length - 1];
  if (typeof last !== 'number') return 0;
  return last + policy.downgradeDays * 24 * 60 * 60 * 1000;
}

// ──────────────────────────────────────────────────────────────
// 唤醒预算（G8 的硬约束）
// ──────────────────────────────────────────────────────────────

/**
 * 每日 L2 唤醒预算。
 *
 * 为什么它不放在投影里：唤醒是**副作用**（真的去 followup 主 Bot），必须发生在
 * Host 侧；投影是纯折叠，不能有副作用。所以预算是一个 Host 侧的按日计数器，
 * 而「这条建议值不值得唤醒」的判定仍然由投影给出（level === 'L2'）。
 *
 * @param {{limit?: number, now?: () => number}} [options]
 */
export function createWakeBudget(options = {}) {
  const limit = Number.isSafeInteger(options.limit) && options.limit >= 0
    ? options.limit
    : DEFAULT_TRIGGER_POLICY.dailyWakeBudget;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  let day = '';
  let used = 0;
  const history = [];

  function dayKey(ts) {
    const date = new Date(ts);
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function roll(ts) {
    const key = dayKey(ts);
    if (key !== day) {
      day = key;
      used = 0;
    }
  }

  return {
    /** 今天还能唤醒几次。 */
    remaining(ts = now()) {
      roll(ts);
      return Math.max(0, limit - used);
    },
    /** 记一次唤醒。超预算时返回 false（调用方不得唤醒）。 */
    consume(ts = now()) {
      roll(ts);
      if (used >= limit) return false;
      used += 1;
      history.push({ at: ts, day });
      return true;
    },
    /** 今天已经唤醒几次。 */
    usedToday(ts = now()) {
      roll(ts);
      return used;
    },
    /** 最近若干次唤醒（测试与排障用）。 */
    history: () => history.slice(),
    limit,
  };
}

// ──────────────────────────────────────────────────────────────
// 投影：ops.triggers
// ──────────────────────────────────────────────────────────────

function validator(label, check) {
  return {
    parse(value) {
      if (!check(value)) throw new Error('agent-ops: invalid ' + label);
      return value;
    },
  };
}

const optionalString = (value) => value === undefined || value === null || typeof value === 'string';

const candidateSchema = validator('trigger candidate', (value) => isPlainObject(value)
  && typeof value.id === 'string'
  && typeof value.kind === 'string'
  && typeof value.title === 'string'
  && typeof value.urgency === 'string'
  && typeof value.at === 'number'
  && typeof value.level === 'string'
  && typeof value.reason === 'string'
  && typeof value.count === 'number'
  && typeof value.ignored === 'boolean'
  && typeof value.firstAt === 'number'
  && (value.notifiedAt === null || typeof value.notifiedAt === 'number'));

export const triggersStateSchema = validator('triggers state', (value) => isPlainObject(value)
  && typeof value.inheritedEventCount === 'number'
  && Array.isArray(value.candidates)
  && value.candidates.every((item) => candidateSchema.parse(item) !== undefined)
  && isPlainObject(value.ignores)
  && isPlainObject(value.counters));

export const triggersViewSchema = validator('triggers view', (value) => isPlainObject(value)
  && Array.isArray(value.candidates)
  && value.candidates.every((item) => candidateSchema.parse(item) !== undefined)
  && isPlainObject(value.counters));

function emptyTriggersState(inheritedEventCount) {
  return {
    inheritedEventCount: typeof inheritedEventCount === 'number' ? inheritedEventCount : 0,
    candidates: [],
    ignores: {},
    counters: { goal: 0, todo: 0, workspace: 0, 'team-task': 0, deliverable: 0, l1: 0, l2: 0 },
  };
}

const triggersViewMemo = new WeakMap();

function triggersViewOf(state) {
  let byCounters = triggersViewMemo.get(state.candidates);
  if (byCounters === undefined) {
    byCounters = new WeakMap();
    triggersViewMemo.set(state.candidates, byCounters);
  }
  let view = byCounters.get(state.counters);
  if (view === undefined) {
    view = { candidates: state.candidates, counters: state.counters };
    byCounters.set(state.counters, view);
  }
  return view;
}

/** 折叠一条忽略记录：该类的忽略次数 +1。 */
function foldIgnore(state, event) {
  const data = isPlainObject(event.data) ? event.data : {};
  const kind = typeof data.kind === 'string' ? data.kind : '';
  if (!CANDIDATE_KINDS.includes(kind)) return state;
  const at = typeof event.time === 'number' ? event.time : 0;
  const times = Array.isArray(state.ignores[kind]) ? state.ignores[kind].slice() : [];
  times.push(at);
  const ignores = { ...state.ignores, [kind]: times };
  const candidates = state.candidates.map((item) => (
    item.kind === kind ? { ...item, ignored: true, level: 'L0', reason: 'ignored' } : item
  ));
  return { ...state, ignores, candidates };
}

export const triggersProjectionDefinition = {
  key: TRIGGERS_PROJECTION_KEY,
  stateVersion: 1,
  stateSchema: triggersStateSchema,
  init: (_header, inheritedEventCount) => emptyTriggersState(inheritedEventCount),
  apply(state, event) {
    if (!isPlainObject(event)) return state;
    if (event.type === TRIGGER_RECORD_TYPE) {
      if (typeof event.seq === 'number' && event.seq < state.inheritedEventCount) return state;
      return foldIgnore(state, event);
    }
    const candidates = candidatesFromEvent(event);
    if (candidates.length === 0) return state;
    if (typeof event.seq === 'number' && event.seq < state.inheritedEventCount) return state;
    const now = typeof event.time === 'number' ? event.time : 0;
    const policy = TRIGGER_POLICY_VIEW;
    let list = state.candidates;
    const counters = { ...state.counters };
    for (const candidate of candidates) {
      const downgradedUntil = downgradeUntilOf(state.ignores, candidate.kind, policy);
      const graded = gradeCandidate(candidate, policy, { downgradedUntil, now });
      const index = list.findIndex((item) => item.id === candidate.id);
      const previous = index >= 0 ? list[index] : undefined;
      const entry = {
        id: candidate.id,
        kind: candidate.kind,
        title: candidate.title,
        urgency: candidate.urgency,
        at: candidate.at,
        level: graded.level,
        reason: graded.reason,
        count: previous === undefined ? 1 : previous.count + 1,
        ignored: previous !== undefined ? previous.ignored : false,
        firstAt: previous === undefined ? candidate.at : previous.firstAt,
        notifiedAt: previous === undefined ? null : previous.notifiedAt,
      };
      if (index >= 0) {
        const next = list.slice();
        next[index] = entry;
        list = next;
      } else {
        list = list.concat([entry]);
      }
      counters[candidate.kind] = (counters[candidate.kind] ?? 0) + 1;
      if (graded.level === 'L1') counters.l1 += 1;
      if (graded.level === 'L2') counters.l2 += 1;
    }
    return { ...state, candidates: list, counters };
  },
  wire: { viewSchema: triggersViewSchema, view: triggersViewOf, summary: false },
};

/**
 * 候选是否在重复提示窗口内（24 小时内不重复提示）。
 */
export function withinRepeatWindow(candidate, now, policy = TRIGGER_POLICY_VIEW) {
  if (candidate === null || typeof candidate !== 'object') return false;
  const notifiedAt = typeof candidate.notifiedAt === 'number' ? candidate.notifiedAt : undefined;
  if (notifiedAt === undefined) return false;
  const window = policy.repeatWindowHours * 60 * 60 * 1000;
  return now - notifiedAt < window;
}

/**
 * 写一条「用户忽略了这条建议」的记录。
 */
export function writeTriggerIgnore(session, kind, at) {
  const data = { version: 1, op: 'ignore', kind, at: typeof at === 'number' ? at : Date.now() };
  return appendPluginRecord(session, TRIGGER_RECORD_TYPE, data);
}
