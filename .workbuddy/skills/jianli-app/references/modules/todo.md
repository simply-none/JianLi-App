# 待办事项 (todoList)

## 职责
待办事项的增删改查、状态切换、截止提醒、子任务层级、重复任务自动生成，以及卡片 / 列表 / 日历三种视图的展示。主列表 + 小窗（todoMiniWindow）共用 `useTodo` store 的数据层。

## 关键文件
- 页面容器：`src/views/todoList/index.vue`（TopTabs 切换三视图、筛选/分组/统计、对话框编排）
- 集中类型：`src/views/todoList/types.ts`（`TodoItem`/`Tag`/`Priority`/`RecurrenceRule`，消除原 4 处重复声明）
- 数据访问：`src/views/todoList/api/todoApi.ts`（封装 `new-sql:query`/`upsert`/`delete`，**严禁 execute**）
- 状态仓库：`src/store/useTodo.ts`（收敛查询、客户端过滤、分组、统计、子任务树、视图态）
- 卡片视图：`TodoList.vue`（网格容器 + 分区分组）+ `components/TodoCard.vue`（单卡：折叠描述/统一密度/层级缩进/重复标记）+ `components/TodoSubtaskProgress.vue`
- 列表视图：`TodoListView.vue`（接入通用 `VirtualList` 虚拟化）
- 日历视图：`TodoCalendarView.vue`（自研月历 grid + el-date-picker，按 dueDate 聚合；**点击日期以 el-popover 锚定该日期格弹出当日待办列表**，不再常驻下方面板）
- 详情弹窗：`TodoDetailDialog.vue`（标题/描述/优先级/截止/提醒/重复配置/关联父任务/标签/状态）
- 标签选择弹窗：`components/TagSelectPopover.vue`（el-popover 多选 + 新增标签；筛选栏与详情弹窗共用）
- 小窗：`src/views/todoMiniWindow/index.vue`
- 主进程重复引擎：`electron/main/module/recurrence.ts`（启动扫描 + 每日 00:00 生成实例）

## 路由
- `RouteNames.TODO_LIST` → `/todoList`
- `RouteNames.TODO_MINI_WINDOW` → `/todoMiniWindow`

## 数据模型（todo_list 表）
- 字段随 newSql 自动加列，新增以下字段（无需迁移脚本）：
  - 子任务关联：`parentIds`（父任务 key 数组，可关联多个；空数组/空=根任务）、`sortOrder`（同级排序，原 `order` 因 SQL 保留字已改名）
  - 重复：`recurrenceRule`(daily|weekly|null)、`recurrenceInterval`(间隔)、`recurrenceWeekdays`(JSON 星期数组)、`recurrenceEnd`(结束日期)、`recurrenceId`(模板 key)、`isRecurrenceInstance`(1=实例)
- **模板**：`recurrenceRule` 非空且 `recurrenceId` 为空 → 仅用于生成实例，默认列表隐藏（可勾选「重复模板」显示）
- **实例**：`recurrenceId` 指向模板、`isRecurrenceInstance=1` → 每条周期一个可独立勾选/留痕的待办
- 子任务：`parentIds` 非空的行作为**独立待办**展示（卡片/列表/日历均可见），卡片显示「子任务」徽标 + 「父任务：名称」chips；不再内嵌折叠于父任务下

## 用到的 IPC 通道
- `new-sql:query`（渲染→主，拉全表后客户端过滤）
- `new-sql:upsert` / `new-sql:delete`（渲染→主，待办增改删）
- `update-todo-reminders`（渲染→主；新增/编辑/完成/删除后发送，由 `job.ts` 重排截止提醒）
- `recurrence:sync`（渲染→主；保存重复待办后发送，由 `recurrence.ts` 立即补生成实例）
- 小窗还用 `open-new-window`(`todoMiniWindow`)/`close-new-window`、`sync-data-to-other-window`、`disable/enable-mouse-click-through`、`get-store`/`set-store`

## 复用 / 集成点
- **提醒联动**：编辑/完成待办后发 `update-todo-reminders`，由 `job.ts` 维护截止提醒；重复实例复制模板的提醒配置，生成后由 `recurrence.ts` 调用 `applyTodoReminders()` 重新排程。
- **habit 链式动作目标**：`src/views/habit/chainActions/actions/todoAction.ts` 打卡后改写待办状态并同样发 `update-todo-reminders`。
- **小窗四件套**：`windowSections.ts:204`（key=`todo`，storeKey=`todoMiniWindow`）。

## 子任务（关联父任务模型）
- 子任务 = 普通待办 + `parentIds`（父任务 key 数组，可关联多个）；作为独立待办出现在卡片/列表/日历。
- **关联父任务用弹窗选择**：`TodoDetailDialog.vue` 内的「关联父任务」改为「已选 tag + 选择父任务按钮」触发 `components/TodoParentSelectDialog.vue`（独立弹窗）。弹窗内：搜索框 + 任务列表（复选框多选，排除自身/重复模板/实例），每行独立「查看」图标 → 打开该父任务**只读详情**（不可编辑）。确定后把选中 key 数组回传，落库为 `parentIds` JSON 字符串（`new-sql:upsert`）。
- **父任务展示用 tag 形式**：卡片/列表/日历均把关联父任务渲染为可点击 tag（chip）；点击 tag 或弹窗内「查看」→ 由 `index.vue` 打开第二个 `<TodoDetailDialog read-only>` 只读详情弹窗（`readOnly` prop：fieldset 禁用全部输入、标签只读展示、底部仅「关闭」）。store 新增 `parentItemsOf(child)` 返回父任务对象数组（供 tag 点击跳转）。
- 卡片显示「子任务」徽标 + 父任务 tag chips（可点击）；列表显示「子」标签 + `↳ 父名` tag（可点击）；日历弹窗显示「子」徽标 + `↳ 父名` tag（可点击）；父任务卡片保留 `TodoSubtaskProgress`（统计其直接子任务完成度，按 parentIds 含自身筛选）。
- 编辑回显：详情弹窗 `loadForm` 用 `parseParentIds()` 把 `parentIds` 统一解析为字符串数组（兼容 数组/JSON字符串/null/旧单值 `parentId`），确保带父任务的待办重新打开编辑时正确回显已选父级；已选 tag 由 `parentTagItems`（按 key 映射回 store 任务）渲染。
- 下拉分组新增「按父任务」：多父任务的任务归入其第一个父任务，无父任务归入「无父任务」。
- 兼容旧数据：`todoApi.normalize` 解析 `parentIds`（JSON），旧 `parentId` 单列自动包装为单元素数组。

## 重复任务
- 模型：生成独立实例。母任务作模板（列表默认隐藏），每个周期在主进程自动生成一条实例。
- **懒生成**：`recurrence.ts` 每次只生成「当天」实例（窗口 = 当天 00:00 ~ 当天 23:59:59），**不再预生成未来**（原 `LOOKAHEAD_DAYS=60` 已移除）；每日 00:00 的 CronJob 在其当天开始(00:00)时生成次日实例。
- 引擎：`electron/main/module/recurrence.ts` 的 `initRecurrence()`（在 `main/index.ts` 中 `initJob()` 之后调用，改主进程需重启 Electron）。
  - 启动仅补生成当天实例 + 每日 00:00 CronJob 补生成次日；
  - 渲染端保存重复待办后发 `recurrence:sync` 立即生成当天实例；
  - 生成完成后调用 `applyTodoReminders()` 刷新提醒。
- 配置项：每天(N)/每周(N，可指定星期)/结束日期（留空=永久）。

## 视图切换
- `index.vue` 顶部用 `TopTabs`（`src/components/TopTabs.vue`）切换 卡片/列表/日历，状态存于 `useTodo.view`。
- 日历视图纯自研（CSS grid 月历 + el-date-picker 选月），零新依赖，全部走主题 token。
- **日历点击弹窗**：点击某天 → 以 `el-popover`（`virtual-ref` 锚定该日期格）弹出当日待办列表（含勾选/查看/编辑），点击空白或关闭按钮收起；下方面板已移除。

## 标签（Tags）
- 标签定义存 `todo_tags` 表（`key`/`name`/`color`），待办的 `tags` 字段为标签 key 的 JSON 数组（如 `["k1","k2"]`）。
- 筛选栏标签过滤：`useTodo.tagFilters`（`string[]`），**或逻辑**（待办命中任一选中标签即保留）；`index.vue` 用 `TagSelectPopover` 触发，trigger 展示已选 chips + 一键清除。
- 详情弹窗标签编辑同样用 `TagSelectPopover`：弹窗内彩色 chip 多选 + 底部按名+选色新增标签（写入 `todo_tags` 并自动选中）。
- `TagSelectPopover.vue` 为通用组件，内部走 `useTodoStore.tags` 与 `api.saveTag`，筛选栏与详情弹窗复用。

## 批量删除（高级条件删除）
- 入口：**独立弹窗**，由 `index.vue` 工具栏中「新建待办」按钮**右侧**的「批量删除」按钮触发（打开 `TodoBatchDeleteDialog.vue`，宽 540px）。**不**内嵌于新建/编辑弹窗。
- 组件：`TodoBatchDeleteDialog.vue`（app-dialog 包 `components/TodoBatchDeletePanel.vue`）→ 面板 `@deleted` 后调 `store.fetchTodos()` 并关窗。
- 条件（纯客户端过滤，复用 `useTodo` 的 `effectiveStatus`/`isSubtask`/`childrenOf`）：
  - 关键词（标题/描述模糊）、状态（多选）、优先级（多选）、标签（多选，任一命中）、截止日期范围（晚于等于 ~ 早于等于，按 `dueDate` 前 10 位 ISO 比对）、任务类型（全部/仅子任务/仅重复模板/仅重复实例/仅顶层）。
  - 级联勾选「同时删除被删父任务的子任务」（默认开），按 `childrenOf` 把子任务一并加入删除集。
- 交互：实时计算匹配数 + 预览前 100 条（状态/优先级/类型徽标）；点击「删除匹配项」→ `ElMessageBox.confirm` 确认 → 逐条 `api.deleteTodo(key)`（`new-sql:delete`）→ 发 `update-todo-reminders` + `recurrence:sync` → emit `deleted`。
- 注意：删除走合规 `new-sql:delete`，**严禁 execute**。

## 命令面板联动
- `src/views/commandPalette/sources/todoSource.ts` 的 `run()` 设置 `useTodoStore().highlightKey` 后跳转到 `todoList`，由页面滚动定位并闪烁高亮目标待办。子任务与重复模板在**客户端过滤**排除（`parentIds` 为 JSON 列，SQL 不便解析），仅显示顶层任务。

## 特有坑 / 注意
- **已移除裸 `new-sql:execute`**：原 `index.vue`/`todoMiniWindow`/`todoSource` 的 execute 已全部替换为 `new-sql:query`/`upsert`/`delete` + 客户端过滤，避免 ALTER 污染表结构。
- 客户端过滤：一次性拉全表，关键词/优先级/标签/状态/完成态/模板/子任务均在 `useTodo` store 内过滤，无 SQL 注入风险。
- 改主进程（`recurrence.ts`/`job.ts`）必须重启 Electron 才生效。
- 子任务作为独立待办展示（`parentIds` 非空），通过卡片/列表/日历的「父任务」标记体现关联；命令面板与迷你窗仍仅显示顶层任务。
- **编辑变新增（致命坑 #21）**：`TodoDetailDialog.handleSave` 必须以「被加载原始待办的 key」作为 upsert 主键，绝不可在保存时把 `key` 重新生成。实现上用独立 `loadedKey` ref（在 `loadForm` 首行从 `todo.key` 取值），`parentKey = loadedKey.value || uuidv4()`；新建时 `loadedKey=null` 走 uuidv4，编辑时必等于原 key → `ON CONFLICT(key)` 命中更新而非插入。后端 `newSql.ensureTableExists` 已对 `todo_list(key)` 建 `uq_todo_list_key` 唯一索引，索引存在时 upsert 一律更新。
- **重复关联别在保存时清零（致命坑 #22）**：`handleSave` 的 `parentData` 切勿硬编码 `recurrenceId: null` 覆盖 `...form.value` 携带的重复字段。编辑重复实例/模板时若把 `recurrenceId` 置 null，会导致该待办脱离重复关联、被 `recurrence:sync` 触发 `generateForTemplate` 误判并重新生成实例（表现为「编辑后多出一条」）。正确做法：让 `recurrenceId`/`isRecurrenceInstance` 沿用 `form.value` 加载到的值（新建为 null/0，实例保留原模板 key）。模板判定见 `recurrence.ts getTemplates()`：`recurrenceRule IN ('daily','weekly') AND (recurrenceId IS NULL OR '')`。

## 2026-10-01 优化增强批次（40+ 项，执行清单见 `C:\cod\jianli\待办事项功能优化与增强_执行清单_2026-10-01.md`）

### 架构变化（写码前必读）
- **写库收口（B1/B2）**：单条增/改/状态切换一律走 `useTodo` 的 `commitTodo(todo)`（upsert + store 局部原位更新 + 带 key 增量重排提醒 + 广播小窗）；删除走 `removeTodo`（**软删除进回收站**）/ `purgeTodo`（物理删除，仅回收站用）/ `restoreTodo`（恢复）。不再「写库后 fetchTodos() 全量重拉」（批量导入/同步刷新/对话框保存仍全量兜底）。
- **状态双写收口（C2）**：任何状态切换必须走 `statusConfig.ts` 的 `applyStatus(item, status, now?)`（一次维护 status/completed/completedTime/updateTime；completedTime 语义=首次完成时刻，再次完成保留旧值）。视图层禁止散落手写四字段。
- **时间统一（C1）**：`src/views/todoList/utils/time.ts` —— `parseTodoDate` / `isOverdueItem(dueDate, isDone)` / `dueSegment`（筛选用，对齐移动端 todo_filter）/ `dueGroupKeyOf`（分组用，多「明天」档）。禁止再造 replace(/-/g,'/')、字符串比较等第三种写法。
- **提醒增量（B4）**：`update-todo-reminders` IPC 可带单个待办 key（字符串载荷）做增量重排；不带 key 全量兜底（批量场景）。主进程 `syncTodoReminders(key)` 已按 key 过滤清理与查询。
- **跨窗口刷新（B1）**：`useTodo` store 内监听 `sync-data-to-other-window`（arg.todoUpdated → fetchTodos）；主进程广播排除发送者，故 commitTodo 不会触发自身重拉。小窗轮询保留作兜底。

### 数据模型（todo_list 新增列，newSql 自动加列）
- `deleted`(TEXT '0'/'1')：**E5 回收站软删除**。回收站内不参与列表/统计/子任务关联/提醒/命令面板；主进程每日 00:05 + 启动时物理清理 30 天前的条目（recurrence.ts `purgeExpiredDeleted`，走 transaction 参数化 DELETE）。⚠️ 与移动端 drift 的 `deleted` 列**必须同批上线**（同步按本表列过滤，单端先上会静默丢列）。
- `focusedMinutes`(TEXT 数字)：**E3 番茄钟联动**。番茄钟小窗在专注段（work→非 work）结束时向 KV 存储 `todo.pomodoroLink` 指向的待办累加（单段上限 180 分钟）；关联入口=卡片/列表 ⋯ 菜单「番茄钟专注此待办」；限制：小窗关窗期间的段不累计。
- `recurrenceMode`(TEXT 'fixed'/'on_complete')：**F2 生成方式**。fixed（缺省）=到点自动生成；on_complete=完成实例后才由主进程补生成下一期（`recurrence.ts generateOnCompleteNext`，挂在 update-todo-reminders 带 key 的调用后；基准日=max(今天,已完成实例 dueDate)，按 模板+dueDate日 去重，超 recurrenceEnd 不生成）。on_complete 模板**不参与**每日懒生成（getTemplates 过滤）。

### 重复任务（E4 扩展）
- 规则扩展为 5 种：daily / weekly / **monthly / yearly**（monthly=按模板当日「几号」，当月无此号跳过；yearly=按「月-日」，2/29 只在闰年命中）。核心公式收口在 `recurrence.ts ruleHit()`（统一 daysDiff>=0 方向约束）+ `nextHitDate()`（F2 用）+ `buildInstance()`（两条生成路径共用）。
- **双端对齐红线**：移动端 `_nextOccurrence` 公式与 PC `ruleHit` 逐字对齐（防双端各自生成→同步后双份实例）；两端同步合并后都有「同 recurrenceId+dueDate 去重」兜底（移动端 `dedupeRecurrenceInstances`，PC 端生成前 `getInstances` 按 dueDate 去重）。

### 视图与筛选
- **逾期高亮（C4）**：卡片/列表/日历弹窗对「未完成且截止已过」条目截止文字标红（`isOverdueItem`）。
- **到期段筛选（D1）**：`store.dueFilter`（overdue/today/thisweek/thismonth/later/nodate），口径与移动端对齐；「已逾期」段额外限定未完成。
- **今日聚焦（D2）**：`store.todayFocus` + `setTodayFocus()`（与 dueFilter 互斥）；命令面板无关键词时首位给「查看今日待办」命令。
- **排序（D7）**：`store.sortMode`（updated/due/priority/created），客户端排序，视图/筛选态一起持久化。
- **视图态持久化（C3）**：`view/groupBy/statusFilter/tagFilters/dueFilter/sortMode/showCompleted/showTemplates` 存 localStorage `todoList.viewState`；todayFocus/highlightKey 等瞬态不存。
- **卡片分批渲染（B3）**：`TodoList.vue` 每批 60 条，el-scrollbar 触底（距底 300px）追加；数据口径（分组/筛选/数量）变化时重置。
- **快捷键（D8）**：页面级 keydown（输入框/isComposing 守卫）：N 新建、Ctrl/Cmd+F 聚焦搜索、Esc 清筛选（弹窗打开时让位给弹窗）。

### 标签 / 批量 / 导出 / 统计
- **saveTag 修复（A4）**：按 name 查命中则携带原 id/key 更新（todo_tags 主键是自增 id，不带 id 的 upsert 永不命中冲突、退化重复插入）；显式带 id（标签管理编辑）直接按 id 更新。返回落库后的最终 Tag（调用方须用返回值的 key 做选中）。
- **标签管理（D5）**：`TagManageDialog.vue` 重命名/改色/删除；删除时清理 todo_list.tags JSON 引用（逐条 upsert）+ 删 todo_tags 行。
- **批量编辑（D6）**：`TodoBatchEditPanel.vue`（与批量删除同款条件模型）批量改状态/优先级/截止/追加标签，逐条 upsert 后一次全量重排提醒。
- **导出（D4）**：`utils/exportTodo.ts` Markdown（按到期段分组+复选框语法）/CSV（BOM+转义），走统一规范 `exportToFile`+`fileNotify`；导出 `store.filteredTodos`（所见即所得）。
- **统计（E1）**：store 扩展 `completionRate/todayDoneCount/overdueCount`；`TodoStatsDialog.vue` 核心指标+近 30 天完成趋势（**零依赖 CSS 柱状图**，非 ECharts）+标签分布。
- **小窗（D9）**：todoMiniWindow 已完成条目保留在列表底部（置灰划线）、点击可重开；完成/重开都显式维护 status 并带 key 重排提醒。

### 命令面板
- `todoSource` 已改走 `new-sql:read`（参数化 SELECT、只读连接、不建表）——❌ 严禁改回 execute；SQL 带 deleted 过滤；无关键词首位「今日待办」命令；无命中时「新建待办：xxx」快速创建（先 fetchTodos 再设 highlightKey，否则滚动定位不到）。

### 特有坑（本批次新增）
- **发 IPC 前必须剥离响应式（方案 B 已根治）**：store 来的 TodoItem 是深层 Proxy（parentIds 数组也是 Proxy），浅展开后发 IPC 会抛「An object could not be cloned」。剥离已收敛到 todoApi 的 ipc() 封装层：payload 整体过 common.ts 的 toPlain()（递归解包 ref/proxy、二进制/Date/Map/Set 原样放行，对齐 send/setStore 系列封装的既有方向），调用方无需各自处理；JSON round-trip 一版方案已弃（破坏 Date/Map/Set、丢 undefined）。
- 主进程 `update-todo-reminders` 监听**只在 recurrence.ts 注册**（initRecurrence 内，提醒重排+on_complete 补生成串联）；newReminder.ts 不再注册，勿重复添加（双监听=双重重排）。
- 批量删除/批量编辑/标签管理/父任务选择的候选集合一律用 `store.activeTodos`（回收站内条目不可见不可选）。
- 统计口径：totalCount/四状态计数/完成率/今日完成/逾期 全部基于 activeTodos（不含回收站）。
- E2「首页今日待办卡」评估后**顺延**：home 视图是主页主题画廊非仪表盘，硬插卡片破坏设计；今日能力由 D2 覆盖。

### 系列配置同步（2026-10-01 补丁·二版，用户拍板语义）
- **修改重复字段 = 整系列生效**：在详情弹窗编辑模板或实例的重复字段（rule/interval/weekdays/end/mode 任一变化）并保存时，渲染端检测变更（`originalTodo` 对比 + `canonicalWeekdays` 规范化比较周几）。
- **同步在渲染端直写**（`TodoDetailDialog.applySeriesConfigSync`）：`new-sql:read`（参数化只读）查模板行 + `recurrenceId` 全部实例，展开整行后只覆盖重复字段与 updateTime，逐行 `new-sql:upsert`；完成后发**裸** `recurrence:sync` 让主进程按新配置补生成。⚠️ 刻意不走主进程新载荷——一版曾放主进程 `recurrence:sync` 载荷分支，因改主进程需重启 Electron 而失效（旧监听器忽略载荷），渲染端直写对重启状态免疫。
- 背景：此前编辑实例只写自身，模板仍按旧配置生成（改了规则后新实例仍按旧周期出现）。规则被清空（改「不重复」）时不同步——模板自身 rule=null 即停止生成。
- **el-radio change 校验警告根治**：element-plus `radioEmits` 对 change 载荷校验 string|number|boolean，「不重复」原用 `:value="null"` 会触发「Invalid event arguments」警告；现经 `recurrenceRuleModel` computed 在边界做 `''` ↔ null 映射。
- ⚠️ 移动端实例本就禁改重复规则，模板编辑路径是否做系列同步为**待定项**（未实现）。
