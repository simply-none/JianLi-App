<template>
  <div class="list">
    <AccountCard
      v-for="entry in entries"
      :key="entry.key"
      :entry="entry"
      @edit="$emit('edit', $event)"
      @delete="$emit('delete', $event)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 条目卡片网格容器。搜索 / 分类过滤在父级完成，这里只负责渲染。
 */
import AccountCard from './AccountCard.vue';
import type { VaultEntryMeta } from '../types';

defineProps<{ entries: VaultEntryMeta[] }>();
defineEmits<{ (e: 'edit', entry: VaultEntryMeta): void; (e: 'delete', entry: VaultEntryMeta): void }>();
</script>

<style scoped lang="scss">
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
</style>
