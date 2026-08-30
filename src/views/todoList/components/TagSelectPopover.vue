<!--
  通用标签选择弹窗（el-popover）
  - v-model：选中的标签 key 数组
  - 触发器：已选标签以彩色 tag chip 形式展示（在前），后接「选择标签」按钮，非输入框形式
  - 弹窗内：全部标签以彩色 chip 网格展示，点击多选(toggle)；新增标签收进弹窗内的展开区
  - 筛选栏与详情弹窗共用，触发器已内置，父组件只需传 v-model
-->
<template>
  <el-popover
    v-model:visible="popVisible"
    placement="bottom-start"
    :width="300"
    trigger="click"
  >
    <template #reference>
      <div class="tag-trigger" :class="{ 'has-value': model.length }">
        <span
          v-for="tag in selectedTags"
          :key="tag.key"
          class="tg-chip"
          :style="{ backgroundColor: tag.color + '22', color: tag.color }"
        >
          {{ tag.name }}
          <LucideIcon name="X" :size="11" class="tg-x" @click.stop="remove(tag.key)" />
        </span>
        <button type="button" class="tg-add">
          <LucideIcon name="Plus" :size="13" />
          选择标签
        </button>
      </div>
    </template>

    <div class="tag-pop">
      <!-- 标签 chip 网格：点击多选，无输入框形式 -->
      <div class="tag-pop-grid">
        <span
          v-for="tag in tags"
          :key="tag.key"
          class="tg-cell"
          :class="{ active: model.includes(tag.key) }"
          :style="model.includes(tag.key)
            ? { backgroundColor: tag.color + '22', color: tag.color }
            : {}"
          @click="toggle(tag.key)"
        >{{ tag.name }}</span>
        <div v-if="!tags.length" class="tag-pop-empty">暂无标签，可在下方新建</div>
      </div>

      <!-- 新增标签：默认隐藏输入框，点击按钮才在弹窗内展开 -->
      <div class="tag-pop-create">
        <el-button v-if="!creating" size="small" plain class="add-btn" @click="startCreate">
          <LucideIcon name="Plus" :size="13" />
          新建标签
        </el-button>
        <template v-else>
          <div class="create-row">
            <el-input
              ref="newInputRef"
              v-model="newName"
              placeholder="标签名称"
              size="small"
              @keyup.enter="createTag"
            />
            <el-button size="small" type="primary" :disabled="!newName.trim()" @click="createTag">确定</el-button>
          </div>
          <div class="color-row">
            <span
              v-for="c in palette"
              :key="c"
              class="color-chip"
              :class="{ active: pickColor === c }"
              :style="{ background: c }"
              @click="pickColor = c"
            />
          </div>
          <el-button size="small" text class="cancel-create" @click="cancelCreate">取消</el-button>
        </template>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { v4 as uuidv4 } from 'uuid';
import { useTodoStore } from '@/store/useTodo';
import { saveTag } from '../api/todoApi';
import type { Tag } from '../types';

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const store = useTodoStore();
const popVisible = ref(false);
const newName = ref('');
const creating = ref(false);
const newInputRef = ref<any>(null);
const palette = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];
const pickColor = ref(palette[0]);

const tags = computed(() => store.tags);

/** 选中的标签 key 数组（双向绑定） */
const model = computed<string[]>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

/** 已选标签对象（用于触发器展示彩色 chip） */
const selectedTags = computed(() => tags.value.filter((t) => model.value.includes(t.key)));

/** 切换某个标签的选中态 */
function toggle(key: string) {
  const arr = [...model.value];
  const i = arr.indexOf(key);
  if (i > -1) arr.splice(i, 1);
  else arr.push(key);
  model.value = arr;
}

/** 直接从触发器移除某个已选标签 */
function remove(key: string) {
  model.value = model.value.filter((k) => k !== key);
}

/** 展开新建标签输入区并聚焦 */
function startCreate() {
  creating.value = true;
  nextTick(() => newInputRef.value?.focus());
}

function cancelCreate() {
  creating.value = false;
  newName.value = '';
  pickColor.value = palette[0];
}

/** 新增标签：写入 todo_tags 表并自动选中 */
async function createTag() {
  const name = newName.value.trim();
  if (!name) return;
  if (tags.value.some((t) => t.name === name)) {
    ElMessage.warning('标签名称已存在');
    return;
  }
  const tag: Tag = { key: uuidv4(), name, color: pickColor.value };
  await saveTag(tag);
  await store.fetchTags();
  if (!model.value.includes(tag.key)) model.value = [...model.value, tag.key];
  newName.value = '';
  creating.value = false;
  pickColor.value = palette[0];
  ElMessage.success('已新增标签');
}
</script>

<style scoped lang="scss">
// 触发器：已选 tag chips（前）+ 选择标签按钮（后），无边框，非输入框外观
.tag-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 32px;
  padding: 2px 0;
  cursor: pointer;

  .tg-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 10px;
    flex-shrink: 0;

    .tg-x {
      cursor: pointer;
      opacity: 0.55;

      &:hover {
        opacity: 1;
      }
    }
  }

  .tg-add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 2px 8px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s;

    &:hover {
      color: var(--color-primary);
    }
  }
}

.tag-pop {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .tag-pop-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;

    .tg-cell {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 12px;
      border: none;
      background: var(--bg-base);
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;

      &:hover {
        color: var(--color-primary);
        background: var(--bg-hover, rgba(99, 102, 241, 0.08));
      }
      &.active {
        font-weight: 600;
      }
    }
    .tag-pop-empty {
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
      width: 100%;
      padding: 12px 0;
    }
  }

  .tag-pop-create {
    border-top: 1px solid var(--border-subtle);
    padding-top: 8px;

    .add-btn {
      width: 100%;
    }
    .create-row {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    .color-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 6px;

      .color-chip {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;

        &.active {
          border-color: var(--text-primary);
        }
      }
    }
    .cancel-create {
      padding-left: 0;
      color: var(--text-muted);
    }
  }
}
</style>
