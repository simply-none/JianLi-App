<template>
  <div class="tag-selector">
    <!-- 已选标签 -->
    <div class="selected-tags" v-if="modelValue.length">
      <TagChip
        v-for="tid in modelValue"
        :key="tid"
        :id="tid"
        closable
        @close="removeTag(tid)"
      />
    </div>

    <!-- 添加/创建标签 -->
    <el-popover
      placement="bottom-start"
      :width="300"
      trigger="click"
      v-model:visible="visible"
    >
      <template #reference>
        <button class="add-tag-btn" type="button">
          <LucideIcon :name="modelValue.length ? 'Tags' : 'TagPlus'" :size="14" />
          <span>{{ modelValue.length ? '编辑标签' : '添加标签' }}</span>
        </button>
      </template>

      <div class="tag-panel">
        <div class="panel-title">
          <span>选择标签</span>
          <el-button link type="primary" size="small" @click="visible = false">完成</el-button>
        </div>

        <!-- 已有标签（按 scope 过滤），支持选中 / 修改 / 删除 -->
        <div class="tag-options" v-if="filteredTags.length">
          <div
            v-for="t in filteredTags"
            :key="t.id"
            class="tag-option"
            :class="{ active: modelValue.includes(String(t.id)), editing: editingId === t.id }"
          >
            <!-- 编辑态：复用 TagFormBlock，与新建共用同一纵向布局 -->
            <TagFormBlock
              v-if="editingId === t.id"
              mode="edit"
              :initial-name="t.name"
              :initial-color="t.color"
              @submit="(p) => onEditSubmit(t, p)"
              @cancel="cancelEdit"
            />

            <!-- 常规态 -->
            <template v-else>
              <span class="tag-dot" :style="{ backgroundColor: t.color }" @click="toggleTag(t.id)"></span>
              <span class="tag-name" @click="toggleTag(t.id)">{{ t.name }}</span>
              <LucideIcon
                v-if="modelValue.includes(String(t.id))"
                name="Check"
                :size="14"
                class="check"
              />
              <span class="tag-actions">
                <button class="opt-btn" title="修改标签" @click.stop="startEdit(t)">
                  <LucideIcon name="Pencil" :size="13" />
                </button>
                <button class="opt-btn danger" title="删除标签" @click.stop="removeTagGlobal(t)">
                  <LucideIcon name="Trash2" :size="13" />
                </button>
              </span>
            </template>
          </div>
        </div>
        <div class="no-tag" v-else>暂无标签，可在下方创建</div>

        <!-- 新建标签：复用 TagFormBlock（与编辑同一视图） -->
        <div class="create-wrap">
          <TagFormBlock mode="create" @submit="(p) => createNewTag(p)" />
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import TagChip from './TagChip.vue';
import TagFormBlock from './TagFormBlock.vue';
import { useThemeConversation } from '../composables/useThemeConversation';
import { TAG_SCOPE } from '../types';

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    /** 标签适用范围，用于过滤可选标签 */
    scope?: string;
  }>(),
  { scope: TAG_SCOPE.CONVERSATION }
);

const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const { tags, createTag, updateTag, deleteTag } = useThemeConversation();

const visible = ref(false);

/** 行内编辑状态（仅存正在编辑的标签 id；表单数据交给 TagFormBlock 内部维护） */
const editingId = ref<number | null>(null);

/** 仅展示当前适用范围（或通用的）标签 */
const filteredTags = computed(() => tags.value.filter((t) => !t.scope || t.scope === props.scope));

function toggleTag(id: string | number) {
  const idStr = String(id);
  const set = new Set(props.modelValue);
  if (set.has(idStr)) set.delete(idStr);
  else set.add(idStr);
  emit('update:modelValue', Array.from(set));
}

function removeTag(id: string | number) {
  emit('update:modelValue', props.modelValue.filter((x) => x !== String(id)));
}

function startEdit(t: any) {
  editingId.value = t.id;
}

function cancelEdit() {
  editingId.value = null;
}

async function onEditSubmit(t: any, payload: { name: string; color: string }) {
  if (!payload.name) {
    ElMessage.warning('标签名称不能为空');
    return;
  }
  await updateTag(t.id, { name: payload.name, color: payload.color });
  editingId.value = null;
  ElMessage.success('已保存');
}

async function removeTagGlobal(t: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除标签「${t.name}」？使用过该标签的主题与对话会同步移除该标签。`,
      '删除标签',
      { type: 'warning' }
    );
  } catch {
    return;
  }
  // 从当前选择中移除
  if (props.modelValue.includes(String(t.id))) {
    removeTag(t.id);
  }
  await deleteTag(t.id);
  ElMessage.success('已删除');
}

async function createNewTag(payload: { name: string; color: string }) {
  const name = payload.name.trim();
  if (!name) {
    ElMessage.warning('请输入标签名称');
    return;
  }
  const existing = tags.value.find((t) => t.name === name && (!t.scope || t.scope === props.scope));
  let id: string;
  if (existing) {
    id = String(existing.id);
  } else {
    const item = await createTag(name, payload.color, props.scope);
    id = String(item.id);
  }
  if (!props.modelValue.includes(id)) {
    emit('update:modelValue', [...props.modelValue, id]);
  }
}
</script>

<style scoped lang="scss">
.tag-selector {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.add-tag-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border: 1px dashed var(--border-subtle);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
}

.tag-panel {
  .panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .tag-options {
    max-height: 220px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tag-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: default;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-hover);

      .tag-actions {
        opacity: 1;
        width: auto;
        margin-left: auto;
      }
    }

    &.active {
      background: var(--color-primary-light);
    }

    /* 编辑态：改为纵向铺满，让 TagFormBlock 完整呈现 */
    &.editing {
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      background: var(--bg-hover);
    }

    .tag-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      cursor: pointer;
    }

    .tag-name {
      flex: 1;
      font-size: 13px;
      color: var(--text-primary);
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .check {
      color: var(--color-primary);
    }

    .tag-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      opacity: 0;
      width: 0;
      overflow: hidden;
      margin-left: 0;
      transition: opacity 0.15s;
    }

    .opt-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;

      &:hover {
        background: var(--bg-active-btn);
        color: var(--color-primary);
      }

      &.danger:hover {
        color: var(--color-danger, #ef4444);
      }
    }
  }

  .no-tag {
    padding: 10px 0;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }

  /* 新建区：与列表分隔，内部纵向排布由 TagFormBlock 负责 */
  .create-wrap {
    border-top: 1px solid var(--border-subtle);
    margin-top: 8px;
    padding-top: 10px;
  }
}
</style>
