# 资源管理页面优化计划

## 一、当前问题分析

**文件位置**: `src/views/resourceManage/index.vue`

当前资源管理页面存在以下问题：
1. **仅支持图片预览**: 使用 `el-image` 组件，只能预览图片格式
2. **其他文件无法查看**: 上传的非图片文件无法预览或打开
3. **排版简陋**: 文件列表展示样式简单，缺乏清晰的视觉层次

## 二、优化方案

### 文件类型分类与预览策略

| 文件类型 | 扩展名 | 预览方式 |
|---------|--------|---------|
| **图片** | jpg, jpeg, png, gif, webp, svg, bmp | `el-image` 预览 + 点击放大 |
| **文本** | txt, md, json, js, ts, html, css, vue, xml, yaml, yml | 原生 FileReader 读取并展示内容 |
| **其他** | pdf, docx, xlsx, exe, zip 等 | 图标展示 + 点击打开文件资源管理器 |

### 打开文件资源管理器

项目中已有现成实现（`appCache/index.vue` 第115行）：
```javascript
send('open-file-in-assets-manager', { path: path })
```

### 排版优化

采用卡片式布局：
- 每个文件作为一个卡片展示
- 卡片包含：文件图标/预览图、文件名、文件类型标签、操作按钮
- 支持拖拽排序（可选）
- 添加文件大小显示

## 三、实施步骤

### 步骤1: 修改资源管理页面模板
- 将单一的图片展示改为通用的文件列表展示
- 添加文件类型判断和对应预览组件
- 添加文件操作按钮（打开、删除）

### 步骤2: 添加文件预览逻辑
- 创建 `getFileType()` 函数判断文件类型
- 创建 `previewFile()` 函数处理文件预览
- 创建 `openFileLocation()` 函数打开文件资源管理器
- 创建 `deleteFile()` 函数删除文件

### 步骤3: 更新样式
- 添加卡片式布局样式
- 添加文件类型图标样式
- 添加文本预览区域样式
- 优化响应式布局

### 步骤4: 更新上传组件（可选）
- 移除上传组件中"只能上传jpg/png文件"的限制提示
- 支持上传更多文件类型

## 四、文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `src/views/resourceManage/index.vue` | 模板、逻辑、样式全面改造 |
| `src/components/upload.vue` | 移除文件类型限制提示 |

## 五、潜在风险与注意事项

1. **文件大小限制**: 文本文件预览时需限制读取大小，避免内存溢出
2. **编码问题**: 文本文件读取时需处理多种编码格式（UTF-8, GBK等）
3. **安全问题**: 文件路径处理需防止路径遍历攻击
4. **性能问题**: 大量文件时需考虑虚拟滚动优化

## 六、参考实现

```javascript
// 文件类型判断
function getFileType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const textExts = ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'vue', 'xml', 'yaml', 'yml'];
  
  if (imageExts.includes(ext)) return 'image';
  if (textExts.includes(ext)) return 'text';
  return 'other';
}

// 文本文件预览
async function previewTextFile(filePath) {
  const content = await window.ipcRenderer.invoke('read-file', filePath);
  return content;
}

// 打开文件资源管理器
function openFileLocation(filePath) {
  send('open-file-in-assets-manager', { path: filePath });
}
```
