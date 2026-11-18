/**
 * lib/config-projection.js — ops.config 投影：运行台的「配置面」
 *
 * 这个投影解决一个实测出来的问题：**审计数据不能靠审计投影下发**。
 *
 * 背景（DSH 的投影下发有两条路）：
 *   1. 会话状态变化时的实时下发（与 summary 无关）
 *   2. 会话打开时的基线 / 会话列表里的缓存值（受 `summary` 成员资格过滤）
 *
 * 我们原来的做法是把「内置规则表 + 生效策略 + 连接器」挂在 ops.audit 的 wire view 上，
 * 而 ops.audit 声明了 `summary: false`（审计条目不该进会话摘要）。结果是：
 * **一个还没发生过任何事件的新会话里，客户端根本读不到规则表**——
 * 实时路径没有东西可发，列表路径又因为 summary:false 把这个键挡在外面。
 * 规则表页因此显示「共 0 条」。
 *
 * 修法（不是绕过，是把职责分开）：
 *   ops.audit  —— 只放会话数据（条目、计数、命中、环境），继续 summary:false
 *   ops.config —— 放「与会话无关但客户端需要知道」的东西：内置规则表、生效策略、
 *                 连接器清单、主动感知策略、用户规则表。默认成员资格（summary:true），
 *                 所以任何会话都能从列表缓存里读到它。
 *
 * 三条硬规则与其它投影完全一致：apply 同步、不关心的事件返回同一引用、state 纯 JSON、
 * wire.view 复用引用。
 */

import { RULE_RECORD_TYPE } from './rules-table.js';
import {
  BUILTIN_RULES_VIEW,
  POLICY_VIEW,
  TRIGGER_POLICY_VIEW,
  setBuiltinRules,
  setPolicyView,
} from './constants.js';

export const CONFIG_PROJECTION_KEY = 'ops.config';

const MAX_USER_RULES_STATE = 64;

function validator(label, check) {
  return {
    parse(value) {
      if (!check(value)) throw new Error('agent-ops: invalid ' + label);
      return value;
    },
  };
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const optionalString = (value) => value === undefined || value === null || typeof value === 'string';

const userRuleSchema = validator('user rule', (value) => isPlainObject(value)
  && typeof value.id === 'string'
  && (value.effect === 'ask' || value.effect === 'allow')
  && optionalString(value.tool)
  && optionalString(value.pattern)
  && optionalString(value.note));

export const configStateSchema = validator('config state', (value) => isPlainObject(value)
  && typeof value.inheritedEventCount === 'number'
  && Array.isArray(value.userRules)
  && value.userRules.every((item) => userRuleSchema.parse(item) !== undefined)
  && typeof value.updatedAt === 'number');

export const configViewSchema = validator('config view', (value) => isPlainObject(value)
  && Array.isArray(value.rules)
  && Array.isArray(value.userRules)
  && value.userRules.every((item) => userRuleSchema.parse(item) !== undefined)
  && isPlainObject(value.policy)
  && isPlainObject(value.triggers)
  && Array.isArray(value.connectors)
  && typeof value.updatedAt === 'number');

function emptyConfigState(inheritedEventCount) {
  return {
    inheritedEventCount: typeof inheritedEventCount === 'number' ? inheritedEventCount : 0,
    userRules: [],
    updatedAt: 0,
  };
}

/**
 * view 的引用复用：用户规则 → 常量组。
 *
 * 最后一层是常量组（内置规则表 / 策略 / 连接器 / 主动感知策略）。它们会随运行
 * 变化（连接器状态变了、设置改了），所以必须参与记忆化：常量组换了引用 → view
 * 重新计算并下发。全部不变时，view 复用同一对象，宿主不会重复通知。
 *
 * 注意：WeakMap 的键必须是对象，所以时间戳那一层不能直接做键——用户规则数组每次
 * 写入都会换引用，updatedAt 与它同增同减，用数组做键已经足够。
 */
const configViewMemo = new WeakMap();

function configViewOf(state) {
  let byConstants = configViewMemo.get(state.userRules);
  if (byConstants === undefined) {
    byConstants = new WeakMap();
    configViewMemo.set(state.userRules, byConstants);
  }
  const constants = constantsView();
  let view = byConstants.get(constants);
  if (view === undefined) {
    view = {
      rules: constants.rules,
      policy: constants.policy,
      connectors: constants.connectors,
      triggers: constants.triggers,
      userRules: state.userRules,
      updatedAt: state.updatedAt,
    };
    byConstants.set(constants, view);
  }
  return view;
}

/** 常量组：内置规则表 / 策略 / 连接器 / 主动感知策略，打包成一个引用。 */
let CONSTANTS = Object.freeze({
  rules: BUILTIN_RULES_VIEW,
  policy: POLICY_VIEW,
  connectors: Object.freeze([]),
  triggers: TRIGGER_POLICY_VIEW,
});

function constantsView() {
  return CONSTANTS;
}

/** 当前常量组（给命令通道用：客户端拿不到投影时从这里读）。 */
export function currentConstants() {
  return CONSTANTS;
}

/**
 * 更新常量组。只有真的变了才换引用（否则会触发一次无谓的下发）。
 *
 * @param {{rules?: object[], policy?: object, connectors?: object[], triggers?: object}} patch
 */
export function setConstants(patch = {}) {
  const next = {
    rules: patch.rules === undefined ? CONSTANTS.rules : Object.freeze(patch.rules.slice()),
    policy: patch.policy === undefined ? CONSTANTS.policy : Object.freeze(patch.policy),
    connectors: patch.connectors === undefined ? CONSTANTS.connectors : Object.freeze(patch.connectors.slice()),
    triggers: patch.triggers === undefined ? CONSTANTS.triggers : Object.freeze(patch.triggers),
  };
  const same = next.rules === CONSTANTS.rules
    && next.policy === CONSTANTS.policy
    && next.connectors === CONSTANTS.connectors
    && next.triggers === CONSTANTS.triggers;
  if (same) return;
  CONSTANTS = Object.freeze(next);
}

/** 只更新连接器清单（连接状态变化时调用）。 */
export function setConnectorList(connectors) {
  setConstants({ connectors });
}

export const configProjectionDefinition = {
  key: CONFIG_PROJECTION_KEY,
  stateVersion: 1,
  stateSchema: configStateSchema,
  init: (_header, inheritedEventCount) => emptyConfigState(inheritedEventCount),
  apply(state, event) {
    if (event === null || typeof event !== 'object') return state;
    if (event.type !== RULE_RECORD_TYPE) return state;
    if (typeof event.seq === 'number' && event.seq < state.inheritedEventCount) return state;
    const data = isPlainObject(event.data) ? event.data : {};
    const raw = Array.isArray(data.rules) ? data.rules : [];
    const rules = raw.slice(0, MAX_USER_RULES_STATE);
    if (rules.length === 0 && state.userRules.length === 0) return state;
    return {
      ...state,
      userRules: rules,
      updatedAt: typeof event.time === 'number' ? event.time : state.updatedAt,
    };
  },
  // 默认成员资格（summary 未声明 = true）：这个投影要出现在会话列表的缓存里，
  // 否则客户端在一个还没有任何事件的新会话里读不到规则表。
  wire: { viewSchema: configViewSchema, view: configViewOf },
};

export { setBuiltinRules, setPolicyView };
