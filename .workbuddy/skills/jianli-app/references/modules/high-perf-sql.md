# 高性能数据库查询 (highPerfSql)

## 职责
数据库管理工作台：左侧表导航（数据表+行数 + 高级开发者分组）+ 主区分页（数据/表结构/高级SQL/可视化）+ 状态条。按 2026-09 设计稿重构，替换了旧「操作类型九宫格」构造（OperationSelector.vue 已删除）。

## 壳层规格（严格对齐 Ardot 帧 3:2/3:3/3:4/3:5/3:29/3:30）
- 顶栏 56px：数据库图标（Lucide `Database` 蓝色）+ 标题 18 Bold + `db.sqlite` 徽标（primary-light 底 radius6）+ 右侧 ghost 36px 按钮 ×2 + 新建表（带 `0 4px 10px` 蓝阴影）。
- 主体 `padding 16 / gap 16`；**主区无大白卡包裹**——横幅/页签/工具栏卡/表格卡平铺在页面底色上，`wb-main` 只负责 `flex column gap 12`。
- 上手横幅在**主工作区内**（非横跨整页）：primary-light 底 + 深色 13px Medium 文案 + 蓝色「知道了」。
- 页签 44px 高 / gap 24 / 14px 字号，active 700 + **32px 居中短下划线**（非全宽）。
- 左导航 260px / radius 12 / 内边距 12：搜索 36px bg-base；分组标题 13 SemiBold + 计数徽标；表项 40px（active primary-light 底 + 名/数全蓝）；1px 分隔线；高级项 34px。
- 状态条 30px：8px 绿点 + 12px 文案。
- DataBrowser：工具栏独立白卡（radius 8 padding 10，搜索 36 bg-base，按钮 34px **radius 6**，删除红描边）；表格卡表头 44 / 行 48；**分页栏 48px 在表格卡内** border-top。
- 新建表弹窗（3:225）：560px / radius 16 / padding 24 gap 18 / 步骤指示（22px 圆点 ①表名→②字段→③确认）/ **底色输入无边框**（表名 40px、字段 36px）/ 主键徽标 / 蓝描边添加字段 / 底部提示+取消+创建表。
- 用法指南抽屉（3:282）：460px / 头 56px（16 Bold + 32px 方形关闭钮）/ 内容 padding 20 / 蓝色引导卡 radius 12 / 橙色高级提示卡与绿色小贴士卡带同色描边。

## 关键文件
- `src/views/highPerfSql/index.vue`：**工作台壳**（顶栏 用法指南/刷新/新建表、上手横幅、左导航挂载、分页切换、高级面板区、状态条 `lastOp`、共用 execute/explain → ResultPanel）
- `src/views/highPerfSql/components/`：
  - `TableNav.vue`（搜索+数据表列表+行数徽标+高级组：索引/视图/触发器/事务/并发测试/SQL控制台）
  - `DataBrowser.vue`（**数据分页**：行级 CRUD + LIKE 搜索 + 分页 + CSV 导出 + 列头点击排序（ASC→DESC→取消循环）+ 双击行进编辑；`rowidOk` 守卫——表无 rowid 时自动降级 `SELECT *` 并禁用编辑/删除按钮）
  - `StructureView.vue`（**表结构分页**：字段清单 + 添加字段（ALTER ADD COLUMN）+ 建表语句 DDL 查看/复制（`sqlite_master` 查询）+ 删除表（checkbox 双重确认 → `DROP TABLE IF EXISTS` → emit `dropped`））
  - `UsageDrawer.vue`（右侧用法指南抽屉）、`CreateTableDialog.vue`（新建表）
  - **高级面板已全部按设计稿帧 3:346~3:457 重写**（Ardot file 729700540498994；Element Plus 旧皮已淘汰）。统一规格：**面板自带头部**（`.pnl-header` 56px：16px Bold 标题 + 12px 状态副标题 + 右侧主按钮，index.vue 不再套 `.adv-panel-title`）、面板体 `.pnl-body`（padding 16 20 / gap 16）、白底卡 `.dcard`（border+radius10，`tinted` 变体 #F9FAFB）、表格卡 `.dtable`（40px 表头 bg-hover + 44px 行）、表单 `.dform/.dlabel/.dinput`（36px 输入）、深色编辑器 `.dcode`（#1E283C 固定两主题）、分段 `.seg`（32px active 蓝底）、按钮 `.pb sm/md/block`（含 `pb-green/pb-red-ghost/pb-blue-ghost/pb-gray`）、开关 `.toggle` 36×20。
  - 各面板：`SqlExecutor`（编辑器+执行行+快捷探查 PRAGMA+历史）、`IndexManager`（索引表：pragma_index_list/index_info 真实清单；表单含复合列/唯一开关/部分索引 WHERE）、`ViewManager`（视图表 sqlite_master+预览展开 DDL）、`TriggerManager`（触发表+时机·事件从 DDL 正则解析）、`TransactionManager`（BEGIN/COMMIT/ROLLBACK+BEGIN 模式分段+SAVEPOINT+未提交语句清单）、`ConcurrencyTester`（并发/超时/自定义语句/journal_mode/busy_timeout 分段+进度/统计/结果表+CSV/JSON/MD 报告）、`ResultPanel`（原生 tabs+表格+分页+导出，expose `addLog`）、`QueryBuilder`（props `tables: string[]` + `tableFields`）
  - 共享样式：`components/panel.scss`（`pnl-*/dcard/dtable/dform/dinput/dcode/seg/pb/toggle` + 旧 `ap-*` 供 QueryBuilder），组件内 `@use "./panel.scss" as *;` 进 scoped 样式（**禁用 `@import`**，Dart Sass 3.0 将移除，dev 控制台会刷弃用警告）
  - **高级面板设计帧细节定案（2026-09-26 逐帧复核）**：
    - 面板 `.pnl` 是白色整卡（bg-card / radius 12），不透出页面灰底。
    - **`.pnl-body` 子项一律 `flex-shrink: 0`**（panel.scss 已内置 `> * { flex-shrink: 0 }`）：面板体靠自身 overflow-y 滚动；否则内容超高时 textarea.dcode 这类表单控件会被 flex 压扁（表单控件 min-content 高度极小、内部可滚），出现「深色输入框被遮挡/裁字」。
    - 索引表（3:346）与触发表（3:394）**只有 4 列、无「操作」列**，列宽固定 240/160/140/100（触发器 80）；删除按钮 `.row-del` 悬停行尾才显示（panel.scss 共享）。视图表（3:370）保留「预览·删除」操作列。
    - 表单卡标题（新建索引等）**左对齐**（标题行 hug_contents 靠左），不要居中。
    - 底部导出行 `.exp-row` **靠左**（所有帧的导出行均无对齐属性 = 默认 MIN）；并发测试报告导出带「报告导出」标签 + CSV/JSON/MD 三钮。
    - `v-else` 与 `v-for` 禁止同元素混用（Vue 3 v-if 优先，行为怪）——空态/行渲染用 `<template v-else>` 包裹。
    - index.vue：**上手横幅只在分页主区分支**（`v-else` 内），高级面板不显示；**高级面板下方不再有 ResultPanel**（设计帧止于「导出 SQL」），结果区只在 SQL 控制台内。
  - **props 约定**：所有面板 `tables` 一律 `string[]`；IndexManager/QueryBuilder 另收 `tableFields: Record<string, {name,type}[]>`（index.vue 的 `loadAllFields` 提供）
  - ~~`OperationSelector.vue`~~、~~`DataEditor.vue`~~、~~`TableManager.vue`~~ 已删除（被 DataBrowser/StructureView/CreateTableDialog 取代）
- `src/views/highPerfSql/visual/`：可视化流水线模块（见下节）
- 主进程：`electron/main/module/newSql.ts`（所有 `new-sql:*` 的 `ipcMain.handle`）

## 数据通道安全约定（DataBrowser 落地时确立）
- **任意表的行级读写在 DataBrowser 里不走 `new-sql:query/update/delete/insert`**，原因是这些通道会 `ensureTableExists(tableName)`：默认主键 `id`，**表里没有 `id` 列时会被自动 `ALTER ADD COLUMN id` + 建唯一索引（污染用户表）**；`query({SqlStr})` 还会先建表（表名打错 → 垃圾表）。
- DataBrowser 的通道：读 `new-sql:read`（`SELECT rowid AS __rid, *`，参数化 LIKE，LIMIT/OFFSET）；增/改/删 `new-sql:transaction`（参数化 INSERT/UPDATE/DELETE，无 ensure、原子）；DDL（CREATE TABLE / ALTER ADD COLUMN）走 `new-sql:execute`——`extractTableName` 只匹配 SELECT/INSERT/UPDATE/DELETE 前缀，CREATE/ALTER/DROP 不会触发自动补列。
- `new-sql:read`：仅 SELECT、走 `getReadDb` 只读连接、支持 params、不 ensure（`readSql`）。

## 路由
- `RouteNames.HIGH_PERF_SQL` → path `/highPerfSql`

## 用到的 IPC 通道（均经 `newSql.ts`）
- `new-sql:listTables`、`new-sql:tableInfo`、`new-sql:query`、`new-sql:count`、`new-sql:insert`、`new-sql:upsert`、`new-sql:update`、`new-sql:delete`
- `new-sql:execute`（执行任意 SQL，本模块**刻意**使用，作为高级执行器）
- `new-sql:explain`、`new-sql:transaction`、`new-sql:execute` 之外的 `new-sql:explain`
- 另有 `new-sql:record-pomodoro`、`new-sql:execute`（带 `primaryKey`）、`new-sql:listTables` 等全部见 `newSql.ts`

## 复用 / 集成点
- 普通业务模块的数据读写应通过 `src/utils/newSql`（内部走 `new-sql:query/upsert/delete` 等封装），**不要裸调 `new-sql:execute`**；本模块是唯一的「 sanctioned 执行器」，供开发手动跑 SQL。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- **约定特例**：项目约定「严禁裸 `new-sql:execute`」，但 highPerfSql 是官方放开的执行器（用户主动写 SQL）。普通模块若需执行 SQL 必须走 `newSql` 封装或 `new-sql:query/upsert/delete`，否则破坏参数化、易 SQL 注入。
- `new-sql:execute` 返回的字段结构与其他 `new-sql:*` 不同，前端需分别解析（见 `ResultPanel`/`SqlExecutor`）。
- 并发压测（`ConcurrencyTester`）会高频发 `new-sql:execute`，注意主进程 SQLite 串行化，压测值仅作参考。

## 可视化流水线（第 13 个操作入口，SQL 教学模式）
- 定位：**教用户数据库操作**——节点即真实 SQL 子句（FROM/WHERE/GROUP BY/SELECT/INSERT），图 → SQL 确定性编译，不是虚拟业务层流水线。
- 代码：`src/views/highPerfSql/visual/`（模块化拆分，避免单文件过大）：
  - `types.ts`：节点数据模型（`PipelineNodeData`/`NodeKind`/`KIND_META` 颜色表）
  - `compiler.ts`：**纯函数编译器**（图→SQL；值一律 `?` 参数化、标识符双引号包裹；`probeCountSql` 生成节点级探针 COUNT；`connectionError` 校验连线方向）
  - `api.ts`：IPC 薄封装（读 `new-sql:read`、写 `new-sql:transaction`、自省 listTables/tableInfo）
  - `VisualPipeline.vue`：编排器（VueFlow 画布 + 工具栏 + 状态）
  - `components/`：`SqlClauseNode`（自定义节点，片段+探针徽标）、`NodeLibrary`（子句库芯片）、`PropertyPanel`（按 kind 分区表单）、`SqlPreviewBar`（底部实时 SQL）、`PipelineResultTable`（结果表，预览 200 行）、`WriteConfirmDialog`（写双重确认弹窗）
- 入口：`OperationSelector` 新增 `visual`（icon `Workflow`）；选中时 `index.vue` 独占内容区渲染 `VisualPipeline`（不走共用 ResultPanel）。
- 新增 IPC：**`new-sql:read`**（`newSql.ts` 的 `readSql`）——仅允许 SELECT、走 `getReadDb` 只读连接、支持 params 参数化、**不调 `ensureTableExists`**（区别于 `query({SqlStr})`：后者表名写错会建垃圾表且不支持参数）。写路径复用既有 `new-sql:transaction`（runInTx+withWriteLock，失败回滚），语句形如 `INSERT INTO 目标 (输出列) SELECT ...`。
- 交互约定：FROM 唯一且不接受入边；INSERT 不接出边；连线方向须符合执行顺序；写操作默认禁用（工具栏「允许写操作」开关）+ 弹窗双重确认。
- 模板持久化：V1 存 `localStorage`（key `sql-pipeline-templates`），后续可迁 SQLite `sql_pipeline` 表。
- 坑：VueFlow 样式必须引入（`VisualPipeline.vue` 底部非 scoped style 已独立 `@import` 两个 css，不依赖 flow 页面）；自动整理动态 import `../../flow/useLayout`（dagre LR）。
