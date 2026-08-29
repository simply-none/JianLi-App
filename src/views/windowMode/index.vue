<template>
  <!--
    小窗设置页（页面壳）：按配置清单渲染各小窗区块，交互逻辑全部在 useWindowModeSetting。
    新增小窗只需在 config/windowSections.ts 追加一条记录。
    顶部 Tab 按小窗切换，同一时刻只展示一个区块，避免逐区块堆叠导致长滚动。
  -->
  <layout-vue>
    <template #main>
      <div class="setting-page">
        <!-- 顶部小窗切换 Tab（通用组件：单行不换行 + 滚轮横滚 + 滚动条仅 hover 显示） -->
        <TopTabs
          :tabs="sectionTabs"
          :model-value="activeTab"
          @update:modelValue="(k: string | number) => (activeTab = k as WindowKey)"
        />

        <!-- 当前选中小窗的设置区块（直接渲染当前选中项，避免 out-in 过渡卡在 opacity:0 导致空白） -->
        <WindowModeSection
          :key="activeSection.key"
          :section="activeSection"
          :config="configOf(activeSection.key)"
          :visible="shownOf(activeSection.key)"
          :custom="customDisplay[activeSection.key]"
          @toggle="(val: boolean) => setVisible(activeSection.key, val)"
          @apply="applyWindow(activeSection.key)"
          @select="({ field, value }: SelectPayload) => onSelect(activeSection.key, field, value)"
          @custom="(type: CustomFieldType) => openCustomModal(activeSection.key, type)"
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
import { ref, computed } from 'vue'
import LayoutVue from '@/components/layout.vue'
import TopTabs, { type TopTabItem } from '@/components/TopTabs.vue'
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

// 当前选中的小窗（Tab 切换的本地状态）
const activeTab = ref<WindowKey>(WINDOW_SECTIONS[0].key)
const activeSection = computed(() => WINDOW_SECTIONS.find((s) => s.key === activeTab.value)!)

// 顶部 Tab 数据源：复用 WINDOW_SECTIONS 的 key/title/icon（不指定 color，回退主题主色）
const sectionTabs: TopTabItem[] = WINDOW_SECTIONS.map((s) => ({
  key: s.key,
  label: s.title,
  icon: s.icon,
}))

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
