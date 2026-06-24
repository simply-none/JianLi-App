# 番茄钟强制切换逻辑实现方案

## 问题分析

### 当前状态管理方式
- 番茄钟状态通过 `startWorkTime` 和 `closeWorkTime` 判断
- 当 `startWorkTime >= closeWorkTime` 时，表示正在工作
- 当 `startWorkTime < closeWorkTime` 时，表示正在休息
- 状态数据存储在 SQLite 数据库的 `basic_info` 表中

### 用户需求
在 `registerShortcut.ts` 的 `showApp` 方法中，当满足以下条件时：
1. 当前应用处于显示状态 (`win.isVisible() === true`)
2. 番茄钟状态为休息 (`startWorkTime < closeWorkTime`)

在隐藏应用时，需要：
1. 写入记录，将番茄钟状态改为工作
2. 加入一个强制字段标识

## 解决方案

### 修改文件清单

| 文件路径 | 修改内容 |
|---------|---------|
| `electron/main/module/registerShortcut.ts` | 修改 `showApp` 方法，增加强制切换逻辑 |
| `electron/main/module/store.ts` | 新增辅助函数，获取和设置番茄钟状态 |

### 实施步骤

#### 步骤 1：在 store.ts 中新增辅助函数
```typescript
// 获取番茄钟状态
export function getPomodoroStatus(): { 
  isResting: boolean; 
  startWorkTime: number; 
  closeWorkTime: number; 
}

// 设置番茄钟状态为工作（强制）
export function setPomodoroToWork(force: boolean = true): void
```

#### 步骤 2：修改 registerShortcut.ts 中的 showApp 方法
```typescript
function showApp() {
  if (win.isVisible()) {
    // 获取番茄钟状态
    const status = getPomodoroStatus()
    
    // 如果正在休息，则强制切换到工作状态
    if (status.isResting) {
      setPomodoroToWork(true)
    }
    
    hideApp()
  } else {
    win.show()
  }
}
```

#### 步骤 3：添加强制字段标识
在设置工作状态时，额外存储一个 `force` 字段，用于标识这次切换是强制的：
```typescript
{
  startWorkTime: Date.now(),
  closeWorkTime: Date.now(),
  force: true,
  forceTime: Date.now()
}
```

### 技术细节

#### 状态判断逻辑
```typescript
// 获取 startWorkTime 和 closeWorkTime
const startWorkTime = await getStore('startWorkTime')
const closeWorkTime = await getStore('closeWorkTime')

// 判断是否正在休息
const isResting = startWorkTime < closeWorkTime
```

#### 强制切换逻辑
```typescript
// 将 startWorkTime 和 closeWorkTime 都设置为当前时间
// 这样 startWorkTime >= closeWorkTime，状态变为工作
await setStore('startWorkTime', Date.now())
await setStore('closeWorkTime', Date.now())
// 记录强制切换标识
await setStore('pomodoroForce', {
  force: true,
  time: Date.now(),
  from: 'rest',
  to: 'work'
})
```

## 风险评估

| 风险 | 等级 | 应对措施 |
|-----|------|---------|
| 状态不一致 | 低 | 使用事务确保状态同时更新 |
| IPC 调用失败 | 低 | 添加错误处理和日志 |
| 性能影响 | 低 | 只在特定条件下触发，不影响正常流程 |

## 验证方案

1. 启动应用，进入休息状态
2. 使用快捷键显示应用
3. 再次使用快捷键隐藏应用
4. 验证数据库中状态是否已切换为工作，且包含强制标识

## 预期结果

- 当应用在休息状态下通过快捷键隐藏时，番茄钟状态自动切换为工作
- 数据库中记录包含 `force: true` 标识
- 前端状态同步更新
