# 网络请求 / 爬虫测试 (netRequest / spider)

## 职责
「网络请求」页提供两种能力：① 纯接口测试（`api-test`，axios 发请求）；② 浏览器自动化爬虫（`spider-test`，puppeteer 连本地已开浏览器或启动新浏览器按步骤操作）。两者结果都经主进程回推渲染端。

## 关键文件
- `src/views/netRequest/index.vue`（入口，`api-test` 行 83/92）
- `src/views/netRequest/browser.vue`（爬虫面板，`spider-test` 行 155，结果监听 161–185，`browser:req-steps` 存取 149/185）
- `src/views/netRequest/stepSelector.vue`（`api-test`/`spider-test` 行 93/103，`get-file-list` 行 67，`query-data` 渲染端监听）
- `src/views/netRequest/columns.vue`、`stepSelector.vue`（步骤配置）
- 主进程：`electron/main/module/apiTest.ts`（`api-test` 行 14、`spider-test` 行 57，puppeteer 逻辑）

## 路由
- `RouteNames.NET_REQUEST` → path `/netRequest`

## 用到的 IPC 通道
- `api-test`（渲染→主，`send`，请求参数）→ 主进程 axios 后 `webContents.send('api-test', data)` 回推（渲染端 `on('api-test')` 收）
- `spider-test`（渲染→主，`send`，`{steps, commonParams}`）→ puppeteer 执行，回推 `spider-test`/`spider-test:request`/`spider-test:response`/`spider-test:getData`
- `get-file-list`（渲染→主，`sendSync`，`'select-dir'`）→ 目录选择（`dialog.ts`）
- `set-store` / `get-store`（`browser:req-steps`）持久化爬虫步骤
- `query-data`（渲染端 `on`，历史记录回显）

## 复用 / 集成点
- 复用 `dialog.ts` 的 `get-file-list` 选目录；步骤持久化复用 `set-store`/`get-store` 约定。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- `spider-test` 需要本地浏览器开启远程调试（`--remote-debugging-port=10853`，见 `apiTest.ts` 注释）；不配 `executablePath` 时默认连当前浏览器，连不上会失败。
- 本模块多处**直接** `window.ipcRenderer.send(...)` 而非走 `src/utils/common.ts` 的 `send()` 封装，新代码建议统一用 `send()`。
- `spider-test` 回推通道是 `webContents.send` 到主窗口，若主窗口关闭/路由切换会丢结果，需自行处理订阅生命周期。
