import test from 'node:test';
import assert from 'node:assert/strict';

import { Session } from '@deepseek-ai/dsh-session';

import { ROLES, findRole, roleIds } from '../lib/roles.js';
import { makeChatRouter } from '../lib/chat-router.js';
import { CHAT_RECORD_TYPE } from '../lib/team-projection.js';

test('G3 八类角色齐备，id 与 preset 声明一致', () => {
  assert.equal(ROLES.length, 8);
  assert.deepEqual(roleIds(), [
    'bot-sales', 'bot-recruiter', 'bot-ops', 'bot-engineer',
    'bot-support', 'bot-researcher', 'bot-finance', 'bot-content',
  ]);
  for (const role of ROLES) {
    assert.equal(typeof role.name, 'string');
    assert.equal(typeof role.description, 'string');
    assert.equal(role.skill, role.id + '-handbook');
  }
});

test('G3 角色可按 id 查找，未知 id 返回 undefined', () => {
  assert.equal(findRole('bot-finance').name, '财务报销');
  assert.equal(findRole('nope'), undefined);
  assert.equal(findRole(undefined), undefined);
});

test('G3 每个角色的岗位手册文件都在包内', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const role of ROLES) {
    const url = new URL('../skills/' + role.id + '/SKILL.md', import.meta.url);
    const content = await readFile(url, 'utf8');
    assert.match(content, /^---\n/);
    assert.match(content, new RegExp('name: ' + role.skill + '\n'));
    assert.match(content, new RegExp('description: .+\n'));
  }
});

/** 造一个假上下文：agents / subagents 可查，事件监听可收。 */
function fakeCtx(agents) {
  const handlers = new Map();
  return {
    handlers,
    warned: [],
    logger: { warn: (message) => { this.warned.push(message); } },
    get(name) {
      if (name === 'agents') return { get: (id) => agents[id] };
      if (name === 'subagents') {
        return {
          rootOf: (agent) => agent.root,
          namesOf: (agent) => ({ self: agent.name, parent: agent.parent }),
        };
      }
      return undefined;
    },
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return () => {
        const current = handlers.get(event) ?? [];
        handlers.set(event, current.filter((item) => item !== handler));
      };
    },
    emit(event, ...args) {
      for (const handler of handlers.get(event) ?? []) handler(...args);
    },
  };
}

test('G1 subagent/start 与 subagent/end 进群聊流', () => {
  const rootSession = Session.create('s-chat-root');
  const root = { name: 'lead', session: rootSession };
  const child = { name: 'researcher', session: Session.create('s-chat-child'), root };
  const ctx = fakeCtx({ 's-chat-root': root, 's-chat-child': child });
  const router = makeChatRouter(ctx);

  ctx.emit('subagent/start', { id: 's-chat-child', parentSessionId: 's-chat-root', provider: 'dsh-sdk' });
  ctx.emit('subagent/end', { id: 's-chat-child', parentSessionId: 's-chat-root', stopReason: 'completed' });

  const records = rootSession.ownEvents();
  assert.equal(records.length, 2);
  assert.equal(records[0].type, CHAT_RECORD_TYPE);
  assert.equal(records[0].data.kind, 'system');
  assert.equal(records[0].data.from, 'researcher');
  assert.match(records[0].data.text, /开始工作/);
  assert.equal(records[1].data.kind, 'system');
  assert.match(records[1].data.text, /结束/);
  router.dispose();
});

test('G1 send_message 的收件箱插入转写成群聊里的「派活」', () => {
  const rootSession = Session.create('s-chat-root-2');
  const root = { name: 'lead', session: rootSession };
  const child = { name: 'researcher', session: Session.create('s-chat-child-2'), parent: 'lead', root };
  const ctx = fakeCtx({ 's-chat-root-2': root, 's-chat-child-2': child });
  const router = makeChatRouter(ctx);

  ctx.emit('session/event', child.session, {
    type: 'agent/inbox/spliced',
    seq: 1,
    time: 1,
    data: {
      target: 'next-turn',
      start: 0,
      inserted: [{ role: 'user', content: [{ type: 'text', text: '查一下竞品定价' }] }],
    },
  });

  const records = rootSession.ownEvents();
  assert.equal(records.length, 1);
  assert.equal(records[0].data.kind, 'handoff');
  assert.equal(records[0].data.from, 'lead');
  assert.equal(records[0].data.to, 'researcher');
  assert.equal(records[0].data.text, '查一下竞品定价');
  router.dispose();
});

test('G1 根会话自己的收件箱插入不重复转写', () => {
  const rootSession = Session.create('s-chat-root-3');
  const root = { name: 'lead', session: rootSession, root: undefined };
  root.root = root;
  const ctx = fakeCtx({ 's-chat-root-3': root });
  const router = makeChatRouter(ctx);

  ctx.emit('session/event', rootSession, {
    type: 'agent/inbox/spliced',
    seq: 1,
    time: 1,
    data: { target: 'next-turn', start: 0, inserted: [{ role: 'user', content: [{ type: 'text', text: '你好' }] }] },
  });

  assert.equal(rootSession.ownEvents().length, 0);
  router.dispose();
});

test('G1 群聊记录都带 ignorable（旧版本读到会跳过）', () => {
  const rootSession = Session.create('s-chat-root-4');
  const root = { name: 'lead', session: rootSession };
  const child = { name: 'worker', session: Session.create('s-chat-child-4'), root };
  const ctx = fakeCtx({ 's-chat-root-4': root, 's-chat-child-4': child });
  const router = makeChatRouter(ctx);
  ctx.emit('subagent/start', { id: 's-chat-child-4', parentSessionId: 's-chat-root-4', provider: 'x' });
  for (const record of rootSession.ownEvents()) {
    assert.equal(record.ignorable, true);
  }
  router.dispose();
});
