import test from 'node:test';
import assert from 'node:assert/strict';

import { Session } from '@deepseek-ai/dsh-session';

import {
  RULE_RECORD_TYPE,
  addUserRule,
  exportUserRulesYaml,
  importUserRulesYaml,
  removeUserRule,
  writeUserRules,
} from '../lib/rules-table.js';
import { configProjectionDefinition } from '../lib/config-projection.js';

function newSession(id) {
  return Session.create(id);
}

/** 把会话里的插件记录折叠成投影状态。 */
function foldSession(session) {
  let state = configProjectionDefinition.init({}, 0);
  for (const event of session.ownEvents()) {
    state = configProjectionDefinition.apply(state, event);
  }
  return state;
}

test('A3 规则表投影的 key 与 stateVersion 固定，默认成员资格（客户端要能读到）', () => {
  assert.equal(configProjectionDefinition.key, 'ops.config');
  assert.equal(configProjectionDefinition.stateVersion, 1);
  // summary 未声明 = true：这样会话列表的缓存里也带着它，新会话里客户端读得到。
  assert.notEqual(configProjectionDefinition.wire.summary, false);
});

test('A3 写规则 → 记录进会话日志 → 投影折出同一张表', () => {
  const session = newSession('s-rules-1');
  const seq = writeUserRules(session, [
    { id: 'ask-publish', effect: 'ask', tool: null, pattern: 'npm publish', note: null },
  ]);
  assert.equal(typeof seq, 'number');

  const events = session.ownEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, RULE_RECORD_TYPE);
  // 插件记录必须带 ignorable：旧版本读到会跳过而不是拒绝整条日志。
  assert.equal(events[0].ignorable, true);

  const state = foldSession(session);
  assert.equal(state.userRules.length, 1);
  assert.equal(state.userRules[0].id, 'ask-publish');
  assert.equal(state.userRules[0].effect, 'ask');
});

test('A3 规则表是整表覆盖：后写的赢', () => {
  const session = newSession('s-rules-2');
  writeUserRules(session, [{ id: 'a', effect: 'ask', tool: null, pattern: 'x', note: null }]);
  writeUserRules(session, [{ id: 'b', effect: 'ask', tool: null, pattern: 'y', note: null }]);
  const state = foldSession(session);
  assert.deepEqual(state.userRules.map((rule) => rule.id), ['b']);
});

test('A3 非法规则写不进表（整表写入时被剔除）', () => {
  const session = newSession('s-rules-3');
  writeUserRules(session, [
    { id: 'ok', effect: 'ask', tool: null, pattern: 'x', note: null },
    { id: 'BAD ID', effect: 'ask', tool: null, pattern: 'y', note: null },
  ]);
  const state = foldSession(session);
  assert.deepEqual(state.userRules.map((rule) => rule.id), ['ok']);
});

test('A3 加规则：重复 id 被拒，合法规则写进表', () => {
  const session = newSession('s-rules-4');
  const current = [];
  const added = addUserRule(session, current, { id: 'ask-one', effect: 'ask', tool: null, pattern: 'npm run build', note: null });
  assert.equal(added.ok, true);
  assert.equal(added.rules.length, 1);

  const again = addUserRule(session, added.rules, { id: 'ask-one', effect: 'ask', tool: null, pattern: 'x', note: null });
  assert.equal(again.ok, false);
  assert.match(again.reason, /重复/);
});

test('A3 加规则：高危动作不能加成 allow', () => {
  const session = newSession('s-rules-5');
  const result = addUserRule(session, [], { id: 'allow-publish', effect: 'allow', tool: null, pattern: 'npm publish', note: null });
  assert.equal(result.ok, false);
  assert.match(result.reason, /高危动作不可设为自动放行/);
});

test('A3 删规则：不存在时报错，存在时写新表', () => {
  const session = newSession('s-rules-6');
  const missing = removeUserRule(session, [], 'nope');
  assert.equal(missing.ok, false);

  writeUserRules(session, [{ id: 'a', effect: 'ask', tool: null, pattern: 'x', note: null }]);
  const removed = removeUserRule(session, [{ id: 'a', effect: 'ask', tool: null, pattern: 'x', note: null }], 'a');
  assert.equal(removed.ok, true);
  assert.deepEqual(foldSession(session).userRules, []);
});

test('D1 导出 YAML 再导入：规则 id 稳定、数量不变', () => {
  const session = newSession('s-rules-7');
  const rules = [
    { id: 'ask-publish', effect: 'ask', tool: null, pattern: 'npm publish', note: null },
    { id: 'allow-fork', effect: 'allow', tool: 'bash', pattern: 'git push origin fork', note: null },
  ];
  writeUserRules(session, rules);
  const yaml = exportUserRulesYaml(foldSession(session).userRules);
  assert.match(yaml, /- id: ask-publish/);

  const target = newSession('s-rules-8');
  const imported = importUserRulesYaml(target, yaml);
  assert.equal(imported.ok, true);
  const state = foldSession(target);
  assert.deepEqual(state.userRules.map((rule) => rule.id), ['ask-publish', 'allow-fork']);
});

test('D1 导入非法 YAML 不写盘', () => {
  const session = newSession('s-rules-9');
  const result = importUserRulesYaml(session, '这不是 yaml');
  assert.equal(result.ok, false);
  assert.equal(session.ownEvents().length, 0);
});

test('A3 投影不关心的事件返回同一引用（硬约束 2）', () => {
  const state = configProjectionDefinition.init({}, 0);
  const next = configProjectionDefinition.apply(state, { type: 'approval/asked', seq: 1, time: 1, data: {} });
  assert.equal(next, state);
});

test('A3 投影的 state 与 view 都能通过自己的 schema', () => {
  const session = newSession('s-rules-10');
  writeUserRules(session, [{ id: 'a', effect: 'ask', tool: null, pattern: 'x', note: null }]);
  const state = foldSession(session);
  assert.equal(configProjectionDefinition.stateSchema.parse(state), state);
  const view = configProjectionDefinition.wire.view(state);
  assert.equal(configProjectionDefinition.wire.viewSchema.parse(view), view);
});

test('A3 view 复用引用：同一 state 多次取 view 恒等', () => {
  const session = newSession('s-rules-11');
  writeUserRules(session, [{ id: 'a', effect: 'ask', tool: null, pattern: 'x', note: null }]);
  const state = foldSession(session);
  assert.equal(configProjectionDefinition.wire.view(state), configProjectionDefinition.wire.view(state));
});
