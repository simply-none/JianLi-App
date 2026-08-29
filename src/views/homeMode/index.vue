<template>
  <div class="home-mode">
    <div class="section-header">
      <h3 class="section-title">
        <LucideIcon name="FileBox" :size="16" />
        主页模式
      </h3>
    </div>

    <!-- 顶部模式切换 Tab：同一时刻只展示一个模式的选项，避免逐卡堆叠导致长滚动 -->
    <div class="mode-tabs" role="tablist">
      <button
        v-for="tab in modeTabs"
        :key="tab.key"
        class="mode-tab"
        :class="[`tab-${tab.key}`, { 'is-active': activeTab === tab.key }]"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="activeTab = tab.key"
      >
        <span class="mode-tab-icon">
          <LucideIcon :name="tab.icon" :size="18" />
        </span>
        <span class="mode-tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- 当前选中模式的选项面板 -->
    <transition name="tab-fade" mode="out-in">
      <div class="mode-card" :class="`${activeTab}-card`" :key="activeTab">
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon :name="currentTab.icon" :size="22" />
          </div>
          <div class="mode-card-title">{{ currentTab.label }}</div>
        </div>
        <div class="mode-options">
          <ModeOptionCard
            v-for="(item, index) in homeModeOpsCc"
            :key="item.value"
            class="mode-option-slot"
            :label="item.label"
            :active="homeModeCc[activeTab].value === item.value"
            :gradient="gradientPalette[index % gradientPalette.length]"
            @select="selectMode(activeTab, item.value)"
          />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import type { StatusMode } from '@/store/useGlobalSetting';
// 原子组件：单个模式选项卡片（渐变背景 + 固定首行"选项" + 模式名）
import ModeOptionCard from './components/ModeOptionCard.vue';

const { setHomeMode } = useGlobalSetting();
const { homeModeOpsC, homeModeC } = storeToRefs(useGlobalSetting());

const homeModeCc = ref<Record<StatusMode, ObjectType>>(JSON.parse(JSON.stringify(homeModeC.value)));
const homeModeOpsCc = ref(JSON.parse(JSON.stringify(homeModeOpsC.value)));

watch(() => homeModeOpsC.value, (n) => {
  homeModeOpsCc.value = JSON.parse(JSON.stringify(n));
}, {
  immediate: true,
  deep: true,
});

watch(() => homeModeC.value, (n) => {
  homeModeCc.value = JSON.parse(JSON.stringify(n));
}, { deep: true });

// 顶部 Tab 配置：顺序即展示顺序，key 与 homeMode 的 StatusMode 对齐
const modeTabs = [
  { key: 'work', label: '日常模式', icon: 'Sun' },
  { key: 'rest', label: '锁定模式', icon: 'Lock' },
  { key: 'screen', label: '屏保模式', icon: 'Monitor' },
  { key: 'lock', label: '强制锁屏模式', icon: 'Key' },
  { key: 'idle', label: '空闲模式', icon: 'Moon' },
] as const;

// 当前选中的模式（Tab 切换的本地状态）
const activeTab = ref<StatusMode>('work');
const currentTab = computed(() => modeTabs.find((t) => t.key === activeTab.value)!);

// 选项卡片渐变调色板：引用主题变量（src/styles/themes），随当前主题切换自动契合主题色；
// 前两项取主色/头部渐变（最强主题关联），其余取主题内置的 icon 渐变，保证各选项颜色区分。
const gradientPalette = [
  'linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to))',
  'linear-gradient(135deg, var(--header-gradient-from), var(--header-gradient-to))',
  'linear-gradient(135deg, var(--icon-blue-from), var(--icon-blue-to))',
  'linear-gradient(135deg, var(--icon-green-from), var(--icon-green-to))',
  'linear-gradient(135deg, var(--icon-orange-from), var(--icon-orange-to))',
  'linear-gradient(135deg, var(--icon-yellow-from), var(--icon-yellow-to))',
  'linear-gradient(135deg, var(--icon-cyan-from), var(--icon-cyan-to))',
  'linear-gradient(135deg, var(--icon-purple-from), var(--icon-purple-to))',
];

function selectMode(key: StatusMode, value: string) {
  homeModeCc.value[key].value = value;
  changeHomeMode(key);
}

function changeHomeMode(key: StatusMode) {
  const find = homeModeOpsCc.value.find((item: any) => item.value === homeModeCc.value[key].value);
  if (!find) { return; }
  homeModeCc.value[key] = {
    ...homeModeCc.value[key],
    ...find,
    mode: {
      ...toRaw(homeModeCc.value[key].mode || {}),
      [homeModeCc.value[key].value]: toRaw(homeModeCc.value[key].mode[homeModeCc.value[key].value] || {}),
    },
  };
  delete homeModeCc.value[key].mode.undefined;
  setHomeMode(homeModeCc.value);
}
</script>

<style scoped lang="scss">
.home-mode {
  width: 100%;
}

.section-header {
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid transparent;
  background: linear-gradient(90deg, var(--color-primary), transparent) no-repeat left bottom / 100% 1px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;

    .el-icon {
      color: var(--color-primary);
    }
  }
}

// 顶部模式切换 Tab
.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.mode-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 10px);
  background: var(--bg-card);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  &.is-active {
    border-color: var(--color-primary);
    background: var(--color-primary-light, rgba(99, 102, 241, 0.12));
    box-shadow: var(--shadow-card);
  }

  .mode-tab-icon {
    display: inline-flex;
  }

  .mode-tab-label {
    color: var(--text-secondary);
    transition: color 0.18s ease;
  }

  &:hover .mode-tab-label {
    color: var(--text-primary);
  }

  &.is-active .mode-tab-label {
    color: var(--color-primary);
  }
}

// 每个模式 Tab 图标沿用卡片专属色，便于区分
.tab-work .mode-tab-icon { color: #409eff; }
.tab-rest .mode-tab-icon { color: #764ba2; }
.tab-screen .mode-tab-icon { color: #67c23a; }
.tab-lock .mode-tab-icon { color: #e6a23c; }
.tab-idle .mode-tab-icon { color: #909399; }

// Tab 切换过渡
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.mode-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px 20px 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }

  &.work-card .mode-card-icon {
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.15), rgba(102, 126, 234, 0.15));
    color: #409eff;
  }

  &.rest-card .mode-card-icon {
    background: linear-gradient(135deg, rgba(118, 75, 162, 0.15), rgba(155, 89, 182, 0.15));
    color: #764ba2;
  }

  &.screen-card .mode-card-icon {
    background: linear-gradient(135deg, rgba(103, 194, 58, 0.15), rgba(82, 190, 128, 0.15));
    color: #67c23a;
  }

  &.lock-card .mode-card-icon {
    background: linear-gradient(135deg, rgba(230, 162, 60, 0.15), rgba(245, 108, 108, 0.15));
    color: #e6a23c;
  }

  &.idle-card .mode-card-icon {
    background: linear-gradient(135deg, rgba(144, 147, 153, 0.15), rgba(96, 98, 102, 0.15));
    color: #909399;
  }
}

.mode-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;

  .mode-card-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .mode-card-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

// 选项容器：弹性换行 + 槽位类控制卡片宽度
.mode-options {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 14px;
}

// 每个选项卡片的栅格槽位（4 列，含 3 个 14px 间距 → 每格 25% - 10.5px）
.mode-option-slot {
  flex: 0 0 calc(25% - 10.5px);
}

@media (max-width: 768px) {
  .mode-option-slot {
    flex: 0 0 calc(50% - 7px);
  }
}

// hover 聚焦：悬停某卡片时，其余卡片背景变暗（对应 demo 的
// .card-grid:hover > .card:not(:hover) .card__background 效果）
.mode-options:hover .mode-option-slot:not(:hover) :deep(.mode-option-card__bg) {
  filter: brightness(0.5) saturate(0.6) contrast(1.1);
}
</style>
