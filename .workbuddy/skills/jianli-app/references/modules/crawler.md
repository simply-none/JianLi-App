# 新爬虫工具 (crawler)

## 职责
通用网页爬取工具（与旧 `spider-test` 步骤引擎解耦）：打开页面 → 可选点击跳转（自动跟随新标签页/本页跳转）→ 等待加载 → 真实性校验 → 可选页面内抽取 → 可选 HTML 落盘。天气模块是其首个使用方（**天气侧已优先走 `cnweather` HTTP 接口，爬虫降为最后兜底**，见 `weather.md`）。

## 性能设计
- **共享浏览器实例 + 每次爬取独立隐身上下文**（`browser.createBrowserContext()`）：省冷启动的同时 Cookie/存储全隔离，避免反爬随共享状态累积标记身份；`browser.connected` 断连自动重建；`before-quit` 时关闭避免残留进程
  > ⚠️ 旧文档曾误写「每次爬取独立 launch 浏览器」——**实际是共享实例 + 独立 Context**，与本节第一条一致（`getBrowser()` 模块级单例）。
- **href 直取优先，模拟点击兜底**：先 `$eval` 读结果链接 href 后直接 `goto`（跳过可操作性等待与新标签页竞态，不受页面 JS 拦截点击影响），href 无效才回退 locator 点击
- **新标签页竞态**：`waitForNavigation` 与轮询做 `Promise.race`，任一就绪立即继续（修复 target="_blank" 场景 navPromise 白等满超时的 20s 卡点）
- 等待上限收紧：导航检测 10s、readyState 轮询 5s、settle 2s
- 结果含 `elapsed`（总耗时 ms），主进程日志输出「爬取完成: URL, 耗时 Nms」

## 关键文件
- `electron/main/module/crawler.ts`：`crawlPage(options)` 核心引擎、`getBrowser` 共享实例、`saveHtmlToCacheData` 落盘、`initCrawler` IPC 注册
- 使用方：`electron/main/module/weather/providers/crawler.ts`（中国天气网，**两段式**：`data/cnWeatherCodes.ts` 的 citycode **直连优先** → 必应搜索兜底）

## ⚠️ 两处防「进错页面」的关键设计（2026-09-30 加，勿回退）
1. **`clickSelector` 不再包含 `#b_results li:first-child a`** —— 一旦 `pickHref` 未命中中国天气网链接，该兜底会把浏览器点进**任意第三方站点**（实测缓存 `深圳_*_invalid.html` 的 `<title>` 是「深圳天气 - 搜索」、`og:url` 指向 `cn.bing.com/search` ⇒ 压根没离开必应）。命中不了就让链路**直接失败**、交给上层降级，比进错页面更可控。
2. **`waitForSelector: '#hidden_title'` 守卫** —— 该隐藏输入框是中国天气网详情页的标志性元素（也是抽取函数首个分支依据）。它不出现即说明落到了别的页面或结构已变，**应尽早失败**而非白等满超时后抽出一堆无效数据（实测缓存 `天津_*_invalid.html` 即此情形）。
> 从根本上规避该问题的做法是**直连优先**（用 citycode 构造 URL，根本不用搜索引擎）；搜索路径只是城市码未收录时的兜底。

## 用到的 IPC 通道
- `crawler:run`（渲染→主，`invoke`，`CrawlOptions`，**无法传抽取函数**）→ 返回 `{success, reason?, url, title, htmlLength, navigated, elapsed}`

## crawlPage 选项 / 结果
- 选项：`url`（必填）、`clickSelector?`（**支持数组按序尝试**，某个成功跳转即停）、`waitForSelector?`、`timeout?`（默认 30s）、`extract?`（页面上下文函数，**禁止引用外部变量**）、`saveHtml?`、`saveName?`
- 结果：`{success, reason?, url, title, html, navigated, extracted?, elapsed}`，**不抛异常**，失败看 `success/reason`

## 等待与跳转判定（Puppeteer 24 官方策略）
- `goto` 用 `waitUntil: 'domcontentloaded'` 即开始操作（不等整页资源）
- 进入目标页两段式：**A. `$eval(selector)` 读 href 后 goto（优先）**；B. `page.locator(sel).setTimeout(t).click()` 模拟点击（兜底），先挂 `waitForNavigation` 再点击（官方竞态模式）
- 「真正跳转」判定：新标签页出现（targetcreated）或 `origin+pathname` 变化——**忽略 query/hash**，避免必应同页参数变化被误判
- 点击后等待链（提速关键，不用长 networkIdle）：URL 离开 about:blank → readyState 轮询至 complete（上限 5s）→ `waitForNetworkIdle({idleTime:400, timeout:2000})` 短 settle（超时即视为就绪）

## 真实性校验（判断是否真的爬到网页）
1. 配置了 `clickSelector` 时：所有候选选择器都没引发真跳转 → 失败「点击后未发生页面跳转」
2. HTML 长度 < 500 → 失败「疑似空页面」
3. `waitForSelector` 配置后未出现 → 失败

## 落盘约定
`saveHtml: true` 时**无论爬取成败**，最终所在页面的完整渲染后 DOM 都写入项目 `cache-data/`（`{saveName}_{时间戳}.html`，失败文件带 `_invalid` 后缀）；`page.content()` 返回的就是渲染后 DOM（含 script 标签属正常）。

## 特有坑 / 注意
- **共享浏览器实例 + 独立 Context**（非每次 launch）；高频调用需自行加缓存/节流
- `extract` 函数会被序列化注入页面，引用外部变量会静默失败
- 主进程改动需重启 Electron 生效
- **`waitForSelector` 是「落地页正确性」的唯一守卫**：搜索引擎结果页结构多变，爬取前务必想清楚「目标页的标志性元素是什么」并配置它
