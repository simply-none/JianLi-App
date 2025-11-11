<template>
  <div class="panel-wrapper">
    <div class="panel-header">
      流程编辑面板
    </div>

    <div class="panel-body">
      <panel-attrs :form-data="formData" ref="panelAttrsRef"></panel-attrs>
    </div>

    <div class="panel-handle">
      <el-button type="primary" @click="submitForm">保存</el-button>
      <el-button type="danger" @click="removeNode">移除</el-button>
    </div>


  </div>
</template>

<script setup lang="ts">
import panelAttrs from "./panelAttrs.vue";
import { onMounted, ref, watch, computed, toRaw } from "vue";

import { useVueFlow } from "@vue-flow/core";
import type { GraphNode } from "@vue-flow/core";

const { updateNode, removeNodes, findNode, getNodes } = useVueFlow();

const props = defineProps({
  node: {
    type: Object as () => GraphNode,
    default: () => ({})
  }
})

const emit = defineEmits(['update'])

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

watch(() => props.node, (newVal) => {
  console.log(newVal)
  if (newVal) {
    formData.value = newVal.data
  }
}, {
  deep: true,
  immediate: true,
})

const panelAttrsRef = ref()

function submitForm() {
  panelAttrsRef.value.formRef.validate((valid: boolean) => {
    if (valid) {
      console.log('panelAttrsRef.value.formSelf.value', toRaw(panelAttrsRef.value.formSelf))
      updateNode(props.node.id, { data: toRaw(panelAttrsRef.value.formSelf) })
    } else {
      console.log('校验失败')
    }
  })
}

// 移除节点
function removeNode() {
  console.log(props.node.id, getNodes.value )
  getNodes.value.forEach(node => {
    console.log(node)
    if (node.id === props.node.id) {
      removeNodes([node], true, true)
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
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5019607843);
}

.panel-header {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  color: #2d3748;
  border-bottom: 6px solid #6d6d6d;
  padding-bottom: 6px;
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