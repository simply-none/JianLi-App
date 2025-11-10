<template>
  <div class="panel-wrapper">
    <div class="panel-header">
      流程编辑面板
    </div>

    <div class="panel-body">
      <el-form :model="formData" :rules="rules" size="small" ref="formRef" label-width="64px" label-position="left">
        <el-form-item label="操作名称" field="id">
          <el-input v-model="formData.id" allow-clear />
        </el-form-item>

        <!-- other props -->
        <el-form-item v-for="(value, key, index) in otherProps" :field="key" :label="key">
          <el-input v-model="formData[key]" allow-clear />
        </el-form-item>
        <!-- 选择操作类型 -->
        <el-form-item label="操作类型" field="handleType">
          <el-select v-model="formData.handleType" :options="selectType" allow-clear />
        </el-form-item>

        <!-- 如果是页面导航，需要导航url-->
        <template v-if="formData.handleType === 'goto'">
          <el-form-item label="导航URL" field="url">
            <el-input v-model="formData.url" allow-clear />
          </el-form-item>
        </template>

        <!-- 如果是选取元素，需要选择器 -->
        <template v-if="formData.handleType === 'locator'">
          <el-form-item label="选择器" field="selector">
            <el-input v-model="formData.selector" allow-clear />
          </el-form-item>
          <!-- 元素进行的步骤 -->
          <el-form-item label="元素步骤" field="elementSteps">
            <!-- 加步骤 -->
            <div class='steps-wrap'>
              <div>
                <el-button @click="addElementStep">添加步骤</el-button>
              </div>
              <div class="steps" v-if="formData.elementSteps">
                <div class="step" v-for="(item, index) in formData.elementSteps">
                  <el-form-item :label="`步骤${index + 1}`">
                    <!-- 选取 -->
                    <el-select v-model="formData.elementSteps[index].action" :options="elementStepOptions" allow-clear />
                    <!-- 操作值 -->
                    <el-input v-model="formData.elementSteps[index].value" allow-clear />
                  </el-form-item>
                </div>
              </div>
            </div>


          </el-form-item>
        </template>

        <!-- 如果是等待，需要等待时间 -->
        <template v-if="formData.handleType === 'wait'">
          <el-form-item label="等待时间" field="waitTime">
            <el-input v-model="formData.waitTime" allow-clear />
          </el-form-item>
        </template>

        <!-- 如果是执行脚本，需要脚本内容 -->
        <template v-if="formData.handleType === 'evaluate'">
          <el-form-item label="脚本内容" field="script">
            <el-input v-model="formData.script" allow-clear />
          </el-form-item>
        </template>

        <!-- 如果是获取数据，需要数据的key -->
        <template v-if="formData.handleType === 'getData'">
          <el-form-item label="数据key" field="dataKey">
            <el-input v-model="formData.dataKey" allow-clear />
          </el-form-item>
        </template>
      </el-form>
    </div>

    <div class="panel-handle">
      <el-button type="primary" @click="submitForm">保存</el-button>
    </div>


  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";

import { useVueFlow } from "@vue-flow/core";
import type { GraphNode } from "@vue-flow/core";

const { updateNode } = useVueFlow();

const props = defineProps({
  node: {
    type: Object as () => GraphNode,
    default: () => ({})
  }
})

/**
 * 1. 打开新页面：browser.newPage()
 * 2. 页面导航：page.goto(url)
 * 2. 元素定位：page.locator(selector)
 *    2.1 元素点击：locator.click()
 *    2.2 元素输入：locator.fill(text)
 *    2.3 元素获取文本：locator.textContent()
 *    2.4 元素悬停：locator.hover()
 *    2.5 元素滚动：locator.scroll({ scrollTop: 1000, scrollLeft: 0 })
 *    2.6 等待元素可见：locator.wait()
 *    2.7 元素过滤：locator.filter(callback)
 *    2.8 元素转JS：locator.map(callback).wait()
 *    2.9 返回elementHandle：(await locator.waitHandle()).click()
 *    2.10 元素定位配置：locatorsetEnsureElementIsInTheViewport(true),setVisibility('visible'),setWaitForEnabled(true),setWaitForStableBoundingBox(true)
 *    2.11 元素定位超时：locator.setTimeout(timeout)
 * 3. 等待元素在DOM中可用：page.waitForSelector(selector)
 * 4. 无需等待查询（已知元素存在）：page.$(selector)单个，page.$$(selector)所有，
 * 5. 监听网络请求：page.on('request', request => {}),page.on('response', response => {})
 */

//  都是可选的操作类型
interface formData {
  id?: string,
  handleType?: string,
  url?: string,
  selector?: string,
  elementSteps?: {
    selector: string,
    action: string,
    value?:string,
  }[],
  waitTime?: string,
  script?: string,
  dataKey?: string,
}

const formData = ref<formData>({
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

// 获取formDate不在上述列出的属性
const otherProps = computed(() => {
  const { id, handleType, url, selector, elementSteps, waitTime, script, dataKey, ...rest } = formData.value
  return rest
})

watch(() => props.node, (newVal) => {
  console.log(newVal)
  if (newVal) {
    formData.value = newVal.data
  }
}, {
  deep: true,
  immediate: true,
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

const selectType = ref([
  {
    label: "页面导航",
    value: 'goto',
  },
  // 选取元素
  {
    label: "选取元素",
    value: 'locator',
  },
  // 监听网络请求
  {
    label: "监听网络请求",
    value: 'request',
  },
  {
    label: "监听网络响应",
    value: 'response',
  },
  // 等待
  {
    label: "等待",
    value: 'wait',
  },
  // 执行脚本
  {
    label: "执行脚本",
    value: 'evaluate',
  },
  // 截图
  {
    label: "截图",
    value: 'screenshot',
  },
  // 生成pdf
  {
    label: "生成pdf",
    value: 'generatePdf',
  },
  // 写入数据
  {
    label: "写入数据",
    value: 'writeData',
  },
  // 获取数据
  {
    label: "获取数据",
    value: 'getData',
  },
])

const elementStepOptions = ref([
  {
    label: "点击",
    value: 'click',
  },
  {
    label: "输入",
    value: 'fill',
  },
  {
    label: "获取文本",
    value: 'textContent',
  },
  {
    label: "悬停",
    value: 'hover',
  },
  {
    label: "滚动",
    value: 'scroll',
  },
  {
    label: "等待可见",
    value: 'wait',
  },
  {
    label: "过滤",
    value: 'filter',
  },
  {
    label: "元素转JS",
    value: 'map',
  },
  {
    label: "返回elementHandle",
    value: 'waitHandle',
  },
  {
    label: "元素定位配置",
    value: 'setEnsureElementIsInTheViewport',
  },
  {
    label: "元素定位超时",
    value: 'setTimeout',
  },
])

// 添加元素步骤
function addElementStep() {
  if (!formData.value.elementSteps) {
    formData.value.elementSteps = [];
  }
  formData.value.elementSteps.push({
    selector: '',
    action: 'click',
  })
}

function submitForm() {
  formRef.value.validate((valid: boolean) => {
    if (valid) {
      updateNode(props.node.id, formData.value)
    } else {
      console.log('校验失败')
    }
  })
}

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