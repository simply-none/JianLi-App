# 开发工具箱 (dev-toolbox)

## 职责
「渐离App」内置的**开发者实用工具箱**页面：6 个工具子页（已改造为 **pdfTools 同款两态布局**：卡片仪表盘 → 点击进入工具 → 页头返回按钮 + 二级标题，**顶部 TopTabs 已移除**），覆盖编码/正则/文本对比/网络诊断/日期计算/单位换算。纯渲染端工具为主，仅网络诊断走主进程 IPC。整体视觉通过**统一卡片体系 + 全局主题变量**与 App 其它页面保持一致（不硬编码颜色）。

## 关键文件
- 页面壳：`src/views/devToolbox/index.vue`（`LayoutVue` 壳 + **两态布局**：仪表盘态=页头大标题（渐变下划线）+ `DevToolCard` 卡片网格；工具态=页头返回按钮 + 二级标题 `tool-head`（工具名 + 描述，主色竖条）+ 内容区渲染子页面。`activeTool` 为本地 `ref`，无 Pinia store）
- 工具清单目录：`src/views/devToolbox/catalog.ts`（`DevToolMeta` 接口 + `DEV_TOOL_CATALOG` 6 项：key/title/desc/icon/accent/**tip**，与 pdfTools 的 TOOL_CATALOG 模式一致；`tip` 为进入工具后二级标题下展示的操作提示）
- 工具卡片：`src/views/devToolbox/components/DevToolCard.vue`（结构复用 pdfTools 的 PdfToolCard：accent 竖条 + 图标 + 标题/描述 + 箭头）
- **操作提示组件**：`src/views/devToolbox/components/ToolHint.vue`（通用轻量提示条，props：`text: string | string[]`、`type: 'info' | 'warn' | 'tip'`，图标 Info/TriangleAlert/Lightbulb；用于在每个功能面板顶部说明用法/输入格式）。工具级 tip 由 index.vue 在二级标题下渲染；面板级 tip 各 tab 内直接放 `<ToolHint text="..." />`。
- 共享：
  - `src/views/devToolbox/shared/types.ts`（`HashAlgorithm` / `RegexMatch` 类型、`PORT_SERVICES` 端口服务名映射）
  - `src/views/devToolbox/shared/hash.ts`（`computeHash(text, algo, key?)`：md5/sha1/sha256/sha384/sha512/hmac-sha256，经主进程 IPC）
  - `src/views/devToolbox/shared/clipboard.ts`（`writeClipboard(text)` 复制 + toast）
- 子页面 `src/views/devToolbox/tabs/`：
  - `jsonHashConverter/index.vue` —— JSON 格式化/压缩/转义/校验/交换（子 Tab：JSON/Hash/编码 ×3）
  - `regexTester/index.vue` —— 正则测试器（语法错误提示、8 色匹配高亮、捕获组详情、10 个常用模板、2s 灾难性回溯熔断）
  - `diffViewer/` —— 文本对比（详见下节）
  - `netDiagnostic/index.vue` —— 网络诊断（子 Tab：Ping/Traceroute/DNS/端口 ×4；`components/TerminalOutput.vue` 终端风格输出）
  - `dateCalculator/index.vue` —— 日期工具（子 Tab：日期差/加减/工作日/倒计时/时间戳 ×5）
  - `unitConverter/index.vue` —— 单位换算（类别 Tab：长度/重量/温度/面积/体积 ×5；localStorage 存历史）

## 路由
- `src/router/index.ts` → `/devToolbox`（页面级路由，非小窗）

## 用到的 IPC 通道
- 复制 / Hash 计算：既有 `clipboard:write`、`hash:compute`（或同款封装）
- 网络诊断（仅此子页走主进程）：
  - `sys:ping(host, count, taskId)` + 流式事件 `sys:ping-data`（监听 `sys:ping-data` 增量拼 raw，结束 removeListener）
  - `sys:traceroute(host, hop, taskId)` + 流式事件 `sys:traceroute-data`
  - `sys:dns-lookup(host)` → `{ ok, results }`
  - `sys:port-check(host, ports[], timeout, concurrency)` → `{ results }`
  - `sys:cancel-task(taskId)`（组件 `onUnmounted` 时取消，防泄漏）
- 纯渲染端工具（JSON / 正则 / Diff / 日期 / 单位）**不依赖主进程**，热重载即生效。

## 复用 / 集成点
- **布局两态（pdfTools 同款）**：仪表盘态与工具态由 `activeTool` 区分；`.toolbox-content` 的 flex 撑满机制仅在工具态存在（保证 Diff/终端等满高页不变），仪表盘态用 `.cards` 网格（`auto-fill minmax(260px,1fr)` + `overflow:auto`）。
- **子页内 Tab 统一**：各子页面（jsonHash/netDiagnostic/dateCalculator/unitConverter）内嵌 Tab 仍用 `@/components/TopTabs.vue`（`TopTabItem[] = { key, label, icon?, color? }`），**不用 el-tabs**。子页内嵌 TopTabs 需覆盖 `:deep(.top-tabs) { margin-bottom: 0 }` 以对齐卡片间距。
- **主题 token**：页面壳 `--bg-base` 背景、卡片 `--bg-card` + `--border-subtle` + `--radius-btn` + `--shadow-card`、文字 `--text-primary`/`--text-secondary`、强调 `--color-primary`（均带 `var(--el-*)` 回退），随明暗主题自动切换。
- **页面壳规范**：`.dev-toolbox-page { width:100%; height:100%; padding:20px; display:flex; flex-direction:column; gap:18px; background:var(--bg-base); overflow:hidden }`；内容区 `.toolbox-content { flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column }` + `.toolbox-content > * { flex:1; min-height:0 }`（保证 6 个工具页根元素统一撑满剩余高度）；`LayoutVue` 的 `.main` 需 `padding:0 !important` 覆盖。
- **工具页根布局规范（防"内容挤顶/下方留白/局促"）**：每个工具页根 `.xxx { display:flex; flex-direction:column; gap:14px; height:100%; min-height:0 }`，内嵌 `TopTabs`（`flex-shrink:0`） + 一个 `.panel { flex:1; min-height:0 }` 卡片；面板内「主可视化区」继续 `flex:1; min-height:0` 占满剩余：JSON 编辑器对（`.editor-split{flex:1}`）、正则测试字符串（`.test-string-wrap{flex:1}`）、终端输出（TerminalOutput 根 `flex:1`，body 去掉 max-height）、倒计时（`.countdown-display{flex:1}`）、快速换算表（`.quick-table-wrap{flex:1}` + `.quick-list{overflow:auto}`）、DNS 网格（`.dns-grid{flex:1;overflow:auto}`）。
- **编辑器拉伸用 CSS 覆盖，勿用 autosize**：`el-input type="textarea"` 写死 `:rows`（如 12），配合 `:deep(.el-textarea){height:100%}` + `:deep(.el-textarea__inner){height:100% !important; resize:none}` 撑满容器；若用 `:autosize` 高度由内容决定永远不占满。
- **Element Plus**：输入/按钮/表格/标签等组件保持 el- 前缀不变，只统一外层容器。

## diffViewer 子模块（重点）
- 入口 `tabs/diffViewer/index.vue`：三视图切换（并排 SplitView / 合并 UnifiedView / 内联 InlineView）+ 行/词/字符/JSON/CSS 5 档算法 + 空白处理（none/trailing/trim/all）+ 忽略大小写/CRLF + 单块应用（`applyHunk` 字符串替换）+ 全局同步 `applyAll`（`right-to-left` 用 `applyPatch(A, patch)`；`left-to-right` 先 `reversePatch` 再 apply）+ `PatchPanel` 抽屉（粘贴 patch 预览/应用/反向回滚）+ 导出 `.patch`。
- 依赖：**`diff@5.1.0`**（ESM，渲染端必须 `import * as DiffLib from 'diff'`，禁止 require）。关键 API：`diffLines/diffWords/diffChars/diffJson(options 需 @ts-ignore)/diffCss`、`createTwoFilesPatch(..., context)`（5/6 参传 `undefined` 不能 `null`）、`parsePatch`、`applyPatch(source, patch)`、`reversePatch`、`formatPatch`、`structuredPatch`。
- `patcher.ts`：`runDiff/computeDiff`（normalize 后调用 diff 库）、`buildHunks`（行号算法：遍历 diffResult，added/removed 开启 hunk，`oldStart=oldLine+1`/`newStart=newLine+1`，unchanged 收尾累加行号；`hunk.isModified=isAdded&&isRemoved`）、`createStandardPatch/applyStandardPatch/reverseStandardPatch`。
- `utils.ts`：`normalize`（空白/大小写/CRLF 预处理）、`calculateStats`（真实行统计）、`debounce`（diff 防抖 200ms）、`isJson/formatJson`。
- **SplitView 三层叠**：`.textarea-wrapper(overflow:hidden)` 内叠 行号层(`.line-numbers` z0) / 高亮层(`.diff-highlight` z1, pointer-events:none 但 hunk 按钮区 auto) / `textarea.real-textarea`(z2)；**横向滚动方案**：textarea 自己滚（`overflow:auto + white-space:pre`），行号/高亮层用 `transform: translate(-scrollLeft,-scrollTop)` 视差跟随，两侧 textarea 的 `@scroll` 经 rAF 互相同步（`isSyncing` 防反馈环）。
- `UnifiedView.vue` `.line-content` 用 `overflow:visible`（勿设 `overflow-x:hidden`，否则长行被截断，外层 `.result-scroll{overflow:auto}` 负责横滚）。

## 特有坑 / 注意
- **`require is not defined`**：渲染端纯 ESM，第三方库一律 `import * as X`（diff、moment 均如此）。
- **preload `on` 必须直通注册**：`window.ipcRenderer.on` 若在 preload 里包装 listener（新箭头函数），渲染端拿原引用调 `off/removeListener` 永远解不掉（静默泄漏）；且 preload 仅暴露 `off`/`removeListener` 直通方法，无 `removeListener` 时会报 `removeListener is not a function`。流式监听一律 `on(channel, fn)` + `finally` 里 `removeListener(channel, fn)`（同一引用）。
- **ping/tracert 乱码**：Windows 中文系统子进程输出为 GBK，主进程必须用 `iconv-lite` `iconv.decode(buf, 'gbk')`（见 `sys.ts#decodeOutput`），禁止直接 `buf.toString()`；ping 表格解析需同时兼容英文（Reply from...bytes=）与中文（来自...字节=）两种输出格式。
- **子 Tab 必须 TOP查**：新增子工具时在对应 `subTabs/catTabs`（`TopTabItem[]`）追加一项，勿改回 el-tabs。
- **netDiagnostic 流式监听**：`ipcRenderer.on('sys:ping-data', ...)` 注册后必须在 finally/卸载时 `removeListener`，并按 `taskId` 过滤，否则串台/泄漏。
- **netDiagnostic host 清洗**：用户常粘贴完整 URL（`https://www.baidu.com/`），而 ping/tracert 只接受纯主机名/IP，否则报「找不到主机」。`sanitizeHost()` 剥离协议/路径/查询/片段/端口，`normalizeHostInput()` 在输入框失焦与每个 run* 执行前调用，自动纠正。
- **单位换算历史**：存 `localStorage['devToolbox:unitHistory']`（最近 10 条，去重）。
- **纯渲染端**：除 sys:* 网络诊断外全部前端完成，改主进程仅当网络诊断通道需要动时才需要。

## 待办 / 未落地
- 大文件 >500KB 切 Web Worker 异步 diff（当前主线程，可能卡顿）。
- diff 差异搜索加 `<mark>` 黄色高亮（当前仅滚动定位）。
- mirror div 测量可抽成 `useTextareaAutoWidth()` composable 复用。