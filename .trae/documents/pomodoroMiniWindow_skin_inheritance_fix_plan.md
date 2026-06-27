# 番茄钟小窗口皮肤 CSS 变量继承问题排查修复计划

## 问题现象

小窗口设置了 `data-skin` 属性在 html 标签上，但 body 及其子元素的皮肤样式不生效，始终显示默认白色皮肤。用户描述为"仅仅在 html 标签生效了，到了 body 及其下面的标签，读不到该属性"。

## 根因分析

**问题出在默认皮肤的 CSS 选择器 `:not([data-skin])` 上。**

当前默认皮肤定义：

```scss
[data-skin="white"],
:not([data-skin]) {
  --skin-bg: rgba(255, 255, 255, 0.95);
  /* ... 其他变量 */
}
```

### 问题链路

1. `applyTheme('coral')` 在 html 上设置 `data-skin="coral"`
2. html 元素匹配 `[data-skin="coral"]` → 设置 coral 皮肤的 CSS 变量
3. body 元素**没有** data-skin 属性 → 匹配 `:not([data-skin])` → 被设置为 white 皮肤变量
4. body 上的 white 变量**覆盖**了从 html 继承来的 coral 变量
5. 所有子元素（.pomodoro-mini-window 等）同样匹配 `:not([data-skin])` → 都被覆盖为 white
6. 结果：html 是 coral，但所有实际显示内容的元素都是 white

### 为什么 `:not([data-skin])` 是罪魁祸首

- `:not([data-skin])` 匹配**所有**没有 data-skin 属性的元素，而不只是根元素
- CSS 变量是继承的，但如果子元素自己也设置了同名变量，会覆盖继承值
- `:not([data-skin])` 在 body、#app、.pomodoro-mini-window 等每一层都设置了 white 变量，把上层传下来的实际皮肤颜色覆盖掉了

## 修复方案

将默认皮肤的选择器从：

```scss
[data-skin="white"],
:not([data-skin]) {
```

改为：

```scss
:root,
[data-skin="white"] {
```

### 修复原理

- `:root` 只匹配文档根元素（html），不匹配子元素
- 默认皮肤变量只在 :root 上设置一次
- 子元素通过**继承**获取皮肤变量，不会被覆盖
- 当 html 有 `data-skin="coral"` 时，`[data-skin="coral"]` 选择器在 html 上覆盖默认变量
- 所有子元素继承 html 上的最终变量值，皮肤正确生效

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/views/pomodoroMiniWindow/index.vue` | 默认皮肤选择器 `:not([data-skin])` → `:root` |

## 修改步骤

1. 打开 `src/views/pomodoroMiniWindow/index.vue`
2. 定位到第 249-263 行的默认皮肤定义
3. 将选择器 `[data-skin="white"],\n:not([data-skin])` 改为 `:root,\n[data-skin="white"]`
4. 运行 TypeScript 类型检查验证

## 风险评估

- **风险低**：只修改一行 CSS 选择器，不涉及逻辑变更
- **兼容性**：`:root` 是 CSS 标准选择器，所有现代浏览器（包括 Electron）都支持
- **回归点**：确认默认皮肤（白色）在没有 data-skin 属性时仍正常显示

## 验证方法

1. 打开番茄钟小窗口
2. 点击皮肤切换按钮循环切换
3. 观察背景、文字、进度条等颜色是否正确变化
4. 关闭小窗口后重新打开，确认皮肤保持上次选择
