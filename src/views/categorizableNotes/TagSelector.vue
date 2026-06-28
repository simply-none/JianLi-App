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
          <span class="tag-dot" :style="{ backgroundColor: tag.color || '#6366f1' }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <LucideIcon name="trash-2" class="delete-icon" @click.stop="handleDeleteTag(tag)" />
        </div>
      </el-option>
      <template #empty>
        <div class="create-tag-section" v-if="filterText.trim()">
          <div class="create-tag-hint">未找到 "{{ filterText }}"</div>
          <el-button type="primary" size="small" @click="handleCreateTag">
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
            placeholder="输入新标签名称"
            clearable
            class="new-tag-input"
            @keyup.enter="handleCreateTagFromFooter"
          />
          <el-button type="primary" size="small" @click="handleCreateTagFromFooter">
            新增
          </el-button>
        </div>
      </template>
    </el-select>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { getStore, setStore } from '@/utils/common';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '请选择标签'
  }
});

const emit = defineEmits(['update:modelValue', 'change', 'tags-updated']);

const selectRef = ref(null);
const selectedTags = ref([...props.modelValue]);
const tagList = ref([]);
const loading = ref(false);
const filterText = ref('');
const newTagName = ref('');

const tagColors = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'
];

const filteredTagList = computed(() => {
  let tags = tagList.value.filter(t => !t.deleted);
  if (!filterText.value.trim()) return tags;
  const keyword = filterText.value.toLowerCase();
  return tags.filter(t => t.name.toLowerCase().includes(keyword));
});

watch(() => props.modelValue, (newVal) => {
  selectedTags.value = [...newVal];
}, { deep: true });

function filterTags(val) {
  filterText.value = val;
}

function handleChange(val) {
  emit('update:modelValue', val);
  emit('change', val);
}

function handleVisibleChange(visible) {
  if (visible) {
    fetchTags();
    filterText.value = '';
  } else {
    newTagName.value = '';
  }
}

async function fetchTags() {
  loading.value = true;
  try {
    const tags = getStore('note_tags') || [];
    tagList.value = Array.isArray(tags) ? tags : [];
    emit('tags-updated', tagList.value);
  } catch (error) {
    console.error('获取标签失败:', error);
    tagList.value = [];
  } finally {
    loading.value = false;
  }
}

async function saveTags(tags) {
  try {
    setStore('note_tags', tags);
    return true;
  } catch (error) {
    console.error('保存标签失败:', error);
    return false;
  }
}

async function createTag(name) {
  if (!name || !name.trim()) return null;
  
  const trimmedName = name.trim();
  const existingTag = tagList.value.find(t => t.name === trimmedName);
  if (existingTag) {
    return existingTag.key;
  }

  const newTag = {
    key: uuidv4(),
    name: trimmedName,
    color: tagColors[Math.floor(Math.random() * tagColors.length)],
    createTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    updateTime: moment().format('YYYY-MM-DD HH:mm:ss')
  };

  tagList.value.push(newTag);
  
  if (await saveTags(tagList.value)) {
    ElMessage.success('标签创建成功');
    emit('tags-updated', tagList.value);
    return newTag.key;
  } else {
    tagList.value.pop();
    ElMessage.error('标签创建失败');
  }
  return null;
}

async function handleCreateTag() {
  if (!filterText.value.trim()) return;
  const tagKey = await createTag(filterText.value);
  if (tagKey && !selectedTags.value.includes(tagKey)) {
    selectedTags.value.push(tagKey);
    handleChange(selectedTags.value);
  }
  filterText.value = '';
  nextTick(() => {
    selectRef.value?.blur();
  });
}

async function handleCreateTagFromFooter() {
  if (!newTagName.value.trim()) return;
  const tagKey = await createTag(newTagName.value);
  if (tagKey && !selectedTags.value.includes(tagKey)) {
    selectedTags.value.push(tagKey);
    handleChange(selectedTags.value);
  }
  newTagName.value = '';
}

async function handleDeleteTag(tag) {
  try {
    await ElMessageBox.confirm(
      `确定要删除标签 "${tag.name}" 吗？删除后笔记中已选该标签的数据将保留，但不能继续使用该标签。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const tagIndex = tagList.value.findIndex(t => t.key === tag.key);
    if (tagIndex > -1) {
      tagList.value[tagIndex].deleted = true;
      tagList.value[tagIndex].updateTime = moment().format('YYYY-MM-DD HH:mm:ss');

      if (await saveTags(tagList.value)) {
        ElMessage.success('标签已删除');
        emit('tags-updated', tagList.value);
      }
    }
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  fetchTags();
});

defineExpose({
  fetchTags,
  tagList,
  deleteTag: handleDeleteTag
});
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
      color: #ef4444;
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