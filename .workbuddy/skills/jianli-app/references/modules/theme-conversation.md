# 主题对话 (themeConversation)

## 职责
主题对话（记录情绪/主题笔记）的主页面与常驻小窗，数据自管（不碰番茄钟/习惯落库路径），同时作为 habit 链式动作的目标之一。

## 关键文件
- 主页面：`src/views/themeConversation/index.vue`（薄壳，挂 `components/ThemeConversationPage.vue`）
- 小窗：`src/views/themeConversationMiniWindow/index.vue`（挂同一 `ThemeConversationPage`，`compact` 模式）
- 页面逻辑：`src/views/themeConversation/components/ThemeConversationPage.vue`
- composables：`src/views/themeConversation/composables/useThemeConversation.ts`、`richText.ts`
- 数据层：`src/views/themeConversation/db.ts`（封装 `new-sql:query/insert/update/delete/execute`）

## 路由
- `RouteNames.THEME_CONVERSATION` → `/themeConversation`
- `RouteNames.THEME_CONVERSATION_MINI` → `/themeConversationMini`（路径须与 `open-new-window` 的 arg 一致）

## 用到的 IPC 通道
- `new-sql:query` / `new-sql:insert` / `new-sql:update` / `new-sql:delete`（渲染→主，主题对话表，自增 `id` 主键）
- `new-sql:execute`（跨表搜索等复杂查询，`db.ts:64` 的 `dbExecute`）
- 小窗四件套：`open/close-new-window`(`themeConversationMini`)、`sync-data-to-other-window`、`disable/enable-mouse-click-through`、`get/set-store`
- 主题切换走 `useTheme` 的 `get/setStore`（见 `themeConversationMiniWindow/index.vue:33` 的 `applyTheme`）

## 复用 / 集成点
- **提醒引擎联动**：提醒设 `recordAfter=1` 时，`App.vue` 自动跳到本页记录情绪。
- **habit 链式动作目标**：`src/views/habit/chainActions/actions/themeConversationAction.ts` 打卡后追加一条主题对话记录。
- **小窗四件套**：配置在 `windowSections.ts:213`（key=`themeConversation`，storeKey=`themeConversationMini`）。

## 特有坑 / 注意
- **`cloneForIpc` 防结构化克隆失败**：`db.ts:23` 用 `JSON.parse(JSON.stringify())` 剥离 Vue Proxy，否则传 reactive 数组（如 `form.tags`）会抛 `DataCloneError`。调用 `dbXxx` 前务必过这一层。
- **小窗鼠标穿透**：`themeConversationMiniWindow/index.vue` 用左右 `mouse-* click-through` 控制，常驻需 `mouseEvents:true`。
- **主题与皮肤区分**：小窗双击切的是「皮肤」(`data-skin` 属性)，与 `useTheme` 的全局主题名（`STORE_KEY`）是两套键，别混写。
