<template>
  <layout-vue>
    <template #main>
      <component :is="curComponent" />
      <div class="setting">
        <el-image :src="SettingSvg" @click="toSetting" @mouseover="openHomeBtnsFn"></el-image>
      </div>
      <div class="home-btns" v-if="isHiddenHomeBtns">
        <el-button type="primary" v-if="curStatusC.value != 'screen'" @click="startLockedFn">
          开启锁屏状态
        </el-button>
        <el-button v-if="curStatusC.value == 'screen'" @click="closeLockedFn">
          开始工作
        </el-button>
        <el-button @click="closeHomeBtnsFn">隐藏操作按钮</el-button>
      </div>
    </template>
  </layout-vue>

</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';

import ShowImage from '@/views/home/showImage.vue';
import TranslucentPoemDisplay from '@/views/home/translucentPoemDisplay.vue';
import ImitationWindowsUpdate from '@/views/home/imitationWindowsUpdate.vue';
import LayoutVue from '@/components/layout.vue';
import SettingSvg from '@/assets/set.svg'
import useGlobalSetting from '@/store/useGlobalSetting';
import useSafetyProtection from '@/store/useSafetyProtection';
import { useWorkOrRest } from '@/hooks/useWorkOrReset';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const isHiddenHomeBtns = ref(false)
const { homeModeC, curStatusC } = storeToRefs(useGlobalSetting());
const { startScreenSaverFn, closeScreenSaverFn } = useWorkOrRest();
const { isPwdSame } = useSafetyProtection();
const curComponent = ref(TranslucentPoemDisplay)

watch(() => homeModeC.value[curStatusC.value.value], (n, o) => {
  console.log(n, o, 'homeModeC')
  switch (n.value) {
    case '0':
      curComponent.value = TranslucentPoemDisplay
      break;
    case '1':
      curComponent.value = ImitationWindowsUpdate
      break;
    case '2':
      curComponent.value = ShowImage
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
.setting .el-image {
  position: fixed;
  width: 24px;
  height: 24px;
  padding: 12px;
  top: 0;
  right: 0;
  cursor: pointer;

  &:hover {
    box-shadow: 0px 0px 15px #818181;
    border-radius: 50%;
  }
}

.home-btns {
  position: fixed;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
}
</style>