<template>
  <div class="account-list">
    <AccountCard
      v-for="acc in accounts"
      :key="acc.key"
      :account="acc"
      :code="codes[acc.key]"
      @edit="(a) => emit('edit', a)"
      @deleted="emit('changed')"
    />
    <p v-if="accounts.length === 0" class="account-list__empty">暂无账户，点击「添加账户」开始。</p>
  </div>
</template>

<script setup lang="ts">
/**
 * 账户列表（网格布局）。2FA 账户数量通常不大，直接用响应式网格即可；
 * 若未来需万级列表再切换为 VirtualList（项目通用组件）。
 */
import AccountCard from './AccountCard.vue';
import type { TwoFactorAccountMeta, TwoFactorCode } from '../types';

defineProps<{
  accounts: TwoFactorAccountMeta[];
  codes: Record<string, TwoFactorCode>;
}>();

const emit = defineEmits<{
  (e: 'edit', a: TwoFactorAccountMeta): void;
  (e: 'changed'): void;
}>();
</script>

<style scoped lang="scss">
.account-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  padding: 4px;
}
.account-list__empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  padding: 40px 0;
}
</style>
