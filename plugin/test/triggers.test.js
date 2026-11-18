import test from 'node:test';
import assert from 'node:assert/strict';

import { Session } from '@deepseek-ai/dsh-session';

import {
  CANDIDATE_KINDS,
  DEFAULT_TRIGGER_POLICY,
  LEVELS,
  TRIGGER_RECORD_TYPE,
  TRIGGERS_PROJECTION_KEY,
  candidatesFromEvent,
  createWakeBudget,
  downgradeUntilOf,
  gradeCandidate,
  setTriggerPolicyView,
  triggersProjectionDefinition,
  withinRepeatWindow,
  writeTriggerIgnore,
} from '../lib/triggers.js';

function fold(events) {
  let state = triggersProjectionDefinition.init({}, 0);
  for (const event of events) state = triggersProjectionDefinition.apply(state, event);
  return state;
}

const todoEvent = (todos, time = 1000) => ({ type: 'todo/write', seq: 1, time, data: { todos } });
const goalEvent = (objective, time = 1000) => ({
  type: 'goal/change',
  seq: 2,
  time,
  data: { operation: 'set', goal: { objective }, updatedAt: time },
});

test('G7 候选类别的取值固定', () => {
  assert.deepEqual(CANDIDATE_KINDS, ['goal', 'todo', 'workspace', 'team-task', 'deliverable']);
  assert.deepEqual(LEVELS, ['L0', 'L1', 'L2']);
});

test('G7 投影的 key 与 stateVersion 固定，wire 不进会话摘要', () => {
  assert.equal(triggersProjectionDefinition.key, 'ops.triggers');
  assert.equal(TRIGGERS_PROJECTION_KEY, 'ops.triggers');
  assert.equal(triggersProjectionDefinition.stateVersion, 1);
  assert.equal(triggersProjectionDefinition.wire.summary, false);
});

test('G7 三路信号都能折出候选：目标 / 待办 / 团队任务', () => {
  const candidates = candidatesFromEvent(goalEvent('把插件发布出去'));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, 'goal');
  assert.equal(candidates[0].title, '把插件发布出去');
  assert.equal(candidates[0].urgency, 'high');

  const todos = candidatesFromEvent(todoEvent([
    { content: '写测试', status: 'pending' },
    { content: '发布', status: 'in_progress' },
    { content: '已完成的', status: 'completed' },
  ]));
  assert.deepEqual(todos.map((item) => item.title), ['写测试', '发布']);

  const team = candidatesFromEvent({
    type: 'team/task',
    seq: 3,
    time: 5,
    data: { version: 2, teamId: 't', task: { id: 'task-1', subject: '整理竞品资料', status: 'pending' } },
  });
  assert.equal(team[0].kind, 'team-task');
  assert.equal(team[0].id, 'team-task:task-1');
});

test('G7 完成的待办与已清除的目标不产生候选', () => {
  assert.deepEqual(candidatesFromEvent(todoEvent([{ content: 'done', status: 'completed' }])), []);
  assert.deepEqual(candidatesFromEvent({
    type: 'goal/change', seq: 1, time: 1, data: { operation: 'clear' },
  }), []);
});

test('G7 「goal 未完成 + 3 条未完成待办 + 交付物已产出」的会话折出 ≥2 条候选且不重复', () => {
  const state = fold([
    goalEvent('把插件发布出去', 1000),
    todoEvent([
      { content: '写测试', status: 'pending' },
      { content: '打包', status: 'pending' },
      { content: '提交', status: 'pending' },
    ], 2000),
    {
      type: 'deliverables/presented',
      seq: 3,
      time: 3000,
      data: { turn: 1, callId: 'c1', files: [{ name: 'agent-ops.tgz' }] },
    },
  ]);
  assert.ok(state.candidates.length >= 2, '候选清单至少两条，实际 ' + state.candidates.length);
  const ids = state.candidates.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, '候选 id 不重复');
  assert.ok(ids.includes('todo:写测试'));
  assert.ok(ids.includes('goal:把插件发布出去'));
});

test('G7 同一候选重复出现只留一条，count 累加', () => {
  const state = fold([
    todoEvent([{ content: '写测试', status: 'pending' }], 1000),
    todoEvent([{ content: '写测试', status: 'pending' }], 2000),
  ]);
  assert.equal(state.candidates.length, 1);
  assert.equal(state.candidates[0].count, 2);
});

test('G7 24 小时内不重复提示同一候选', () => {
  const hour = 60 * 60 * 1000;
  const candidate = { notifiedAt: 1000 * hour };
  assert.equal(withinRepeatWindow(candidate, 1000 * hour + 23 * hour, DEFAULT_TRIGGER_POLICY), true);
  assert.equal(withinRepeatWindow(candidate, 1000 * hour + 25 * hour, DEFAULT_TRIGGER_POLICY), false);
  assert.equal(withinRepeatWindow({ notifiedAt: null }, 1000, DEFAULT_TRIGGER_POLICY), false);
});

test('G8 默认分级：未开唤醒时最高只到 L1', () => {
  const policy = { ...DEFAULT_TRIGGER_POLICY };
  assert.equal(gradeCandidate({ urgency: 'high' }, policy).level, 'L1');
  assert.equal(gradeCandidate({ urgency: 'low' }, policy).level, 'L0');
});

test('G8 打开唤醒后高紧急度候选升到 L2', () => {
  const policy = { ...DEFAULT_TRIGGER_POLICY, wakeEnabled: true };
  const graded = gradeCandidate({ urgency: 'high' }, policy);
  assert.equal(graded.level, 'L2');
  assert.equal(graded.reason, 'wake-enabled');
});

test('G8 连续忽略两次后该类降级，30 天后恢复', () => {
  const policy = { ...DEFAULT_TRIGGER_POLICY };
  const ignores = { todo: [1000, 2000] };
  const until = downgradeUntilOf(ignores, 'todo', policy);
  assert.equal(until, 2000 + 30 * 24 * 60 * 60 * 1000);
  assert.equal(gradeCandidate({ urgency: 'high' }, policy, { downgradedUntil: until, now: 2000 }).level, 'L0');
  assert.equal(gradeCandidate({ urgency: 'high' }, policy, { downgradedUntil: until, now: until + 1 }).level, 'L1');
});

test('G8 只忽略一次不降级', () => {
  const policy = { ...DEFAULT_TRIGGER_POLICY };
  assert.equal(downgradeUntilOf({ todo: [1000] }, 'todo', policy), 0);
});

test('G8 忽略记录进会话日志后，该类候选降为 L0', () => {
  const session = Session.create('s-triggers-1');
  writeTriggerIgnore(session, 'todo');
  writeTriggerIgnore(session, 'todo');
  const state = fold([
    todoEvent([{ content: '写测试', status: 'pending' }], 1000),
    ...session.ownEvents(),
  ]);
  const todo = state.candidates.find((item) => item.kind === 'todo');
  assert.ok(todo !== undefined);
  assert.equal(todo.level, 'L0');
  assert.equal(todo.ignored, true);
});

test('G8 忽略记录带 ignorable，旧版本读到会跳过', () => {
  const session = Session.create('s-triggers-2');
  writeTriggerIgnore(session, 'goal');
  const events = session.ownEvents();
  assert.equal(events[0].type, TRIGGER_RECORD_TYPE);
  assert.equal(events[0].ignorable, true);
});

test('G8 L2 唤醒预算：第 4 次不再放行', () => {
  const budget = createWakeBudget({ limit: 3, now: () => Date.UTC(2026, 0, 1, 12) });
  assert.equal(budget.consume(), true);
  assert.equal(budget.consume(), true);
  assert.equal(budget.consume(), true);
  assert.equal(budget.consume(), false, '第 4 次超预算');
  assert.equal(budget.usedToday(), 3);
  assert.equal(budget.remaining(), 0);
});

test('G8 唤醒预算按天重置', () => {
  let now = Date.UTC(2026, 0, 1, 12);
  const budget = createWakeBudget({ limit: 1, now: () => now });
  assert.equal(budget.consume(), true);
  assert.equal(budget.consume(), false);
  now = Date.UTC(2026, 0, 2, 12);
  assert.equal(budget.consume(), true, '第二天预算恢复');
  assert.equal(budget.usedToday(), 1);
});

test('G8 预算为 0 时一次都不放行', () => {
  const budget = createWakeBudget({ limit: 0 });
  assert.equal(budget.consume(), false);
});

test('G7 投影不关心的事件返回同一引用（硬约束 2）', () => {
  const state = triggersProjectionDefinition.init({}, 0);
  assert.equal(triggersProjectionDefinition.apply(state, { type: 'approval/asked', seq: 1, time: 1, data: {} }), state);
});

test('G7 投影的 state 与 view 都能通过自己的 schema', () => {
  const state = fold([todoEvent([{ content: '写测试', status: 'pending' }])]);
  assert.equal(triggersProjectionDefinition.stateSchema.parse(state), state);
  const view = triggersProjectionDefinition.wire.view(state);
  assert.equal(triggersProjectionDefinition.wire.viewSchema.parse(view), view);
});

test('G7 view 复用引用：同一 state 多次取 view 恒等', () => {
  const state = fold([todoEvent([{ content: '写测试', status: 'pending' }])]);
  assert.equal(triggersProjectionDefinition.wire.view(state), triggersProjectionDefinition.wire.view(state));
});

test('G8 策略发布后立即生效（模块级常量）', () => {
  setTriggerPolicyView({ wakeEnabled: true, dailyWakeBudget: 5 });
  const graded = gradeCandidate({ urgency: 'high' }, {
    notifyUrgency: 'normal',
    wakeEnabled: true,
    dailyWakeBudget: 5,
    repeatWindowHours: 24,
    ignoreThreshold: 2,
    downgradeDays: 30,
  });
  assert.equal(graded.level, 'L2');
  setTriggerPolicyView(DEFAULT_TRIGGER_POLICY);
});
