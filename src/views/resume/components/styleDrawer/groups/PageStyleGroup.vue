<template>
  <div class="page-style-group">
    <div class="g-row">
      <span class="g-label">正文字号 {{ model.fontSize }}pt</span>
      <el-slider v-model="model.fontSize" size="small" :min="8" :max="12" :step="0.5" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">行高 {{ model.lineHeight }}</span>
      <el-slider v-model="model.lineHeight" size="small" :min="1.2" :max="1.8" :step="0.05" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">字体</span>
      <el-radio-group v-model="model.fontFamily" size="small" @change="notify">
        <el-radio-button value="sans">无衬线</el-radio-button>
        <el-radio-button value="serif">衬线</el-radio-button>
      </el-radio-group>
      <el-select
        v-model="model.fontFamilyName"
        class="font-select"
        size="small"
        filterable
        clearable
        placeholder="默认字体"
        title="自定义字体（清空 = 跟随衬线/无衬线默认栈）"
        @change="notify"
      >
        <el-option v-for="f in fontOptions" :key="f.value" :value="f.value" :label="f.label" />
      </el-select>
    </div>
    <div class="g-row">
      <span class="g-label">左右边距 {{ model.paddingX }}mm</span>
      <el-slider v-model="model.paddingX" size="small" :min="8" :max="20" :step="1" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">上下边距 {{ model.paddingY }}mm</span>
      <el-slider v-model="model.paddingY" size="small" :min="8" :max="20" :step="1" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">模块间距 {{ model.sectionGap }}px</span>
      <el-slider v-model="model.sectionGap" size="small" :min="4" :max="28" :step="1" class="slider" @input="notify" />
    </div>
    <div class="g-row">
      <span class="g-label">条目间距 {{ model.entryGap }}px</span>
      <el-slider v-model="model.entryGap" size="small" :min="0" :max="20" :step="1" class="slider" @input="notify" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import useGlobalSetting from '@/store/useGlobalSetting'
import type { PageStyle } from '../../../engine/types'

/**
 * 页面全局配置组
 * 正文字号/行高/字体（衬线·无衬线 + 自定义字体下拉）/边距/间距。
 * 字体选项与设置页「字体设置」一致：内置字体列表 + 主进程 get-fonts 返回的系统字体。
 * 控件直接绑定 props.model（动态访问），mutate 后经 change 通知父级。
 */
defineProps<{
  /** 页面全局配置（draft 内引用） */
  model: PageStyle
}>()

const emit = defineEmits<{
  /** 配置变更通知 */
  (e: 'change'): void
}>()

/** 通知父级配置变更 */
function notify() {
  emit('change')
}

/** 系统已安装字体（主进程 get-fonts 返回，结构 { label, value }） */
const sysFonts = ref<{ label: string; value: string }[]>([])
/** 设置页管理的内置字体选项 */
const { globalFontOpsC } = storeToRefs(useGlobalSetting())

/** 合并去重后的字体下拉选项 */
const fontOptions = computed(() => {
  const ops = [...(globalFontOpsC.value || []), ...sysFonts.value]
  return ops.filter(
    (item, index, self) => item && item.value && self.findIndex((i) => i.value === item.value) === index
  )
})

// 拉取系统字体（与设置页一致）
onMounted(() => {
  ;(window as any).ipcRenderer
    .handlePromise('get-fonts', {})
    .then((result: any) => {
      sysFonts.value = result || []
    })
    .catch((err: any) => {
      console.error('获取系统字体失败', err)
    })
})
</script>

<style scoped>
.page-style-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.g-label {
  font-size: 12px;
  color: var(--skin-text-secondary, #666);
  width: 110px;
  flex-shrink: 0;
}
.font-select {
  flex: 1;
  min-width: 0;
}
.slider {
  flex: 1;
}
</style>
