<template>
  <el-form class="pomodoro-record" label-width="120" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">网络请求</div>
      </template>
    </el-form-item>

    <el-form-item label="接口路径" class="mode-wrapper">
      <el-input spellcheck="false" v-model="url" />
    </el-form-item>
    <el-form-item label="请求方式" class="mode-wrapper">
      <el-radio-group v-model="method" size="small">
        <el-radio label="get">get</el-radio>
        <el-radio label="post">post</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item label="选项参数" class="mode-wrapper">
      <!-- tabs -->
      <el-tabs v-model="tabActiveName" class="result-tabs">
        <!-- 查询参数 -->
        <el-tab-pane label="查询参数" name="params">
          <columns label="查询参数" @update="val => params = val"/>
        </el-tab-pane>
        <el-tab-pane label="请求头" name="header">
          <columns label="请求头" @update="val => header = val"/>
        </el-tab-pane>
        <el-tab-pane label="请求体" name="body">
          <el-input spellcheck="false" v-model="body" type="textarea" rows="10" />
        </el-tab-pane>
      </el-tabs>
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
    <el-form-item  class="mode-wrapper">
      <el-button @click="sendRequest">发送</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import columns from './columns.vue';
import { h, ref, reactive, watch, computed, toRaw, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';

// ------接口测试 start------
const url = ref('');
const method = ref('get');
const header = ref<ObjectType>([{key: '', value: ''}]);
const params = ref<ObjectType>([{key: '', value: ''}]);
const body = ref('');
const result = ref('');
const tabActiveName = ref('params');
const activeName = ref('original');

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

window.ipcRenderer.on("api-test", (event, arg) => {
  console.warn(arg, 't');
  result.value = JSON.stringify(arg, null, 2);
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
