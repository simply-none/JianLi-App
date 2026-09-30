<!--
  思维导图 —— 「从其它模块生成导图」弹窗。

  为什么入口放在导图模块内部，而不是去待办 / 笔记 / 主题对话各加一个按钮：
    那三个模块一个都不用改 —— 这里只对它们的表做**只读查询**。
    跨模块联动的回归风险因此接近零，将来某个模块改了表结构，
    受影响面也只有这一个文件。

  行为：
    · 选数据源 → 只读拉一次该源的数据 → 本地组装树（不走数据库写操作）
    · 生成 = 作为**新文档**载入（id 置空），随后请求画布适应内容
    · 勾选项（含已完成 / 附带正文大纲 / 附带对话条目）只影响组装，不影响来源数据

  ⚠️ 数据量兜底：笔记按最近修改取 200 条、对话取 500 条 ——
     不加限制时一份几千节点的导图会让布局与渲染都很难受。
     上限写在预览区里，用户看得见是怎么被截断的。
-->
<template>
  <AppDialog v-model="opened" title="从其它模块生成导图" width="580px" :show-fullscreen="false">
    <div class="mind-gen">
      <!-- 数据源 -->
      <div class="mind-gen__sources">
        <button
          v-for="item in GENERATE_SOURCES"
          :key="item.key"
          type="button"
          class="mind-gen__source"
          :class="{ 'is-active': sourceKey === item.key }"
          @click="pickSource(item.key)"
        >
          <LucideIcon :name="iconOf(item.key)" :size="18" class="mind-gen__source-icon" />
          <span class="mind-gen__source-label">{{ item.label }}</span>
          <span class="mind-gen__source-desc">{{ item.desc }}</span>
        </button>
      </div>

      <!-- 根节点名称 -->
      <div class="mind-gen__field">
        <span class="mind-gen__field-label">根节点名称</span>
        <el-input v-model="options.rootText" size="small" maxlength="30" placeholder="根节点名称" />
      </div>

      <!-- 该数据源的开关 -->
      <label class="mind-gen__toggle">
        <el-switch v-model="toggleValue" size="small" />
        <span class="mind-gen__toggle-label">{{ current.toggle.label }}</span>
        <span class="mind-gen__toggle-hint">{{ current.toggle.hint }}</span>
      </label>

      <!-- 预览 -->
      <div class="mind-gen__preview" :class="{ 'is-empty': !loading && previewCount === 0 }">
        <LucideIcon v-if="loading" name="LoaderCircle" :size="14" class="mind-gen__spin" />
        <span v-if="loading">正在读取数据…</span>
        <span v-else-if="previewCount > 0">
          将生成 <strong>{{ previewCount }}</strong> 个节点（含根节点）
        </span>
        <span v-else>没有读到可用的数据</span>
      </div>
      <p class="mind-gen__limit">{{ limitHint }}</p>
    </div>

    <div class="mind-gen__footer">
      <button type="button" class="mind-gen__btn" @click="opened = false">取消</button>
      <button
        type="button"
        class="mind-gen__btn mind-gen__btn--primary"
        :disabled="loading || previewCount === 0"
        @click="onGenerate"
      >
        生成导图
      </button>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppDialog from '@/components/AppDialog.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { MIND_DOC_VERSION } from '../constants'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import {
  GENERATE_SOURCES,
  defaultOptions,
  notesToTree,
  themesToTree,
  todosToTree,
  type ConversationSourceRow,
  type GenerateOptions,
  type GenerateSource,
  type MindSourceKey,
  type NoteSourceRow,
  type ThemeSourceRow,
  type TodoSourceRow,
} from '../utils/generate'
import { countNodes } from '../utils/tree'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const mind = useMindDoc()
const view = useMindView()

/** 笔记 / 对话的读取上限（见文件头的数据量兜底说明） */
const NOTE_LIMIT = 200
const CONVERSATION_LIMIT = 500

const SOURCE_ICONS: Record<MindSourceKey, string> = {
  todo: 'CheckSquare',
  note: 'NotebookPen',
  theme: 'MessagesSquare',
}

const opened = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const sourceKey = ref<MindSourceKey>('todo')
const options = ref<GenerateOptions>(defaultOptions('todo'))
const loading = ref(false)

const todoRows = ref<TodoSourceRow[]>([])
const noteRows = ref<NoteSourceRow[]>([])
const themeRows = ref<ThemeSourceRow[]>([])
const conversationRows = ref<ConversationSourceRow[]>([])

const current = computed<GenerateSource>(
  () => GENERATE_SOURCES.find(item => item.key === sourceKey.value) ?? GENERATE_SOURCES[0],
)

function iconOf(key: MindSourceKey): string {
  return SOURCE_ICONS[key]
}

/** 当前源的勾选项（三个开关各自独立，切换数据源时互不覆盖） */
const toggleValue = computed<boolean>({
  get: () => options.value[current.value.toggle.key],
  set: (value) => {
    options.value = { ...options.value, [current.value.toggle.key]: value }
  },
})

/* ------------------------------------------------------------ 只读取数 */

/** 只读查询（**不写任何表**）；失败返回空数组，由预览区提示「没有数据」 */
async function queryRows(tableName: string, sql: string): Promise<Record<string, any>[]> {
  try {
    const res: any = await window.ipcRenderer.handlePromise('new-sql:query', { tableName, SqlStr: sql })
    if (!res || !res.success) return []
    const data = res.data ?? res.rows ?? []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function loadRows(key: MindSourceKey): Promise<void> {
  loading.value = true
  try {
    if (key === 'todo') {
      todoRows.value = (await queryRows('todo_list', 'SELECT * FROM todo_list')) as TodoSourceRow[]
    } else if (key === 'note') {
      noteRows.value = (await queryRows(
        'note_book',
        `SELECT * FROM note_book ORDER BY updateTime DESC LIMIT ${NOTE_LIMIT}`,
      )) as NoteSourceRow[]
    } else {
      themeRows.value = (await queryRows(
        'conversation_theme',
        'SELECT * FROM conversation_theme ORDER BY id ASC',
      )) as ThemeSourceRow[]
      // 对话条目只在需要时才拉，避免白读一大张表
      conversationRows.value = options.value.includeConversations
        ? ((await queryRows(
            'conversation',
            `SELECT * FROM conversation ORDER BY id ASC LIMIT ${CONVERSATION_LIMIT}`,
          )) as ConversationSourceRow[])
        : []
    }
  } finally {
    loading.value = false
  }
}

/** 对话开关打开时才需要补拉（否则每次勾选都要重开弹窗） */
watch(toggleValue, async (value) => {
  if (sourceKey.value !== 'theme' || !value || conversationRows.value.length) return
  conversationRows.value = (await queryRows(
    'conversation',
    `SELECT * FROM conversation ORDER BY id ASC LIMIT ${CONVERSATION_LIMIT}`,
  )) as ConversationSourceRow[]
})

/* ------------------------------------------------------------ 预览与生成 */

/** 当前参数下要生成的树（预览与生成共用同一份，避免「看到的」和「生成的」不一致） */
const previewTree = computed(() => {
  if (sourceKey.value === 'todo') return todosToTree(todoRows.value, options.value)
  if (sourceKey.value === 'note') return notesToTree(noteRows.value, options.value)
  return themesToTree(themeRows.value, conversationRows.value, options.value)
})

const previewCount = computed(() => countNodes(previewTree.value))

const limitHint = computed(() => {
  if (sourceKey.value === 'note') return `最多读取最近修改的 ${NOTE_LIMIT} 条笔记`
  if (sourceKey.value === 'theme') return `最多读取 ${CONVERSATION_LIMIT} 条对话`
  return '已按父子任务关系归位，多父任务只挂在第一个父任务下'
})

/* -------------------------------------------------------------- 交互 */

function pickSource(key: MindSourceKey) {
  if (sourceKey.value === key) return
  sourceKey.value = key
  // 三个开关各自独立，切换数据源时保留用户已勾的项；只把根名称换成新源的默认值
  options.value = { ...options.value, rootText: defaultOptions(key).rootText }
}

/** 打开弹窗 / 切换数据源时拉数据（弹窗关闭期间不做任何查询） */
watch(
  [opened, sourceKey],
  ([isOpen]) => {
    if (!isOpen) return
    loadRows(sourceKey.value)
  },
  { immediate: true },
)

async function onGenerate() {
  const tree = previewTree.value
  if (countNodes(tree) <= 1) {
    ElMessage.warning('没有读到可用的数据')
    return
  }
  if (mind.dirty.value) {
    try {
      await ElMessageBox.confirm(
        '当前导图有未保存的改动，生成新导图会载入新内容并丢弃这些改动。',
        '生成导图',
        { type: 'warning', confirmButtonText: '仍然生成', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
  }

  const name = options.value.rootText.trim() || current.value.defaultRoot
  view.requestFit()
  mind.replaceDoc({
    id: undefined,
    name,
    data: { version: MIND_DOC_VERSION, layout: mind.layout.value, root: tree },
  })
  opened.value = false
  ElMessage.success('已生成新导图，按 Ctrl + S 保存')
}
</script>

<style scoped lang="scss">
.mind-gen__sources {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.mind-gen__source {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s;

  &:hover {
    border-color: var(--color-primary);
  }

  &.is-active {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-card));
  }
}

.mind-gen__source-icon {
  color: var(--color-primary);
}

.mind-gen__source-label {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.mind-gen__source-desc {
  color: var(--text-muted);
  font-size: 12px;
}

.mind-gen__field {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.mind-gen__field-label {
  flex: none;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.mind-gen__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  cursor: pointer;
}

.mind-gen__toggle-label {
  color: var(--text-primary);
  font-size: 13px;
}

.mind-gen__toggle-hint {
  color: var(--text-muted);
  font-size: 12px;
}

.mind-gen__preview {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 13px;

  strong {
    font-variant-numeric: tabular-nums;
  }

  &.is-empty {
    color: var(--text-muted);
  }
}

.mind-gen__spin {
  color: var(--color-primary);
  animation: mind-gen-spin 1s linear infinite;
}

@keyframes mind-gen-spin {
  to {
    transform: rotate(360deg);
  }
}

.mind-gen__limit {
  margin: 8px 2px 0;
  color: var(--text-muted);
  font-size: 12px;
}

.mind-gen__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.mind-gen__btn {
  padding: 7px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--primary {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;

    &:hover:not(:disabled) {
      color: #fff;
      background: var(--color-primary-solid, var(--color-primary));
    }
  }
}
</style>
