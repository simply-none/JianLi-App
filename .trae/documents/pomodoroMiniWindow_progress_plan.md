# 番茄钟小窗口进度条修复计划

## 需求分析

修复 `pomodoroMiniWindow/index.vue` 中进度条不随时间变化的问题，确保进度条百分比实时更新。

## 当前问题分析

### 问题根因

当前 `progressPercent` 是一个计算属性（computed），依赖于 `curStatusC` 和 `sysData`，但这些依赖只在 `sync-data-to-other-window` 事件触发时更新，没有定时器驱动的实时更新机制。

### 当前计算逻辑

```javascript
const progressPercent = computed(() => {
  const status = curStatusC.value?.value;
  const data = sysData.value;
  // ... 根据 startTime 和 duration 计算进度
});
```

### 解决方案

在倒计时定时器中同步更新进度状态，使进度条实时变化。

## 修改方案

### 修改步骤

1. **添加进度状态变量**：
   - 添加 `progressPercentValue` 响应式变量存储当前进度百分比

2. **修改倒计时函数**：
   - 在 `countDown()` 定时器中计算并更新进度百分比
   - 使用公式：`progress = (已过时间 / 总时间) * 100`

3. **修改模板绑定**：
   - 将 `progressPercent` 改为 `progressPercentValue`

4. **保留计算属性作为初始化**：
   - 在数据同步时初始化进度值

## 风险与注意事项

1. **时间精度**：确保使用 `moment().valueOf()` 获取毫秒级时间戳
2. **状态切换**：工作/休息状态切换时需正确计算初始进度
3. **边界处理**：确保进度值在 0-100 之间

## 验证方案

1. 打开番茄钟小窗口，启动工作计时
2. 观察进度条是否随时间平滑增长
3. 切换到休息状态，验证进度条重新计算
4. 验证进度百分比显示正确