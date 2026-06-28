# 极简时钟背景更换功能实现计划

## 需求概述
为极简时钟主题添加更换背景/背景图片的功能，设置图标需要融入当前的极简风格排版中，不能显得突兀。

## 存储方式（重要补充）

根据用户指示，首页模式的配置存储在 `basic_info` 表中，使用对象形式存储：
- **存储字段格式**: `home-mode:{模式英文标识}`
- **对于极简时钟**: `home-mode:minimal-clock`
- **参考实现**: `window-mode:pomodoro` 字段的存储方式（见 `src/store/useWindowMode.ts`）

### 存储 API 用法
```ts
// 存储（保存配置）
setStore('home-mode:minimal-clock', {
  backgroundType: 'gradient' | 'image' | 'none',
  backgroundValue: '背景值（渐变CSS或图片URL）'
});

// 读取（初始化）
const config = getStore('home-mode:minimal-clock');
```

## 当前状态分析

### 现有代码结构
- **极简时钟组件**: `src/views/home/minimalClock.vue`
  - 当前使用固定的深色渐变背景 (`linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)`)
  - 极简风格：纯色、大字体、圆形状态指示器
  - 无设置按钮

- **窗口模式存储**: `src/store/useWindowMode.ts`
  - 展示了 `window-mode:pomodoro` 的存储模式
  - 使用 `setStore`/`getStore` 函数
  - 配置以对象形式存储在 `basic_info` 表中

- **上传组件**: `src/components/upload.vue`
  - 支持文件上传，可复用

### 设计决策
1. **设置按钮设计**: 采用极简透明圆形按钮，固定在右下角，hover 时淡入，click 时显示面板
2. **背景设置面板**: 弹出式面板，包含预设背景网格和自定义上传入口
3. **预设背景**: 提供 6-8 种预设渐变/图片背景供选择
4. **持久化存储**: 将背景配置存入 `home-mode:minimal-clock` 字段中

## 实现方案

### 1. 修改 minimalClock.vue

#### 模板部分
- 添加设置按钮（右下角，透明圆形按钮，hover 显示，LucideIcon）
- 添加背景设置弹出面板（el-popover）
- 背景容器动态绑定 `style`（支持背景图片和渐变）

#### 脚本部分
- 引入 `getStore`, `setStore` 从 `@/utils/common`
- 定义预设背景列表（渐变和图片 URL）
- 从 store 读取当前背景配置
- 添加方法：
  - `selectBackground(background)`: 选择预设背景
  - `removeBackground()`: 移除自定义背景
  - `handleImageUpload(file)`: 处理图片上传
  - `saveBackground()`: 保存到 `home-mode:minimal-clock`

#### 样式部分
- 设置按钮样式（透明圆形，hover 效果，与现有极简风格一致）
- 弹出面板样式（毛玻璃效果，圆角）
- 预设背景网格样式

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/views/home/minimalClock.vue` | 添加设置按钮、背景选择面板、背景切换逻辑、持久化存储 |

## 详细实现步骤

### 步骤 1: 修改 minimalClock.vue 脚本
1. 引入依赖：
   ```ts
   import { getStore, setStore } from '@/utils/common';
   ```
2. 定义极简时钟配置接口和默认值：
   ```ts
   interface MinimalClockConfig {
     backgroundType: 'gradient' | 'image' | 'none';
     backgroundValue: string;
   }
   
   const defaultBackground = {
     backgroundType: 'gradient' as const,
     backgroundValue: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)'
   };
   ```
3. 定义预设背景列表：
   ```ts
   const presetBackgrounds = [
     { type: 'gradient', value: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', label: '深空黑' },
     { type: 'gradient', value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', label: '星空紫' },
     // ... 更多预设
   ];
   ```
4. 从 store 读取/初始化配置
5. 添加保存和选择背景的方法

### 步骤 2: 修改 minimalClock.vue 模板
1. 添加设置按钮（右下角固定）
2. 添加背景选择弹出面板

### 步骤 3: 修改 minimalClock.vue 样式
1. 设置按钮样式（透明圆形，hover 显示）
2. 背景选择面板样式
3. 确保与现有极简风格一致

## 预设背景方案

### 渐变背景
1. 深空黑: `linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)`
2. 星空紫: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`
3. 晨曦橙: `linear-gradient(135deg, #2d1e2f 0%, #4a3728 100%)`
4. 极光绿: `linear-gradient(135deg, #0f2027 0%, #203a43 100%)`
5. 深海蓝: `linear-gradient(135deg, #0f0c29 0%, #302b63 100%)`

### 图片背景（使用 Unsplash Source）
1. 城市夜景: `https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920`
2. 自然风光: `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920`
3. 抽象艺术: `https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920`
4. 极简几何: `https://images.unsplash.com/photo-1557683316-973673baf926?w=1920`

## 验证步骤

1. 启动开发服务器 `npm run dev`
2. 切换到极简时钟模式
3. 验证设置按钮在右下角正确显示（hover 时）
4. 点击设置按钮，验证弹出面板正常显示
5. 选择预设背景，验证背景实时切换
6. 上传自定义图片，验证图片设置为背景
7. 刷新页面，验证背景设置已持久化保存（从 `home-mode:minimal-clock` 读取）
8. TypeScript 类型检查: `npx tsc --noEmit`

## 风险与注意事项

1. **图片 URL 有效性**: 使用可靠的免费图片 CDN
2. **大图片性能**: 上传图片时限制大小或压缩
3. **风格一致性**: 确保设置按钮和面板不破坏极简风格
4. **存储大小**: 避免 base64 存储大图片，考虑使用本地文件路径
