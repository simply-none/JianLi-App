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
      <el-form v-else :model="data" label-width="120px">
        <!-- 背景优先级 字段 -->
        <el-form-item prop="backgroundPriority">
          <template #label>
            背景优先级
          </template>
          <el-radio-group v-model="data.backgroundPriority">
            <el-radio label="1">背景色优先</el-radio>
            <el-radio label="2">背景图优先</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item prop="backgroundColor">
          <template #label>
            背景色
          </template>
          <el-input v-model="data.backgroundColor" disabled />
          <el-color-picker v-model="data.backgroundColor" :show-alpha="true" size="small" :predefine="['#ffffff']"></el-color-picker>
        </el-form-item>

        <el-form-item prop="backgroundImage">
          <template #label>
            背景
          </template>
          <el-input v-model="data.backgroundImage" disabled />
          <uploadVue :limit="1" :autoSave="true" @getFilePath="path => getFilePath(path, 'backgroundImage')">
          </uploadVue>
        </el-form-item>
        <el-form-item prop="smallComps">
          <template #label>
            小组件
          </template>
          <el-checkbox-group class="smallComps-list" v-model="data.smallComps" size="small">
            <el-checkbox v-for="(comps, key, index) in smallComponentsCc" :label="comps.label" :value="comps" border />
          </el-checkbox-group>
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
import useSmallComponentsOps from '@/store/useSmallComponentsOps'
import { computed, ref, toRaw, unref } from 'vue'
import { storeToRefs } from 'pinia'

const emit = defineEmits(['update'])

const useSmallComponentsOpsStore = useSmallComponentsOps()
const { smallComponentsC } = storeToRefs(useSmallComponentsOpsStore);

const smallComponentsCc = computed(() => {
  console.log(smallComponentsC.value, 'smallComponentsC')
  return Object.fromEntries(
    Object.entries(smallComponentsC.value).map(([key, value]) => [key, { name: value.name, label: value.label }])
  );
})

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
  // 解决嵌套proxy的问题，直接使用json格式化
  emit('update', { el: elName.value, data: JSON.parse(JSON.stringify(data.value)) }, name.value)
}

function onJsonChange(value) {
  if (JSON.stringify(value) === JSON.stringify(data.value)) { return }
  data.value = value;
}

function getFilePath(path, key) {
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
    align-items: center;
  }
}
</style>