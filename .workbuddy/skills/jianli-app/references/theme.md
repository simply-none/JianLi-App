# 主题与视觉约定（theming）

## 为什么需要这份约定
本应用有 **25 套主题**（含 light / 多套暗色 / 彩色主题），由 `useTheme` 把 `data-theme` 写到
`document.documentElement`（html 根元素）。`src/styles/themes/index.scss` 汇总全部主题，
每套主题用 `[data-theme="x"]` 选择器在 `light.scss` 的 `:root` 默认值之上**覆写全部 CSS 变量**。

视觉变量分两套，职责截然不同：
- **自定义主题 token**（`--bg-*` / `--text-*` / `--border-*` / `--color-*` …）：**业务 UI 专用**，
  25 套主题 + `:root` 默认值全部定义，保证任意主题下都存在。
- **Element Plus 覆写变量**（`--el-*`）：**仅供 Element Plus 组件内部默认样式读取**（按钮、表格、输入框等），
  各主题只补了常用的一部分。

> ⚠️ 业务代码（自己写的 `<style scoped>` / 内联样式）**只碰自定义 token**。Element Plus 组件会自动读自己的变量，
> 不要手动给它指定 `--el-*`。

## 自定义 token 清单（每套主题都定义，可直接用）
| 类别 | 变量 |
|---|---|
| 背景 | `--bg-base`（页面底）、`--bg-card`（卡片/面板）、`--bg-sidebar`、`--bg-hover`（悬停/填充面，半透明 tint） |
| 文字 | `--text-primary`、`--text-secondary`、`--text-muted` |
| 边框/分隔 | `--border-subtle`、`--border-group` |
| 主色 | `--color-primary`、`--color-primary-light`（≈10% 主色 tint）、`--color-primary-hover`（≈18% tint）、`--color-primary-solid` |
| 状态色 | `--color-success`、`--color-warning`、`--color-error`、`--color-info` |
| 标签底色 | `--tag-bg-info` / `--tag-bg-success` / `--tag-bg-warning` / `--tag-bg-danger` |
| 输入/图标/阴影等 | `--input-bg`、`--input-border`、`--input-border-focus`、`--scrollbar-thumb`、`--shadow-card`、`--radius-card` 等 |

完整值见 `src/styles/themes/cobalt.scss`（它包含了主题定义的所有变量名，可作为总表参考）。

## 红线（新增 / 修改任何 UI 必须遵守）
1. **禁止硬编码颜色**：任何背景、文字、边框、主色一律写 `var(--xxx)`，不得出现 `#hex`、`rgb()/rgba()`、
   `white/black` 等字面量（阴影/半透明 tint 例外，但也应尽量基于 token 的 `color-mix` 或 `--bg-hover` 派生）。
2. **禁止直接用 Element Plus 的 `--el-*` 变量**（尤其是 `light-N` / `extra-light` 系列）：
   `--el-fill-color-extra-light`、`--el-color-primary-light-9`、`--el-fill-color-lighter`、`--el-color-primary-light-5`、
   `--el-bg-color`、`--el-text-color-*` 等。**并非 25 套主题都定义了这些**——某套主题缺失时会回退到浅色 `:root`，
   导致该区域在深色 / 非默认主题下**彻底不跟随系统主题变化**。
   → 这是数据获取页（dataAcquisition）曾踩过的坑：其组件原用 `--el-fill-color-extra-light` 等，切换暗色主题时面板仍发白。
3. **派生色阶用 `color-mix()` 从基准变量算**：需要"主色浅底 / 主色边框"时，用
   `color-mix(in srgb, var(--color-primary) 10%, transparent)`（激活项底）或
   `color-mix(in srgb, var(--color-primary) 45%, transparent)`（悬停边框），不要依赖某套主题是否定义了 `light-N`。
   `color-mix` 是纯 CSS，Vite 直通，无需额外 PostCSS 插件。
4. **新增颜色语义时**：优先复用既有 token；确需新语义，必须在 `src/styles/themes/` **每套主题文件 + `light.scss` 的 `:root`**
   同时补定义，保持 26 处一致，否则会出现"某主题缺变量 → 回退浅色"。

## Element Plus 变量集中重映射（统一跟随主题）
为避免在 25+ 套主题里逐个补 `--el-*`（且极易遗漏），本应用在
`src/styles/element-plus-theme.scss` 用一个 `:root` 块把 Element Plus 的全部设计变量
（`--el-color-*` / `--el-bg-color*` / `--el-text-color-*` / `--el-border-color*` / `--el-fill-color*` /
`--el-mask-color` / `--el-box-shadow*`）**统一重映射到自定义 token**：
- 基础色：`--el-color-primary → var(--color-primary)`；状态色 `success / warning / danger / info`
  → `var(--color-success / --color-warning / --color-error / --color-info)`（`danger` 对应 `--color-error`）。
- 派生色阶（`light-3 / 5 / 7 / 8 / 9`、`dark-2`）：用 `color-mix(in srgb, var(--主题色) X%, var(--bg-card))`
  以主题表面色为锚点派生，浅色 / 深色主题下都得到合适色阶。
- 背景 / 文字 / 边框 / 填充 / 阴影：分别指向 `--bg-card` / `--bg-base` / `--text-*` / `--border-subtle` / `--bg-hover` 等。

该文件已在 `src/style.scss` 中于 `@use themes / @use skins` 之后 `@use` 引入。
因 `main.ts` 先 import Element Plus 的 css、后 import `style.scss`，此 `:root` 会覆盖 EP 自带默认值，
**所有 EP 组件随主题切换自动联动**，业务侧一般不再需要为 EP 组件写 `--el-*` 覆写。

> 注意：各主题文件（如 `cobalt.scss`）里手写的 `--el-*` 仍保留作为兜底，但会被本文件覆盖；
> 新增主题时**无需再手写 `--el-*`**，本文件已统一覆盖。

## 正例 / 反例
反例（数据获取页旧写法，部分主题不跟随主题）：
```scss
.left-panel { background: var(--el-bg-color); }              /* 依赖 --el-*，可能回退浅色 */
.task-item.is-active { background: var(--el-color-primary-light-9); }  /* 暗色主题未定义 → 发白 */
```
正例（修复后，全主题联动）：
```scss
.left-panel { background: var(--bg-card); }
.task-item.is-active { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
```

## 验证
- 切换多个主题（尤其暗色：cobalt / dark / dracula 等）目视确认背景与文字同步变化。
- 查漏：在业务 `.vue` 的 `<style>` 中 grep 是否残留 `--el-(fill-color-|color-primary-light-|bg-color|text-color-)` 或硬编码 `#`，
  有则改为对应自定义 token。
- 渲染端改动热重载即可；主题切换机制本身在主进程无关，无需重启 Electron。
