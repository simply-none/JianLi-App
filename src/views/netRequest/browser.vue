<template>
  <el-form-item>
    <template #label>
      <div class="setting-title">浏览器请求</div>
    </template>
  </el-form-item>

  <el-form-item label="公有参数" class="mode-wrapper">
    <!-- 是否打开浏览器: 使用el-switch -->
    <el-form-item label="是否打开浏览器" class="mode-wrapper">
      <el-switch v-model="commonParams.headless" active-value="true" inactive-value="false" active-text="打开" inactive-text="关闭" />
    </el-form-item>
    <!-- 操作延迟 -->
    <el-form-item label="操作延迟" class="mode-wrapper">
      <el-input v-model="commonParams.slowMo" type="number" placeholder="请输入操作延迟（毫秒）" />
    </el-form-item>
    <!-- 超时时间 -->
    <el-form-item label="超时时间" class="mode-wrapper">
      <el-input v-model="commonParams.timeout" type="number" placeholder="请输入超时时间（毫秒）" />
    </el-form-item>
    <!-- 浏览器执行路径 -->
    <el-form-item label="浏览器执行路径" class="mode-wrapper">
      <el-input spellcheck="false" v-model="commonParams.executablePath" placeholder="请选择" style="width: 100%" disabled :title="commonParams.executablePath">
        <template #append>
          <el-button @click="selectExecutablePath">
            选择路径
          </el-button>
        </template>
      </el-input>
    </el-form-item>
  </el-form-item>
  <el-form-item label="步骤选择器" class="mode-wrapper">
    <stepSelector></stepSelector>
  </el-form-item>
  <el-form-item label="返回结果" class="mode-wrapper">
    <el-tabs v-model="activeName" class="result-tabs">
      <el-tab-pane label="原始数据" name="original">
        <el-input spellcheck="false" type='textarea' :rows='20' v-model="result" />
      </el-tab-pane>
      <el-tab-pane label="格式化数据" name="formatted">
        <div v-html="result"></div>
      </el-tab-pane>
    </el-tabs>
  </el-form-item>
  <el-form-item class="mode-wrapper">
    <el-button @click="sendRequestNightmare">发送</el-button>
  </el-form-item>
</template>

<script setup lang="ts">
import stepSelector from './stepSelector.vue';
import columns from './columns.vue';
import { h, ref, reactive, watch, computed, toRaw, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { send, sendSync } from '@/utils/common';

// ------接口测试 start------
const url = ref('');
const method = ref('get');
const header = ref<ObjectType>([{ key: '', value: '' }]);
const params = ref<ObjectType>([{ key: '', value: '' }]);
const body = ref('');
const result = ref('');
const tabActiveName = ref('params');
const activeName = ref('original');

const commonParams = ref<ObjectType>({
  headless: 'false',
  slowMo: 50,
  timeout: 300000,
  executablePath: '',
});

function selectExecutablePath() {
  const res = sendSync('get-file-list', {
    openDirectory: false,
    openFile: true,
    type: "executable",
  });
  console.log(res);
  if (Array.isArray(res)) {
    commonParams.value.executablePath = res[0];
  }
}

function sendRequest() {
  if (!url.value) {
    return ElMessage.warning('请输入接口路径');
  }
  // const headerStr = JSON.stringify(header.value);
  const myHeader = header.value.reduce((prev: ObjectType, cur: ObjectType) => {
    prev[cur.key] = cur.value;
    return prev;
  }, {});
  const myParams = params.value.reduce((prev: ObjectType, cur: ObjectType) => {
    prev[cur.key] = cur.value;
    return prev;
  }, {});
  console.log(toRaw(myHeader), 'header')
  console.log(toRaw(myParams), 'params')
  window.ipcRenderer.send("api-test", {
    url: url.value,
    method: method.value,
    header: myHeader,
    params: myParams,
    body: body.value,
  })
}

function sendRequestNightmare() {
  window.ipcRenderer.send("spider-test", {
  })
}

window.ipcRenderer.on("api-test", (event, arg) => {
  console.warn(arg, 't');
  result.value = JSON.stringify(arg, null, 2);
});

window.ipcRenderer.on("spider-test", (event, arg) => {
  console.warn(arg, 't spider-test');
  result.value = arg.mainContent;
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
