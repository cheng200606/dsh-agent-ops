/**
 * lib/connectors.js — 连接器可见性（B3）
 *
 * 执行环境页要能回答「我现在连着什么」：名字 + 状态（connected / needs-auth /
 * disabled / failed）。这是**只读**的——连接与授权都有官方入口，插件再造一个
 * 按钮就会变成第二个权限入口。
 *
 * 数据源是宿主的 MCP 管理器（ctx.mcpManager）：
 *   list()                  → [{ name, configured, status }]
 *   'mcp-manager/status'    → (name, status) 每次状态变化都会发
 *
 * 状态形状：McpManagedServerStatus 是 McpConnectionStatus 的并集，外加
 * { state: 'disabled' } 与两种 failed。我们把状态压成一个字符串标签给界面用，
 * 细节留在宿主的设置页。
 */

import { setConnectorList } from './config-projection.js';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * 把宿主的连接器状态压成界面用的标签。
 * @returns {{ name: string, status: string }}
 */
export function connectorRow(view) {
  if (!isPlainObject(view)) return { name: 'unknown', status: 'unknown' };
  const name = typeof view.name === 'string' ? view.name : 'unknown';
  const status = isPlainObject(view.status) ? view.status : undefined;
  if (status === undefined) return { name, status: 'unknown' };
  const state = typeof status.state === 'string' ? status.state : 'unknown';
  if (state === 'failed') return { name, status: 'failed' };
  if (state === 'disabled') return { name, status: 'disabled' };
  if (state === 'connected') return { name, status: 'connected' };
  // 其余状态（connecting / needs-auth / disconnected 等）原样带过来。
  return { name, status: state };
}

/**
 * 注册连接器监听。
 *
 * @param {object} ctx 插件上下文。
 * @returns {{ dispose: () => void, refresh: () => void }}
 */
export function makeConnectorUnit(ctx) {
  const refresh = () => {
    const manager = ctx.get('mcpManager');
    if (manager === undefined || typeof manager.list !== 'function') {
      setConnectorList([]);
      return;
    }
    try {
      const list = manager.list();
      const rows = Array.isArray(list) ? list.map(connectorRow) : [];
      setConnectorList(rows);
    } catch (error) {
      ctx.logger?.warn?.('[agent-ops] 读取连接器清单失败：' + String(error));
    }
  };

  const listeners = [];
  listeners.push(ctx.on('mcp-manager/status', () => { refresh(); }));
  refresh();

  return {
    refresh,
    dispose() {
      for (const listener of listeners) {
        if (typeof listener === 'function') {
          try {
            listener();
          } catch {
            /* ignore */
          }
        }
      }
    },
  };
}
