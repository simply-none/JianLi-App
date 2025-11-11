<template>
  <!-- 选择步骤 -->
  <el-form-item v-if="stepSelectorList.length > 0" label="流程名称" class="mode-wrapper">
    <el-select v-model="currentFlow" placeholder="请选择步骤" value-key="id" @change="currentFlowChange">
      <el-option v-for="item in stepSelectorList"  :key="item.id" :label="item.name" :value="item" />
    </el-select>
  </el-form-item>
  <div @click="toFlowManage" v-else>
    请到流程管理中添加流程步骤，再进行测试。
  </div>
  <el-form-item label="步骤" class="mode-wrapper" v-for="(value, index) in nodes">
    <template #label>
      {{ '步骤' + (index + 1) + ': ' }}
    </template>
    <el-tooltip effect="light">
      <template #content>
        <div style="width: 200px;" v-for="(item, key, index) in value" :key="index">{{key}}: {{ item }}</div>
      </template>
      {{ (value.data ? value.data.id : '') }}
    </el-tooltip>
  </el-form-item>
</template>

<script setup lang="ts">
import { h, ref, reactive, watch, computed, toRaw, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { send, sendSync } from '@/utils/common';
import { TreeLinkedListSorter } from "@/utils/treeTrans"
import { useRouter } from 'vue-router';

const router = useRouter();

// ------接口测试 start------
const url = ref('');
const method = ref('get');
const header = ref<ObjectType>([{ key: '', value: '' }]);
const params = ref<ObjectType>([{ key: '', value: '' }]);
const body = ref('');
const result = ref('');
const currentFlow = ref();
const nodes = ref<ObjectType[]>([]);

// 步骤选择器列表
const stepSelectorList = ref<ObjectType>([]);

const commonParams = ref<ObjectType>({
  headless: 'false',
  slowMo: 50,
  timeout: 300000,
  executablePath: '',
});

function currentFlowChange(val: ObjectType) {
  console.log(val, 'val')
  if (val && val.data) {
    let n = (JSON.parse(val.data) || {}).nodes || [];
    n = TreeLinkedListSorter.sortByHierarchy(n, 'data', null);
    nodes.value = n.map((item: ObjectType) => {
      return item.data
    })

    console.log(nodes, 'nodes')
  }
}

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

function toFlowManage() {
  router.push({ name: 'flow' })
}


window.ipcRenderer.handlePromise('query-data', {
  tableName: 'flow',
  conditions: {
    orderBy: 'id',
    orderByDesc: true
  }
}).then(result => {
  if (result.success) {
    console.log(result.data, 'result.data')
    if (Array.isArray(result.data) && result.data.length > 0) {
      stepSelectorList.value = result.data
    }
    // fromObject(JSON.parse(result.data.data))
  } else {
    console.log('查询失败')
  }
})

defineExpose({
  currentFlow,
  nodes,
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
