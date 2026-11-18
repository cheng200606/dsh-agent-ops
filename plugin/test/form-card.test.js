import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELD_TYPES,
  FORM_ACTION,
  FORM_SKILL,
  MAX_FORM_FIELDS,
  formCardKind,
  formDetailsSchema,
  opsFormSkillContent,
  registerFormCard,
  validateFormDetails,
} from '../lib/form-card.js';
import { connectorRow } from '../lib/connectors.js';

const validDetails = {
  summary: '收三个字段',
  submitLabel: '保存',
  fields: [
    { name: 'target', label: '目标文件', type: 'text', required: true },
    { name: 'mode', label: '处理方式', type: 'select', options: ['仅草稿', '直接应用'], required: true },
    { name: 'note', label: '备注', type: 'text', required: false },
  ],
};

test('E1 表单详情的校验通过：三字段的表单是合法的', () => {
  const result = validateFormDetails(validDetails);
  assert.equal(result.ok, true);
  assert.equal(result.value.fields.length, 3);
  assert.equal(result.value.fields[1].options.length, 2);
});

test('E1 表单详情必须是对象、必须有字段、字段数有上限', () => {
  assert.equal(validateFormDetails(null).ok, false);
  assert.equal(validateFormDetails({}).ok, false);
  assert.equal(validateFormDetails({ fields: [] }).ok, false);
  const many = { fields: [] };
  for (let i = 0; i < MAX_FORM_FIELDS + 1; i += 1) {
    many.fields.push({ name: 'f' + i, label: 'F' + i, type: 'text' });
  }
  const result = validateFormDetails(many);
  assert.equal(result.ok, false);
  assert.match(result.issue, /字段最多/);
});

test('E1 字段名与类型受约束', () => {
  assert.equal(validateFormDetails({ fields: [{ name: 'Bad Name', label: 'x', type: 'text' }] }).ok, false);
  assert.equal(validateFormDetails({ fields: [{ name: 'a', label: 'x', type: 'number' }] }).ok, false);
  assert.equal(validateFormDetails({ fields: [{ name: 'a', label: '', type: 'text' }] }).ok, false);
  assert.equal(validateFormDetails({ fields: [{ name: 'a', label: 'x', type: 'select' }] }).ok, false);
  assert.equal(validateFormDetails({ fields: [{ name: 'a', label: 'x', type: 'select', options: ['only'] }] }).ok, false);
  assert.deepEqual(FIELD_TYPES, ['text', 'select']);
});

test('E1 字段名重复被拒', () => {
  const result = validateFormDetails({
    fields: [
      { name: 'a', label: 'A', type: 'text' },
      { name: 'a', label: 'A2', type: 'text' },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.issue, /重复/);
});

test('E1 手写 schema 提供 safeParse（宿主只要求这个）', () => {
  const ok = formDetailsSchema.safeParse(validDetails);
  assert.equal(ok.success, true);
  assert.equal(ok.data.fields.length, 3);
  const bad = formDetailsSchema.safeParse({ fields: [] });
  assert.equal(bad.success, false);
  assert.throws(() => formDetailsSchema.parse({ fields: [] }));
});

test('E1 卡片种类声明了动作、技能与校验入口', () => {
  const kind = formCardKind({});
  assert.equal(kind.action, FORM_ACTION);
  assert.equal(kind.skill, FORM_SKILL);
  assert.equal(typeof kind.invitation, 'string');
  assert.equal(typeof kind.act, 'function');
  assert.deepEqual(Object.keys(kind.verbs), ['submit']);
  assert.equal(kind.detailsIssues(validDetails), undefined);
  assert.match(kind.detailsIssues({ fields: [] }), /字段/);
});

test('E1 用户提交后 act() 记决策并把字段值带回去', async () => {
  const recorded = [];
  const ctx = { actionCards: { record: (agent, decision) => recorded.push(decision) }, logger: {} };
  const kind = formCardKind(ctx);
  const result = await kind.act(
    { id: 'agent-1' },
    { callId: 'call-1', details: validDetails },
    'submit',
    { target: 'a.txt', mode: '仅草稿' },
  );
  assert.equal(result.status, 'settled');
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].callId, 'call-1');
  assert.equal(recorded[0].action, FORM_ACTION);
  assert.equal(recorded[0].phase, 'submitted');
  assert.deepEqual(recorded[0].data.fields, { target: 'a.txt', mode: '仅草稿', note: null });
});

test('E1 未提交过的字段记为 null，而不是丢键', async () => {
  const recorded = [];
  const ctx = { actionCards: { record: (agent, decision) => recorded.push(decision) }, logger: {} };
  const kind = formCardKind(ctx);
  await kind.act({ id: 'a' }, { callId: 'c', details: validDetails }, 'submit', {});
  assert.deepEqual(Object.keys(recorded[0].data.fields).sort(), ['mode', 'note', 'target']);
  assert.equal(recorded[0].data.fields.note, null);
});

test('E1 未知动词被拒绝', async () => {
  const ctx = { actionCards: { record: () => {} }, logger: {} };
  const kind = formCardKind(ctx);
  const result = await kind.act({ id: 'a' }, { callId: 'c', details: validDetails }, 'explode', {});
  assert.equal(result.status, 'refused');
});

test('E1 决策记不进日志时返回 unconfirmed，不假装成功', async () => {
  const ctx = {
    actionCards: { record: () => { throw new Error('no log'); } },
    logger: { warn: () => {} },
  };
  const kind = formCardKind(ctx);
  const result = await kind.act({ id: 'a' }, { callId: 'c', details: validDetails }, 'submit', {});
  assert.equal(result.status, 'unconfirmed');
});

test('E1 宿主没有 actionCards 时注册静默失败，不抛异常', () => {
  assert.equal(registerFormCard({ get: () => undefined, logger: {} }), false);
});

test('E1 同名种类二次注册被宿主拒绝，插件只记日志不崩', () => {
  const attempts = [];
  const ctx = {
    get: () => ({
      register: (kind) => {
        attempts.push(kind.action);
        if (attempts.length > 1) throw new Error('action already registered');
      },
    }),
    logger: { warn: () => {} },
  };
  assert.equal(registerFormCard(ctx), true);
  assert.equal(registerFormCard(ctx), false);
  assert.deepEqual(attempts, ['ops_form', 'ops_form']);
});

test('E1 随包发布的 ops-form 技能正文可用', () => {
  const content = opsFormSkillContent();
  assert.match(content, /name: ops-form/);
  assert.match(content, /propose_action/);
});

test('B3 连接器状态被压成界面用的标签', () => {
  assert.deepEqual(connectorRow({ name: 'files', status: { state: 'connected' } }), { name: 'files', status: 'connected' });
  assert.deepEqual(connectorRow({ name: 'mail', status: { state: 'disabled' } }), { name: 'mail', status: 'disabled' });
  assert.deepEqual(connectorRow({ name: 'x', status: { state: 'failed', reason: 'load' } }), { name: 'x', status: 'failed' });
  assert.deepEqual(connectorRow({ name: 'y', status: { state: 'needs-auth' } }), { name: 'y', status: 'needs-auth' });
  assert.deepEqual(connectorRow(undefined), { name: 'unknown', status: 'unknown' });
});
