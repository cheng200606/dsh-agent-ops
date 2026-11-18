import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSkillDraft, extractSteps, skillDirectoryFor } from '../lib/teach.js';

function toolCall(index, name, args) {
  return {
    type: 'tool/call',
    seq: index,
    time: 1000 + index,
    data: { callId: 'c' + index, name, arguments: args },
  };
}

test('G6 抽取工具调用序列，步骤数与工具调用数一致', () => {
  const events = [
    toolCall(1, 'bash', { command: 'npm install' }),
    toolCall(2, 'bash', { command: 'npm test' }),
    toolCall(3, 'read', { file_path: 'a.txt' }),
    toolCall(4, 'bash', { command: 'npm run build' }),
    toolCall(5, 'bash', { command: 'npm publish' }),
    toolCall(6, 'bash', { command: 'git status' }),
    toolCall(7, 'read', { file_path: 'b.txt' }),
    toolCall(8, 'write', { file_path: 'c.txt', content: 'x' }),
  ];
  const { steps, approvals, failures } = extractSteps(events);
  assert.equal(steps.length, 8, '8 次工具调用 → 8 个步骤');
  assert.equal(steps[0].tool, 'bash');
  assert.equal(steps[0].summary, 'npm install');
  assert.equal(approvals, 0);
  assert.equal(failures, 0);
});

test('G6 统计人工介入点与失败次数', () => {
  const events = [
    { type: 'approval/asked', seq: 1, time: 1, data: { id: 'a', toolName: 'bash' } },
    toolCall(2, 'bash', { command: 'npm publish' }),
    { type: 'tool/result', seq: 3, time: 3, data: { error: { message: 'denied' } } },
  ];
  const { steps, approvals, failures } = extractSteps(events);
  assert.equal(steps.length, 1);
  assert.equal(approvals, 1);
  assert.equal(failures, 1);
});

test('G6 生成的 SKILL.md 有合法 frontmatter 与步骤清单', () => {
  const { steps, approvals, failures } = extractSteps([
    toolCall(1, 'bash', { command: 'npm test' }),
    toolCall(2, 'bash', { command: 'npm run build' }),
  ]);
  const draft = buildSkillDraft({ name: 'npm-release', steps, approvals, failures });
  assert.match(draft.content, /^---\nname: npm-release\ndescription: .+\n---\n/);
  assert.match(draft.content, /1\. 用 `bash` 执行：`npm test`/);
  assert.match(draft.content, /2\. 用 `bash` 执行：`npm run build`/);
  assert.equal(draft.name, 'npm-release');
  assert.equal(draft.steps.length, 2);
});

test('G6 技能名必须是 kebab-case', () => {
  assert.throws(() => buildSkillDraft({ name: 'Bad Name', steps: [] }), /kebab-case/);
  assert.throws(() => buildSkillDraft({ name: '../escape', steps: [] }), /kebab-case/);
});

test('G6 生成物诚实写明能力边界', () => {
  const { steps } = extractSteps([toolCall(1, 'bash', { command: 'ls' })]);
  const draft = buildSkillDraft({ name: 'demo', steps, approvals: 2, failures: 0 });
  assert.match(draft.content, /不覆盖鼠标键盘级操作/);
  assert.match(draft.content, /2 次停下来问人/);
});

test('G6 工作流草稿是合法的脚本体：顶层 await + return JSON', () => {
  const { steps } = extractSteps([
    toolCall(1, 'bash', { command: 'npm test' }),
    toolCall(2, 'bash', { command: 'npm run build' }),
  ]);
  const draft = buildSkillDraft({ name: 'npm-release', steps, approvals: 0, failures: 0 });
  assert.match(draft.workflow, /await agent\(/);
  assert.match(draft.workflow, /return \{ name: "npm-release", steps: 2 \}/);
  // 草稿必须能被解析（用 new Function 验语法，不执行）。脚本体允许顶层 await，
  // 所以包一层 async IIFE 再验。
  const compiled = new Function('agent', 'phase', 'return (async () => {\n' + draft.workflow + '\n})()');
  assert.equal(typeof compiled, 'function');
});

test('G6 技能目录落在项目的 .dsh/skills 下（项目级优先级最高）', () => {
  assert.equal(skillDirectoryFor('D:/work/project', 'my-skill'), 'D:/work/project/.dsh/skills/my-skill');
  assert.equal(skillDirectoryFor('D:\\work\\project\\', 'my-skill'), 'D:\\work\\project/.dsh/skills/my-skill');
});

test('G6 不知道工作目录或名字非法时拒绝落盘', () => {
  assert.throws(() => skillDirectoryFor('', 'my-skill'), /工作目录/);
  assert.throws(() => skillDirectoryFor('D:/work', 'Bad Name'), /kebab-case/);
});
