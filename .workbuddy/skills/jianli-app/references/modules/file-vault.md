# 私密文件保险箱（fileVault）

## 职责
本地 AES-256-GCM 加密存储敏感文件（文档 / 图片 / 证书 / 密钥文件等）：解锁后才能查看、预览、导出。复用项目统一安全底座 `vault/crypto.ts`（与密码保险库、2FA 同源），渲染端只经 IPC，绝不持有明文与密钥。文件名走**方案 A（加密）**：原名也用 `dataKey` 加密，库里只存密文，连 SQLite 都看不到真实文件名。

## 关键设计决策（与用户确认）
- **密钥层级（数据密钥 + 口令加密密钥）**：`dataKey` 随机 32 字节，仅驻留主进程内存；`KEK = PBKDF2(password, salt, 200000, 32, sha256)`；`wrappedKey = AES-256-GCM(KEK, dataKey)` 落库 `file_vault_config`。每文件用 `dataKey` 加密，密文落独立目录（文件名随机 uuid + `.jlv`）。
- **改密码 = 仅重 wrap `dataKey`**，无需重加密所有文件（相对「每文件派生口令密钥」方案的核心优势）。
- **锁定 = 清零内存 `dataKey` + `vaultPass`**，保留路径。
- **文件名加密（方案 A）**：`original_name` 用 `dataKey` 加密后存库（`file_vault_files.name`）；未解锁时列表为空、搜索只能在解锁后可用。代价 = 库泄露也不暴露文件名（内容本就不可读）。
- **密文目录独立于 DB**：`fileCachePath/渐离App保险箱/`，文件过大不进 SQLite。

## 文件结构（原子化拆分）
### 主进程（改完需重启 Electron）
- `electron/main/module/fileVault.ts` — `initFileVault()`：建表（`file_vault_config` / `file_vault_files`，主键 TEXT）+ 注册全部 `file-vault:*` IPC + 内存态 `dataKey/vaultPass`
- 复用 `electron/main/module/vault/crypto.ts` 的 `encryptBytes` / `decryptBytes` / `deriveKey`（AES-256-GCM，PBKDF2 200000）
- 注册：已在 `electron/main/index.ts` 的启动流程里 `initFileVault()`

### 渲染端
- `src/views/fileVault/types.ts` — `VaultFileMeta` / `VaultStatus` / `DecryptTempResult` / `ExportResult`
- `src/views/fileVault/api/fileVaultApi.ts` — `file-vault:*` IPC 封装（薄封装 `window.ipcRenderer.handlePromise`）
- `src/views/fileVault/store/useFileVault.ts` — Pinia store（状态 + 动作，委托 api，不持明文）
- `src/views/fileVault/index.vue` — 主视图（未建库 / 未解锁 / 已解锁三态 + 自动锁定 UI）
- `src/views/fileVault/components/`：`UnlockView`（首次设密·解锁）· `FileGrid`（VirtualList 虚拟化卡片）· `ImportDialog`（原生多选→逐文件加密）· `PreviewDialog`（解密临时文件经 `jlocal:///` 预览，关闭即清临时明文）

### 路由 / 菜单
- `src/router/index.ts` — `RouteNames.FILE_VAULT` + `layoutRouters`（`/fileVault`）
- `src/layout/index.vue` — 「效率工具」组 `names` 加 `fileVault`（侧边栏入口）
- `routeSetting` 可见开关由 `layoutRouters` 自动接管

## IPC 通道（全部 `file-vault:*`，主进程 handle）
| 通道 | 用途 |
|---|---|
| `file-vault:set-password` `{password}` | 首次设密，生成 dataKey → 派生 KEK → wrap 落库 |
| `file-vault:unlock` `{password}` | 派生 KEK 解 wrap；口令错则 GCM 认证失败返回「口令错误」 |
| `file-vault:lock` | 清空内存 dataKey/口令 + 清理预览临时目录 |
| `file-vault:status` | 返回 `{hasVault, isUnlocked}` |
| `file-vault:list` | 解锁后主进程用 dataKey 解密文件名，返回脱敏元数据列表 |
| `file-vault:pick-import` | 原生多选对话框，返回源文件路径数组 |
| `file-vault:import` `{sourcePath, name?, deleteSource?}` | 读源文件→加密落盘→写脱敏元数据（原名加密）；`deleteSource=true` 时再安全删除原文件（随机覆盖 + unlink），避免明文原文件残留在原位置 |
| `file-vault:pick-export-dir` | 原生目录选择，返回导出目录 |
| `file-vault:export` `{id, destDir}` | 解密写出目标目录 |
| `file-vault:decrypt-temp` `{id}` | 解密到临时目录，返回 `tempPath`（渲染端用 `jlocal:///` 预览） |
| `file-vault:cleanup-temp` | 清空预览临时目录（防磁盘残留明文） |
| `file-vault:delete` `{id}` | 删元数据 + 删密文 |

## 安全红线
- 明文文件内容绝不写应用数据库（newSql / basic_info 只读写 vault 配置与脱敏元数据）。
- `dataKey` / 口令仅驻留内存，`lock` 时清零。
- 预览先解密到临时目录、用完即清（关闭预览 / 锁定均触发 `cleanup-temp`）。
- **方案 A 强隐私**：未解锁时 SQLite 元数据里只有密文文件名，资源管理器 / SQLite 均看不到真实文件名。
- **备份红线**：数据库级 `.jlbak` 整库快照会包含 `file_vault_*`，但它们由口令派生 KEK 保护（无口令无法解开 dataKey）；且「数据导出中心」已通过 `backup.ts` 的 `EXPORT_EXCLUDE_PREFIXES = ["file_vault_"]` 排除，不会在导出中心枚举 / 导出这些表。

## 自动锁定（② 新增）
- **共享 composable**：`src/composables/useAutoLock.ts`（原 passwordVault 私有版已提升为共享，避免重复实现）。
- `index.vue` 解锁后 `watch(store.isUnlocked)` 启动监听；触发条件 = 窗口失焦 / 页面隐藏(`visibilitychange:hidden`) / 空闲超时，任一即 `store.lock()` 清空主进程内存密钥。
- 工具栏新增「自动锁定」下拉：1 / 5 / 10 / 15 / 30 分钟，`checkIdle` 每次实时读取最新阈值。
- 导入 / 导出走原生文件对话框时会 `pause()` 自动锁定、关闭后 `resume()`，避免失焦误锁。

## 命令面板入口
- `FILE_VAULT` 路由已在 `layoutRouters` 内，命令面板 `routeSource` 自动派生该入口——搜「保险箱 / fileVault」即可直达，无需在 `actionSource.ts` 重复登记。

## 特有坑 / 注意
- 改主进程（fileVault.ts / crypto.ts）**必须重启 Electron**。
- 渲染端禁 `import electron/*`；所有库 / 磁盘操作走 IPC。
- **忘记密码 = 不可恢复**（无后门，设计如此，UI 需显著提示）。
- 密文目录 Windows 下权限；导出后明文及时清理；预览临时文件及时删。
- **导入即「移入」语义**：加密副本落盘后默认安全删除原文件（`ImportDialog` 开关「导入后删除原文件」默认勾选），否则明文原文件仍躺在原位置会被误认为「加密未生效」。
- 主题色走 CSS token（`--bg-base/card`、`--color-primary` 等），适配 25 套主题。
- 与既有架构一致：侧边栏入口 + 路由可见开关（routeSetting 自动接管），遵循「新需求落地清单」红线 8。
