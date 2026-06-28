<template>
  <layout-vue>
    <template #main>
      <div class="setting-page">
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="Timer" />
            番茄钟设置
          </h2>

          <div class="status-card">
            <div class="status-left">
              <div class="status-indicator-wrapper">
                <div class="status-indicator" :class="curStatusC.value === 'rest' ? 'rest' : 'work'">
                  <LucideIcon name="Coffee" :size="20" class="status-icon" v-if="curStatusC.value === 'rest'" />
                  <LucideIcon name="Timer" :size="20" class="status-icon" v-else />
                </div>
                <div class="status-ring" :class="curStatusC.value === 'rest' ? 'rest' : 'work'"></div>
              </div>
              <div class="status-text">
                <div class="status-title">{{ curStatusC.label }}</div>
                <div class="status-desc">{{ curStatusC.value === 'rest' ? '正在休息中' : '正在工作中' }}</div>
              </div>
            </div>
            <div class="status-right">
              <div class="status-time">
                <LucideIcon name="Building2" :size="16" />
                <span>{{ nextWorkTime }}</span>
                <span class="time-label">下次工作</span>
              </div>
              <div class="status-time">
                <LucideIcon name="Coffee" :size="16" />
                <span>{{ nextRestTime }}</span>
                <span class="time-label">下次休息</span>
              </div>
            </div>
          </div>

          <div class="time-cards">
            <div class="time-card work-time-card">
              <div class="time-card-icon">
                <LucideIcon name="Building2" :size="24" />
              </div>
              <div class="time-card-content">
                <div class="time-card-title">工作时间</div>
                <div class="time-display">
                  <el-button size="large" type="text" @click="adjustWorkTime(-1)" class="time-btn-minus">-</el-button>
                  <div class="time-value-wrapper">
                    <span class="time-value">{{ workTimeGapCc }}</span>
                    <span class="time-unit">{{ workTimeGapUnitCc === 60 * 60 * 1000 ? '小时' : workTimeGapUnitCc === 60 * 1000 ? '分钟' : '秒' }}</span>
                  </div>
                  <el-button size="large" type="text" @click="adjustWorkTime(1)" class="time-btn-plus">+</el-button>
                </div>
              </div>
              <div class="time-card-select">
                <el-select
                  v-model="workTimeGapUnitCc"
                  size="small"
                  @change="changeWorkTimeGapUnitCc"
                  class="time-unit-select"
                >
                  <el-option v-for="value in timeUnit" :key="value.times" :label="value.label" :value="value.times" />
                </el-select>
              </div>
            </div>

            <div class="time-card rest-time-card">
              <div class="time-card-icon">
                <LucideIcon name="Coffee" :size="24" />
              </div>
              <div class="time-card-content">
                <div class="time-card-title">休息时间</div>
                <div class="time-display">
                  <el-button size="large" type="text" @click="adjustRestTime(-1)" class="time-btn-minus">-</el-button>
                  <div class="time-value-wrapper">
                    <span class="time-value">{{ restTimeGapCc }}</span>
                    <span class="time-unit">{{ restTimeGapUnitCc === 60 * 60 * 1000 ? '小时' : restTimeGapUnitCc === 60 * 1000 ? '分钟' : '秒' }}</span>
                  </div>
                  <el-button size="large" type="text" @click="adjustRestTime(1)" class="time-btn-plus">+</el-button>
                </div>
              </div>
              <div class="time-card-select">
                <el-select
                  v-model="restTimeGapUnitCc"
                  size="small"
                  @change="changeRestTimeGapUnitCc"
                  class="time-unit-select"
                >
                  <el-option v-for="value in timeUnit" :key="value.times" :label="value.label" :value="value.times" />
                </el-select>
              </div>
            </div>
          </div>

          <div class="action-bar">
            <el-button type="primary" @click="() => changeEffectFn()" class="action-btn">
              <LucideIcon name="StarCheck" />
              立即生效
            </el-button>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="Hourglass" />
            番茄钟可视化
          </h2>
          <div class="visual-card">
            <Pomodoro />
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="Haze" />
            强制设置
          </h2>

          <div class="force-card">
            <div class="force-label">强制工作次数</div>
            <div class="force-options">
              <el-button
                v-for="i in 4"
                :key="i"
                :type="forceWorkTimesC === i - 1 ? 'primary' : 'default'"
                :plain="forceWorkTimesC !== i - 1"
                @click="changeForceWorkTimes(i - 1)"
                class="force-option"
              >
                {{ i - 1 }} 次
              </el-button>
            </div>
          </div>

          <div class="force-action-card">
            <el-button type="primary" @click="() => forceWorkWithTimes({ isUpdateStartTime: true })" class="force-btn">
              <LucideIcon name="Telescope" />
              强制开始工作
            </el-button>
            <el-tag size="small" type="info" class="force-badge">
              今日剩余 {{ forceWorkTimesC - todayForceWorkTimesC?.times }} 次
            </el-tag>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="FolderCog" />
            缓存设置
          </h2>
          <div class="cache-card">
            <CacheSet />
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="Settings" />
            其他设置
          </h2>

          <div class="font-card">
            <div class="font-label">字体设置</div>
            <div class="font-row">
              <div class="font-item">
                <span class="font-item-label">中文</span>
                <el-select-v2
                  v-model="globalFontCc"
                  @change="setGlobalFontC"
                  filterable
                  :options="[...globalFontOpsC, ...sysFonts]"
                  popper-class="font-select-popper"
                  :item-height="72"
                  style="width: 280px"
                >
                  <template #default="{ item }">
                    <span class="font-box" :style="{ fontFamily: item.value }">
                      <span class="font-name">{{ item.label }}</span>
                      <span class="font-preview">预览字体: 中文English123456</span>
                    </span>
                  </template>
                </el-select-v2>
              </div>
              <div class="font-item">
                <span class="font-item-label">英文</span>
                <el-select-v2
                  v-model="globalFontENCc"
                  @change="setGlobalFontENC"
                  filterable
                  :options="[...globalFontOpsC, ...sysFonts]"
                  popper-class="font-select-popper"
                  :item-height="72"
                  style="width: 280px"
                >
                  <template #default="{ item }">
                    <span class="font-box" :style="{ fontFamily: item.value }">
                      <span class="font-name">{{ item.label }}</span>
                      <span class="font-preview">预览字体: 中文English123456</span>
                    </span>
                  </template>
                </el-select-v2>
              </div>
            </div>
          </div>

          <div class="toggle-card">
            <span class="toggle-label">开机自启动</span>
            <el-switch
              v-model="isStartupCc"
              inline-prompt
              active-text="是"
              inactive-text="否"
              @change="changeIsStartup"
            />
          </div>

          <div class="action-grid">
            <div class="action-card work-action">
              <LucideIcon name="Crosshair"  :padding="12" color="#6366f1" type="rounded"/>
              <div class="action-title">开始工作</div>
              <div class="action-desc">立即开始工作模式</div>
              <el-button type="primary" @click="() => startWorkFn()" class="action-button">开始</el-button>
            </div>

            <div class="action-card rest-action">
              <LucideIcon name="Coffee" :padding="12" color="#67c23a" type="rounded" />
              <div class="action-title">开始休息</div>
              <div class="action-desc">立即开始休息模式</div>
              <el-button type="success" @click="() => startRestFn({ isUpdateCloseTime: true })" class="action-button">休息</el-button>
            </div>

            <div class="action-card clear-action">
              <LucideIcon name="Trash" :padding="12" color="#e6a23c" type="rounded" />
              <div class="action-title">清空数据</div>
              <div class="action-desc">清除所有系统数据</div>
              <el-button type="warning" @click="clearStore" class="action-button">清空</el-button>
            </div>

            <div class="action-card quit-action">
              <LucideIcon name="LogOut" :padding="12" color="#f56c6c" type="rounded" />
              <div class="action-title">退出应用</div>
              <div class="action-desc">退出当前应用程序</div>
              <el-button type="danger" @click="quitApp" class="action-button">退出</el-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import useWorkOrResetStore from '@/store/useWorkOrReset';
import { useWorkOrRest } from '@/hooks/useWorkOrReset';
import useClearStore from '@/hooks/useClearStore';
import useGlobalSetting from '@/store/useGlobalSetting';
import { storeToRefs } from 'pinia';
import { timeUnit } from '@/utils/time';
import confirmDialog from '@/utils/confirmDialog';
import CacheSet from '@/views/setting/cacheSet.vue';
import Pomodoro from '@/views/setting/pomodoro.vue';

const { clearStore } = useClearStore();
const { startWorkFn, startRestFn, changeEffectFn, forceWorkWithTimes } = useWorkOrRest();

const { setWorkTimeGap, setRestTimeGap, setWorkTimeGapUnit, setRestTimeGapUnit } = useWorkOrResetStore();
const { workTimeGap, restTimeGap, workTimeGapUnit, restTimeGapUnit, nextRestTime, nextWorkTime } = storeToRefs(useWorkOrResetStore());
const { setForceWorkTimes, setIsStartup, setGlobalFont, setGlobalFontEN } = useGlobalSetting();
const { isStartupC, forceWorkTimesC, todayForceWorkTimesC, globalFontC, globalFontENC, globalFontOpsC, curStatusC } = storeToRefs(useGlobalSetting());

const sysFonts = ref([]);
const workTimeGapCc = ref(workTimeGap.value);
const restTimeGapCc = ref(restTimeGap.value);
const workTimeGapUnitCc = ref(workTimeGapUnit.value);
const restTimeGapUnitCc = ref(restTimeGapUnit.value);
const isStartupCc = ref(isStartupC.value);
const globalFontCc = ref(globalFontC.value);
const globalFontENCc = ref(globalFontENC.value);

watch(workTimeGap, (n) => {
  workTimeGapCc.value = n;
});
watch(restTimeGap, (n) => {
  restTimeGapCc.value = n;
});
watch(workTimeGapUnit, (n) => {
  workTimeGapUnitCc.value = n;
});
watch(restTimeGapUnit, (n) => {
  restTimeGapUnitCc.value = n;
});
watch(globalFontC, (n) => {
  globalFontCc.value = n;
});
watch(globalFontENC, (n) => {
  globalFontENCc.value = n;
});
watch(isStartupC, (n) => {
  isStartupCc.value = n;
});

function adjustWorkTime(delta: number) {
  const newValue = workTimeGapCc.value + delta;
  if (newValue >= 1 && newValue <= 180) {
    workTimeGapCc.value = newValue;
    changeWorkTimeGapCc();
  }
}

function adjustRestTime(delta: number) {
  const newValue = restTimeGapCc.value + delta;
  if (newValue >= 1 && newValue <= 60) {
    restTimeGapCc.value = newValue;
    changeRestTimeGapCc();
  }
}

function changeWorkTimeGapCc() {
  setWorkTimeGap(workTimeGapCc.value);
}

function changeRestTimeGapCc() {
  setRestTimeGap(restTimeGapCc.value);
}

function changeWorkTimeGapUnitCc() {
  setWorkTimeGapUnit(workTimeGapUnitCc.value);
}

function changeRestTimeGapUnitCc() {
  setRestTimeGapUnit(restTimeGapUnitCc.value);
}

function quitApp() {
  confirmDialog.open('确定要退出应用吗？', 3, () => {
    window.ipcRenderer.send('quit-app');
  });
}

function changeForceWorkTimes(value: number) {
  setForceWorkTimes(Number(value));
}

function changeIsStartup(value: boolean) {
  isStartupCc.value = value;
  setIsStartup(value);
}

function setGlobalFontC() {
  setGlobalFont(globalFontCc.value);
}

function setGlobalFontENC() {
  setGlobalFontEN(globalFontENCc.value);
}

onMounted(async () => {
  await nextTick();
  try {
    const result = await window.ipcRenderer.handlePromise('get-fonts', {});
    sysFonts.value = result || [];
  } catch (err) {
    console.log('查询系统字体失败:', err);
  }
});
</script>

<style lang="scss">
.font-select-popper {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-subtle) !important;

  .el-select-dropdown__item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: fit-content;
    color: var(--text-primary) !important;

    &:hover {
      background: var(--bg-hover) !important;
    }

    .font-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 72px;
    }

    .font-name {
      font-size: 14px;
      font-weight: 500;
    }

    .font-preview {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
  }
}
</style>

<style scoped lang="scss">
:deep(.main) {
  padding: 0 !important;
}

.setting-page {
  width: 100%;
  min-height: 100%;
  // padding: 20px;
  box-sizing: border-box;

  .section {
    margin-bottom: 28px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--color-primary);

      .el-icon {
        color: var(--color-primary);
      }
    }
  }

  .status-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px 24px;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, var(--color-primary), var(--color-primary) 50%, rgba(0,0,0,0.1));
    }

    .status-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .status-indicator-wrapper {
      position: relative;
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-indicator {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
      transition: all 0.3s ease;

      &.work {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        .status-icon { color: #fff; }
      }

      &.rest {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        .status-icon { color: #fff; }
      }
    }

    .status-ring {
      position: absolute;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 3px solid transparent;
      animation: status-ring 2s ease-in-out infinite;

      &.work {
        border-color: rgba(102, 126, 234, 0.3);
      }

      &.rest {
        border-color: rgba(245, 87, 108, 0.3);
      }
    }

    .status-text {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .status-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .status-desc {
        font-size: 13px;
        color: var(--text-muted);
      }
    }

    .status-right {
      display: flex;
      gap: 32px;

      .status-time {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;

        .el-icon {
          color: var(--color-primary);
          margin-right: 6px;
        }

        span {
          font-size: 14px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .time-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: normal;
        }
      }
    }
  }

  .time-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 20px;

    .time-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-card);
      padding: 20px;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;

      &:hover {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-card);
      }

      &.work-time-card {
        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #667eea, #764ba2);
        }

        .time-card-icon {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
          color: #667eea;
        }
      }

      &.rest-time-card {
        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #67c23a, #85ce61);
        }

        .time-card-icon {
          background: linear-gradient(135deg, rgba(103, 194, 58, 0.1), rgba(133, 206, 97, 0.1));
          color: #67c23a;
        }
      }

      .time-card-icon {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .time-card-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .time-card-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .time-display {
          display: flex;
          align-items: center;
          gap: 12px;

          .time-btn-minus,
          .time-btn-plus {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            font-size: 20px;
            font-weight: 300;
            color: var(--text-secondary);
            background: var(--bg-hover);
            transition: all 0.2s ease;

            &:hover {
              background: var(--color-primary);
              color: #fff;
            }

            &:active {
              transform: scale(0.95);
            }
          }

          .time-value-wrapper {
            display: flex;
            align-items: baseline;
            gap: 6px;

            .time-value {
              font-size: 36px;
              font-weight: 700;
              color: var(--text-primary);
              line-height: 1;
              font-variant-numeric: tabular-nums;
            }

            .time-unit {
              font-size: 14px;
              color: var(--text-muted);
            }
          }
        }
      }

      .time-card-select {
        flex-shrink: 0;

        .time-unit-select {
          width: 80px;
          font-size: 13px;
        }
      }
    }
  }

  .action-bar {
    display: flex;
    justify-content: flex-end;

    .action-btn {
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 500;
    }
  }

  .visual-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .force-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
    margin-bottom: 16px;

    .force-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    .force-options {
      display: flex;
      gap: 10px;

      .force-option {
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
      }
    }
  }

  .force-action-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 16px 20px;

    .force-btn {
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 500;
    }

    .force-badge {
      font-size: 13px;
    }
  }

  .cache-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .font-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
    margin-bottom: 16px;

    .font-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 16px;
    }

    .font-row {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
    }

    .font-item {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .font-item-label {
        font-size: 13px;
        color: var(--text-secondary);
      }
    }
  }

  .toggle-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 16px 20px;
    margin-bottom: 16px;

    .toggle-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;

    .action-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-card);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-card);
        transform: translateY(-2px);
      }

      .action-icon {
        font-size: 32px;
        color: var(--color-primary);
      }

      .action-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .action-desc {
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }

      .action-button {
        margin-top: 8px;
        padding: 8px 20px;
        font-size: 13px;
      }

      &.work-action .action-icon { color: #409eff; }
      &.rest-action .action-icon { color: #67c23a; }
      &.clear-action .action-icon { color: #e6a23c; }
      &.quit-action .action-icon { color: #f56c6c; }
    }
  }
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes status-ring {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.2;
  }
}
</style>