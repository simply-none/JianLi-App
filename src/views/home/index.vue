<template>
  <layout-vue>
    <template #main>
      <component :is="curComponent" />
      <div class="setting">
        <el-popover placement="right" :width="100" trigger="contextmenu" :auto-close="3000">
          <template #reference>
            <LucideIcon class="setting-icon" name="Settings" @click="toSetting" :padding="12" :size="24" />
          </template>
          <div class="home-btns">
            <el-button type="primary" v-if="curStatusC.value != 'screen'" @click="startLockedFn">
              开启锁屏状态
            </el-button>
            <el-button v-if="curStatusC.value == 'screen'" @click="closeLockedFn">
              开始工作
            </el-button>
            <el-button @click="closeHomeBtnsFn">隐藏操作按钮</el-button>
          </div>
        </el-popover>
      </div>
    </template>
  </layout-vue>

</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';

import custom from '@/views/home/custom.vue';
import ImitationWindowsUpdate from '@/views/home/imitationWindowsUpdate.vue';
import MinimalClock from '@/views/home/minimalClock.vue';
import GitHubTheme from '@/views/home/githubTheme.vue';
import MotivationalQuote from '@/views/home/motivationalQuote.vue';
import TerminalTheme from '@/views/home/terminalTheme.vue';
import MusicPlayerTheme from '@/views/home/musicPlayerTheme.vue';
import WindowsDesktop from '@/views/home/windowsDesktop.vue';
import MacOSDesktop from '@/views/home/macOSDesktop.vue';
import NewsReader from '@/views/home/newsReader.vue';
import CodeEditorTheme from '@/views/home/codeEditorTheme.vue';
import SearchEngine from '@/views/home/searchEngine.vue';
import LayoutVue from '@/components/layout.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import useSafetyProtection from '@/store/useSafetyProtection';
import { useWorkOrRest } from '@/hooks/useWorkOrReset';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const isHiddenHomeBtns = ref(false)
const { homeModeC, curStatusC } = storeToRefs(useGlobalSetting());
const { startScreenSaverFn, closeScreenSaverFn } = useWorkOrRest();
const { isPwdSame } = useSafetyProtection();
const curComponent = shallowRef(custom)

watch(() => homeModeC.value[curStatusC.value.value], (n, o) => {
  console.log(n, o, 'homeModeC')
  switch (n.value) {
    case '1':
      curComponent.value = ImitationWindowsUpdate
      break;
    case '3':
      curComponent.value = custom
      break;
    case '4':
      curComponent.value = MinimalClock
      break;
    case '5':
      curComponent.value = GitHubTheme
      break;
    case '6':
      curComponent.value = MotivationalQuote
      break;
    case '7':
      curComponent.value = TerminalTheme
      break;
    case '8':
      curComponent.value = MusicPlayerTheme
      break;
    case '9':
      curComponent.value = WindowsDesktop
      break;
    case '10':
      curComponent.value = MacOSDesktop
      break;
    case '11':
      curComponent.value = NewsReader
      break;
    case '12':
      curComponent.value = CodeEditorTheme
      break;
    case '13':
      curComponent.value = SearchEngine
      break;
  }
}, { immediate: true, deep: true })

// 打开操作按钮
function openHomeBtnsFn() {
  isHiddenHomeBtns.value = true
  console.log('打开操作按钮')
}

// 关闭操作按钮
function closeHomeBtnsFn() {
  isHiddenHomeBtns.value = false
  console.log('关闭操作按钮')
}

function toggleComponent(status) {
  switch (status) {
    case 'work':
      return 'work'
    case 'rest':
      return 'rest'
  }
}

watch(() => curStatusC.value.value, () => {
  // 首页展示组件模式变更
  toggleComponent(curStatusC.value.value)
}, { immediate: true, deep: true })

// 开启锁屏状态
function startLockedFn() {
  startScreenSaverFn()
  closeHomeBtnsFn()
}

// 关闭锁屏状态
function closeLockedFn() {
  // 结束锁屏需要输入密码确认
  ElMessageBox.prompt('请输入密码', '确认关闭锁屏', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'password',
  }).then(({ value }) => {
    console.log(value, 'value', isPwdSame(value));
    if (isPwdSame(value)) {
      closeScreenSaverFn()
      closeHomeBtnsFn()
    }
    else {
      ElMessage.error('密码错误')
    }
  }).catch(() => {
    ElMessage({
      type: 'info',
      message: '已取消'
    });
  });
}

function toSetting() {
  router.push('/setting');
}
</script>

<style lang="scss" scoped>
.layout {
  :deep(.content) {
    .main {
      overflow: hidden;
    }
  }
}

.setting {
  z-index: 9999;
  position: fixed;
  width: 24px;
  height: 24px;
  padding: 12px;
  top: 0;
  right: 0;

  .setting-icon {
    position: fixed;
    width: 24px;
    height: 24px;
    padding: 12px;
    top: 0;
    right: 0;
    cursor: pointer;
    visibility: hidden;
  }

  &:hover {
    box-shadow: 0px 0px 15px #818181;
    border-radius: 50%;

    .setting-icon {
      visibility: visible;
    }
  }
}

.home-btns {
  width: 100%;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 18px;

  .el-button {
    width: 100%;
  }

  .el-button+.el-button {
    margin-left: 0px;
  }
}
</style>