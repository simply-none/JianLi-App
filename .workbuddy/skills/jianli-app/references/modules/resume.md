# 简历模块（resume）

## 功能概述
简历编辑与 PDF 导出工具（`/resume`，侧边栏「效率工具」分组）。顶部工具条（左：标题+简历选择+新建 / 右：填充示例+保存+导出 PDF）+ 下方左编辑右 A4 实时预览。支持多份简历管理（切换/新建/重命名/删除，收纳在顶部选择器下拉）。

**原子化排版引擎**（2026-08-31 重构核心）：渲染从「模板硬编码」迁移为「配置驱动」——
- 简历拆分为 模块（6 个，可排序/显隐）→ 组件（章节标题/装饰线/条目头/列表/纯文本/圆点）→ 原子字段（姓名/日期/学校…每个可独立调试：显隐/字号档/字重/灰阶）
- 预览工具条「排版」按钮打开**全屏弹窗**：左侧配置面板、右侧**示例简历（mock）实时渲染**（120ms 防抖），「完成」应用 draft，「取消」丢弃
- 弹窗顶部按钮：**保存**（输入名字，同名覆盖=编辑/新名=新增）、**另存为**（强制新增，同名拒绝）、恢复默认排版；保存的预设进入 `resume_layout_preset` 表
- 主页面「填充示例」左侧有**「选择排版」下拉**（展开时拉取预设列表，`LayoutTemplate` 图标），选中预设即应用到当前简历排版（置 dirty，随「保存」落库）
- 预览纸张 **fit-width 按容器宽度自适应缩放**（非固定 100%），iframe 高度随内容自适应（多页完整展示）
- 默认配置 = 原 compact 视觉（零回归），`mergeConfig` 负责库中存量配置与默认值补全合并

当前模板仍为 **紧凑高效（compact）** 一套（即引擎默认皮肤）；其余灰黑白模板已规划待扩展。

## 入口与文件结构
- 路由：`src/router/index.ts` → `RouteNames.RESUME = "resume"`（layoutRouters，path `/resume`）
- 菜单：`src/layout/index.vue` 与 `src/views/routeSetting/index.vue` 的 groupDefs 效率工具组均含 `resume`（图标 `FileUser`）
- 页面目录 `src/views/resume/`：
  - `index.vue`：入口（工具条 + 编辑/预览两栏），config 状态与保存/切换/导出编排；预览渲染 150ms 防抖
  - `types.ts`：ResumeData/ResumeRecord/ResumeTemplate + **重导出全部排版类型**（消费方统一从这里 import）
  - `db.ts`：数据层（`resume_data` 内容表 + `resume_layout` 排版表）
  - `mock.ts`：虚构示例数据 `createMockResumeData()`（调试 + 排版弹窗预览共用）
  - **`engine/` 排版引擎（纯函数，无 Vue）**：
    - `types.ts` 排版类型（SizeKey/InkLevel/TextStyle/SeparatorStyle/LineDecoration/SectionTitleStyle/EntryHeaderStyle/ListStyle/SkillsDotStyle/BasicsHeaderStyle/ModuleStyle/ResumeLayoutConfig）
    - `tokens.ts` 字号档位（xs…giant，delta 相对正文字号）与灰阶档位（8 档 #1a1a1a→#d9d9d9）映射
    - `defaultConfig.ts` 默认配置（=compact 视觉）+ `mergeConfig` 深合并
    - `components/`：`text.ts`（TextStyle→内联 CSS、字段组+分隔符）、`line.ts`（装饰线：after/below、solid/segment/dashed/dotted、渐细）、`sectionTitle.ts`、`entryHeader.ts`（字段顺序+日期位置）、`bulletList.ts`（dot/dash/number/none）
    - `sections/`：`entrySection.ts`（教育/工作/项目共用工厂）、`basics.ts`、`skills.ts`、`evaluation.ts`、`index.ts`（`renderResume(data, config)` 入口 + 模块注册表）
  - `templates/compact.ts`：薄适配层（mergeConfig → renderResume）
  - `components/`：
    - `ResumeSelect.vue` 顶部选择器；`ResumeEditor.vue` + `editor/*` 编辑器；`ResumePaper.vue` 纸张原子（fit-width + zoom + iframe 高度自适应）；`ResumePreview.vue` 预览工具条（缩放/适应宽度/排版）
    - **`styleDrawer/`**：`StyleDialog.vue` 全屏排版弹窗；`groups/` 原子控件：`TextStyleRow`（字段调试行：显隐+字号档+字重+灰阶色板）、`LineDecorationGroup`、`SeparatorGroup`、`PageStyleGroup`、`SectionTitleGroup`、`EntryHeaderGroup`（字段顺序 chips/日期位置/连接符）、`ListStyleGroup`、`SkillsDotsGroup`、`ModuleList`（模块排序显隐手风琴）、`moduleMeta.ts`（字段元数据）

## 数据存储（SQLite）
- 表 `resume_data`：`id` 自增主键、`name`（唯一索引）、`template_id`、`data`（ResumeData JSON）、时间戳
- 表 `resume_layout`：`id` 自增主键、`resume_id`（**唯一索引**，每份简历一份排版）、`config`（ResumeLayoutConfig JSON）、`updated_at`
- 表 `resume_layout_preset`：`id` 自增主键、`name`（**唯一索引**，命名排版预设）、`config`（JSON）、`created_at`、`updated_at`；`saveLayoutPreset(name, config, {overwrite})` 一体承担新增（overwrite=false）/编辑（overwrite=true）；读取统一过 `mergeConfig` 补全
- 均为显式建表 + 唯一索引模式；`deleteResume` 联动删除对应 layout 行（预设表不随简历删除，是全局方案库）
- 排版配置读取统一过 `mergeConfig`（缺字段回退默认）；「保存」按钮同时落库内容 + 排版

## IPC 通道
| 通道 | 方向 | 说明 |
|---|---|---|
| `resume:export-pdf` | 渲染→主 | `{ html, fileName }` → `{ ok, path?, canceled?, error? }` |

## PDF 导出链路
渲染端 `currentTemplate.render(data, config)` → IPC `resume:export-pdf` → 隐藏 `BrowserWindow`（sandbox）加载 data URL → `printToPDF(A4, printBackground, margins 0)` → 保存对话框（文件名 `简历名-YYYYMMDD-HHmmss.pdf`）→ 写盘。导出前 dirty 自动静默保存（内容+排版）。

## 特有约定 / 坑
- **改主进程需重启 Electron**；引擎/页面改动热重载即可
- **预览与导出必须同源**：都走 `render(data, config)`，且导出前落库保证一致
- 模板 HTML **自包含**：全部内联样式（引擎按配置拼 style 属性），禁止外部资源
- 排版 UI 采用 **draft 直改模式**：StyleDialog 对 config 深拷贝出 reactive draft，子组件直接 mutate props 引用对象 + emit('change') 通知重渲染（务实约定，非严格单向流）；「完成」才 apply 回主状态并置 dirty
- **子组件严禁 setup 时快照解构 model**（如 `const d = props.model`）：父级替换 draft 引用后快照脱节导致「改了没反应」；必须动态访问 `props.model`（模板直接用 prop 名）
- **draft 只在 visible 变化时赋值一次**（watch visible 的 immediate 回调），不要同时绑 el-dialog @open，否则二次替换引用重演脱节
- 渲染兜底：StyleDialog 用 `watch(draft, deep)` 兜底漏发事件 + `renderTick` 递增作为 ResumePaper 的 **key 强制 iframe 重建**（杜绝 srcdoc 更新不重载），渲染输入先深拷贝脱离 proxy
- `ensureField`（ModuleList 内）保证字段覆盖对象为**完整 TextStyle**（defaultConfig 里 fields 是 Partial）
- 引擎 `TextStyle.ink` 用灰阶档位（InkLevel）而非自由色，维持灰黑白基调；新增可调维度先扩 engine/types.ts + tokens.ts
- 字段 id 约定：basics= name/jobIntent/phone/email/gender/age/city；条目模块主字段= school/major/degree、company/position、name/role；`date`、`description`、`skillName`、`text`
- 日期在条目间以 `start|end` 中转（entrySection 提取），最终按 `dateConnector`（–/~ /至/空格）拼接
- 预览防抖 150ms（主页面）/ 120ms（排版弹窗），避免拖滑块高频重渲染 iframe
- `@page A4 margin 0`，页面边距由 `page.paddingX/Y` 控制；body 为 flex column + `sectionGap` 控制模块间距

## 后续扩展（已确认方向）
- 其余 9 套灰黑白模板：新模板 = 一组不同的 defaultConfig 预设（或独立 sections 差异渲染），在 `templates/` 增加适配层并在 `templates/index.ts` 注册
- 排版配置导入/导出（JSON 分享）可在 `resume_layout` 基础上直接扩展
