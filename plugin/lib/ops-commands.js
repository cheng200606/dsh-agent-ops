/**
 * lib/ops-commands.js — v1.1 的 Host 侧命令（客户端唯一的「UI → Host」写入通道）
 *
 * 为什么用 slash 命令而不是自造输入框（与 team-units.js 同一个理由）：
 * 宿主的输入管线已经把 `/xxx` 解析成命令并落到 command/run + command/done 事件，
 * 客户端一条 ctx.remote.commands.execute 就能触发，不需要我们维护第二条输入通道，
 * 也不会绕过宿主的会话锁与排队。
 *
 * 命令名受宿主约束：/^[a-z][a-z0-9_-]*$/u（不许点号、不许大写）。
 *
 * 这一组命令覆盖：
 *   /ops-rule      用户规则表（A3）：增删查导、YAML 导入导出（D1）
 *   /ops-adjudicate 升级工单裁决（G5）
 *   /ops-ignore    忽略一类主动建议（G8 的降级前提）
 *   /ops-teach     从会话轨迹生成例程草稿（G6），确认后才落盘
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';

import { adjudicateEscalation } from './escalation.js';
import { buildSkillDraft, extractSteps, skillDirectoryFor } from './teach.js';
import { addUserRule, exportUserRulesYaml, importUserRulesYaml, removeUserRule } from './rules-table.js';
import { currentConstants } from './config-projection.js';
import { writeEscalation } from './team-units.js';
import { writeTriggerIgnore } from './triggers.js';
import { MAX_USER_RULES } from './rules/user-rules.js';

export const RULE_COMMAND_NAME = 'ops-rule';
export const CONFIG_COMMAND_NAME = 'ops-config';
export const ADJUDICATE_COMMAND_NAME = 'ops-adjudicate';
export const IGNORE_COMMAND_NAME = 'ops-ignore';
export const TEACH_COMMAND_NAME = 'ops-teach';

const ok = (text) => ({ kind: 'success', text });
const fail = (text) => ({ kind: 'error', text });

/** 取会话当前的用户规则表。 */
function currentRules(configHandle, session) {
  try {
    const state = configHandle.stateOf(session);
    return Array.isArray(state.userRules) ? state.userRules : [];
  } catch {
    return [];
  }
}

/** 取会话当前的升级工单。 */
function currentEscalations(botsHandle, session) {
  try {
    const state = botsHandle.stateOf(session);
    return Array.isArray(state.escalations) ? state.escalations : [];
  } catch {
    return [];
  }
}

/**
 * 注册这一组命令。
 *
 * @param {object} ctx 插件上下文。
 * @param {object} deps { rulesHandle, botsHandle, escalationPolicy }
 * @returns {Function[]} 注销函数数组。
 */
export function registerOpsCommands(ctx, deps) {
  const disposers = [];
  const { configHandle, botsHandle } = deps;

  // ── /ops-config ──────────────────────────────────────────────
  // 客户端拿不到投影时的兜底通道：规则表 / 策略 / 连接器这些常量走命令下发。
  // 为什么需要它：投影值只会在「会话被客户端订阅」或「会话已有事件」时到达，
  // 一个刚创建、还没跑过一轮的新会话里客户端拿不到任何投影——而规则表恰恰是
  // 用户打开面板第一眼要看的东西。命令通道是宿主验证过的 UI→Host 通路。
  disposers.push(ctx.commands.register({
    name: CONFIG_COMMAND_NAME,
    description: '读取运行台的配置面（规则表 / 策略 / 连接器）。',
    input: { hint: '（无需参数）' },
    recordInput: false,
    handler() {
      const constants = currentConstants();
      const payload = {
        rules: constants.rules,
        policy: constants.policy,
        connectors: constants.connectors,
        triggers: constants.triggers,
      };
      return { kind: 'success', text: JSON.stringify(payload) };
    },
  }));

  // ── /ops-rule ────────────────────────────────────────────────
  disposers.push(ctx.commands.register({
    name: RULE_COMMAND_NAME,
    description: '管理用户规则表：list / add / remove / export / import。',
    input: { hint: 'list | add <id> <ask|allow> <片段> [--tool 工具名] | remove <id> | export | import <文件>' },
    recordInput: true,
    handler(invocation) {
      const session = invocation.agent.session;
      const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput.trim() : '';
      const parts = raw.split(/\s+/u).filter((item) => item.length > 0);
      const action = parts[0] ?? 'list';
      const rules = currentRules(configHandle, session);

      if (action === 'list') {
        if (rules.length === 0) return ok('当前会话没有用户规则（内置高危表仍然生效）。');
        const lines = rules.map((rule) => '- ' + rule.id + '：' + rule.effect
          + (rule.tool ? ' @' + rule.tool : '')
          + (rule.pattern ? ' 命中「' + rule.pattern + '」' : '')
          + (rule.note ? '（' + rule.note + '）' : ''));
        return ok('用户规则 ' + String(rules.length) + ' / ' + String(MAX_USER_RULES) + '：\n' + lines.join('\n'));
      }

      if (action === 'add') {
        const id = parts[1];
        const effect = parts[2];
        const flags = { tool: null };
        const rest = [];
        for (let i = 3; i < parts.length; i += 1) {
          if (parts[i] === '--tool' && i + 1 < parts.length) {
            flags.tool = parts[i + 1];
            i += 1;
            continue;
          }
          rest.push(parts[i]);
        }
        const pattern = rest.join(' ');
        if (id === undefined || effect === undefined) {
          return fail('用法：/ops-rule add <id> <ask|allow> <命令片段> [--tool 工具名]');
        }
        const result = addUserRule(session, rules, {
          id, effect, pattern: pattern.length > 0 ? pattern : null, tool: flags.tool, note: null,
        });
        if (!result.ok) return fail(result.reason);
        return ok('已加规则 ' + id + '（' + effect + '）。当前 ' + String(result.rules.length) + ' / ' + String(MAX_USER_RULES) + '。');
      }

      if (action === 'remove') {
        const id = parts[1];
        if (id === undefined) return fail('用法：/ops-rule remove <id>');
        const result = removeUserRule(session, rules, id);
        if (!result.ok) return fail(result.reason);
        return ok('已删规则 ' + id + '。当前 ' + String(result.rules.length) + ' / ' + String(MAX_USER_RULES) + '。');
      }

      if (action === 'export') {
        const yaml = exportUserRulesYaml(rules);
        return ok('规则表 YAML（可存进仓库）：\n' + yaml);
      }

      if (action === 'import') {
        const path = parts[1];
        if (path === undefined) return fail('用法：/ops-rule import <工作区内的 yaml 路径>');
        return importRulesFromFile(session, path);
      }

      return fail('未知子命令：' + action + '（可用：list / add / remove / export / import）');
    },
  }));

  // ── /ops-adjudicate ─────────────────────────────────────────
  disposers.push(ctx.commands.register({
    name: ADJUDICATE_COMMAND_NAME,
    description: '裁决一张升级工单：/ops-adjudicate <工单 id> <approve|reject>。',
    input: { hint: '<工单 id> <approve|reject>' },
    recordInput: true,
    handler(invocation) {
      const session = invocation.agent.session;
      const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput.trim() : '';
      const parts = raw.split(/\s+/u).filter((item) => item.length > 0);
      const id = parts[0];
      const decision = parts[1] === 'approve' ? 'approved' : parts[1] === 'reject' ? 'rejected' : undefined;
      if (id === undefined || decision === undefined) {
        return fail('用法：/ops-adjudicate <工单 id> <approve|reject>');
      }
      const tickets = currentEscalations(botsHandle, session);
      const ticket = tickets.find((item) => item.id === id);
      if (ticket === undefined) return fail('找不到工单 ' + id + '。');
      const result = adjudicateEscalation(ticket, decision, deps.escalationPolicy, (next) => {
        writeEscalation(session, next);
      });
      if (!result.ok) return fail(result.reason);
      return ok('工单 ' + id + ' 已裁决为 ' + decision + '（已写进会话日志，主 Bot 会看到）。');
    },
  }));

  // ── /ops-ignore ─────────────────────────────────────────────
  disposers.push(ctx.commands.register({
    name: IGNORE_COMMAND_NAME,
    description: '忽略一类主动建议：/ops-ignore <goal|todo|workspace|team-task|deliverable>。',
    input: { hint: '<类别>' },
    recordInput: true,
    handler(invocation) {
      const session = invocation.agent.session;
      const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput.trim() : '';
      const kind = raw.split(/\s+/u)[0] ?? '';
      const result = writeTriggerIgnore(session, kind);
      if (typeof result !== 'number') return fail('忽略记录写入失败。');
      return ok('已忽略 ' + kind + ' 类建议（连续两次后该类自动降级 30 天）。');
    },
  }));

  // ── /ops-teach ──────────────────────────────────────────────
  disposers.push(ctx.commands.register({
    name: TEACH_COMMAND_NAME,
    description: '把本会话的执行轨迹变成例程草稿：/ops-teach <技能名> [save]。',
    input: { hint: '<技能名> [save]' },
    recordInput: true,
    handler(invocation) {
      const session = invocation.agent.session;
      const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput.trim() : '';
      const parts = raw.split(/\s+/u).filter((item) => item.length > 0);
      const name = parts[0];
      const shouldSave = parts.includes('save');
      if (name === undefined) return fail('用法：/ops-teach <技能名> [save]');
      return buildTeachingDraft(ctx, session, name, shouldSave);
    },
  }));

  return disposers;
}

/** 从工作区里的 YAML 文件导入规则表。 */
async function importRulesFromFile(session, path) {
  try {
    const text = await readFile(path, 'utf8');
    const result = importUserRulesYaml(session, text);
    if (!result.ok) return fail('导入失败：' + result.reason);
    return ok('已导入 ' + String(result.rules.length) + ' 条规则。');
  } catch (error) {
    return fail('读取失败：' + String(error && error.message ? error.message : error));
  }
}

/**
 * 生成例程草稿；带 save 时落盘。
 *
 * 落盘路径：<cwd>/.dsh/skills/<name>/SKILL.md（项目级技能，优先级最高）。
 * 未确认前不写盘——所以「生成」与「保存」是两条命令。
 */
async function buildTeachingDraft(ctx, session, name, shouldSave) {
  const query = ctx.get('sessionQuery');
  if (query === undefined || typeof query.readSession !== 'function') {
    return fail('当前宿主没有会话查询能力，做不了示范学习。');
  }
  let snapshot;
  try {
    snapshot = await query.readSession(session.id);
  } catch (error) {
    return fail('读取会话日志失败：' + String(error && error.message ? error.message : error));
  }
  const events = snapshot !== null && typeof snapshot === 'object' ? snapshot.events : [];
  const { steps, approvals, failures } = extractSteps(events);
  if (steps.length === 0) {
    return fail('这段会话里没有工具调用，没有可回放的轨迹。');
  }
  let draft;
  try {
    draft = buildSkillDraft({ name, steps, approvals, failures, sessionId: String(session.id) });
  } catch (error) {
    return fail(String(error && error.message ? error.message : error));
  }
  if (!shouldSave) {
    return ok('例程草稿（' + String(steps.length) + ' 步，确认后用 /ops-teach ' + name + ' save 落盘）：\n\n' + draft.content);
  }
  const cwd = snapshot.session !== null && typeof snapshot.session === 'object' ? snapshot.session.cwd : undefined;
  try {
    const directory = skillDirectoryFor(cwd, name);
    await mkdir(directory, { recursive: true });
    await writeFile(directory + '/SKILL.md', draft.content, 'utf8');
  } catch (error) {
    return fail('落盘失败：' + String(error && error.message ? error.message : error));
  }
  return ok('已写入 ' + skillDirectoryFor(cwd, name) + '/SKILL.md（' + String(steps.length) + ' 步）。');
}
