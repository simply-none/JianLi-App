# 路由配置功能优化计划

## 一、需求概述

1. 保存配置后刷新左侧菜单（尤其是 layout 布局下的页面）
2. 如果某个分类下没有路由页面，该分类名称不应该显示

## 二、问题分析

### 问题 1：配置保存后菜单未刷新

**原因**：
- `getStore` 使用 `sendSync` 同步调用
- `menuGroups` computed 属性在 `getStore` 变化时不会自动响应
- layout 和 routeSetting 是独立的组件，无法直接通信

**解决方案**：
- 在 layout 中添加一个响应式 ref `menuRefreshKey`
- `menuGroups` computed 依赖这个 key
- 在 routeSetting 保存后，通过自定义事件通知 layout 刷新

### 问题 2：空分组仍然显示

**原因**：
- `menuGroups` 没有过滤掉 items 为空的分组

**解决方案**：
- 在模板中过滤掉空的分组，或在 computed 中过滤

## 三、修改计划

### 修改 1：layout/index.vue - 添加菜单刷新机制

**文件**：`src/layout/index.vue`

```typescript
// 添加响应式刷新 key
const menuRefreshKey = ref(0);

// 修改 menuGroups computed，依赖刷新 key
const menuGroups = computed(() => {
  menuRefreshKey.value; // 依赖刷新 key
  const savedConfig = getStore('routeSetting') || {};
  const visibleRoutes: Record<string, boolean> = savedConfig;

  return groupDefs
    .map(g => ({
      label: g.label,
      items: g.names
        .filter(name => {
          if (lockedRoutes.includes(name)) {
            return true;
          }
          return visibleRoutes[name] !== false;
        })
        .map(name => enrichedRouters.find(r => r.name === name))
        .filter(Boolean) as RouteRecordRaw[],
    }))
    .filter(g => g.items.length > 0); // 过滤空分组
});

// 监听刷新事件
function handleMenuRefresh() {
  menuRefreshKey.value++;
}

onMounted(() => {
  window.addEventListener('route-setting-changed', handleMenuRefresh);
});

onUnmounted(() => {
  window.removeEventListener('route-setting-changed', handleMenuRefresh);
});
```

### 修改 2：routeSetting/index.vue - 触发刷新事件

**文件**：`src/views/routeSetting/index.vue`

```typescript
// 保存配置
function saveConfig() {
  saving.value = true;
  try {
    setStore('routeSetting', routeConfig.value);
    ElMessage.success('配置已保存');
    // 通知 layout 刷新菜单
    window.dispatchEvent(new CustomEvent('route-setting-changed'));
  } catch (error) {
    console.error('保存配置失败:', error);
    ElMessage.error('保存配置失败');
  } finally {
    saving.value = false;
  }
}

// 重置配置
function resetConfig() {
  routeConfig.value = {};
  setStore('routeSetting', {});
  ElMessage.success('已重置为默认配置');
  // 通知 layout 刷新菜单
  window.dispatchEvent(new CustomEvent('route-setting-changed'));
}
```

## 四、验证步骤

1. **保存配置测试**：
   - 在路由配置页面关闭某个菜单（如"关于"）
   - 点击保存
   - 左侧菜单应立即隐藏该菜单项

2. **重置配置测试**：
   - 在路由配置页面重置配置
   - 左侧菜单应恢复显示所有菜单项

3. **空分组测试**：
   - 关闭某个分组下的所有可配置菜单
   - 该分组名称应不再显示
   - 注意：系统与资源分组有 routeSetting，不会为空

## 五、文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/layout/index.vue` | 修改 | 添加菜单刷新机制，过滤空分组 |
| `src/views/routeSetting/index.vue` | 修改 | 保存/重置后触发刷新事件 |
