# 已知差异与风险（risks）

> 封装 / 开发前必读，避免踩历史雷。以下为代码探查时发现的与文档 / 规范不符或易错处。

1. **node 版本要求 `>=24.0.0`**：`package.json` `engines` 与 `check-node-version.js`（挂 `prestart`，每次 dev/build 拦截）统一要求 **24.x**，与 Electron 44 内嵌的 Node 24 对齐；`@types/node` 同步为 `^24.19.0`。CI（`.github/workflows/build.yml`）`actions/setup-node@v4` + `node-version: 24` + `cache: npm`。
   - ⚠️ `check-node-version.js` 只比较**主版本号**（`compareVersions(a.split('.')[0], b.split('.')[0])`），24.0.0 与 24.99.99 等价放行；写 23.x 会被拦。
   - ⚠️ **升级 Node 主版本后原生模块 ABI 失效**（`sqlite3` 等）：必须删 `node_modules` 重新 `npm install`，否则报 `NODE_MODULE_VERSION` 不匹配。
   - 注：Electron 内嵌 Node（运行时）与本机 Node（构建侧）是两回事，前者不可改。
2. **get-store typo**：`store.ts` 注册的是 `get-stort-all`（疑似拼写错误），调用方若用 `get-store-all` 将失效。
3. **双数据层已合并（2026-09-03）**：`module/sql.ts` 已删除，`newSql.ts` 为唯一连接池（启动按打包路径打开只读 `shiciDb` 并跳过 WAL）。渲染端旧通道 `query-data`/`set-data`/`delete-data` 早已迁移到 `new-sql:query`/`upsert`/`delete`；`utils/sql.ts` 仅留无独立连接的回调式辅助函数。新增业务一律走 newSql 三件套，语义差异：旧层 `whereStr`/`limit`/`orderBy` 塞 `conditions` 内，新层必须放顶层 options。详见 `data-layer.md`。
4. **死 / 未接通道**：渲染端 `invoke`/`send` 的 `save-file`、`get-file-list`、`save-debug-data` 在主进程未找到 handler（可能走 worker 或已废弃），封装前核实。
5. **new-sql:execute 仍存在**：危险通道代码层未移除，只靠规范约束——**永远不要调用**。
6. **遗留 / 未注册项**：`src/views/chart` 目录存在但未注册路由（疑似废弃）；`src/views/test.vue`、`src/demos/ipc.ts` 为调试残留；根 `功能清单.md` 为空占位。
7. **命令面板作用域耦合**：新增源需同时改 `REGISTRY`、`SCOPE_PREFIX_MAP`/`SCOPE_LABEL`/`TYPE_META`、`CommandType`、`SCOPE_PATTERN`，否则作用域不生效。
8. **小窗穿透**：新常驻小窗务必 `mouseEvents:true`，否则点不动 / 拖不动。
9. **Tab 内容面板勿用 `<transition mode="out-in">`**：`out-in` 离场动画结束后进入态 `transitionend` 不触发，新面板卡在 `opacity:0` → 点 Tab 后下方空白。多 Tab 页（homeMode / windowMode）改为直接 `v-if`/`:key` 渲染当前面板；切换动画要用就在子元素上做、不要包 `out-in`。
10. **顶部 Tab 复用 `TopTabs`**：多 Tab 页统一用 `src/smallComponents/TopTabs.vue`（单行不换行 + 滚轮横滚 + 滚动条仅 hover 显示），不要各页自写 tab 栏；其 `emit` 为 `string | number`，消费方需 `as` 回严格联合类型。

16. **待办已移除裸 `new-sql:execute`**：`index.vue`/`todoSource` 改为 `new-sql:query` + 客户端过滤，`TodoDetailDialog` 用 `new-sql:upsert`；新增待办逻辑一律走三件套，禁止 execute。
17. **重复任务引擎在主进程**：`electron/main/module/recurrence.ts` 的 `initRecurrence()` 在 `main/index.ts`（`initJob()` 之后）注册，改它或 `job.ts` 必须重启 Electron；生成实例写入 todo_list（recurrenceId/isRecurrenceInstance），默认列表隐藏模板。
18. **待办迷你窗(todoMiniWindow)已统一到新数据层**：原本地 `new-sql:execute` 全部替换为 `fetchAllTodos`/`saveTodo`（走 `new-sql:query`/`upsert`）；新增待办经 `normalize` 补全新模型字段，列表默认隐藏子任务(`parentId` 非空)与重复模板(`recurrenceRule` 非空且 `recurrenceId` 为空)，与主窗口默认行为一致。
19. **标签筛选/编辑改为 TagSelectPopover 多选**：`useTodo.tagFilter`(单值) 已改为 `tagFilters`(`string[]` 数组，或逻辑匹配)；筛选栏与 `TodoDetailDialog` 的标签编辑均复用新组件 `components/TagSelectPopover.vue`（el-popover 内彩色 chip 多选 + 底部新增标签）。日历视图点击日期改为 `el-popover`(`virtual-ref` 锚定日期格) 弹出当日列表，移除原下方常驻面板。

20. **upsert 依赖 key 列唯一索引（编辑变新增的根因）**：`newSql.upsert` 用 `ON CONFLICT(key)` 实现更新，但 `ensureTableExists` 原逻辑仅当「主键列不存在」时才建 UNIQUE 索引。重构前用裸 `execute` 建表的旧 `todo_list`/`todo_tags`，其 `key`/`id` 列**已存在却无唯一约束**，导致 `ON CONFLICT` 永不命中、upsert 退化为重复 INSERT——典型表现「编辑待办却新增一条」。已修复：`ensureTableExists` 改为「无论列是否存在都确保 UNIQUE 索引，失败时先按主键去重(保留最新一条)再重试」；并在 `main/index.ts` 启动时主动 `ensureTableExists('todo_list','key')` / `('todo_tags','id')` 清理历史重复。**改主进程必须重启 Electron 生效。**

21. **单一提醒引擎（2026-09-03 统一）**：原 newReminder（setTimeout）与 job.ts+recurrence.ts（cron）的待办截止提醒已统一为 newReminder 引擎——待办截止提醒写成 `reminders` 表 `source='todo'` 行由 `syncTodoReminders()` 调度，`get-tips` 已过滤系统行，`update-todo-reminders` IPC 现由 newReminder 监听。job.ts 仅留工作/休息定时器（`createJob`/`startJobFn`）。清理 todo 行走 `query` 列出 + `del`，**勿用 `new-sql:execute`**；`source`/`refKey` 列由 upsert 自动补，勿手动加列。改 newReminder/job.ts/recurrence.ts 均须重启 Electron。

22. **统一右键菜单已重构（2026-09-04）**：旧 HKLM CommandStore 级联 + HKCU 扁平 fallback + UAC `--register-shell-menu-elevated` 方案已废弃，改为 `shellMenu.ts` 按 `SUB_COMMANDS.exts` 逐扩展名写 HKCU（无需管理员）。`registerShellMenuElevated()` 现仅调 `registerShellMenu()`，无 PowerShell 提权、无参数拦截。新增动作 `open-reader` / `pdf-*`(5) / `batch-rename` 经 `app:cli-open` 按 `action` 分流到各模块 store；启用/默认打开集合存 `basic_info`，设置页 `fileRela/ShellMenuManager.vue` 管理。`CliItem.action` 已扩展为 10 种，渲染端 `App.vue` 的 `switch(action)` 必须随 `CliAction` 同步——新增 action 若漏加 case 会静默无响应（不报错但功能不触发）。改 `shellMenu.ts` / `index.ts` 须重启 Electron。

23. **右键菜单启用集合须迁移并集（2026-09-03 修复）**：`shellMenu.ts` 的 `getEnabledIds()` 曾原样把持久化 `basic_info.shellMenuEnabled` 当启用集合、无并集兜底，且模块级缓存；`registerShellMenu()` 循环 `if(!enabled.has(s.id)) continue` 会把不在集合内的命令整条跳过、不写注册表。若用户旧版持久化的是较小集合（如仅 3 个保险箱 id，或漏了后加的 `JianliApp.PdfCompress`），升级后该批新增命令右键菜单根本不出现、点击无反应（根因即「PDF 几个动作没触发」）。已修复：引入 `SHELL_MENU_SCHEMA` 版本标记 + `LEGACY_IDS`（传统 3 命令 `Encrypt/Decrypt/SecureDelete` 尊重旧开关，其余新增命令默认启用）做一次性迁移并写回 `basic_info`；`schema` 达标后完全信任用户开关（含其手动关闭的新命令，重启不再被恢复）。**新增右键动作时务必把 id 加进 `SUB_COMMANDS`**；若属「新增命令」须在 `getEnabledIds` 迁移分支默认启用，并视情况把 `SHELL_MENU_SCHEMA` +1，否则旧存档会漏注册。改 `shellMenu.ts` 须重启 Electron 才会重跑 `registerShellMenu()`。

24. **迁移写回禁用 `upsert`（嵌套事务坑，2026-09-04 修复）**：`getEnabledIds()` 的迁移写回最初用 `newSql.upsert`（`upsert` 强制 `BEGIN TRANSACTION`），而它在启动期 `registerShellMenu()` 第一次调用时就触发，与当时尚未提交的初始化事务在共享单连接上交错 → `SQLITE_ERROR: cannot start a transaction within a transaction`（异步 Promise reject 且 `try/catch` 抓不到，表现为 `Unhandled rejection`）。已改为裸 `db.run('INSERT OR REPLACE INTO basic_info (key,value) VALUES (?,?)')`（无 `BEGIN`，并入已有事务随其提交），并抽 `saveBasicInfoKV()` 复用于 `shell-menu:set-default-open`。教训：**绝不在启动注册热路径用 `upsert` 写回**；任何 basic_info 元信息写回若可能在启动期发生，都用单行非事务写。`dist-electron` 改动须重新 `vite build` 才生效。

25. **注册后须通知 Explorer 刷新外壳缓存（2026-09-04 新增）**：`registerShellMenu()` 末尾调用 `notifyShellRefresh()`（powershell P/Invoke `SHChangeNotify(SHCNE_ASSOCCHANGED)`）让资源管理器重新加载 shell 关联，否则新注册/取消的右键菜单项需手动重启资源管理器才显示。该调用 fire-and-forget + `try/catch` 包裹，失败不影响注册本体。

26. **应用锁 2FA 门禁（2026-09-04 新增）**：解锁已升级为两步——`app-lock:unlock` 密码步通过且门禁启用时**不解锁**，返回 `{need2fa, token}` 待验证会话（120s TTL、绑定 `sender webContents.id`），渲染端 `AppLockTotpStep.vue` 凭 token 调 `app-lock:verify-2fa` 提交 TOTP/恢复码。门禁密钥独立存 `basic_info(appLock2faVault)`（AES-GCM 信封、**用应用锁密码加密**），与 2FA 保险库完全解耦（勿再往 `twoFactor.ts` 保险库里塞门禁密钥——启动锁定时保险库未打开会死锁）。新增/改动主进程文件 `appLock2fa.ts` 与 `appLock.ts` 须重启 Electron；渲染端 `useAppLock.unlock()` 返回值已从 `boolean` 改为对象 `{matched, need2fa, token, remainingAttempts, retryAfterSeconds}`。
27. **改应用锁密码必须传 `current`**：门禁信封用应用锁密码加密，`app-lock:set-password` 在门禁启用时要求 `params.current`（先验旧密码再用新密码 `rewrap2fa` 重加密信封），缺参会报错；渲染端修改模式已自动携带。**冷却计数已移到主进程**（`appLock2fa.ts` 内存变量，密码步+动态码步共用，错 5 次冷却 30s，跨渲染端刷新有效、应用重启清零），`AppLock.vue` 旧纯前端 failCount 冷却已删除——勿再在渲染端自建计数。门禁相关 UI（向导二维码）走 `QrCodeView` 内联渲染，遵守「otpauth URI 不进 qr_history」红线。

28. **常驻页 `deep:true` watch + 秒级时钟 = 持续主线程开销（2026-09-28 修复，表现为主页快速移动鼠标偶发卡顿）**：`useGlobalSetting.ts` 的 `idleNow` 原为 1s `setInterval`，逐级驱动 `isIdleNow` → `activeHomeModeKey`；而 `home/index.vue` 与 `components/importSmallComponents.vue` 的 watch getter 都依赖这些 computed 且带 `deep: true`，导致**每秒**对 `homeMode[key]`（含 `widgets`/`style`/`mode` 深层对象）做完整递归遍历，`importSmallComponents` 的 handler 还每次 `JSON.parse(JSON.stringify(整个 homeMode))` 全量深拷贝并重渲染。修复：`idleNow` 间隔 1s→15s（判定精度只到分钟，见 `utils/idleTime.ts`）；两处 watch 去掉 `deep:true` 并改监听浅值（`home/index.vue` 的 getter 改返回原始值 `value`，避免 `|| {}` 字面量浅比较恒不等）；删除相关 `console.log`。**约定：`deep:true` 禁止与「依赖秒级时钟的 computed」搭配；watch getter 禁止返回新造的对象/数组字面量**（浅比较恒不等 ⇒ handler 空转）；`homeMode` 的写入均为整体替换引用，浅比较足够。另修 `newSql.ensureTableColumns` 无缓存问题（每次 upsert 白跑 `sqlite_master` + `PRAGMA table_info` 2 次元数据 IO），加 `ensuredColumnSets` 缓存（表名|主键|列签名），结构变更时不写缓存。详见 `modules/home.md` 的「性能红线」。**`newSql.ts` 改动须重启 Electron。** 排查方法：「一直存在 + 仅在某些页面出现 + 近期提交后出现」→ 先 `git log --since` 圈定时间窗，再 `git show --stat` 找改动密集文件，最后 `git log -S "<可疑标识符>"` 定位引入/改动点，比全仓盲搜高效得多。

29. **后台轮询守卫必须「先廉价后昂贵」，且四次踩坑都源于「想当然」（2026-09-28 修复「鼠标快速移动卡顿」）**：用户反馈「停留 home 页也会卡」「一周前不卡」，而 home 近期无改动 ⇒ 真凶在主进程 + 数据层。**用户自己给出了判定症状：剪贴板最近一条记录是文本时不卡，是图片时就卡** —— 这是本类问题极好用的症状指纹。
   - **根因（同步阻塞）**：`clipboard.ts` 的 `startClipboardMonitor` 守卫是 `!hasText || text === lastClipboardText`，而**剪贴板里停留一张图片时 `readText()` 恒为空**，故每轮都进图片分支跑 `availableFormats()` → `readImage()` → **`toDataURL()`**（完整 PNG 编码）。这些都是**同步 OLE 剪贴板调用**，直接阻塞主进程事件循环，鼠标输入随之卡顿——**与停在哪个页面无关**。
   - **四次修正，全部是「想当然」的代价**：
     - v1：把**廉价的指纹比对放在昂贵的 `toDataURL()` 之后** ⇒ 每轮白编码再丢弃；
     - v2：加 `clipboard.getChangeCount()` 序列号守卫，但 **Electron 36.9.5 的 `clipboard` 模块根本没有这个 API**。`electron.d.ts` 未声明；搜 `electron.exe` 二进制时 `ChangeCount` 仅以 Chromium **媒体指标名**出现（`WebContentsAutoScaler::…ScaleOverrideChangeCount` / `MediaRecorder.TrackTransformationChangeCount`）。**当时用类型断言把 TS2339 绕过去了 —— 绕过报错 ≠ API 存在**，运行时取到 `undefined` ⇒ 守卫恒失效但表面像"已优化"；
     - v3：改用 `readBuffer('image/png')` 当廉价指纹，**但它并不廉价**：Windows 剪贴板图片通常是 **DIB/Bitmap 而非 PNG**，没有原生 PNG 数据时 `readBuffer` 会**内部临时编码成 PNG** ⇒ 编码又被加回来。当时"0.128ms"的测算是用 **Node Buffer 拷贝**类比出来的，**完全没算 OLE 读取与隐式编码**；
     - v4（现行）：`getSize()` + `toBitmap().length`（`宽x高:位图字节数`），两者都不触发任何编码。不只用尺寸是因为同尺寸的不同截图会碰撞 → 漏记录。
   - **正确解法（四层守卫，顺序不可调整）**：`readText()` → `availableFormats()` → **`cheapImageKey()`（不编码）** → 仅新图片才 `toDataURL()`。
   - **缓存 stale 约定**：剪贴板切成纯文本、或文本分支落库成功时，**清空**图片两个缓存；启动预热因库里是 dataURL 无法反推原始位图，`lastImageCheapKey` 留空（首次多编码一次）；`lastImageCheapKey` 仅在成功落库后刷新；`cheapKey` 为空时回落到昂贵指纹兜底去重。
   - **根因 B（表无索引 + 全表扫描）**：`clipboard_history` 只靠主键索引，而列表分页/启动预热均按 `create_time DESC, id DESC` 排序 ⇒ 全走 `SCAN` + `USE TEMP B-TREE FOR ORDER BY`。库涨到 **121MB / 2.6 万行**后实测：列表 **444ms**、去重查找 **445ms**、启动预热 **107ms**。加 `idx_clipboard_create_time` 后 → **15ms / 16ms**（约 30 倍）。这正是「一周前不卡」的解释：**表在长，扫描成本线性上涨**。
   - 附带修复：列表查询 `SELECT *` → 只取渲染端真正消费的 7 列（`rtf`/`bookmark`/`findText` 前端从未读取却每次过 IPC）；新增 `MAX_TEXT_LENGTH`（512KB 截断，库里出现过 **7.3MB 单条 text**）且超 8KB 跳过文本合并查找；`newSql.ts` 的 WAL `wal_autocheckpoint` 1000 页(4MB) → 6000 页(≈24MB)。渲染端 `clipboardFormat.ts` 的 `splitByKeyword` 加 `PREVIEW_CHAR_LIMIT`(20000) + `MAX_SEGMENTS`(300)——卡片折叠用 `max-height`+mask，**DOM 节点仍真实存在**，7.3MB 文本配关键词搜索会切出上万 `<span>` 卡死渲染进程。
   - **另有一个易漏的第二轮询器**：`download/downloadInterceptor.ts` 的 `startClipboardMonitor()` 也跑 **1s** 轮询（由 `download/index.ts` 的 `initDownloader()` 启动）。它只做 `readText()`（较轻），但改剪贴板逻辑时必须记得它的存在。
   - **通用教训**：① 「便宜的判断」永远排在「昂贵的操作」之前；② 长驻 `setInterval` 必须先做 O(1) 的「本次是否有变化」判断；③ **不要用类型断言绕过 TS 报错来"创造" API** —— 绕过报错 ≠ API 存在，必须搜二进制符号 / 写最小复现验证；④ **不要用「等价模拟」证明性能假设** —— Node Buffer 拷贝 ≠ OLE 剪贴板读取，`readBuffer(mimeType)` 的代价取决于剪贴板是否真有该 mimeType 的原生数据；⑤ 排序列没有索引 = 每次全表排序，**这类问题会随数据增长从"不卡"恶化到"卡"**，排查务必实测真实库；⑥ 剪贴板监听是本项目最容易埋卡顿的地方，改 `clipboard.ts` 须重启 Electron。

## 维护建议
- 每次大改动后更新对应 `references/modules/*.md` 与 `risks.md`，保持 skill 与代码同步。
- skill 内容会随代码演进过时，把它作为「项目知识基线」，发现不符就改。

## 环境与包管理器（2026-09-29 迁移）

30. **包管理器已从 cnpm 迁到原生 npm（2026-09-29）**。「项目只支持 cnpm」是三重历史遗留造成的假象，**并非真实限制**，耦合点已全部解除：
    - `check-node-version.js` 曾硬编码「请使用 cnpm 安装依赖包」文案（挂 `prestart`，每次 dev/build 都打印，是印象的主要来源）→ 已改为 npm 文案。
    - `.gitignore` 曾把 `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` **三个 lockfile 全部忽略** → 现**放行 `package-lock.json`**（**锁文件必须提交**，这是依赖可复现的根本）、忽略 `pnpm-lock.yaml` 与 `yarn.lock`。
    - `package.json` 的 `scripts` 保持 `npm run xxx` 嵌套（npm 下本就正确，无需改动）。
    - `increase-memory-limit`：它扫 `node_modules/.bin` 注入 `--max-old-space-size`，**npm 扁平布局下工作正常**，故 `build` 脚本保持原样调用它。
31. **`sqlite3` 装不上 = 下载被墙 + `node-gyp@8` 不支持新 Node（2026-09-29 二次定位，最终解法：升 sqlite3@6.0.1）**：`npm install` 报
    ```
    prebuild-install warn install read ECONNRESET
    gyp ERR! find VS Could not find any Visual Studio installation to use
    ```
    **两个独立原因叠加**，只解决第一个不够：
    - **原因① 下载被墙（表层）**：`prebuild-install` 从 GitHub Releases 下预编译包被 ECONNRESET 打断 → 走 install 脚本里的 `|| node-gyp rebuild` 回退本地编译 → 本机没有 VS C++ 工具链 → 失败。cnpm 之所以"能用"是因为它内置二进制镜像加速。
    - **原因② `node-gyp` 版本与 Node 不匹配（深层，之前漏掉）**：`sqlite3@5.1.7` 的 `optionalDependencies` **和** `peerDependencies` 都钉死 `node-gyp: "8.x"`，而 **`node-gyp@8` 只支持到 Node 18**。所以报错里会出现 `gyp info using node@24.18.1 ... node-gyp@8.4.1` —— 这个组合本身就是坏的，**即使下载成功也白搭，一旦回退编译必失败**。
    - ✅ **最终解法（已落地）**：`sqlite3` 从 `^5.1.7` 升到 **`^6.0.1`**。对比：

      | | `sqlite3@5.1.7` | `sqlite3@6.0.1` |
      |---|---|---|
      | 绑定 `node-gyp` | **`8.x`**（≤ Node 18） | **`12.x`**（`^20.17.0 \|\| >=22.9.0`，含 Node 24）|
      | `engines.node` | 未声明 | `>=20.17.0` |
      | 官方 CI 覆盖 Node | 18 / 20 / 22 | **18 / 20 / 22 / 24** |
      | `node-addon-api` | `^7.0.0` | `^8.0.0` |
      | `prebuild-install` | `^7.1.1` | `^7.1.3` |

      ⇒ **无需安装 Visual Studio**，官方 6.x 已覆盖 Node 24。API 无破坏性变更（仍是 `new sqlite3.Database()` / `verbose()`，仍支持 CJS `require` / 默认导入），代码零改动。
    - **镜像配置**：`sqlite3_binary_host=https://registry.npmmirror.com/-/binary/sqlite3`（**不要**写项目级 `.npmrc`，见第 33 条；写 shell 环境变量或用户级 `~/.npmrc`）。
    - **键名规则（实证自 `prebuild-install@7` 的 `util.js: getEnvPrefix()`）**：它读的是
      `npm_config_<包名>_binary_host` **或** `npm_config_<包名>_binary_mirror`（包名中非字母数字字符替换为 `_`）。
      **所以每个原生模块必须单独配一行**，形如 `<包名>_binary_host=...`。
      ⚠️ 写成 `prebuild_install_mirror` / `node_pre_gyp_mirror` 这类**全局键是无效的**（已实测返回 `undefined`，会回落 GitHub）。
    - **URL 拼接**：`<host>/{tag_prefix}{version}/{name}-v{version}-{runtime}-v{abi}-{platform}{libc}-{arch}.tar.gz`。
      镜像前缀是 `/-/binary/`（**不是** `/mirrors/`）。`v6.0.1-napi-v3/v6-win32-x64` 与 `v5.1.7` 同名文件均实测 HTTP 200 + 有效 gzip。
      **校验手法**：镜像的 napi-v3 包 sha256 与 GitHub 官方 Release 页公布的 `b0c4734551c661f8...` **完全一致**，证明镜像是官方同步的真包。
    - **`target=undefined` 的成因（源码级确认，别误判）**：`prebuild-install@7.1.3` 的 `rc.js` L50 判断
      `if (napi.isNapiRuntime(rc.runtime) && rc.target === process.versions.node) rc.target = napi.getBestNapiBuildVersion()`；
      只有 `target === process.versions.node` 才会推导出 napi 版本。若 `target` 变成字符串 `"undefined"` 就跳过推导，`abi` 也成了 `"undefined"` → 报 `does not support N-API version undefined`。
      **该值只可能来自 `npm_config_target=undefined`（字符串）或命令行 `--target=undefined`**，不是 npm 默认行为。本次报错**不影响最终解法**（升级 sqlite3 后走预编译包，压根不进这条路径）。
    - **新增原生模块时**，查镜像目录 `https://registry.npmmirror.com/-/binary/<包名>/` 确认文件名与 `v<版本>/` 路径，再补一行。
32. **`.npmrc` 注入的环境变量带 `npm_config_` 前缀（实测确认）**：经 `npm run`/`npm exec` 执行的子进程能拿到 `npm_config_xxx`，直接 `node xxx` 则拿不到。**推论**：任何只读无前缀环境变量（如 puppeteer 的 `PUPPETEER_DOWNLOAD_BASE_URL`、`PUPPETEER_SKIP_DOWNLOAD`）的工具，**在 `.npmrc` 里配置无效**，必须在 shell 里 `set` 后再执行 npm。
33. **`.npmrc` 关键项（npm 版，2026-09-29 二次修定）**：**项目级 `.npmrc` 现在只留 `registry=https://registry.npmmirror.com`**。
    - ⚠️ **不要**在项目级 `.npmrc` 写 `electron_mirror` / `electron_builder_binaries_mirror` / `sqlite3_binary_host` 等**自定义键** —— npm 11 起会报
      `npm warn Unknown project config "xxx". This will stop working in the next major version of npm.`
      这些键**从来不是 npm 的配置项**，而是 electron / prebuild-install / node-pre-gyp 的**环境变量**（读 `process.env`）；旧版 npm 对未知键"
      沉默地"注入 `npm_config_xxx` 环境变量，顺手实现了镜像用途。npm 11 起警告并将在下个大版本**移除该注入行为**。
    - **镜像的正确落点（已改好）**：
      - 运行时 Electron 二进制 → `electron-builder.json5` 的 **`electronGet.mirrorOptions.mirror`**；
      - 原生模块预编译包 → **shell 环境变量**，或**用户级 `~/.npmrc`**（`C:\Users\<你>\.npmrc`）。**用户级不触发该警告**（npm 只对项目级的未知键报警），且全局生效；
      - puppeteer → 只能在 shell `set`（见第 32 条，它读无前缀变量）。
    - ⚠️ **`electron-builder.json5` 里不存在 `electronMirror` / `electronBuilderBinariesMirror` 这两个字段**（已查 `app-builder-lib` 的 `configuration.ts` 与 `scheme.json` 确认；`Configuration` 接口里**没有任何含 "Mirror" 的属性**）。正确字段是 `electronGet: { mirrorOptions: { mirror } }`（`ElectronGetOptions` 直接透传给 `@electron/get`）。
    - ⚠️ **`.npmrc` 里 `key[]=...` 是错的**：`key` 是 npm **已存在的内置配置项**（TLS 客户端密钥，与 `cert` 配对），不是"自定义键容器"。
      实测后果：`key` 被解析成数组、触发 `npm warn config key 'key' and 'cert' are no longer used...`，
      并且 `npm exec` 会因把数组当密钥读而报 `ERR_OSSL_UNSUPPORTED`（OpenSSL DECODER routines::unsupported）。
    - **不要**添加 pnpm 专属项（`shamefully-hoist` / `hoist-pattern` / `enable-pre-post-scripts`）或 `legacy-peer-deps`（后者跳过 peer 校验、掩盖真实版本冲突）。
34. **曾短暂试验 pnpm 的方案（备查，未采用）**：用户评估后选定**原生 npm**。若将来重新考虑 pnpm 需处理：① pnpm 10 默认禁止依赖跑 postinstall，`sqlite3`/`puppeteer`/`sherpa-onnx-node`/`clipboard-event`/`font-list`/`say` 会静默缺二进制，须在 `pnpm-workspace.yaml` 声明 `onlyBuiltDependencies`；② `increase-memory-limit` 会改坏 `.bin` 符号链接（须改用 `NODE_OPTIONS`）；③ 需 `shamefully-hoist=true` + `hoist-pattern[]=*`（electron-builder 收集依赖必需）。
35. **Electron 二进制下载慢 → 走镜像（实测 16 倍差距，2026-09-29）**：首次 `npm install` / `npm run dev` 要下 **~116MB** 的 Electron zip。
    - **实测同网络对比**：GitHub 官方 **372 KB/s**（约 5 分 20 秒）vs npmmirror 镜像 **5.9 MB/s**（约 20 秒）。
    - **`@electron/get` 的镜像读取链（源码级，`artifact-utils.ts: mirrorVar()`）**：
      `npm_config_electron_mirror` → `NPM_CONFIG_ELECTRON_MIRROR` → `npm_config_electron_<snake>` → `npm_package_config_electron_*` → **`ELECTRON_MIRROR`** → `options.mirror` → 默认 GitHub。
      ⇒ **`.npmrc` 写 `electron_mirror` 是有效的**（它确实读 npm 注入的变量），`electron-builder.json5` 的 `electronGet.mirrorOptions.mirror` 对应最末的 `options.mirror`。
    - **URL 拼接**：`<mirror><version>/electron-v<version>-<platform>-<arch>.zip`（镜像上**不需要** `v` 前缀，带与不带都实测 HTTP 206）。
    - **镜像真伪校验**：镜像上 `SHASUMS256.txt` 可读且与官方值一致，可用来核对下载完整性。
    - **配置落点**：写**用户级 `~/.npmrc`**（不出警告、全局生效）；临时覆盖用 shell `set ELECTRON_MIRROR=...`（优先级高于 `.npmrc`）。
    - **断点续传**：内置 `npm run fetch-electron`（`scripts/fetch-electron.cjs`），走 `curl -C - --retry 10 --retry-all-errors`，中断后重跑接着下。
    - **缓存位置**：`%LOCALAPPDATA%\electron\Cache\<url 的 sha256>\electron-v<版本>-<platform>-<arch>.zip`（按 URL 哈希分目录，换镜像会导致目录不同）。
36. **electron 相关依赖升级后的版本基线（2026-09-29）**：`electron@^44.4.5`、`electron-builder@^26.17.0`、`electron-store@^11.0.2`、`vite-plugin-electron@^1.1.2`、`electron-log@^5.4.4`、`electron-devtools-installer@^4.0.0`、**`sqlite3@^6.0.1`**（原 `^5.1.7`，为支持 Node 24 而升，见第 31 条）。**`vite-plugin-electron-renderer` 已移除**（1.0.0 起零依赖零 peer，是空壳；`vite.config.ts` 里原 `renderer: {}` 本就是空对象）。注意：
    - `electron-builder` 的 npm `latest` 标签曾停在 `26.15.3`（发布流水线问题），**真实最高稳定版看 `v26` dist-tag**，查版本别只信 `latest`。
    - `electron-store@11` 是**纯 ESM**（`conf@15` → `dot-prop@10`），dev 若报 `ERR_REQUIRE_ESM` 需处理；`vite.config.ts` 的 `optimizeDeps.include: ['electron-store']` 必须保留。
    - Electron 36 → 44 跨 8 个 Chromium 大版本，**重点回归** `features/ebook`（epubjs / pdfjs 的 webview 渲染）与 `features/browser`（多标签 WebView）。
    - 未来若升 **Vite 8**，`vite.config.ts` 需把 `build.rollupOptions` 改为 `build.rolldownOptions`（vite-plugin-electron v1 迁移要求）；当前 Vite 6 继续用 `rollupOptions`。
37. **`vite.config.flat.txt` 是无效文件**：它是从 `vite-plugin-electron` 官方模板拷来的「flat API」参考备忘（后缀 `.txt`，不被 Vite 加载），内部 import 了**已移除的** `vite-plugin-electron-renderer`。勿被它误导；实际配置是 `vite.config.ts`（使用 `vite-plugin-electron/simple`）。
38. **排查此类「装不上」问题的通用方法（值得复用）**：不要停留在「报错就说环境不行」，要**顺着失败链路定位到可验证的真相**：
    ① 从报错首行找**分叉点**（此处是 `prebuild-install X || node-gyp rebuild` 的 `||`，说明下载失败才转编译）；
    ② 解包目标 npm 包**读源码**（`curl <pkg>.tgz` → gunzip → 手工解 tar → 读 `util.js`/`rc.js`）确认它**真正读哪个键名/环境变量**，别照抄博客；
    ③ 用镜像的**目录列表 API**（`https://registry.npmmirror.com/-/binary/<pkg>/<ver>/` 返回 JSON）确认**真实文件名**，别凭模板猜（本例漏了 `sqlite3-` 前缀导致误判 404）；
    ④ 用 `curl -I -L` **实测 HTTP 200** 而非假设；
    ⑤ 写探针脚本**实测环境变量注入**，而非推断 npm 的行为。
    ⑥ **听到一个说法先想"它是不是本来就是别人的东西"** —— 本次「`key[]=` 能当自定义键容器」的推断，错在没先查 `key` 在 npm 里是否**已存在**（它是 TLS 密钥项）。**已存在的内置键不能借用**，借用代价是静默改语义或报错。同类：`electron_builder_binaries_mirror` 我先假设是 electron-builder 的 config 字段，实际它只是环境变量、config 里根本没有该键。
    ⑦ **报错里的"版本不匹配"要当成一等线索**：本次真正卡死的是 `gyp info using node@24.18.1 ... node-gyp@8.4.1`——一眼可见 `node-gyp@8` 不可能支持 Node 24。查包的 `optionalDependencies`/`peerDependencies` 就发现 `sqlite3@5.1.7` 把 `node-gyp` 钉在 `8.x`。**顺带教训：只修「下载镜像」是治标**（表层 ECONNRESET），**要往下一层看「回退路径本身是否可行」**。
    ⑧ **优先"升级依赖"而不是"装工具链"**：用户诉求是「不装 VS 也能解决」。正解不是绕开本地编译，而是**升到官方已支持目标 Node 的版本**（sqlite3 6.x 的 CI 矩阵含 Node 24）——比装 6GB VS Build Tools 干净得多。评估时**去查上游 CI 矩阵 / `engines` / Release Notes**，那是"官方是否支持某运行时"的最硬证据。
    ⑨ **校验镜像真伪用哈希对账**：拿镜像包 sha256 跟 GitHub 官方 Release 页公布的比对（本次 napi-v3 完全一致），远比"能下载"更能证明是官方同步包。
39. **⚠️ Electron 44 把 `clipboard` 整个重写成 W3C 异步 API（2026-09-29 迁移完成，**必读**）**：
    - **破坏面**：`interface Clipboard` 只剩 **7 个成员**（`clear` / `has` / `read` / `readText` / `write` / `writeText` / `selection`），
      **旧的同步 API 一个不剩全部移除**（已逐个搜 `electron.d.ts`，0 命中）：`readImage` / `writeImage` / `availableFormats` /
      `readBuffer` / `writeBuffer` / `readHTML` / `writeHTML` / `readRTF` / `writeRTF` / `readBookmark` / `writeBookmark` /
      **`readFindText` / `writeFindText`** / `hasImage`。
      ⇒ **`readText()` 现在返回 `Promise<string>`**。旧代码 `clipboard.readText().trim()` 会得到
      `TypeError: text.trim is not a function`（Promise 上没有该方法）——**这正是本次运行时崩溃的根因**。
    - **兼容层**：`electron/main/module/utils/clipboardCompat.ts`（**新增，唯一入口，勿绕过**）。
      业务侧只需「加 await + 换函数名」，旧调用形式基本保留：
      | 旧 | 新 |
      |---|---|
      | `clipboard.readText()` | `await readClipboardText()` |
      | `clipboard.writeText(t)` | `await writeClipboardText(t)` |
      | `clipboard.readImage()` | `await readClipboardImage()`（**无图时返回空 NativeImage，`isEmpty()` 语义不变**）|
      | `clipboard.writeImage(img)` | `await writeClipboardImage(img)` / `await writeClipboardImageFromPng(pngBuf)` |
      | `clipboard.availableFormats()` | `await readClipboardFormats()` |
      | `clipboard.write({text,html})` | `await writeClipboardRich({text,html})` |
      | `clipboard.readHTML()` / `readRTF()` | `await readClipboardHtml()` / `readClipboardRtf()` |
      | `clipboard.readBookmark()` | `await readClipboardBookmark()`（无书签返回 `{title:'',url:''}`，**不抛错**，保持旧语义）|
      | `clipboard.readFindText()` | **已移除** → 用 `""`（DB 列保留，值恒空）|
    - **性能反转（重要）**：旧 `writeImage(nativeImage)` 同步、内部零拷贝；新 API 只能
      `clipboard.write([new ClipboardItem({ 'image/png': Blob })])`，**必须先把图编码成 PNG**。
      故兼容层提供两条路径：**手里已有 PNG 字节就走 `writeClipboardImageFromPng()`（零重复编码）**，
      只有 NativeImage 时才用 `writeClipboardImage()`（内部 `toPNG()`，数 MB 图约 10–50ms 阻塞主进程）。
      截图 / 二维码链路的数据源本来就是 PNG dataURL，全部走前者（见 `bufferFromDataUrl()`）。
    - **⚠️ 三个类型坑（都在兼容层文件里写了注释，别重踩）**：
      1. **`ClipboardItem` 同名冲突**：项目 tsconfig 带 `lib:["ESNext","DOM"]`，DOM 也有 `ClipboardItem`；
         直接用全局名会解析成 **DOM 版**，与 `clipboard.write()` 要求的 `Electron.ClipboardItem` 不兼容
         （DOM 版 `getType()` 返回 `Promise<Blob>`，Electron 版可返回 `ClipboardBookmark`）。
      2. **★ `ClipboardItem` 在 Electron 主进程里不是全局，必须从 `'electron'` import（2026-09-29 二次修正，
         曾因此线上崩溃，务必记住）★**：
         - **踩坑经过**：初版误以为「Node 18+ 内置全局 `ClipboardItem`」，直接裸用全局名。
           **类型检查通过、构建通过**，但运行时报
           `ReferenceError: ClipboardItem is not defined`（`dist-electron/main/index-*.js` 顶层求值即抛，
           **整个主进程起不来**）。
         - **根因**：`ClipboardItem` 是 **Web/浏览器**全局，**不是 Node 全局**，Node 18+ 并未内置它；
           Electron 主进程也**没有**把它挂到 `globalThis` 上。
           「编译能过」是因为**类型空间里恰有 DOM 的 `ClipboardItem`** ——
           **典型陷阱：类型存在 ≠ 运行时有值**（与第 29 条 v2 的 `getChangeCount` 同源）。
         - **实测结论（真实 Electron 44 主进程，逐个 `typeof` 过）**：
           ```
           globalThis.ClipboardItem              → undefined   ✗
           globalThis.clipboard                   → undefined   ✗
           require('electron').ClipboardItem      → 'function'  ✓   ← 唯一正确来源
           require('electron') 的 clipboard 相关键 = ['clipboard', 'ClipboardItem']
           ```
           用法：`import { clipboard, ClipboardItem } from 'electron'`，
           再断言成构造签名 `as unknown as new (items) => Electron.ClipboardItem`。
         - **为什么 `'electron'` 里有**：`electron.d.ts` 的 `namespace CrossProcessExports` 内声明了
           `class ClipboardItem extends Electron.ClipboardItem {}`（L26709），
           并由 `declare module 'electron' { export = Electron.CrossProcessExports; }`（L27164）暴露。
           ⚠️ 注意 `declare namespace Electron` 里那个 `class ClipboardItem`（L7045）**只是类型**，
           但那不代表运行时没有 —— 别据此推断"不能 import"（这正是初版误判的原因）。
         - **已加兜底**：`makeClipboardItem()` 在 `typeof ClipboardItemCtor !== 'function'` 时
           打日志并返回 null（调用方安全降级）。**目的是别再把主进程整体打挂** ——
           最坏只是「写图片/富文本失效」，而不是白屏启动失败。
         - **同类排查结论（一并实测）**：主进程里 `Blob` / `File` / `FormData` / `fetch` / `Request` /
           `Response` / `TextEncoder` / `URLSearchParams` / `structuredClone` / `crypto` **全部存在**，
           **只有 `ClipboardItem` 缺失**。故 `netRequest.ts` 的 `new Blob([buf])` 是安全的，无需改动。
      3. **`Buffer` 不是合法 `BlobPart`**：`Buffer.buffer` 可能是 `SharedArrayBuffer`；且 TS 5.7+ 的
         `Uint8Array<TArrayBuffer>` 泛型下，`new Uint8Array(n)` 推成 `ArrayBufferLike`（不合格）、
         `new Uint8Array<ArrayBuffer>(n)` 又被当「参数是 ArrayBuffer」而报错。
         ⇒ 唯一稳妥写法：先 `new ArrayBuffer(n)`，再 `new Uint8Array(buffer).set(src)` 包装。
    - **📌 验证这类「运行时全局/导出是否存在」的方法（可复用）**：写一个探针脚本用真 Electron 跑，
      **必须 `unset ELECTRON_RUN_AS_NODE`**（本环境该变量默认为 `1`，会让 Electron 退化成纯 Node 模式：
      `require('electron')` 返回**路径字符串**、`app` 为 `undefined`，得到全是假阴性）。
      ```bash
      cd C:/cod/jianli/jianli-app && unset ELECTRON_RUN_AS_NODE && \
        ./node_modules/electron/dist/electron.exe "C:/cod/jianli/jianli-app/_probe.mjs"
      ```
      探针要放在**项目目录内**（否则解析不到 `electron` 模块）；用 `app.whenReady()` 包住逻辑。
    - **⚠️ 轮询异步化的新风险 = 重入**：`setInterval` 不等 async 回调完成就进下一轮。
      若单轮因 PNG 编码 + DB 写入耗时超过间隔，两执行流会并发读写状态缓存 → **同条内容记两次**或**缓存被覆盖丢写入**。
      解法（`clipboard.ts` / `downloadInterceptor.ts` 均已落地）：**`busy`/`polling` 重入锁**
      （单轮未结束直接跳过本轮；状态是「读到才更新」，天然幂等可重试，内容不会丢）+
      外层 `try/catch/finally`（保证异常不停摆、锁必然释放）。
      **四层守卫链的 await 顺序一字未改**，第 3 层「廉价指纹不编码」的经济性完整保留（见第 29 条）。
    - **`findText` 处理**：`clipboard.ts` 的 `const findText = clipboard.readFindText()` → `const findText = ""`。
      按约定「保留 DB 列、采集值置空」——它是 macOS 搜索框专用，Windows 上历史基本恒空，
      删列涉及旧库迁移风险，不值得。
    - **改动清单（21 处 / 8 文件）**：`preload/index.ts`(2)、`download/downloadInterceptor.ts`(1)、
      `passwordVault.ts`(2)、`qrcode.ts`(1)、`remoteControl.ts`(1)、`screenshot.ts`(4)、
      `clipboard.ts`(10)、`noteSlip.ts`(1)。
      注意 `noteSlip.ts` 原来是 `clipboard.readText?.() ?? ""` 的可选调用写法，现在直接 `await` 即可。
    - **✅ 升级 Electron 44 带来的 18 行其它模块类型报错已全部修完**（2026-09-29），
      `tsc -p tsconfig.node.json --noEmit` 与 `tsc -p tsconfig.json --noEmit` **双双 exit 0**。
      **逐处定性比"修掉"更重要**，因为其中 5 处是**与新版本无关的历史真 bug**，被升级后的严格检查翻出来：

      **① 真 bug（历史遗留，一直被静默吞掉或从未生效）**：
      | 位置 | 问题 | 修复 |
      |---|---|---|
      | `pdf.ts:635` | `p.flatten()` —— **pdf-lib 从来没有这个 API**；外层 `try/catch` 静默吞异常 ⇒ **去注释功能形同虚设** | `(p.node as unknown as PDFDict).delete(PDFName.of('Annots'))`（`PDFName` 该文件早已 import） |
      | `shellMenu.ts:524` | `setDefaultOpen(payload.ext, !!payload.enabled)` —— **漏传第一个 `ops` 参数**（签名 `setDefaultOpen(ops, ext, enabled)`）⇒ 默认打开设置永远不落盘 | 补 `const ops: RegOp[] = []` 并 `await runShellMenuWorker(ops)` |
      | `transfer/transferModule.ts:1221` | `orderByDesc: "created_at"` —— 该参数是**布尔开关**不是列名（见第 3 条：新层 `orderBy` 放顶层 options）⇒ 排序完全失效 | 拆成 `orderBy: "created_at", orderByDesc: true` |
      | `tts-kokoro.ts:185` | `new Worker(kokoroWorkerPath, ...)` —— **该变量从未定义**（正确名是第 25 行 import 的 `sherpaTtsWorkerPath`） | 改用 `sherpaTtsWorkerPath` |
      | `tts-vits.ts:103` | `JSON.stringify({numSpeakers}, 'utf-8')` —— 把编码当 **replacer** 传给了 stringify | 编码参数移到 `fs.writeFileSync(path, data, 'utf-8')` 第三位 |

      **② Electron 44 真删了 API**：
      | 位置 | 删掉的 | 替代 |
      |---|---|---|
      | `browserDownload.ts:179` | `DownloadItem.canCancel()` | `item.getState() === 'progressing'`（等价语义）|
      | `browserPermission.ts:142` | `PermissionRequest.embeddingOrigin` | 删 fallback（原逻辑本就优先 `requestingUrl`，取 `details?.requestingUrl \|\| ""`）|
      | `ferry.ts:143` | `PermissionType` 的 `'camera'`/`'microphone'` | 只有 **`'media'`** 一个枚举值，删多余比较 |

      **③ 配置/解析层（3 处，非 API 变化）**：
      - `twoFactor/types.ts:4` + `twoFactor/vault.ts:8,15`：补 `.ts` 扩展名（**全仓 178 处在用 `.ts` 显式扩展名，仅这 3 处漏**，见 tsconfig `allowImportingTsExtensions`）。
      - `vite.config.ts:6`：JSON 导入加 `with { type: 'json' }`（`resolveJsonModule` 下的 `ESNext` 模块要求 import attribute）。

      > **⚠️ 上游声明 bug（渲染端，`src/`）**：另有 9 处报错全部来自 **epubjs 的 `.d.ts` 写错**，已逐行核对
      > `node_modules/epubjs/src/` 源码证实（**不要照 .d.ts 修业务代码，要去读 src**）：
      > | 声明 | .d.ts 写的 | 源码真实行为 | 结论 |
      > |---|---|---|---|
      > | `types/rendition.d.ts:91` | `getContents(): Contents` | `src/managers/default/index.js`：`var contents=[]` + 逐个 view `contents.push(viewContents)` | **真返回 `Contents[]`，声明漏了 `[]`** ⇒ 7 处报错（`.length` TS2339 / `[0]` 索引 TS7053 / `as any[]` TS2352）|
      > | `types/rendition.d.ts:77` | `currentLocation(): DisplayedLocation` | `rendition.js` 的 `located()` 返回 `{start:{index,href,cfi,displayed}, end:{...}}` | **实际是包一层的 `Location`**，不是裸 `DisplayedLocation` ⇒ `loc?.start` 报 TS2339 |
      >
      > **修法（`useEpubTts.ts`）**：新增**唯一的类型收口**
      > `takeContents(rendition: { getContents: () => unknown } \| null \| undefined): Contents[]`
      > （内部 `Array.isArray(list) ? (list as Contents[]) : []`，**保留强类型不退化成 any**），
      > 三处取 Contents 的地方统一改走它（原 L117/L137 各自手写 `as Contents[]`、L228 裸调，风格不一）；
      > `currentLocation()` 处 `as unknown as { start?: { href?: string } } \| undefined` 再窄化
      > （**类型与真值不重叠时 TS 要求先过 `unknown`**，直接 `as` 会报 TS2352）。
      > 两处都留了长注释标注「依据是 src 第几行、上游修正后即可改回直调」。
 40. **TS2367「无重叠」在 async 循环里可能是误报（2026-09-29）**：`useBookTts.ts` 的 `runLoop` 内
    `if (status.value === 'paused') break;` 报
    `TS2367: types '"playing"' and '"paused"' have no overlap`。
    - **成因**：`status: Ref<TtsStatus>`，循环开头 `status.value = 'playing'` 让 TS 把该表达式**窄化**成字面量 `'playing'`；
      而真正的暂停来自**外部同步调用** `pause()`（`status.value = 'paused'`），发生在循环内某个 `await` 挂起期间 ——
      **TS 控制流分析不跨 `await` 感知外部对同一引用的改写**，于是判定两次比较无交集。
      **是 TS 局限，不是逻辑错误**（运行时完全可能成立）。
    - **❌ 错误修法**：删掉这个判断（会丢暂停能力）、或改逻辑去迎合报错、或就地 `as TtsStatus` 把类型撒谎。
    - **✅ 正解**：加一个显式返回 `TtsStatus` 的**读取函数**，用函数调用读即可绕开窄化，
      同时把「该值可能在 await 期间被外部改动」这层意图写进代码：
      ```ts
      function readStatus(r: Ref<TtsStatus>): TtsStatus { return r.value; }
      // 调用点： if (readStatus(status) === 'paused') break;
      ```
      （`useBookTts.ts` 模块级已落地，与同文件 `resume()` 的 `status.value !== 'paused'` 判断形成对照。）
    - **通用教训**：「跨 `await` 的外部状态修改」是 TS2367 的高发场景，**报警 ≠ 该删判断**。
      修之前先问「这个值会在 await 期间被谁改」，再决定是用读取函数收口还是重构状态机。
 41. **`voicePrefix` 必须是 `protected` 而非 `private`（2026-09-29）**：`src/utils/tts/SherpaOnnxProvider.ts`
    的 `private readonly voicePrefix: string` 被子类 `PiperProvider` / `SherpaVitsProvider` 读取（拼音色名），
    报 TS2341。子类**只读不写** ⇒ 改 `protected` 是正解（不要改成 public，也不要给子类开 getter 绕）。
42. **本机类型校验命令（2026-09-29 实测）**：本机 bash 缺 `sed` / `dirname`（`ls`/`grep`/`cp` 也都没有），
    ⇒ **`node_modules/.bin/tsc` 的 shell shim 会直接崩**（`sed: command not found` → `Cannot find module 'C:\typescript\bin\tsc'`）。
    必须**直调 JS 入口**（用隔离的 managed node）：
    ```bash
    cd C:/cod/jianli/jianli-app
    C:/Users/风起/.workbuddy/binaries/node/versions/22.22.2-3/node.exe \
      ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
    ```
    两侧都要跑：`tsconfig.json`（渲染端 `src/`）与 `tsconfig.node.json`（electron 侧）。

