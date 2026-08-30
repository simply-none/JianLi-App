# 数据获取 (dataAcquisition)

## 职责
基于 Puppeteer 24 的**任务化网页采集**引擎 + 可视化配置页面：JSON 规则描述式抽取（选择器/属性/变换管道）、XHR/Fetch 接口捕获、四种分页、有头登录态管理、实时进度推送、结果预览/历史/CSV 导出。与天气爬虫 `crawler.ts` **完全独立**（各自浏览器实例），天气模块零改动。

## 关键文件
- 主进程 `electron/main/module/dataAcquisition/`：
  - `types.ts`：全部共享类型（与渲染端 types 结构一致，JSON 可序列化）
  - `browser.ts`：独立共享浏览器（断连重建/代理签名变化重建）、信号量并发（maxConcurrent）、反检测注入（抹 webdriver/伪造 plugins）、有头登录会话（openLoginSession → finishLoginSession 存 Cookie 到 electron-store `scraper-login:{档案名}`）
  - `rules.ts`：抽取核心。选择器走 Puppeteer 原生 $/$$（**天然支持 P 选择器** `text/` `xpath//` `aria/` `>>>`）；取值函数为页面内静态函数 `getElValue(el, attr)`；变换管道（trim/replace/number/date/split）在 Node 端执行；**两级抽取**：记录级 rules + 可选 `groups`（ItemGroup 提取项容器组，每条记录内 `组名: 子项数组`，返回全部子项而非第一个）；`attachCapture` 监听 response 仅捕 JSON、`captureToRecords` 按 dataPath 提取
  - `engine.ts`：任务流水线（并发槽位 → 建页/Cookie 注入 → 逐页：goto → waitForReady → scroll/交互 → 调试快照（提取现场）→ 抽取 → 快照/截图 → 分页推进 → 随机延时）；交互动作 14 种：input/click/doubleClick/hover/select/press/scroll/scrollTo/wait/waitSelector/waitNavigation/newTab（切换新标签页并接管后续操作）/back/reload；`runningTasks` 取消标记表；测试模式强制单页
  - `index.ts`：`initDataAcquisition()` IPC 注册 + before-quit 清理
- 渲染端 `src/views/dataAcquisition/`：
  - `types/index.ts`、`db.ts`（scraper_tasks / scraper_history，幂等建表 + pragma 补列）、`config/defaults.ts`（默认配置工厂）
  - `composables/useTask.ts`（**模块级单例订阅** scraper:task-progress / task-result 推送，runningMap 实时状态）、`composables/useHistory.ts`（历史 + buildCsv BOM + exportRecords 复用 `net-request:save-file`）
  - `components/`：`sidebar/TaskList`、`config/TaskConfigPanel`（**按浏览器使用流程分步**：①打开网页（URL/数据源/页面等待）→ ②模拟浏览操作（交互步骤）→ ③提取结果（**ExtractEditor**：记录字段/提取项容器芯片切换+默认第一个，记录容器/字段规则/接口捕获，**作用于②执行完后的最终页面**）→ ④分页；含 RuleEditor/ActionPanel/PaginationPanel/AntiCrawlPanel + JSON 高级编辑 + ConfigGuide 可折叠说明）、`run/RunPanel`、`result/ResultView`（动态列表格+JSON 双视图+分页）、`history/HistoryPanel`（查看弹窗/重跑）

## 路由 / 菜单
- `RouteNames.DATA_ACQUISITION` → `/dataAcquisition`，菜单组「开发工具」，iconMap 用 `Radar`（已验证存在于 @lucide/vue 并加入 LucideIcon nameMap）
- 命令面板 routeSource 由 layoutRouters 自动派生，无需单独注册

## 用到的 IPC 通道（preload `scraper.*` 命名空间）
| 通道 | 方向 | 用途 |
|---|---|---|
| `scraper:run-task` | 渲染→主 invoke | { taskId, config, mode: run/test }，异步执行立即返回 |
| `scraper:stop-task` | 渲染→主 | 设取消标记，下一检查点退出 |
| `scraper:task-progress` | 主→渲染 send | { taskId, status, page, recordCount, phase, log } |
| `scraper:task-result` | 主→渲染 send | ScrapeTaskResult（records 全量带回） |
| `scraper:login-start` / `login-finish` / `login-cancel` / `login-list` / `login-delete` | 渲染→主 | 有头登录态管理 |
| `scraper:get-settings` / `set-settings` | 渲染→主 | 全局设置（electron-store `scraper-settings`：headless/proxy/maxConcurrent/timeout/userAgent） |
| `scraper:reveal-file` | 渲染→主 | 在文件管理器中定位文件（导出成功提示的文件链接点击跳转） |
| `net-request:save-file` | 渲染→主 | JSON 导出复用（text 写盘，返回 `{ success, path }`） |

## 持久化
- SQLite `scraper_tasks`（name 唯一索引 uq_scraper_task_name；**编辑任务按 id UPDATE 支持改名**，新建才按 name 幂等；重名冲突抛友好错误）、`scraper_history`（保留最近 100 条，data 超 2MB 截断为 []）
- 导出为 JSON 文件（`任务名-时间.json`，保留记录层级含项容器数组；成功提示 duration 5s + 可点击文件链接 → `scraper:reveal-file`）
- electron-store：`scraper-settings` 全局设置、`scraper-login:{档案名}` Cookie 档案
- 快照/截图落 `cache-data/`（复用 crawler.ts 导出的 `saveHtmlToCacheData`）

## 特有坑 / 注意
- **改主进程需重启 Electron**；渲染端热重载即可
- 引擎为独立实例，勿与 `crawler.ts` 的单槽位新标签页路由混用（并发互扰）
- 变换下拉仅 3 个预设（trim/number/date），replace/split 需走「JSON 配置（高级）」面板手工编辑
- ResultView JSON 视图超 20 万字符截断；历史 data 超 2MB 不落库
- 代理/无头设置变化时共享浏览器自动关闭重建（签名比对），进行中任务不受影响（各自上下文）
