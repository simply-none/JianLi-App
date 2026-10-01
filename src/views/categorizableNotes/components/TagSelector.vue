<template>
  <div class="tag-selector">
    <el-select
      v-model="selectedTags"
      multiple
      filterable
      :placeholder="placeholder"
      :loading="loading"
      :filter-method="filterTags"
      @change="handleChange"
      @visible-change="handleVisibleChange"
      class="tag-select"
      ref="selectRef"
    >
      <el-option
        v-for="tag in filteredTagList"
        :key="tag.key"
        :label="tag.name"
        :value="tag.key"
      >
        <div class="tag-option">
          <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <LucideIcon name="Trash2" class="delete-icon" title="删除标签" @click.stop="handleDeleteTag(tag)" />
        </div>
      </el-option>
      <template #empty>
        <div class="create-tag-section" v-if="filterText.trim()">
          <div class="create-tag-hint">未找到 "{{ filterText }}"</div>
          <el-button type="primary" size="small" @click="handleCreateFromFilter">
            创建标签 "{{ filterText }}"
          </el-button>
        </div>
        <div v-else class="no-tags-hint">
          暂无标签，输入名称可创建新标签
        </div>
      </template>
      <template #footer>
        <div class="tag-footer" v-if="!filterText.trim()">
          <el-input
            v-model="newTagName"
            size="small"
            placeholder="输入新标签名称，回车创建"
            clearable
            class="new-tag-input"
            @keyup.enter="handleCreateFromFooter"
          />
          <el-button type="primary" size="small" @click="handleCreateFromFooter">
            新增
          </el-button>
        </div>
      </template>
    </el-select>
  </div>
</template>

<script setup lang="ts">
/**
 * 标签选择器（原子组件，编辑笔记时挂 / 摘标签）
 * - 多选 + 搜索过滤 + 下拉内直接创建（空结果 / 底部输入两条路径）
 * - 选项 hover 可软删标签（删除后仍存在的笔记数据不变，与旧版一致）
 * - 标签的读写统一走 useNotes 数据层；每次增删后 emit tags-updated 通知父级同步
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import moment from 'moment'
import { ElMessage, ElMessageBox, ElSelect } from 'element-plus'
import LucideIcon from '@/components/LucideIcon.vue'
import {
  loadTags,
  saveTags,
  createTagObject,
  type NoteTag,
} from '../composables/useNotes'

const props = defineProps<{
  modelValue: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: string[]]
  change: [val: string[]]
  'tags-updated': [tags: NoteTag[]]
}>()

const selectRef = ref<InstanceType<typeof ElSelect> | null>(null)
const selectedTags = ref<string[]>([...props.modelValue])
const tagList = ref<NoteTag[]>([])
const loading = ref(false)
const filterText = ref('')
const newTagName = ref('')

const filteredTagList = computed(() => {
  const tags = tagList.value.filter((t) => !t.deleted)
  if (!filterText.value.trim()) return tags
  const keyword = filterText.value.toLowerCase()
  return tags.filter((t) => t.name.toLowerCase().includes(keyword))
})

watch(
  () => props.modelValue,
  (newVal) => {
    selectedTags.value = [...newVal]
  },
  { deep: true }
)

function filterTags(val: string) {
  filterText.value = val
}

function handleChange(val: string[]) {
  emit('update:modelValue', val)
  emit('change', val)
}

function handleVisibleChange(visible: boolean) {
  if (visible) {
    fetchTags()
    filterText.value = ''
  } else {
    newTagName.value = ''
  }
}

async function fetchTags() {
  loading.value = true
  try {
    tagList.value = loadTags()
    emit('tags-updated', tagList.value)
  } finally {
    loading.value = false
  }
}

/** 创建标签并选中（同名复用既有标签）；失败回滚本地列表 */
async function createAndSelect(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  const existed = tagList.value.find((t) => t.name === trimmed && !t.deleted)
  if (existed) {
    selectKey(existed.key)
    return
  }
  const newTag = createTagObject(trimmed, tagList.value)
  tagList.value.push(newTag)
  if (await saveTags(tagList.value)) {
    ElMessage.success('标签创建成功')
    emit('tags-updated', tagList.value)
    selectKey(newTag.key)
  } else {
    tagList.value.pop()
    ElMessage.error('标签创建失败')
  }
}

/** 把 key 加入选中并通知父级 */
function selectKey(key: string) {
  if (!selectedTags.value.includes(key)) {
    selectedTags.value = [...selectedTags.value, key]
    handleChange(selectedTags.value)
  }
}

async function handleCreateFromFilter() {
  if (!filterText.value.trim()) return
  await createAndSelect(filterText.value)
  filterText.value = ''
  nextTick(() => selectRef.value?.blur())
}

async function handleCreateFromFooter() {
  if (!newTagName.value.trim()) return
  await createAndSelect(newTagName.value)
  newTagName.value = ''
}

/** 软删标签：标记 deleted，保留笔记上已有的 tags 数据 */
async function handleDeleteTag(tag: NoteTag) {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签 "${tag.name}" 吗？删除后笔记中已选该标签的数据将保留，但不能继续使用该标签。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    const tagIndex = tagList.value.findIndex((t) => t.key === tag.key)
    if (tagIndex > -1) {
      tagList.value[tagIndex].deleted = true
      tagList.value[tagIndex].updateTime = moment().format('YYYY-MM-DD HH:mm:ss')
      if (await saveTags(tagList.value)) {
        ElMessage.success('标签已删除')
        emit('tags-updated', tagList.value)
      }
    }
  } catch {
    /* 用户取消 */
  }
}

onMounted(() => {
  fetchTags()
})

defineExpose({
  fetchTags,
  tagList,
  deleteTag: handleDeleteTag,
})
</script>

<style scoped lang="scss">
.tag-selector {
  width: 100%;
}

.tag-select {
  width: 100%;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .tag-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-name {
    flex: 1;
  }

  .delete-icon {
    opacity: 0;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    transition: opacity 0.2s;

    &:hover {
      color: var(--color-error);
    }
  }

  &:hover .delete-icon {
    opacity: 1;
  }
}

.create-tag-section {
  padding: 12px;
  text-align: center;

  .create-tag-hint {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
}

.no-tags-hint {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.tag-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-subtle);

  .new-tag-input {
    flex: 1;
  }
}
</style>
