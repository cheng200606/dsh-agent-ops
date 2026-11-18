/**
 * lib/roles.js — 八类开箱角色（G3）与它们的岗位手册
 *
 * 角色的**真正载体是 preset**（04 方案 C-6：独立角色必须走 preset，且 preset 只在
 * spawn 时可指定）。本插件在 cordis.patch.yml 里声明了八条 preset 声明，每条带一段
 * persona 与一份工具白名单——那才是「角色」的本体。
 *
 * 本模块做两件辅助的事：
 *   1. 给出角色的**目录**（id / 名称 / 岗位手册 skill 名），让命令与界面能列出
 *      「有哪些角色」，并且能校验用户填的角色名确实存在。
 *   2. 把随包发布的八份岗位手册注册进宿主的技能表（ctx.skills.register），
 *      这样角色 agent 能加载自己那份手册。
 *
 * 关于「岗位手册是全局注册而不是按 preset 隔离」：宿主没有「按 preset 限定技能」
 * 的机制（preset 只能改工具面与人设），所以八份手册是全局可见的运行时技能，
 * 由 persona 指名让对应角色加载自己那一份。这是一处已知偏差，记录在案。
 */

import { readFile } from 'node:fs/promises';

/** 八类角色。id 与 cordis.patch.yml 里的 preset id 一一对应。 */
export const ROLES = [
  { id: 'bot-sales', name: '销售拓客', description: '录 CRM、写跟进邮件、整理线索', skill: 'bot-sales-handbook' },
  { id: 'bot-recruiter', name: '人才招聘', description: '简历筛选、面试安排、候选人跟踪', skill: 'bot-recruiter-handbook' },
  { id: 'bot-ops', name: '运营支持', description: '报表整理、周报汇总、数据核对', skill: 'bot-ops-handbook' },
  { id: 'bot-engineer', name: '工程助理', description: '复现 bug、建 ticket、跑测试、读代码库', skill: 'bot-engineer-handbook' },
  { id: 'bot-support', name: '客服工单', description: '工单分流、话术草稿、退款请求初判', skill: 'bot-support-handbook' },
  { id: 'bot-researcher', name: '研究整理', description: '竞品调研、政策追踪、资料汇编', skill: 'bot-researcher-handbook' },
  { id: 'bot-finance', name: '财务报销', description: '票据整理、报销单核对、预算比对', skill: 'bot-finance-handbook' },
  { id: 'bot-content', name: '内容运营', description: '公众号 / 社媒草稿、图文排版', skill: 'bot-content-handbook' },
];

/** 按 id 找角色。 */
export function findRole(id) {
  if (typeof id !== 'string') return undefined;
  return ROLES.find((role) => role.id === id);
}

/** 角色 id 列表（给界面与命令用）。 */
export function roleIds() {
  return ROLES.map((role) => role.id);
}

/**
 * 注册八份岗位手册。
 *
 * 用 ctx.skills.register（运行时技能，最低优先级但一定可见）。技能注册失败不该让
 * 插件整体挂掉——手册只是锦上添花，角色的本体（preset + persona）不依赖它。
 *
 * @returns {Promise<string[]>} 实际注册成功的技能名。
 */
export async function registerRoleSkills(ctx) {
  const skills = ctx.get('skills');
  if (skills === undefined || typeof skills.register !== 'function') return [];
  const registered = [];
  for (const role of ROLES) {
    try {
      const url = new URL('../skills/' + role.id + '/SKILL.md', import.meta.url);
      const content = await readFile(url, 'utf8');
      const description = firstDescription(content) ?? role.description;
      skills.register({
        name: role.skill,
        description,
        content,
        source: 'bundled',
        provider: 'agent-ops',
        invocation: { modelInvocable: true, userInvocable: true },
      });
      registered.push(role.skill);
    } catch (error) {
      ctx.logger?.warn?.('[agent-ops] 岗位手册注册失败：' + role.id + ' → ' + String(error));
    }
  }
  return registered;
}

/** 从 SKILL.md 的 frontmatter 里取 description（避免与正文解析耦合）。 */
function firstDescription(content) {
  const match = /^description:\s*(.+)$/mu.exec(content);
  return match === null ? undefined : match[1].trim();
}
