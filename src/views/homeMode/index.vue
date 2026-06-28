<template>
  <div class="home-mode">
    <div class="section-header">
      <h3 class="section-title">
        <LucideIcon name="FileBox" :size="16" />
        主页模式
      </h3>
    </div>

    <div class="mode-cards">
      <div class="mode-card work-card">
        <div class="mode-card-icon">
          <LucideIcon name="Sun" :size="28" />
        </div>
        <div class="mode-card-content">
          <div class="mode-card-title">日常模式</div>
          <el-select v-model="homeModeCc.work.value" value-key="value" placeholder="请选择" class="mode-select"
            @change="changeHomeMode('work')">
            <el-option v-for="item in homeModeOpsCc" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
      </div>

      <div class="mode-card rest-card">
        <div class="mode-card-icon">
          <LucideIcon name="Lock" :size="28" />
        </div>
        <div class="mode-card-content">
          <div class="mode-card-title">锁定模式</div>
          <el-select v-model="homeModeCc.rest.value" value-key="value" placeholder="请选择" class="mode-select"
            @change="changeHomeMode('rest')">
            <el-option v-for="item in homeModeOpsCc" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
      </div>

      <div class="mode-card screen-card">
        <div class="mode-card-icon">
          <LucideIcon name="Monitor" :size="28" />
        </div>
        <div class="mode-card-content">
          <div class="mode-card-title">屏保模式</div>
          <el-select v-model="homeModeCc.screen.value" value-key="value" placeholder="请选择" class="mode-select"
            @change="changeHomeMode('screen')">
            <el-option v-for="item in homeModeOpsCc" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
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
  border-bottom: 2px solid var(--color-primary);

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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }

  .mode-card-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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

  .mode-card-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .mode-card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .mode-select {
      width: 100%;
    }
  }
}
</style>