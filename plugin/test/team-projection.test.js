import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAT_RECORD_TYPE,
  BOT_RECORD_TYPE,
  ESCALATION_RECORD_TYPE,
  CHAT_PROJECTION_KEY,
  BOTS_PROJECTION_KEY,
  chatProjectionDefinition,
  botsProjectionDefinition,
} from '../lib/team-projection.js';

let seq = 0;
function rec(type, data) {
  seq += 1;
  return { type, seq, time: 1700000000000 + seq * 1000, data };
}

function say(from, text, to) {
  const data = { version: 1, from, text };
  if (to !== undefined) data.to = to;
  return rec(CHAT_RECORD_TYPE, data);
}

function chatFold(events, inherited) {
  let state = chatProjectionDefinition.init({}, inherited === undefined ? 0 : inherited);
  for (const event of events) state = chatProjectionDefinition.apply(state, event);
  return state;
}

function botsFold(events, inherited) {
  let state = botsProjectionDefinition.init({}, inherited === undefined ? 0 : inherited);
  for (const event of events) state = botsProjectionDefinition.apply(state, event);
  return state;
}

test('G1 投影元数据：两个 key 与 stateVersion 固定，wire 不进会话摘要', () => {
  assert.equal(CHAT_PROJECTION_KEY, 'ops.chat');
  assert.equal(BOTS_PROJECTION_KEY, 'ops.bots');
  assert.equal(chatProjectionDefinition.key, 'ops.chat');
  assert.equal(botsProjectionDefinition.key, 'ops.bots');
  assert.equal(chatProjectionDefinition.stateVersion, 1);
  assert.equal(botsProjectionDefinition.stateVersion, 1);
  assert.equal(chatProjectionDefinition.wire.summary, false);
  assert.equal(botsProjectionDefinition.wire.summary, false);
});

test('G1 记录类型常量符合宿主 plugin 记录语法', () => {
  const syntax = /^plugin:[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/u;
  for (const type of [CHAT_RECORD_TYPE, BOT_RECORD_TYPE, ESCALATION_RECORD_TYPE]) {
    assert.equal(syntax.test(type), true, type);
  }
});

test('G1 群聊消息按时间入流并精确计数', () => {
  const state = chatFold([say('lead', '开会'), say('researcher', '收到'), say('lead', '开始')]);
  assert.equal(state.messages.length, 3);
  assert.deepEqual(state.counters, { messages: 3, system: 0, escalations: 0 });
  assert.deepEqual(state.messages.map((m) => m.text), ['开会', '收到', '开始']);
  assert.deepEqual(state.messages.map((m) => m.from), ['lead', 'researcher', 'lead']);
  assert.equal(state.messages[0].kind, 'message');
  assert.equal(state.messages[0].to, null);
});

test('G1 不关心的事件必须返回同一个 state 引用（宿主用 Object.is 判定）', () => {
  let state = chatFold([say('lead', '一')]);
  const before = state;
  for (const event of [
    rec('approval/asked', { id: 'x', toolName: 'pwsh' }),
    rec('tool/call', { turn: 1, step: 1, callId: 'c', name: 'pwsh', arguments: '{}' }),
    rec('user/message', {}),
    { type: CHAT_RECORD_TYPE, seq: 0, time: 0, data: {} },
  ]) {
    if (event.type === CHAT_RECORD_TYPE) continue;
    assert.equal(chatProjectionDefinition.apply(state, event), before);
  }
  assert.equal(state, before);
});

test('G1 fork 继承过滤：init 前的父会话记录不进本会话群聊', () => {
  const parent = [say('lead', '父会话说的')];
  // inheritedEventCount 是「继承来的事件条数」：父会话最后一条 seq=N-1 时计数为 N，
  // 因此 seq < N 的记录全部属于父会话，必须跳过。
  const inherited = parent[0].seq + 1;
  const state = chatFold([...parent, say('lead', '子会话说的')], inherited);
  assert.equal(state.inheritedEventCount, inherited);
  assert.deepEqual(state.messages.map((m) => m.text), ['子会话说的']);
  assert.equal(state.counters.messages, 1);
});

test('G1 畸形记录被安全降级而不是抛错', () => {
  const state = chatFold([
    rec(CHAT_RECORD_TYPE, {}),
    rec(CHAT_RECORD_TYPE, { from: '', text: 42 }),
    rec(CHAT_RECORD_TYPE, { from: 'lead', text: 'x', kind: 'weird' }),
  ]);
  assert.equal(state.messages.length, 3);
  assert.equal(state.messages[0].from, 'unknown');
  assert.equal(state.messages[0].text, '');
  assert.equal(state.messages[2].kind, 'message');
});

test('G1 超长文本被截断到 2048 字符', () => {
  const state = chatFold([say('lead', 'x'.repeat(5000))]);
  assert.equal(state.messages[0].text.length, 2049);
  assert.equal(state.messages[0].text.endsWith('…'), true);
});

test('G1 消息列表有上限，最旧的被裁掉', () => {
  const events = [];
  for (let i = 0; i < 520; i += 1) events.push(say('lead', 'm' + i));
  const state = chatFold(events);
  assert.equal(state.messages.length, 500);
  assert.equal(state.messages[0].text, 'm20');
  assert.equal(state.messages[499].text, 'm519');
  assert.equal(state.counters.messages, 520);
});

test('G1 wire.view 复用引用：同一 state 多次取 view 恒等', () => {
  const state = chatFold([say('lead', '一'), say('bot', '二')]);
  const first = chatProjectionDefinition.wire.view(state);
  const second = chatProjectionDefinition.wire.view(state);
  assert.equal(first, second);
  assert.equal(first.messages, state.messages);
  assert.equal(first.counters, state.counters);
  // 新 state 产生新 view；同一 state 的旧 view 不变
  const next = chatProjectionDefinition.apply(state, say('lead', '三'));
  assert.notEqual(chatProjectionDefinition.wire.view(next), first);
  assert.equal(chatProjectionDefinition.wire.view(state), first);
});

test('G1 两个 state 不串台（记忆化按引用分桶）', () => {
  const a = chatFold([say('lead', 'a')]);
  const b = chatFold([say('lead', 'b'), say('lead', 'b2')]);
  assert.notEqual(chatProjectionDefinition.wire.view(a), chatProjectionDefinition.wire.view(b));
  assert.equal(chatProjectionDefinition.wire.view(a).messages.length, 1);
  assert.equal(chatProjectionDefinition.wire.view(b).messages.length, 2);
});

// ── ops.bots ────────────────────────────────────────────────

function bot(name, role, main, title) {
  const data = { version: 1, name, role };
  if (main !== undefined) data.main = main;
  if (title !== undefined) data.title = title;
  return rec(BOT_RECORD_TYPE, data);
}

function ticket(id, extra) {
  return rec(ESCALATION_RECORD_TYPE, Object.assign({
    version: 1,
    id,
    toolName: 'pwsh',
    ruleId: 'rm-root',
    category: 'destructive',
    risk: 'critical',
    from: 'builder',
    status: 'pending',
    argsSummary: 'Remove-Item C:\\ -Recurse',
  }, extra));
}

test('G4 名册按名字去重，同名声明的后一条覆盖前一条', () => {
  const state = botsFold([bot('researcher', 'scout'), bot('researcher', 'scout-v2'), bot('builder', 'dev')]);
  assert.equal(state.bots.length, 2);
  assert.deepEqual(state.bots.map((b) => b.name), ['researcher', 'builder']);
  assert.equal(state.bots[0].role, 'scout-v2');
});

test('G4 主 Bot 全局唯一：声明新的主 Bot 会把旧的降级', () => {
  const state = botsFold([bot('lead', 'coordinator', true), bot('builder', 'dev', true)]);
  assert.deepEqual(state.bots.map((b) => [b.name, b.main]), [['lead', false], ['builder', true]]);
  assert.equal(botsProjectionDefinition.wire.view(state).mainName, 'builder');
});

test('G4 没有主 Bot 时 mainName 是空串（不是 undefined）', () => {
  const state = botsFold([bot('builder', 'dev')]);
  assert.equal(botsProjectionDefinition.wire.view(state).mainName, '');
});

test('G4 缺 name 的 bot 记录被忽略，不产生空行', () => {
  const state = botsFold([rec(BOT_RECORD_TYPE, { role: 'x' }), rec(BOT_RECORD_TYPE, {}), bot('builder', 'dev')]);
  assert.equal(state.bots.length, 1);
  assert.equal(state.bots[0].title, null);
});

test('G4 名册有上限，最旧的被裁掉', () => {
  const events = [];
  for (let i = 0; i < 80; i += 1) events.push(bot('bot' + i, 'r'));
  const state = botsFold(events);
  assert.equal(state.bots.length, 64);
  assert.equal(state.bots[0].name, 'bot16');
});

test('G5 升级工单入册：字段完整、状态默认为 pending', () => {
  const state = botsFold([ticket('esc-1')]);
  assert.equal(state.escalations.length, 1);
  const item = state.escalations[0];
  assert.equal(item.id, 'esc-1');
  assert.equal(item.toolName, 'pwsh');
  assert.equal(item.ruleId, 'rm-root');
  assert.equal(item.risk, 'critical');
  assert.equal(item.from, 'builder');
  assert.equal(item.status, 'pending');
  assert.equal(typeof item.seq, 'number');
  assert.equal(typeof item.time, 'number');
});

test('G5 同一工单 id 再写只更新状态，不新增一行', () => {
  const state = botsFold([ticket('esc-1'), ticket('esc-1', { status: 'approved' })]);
  assert.equal(state.escalations.length, 1);
  assert.equal(state.escalations[0].status, 'approved');
  assert.equal(state.escalations[0].seq, state.escalations[0].seq);
});

test('G5 状态回填遇到未知 id 时忽略而不是崩', () => {
  const state = botsFold([ticket('esc-1'), ticket('esc-404', { status: 'approved' })]);
  assert.equal(state.escalations.length, 2);
  assert.equal(state.escalations[1].id, 'esc-404');
});

test('G5 工单参数摘要被截断到 400 字符', () => {
  const state = botsFold([ticket('esc-1', { argsSummary: 'y'.repeat(2000) })]);
  assert.equal(state.escalations[0].argsSummary.length, 401);
  assert.equal(state.escalations[0].argsSummary.endsWith('…'), true);
});

test('G5 工单列表有上限', () => {
  const events = [];
  for (let i = 0; i < 220; i += 1) events.push(ticket('esc-' + i));
  const state = botsFold(events);
  assert.equal(state.escalations.length, 200);
  assert.equal(state.escalations[199].id, 'esc-219');
});

test('G4/G5 不关心的事件返回同一个 state 引用', () => {
  const state = botsFold([bot('lead', 'coordinator')]);
  const before = state;
  for (const event of [
    rec('approval/asked', { id: 'x', toolName: 'pwsh' }),
    rec('subagent/catalog', { childId: 'c', childCreatedAt: 1, version: 3, mode: 'continuable', label: 'x', name: 'n' }),
    rec(CHAT_RECORD_TYPE, { from: 'lead', text: 'hi' }),
  ]) {
    assert.equal(botsProjectionDefinition.apply(state, event), before);
  }
});

test('G4 fork 继承过滤：init 前的父会话名册不进本会话', () => {
  const parent = [bot('lead', 'coordinator', true)];
  const inherited = parent[0].seq + 1;
  const state = botsFold([...parent, bot('builder', 'dev')], inherited);
  assert.deepEqual(state.bots.map((b) => b.name), ['builder']);
  assert.equal(botsProjectionDefinition.wire.view(state).mainName, '');
});

test('G4/G5 wire.view 复用引用：同一 state 多次取 view 恒等', () => {
  const state = botsFold([bot('lead', 'coordinator', true), ticket('esc-1')]);
  const first = botsProjectionDefinition.wire.view(state);
  const second = botsProjectionDefinition.wire.view(state);
  assert.equal(first, second);
  assert.equal(first.bots, state.bots);
  assert.equal(first.escalations, state.escalations);
  const next = botsProjectionDefinition.apply(state, bot('builder', 'dev'));
  assert.notEqual(botsProjectionDefinition.wire.view(next), first);
  assert.equal(botsProjectionDefinition.wire.view(state), first);
});

test('G4/G5 view 能被自己的 viewSchema 解析（wire 往返）', () => {
  const state = botsFold([bot('lead', 'coordinator', true), bot('builder', 'dev'), ticket('esc-1')]);
  const view = botsProjectionDefinition.wire.view(state);
  assert.equal(botsProjectionDefinition.wire.viewSchema.parse(view), view);
  const chatState = chatFold([say('lead', 'hi')]);
  const chatView = chatProjectionDefinition.wire.view(chatState);
  assert.equal(chatProjectionDefinition.wire.viewSchema.parse(chatView), chatView);
});

test('G1/G4 stateSchema 能解析自己产出的 state（checkpoint 往返）', () => {
  const chatState = chatFold([say('lead', 'hi'), say('bot', 'yo', 'lead')]);
  assert.equal(chatProjectionDefinition.stateSchema.parse(chatState), chatState);
  const botsState = botsFold([bot('lead', 'coordinator', true), ticket('esc-1')]);
  assert.equal(botsProjectionDefinition.stateSchema.parse(botsState), botsState);
});
