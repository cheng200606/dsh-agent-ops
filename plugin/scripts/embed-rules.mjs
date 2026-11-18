/**
 * scripts/embed-rules.mjs — 把内置规则表生成进 client.js
 *
 * 为什么需要这一步（一个实测出来的坑）：
 *   客户端拿插件数据只有两条路——会话投影与命令通道。**两条都要求会话是「活着」的**
 *   （被客户端订阅，或者已经跑过一轮）。一个刚创建、还没跑过一轮的新会话里，
 *   客户端拿不到任何投影值，于是规则表页显示「共 0 条」——这是错的：
 *   规则表是插件级的静态表，跟会话有没有活动无关。
 *
 *   所以规则表**内嵌进客户端 bundle**：唯一真源仍然是 lib/rules/classify.js，
 *   这段代码在打包前（npm pack 会先跑 prepack）从 classify.js 生成，
 *   写进 client.js 的标记块里。改规则表只要改 classify.js，然后重新打包。
 *
 * 用法：node scripts/embed-rules.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, '..');

const { RULES, sortedRules } = await import('../lib/rules/classify.js');
const { rulesAsJson } = await import('../lib/rules/classify.js');

const BEGIN = '    /* AUTO-GENERATED:RULES_BEGIN */';
const END = '    /* AUTO-GENERATED:RULES_END */';

const rows = rulesAsJson(sortedRules(RULES));
const payload = rows.map((rule) => ({
  id: rule.id,
  category: rule.category,
  risk: rule.risk,
  scope: rule.scope,
  pattern: rule.pattern,
  flags: rule.flags,
  note: rule.note,
}));

const body = [
  BEGIN,
  '    // 本块由 scripts/embed-rules.mjs 从 lib/rules/classify.js 生成，请勿手改。',
  '    // 唯一真源是 classify.js：改规则改那里，然后重新打包（npm pack 会自动重生成）。',
  '    const RULES_TABLE = ' + JSON.stringify(payload, null, 2).split('\n').join('\n    ') + ';',
  END,
].join('\n');

const clientPath = join(pluginRoot, 'client.js');
const source = await readFile(clientPath, 'utf8');
const start = source.indexOf(BEGIN);
const end = source.indexOf(END);
if (start < 0 || end < 0) {
  console.error('embed-rules: client.js 里找不到标记块，未改动。');
  process.exit(1);
}
const next = source.slice(0, start) + body + source.slice(end + END.length);
await writeFile(clientPath, next, 'utf8');
console.log('embed-rules: 已写入 ' + String(payload.length) + ' 条规则。');
