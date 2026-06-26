# 番茄钟小窗口响应式布局优化计划

## 一、问题分析

### 当前问题
[pomodoroMiniWindow/index.vue](file:///C:/cod/electron-vite-vue/src/views/pomodoroMiniWindow/index.vue) 使用了大量固定尺寸单位（px），导致在不同窗口大小下内容可能溢出或显示不完整。

### 窗口尺寸变化
根据 [newWindow.ts](file:///C:/cod/electron-vite-vue/electron/main/module/newWindow.ts) 和 [useWindowMode.ts](file:///C:/cod/electron-vite-vue/src/store/useWindowMode.ts)：
- 默认尺寸：108 x 81 px
- 配置尺寸：200 x 100 px
- 可能还有其他自定义尺寸

### 当前固定尺寸问题
| 属性 | 当前值 | 问题 |
|------|--------|------|
| padding | 16px | 在 108x81 的小窗口中占比过大 |
| 状态标签字体 | 16px | 可能导致文字溢出 |
| 倒计时字体 | 32px | 在小窗口中过大 |
| 各区域间距 | 12px | 固定间距可能压缩内容 |
| 拖拽区域 | 12px | 固定高度 |

---

## 二、优化方案

### 1. 使用相对单位替代固定单位

**核心思路：**
- 使用 `vmin` 作为字体大小单位（基于视口最小边）
- 使用百分比作为容器尺寸单位
- 使用 `em` 或 `%` 作为间距单位
- 确保内容自适应窗口大小

### 2. 布局优化

**布局结构：**
```
┌──────────────────────────┐
│  拖拽区域 (8%)            │
│  ┌─┐ 状态标签            │
│  │●│ 子标题              │
│  └─┘                     │
│  倒计时 (自适应大小)       │
│  ▓▓▓▓▓▓▓░░░ 进度条       │
└──────────────────────────┘
```

**关键改进：**
- 倒计时字体大小使用 `vmin`，根据窗口大小自动缩放
- 所有 padding 和间距使用百分比或 em
- 使用 `flex` 布局自动分配空间
- 添加最小/最大字体限制，防止过大或过小

### 3. 响应式策略

| 窗口尺寸 | 字体大小策略 |
|----------|-------------|
| 极小 (< 120px) | 最小 10px 字体，简化显示 |
| 小 (120-200px) | 4-5vmin 字体 |
| 中等 (200-300px) | 5-6vmin 字体 |
| 大 (> 300px) | 最大 24px 字体 |

---

## 三、具体修改计划

### 修改 pomodoroMiniWindow/index.vue

#### 1. 样式修改

**容器样式：**
```scss
.pomodoro-mini-window {
  width: 100%;
  height: 100%;
  padding: 4% 6%;  // 使用百分比替代固定px
  box-sizing: border-box;
  // ...其他样式
}
```

**拖拽区域：**
```scss
.drag-area {
  height: 10%;  // 使用百分比
  min-height: 8px;
  margin-bottom: 4%;
}
```

**状态区域：**
```scss
.status-section {
  gap: 0.5em;  // 使用em相对单位
  
  .status-dot {
    width: 1.5em;  // 使用em相对单位
    height: 1.5em;
  }
  
  .status-label {
    font-size: clamp(10px, 4vmin, 16px);  // 响应式字体
  }
  
  .status-subtitle {
    font-size: clamp(8px, 2.5vmin, 12px);
  }
}
```

**倒计时：**
```scss
.countdown-value {
  font-size: clamp(16px, 10vmin, 32px);  // 大字体但有上限
  line-height: 1.2;
}
```

**进度条：**
```scss
.progress-section {
  gap: 0.5em;
  
  .progress-bar {
    height: clamp(4px, 1.5vmin, 6px);
  }
  
  .progress-text {
    font-size: clamp(8px, 2.5vmin, 12px);
    min-width: auto;
  }
}
```

#### 2. 布局调整
- 确保所有内容使用 flex 布局，自动分配空间
- 添加 `overflow: hidden` 防止内容溢出
- 文字溢出时使用省略号

---

## 四、技术实现细节

### 1. clamp() 函数
使用 CSS `clamp()` 函数实现响应式字体：
- `clamp(min, preferred, max)`
- preferred 使用 vmin 单位，基于视口最小边

### 2. em 单位
- 相对于当前元素的字体大小
- 适合用于间距和内边距

### 3. vmin 单位
- 视口最小边的 1%
- 确保在宽高变化时都能正常显示

### 4. flex 布局
- 使用 flex-grow 分配剩余空间
- 使用 flex-shrink 控制收缩
- 确保内容不会溢出

---

## 五、验证标准

1. **108x81 窗口**：所有内容可见，不溢出
2. **200x100 窗口**：内容舒适展示
3. **300x200 窗口**：内容不过大，有最大限制
4. **任意比例窗口**：内容自适应，不溢出
5. **文字完整**：所有文字完整显示，不被截断

---

## 六、完成标准

- [ ] 所有固定 px 单位替换为相对单位
- [ ] 字体大小使用 clamp() 响应式
- [ ] 间距和内边距使用百分比或 em
- [ ] 108x81 小窗口下内容完整显示
- [ ] 大窗口下内容有最大限制
- [ ] 代码无报错
