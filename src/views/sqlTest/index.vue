<template>
  <el-form class="pomodoro-record" label-width="120" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">数据库测试</div>
      </template>
    </el-form-item>

    <el-form-item label="按钮" class="mode-wrapper">
      <el-button @click="setSqlData">设置数据</el-button>
      <el-button @click="getSqlData">查询数据</el-button>
      <!-- 删除 -->
      <el-button @click="deleteSqlData">删除数据</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { h, ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { send, sendSync, getStore, setStore } from '@/utils/common';
import moment from 'moment';

const curDate = ref(moment().format('YYYY-MM-DD'))

const setSqlData = () => {
  const curTime = moment().format('YYYY-MM-DD HH:mm:ss')

  window.ipcRenderer.handlePromise('set-data', {
    tableName: 'user_info',
    data: {
      // key: Math.random().toString(36).substring(2),
      value: curTime,
      ['d' + Date.now()]: curTime,
      mode: import.meta.env.MODE,
    }
  }).then(result => {
    if (result.success) {
      console.log('设置成功:', result.data);
    } else {
    console.log('设置失败:', result.error);
    }
  })
}

const getSqlData = () => {
  window.ipcRenderer.handlePromise('query-data', {
    tableName: 'user_info',
    conditions: {
      mode: 'development',
    }
  }).then(result => {
    if (result.success) {
      console.log('查询结果:', result.data);
    }
  }).catch(err => {
    console.log('查询失败:', err);
  })
}

const deleteSqlData = () => {
  window.ipcRenderer.handlePromise('delete-data', {
    tableName: 'user_info',
    condition: {
      key: 'test',
    }
  }).then(result => {
    if (result.success) {
      console.log('删除成功:', result.data);
    } else {
    console.log('删除失败:', result.error);
    }
  })
}

onMounted(() => {
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
