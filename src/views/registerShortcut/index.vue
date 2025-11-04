<template>
  <el-form class="fileRela-form" label-width="120" label-position="left">

    <el-form-item>
      <template #label>
        <div class="setting-title">快捷键注册</div>
      </template>
    </el-form-item>

    <el-form-item v-for="(item, index) in allShortcuts" :key="item.key" :label="item.name" class="mode-wrapper">
      <!-- 快捷键注册 -->
      <shortcut :shortcut="item.shortcut"></shortcut>
      <!-- 注册按钮 -->
      <el-button class="register-btn" type="primary" @click="registerCommonFn(item)">注册</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import moment from 'moment';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import shortcut from './shortcut.vue';
import { mergeShortcuts } from '@/utils';

const route = useRoute();

const tableName = ref('register_shortcut')

// route变更
watch(() => route.path, (newPath) => {
  // 判断是否是当前页面
  if (newPath === '/registerShortcut') {
    console.log('当前路由变化:', newPath);

    // 刷新数据
    getShortcut();
  }

}, { immediate: true });

const registerShortcut = (shortcut) => {
  console.log(shortcut);
  const curTime = moment().format('YYYY-MM-DD HH:mm:ss')
  window.ipcRenderer.handlePromise('set-data', {
    tableName: tableName.value,
    data: {
      ...shortcut,
      createTime: curTime,
      mode: import.meta.env.MODE,
    },
    config: {
      primaryKey: 'key',
    }
  }).then(result => {
    if (result.success) {
      console.log('设置成功:', result.data);
      window.ipcRenderer.send('register-shortcut', shortcut)
    } else {
      console.log('设置失败:', result.error);
    }
  })
}

const originShortcuts = ref([
  {
    type: 'show_app',
    url: '',
    name: '显示应用',
    key: 'showAppShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'home',
    name: '打开首屏',
    key: 'homeShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'notebook',
    name: '打开记事本',
    key: 'notebookShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'pomodoroRecord',
    name: '打开番茄钟记录',
    key: 'pomodoroRecordShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'clipboard',
    name: '打开剪贴板',
    key: 'clipboardShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'netRequest',
    name: '打开网络请求',
    key: 'netRequestShortcut',
    shortcut: ['', '', ''],
  },
  {
    type: 'open_match_page',
    url: 'systemInfo',
    name: '打开系统信息',
    key: 'systemInfoShortcut',
    shortcut: ['', '', ''],
  },
])

// 获取所有的快捷键
const allShortcuts = ref([])

const registerCommonFn = (item) => {
  // 判断item.shortcut是否是至少两个元素不为空字符串的数组，如果不是，则不执行注册操作
  const isMust = item.shortcut.filter(item => item !== '').length >= 2
  if (!isMust) {
    ElMessage.error('请选择至少两个快捷键')
    return
  }
  const cur = allShortcuts.value.find(c => c.key === item.key)
  if (!cur) {
    return
  }
  registerShortcut({
    ...cur,
    shortcut: item.shortcut.join('+'),
  });
}

// 获取数据
function getShortcut() {
  window.ipcRenderer.handlePromise('query-data', {
    tableName: tableName.value,
    conditions: {
    }
  }).then(result => {
    console.log('查询结果:', result);
    if (result.success) {
      const r = mergeShortcuts(originShortcuts.value, result.data)
      // shortcut通过+分割为数组，长度小于3，补全空字符串
      allShortcuts.value = r.map(item => {
        // 如果是数组，直接返回
        if (Array.isArray(item.shortcut)) {
          return item
        }
        item.shortcut = item.shortcut.split('+')
        while (item.shortcut.length < 3) {
          item.shortcut.push('')
        }
        return item
      })
      console.log(allShortcuts.value)
    } else {
      console.log('查询失败:', result.error);
    }
  })
}


</script>

<style scoped lang="scss">
.fileRela-form {
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

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

.setting-handle {
  width: 100%;
  text-align: right;
}

.register-btn {
  margin-left: 12px;
}
</style>
