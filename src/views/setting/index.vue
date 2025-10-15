<template>
  <layout-vue isPadding>
    <template #main>
      <el-form class="setting-form" label-width="108" label-position="left" :style="{
        // backgroundColor: appInnerColorCc,
      }">
        <el-form-item>
          <template #label>
            <div class="setting-title">基础数据</div>
          </template>
        </el-form-item>
        <el-form-item label="当前状态">
          <div :class="['cur-status', curStatusC.value === 'rest' ? 'cur-status-rest' : 'cur-status-work']">
            {{ curStatusC.label }}
          </div>
        </el-form-item>
        <el-form-item label="下次工作时间">
          <div>
            {{ nextWorkTime }}
          </div>
        </el-form-item>
        <el-form-item label="下次休息时间">
          <div>
            {{ nextRestTime }}
          </div>
        </el-form-item>
        <el-form-item label="工作时间">
          <el-input v-model="workTimeGapCc" placeholder="Please input" @change="changeWorkTimeGapCc">
            <template #append>
              <el-select v-model="workTimeGapUnitCc" placeholder="Select" style="width: 115px"
                @change="changeWorkTimeGapUnitCc">
                <el-option v-for="value in timeUnit" :key="value.times" :label="value.label" :value="value.times" />
              </el-select>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="休息时间">
          <el-input v-model="restTimeGapCc" placeholder="Please input" @change="changeRestTimeGapCc">
            <template #append>
              <el-select v-model="restTimeGapUnitCc" placeholder="Select" style="width: 115px"
                @change="changeRestTimeGapUnitCc">
                <el-option v-for="value in timeUnit" :key="value.times" :label="value.label" :value="value.times" />
              </el-select>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="">
          <el-button type="primary" @click="() => changeEffectFn()">立即生效</el-button>
        </el-form-item>

        <!-- 分割线 -->
        <el-divider></el-divider>
        <el-form-item>
          <template #label>
            <div class="setting-title">强制设置</div>
          </template>
        </el-form-item>
        <el-form-item label="强制工作次数">
          <el-radio-group v-model="forceWorkTimesC" @change="changeForceWorkTimes">
            <el-radio v-for="i in 4" :key="i" :value="i - 1" border>{{ i - 1 }} 次</el-radio>
          </el-radio-group>

        </el-form-item>
        <el-form-item label="立刻强制工作">
          <el-button type="primary" @click="() => forceWorkWithTimes({ isUpdateStartTime: true })">强制开始工作</el-button>
          <span style="margin-left: 1em;">今日剩余 {{ forceWorkTimesC - todayForceWorkTimesC?.times }} 次</span>
        </el-form-item>

        <!-- 分割线 -->
        <el-divider></el-divider>
        <CacheSet />

        <!-- 分割线 -->
        <el-divider></el-divider>
        <el-form-item>
          <template #label>
            <div class="setting-title">其他设置</div>
          </template>
        </el-form-item>

        <el-form-item label="是否开始工作">
          <el-button type="primary" @click="() => startWorkFn()">开始工作</el-button>

        </el-form-item>
        <el-form-item label="是否开始休息">
          <el-button type="primary" @click="() => startRestFn({ isUpdateCloseTime: true })">开始休息</el-button>
        </el-form-item>
        <el-form-item label="清空系统数据">
          <el-button type="primary" @click="clearStore">清空数据</el-button>
        </el-form-item>
        <el-form-item label="全局字体设置">
          <el-select v-model="globalFontCc" filterable style="width: 300px" @change="setGlobalFontC" popper-class="font-select-popper">
            <el-option v-for="value in [...globalFontOpsC, ...sysFonts]" :key="value.value" :value="value.value" :label="value.label">
              <!-- {{ value.label + 'fjalfwjs' }} -->
              <span class="font-box" :style="{ fontFamily: value.value }">
                <span class="font-name">{{ value.label }}</span>
                <span class="font-preview">
                  预览字体: 中文English123456
                </span>
              </span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="开机自启动">
          <el-switch v-model="isStartupCc" inline-prompt active-text="是" inactive-text="否" @change="changeIsStartup" />
        </el-form-item>
        <el-form-item label="退出应用">
          <el-button type="primary" @click="quitApp">点击退出应用</el-button>
        </el-form-item>
      </el-form>
    </template>
  </layout-vue>

</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw, nextTick } from 'vue';
import { useRouter } from 'vue-router';

import LayoutVue from '@/components/layout.vue';
import useWorkOrResetStore from '@/store/useWorkOrReset'
import { useWorkOrRest } from '@/hooks/useWorkOrReset';
import useClearStore from '@/hooks/useClearStore';
import useGlobalSetting from '@/store/useGlobalSetting';
import { storeToRefs } from 'pinia';
import { timeUnit } from '@/utils/time';
import confirmDialog from '@/utils/confirmDialog';
import CacheSet from '@/views/setting/cacheSet.vue';

const router = useRouter();

const { clearStore } = useClearStore();
const {
  startWorkFn,
  startRestFn,
  changeEffectFn,
  forceWorkWithTimes,
} = useWorkOrRest();

const {
  setWorkTimeGap,
  setRestTimeGap,
  setWorkTimeGapUnit,
  setRestTimeGapUnit,
} = useWorkOrResetStore()
const {
  workTimeGap,
  restTimeGap,
  workTimeGapUnit,
  restTimeGapUnit,
  startWorkTime,
  closeWorkTime,
  nextRestTime,
  nextWorkTime,
} = storeToRefs(useWorkOrResetStore());
const { setForceWorkTimes, setAppBgColor, setAppInnerColor, setIsStartup, setHomeMode, setGlobalFont, setHomeModeOps } = useGlobalSetting();
const { isStartupC, forceWorkTimesC, todayForceWorkTimesC, appBgColorC, appInnerColorC, globalFontC, globalFontOpsC, homeModeOpsC, curStatusC } = storeToRefs(useGlobalSetting());

const sysFonts = ref([])
const workTimeGapCc = ref(JSON.parse(JSON.stringify(workTimeGap.value)))
const restTimeGapCc = ref(JSON.parse(JSON.stringify(restTimeGap.value)))
const workTimeGapUnitCc = ref(JSON.parse(JSON.stringify(workTimeGapUnit.value)))
const restTimeGapUnitCc = ref(JSON.parse(JSON.stringify(restTimeGapUnit.value)))
const isStartupCc = ref(JSON.parse(JSON.stringify(isStartupC.value)))

watch(() => workTimeGap.value, (n) => {
  workTimeGapCc.value = JSON.parse(JSON.stringify(n));
})
watch(() => restTimeGap.value, (n) => {
  restTimeGapCc.value = JSON.parse(JSON.stringify(n));
})

watch(() => workTimeGapUnit.value, (n) => {
  workTimeGapUnitCc.value = JSON.parse(JSON.stringify(n));
})
watch(() => restTimeGapUnit.value, (n) => {
  restTimeGapUnitCc.value = JSON.parse(JSON.stringify(n));
})

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

window.ipcRenderer.handlePromise('get-fonts', {}).then(result => {
  sysFonts.value = result || [];
}).catch(err => {
  console.log('查询系统字体失败:', err);
})

const homeModeOpsCc = ref(JSON.parse(JSON.stringify(homeModeOpsC.value)))
const activeHomeModeOps = ref(toRaw(homeModeOpsCc.value[0]))

watch(() => homeModeOpsC.value, (n) => {
  homeModeOpsCc.value = JSON.parse(JSON.stringify(n));
}, {
  immediate: true,
  deep: true,
})

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

const globalFontCc = ref(JSON.parse(JSON.stringify(globalFontC.value)))

watch(() => globalFontC.value, (n) => {
  globalFontCc.value = JSON.parse(JSON.stringify(n));
})
function setGlobalFontC() {
  setGlobalFont(globalFontCc.value);
}

</script>

<style lang="scss">
.font-select-popper {
  //下拉框的背景色
  .el-select-dropdown__item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: fit-content;
    .font-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 72px;
    }
  }
}
</style>

<style scoped lang="scss">
.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.cur-status {
  &-work {
    &::before {
      content: "";
      display: inline-block;
      width: 12px;
      height: 12px;
      background: #00ffbf;
      border-radius: 50%;
      margin-right: 6px;
    }

    &::rest {
      content: "";
      display: inline-block;
      width: 12px;
      height: 12px;
      background: #ff0303;
      border-radius: 50%;
      margin-right: 6px;
    }
  }
}

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

// 主页模式
:deep(.mode-wrapper) {
  .el-form-item__content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.mode-ops {
  width: 100%;
  padding-top: 12px;

  .mode-item {
    display: flex;
    margin-bottom: 10px;
  }

  .mode-label {
    width: 150px;
  }
}
</style>