# 番茄钟小窗口皮肤配置读取问题排查与修复计划

## 问题描述
小窗口没有读取到变更后的对象属性，导致关闭后重新打开，皮肤并没有切换成最新的。

## 问题根因分析

### 根因 1：cycleTheme 读错了 DOM 属性（关键 Bug）
**文件**：`src/views/pomodoroMiniWindow/index.vue` 第76-83行

```typescript
const cycleTheme = () => {
  // 错误：读取的是 data-theme（全局主题，如 dark/midnight）
  // 而皮肤实际存储在 data-skin 属性中
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'default'
  const idx = themes.indexOf(currentTheme)
  // themes = ['coral', 'mint', 'sky', ...]
  // data-theme 的值是全局主题（如 'dark'），不在 themes 数组中
  // 所以 idx = -1，每次都从 themes[0] = 'coral' 开始
  const nextTheme = themes[(idx + 1) % themes.length]
  ...
}
```

**影响**：
- 点击皮肤切换按钮，总是从 coral 开始循环
- 即使保存了当前皮肤，下次切换还是从 coral 开始
- 但 saveConfig 是正常的，所以 store 里存的是对的

### 根因 2：默认 skin 值不一致
**文件 1**：`src/store/useWindowMode.ts` 第14-23行
```typescript
const pomodoroMiniWindowConfig = ref({
  ...
  skin: 'default',   // 默认值是 'default'
  layout: 'default',
});
```

**文件 2**：`src/views/windowMode/index.vue` 第434-445行
```typescript
const skinOptions = [
  { label: '默认(白)', value: 'white' },  // 第一个选项是 'white'
  ...
];
```

**问题**：
- store 默认值是 `'default'`，但选项里没有 `'default'`
- `applyTheme` 函数中 `'default'` 和 `'white'` 都会移除 data-skin，但语义不统一
- 新用户首次使用时，windowMode 页面没有选中项被高亮

### 根因 3：applyTheme 中 default 判断冗余
**文件**：`src/views/pomodoroMiniWindow/index.vue` 第91-97行

```typescript
const applyTheme = (theme: string) => {
  if (theme === 'default' || theme === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', theme)
  }
}
```

- `'default'` 是旧的遗留值，新的皮肤列表里没有 `'default'`
- CSS 中 `[data-skin="white"], :not([data-skin])` 已经处理了 white 和无属性两种情况

## 修复方案

### Step 1: 修复 cycleTheme 读错属性的问题
**文件**：`src/views/pomodoroMiniWindow/index.vue`

将 `data-theme` 改为 `data-skin`：
```typescript
const cycleTheme = () => {
  const currentSkin = document.documentElement.getAttribute('data-skin') || 'white'
  const idx = themes.indexOf(currentSkin)
  const nextTheme = themes[(idx + 1) % themes.length]
  applyTheme(nextTheme)
  saveConfig('skin', nextTheme)
}
```

### Step 2: 统一默认 skin 值为 'white'
**文件**：`src/store/useWindowMode.ts`

将默认值从 `'default'` 改为 `'white'`，与 skinOptions 保持一致：
```typescript
const pomodoroMiniWindowConfig = ref({
  position: 'bottom-right',
  width: 108,
  height: 81,
  gap: 30,
  x: 0,
  y: 0,
  skin: 'white',   // 从 'default' 改为 'white'
  layout: 'default',
});
```

同时修改 `objectVars` 中的默认值：
```typescript
{
  field: "window-mode:pomodoro",
  default: {
    ...
    skin: 'white',  // 从 'default' 改为 'white'
    layout: 'default',
  },
  map: pomodoroMiniWindowConfig,
},
```

### Step 3: 简化 applyTheme 函数
**文件**：`src/views/pomodoroMiniWindow/index.vue`

移除 `'default'` 判断，只保留 `'white'`：
```typescript
const applyTheme = (theme: string) => {
  if (theme === 'white') {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', theme)
  }
}
```

### Step 4: 运行 TypeScript 类型检查
```bash
npx vue-tsc --noEmit
```

## 验证清单
- [ ] cycleTheme 读取 data-skin 而非 data-theme
- [ ] useWindowMode.ts 默认 skin 为 'white'
- [ ] applyTheme 移除 'default' 判断
- [ ] windowMode 页面默认选中 "默认(白)"
- [ ] 小窗口关闭重开后皮肤保持不变
- [ ] 皮肤切换按钮能正确循环切换
- [ ] TypeScript 类型检查通过
