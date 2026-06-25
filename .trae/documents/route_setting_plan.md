# 路由配置页面实现计划

## 一、需求概述

新增一个路由配置页面，位于"系统与资源-系统信息"下面，允许用户灵活配置侧边栏菜单的显示/隐藏，配置数据保存到 `basic_info` 表的 `routeSetting` 字段。

## 二、当前状态分析

### 现有架构

1. **路由定义**（`src/router/index.ts`）：
   - `layoutRouters` 数组定义所有侧边栏路由
   - 每个路由包含 `path`, `name`, `component`, `meta` 属性
   - `RouteNames` 对象定义路由名称常量

2. **菜单分组**（`src/layout/index.vue`）：
   - `groupDefs` 数组定义菜单分组（通用、系统与资源、效率工具等）
   - `menuGroups` computed 属性根据分组生成菜单项
   - `enrichedRouters` 为每个路由注入图标到 `meta`

3. **数据存储**：
   - 使用 `getStore(key)` / `setStore(key, value)` 读写 `basic_info` 表
   - 数据格式为 JSON 字符串

### 需要修改的文件

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/router/index.ts` | 修改 | 添加 `ROUTE_SETTING` 路由 |
| `src/layout/index.vue` | 修改 | 添加菜单配置功能 |
| `src/views/routeSetting/index.vue` | 新增 | 路由配置页面 |

## 三、修改计划

### 修改 1：添加路由配置路由

**文件**：`src/router/index.ts`

```typescript
// 添加路由名称常量
ROUTE_SETTING: "routeSetting",

// 在 layoutRouters 中添加
{
  path: "/routeSetting",
  name: RouteNames.ROUTE_SETTING,
  component: () => import("@/views/routeSetting/index.vue"),
  meta: {
    title: "路由配置",
    icon: Setting,
  },
},
```

### 修改 2：修改菜单分组

**文件**：`src/layout/index.vue`

在 `groupDefs` 的"系统与资源"分组中添加 `routeSetting`：

```typescript
const groupDefs: MenuGroup[] = [
  { label: '通用', names: ['setting', 'homeMode', 'windowMode', 'styleBeauty'] },
  { label: '系统与资源', names: ['systemInfo', 'routeSetting', 'appCache', 'fileRela', 'resourceManage', 'safetyProtection'] },
  // ...
];
```

添加 `routeSetting` 的图标映射：

```typescript
const iconMap: Record<string, any> = {
  // ...
  routeSetting: Setting,
};
```

### 修改 3：实现动态菜单过滤

**文件**：`src/layout/index.vue`

修改 `menuGroups` computed 属性，从 `getStore('routeSetting')` 读取配置并过滤：

```typescript
import { getStore } from '@/utils/common';

// 默认配置（所有菜单可见）
const defaultVisibleRoutes = [
  'setting', 'homeMode', 'windowMode', 'styleBeauty',
  'systemInfo', 'appCache', 'fileRela', 'resourceManage', 'safetyProtection',
  'pomodoroRecord', 'clipboard', 'notebook', 'categorizableNotes', 'registerShortcut', 'function', 'weather',
  'netRequest', 'sqlTest', 'flow',
  'about'
];

const menuGroups = computed(() => {
  // 获取用户配置
  const savedConfig = getStore('routeSetting');
  const visibleRoutes: Record<string, boolean> = savedConfig || {};

  return groupDefs.map(g => ({
    label: g.label,
    items: g.names
      .filter(name => {
        // 始终显示的路由（不可配置）
        if (['setting', 'systemInfo', 'routeSetting'].includes(name)) {
          return true;
        }
        // 检查用户配置，未配置的默认显示
        return visibleRoutes[name] !== false;
      })
      .map(name => enrichedRouters.find(r => r.name === name))
      .filter(Boolean) as RouteRecordRaw[],
  }));
});
```

### 修改 4：创建路由配置页面

**文件**：`src/views/routeSetting/index.vue`（新建）

**功能**：
1. 展示所有可配置路由的列表（按分组）
2. 每个路由项有开关控制显示/隐藏
3. 保存配置到 `basic_info` 表的 `routeSetting` 字段
4. 不可配置的路由（/home, /setting, 路由配置页）显示禁用状态

**页面结构**：
```vue
<template>
  <div class="route-setting-page">
    <div class="page-header">
      <h2>路由配置</h2>
      <p>自定义侧边栏菜单的显示与隐藏</p>
    </div>

    <div class="config-container">
      <div v-for="group in menuGroupDefs" :key="group.label" class="config-group">
        <h3 class="group-title">{{ group.label }}</h3>
        <div class="route-list">
          <div
            v-for="item in group.items"
            :key="item.name"
            class="route-item"
            :class="{ 'is-locked': isLockedRoute(item.name) }"
          >
            <div class="route-info">
              <el-icon><component :is="item.meta?.icon" /></el-icon>
              <span class="route-name">{{ item.meta?.title }}</span>
              <span class="route-path">{{ item.path }}</span>
            </div>
            <el-switch
              :model-value="isRouteVisible(item.name)"
              :disabled="isLockedRoute(item.name)"
              @change="toggleRoute(item.name, $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <el-button type="primary" @click="saveConfig">保存配置</el-button>
      <el-button @click="resetConfig">重置为默认</el-button>
    </div>
  </div>
</template>
```

**样式**：使用 CSS 变量支持主题切换，与项目风格保持一致。

### 修改 5：配置数据结构

**存储格式**（`basic_info` 表，`key = 'routeSetting'`）：
```json
{
  "pomodoroRecord": true,
  "clipboard": false,
  "notebook": true,
  "categorizableNotes": true,
  "registerShortcut": false,
  "function": false,
  "weather": true,
  "netRequest": true,
  "sqlTest": false,
  "flow": true,
  "about": true
}
```

- `true` 表示显示（显式开启）
- `false` 表示隐藏
- 不存在的路由默认显示

**不可配置路由**：
- `setting` - 始终显示
- `homeMode` - 始终显示
- `windowMode` - 始终显示
- `styleBeauty` - 始终显示
- `systemInfo` - 始终显示
- `routeSetting` - 始终显示
- 其他不在分组中的路由（如 home）

## 四、验证步骤

1. **页面访问测试**：
   - 在侧边栏"系统与资源"分组中找到"路由配置"菜单项
   - 点击进入配置页面

2. **开关功能测试**：
   - 切换路由开关后点击保存
   - 返回其他页面，侧边栏菜单应相应变化
   - 刷新页面后配置仍然生效

3. **不可配置路由测试**：
   - `setting`、`systemInfo`、`routeSetting` 的开关应禁用（灰色）

4. **重置功能测试**：
   - 点击"重置为默认"按钮
   - 所有可配置路由应恢复默认显示

5. **主题切换测试**：
   - 切换主题后，配置页面样式应正确适配

## 五、注意事项

1. 路由配置页面本身不能被隐藏，否则用户无法恢复配置
2. 需要确保 `getStore` 在 layout 初始化时能正确读取配置
3. 配置保存后应立即生效，不需要刷新页面
4. 需要处理 `basic_info` 表不存在 `routeSetting` 记录的情况（返回默认值）
