# 首页锁屏界面新模式设计计划（最终版）

## 一、需求分析

### 1.1 需求概述
在 `src/views/home/` 目录下新增**10种不同网页风格的模式**，具体要求：
- **所有新模式都导入 importSmallComponents**（参照 custom.vue）
- **无需新增小组件**
- **每个模式有自己的界面风格**（背景色、布局等）
- **不改动**当前4种模式

### 1.2 当前模式分析

| 模式 | value | 特点 |
|-----|-------|------|
| 透明诗词板 | "0" | 导入 importSmallComponents |
| 模拟Windows更新 | "1" | 独特界面设计（无小组件） |
| vscode代码背景 | "2" | 导入 importSmallComponents |
| 自定义 | "3" | 导入 importSmallComponents |

### 1.3 模式组件结构模板
所有新模式都参照 `custom.vue` 结构：
```vue
<template>
  <div class="home-rest2" @contextmenu="contextmenuFn">
    <importSmallComponents ref="importSmallComponentsRef" :modeName="modeName"></importSmallComponents>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import importSmallComponents from '@/components/importSmallComponents.vue';

const importSmallComponentsRef = ref()
const modeName = ref('新模式名称')

const contextmenuFn = (event) => {
  importSmallComponentsRef.value.contextmenuFn(event)
}
</script>

<style lang="scss" scoped>
.home-rest2 {
  width: 100%;
  height: 100%;
  position: relative;
  user-select: none;
}
</style>
```

---

## 二、10种新模式设计

### 模式4：极简时钟型 (minimalClock)
**设计风格**：类似 iOS/macOS 锁屏风格

**特色**：
- 深色渐变背景（#0a0a0a → #1a1a1a）
- 默认大时钟居中显示
- 极简风格，适合专注工作场景

**默认样式配置**：
```typescript
{
  label: "极简时钟",
  value: "4",
  primaryColor: "#ffffff",
  secondaryColor: "#0a0a0a",
  opacity: 0.9,
}
```

---

### 模式5：GitHub主题型 (githubTheme)
**设计风格**：模拟 GitHub 登录页深色主题

**特色**：
- GitHub 深色主题背景（#0d1117）
- 左侧装饰文字区域
- 适合开发者工作场景

**默认样式配置**：
```typescript
{
  label: "GitHub主题",
  value: "5",
  primaryColor: "#c9d1d9",
  secondaryColor: "#0d1117",
  opacity: 0.95,
}
```

---

### 模式6：励志名言型 (motivationalQuote)
**设计风格**：优雅名言展示风格

**特色**：
- 柔和蓝灰色渐变背景
- 默认显示大时钟 + 古诗小组件
- 文字排版居中，优雅风格

**默认样式配置**：
```typescript
{
  label: "励志名言",
  value: "6",
  primaryColor: "#ffffff",
  secondaryColor: "#2c3e50",
  opacity: 0.9,
}
```

---

### 模式7：终端主题型 (terminalTheme)
**设计风格**：模拟终端/命令行界面

**特色**：
- 黑色背景（#1e1e1e）
- 绿色文字装饰元素
- 左侧模拟命令行输出区域
- 适合程序员工作场景

**默认样式配置**：
```typescript
{
  label: "终端主题",
  value: "7",
  primaryColor: "#00ff00",
  secondaryColor: "#1e1e1e",
  opacity: 0.95,
}
```

---

### 模式8：音乐播放器型 (musicPlayerTheme)
**设计风格**：模拟音乐播放器锁屏界面

**特色**：
- 深色渐变背景（#1a1a2e）
- 底部装饰性播放控制区域
- 模拟播放进度条样式
- 适合休息放松场景

**默认样式配置**：
```typescript
{
  label: "音乐播放器",
  value: "8",
  primaryColor: "#ffffff",
  secondaryColor: "#1a1a2e",
  opacity: 0.85,
}
```

---

### 模式9：Windows桌面型 (windowsDesktop)
**设计风格**：模拟 Windows 10/11 桌面风格

**特色**：
- Windows 蓝色渐变背景（#0078d4）
- 左侧装饰性图标区域
- 底部任务栏样式装饰
- 适合办公工作场景

**默认样式配置**：
```typescript
{
  label: "Windows桌面",
  value: "9",
  primaryColor: "#ffffff",
  secondaryColor: "#0078d4",
  opacity: 0.9,
}
```

---

### 模式10：macOS桌面型 (macOSDesktop)
**设计风格**：模拟 macOS 桌面风格

**特色**：
- macOS 深色背景（#1c1c1e）
- Dock 样式底部装饰
- 顶部菜单栏样式装饰
- 适合苹果用户工作场景

**默认样式配置**：
```typescript
{
  label: "macOS桌面",
  value: "10",
  primaryColor: "#ffffff",
  secondaryColor: "#1c1c1e",
  opacity: 0.9,
}
```

---

### 模式11：新闻阅读型 (newsReader)
**设计风格**：模拟新闻阅读页面风格

**特色**：
- 白色/浅灰背景（#f5f5f5）
- 顶部新闻标题样式装饰
- 左侧文章列表样式装饰
- 适合阅读休息场景

**默认样式配置**：
```typescript
{
  label: "新闻阅读",
  value: "11",
  primaryColor: "#333333",
  secondaryColor: "#f5f5f5",
  opacity: 0.9,
}
```

---

### 模式12：代码编辑型 (codeEditorTheme)
**设计风格**：模拟 VS Code 编辑器风格

**特色**：
- VS Code 深色主题背景（#1e1e1e）
- 左侧文件树样式装饰
- 顶部标签栏样式装饰
- 适合开发者工作场景

**默认样式配置**：
```typescript
{
  label: "代码编辑",
  value: "12",
  primaryColor: "#d4d4d4",
  secondaryColor: "#1e1e1e",
  opacity: 0.95,
}
```

---

### 模式13：搜索引擎型 (searchEngine)
**设计风格**：模拟搜索引擎首页风格

**特色**：
- 白色背景（#ffffff）
- 中央搜索框样式装饰
- 底部快捷链接样式装饰
- 适合简洁工作场景

**默认样式配置**：
```typescript
{
  label: "搜索引擎",
  value: "13",
  primaryColor: "#333333",
  secondaryColor: "#ffffff",
  opacity: 0.85,
}
```

---

## 三、修改文件清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `src/views/home/minimalClock.vue` | 新增 | 极简时钟模式组件 |
| `src/views/home/githubTheme.vue` | 新增 | GitHub主题模式组件 |
| `src/views/home/motivationalQuote.vue` | 新增 | 励志名言模式组件 |
| `src/views/home/terminalTheme.vue` | 新增 | 终端主题模式组件 |
| `src/views/home/musicPlayerTheme.vue` | 新增 | 音乐播放器模式组件 |
| `src/views/home/windowsDesktop.vue` | 新增 | Windows桌面模式组件 |
| `src/views/home/macOSDesktop.vue` | 新增 | macOS桌面模式组件 |
| `src/views/home/newsReader.vue` | 新增 | 新闻阅读模式组件 |
| `src/views/home/codeEditorTheme.vue` | 新增 | 代码编辑模式组件 |
| `src/views/home/searchEngine.vue` | 新增 | 搜索引擎模式组件 |
| `src/views/home/index.vue` | 修改 | 新增10种模式的导入和切换逻辑 |
| `src/store/useGlobalSetting.ts` | 修改 | 新增10种模式选项定义 |
| `src/store/useSmallComponentsOps.ts` | 修改 | 新增10种模式的默认小组件配置 |

---

## 四、实施步骤

### 步骤1：新增10种模式组件
创建10个新模式组件文件，每个参照 custom.vue 结构：
- `minimalClock.vue` → modeName: 'minimalClock'
- `githubTheme.vue` → modeName: 'githubTheme'
- `motivationalQuote.vue` → modeName: 'motivationalQuote'
- `terminalTheme.vue` → modeName: 'terminalTheme'
- `musicPlayerTheme.vue` → modeName: 'musicPlayerTheme'
- `windowsDesktop.vue` → modeName: 'windowsDesktop'
- `macOSDesktop.vue` → modeName: 'macOSDesktop'
- `newsReader.vue` → modeName: 'newsReader'
- `codeEditorTheme.vue` → modeName: 'codeEditorTheme'
- `searchEngine.vue` → modeName: 'searchEngine'

### 步骤2：更新模式选项
在 `useGlobalSetting.ts` 中：
- 在 `originHomeModeOps` 数组末尾新增10个模式选项
- value 从 "4" 到 "13"

### 步骤3：更新小组件默认配置
在 `useSmallComponentsOps.ts` 中：
- 为10种新模式添加默认小组件配置

### 步骤4：更新模式切换逻辑
在 `index.vue` 中：
- 导入10个新模式组件
- 在 switch 语句中新增 case '4' 到 case '13'

---

## 五、验证方案

1. **TypeScript 类型检查**：`npx tsc --noEmit`
2. **功能验证**：
   - 模式切换正常工作
   - 小组件拖拽、右键菜单、数据持久化正常
   - 界面风格渲染正常

---

## 六、模式总览

| 模式编号 | 模式名称 | 背景色 |
|---------|---------|--------|
| 0 | 透明诗词板 | 透明/自定义 |
| 1 | 模拟Windows更新 | #0077d7 |
| 2 | vscode代码背景 | 自定义 |
| 3 | 自定义 | 自定义 |
| **4** | **极简时钟** | **#0a0a0a** |
| **5** | **GitHub主题** | **#0d1117** |
| **6** | **励志名言** | **#2c3e50** |
| **7** | **终端主题** | **#1e1e1e** |
| **8** | **音乐播放器** | **#1a1a2e** |
| **9** | **Windows桌面** | **#0078d4** |
| **10** | **macOS桌面** | **#1c1c1e** |
| **11** | **新闻阅读** | **#f5f5f5** |
| **12** | **代码编辑** | **#1e1e1e** |
| **13** | **搜索引擎** | **#ffffff** |