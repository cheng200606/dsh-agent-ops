/**
 * lib/form-card.js — ops.form 表单卡片（E1）
 *
 * 对标 Grok Bot 的 Secure Form：聊天内的结构化输入表单。
 *
 * 宿主给的动作卡片机制（dsh-action-cards）：
 *   register({ action, skill, invitation, details, detailsIssues, verbs, act })
 *   - action      这个种类的标识（同一种类不能注册两次，重复注册会抛错）
 *   - skill       模型在**当前轮次**必须加载过的 skill，否则 propose_action 被拒
 *   - details     校验 details 的 schema（宿主只要求它有 safeParse）
 *   - detailsIssues(details) → string | undefined：给出人能读的问题
 *   - verbs       用户能做的动作（'dismiss' 是宿主内建的）
 *   - act(agent, proposal, verb, payload) → ActionCardResult
 *
 * 关键：**act() 的返回值不会直接喂回模型**。宿主只在下一轮 pre-step 把
 * 「已记录的决策」注入模型上下文，所以本模块必须调用
 * `ctx.actionCards.record(agent, decision)`，否则模型永远看不到用户填了什么。
 *
 * 为什么 details 用手写 schema 而不是 zod：宿主只用到 `safeParse` 与我们自己
 * 提供的 `detailsIssues`，手写对象就够；引 zod 会和宿主内部版本打架（见
 * audit-projection.js 的注释）。
 */

import { readFileSync } from 'node:fs';

export const FORM_ACTION = 'ops_form';
export const FORM_SKILL = 'ops-form';

/** 技能正文的兜底版本（包内文件读不到时用，宁可短一点也不让插件挂掉）。 */
const FALLBACK_SKILL = `---
name: ${FORM_SKILL}
description: 需要少量结构化输入时，发一张表单卡片。
---

# ops-form

加载本 skill 后调 propose_action，action 填 ${FORM_ACTION}，details 给
{ summary, submitLabel, fields: [{ name, label, type: 'text' | 'select', required }] }。
`;

/**
 * 读出随包发布的 ops-form 技能正文。
 *
 * 用同步读：技能注册发生在插件激活时，那一刻就要拿到内容（effect 的回调必须
 * 同步返回 disposer）。
 */
export function opsFormSkillContent() {
  try {
    return readFileSync(new URL('../skills/ops-form/SKILL.md', import.meta.url), 'utf8');
  } catch {
    return FALLBACK_SKILL;
  }
}

/** 表单字段的类型词表。 */
export const FIELD_TYPES = ['text', 'select'];

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 字段名的语法。 */
const FIELD_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 字段数量上限（再多就不是「一张表」了）。 */
export const MAX_FORM_FIELDS = 8;

/**
 * 校验一份 details。
 * @returns {{ ok: true, value: object } | { ok: false, issue: string }}
 */
export function validateFormDetails(details) {
  if (!isPlainObject(details)) return { ok: false, issue: '表单内容必须是对象。' };
  const fields = details.fields;
  if (!Array.isArray(fields)) return { ok: false, issue: '表单必须有 fields 数组。' };
  if (fields.length === 0) return { ok: false, issue: '表单至少要有一个字段。' };
  if (fields.length > MAX_FORM_FIELDS) {
    return { ok: false, issue: '字段最多 ' + String(MAX_FORM_FIELDS) + ' 个。' };
  }
  const seen = new Set();
  for (const field of fields) {
    if (!isPlainObject(field)) return { ok: false, issue: '每个字段必须是对象。' };
    const name = typeof field.name === 'string' ? field.name : '';
    if (!FIELD_NAME_PATTERN.test(name)) {
      return { ok: false, issue: '字段名只能是小写字母、数字与连字符：' + name };
    }
    if (seen.has(name)) return { ok: false, issue: '字段名重复：' + name };
    seen.add(name);
    const type = typeof field.type === 'string' ? field.type : 'text';
    if (!FIELD_TYPES.includes(type)) {
      return { ok: false, issue: '字段类型只能是 text 或 select：' + name };
    }
    if (type === 'select') {
      const options = field.options;
      if (!Array.isArray(options) || options.length < 2) {
        return { ok: false, issue: '选择型字段至少要给两个选项：' + name };
      }
      for (const option of options) {
        if (typeof option !== 'string' || option.trim().length === 0) {
          return { ok: false, issue: '选项必须是非空字符串：' + name };
        }
      }
    }
    if (typeof field.label !== 'string' || field.label.trim().length === 0) {
      return { ok: false, issue: '字段要有 label：' + name };
    }
  }
  const summary = typeof details.summary === 'string' ? details.summary : '';
  const submitLabel = typeof details.submitLabel === 'string' ? details.submitLabel : '提交';
  return {
    ok: true,
    value: {
      summary,
      submitLabel,
      fields: fields.map((field) => ({
        name: field.name,
        label: field.label,
        type: field.type === 'select' ? 'select' : 'text',
        required: field.required === true,
        ...(field.type === 'select' ? { options: field.options.slice() } : {}),
      })),
    },
  };
}

/**
 * 手写 schema：宿主只用 safeParse（propose 时校验一次、用户动作前再校验一次）。
 */
export const formDetailsSchema = {
  parse(value) {
    const result = validateFormDetails(value);
    if (!result.ok) throw new Error(result.issue);
    return result.value;
  },
  safeParse(value) {
    const result = validateFormDetails(value);
    return result.ok ? { success: true, data: result.value } : { success: false, error: result.issue };
  },
};

/**
 * 生成这个 action card 种类。
 *
 * @param {object} ctx 插件上下文。
 * @returns {object} 可以直接交给 ctx.actionCards.register 的种类定义。
 */
export function formCardKind(ctx) {
  return {
    action: FORM_ACTION,
    skill: FORM_SKILL,
    invitation: '用中文或用户的语言写一句话，说明这张表要收什么，请用户填写。',
    details: formDetailsSchema,
    detailsIssues: (details) => {
      const result = validateFormDetails(details);
      return result.ok ? undefined : result.issue;
    },
    verbs: {
      submit: { writes: false },
    },
    /**
     * 用户提交表单。
     *
     * 这里**只收集数据**：把字段值记进决策，由模型决定下一步做什么。
     * 表单不是权限通道——它不写文件、不发消息、不触发任何动作。
     */
    async act(agent, proposal, verb, payload) {
      if (verb !== 'submit') {
        return { status: 'refused', reason: '未知的操作：' + verb };
      }
      const values = isPlainObject(payload) ? payload : {};
      const fields = isPlainObject(proposal.details) && Array.isArray(proposal.details.fields)
        ? proposal.details.fields
        : [];
      const data = {};
      for (const field of fields) {
        const name = typeof field.name === 'string' ? field.name : '';
        if (name.length === 0) continue;
        const value = values[name];
        data[name] = value === undefined ? null : value;
      }
      const decision = {
        callId: proposal.callId,
        action: FORM_ACTION,
        phase: 'submitted',
        data: { fields: data },
      };
      try {
        ctx.actionCards.record(agent, decision);
      } catch (error) {
        ctx.logger?.warn?.('[agent-ops] 表单决策记录失败：' + String(error));
        return { status: 'unconfirmed', reason: '决策未能记入会话日志：' + String(error) };
      }
      return { status: 'settled', decision };
    },
  };
}

/**
 * 注册表单卡片种类。
 *
 * 注册失败（例如宿主已经有同名种类）只记日志，不让整个插件激活失败。
 *
 * @returns {boolean} 是否注册成功。
 */
export function registerFormCard(ctx) {
  const cards = ctx.get('actionCards');
  if (cards === undefined || typeof cards.register !== 'function') return false;
  try {
    cards.register(formCardKind(ctx));
    return true;
  } catch (error) {
    ctx.logger?.warn?.('[agent-ops] 表单卡片种类注册失败：' + String(error));
    return false;
  }
}
