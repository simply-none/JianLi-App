<template>
  <el-drawer
    v-model="open"
    :title="drawer.title || '历史对话'"
    direction="rtl"
    size="420px"
    append-to-body
  >
    <div class="ref-drawer">
      <div
        v-for="(item, idx) in drawer.items"
        :key="item.id || idx"
        class="ref-card clickable"
        @click="locate(item.id)"
        title="点击在对话列表中定位该项"
      >
        <div class="ref-card-head">
          <span class="ref-index">#{{ item.id }}</span>
          <span class="ref-theme" v-if="item.theme_title">
            <LucideIcon name="Hash" :size="12" />{{ item.theme_title }}
          </span>
        </div>
        <div class="ref-content">{{ item.content }}</div>
        <div class="ref-tags" v-if="tagArr(item).length">
          <TagChip v-for="tid in tagArr(item)" :key="tid" :id="tid" />
        </div>
        <div class="ref-meta">
          <span><LucideIcon name="Clock" :size="12" />{{ item.create_time }}</span>
          <span v-if="item.annotate_time"><LucideIcon name="PenLine" :size="12" />标注 {{ item.annotate_time }}</span>
        </div>
        <div class="ref-locate">
          <LucideIcon name="CornerDownRight" :size="12" />在对话列表中定位
        </div>
      </div>

      <div class="ref-empty" v-if="!drawer.items.length">暂无引用信息</div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import TagChip from './TagChip.vue';
import { useThemeConversation } from '../composables/useThemeConversation';

const { referenceDrawer, parseArr, locateConversation } = useThemeConversation();

const drawer = referenceDrawer;
const open = computed({
  get: () => drawer.value.open,
  set: (v: boolean) => { drawer.value.open = v; },
});

/** 点击引用项：在中间对话列表中定位并高亮该对话 */
function locate(id: number) {
  locateConversation(id);
}

function tagArr(item: any): string[] {
  return parseArr(item.tags);
}
</script>

<style scoped lang="scss">
.ref-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

  .ref-card {
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--bg-card);

  /* 可点击定位：整张卡片作为「跳转到对话」的入口 */
  &.clickable { cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; }
  &.clickable:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 10px var(--shadow-card);
  }

  .ref-card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;

    .ref-index {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-light);
      padding: 1px 8px;
      border-radius: 8px;
    }

    .ref-theme {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      color: var(--text-muted);
    }
  }

  .ref-content {
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .ref-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .ref-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-muted);

    span { display: inline-flex; align-items: center; gap: 4px; }
  }

  .ref-locate {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--color-primary);
    opacity: 0.75;
  }
  &.clickable:hover .ref-locate { opacity: 1; }
}

.ref-empty {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
