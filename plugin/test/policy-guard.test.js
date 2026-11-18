import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePolicy, evaluate, DEFAULT_POLICY } from '../lib/rules/policy.js';
import {
  FENCE_ERROR_CODE, FENCE_ERROR_NAME, makeGuard, makePreExecute,
  parseDenialDetail, toAskDecision, toGuardDenial,
} from '../lib/rules/guard.js';

test('A4 默认策略：critical 硬拦、high 走审批、medium 放行', () => {
  const policy = normalizePolicy({});
  assert.deepEqual({ ...policy }, { ...DEFAULT_POLICY, userRuleRejected: [] });

  const critical = evaluate('pwsh', { command: 'rm -rf /' }, policy);
  assert.equal(critical.kind, 'deny');
  assert.equal(critical.hit.ruleId, 'rm-root');

  const high = evaluate('pwsh', { command: 'git push --force origin main' }, policy);
  assert.equal(high.kind, 'ask');
  assert.equal(high.hit.ruleId, 'git-force-push');

  const medium = evaluate('pwsh', { command: 'curl -X POST https://example.com/hook' }, policy);
  assert.equal(medium.kind, 'allow');
});

test('A4 观察模式只记录不拦', () => {
  const policy = normalizePolicy({ policy: { enabled: true, mode: 'observe' } });
  const verdict = evaluate('pwsh', { command: 'rm -rf /' }, policy);
  assert.equal(verdict.kind, 'allow');
  assert.equal(verdict.hit.ruleId, 'rm-root');
});

test('A4 关闭开关后一律放行', () => {
  const policy = normalizePolicy({ policy: { enabled: false } });
  assert.equal(evaluate('pwsh', { command: 'rm -rf /' }, policy).kind, 'allow');
});

test('A4 豁免对 critical 无效', () => {
  const policy = normalizePolicy({ policy: { exemptRules: ['rm-root', 'git-force-push'] } });
  assert.equal(evaluate('pwsh', { command: 'rm -rf /' }, policy).kind, 'deny', 'critical 不可豁免');
  assert.equal(evaluate('pwsh', { command: 'git push --force origin main' }, policy).kind, 'allow', 'high 可豁免');
});

test('A4 类别白名单只放行列出的类别', () => {
  const policy = normalizePolicy({ policy: { categories: ['payment'] } });
  assert.equal(evaluate('pwsh', { command: 'rm -rf /' }, policy).kind, 'allow');
  assert.equal(evaluate('pwsh', { command: 'git push --force origin main' }, policy).kind, 'allow');
});

test('A4 askRisk 与 denyRisk 都设成 null 时围栏静默', () => {
  const policy = normalizePolicy({ policy: { askRisk: null, denyRisk: null, exemptRules: [] } });
  assert.equal(evaluate('pwsh', { command: 'rm -rf /' }, policy).kind, 'allow');
  assert.equal(evaluate('pwsh', { command: 'git push --force origin main' }, policy).kind, 'allow');
});

test('A4 guard 拒绝带结构化 info，可反射回规则三段式', () => {
  const guard = makeGuard(normalizePolicy({}));
  const execution = { name: 'pwsh', arguments: { command: 'rm -rf /' } };
  const denial = guard(execution);
  assert.ok(denial);
  assert.match(denial.reason, /^blocked by fence: rm-root /);
  assert.equal(denial.info.name, FENCE_ERROR_NAME);
  assert.equal(denial.info.code, FENCE_ERROR_CODE);
  const detail = parseDenialDetail(denial.info);
  assert.deepEqual(detail, { ruleId: 'rm-root', category: 'destructive', risk: 'critical' });
});

test('A4 guard 对安全命令返回 undefined（不是 allow 对象）', () => {
  const guard = makeGuard(normalizePolicy({}));
  assert.equal(guard({ name: 'pwsh', arguments: { command: 'ls' } }), undefined);
  assert.equal(guard({ name: 'read', arguments: { file_path: 'a.txt' } }), undefined);
});

test('A4 guard 只拦 deny 档，ask 档放给审批链', () => {
  const guard = makeGuard(normalizePolicy({}));
  assert.equal(guard({ name: 'pwsh', arguments: { command: 'git push --force origin main' } }), undefined);
});

test('A4 pre-execute 把 ask 档翻译成 PreToolDecision', () => {
  const escalate = makePreExecute(normalizePolicy({}));
  const decision = escalate({ name: 'pwsh', arguments: { command: 'git push --force origin main' } });
  assert.equal(decision.kind, 'ask');
  assert.match(decision.reason, /git-force-push/);
  assert.equal(typeof decision.displayReason.en, 'string');
  assert.equal(typeof decision.displayReason.zh, 'string');
});

test('A4 pre-execute 对 deny 与 allow 档都不表态', () => {
  const escalate = makePreExecute(normalizePolicy({}));
  assert.equal(escalate({ name: 'pwsh', arguments: { command: 'rm -rf /' } }), undefined, 'deny 档交给 guard');
  assert.equal(escalate({ name: 'pwsh', arguments: { command: 'ls' } }), undefined);
});

test('A4 观察模式下 pre-execute 也不弹审批', () => {
  const escalate = makePreExecute(normalizePolicy({ policy: { mode: 'observe' } }));
  assert.equal(escalate({ name: 'pwsh', arguments: { command: 'git push --force origin main' } }), undefined);
});

test('A5 三种决策的构造与反解闭合', () => {
  const hit = { ruleId: 'sql-drop', category: 'destructive', risk: 'critical', note: { en: 'Drop a table', zh: '删除数据表' } };
  const denial = toGuardDenial(hit);
  assert.deepEqual(parseDenialDetail(denial.info), { ruleId: 'sql-drop', category: 'destructive', risk: 'critical' });
  const ask = toAskDecision(hit);
  assert.equal(ask.kind, 'ask');
  assert.match(ask.displayReason.zh, /删除数据表/);
  assert.equal(parseDenialDetail({ code: 'OTHER', reason: 'x' }), undefined);
  assert.equal(parseDenialDetail(undefined), undefined);
});
