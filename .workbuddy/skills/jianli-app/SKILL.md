---
name: jianli-app
description: 本技能用于开发、维护、扩展「渐离App」(jianli-app) —— 一个 Electron + Vue3 + TypeScript + Vite 桌面效率应用。当任务涉及该项目的任意模块（习惯打卡、番茄钟、待办、剪贴板、笔记、电子书、股票、截图、小窗、提醒引擎、命令面板、调色板、数据层等）、需要理解架构/进程边界/IPC 通道/小窗四件套/复用模式，或要新增功能、排查已知雷区时，使用本技能。
agent_created: true
---

# 渐离App 项目开发技能（jianli-app）

## 这是什么
封装「渐离App」整个桌面应用的架构、约定、IPC 契约、复用模式与逐模块知识，让 AGENTS 在本项目里能按既定模式开发、维护、扩展功能，并避开已知雷区。它不是运行时功能，而是「开发该应用的知识库」——把散落在代码与记忆里的工程约定固化下来，供后续会话按需加载。

## 何时使用
- 任务涉及本项目任意模块（习惯打卡 / 番茄钟 / 待办 / 剪贴板 / 笔记 / 电子书 / 股票 / 截图 / 小窗 / 提醒 / 命令面板 / 调色板 / 数据层 …）。
- 需要理解：进程边界、改主进程要不要重启、IPC 通道怎么对接、小窗怎么加、某个注册表怎么扩。
- 要新增功能、重构功能、排查问题、排查「发了 IPC 没反应」、避免 newSql / 穿透 / 破表等历史坑。
- **数据层操作 / 双 SQL 层合并**：建表、读写业务数据、多库选择、旧层调用迁移，见「参考文档导航」中的 `sql-db-ops.md` 与 `sql-merge-plan.md`。
- **把功能移植到 Flutter 移动端（Android/iOS）、跨端复用 db.sqlite、类 LocalSend 局域网同步**：见下方「Flutter 移动端移植计划」与 `references/flutter-port.md`。

## 全局红线（先读，违反必踩雷）
1. 渲染端**禁止 `import electron/*`（含类型）**；一切系统 / 磁盘 / 库操作走 IPC。
2. 改主进程（`electron/**`）**必须重启 Electron**；改渲染端（`src/**`）热重载即可。
3. 业务数据走 newSql 的 `query`/`upsert`/`delete`；❌ **严禁裸 `new-sql:execute`**（确需用 SQL 时先读 `references/db-pitfalls.md`，execute 有自动建表劫持结构、PRAGMA 拿不到结果、SELECT 结果在 data.rows 三个必避的坑）。
4. SQLite 补主键 = `ADD COLUMN key TEXT` + `CREATE UNIQUE INDEX`（不能 `ALTER` 加 PK）。
5. 常驻小窗必须 `mouseEvents:true`，否则鼠标穿透点不动 / 拖不动。
6. 小窗路由 path 名**必须**与主进程 `createOtherWindow` 的 `arg` 一致。
7. 新需求开发/功能重构采用**原子化、组件化、功能化**拆解构建：单文件职责单一、体量可控，禁止把一堆功能堆成一个超大文件（与项目 `AGENTS.md`「功能注意分割，防止代码文件过大」一致）；每个功能 / 组件需带注释。
8. 新需求开发落地清单（接入菜单与小窗）：
   - **必备**：① `src/router/index.ts` 的 `RouteNames` 加 key + `layoutRouters` 注册路由；② **`src/constants/menu.ts` 的 `menuGroupDefs` 对应分组 `names` 加名**（菜单分组唯一数据源，侧边栏 `src/layout/index.vue` 与路由配置页 `src/views/routeSetting/index.vue` 自动同步，❌ **严禁分别去这两个文件里加名单**——2026-09-10 已因两份名单漂移导致 6 个功能在配置页没有开关）；③ 可选：`src/utils` 的 `iconMap` 加图标。
   - **可选**：若需常驻浮动交互，再按小窗四件套加一个小窗（见 `references/modules/small-window.md`），且必须 `mouseEvents:true` 并遵循路径一致性红线（第 6 条）。
9. 每次修改都必须同步更新对应模块的文档 `references/modules/<模块>.md`
10. **导出统一规范（见 `references/export.md`，新增导出功能前必读）**：所有「导出 / 保存文件到磁盘」走统一入口 `src/utils/exportToFile.ts`（`exportTextToCache` / `exportBufferToCache`）；**不弹系统保存框、默认直写缓存目录 `fileCachePath`、成功用 `src/utils/fileNotify.ts` 的 `fileNotify` 提示（蓝色可点击路径）**；安全敏感导出（2FA 密钥库 / 文件保险库解密）保留用户选位置，仅把成功提示换成 `fileNotify`。

## 参考文档导航
- 架构总览：`references/architecture.md`
- 数据层约定：`references/data-layer.md`
- SQL 数据库操作（统一数据层 newSql）：`references/sql-db-ops.md`
- 双 SQL 层合并设计：`references/sql-merge-plan.md`
- 数据库踩坑指南（写库前必读）：`references/db-pitfalls.md`
- IPC 通道契约：`references/ipc-channels.md`
- 导出统一规范（落盘/命名/反馈/红线）：`references/export.md`
- 小窗机制与四件套：`references/modules/small-window.md`
- 通用复用模式：`references/patterns.md`
- 主题与视觉约定（token 清单 / 严禁硬编码 / 禁用未全覆盖的 --el-* / 派生色用 color-mix）：`references/theme.md`
- 已知差异与风险：`references/risks.md`
- Flutter 移动端移植计划（跨端 / 双端同步）：`references/flutter-port.md`
- 文件互传双端方案与模块文档（双端批量互传，#9–#21 增强全部向后兼容）：`references/modules/file-transfer.md`
- 逐模块文档（`references/modules/`，处理具体模块前先读对应文件）：
  - **效率 / 提醒类**：`habit` `reminder` `todo` `pomodoro` `countdown` `command-palette` `theme-conversation` `window-mode` `shortcut` `home-mode` `route-setting` `settings` `quick-note` `sticker` `app-lock` `two-factor` `file-vault`
  - **内容 / 数据类**：`clipboard` `notebook` `categorizable-notes` `ebook-reader` `accounting` `stock` `flow` **`mindmap`（思维导图，自研树布局 + 六种方向（左右/右向/左向/向下/鱼骨/时间轴）/ 撤销重做 / 搜索 / 节点右键菜单 / 剪切粘贴 / 分支聚焦 / 大纲面板 / 框选多选 / 拖放换父 / 节点分支色·背景色·文字色·图标·超链接 / 手动拖拽固定坐标 / MiniMap / SVG·PNG 导出 / XMind·FreeMind·OPML 互操作 / 待办·笔记·主题对话一键生成 / 导出为待办 / 命令面板打开指定导图）** `function` `color-palette` `resume`
  - **系统 / 工具类**：`system-info` `weather` `crawler` `spider` `high-perf-sql` `file-rela` `resource-manage` `screenshot` `browser` `downloader` `about` `safety-protection` `app-cache` `backup` `tts` `small-window` `home` `data-acquisition` `dev-toolbox` `qr-code` `sync` `file-transfer` `ferry` **`note-slip`（小纸条，P1-6 双端同名）**

## 使用方式
1. 接到本项目任务，先判断属于「架构 / 数据 / IPC / 小窗 / 复用模式」哪一类，读对应核心参考。
2. 锁定到具体模块，读 `references/modules/<模块>.md` 拿到入口文件、store、路由、用到的 IPC、特有坑。
3. 需要新增能力时，优先复用既有模式（命令面板 REGISTRY、链式动作 registry、小窗四件套、提醒引擎 `syncReminders`），不要另起炉灶。
4. 所有文档用中文；发现与代码不符，请直接更新对应文档，保持 skill 与代码同步。
5. **沙箱内改完渲染端怎么自证**（GUI 起不来时的四板斧，全部在沙箱可跑）：
   - **类型 + 模板**：`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json`（全项目，实测 30~46s）。**必须跑**——它能抓出模板里引用了不存在的绑定这类纯运行时才会暴露的错误（本项目已因此抓到一次）。
   - **SFC 结构/语法**：`@vue/compiler-sfc` 的 `parse` + `compileScript` + `compileTemplate`，逐文件跑，秒级。
   - **纯逻辑层断言**：不依赖 Vue 的 pure 模块（如 `utils/*.ts`）直接用 `typescript.transpileModule` + 自定义 `require` 加载**真实 TS 源码**跑断言，比对着源码手写期望值可靠。
   - **图标名登记扫描**（新增，强烈建议常备）：把源码里 `<LucideIcon name="X">` 与 `icon: 'X'` 用到的名字全抓出来，跟 `LucideIcon.vue` 的 `nameMap` 比对。**漏登记不报错、不告警，只会静默 fallback 成 `CloudAlert`**（`nameMap[name] || nameMap['CloudAlert']`），肉眼极难发现。顺带也能检出「`import` 了但没进 `nameMap`」。
   - 交互、视觉、主题适配只能由用户本地 `npm run dev` 实机确认，**不要声称已验证**。

## 维护说明
本 skill 是「项目知识基线」，随代码演进而更新。原则：
- 每次大改动后同步 `risks.md`（通用教训 / 坑）与对应模块文档 `references/modules/<模块>.md`。
- 发现与代码不符，直接更新对应文档，保持 skill 与代码同步。
- 新增模块：在 `references/modules/` 加一份文档，并在上方「逐模块文档」导航补一行。

### 变更里程碑（现状 + 关键决策）
> 按功能归并；详细的逐轮调试 / 补丁过程见各模块文档与 `risks.md`，此处只留「当前状态 + 关键架构决策」。

- **电子书阅读器优化增强批次（2026-10-01，A–F 六波）**：TXT 补齐章节识别/目录/书签/全文搜索；EPUB 进度滑块 + locations 分档延后；PDF 翻页模式 + 夜间反色 + 缩放归一化；快捷键体系 `useReaderShortcuts.ts`（输入框守卫）；书架导入批量化（弃 sendSync）、背景图持久化只落图库 id、筛选/排序/搜索增强、元数据手动编辑、拖拽导入与拖拽进分类、删除分类确认；单条标注改色 + 书签重命名 + EPUB 书签段落指纹判重；搜索命中可见化（EPUB 标注通道 / TXT 原生选区 / PDF viewport 矩形）；导出 HTML/CSV/书摘长图（统一 exportToFile 规范）；阅读时长统计（新表 `ebook_reading_stats` + 继续阅读横幅）；TTS 增强（PDF 适配器/睡眠定时/朗读选区）；**CBZ 漫画格式**（`CbzReader.vue`，jszip 零新依赖）；传书 format 三值化支持 PDF（PC↔PC）。⚠️ **用户拍板不做**：划词翻译/词典；**EPUB「设置变更→整本重建」是为划线定位准确特意设计的，禁止改轻量**。主进程新增 7 条 IPC（需重启），详见 `references/modules/ebook-reader.md`「2026-10-01 优化增强批次」与 `C:\cod\jianli\电子书阅读器优化增强_执行清单_2026-10-01.md`。

- **可归类笔记 UI/交互重构（categorizable-notes）**：卡片网格 + 详情弹窗 → **三栏主从布局**（TagSidebar 标签导航 / NoteListPanel 搜索+行式列表+无限滚动 / NoteDetailPanel 右栏内联查看·编辑），**编辑不再弹窗**；新增脏数据守卫（切换/取消先确认丢弃）与 Ctrl+S / Esc 快捷键；数据出口收敛到 `composables/useNotes.ts`（IPC 契约、表结构、标签 store 均不变）。零主进程改动。沙箱自证：vue-tsc 全绿 + SFC 编译 + 图标登记扫描 + 数据层真实源码断言（25 条，抓到 SQL OR 组缺括号优先级 bug）。交互/视觉/26 主题须本地 `npm run dev` 实机确认。详见 `references/modules/categorizable-notes.md`。

- **思维导图（mindmap）**：P0–P13 全部落地（撤销重做 / JSON·MD 导入导出 / 六向布局 / 搜索定位 / 节点右键菜单 / 剪切粘贴子树 / 分支聚焦 / 大纲面板 / 框选多选 / 拖放换父 / 节点背景色·文字色·图标·超链接 / MiniMap / SVG·PNG 导出 / XMind·FreeMind·OPML 互操作 / 待办·笔记·主题对话一键生成 / 字体字号版式）。全程零主进程改动、零新依赖（MiniMap 自研，未装 `@vue-flow/minimap`）。核心决策：① **树是唯一真源、坐标只派生绝不落库**（换布局零数据迁移）；② 撤销埋点只在 `useMindDoc.commit()` 一处；③ 分支 / 背景 / 文字 / 图标色只存 key，用主题令牌 + `color-mix()` 派生（26 套主题自适应）；④ 导出从「树 + 布局」直出 SVG，颜色过 `resolveCssColor()` 折算 sRGB；⑤ 右键菜单独立组件 `Teleport to="body"`，只存视口坐标，关闭用 window 捕获阶段 `pointerdown` 判点外（避开「全屏遮罩关浮层」零坐标事件陷阱）；⑥ 工具条「滚动层」与「浮层」必须分层（`overflow-x:auto` ≠ 滚轮能滚，须手写 `onWheel`）。累计断言 400+（沙箱四板斧）。⚠️ 交互 / 视觉 / 26 主题观感须本地 `npm run dev` 实机确认。详见 `references/modules/mindmap.md`。

- **剪贴板（clipboard）**：Electron 44 异步 Clipboard API 全面迁移（新增 `clipboardCompat.ts` 兼容层，业务侧 = 加 `await` + 换函数名）；性能根因修复——四层守卫（`readText()` → `availableFormats()` → `cheapImageKey()` 不编码 → 仅新图 `toDataURL()`）、`clipboard_history` 补 `idx_clipboard_create_time` 索引（列表 444ms → 15ms）、`newSql.ensureTableColumns` 加缓存、两处轮询加重入锁（`busy`/`polling`）。⚠️ 改主进程须重启。详见 `references/modules/clipboard.md` 与 `risks.md` #29。

- **启动提速 + 资源管理器右键菜单注册**：`runDeferredInits()` 把非关键模块移出首屏关键路径（P0 埋点 `timeInit` 定位瓶颈）；右键菜单注册表写入全搬 **Worker 线程**异步跑（主线程不再冻结），每次启动重写、不阻塞；PDF 工具箱 5 条命令（`PdfCompress/Split/Merge/ExtractAttach/ToImage`）因此重新启用（`SHELL_MENU_SCHEMA` 2→3 触发默启用迁移）。⚠️ 改主进程须重启。详见 `references/modules/file-vault.md`「资源管理器右键菜单」与 `risks.md`。

- **文件互传（fileTransfer）**：双端对称批量互传已落地 + 两批增强（#9 重名 / #10 拆「文件·文件夹」双对话框 / #11 最近设备 / #13 断点续传 / #14 会话加密 / #15 接收询问 / #16 磁盘预估 / #17 并发守卫 / #20 分页清理 / #21 随机昵称）全部向后兼容；决策记录已并入 `references/modules/file-transfer.md`。复用 47124 数据面，不新开端口。⚠️ 改 `transferModule.ts` / `syncModule.ts` 须重启。详见 `references/modules/file-transfer.md`。

- **小纸条（note-slip）**：P1-6 双端落地（PC⇄手机文字 / 链接速传，单条 ≤8000 字；大文件走文件互传）。复用 47124 数据面 + 47123 发现；表 `note_slip` 双端同构、不入同步白名单；PC 注册须排在 sync 之后。详见 `references/modules/note-slip.md`。

- **隔空互传 →「流光扫传」更名**：界面文案统一更名「流光扫传」（PC 6 处 + 移动端 17 处），代码代号 `ferry` / 路由 `/ferry` / IPC `ferry:open` / 静态站 `qyferry` 刻意保留（避免旧用户已接收文件「消失」）。详见 `references/modules/ferry.md`。

- **局域网同步白名单扩容**：主题对话三表 `conversation_theme` / `conversation` / `conversation_tag` 加入白名单；`tablePk()` 按表适配主键（conversation* → id，其余 → key）。详见 `references/modules/sync.md`。改主进程须重启。

- **天气（weather）**：多数据源可插拔架构（9 源：和风 / Open-Meteo / 心知 / 高德 / 彩云 / OpenWeatherMap / wttr / 爬虫兜底 / 中国天气网 cnweather），`WeatherProvider` 接口 + `resolveChain` 降级链 + 字段分级展示；县级坐标改用 **DataV.GeoAtlas 全国快照**（3237 条，零手写）；重名区县消歧 + 记住选择（`CityRef` + adcode）；玻璃页主题 / 图表配色（不读 CSS 变量、用玻璃专用色板）。关键坑：① 把 Vue 响应式发 IPC 前必须递归 `toRaw()`（Proxy 不可结构化克隆）；② 图表配色不读主题灰、用 `useGlassChartTheme` 白色系；③ ECharts SSR 断言须归一化 rgba / 小写化、tooltip 不渲染、LinearGradient 无 `<defs>`、`markPoint` 禁用 `symbol:'none'`；④ 中国天气网接口须 HTTPS + 带协议 Referer。详见 `references/modules/weather.md`。

- **导出统一规范（fileNotify）**：全项目导出点「点路径 → 定位文件」失效已根治——渲染端 `ElMessage` 加 `data-path` + 文档捕获阶段事件委托；主进程 `exec('explorer /select')` 改 `shell.showItemInFolder`。新增导出功能前必读 `references/export.md`。改主进程须重启。

- **home 卡顿修复**：`idleNow` 间隔 1s → 15s、两处 `deep:true` watch 改浅值、`newSql.ensureTableColumns` 加缓存。约定见 `risks.md` #28。

### 跨模块通用教训（详细见 `risks.md`，此处索引）
- 不要用类型断言「创造」API（绕过报错 ≠ 存在，搜二进制符号 / 最小复现验证）。
- 性能排查用真实 DB 实测耗时与执行计划，别只看代码。
- 把 Vue 响应式数据发主进程（invoke / send）前必须递归 `toRaw()` 剥离 Proxy。
- 浮层避免「全屏遮罩 + 遮罩上关浮层」（派发中途元素移除 → Chromium 重发零坐标事件）；定位类 bug 先量化症状。
- 写完响应式样式立刻读 DOM 几何读的是上一帧，须 `await nextTick()` 或改量不依赖本次写入的量。
