<!--
  待办统计弹窗（E1）：核心指标 + 近 30 天完成趋势 + 标签分布。
  趋势图用零依赖 CSS 柱状图（替代 ECharts：避免引入图表主题/SSR/resize 一套坑，
  柱高按最大值归一化，配色走主题 token），数据全部由 store.todos 客户端聚合，零表变更。
-->
<template>
  <app-dialog
    :model-value="modelValue"
    title="待办统计"
    width="640px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="stats-body">
      <!-- 核心指标 -->
      <div class="stat-cards">
        <div class="stat-card">
          <span class="num">{{ store.totalCount }}</span>
          <span class="label">总计</span>
        </div>
        <div class="stat-card">
          <span class="num primary">{{ store.completionRate }}%</span>
          <span class="label">完成率</span>
        </div>
        <div class="stat-card">
          <span class="num success">{{ store.todayDoneCount }}</span>
          <span class="label">今日完成</span>
        </div>
        <div class="stat-card">
          <span class="num danger">{{ store.overdueCount }}</span>
          <span class="label">逾期未完成</span>
        </div>
      </div>

      <!-- 近 30 天完成趋势 -->
      <div class="section">
        <div class="section-title">近 30 天完成趋势</div>
        <div class="trend">
          <div
            v-for="d in trend"
            :key="d.date"
            class="trend-col"
            :title="`${d.date} 完成 ${d.count} 条`"
          >
            <div class="bar-wrap">
              <div class="bar" :style="{ height: barHeight(d.count) }" />
            </div>
            <span class="day-label">{{ d.label }}</span>
          </div>
        </div>
        <div v-if="!trendMax" class="trend-empty">近 30 天还没有完成记录</div>
      </div>

      <!-- 标签分布 -->
      <div v-if="tagDist.length" class="section">
        <div class="section-title">标签分布</div>
        <div class="tag-dist">
          <div v-for="item in tagDist" :key="item.key" class="dist-row">
            <span class="dot" :style="{ background: item.color }" />
            <span class="name">{{ item.name }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: item.percent + '%', background: item.color }" />
            </div>
            <span class="count">{{ item.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </app-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import moment from 'moment';
import { useTodoStore } from '@/store/useTodo';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const store = useTodoStore();

/** 近 30 天每天完成数（按 completedTime 日期聚合，含今天） */
const trend = computed(() => {
  const counts = new Map<string, number>();
  for (const t of store.todos) {
    if (store.effectiveStatus(t) !== 'completed') continue;
    const day = (t.completedTime || '').slice(0, 10);
    if (!day) continue;
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  const out: { date: string; label: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = moment().subtract(i, 'days');
    const date = d.format('YYYY-MM-DD');
    out.push({ date, label: i % 5 === 0 ? d.format('MM-DD') : '', count: counts.get(date) || 0 });
  }
  return out;
});

const trendMax = computed(() => Math.max(1, ...trend.value.map((d) => d.count)));
const barHeight = (count: number) => `${Math.round((count / trendMax.value) * 100)}%`;

/** 标签分布（按使用条数，取前 8） */
const tagDist = computed(() => {
  const counts = new Map<string, number>();
  for (const t of store.todos) {
    try {
      const keys = JSON.parse(t.tags || '[]') as string[];
      for (const k of keys) counts.set(k, (counts.get(k) || 0) + 1);
    } catch {
      /* ignore */
    }
  }
  const max = Math.max(1, ...counts.values());
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({
      key,
      name: store.tags.find((t) => t.key === key)?.name || '已删除标签',
      color: store.tags.find((t) => t.key === key)?.color || '#9ca3af',
      count,
      percent: Math.round((count / max) * 100),
    }));
});
</script>

<style scoped lang="scss">
.stats-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 0;
    border-radius: 10px;
    background: var(--bg-hover);

    .num {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);

      &.primary { color: var(--color-primary); }
      &.success { color: #22c55e; }
      &.danger { color: #ef4444; }
    }

    .label {
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}

.section {
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
}

.trend {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 120px;

  .trend-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;

    .bar-wrap {
      flex: 1;
      width: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: center;

      .bar {
        width: 70%;
        min-height: 2px;
        border-radius: 3px 3px 0 0;
        background: var(--color-primary);
        opacity: 0.85;
      }
    }

    .day-label {
      font-size: 10px;
      color: var(--text-muted);
      height: 14px;
      line-height: 14px;
    }
  }
}

.trend-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 8px 0;
}

.tag-dist {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .dist-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .name {
      flex: 0 0 96px;
      font-size: 12px;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-track {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: var(--bg-hover);
      overflow: hidden;

      .bar-fill {
        height: 100%;
        border-radius: 4px;
        opacity: 0.8;
      }
    }

    .count {
      flex: 0 0 28px;
      text-align: right;
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}
</style>
