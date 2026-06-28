# getLightColor 函数完善与迁移计划

## 一、需求分析

### 1.1 需求概述
将 `src/components/LucideIcon.vue` 中的 `getLightColor` 函数完善，并迁移到 `src/utils/` 工具函数文件夹下，同时新增 `getDarkColor` 函数用于获取颜色的深色层级版本，通过导入形式在组件中使用。

### 1.2 函数功能

#### getLightColor 函数
- **输入**：颜色值（支持多种格式：hex、rgb、rgba、颜色名称）、可选的浅化级别（1-8级）
- **输出**：返回该颜色的浅化版本

#### getDarkColor 函数
- **输入**：颜色值（支持多种格式：hex、rgb、rgba、颜色名称）、可选的深化级别（1-8级）
- **输出**：返回该颜色的深化版本

### 1.3 当前状态
当前 `getLightColor` 函数为空实现，仅有注释说明待完成：
```typescript
function getLightColor(color: string, level?: number): string {
  // TODO: 根据color的颜色，获取浅1，2，3，4，5，6,7,8个层级的颜色
}
```

## 二、代码库调研

### 2.1 现有工具函数结构
```
src/utils/
├── index.ts          # 通用工具函数（节流、防抖、对象处理等）
├── common.ts         # 通用工具（store操作、SQL操作等）
├── css.ts            # CSS属性定义
├── font.ts           # 字体相关
├── time.ts           # 时间相关
├── store.ts          # store操作
└── treeTrans.ts      # 树形结构转换
```

### 2.2 现有工具函数风格
- 使用 ES Module 导出（`export function xxx`）
- 函数命名采用驼峰式
- 类型定义清晰

### 2.3 目标文件分析

**LucideIcon.vue**（第177-179行）：
```typescript
function getLightColor(color: string, level?: number): string {
  // TODO: 根据color的颜色，获取浅1，2，3，4，5，6,7,8个层级的颜色
}
```

## 三、实现方案

### 3.1 方案设计

#### 3.1.1 文件组织
- 在 `src/utils/` 下创建新文件 `color.ts`，用于存放颜色处理相关工具函数
- 在 `src/utils/index.ts` 中导出 `getLightColor` 和 `getDarkColor` 函数（保持统一入口）

#### 3.1.2 函数实现逻辑

1. **颜色格式解析**：支持以下格式
   - Hex: `#fff`, `#ffffff`, `fff`, `ffffff`
   - RGB: `rgb(255, 255, 255)`, `rgba(255, 255, 255, 1)`
   - 颜色名称: `red`, `blue`, `currentColor` 等

2. **浅化算法**（getLightColor）：
   - 将颜色转换为 RGB 格式
   - 根据浅化级别（1-8）增加 RGB 各通道值，向白色趋近
   - 级别1浅化程度最小，级别8浅化程度最大（接近白色）

3. **深化算法**（getDarkColor）：
   - 将颜色转换为 RGB 格式
   - 根据深化级别（1-8）减少 RGB 各通道值，向黑色趋近
   - 级别1深化程度最小，级别8深化程度最大（接近黑色）

4. **边界处理**：
   - `currentColor` 返回透明或原始值
   - 无效颜色格式返回默认值

#### 3.1.3 函数签名
```typescript
export function getLightColor(color: string, level?: number): string
export function getDarkColor(color: string, level?: number): string
```

### 3.2 修改文件列表

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `src/utils/color.ts` | 新建 | 创建颜色处理工具函数（getLightColor、getDarkColor） |
| `src/utils/index.ts` | 修改 | 导出 `getLightColor` 和 `getDarkColor` 函数 |
| `src/components/LucideIcon.vue` | 修改 | 移除本地函数，改为从 utils 导入 |

## 四、实施步骤

### 步骤1：创建颜色处理工具文件
**文件**：`src/utils/color.ts`

实现内容：
1. 颜色格式解析函数（hexToRgb、rgbToHex）
2. `getLightColor` 函数：解析颜色 → 浅化处理 → 返回 hex 格式
3. `getDarkColor` 函数：解析颜色 → 深化处理 → 返回 hex 格式

### 步骤2：更新 utils/index.ts
**文件**：`src/utils/index.ts`

在文件末尾添加：
```typescript
export { getLightColor, getDarkColor } from './color'
```

### 步骤3：修改 LucideIcon.vue
**文件**：`src/components/LucideIcon.vue`

修改内容：
1. 添加导入语句：`import { getLightColor } from '@/utils'`
2. 移除本地定义的 `getLightColor` 函数

## 五、潜在风险与注意事项

### 5.1 风险点
1. **颜色格式兼容性**：需支持多种颜色格式，避免解析失败
2. **currentColor 处理**：`currentColor` 是 CSS 关键字，需特殊处理
3. **深浅化算法合理性**：需确保深浅化后的颜色符合视觉预期

### 5.2 注意事项
1. 浅化/深化级别范围限定为 1-8，超出范围取边界值
2. 返回颜色格式统一为 hex（带 `#` 前缀）
3. 保持函数的纯函数特性，不产生副作用

## 六、验证方案

### 6.1 验证方法
1. **TypeScript 类型检查**：执行 `npx tsc --noEmit` 确保类型正确
2. **组件功能验证**：确保 LucideIcon 组件的背景色功能正常工作

### 6.2 测试用例

#### getLightColor 测试用例
| 输入颜色 | 浅化级别 | 预期效果 |
|---------|---------|---------|
| `#ff0000` | 1 | 浅红色 |
| `#00ff00` | 8 | 接近白色的浅绿色 |
| `rgb(0, 0, 255)` | 4 | 中等浅化的蓝色 |
| `currentColor` | 任意 | 返回透明或原值 |

#### getDarkColor 测试用例
| 输入颜色 | 深化级别 | 预期效果 |
|---------|---------|---------|
| `#ff0000` | 1 | 深红色 |
| `#00ff00` | 8 | 接近黑色的深绿色 |
| `rgb(0, 0, 255)` | 4 | 中等深化的蓝色 |
| `currentColor` | 任意 | 返回透明或原值 |

## 七、依赖关系

- **新增依赖**：无
- **现有依赖**：Vue 3、TypeScript
