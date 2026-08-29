<template>
  <div class="color-sliders">
    <!-- HSV 滑块 -->
    <div class="slider-row">
      <span class="sl-label">H</span>
      <input
        class="sl-input"
        type="range"
        min="0"
        max="360"
        step="1"
        :value="store.baseHsv.h"
        @input="onH($event)"
      />
      <span class="sl-val">{{ Math.round(store.baseHsv.h) }}</span>
    </div>
    <div class="slider-row">
      <span class="sl-label">S</span>
      <input
        class="sl-input"
        type="range"
        min="0"
        max="100"
        step="1"
        :value="store.baseHsv.s"
        @input="onS($event)"
      />
      <span class="sl-val">{{ Math.round(store.baseHsv.s) }}</span>
    </div>
    <div class="slider-row">
      <span class="sl-label">V</span>
      <input
        class="sl-input"
        type="range"
        min="0"
        max="100"
        step="1"
        :value="store.baseHsv.v"
        @input="onV($event)"
      />
      <span class="sl-val">{{ Math.round(store.baseHsv.v) }}</span>
    </div>

    <div class="divider" />

    <!-- RGB 滑块 -->
    <div class="slider-row">
      <span class="sl-label">R</span>
      <input
        class="sl-input"
        type="range"
        min="0"
        max="255"
        step="1"
        :value="rgb.r"
        @input="onR($event)"
      />
      <span class="sl-val">{{ rgb.r }}</span>
    </div>
    <div class="slider-row">
      <span class="sl-label">G</span>
      <input
        class="sl-input"
        type="range"
        min="0"
        max="255"
        step="1"
        :value="rgb.g"
        @input="onG($event)"
      />
      <span class="sl-val">{{ rgb.g }}</span>
    </div>
    <div class="slider-row">
      <span class="sl-label">B</span>
      <input
        class="sl-input"
        type="range"
        min="0"
        max="255"
        step="1"
        :value="rgb.b"
        @input="onB($event)"
      />
      <span class="sl-val">{{ rgb.b }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { hsvToRgb, rgbToHsv } from '../colorMath'
import useColorPalette from '../useColorPalette'

const store = useColorPalette()

const rgb = computed(() => hsvToRgb(store.baseHsv))

function onH(e: Event) {
  store.setBaseHsv({ ...store.baseHsv, h: Number((e.target as HTMLInputElement).value) })
}
function onS(e: Event) {
  store.setBaseHsv({ ...store.baseHsv, s: Number((e.target as HTMLInputElement).value) })
}
function onV(e: Event) {
  store.setBaseHsv({ ...store.baseHsv, v: Number((e.target as HTMLInputElement).value) })
}
function onR(e: Event) {
  store.setBaseHsv(rgbToHsv({ ...rgb.value, r: Number((e.target as HTMLInputElement).value) }))
}
function onG(e: Event) {
  store.setBaseHsv(rgbToHsv({ ...rgb.value, g: Number((e.target as HTMLInputElement).value) }))
}
function onB(e: Event) {
  store.setBaseHsv(rgbToHsv({ ...rgb.value, b: Number((e.target as HTMLInputElement).value) }))
}
</script>

<style scoped lang="scss">
.color-sliders {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sl-label {
  width: 14px;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
}
.sl-input {
  flex: 1;
  accent-color: var(--color-primary);
  cursor: pointer;
}
.sl-val {
  width: 34px;
  text-align: right;
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 0;
}
</style>
