# 文件管理页面图标修复计划

## 问题分析

文件管理页面引入了不存在的 Element Plus 图标，导致报错。

## 无效图标列表

### index.vue
- `CopyDocument` - 不存在
- `Monitor` - 不存在

### fileScan.vue
- `ArrowLeftBold` - 不存在
- `ArrowRightBold` - 不存在

## 替换方案

### index.vue

| 原图标 | 替换为 | 使用位置 |
|--------|--------|---------|
| CopyDocument | Files | 文件转移标题 |
| Monitor | SetUp | 默认应用标题 |

### fileScan.vue

| 原图标 | 替换为 | 使用位置 |
|--------|--------|---------|
| ArrowLeftBold | ArrowLeft | 资源展示左箭头 |
| ArrowRightBold | ArrowRight | 资源展示右箭头 |

## 修改文件

1. `c:\cod\electron-vite-vue\src\views\fileRela\index.vue`
2. `c:\cod\electron-vite-vue\src\views\fileRela\fileScan.vue`

## 验证方式

替换后使用 GetDiagnostics 检查是否有 TypeScript 错误。