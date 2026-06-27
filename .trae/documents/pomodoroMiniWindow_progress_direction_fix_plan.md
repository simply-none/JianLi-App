# 番茄钟小窗口进度条方向修复计划

## 问题现象

小窗口的进度条目前是递增的（从 0% 到 100%），但用户期望是递减的（从 100% 到 0%），表示剩余时间比例。

## 根因分析

当前进度计算逻辑：
```typescript
const elapsed = moment().valueOf() - startTime;
const progress = (elapsed / duration) * 100;
```

- `elapsed` = 已过去时间
- `progress` = 已过去时间占比（递增）

用户期望的逻辑：
```typescript
const progress = 100 - (elapsed / duration) * 100;
```

- `progress` = 剩余时间占比（递减）

## 修复方案

修改两处进度计算：

1. `sync-data-to-other-window` 回调中的进度计算（第 166-167 行）
2. `countDown` 定时器中的进度计算（第 222-224 行）

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/views/pomodoroMiniWindow/index.vue` | 进度计算公式改为 `100 - elapsed/duration * 100` |

## 修改步骤

1. 打开 `src/views/pomodoroMiniWindow/index.vue`
2. 定位第 166-167 行，改为：
   ```typescript
   const progress = 100 - (elapsed / duration) * 100;
   ```
3. 定位第 222-224 行，改为：
   ```typescript
   const progress = 100 - (elapsed / duration) * 100;
   ```
4. 运行 TypeScript 类型检查验证

## 验证方法

1. 打开番茄钟小窗口
2. 观察进度条从 100% 开始逐渐减少到 0%
3. 工作阶段结束或休息阶段结束时进度条应为 0%