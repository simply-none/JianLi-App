<!--
  思维导图 —— 画布设置（画布右上角的小按钮 + 下拉面板）。

  当前只放两项：**字体** 与 **字号**（用户指定的第一批）。

  为什么这两项是「**文档级**」而不是全局设置 / localStorage：
    它们属于**内容版式** —— 同一份导图在别人机器上打开应该长得一样，
    导出的 JSON / SVG / PNG 也该把字体与字号带走。所以值落在 `MindDocData`
    （`fontFamily` / `fontSize`，见 types.ts 的说明），写入走 `useMindDoc.setFontFamily`
    / `setFontSize` → `commitData`（可撤销、`revision +1` ⇒ 画布自动重排并重新量尺寸）。
    （对比：MiniMap 开关是「这台机器上我喜欢怎么看」，所以它走 localStorage。）

  字体列表**复用设置页那一套**：`get-fonts` IPC（主进程 font-list，懒加载 + 缓存）
  + `useGlobalSetting.globalFontOpsC` 预设，**零新增主进程通道**。
  ⚠️ 但**刻意不列出 `initial`**（`globalFontOpsC` 的默认项「系统字体」）：
     `font-family: initial` 对节点而言是「UA 默认字体」（会渲染成衬线体），
     与「跟随应用字体」（继承应用的全局字体）**不是一回事**，列出来必然被误选。
     所以两侧都归一：这里不展示，`utils/tree.ts` 的 `normalizeFontFamily` 也把它折成
     「跟随应用」—— 规则只有一份，反序列化与 UI 写入共用。

  位置：画布**右上角**。此前的右上角是空的（分支聚焦浮条在顶部居中、缩略图与缩放条在
  右下），所以不会与任何现有浮层抢位。面板用 `el-popover`（teleport 到 body）而不是
  自绘绝对定位块：画布容器有 `overflow: hidden`，贴边面板在窄画布下会被裁；而这里
  不需要像 `MindSearchBox` 那样接管键盘，用现成组件更稳（外点关闭 / Esc / 视口翻转都是它管）。

  交互取舍：**字号只在松手（`change`）时才写文档**，拖动过程中只更新数字与预览。
    理由是每一笔写入都会进撤销栈 —— 若按 `input` 逐帧写，从 13 拖到 20 会留下十几个
    撤销步，Ctrl+Z 要按十几次才退回去。
-->
<template>
  <div class="mind-setting">
    <el-popover
      v-model:visible="open"
      placement="bottom-end"
      :width="300"
      trigger="click"
      :show-arrow="false"
      :offset="8"
      popper-class="mind-setting-popper"
    >
      <template #reference>
        <button
          type="button"
          class="mind-setting__trigger"
          :class="{ 'is-active': open }"
          title="画布设置（字体 / 字号）"
        >
          <LucideIcon name="Settings" :size="16" />
        </button>
      </template>

      <div class="mind-setting__body">
        <!-- ------------------------------------------------------------ 字体 -->
        <section class="mind-setting__group">
          <header class="mind-setting__label">
            <span>字体</span>
            <span class="mind-setting__hint">只影响本导图</span>
          </header>

          <el-select-v2
            v-model="family"
            class="mind-setting__select"
            :options="fontOptions"
            filterable
            :item-height="56"
            placeholder="跟随应用字体"
            popper-class="mind-setting-font-popper"
            @change="onFamilyChange"
          >
            <template #default="{ item }">
              <span class="mind-setting__font-box" :style="{ fontFamily: item.value }">
                <span class="mind-setting__font-name">{{ item.label }}</span>
                <span class="mind-setting__font-sample">预览字体：中文 English 123</span>
              </span>
            </template>
          </el-select-v2>
        </section>

        <!-- ------------------------------------------------------------ 字号 -->
        <section class="mind-setting__group">
          <header class="mind-setting__label">
            <span>字号</span>
            <span class="mind-setting__hint">全图统一 · 中心主题更大</span>
          </header>

          <div class="mind-setting__size-row">
            <el-slider
              v-model="sizeDraft"
              class="mind-setting__slider"
              :min="FONT_SIZE_RANGE.min"
              :max="FONT_SIZE_RANGE.max"
              :step="FONT_SIZE_RANGE.step"
              :show-tooltip="false"
              @change="commitSize"
            />
            <span class="mind-setting__size-value">{{ sizeText }}px</span>
          </div>

          <!-- 比例预览：三档字号由 fontSizeOf 现算，与画布上是同一个函数 -->
          <div class="mind-setting__preview" :style="{ fontFamily: previewFamily }">
            <span :style="{ fontSize: `${previewSize(0)}px` }">中心主题</span>
            <span :style="{ fontSize: `${previewSize(1)}px` }">一级主题</span>
            <span :style="{ fontSize: `${previewSize(2)}px` }">二级主题</span>
          </div>

          <footer class="mind-setting__foot">
            <button
              type="button"
              class="mind-setting__reset"
              :disabled="!sizeTouched"
              @click="resetSize"
            >
              <LucideIcon name="RotateCcw" :size="12" />
              字号恢复默认
            </button>
          </footer>
        </section>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import LucideIcon from '@/components/LucideIcon.vue'
import { FONT_INHERIT_VALUE, FONT_SIZE_RANGE, fontSizeOf } from '../constants'
import { useMindDoc } from '../composables/useMindDoc'
import useGlobalSetting from '@/store/useGlobalSetting'
import { storeToRefs } from 'pinia'

/** 字体下拉的一项（与设置页 / `get-fonts` 的返回形状一致） */
interface FontOption {
  label: string
  value: string
}

const mind = useMindDoc()
const { globalFontOpsC } = storeToRefs(useGlobalSetting())

/** 面板开合（由 el-popover 的双向绑定驱动） */
const open = ref(false)

/* ---------------------------------------------------------------- 字体 */

/**
 * 「跟随应用字体」之外一律不用：`initial` 是 UA 默认字体、空串是无效值，
 * 两者都被 `normalizeFontFamily` 折成「不覆盖 font-family」，
 * 所以列表里列出来就只会误导（见文件头说明）。
 */
const UNUSABLE_FONT_VALUES = ['', FONT_INHERIT_VALUE, 'initial']

/** 系统字体（懒加载：面板首次打开时才去问主进程，避免进页面就枚举上千个字体） */
const sysFonts = ref<FontOption[]>([])
let fontsRequested = false

function loadFonts() {
  window.ipcRenderer
    .handlePromise<FontOption[]>('get-fonts', {})
    .then((result) => {
      sysFonts.value = Array.isArray(result) ? result : []
    })
    .catch(() => {
      // 主进程通道不可用 / 枚举失败：只留预设与「跟随应用字体」，功能不受影响
      sysFonts.value = []
    })
}

/** 预设（设置页维护）+ 系统字体，按 value 去重；第一项固定是「跟随应用字体」 */
const fontOptions = computed<FontOption[]>(() => {
  // `globalFontOpsC` 的元素类型里 `label` / `value` 都是**可选**的（历史包袱）：
  // 统一收口成两个字段都是字符串的形状，否则下拉里会混进半张空项，且后面按 value 去重会比较到 undefined。
  const presets: FontOption[] = globalFontOpsC.value
    .map((item) => ({ label: item.label ?? item.value ?? '', value: item.value ?? '' }))
    .filter((item) => Boolean(item.value))

  const merged: FontOption[] = [
    { label: '跟随应用字体', value: FONT_INHERIT_VALUE },
    ...presets,
    ...sysFonts.value,
  ].filter((item) => !UNUSABLE_FONT_VALUES.includes(item.value))
  return merged.filter((item, index) => merged.findIndex((other) => other.value === item.value) === index)
})

/** 文档里的字体族 → 下拉的选中值（未设 = 跟随应用字体） */
function toOptionValue(family?: string): string {
  return family || FONT_INHERIT_VALUE
}

const family = ref(toOptionValue(mind.fontFamily.value))

// 撤销 / 换文档 / 导入之后，面板上的选中值要跟着回正
watch(
  () => mind.fontFamily.value,
  (value) => {
    family.value = toOptionValue(value)
  },
)

function onFamilyChange(value: string) {
  mind.setFontFamily(value)
}

/* ---------------------------------------------------------------- 字号 */

/**
 * 草稿值：拖动过程中只改它（以及预览），**不进文档**。
 * 松手（`change`）才调 `commitSize` —— 理由见文件头「交互取舍」。
 */
const sizeDraft = ref(mind.fontSize.value)

watch(
  () => mind.fontSize.value,
  (value) => {
    sizeDraft.value = value
  },
)

const sizeText = computed(() => String(Math.round(sizeDraft.value * 10) / 10))
/** 是否偏离过默认值（决定「字号恢复默认」是否可点） */
const sizeTouched = computed(() => Math.abs(sizeDraft.value - mind.fontSize.value) > 0.001 || Boolean(mind.doc.value.data.fontSize))

function commitSize() {
  mind.setFontSize(sizeDraft.value)
}

function resetSize() {
  mind.setFontSize(undefined)
}

/** 预览用的字体族：未设时留空 = 继承（与画布上的节点行为一致） */
const previewFamily = computed(() => mind.fontFamily.value || '')

/** 三档字号：**必须**用画布/测量同一个 `fontSizeOf(level, base)`，预览才不会骗人 */
function previewSize(level: number): number {
  return fontSizeOf(level, sizeDraft.value)
}

/* ---------------------------------------------------------------- 懒加载 */

watch(open, (value) => {
  if (!value || fontsRequested) return
  fontsRequested = true
  loadFonts()
})

onUnmounted(() => {
  fontsRequested = true
})
</script>

<style scoped lang="scss">
/*
  位置与缩放条（`MindZoomBar`）同一层级：绝对定位在 `.mind-canvas` 内部、贴右上角。
  注意 `.mind-canvas` 有 `overflow: hidden`，但**按钮只有 32×32、贴着右缘**，
  不会被裁（会被裁的是「向画布外溢出的面板」—— 那个走 el-popover 的 teleport）。
*/
.mind-setting {
  position: absolute;
  right: 16px;
  top: 12px;
  z-index: 6;
}

.mind-setting__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;

  &:hover,
  &.is-active {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

/* 面板内容（样式作用域内 —— el-popover 的内容仍然由本组件渲染，带 scope 属性） */
.mind-setting__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mind-setting__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mind-setting__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.mind-setting__hint {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
}

.mind-setting__select {
  width: 100%;
}

.mind-setting__font-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  height: 56px;
  min-width: 0;
}

.mind-setting__font-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mind-setting__font-sample {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mind-setting__size-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mind-setting__slider {
  flex: 1;
  min-width: 0;
}

.mind-setting__size-value {
  flex: none;
  width: 44px;
  color: var(--text-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.mind-setting__preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-primary);
  line-height: 1.4;
}

.mind-setting__foot {
  display: flex;
  justify-content: flex-end;
}

.mind-setting__reset {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}
</style>

<!--
  非 scoped：`el-popover` / el-select-v2 的 popper 是**挂在 body 上的**，
  它们由 Element Plus 创建、拿不到本组件的 scope 属性 ——
  而 `.mind-setting-popper` / `.mind-setting-font-popper` 是通过 `popper-class` 传下去的名字，
  所以只能用这两个类名在这里圈定范围（这也是全项目处理 Element popper 的既有方式）。
  这里只用 `--bg-* / --text-* / --border-* / --color-*` 这些**根级**令牌：
  面板已经脱离 `.mind-canvas`，`--mm-*` 那套在它身上是取不到的。
-->
<style lang="scss">
.mind-setting-popper.el-popover.el-popper {
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.mind-setting-font-popper .el-select-dropdown__item {
  color: var(--text-primary);
}
</style>
