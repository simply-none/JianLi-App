# 翻页倒计时布局优化计划

## 问题分析

### 问题1：重影（数字重叠）

当前实现的问题：
- flip-top、flip-bottom、flip-back 三个层都显示同一个数字 `{{ digit }}`
- 翻页动画时没有分离旧数字和新数字，导致视觉上两层数字重叠

参照 ClockDemo1 的正确实现：
- 需要保存旧数字（before）和新数字（active）
- 翻页时：旧数字的上半部分向下翻，新数字的上半部分从下方翻上来
- flip-top 和 flip-bottom 显示当前数字，flip-back 显示新数字

### 问题2：皮肤样式不匹配

当前硬编码：
- 背景：`rgba(0, 0, 0, 0.6)` 和灰色渐变
- 文字：`color: #fff`
- 分隔点：`background: rgba(255, 255, 255, 0.8)`

需要改为使用 skin CSS 变量：
- 背景：`var(--skin-bg)` 或基于 skin 的深色版本
- 文字：`var(--skin-text-primary)`
- 分隔点：`var(--skin-dot)`

### 问题3：去除进度条

从 LayoutFlip.vue 中删除 progress-section 部分。

## 修复方案

### 修改 FlipCountdown.vue

1. 添加 `prevDisplayDigits` 保存旧数字
2. 翻页动画时，flip-back 显示新数字，flip-top 显示旧数字
3. 使用 skin CSS 变量替换硬编码颜色
4. 调整动画时序，避免重影

### 修改 LayoutFlip.vue

1. 删除 progress-section 部分

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/views/pomodoroMiniWindow/components/FlipCountdown.vue` | 修复翻页重影、适配皮肤变量 |
| `src/views/pomodoroMiniWindow/layouts/LayoutFlip.vue` | 删除进度条 |

## 修改步骤

1. 修改 FlipCountdown.vue 的模板和脚本，分离新旧数字
2. 修改 FlipCountdown.vue 的样式，使用 skin CSS 变量
3. 删除 LayoutFlip.vue 中的进度条部分
4. 运行 TypeScript 类型检查