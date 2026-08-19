<template>
  <aside class="theme-list">
    <!-- 头部 -->
    <div class="tl-header">
      <div class="tl-title">
        <LucideIcon name="MessagesSquare" :size="16" />
        <span>对话主题</span>
      </div>
      <button class="tl-new" title="新建主题" @click="openCreate">
        <LucideIcon name="Plus" :size="16" />
      </button>
    </div>

    <!-- 主题列表 -->
    <div class="tl-body">
      <div
        v-for="theme in themes"
        :key="theme.id"
        class="tl-item"
        :class="{ active: theme.id === currentThemeId, matched: isMatched(theme) }"
        @click="selectTheme(theme.id)"
      >
        <div class="tl-item-main">
          <div class="tl-item-title">
            <LucideIcon name="Hash" :size="13" class="tl-hash" />
            <span class="tl-name">{{ theme.title || '未命名主题' }}</span>
            <span class="tl-count">{{ themeCounts[theme.id] || 0 }}</span>
          </div>
          <div class="tl-tags" v-if="parsedTags(theme).length">
            <TagChip
              v-for="tid in parsedTags(theme)"
              :key="tid"
              :id="tid"
            />
          </div>
        </div>
        <button
          class="tl-del"
          title="删除主题"
          @click.stop="removeTheme(theme)"
        >
          <LucideIcon name="Trash2" :size="14" />
        </button>
      </div>

      <div class="tl-empty" v-if="!themes.length">还没有主题，点击右上角 + 创建</div>
    </div>

    <!-- 新建/编辑主题弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑主题' : '新建主题'"
      width="420px"
      append-to-body
    >
      <div class="theme-form">
        <label class="form-label">主题标题</label>
        <el-input v-model="formTitle" placeholder="例如：关于产品方向的思考" maxlength="50" />

        <label class="form-label">主题标签</label>
        <TagSelector v-model="formTags" :scope="'theme'" />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import TagChip from './TagChip.vue';
import TagSelector from './TagSelector.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

const {
  themes,
  themeCounts,
  currentThemeId,
  searchKeyword,
  selectTheme,
  createTheme,
  updateTheme,
  deleteTheme,
  parseArr,
} = useThemeConversation();

const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const formTitle = ref('');
const formTags = ref<string[]>([]);

function parsedTags(theme: any): string[] {
  return parseArr(theme.tags);
}

/** 搜索状态下，标题命中关键字的主题高亮（标签命中由搜索结果体现） */
function isMatched(theme: any): boolean {
  const kw = searchKeyword.value.trim();
  if (!kw) return false;
  return !!(theme.title && theme.title.includes(kw));
}

function openCreate() {
  editingId.value = null;
  formTitle.value = '';
  formTags.value = [];
  dialogVisible.value = true;
}

async function removeTheme(theme: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除主题「${theme.title || '未命名'}」？其下全部对话也会一并删除。`,
      '删除确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }
  await deleteTheme(theme.id);
  ElMessage.success('已删除');
}

async function submit() {
  const title = formTitle.value.trim();
  if (!title) {
    ElMessage.warning('请输入主题标题');
    return;
  }
  if (editingId.value) {
    await updateTheme(editingId.value, { title, tags: formTags.value });
  } else {
    await createTheme(title, formTags.value);
  }
  dialogVisible.value = false;
  ElMessage.success('已保存');
}
</script>

<style scoped lang="scss">
.theme-list {
  width: 25%;
  max-width: 500px;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-right: 1px solid var(--border-subtle);
  box-sizing: border-box;
}

.tl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0px 16px 14px 16px;
  border-bottom: 1px solid var(--border-subtle);

  .tl-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);

    :deep(.lucide-icon) {
      color: var(--color-primary);
    }
  }

  .tl-new {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-btn);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: var(--color-primary-light);
      color: var(--color-primary);
    }
  }
}

.tl-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 24px 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }
}

.tl-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-btn);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.2s, border-color 0.2s;

  &:hover {
    background: var(--bg-hover);

    .tl-del { opacity: 1; }
  }

  &.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);

    .tl-name { color: var(--color-primary-solid); font-weight: 600; }
  }

  &.matched {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .tl-item-main {
    flex: 1;
    min-width: 0;
  }

  .tl-item-title {
    display: flex;
    align-items: center;
    gap: 4px;

    .tl-hash { color: var(--text-muted); flex-shrink: 0; }

    .tl-name {
      flex: 1;
      font-size: 14px;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tl-count {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-active-btn);
      border-radius: 10px;
      padding: 0 7px;
      flex-shrink: 0;
    }
  }

  .tl-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .tl-del {
    flex-shrink: 0;
    opacity: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: opacity 0.2s, color 0.2s;

    &:hover { color: var(--color-danger, #ef4444); }
  }
}

.tl-empty {
  padding: 30px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}

.theme-form {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .form-label {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 500;
  }
}
</style>
