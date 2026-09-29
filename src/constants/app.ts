/**
 * 应用级常量（渲染进程）
 *
 * 说明：
 * - appName：应用正式名称，与主进程 variables.ts 的 appName 保持一致。
 *   用于「取不到本机设备名」时的兜底文案，以及任何需要展示产品名的场景。
 * - 本机设备名（随机昵称基座，如「软胖憨憨的小鸭」）不走这里：
 *   它由主进程 transfer:status / transfer:nickname 提供，首次生成后永久固定。
 */

/** 应用正式名称 */
export const appName = '渐离App'
