# 小窗口定位逻辑优化计划

## 一、问题分析

### 当前逻辑
[newWindow.ts](file:///C:/cod/electron-vite-vue/electron/main/module/newWindow.ts) 第48-49行：
```javascript
x: ops?.center ? null : ops?.x === 0 ? ops?.x : (ops?.x || screenWidth - 120),
y: ops?.center ? null : ops?.y === 0 ? ops?.y : (ops?.y || screenHeight - 219),
```

**问题：**
- 使用固定偏移量（120, 219），没有考虑窗口实际宽高
- 没有默认间隙，可能紧贴屏幕边缘
- 不支持多种定位方向

### 二、优化方案

#### 1. 定位方向支持

支持的定位方向：
| 方向 | 说明 |
|------|------|
| `bottom-right` | 右下角（默认） |
| `bottom-left` | 左下角 |
| `top-right` | 右上角 |
| `top-left` | 左上角 |
| `center` | 屏幕中央 |
| `center-top` | 顶部中央 |
| `center-bottom` | 底部中央 |
| `center-left` | 左侧中央 |
| `center-right` | 右侧中央 |

#### 2. 默认间隙

- 默认间隙：30px
- 可通过 `ops.gap` 自定义间隙大小

#### 3. 定位计算逻辑

```
┌─────────────────────────────────────┐
│         top-left   center-top   top-right        │
│         ──────────────────────────               │
│                                                  │
│   center-left          center          center-right   │
│                                                  │
│         ──────────────────────────               │
│      bottom-left  center-bottom  bottom-right   │
└─────────────────────────────────────┘
```

### 三、具体修改

#### 修改 createOtherWindow 函数

**新增参数支持：**
- `ops.position`：定位方向，默认 `bottom-right`
- `ops.gap`：距离屏幕边缘的间隙，默认 30

**定位计算逻辑：**

```javascript
function calculatePosition(ops) {
  const width = ops?.width || 108;
  const height = ops?.height || 81;
  const gap = ops?.gap || 30;
  const position = ops?.position || 'bottom-right';
  
  let x, y;
  
  switch (position) {
    case 'bottom-right':
      x = screenWidth - width - gap;
      y = screenHeight - height - gap;
      break;
    case 'bottom-left':
      x = gap;
      y = screenHeight - height - gap;
      break;
    case 'top-right':
      x = screenWidth - width - gap;
      y = gap;
      break;
    case 'top-left':
      x = gap;
      y = gap;
      break;
    case 'center':
      x = Math.floor((screenWidth - width) / 2);
      y = Math.floor((screenHeight - height) / 2);
      break;
    case 'center-top':
      x = Math.floor((screenWidth - width) / 2);
      y = gap;
      break;
    case 'center-bottom':
      x = Math.floor((screenWidth - width) / 2);
      y = screenHeight - height - gap;
      break;
    case 'center-left':
      x = gap;
      y = Math.floor((screenHeight - height) / 2);
      break;
    case 'center-right':
      x = screenWidth - width - gap;
      y = Math.floor((screenHeight - height) / 2);
      break;
    default:
      x = screenWidth - width - gap;
      y = screenHeight - height - gap;
  }
  
  return { x, y };
}
```

### 四、调用示例

```javascript
// 默认右下角，30px间隙
createOtherWindow('second', { width: 200, height: 100 });

// 左上角，20px间隙
createOtherWindow('second', { width: 200, height: 100, position: 'top-left', gap: 20 });

// 屏幕中央
createOtherWindow('second', { width: 200, height: 100, position: 'center' });

// 顶部中央
createOtherWindow('second', { width: 200, height: 100, position: 'center-top' });
```

### 五、完成标准

- [ ] 支持多种定位方向（bottom-right, bottom-left, top-right, top-left, center, center-top, center-bottom, center-left, center-right）
- [ ] 默认右下角定位，考虑窗口实际宽高
- [ ] 默认间隙 30px，可自定义
- [ ] 向后兼容：未传入 position 时默认右下角
- [ ] 代码无报错
