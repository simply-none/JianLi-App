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
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon name="Sun" :size="22" />
          </div>
          <div class="mode-card-title">日常模式</div>
        </div>
        <div class="mode-options">
          <div
            v-for="item in homeModeOpsCc"
            :key="item.value"
            class="mode-option"
            :class="{ active: homeModeCc.work.value === item.value }"
            :title="item.label"
            @click="selectMode('work', item.value)"
          >
            <div class="mode-option-label">{{ item.label }}</div>
          </div>
        </div>
      </div>

      <div class="mode-card rest-card">
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon name="Lock" :size="22" />
          </div>
          <div class="mode-card-title">锁定模式</div>
        </div>
        <div class="mode-options">
          <div
            v-for="item in homeModeOpsCc"
            :key="item.value"
            class="mode-option"
            :class="{ active: homeModeCc.rest.value === item.value }"
            :title="item.label"
            @click="selectMode('rest', item.value)"
          >
            <div class="mode-option-label">{{ item.label }}</div>
          </div>
        </div>
      </div>

      <div class="mode-card screen-card">
        <div class="mode-card-header">
          <div class="mode-card-icon">
            <LucideIcon name="Monitor" :size="22" />
          </div>
          <div class="mode-card-title">屏保模式</div>
        </div>
        <div class="mode-options">
          <div
            v-for="item in homeModeOpsCc"
            :key="item.value"
            class="mode-option"
            :class="{ active: homeModeCc.screen.value === item.value }"
            :title="item.label"
            @click="selectMode('screen', item.value)"
          >
            <div class="mode-option-label">{{ item.label }}</div>
          </div>
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
          <div
            v-for="item in homeModeOpsCc"
            :key="item.value"
            class="mode-option"
            :class="{ active: homeModeCc.lock.value === item.value }"
            :title="item.label"
            @click="selectMode('lock', item.value)"
          >
            <div class="mode-option-label">{{ item.label }}</div>
          </div>
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
        <div
          v-for="item in homeModeOpsCc"
          :key="item.value"
          class="mode-option"
          :class="{ active: homeModeCc.idle.value === item.value }"
          :title="item.label"
          @click="selectMode('idle', item.value)"
        >
          <div class="mode-option-label">{{ item.label }}</div>
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

.mode-options {
  display: flex;
  flex-wrap: wrap;
  margin: -5px;
}

.mode-option {
  flex: 0 0 calc(25% - 10px);
  margin: 5px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 8px;
  background: var(--el-fill-color-blank, #ffffff);
  color: var(--el-text-color-regular, #606266);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    color: var(--el-color-primary, #409eff);
    border-color: var(--el-color-primary-light-7, #c6e2ff);
  }

  &.active {
    color: #fff;
    background: var(--el-color-primary, #409eff);
    border-color: var(--el-color-primary, #409eff);
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
  }

  .mode-option-label {
    line-height: 1.2;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
}
</style>