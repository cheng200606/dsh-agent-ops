/**
 * lib/index.js — @local/dsh-agent-ops 的 Host 半
 *
 * 十个单元，全部挂在宿主已有 seam 上，不新建任何存储、不注册任何模型可见内容：
 *
 *   v1.0（审计与围栏）
 *   1. ops.audit 投影   —— 折叠宿主的 approval/*、tool/*、sandbox/mode、permission/preset 事件，
 *                          产出一份只读审计时间线，由宿主的投影通道自动 wire 给客户端。
 *   2. 审批旁听         —— 在 approval/request waterfall 上记一笔再 next() 透传（红线：绝不抢作答权）。
 *   3. 围栏提问         —— tools/pre-execute 对高危动作返回 { kind: 'ask' }，让人拍板。
 *   4. 围栏硬拦         —— tools.guard 对不可逆动作返回拒绝；guard 没有 allow 分支，
 *                          所以「后面的监听器把拒绝翻回许可」在类型上不可能发生。
 *
 *   v1.1（团队与群聊）
 *   5. ops.chat / ops.bots 投影 —— 折叠插件记录的群聊消息、角色声明与升级工单。
 *   6. 群聊命令         —— /ops-say 与 /ops-bot：客户端唯一的「UI → Host」写入通道。
 *   7. 升级工单         —— 子代理命中的高危调用转成工单交给主 Bot，并当场拒绝原调用。
 *
 *   v1.1 收尾（A3 / G5~G8）
 *   8. ops.rules 投影   —— 用户规则表（会话级插件记录），A3 的「20 条上限 / Ask 优先 /
 *                          高危不可 Allow / 命中计数」。
 *   9. ops.triggers 投影 —— 主动感知的候选清单（G7）与 L0/L1/L2 分级（G8）。
 *  10. L2 唤醒          —— 唯一会花钱的一级：受每日预算约束的 followup()。
 *
 * 为什么 3 和 4 分开：pre-execute 的 ask 会经过 ServiceAsk → approval.request，
 * 在 approval 策略为 never 的会话里（子代理恒为 never）会变成拒绝；
 * 但真正不可逆的那一档（格式化磁盘、drop database、强推、提权）连问都不该问，
 * 必须由 guard 在最后一米拦死。
 *
 * 为什么 7 是「拒绝 + 重执行」：审批必须在未结束的轮次内发生（宿主 approval.request 的硬校验），
 * 子代理的工具调用属于另一个 Agent 的另一个轮次，挂起等待只会留下永不结算的 Promise。
 */

import { auditProjectionDefinition } from './audit-projection.js';
import { createApprovalIndex } from './approval-index.js';
import { normalizePolicy } from './rules/policy.js';
import { makeGuard, makePreExecute } from './rules/guard.js';
import { rulesAsJson } from './rules/classify.js';
import {
  makeEscalationUnit,
  registerChatCommands,
  registerTeamProjections,
} from './team-units.js';
import { configProjectionDefinition, setConstants } from './config-projection.js';
import { setPolicyView } from './constants.js';
import { normalizeEscalationPolicy } from './escalation.js';
import { registerOpsCommands } from './ops-commands.js';
import { makeChatRouter } from './chat-router.js';
import { makeConnectorUnit } from './connectors.js';
import { FORM_SKILL, opsFormSkillContent, registerFormCard } from './form-card.js';
import { registerRoleSkills } from './roles.js';
import { setTriggerPolicyView, triggerPolicySnapshot, triggersProjectionDefinition } from './triggers.js';
import { makeWakeUnit } from './wake-unit.js';

export const name = 'agent-ops';

/**
 * 注入三个服务：
 *   sessionProjections —— 注册四个投影（ops.audit / ops.chat / ops.bots / ops.rules / ops.triggers）
 *   tools              —— 注册 guard
 *   commands           —— 注册 /ops-say、/ops-bot、/ops-rule、/ops-adjudicate、/ops-ignore、/ops-teach
 * approval、sandboxPolicy、subagents、agents、sessionQuery 通过 ctx.get() 可选读取而不是硬注入：
 * 审批结论与沙箱模式从会话事件折叠即可；subagents 缺席时升级工单降级为「只登记不唤醒」，
 * 不该因为它不在就让整个插件激活失败。
 */
export const inject = ['sessionProjections', 'tools', 'commands'];

export async function apply(ctx, config = {}) {
  const policy = normalizePolicy(config);
  const escalationPolicy = normalizeEscalationPolicy(config);
  const triggerPolicy = normalizeTriggerPolicy(config);
  const index = createApprovalIndex({ limit: 200 });

  // ── 单元 1：审计投影 ────────────────────────────────────────────
  // 客户端 bundle 是零构建的、拿不到规则表源码，所以规则表必须走投影通道下发。
  // 但**不能**挂在审计投影上：它声明了 summary:false，挂在那儿的话，
  // 一个还没有任何事件的新会话里客户端读不到规则表（实测踩过）。
  // 所以规则表 / 策略 / 连接器走单独的 ops.config 投影（默认成员资格）。
  setTriggerPolicyView(triggerPolicy);
  setConstants({
    rules: rulesAsJson(),
    policy: setPolicyView(policy),
    triggers: triggerPolicySnapshot(),
  });

  // 返回值是一个 thenable + disposer 双用对象；await 拿到 handle，
  // 注册归本插件 fiber 所有，插件卸载时自动释放。
  await ctx.sessionProjections.register(auditProjectionDefinition);

  // ── 单元 8：配置面投影（规则表 / 策略 / 连接器 / 用户规则）──────
  const configHandle = await ctx.sessionProjections.register(configProjectionDefinition);

  // ── 单元 9：主动感知投影（G7 / G8）─────────────────────────────
  await ctx.sessionProjections.register(triggersProjectionDefinition);

  // ── 单元 5：群聊与名册投影（v1.1）────────────────────────────────
  const botsHandle = await registerTeamProjections(ctx);

  // 会话 → 用户规则表。规则表是会话级的（存在会话日志的插件记录里），
  // 所以判定时必须按 execution.agent 找到它所属的会话。
  const rulesOf = (session) => {
    try {
      const state = configHandle.stateOf(session);
      return Array.isArray(state.userRules) ? state.userRules : [];
    } catch {
      return [];
    }
  };

  // ── 单元 2：审批旁听（只观察，不改写）─────────────────────────────
  ctx.on('approval/request', async (request, next) => {
    const ticket = index.begin(request);
    let outcome;
    try {
      outcome = await next();
    } catch (error) {
      index.settle(ticket, 'unavailable', error);
      throw error;
    }
    index.settle(ticket, outcome);
    // 红线：原样返回下游的结论。我们只记录，不表态。
    return outcome;
  });

  // ── 单元 6 + 11：群聊命令与规则/工单/建议/示范命令 ───────────────
  // disposer 交给 cordis 管理：ctx.effect 在本插件 fiber 上登记，卸载时自动摘除命令。
  ctx.effect(() => {
    const disposers = registerChatCommands(ctx);
    return () => { for (const dispose of disposers) dispose(); };
  }, 'agent-ops: chat commands');

  ctx.effect(() => {
    const disposers = registerOpsCommands(ctx, {
      configHandle,
      botsHandle,
      escalationPolicy,
    });
    return () => { for (const dispose of disposers) dispose(); };
  }, 'agent-ops: ops commands');

  // ── 单元 3 + 7：围栏提问 与 升级工单（v1.1）──────────────────────
  const escalateToPrimary = makeEscalationUnit(ctx, policy);
  const askOrAllow = makePreExecute(policy, rulesOf);
  ctx.on('tools/pre-execute', async (execution, next) => {
    const downstream = await next();
    // 单调：下游已经否掉或已经要问了，就别再叠加一层。
    if (downstream.kind !== 'allow') return downstream;
    // 没有 agent 的调用没有审批通道可走，问了也只会变成 unavailable 拒绝。
    if (execution.agent === undefined) return downstream;
    // 子代理没有审批权，先看要不要转成工单交给主 Bot；根代理自己被跳过。
    const escalated = await escalateToPrimary(execution);
    if (escalated !== undefined) return escalated;
    return askOrAllow(execution) ?? downstream;
  });

  // ── 单元 4：围栏硬拦 ───────────────────────────────────────────
  // 返回 disposer，cordis 在本插件 fiber 上登记；卸载时自动摘除。
  ctx.tools.guard(makeGuard(policy, rulesOf));

  // ── 单元 10：L2 唤醒（G8）──────────────────────────────────────
  // 只在策略打开 wakeEnabled 时才会真的唤醒（默认关）。
  ctx.effect(() => {
    const unit = makeWakeUnit(ctx);
    return () => unit.dispose();
  }, 'agent-ops: wake unit');

  // ── 单元 5b：群聊三路信号转写（G1）──────────────────────────────
  // subagent/start、subagent/end 与 send_message 的收件箱插入都不是根会话的事件，
  // 由 Host 侧转写成根会话的群聊记录，群聊页才能看到整支团队的协作流。
  ctx.effect(() => {
    const router = makeChatRouter(ctx);
    return () => router.dispose();
  }, 'agent-ops: chat router');

  // ── E1：ops.form 表单卡片 ──────────────────────────────────────
  // 新 action card 种类 + 一份 ops-form 技能。宿主缺席 actionCards 时静默跳过。
  registerFormCard(ctx);
  ctx.effect(() => {
    const skills = ctx.get('skills');
    if (skills === undefined || typeof skills.register !== 'function') return () => {};
    const disposer = skills.register({
      name: FORM_SKILL,
      description: '当需要一个结构化的少量输入（几个字段、几个选项）而不是一轮问答时，发一张表单卡片。',
      content: opsFormSkillContent(),
      source: 'bundled',
      provider: 'agent-ops',
      invocation: { modelInvocable: true, userInvocable: true },
    });
    return disposer;
  }, 'agent-ops: ops-form skill');

  // ── B3：连接器可见性（只读）────────────────────────────────────
  ctx.effect(() => {
    const unit = makeConnectorUnit(ctx);
    return () => unit.dispose();
  }, 'agent-ops: connectors');

  // ── G3：八份岗位手册注册进技能表 ──────────────────────────────
  // 角色的本体是 preset（cordis.patch.yml 里的八条声明），手册只是补充；
  // 注册失败不阻断插件激活。
  ctx.effect(() => {
    let disposed = false;
    const disposers = [];
    registerRoleSkills(ctx).then((registered) => {
      if (disposed) return;
      ctx.logger?.debug?.('[agent-ops] 岗位手册已注册：' + String(registered.length) + ' 份');
    }).catch((error) => {
      ctx.logger?.warn?.('[agent-ops] 岗位手册注册失败：' + String(error));
    });
    return () => { disposed = true; for (const dispose of disposers) dispose(); };
  }, 'agent-ops: role skills');

  ctx.logger?.debug?.(
    '[agent-ops] fence ' + (policy.enabled ? policy.mode : 'disabled')
    + ' (ask>=' + String(policy.askRisk) + ', deny>=' + String(policy.denyRisk) + ')'
    + ', rules=' + String(policy.userRules.length)
    + ', adjudicate=' + String(escalationPolicy.adjudicate)
    + ', wake=' + String(triggerPolicy.wakeEnabled),
  );

  // 不返回值：cordis 把 apply() 的返回值当作生命周期 effect，只有
  // function（disposer）与 null/undefined 合法，返回对象会抛
  // TypeError: Invalid effect 并让整个插件条目激活失败。
}

/**
 * 归一化主动感知的策略（G7 / G8）。
 */
function normalizeTriggerPolicy(config) {
  const raw = config !== null && typeof config === 'object' ? (config.triggers ?? config) : {};
  return {
    notifyUrgency: typeof raw.notifyUrgency === 'string' ? raw.notifyUrgency : 'normal',
    wakeEnabled: raw.wakeEnabled === true,
    dailyWakeBudget: Number.isSafeInteger(raw.dailyWakeBudget) && raw.dailyWakeBudget >= 0 ? raw.dailyWakeBudget : 3,
    repeatWindowHours: Number.isSafeInteger(raw.repeatWindowHours) && raw.repeatWindowHours > 0 ? raw.repeatWindowHours : 24,
    ignoreThreshold: Number.isSafeInteger(raw.ignoreThreshold) && raw.ignoreThreshold > 0 ? raw.ignoreThreshold : 2,
    downgradeDays: Number.isSafeInteger(raw.downgradeDays) && raw.downgradeDays > 0 ? raw.downgradeDays : 30,
  };
}
