/**
 * lib/teach.js — 示范学习：把一次会话的执行轨迹变成可复用的例程草稿（G6）
 *
 * DSH 没有「录制」：没有屏幕录像、没有鼠标键盘流。04 方案 §9.7 的判断是
 * **会话日志本身就是完整的执行轨迹**——它记下了每一次工具调用、每一次人工介入
 * （approval/asked）与每一次失败重试。所以「Teach a task」在我们这里不是录像回放，
 * 而是**日志回放 → 抽取骨架 → 生成草稿 → 人工确认后落盘**。
 *
 * 能学到什么、学不到什么（必须诚实写进生成物）：
 *   能学到  工具调用序列与参数骨架、哪一步停下来问过人、失败重试的形态
 *   学不到  鼠标键盘级操作（dsh-cua 不保留）、用户当时的隐含判断、环境状态
 *
 * 三条纪律：
 *   1. **未确认前不写盘**：生成只是生成，落盘必须由用户显式确认（/ops-teach save）。
 *   2. 步骤数 = 工具调用数（验收口径），不合并、不抽样。
 *   3. 只写到 `<cwd>/.dsh/skills/<name>/SKILL.md`，名字必须是 kebab-case，
 *      杜绝路径穿越。
 */

import { argumentsText, shellCommandOf } from './rules/classify.js';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** skill 名的语法：与 DSH 的技能名规则一致（kebab-case）。 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 单步摘要长度上限。 */
const MAX_SUMMARY = 200;

/**
 * 从会话事件里抽取工具调用序列。
 *
 * @param {object[]} events 会话事件（sessionQuery.readSession 的 events）。
 * @returns {{ steps: object[], approvals: number, failures: number }}
 */
export function extractSteps(events) {
  const list = Array.isArray(events) ? events : [];
  const steps = [];
  let approvals = 0;
  let failures = 0;
  for (const event of list) {
    if (!isPlainObject(event)) continue;
    if (event.type === 'approval/asked') {
      approvals += 1;
      continue;
    }
    if (event.type === 'tool/call') {
      const data = isPlainObject(event.data) ? event.data : {};
      const name = typeof data.name === 'string' ? data.name : '';
      if (name.length === 0) continue;
      steps.push({
        index: steps.length + 1,
        tool: name,
        summary: summarizeCall(name, data.arguments),
        at: typeof event.time === 'number' ? event.time : 0,
      });
      continue;
    }
    if (event.type === 'tool/result') {
      const data = isPlainObject(event.data) ? event.data : {};
      if (data.error !== undefined && data.error !== null) failures += 1;
    }
  }
  return { steps, approvals, failures };
}

/** 一句话概括一次工具调用。 */
function summarizeCall(name, args) {
  const command = shellCommandOf(name, args);
  const text = command !== undefined ? command : argumentsText(args);
  const flat = String(text).replace(/\s+/gu, ' ').trim();
  return flat.length > MAX_SUMMARY ? flat.slice(0, MAX_SUMMARY) + '…' : flat;
}

/**
 * 生成 SKILL.md 草稿与工作流脚本草稿。
 *
 * @param {{name: string, title?: string, description?: string, steps: object[], approvals: number, failures: number, sessionId?: string}} input
 * @returns {{ name: string, description: string, content: string, workflow: string, steps: object[] }}
 */
export function buildSkillDraft(input) {
  const steps = Array.isArray(input.steps) ? input.steps : [];
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error('技能名只能是小写字母、数字与连字符（kebab-case）。');
  }
  const description = typeof input.description === 'string' && input.description.trim().length > 0
    ? input.description.trim()
    : '由 Agent Ops 从一次会话的执行轨迹回放生成的例程：' + steps.length + ' 步工具调用。';
  const title = typeof input.title === 'string' && input.title.trim().length > 0 ? input.title.trim() : name;

  const lines = [];
  lines.push('---');
  lines.push('name: ' + name);
  lines.push('description: ' + oneLine(description));
  lines.push('---');
  lines.push('');
  lines.push('# ' + title);
  lines.push('');
  lines.push('本例程由 Agent Ops 从会话的执行轨迹回放生成（' + String(steps.length) + ' 次工具调用，'
    + String(input.approvals ?? 0) + ' 次人工介入，' + String(input.failures ?? 0) + ' 次失败）。');
  lines.push('');
  lines.push('## 步骤');
  lines.push('');
  for (const step of steps) {
    lines.push(String(step.index) + '. 用 `' + step.tool + '` 执行：' + (step.summary.length > 0 ? '`' + step.summary + '`' : '（无参数）'));
  }
  lines.push('');
  lines.push('## 已知边界');
  lines.push('');
  lines.push('- 只覆盖工具调用序列，不覆盖鼠标键盘级操作（dsh-cua 的会话不保留这些）。');
  lines.push('- 不包含用户当时的隐含判断与环境状态——回放的是动作，不是机器。');
  if ((input.approvals ?? 0) > 0) {
    lines.push('- 这一步流程里有 ' + String(input.approvals) + ' 次停下来问人，重跑时同样会停下来。');
  }
  lines.push('');

  return {
    name,
    description,
    content: lines.join('\n'),
    workflow: buildWorkflowDraft(input, name, description),
    steps,
  };
}

/** 工作流脚本草稿：把演示过的步骤写成 agent() 调用序列。 */
function buildWorkflowDraft(input, name, description) {
  const steps = Array.isArray(input.steps) ? input.steps : [];
  const lines = [];
  lines.push('// 由 Agent Ops 从会话轨迹回放生成的工作流草稿（请人工审阅后再用）。');
  lines.push('// 脚本体以顶层 await 运行，以 return <json-value> 结束。');
  lines.push('// 可用钩子：agent(prompt, opts) / parallel() / pipeline() / phase() / log()。');
  lines.push('');
  lines.push('phase(' + JSON.stringify('重放 ' + String(steps.length) + ' 步') + ')');
  lines.push('');
  for (const step of steps) {
    const prompt = '用 ' + step.tool + ' 执行：' + (step.summary.length > 0 ? step.summary : '（无参数）');
    lines.push('await agent(' + JSON.stringify(prompt) + ')');
  }
  lines.push('');
  lines.push('return { name: ' + JSON.stringify(name) + ', steps: ' + String(steps.length) + ' }');
  return lines.join('\n');
}

/** 单行化（YAML frontmatter 里不能有换行）。 */
function oneLine(text) {
  return String(text).replace(/\s+/gu, ' ').trim();
}

/**
 * 技能文件在项目里的位置。
 *
 * 选 `<cwd>/.dsh/skills` 而不是 `~/.dsh/skills`：项目级技能在 DSH 的技能优先级里
 * 排最高（rank 100），而且跟着仓库走——这正是「可版本化的资产」该有的样子。
 */
export function skillDirectoryFor(cwd, name) {
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new Error('不知道当前工作目录，无法落盘。');
  }
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error('技能名只能是小写字母、数字与连字符（kebab-case）。');
  }
  const base = cwd.replace(/[\\/]+$/u, '');
  return base + '/.dsh/skills/' + name;
}
