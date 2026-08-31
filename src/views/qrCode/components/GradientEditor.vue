<template>
  <div class="gradient-editor">
    <!-- 类型 + 角度 -->
    <div class="ge-row">
      <div class="ge-seg">
        <button
          :class="{ 'is-active': modelValue.gradientType !== 'radial' }"
          @click="setType('linear')"
        >
          线性
        </button>
        <button
          :class="{ 'is-active': modelValue.gradientType === 'radial' }"
          @click="setType('radial')"
        >
          径向
        </button>
      </div>
      <label class="ge-rot">
        <span>角度 {{ modelValue.rotation ?? 0 }}°</span>
        <input
          type="range"
          min="0"
          max="360"
          :value="modelValue.rotation ?? 0"
          @input="setRotation($event)"
        />
      </label>
    </div>

    <!-- 色标列表 -->
    <div class="ge-stops">
      <div v-for="(s, i) in stops" :key="i" class="ge-stop">
        <input
          type="color"
          class="ge-color"
          :value="s.color"
          @input="setStopColor(i, $event)"
        />
        <input
          type="range"
          class="ge-offset"
          min="0"
          max="100"
          :value="Math.round(s.offset * 100)"
          @input="setStopOffset(i, $event)"
        />
        <span class="ge-offset-val">{{ Math.round(s.offset * 100) }}%</span>
        <button
          v-if="stops.length > 1"
          class="ge-del"
          title="删除该色标"
          @click="removeStop(i)"
        >
          ×
        </button>
      </div>
    </div>

    <div class="ge-actions">
      <button class="ge-add" @click="addStop">+ 添加色标</button>
      <div class="ge-presets">
        <button
          v-for="p in gradientPresets"
          :key="p.id"
          class="ge-preset"
          :title="p.label"
          @click="applyPreset(p)"
        >
          <span class="ge-preset-bar" :style="presetBarStyle(p.gradient)"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 渐变编辑器（L3 原子组件）
 * - 仅负责「渐变对象」的编辑，不涉及纯色模式（纯色由父级 color input 处理）。
 * - 输出标准化 QrGradient：emit 前按 offset 升序排列色标。
 */
import { computed } from 'vue';
import { QR_GRADIENT_PRESETS, type QrGradientPreset } from '@/utils/qrcode';
import type { QrGradient } from '@/utils/qrcode';

const props = defineProps<{
  modelValue: QrGradient;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: QrGradient): void;
}>();

const gradientPresets = QR_GRADIENT_PRESETS;

// 内部维护一份可变副本（避免直接改 props）
const stops = computed(() => props.modelValue.colorStops ?? []);

function emitNext(next: Partial<QrGradient>) {
  const merged: QrGradient = {
    gradientType: props.modelValue.gradientType ?? 'linear',
    rotation: props.modelValue.rotation ?? 0,
    colorStops: [...(props.modelValue.colorStops ?? [])],
    ...next,
  };
  // 色标按 offset 升序，保证库渲染正确
  merged.colorStops = [...merged.colorStops].sort((a, b) => a.offset - b.offset);
  emit('update:modelValue', merged);
}

function setType(t: 'linear' | 'radial') {
  emitNext({ gradientType: t });
}
function setRotation(e: Event) {
  emitNext({ rotation: Number((e.target as HTMLInputElement).value) });
}
function setStopColor(i: number, e: Event) {
  const color = (e.target as HTMLInputElement).value;
  const next = stops.value.map((s, idx) => (idx === i ? { ...s, color } : s));
  emitNext({ colorStops: next });
}
function setStopOffset(i: number, e: Event) {
  const offset = Number((e.target as HTMLInputElement).value) / 100;
  const next = stops.value.map((s, idx) => (idx === i ? { ...s, offset } : s));
  emitNext({ colorStops: next });
}
function removeStop(i: number) {
  if (stops.value.length <= 1) return;
  emitNext({ colorStops: stops.value.filter((_, idx) => idx !== i) });
}
function addStop() {
  const last = stops.value[stops.value.length - 1];
  const next = [
    ...stops.value,
    { offset: 1, color: last ? last.color : '#000000' },
  ];
  emitNext({ colorStops: next });
}
function applyPreset(p: QrGradientPreset) {
  emit('update:modelValue', {
    gradientType: p.gradient.gradientType ?? 'linear',
    rotation: p.gradient.rotation ?? 0,
    colorStops: p.gradient.colorStops.map((c) => ({ ...c })),
  });
}

/** 预设小色条背景 */
function presetBarStyle(g: QrGradient): Record<string, string> {
  const dir = g.gradientType === 'radial' ? 'radial' : `linear(${g.rotation ?? 0}deg)`;
  const stopsStr = (g.colorStops ?? [])
    .map((c) => `${c.color} ${Math.round(c.offset * 100)}%`)
    .join(', ');
  return { background: `${dir}, ${stopsStr}` };
}
</script>

<style scoped lang="scss">
.gradient-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ge-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ge-seg {
  display: inline-flex;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  overflow: hidden;
  button {
    padding: 4px 12px;
    font-size: 12px;
    background: var(--bg-card);
    color: var(--text-muted);
    cursor: pointer;
    border: none;
    &:not(:last-child) {
      border-right: 1px solid var(--border-subtle);
    }
    &.is-active {
      background: var(--color-primary);
      color: #fff;
    }
  }
}

.ge-rot {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  input[type='range'] {
    width: 100%;
    accent-color: var(--color-primary);
  }
}

.ge-stops {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ge-stop {
  display: flex;
  align-items: center;
  gap: 8px;
  input[type='color'] {
    width: 34px;
    height: 28px;
    padding: 2px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--bg-card);
    cursor: pointer;
  }
  .ge-offset {
    flex: 1;
    accent-color: var(--color-primary);
  }
  .ge-offset-val {
    width: 34px;
    text-align: right;
    font-size: 11px;
    color: var(--text-muted);
  }
  .ge-del {
    width: 22px;
    height: 22px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--bg-card);
    color: var(--text-muted);
    cursor: pointer;
    line-height: 1;
    &:hover {
      border-color: var(--color-error, #e11d48);
      color: var(--color-error, #e11d48);
    }
  }
}

.ge-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ge-add {
  font-size: 12px;
  padding: 4px 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.ge-presets {
  display: inline-flex;
  gap: 6px;
}
.ge-preset {
  width: 30px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  cursor: pointer;
  overflow: hidden;
  &:hover {
    border-color: var(--color-primary);
  }
}
.ge-preset-bar {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
