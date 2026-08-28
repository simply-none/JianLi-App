/**
 * 链式动作注册表（仿命令面板 useCommandSources 的 REGISTRY 模式）。
 *
 * 扩展方式：写一个实现 HabitChainAction 的文件，在 index.ts 里 import 一次即可，
 * 习惯核心与设置界面都不需要改动。
 */

import type { ChainActionResult, HabitChainAction } from "./types";

const registry: Record<string, HabitChainAction> = {};

/** 注册一个链式动作（同 type 后注册者覆盖前者） */
export function registerHabitChainAction(action: HabitChainAction): void {
  registry[action.type] = action;
}

/** 按 type 取动作，未注册返回 undefined */
export function getHabitChainAction(type: string): HabitChainAction | undefined {
  return registry[type];
}

/** 列出全部已注册动作（供设置界面渲染开关列表） */
export function listHabitChainActions(): HabitChainAction[] {
  return Object.values(registry);
}

/** 统一调用 preload 暴露的 ipcRenderer */
function invoke<T = any>(channel: string, args?: any): Promise<T> {
  return (window as any).ipcRenderer.invoke(channel, args);
}

/** 供各 action 复用的 IPC 调用（ habit_def 等核心表之外的目标表都走这里） */
export { invoke };
