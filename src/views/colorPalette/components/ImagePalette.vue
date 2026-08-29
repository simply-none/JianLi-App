<template>
  <div class="image-palette">
    <!-- 上传 / 拖拽区 -->
    <div
      class="drop"
      :class="{ 'is-over': dragOver }"
      @click="pickFile"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <template v-if="previewUrl">
        <img :src="previewUrl" class="thumb" alt="预览" />
        <span class="drop-tip">点击或拖拽更换图片</span>
      </template>
      <template v-else>
        <LucideIcon name="ImagePlus" :size="26" class="drop-icon" />
        <span class="drop-tip">点击或拖拽图片提取主色</span>
      </template>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
    </div>

    <!-- 主色数量 -->
    <div v-if="previewUrl" class="count-row">
      <span class="lbl">主色数</span>
      <div class="seg">
        <button
          v-for="n in [4, 6, 8]"
          :key="n"
          class="seg-btn"
          :class="{ 'is-active': count === n }"
          @click="count = n"
        >
          {{ n }}
        </button>
      </div>
      <button class="save-btn" @click="saveAsPalette">
        <LucideIcon name="Save" :size="13" /> 存为色板
      </button>
    </div>

    <!-- 主色结果 -->
    <div v-if="extracted.length" class="swatches">
      <div v-for="(hex, i) in extracted" :key="i" class="sw" :title="`点击设为基准色 · ${hex.toUpperCase()}`" @click="useAsBase(hex)">
        <span class="chip" :style="{ background: hex }" />
        <span class="hex">{{ hex.toUpperCase() }}</span>
        <button class="mini" title="加入工作区" @click.stop="store.addSwatch(hex)">
          <LucideIcon name="Plus" :size="12" />
        </button>
      </div>
    </div>

    <!-- 色板名输入 -->
    <input
      v-if="previewUrl"
      v-model="paletteName"
      class="name-input"
      placeholder="色板名称（存为色板时使用）"
      spellcheck="false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { rgbToHex } from '../colorMath'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

/** 单像素 */
interface Pix {
  r: number
  g: number
  b: number
}

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const previewUrl = ref('')
const count = ref(6)
const extracted = ref<string[]>([])
const paletteName = ref('')
/** 已采样像素缓存，切换主色数时无需重新读取图片 */
let sampled: Pix[] = []

function pickFile() {
  fileInput.value?.click()
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) loadFile(f)
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) loadFile(f)
}

function loadFile(file: File) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  paletteName.value = `图片配色 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
  const img = new Image()
  img.onload = () => {
    const maxDim = 100
    const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    sampled = []
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 125) continue
      sampled.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    }
    extract()
  }
  img.src = previewUrl.value
}

/** 中位数切分法（median-cut）聚类主色 */
function extract() {
  if (sampled.length === 0) {
    extracted.value = []
    return
  }
  // 抽样上限，避免极端大图过慢
  const pool = sampled.length > 5000 ? sampled.filter((_, i) => i % Math.ceil(sampled.length / 5000) === 0) : sampled
  extracted.value = medianCut(pool, count.value).map((p) => rgbToHex(p))
}

/** 主色数切换时无需重新读取图片，直接对缓存像素重新聚类 */
watch(count, () => {
  if (sampled.length) extract()
})

/** 返回盒子各通道范围，取最大者作为切分轴 */
function channelRange(box: Pix[]): { axis: keyof Pix; range: number } {
  let rMin = 255
  let rMax = 0
  let gMin = 255
  let gMax = 0
  let bMin = 255
  let bMax = 0
  for (const p of box) {
    rMin = Math.min(rMin, p.r); rMax = Math.max(rMax, p.r)
    gMin = Math.min(gMin, p.g); gMax = Math.max(gMax, p.g)
    bMin = Math.min(bMin, p.b); bMax = Math.max(bMax, p.b)
  }
  const rr = rMax - rMin
  const gr = gMax - gMin
  const br = bMax - bMin
  if (rr >= gr && rr >= br) return { axis: 'r', range: rr }
  if (gr >= rr && gr >= br) return { axis: 'g', range: gr }
  return { axis: 'b', range: br }
}

/** 对像素集合做 median-cut，返回每组平均色（按占比降序） */
function medianCut(pixels: Pix[], target: number): Pix[] {
  let boxes: Pix[][] = [pixels]
  while (boxes.length < target) {
    let idx = 0
    let best = -1
    for (let i = 0; i < boxes.length; i++) {
      const rg = channelRange(boxes[i])
      if (rg.range > best) {
        best = rg.range
        idx = i
      }
    }
    if (best <= 0) break
    const box = boxes[idx]
    const { axis } = channelRange(box)
    box.sort((a, b) => a[axis] - b[axis])
    const mid = Math.floor(box.length / 2)
    boxes.splice(idx, 1, box.slice(0, mid), box.slice(mid))
  }
  return boxes
    .map((b) => ({
      color: {
        r: Math.round(b.reduce((s, p) => s + p.r, 0) / b.length),
        g: Math.round(b.reduce((s, p) => s + p.g, 0) / b.length),
        b: Math.round(b.reduce((s, p) => s + p.b, 0) / b.length),
      },
      n: b.length,
    }))
    .sort((a, b) => b.n - a.n)
    .map((x) => x.color)
}

/** 设为当前基准色 */
function useAsBase(hex: string) {
  store.setBaseFromHex(hex)
}

/** 存为色板（复用既有持久化） */
function saveAsPalette() {
  if (!extracted.value.length) return
  store.savePalette(paletteName.value.trim() || '图片配色', extracted.value)
}
</script>

<style scoped lang="scss">
.image-palette {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.drop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 96px;
  padding: 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--bg-base);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.12s, background 0.12s;
  &.is-over {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
  .drop-icon {
    color: var(--text-muted);
  }
  .drop-tip {
    font-size: 0.76rem;
    color: var(--text-muted);
  }
  .thumb {
    max-width: 100%;
    max-height: 84px;
    border-radius: 6px;
    object-fit: contain;
  }
}
.count-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  .lbl {
    font-size: 0.74rem;
    color: var(--text-muted);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    overflow: hidden;
    .seg-btn {
      width: 30px;
      padding: 5px 0;
      border: none;
      background: var(--bg-card);
      color: var(--text-secondary);
      font-size: 0.76rem;
      cursor: pointer;
      border-right: 1px solid var(--border-subtle);
      &:last-child {
        border-right: none;
      }
      &.is-active {
        background: var(--color-primary-light);
        color: var(--color-primary-solid);
        font-weight: 600;
      }
    }
  }
  .save-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    padding: 5px 10px;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-btn);
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
    font-size: 0.76rem;
    cursor: pointer;
    &:hover {
      background: var(--color-primary-hover);
    }
  }
}
.swatches {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  .sw {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 7px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    cursor: pointer;
    &:hover {
      background: var(--bg-hover);
    }
    .chip {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .hex {
      flex: 1;
      min-width: 0;
      font-size: 0.72rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--text-secondary);
    }
    .mini {
      width: 22px;
      height: 22px;
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      background: var(--bg-card);
      color: var(--text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      &:hover {
        color: var(--color-primary-solid);
        border-color: var(--color-primary);
      }
    }
  }
}
.name-input {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.76rem;
  outline: none;
  &:focus {
    border-color: var(--color-primary);
  }
}
</style>
