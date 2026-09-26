<script setup lang="ts">
/**
 * 左侧表导航：搜索 + 数据表（行数）+ 高级（开发者）分组。
 * 点击表 → 数据浏览；点击高级项 → 全区工作面板。
 */
import { computed, ref } from "vue";
import { Search, Table, X } from "@lucide/vue";

interface AdvItem {
  key: string;
  label: string;
}

const props = defineProps<{
  tables: string[];
  counts: Record<string, number | undefined>;
  selectedTable: string;
  activeNav: string;
}>();

const emit = defineEmits<{
  (e: "select-table", name: string): void;
  (e: "select-adv", key: string): void;
}>();

const keyword = ref("");

const advItems: AdvItem[] = [
  { key: "adv:index", label: "索引管理" },
  { key: "adv:view", label: "视图管理" },
  { key: "adv:trigger", label: "触发器" },
  { key: "adv:transaction", label: "事务管理" },
  { key: "adv:concurrency", label: "并发测试" },
  { key: "adv:sql", label: "SQL 控制台" },
];

const filteredTables = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return kw ? props.tables.filter((t) => t.toLowerCase().includes(kw)) : props.tables;
});

function fmtCount(n: number | undefined): string {
  return n == null ? "" : n.toLocaleString("zh-CN");
}
</script>

<template>
  <aside class="table-nav">
    <div class="nav-search">
      <Search class="search-icon" />
      <input v-model="keyword" placeholder="搜索表名..." />
      <X v-if="keyword" class="clear-icon" @click="keyword = ''" />
    </div>

    <div class="nav-group-title">
      <span>数据表</span>
      <span class="group-count">{{ tables.length }}</span>
    </div>

    <div class="nav-list">
      <button
        v-for="t in filteredTables"
        :key="t"
        class="table-item"
        :class="{ active: activeNav === 'data' && selectedTable === t }"
        @click="emit('select-table', t)"
      >
        <Table class="table-icon" />
        <span class="table-name">{{ t }}</span>
        <span class="table-count">{{ fmtCount(counts[t]) }}</span>
      </button>
      <div v-if="filteredTables.length === 0" class="nav-empty">无匹配表</div>
    </div>

    <div class="nav-advanced">
      <div class="adv-title">高级（开发者）</div>
      <button
        v-for="item in advItems"
        :key="item.key"
        class="adv-item"
        :class="{ active: activeNav === item.key }"
        @click="emit('select-adv', item.key)"
      >
        {{ item.label }}
      </button>
    </div>
  </aside>
</template>

<style scoped lang="scss">
/* 对齐设计稿 3:29：260px 白卡 radius 12 + 内边距 12 + 40px 表项 */
.table-nav {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 12px;
  overflow: hidden;
}

.nav-search {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  background: var(--bg-base);
  border-radius: 8px;

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;

    &::placeholder {
      color: var(--text-muted);
    }
  }
}

.search-icon,
.clear-icon {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.clear-icon {
  cursor: pointer;
}

.nav-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);

  .group-count {
    padding: 1px 7px;
    background: var(--bg-base);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
  }
}

.nav-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.table-item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--color-primary-light);

    .table-name,
    .table-count,
    .table-icon {
      color: var(--color-primary);
    }

    .table-name {
      font-weight: 600;
    }
  }
}

.table-icon {
  width: 15px;
  height: 15px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.table-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}

.nav-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* 高级分组：1px 分隔线 + 12px 标题 + 34px 项 */
.nav-advanced {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 10px;
}

.adv-title {
  padding: 2px 2px 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}

.adv-item {
  display: block;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: 600;
  }
}
</style>
