<template>
  <div class="net-request-page">
    <!-- 顶部：模式切换 + 环境切换 + 导入 -->
    <div class="page-header">
      <el-radio-group v-model="mode" size="small">
        <el-radio-button value="http">
          <LucideIcon name="Globe" :size="13" />
          HTTP 请求
        </el-radio-button>
        <el-radio-button value="ws">
          <LucideIcon name="PlugZap" :size="13" />
          WebSocket
        </el-radio-button>
      </el-radio-group>

      <!-- HTTP 模式才显示环境切换 -->
      <EnvBar v-if="mode === 'http'" :envs="envs" @select="onSelectEnv" />

      <div class="header-spacer"></div>
      <el-button size="small" @click="importVisible = true">
        <LucideIcon name="Upload" :size="13" />
        导入接口
      </el-button>
    </div>

    <!-- 主体：侧边栏 + 工作区 -->
    <div class="page-body">
      <!-- 侧边栏（仅 HTTP 模式） -->
      <aside v-if="mode === 'http'" class="sidebar-box">
        <Sidebar
          :history-list="historyList"
          :tree="collectionTree"
          @load="onLoadConfig"
          @delete-history="onRemoveHistory"
          @clear-history="onClearHistory"
          @search-history="onSearchHistory"
          @create-folder="onCreateFolder"
          @rename-node="onRenameNode"
          @delete-node="onDeleteNode"
          @import="importVisible = true"
        />
      </aside>

      <!-- 工作区 -->
      <main class="main-box">
        <!-- HTTP 请求模式 -->
        <template v-if="mode === 'http'">
          <UrlBar
            :config="config"
            :loading="loading"
            @update:method="config.method = $event"
            @update:url="config.url = $event"
            @send="onSend"
            @save="openSaveDialog"
          />
          <RequestTabs
            :config="config"
            :test-results="testResults"
            @update:params="config.params = $event"
            @update:headers="config.headers = $event"
            @update:body-type="config.bodyType = $event"
            @update:raw-type="config.rawType = $event"
            @update:raw-body="config.rawBody = $event"
            @update:form-data="config.formData = $event"
            @update:url-encoded="config.urlEncoded = $event"
            @update:binary-file-path="config.binaryFilePath = $event"
            @update:auth="config.auth = $event"
            @update:settings="config.settings = $event"
            @update:scripts="config.scripts = $event"
          />
          <ResponsePanel :record="response" />
        </template>

        <!-- WebSocket 模式 -->
        <WsPanel v-else />
      </main>
    </div>

    <!-- 保存到集合弹窗 -->
    <SaveRequestDialog
      v-model="saveVisible"
      :tree="collectionTree"
      :config="config"
      :editing-id="editingNodeId"
      :editing-name="editingName"
      @save="onSaveToCollection"
      @create-folder="onCreateFolderInDialog"
    />

    <!-- 导入弹窗 -->
    <ImportDialog v-model="importVisible" @curl="onCurlImport" />
  </div>
</template>

<script setup lang="ts">
/**
 * 网络请求工作台 - 页面入口
 * ------------------------------------------------------------------
 * Postman 风格布局：侧边栏（历史/集合） + 请求编辑区 + 响应区，
 * 另含 WebSocket 调试模式、多环境变量、多格式导入（cURL/Postman/OpenAPI）。
 * 数据层走 db.ts（SQLite），请求能力走主进程 net-request:* IPC。
 */
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sidebar from './components/sidebar/index.vue'
import UrlBar from './components/request/UrlBar.vue'
import RequestTabs from './components/request/RequestTabs.vue'
import SaveRequestDialog from './components/request/SaveRequestDialog.vue'
import ResponsePanel from './components/response/ResponsePanel.vue'
import EnvBar from './components/env/EnvBar.vue'
import ImportDialog from './components/import/ImportDialog.vue'
import WsPanel from './components/ws/WsPanel.vue'
import type { RequestConfig } from './types'
import {
  createEmptyConfig,
  sendRequest,
  useRequestState,
} from './composables/useRequest'
import {
  createFolder,
  refreshCollection,
  removeCollectionNode,
  renameCollectionNode,
  saveRequestToCollection,
  useCollectionState,
} from './composables/useCollection'
import {
  pushHistory,
  refreshHistory,
  removeAllHistory,
  removeHistory,
  useHistoryState,
} from './composables/useHistory'
import {
  loadEnvs,
  refreshEnvs,
  setActiveEnv,
  useEnvList,
} from './composables/useEnvironment'
import { useWsAutoClose } from './composables/useWebSocket'

/* ---------------- 页面级状态 ---------------- */

/** 工作模式：http 请求 / websocket 调试 */
const mode = ref<'http' | 'ws'>('http')

/** 当前请求配置 */
const config = ref<RequestConfig>(createEmptyConfig())

/** 请求/响应状态（loading、response、断言结果） */
const { loading, response, testResults } = useRequestState()

/** 历史 / 集合 / 环境 数据源 */
const { historyList } = useHistoryState()
const collectionTree = useCollectionState()
const envs = useEnvList()

/* ---------------- 弹窗状态 ---------------- */

/** 保存弹窗可见性 */
const saveVisible = ref(false)
/** 导入弹窗可见性 */
const importVisible = ref(false)
/** 编辑中的集合请求节点 id（0 = 新建保存） */
const editingNodeId = ref(0)
/** 编辑中的集合请求名称 */
const editingName = ref('')

/* ---------------- 生命周期 ---------------- */

/** WS 页面卸载时自动断开连接 */
useWsAutoClose()

onMounted(async () => {
  // 初始化三份数据（失败均不阻塞页面）
  try {
    await refreshHistory()
    await refreshCollection()
    await loadEnvs()
  } catch (err) {
    console.error('网络请求页面数据初始化失败：', err)
    ElMessage.error('本地数据加载失败，请查看控制台日志')
  }
})

/* ---------------- 请求发送 / 历史 ---------------- */

/**
 * 发送请求（成功/失败均写入历史）
 */
async function onSend(): Promise<void> {
  if (!config.value.url.trim()) {
    ElMessage.warning('请输入请求地址')
    return
  }
  await sendRequest(config.value, (res) => {
    pushHistory(config.value, { status: res.status, time: res.time, size: res.size })
  })
}

/**
 * 加载配置（历史/集合点击回填，深拷贝避免联动污染）
 * @param cfg 请求配置
 * @param nodeId 集合请求节点 id（集合加载时传入，保存时覆盖原节点）
 * @param name 集合请求名称
 */
function onLoadConfig(cfg: RequestConfig, nodeId?: number, name?: string): void {
  config.value = JSON.parse(JSON.stringify(cfg))
  response.value = null
  editingNodeId.value = nodeId || 0
  editingName.value = name || ''
}

/**
 * 搜索历史（关键字已由 HistoryPanel 传入 useHistory 状态）
 */
function onSearchHistory(): void {
  refreshHistory()
}

/**
 * 删除单条历史
 * @param id 历史 id
 */
function onRemoveHistory(id: number): void {
  removeHistory(id).catch((err) => ElMessage.error('删除历史失败：' + err.message))
}

/**
 * 清空历史
 */
function onClearHistory(): void {
  removeAllHistory().catch((err) => ElMessage.error('清空历史失败：' + err.message))
}

/* ---------------- 集合操作 ---------------- */

/**
 * 新建文件夹（弹窗输入名称）
 * @param parentId 父节点 id（0 = 根级）
 */
function onCreateFolder(parentId: number): void {
  ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', { inputValue: '新建文件夹' })
    .then(({ value }) => {
      if (value?.trim()) {
        createFolder(parentId, value.trim()).catch((err) =>
          ElMessage.error('新建文件夹失败：' + err.message)
        )
      }
    })
    .catch(() => {})
}

/**
 * 弹窗内新建集合（保存弹窗「新建」入口）
 * @param parentId 父集合 id（0 = 根目录）
 * @param name 集合名称
 * @param onDone 创建成功回调（携带新集合 id，供弹窗自动选中）
 */
function onCreateFolderInDialog(parentId: number, name: string, onDone: (id: number) => void): void {
  createFolder(parentId, name)
    .then((id) => {
      onDone(id)
      ElMessage.success('已创建集合「' + name + '」')
    })
    .catch((err) => ElMessage.error('新建集合失败：' + err.message))
}

/**
 * 重命名集合节点
 * @param id 节点 id
 * @param name 新名称
 */
function onRenameNode(id: number, name: string): void {
  renameCollectionNode(id, name).catch((err) =>
    ElMessage.error('重命名失败：' + err.message)
  )
}

/**
 * 删除集合节点（文件夹级联）
 * @param id 节点 id
 */
function onDeleteNode(id: number): void {
  removeCollectionNode(id).catch((err) =>
    ElMessage.error('删除失败：' + err.message)
  )
}

/**
 * 打开保存弹窗（若当前请求来自集合则默认覆盖原节点）
 */
function openSaveDialog(): void {
  saveVisible.value = true
}

/**
 * 保存请求到集合
 * @param name 请求名称
 * @param parentId 目标文件夹 id
 */
function onSaveToCollection(name: string, parentId: number): void {
  saveRequestToCollection({
    id: editingNodeId.value || undefined,
    parentId,
    name,
    config: JSON.parse(JSON.stringify(config.value)),
  })
    .then(() => ElMessage.success('已保存到集合'))
    .catch((err) => ElMessage.error('保存失败：' + err.message))
}

/* ---------------- 环境变量 ---------------- */

/**
 * 切换激活环境
 * @param id 环境 id
 */
function onSelectEnv(id: number): void {
  setActiveEnv(id).catch((err) => ElMessage.error('切换环境失败：' + err.message))
}

/* ---------------- 导入 ---------------- */

/**
 * cURL 导入回填请求编辑区
 * @param cfg 解析后的请求配置
 */
function onCurlImport(cfg: RequestConfig): void {
  config.value = cfg
  response.value = null
}
</script>

<style scoped lang="scss">
.net-request-page {
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .header-spacer {
    flex: 1;
  }
}

.page-body {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}

.sidebar-box {
  width: 280px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 10px;
  overflow: hidden;
}

.main-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
</style>
