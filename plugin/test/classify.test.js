import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FENCE_CATEGORIES, RISK_LEVELS, RULES, classifyToolCall, shellCommandOf,
  argumentsText, atLeast, rulesAsJson, sortedRules,
} from '../lib/rules/classify.js';

const CRITICAL_SAMPLES = [
  ['pwsh', { command: 'rm -rf /' }, 'rm-root'],
  ['pwsh', { command: 'rm -rf ~/*' }, 'rm-root'],
  ['pwsh', { command: 'Format-Volume -DriveLetter D' }, 'disk-format'],
  ['pwsh', { command: 'dd if=/dev/zero of=/dev/sda bs=1M' }, 'disk-raw-write'],
  ['pwsh', { command: 'Remove-Item -Recurse -Force C:\\Windows' }, 'remove-item-recursive-force'],
  ['pwsh', { command: 'git push --force origin main' }, 'git-force-push'],
  ['pwsh', { command: 'sudo rm /etc/passwd' }, 'privilege-escalation'],
  ['pwsh', { command: 'npm publish --access public' }, 'package-publish'],
  ['pwsh', { command: 'kubectl delete deployment api -n prod' }, 'k8s-mutate-prod'],
  ['pwsh', { command: 'terraform apply -auto-approve' }, 'terraform-apply-destroy'],
  ['pwsh', { command: 'psql -c "DROP TABLE users"' }, 'sql-drop'],
  ['pwsh', { command: 'psql -c "TRUNCATE users"' }, 'sql-truncate'],
];

test('A4 十二个高危样本必须被分类命中', () => {
  for (const [name, args, expected] of CRITICAL_SAMPLES) {
    const hit = classifyToolCall(name, args);
    assert.ok(hit, name + ' ' + JSON.stringify(args) + ' 应命中规则');
    assert.equal(hit.ruleId, expected, name + ' ' + JSON.stringify(args));
    assert.ok(FENCE_CATEGORIES[hit.category], '分类必须在七类内：' + hit.category);
    assert.ok(RISK_LEVELS.includes(hit.risk), '风险等级必须合法：' + hit.risk);
  }
});

test('A4 只读与执行器工具一律短路，不产生误报', () => {
  for (const name of ['read', 'glob', 'grep', 'read_image', 'web_search', 'web_fetch', 'todo_write', 'skill']) {
    assert.equal(classifyToolCall(name, { path: 'rm -rf / DROP TABLE users' }), undefined, name + ' 应短路');
  }
  for (const name of ['run_code', 'workflow', 'ralph']) {
    assert.equal(classifyToolCall(name, { code: 'db.exec("DROP TABLE users")' }), undefined, name + ' 应短路');
  }
});

test('A4 日常命令不误报', () => {
  const benign = [
    ['pwsh', { command: 'ls' }],
    ['pwsh', { command: 'git status' }],
    ['pwsh', { command: 'git commit -m "fix"' }],
    ['pwsh', { command: 'npm run build' }],
    ['pwsh', { command: 'cat README.md' }],
    ['pwsh', { command: 'git push origin feature/x' }],
    ['read', { file_path: 'D:\\a.txt' }],
    ['write', { file_path: 'D:\\a.txt', content: 'hello' }],
    ['edit', { file_path: 'D:\\a.txt' }],
  ];
  for (const [name, args] of benign) {
    assert.equal(classifyToolCall(name, args), undefined, name + ' ' + JSON.stringify(args) + ' 不应命中');
  }
});

test('A5 分类表可导出为 JSON，审计 risk 字段与查表一致', () => {
  const json = rulesAsJson();
  assert.equal(json.length, RULES.length);
  for (const row of json) {
    assert.equal(typeof row.id, 'string');
    assert.ok(FENCE_CATEGORIES[row.category], row.id + ' 分类非法');
    assert.ok(RISK_LEVELS.includes(row.risk), row.id + ' 风险非法');
    assert.equal(typeof row.pattern, 'string');
    assert.equal(typeof row.flags, 'string');
  }
  const hit = classifyToolCall('pwsh', { command: 'git push --force origin main' });
  const row = json.find((item) => item.id === hit.ruleId);
  assert.ok(row);
  assert.equal(row.risk, hit.risk);
  assert.equal(row.category, hit.category);
});

test('A5 规则 id 唯一，排序按风险降序且稳定', () => {
  const ids = RULES.map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length, '规则 id 必须唯一');
  const sorted = sortedRules();
  const weight = { critical: 3, high: 2, medium: 1, low: 0 };
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(weight[sorted[i - 1].risk] >= weight[sorted[i].risk], '排序必须按风险降序');
  }
  assert.deepEqual(sortedSortedIds(sorted), sortedSortedIds(sortedRules()), '排序必须稳定');
  function sortedSortedIds(list) {
    return list.map((rule) => rule.id).join(',');
  }
});

test('shellCommandOf 只对 shell 类工具取值，支持字符串数组', () => {
  assert.equal(shellCommandOf('read', { command: 'ls' }), undefined);
  assert.equal(shellCommandOf('pwsh', { command: 'ls' }), 'ls');
  assert.equal(shellCommandOf('bash', { script: 'npm test' }), 'npm test');
  assert.equal(shellCommandOf('pwsh', { commands: ['npm ci', 'npm test'] }), 'npm ci\nnpm test');
  assert.equal(shellCommandOf('pwsh', { command: 42 }), undefined);
});

test('argumentsText 接受 JSON 字符串与对象', () => {
  assert.equal(argumentsText({ a: 1 }).includes('"a"'), true);
  assert.equal(argumentsText('{"a":1}').includes('"a"'), true);
  assert.equal(argumentsText('not json'), 'not json');
});

test('atLeast 比较风险阈值', () => {
  assert.equal(atLeast('critical', 'high'), true);
  assert.equal(atLeast('high', 'high'), true);
  assert.equal(atLeast('medium', 'high'), false);
  assert.equal(atLeast('critical', null), false);
});
