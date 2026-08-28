<template>
  <div class="home-mode">
    <div class="section-header">
      <h3 class="section-title">
        <LucideIcon name="FileBox" :size="16" />
        主页模式
      </h3>
    </div>

    <div class="mode-cards">
      <!-- 日常模式 -->
      <div class="mode-card work-card">
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon name="Sun" :size="22" />
          </div>
          <div class="mode-card-title">日常模式</div>
        </div>
        <div class="mode-options">
          <ModeOptionCard
            v-for="(item, index) in homeModeOpsCc"
            :key="item.value"
            class="mode-option-slot"
            :label="item.label"
            :active="homeModeCc.work.value === item.value"
            :gradient="gradientPalette[index % gradientPalette.length]"
            @select="selectMode('work', item.value)"
          />
        </div>
      </div>

      <!-- 锁定模式 -->
      <div class="mode-card rest-card">
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon name="Lock" :size="22" />
          </div>
          <div class="mode-card-title">锁定模式</div>
        </div>
        <div class="mode-options">
          <ModeOptionCard
            v-for="(item, index) in homeModeOpsCc"
            :key="item.value"
            class="mode-option-slot"
            :label="item.label"
            :active="homeModeCc.rest.value === item.value"
            :gradient="gradientPalette[index % gradientPalette.length]"
            @select="selectMode('rest', item.value)"
          />
        </div>
      </div>

      <!-- 屏保模式 -->
      <div class="mode-card screen-card">
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon name="Monitor" :size="22" />
          </div>
          <div class="mode-card-title">屏保模式</div>
        </div>
        <div class="mode-options">
          <ModeOptionCard
            v-for="(item, index) in homeModeOpsCc"
            :key="item.value"
            class="mode-option-slot"
            :label="item.label"
            :active="homeModeCc.screen.value === item.value"
            :gradient="gradientPalette[index % gradientPalette.length]"
            @select="selectMode('screen', item.value)"
          />
        </div>
      </div>

      <!-- 强制锁屏模式：番茄钟 lock 状态（非序列、强制锁屏）对应的皮肤方案 -->
      <div class="mode-card lock-card">
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon name="Key" :size="22" />
          </div>
          <div class="mode-card-title">强制锁屏模式</div>
        </div>
        <div class="mode-options">
          <ModeOptionCard
            v-for="(item, index) in homeModeOpsCc"
            :key="item.value"
            class="mode-option-slot"
            :label="item.label"
            :active="homeModeCc.lock.value === item.value"
            :gradient="gradientPalette[index % gradientPalette.length]"
            @select="selectMode('lock', item.value)"
          />
        </div>
      </div>
    </div>

    <!-- 空闲模式：空闲（免打扰）时段对应的皮肤方案 -->
    <div class="mode-card idle-card">
      <div class="mode-card-header">
        <div class="mode-card-icon">
          <LucideIcon name="Moon" :size="22" />
        </div>
        <div class="mode-card-title">空闲模式</div>
      </div>
      <div class="mode-options">
        <ModeOptionCard
          v-for="(item, index) in homeModeOpsCc"
          :key="item.value"
          class="mode-option-slot"
          :label="item.label"
          :active="homeModeCc.idle.value === item.value"
          :gradient="gradientPalette[index % gradientPalette.length]"
          @select="selectMode('idle', item.value)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, toRaw } from 'vue';
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

.mode-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
