# 修复小窗口定位错误计划

## 问题分析

**现象**：无论怎么设置 position 参数，小窗口始终显示在屏幕左上角

**根因**：
1. store 中 `pomodoroMiniWindowConfig` 和 `miniNotebookWindowConfig` 的默认值包含 `x: 0, y: 0`
2. 打开窗口时，整个配置对象（包括 x=0, y=0）被传递给 `createOtherWindow`
3. `newWindow.ts` 第 124-125 行的判断逻辑有问题：
```typescript
x: ops?.center ? null : ops?.x === 0 ? ops?.x : (ops?.x || calculatePosition(ops).x),
y: ops?.center ? null : ops?.y === 0 ? ops?.y : (ops?.y || calculatePosition(ops).y),
```
   当 `ops?.x === 0` 时，直接使用 0 作为坐标，而不通过 `calculatePosition` 计算。由于默认值就是 0，导致 position 参数完全失效。

## 需要修改的文件

### 1. `electron/main/module/newWindow.ts`
- 修改 `createOtherWindow` 函数中 x/y 坐标的计算逻辑
- 新增 'custom' 到 `PositionType` 类型定义
- 逻辑：当 `position === 'custom'` 时使用传入的 x/y，其他情况一律通过 `calculatePosition(ops)` 计算

### 2. `src/store/useWindowMode.ts`（可选优化）
- 保持不变，因为后端修复后即使传了 x=0/y=0 也不会影响定位

## 修改步骤

1. 在 `PositionType` 中添加 `'custom'` 类型
2. 修改 `calculatePosition` 函数，增加 `custom` 情况的处理（直接返回 ops 中的 x/y）
3. 修改 `createOtherWindow` 中 x/y 的赋值逻辑：
   - 如果 `center` 为 true，使用 null（让 Electron 居中）
   - 如果 `position === 'custom'`，使用传入的 x/y
   - 其他情况，使用 `calculatePosition(ops)` 计算 x/y

## 风险与注意事项

- 现有自定义位置功能需要确保 position 为 'custom' 时 x/y 才生效
- 向后兼容：不传 position 时默认 'bottom-right'，行为不变
- 需要验证 9 个方向定位是否都正常工作
