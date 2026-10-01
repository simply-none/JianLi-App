<template>
  <div class="categorizable-notes">
    <!-- 左栏：标签导航 -->
    <TagSidebar
      class="cn-sidebar"
      :tags="allTags"
      :counts="tagCounts"
      :total="noteTotal"
      :selected="selectedFilterTags"
      @select="handleSelectTags"
      @create-tag="handleCreateTag"
      @delete-tag="handleDeleteTag"
      @create-note="handleCreateNote"
    />

    <!-- 中列：搜索 + 笔记列表 -->
    <NoteListPanel
      class="cn-list"
      :notes="allNotes"
      :tags="allTags"
      :selected-key="detailMode === 'view' ? selectedNote?.key || '' : ''"
      :loading="loading"
      :has-more="hasMore"
      :keyword="searchKeyword"
      @search="handleSearch"
      @select="handleSelectNote"
      @edit="handleEditNote"
      @delete="handleDeleteNote"
      @load-more="loadMore"
      @tag-click="handleTagClick"
    />

    <!-- 右栏：内联查看 / 编辑（替代旧版弹窗） -->
    <NoteDetailPanel
      ref="detailPanelRef"
      class="cn-detail"
      :note="selectedNote"
      :mode="detailMode"
      :tags="allTags"
      :saving="saving"
      @edit="detailMode = 'edit'"
      @save="handleSave"
      @cancel="handleCancelEdit"
      @delete="handleDeleteNote"
      @create="handleCreateNote"
      @tag-click="handleTagClick"
      @tags-updated="syncTags"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 可归类笔记 —— 主页面（三栏主从布局）
 *
 * 布局：左栏标签导航（TagSidebar）+ 中列笔记列表（NoteListPanel）
 *      + 右栏内联查看 / 编辑（NoteDetailPanel，替代旧版弹窗编辑）
 *
 * 本组件只做状态编排：数据读写全部下沉到 composables/useNotes.ts；
 * 确认类交互（切换丢弃未保存修改 / 删除确认）在进入动作前统一守卫。
 */
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TagSidebar from './components/TagSidebar.vue'
import NoteListPanel from './components/NoteListPanel.vue'
import NoteDetailPanel from './components/NoteDetailPanel.vue'
import {
  fetchNotePage,
  fetchTagCounts,
  upsertNote,
  deleteNote,
  loadTags,
  saveTags,
  createTagObject,
  buildNoteRow,
  type NoteRow,
  type NoteTag,
  type DetailMode,
} from './composables/useNotes'

// ---------- 列表状态 ----------
const allNotes = ref<NoteRow[]>([])
const allTags = ref<NoteTag[]>([])
const tagCounts = ref<Record<string, number>>({})
const noteTotal = ref(0)
const searchKeyword = ref('')
const selectedFilterTags = ref<string[]>([])
const page = ref(1)
const loading = ref(false)
const hasMore = ref(true)

// ---------- 详情状态 ----------
const selectedNote = ref<NoteRow | null>(null)
const detailMode = ref<DetailMode>('empty')
const detailPanelRef = ref<InstanceType<typeof NoteDetailPanel> | null>(null)
const saving = ref(false)

// ---------- 数据加载 ----------

/** 拉取一页笔记（重置 or 追加） */
async function fetchNotes(append = false) {
  if (loading.value) return
  loading.value = true
  const { list, hasMore: more } = await fetchNotePage(
    searchKeyword.value,
    selectedFilterTags.value,
    page.value
  )
  if (append) allNotes.value.push(...list)
  else allNotes.value = list
  hasMore.value = more
  loading.value = false
}

/** 从第一页重查列表 + 刷新标签计数 */
async function refresh() {
  page.value = 1
  hasMore.value = true
  await fetchNotes(false)
  refreshTagCounts()
}

async function refreshTagCounts() {
  const { counts, total } = await fetchTagCounts()
  tagCounts.value = counts
  noteTotal.value = total
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  page.value++
  fetchNotes(true)
}

function reloadTags() {
  allTags.value = loadTags()
}

// ---------- 筛选 / 搜索 ----------

function handleSearch(keyword: string) {
  searchKeyword.value = keyword
  refresh()
}

function handleSelectTags(tagKeys: string[]) {
  selectedFilterTags.value = tagKeys
  refresh()
}

/** 点击任一标签 chip：仅选中该标签筛选 */
function handleTagClick(tagKey: string) {
  selectedFilterTags.value =
    selectedFilterTags.value.length === 1 && selectedFilterTags.value[0] === tagKey
      ? []
      : [tagKey]
  refresh()
}

// ---------- 详情流转 ----------

/** 有未保存修改时询问丢弃；返回 true = 可以继续切换 */
async function guardDirty(): Promise<boolean> {
  if (detailMode.value !== 'edit' || !detailPanelRef.value?.isDirty()) return true
  try {
    await ElMessageBox.confirm('当前笔记修改尚未保存，确定放弃吗？', '放弃修改', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

async function handleSelectNote(note: NoteRow) {
  if (note.key === selectedNote.value?.key && detailMode.value !== 'empty') return
  if (!(await guardDirty())) return
  selectedNote.value = note
  detailMode.value = 'view'
}

async function handleEditNote(note: NoteRow) {
  if (!(await guardDirty())) return
  selectedNote.value = note
  detailMode.value = 'edit'
}

async function handleCreateNote() {
  if (!(await guardDirty())) return
  selectedNote.value = null
  detailMode.value = 'edit'
}

function handleCancelEdit() {
  detailMode.value = selectedNote.value ? 'view' : 'empty'
}

/** 保存（新建 / 编辑共用）：落库后刷新列表并回到查看态 */
async function handleSave(payload: { content: string; html: string; tagKeys: string[] }) {
  saving.value = true
  const row = buildNoteRow(selectedNote.value || {}, payload.content, payload.html, payload.tagKeys)
  const result = await upsertNote(row)
  saving.value = false
  if (!result.success) {
    ElMessage.error('保存失败:' + (result.error || ''))
    return
  }
  ElMessage.success('保存成功')
  selectedNote.value = row
  detailMode.value = 'view'
  reloadTags()
  refresh()
}

/** 删除笔记（列表行 / 查看面板共用） */
async function handleDeleteNote(note: NoteRow) {
  try {
    await ElMessageBox.confirm('确定要删除这篇笔记吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const ok = await deleteNote(note.key)
  if (!ok) {
    ElMessage.error('删除失败')
    return
  }
  ElMessage.success('删除成功')
  if (selectedNote.value?.key === note.key) {
    selectedNote.value = null
    detailMode.value = 'empty'
  }
  allNotes.value = allNotes.value.filter((n) => n.key !== note.key)
  refreshTagCounts()
}

// ---------- 标签管理 ----------

/** 左栏新建标签 */
async function handleCreateTag(name: string) {
  const tags = loadTags()
  const existed = tags.find((t) => t.name === name.trim())
  if (existed) {
    ElMessage.info('标签已存在')
    return
  }
  const newTag = createTagObject(name, tags)
  tags.push(newTag)
  if (await saveTags(tags)) {
    ElMessage.success('标签创建成功')
    reloadTags()
  } else {
    ElMessage.error('标签创建失败')
  }
}

/** 左栏软删标签：已用该标签的笔记数据保留（与旧版语义一致） */
async function handleDeleteTag(tag: NoteTag) {
  const tags = loadTags()
  const target = tags.find((t) => t.key === tag.key)
  if (!target) return
  target.deleted = true
  if (await saveTags(tags)) {
    ElMessage.success('标签已删除')
    reloadTags()
  }
}

/** TagSelector 内部增删标签后同步（事件带全量列表，直接采纳） */
function syncTags(tags: NoteTag[]) {
  allTags.value = Array.isArray(tags) ? tags : loadTags()
}

// ---------- 初始化 ----------
onMounted(async () => {
  reloadTags()
  await refresh()
})
</script>

<style scoped lang="scss">
.categorizable-notes {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
}

.cn-sidebar {
  width: 208px;
  flex-shrink: 0;
}

.cn-list {
  width: 300px;
  flex-shrink: 0;
}

.cn-detail {
  flex: 1;
  min-width: 0;
}
</style>
