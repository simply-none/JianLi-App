<template>
  <el-form-item>
    <template #label>
      <div class="setting-title">浏览器请求</div>
    </template>
  </el-form-item>

  <el-form-item label="公有参数" class="mode-wrapper">
    <!-- 是否打开浏览器: 使用el-switch -->
    <el-form-item label="是否打开浏览器" class="mode-wrapper">
      <el-switch v-model="commonParams.headless" :active-value="false" :inactive-value="true" active-text="打开" inactive-text="关闭" />
    </el-form-item>
    <!-- 操作延迟 -->
    <el-form-item label="操作延迟" class="mode-wrapper">
      <el-input v-model="commonParams.slowMo" type="number" placeholder="请输入操作延迟（毫秒）" />
    </el-form-item>
    <!-- 超时时间 -->
    <el-form-item label="超时时间" class="mode-wrapper">
      <el-input v-model="commonParams.timeout" type="number" placeholder="请输入超时时间（毫秒）" />
    </el-form-item>
    <!-- 使用当前打开的浏览器还是自定义浏览器 -->
    <el-form-item label="浏览器类型" class="mode-wrapper">
      <el-switch v-model="commonParams.useCurrentBrowser" :active-value="true" :inactive-value="false" active-text="使用当前打开的浏览器" inactive-text="使用自定义浏览器" />
    </el-form-item>
    <!-- 调试url，使用当前打开的浏览器 -->
     <el-form-item v-if="commonParams.useCurrentBrowser" label="浏览器ws地址" class="mode-wrapper">
      <el-input v-model="commonParams.browserURL" placeholder="请输入当前打开的浏览器ws地址" />
    </el-form-item>

    <!-- 浏览器执行路径 -->
    <el-form-item v-if="!commonParams.useCurrentBrowser" label="浏览器执行路径" class="mode-wrapper">
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
    <stepSelector ref="stepSelectorRef"></stepSelector>
  </el-form-item>
  <el-form-item label="返回结果" class="mode-wrapper">
    <el-tabs v-model="activeName" class="result-tabs">
      <el-tab-pane label="原始数据" name="original">
        <el-input spellcheck="false" type='textarea' :rows='20' v-model="result" />
      </el-tab-pane>
      <el-tab-pane label="格式化数据" name="formatted">
        <div v-if="resultType == 'String'" v-html="result"></div>
        <div v-else-if="resultType == 'Array'">
          <div v-for="(item, index) in (result)" :key="index">
            {{ index + 1 }}: {{ item }}
          </div>
        </div>
        <div v-else-if="resultType == 'Object'">
          <div v-for="(item, key) in (result)" :key="key">
            {{ key }}: {{ item }}
          </div>
        </div>
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
const stepSelectorRef = ref();

function getType (value: string) {
  // 使用Object.prototype.toString.call(value).slice(8, -1)来判断类型
  return Object.prototype.toString.call(value).slice(8, -1);
}

const resultType = computed(() => {
  return getType(result.value);
});
// ------接口测试 end------

const commonParams = ref<ObjectType>({
  headless: false,
  slowMo: 50,
  timeout: 300000,
  useCurrentBrowser: true,
  executablePath: '',
  // 调试url，使用当前打开的浏览器
  browserURL: 'http://127.0.0.1:10853',
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
  let nodes = toRaw(stepSelectorRef.value.nodes)
  if (!stepSelectorRef.value.currentFlow || (Array.isArray(nodes) && nodes.length == 0)) {
    return ElMessage.warning('请选择步骤');
  }
  console.log(nodes, 'nodes')
  window.ipcRenderer.send('set-store', 'browser:req-steps',
    {
      steps: nodes,
      commonParams: toRaw(commonParams.value),
    }
  )
  window.ipcRenderer.send("spider-test", {
    steps: nodes,
    commonParams: toRaw(commonParams.value),
  })
}

window.ipcRenderer.on("spider-test:getData", (event, arg) => {
  console.warn(arg, 't');
  result.value = arg.mainContent;
});

window.ipcRenderer.on("spider-test:request", (event, arg) => {
  console.warn(arg, 't spider-test:request');
});

window.ipcRenderer.on("spider-test:response", (event, arg) => {
  console.warn(arg, 't spider-test:response');
});

window.ipcRenderer.on("spider-test", (event, arg) => {
  console.warn(arg, 't spider-test');
  result.value = arg.mainContent;
});

onMounted(() => {
  let res = window.ipcRenderer.sendSync('get-store', 'browser:req-steps')
  console.log(res, 'res')
  if (res && res.commonParams) {
    commonParams.value = res.commonParams;
  }
})
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
