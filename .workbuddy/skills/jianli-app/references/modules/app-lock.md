# 应用锁 / 隐私模式 (app-lock)

## 职责
应用锁（密码锁屏 + 隐藏小窗防窥）与隐私模式（老板键一键隐藏/恢复全部窗口）。锁定态权威在主进程，广播同步渲染端。

## 关键文件
- 主进程：`electron/main/module/appLock.ts`（`initAppLock()`：IPC + 广播 + 启动/恢复锁定 + 老板键）
- 快捷键分发：`electron/main/module/registerShortcut.ts` 的 `globalShortcutFn` 新增 `lock_app` / `privacy_hide` 分支
- 渲染端 store：`src/store/useAppLock.ts`（锁定态 + 配置开关 + 动作封装）
- 锁屏遮罩：`src/layout/AppLock.vue`（挂 `src/layout/index.vue`，Transition 淡入淡出）
- 设置 UI：`src/views/setting/components/AppLockSetting.vue`（设置页「安全与隐私」区块）
- 命令面板：`actionSource.ts` 的 `action:lock-app`

## 密码安全
- 密码经 RSA 公钥加密落 `basic_info` 表 `appLockPassword` 键（复用 crypto.ts 的 RSAKey，**绝不在本模块重新生成密钥**）
- 校验：主进程私钥解密比对，**全部用异步 ipcMain.handle**（避开 decrypt-pwd 同步通道阻塞的坑）
- 明文不经过渲染端存储；关闭/修改密码需先验证当前密码

## 配置键（basic_info）
- `appLockPassword`：密码密文
- `appLockOnStartup`：启动时锁定（bool，**默认 false，用户开启才触发**）
- `appLockOnRestore`：最小化恢复时锁定（bool，默认 false）

## IPC 通道
| 通道 | 类型 | 用途 |
|---|---|---|
| `app-lock:set-password` | handle | 设置/修改密码（主进程加密落库） |
| `app-lock:verify` | handle | 校验密码（不改变锁定态） |
| `app-lock:clear-password` | handle | 验证后清除密码并解锁 |
| `app-lock:unlock` | handle | 校验通过即解锁并广播 |
| `app-lock:lock` | handle | 立即锁定 |
| `app-lock:get-state` | handle | 状态快照（locked/hasPassword/两开关） |
| `app-lock:config-changed` | on | 渲染端改开关后通知主进程 |
| `app-lock:state-changed` | 广播 | 主→所有窗口同步锁定态 |

## 锁定/解锁流程
- **锁定** `lockAppNow()`：幂等（已锁直接返回）→ 隐藏全部非主窗口（记录到 hiddenWindows）→ 置 isLocked → 广播 → 主窗口 show+focus
- **解锁** `unlockAppNow()`：清态 → 广播 → 按原窗口对象 show 恢复 hiddenWindows
- **启动锁定**：init 后延迟 4s 检查开关 + 已设密码才触发
- **恢复锁定**：监听主窗口 `restore`/`show`，有 8s 启动保护期（避免与启动锁定/首次显示重复），且 isLocked 幂等防事件循环

## 隐私模式（老板键）`togglePrivacyHide()`
- 有可见窗口 → 全部隐藏（独立记录 privacyHidden，与锁定列表分开）
- 全隐藏 → 显示主窗口；**锁定态下不恢复小窗**（保持隐私）
- 用户在快捷键页绑定 `privacy_hide` 触发

## 特有坑 / 注意
- **私钥解密必须走 `crypto.ts` 的 `safePrivateDecrypt`**：RSAKey 私钥生成时带了 `aes-256-cbc` 口令加密（passphrase），自行调用 `privateDecrypt` 漏传 passphrase 会必然抛错 → 表现为「正确密码也解锁失败」（2026-08-30 已修复）
- 渲染端锁定态唯一来源是主进程广播，渲染端**不自行判定**锁定（避免多窗口状态漂移）
- `restore`/`show` 事件回调是异步判定（shouldLockOnRestore 读库），isLocked 置位必须在 show() 之前防重入
- 输错 5 次密码 → 30 秒冷却倒计时（渲染端 AppLock.vue 纯前端计时）
- 快捷键动作类型新增必须同时改 `registerShortcut.ts` 分发与 `registerShortcut/index.vue` 配置列表
- 主进程改动需重启 Electron 生效
