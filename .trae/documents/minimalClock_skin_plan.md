# Minimal Clock 文字颜色切换功能实现计划

## 需求分析

为 `minimalClock.vue` 的 `clock-container` 区域添加文字颜色点击切换功能，使用 `src/styles/skins/` 目录下的皮肤配置。

### 需求要点
- 点击 `clock-container` 区域切换文字颜色
- 使用 skins 目录中的各种主题配色（white, amber, aurora, coral, dark, gray, lavender, mint, sakura, sky）
- 默认使用 white skin 的文字颜色
- 配置不需要存储到数据库，仅运行时切换

## 技术方案

### 1. 皮肤颜色配置提取

从 skins 文件中提取每个皮肤的文字颜色变量：

| 皮肤名称 | `--skin-text-primary` | `--skin-text-secondary` |
|---------|----------------------|------------------------|
| white | #4338ca | #6366f1 |
| amber | #B45309 | #D97706 |
| aurora | (待读取) | (待读取) |
| coral | (待读取) | (待读取) |
| dark | #F3F4F6 | #D1D5DB |
| gray | (待读取) | (待读取) |
| lavender | (待读取) | (待读取) |
| mint | (待读取) | (待读取) |
| sakura | (待读取) | (待读取) |
| sky | #1D4ED8 | #2563EB |

### 2. 实现方式

在 Vue 组件中：
- 定义皮肤列表数组，包含皮肤名称和对应的颜色配置
- 使用 `ref` 管理当前选中的皮肤索引
- 通过 `computed` 计算属性生成文字颜色样式
- 在 `clock-container` 上绑定点击事件切换皮肤
- 添加点击反馈动画效果

## 文件修改

### 修改文件：`src/views/home/minimalClock.vue`

#### 修改内容：

1. **模板部分**：
   - 为 `clock-container` 添加点击事件 `@click="switchSkin"`
   - 添加切换提示动画

2. **脚本部分**：
   - 添加皮肤配置列表
   - 添加当前皮肤索引 ref
   - 添加 `switchSkin` 切换方法
   - 添加 `textStyle` 计算属性

3. **样式部分**：
   - 修改 `clock-container` 的文字颜色为动态绑定
   - 添加点击反馈样式

## 实施步骤

1. 读取剩余的 skin 文件获取颜色配置
2. 修改 minimalClock.vue 添加皮肤切换功能
3. 验证功能正常运行

## 风险评估

- **低风险**：仅修改单个文件，不影响其他模块
- **无存储需求**：无需修改数据库或 localStorage
- **样式隔离**：使用 scoped style，不会污染全局样式

## 验证方式

1. 使用 `npx tsc --noEmit` 检查 TypeScript 类型错误
2. 使用 `npx vite --mode development` 启动开发服务器验证功能
