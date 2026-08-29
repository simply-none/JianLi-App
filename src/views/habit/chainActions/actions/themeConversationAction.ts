/**
 * 串接动作：自动写主题对话记录。
 *
 * 打卡后按习惯名称在「主题对话」中：
 *   - 找到同名主题则复用，找不到则自动新建（主题标题 = 习惯名称）；
 *   - 在该主题下写入一条对话记录。
 * 撤销打卡时按 ext_key 精确删除该对话（依赖 conversation 表的可选 ext_key 列）。
 *
 * 设计要点：
 *   - 直接走 themeConversation/db 的底层 IPC，**不依赖 useThemeConversation 的全局
 *     currentThemeId 状态**，避免后台打卡把用户在主题对话界面当前选中的主题悄悄切走。
 *   - conversation 表的 ext_key 列由本 action 幂等补列（ALTER 失败即忽略），
 *     不修改 themeConversation 模块自身的建表逻辑，保持单向串接、核心零改动。
 */

import type { HabitChainAction } from "../types";
import { dbQuery, dbInsert, dbUpdate, dbDelete, dbExecute } from "../../../themeConversation/db";
import { TABLE } from "../../../themeConversation/types";
import { dateTimeToStr } from "../../utils/streak";

/** 对话默认模板，支持 {name} {date} {time} {value} {note} 占位符 */
const DEFAULT_TEMPLATE = "今日打卡：{name}（{date} {time}）";

/** 渲染模板 */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** 本次对话的外部关联 key：习惯 + 日期，保证一天一条且可精确定位（用于撤销回滚） */
function extKeyOf(habitKey: string, date: string): string {
  return `habit-conv-${habitKey}-${date}`;
}

let schemaEnsured = false;
/** 幂等补列：conversation 表挂一个外部关联键，已有的库 / 新库都安全 */
async function ensureExtKeyColumn() {
  if (schemaEnsured) return;
  try {
    await dbExecute(`ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN ext_key TEXT`);
  } catch {
    // 列已存在时 SQLite 报 duplicate column name，忽略即可
  }
  schemaEnsured = true;
}

/** 按标题找主题，没有则新建（不依赖全局选中态，避免副作用） */
async function findOrCreateTheme(title: string): Promise<number> {
  const rows = await dbQuery({ tableName: TABLE.THEME, conditions: { title } });
  if (rows.length) return Number(rows[0].id);
  const t = dateTimeToStr(new Date());
  const res = await dbInsert(TABLE.THEME, {
    title,
    tags: "[]",
    create_time: t,
    update_time: t,
    remark: "",
    parent_id: "",
  });
  return Number(res.lastID);
}

const themeConversationAction: HabitChainAction = {
  type: "themeConversation",
  label: "自动写主题对话记录",
  description: "打卡后在「主题对话」按习惯名称新建/复用主题，并写入一条对话；撤销打卡时自动删除",

  async run(ctx) {
    const { habit, checkin } = ctx;
    const template = String(ctx.params?.template || DEFAULT_TEMPLATE);
    const content = render(template, {
      name: habit.name,
      date: checkin.date,
      time: checkin.time,
      value: checkin.value || "",
      note: checkin.note || "",
    });

    // 确保外部关联列存在
    await ensureExtKeyColumn();
    // 主题：同名复用，不存在则按习惯名称新建
    const themeId = await findOrCreateTheme(habit.name);
    const t = dateTimeToStr(new Date());

    await dbInsert(TABLE.CONVERSATION, {
      theme_id: themeId,
      content,
      is_rich: "0",
      ref_ids: "[]",
      cross_refs: "[]",
      tags: "[]",
      create_time: t,
      annotate_time: "",
      pinned: "0",
      is_deleted: "0",
      // 外部关联键：用于撤销时精准删除本条自动对话
      ext_key: extKeyOf(habit.key, checkin.date),
    });

    // 同步主题的更新时间，让其在主题列表里靠前
    await dbUpdate(TABLE.THEME, { update_time: t }, { id: themeId });
  },

  async rollback(ctx) {
    await ensureExtKeyColumn();
    await dbDelete(TABLE.CONVERSATION, { ext_key: extKeyOf(ctx.habit.key, ctx.checkin.date) });
  },
};

export default themeConversationAction;
