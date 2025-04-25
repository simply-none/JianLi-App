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
            <!-- 如果是length -->
            <el-tooltip effect="dark" placement="top" v-if="cssProperties[key].type == 'length'">
              <template #content>
                <span>单位：['px', 'em','rem', '%', 'vw', 'vh', 'vmin', 'vmax', 'ch', 'ex', 'cm','mm', 'in', 'pt', 'pc',
                  'px']</span>
              </template>
              <span style="color: red;">*</span>
            </el-tooltip>
            <!-- 如果是time -->
            <el-tooltip effect="dark" placement="top" v-else-if="cssProperties[key].type == 'time'">
              <template #content>
                <span>单位：['s','ms']</span>
              </template>
              <span style="color: red;">*</span>
            </el-tooltip>
            {{ handleLabel(key) }}
          </template>
          <!-- 如果 cssProperties[key].values的长度不为0，则使用el-select -->
          <el-select v-if="vifFn(key)" v-model="data[key]" placeholder="请选择">
            <el-option v-for="(item, index) in cssProperties[key].values" :key="index" :label="item" :value="item" />
          </el-select>
          <!-- 如果 cssProperties[key].values的长度为0，则通过 cssProperties[key].type 判断类型-->
          <!-- 如果type类型为color，则使用 -->
          <el-color-picker v-else-if="cssProperties[key].type == 'color'" v-model="data[key]" show-alpha />
          <!-- 如果type类型为number，则使用 -->
          <el-input v-else-if="cssProperties[key].type == 'number'" v-model="data[key]" placeholder="请输入" />
          <!-- 如果type类型为length，则表示可以使用数值+单位 复合值的形式，单位有px,em,rem,%等，使用输入框和选择框 -->
          <template v-else-if="cssProperties[key].type == 'length'">
            <el-input v-model="data[key]" placeholder="请输入" />
          </template>
          <!-- 如果type类型为time，则使用 数值 加 时间单位的形式 -->
          <template v-else-if="cssProperties[key].type == 'time'">
            <!-- 不进行单位录入了，改成提示 -->
            <el-tooltip effect="dark" placement="top">
              <template #content>
                <span>单位：['s','ms']</span>
              </template>
              <span style="color: red;">*</span>
            </el-tooltip>
            <el-input v-model="data[key]" placeholder="请输入" />
          </template>
          <!-- 否则使用输入框 -->
          <el-input v-else v-model="data[key]" placeholder="请输入" />
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

function open(widgetData, widgetName, elName0) {
  drawer.value = true;
  name.value = widgetName;
  elName.value = elName0;
  const commonData = filterCssProperties(widgetData);
  data.value = JSON.parse(JSON.stringify(commonData || {}));
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