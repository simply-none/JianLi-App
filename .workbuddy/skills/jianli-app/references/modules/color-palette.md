# 调色板工具 (color-palette)

## 职责
一个面向前端 / UI 设计的调色板工具：HSV 画布取色 + H/S/V/R/G/B + **A（透明度，0-100）** 滑块联动、HEX(8位#RRGGBBAA，不透明时缩 6 位)/RGBA/HSLA 数值显示与一键复制、10 种配色方案（互补 / 类比 / 三角 / 分裂互补 / 四角 / 单色 / 矩形双互补 / 双分裂互补 / 类比+互补 / 二色邻近）生成（生成色携带当前透明度）、渐变生成器（线性/径向、多色标**各带 alpha**、生成并复制 `rgba(...)` 的 CSS）、颜色智能命名（148 个 CSS 命名色就近匹配）、随机基准色 / 随机填充工作区、WCAG 对比度检查（前/背景**均带 alpha**，按「叠白底」合成计算，AA/AAA 徽章）、红/绿/蓝色盲模拟预览（保留 alpha）、导出 CSS 变量 / SCSS / JSON 主题皮肤（JSON 增 `alpha`/`rgba` 字段）、命名色板与单色收藏持久化（存数据库，色值为 8 位 HEX，重启不丢；旧 6 位数据向后兼容）。**专业配色引擎**：在 `colorMath.ts` 新增感知均匀的 Oklab/OkLCH 色彩空间转换（`rgbToOklab`/`oklabToRgb`/`oklabToOklch`/`oklchToOklab`/`hexToOklch`/`oklchToHex`/`gamutClipOklch`/`mixOklab`），不改动既有 HSV/HSL 链路；`ScalePanel.vue` 基于基准色的 OKLCH 色相/彩度沿感知亮度轴生成 11 档色阶（50–950，浅/深档自动收敛彩度避免溢出 sRGB 色域，输出经 gamut 钳制保证合法 HEX），支持单色复制、整组加入工作区、复制 CSS 变量/SCSS；`ImagePalette.vue` 支持点击/拖拽上传图片→离屏 canvas 缩至 ~100×100 采样（剔除 alpha<125 像素）→**中位数切分法（median-cut）**聚类出 4/6/8 个主色（按占比降序），可设为基准色、加入工作区或一键存为色板。纯渲染端实现，颜色计算全为纯函数，不依赖主进程。

## 关键文件
- 页面壳：`src/views/colorPalette/index.vue`（响应式卡片栅格组装所有面板）
- 颜色算法：`src/views/colorPalette/colorMath.ts`（HEX/RGB/HSL/HSV 互转、**含 alpha**：`parseHex`/`parseAlpha`/`hexToRgba`/`rgbaToHex`/`hsvToHexa`/`rgbToHsla`/`toShortHex`/`compositeAlpha`；配色方案生成、WCAG 相对亮度与对比度、色盲模拟矩阵、就近命名 `nearestColorName`；**Oklab/OkLCH 感知均匀空间**：`rgbToOklab`/`oklabToRgb`/`oklabToOklch`/`oklchToOklab`/`hexToOklch`/`oklchToHex`/`gamutClipOklch`/`mixOklab`；色阶梯度 `generateScale(baseHex)`——纯函数，可单测）
- 颜色命名库：`src/views/colorPalette/colorNames.ts`（CSS 规范 148 个命名色 `[名, #hex]`，供 `nearestColorName` 全量遍历取最近）
- 状态 + 数据层：`src/views/colorPalette/useColorPalette.ts`（Pinia store；`ensureSchema()` 显式 `CREATE TABLE`；随机生成 `randomizeBase()` / `addRandomSwatches(n)`）
- 类型：`src/views/colorPalette/types.ts`（`HarmonyType` / `SavedPalette` / `ColorFavorite`）
- 复制工具：`src/views/colorPalette/clipboard.ts`（复制 + toast 反馈，统一封装 `clipboard:write` 习惯）
- 组件（`src/views/colorPalette/components/`）：
  - `ColorCanvas.vue` —— HSV 二维饱和度/明度画布取色 + 色相条，鼠标拖拽/缩放
  - `ColorSliders.vue` —— H/S/V + R/G/B + **A（透明度）** 滑块联动（绑 `store.baseAlpha` / `setBaseAlpha`）
  - `ColorValueInputs.vue` —— HEX(8位) 可编辑、RGBA/HSLA 显示复制、大预览块（带透明棋盘格）
  - `HarmonyPanel.vue` —— 方案选择 + 生成色块（携带当前透明度）+ 一键加入工作区 + 「随机基准色」按钮（调 `store.randomizeBase()`）
  - `GradientPanel.vue` —— 渐变生成器（线性/径向、角度、多色标**各带 alpha 滑块**、实时预览、复制 `rgba(...)` 的 CSS）
  - `ColorNamePanel.vue` —— 当前基准色的最近命名色 + 偏差 + 复制名称（调 `nearestColorName`，忽略 alpha）
  - `SwatchList.vue` —— 工作区色块增/删/复制/清空（色块带透明棋盘格，色值 8 位）
  - `ContrastChecker.vue` —— 双色 WCAG 对比度（前/背景各带 alpha 滑块，按叠白底合成计算）
  - `ColorBlindSim.vue` —— 红/绿/蓝色盲模拟预览（保留 alpha）
  - `ExportPanel.vue` —— 导出 CSS 变量 / SCSS / JSON（JSON 含 `alpha`/`rgba`）
  - `ScalePanel.vue` —— 色阶梯度生成器（基于基准色 OKLCH，11 档 50–950，单色复制 / 整组加入工作区 / 复制 CSS 变量·SCSS，调 `generateScale`/`toCssVariables`/`toScss`）
  - `ImagePalette.vue` —— 图片主色提取（上传/拖拽→离屏 canvas 采样→median-cut 聚类 4/6/8 主色，设为基准色 / 加入工作区 / 存为色板，调 `store.setBaseFromHex`/`addSwatch`/`savePalette`）
  - `SavedPalettePanel.vue` —— 命名保存色板到库、加载/删除、快速收藏单色
- 接入：
  - 路由：`src/router/index.ts` 增加 `RouteNames.COLOR_PALETTE` → `/colorPalette`
  - 菜单：`src/layout/index.vue` 的 `groupDefs`「效率工具」分组加入 `colorPalette`
  - 图标：`src/utils/index.ts` 的 `iconMap.colorPalette = 'Palette'`（复用已注册图标，无需新依赖）

## 路由
- `RouteNames.COLOR_PALETTE` → `/colorPalette`

## 用到的 IPC 通道
- 读色板/收藏：`new-sql:query`（表 `color_palette` / `color_favorite`）
- 保存命名色板（按主键覆盖）：`new-sql:upsert`
- 删除色板/收藏：`new-sql:delete`
- 复制走 `window.ipcRenderer.handlePromise` 封装（与项目其余 newSql 调用一致），未新增通道

## 数据表
- `color_palette`：`key TEXT` 主键（命名）、`colors TEXT`（JSON 数组）、`created_at` / `updated_at` 时间戳；重名覆盖（upsert）。
- `color_favorite`：`key TEXT` 主键（色值本身作 key）、`color TEXT`、`created_at`；快速收藏单色。
- 由 store 的 `ensureSchema()` 在首次加载时显式 `CREATE TABLE`（与记账模块一致，控制列结构，不依赖 execute 自动建表劫持）。

## 复用 / 集成点
- **菜单可见开关自动生效**：因已加入 `layout/index.vue` 的 `groupDefs`，`src/views/routeSetting/index.vue` 是路由表驱动，色板菜单会自动出现在「菜单显隐」配置页，无需额外登记。
- **主题 token**：全程用 `--bg-card` / `--text-primary` / `--color-primary` / `--border-subtle` 等，不硬编码颜色，自动跟随明暗主题。
- **Element Plus**：用 `el-card` / `el-tabs` / `el-input` / `el-button` / `el-message` 等。
- **HSV 画布**：原生 `<canvas>` + 鼠标事件自绘，未引入 chroma.js / color 等第三方库，保持零额外依赖。

## 特有坑 / 注意
- **store 默认导出**：`useColorPalette.ts` 是 `export default defineStore(...)`，各组件须 `import useColorPalette`（默认导入）；若写成 `import { useColorPalette }` 命名导入会触发 TS2614（首次实现即踩此坑，9 个文件连锁报错，改默认导入后类型检查 0 报错）。
- **纯渲染端改动**：颜色计算纯函数化，仅调用已存在的 `new-sql` IPC，无需重启主进程；前端热重载或刷新页面即生效。
- **表结构显式建**：不要靠 `new-sql:execute` 自动建表（有结构劫持坑），改为 store 内 `CREATE TABLE` 控制列。
- 命令面板 `!` 作用域快速取色、frameless 悬浮小窗**尚未实现**（设计时曾提议，未落地）；如需可复用 `registerShortcut` 四件套与命令面板 REGISTRY。
- **取色锁定（ColorCanvas 关键交互）**：SV 画布与色相条的拖拽标志 `draggingSv`/`draggingHue` 必须在 `pointerup`/`pointercancel` 复位并 `releasePointerCapture`。若只置位不复位，首次按下后标志恒为 `true`，鼠标此后 hover（pointermove）颜色就一直跟着跑、松手也锁不住——表现为「固定不了色彩」。正确行为：按下取色、拖拽预览、松开左键即固定。
- **透明度模型（alpha）+ 防锯齿渲染**：基准色透明度是独立 `store.baseAlpha`（0-100，默认 100=不透明），`baseHex` 为 8 位 HEX（`#RRGGBBAA`，不透明时 `toShortHex` 缩为 6 位）；工作区/收藏/色板色值统一为 8 位字符串，旧 6 位数据 `parseHex`/`hexToRgb` 自动忽略 alpha 向后兼容。`<input type="color">` 原生只支持 6 位，故渐变/对比度的 alpha 用独立滑块控制。**色块按 alpha 条件切换渲染**：不透明（alpha=1）走改动前纯色 `background: var(--c)`（无棋盘格、无 box-shadow，与未加透明度功能前完全一致，无锯齿）；透明时给元素加 `.is-transparent` 类，启用 SVG data-URI 棋盘格（16×16 内联 SVG）+ `box-shadow: inset 0 0 0 9999px var(--c)`。**禁用 `conic-gradient` 棋盘格 + `::before` 颜色层**（conic-gradient 的 90° 尖锐色阶在 Chromium 圆角处劣质 AA，即使 SVG 替代后，不透明路径也必须撤掉棋盘格才能复现无锯齿的旧渲染）。判断函数：`colorMath.parseAlpha(hex)`（HEX 返回 0-1）、`colorMath.gradientHasAlpha(css)`（渐变含透明色标）。
- **OkLab 往返实现要点**：`rgbToOklab` 的反向 `oklabToRgb` 必须由 Oklab 的 L/a/b **立方根（Math.cbrt）**还原线性 RGB（即 `l = l_³` 等），**切勿写成平方**——平方会让色相错乱（红→品红）。该模块已用 node 脚本验证 srgb↔oklch 往返误差 0、色阶 11 档均为合法 HEX 且明度单调。`generateScale` 的亮度目标取自 Tailwind 实测感知亮度曲线（50→0.975 … 950→0.185），彩度因子按亮度档位收敛（`gamutClipOklch` 在越界时 ×0.9 收缩 C 直到落回 sRGB 色域）。
- **图片主色提取（median-cut）**：`ImagePalette.vue` 用 `object URL` 加载图片、离屏 canvas 缩放采样；注意 `img.onload` 是异步，采样完才 `extract()`；切换主色数 `watch(count)` 仅对缓存像素 `sampled` 重聚类，不重新读图。透明白像素（alpha<125）跳过，避免主色偏透明。色值输出为 6 位 HEX（不透明），`store.savePalette` 直接复用既有持久化。
