# 私密文件保险箱（fileVault）· 实现计划文档 + 任务清单

> 状态：执行中（① 核心闭环 + ② 自动锁定/命令面板 已完成；③ 备份红线+文档、小窗待做）
> 范围：个人本地加密存储敏感文件，复用现有 `vault/crypto.ts` 安全底座，不依赖云端 / AI / 付费接口。

---

## 0. 一句话结论

把文档 / 图片 / 证书 / 密钥等敏感文件**本地 AES-256-GCM 加密落盘**，解锁后才能查看、预览、导出。强复用项目既有安全架构（与密码保险库、2FA 同源），渲染端只经 IPC，绝不碰明文与主进程加密实现。

---

## 1. 加密设计（安全核心）

### 1.1 密钥层级（推荐「数据密钥 + 口令加密密钥」双层）

| 层 | 说明 | 存储位置 |
|---|---|---|
| `dataKey` | 随机 32 字节，加密每个文件用 | **仅驻留主进程内存**，不落盘 |
| `KEK` | `PBKDF2(password, salt, 200000, 32, sha256)` | 派生，不落盘 |
| `wrappedKey` | `AES-256-GCM(KEK, dataKey)` | 落库（`file_vault_config`） |
| 每文件 | `AES-256-GCM(dataKey, 随机IV, 文件字节)` | 密文落盘于独立目录 |

- 复用 `vault/crypto.ts` 的 `PBKDF2_ITERATIONS=200000` / `sha256` / `aes-256-gcm` 约定（与密码保险库、2FA 完全一致）。
- 改密码 = 仅重新 wrap `dataKey`，**无需重加密所有文件**（这是相对"每文件派生口令密钥"方案的核心优势）。
- 锁定 = 清零内存 `dataKey` + `vaultPass`，保留路径。

### 1.2 二进制加解密原语（需在 `vault/crypto.ts` 新增，不破坏现有 JSON 信封）

现有 `encryptVault/decryptVault` 只处理 JSON，需新增一对**操作原始字节**的函数（供文件用）：

- `encryptBytes(plain: Buffer, key: Buffer): { iv: string; ct: string }`  // iv 12B + ct(含16B GCM tag)
- `decryptBytes(env: { iv: string; ct: string }, key: Buffer): Buffer`

密文文件落盘格式：`[12B iv][ciphertext+16B tag]`，无 JSON 包裹，省去 base64 体积膨胀。

### 1.3 文件名隐私（⚠️ 待你拍板，见 §6）

| 方案 | 做法 | 代价 |
|---|---|---|
| **A 强隐私（推荐）** | `original_name` 也用 `dataKey` 加密，库里只存密文；列表只在解锁后由主进程内存解密返回 | 锁定态列表为空、搜索仅在解锁后可用 |
| B 简单 | `original_name` 明文存库 | 库泄露→文件名泄露（内容仍安全） |

---

## 2. 数据层（SQLite + 密文目录，均走 newSql）

- `file_vault_config`（key/value 风格，主键 `key`）：`key='vault'` → `salt` / `wrapped_key` / `version` / `created_at`。
- `file_vault_files`（主键 `id` uuid）：`id` / `name`(方案A加密) / `mime` / `ext` / `size` / `iv` / `tag` / `ciphertext_path` / `created_at`。
- **密文目录**：`path.resolve(getCachePath(), '渐离App保险箱')`，独立于 DB，大文件不进 SQLite。
- **预览临时目录**：`app.getPath('temp')/渐离App保险箱预览`，用完即清。

> 表自动创建/加列走 newSql 的 `query`/`upsert`（与 `passwordVault.ts` 用 `tableName` from `./store.ts` 同一套路）。

---

## 3. 主进程 `electron/main/module/fileVault.ts`（新增）

- 复用 `vault/crypto.ts`；`initFileVault()` 注册 IPC；内存态 `vaultKey(dataKey)` / `vaultPath` / `vaultPass`（lock 清内存保路径）。
- ⚠️ 改主进程 **必须重启 Electron**。

### IPC 通道（`file-vault:*`）

| 通道 | 入参 | 说明 |
|---|---|---|
| `set-password` | `{ password }` | 首次建库：生成 dataKey + salt + wrappedKey 落 `file_vault_config` |
| `unlock` | `{ password }` | 派生 KEK → 解 wrap 成功即密码正确 → dataKey 入内存 |
| `lock` | — | 清零 dataKey / vaultPass |
| `status` | — | `{ hasVault, isUnlocked }` |
| `list` | — | 元数据列表（解锁后主进程用 dataKey 解密文件名返回） |
| `import` | `{ sourcePath, name? }` | 读源文件→加密落盘→写元数据（原文件可选安全擦除） |
| `export` | `{ id, destDir }` | 解密写出目标目录 |
| `decrypt-temp` | `{ id }` | 解密到临时目录供预览，返回临时路径 |
| `cleanup-temp` | `{ id? }` | 清理临时文件（关闭预览/锁定时调用） |
| `delete` | `{ id }` | 删元数据 + 删密文 |

---

## 4. 渲染端 `src/views/fileVault/`（新增，按需拆组件）

- `index.vue`：两态（解锁 / 列表）。
- `types.ts`：元数据、状态、入参类型。
- `api/fileVaultApi.ts`：统一 `ipcRenderer.handlePromise('file-vault:*')` 薄封装（对齐 `passwordVaultApi.ts`）。
- `store/useFileVault.ts`：Pinia store（state + 动作，对齐 `usePasswordVault.ts`）。
- `components/`：
  - `UnlockView.vue`：首次设密 / 输入密码解锁（复用 `VaultGate.vue` 思路）。
  - `FileGrid.vue`：用全局 `VirtualList.vue` 渲染文件卡片网格（`@` 组件，不 import electron/*）。
  - `ImportDialog.vue`：选文件→加密导入。
  - `PreviewDialog.vue`：解密临时文件后预览（图片/PDF/文本，复用 `jlocal` 协议或 temp 路径）。
  - `AutoLock.ts`：复用密码保险库 `useAutoLock` 思路（失焦 + 页面隐藏 + 空闲触发 `lock` + `cleanup-temp`）。
- 复用全局组件：`AppDialog` / `VirtualList` / `LucideIcon`(`Shield`/`Lock`/`File` 等需登记 nameMap) / `fileProtocol`。

---

## 5. 集成点（全部对号入座，复用既有约定）

| 接入位置 | 文件 | 改动 |
|---|---|---|
| 路由注册 | `src/router/index.ts` | `RouteNames` 增 `FILE_VAULT: "fileVault"`；`layoutRouters` 增 `/fileVault` → `@/views/fileVault/index.vue` |
| 侧边栏入口 | `src/layout/index.vue:136` | `效率工具` 分组的 `names` 数组增 `'fileVault'` |
| 主进程初始化 | `electron/main/index.ts:164` | `import { initFileVault } from "./module/fileVault.ts"` 并调用 `initFileVault()` |
| 命令面板 | `src/views/commandPalette/sources/actionSource.ts` | 增一条跳转 action（`icon: 'LockKeyhole'`，对齐密码保险库） |
| 备份排除 | `electron/main/module/backup.ts` | `getExportModules` 里把 `file_vault_*` 加入**导出黑名单**（避免 .jlbak 泄露文件名，红线） |
| 小窗（可选） | `src/views/windowMode/config/windowSections.ts` + `useWindowMode` + 路由 + `newWindow.ts` | 四件套 + `mouseEvents:true`（参考 `habitMiniWindow`/`todoMiniWindow`） |

> 红线提示：改主进程须重启；备份不含 `file_vault_*`；文档须同步到 skill（见 §7）。

---

## 6. 待确认的两点（你拍板后开工）

1. **文件名隐私**：选 **A（加密，强隐私）** 还是 **B（明文，简单）**？（推荐 A）
2. **执行范围**：
   - 范围① 核心闭环（主进程加密+建表 / import·export·delete·预览 / 渲染端解锁·列表·导入·导出 UI）
   - 范围② 核心闭环 + 自动锁定 + 小窗
   - 范围③ 全量（含小窗 + 模块文档 + SKILL 导航同步）
   - （推荐先①，跑通后再扩②/③）

---

## 7. 文档同步（执行末段红线）

- 新增 `.workbuddy/skills/jianli-app/references/modules/file-vault.md`（模块说明）。
- 更新 `.workbuddy/skills/jianli-app/SKILL.md` 导航（新增「安全」分组条目）。

---

## 8. 风险与约束

- **忘记密码 = 不可恢复**（无后门，UI 显著提示）。
- 密文目录 Windows 权限；导出后明文及时清理；预览临时文件用后即删（锁定/退出触发 `cleanup-temp`）。
- 预览临时窗口期为明文，属固有风险，已用「用完即清」缓解。
- 主进程改动需重启 Electron 验证（建议用 `vue-tsc --noEmit` 校验类型零错误）。

---

## 9. 任务清单（Phase 拆分，勾选式）

### Phase 0 — 准备
- [ ] 确认方案（§6 两项拍板）
- [ ] 在 `vault/crypto.ts` 新增 `encryptBytes` / `decryptBytes`（原始字节AES-GCM）

### Phase 1 — 主进程核心闭环
- [ ] 新建 `electron/main/module/fileVault.ts`：`set-password` / `unlock` / `lock` / `status`
- [ ] 建表逻辑：`file_vault_config` / `file_vault_files`（走 newSql）
- [ ] `import` / `export` / `delete` 实现（加密落盘 + 元数据处理）
- [ ] `decrypt-temp` / `cleanup-temp`（预览临时文件）
- [ ] `electron/main/index.ts` 注册 `initFileVault()`

### Phase 2 — 渲染端 UI
- [ ] `types.ts` / `api/fileVaultApi.ts` / `store/useFileVault.ts`
- [ ] `index.vue` 解锁态 + 列表态
- [ ] `UnlockView.vue`（首次设密 / 解锁）
- [ ] `FileGrid.vue`（VirtualList 网格）
- [ ] `ImportDialog.vue` / `PreviewDialog.vue`
- [ ] 路由 + 侧边栏入口（§5）

### Phase 3 — 自动锁定 + 命令面板 ✅ 已完成（2026-09-01）
- [x] 将 `useAutoLock` 提升为共享 composable（`src/composables/useAutoLock.ts`，原 passwordVault 私有版已删除并改引用）
- [x] `fileVault/index.vue` 接入：解锁后启动监听，失焦/页面隐藏/空闲超时触发 `store.lock()`；工具栏新增「自动锁定」空闲阈值下拉（1/5/10/15/30 分钟，实时生效）
- [x] 打开原生对话框（导入/导出）时 `pause()`、关闭后 `resume()`，避免失焦误锁
- [x] 命令面板入口：路由 `FILE_VAULT` 已在 `layoutRouters` 内，`routeSource` 自动派生（搜索「保险箱 / fileVault」即可直达），无需在 `actionSource.ts` 重复登记
- [x] `vue-tsc --noEmit` 类型校验通过（0 错误）

### Phase 4 — 备份红线 + 文档 ✅ 已完成（2026-09-01）
- [x] `backup.ts` 新增 `EXPORT_EXCLUDE_PREFIXES = ["file_vault_"]` + `isExportExcluded()`：`getExportModules` 的 `otherTables` 不再枚举 `file_vault_*`；`runExport` 拒绝导出这些表（防御纵深）
- [x] 新增技能模块文档 `references/modules/file-vault.md`（职责 / 设计决策 / 文件结构 / IPC 契约 / 安全红线 / 自动锁定 / 命令面板 / 坑）
- [x] `SKILL.md` 导航「效率 / 提醒类」增补 `file-vault`（紧跟 `two-factor`）
- [x] `vue-tsc --noEmit` 类型校验通过（0 错误；主进程改动需重启 Electron 验证）

### Phase 5（可选）— 小窗
- [ ] `windowSections.ts` + `useWindowMode` + 路由 + `newWindow.ts` 四件套（`mouseEvents:true`）
