/**
 * 串接动作：完成关联待办。
 *
 * 数据契约沿用待办模块自身写法（todo_list + new-sql:upsert，primaryKey='key'，
 * 先展开整行再覆盖状态字段，写完发 update-todo-reminders 让主进程重排截止提醒）。
 */

import type { HabitChainAction } from "../types";
import { invoke } from "../registry";
import { dateTimeToStr } from "../../utils/streak";

/** 转义单引号，避免 key 里带引号破坏 SQL 字面量 */
function esc(v: unknown): string {
  return String(v ?? "").replace(/'/g, "''");
}

/** 查询待办（走 new-sql:query + SqlStr，不做列推导，避免污染表结构） */
async function queryTodos(sql: string): Promise<any[]> {
  const res = await invoke("new-sql:query", {
    tableName: "todo_list",
    conditions: { SqlStr: sql },
  });
  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

/** 从 params 里取出待办 key 列表 */
function pickKeys(ctx: { params: Record<string, any> }): string[] {
  const raw = ctx.params?.todoKeys;
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return list.map((k) => String(k).trim()).filter(Boolean);
}

const todoAction: HabitChainAction = {
  type: "todo",
  label: "完成关联待办",
  description: "打卡后把关联的待办项标记为已完成（需填写待办 key，多个用逗号分隔）",

  async run(ctx) {
    const keys = pickKeys(ctx);
    if (!keys.length) return;

    const now = dateTimeToStr(new Date());
    const inList = keys.map((k) => `'${esc(k)}'`).join(",");
    const rows = await queryTodos(`SELECT * FROM todo_list WHERE key IN (${inList})`);
    if (!rows.length) return;

    for (const row of rows) {
      await invoke("new-sql:upsert", {
        tableName: "todo_list",
        // 展开整行再覆盖，保证不丢其它字段（与待办模块 TodoDetailDialog 的保存写法一致）
        data: {
          ...row,
          status: "completed",
          completed: 1,
          completedTime: now,
          updateTime: now,
        },
        config: { primaryKey: "key" },
      });
    }

    // 通知主进程按最新待办重新排程截止提醒
    (window as any).ipcRenderer.send("update-todo-reminders");
  },

  async rollback(ctx) {
    const keys = pickKeys(ctx);
    if (!keys.length) return;

    const now = dateTimeToStr(new Date());
    const inList = keys.map((k) => `'${esc(k)}'`).join(",");
    const rows = await queryTodos(`SELECT * FROM todo_list WHERE key IN (${inList})`);
    if (!rows.length) return;

    for (const row of rows) {
      await invoke("new-sql:upsert", {
        tableName: "todo_list",
        data: {
          ...row,
          status: "not_started",
          completed: 0,
          completedTime: "",
          updateTime: now,
        },
        config: { primaryKey: "key" },
      });
    }
    (window as any).ipcRenderer.send("update-todo-reminders");
  },
};

export default todoAction;
