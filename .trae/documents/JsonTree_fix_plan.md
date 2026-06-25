# JsonTree 组件点击无响应问题排查计划

## 1. 问题分析

### 根本原因
**`shallowRef` 的响应式机制问题**

当前代码使用 `shallowRef` 定义 `expandedKeys`：
```javascript
const expandedKeys = shallowRef<string[]>([]);
```

`shallowRef` 只监听 `.value` 的**引用变化**，不会递归监听内部属性变化。当使用 `push()`、`splice()` 等方法修改数组时，数组的引用没有改变，因此不会触发响应式更新，视图不会重新渲染。

### 问题代码位置
- 第 31 行：`const expandedKeys = shallowRef<string[]>([]);`
- 第 37-45 行：`toggleExpand` 函数使用 `push()` 和 `splice()` 修改数组

---

## 2. 修复方案

### 方案一：将 shallowRef 改为 ref（推荐）
```javascript
const expandedKeys = ref<string[]>([]);
```

`ref` 会递归监听数组内部变化，`push()`、`splice()` 操作会自动触发响应式更新。

### 方案二：手动触发响应式更新
```javascript
const expandedKeys = shallowRef<string[]>([]);

function toggleExpand(key: string | number) {
  const keyStr = String(key);
  const index = expandedKeys.value.indexOf(keyStr);
  if (index === -1) {
    expandedKeys.value.push(keyStr);
  } else {
    expandedKeys.value.splice(index, 1);
  }
  triggerRef(expandedKeys); // 手动触发更新
}
```

### 推荐方案
方案一更简洁，不需要额外的 `triggerRef` 调用，符合 Vue 3 的响应式最佳实践。

---

## 3. 修改内容

### 文件

1. **JsonTree.vue** (`c:\cod\electron-vite-vue\src\components\JsonTree.vue`)
   - 将第 31 行的 `shallowRef` 改为 `ref`
   - 清理未使用的导入（如果 `ElMessage` 未使用）

### 功能保留
- ✅ 对象/数组递归展开/折叠
- ✅ 点击节点展开/折叠
- ✅ 颜色区分数据类型
- ✅ 所有原有功能

---

## 4. 验证步骤

1. 确认修改后点击节点可以正常展开/折叠
2. 确认递归嵌套的数据也能正常展开/折叠
3. 确认页面无 TypeScript 错误
4. 确认数据展示样式保持不变

---

## 5. 实施步骤

1. 修改 `shallowRef` 为 `ref`
2. 清理未使用的导入
3. 验证功能完整性