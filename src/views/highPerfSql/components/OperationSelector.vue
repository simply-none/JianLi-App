<template>
  <div class="operation-selector">
    <div class="selector-header">
      <span class="title">操作类型</span>
    </div>
    <div class="selector-grid">
      <button
        v-for="op in operations"
        :key="op.key"
        :class="['op-button', { active: selected === op.key }]"
        @click="$emit('select', op.key)"
      >
        <div class="op-icon" :style="{ background: op.gradient }">
          <component :is="op.icon" class="icon" />
        </div>
        <span class="op-label">{{ op.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Table,
  Grid2X2X,
  Database,
  Eye,
  Zap,
  GitBranch,
  Terminal,
  Activity,
} from "@lucide/vue";

interface Operation {
  key: string;
  label: string;
  icon: any;
  gradient: string;
}

defineProps<{
  selected: string;
}>();

defineEmits<{
  (e: "select", key: string): void;
}>();

const operations: Operation[] = [
  { key: "query", label: "查询数据", icon: Search, gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { key: "insert", label: "插入数据", icon: Plus, gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { key: "update", label: "更新数据", icon: Edit, gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { key: "delete", label: "删除数据", icon: Trash2, gradient: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" },
  { key: "createTable", label: "创建表", icon: Table, gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" },
  { key: "dropTable", label: "删除表", icon: Grid2X2X, gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { key: "index", label: "管理索引", icon: Database, gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { key: "view", label: "视图管理", icon: Eye, gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { key: "trigger", label: "触发器", icon: Zap, gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { key: "transaction", label: "事务管理", icon: GitBranch, gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" },
  { key: "execute", label: "执行SQL", icon: Terminal, gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { key: "concurrency", label: "并发测试", icon: Activity, gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
];
</script>

<style scoped lang="scss">
.operation-selector {
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.selector-header {
  margin-bottom: 16px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.selector-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.op-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  background: var(--bg-base);
  border: 2px solid transparent;
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  &.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);

    .op-label {
      color: var(--color-primary);
      font-weight: 600;
    }
  }
}

.op-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.icon {
  width: 18px;
  height: 18px;
  color: #fff;
}

.op-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.4;
}
</style>
