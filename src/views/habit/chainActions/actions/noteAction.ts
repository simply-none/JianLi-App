/**
 * 串接动作：自动写笔记日志。
 *
 * 打卡后在 note_book 追加一条带日期的日志。笔记 key 由「习惯 + 日期」决定，
 * 因此同一天重复打卡是更新同一条，撤销打卡则把这条删掉，不会留下垃圾笔记。
 */

import type { HabitChainAction } from "../types";
import { invoke } from "../registry";
import { dateTimeToStr } from "../../utils/streak";

/** 日志默认模板，支持 {name} {date} {time} {value} {note} 占位符 */
const DEFAULT_TEMPLATE = "今日打卡：{name}（{date} {time}）";

/** 渲染模板 */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** 转义单引号 */
function esc(v: unknown): string {
  return String(v ?? "").replace(/'/g, "''");
}

/** 本次日志的笔记 key：习惯 + 日期，保证一天一条且可精确定位 */
function noteKeyOf(habitKey: string, date: string): string {
  return `habit-log-${habitKey}-${date}`;
}

const noteAction: HabitChainAction = {
  type: "note",
  label: "自动写笔记日志",
  description: "打卡后在「可归类的笔记」里写入一条带日期的日志，撤销打卡时自动删除",

  async run(ctx) {
    const { habit, checkin } = ctx;
    const now = new Date();
    const template = String(ctx.params?.template || DEFAULT_TEMPLATE);

    const text = render(template, {
      name: habit.name,
      date: checkin.date,
      time: checkin.time,
      value: checkin.value || "",
      note: checkin.note || "",
    });

    const html = `<p>${text}</p>`;

    await invoke("new-sql:upsert", {
      tableName: "note_book",
      data: {
        key: noteKeyOf(habit.key, checkin.date),
        excerpt: text,
        html,
        content: html,
        mdText: text,
        // 归类到「习惯打卡」；tags 存空数组字符串，避免影响既有标签筛选
        whereStr: "习惯打卡",
        tags: "[]",
        createTime: dateTimeToStr(now),
        updateTime: dateTimeToStr(now),
      },
      config: { primaryKey: "key" },
    });
  },

  async rollback(ctx) {
    // 走笔记模块自身的删除通道（delete-data + condition），保持一致
    await invoke("delete-data", {
      tableName: "note_book",
      condition: { key: esc(noteKeyOf(ctx.habit.key, ctx.checkin.date)) },
    });
  },
};

export default noteAction;
