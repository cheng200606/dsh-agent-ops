import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_USER_RULES,
  checkAllowRuleSafety,
  isUserRuleId,
  isValidUserRuleId,
  matchUserRule,
  normalizeUserRules,
  parseUserRulesYaml,
  ruleMatches,
  stripUserRulePrefix,
  userRuleId,
  userRulesAsJson,
  userRulesAsYaml,
  validateUserRule,
} from '../lib/rules/user-rules.js';

test('A3 规则 id 必须是 kebab-case', () => {
  assert.equal(isValidUserRuleId('ask-before-publish'), true);
  assert.equal(isValidUserRuleId('ask_before'), false);
  assert.equal(isValidUserRuleId('Ask'), false);
  assert.equal(isValidUserRuleId(''), false);
  assert.equal(isValidUserRuleId('a'.repeat(65)), false);
});

test('A3 规则必须至少指定工具名或命令片段', () => {
  const result = validateUserRule({ id: 'x', effect: 'ask' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /至少要指定/);
});

test('A3 效果只能是 ask 或 allow', () => {
  const result = validateUserRule({ id: 'x', effect: 'deny', pattern: 'ls' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /ask 或 allow/);
});

test('A3 规则表上限 20 条，第 21 条被拒并给出提示', () => {
  const many = [];
  for (let i = 0; i < MAX_USER_RULES + 3; i += 1) {
    many.push({ id: 'rule-' + i, effect: 'ask', pattern: 'cmd-' + i });
  }
  const { rules, rejected } = normalizeUserRules(many);
  assert.equal(rules.length, MAX_USER_RULES);
  assert.equal(rejected.length, 3);
  assert.match(rejected[0].reason, /最多 20 条/);
});

test('A3 重复 id 被拒', () => {
  const { rules, rejected } = normalizeUserRules([
    { id: 'same', effect: 'ask', pattern: 'a' },
    { id: 'same', effect: 'ask', pattern: 'b' },
  ]);
  assert.equal(rules.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason, /重复/);
});

test('A3 高危动作不能被保存成 allow 规则', () => {
  const denied = validateUserRule({ id: 'allow-publish', effect: 'allow', pattern: 'npm publish' });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /高危动作不可设为自动放行/);
  assert.equal(denied.ruleId, 'package-publish');

  const critical = validateUserRule({ id: 'allow-drop', effect: 'allow', pattern: 'drop table' });
  assert.equal(critical.ok, false);
  assert.equal(critical.category, 'destructive');
});

test('A3 普通动作可以保存成 allow 规则', () => {
  const allowed = validateUserRule({ id: 'allow-fork-push', effect: 'allow', pattern: 'git push origin fork' });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.rule.tool, null);
  assert.equal(allowed.rule.pattern, 'git push origin fork');
});

test('A3 allow 规则的安全检查只拦 critical 档', () => {
  assert.deepEqual(checkAllowRuleSafety({ id: 'a', effect: 'allow', tool: null, pattern: 'npm install' }), { ok: true });
  const blocked = checkAllowRuleSafety({ id: 'a', effect: 'allow', tool: null, pattern: 'terraform apply' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.category, 'production');
});

test('A3 规则命中：tool 与 pattern 都得对上', () => {
  const rule = { id: 'r', effect: 'ask', tool: 'bash', pattern: 'npm test', note: null };
  assert.equal(ruleMatches(rule, 'bash', { command: 'npm test -- --watch=false' }), true);
  assert.equal(ruleMatches(rule, 'pwsh', { command: 'npm test' }), false);
  assert.equal(ruleMatches(rule, 'bash', { command: 'ls' }), false);
});

test('A3 Ask 优先：allow 与 ask 同时命中时结果是 ask', () => {
  const rules = [
    { id: 'allow-one', effect: 'allow', tool: null, pattern: 'deploy', note: null },
    { id: 'ask-one', effect: 'ask', tool: null, pattern: 'deploy', note: null },
  ];
  const hit = matchUserRule(rules, 'bash', { command: 'deploy now' });
  assert.equal(hit.effect, 'ask');
  assert.equal(hit.id, 'ask-one');
});

test('A3 只有 allow 规则命中时结果是 allow', () => {
  const rules = [{ id: 'allow-one', effect: 'allow', tool: null, pattern: 'deploy', note: null }];
  const hit = matchUserRule(rules, 'bash', { command: 'deploy now' });
  assert.equal(hit.effect, 'allow');
});

test('A3 用户规则 id 带前缀，与内置规则不混淆', () => {
  assert.equal(userRuleId('mine'), 'user:mine');
  assert.equal(isUserRuleId('user:mine'), true);
  assert.equal(isUserRuleId('rm-root'), false);
  assert.equal(stripUserRulePrefix('user:mine'), 'mine');
  assert.equal(stripUserRulePrefix('rm-root'), 'rm-root');
});

test('D1 规则表导出 YAML 再导入，规则 id 稳定', () => {
  const rules = [
    { id: 'ask-publish', effect: 'ask', tool: null, pattern: 'npm publish', note: '发布前问一声' },
    { id: 'allow-fork', effect: 'allow', tool: 'bash', pattern: 'git push origin fork', note: null },
  ];
  const yaml = userRulesAsYaml(rules);
  assert.match(yaml, /^rules:/m);
  assert.match(yaml, /- id: ask-publish/);
  const parsed = parseUserRulesYaml(yaml);
  assert.deepEqual(parsed.rejected, []);
  assert.deepEqual(parsed.rules.map((rule) => rule.id), ['ask-publish', 'allow-fork']);
  assert.deepEqual(parsed.rules[1], rules[1]);
});

test('D1 YAML 解析失败时给出原因而不是抛异常', () => {
  const parsed = parseUserRulesYaml('这不是 yaml');
  assert.equal(parsed.rules.length, 0);
  assert.ok(parsed.rejected.length > 0);
});

test('D1 空规则表导出后可原样导入', () => {
  const yaml = userRulesAsYaml([]);
  const parsed = parseUserRulesYaml(yaml);
  assert.deepEqual(parsed.rejected, []);
  assert.deepEqual(parsed.rules, []);
});

test('A3 导出的 JSON 不含函数与正则', () => {
  const json = userRulesAsJson([{ id: 'a', effect: 'ask', tool: null, pattern: 'x', note: null }]);
  assert.deepEqual(json, [{ id: 'a', effect: 'ask', tool: null, pattern: 'x', note: null }]);
  assert.equal(JSON.stringify(json).includes('function'), false);
});
