<template>
  <el-collapse class="config-guide">
    <el-collapse-item name="guide">
      <template #title>
        <span class="guide-title">📖 任务配置说明（点击展开完整文档）</span>
      </template>

      <div class="guide-body">
        <h4>1. 基础信息</h4>
        <ul>
          <li><b>任务名</b>：保存的唯一标识，重名保存即更新同名任务</li>
          <li><b>起始 URL</b>：采集入口地址；分页方式为「URL 模板」时可写 <code>{page}</code> 占位符（如 <code>https://a.com/list/{page}.html</code>），或填「页码参数名」由引擎自动追加 <code>?page=N</code></li>
          <li><b>数据源</b>：
            <ul>
              <li><b>页面规则（DOM）</b>：解析渲染后的页面元素，适合静态结构或需要模拟操作的场景</li>
              <li><b>接口捕获（XHR/Fetch）</b>：监听页面发出的接口请求并截获 JSON 响应，适合 Vue/React 等前后端分离站点（数据来自接口时比解析 DOM 更稳、更全）</li>
            </ul>
          </li>
          <li><b>记录容器</b>（仅 DOM 模式）：列表条目的公共父选择器（如 <code>.item</code>），每个容器产出一条记录，字段选择器在容器内<b>相对</b>匹配；留空则为「扁平模式」，整页产出一条记录。<b>注意</b>：容器必须真实存在于「抽取那一刻」的页面上（如交互跳转/翻页后容器可能已消失），匹配 0 个会直接报错提示</li>
          <li><b>提取项容器</b>（可选，可多个）：在记录容器（或整页）内再匹配多个子项，每个子项产出一组字段，<b>以数组返回全部子项而非第一个</b>；适合一条记录里还要收集多条子信息（如详情页的相关新闻列表）。点击「记录字段/提取项容器」芯片切换编辑区</li>
        </ul>

        <h4>2. 字段规则（DOM 模式，作用于最终页面）</h4>
        <ul>
          <li><b>字段名</b>：结果记录中的键名（如 <code>标题</code>、<code>价格</code>）</li>
          <li><b>选择器</b>：支持完整 CSS 选择器与 Puppeteer P 选择器（见下节）</li>
          <li><b>取值属性</b>：<code>text</code> 文本 / <code>html</code> 内部 HTML / <code>outerHTML</code> / <code>href</code> 链接（自动转绝对地址）/ <code>src</code> 图片 / <code>value</code> 输入值 / title、alt、data-* 等任意属性</li>
          <li><b>允许缺失</b>：元素不存在时该字段留空（勾选后不会因个别元素缺失而中断）</li>
          <li><b>多值</b>（仅扁平模式）：命中多个元素时取全部产出数组</li>
          <li><b>变换管道</b>：取值后按序处理——<code>trim</code> 去首尾空格 / <code>number</code> 提取数字（"¥12.5"→12.5）/ <code>date</code> 转标准日期格式；<code>replace</code> 正则替换、<code>split</code> 分割取段需在「JSON 配置（高级）」中手工编辑</li>
        </ul>

        <h4>3. 选择器语法（P 选择器）</h4>
        <table class="selector-table">
          <thead>
            <tr><th>写法</th><th>说明</th><th>示例</th></tr>
          </thead>
          <tbody>
            <tr><td><code>.class #id tag</code></td><td>标准 CSS 选择器</td><td><code>div.list > a.title</code></td></tr>
            <tr><td><code>text/文本</code></td><td>按可见文本匹配（最智能的元素）</td><td><code>text/评分</code></td></tr>
            <tr><td><code>xpath//表达式</code></td><td>XPath 表达式</td><td><code>xpath//span[@class="num"]</code></td></tr>
            <tr><td><code>aria/名称</code></td><td>按无障碍角色/名称匹配</td><td><code>aria/搜索</code></td></tr>
            <tr><td><code>a &gt;&gt;&gt; b</code></td><td>穿透 Shadow DOM（Web Components 页面必备）</td><td><code>my-widget &gt;&gt;&gt; .inner</code></td></tr>
          </tbody>
        </table>

        <h4>4. 接口捕获设置（network 模式）</h4>
        <ul>
          <li><b>URL 正则</b>：接口地址匹配规则（如 <code>/api\/list</code>），只捕获 content-type 为 JSON 的响应</li>
          <li><b>请求方法</b>：可按 GET/POST 过滤，留空不限</li>
          <li><b>数据路径</b>：响应 JSON 内记录数组的位置，点号分隔（如 <code>data.list</code>）；留空取整个响应体</li>
          <li><b>捕获上限</b>：最多捕获的响应条数（防内存失控）</li>
        </ul>
        <p class="tip">提示：不知道接口地址时，可先运行一次（任意正则如 <code>.</code>），从浏览器 DevTools 的 Network 面板确认真实接口后回填。</p>

        <h4>5. 页面等待</h4>
        <ul>
          <li><b>加载策略</b>：<code>DOM 就绪</code>（快，默认）/ <code>load</code> 全部资源 / <code>networkidle2</code> 网络连接≤2 / <code>networkidle0</code> 网络全空闲（最慢最完整）</li>
          <li><b>特征选择器</b>：该元素出现才继续抽取（推荐填列表容器，比固定延时更可靠）</li>
          <li><b>选择器超时</b>：特征选择器最长等待时间，超时不阻断（交由抽取结果反映）</li>
          <li><b>网络缓冲(ms)</b>：加载后的额外缓冲，等待残余请求（如懒加载图片/接口）</li>
        </ul>

        <h4>6. 交互步骤（模拟人类浏览，导航到目标页面）</h4>
        <ul>
          <li>整体流程遵循<b>正常使用浏览器的顺序</b>：① 打开网页 → ② 一连串浏览操作（搜索→点结果→进列表→点进详情…）→ ③ 到达最终页面后提取 → ④ 分页重复</li>
          <li><b>记录容器、字段规则、接口捕获都只作用于第②步全部执行完后的最终页面</b>（如新闻详情页），与起始网页无关；调试快照即提取那一刻的页面现场</li>
          <li><b>输入 input</b>：向选择器填入文本（如搜索框填关键词）</li>
          <li><b>点击 click / 双击 doubleClick</b>：点击/双击元素（提交搜索、点进链接、展开折叠）</li>
          <li><b>悬停 hover</b>：鼠标悬停（触发下拉菜单、悬浮卡片）</li>
          <li><b>下拉选择 select</b>：原生 select 下拉框选中某项（填选项 value 值）</li>
          <li><b>按键 press</b>：模拟键盘按键（如 <code>Enter</code> 回车提交）</li>
          <li><b>滚动 scroll / 滚动到元素 scrollTo</b>：滚到页面底部触发懒加载，或滚到指定元素位置</li>
          <li><b>后退 back / 刷新 reload</b>：浏览器后退、刷新当前页面</li>
          <li><b>切换到新标签页 newTab</b>：点击 <code>target=_blank</code> 链接会新开页签，此步骤等待新页签出现并切换过去（之后的操作和提取都发生在新页签）；注意要先「点击」再「切换」，且不能省略</li>
          <li><b>切换到目标标签页 switchTab</b>：在已打开的页签中按 URL 或标题关键字匹配切换（支持正则，如 <code>msn\.com</code>）；适合新页签已经打开、或需在多个页签间来回的场景；匹配不到会直接报错并列出当前页签数</li>
          <li><b>等待元素出现 waitSelector</b>：智能等待，元素一出现立即继续（推荐代替固定等待）</li>
          <li><b>等待跳转 waitNavigation</b>：等待页面跳转完成再继续</li>
          <li><b>固定等待 wait</b>：固定延时（ms），给前序操作留出渲染时间</li>
        </ul>

        <h4>7. 分页设置</h4>
        <ul>
          <li><b>不分页</b>：仅采集当前页</li>
          <li><b>点击下一页</b>：填「下一页」按钮选择器（如 <code>span.next a</code>），循环点击直到按钮消失或达到最大页数</li>
          <li><b>URL 模板</b>：URL 中含 <code>{page}</code> 占位符或设置页码参数名，从起始页码循环采集</li>
          <li><b>滚动加载</b>：滚动 N 次（每次间隔可配）后一次性抽取（瀑布流页面用）</li>
          <li><b>最大页数</b>：防失控保险丝，务必设置合理值</li>
        </ul>

        <h4>8. 反爬与登录</h4>
        <ul>
          <li><b>登录档案</b>：需要登录/验证码的页面，先用下方「打开登录窗口」弹出真实浏览器手动登录，完成后 Cookie 存为档案，任务运行时自动注入登录态</li>
          <li><b>屏蔽资源</b>：不加载图片/字体/媒体/样式可显著提速（不影响文本抽取）</li>
          <li><b>页间延时(ms)</b>：翻页间的随机等待区间（如 500~1500），模拟人工浏览降低封禁风险</li>
          <li><b>自定义 UA</b>：伪装移动端或其他浏览器身份（留空用全局默认）</li>
        </ul>

        <h4>9. 输出选项</h4>
        <ul>
          <li><b>HTML 快照</b>：每页渲染后的 DOM 保存到项目 <code>cache-data/</code>（存档/调试用）</li>
          <li><b>整页截图</b>：每页截图保存到 <code>cache-data/</code></li>
          <li><b>最大记录数</b>：达到上限自动停止（0 不限）</li>
        </ul>
        <p class="tip">采集完成后自动写入「历史」，可在结果页签「导出 CSV」（带 BOM，Excel 直开不乱码），也可在历史中一键重跑。</p>

        <h4>10. JSON 配置（高级）</h4>
        <p>完整配置即一份 JSON，可在此手工编辑实现面板未覆盖的能力（如 <code>replace</code>/<code>split</code> 变换、自定义请求头）：</p>
        <pre class="code-block">{
  "rules": [{
    "field": "价格",
    "selector": ".price",
    "attr": "text",
    "transforms": [
      { "type": "replace", "pattern": "¥|,", "flags": "g", "replacement": "" },
      { "type": "number" }
    ]
  }],
  "antiCrawl": { "extraHeaders": { "Referer": "https://example.com" } }
}</pre>

        <h4>11. 推荐工作流</h4>
        <ul>
          <li>① 填 URL 与字段规则 → ② <b>试运行</b>（只跑第一页）查看结果调规则 → ③ 配置分页/反爬 → ④ <b>正式运行</b>批量采集 → ⑤ 结果页导出 CSV 或到历史中重跑</li>
        </ul>

        <h4>12. 完整示例：豆瓣电影 Top250（列表分页采集）</h4>
        <p>以真实站点做逐项分析，照此思路替换成你自己的目标站即可。</p>

        <p><b>目标</b>：采集 <code>https://movie.douban.com/top250</code> 全部 250 部电影的「标题 / 评分 / 评分人数 / 链接」，翻完 10 页自动停止。</p>

        <p><b>第一步 · 分析页面结构</b>（浏览器 F12 查看 DOM）：每部电影在一个 <code>&lt;div class="item"&gt;</code> 里，内部有 <code>span.title</code>（标题）、<code>span.rating_num</code>（评分）、<code>span.pl</code>（评分人数）、<code>div.hd a</code>（详情链接）——由此确定「记录容器」和各字段的选择器。</p>

        <p><b>第二步 · 确定翻页方式</b>：页面底部有「后一页」按钮 <code>span.next a</code>，共 10 页，属于典型的「点击下一页」分页。</p>

        <p><b>第三步 · 填写配置</b>：</p>
        <table class="selector-table">
          <thead><tr><th>配置项</th><th>取值</th><th>理由</th></tr></thead>
          <tbody>
            <tr><td>任务名</td><td><code>豆瓣电影Top250</code></td><td>保存后可复用/重跑</td></tr>
            <tr><td>起始 URL</td><td><code>https://movie.douban.com/top250</code></td><td>列表第一页；第一页 URL 不带参数，翻页靠点击推进</td></tr>
            <tr><td>数据源</td><td>页面规则（DOM）</td><td>豆瓣列表页为服务端渲染，数据直接在 HTML 里，无需捕获接口</td></tr>
            <tr><td>记录容器</td><td><code>div.item</code></td><td>每部电影一个容器，产出一条记录</td></tr>
            <tr><td>字段规则 ×4</td><td>见下方规则表</td><td>字段选择器相对容器填写，不用带 <code>div.item</code> 前缀</td></tr>
            <tr><td>等待策略</td><td>DOM 就绪 + 特征选择器 <code>div.grid-view</code></td><td>列表渲染完成即继续，比固定延时快且可靠</td></tr>
            <tr><td>分页</td><td>点击下一页：<code>span.next a</code>，最大 10 页</td><td>按钮消失（最后一页没有「后一页」）时自然结束</td></tr>
            <tr><td>反爬</td><td>屏蔽 图片/字体/媒体；页间延时 800~2000ms</td><td>提速 + 模拟人工，降低被限流风险</td></tr>
            <tr><td>输出</td><td>最大记录数 250</td><td>达到目标条数自动停止，双保险</td></tr>
          </tbody>
        </table>

        <p><b>字段规则明细</b>：</p>
        <table class="selector-table">
          <thead><tr><th>字段名</th><th>选择器</th><th>取值属性</th><th>变换</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td><code>标题</code></td><td><code>span.title:first-child</code></td><td>text</td><td>trim</td><td>取第一个 title（排除外文名）</td></tr>
            <tr><td><code>评分</code></td><td><code>span.rating_num</code></td><td>text</td><td>number</td><td>"9.7" → 9.7</td></tr>
            <tr><td><code>评分人数</code></td><td><code>span.pl</code></td><td>text</td><td>replace 去掉"人评价" → number</td><td>"3135245人评价" → 3135245（replace 需在 JSON 高级中配置）</td></tr>
            <tr><td><code>链接</code></td><td><code>div.hd a</code></td><td>href</td><td>—</td><td>引擎自动转绝对地址</td></tr>
          </tbody>
        </table>

        <p><b>对应的完整 JSON 配置</b>（可直接粘贴到「JSON 配置（高级）」再按需修改）：</p>
        <pre class="code-block">{
  "name": "豆瓣电影Top250",
  "url": "https://movie.douban.com/top250",
  "source": "dom",
  "wait": { "until": "domcontentloaded", "selector": "div.grid-view", "selectorTimeout": 10000, "settleMs": 800 },
  "itemSelector": "div.item",
  "rules": [
    { "field": "标题", "selector": "span.title:first-child", "attr": "text", "optional": true, "transforms": [{ "type": "trim" }] },
    { "field": "评分", "selector": "span.rating_num", "attr": "text", "optional": true, "transforms": [{ "type": "number" }] },
    { "field": "评分人数", "selector": "span.pl", "attr": "text", "optional": true, "transforms": [
      { "type": "replace", "pattern": "人评价|,", "flags": "g", "replacement": "" },
      { "type": "number" }
    ] },
    { "field": "链接", "selector": "div.hd a", "attr": "href", "optional": true }
  ],
  "pagination": { "type": "selector", "next": "span.next a", "maxPages": 10 },
  "antiCrawl": {
    "blockResources": ["image", "font", "media"],
    "delayMs": [800, 2000],
    "viewport": { "width": 1920, "height": 1080 }
  },
  "output": { "maxRecords": 250, "htmlSnapshot": false, "screenshot": false }
}</pre>

        <p><b>第四步 · 试运行验证</b>：点「试运行」只跑第一页，结果表格应出现 25 条记录；若某列为空，回到配置检查该字段的「选择器」是否写错（如类名大小写、层级关系）。</p>

        <p><b>第五步 · 正式运行</b>：确认无误后点「正式运行」，引擎逐页点击「后一页」共 10 页，运行面板实时显示「第 N 页 · 已采集 X 条」，结束后自动写入历史并可在结果页导出 CSV。</p>

        <p class="tip">变体参考：若目标是瀑布流站点，把分页改成「滚动加载」（滚动 10 次间隔 1200ms）；若数据来自接口，把数据源改成「接口捕获」，URL 正则填接口地址（如 <code>/api\\/list</code>）、数据路径填 <code>data.list</code>，规则可不填——返回的 JSON 对象字段直接作为列展示。</p>

      </div>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
/**
 * 任务配置说明文档
 * ------------------------------------------------------------------
 * 置顶于任务配置面板顶部的完整配置说明（可折叠，默认折叠），
 * 覆盖基础信息/字段规则/选择器语法/接口捕获/等待/交互/分页/反爬/输出/JSON 高级配置。
 */
// 纯静态展示组件，无逻辑
</script>

<style scoped>
.config-guide {
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
}
.guide-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
}
.guide-body {
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}
.guide-body h4 {
  margin: 14px 0 4px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.guide-body ul {
  margin: 4px 0;
  padding-left: 18px;
}
.guide-body li {
  margin: 2px 0;
}
.guide-body code {
  background: var(--el-fill-color-light);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: var(--el-color-danger);
}
.tip {
  font-size: 12px;
  color: var(--el-color-warning);
  margin: 4px 0;
}
.selector-table {
  width: 100%;
  border-collapse: collapse;
  margin: 6px 0;
  font-size: 12px;
}
.selector-table th,
.selector-table td {
  border: 1px solid var(--el-border-color-lighter);
  padding: 4px 8px;
  text-align: left;
}
.selector-table th {
  background: var(--el-fill-color-light);
}
.code-block {
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 10px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}
</style>
