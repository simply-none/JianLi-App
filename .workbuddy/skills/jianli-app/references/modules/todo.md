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
