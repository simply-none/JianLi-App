<template>
  <el-drawer v-model="drawer" :direction="direction" size="60%" :append-to-body="false" modal-class="style-drawer">
    <template #header>
      <h4>
        <span>小组件{{ name }} - 元素{{ elName }} 样式</span>
        <el-switch v-model="showEditor" class="ml-2" inline-prompt
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949" active-text="JSON编辑"
          inactive-text="输入框" />
      </h4>
    </template>
    <template #default>
      <jsonEditor v-if="showEditor" :value="data" @update="onJsonChange"></jsonEditor>
      <!-- 换成表单 -->
      <el-form v-else :model="data" label-width="180px">
        <el-form-item :prop="key" v-for="(value, key, index) in data" :key="key">
          <!-- label -->
          <template #label>
            {{ handleLabel(key) }}
          </template>
          <el-input  v-model="data[key]" disabled />
          <uploadVue :limit="1" :autoSave="true" @getFilePath="path => getFilePath(path, key)"></uploadVue>
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <div style="flex: auto">
        <el-button @click="cancelClick">取消</el-button>
        <el-button type="primary" @click="confirmClick">确定</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import uploadVue from '@/components/upload.vue'
import jsonEditor from '@/components/jsonEditor.vue'
import { ref } from 'vue'
import { cssProperties } from '@/utils/css'

const emit = defineEmits(['update'])

const showEditor = ref(true)
const drawer = ref(false)
const direction = ref('rtl')
const name = ref('')
const elName = ref('')
const data = ref({})

function cancelClick() {
  drawer.value = false
}

function confirmClick() {
  drawer.value = false
  emit('update', { el: elName.value, data: data.value }, name.value)
}

function handleLabel(key) {
  // console.log((cssProperties[key] || {}).zh + '(' + key + ')', '测试')
  return (cssProperties[key] || {}).zh + '(' + key + ')'
}

function vifFn(key) {
  // console.log(key, cssProperties[key], '测试222')
  return (cssProperties[key].values).length != 0
}

// 从widgetData（一个对象，键为css属性）中过滤出commonCssProperties（一个数组，包含css属性）中的属性
function filterCssProperties(widgetData) {
  return Object.keys(cssProperties).reduce((acc, key) => {
    if (widgetData[key]) {
      acc[key] = widgetData[key];
    }
    return acc;
  }, {})
}

function onJsonChange(value) {
  if (JSON.stringify(value) === JSON.stringify(data.value)) { return }
  data.value = value;
}

function getFilePath (path, key) {
  console.log(path, key, '测试')
  // path 反斜杠转换为正斜杠
  path = path.replace(/\\/g, '/');
  data.value[key] = path;
}

function open(widgetData, widgetName, elName0) {
  drawer.value = true;
  name.value = widgetName;
  elName.value = elName0;
  data.value = JSON.parse(JSON.stringify(widgetData || {}));
}

defineExpose({ open })
</script>

<style lang="scss">
.style-drawer {
  *::-webkit-scrollbar {
    width: 13px;
    height: 1px;
    display: block;
  }

  .el-drawer__header {
    margin-bottom: 0;

    h4 {
      margin: 0;
      color: #000;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .el-form-item__label {
    line-height: 1;
    word-wrap: break-word;
    word-break: break-word;
    justify-content: flex-start;
  }
}
</style>