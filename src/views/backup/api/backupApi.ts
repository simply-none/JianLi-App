/**
 * 备份与恢复 + 数据导出中心的 IPC 封装
 *
 * 统一经 window.ipcRenderer.handlePromise 调用主进程 backup.ts 注册的通道，
 * 渲染端不直接接触任何文件 / 数据库操作。
 */
import type {
  BackupInfo,
  BackupListItem,
  AutoBackupConfig,
  CommonResult,
  ExportModulesResult,
  ExportFileItem,
} from "../types";
import { toPlain } from "@/utils/common";

/**
 * 通用调用封装：还原 Vue 代理后经 handlePromise 调用主进程
 *
 * @param {string} channel - IPC 通道名
 * @param {Object} [args] - 调用参数
 * @returns {Promise<any>} 主进程返回结果
 */
async function call<T = any>(channel: string, args?: any): Promise<T> {
  return window.ipcRenderer.handlePromise(channel, toPlain(args || {}));
}

/**
 * 获取备份概况（各库状态、备份目录、自动备份配置、最近备份）
 *
 * @returns {Promise<BackupInfo>} 备份概况信息
 */
export function getBackupInfo(): Promise<BackupInfo> {
  return call<BackupInfo>("backup:get-info");
}

/**
 * 创建手动备份
 *
 * @param {string} [note] - 用户备注
 * @returns {Promise<CommonResult>} 成功返回 fileName/filePath/size/manifest
 */
export function createBackup(note?: string): Promise<CommonResult> {
  return call<CommonResult>("backup:create", { note: note || "" });
}

/**
 * 获取备份文件列表（按时间倒序）
 *
 * @returns {Promise<BackupListItem[]>} 备份列表
 */
export function listBackups(): Promise<BackupListItem[]> {
  return call<BackupListItem[]>("backup:list");
}

/**
 * 恢复指定备份（备份目录内的文件）
 *
 * @param {string} fileName - 备份文件名
 * @returns {Promise<CommonResult>} 成功返回 needRestart:true 与原备份清单
 */
export function restoreBackup(fileName: string): Promise<CommonResult> {
  return call<CommonResult>("backup:restore", { fileName });
}

/**
 * 选择外部备份文件（主进程原生文件选择框，仅 .jlbak）
 *
 * @returns {Promise<CommonResult>} 成功返回 filePath 与 manifest 预览
 */
export function selectBackupFile(): Promise<CommonResult> {
  return call<CommonResult>("backup:select-backup-file");
}

/**
 * 按绝对路径恢复（配合 selectBackupFile 使用，用于恢复外部备份文件）
 *
 * @param {string} filePath - 备份文件绝对路径
 * @returns {Promise<CommonResult>} 成功返回 needRestart:true 与原备份清单
 */
export function restoreFromPath(filePath: string): Promise<CommonResult> {
  return call<CommonResult>("backup:restore-path", { filePath });
}

/**
 * 删除指定备份
 *
 * @param {string} fileName - 备份文件名
 * @returns {Promise<CommonResult>} 删除结果
 */
export function deleteBackup(fileName: string): Promise<CommonResult> {
  return call<CommonResult>("backup:delete", { fileName });
}

/**
 * 在资源管理器中打开备份目录
 *
 * @returns {Promise<CommonResult>} 打开结果
 */
export function openBackupDir(): Promise<CommonResult> {
  return call<CommonResult>("backup:open-dir");
}

/**
 * 读取自动备份配置
 *
 * @returns {Promise<AutoBackupConfig>} 自动备份配置
 */
export function getAutoConfig(): Promise<AutoBackupConfig> {
  return call<AutoBackupConfig>("backup:get-auto-config");
}

/**
 * 保存自动备份配置（合并式更新）
 *
 * @param {Partial<AutoBackupConfig>} partial - 要更新的配置字段
 * @returns {Promise<AutoBackupConfig>} 更新后的完整配置
 */
export function setAutoConfig(partial: Partial<AutoBackupConfig>): Promise<AutoBackupConfig> {
  return call<AutoBackupConfig>("backup:set-auto-config", partial);
}

/**
 * 获取导出中心模块清单（按模块归组的表 + 未归组表，含行数与日期列探测）
 *
 * @returns {Promise<ExportModulesResult>} 导出模块清单
 */
export function getExportModules(): Promise<ExportModulesResult> {
  return call<ExportModulesResult>("export:get-modules");
}

/**
 * 弹出目录选择框（主进程原生对话框）
 *
 * @returns {Promise<string|null>} 选择的目录路径；取消返回 null
 */
export function selectExportDir(): Promise<string | null> {
  return call<string | null>("export:select-dir");
}

/**
 * 执行数据导出
 *
 * @param {Object} params - 导出参数
 * @param {string[]} params.tables - 要导出的表名列表
 * @param {"csv"|"json"} params.format - 导出格式
 * @param {string} [params.dateStart] - 日期范围起点（YYYY-MM-DD，可选）
 * @param {string} [params.dateEnd] - 日期范围终点（YYYY-MM-DD，可选）
 * @param {string} params.saveDir - 导出目标目录
 * @returns {Promise<{ ok: boolean; files?: ExportFileItem[]; error?: string }>} 导出结果
 */
export function runExport(params: {
  tables: string[];
  format: "csv" | "json";
  dateStart?: string;
  dateEnd?: string;
  saveDir: string;
}): Promise<{ ok: boolean; files?: ExportFileItem[]; error?: string }> {
  return call("export:run", params);
}
