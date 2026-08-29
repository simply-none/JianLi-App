# 网络请求工作台 (netRequest)

## 职责
Postman 风格的 HTTP / WebSocket 调试工作台。支持：请求方法/URL/参数/头/四种 Body、认证、请求设置、前置/后置脚本断言、环境变量 `{{var}}` 替换、请求历史、集合（文件夹树）、代码片段导入（5 种）/Postman/OpenAPI。旧的 `api-test`（axios 接口测试）与 `spider-test`（puppeteer 爬虫步骤）已于 2026-08 重构时移除，HTTP 请求统一走 `net-request:send`（主进程 axios），浏览器爬取能力由 `crawler.ts` 模块承接。

## 关键文件
- `src/views/netRequest/index.vue`（页面入口：模式切换 HTTP/WS、环境栏、侧边栏、工作区、保存/导入弹窗）
- `src/views/netRequest/types/index.ts`（全部 TS 类型，RequestConfig 是落库核心 JSON）
- `src/views/netRequest/db.ts`（SQLite 三表建表校验 + CRUD：`net_request_history` / `net_request_collection` / `net_request_env`）
- `src/views/netRequest/composables/`：
  - `useRequest.ts`（发送流水线：前置脚本 → 组装载荷 → IPC → 后置断言 → 写历史；`copyAsCurl`）
  - `useHistory.ts` `useCollection.ts` `useEnvironment.ts` `useImport.ts`（5 种代码片段 + Postman/OpenAPI 解析）`useWebSocket.ts`
- 组件（细粒度拆分）：
  - `components/request/`：`UrlBar` `RequestTabs` `ParamsTab` `HeadersTab` `BodyTab`（+`body/FormDataTable`）`AuthTab` `ScriptTab` `KeyValueTable` `SaveRequestDialog`
  - `components/response/`：`ResponsePanel` `ResponseStatusBar` `HeadersTable` `JsonViewer`（+`JsonNode`）`ResponseActions`
  - `components/sidebar/`：`index` `HistoryPanel` `CollectionPanel` `CollectionTree`（递归树）
  - `components/env/`：`EnvBar` `EnvDialog`
  - `components/import/ImportDialog.vue`、`components/ws/WsPanel.vue`（+`WsMessageList`）
- 主进程：`electron/main/module/netRequest.ts`（`initNetRequest()`）

## 路由
- `RouteNames.NET_REQUEST` → path `/netRequest`

## 用到的 IPC 通道（handle/promise 风格）
- `net-request:send`：发 HTTP 请求（主进程 axios，arraybuffer 接收后按 content-type 解码；支持 followRedirects / validateSsl / timeout）
- `net-request:ws-open` / `ws-send` / `ws-close`：WebSocket 测试（使用 Electron 36 内置 WebSocket，未装 ws 包）
- `net-request:pick-file`：选择 binary 文件；`net-request:read-file`：读取文件内容

## 持久化（SQLite，经 newSql 的 dbRun/dbQuery）
- `net_request_history`：method/url/status/time/size/config(JSON)/created_at
- `net_request_collection`：parent_id/node_type(folder|request)/name/method/url/config(JSON)/sort
- `net_request_env`：name/vars(JSON)/is_active
- 注意 `db.ts` 有 `ensureTables()` 幂等建表 + `pragma_table_info` 缺列补齐（遵守 db-pitfalls：PRAGMA 用 SELECT 形式）

## 复用 / 集成点
- 环境变量替换用 `{{变量名}}` 占位，URL/头/参数/Body 均生效。
- 集合树 `CollectionTree.vue` 是递归组件，depth 默认 0（withDefaults）；支持任意层级嵌套集合，节点行点击切换展开、菜单「新建子文件夹」创建二级/多级集合；`CollectionPanel.vue` 通过 `expandAll`+`expandSignal`（信号自增 + watch）实现全部展开/收起。
- 保存弹窗 `SaveRequestDialog.vue`：目标集合为 el-tree-select（根目录 value=0 内置节点 + DB 文件夹树）；「新建」按钮内联创建集合于当前选中集合下，`createFolder` 返回新 id（`insertCollectionNode` → lastID）经 `onDone` 回调自动选中；名称默认取 URL 末段，UUID/超长哈希/长数字段自动回退（`deriveName`）。
- 命令面板 REGISTRY 可跳转本页。

## 代码片段导入（5 个子页签，2026-08 新增）
「导入接口」弹窗的「代码片段」大类下分 5 个子页签，均解析为单个 `RequestConfig` 并回填请求编辑区：
- `cURL (cmd)`：`^` 续行、仅双引号、`\"` 转义 → `parseCurlCmd`
- `cURL (bash)`：`\` 续行、单/双引号 → `parseCurl`（与 cmd 共用 `parseCurlTokens` 核心 + `tokenize(text, { singleQuote })`）
- `fetch`（浏览器）/ `fetch (Node.js)`：共用 `parseFetchCode` 核心 → `parseFetch` / `parseFetchNode`；解析 `fetch('url', { method, headers, body })`，body 兼容字符串字面量与 `JSON.stringify(...)`，先摘除 body 片段再识别 method/headers 防误匹配
- `PowerShell`：`Invoke-RestMethod / Invoke-WebRequest`，支持 `-Uri/-Method/-ContentType/-Headers`（内联 `@{...}` 或 `$var` 声明）/`-Body`（here-string、引号字符串、`$var`、`@{...}` 转 JSON）→ `parsePowerShell`
- 统一入口 `parseCodeSnippet(kind, text)`，类型 `CodeSnippetKind`；辅助函数 `readJsString`（JS 字符串转义读取）、`extractBalanced`（括号配平提取）也在 `useImport.ts` 内
- UI：`ImportDialog.vue` 中 format='code' 时显示 5 个 `el-radio-button` 子页签（`codeKind` ref），每个子页签有专属占位示例；成功后 emit 'curl' 回填，与旧 cURL 流程一致

## 特有坑 / 注意
- 渲染端禁止 import electron/*；文件选择/读取必须走 IPC。
- 保存集合时区分「新建」与「更新」：从集合加载请求后 index.vue 会记录 `editingNodeId`，再保存即更新原节点。
- 主进程 `netRequest.ts` 改动需重启 Electron；渲染端热重载即可。
