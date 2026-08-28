/**
 * 链式动作（Habit Chain Action）的类型契约。
 *
 * 「习惯打卡」本身很薄，真正的能力来自打卡之后能派发到哪些模块。
 * 每个串接目标（待办 / 笔记 / 记账 / …）实现本接口并注册进 registry，
 * 习惯核心不认识任何具体模块 —— 新增串接只需新增一个 action 文件，核心零改动。
 */

import type { HabitCheckin, HabitDef } from "../types";

/** 派发时传给 action 的上下文 */
export interface ChainActionContext {
  /** 触发本次动作的习惯定义 */
  habit: HabitDef;
  /** 本次打卡记录（撤销时是那条被删掉的记录） */
  checkin: HabitCheckin;
  /** 动作自身的参数，来自 habit_def.chainActions 里的 params */
  params: Record<string, any>;
}

/** 单个动作的执行结果（用于 UI 提示，不抛出、不中断其它动作） */
export interface ChainActionResult {
  type: string;
  ok: boolean;
  /** 给用户看的一句话结果，失败时是原因 */
  message: string;
}

export interface HabitChainAction {
  /** 唯一类型标识，存进 habit_def.chainActions[].type */
  type: string;
  /** 设置界面展示的名称 */
  label: string;
  /** 一句话说明，展示在设置界面 */
  description: string;
  /** 打卡成功后执行 */
  run(ctx: ChainActionContext): Promise<void> | void;
  /** 撤销打卡时回滚（可选；无法回滚的动作不实现即可） */
  rollback?(ctx: ChainActionContext): Promise<void> | void;
}
