<template>
  <el-form-item>
    <template #label>
      <div class="setting-title">系统信息</div>
    </template>
  </el-form-item>

  <el-form-item label="实时信息" class="mode-wrapper">
    <system-info-form :data="result.data"></system-info-form>
  </el-form-item>

  <el-form-item label="系统信息" class="mode-wrapper">
    <system-info-form :data="systemStaticData.data"></system-info-form>
  </el-form-item>

  <el-form-item label="测试" class="mode-wrapper">
    <el-button @click="sendRequest" v-if="!isMonitoring">开始监控</el-button>
    <el-button @click="stopRequest" v-if="isMonitoring">停止监控</el-button>
  </el-form-item>

</template>

<script setup lang="ts">
import systemInfoForm from './form.vue';
import { h, ref, reactive, watch, computed, toRaw, onMounted, onUnmounted, nextTick } from 'vue';

const result: ObjectType = ref({
  type: '',
  data: {},
  time: '',
});
const systemStaticData: ObjectType = ref({
  type: '',
  data: {},
});
// 是否正在监控
const isMonitoring = ref(false);
let count = ref(0);

function sendRequest() {
  console.log('开始监控系统信息...')
  isMonitoring.value = true;
  window.ipcRenderer.send("system-info", {
    type: 'start'
  })
}

function stopRequest() {
  isMonitoring.value = false;
  window.ipcRenderer.send("system-info", {
    type: 'stop'
  })
}

function getStaticData() {
  window.ipcRenderer.send("system-info-static", {
    type: 'static'
  })
}

function listenerFn(event: Electron.IpcRendererEvent, arg: ObjectType) {
  console.warn(count.value++, arg, 'system-info');
  if (arg.type === 'static') {
    systemStaticData.value = arg;
    console.log('静态数据', systemStaticData.value);
    return;
  }
  result.value = arg;
}

onMounted(() => {
  sendRequest();
  getStaticData();
  // 接收数据
  window.ipcRenderer.on("system-info", listenerFn);
  window.ipcRenderer.on("system-info-static", listenerFn);
});

onUnmounted(() => {
  // 移除所有的事件监听，而不是调用stopRequest
  stopRequest();
  console.log('移除事件监听', count.value);
  setTimeout(() => {
    window.ipcRenderer.removeAllListeners("system-info");
    window.ipcRenderer.removeAllListeners("system-info-static");
    console.log('移除事件监听完成', count.value);
  }, 10)
});

</script>

<style scoped lang="scss">
.pomodoro-record {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.result-tabs {
  width: 100%;
  min-height: 420px;
  max-height: 500px;

  :deep(.el-tabs__content) {
    overflow: auto;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

// 主页模式
:deep(.el-table .table-work) {
  --el-table-tr-bg-color: #f0f9eb;

}

:deep(.el-table .table-rest) {
  --el-table-tr-bg-color: #fff5f5;
}

:deep(.el-table .table-screen) {
  --el-table-tr-bg-color: #e6fffb;
}
</style>
