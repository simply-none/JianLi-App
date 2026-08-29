/**
 * 链式动作入口：注册全部动作 + 提供打卡后的派发能力。
 *
 * 新增一个串接目标的标准姿势：
 *   1. 在 actions/ 下写一个实现 HabitChainAction 的文件；
 *   2. 在下面的 ACTIONS 数组里加进去。
 * 习惯核心、store、设置界面都无需改动。
 */

import type { HabitCheckin, HabitDef } from "../types";
import type { ChainActionResult } from "./types";
import { getHabitChainAction, registerHabitChainAction } from "./registry";
import todoAction from "./actions/todoAction";
import noteAction from "./actions/noteAction";
import themeConversationAction from "./actions/themeConversationAction";

/** 已实现的串接动作清单 */
const ACTIONS = [todoAction, noteAction, themeConversationAction];

ACTIONS.forEach((action) => registerHabitChainAction(action));

export { registerHabitChainAction, getHabitChainAction, listHabitChainActions } from "./registry";
export type { HabitChainAction, ChainActionContext, ChainActionResult } from "./types";

/**
 * 按 phase 依次执行习惯上配置的动作。
 * 设计要点：**单个动作失败不阻断其它动作，也绝不阻断打卡本身** ——
 * 打卡是主流程，串接只是附加能力，失败只记录原因交给 UI 提示。
 */
async function runAll(
  habit: HabitDef,
  checkin: HabitCheckin,
  phase: "run" | "rollback"
): Promise<ChainActionResult[]> {
  const configs = habit.chainActions ?? [];
  if (!configs.length) return [];

  const results: ChainActionResult[] = [];
  for (const cfg of configs) {
    const action = getHabitChainAction(cfg.type);
    if (!action) {
      results.push({ type: cfg.type, ok: false, message: `未注册的动作：${cfg.type}` });
      continue;
    }

    const ctx = { habit, checkin, params: cfg.params ?? {} };
    try {
      if (phase === "run") {
        await action.run(ctx);
        results.push({ type: cfg.type, ok: true, message: `${action.label}已执行` });
      } else if (action.rollback) {
        await action.rollback(ctx);
        results.push({ type: cfg.type, ok: true, message: `${action.label}已回滚` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ type: cfg.type, ok: false, message: `${action.label}失败：${message}` });
      console.error("[habit] 链式动作执行失败:", cfg.type, err);
    }
  }
  return results;
}

/** 打卡成功后派发全部链式动作 */
export function dispatchChainActions(
  habit: HabitDef,
  checkin: HabitCheckin
): Promise<ChainActionResult[]> {
  return runAll(habit, checkin, "run");
}

/** 撤销打卡后回滚全部链式动作 */
export function rollbackChainActions(
  habit: HabitDef,
  checkin: HabitCheckin
): Promise<ChainActionResult[]> {
  return runAll(habit, checkin, "rollback");
}
