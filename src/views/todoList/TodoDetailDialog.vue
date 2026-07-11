<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑待办事项' : '新建待办事项'"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="todo-form">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题">
          <el-input
            v-model="form.title"
            placeholder="请输入待办标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            placeholder="请输入待办描述"
            :rows="4"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="优先级">
          <el-radio-group v-model="form.priority" class="priority-radio-group">
            <el-radio value="high" class="priority-high">
              <span class="priority-label">高</span>
              <span class="priority-dot high"></span>
            </el-radio>
            <el-radio value="medium" class="priority-medium">
              <span class="priority-label">中</span>
              <span class="priority-dot medium"></span>
            </el-radio>
            <el-radio value="low" class="priority-low">
              <span class="priority-label">低</span>
              <span class="priority-dot low"></span>
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="截止时间">
          <el-date-picker
            v-model="form.dueDate"
            type="datetime"
            placeholder="选择截止时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>

        <el-form-item label="标签">
          <div class="tag-selector">
            <div class="selected-tags" v-if="selectedTags.length > 0">
              <span
                v-for="tag in selectedTags"
                :key="tag.key"
                class="selected-tag"
                :style="{ backgroundColor: tag.color + '20', color: tag.color }"
              >
                {{ tag.name }}
                <LucideIcon name="X" class="close-icon" @click="removeTag(tag.key)" />
              </span>
            </div>
            <el-input
              v-model="newTagName"
              placeholder="输入标签名按回车添加"
              @keyup.enter="addTag"
              class="tag-input"
            />
          </div>
        </el-form-item>

        <el-form-item label="完成状态">
          <el-switch
            v-model="form.completed"
            :active-value="1"
            :inactive-value="0"
            active-text="已完成"
            inactive-text="未完成"
            @change="handleCompleteChange"
          />
        </el-form-item>

        <el-form-item v-if="form.completedTime" label="完成时间">
          <span class="completed-time">{{ form.completedTime }}</span>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

interface Tag {
  key: string;
  name: string;
  color: string;
}

interface TodoItem {
  key: string;
  title: string;
  description: string;
  tags: string;
  completed: number;
  completedTime: string;
  priority: string;
  dueDate: string;
  createTime: string;
  updateTime: string;
}

const props = defineProps<{
  visible: boolean;
  todo: TodoItem | null;
  tags: Tag[];
}>();

const emit = defineEmits(['update:visible', 'save', 'tag-update']);

const tagColors = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const form = ref<TodoItem>({
  key: '',
  title: '',
  description: '',
  tags: '[]',
  completed: 0,
  completedTime: '',
  priority: 'medium',
  dueDate: '',
  createTime: '',
  updateTime: '',
});

const newTagName = ref('');

const localTags = ref<Tag[]>([...props.tags]);

watch(() => props.tags, (newTags) => {
  localTags.value = [...newTags];
}, { deep: true });

const selectedTags = computed(() => {
  if (!form.value.tags) return [];
  try {
    const tagKeys = JSON.parse(form.value.tags);
    return localTags.value.filter(t => tagKeys.includes(t.key));
  } catch {
    return [];
  }
});

watch(() => props.visible, (val) => {
  if (val) {
    if (props.todo) {
      form.value = { ...props.todo };
    } else {
      form.value = {
        key: '',
        title: '',
        description: '',
        tags: '[]',
        completed: 0,
        completedTime: '',
        priority: 'medium',
        dueDate: '',
        createTime: '',
        updateTime: '',
      };
    }
    newTagName.value = '';
  }
});

watch(() => props.todo, (val) => {
  if (val && props.visible) {
    form.value = { ...val };
  }
});

const isEdit = computed(() => !!form.value.key);

function addTag() {
  const name = newTagName.value.trim();
  if (!name) return;

  let currentTags: string[] = [];
  try {
    currentTags = JSON.parse(form.value.tags || '[]');
  } catch {
    currentTags = [];
  }

  const existingTag = localTags.value.find(t => t.name === name);
  if (existingTag) {
    if (!currentTags.includes(existingTag.key)) {
      currentTags.push(existingTag.key);
    }
  } else {
    const newTag: Tag = {
      key: uuidv4(),
      name,
      color: tagColors[currentTags.length % tagColors.length],
    };

    localTags.value = [...localTags.value, newTag];
    currentTags.push(newTag.key);

    window.ipcRenderer.handlePromise('new-sql:upsert', {
      tableName: 'todo_tags',
      data: newTag,
      config: { primaryKey: 'id' },
    }).then(() => {
      emit('tag-update');
    });
  }

  const newForm = { ...form.value };
  newForm.tags = JSON.stringify(currentTags);
  form.value = newForm;
  newTagName.value = '';
}

function removeTag(tagKey: string) {
  let currentTags: string[] = [];
  try {
    currentTags = JSON.parse(form.value.tags || '[]');
  } catch {
    currentTags = [];
  }

  const index = currentTags.indexOf(tagKey);
  if (index > -1) {
    currentTags.splice(index, 1);
    const newForm = { ...form.value };
    newForm.tags = JSON.stringify(currentTags);
    form.value = newForm;
  }
}

function handleCompleteChange(val: number) {
  if (val === 1 && !form.value.completedTime) {
    form.value.completedTime = moment().format('YYYY-MM-DD HH:mm:ss');
  } else if (val === 0) {
    form.value.completedTime = '';
  }
}

async function handleSave() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }

  const todoData = {
    ...form.value,
    key: form.value.key || uuidv4(),
    createTime: form.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
    updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
  };

  const result = await window.ipcRenderer.handlePromise('new-sql:upsert', {
    tableName: 'todo_list',
    data: todoData,
    config: { primaryKey: 'key' },
  });

  if (result.success) {
    ElMessage.success('保存成功');
    emit('save', todoData);
    emit('update:visible', false);
  } else {
    ElMessage.error('保存失败:' + result.error);
  }
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<style scoped lang="scss">
.todo-form {
  padding: 8px 0;
}

.tag-selector {
  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 12px;
    line-height: 1.4;

    .close-icon {
      cursor: pointer;
      font-size: 12px;
      opacity: 0.7;

      &:hover {
        opacity: 1;
      }
    }
  }

  .tag-input {
    :deep(.el-input__wrapper) {
      background: var(--bg-base);
      box-shadow: 0 0 0 1px var(--border-subtle) inset;
    }
  }
}

.completed-time {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 500;
}

.priority-radio-group {
  display: flex;
  gap: 16px;

  :deep(.el-radio) {
    margin-right: 0;
  }

  :deep(.el-radio__inner) {
    display: none;
  }

  :deep(.el-radio__label) {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }

  :deep(.el-radio__input.is-checked + .el-radio__label) {
    border-color: var(--color-primary);
    background-color: var(--color-primary-light);
  }
}

.priority-label {
  font-size: 13px;
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.high {
    background-color: #ef4444;
  }

  &.medium {
    background-color: #f59e0b;
  }

  &.low {
    background-color: #10b981;
  }
}

.priority-high :deep(.el-radio__input.is-checked + .el-radio__label) {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}

.priority-medium :deep(.el-radio__input.is-checked + .el-radio__label) {
  border-color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
}

.priority-low :deep(.el-radio__input.is-checked + .el-radio__label) {
  border-color: #10b981;
  background-color: rgba(16, 185, 129, 0.1);
}
</style>