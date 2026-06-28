# GitHub主题模式重构计划

## 一、需求分析

用户要求修改 `githubTheme.vue` 组件，使其更完全仿照GitHub主页样式，并在某处插入倒计时功能。

### 当前问题
1. 当前实现过于简单，没有完全仿照GitHub主页的布局结构
2. 倒计时功能虽然存在，但展示方式不够明显

### 目标效果
1. 仿照GitHub主页布局：顶部导航栏 + 主体内容区
2. 集成番茄钟倒计时功能，作为页面的一个核心展示元素
3. 保持GitHub深色主题风格（#0d1117背景）

## 二、GitHub主页参考结构

### 顶部导航栏
- GitHub Logo
- 搜索框
- 导航链接（Pull requests、Issues、Marketplace等）
- 通知图标
- 用户头像

### 主体内容区
- 左侧：欢迎信息、状态展示
- 中间/右侧：卡片式布局（类似GitHub的仓库卡片、活动卡片）

## 三、修改方案

### 1. 重构模板结构
```html
<template>
  <div class="github-theme">
    <!-- 顶部导航栏 -->
    <header class="github-header">
      <div class="header-content">
        <div class="header-left">
          <svg class="github-logo" ... />
          <nav class="header-nav">...</nav>
        </div>
        <div class="header-center">
          <div class="search-box">...</div>
        </div>
        <div class="header-right">
          <LucideIcon name="Bell" />
          <div class="user-avatar">...</div>
        </div>
      </div>
    </header>
    
    <!-- 主体内容区 -->
    <main class="github-main">
      <div class="main-content">
        <!-- 左侧区域 -->
        <div class="main-left">
          <div class="hero-section">
            <h1>{{ statusTitle }}</h1>
            <p>{{ statusSubtitle }}</p>
          </div>
          
          <!-- 倒计时卡片 -->
          <div class="countdown-card" :class="curStatusC.value">
            <div class="countdown-header">
              <LucideIcon :name="curStatusC.value === 'work' ? 'Coffee' : 'Sun'" />
              <span>{{ curStatusC.value === 'work' ? '专注时间' : '休息时间' }}</span>
            </div>
            <div class="countdown-display">{{ displayTime }}</div>
            <div class="countdown-progress">
              <div class="progress-bar" :style="{ width: progress + '%' }"></div>
            </div>
          </div>
        </div>
        
        <!-- 右侧区域（类似GitHub仓库卡片） -->
        <div class="main-right">
          <div class="repo-card">...</div>
          <div class="activity-card">...</div>
        </div>
      </div>
    </main>
    
    <!-- 底部 -->
    <footer class="github-footer">...</footer>
  </div>
</template>
```

### 2. 脚本逻辑修改
- 保持现有的倒计时逻辑
- 添加进度计算（可选）
- 确保状态切换正确

### 3. 样式修改
- 添加顶部导航栏样式
- 添加主体内容区布局样式
- 添加倒计时卡片样式
- 保持GitHub风格的颜色和间距

## 四、文件修改清单

| 文件路径 | 修改内容 |
|---------|---------|
| `src/views/home/githubTheme.vue` | 重构模板结构、样式和脚本逻辑 |

## 五、关键实现细节

### 倒计时功能实现
参考 `motivationalQuote.vue` 的实现方式：
1. 从 `useWorkOrRestStore` 获取 `nextRestTime` 和 `nextWorkTime`
2. 使用 `setInterval` 每秒钟更新倒计时
3. 使用 `countDown` 函数计算剩余时间并格式化

### GitHub风格样式
- 背景色：#0d1117
- 主文字：#f0f6fc
- 次文字：#8b949e
- 边框：#30363d
- 蓝色高亮：#58a6ff

## 六、风险评估

1. **布局兼容性**：需要确保在不同屏幕尺寸下都能正常显示
2. **状态同步**：倒计时需要与全局状态保持同步
3. **性能优化**：定时器需要正确清理，避免内存泄漏

## 七、验证方案

1. 使用 `npx tsc --noEmit` 进行TypeScript类型检查
2. 运行开发服务器预览效果
3. 验证倒计时功能是否正常工作
4. 验证状态切换是否正确显示

## 八、实施步骤

1. 修改模板结构，添加导航栏和主体内容区
2. 修改脚本逻辑，确保倒计时功能正常
3. 修改样式，实现GitHub风格
4. 运行TypeScript检查
5. 预览效果并验证