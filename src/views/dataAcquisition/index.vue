<template>
  <div class="data-acquisition">
    <!-- 左侧任务列表 -->
    <div class="left-panel">
      <TaskList
        :tasks="tasks"
        :active-id="activeTaskId"
        @create="onCreate"
        @select="onSelect"
        @delete="onDeleteTask"
      />
    </div>

    <!-- 右侧工作区 -->
    <div class="main-panel">
      <el-tabs v-model="activeTab" class="work-tabs">
        <el-tab-pane label="任务配置" name="config">
          <!-- 空状态引导：无任务时展示开始新建按钮 -->
          <div v-if="showEmptyGuide" class="empty-guide">
            <div class="guide-title">还没有采集任务</div>
            <div class="guide-tip">按「打开网页 → 浏览操作 → 提取结果 → 分页」四步配置即可开始采集</div>
            <el-button type="primary" @click="onStartNew">开始新建</el-button>
          </div>
          <template v-else>
            <div class="tab-toolbar">
              <el-button type="primary" size="small" :disabled="!config.name || !config.url" @click="onSave">
                保存任务
              </el-button>
              <span class="toolbar-tip">保存后可在左侧任务列表中随时载入</span>
            </div>
            <TaskConfigPanel :config="config" />
          </template>
        </el-tab-pane>

        <el-tab-pane label="运行" name="run">
          <RunPanel
            :current-state="latestRunState"
            :disabled="!config.url"
            @run="onRun"
            @stop="onStop"
          />
        </el-tab-pane>

        <el-tab-pane label="结果" name="result">
          <ResultView :records="resultRecords" :export-name="config.name" />
        </el-tab-pane>

        <el-tab-pane label="历史" name="history">
          <HistoryPanel
            ref="historyPanelRef"
            :history="history"
            @search="onSearchHistory"
            @refresh="refreshHistory"
            @view="onViewHistory"
            @rerun="onRerun"
            @delete="onDeleteHistory"
            @clear="onClearHistory"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 数据获取页面入口
 * ------------------------------------------------------------------
 * 基于 Puppeteer 的任务化网页采集：左侧任务列表 + 右侧四个页签
 * （任务配置 / 运行 / 结果 / 历史）。
 * 任务配置保存到 scraper_tasks 表；采集结果自动写入 scraper_history；
 * 引擎在主进程独立运行（进度/结果经 IPC 推送），不改动天气爬虫。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ScrapeConfig, HistoryItem } from './types'
import { createDefaultConfig } from './config/defaults'
import { useTask } from './composables/useTask'
import { useHistory } from './composables/useHistory'
import TaskList from './components/sidebar/TaskList.vue'
import TaskConfigPanel from './components/config/TaskConfigPanel.vue'
import RunPanel from './components/run/RunPanel.vue'
import ResultView from './components/result/ResultView.vue'
import HistoryPanel from './components/history/HistoryPanel.vue'
import type { TaskItem } from './types'

/* 任务运行（任务 CRUD + 运行/取消 + 实时状态） */
const { tasks, runningMap, refreshTasks, persistTask, removeTask, runTask, stopTask } = useTask()
/* 采集历史 */
const { history, keyword: historyKeyword, refreshHistory, recordResult, removeHistory, removeAllHistory } = useHistory()

/**
 * 按任务名关键字搜索历史
 * @param kw 搜索关键字
 */
async function onSearchHistory(kw: string): Promise<void> {
  historyKeyword.value = kw
  await refreshHistory()
}

/** 当前激活页签 */
const activeTab = ref('config')
/** 当前编辑中的任务配置（新建即默认值，选中即深拷贝） */
const config = ref<ScrapeConfig>(createDefaultConfig())
/** 当前选中的任务 id（未保存的新任务为 null） */
const activeTaskId = ref<number | null>(null)
/** 最近一次采集的记录（试运行与正式运行共用结果视图） */
const resultRecords = ref<any[]>([])
/** 历史面板组件引用（打开查看弹窗用） */
const historyPanelRef = ref<InstanceType<typeof HistoryPanel> | null>(null)

/**
 * 最近一次运行的状态（runningMap 中按开始时间倒序取第一条，
 * 桌面单用户场景下即为「当前关注」的运行）
 */
const latestRunState = computed(() => {
  const list = Object.values(runningMap.value).sort((a, b) => b.startedAt - a.startedAt)
  return list[0] || null
})

/**
 * 新建任务：重置为默认配置并切到配置页签
 */
function onCreate(): void {
  config.value = createDefaultConfig()
  activeTaskId.value = null
  activeTab.value = 'config'
}

/** 空状态引导是否已被「开始新建」关闭（任务列表从有到无时自动重新显示） */
const newGuideDismissed = ref(false)

/** 是否展示空状态引导：无任务且未选中任务且引导未被关闭 */
const showEmptyGuide = computed(
  () => !tasks.value.length && activeTaskId.value === null && !newGuideDismissed.value
)

/**
 * 空状态引导的「开始新建」：关闭引导并重置为默认配置
 */
function onStartNew(): void {
  newGuideDismissed.value = true
  onCreate()
}

// 任务列表从有到无（全部删除）时重新显示空状态引导
watch(
  () => tasks.value.length,
  (now, prev) => {
    if (now === 0 && (prev || 0) > 0) newGuideDismissed.value = false
  }
)

/**
 * 选中任务：深拷贝配置载入编辑（避免编辑直接影响已存任务）
 * @param task 选中的任务
 */
function onSelect(task: TaskItem): void {
  config.value = JSON.parse(JSON.stringify(task.config))
  activeTaskId.value = task.id
  activeTab.value = 'config'
}

/**
 * 删除任务
 * @param id 任务 id
 */
async function onDeleteTask(id: number): Promise<void> {
  try {
    await removeTask(id)
    if (activeTaskId.value === id) {
      activeTaskId.value = null
    }
    ElMessage.success('任务已删除')
  } catch (err) {
    ElMessage.error(`删除失败：${(err as Error).message}`)
  }
}

/**
 * 保存任务（按名称幂等）
 */
async function onSave(): Promise<void> {
  const err = validateConfig(config.value)
  if (err) {
    ElMessage.warning(err)
    return
  }
  try {
    // 编辑已有任务时按 id 更新（支持改名），未选中任务时新建
    const id = await persistTask(config.value, activeTaskId.value)
    activeTaskId.value = id
    ElMessage.success('任务已保存')
  } catch (err) {
    ElMessage.error(`${(err as Error).message}`)
  }
}

/**
 * 校验任务配置可运行性（不通过则返回错误描述）
 * @param config 任务配置
 * @returns 错误描述；通过校验返回 null
 */
function validateConfig(config: ScrapeConfig): string | null {
  if (!config.name?.trim()) return '请先填写任务名'
  if (!config.url?.trim()) return '请先填写起始 URL'
  if (config.source === 'network') {
    if (!config.capture?.urlPattern?.trim()) {
      return '接口捕获模式必须填写「URL 正则」（接口捕获设置）'
    }
    return null
  }
  // DOM 模式：记录级字段规则与提取项容器至少有其一
  // （有提取项容器时记录级规则可不填，每条记录产出各容器的子项数组）
  const validRules = (config.rules || []).filter((r) => r.field?.trim() && r.selector?.trim())
  const validGroups = (config.groups || []).filter((g) => g.name?.trim() && g.selector?.trim())
  if (!validRules.length && !validGroups.length) {
    return '至少需要一种抽取配置：填写有效字段规则，或添加提取项容器（组名与项容器选择器必填）'
  }
  if (config.pagination?.type === 'selector' && !config.pagination.next?.trim()) {
    return '分页方式为「点击下一页」时必须填写「下一页选择器」'
  }
  return null
}

/**
 * 运行任务（试运行 / 正式运行），完成后结果落历史并自动切换视图
 * @param mode 运行模式
 */
async function onRun(mode: 'test' | 'run'): Promise<void> {
  const err = validateConfig(config.value)
  if (err) {
    ElMessage.warning(err)
    activeTab.value = 'config'
    return
  }
  activeTab.value = 'run'
  try {
    const result = await runTask(config.value, mode)
    resultRecords.value = result.records || []
    await recordResult(config.value, result)
    if (mode === 'test') {
      // 试运行直接展示结果便于调参
      activeTab.value = 'result'
      ElMessage.success(result.success ? `试运行完成，共 ${resultRecords.value.length} 条` : `试运行失败：${result.reason || '未知原因'}`)
    } else {
      ElMessage.success(result.success ? `采集完成：${result.records.length} 条 / ${result.pages} 页` : `任务结束：${result.reason || '未采集到数据'}`)
    }
  } catch (err) {
    ElMessage.error(`运行异常：${(err as Error).message}`)
  }
}

/**
 * 停止当前运行的任务
 * @param taskId 任务 id
 */
async function onStop(taskId: string): Promise<void> {
  await stopTask(taskId)
  ElMessage.info('已请求停止，引擎将在下一检查点退出')
}

/**
 * 查看历史结果（打开弹窗）
 * @param item 历史项
 */
function onViewHistory(item: HistoryItem): void {
  historyPanelRef.value?.openView(item)
}

/**
 * 按历史配置重跑：载入配置并启动正式运行
 * @param item 历史项
 */
async function onRerun(item: HistoryItem): Promise<void> {
  if (!item.config) return
  config.value = JSON.parse(JSON.stringify(item.config))
  activeTaskId.value = null
  await onRun('run')
}

/**
 * 删除单条历史
 * @param id 历史 id
 */
async function onDeleteHistory(id: number): Promise<void> {
  try {
    await removeHistory(id)
  } catch (err) {
    ElMessage.error(`删除失败：${(err as Error).message}`)
  }
}

/**
 * 清空全部历史
 */
async function onClearHistory(): Promise<void> {
  try {
    await removeAllHistory()
    ElMessage.success('历史已清空')
  } catch (err) {
    ElMessage.error(`清空失败：${(err as Error).message}`)
  }
}

onMounted(async () => {
  try {
    await Promise.all([refreshTasks(), refreshHistory()])
    // 默认选中第一个采集任务（存在时），载入其配置进入编辑
    if (tasks.value.length) {
      onSelect(tasks.value[0])
    }
  } catch (err) {
    ElMessage.error(`数据加载失败：${(err as Error).message}`)
  }
})
</script>

<style scoped>
.data-acquisition {
  display: flex;
  gap: 12px;
  height: 100%;
  min-height: 0;
}
.left-panel {
  width: 230px;
  flex-shrink: 0;
  padding: 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
}
.main-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.work-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 页签内容区作为滚动容器：任务配置说明/长表单超出时可滚动查看 */
.work-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.tab-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.toolbar-tip {
  font-size: 12px;
  color: var(--text-muted);
}
.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 0 60px;
}
.guide-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.guide-tip {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
