<template>
  <div class="color-field">
    <!-- 模式切换：纯色 / 渐变 -->
    <div class="cf-mode">
      <button :class="{ 'is-active': !hasGradient }" @click="toSolid">纯色</button>
      <button :class="{ 'is-active': hasGradient }" @click="toGradient">渐变</button>
    </div>

    <!-- 纯色 -->
    <template v-if="!hasGradient">
      <div class="cf-solid">
        <input
          type="color"
          class="cf-color"
          :value="modelColor || '#000000'"
          @input="onSolidColor($event)"
        />
        <div class="cf-palette">
          <button
            v-for="c in commonColors"
            :key="c"
            class="cf-swatch"
            :style="{ background: c }"
            :title="c"
            @click="onSolidColorRaw(c)"
          />
        </div>
      </div>
    </template>

    <!-- 渐变 -->
    <template v-else>
      <GradientEditor :model-value="gradientValue" @update:model-value="onGradient" />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 颜色字段（L3 原子组件）：纯色 / 渐变 二选一。
 * - 纯色：原生取色器 + 常用色板。
 * - 渐变：委托 GradientEditor（多色标 + 角度 + 预设）。
 * 父级通过两个独立事件拿到「纯色值」与「渐变对象」，再写入对应样式字段。
 */
import { computed } from 'vue';
import { QR_COMMON_COLORS, type QrGradient } from '@/utils/qrcode';
import GradientEditor from './GradientEditor.vue';

const props = defineProps<{
  modelColor?: string;
  modelGradient?: QrGradient | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelColor', value: string | undefined): void;
  (e: 'update:modelGradient', value: QrGradient | null): void;
}>();

const commonColors = QR_COMMON_COLORS;
const hasGradient = computed(() => !!props.modelGradient);

const gradientValue = computed<QrGradient>(
  () =>
    props.modelGradient ?? {
      gradientType: 'linear',
      rotation: 45,
      colorStops: [
        { offset: 0, color: '#2563eb' },
        { offset: 1, color: '#7c3aed' },
      ],
    },
);

function toSolid() {
  emit('update:modelGradient', null);
}
function toGradient() {
  emit('update:modelGradient', { ...gradientValue.value });
}
function onSolidColor(e: Event) {
  onSolidColorRaw((e.target as HTMLInputElement).value);
}
function onSolidColorRaw(c: string) {
  emit('update:modelColor', c);
  emit('update:modelGradient', null);
}
function onGradient(g: QrGradient) {
  emit('update:modelGradient', g);
}
</script>

<style scoped lang="scss">
.color-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-mode {
  display: inline-flex;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  overflow: hidden;
  width: fit-content;
  button {
    padding: 3px 12px;
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

.cf-solid {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.cf-color {
  width: 40px;
  height: 30px;
  padding: 2px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-card);
  cursor: pointer;
}
.cf-palette {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.cf-swatch {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  padding: 0;
  &:hover {
    transform: scale(1.12);
  }
}
</style>
