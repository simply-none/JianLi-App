# 番茄钟休息状态进度条修复计划

## 一、问题分析

### 当前问题
[pomodoroMiniWindow/index.vue](file:///C:/cod/electron-vite-vue/src/views/pomodoroMiniWindow/index.vue) 在休息状态时，进度条没有变化。

### 可能原因

1. **进度计算逻辑问题**：休息状态下的 start/end 时间计算可能有误
2. **数据同步问题**：休息状态下的数据可能没有正确同步
3. **样式问题**：休息状态下进度条颜色与背景相似，导致视觉上看不出变化

### 当前进度计算逻辑

```javascript
const progressPercent = computed(() => {
  const status = curStatusC.value?.value;
  
  if (!sysData.value) return 0;
  
  let start, end;
  
  if (status === 'work') {
    start = sysData.value.startWorkTime;
    end = sysData.value.startWorkTime + sysData.value.workTimeGapUnit * sysData.value.workTimeGap;
  } else {
    start = sysData.value.closeWorkTime;
    end = sysData.value.closeWorkTime + sysData.value.restTimeGapUnit * sysData.value.restTimeGap;
  }
  
  const now = moment().valueOf();
  const total = end - start;
  const current = now - start;
  
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (current / total) * 100));
});
```

---

## 二、修复计划

### 步骤 1：检查并修复进度计算逻辑

**问题点：**
- 休息状态下使用 `closeWorkTime` 作为开始时间
- 需要确认 `restTimeGapUnit` 和 `restTimeGap` 是否正确同步
- 可能需要添加调试日志确认数据

**修复方案：**
1. 确认休息状态下的时间计算正确
2. 添加边界情况处理（数据缺失时显示0%）
3. 确保进度条在休息状态下正确更新

### 步骤 2：检查样式可见性

**问题点：**
- 休息状态下进度条颜色是蓝色
- 背景也是淡蓝色
- 可能对比度不够，导致视觉上不明显

**修复方案：**
- 增加进度条与背景的对比度
- 确保进度条在两种状态下都清晰可见

### 步骤 3：验证倒计时与进度条同步

**问题点：**
- 倒计时每秒更新一次
- 进度条计算基于当前时间，应该也是每秒变化
- 需要确认两者同步

**修复方案：**
- 确保进度计算使用的时间基准与倒计时一致
- 进度条平滑过渡

---

## 三、具体修改内容

### 1. 进度计算逻辑优化

```javascript
const progressPercent = computed(() => {
  const status = curStatusC.value?.value;
  
  if (!sysData.value) return 0;
  
  let startTime, duration;
  
  if (status === 'work') {
    startTime = sysData.value.startWorkTime;
    duration = sysData.value.workTimeGapUnit * sysData.value.workTimeGap;
  } else {
    startTime = sysData.value.closeWorkTime;
    duration = sysData.value.restTimeGapUnit * sysData.value.restTimeGap;
  }
  
  if (!startTime || !duration || duration <= 0) return 0;
  
  const now = moment().valueOf();
  const elapsed = now - startTime;
  const progress = (elapsed / duration) * 100;
  
  return Math.max(0, Math.min(100, progress));
});
```

### 2. 样式优化（可选）

- 增加进度条背景的对比度
- 确保休息状态下进度条清晰可见

---

## 四、验证方法

1. **工作状态测试**：确认工作状态下进度条正常增长
2. **休息状态测试**：确认休息状态下进度条正常增长
3. **状态切换测试**：状态切换时进度条正确重置
4. **数据同步测试**：确认主窗口数据同步到小窗口

---

## 五、完成标准

- [ ] 休息状态下进度条正确显示并随时间增长
- [ ] 工作状态下进度条正常工作（不受影响）
- [ ] 状态切换时进度条正确重置
- [ ] 代码无报错
