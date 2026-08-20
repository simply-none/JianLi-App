<template>
  <!-- 右侧抽屉：双栏选择其它主题下的对话作为跨主题引用（左=主题树导航，右=对话勾选） -->
  <el-drawer
    v-model="visible"
    title="跨主题引用"
    direction="rtl"
    size="50%"
    append-to-body
    @open="onOpen"
  >
    <div class="ct-layout">
      <!-- 左栏：主题树导航 -->
      <div class="ct-side">
        <div class="ct-search">
          <LucideIcon name="Search" :size="14" />
          <input
            v-model="keyword"
            class="ct-search-input"
            placeholder="搜索对话内容…"
          />
        </div>
        <div class="ct-theme-list">
          <template v-if="visibleThemes.length">
            <div
              v-for="row in visibleThemes"
              :key="row.theme.id"
              class="ct-theme"
              :class="{
                active: row.theme.id === activeThemeId,
                matched: keyword.trim() && matchedThemeIds.has(row.theme.id),
                child: row.depth > 0,
              }"
              :style="row.depth > 0 ? { paddingLeft: 10 + row.depth * 14 + 'px' } : null"
              @click="selectTheme(row.theme.id)"
            >
              <button
                v-if="row.hasChildren"
                class="ct-caret"
                @click.stop="toggleCollapseTheme(row.theme.id)"
              >
                <LucideIcon :name="row.collapsed ? 'ChevronRight' : 'ChevronDown'" :size="14" />
              </button>
              <span v-else class="ct-caret-ph"></span>
              <LucideIcon
                :name="row.depth > 0 ? 'CornerDownRight' : 'Hash'"
                :size="13"
                class="ct-theme-ico"
                :class="{ child: row.depth > 0 }"
              />
              <span class="ct-theme-name">{{ row.theme.title || '未命名主题' }}</span>
              <span class="ct-theme-count">{{ themeConvCount[row.theme.id] || 0 }}</span>
            </div>
          </template>
          <div class="ct-empty" v-else>
            <LucideIcon name="Layers" :size="26" />
            <p>暂无其它主题</p>
            <span>跨主题引用需要先存在多个主题</span>
          </div>
        </div>
      </div>

      <!-- 右栏：对话列表（勾选） -->
      <div class="ct-main">
        <div class="ct-main-head">
          <span class="ct-main-title">
            <LucideIcon :name="keyword.trim() ? 'Search' : 'Hash'" :size="13" />
            {{ listTitle || '请选择主题' }}
          </span>
          <span class="ct-main-count">{{ convList.length }} 条</span>
        </div>
        <div class="ct-conv-list">
          <template v-if="convList.length">
            <label
              v-for="item in convList"
              :key="item.id"
              class="ct-item"
              :class="{ active: isSelected(Number(item.theme_id), item.id) }"
            >
              <input
                type="checkbox"
                :checked="isSelected(Number(item.theme_id), item.id)"
                @change="toggle(Number(item.theme_id), item.id)"
              />
              <div class="ct-item-body">
                <div class="ct-item-text">{{ snippet(item.content) }}</div>
                <!-- 引用信息徽标行：与主列表气泡信息一致（引用了 / 跨主题 / 被引用 / 被跨引用） -->
                <div class="ct-item-refs" v-if="refBadges(item).length">
                  <span v-for="b in refBadges(item)" :key="b.kind" class="ct-badge" :class="b.kind">
                    <LucideIcon :name="b.icon" :size="11" />{{ b.text }}
                  </span>
                </div>
                <div class="ct-item-meta">
                  <span v-if="keyword.trim() && item.theme_title" class="ct-item-theme">
                    <LucideIcon name="Hash" :size="11" />{{ item.theme_title }}
                  </span>
                  <span class="ct-item-time">{{ item.create_time }}</span>
                </div>
              </div>
            </label>
          </template>
          <div class="ct-empty" v-else>
            <LucideIcon name="MessageCircle" :size="28" />
            <p>{{ keyword.trim() ? '没有匹配的对话' : '该主题下暂无对话' }}</p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="ct-selected">已选 {{ selected.length }} 条</span>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!selected.length" @click="confirm">确定引用</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { useThemeConversation } from '../composables/useThemeConversation';
import { snippetOf } from '../composables/richText';

const props = defineProps<{
  modelValue: boolean;
  /** 排除的主题 id：跨主题引用不应包含该主题。编辑场景传被编辑对话所属主题；不传则回退到当前主题 */
  excludeThemeId?: number | null;
  /** 预选中的跨主题引用（编辑场景回显已有引用） */
  initialRefs?: Array<{ themeId: number; convId: number }>;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'confirm', refs: Array<{ themeId: number; convId: number }>): void;
}>();

const {
  themes,
  currentThemeId,
  getConversationsByTheme,
  parseArr,
  // 引用信息统计（徽标行数据源）
  crossReferencedBy,
  loadCrossReferenced,
  referencedByCounts,
  loadReferencedByCounts,
} = useThemeConversation();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

/** 排除主题：编辑场景用传入的 excludeThemeId，否则回退到当前主题（与输入框行为一致） */
const effectiveExcludeId = computed(() => {
  const e = props.excludeThemeId;
  return e != null ? e : currentThemeId.value;
});

const keyword = ref('');
/** 各主题的对话缓存：themeId -> 对话列表（含 theme_title），打开时一次加载 */
const themeConvs = ref<Record<number, any[]>>({});
/** 折叠的主题 id 集合 */
const collapsedThemes = ref<Set<number>>(new Set());
/** 当前选中的主题（右侧展示其对话） */
const activeThemeId = ref<number | null>(null);
/** 选中集合：{ themeId, convId } */
const selected = ref<Array<{ themeId: number; convId: number }>>([]);

/* ============================ 主题树 ============================ */

/** 排除“指定主题”后的主题树（含父子层级，与左侧主题列表一致） */
const themeTree = computed(() => {
  const others = themes.value.filter((t) => t.id !== effectiveExcludeId.value);
  const map = new Map<number, any>();
  others.forEach((t) => map.set(t.id, { theme: t, children: [] }));
  const roots: any[] = [];
  map.forEach((node) => {
    const pid = node.theme.parent_id;
    const parent = pid ? map.get(Number(pid)) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
});

/** 平铺可见主题（含 depth / hasChildren / collapsed），折叠主题的子树跳过 */
const visibleThemes = computed(() => {
  const out: Array<{ theme: any; depth: number; hasChildren: boolean; collapsed: boolean }> = [];
  const walk = (nodes: any[], depth: number) => {
    nodes.forEach((node) => {
      const hasChildren = node.children.length > 0;
      const collapsed = collapsedThemes.value.has(node.theme.id);
      out.push({ theme: node.theme, depth, hasChildren, collapsed });
      if (hasChildren && !collapsed) walk(node.children, depth + 1);
    });
  };
  walk(themeTree.value, 0);
  return out;
});

function toggleCollapseTheme(id: number) {
  const s = new Set(collapsedThemes.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  collapsedThemes.value = s;
}

/** 各主题对话数量徽标 */
const themeConvCount = computed(() => {
  const map: Record<number, number> = {};
  Object.keys(themeConvs.value).forEach((tid) => {
    map[Number(tid)] = (themeConvs.value[Number(tid)] || []).length;
  });
  return map;
});

/* ============================ 对话列表 ============================ */

/** 右侧展示的对话：无关键字=当前选中主题；有关键字=全部主题下匹配对话 */
const convList = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) {
    if (activeThemeId.value == null) return [];
    return themeConvs.value[activeThemeId.value] || [];
  }
  const flat: any[] = [];
  const walk = (nodes: any[]) => {
    nodes.forEach((node) => {
      (themeConvs.value[node.theme.id] || []).forEach((c: any) => {
        if ((c.content || '').toLowerCase().includes(kw)) flat.push(c);
      });
      walk(node.children);
    });
  };
  walk(themeTree.value);
  return flat;
});

/** 搜索时：包含匹配对话的主题 id 集合（左栏高亮） */
const matchedThemeIds = computed(() => {
  const set = new Set<number>();
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return set;
  Object.keys(themeConvs.value).forEach((tid) => {
    const has = (themeConvs.value[Number(tid)] || []).some((c: any) =>
      (c.content || '').toLowerCase().includes(kw),
    );
    if (has) set.add(Number(tid));
  });
  return set;
});

/** 右栏标题 */
const listTitle = computed(() => {
  if (keyword.value.trim()) return '搜索结果';
  const t = themes.value.find((x) => x.id === activeThemeId.value);
  return t ? t.title || '未命名主题' : '';
});

function selectTheme(id: number) {
  activeThemeId.value = id;
}

/* ============================ 打开 / 勾选 ============================ */

async function onOpen() {
  keyword.value = '';
  // 预选中传入的已有跨主题引用（编辑场景回显），未传则为空
  selected.value = (props.initialRefs || []).map((r) => ({ ...r }));
  collapsedThemes.value = new Set();
  // 刷新全局引用统计（「被引用 / 被跨引用」徽标依赖）
  await Promise.all([loadReferencedByCounts(), loadCrossReferenced()]);
  const others = themes.value.filter((t) => t.id !== effectiveExcludeId.value);
  const titleMap = new Map(others.map((t) => [t.id, t.title]));
  // 一次加载全部其它主题的对话，并为对话补上所属主题名（搜索平铺时展示）
  const list = await Promise.all(
    others.map(async (t) => {
      const items = await getConversationsByTheme(t.id);
      return items.map((c: any) => ({ ...c, theme_title: titleMap.get(t.id) || '' }));
    }),
  );
  themeConvs.value = {};
  others.forEach((t, i) => {
    themeConvs.value[t.id] = list[i] || [];
  });
  activeThemeId.value = others.length ? others[0].id : null;
}

/** 解析 cross_refs 字段（本地辅助，与展示侧逻辑一致） */
function parseCrossRefs(value: any): Array<{ themeId: number; convId: number }> {
  if (!value) return [];
  if (Array.isArray(value)) return value as Array<{ themeId: number; convId: number }>;
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 对话项的引用信息徽标：与主列表气泡一致（引用了 / 跨主题 / 被引用 / 被跨引用），无则省略 */
function refBadges(item: any): Array<{ kind: string; icon: string; text: string }> {
  const badges: Array<{ kind: string; icon: string; text: string }> = [];
  const refCount = parseArr(item.ref_ids).length;
  const crossCount = parseCrossRefs(item.cross_refs).length;
  const refBy = referencedByCounts.value[Number(item.id)] || 0;
  const crossBy = crossReferencedBy.value[Number(item.id)]?.length || 0;
  if (refCount) badges.push({ kind: 'ref', icon: 'Link', text: `引用了 ${refCount} 条` });
  if (crossCount) badges.push({ kind: 'cross', icon: 'Layers', text: `跨主题 ${crossCount} 条` });
  if (refBy) badges.push({ kind: 'refby', icon: 'Quote', text: `被引用 ${refBy}` });
  if (crossBy) badges.push({ kind: 'crossby', icon: 'CornerUpLeft', text: `被跨引用 ${crossBy}` });
  return badges;
}

function isSelected(themeId: number, convId: number) {
  return selected.value.some((r) => r.themeId === themeId && r.convId === convId);
}

function toggle(themeId: number, convId: number) {
  const i = selected.value.findIndex((r) => r.themeId === themeId && r.convId === convId);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push({ themeId, convId });
}

function snippet(text: string): string {
  return snippetOf(text, 60);
}

function confirm() {
  emit('confirm', selected.value.map((r) => ({ ...r })));
  visible.value = false;
}
</script>

<style scoped lang="scss">
/* 抽屉 body：去掉内边距，让双栏占满高度 */
:deep(.el-drawer__body) {
  padding: 0;
  min-height: 0;
}

.ct-layout {
  display: flex;
  height: 100%;
  min-height: 0;
}

/* ============================ 左栏：主题树 ============================ */
.ct-side {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  padding: 12px 10px;
  box-sizing: border-box;
  min-height: 0;
}

.ct-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 34px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  color: var(--text-muted);
  flex-shrink: 0;

  :deep(.lucide-icon) { flex-shrink: 0; }

  .ct-search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);
    font-family: inherit;
  }
}

.ct-theme-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 10px;
  padding-right: 2px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }
}

.ct-theme {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover { background: var(--bg-hover); }

  /* 子主题：左侧引导线 */
  &.child { border-left: 2px solid var(--color-primary-light); }

  &.active {
    background: var(--color-primary-light);
    .ct-theme-name { color: var(--color-primary-solid); font-weight: 600; }
  }

  /* 搜索命中：主题色描边提示包含匹配对话 */
  &.matched:not(.active) {
    outline: 1px solid var(--color-primary);
    outline-offset: -1px;
  }

  .ct-caret {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    flex-shrink: 0;

    &:hover { background: var(--bg-hover); color: var(--text-primary); }
  }
  .ct-caret-ph { width: 16px; height: 16px; flex-shrink: 0; }

  .ct-theme-ico { color: var(--text-muted); flex-shrink: 0; }
  .ct-theme-ico.child { color: var(--color-primary); opacity: 0.75; }

  .ct-theme-name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ct-theme-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-active-btn);
    border-radius: 10px;
    padding: 0 6px;
    flex-shrink: 0;
  }
}

/* ============================ 右栏：对话列表 ============================ */
.ct-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ct-main-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 8px;
  flex-shrink: 0;

  .ct-main-title {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    :deep(.lucide-icon) { color: var(--color-primary); flex-shrink: 0; }
  }

  .ct-main-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-active-btn);
    border-radius: 10px;
    padding: 0 7px;
    flex-shrink: 0;
  }
}

.ct-conv-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 16px 12px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
}

.ct-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-base);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;

  &:hover { background: var(--bg-hover); }
  &.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  input {
    width: 16px;
    height: 16px;
    margin-top: 2px;
    cursor: pointer;
    accent-color: var(--color-primary);
    flex-shrink: 0;
  }

  .ct-item-body { flex: 1; min-width: 0; }
  .ct-item-text {
    font-size: 13px;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    /* 内容完整展示，不做截断 */
  }

  /* 引用信息徽标行：四色区分，与主列表气泡信息一致 */
  .ct-item-refs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .ct-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 999px;
    line-height: 1.6;

    &.ref { color: #b45309; background: rgba(245, 158, 11, 0.14); }
    &.cross { color: #0e7490; background: rgba(6, 182, 212, 0.14); }
    &.refby { color: #6d28d9; background: rgba(139, 92, 246, 0.14); }
    &.crossby { color: #1d4ed8; background: rgba(59, 130, 246, 0.14); }
  }

  .ct-item-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-muted);

    .ct-item-theme {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--color-primary);
      background: var(--color-primary-light);
      padding: 0 6px;
      border-radius: 8px;
    }
  }
}

/* ============================ 空态 / 底部 ============================ */
.ct-empty {
  margin: auto;
  text-align: center;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 30px 10px;

  p { margin: 0; font-size: 13px; }
  span { font-size: 12px; opacity: 0.8; }
}

.ct-selected {
  font-size: 12px;
  color: var(--text-muted);
  margin-right: auto;
}
</style>
