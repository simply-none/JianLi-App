<template>
  <el-form :model="formSelf" :rules="rules" size="small" ref="formRef" label-width="64px" label-position="left">
    <el-form-item label="操作名称" field="id">
      <el-input v-model="formSelf.id" allow-clear />
    </el-form-item>

    <!-- other props -->
    <el-form-item v-for="(value, key, index) in otherProps" :field="key" :label="key">
      <el-input v-model="formSelf[key]" allow-clear />
    </el-form-item>
    <!-- 选择操作类型 -->
    <el-form-item label="操作类型" field="handleType">
      <el-select v-model="formSelf.handleType" :options="selectType" allow-clear />
    </el-form-item>

    <!-- 如果是页面导航，需要导航url-->
    <template v-if="formSelf.handleType === 'goto'">
      <el-form-item label="导航URL" field="url">
        <el-input v-model="formSelf.url" allow-clear />
      </el-form-item>
    </template>

    <!-- 如果是选取元素，需要选择器 -->
    <template v-if="formSelf.handleType === 'locator'">
      <el-form-item label="选择器" field="selector">
        <el-input v-model="formSelf.selector" allow-clear />
      </el-form-item>
      <!-- 元素进行的步骤 -->
      <el-form-item label="元素步骤" field="elementSteps">
        <!-- 加步骤 -->
        <div class='steps-wrap'>
          <div>
            <el-button @click="addElementStep">添加步骤</el-button>
          </div>
          <div class="steps" v-if="formSelf.elementSteps">
            <div class="step" v-for="(item, index) in formSelf.elementSteps">
              <el-form-item :label="`步骤${index + 1}`">
                <!-- 选取 -->
                <el-select v-model="formSelf.elementSteps[index].action" :options="elementStepOptions" allow-clear />
                <!-- 操作值 -->
                <el-input v-model="formSelf.elementSteps[index].value" allow-clear />
                <div>
                  <el-button @click="removeElementStep(index)">删除</el-button>
                </div>
              </el-form-item>
            </div>
          </div>
        </div>
      </el-form-item>
    </template>

    <!-- 如果是等待，需要等待时间 -->
    <template v-if="formSelf.handleType === 'wait'">
      <el-form-item label="等待时间" field="waitTime">
        <el-input v-model="formSelf.waitTime" allow-clear />
      </el-form-item>
    </template>

    <!-- 如果是执行脚本，需要脚本内容 -->
    <template v-if="formSelf.handleType === 'evaluate'">
      <el-form-item label="脚本内容" field="script">
        <el-input v-model="formSelf.script" allow-clear />
      </el-form-item>
    </template>

    <!-- 如果是获取数据，需要数据的key -->
    <template v-if="formSelf.handleType === 'getData'">
      <el-form-item label="数据key" field="dataKey">
        <el-input v-model="formSelf.dataKey" allow-clear />
      </el-form-item>
    </template>
  </el-form>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";

import { useVueFlow } from "@vue-flow/core";
import type { GraphNode } from "@vue-flow/core";
import { selectType, elementStepOptions } from "./preset";

const { updateNode, removeNodes, findNode, getNodes } = useVueFlow();

const props = defineProps({
  formData: {
    type: Object as () => formSelf,
    default: () => ({
      id: '',
      handleType: 'goto',
      url: '',
      selector: '',
      elementSteps: [{
        selector: '',
        action: '',
        value: '',
      }],
      waitTime: '',
      script: '',
      dataKey: ''
    })
  }
})

//  都是可选的操作类型
interface formSelf {
  id?: string,
  handleType?: string,
  url?: string,
  selector?: string,
  elementSteps?: {
    selector: string,
    action: string,
    value?: string,
  }[],
  waitTime?: string,
  script?: string,
  dataKey?: string,
}

const formSelf = ref<formSelf>({
  id: '',
  handleType: 'goto',
  url: '',
  selector: '',
  elementSteps: [{
    selector: '',
    action: '',
    value: '',
  }],
  waitTime: '',
  script: '',
  dataKey: ''
})

watch(() => props.formData, (newVal) => {
  console.log(newVal)
  if (newVal) {
    formSelf.value = JSON.parse(JSON.stringify(newVal))
  }
}, {
  deep: true,
  immediate: true,
})

// 获取formDate不在上述列出的属性
const otherProps = computed(() => {
  const { id, handleType, url, selector, elementSteps, waitTime, script, dataKey, ...rest } = formSelf.value
  return rest
})

const rules = ref({
  id: [{ required: true, message: '请输入操作名称', trigger: ['blur'] }],
  handleType: [{ required: true, message: '请选择操作类型', trigger: ['blur'] }],
  url: [{ required: true, message: '请输入导航URL', trigger: ['blur'] }],
  selector: [{ required: true, message: '请输入选择器', trigger: ['blur'] }],
  elementSteps: [{ required: true, message: '请添加元素步骤', trigger: ['blur'] }],
  waitTime: [{ required: true, message: '请输入等待时间', trigger: ['blur'] }],
  script: [{ required: true, message: '请输入脚本内容', trigger: ['blur'] }],
  dataKey: [{ required: true, message: '请输入数据key', trigger: ['blur'] }],
  elementStep: [{ required: true, message: '请选择元素步骤', trigger: ['blur'] }],
})

const formRef = ref()



// 添加元素步骤
function addElementStep() {
  if (!formSelf.value.elementSteps) {
    formSelf.value.elementSteps = [];
  }
  formSelf.value.elementSteps.push({
    selector: '',
    action: 'click',
  })
}

// 删除元素步骤
function removeElementStep(index: number) {
  if (formSelf.value.elementSteps && formSelf.value.elementSteps.length > 0) {
    formSelf.value.elementSteps.splice(index, 1);
  }
}



defineExpose({
  formSelf,
  formRef,
})
</script>

<style scoped lang="scss">
.panel-wrapper {
  padding: 12px;
  width: 300px;
  height: 100%;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-header {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  color: #2d3748;
  border-bottom: 6px solid #6d6d6d;
}

.panel-body {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}

.panel-handle {
  width: 100%;
  text-align: right;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>