# 文件保险箱 · 资源管理器右键菜单 实现计划

> 范围：仅为「可落地的实现计划 + 任务清单」，确认后再写代码。
> 注册方式（已确认）：**运行时写 `HKEY_CURRENT_USER` 注册表**，无需管理员，开发/打包均可用，退出不自动清理（菜单常驻），卸载时由 NSIS 或手动清理（见阶段 4）。

## 一、目标

在 Windows 文件资源管理器右键任意文件时，出现「通过渐离App」相关菜单项，点击后把文件交给已有「私密文件保险箱」的对应对话框处理：

- **加密到保险箱**：复用 `ImportDialog`（`importFiles` + 默认安全删除源文件）。
- **解密文件(.jlv)**：复用 `DecryptImportDialog`（`import-decrypt` / `import-decrypt-bytes`）。
- （阶段 2 可选）**安全删除**：复用 `secureDeleteFile`，新增 IPC，无需解锁。

底层能力（AES-256-GCM、文件名加密、源文件碎纸、解密临时预览）已全部就绪，本次纯属「注册表 + 启动参数路由 + 渲染端接线」。

## 二、整体数据流

```
资源管理器右键
  └─ 注册表 command: "<exe>" --vault-encrypt "%1"
        │
        ▼
Electron 启动 / 第二实例
  ├─ 首次启动: process.argv → parseCliFiles()
  └─ second-instance: argv → parseCliFiles()
        │  解析出 {action, files[]} 并入队 pendingCli
        ▼
  win.webContents.send('app:cli-open', {action, files})
        │
        ▼
渲染端 App.vue 监听 → router.push('fileVault')
        │
        ▼
useFileVault.pendingCli → fileVault/index.vue 挂载后 applyPending()
  ├─ encrypt → 未解锁先弹解锁，解锁后打开 ImportDialog(initialFiles)
  ├─ decrypt → 未解锁先弹解锁，解锁后打开 DecryptImportDialog(initialFiles)
  └─ secure-delete → 弹确认框 → file-vault:secure-delete（无需解锁）
```

## 三、改动点清单

### 3.1 新增主进程模块 `electron/main/module/shellMenu.ts`（Windows 专属）

- `registerShellMenu()`：`process.platform === 'win32'` 时执行。
  - 用 `child_process.execSync('reg add ... /f')` 写 `HKEY_CURRENT_USER\Software\Classes\*\shell\`：
    - 扁平三项（推荐，键少、易清理）：
      - `JianliApp.Encrypt`：`(Default)`=「通过渐离App 加密到保险箱」，`Icon`=`<exe>,0`，`command`=`"<exe>" --vault-encrypt "%1"`
      - `JianliApp.Decrypt`：`(Default)`=「通过渐离App 解密(.jlv)」，`command`=`"<exe>" --vault-decrypt "%1"`
      - `JianliApp.SecureDelete`：`(Default)`=「通过渐离App 安全删除」， `command`=`"<exe>" --secure-delete "%1"`
    - `<exe>` = `process.execPath`（打包后为真实渐离App.exe）。
  - 幂等：每次 `reg add /f` 覆盖，App 更新后路径自动刷新。
  - dev 模式（`!app.isPackaged`）：`process.execPath` 是 electron.exe，直接注册会带不对的参数。策略：
    - 打包版：`whenReady` 后自动 `registerShellMenu()`。
    - dev 版：不自动注册，另提供 `scripts/register-shell-menu-dev.cjs`（手动跑，把 command 指向 `electron.exe "<appDir>" --vault-encrypt "%1"`）便于联调。
- `unregisterShellMenu()`：`reg delete ... /f` 删除上述三项（供「设置里移除右键菜单」或卸载调用）。
- `parseCliFiles(argv): {action, files: string[]}[]`：跳过 argv[0]（exe 路径），扫描 `--vault-encrypt / --vault-decrypt / --secure-delete` 标志，其后直到下一个 `--` 标志或 argv 末尾的参数为文件路径，归入对应 action。
- 模块级 `pendingCli: {action, files}[]` 队列 + `queueCli(items)` / `flushPending(win)`（`win.webContents.send('app:cli-open', item)` 逐个发送）。

### 3.2 改 `electron/main/index.ts`

- 在 `createWindow()` 末尾（`initFileVault()` 之后）调用 `registerShellMenu()`（仅 win32 + 打包或 dev 脚本）。
- 改造 `app.on('second-instance', ...)`（当前 :176 只 `win.focus()`）：
  ```ts
  app.on('second-instance', (_e, argv) => {
    const items = parseCliFiles(argv);
    if (items.length) queueCli(items);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      flushPending(win);   // 把排队文件发给渲染端
    }
  });
  ```
- 首次启动：在 `app.whenReady().then(createWindow)` 之后，`createWindow` 内 `win` 就绪后补一次 `flushPending(win)`（覆盖 App 未运行时直接双击文件启动的场景）。
- 新增 IPC `file-vault:secure-delete`：`ipcMain.handle` 内调用已存在的 `secureDeleteFile(sourcePath)`（见 `fileVault.ts:277`），返回 `{ ok, deleted }`，**不要求解锁**。

### 3.3 改 `electron/main/module/fileVault.ts`

- 仅新增 `file-vault:secure-delete` 处理（其余 IPC 与 `secureDeleteFile` 复用，无需改）。

### 3.4 改 `src/views/fileVault/store/useFileVault.ts`

- 新增 `pendingCli = ref<{action:string, files:string[]} | null>(null)`、`setPendingCli(item)`、`applyPending()`。
  - `applyPending()`：
    - `encrypt`：若 `isUnlocked` → 打开 `ImportDialog` 并预填 `initialFiles`；否则先触发解锁（`showUnlock=true`），解锁 `@done` 后再打开导入。
    - `decrypt`：同上逻辑 → 打开 `DecryptImportDialog` 预填。
    - `secure-delete`：无需解锁，弹 `ElMessageBox.confirm` → 调 `fileVaultApi.secureDelete(files)` → 提示结果。
  - 调用后清空 `pendingCli`。

### 3.5 改 `src/views/fileVault/index.vue`

- 新增 `onMounted` 内调用 `store.applyPending()`（在 `store.init()` 之后），使右键启动能自动弹出对应对话框。
- 给 `ImportDialog` / `DecryptImportDialog` 增加可选 `initialFiles` prop（默认空，走原有原生选择逻辑），非空时跳过 `pick-import` 直接走 `importFiles` / `decryptImportBytes`。

### 3.6 改 `src/App.vue`（或根布局，常驻）

- `ipcRenderer.on('app:cli-open', (_e, item) => { router.push({ name: 'fileVault' }); useFileVault().setPendingCli(item); })`。
- `onUnmounted` 注销监听。

### 3.7 路由

- 现有 `FILE_VAULT` 路由（`src/router/index.ts`）已就绪，`router.push({name:'fileVault'})` 即可。

## 四、关键技术点 / 坑

1. **多选聚合**：Windows 多选文件右键可能多次触发 `second-instance`（每次一个 `%1`）。用 `pendingCli` 队列 + `flushPending` 把多次调用聚合成一批文件，渲染端一次性弹对话框，规避「只拿到第一个文件」的坑。
2. **窗口未就绪**：`second-instance` 可能早于 `createWindow` 完成，先入队、窗口就绪后 `flushPending` 补发。
3. **解锁前置**：加密/解密必须先解锁保险箱（`dataKey` 在内存）。渲染端 `applyPending` 先判断 `isUnlocked`，未解锁先弹解锁门，解锁完成回调里再开对话框。安全删除不需要解锁。
4. **dev 模式注册**：dev 下 `process.execPath` 非业务 exe，自动注册会写错命令；改为 dev 手动脚本，避免污染。
5. **中文路径**：注册表 `%1` 以引号原始路径传入，Electron argv 在 Windows 上为 UTF-8，中文文件名无需额外转码。
6. **主进程改动需重启 Electron** 才能测试（项目约定）。

## 五、可扩展功能（后续阶段，本次不实现）

| 功能 | 复用 | 说明 |
|---|---|---|
| 安全碎纸机删除（阶段 2） | `secureDeleteFile` | 右键彻底擦除源文件，独立隐私能力 |
| 批量多选 | second-instance 聚合 | 本次队列已天然支持 |
| 用渐离预览 | `decrypt-temp` + `jlocal://` | 临时解密到内存缓存预览，不留明文 |
| 计算 SHA-256 校验 | `node:crypto` | 安全工具向，加到右键 |
| 联动笔记/待办/剪贴板 | 各模块 API | 右键文件→加入待办附件/导入笔记（偏离主线，远期） |
| NSIS 安装时注册（阶段 4） | `nsis.include` | 打包时写菜单、卸载清理，确保未运行过也有菜单（当前用运行时 HKCU） |

## 六、任务清单（确认后执行）

- [ ] 新建 `electron/main/module/shellMenu.ts`：`registerShellMenu` / `unregisterShellMenu` / `parseCliFiles` / `queueCli` / `flushPending`（win32 + HKCU + reg add）。
- [ ] `index.ts`：接入 `registerShellMenu` + 改造 `second-instance` + 首次启动 `flushPending` + 注册 `file-vault:secure-delete`。
- [ ] `fileVault.ts`：新增 `file-vault:secure-delete` 处理。
- [ ] `useFileVault.ts`：新增 `pendingCli` / `setPendingCli` / `applyPending`（含解锁前置与安全删除分支）。
- [ ] `index.vue`：`onMounted` 调 `applyPending`；`ImportDialog`/`DecryptImportDialog` 支持 `initialFiles` prop。
- [ ] `App.vue`：常驻监听 `app:cli-open`，跳转 fileVault 并 `setPendingCli`。
- [ ] `api/fileVaultApi.ts`：新增 `secureDelete(files)` 封装。
- [ ] `scripts/register-shell-menu-dev.cjs`：dev 联调用注册脚本（含反注册）。
- [ ] 类型检查 `vue-tsc --noEmit` 通过；主进程改动重启验证。
- [ ] 同步到 `@skill:jianli-app` 模块文档（红线 9）：在 `references/modules/file-vault.md` 增补「资源管理器右键」章节。

## 七、验证步骤

1. 打包或 dev + 手动跑 `register-shell-menu-dev.cjs`。
2. 资源管理器右键一个普通文件 → 应见「加密到保险箱 / 解密(.jlv) / 安全删除」三项。
3. 点「加密到保险箱」→ App 启动/聚焦 → 跳文件保险箱 → 若未解锁先解锁 → 导入对话框预填该文件 → 导入后源文件被碎纸。
4. 右键 `.jlv` → 解密 → 另存明文，验证可正常打开。
5. 右键文件 → 安全删除 → 确认后源文件不可恢复（对比加密导入的碎纸效果）。
6. 多选多个文件右键加密 → 应聚合为一次批量导入。
```
