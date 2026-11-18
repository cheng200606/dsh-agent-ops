import test from 'node:test';
import assert from 'node:assert/strict';

import { Session } from '@deepseek-ai/dsh-session';

import {
  DEFAULT_ESCALATION_POLICY,
  ESCALATION_DECISIONS,
  adjudicateEscalation,
  canAdjudicate,
  normalizeEscalationPolicy,
} from '../lib/escalation.js';
import { makeEscalationUnit } from '../lib/team-units.js';
import { normalizePolicy } from '../lib/rules/policy.js';

function fakeCtx(options = {}) {
  const warned = [];
  return {
    warned,
    logger: { warn: (message) => warned.push(message) },
    get(name) {
      if (name === 'subagents') {
        return {
          rootOf: (agent) => (options.rootOf ? options.rootOf(agent) : agent),
          namesOf: () => ({ self: options.selfName ?? 'researcher' }),
        };
      }
      return undefined;
    },
  };
}

test('G5 升级策略默认关闭裁决', () => {
  assert.deepEqual({ ...DEFAULT_ESCALATION_POLICY }, { adjudicate: false });
  assert.equal(normalizeEscalationPolicy({}).adjudicate, false);
  assert.equal(normalizeEscalationPolicy({ escalation: { adjudicate: true } }).adjudicate, true);
});

test('G5 裁决开关关闭时收件箱不可裁决', () => {
  const written = [];
  const result = adjudicateEscalation(
    { id: 'esc-1', risk: 'high', status: 'pending' },
    'approved',
    { adjudicate: false },
    (ticket) => written.push(ticket),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /只展示升级工单/);
  assert.equal(written.length, 0);
});

test('G5 critical 档永不可裁决', () => {
  const written = [];
  const result = adjudicateEscalation(
    { id: 'esc-1', risk: 'critical', status: 'pending' },
    'approved',
    { adjudicate: true },
    (ticket) => written.push(ticket),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /不可裁决/);
  assert.equal(written.length, 0);
});

test('G5 裁决结论只有两种', () => {
  assert.deepEqual(ESCALATION_DECISIONS, ['approved', 'rejected']);
  const written = [];
  const result = adjudicateEscalation(
    { id: 'esc-1', risk: 'high', status: 'pending' },
    'maybe',
    { adjudicate: true },
    (ticket) => written.push(ticket),
  );
  assert.equal(result.ok, false);
  assert.equal(written.length, 0);
});

test('G5 已裁决的工单不能再裁决', () => {
  const result = adjudicateEscalation(
    { id: 'esc-1', risk: 'high', status: 'approved' },
    'rejected',
    { adjudicate: true },
    () => {},
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /已经裁决过/);
});

test('G5 裁决成功时写回状态', () => {
  const written = [];
  const result = adjudicateEscalation(
    { id: 'esc-1', risk: 'high', status: 'pending', toolName: 'bash' },
    'approved',
    { adjudicate: true },
    (ticket) => written.push(ticket),
  );
  assert.equal(result.ok, true);
  assert.equal(written.length, 1);
  assert.equal(written[0].status, 'approved');
  assert.equal(written[0].id, 'esc-1');
});

test('G5 界面能否显示裁决按钮：按开关、风险与状态判断', () => {
  assert.equal(canAdjudicate({ risk: 'high', status: 'pending' }, { adjudicate: false }), false);
  assert.equal(canAdjudicate({ risk: 'high', status: 'pending' }, { adjudicate: true }), true);
  assert.equal(canAdjudicate({ risk: 'critical', status: 'pending' }, { adjudicate: true }), false);
  assert.equal(canAdjudicate({ risk: 'high', status: 'rejected' }, { adjudicate: true }), false);
});

test('G5 子代理撞高危动作：当场拒绝、写工单、唤醒主 Bot', async () => {
  const rootSession = Session.create('s-root');
  const rootAgent = {
    session: rootSession,
    followed: [],
    followup(message) { this.followed.push(message); },
  };
  const childAgent = { session: Session.create('s-child'), name: 'researcher' };
  const ctx = fakeCtx({ rootOf: () => rootAgent, selfName: 'researcher' });
  const unit = makeEscalationUnit(ctx, normalizePolicy({}));

  const decision = await unit({
    name: 'bash',
    arguments: { command: 'git push --force origin main' },
    agent: childAgent,
  });

  assert.ok(decision !== undefined, '子代理的高危调用必须被处理');
  assert.equal(decision.kind, 'deny');
  assert.notEqual(decision.kind, 'allow');
  assert.equal(decision.info.code, 'AGENT_OPS_ESCALATED');
  assert.match(decision.reason, /agent-ops: escalated to esc-/);
  assert.equal(rootAgent.followed.length, 1, '主 Bot 被唤醒一次');
  assert.match(String(rootAgent.followed[0].content[0].text), /升级工单/);

  // 工单必须带工具名 + 参数摘要 + 风险类目。
  const records = rootSession.ownEvents();
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'plugin:ops.escalation');
  assert.equal(records[0].data.toolName, 'bash');
  assert.equal(records[0].data.ruleId, 'git-force-push');
  assert.equal(records[0].data.category, 'destructive');
  assert.ok(records[0].data.argsSummary.length > 0, '工单带参数摘要');
  assert.equal(records[0].data.status, 'pending');
  assert.equal(records[0].data.from, 'researcher');
});

test('G5 根代理自己发起的调用不升级（原生审批链处理）', async () => {
  const rootAgent = { session: Session.create('s-root-2'), followed: [], followup() { this.followed.push(1); } };
  const ctx = fakeCtx({ rootOf: () => rootAgent });
  const unit = makeEscalationUnit(ctx, normalizePolicy({}));

  const decision = await unit({
    name: 'bash',
    arguments: { command: 'git push --force origin main' },
    agent: rootAgent,
  });
  assert.equal(decision, undefined, '根代理的调用交给宿主原生审批链');
  assert.equal(rootAgent.followed.length, 0);
});

test('G5 子代理没有审批权：升级路径永远不会给出放行结论', async () => {
  const rootAgent = { session: Session.create('s-root-3'), followed: [], followup() { this.followed.push(1); } };
  const ctx = fakeCtx({ rootOf: () => rootAgent });
  const unit = makeEscalationUnit(ctx, normalizePolicy({}));

  for (const command of ['rm -rf /', 'git push --force origin main', 'npm publish']) {
    const decision = await unit({
      name: 'bash',
      arguments: { command },
      agent: { session: Session.create('s-child-3') },
    });
    if (decision !== undefined) {
      assert.notEqual(decision.kind, 'allow', '任何路径都不许放行子代理的高危调用');
      assert.equal(decision.kind, 'deny');
    }
  }
});

test('G5 同一个 (工具, 参数) 在窗口内只唤醒一次', async () => {
  const rootAgent = { session: Session.create('s-root-4'), followed: [], followup() { this.followed.push(1); } };
  const ctx = fakeCtx({ rootOf: () => rootAgent });
  const unit = makeEscalationUnit(ctx, normalizePolicy({}));

  const execution = {
    name: 'bash',
    arguments: { command: 'git push --force origin main' },
    agent: { session: Session.create('s-child-4') },
  };
  await unit(execution);
  await unit(execution);
  assert.equal(rootAgent.followed.length, 1, '节流窗口内只唤醒一次');
});
