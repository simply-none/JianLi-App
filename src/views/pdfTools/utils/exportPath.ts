/**
 * 多文件导出路径工具
 * 当某工具自动导出「一系列文件」时，在用户所选目录下再生成
 * 「<源文件名>-<功能>-<datetime>」子目录，文件写入该子目录，避免
 * 多次导出时文件散落混在一起。例：path/doing-拆分-2026-08-31-22-57-00/
 *
 * 渲染端无 node:path，故用平台无关的方式拼接路径。
 */

/** 生成文件系统安全的 datetime 片段（如 2026-08-31-22-57-00，无冒号） */
function safeTimestamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-` +
    `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

/** 平台无关的路径拼接（渲染端无 node:path 可用） */
function joinPath(dir: string, name: string): string {
  const d = dir.replace(/[\\/]+$/, '');
  const sep = d.includes('\\') ? '\\' : '/';
  return `${d}${sep}${name}`;
}

/**
 * 计算自动导出的子目录绝对路径。
 * @param outDir 用户选择的目录
 * @param baseName 源文件名（已去扩展名）
 * @param funcLabel 功能名（如「拆分」「导出图片」）
 */
export function makeExportSubDir(outDir: string, baseName: string, funcLabel: string): string {
  const folder = `${baseName}-${funcLabel}-${safeTimestamp()}`;
  return joinPath(outDir, folder);
}
