# 番茄钟小窗口翻页倒计时布局实现计划

## 目标

创建一个新的翻页风格布局 `LayoutFlip.vue`，使用翻页动画效果显示倒计时时间，参照 `ClockDemo1/index.html` 的翻页时钟样式。

## 现有结构分析

**布局组件接口**（所有布局统一）：
- Props: `status`, `countdown`, `progress`, `statusLabel`, `statusSubtitle`
- Emits: `cycle-theme`
- 使用 skin CSS 变量

**index.vue 中的注册**：
- layouts 数组: `['default', 'simple', 'circle', 'compact', 'classic']`
- layoutComponents 对象: 组件映射

## 实现方案

### 步骤1：创建翻页倒计时组件 FlipCountdown.vue

封装翻页时钟逻辑，接收 `countdown` prop（格式 "HH:MM:SS"），显示翻页动画效果。

**组件结构**：
```
FlipCountdown.vue
├── flip-group (包含小时、分钟、秒)
│   ├── flip-item (每个数字位)
│   │   ├── flip-card
│   │   │   ├── flip-card-top (上半部分)
│   │   │   ├── flip-card-bottom (下半部分)
│   │   │   └── flip-card-back (背面)
```

**动画原理**（参照 ClockDemo1）：
- 使用 CSS 3D transform 实现翻页效果
- 每个数字位独立翻转动画
- 当数字变化时，触发翻页动画

### 步骤2：创建新布局 LayoutFlip.vue

使用 FlipCountdown 组件，配合状态指示和主题切换按钮。

**布局结构**：
```
LayoutFlip.vue
├── theme-switch (主题切换按钮)
├── status-section (状态标签)
├── flip-countdown (翻页倒计时)
└── progress-section (进度条)
```

### 步骤3：注册新布局

在 `index.vue` 中：
- 添加 `'flip'` 到 layouts 数组
- 添加 FlipCountdown 和 LayoutFlip 导入
- 在 layoutComponents 中注册

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/views/pomodoroMiniWindow/components/FlipCountdown.vue` | 新建 - 翻页倒计时组件 |
| `src/views/pomodoroMiniWindow/layouts/LayoutFlip.vue` | 新建 - 翻页风格布局 |
| `src/views/pomodoroMiniWindow/index.vue` | 修改 - 注册新布局 |
| `src/views/windowmode/index.vue` | 修改 - 添加布局选项 |

## 修改步骤

1. 创建 `FlipCountdown.vue` 组件
2. 创建 `LayoutFlip.vue` 布局
3. 修改 `index.vue` 注册新布局
4. 修改 `windowmode/index.vue` 添加布局选项
5. 运行 TypeScript 类型检查

## 风险评估

- **风险低**：新增组件，不影响现有功能
- **兼容性**：CSS 3D transform 在 Electron 中支持良好
- **回归点**：确保其他布局仍正常工作

## 验证方法

1. 打开番茄钟小窗口
2. 双击切换布局到翻页风格
3. 观察倒计时翻页动画效果
4. 切换皮肤，确认样式适配正确