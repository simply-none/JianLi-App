<template>
  <!--
    小窗设置页（页面壳）：按配置清单渲染各小窗区块，交互逻辑全部在 useWindowModeSetting。
    新增小窗只需在 config/windowSections.ts 追加一条记录。
  -->
  <layout-vue>
    <template #main>
      <div class="setting-page">
        <WindowModeSection
          v-for="section in WINDOW_SECTIONS"
          :key="section.key"
          :section="section"
          :config="configOf(section.key)"
          :visible="shownOf(section.key)"
          :custom="customDisplay[section.key]"
          @toggle="(val: boolean) => setVisible(section.key, val)"
          @apply="applyWindow(section.key)"
          @select="({ field, value }: SelectPayload) => onSelect(section.key, field, value)"
          @custom="(type: CustomFieldType) => openCustomModal(section.key, type)"
        />

        <WindowModeCustomDialog
          v-model="showModal"
          :type="modalType"
          :title="modalTitle"
          :initial="modalInitial"
          @confirm="submitCustom"
        />
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LayoutVue from '@/components/layout.vue'
import WindowModeSection from './components/WindowModeSection.vue'
import WindowModeCustomDialog from './components/WindowModeCustomDialog.vue'
import { useWindowModeSetting, type CustomFieldType } from './composables/useWindowModeSetting'
import { WINDOW_SECTIONS, type WindowKey } from './config/windowSections'

type SelectPayload = {
  field: 'position' | 'size' | 'gap' | 'skin' | 'layout'
  value: any
}

const {
  configMap,
  shownMap,
  setPosition,
  setSize,
  setGap,
  setSkin,
  setLayout,
  setVisible,
  applyWindow,
  showModal,
  modalType,
  modalTitle,
  customPosition,
  customSize,
  customGap,
  customDisplay,
  openCustomModal,
  submitCustom,
} = useWindowModeSetting()

// 模板中 Record 内的 Ref 不会自动解包，统一经方法取值（同时建立响应式依赖）
function configOf(key: WindowKey) {
  return configMap[key].value
}

function shownOf(key: WindowKey) {
  return shownMap[key].value
}

// 各配置项的选择统一在此分发
function onSelect(key: WindowKey, field: SelectPayload['field'], value: any) {
  if (field === 'position') setPosition(key, value)
  else if (field === 'size') setSize(key, value.width, value.height)
  else if (field === 'gap') setGap(key, value)
  else if (field === 'skin') setSkin(key, value)
  else setLayout(key, value)
}

// 弹窗初始值：位置固定从 (0,0) 起填，尺寸与间隙沿用当前配置
const modalInitial = computed(() => ({
  x: customPosition.value.x,
  y: customPosition.value.y,
  width: customSize.value.width,
  height: customSize.value.height,
  gap: customGap.value,
}))
</script>

<style scoped lang="scss">
:deep(.main) {
  padding: 0 !important;
}

.setting-page {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: 20px;
}
</style>
