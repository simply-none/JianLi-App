# 终端主题模式重构计划

## 一、需求分析

用户要求修改 `terminalTheme.vue` 组件，使其铺满整个页面，运行命令模拟数据以填满屏幕，并将番茄钟信息自然融入其中。

### 当前问题
1. 终端窗口固定大小（700px宽），没有铺满屏幕
2. 内容太少，只有几个输出行
3. 没有模拟命令执行的效果，缺乏真实终端的感觉

### 目标效果
1. 终端铺满整个页面，去掉窗口边框限制
2. 模拟命令执行，显示各种命令输出（ls, git status, npm, system info等）
3. 将番茄钟信息自然融入命令输出中（显示状态、倒计时、进度等）
4. 添加滚动效果，模拟终端输出流

## 二、设计方案

### 布局结构
```html
<template>
  <div class="terminal-theme">
    <!-- 设置按钮 -->
    <button class="settings-btn" @click="goToSettings" title="设置">
      <LucideIcon name="Settings" :size="20" />
    </button>
    
    <!-- 终端内容区域 -->
    <div class="terminal-content">
      <!-- 命令历史记录 -->
      <div class="terminal-history">
        <!-- 系统启动信息 -->
        <div class="system-info">...</div>
        
        <!-- 模拟命令输出 -->
        <div v-for="(line, index) in commandLines" :key="index" class="command-line">...</div>
        
        <!-- 番茄钟信息输出（模拟命令） -->
        <div class="pomodoro-output">...</div>
      </div>
      
      <!-- 当前命令行 -->
      <div class="current-line">
        <span class="prompt">➜</span>
        <span class="command-path">~</span>
        <span class="cursor">█</span>
      </div>
    </div>
  </div>
</template>
```

### 模拟命令列表
1. `ls -la` - 显示目录内容
2. `git status` - 显示git状态
3. `npm run build` - 构建输出
4. `neofetch` - 系统信息
5. `date` - 当前时间
6. `top` - 进程信息
7. `cat pomodoro-status.txt` - 番茄钟状态
8. `./start-pomodoro.sh` - 启动番茄钟脚本

### 番茄钟信息融入方式
1. 通过模拟命令输出显示当前状态
2. 使用进度条显示完成进度
3. 显示剩余时间和下一次状态切换时间
4. 使用颜色区分工作/休息状态

## 三、文件修改清单

| 文件路径 | 修改内容 |
|---------|---------|
| `src/views/home/terminalTheme.vue` | 重构模板结构、样式和脚本逻辑 |

## 四、关键实现细节

### 命令行模拟
- 使用 `setInterval` 定期添加新的命令行输出
- 模拟命令执行延迟效果
- 使用打字机效果显示输出

### 番茄钟状态显示
- 在终端输出中添加 `pomodoro` 相关命令
- 使用不同颜色显示工作/休息状态（红色/绿色）
- 实时更新倒计时和进度

### 滚动效果
- 自动滚动到底部显示最新命令
- 支持手动滚动查看历史

## 五、风险评估

1. **性能问题**：过多的DOM元素可能导致性能问题，需要限制历史记录数量
2. **状态同步**：番茄钟状态需要与全局状态保持同步
3. **滚动体验**：自动滚动可能会影响用户体验，需要处理好滚动时机

## 六、验证方案

1. 使用 `npx tsc --noEmit` 进行TypeScript类型检查
2. 运行开发服务器预览效果
3. 验证终端是否铺满整个页面
4. 验证命令输出是否正常
5. 验证番茄钟信息是否正确显示

## 七、实施步骤

1. 修改模板结构，去掉窗口限制，改为全屏终端
2. 添加命令历史记录和模拟命令输出
3. 实现命令行打字机效果
4. 集成番茄钟信息到命令输出中
5. 添加自动滚动功能
6. 调整样式，使用终端配色方案
7. 运行TypeScript检查
8. 预览效果并验证