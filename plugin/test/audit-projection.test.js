import test from 'node:test';
import assert from 'node:assert/strict';

import { auditProjectionDefinition, AUDIT_PROJECTION_KEY } from '../lib/audit-projection.js';

let seq = 0;
function ev(type, data) {
  seq += 1;
  return { type, seq, time: 1700000000000 + seq * 1000, data };
}

function asked(id, toolName) {
  return ev('approval/asked', { id, toolName });
}

function decided(id, outcome) {
  return ev('approval/decided', { id, outcome });
}

function fold(events) {
  let state = auditProjectionDefinition.init({}, 0);
  for (const event of events) state = auditProjectionDefinition.apply(state, event);
  return state;
}

test('F2 投影元数据：key 与 stateVersion 固定，wire 不进会话摘要', () => {
  assert.equal(auditProjectionDefinition.key, 'ops.audit');
  assert.equal(AUDIT_PROJECTION_KEY, 'ops.audit');
  assert.equal(auditProjectionDefinition.stateVersion, 4);
  assert.equal(auditProjectionDefinition.wire.summary, false);
});

test('F2 三组 asked/decided 序列的计数器精确匹配', () => {
  const cases = [
    {
      name: '全部放行',
      events: [
        asked('a', 'pwsh'), decided('a', 'allowed-once'),
        asked('b', 'pwsh'), decided('b', 'allowed-once'),
        asked('c', 'pwsh'), decided('c', 'allowed-once'),
      ],
      counters: { asked: 3, allowed: 3, denied: 0, blocked: 0, reviewed: 0 },
    },
    {
      name: '全部拒绝',
      events: [
        asked('a', 'pwsh'), decided('a', 'rejected'),
        asked('b', 'pwsh'), decided('b', 'rejected'),
        asked('c', 'pwsh'), decided('c', 'cancelled'),
      ],
      counters: { asked: 3, allowed: 0, denied: 3, blocked: 0, reviewed: 0 },
    },
    {
      name: '混合 + 未决',
      events: [
        asked('a', 'pwsh'), decided('a', 'allowed-once'),
        asked('b', 'pwsh'), decided('b', 'unavailable'),
        asked('c', 'pwsh'),
      ],
      counters: { asked: 3, allowed: 1, denied: 1, blocked: 0, reviewed: 0 },
      pending: 'c',
    },
  ];

  for (const item of cases) {
    const state = fold(item.events);
    assert.deepEqual(state.counters, item.counters, item.name);
    if (item.pending !== undefined) {
      const entry = state.entries.find((row) => row.id === item.pending);
      assert.ok(entry, '未决条目应保留');
      assert.equal(entry.outcome, 'pending');
    }
  }
});

test('F2 无关事件必须返回同一 state 引用（Object.is）', () => {
  const state = fold([asked('a', 'pwsh'), decided('a', 'allowed-once')]);
  const unrelated = [
    ev('turn/start', { turn: 1 }),
    ev('step/start', { turn: 1, step: 1 }),
    ev('goal/change', { goal: null }),
    ev('session/title', { title: 'hello' }),
    ev('subagent/descriptor', { descriptor: null }),
  ];
  for (const event of unrelated) {
    assert.equal(auditProjectionDefinition.apply(state, event), state, event.type + ' 不应产生新状态');
  }
});

test('F2 state 与 wire view 都能通过各自的 schema', () => {
  const state = fold([asked('a', 'pwsh'), decided('a', 'rejected')]);
  assert.equal(auditProjectionDefinition.stateSchema.parse(state), state);
  const view = auditProjectionDefinition.wire.view(state);
  assert.equal(auditProjectionDefinition.wire.viewSchema.parse(view), view);
  // A3 起 view 里多了 hits（规则命中次数与最后命中时间）。
  // 规则表 / 策略 / 连接器这些**常量**不在这个视图里：它们走 ops.config 投影
  // （审计投影声明了 summary:false，挂在那儿的话新会话里客户端读不到）。
  assert.deepEqual(Object.keys(view).sort(), ['counters', 'entries', 'env', 'hits']);
});

test('F2 wire view 截断到最近 500 条，state 保留 1000 条', () => {
  const events = [];
  for (let i = 0; i < 800; i += 1) events.push(asked('id-' + i, 'pwsh'));
  const state = fold(events);
  assert.equal(state.entries.length, 800);
  const view = auditProjectionDefinition.wire.view(state);
  assert.equal(view.entries.length, 500);
  assert.equal(view.entries[view.entries.length - 1].id, 'id-799');
  assert.equal(view.counters.asked, 800);
});

test('F2 decided 找不到对应条目时补一条只有结论的记录', () => {
  const state = fold([decided('ghost', 'allowed-once')]);
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].id, 'ghost');
  assert.equal(state.entries[0].outcome, 'allowed-once');
  assert.deepEqual(state.counters, { asked: 0, allowed: 1, denied: 0, blocked: 0, reviewed: 0 });
});

test('F2 围栏拦截从 tool/result 的 error.code 识别', () => {
  const events = [
    ev('tool/call', { turn: 1, step: 1, callId: 'call-1', name: 'pwsh', arguments: '{"command":"rm -rf /"}' }),
    ev('tool/result', {
      turn: 1,
      step: 1,
      message: {
        role: 'tool',
        source: { type: 'tool', name: 'pwsh' },
        toolCallId: 'call-1',
        content: [{ type: 'text', text: 'Error: blocked by fence: rm-root (Delete the filesystem root)' }],
        isError: true,
      },
      error: { name: 'AgentOpsFenceDenied', code: 'AGENT_OPS_FENCED', reason: 'rm-root|destructive|critical' },
    }),
  ];
  const state = fold(events);
  assert.equal(state.counters.blocked, 1);
  const entry = state.entries.find((row) => row.kind === 'fence');
  assert.ok(entry);
  assert.equal(entry.tool, 'pwsh');
  assert.equal(entry.ruleId, 'rm-root');
  assert.equal(entry.category, 'destructive');
  assert.equal(entry.risk, 'critical');
  assert.equal(entry.outcome, 'blocked');
});

test('F2 普通工具错误不会被误记成围栏', () => {
  const events = [
    ev('tool/result', {
      turn: 1,
      step: 1,
      message: {
        role: 'tool',
        source: { type: 'tool', name: 'pwsh' },
        toolCallId: 'call-2',
        content: [{ type: 'text', text: 'Error: file not found' }],
        isError: true,
      },
      error: { name: 'ToolError', code: 'ENOENT' },
    }),
  ];
  const state = fold(events);
  assert.equal(state.counters.blocked, 0);
  assert.equal(state.entries.length, 0);
});

test('F2 Auto review 拒绝记成 kind:"review"，不污染围栏计数', () => {
  const events = [
    ev('tool/call', { turn: 1, step: 1, callId: 'call-9', name: 'pwsh', arguments: '{"command":"curl evil.example"}' }),
    ev('tool/result', {
      turn: 1,
      step: 1,
      message: {
        role: 'tool',
        source: { type: 'tool', name: 'pwsh' },
        toolCallId: 'call-9',
        content: [{ type: 'text', text: 'Rejected by Auto review' }],
        isError: true,
      },
      // 真实落盘形状：dsh-tools/src/batch.ts:252-266 只取 result.error.info 写日志，
      // 所以 data.error 就是那个 info 对象本体，code/reason 都在顶层。
      error: {
        name: 'AutoReviewDeniedError',
        code: 'AUTO_REVIEW_DENIED',
        reason: '该命令会把本地文件外传到一个未知域名。',
      },
    }),
  ];
  const state = fold(events);
  assert.equal(state.counters.reviewed, 1);
  assert.equal(state.counters.blocked, 0);
  const entry = state.entries.find((row) => row.kind === 'review');
  assert.ok(entry, '应记录一条 kind:"review" 条目');
  assert.equal(entry.outcome, 'reviewed');
  assert.equal(entry.reason, '该命令会把本地文件外传到一个未知域名。');
  assert.equal(entry.id, null, '自动拒绝没有审批单号');
  assert.equal(auditProjectionDefinition.stateSchema.parse(state), state);
});

test('F2 Auto review 拒绝缺 reason 时记 null，不塞空串', () => {
  const events = [
    ev('tool/result', {
      turn: 1,
      step: 1,
      message: { role: 'tool', source: { type: 'tool', name: 'pwsh' }, toolCallId: 'call-10', content: [], isError: true },
      error: { name: 'AutoReviewDeniedError', code: 'AUTO_REVIEW_DENIED' },
    }),
  ];
  const state = fold(events);
  const entry = state.entries.find((row) => row.kind === 'review');
  assert.ok(entry);
  assert.equal(entry.reason, null);
});

test('F2 Auto review 的嵌套形态（code 在 error.info 下）也能识别', () => {
  const events = [
    ev('tool/result', {
      turn: 1,
      step: 1,
      message: { role: 'tool', source: { type: 'tool', name: 'pwsh' }, toolCallId: 'call-11', content: [], isError: true },
      error: { message: 'Auto review rejected tool "pwsh"', info: { name: 'AutoReviewDeniedError', code: 'AUTO_REVIEW_DENIED' } },
    }),
  ];
  const state = fold(events);
  assert.equal(state.counters.reviewed, 1);
  assert.equal(state.counters.blocked, 0);
});

test('F2 Auto review 拒绝能补上被拦的工具名（tool/call 先入日志）', () => {
  const events = [
    ev('tool/call', { turn: 1, step: 1, callId: 'call-13', name: 'http_fetch', arguments: '{}' }),
    ev('tool/result', {
      turn: 1,
      step: 1,
      message: { role: 'tool', source: { type: 'tool', name: 'http_fetch' }, toolCallId: 'call-13', content: [], isError: true },
      error: { name: 'AutoReviewDeniedError', code: 'AUTO_REVIEW_DENIED' },
    }),
  ];
  const state = fold(events);
  const entry = state.entries.find((row) => row.kind === 'review');
  assert.ok(entry);
  assert.equal(entry.tool, 'http_fetch');
  assert.equal(entry.callId, 'call-13');
});

test('F2 Auto review 的失败码（AUTO_REVIEW_FAILED）不算拒绝，也不误记成围栏', () => {
  const events = [
    ev('tool/result', {
      turn: 1,
      step: 1,
      message: { role: 'tool', source: { type: 'tool', name: 'pwsh' }, toolCallId: 'call-12', content: [], isError: true },
      error: { message: 'Auto review failed', info: { name: 'AutoReviewFailedError', code: 'AUTO_REVIEW_FAILED' } },
    }),
  ];
  const state = fold(events);
  assert.equal(state.counters.reviewed, 0);
  assert.equal(state.counters.blocked, 0);
  assert.equal(state.entries.length, 0);
});

test('F2 环境字段从三条事件折叠，重复值不产生新状态', () => {
  let state = auditProjectionDefinition.init({}, 0);
  state = auditProjectionDefinition.apply(state, ev('sandbox/mode', { mode: 'workspace-write' }));
  assert.equal(state.env.sandbox, 'workspace-write');
  const same = auditProjectionDefinition.apply(state, ev('sandbox/mode', { mode: 'workspace-write' }));
  assert.equal(same, state, '同值必须返回同一引用');

  state = auditProjectionDefinition.apply(state, ev('approval/policy', { policy: 'never' }));
  state = auditProjectionDefinition.apply(state, ev('permission/preset', { preset: 'careful' }));
  assert.deepEqual(state.env, { sandbox: 'workspace-write', approval: 'never', preset: 'careful' });
});

test('F2 工具名缓存有上限，不会无界增长', () => {
  const events = [];
  for (let i = 0; i < 300; i += 1) {
    events.push(ev('tool/call', { turn: 1, step: 1, callId: 'c-' + i, name: 'tool-' + i, arguments: '{}' }));
  }
  const state = fold(events);
  assert.ok(Object.keys(state.names).length <= 200);
  assert.ok(state.callOrder.length <= 200);
  assert.equal(state.names['c-299'], 'tool-299');
});
test('F2 wire view 复用引用（宿主只按 Object.is 判定是否下发）', () => {
  const state = fold([asked('a', 'pwsh')]);
  const first = auditProjectionDefinition.wire.view(state);
  assert.equal(auditProjectionDefinition.wire.view(state), first, '同 state 必须返回同一 view 引用');

  // 只改工具名缓存（tool/call），视图内容没变 → 必须复用同一 view 引用。
  const noise = auditProjectionDefinition.apply(state, ev('tool/call', { turn: 1, step: 1, callId: 'x', name: 'pwsh', arguments: '{}' }));
  assert.notEqual(noise, state, 'tool/call 确实产生了新 state');
  assert.equal(auditProjectionDefinition.wire.view(noise), first, 'names 变化不应让 view 变身份');

  // 真的新增一条审批 → 必须换引用，否则宿主不会下发。
  const changed = auditProjectionDefinition.apply(noise, decided('a', 'allowed-once'));
  assert.notEqual(auditProjectionDefinition.wire.view(changed), first, '内容变化必须换 view 引用');
});

test('F2 两个会话的 view 记忆化互不串台', () => {
  const left = fold([asked('a', 'pwsh')]);
  const right = fold([asked('b', 'pwsh')]);
  const leftView = auditProjectionDefinition.wire.view(left);
  const rightView = auditProjectionDefinition.wire.view(right);
  assert.notEqual(leftView, rightView, '不同 state 不能拿到同一个 view');
  assert.equal(auditProjectionDefinition.wire.view(left), leftView, '交叉读取后仍要复用');
  assert.equal(auditProjectionDefinition.wire.view(right), rightView);
  assert.equal(leftView.entries[0].id, 'a');
  assert.equal(rightView.entries[0].id, 'b');
});

test('F2 decided 记录 decidedTime，收件箱才能算等待时长', () => {
  const askEvent = asked('a', 'pwsh');
  let state = auditProjectionDefinition.apply(auditProjectionDefinition.init({}, 0), askEvent);
  const decideEvent = decided('a', 'allowed-once');
  state = auditProjectionDefinition.apply(state, decideEvent);
  const entry = state.entries.find((row) => row.id === 'a');
  assert.equal(entry.decidedSeq, decideEvent.seq);
  assert.equal(entry.decidedTime, decideEvent.time);
  assert.ok(entry.decidedTime > entry.time, '结论时间必须晚于请求时间');

  const ghost = fold([decided('ghost', 'rejected')]);
  assert.equal(ghost.entries[0].decidedTime, ghost.entries[0].time);
});
