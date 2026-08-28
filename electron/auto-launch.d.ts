// auto-launch 库自带 JS 但无类型声明，这里补充模块声明供 TypeScript 识别。
// 运行时为 CommonJS：module.exports = AutoLaunch（class）。
// 配合 tsconfig.node.json 的 esModuleInterop，可用 `import AutoLaunch from 'auto-launch'`。
declare module 'auto-launch' {
  class AutoLaunch {
    /**
     * @param options.name     应用名（Windows 下用作启动文件夹快捷方式文件名，需与 enable 时一致）
     * @param options.path     可执行文件路径（app.getPath('exe')）
     * @param options.isHidden 仅 macOS 生效，启动后隐藏（Windows 忽略）
     */
    constructor(options: AutoLaunch.Options);
    /** 启用开机自启动 */
    enable(): Promise<void>;
    /** 关闭开机自启动 */
    disable(): Promise<void>;
    /** 是否已启用开机自启动 */
    isEnabled(): Promise<boolean>;
  }

  namespace AutoLaunch {
    interface Options {
      name: string;
      path?: string;
      isHidden?: boolean;
      mac?: {
        useLaunchAgent?: boolean;
      };
      linux?: {
        isHidden?: boolean;
        xdg?: {
          name?: string;
          fileName?: string;
          encodedExec?: string;
        };
      };
    }
  }

  export = AutoLaunch;
}
