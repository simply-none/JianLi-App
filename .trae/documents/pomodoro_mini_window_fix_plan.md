# 番茄钟小窗口数据获取优化计划

## 需求概述

修复小窗口在第一次启动时有时出现"等待中..."字样但番茄钟实际已启动的问题。需要在组件加载时主动请求一次番茄钟相关数据。

## 问题分析

### 当前实现

1. **数据来源**：通过 `sync-data-to-other-window` IPC 事件被动接收数据
2. **初始化时机**：组件挂载时调用 `loadConfig()`，但没有主动获取番茄钟状态
3. **问题**：`curStatusC` 初始为空对象，导致 `nextTime` 为空，显示"等待中..."

### 数据获取方式

用户提到可以使用 `get-store-all` 事件获取 base-info 表的所有数据。

## 解决方案

### 修改步骤

1. **在 `onMounted` 中主动请求番茄钟数据**
   - 使用 `window.ipcRenderer.invoke('get-store-all', 'base-info')` 获取所有数据
   - 解析数据并初始化组件状态
   - 启动倒计时

2. **处理数据结构**
   - 从返回的数据中提取 `curStatus`、`startWorkTime`、`closeWorkTime` 等字段
   - 计算下一个状态切换时间
   - 启动 `countDown` 定时器

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/views/pomodorominiwindow/index.vue` | 在 `onMounted` 中主动获取番茄钟数据 |

## 实现步骤

### 步骤 1: 修改 onMounted 函数

```ts
onMounted(() => {
  loadConfig()
  // 主动获取番茄钟数据
  fetchPomodoroData()
})

async function fetchPomodoroData() {
  try {
    // 使用 get-store-all 获取 base-info 表的所有数据
    const data = await window.ipcRenderer.invoke('get-store-all', 'base-info')
    
    if (data && typeof data === 'object') {
      // 处理数据并更新状态
      handlePomodoroData(data)
      
      // 触发一次数据同步（模拟收到同步消息）
      const event = { data }
      window.ipcRenderer.emit('sync-data-to-other-window', event)
    }
  } catch (e) {
    console.log('获取番茄钟数据失败:', e)
  }
}

function handlePomodoroData(data: any) {
  // 设置当前状态
  curStatusC.value = { value: data.curStatus?.value || 'work' }
  
  // 计算下一个状态切换时间
  if (data.curStatus?.value === 'work') {
    nextTime.value = moment(data.startWorkTime + data.workTimeGapUnit * data.workTimeGap).format('YYYY-MM-DD HH:mm:ss')
  } else {
    nextTime.value = moment(data.closeWorkTime + data.restTimeGapUnit * data.restTimeGap).format('YYYY-MM-DD HH:mm:ss')
  }
  
  // 计算进度
  if (data.curStatus?.value === 'work') {
    const startTime = data.startWorkTime
    const duration = data.workTimeGapUnit * data.workTimeGap
    if (startTime && duration && duration > 0) {
      const elapsed = moment().valueOf() - startTime
      const progress = 100 - (elapsed / duration) * 100
      progressPercentValue.value = Math.max(0, Math.min(100, progress))
    }
  } else {
    const startTime = data.closeWorkTime
    const duration = data.restTimeGapUnit * data.restTimeGap
    if (startTime && duration && duration > 0) {
      const elapsed = moment().valueOf() - startTime
      const progress = 100 - (elapsed / duration) * 100
      progressPercentValue.value = Math.max(0, Math.min(100, progress))
    }
  }
  
  // 同步到 sysData
  sysData.value = data
  
  // 启动倒计时
  countDown()
}
```

### 步骤 2: 验证实现
1. 检查 TypeScript 编译
2. 测试小窗口首次加载是否正常显示番茄钟状态

## 注意事项

1. 使用 `invoke` 而不是 `sendSync`，避免阻塞
2. 数据处理逻辑与 `sync-data-to-other-window` 事件处理保持一致
3. 确保 `countDown` 在数据初始化后调用
