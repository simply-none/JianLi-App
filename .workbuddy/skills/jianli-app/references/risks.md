# 已知差异与风险（risks）

> 封装 / 开发前必读，避免踩历史雷。以下为代码探查时发现的与文档 / 规范不符或易错处。

1. **node 版本不一致**：README「安装」写 v20.13.1，但 `package.json` `engines` 要求 `>=22` 且 `prestart` 跑 `check-node-version.js` 会拦截——**以代码为准，需 node 22+**。
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
