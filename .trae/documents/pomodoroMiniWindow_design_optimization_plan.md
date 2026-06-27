# 番茄钟小窗口皮肤和主题优化计划

## 任务目标
优化番茄钟小窗口的皮肤（10套独立设计，解决文字和背景不搭配问题）和主题排版（优化样式太丑的问题）。

## 核心问题分析

### 文字颜色与背景协调性问题
当前皮肤使用半透明背景（opacity 0.1-0.12），导致文字与背景对比度不足，可读性差。

**问题示例：**
- `coral` 皮肤：`rgba(255,107,107,0.12)` 背景 + `#DC2626` 深红文字 → 对比度低，文字几乎看不见
- `amber` 皮肤：`rgba(245,158,11,0.1)` 背景 + `#D97706` 琥珀色文字 → 黄/橙对比度差
- `mint` 皮肤：`rgba(0,217,166,0.1)` 背景 + `#059669` 深绿文字 → 对比度不足

### 修复原则
1. **强调色皮肤**（coral, mint, sky, lavender, sakura, amber, aurora）：背景加深或文字提亮
2. **暗色皮肤**（dark）：保持现状，浅色文字在深色背景上对比度良好
3. **灰度皮肤**（gray, white）：适当调整确保可读性

## 10套皮肤重新设计

### 1. 默认白 (white) - 保持
```scss
[data-skin="white"],
:not([data-skin]) {
  --skin-bg: rgba(255, 255, 255, 0.95);
  --skin-border: rgba(99, 102, 241, 0.25);
  --skin-text-primary: #4338ca;      // 靛蓝 - 深色高对比
  --skin-text-secondary: #6366f1;   // 紫色次级
  --skin-dot: #6366f1;
  --skin-dot-glow: rgba(99, 102, 241, 0.6);
  --skin-progress-bg: rgba(99, 102, 241, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #6366f1, #818cf8);
  --skin-circle-ring: #6366f1;
  --skin-btn-bg: rgba(99, 102, 241, 0.12);
  --skin-btn-hover: rgba(99, 102, 241, 0.22);
}
```

### 2. 珊瑚橙 (coral) - 重新设计
```scss
[data-skin="coral"] {
  --skin-bg: rgba(255, 230, 230, 0.92);   // 浅珊瑚底色
  --skin-border: rgba(220, 38, 38, 0.25);
  --skin-text-primary: #DC2626;           // 深红主文字
  --skin-text-secondary: #991B1B;          // 更深红次级
  --skin-dot: #EF4444;
  --skin-dot-glow: rgba(239, 68, 68, 0.6);
  --skin-progress-bg: rgba(220, 38, 38, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #EF4444, #F87171);
  --skin-circle-ring: #EF4444;
  --skin-btn-bg: rgba(239, 68, 68, 0.12);
  --skin-btn-hover: rgba(239, 68, 68, 0.22);
}
```

### 3. 薄荷绿 (mint) - 重新设计
```scss
[data-skin="mint"] {
  --skin-bg: rgba(209, 250, 240, 0.92);   // 浅薄荷底色
  --skin-border: rgba(5, 150, 105, 0.25);
  --skin-text-primary: #059669;            // 深绿主文字
  --skin-text-secondary: #047857;          // 更深绿次级
  --skin-dot: #10B981;
  --skin-dot-glow: rgba(16, 185, 129, 0.6);
  --skin-progress-bg: rgba(5, 150, 105, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #10B981, #34D399);
  --skin-circle-ring: #10B981;
  --skin-btn-bg: rgba(16, 185, 129, 0.12);
  --skin-btn-hover: rgba(16, 185, 129, 0.22);
}
```

### 4. 星空蓝 (sky) - 重新设计
```scss
[data-skin="sky"] {
  --skin-bg: rgba(219, 234, 254, 0.92);   // 浅蓝底色
  --skin-border: rgba(37, 99, 235, 0.25);
  --skin-text-primary: #1D4ED8;            // 深蓝主文字
  --skin-text-secondary: #2563EB;         // 蓝色次级
  --skin-dot: #3B82F6;
  --skin-dot-glow: rgba(59, 130, 246, 0.6);
  --skin-progress-bg: rgba(37, 99, 235, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #3B82F6, #60A5FA);
  --skin-circle-ring: #3B82F6;
  --skin-btn-bg: rgba(59, 130, 246, 0.12);
  --skin-btn-hover: rgba(59, 130, 246, 0.22);
}
```

### 5. 薰衣草 (lavender) - 重新设计
```scss
[data-skin="lavender"] {
  --skin-bg: rgba(237, 233, 254, 0.92);  // 浅紫底色
  --skin-border: rgba(124, 58, 237, 0.25);
  --skin-text-primary: #6D28D9;           // 深紫主文字
  --skin-text-secondary: #7C3AED;          // 紫色次级
  --skin-dot: #8B5CF6;
  --skin-dot-glow: rgba(139, 92, 246, 0.6);
  --skin-progress-bg: rgba(124, 58, 237, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #8B5CF6, #A78BFA);
  --skin-circle-ring: #8B5CF6;
  --skin-btn-bg: rgba(139, 92, 246, 0.12);
  --skin-btn-hover: rgba(139, 92, 246, 0.22);
}
```

### 6. 樱花粉 (sakura) - 重新设计
```scss
[data-skin="sakura"] {
  --skin-bg: rgba(252, 231, 243, 0.92);  // 浅粉底色
  --skin-border: rgba(219, 39, 119, 0.25);
  --skin-text-primary: #BE185D;           // 深粉主文字
  --skin-text-secondary: #DB2777;         // 粉色次级
  --skin-dot: #EC4899;
  --skin-dot-glow: rgba(236, 72, 153, 0.6);
  --skin-progress-bg: rgba(219, 39, 119, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #EC4899, #F472B6);
  --skin-circle-ring: #EC4899;
  --skin-btn-bg: rgba(236, 72, 153, 0.12);
  --skin-btn-hover: rgba(236, 72, 153, 0.22);
}
```

### 7. 琥珀金 (amber) - 重新设计
```scss
[data-skin="amber"] {
  --skin-bg: rgba(254, 243, 199, 0.92);  // 浅黄底色
  --skin-border: rgba(217, 119, 6, 0.25);
  --skin-text-primary: #B45309;           // 深橙主文字（对比度高）
  --skin-text-secondary: #D97706;         // 琥珀次级
  --skin-dot: #F59E0B;
  --skin-dot-glow: rgba(245, 158, 11, 0.6);
  --skin-progress-bg: rgba(217, 119, 6, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #F59E0B, #FBBF24);
  --skin-circle-ring: #F59E0B;
  --skin-btn-bg: rgba(245, 158, 11, 0.12);
  --skin-btn-hover: rgba(245, 158, 11, 0.22);
}
```

### 8. 暗夜黑 (dark) - 保持深色
```scss
[data-skin="dark"] {
  --skin-bg: rgba(31, 41, 55, 0.95);
  --skin-border: rgba(255, 255, 255, 0.1);
  --skin-text-primary: #F3F4F6;
  --skin-text-secondary: #D1D5DB;
  --skin-dot: #60A5FA;
  --skin-dot-glow: rgba(96, 165, 250, 0.6);
  --skin-progress-bg: rgba(255, 255, 255, 0.1);
  --skin-progress-fill: linear-gradient(90deg, #60A5FA, #93C5FD);
  --skin-circle-ring: #60A5FA;
  --skin-btn-bg: rgba(96, 165, 250, 0.15);
  --skin-btn-hover: rgba(96, 165, 250, 0.25);
}
```

### 9. 薄雾灰 (gray) - 重新设计
```scss
[data-skin="gray"] {
  --skin-bg: rgba(243, 244, 246, 0.92);  // 浅灰底色
  --skin-border: rgba(75, 85, 99, 0.25);
  --skin-text-primary: #1F2937;           // 深灰主文字
  --skin-text-secondary: #4B5563;        // 中灰次级
  --skin-dot: #6B7280;
  --skin-dot-glow: rgba(107, 114, 128, 0.6);
  --skin-progress-bg: rgba(75, 85, 99, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #6B7280, #9CA3AF);
  --skin-circle-ring: #6B7280;
  --skin-btn-bg: rgba(107, 114, 128, 0.12);
  --skin-btn-hover: rgba(107, 114, 128, 0.22);
}
```

### 10. 极光青 (aurora) - 重新设计
```scss
[data-skin="aurora"] {
  --skin-bg: rgba(207, 250, 255, 0.92);  // 浅青底色
  --skin-border: rgba(8, 145, 178, 0.25);
  --skin-text-primary: #0E7490;           // 深青主文字
  --skin-text-secondary: #0891B2;         // 青色次级
  --skin-dot: #06B6D4;
  --skin-dot-glow: rgba(6, 182, 212, 0.6);
  --skin-progress-bg: rgba(8, 145, 178, 0.15);
  --skin-progress-fill: linear-gradient(90deg, #06B6D4, #22D3EE);
  --skin-circle-ring: #06B6D4;
  --skin-btn-bg: rgba(6, 182, 212, 0.12);
  --skin-btn-hover: rgba(6, 182, 212, 0.22);
}
```

## 实施步骤

### Step 1: 更新 10 套皮肤定义
**文件**：`c:\cod\electron-vite-vue\src\views\pomodorominiwindow\index.vue` 第247-398行

替换所有皮肤定义为上述新的配色方案，确保：
- 背景提升到 0.92 不透明度（从 0.1-0.12 提升）
- 添加匹配的浅色背景底色（如 `rgba(255, 230, 230, 0.92)` for coral）
- 文字颜色与背景形成高对比度

### Step 2: 更新 windowMode 页面皮肤选项
**文件**：`c:\cod\electron-vite-vue\src\views\windowMode\index.vue` 第434-449行

```typescript
const skinOptions = [
  { label: '默认(白)', value: 'white' },
  { label: '珊瑚橙', value: 'coral' },
  { label: '薄荷绿', value: 'mint' },
  { label: '星空蓝', value: 'sky' },
  { label: '薰衣草', value: 'lavender' },
  { label: '樱花粉', value: 'sakura' },
  { label: '琥珀金', value: 'amber' },
  { label: '暗夜黑', value: 'dark' },
  { label: '薄雾灰', value: 'gray' },
  { label: '极光青', value: 'aurora' },
];
```

### Step 3: 统一 LayoutSimple 皮肤变量
**文件**：`c:\cod\electron-vite-vue\src\views\pomodorominiwindow\layouts\LayoutSimple.vue`

1. **皮肤切换按钮**：使用 `--skin-btn-bg`、`--skin-border`、`--skin-btn-hover`、`--skin-dot`
2. **状态点**：使用 `--skin-dot`、`--skin-dot-glow`
3. **倒计时文字**：使用 `--skin-text-primary`、`--skin-dot-glow` 添加阴影

### Step 4: 统一 LayoutClassic 皮肤变量
**文件**：`c:\cod\electron-vite-vue\src\views\pomodorominiwindow\layouts\LayoutClassic.vue`

1. **皮肤切换按钮**：使用 `--skin-btn-bg`、`--skin-border`、`--skin-btn-hover`、`--skin-dot`
2. **标题文字**：使用 `--skin-text-secondary`
3. **倒计时文字**：使用 `--skin-text-primary`、`--skin-dot-glow` 添加阴影
4. **进度条**：使用 `--skin-progress-bg`、`--skin-progress-fill`
5. **百分比文字**：使用 `--skin-text-secondary`

### Step 5: 运行 TypeScript 类型检查
```bash
npx vue-tsc --noEmit
```

## 验证清单
- [ ] 10套皮肤背景透明度提升到 0.92
- [ ] 10套皮肤都有匹配的浅色背景底色
- [ ] 文字颜色与背景对比度充足
- [ ] windowMode 页面皮肤选项显示新的10套皮肤
- [ ] LayoutSimple 布局使用皮肤变量
- [ ] LayoutClassic 布局使用皮肤变量
- [ ] TypeScript 类型检查通过
