# 已知差异与风险（risks）

> 封装 / 开发前必读，避免踩历史雷。以下为代码探查时发现的与文档 / 规范不符或易错处。编号为历史遗留，11–15 已删除。

## 一、数据层 / IPC / 业务

1. **node 版本要求 `>=24.0.0`**：`package.json` `engines` 与 `check-node-version.js` 统一要求 24.x，与 Electron 44 内嵌 Node 24 对齐。
   - ⚠️ 升级 Node 主版本后原生模块 ABI 失效（sqlite3 等）：必须删 `node_modules` 重新 `npm install`。
   - 注：Electron 内嵌 Node（运行时）与本机 Node（构建侧）是两回事，前者不可改。
2. **get-store typo**：`store.ts` 注册的是 `get-stort-all`（拼写错误），调用方用 `get-store-all` 将失效。
3. **双数据层已合并**：`module/sql.ts` 已删，`newSql.ts` 为唯一连接池。新增业务一律走 newSql 三件套（`query`/`upsert`/`delete`）；旧层 `whereStr`/`limit`/`orderBy` 塞 `conditions` 内，新层放顶层 options。详见 `data-layer.md`。
4. **死 / 未接通道**：`save-file`/`get-file-list`/`save-debug-data` 主进程无 handler（可能走 worker 或已废弃），封装前核实。
5. **new-sql:execute 仍存在**：危险通道未移除，只靠规范约束——**永远不要调用**。
6. **遗留 / 未注册项**：`src/views/chart` 未注册路由（疑似废弃）；`src/views/test.vue`/`src/demos/ipc.ts` 为调试残留；根 `功能清单.md` 为空占位。
7. **命令面板作用域耦合**：新增源需同时改 `REGISTRY`、`SCOPE_PREFIX_MAP`/`SCOPE_LABEL`/`TYPE_META`、`CommandType`、`SCOPE_PATTERN`，否则作用域不生效。
8. **小窗穿透**：新常驻小窗务必 `mouseEvents:true`，否则点不动 / 拖不动。
9. **Tab 内容面板勿用 `<transition mode="out-in">`**：`out-in` 离场动画结束后进入态 `transitionend` 不触发 → 新面板卡 `opacity:0` 空白。改用 `v-if`/`:key`。
10. **顶部 Tab 复用 `TopTabs`**：多 Tab 页统一用 `src/smallComponents/TopTabs.vue`（单行不换行 + 滚轮横滚）；其 `emit` 为 `string | number`，消费方需 `as` 回严格联合类型。

## 二、主进程模块（改动后须重启 Electron）

16. **待办已移除裸 `new-sql:execute`**：`index.vue`/`todoSource` 改 `query` + 客户端过滤，`TodoDetailDialog` 用 `upsert`；新增待办逻辑一律走三件套。
17. **重复任务引擎在主进程**：`electron/main/module/recurrence.ts` 的 `initRecurrence()` 在 `main/index.ts` 注册，改它或 `job.ts` 必须重启 Electron。
18. **待办迷你窗已统一到新数据层**：`fetchAllTodos`/`saveTodo` 走 `query`/`upsert`；默认隐藏子任务(`parentId` 非空)与重复模板，与主窗口一致。
19. **标签筛选/编辑改 `TagSelectPopover` 多选**：`useTodo.tagFilter` 单值→`tagFilters`(`string[]` 数组或逻辑)；筛选栏与 `TodoDetailDialog` 均复用 `components/TagSelectPopover.vue`。
20. **upsert 依赖 key 列唯一索引（编辑变新增的根因）**：`ensureTableExists` 改为「无论列是否存在都确保 UNIQUE 索引，失败先按主键去重再重试」；启动时主动 `ensureTableExists('todo_list','key')`/`('todo_tags','id')` 清理历史重复。**改主进程须重启生效。**
21. **单一提醒引擎（已统一）**：原 newReminder(setTimeout) 与 job.ts+recurrence.ts(cron) 的待办截止提醒统一为 newReminder 引擎，写 `reminders` 表 `source='todo'`；job.ts 仅留工作/休息定时器。清理 todo 走 `query`+`del`，**勿用 execute**。改 newReminder/job.ts/recurrence.ts 须重启。
22. **统一右键菜单已重构**：旧级联方案废弃，改 `shellMenu.ts` 按 `SUB_COMMANDS.exts` 逐扩展名写 HKCU（无需管理员）。`CliItem.action` 已扩为 10 种，渲染端 `App.vue` 的 `switch(action)` 必须随 `CliAction` 同步——漏 case 静默无响应。改 `shellMenu.ts`/`index.ts` 须重启。
23. **右键菜单启用集合须迁移并集**：`getEnabledIds()` 引入 `SHELL_MENU_SCHEMA` + `LEGACY_IDS`（旧命令尊重旧开关，新增命令默认启用）做一次性迁移写回 `basic_info`。**新增右键动作须把 id 加进 `SUB_COMMANDS`**；若属新增命令须在迁移分支默认启用、视情况 `SHELL_MENU_SCHEMA`+1。改 `shellMenu.ts` 须重启才会重跑 `registerShellMenu()`。
24. **迁移写回禁用 `upsert`（嵌套事务坑）**：启动注册热路径写回 `basic_info` 用单行非事务 `db.run('INSERT OR REPLACE …')`（抽 `saveBasicInfoKV()`），**绝不在启动热路径用 `upsert`**（会与初始化事务交错报 SQLITE_ERROR）。`dist-electron` 改动须重新 `vite build`。
25. **注册后须 notifyShellRefresh**：`registerShellMenu()` 末尾调 `notifyShellRefresh()`（SHChangeNotify）刷新 Explorer 外壳缓存，否则菜单项需手动重启资源管理器才显示。
26. **应用锁 2FA 门禁**：`app-lock:unlock` 密码步通过且门禁启用时返回 `{need2fa, token}` 待 TOTP 验证。门禁密钥独立存 `basic_info(appLock2faVault)`（AES-GCM 信封、用应用锁密码加密），**勿往 `twoFactor.ts` 保险库塞门禁密钥**（启动锁定时未打开会死锁）。改 `appLock2fa.ts`/`appLock.ts` 须重启；`useAppLock.unlock()` 返回值已改为对象。
27. **改应用锁密码必须传 `current`**；冷却计数已移到主进程（`appLock2fa.ts` 内存变量，错 5 次冷却 30s），**勿在渲染端自建计数**。
28. **常驻页 `deep:true` + 秒级时钟 = 主线程开销（主页移动鼠标卡顿根因）**：`idleNow` 间隔 1s→15s；两处 watch 去掉 `deep:true` 改监听浅值；`homeMode` 写入均为整体替换引用，浅比较足够。另修 `newSql.ensureTableColumns` 无缓存（加 `ensuredColumnSets`）。**约定：`deep:true` 禁止与依赖秒级时钟的 computed 搭配；watch getter 禁止返回新造对象/数组字面量（浅比较恒不等→handler 空转）。** `newSql.ts` 改动须重启。详见 `modules/home.md`「性能红线」。
29. **后台轮询守卫必须「先廉价后昂贵」（剪贴板卡顿根因）**：
   - 根因：剪贴板停留图片时 `readText()` 恒空→每轮跑 `toDataURL()`（同步 OLE 调用）阻塞主进程。
   - **四层守卫顺序不可调**：`readText()` → `availableFormats()` → **`cheapImageKey()`（不编码）** → 仅新图片才 `toDataURL()`。
   - 根因 B：列表/预热按 `create_time DESC` 排序无索引→全表扫描；已加 `idx_clipboard_create_time`（约 30 倍提速）。表长会随数据增长变卡，排查须实测真实库。
   - ⚠️ 另有一轮询器 `download/downloadInterceptor.ts` 也跑 1s 轮询，改剪贴板逻辑须记得。
   - **通用教训**：① 廉价判断先于昂贵操作；② 长驻 `setInterval` 先 O(1) 判变化；③ **勿用类型断言绕过 TS 报错创造 API**（绕过≠存在）；④ 勿用等价模拟证明性能假设；⑤ 排序列无索引随数据增长变卡；⑥ 剪贴板监听最易埋卡顿，改 `clipboard.ts` 须重启。

## 三、环境与包管理器（2026-09-29 迁移）

30. **包管理器从 cnpm 迁到原生 npm**：「只支持 cnpm」是历史假象。**锁文件必须提交**——`.gitignore` 已放行 `package-lock.json`，忽略 `pnpm-lock.yaml`/`yarn.lock`。
31. **`sqlite3` 装不上 = 下载被墙 + `node-gyp@8` 不支持新 Node**：最终解法升 `sqlite3@5.1.7`→**`^6.0.1`**（官方 CI 覆盖 Node 24，无需装 VS，API 零改动）。
   - ⚠️ 镜像 key 命名：`<包名>_binary_host`（如 `sqlite3_binary_host`），写 **shell 环境变量或用户级 `~/.npmrc`**，**不要**写项目级 `.npmrc`。
   - ⚠️ 每个原生模块单独配一行；全局键（`prebuild_install_mirror` 等）无效。镜像目录 `https://registry.npmmirror.com/-/binary/<包名>/`（前缀 `/-/binary/` 非 `/mirrors/`）。
32. **`.npmrc` 注入变量带 `npm_config_` 前缀**：经 `npm run`/`npm exec` 的子进程能拿到，直接 `node xxx` 拿不到。只读无前缀变量（puppeteer 的 `PUPPETEER_*`）在 `.npmrc` 无效，须 shell `set`。
33. **`.npmrc` 现在只留 `registry=https://registry.npmmirror.com`**：
   - ⚠️ **不要**写 `electron_mirror`/`electron_builder_binaries_mirror`/`sqlite3_binary_host` 等自定义键——npm 11 警告并将移除注入；它们是 electron/prebuild-install 的环境变量。
   - 正确落点：Electron 二进制→`electron-builder.json5` 的 `electronDownload.mirrorOptions.mirror`（见第 46 条）；原生模块→shell 环境变量或用户级 `~/.npmrc`；puppeteer→shell `set`。
   - ⚠️ `.npmrc` 里 `key[]=...` 是错的（`key` 是 npm 内置 TLS 密钥项，会误触发 `ERR_OSSL_UNSUPPORTED`）。
34. **曾短暂试验 pnpm（未采用）**：若将来重考虑 pnpm 需 `onlyBuiltDependencies`、改用 `NODE_OPTIONS` 替 `increase-memory-limit`、`shamefully-hoist=true`。当前选定原生 npm。
35. **Electron 二进制下载走镜像（实测 16 倍差距）**：写**用户级 `~/.npmrc`** 的 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`（不出警告、全局生效）；临时覆盖用 shell `set`。断点续传：`npm run fetch-electron`（curl -C - --retry 10）。
36. **依赖版本基线（2026-09-29）**：`electron@^44.4.5`、`electron-builder@^26.17.0`、`electron-store@^11.0.2`（纯 ESM，dev 报 `ERR_REQUIRE_ESM` 需处理）、`sqlite3@^6.0.1`；**`vite-plugin-electron-renderer` 已移除**。`electron-builder` 真实最高看 `v26` dist-tag 别只信 `latest`。升 Vite 8 需 `build.rolldownOptions`。
37. **`vite.config.flat.txt` 是无效文件**：从模板拷来的 `.txt` 参考备忘（不被 Vite 加载，import 了已移除的 renderer 插件）。实际配置是 `vite.config.ts`（用 `vite-plugin-electron/simple`）。
38. **排查「装不上」通用方法（可复用）**：① 从报错首行找分叉点；② 解包目标 npm 包读源码确认真读哪个键/环境变量；③ 用镜像目录列表 API 确认真实文件名（别凭模板猜）；④ `curl -I -L` 实测 HTTP 200；⑤ 写探针实测环境变量注入；⑥ 先查内置键能否借用（已存在的内置键不能借用）；⑦ 版本不匹配当一等线索（顺下一层看回退路径是否可行，不只修镜像）；⑧ 优先升级依赖而非装工具链（查上游 CI 矩阵/`engines`）；⑨ 哈希对账校验镜像真伪。

## 四、Electron 44 升级 / 构建链

39. **⚠️ Electron 44 把 `clipboard` 整个重写成 W3C 异步 API（必读）**：
   - 旧同步 API（`readImage`/`availableFormats`/`readBuffer`/`readHTML` 等）全部移除，`readText()` 现返回 `Promise<string>`，旧 `readText().trim()` → `TypeError`。
   - **唯一入口 `electron/main/module/utils/clipboardCompat.ts`**，业务侧只需「加 await + 换函数名」（如 `readClipboardText()`/`writeClipboardImageFromPng()`）。四层守卫顺序见第 29 条。
   - ⚠️ **`ClipboardItem` 必须从 `'electron'` import**（不是 Node/Web 全局，否则主进程 `ReferenceError` 起不来）；同文件已写类型坑注释。验证运行时全局是否存在的探针须先 `unset ELECTRON_RUN_AS_NODE`（否则 Electron 退化成 Node 得假阴性）。
   - ⚠️ 异步轮询新风险=重入：`clipboard.ts`/`downloadInterceptor.ts` 已加 `busy` 重入锁 + `try/finally`（单轮未结束跳过本轮）。
   - 改动 21 处/8 文件已落地；升级带来的 18 行类型报错已修（含 5 处历史真 bug：pdf.ts `flatten()` 不存在、shellMenu.ts 漏传 ops、transferModule `orderByDesc` 当列名、tts 变量名错、JSON.stringify 编码当 replacer）。
40. **TS2367「无重叠」在 async 循环里可能是误报**：跨 `await` 的外部状态修改（如 `pause()` 改 `status.value`）TS 控制流分析不感知。❌ 别删判断/撒谎 `as`；✅ 加显式返回类型的读取函数收口（如 `readStatus(r)`）。修前先问「值会在 await 期间被谁改」。
41. **`voicePrefix` 必须是 `protected` 非 `private`**：`SherpaOnnxProvider.ts` 的 `voicePrefix` 被子类只读，改 `protected`（别改 public 或开 getter）。
42. **本机类型校验命令**：bash 缺 `sed`/`dirname`，`node_modules/.bin/tsc` 的 shim 崩（报 `Cannot find module 'C:\typescript\bin\tsc'`）。须直调 JS 入口（隔离 managed node）：`node.exe ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`，两侧（`tsconfig.json` 渲染端 + `tsconfig.node.json` 主进程）都跑。
43. **⚠️ `jlocal://` 协议两个致命坑（升级后电子书点不开根因）**，集中在 `protocol.ts`：
   - **坑 A：`privileges.corsEnabled` 必须 true**——dev 下页面 `http://localhost:5173` fetch `jlocal://` 属跨源，Chromium 默认拦（报错在 CORS 不在 handler，易误判）。`webSecurity:false` 不能替代。
   - **坑 B：`standard` scheme 吃 Windows 盘符**——`jlocal:///C:/...` 被规范化成 `jlocal://c/...`（host="c"）。用 `resolveLocalPath()`（`URL.host`+`URL.pathname` 还原，判盘符正则 `^\/[a-zA-Z]:\/`）替代旧 `slice('jlocal:///'.length)`。
   - 验证走真实 Electron 探针 `net.fetch`（BrowserWindow `loadURL` 沙箱内恒 `ERR_FAILED`）；单测须同时覆盖 Chromium 规范化与纯 Node 两种形态。
44. **⚠️ `increase-memory-limit` 改坏 `node_modules/.bin` 且 `npm install` 修不回（已彻底移除）**：该包文本替换 `.bin/*.cmd` 把 `node` 换成 `node --max-old-space-size=...` 不加引号→cmd 当整体文件名。受害 136 个 shim。⚠️ `npm install` 不重写已存在文件，**须 `rmdir /s /q node_modules\.bin && npm install`**（或删整个 node_modules）。✅ 改用 `NODE_OPTIONS=--max-old-space-size=10240`（Node 官方机制，不碰 shim、跨平台）；`set NODE_OPTIONS=...&&` 故意不留空格。
45. **⚠️ `src/vite-env.d.ts` 是 preload IPC 契约的手写镜像，会漂移→`TS2339`**：`window.ipcRenderer` 类型来自该文件（preload 返回 `Promise<any>` 推不出结构）。**新增/修改 IPC 返回值时务必同步这份声明**（先读主进程 handler 真实 `return` 逐字段比对，别只补报错那一个字段）。根治方案：preload `export type PreloadApi = typeof api`，渲染端 `ipcRenderer: PreloadApi`。
46. **⚠️ Electron 下载镜像正确键是 `electronDownload`，不是 `electronGet`**：`electron-builder.json5` 顶层 `electronDownload: { mirrorOptions: { mirror: "https://npmmirror.com/mirrors/electron/" } }`。`electronGet` 不存在（笔误自类型名），`scheme.json` 权威（90 根属性无 "Mirror"）。验证配置项合法性两处一起查：`scheme.json` 根属性白名单 + `electronGet.js` 运行时读取逻辑。
47. **Vite 警告「dynamically imported but also statically imported」= 无效懒加载**：某模块被 `await import()` 同时又被静态导入→静态已拉进主包，动态拆不动（warning 非 error，构建成功）。修法：把函数内的 `await import()` 提到顶层静态导入；**改前核对排除循环依赖 + 确认行为不变**（动态导入常见存在理由就是破环）。⚠️ 勿误伤路由懒加载（~50 处）与重库按需加载（jsqr/qr-code-styling/diff 等）。
48. **Vite 6→8 升级可行性已评估，暂不执行**：`vite build` 的 `Unknown input/output options: platform/codeSplitting` 警告属 `vite-plugin-electron@1.1.2` 兼容层缺陷（Rollup 忽略未知选项，功能无影响，纯噪声）。兼容矩阵已核实（仅 `vite.config.ts` 2 处 `rollupOptions`→`rolldownOptions` + `plugin-vue` 升 6.x）。**🗓 决策：用户选择「先不动」**——警告无害，勿擅自升级 Vite 或加 `onwarn`；待有其它理由动构建链时一并处理。
49. **打包体积审计：`dependencies` 归位是 Setup.exe 瘦身大头**：机制 `external` = `Object.keys(pkg.dependencies)` 全量 + electron-builder 按 `dependencies` 递归闭包收集 node_modules（与 `files` 无关）→ 渲染端专用包写在 `dependencies` 整包进 app。**已实施**：13 个渲染端专用包 `dependencies`→`devDependencies`（@dagrejs/dagre、@lucide/vue、@vue-flow/*、diff、epubjs、jsqr、jszip、pdfjs-dist、qr-code-styling 等），`dependencies` 剩 14 个主进程必需。⚠️ `sherpa-onnx-node`(+win-x64) 被运行时 `createRequire().resolve` 动态解析，必须留 `dependencies`（TTS 缺即哑）；pdfjs-dist 移走后 `@napi-rs/canvas` 链自动消失。打包后验证：主进程能起、PDF/TTS 正常、`resources/app/node_modules` 里 pdfjs-dist/@napi-rs/@lucide 已消失。

50. **字符串拼 SQL 时 OR 条件组必须整体加括号再与 AND 组合**：可归类笔记重构曾把标签条件以裸 `a OR b` 与关键词 AND 相接 → `kw AND a OR b` 因优先级 = `(kw AND a) OR b`，仅含标签 b 的笔记绕过关键词筛选（单标签时不带括号恰好没错，**多标签才炸，极易漏测**）。修法：`conditions.push('(' + ors.join(' OR ') + ')')`；断言脚本用多标签 + 关键词组合用例覆盖。
51. **`defineExpose` 的方法依赖模板 `ref` 绑定，声明了 ref 忘绑 `ref="xxx"` 不报错、静默 `undefined`**：可归类笔记重构中父组件声明 `detailPanelRef` 但模板漏绑，脏数据守卫 `detailPanelRef.value?.isDirty()` 永远 undefined → 守卫静默失效。凡是「子组件 expose 守卫/校验函数、父级调用决定流程」的结构，vue-tsc 不会抓，须人工核对模板绑定（或父级降级为「未挂载即视为脏」的保守默认）。

## 维护建议
- 每次大改动后更新对应 `references/modules/*.md` 与 `risks.md`，保持 skill 与代码同步。
- skill 内容会随代码演进过时，把它作为「项目知识基线」，发现不符就改。
