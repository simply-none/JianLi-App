<template>
  <div class="color-canvas">
    <!-- 饱和度/明度 二维取色区 -->
    <canvas
      ref="svCanvas"
      class="sv-area"
      :width="W"
      :height="H"
      @pointerdown="onSvDown"
      @pointermove="onSvMove"
      @pointerup="endSv"
      @pointercancel="endSv"
    />
    <!-- 色相条 -->
    <canvas
      ref="hueCanvas"
      class="hue-strip"
      :width="W"
      :height="HUE_H"
      @pointerdown="onHueDown"
      @pointermove="onHueMove"
      @pointerup="endHue"
      @pointercancel="endHue"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { hsvToHex } from '../colorMath'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

const W = 280
const H = 200
const HUE_H = 16

const svCanvas = ref<HTMLCanvasElement>()
const hueCanvas = ref<HTMLCanvasElement>()
let draggingSv = false
let draggingHue = false

/** 绘制饱和度/明度方块（底色为当前色相，叠加白→透明、透明→黑） */
function drawSV() {
  const cv = svCanvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')!
  const h = store.baseHsv.h
  // 底色（满饱和满明度的当前色相）
  ctx.fillStyle = hsvToHex({ h, s: 100, v: 100 })
  ctx.fillRect(0, 0, W, H)
  // 白：左不透明 → 右透明（饱和度方向）
  const wg = ctx.createLinearGradient(0, 0, W, 0)
  wg.addColorStop(0, 'rgba(255,255,255,1)')
  wg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = wg
  ctx.fillRect(0, 0, W, H)
  // 黑：上透明 → 下不透明（明度方向）
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, 'rgba(0,0,0,0)')
  bg.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // 当前位置标记
  const x = (store.baseHsv.s / 100) * W
  const y = (1 - store.baseHsv.v / 100) * H
  ctx.strokeStyle = store.baseHsv.v > 50 ? '#000' : '#fff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.stroke()
}

/** 绘制色相条 */
function drawHue() {
  const cv = hueCanvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, W, 0)
  for (let i = 0; i <= 6; i++) {
    g.addColorStop(i / 6, hsvToHex({ h: (i * 60) % 360, s: 100, v: 100 }))
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, HUE_H)
  // 当前色相标记
  const x = (store.baseHsv.h / 360) * W
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x - 5, -4)
  ctx.lineTo(x + 5, -4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

/** 读取指针在元素内的相对坐标（兼容 CSS 缩放） */
function relPos(e: PointerEvent, el: HTMLElement, axisW: number, axisH: number) {
  const rect = el.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * axisW
  const y = ((e.clientY - rect.top) / rect.height) * axisH
  return { x: Math.max(0, Math.min(axisW, x)), y: Math.max(0, Math.min(axisH, y)) }
}

function onSvDown(e: PointerEvent) {
  draggingSv = true
  svCanvas.value?.setPointerCapture(e.pointerId)
  updateSv(e)
}
function onSvMove(e: PointerEvent) {
  if (draggingSv) updateSv(e)
}
/** 左键松开即固定颜色：复位拖拽标志并释放指针捕获，之后 hover 不再改变取色 */
function endSv(e: PointerEvent) {
  draggingSv = false
  svCanvas.value?.releasePointerCapture?.(e.pointerId)
}
function updateSv(e: PointerEvent) {
  const el = svCanvas.value!
  const { x, y } = relPos(e, el, W, H)
  const s = (x / W) * 100
  const v = (1 - y / H) * 100
  store.setBaseHsv({ ...store.baseHsv, s, v })
}

function onHueDown(e: PointerEvent) {
  draggingHue = true
  hueCanvas.value?.setPointerCapture(e.pointerId)
  updateHue(e)
}
function onHueMove(e: PointerEvent) {
  if (draggingHue) updateHue(e)
}
/** 色相条同样在松开左键后固定，避免 hover 误改色相 */
function endHue(e: PointerEvent) {
  draggingHue = false
  hueCanvas.value?.releasePointerCapture?.(e.pointerId)
}
function updateHue(e: PointerEvent) {
  const el = hueCanvas.value!
  const { x } = relPos(e, el, W, HUE_H)
  const h = (x / W) * 360
  store.setBaseHsv({ ...store.baseHsv, h })
}

onMounted(() => {
  drawSV()
  drawHue()
})
// 色相变化时重绘 SV 底色；任意分量变化重绘标记
watch(
  () => [store.baseHsv.h, store.baseHsv.s, store.baseHsv.v],
  () => {
    drawSV()
    drawHue()
  },
)
</script>

<style scoped lang="scss">
.color-canvas {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.sv-area {
  width: 100%;
  aspect-ratio: 280 / 200;
  border-radius: var(--radius-card);
  cursor: crosshair;
  touch-action: none;
  border: 1px solid var(--border-subtle);
}
.hue-strip {
  width: 100%;
  height: 16px;
  border-radius: 8px;
  cursor: pointer;
  touch-action: none;
  border: 1px solid var(--border-subtle);
}
</style>
