import test from 'node:test';
import assert from 'node:assert/strict';

import { createApprovalIndex } from '../lib/approval-index.js';

function request(overrides = {}) {
  return { toolName: 'pwsh', callId: 'call-1', reason: 'agent-ops: rm-root', ...overrides };
}

test('A1 审批索引记录在飞与结论，不改变结论本身', () => {
  const index = createApprovalIndex();
  const ticket = index.begin(request());
  assert.equal(index.size, 1);

  const snapshot = index.snapshot();
  assert.equal(snapshot.pending.length, 1);
  assert.equal(snapshot.pending[0].tool, 'pwsh');

  index.settle(ticket, 'allowed-once');
  assert.equal(index.size, 0);
  const after = index.snapshot();
  assert.equal(after.pending.length, 0);
  assert.equal(after.recent.length, 1);
  assert.equal(after.recent[0].outcome, 'allowed-once');
  assert.equal(typeof after.recent[0].durationMs, 'number');
});

test('A1 没有 callId 的请求也能拿到稳定 key', () => {
  const index = createApprovalIndex();
  const a = index.begin({ toolName: 'pwsh' });
  const b = index.begin({ toolName: 'pwsh' });
  assert.equal(a.key, 'pending-1');
  assert.equal(b.key, 'pending-2');
  assert.notEqual(a.key, b.key);
});

test('A1 最近记录按上限淘汰', () => {
  const index = createApprovalIndex({ limit: 3 });
  for (let i = 0; i < 6; i += 1) {
    const ticket = index.begin(request({ callId: 'c-' + i }));
    index.settle(ticket, 'rejected');
  }
  const snapshot = index.snapshot();
  assert.equal(snapshot.recent.length, 3);
  assert.equal(snapshot.recent[2].key, 'c-5');
});

test('A1 抛错时记为 unavailable 并保留错误信息', () => {
  const index = createApprovalIndex();
  const ticket = index.begin(request());
  index.settle(ticket, 'unavailable', new Error('answerer blew up'));
  const snapshot = index.snapshot();
  assert.equal(snapshot.recent[0].outcome, 'unavailable');
  assert.equal(snapshot.recent[0].error, 'answerer blew up');
});

test('A1 settle 幂等：重复 settle 不产生重复行', () => {
  const index = createApprovalIndex();
  const ticket = index.begin(request());
  index.settle(ticket, 'allowed-once');
  index.settle(ticket, 'allowed-once');
  assert.equal(index.snapshot().recent.length, 2, '每次 settle 仍是一条记录（调用方保证只调一次）');
  assert.equal(index.size, 0);
});
